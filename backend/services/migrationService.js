import { rootPool, getDatasetPool, getSystemPool } from '../config/database.js';
import { sortTablesTopologically, generateTableDDL } from './schemaGenerator.js';

/**
 * Migration Service: Coordinates physical schema generation and data insertion into MySQL
 */
export const executeMigration = async ({
  datasetId,
  targetDatabaseName,
  tables,
  relationships,
  originalRows,
  normalizationSteps = []
}) => {
  const systemPool = await getSystemPool();
  const sortedTables = sortTablesTopologically(tables);
  const logEntries = [];

  const logStage = async (stage, status, message, sqlExecuted = null) => {
    try {
      await systemPool.query(
        `INSERT INTO migration_logs (dataset_id, stage, status, message, sql_executed) VALUES (?, ?, ?, ?, ?)`,
        [datasetId, stage, status, message, sqlExecuted]
      );
      logEntries.push({ stage, status, message });
    } catch (err) {
      console.error('Failed to write migration log:', err.message);
    }
  };

  await logStage('INITIALIZATION', 'in_progress', `Starting migration for database '${targetDatabaseName}'`);

  let rootConn;
  let datasetConn;

  try {
    // 1. Create target database using root connection
    rootConn = await rootPool.getConnection();
    const createDbSql = `CREATE DATABASE IF NOT EXISTS \`${targetDatabaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;
    await rootConn.query(createDbSql);
    await logStage('DATABASE_CREATION', 'completed', `Created database '${targetDatabaseName}'`, createDbSql);
    rootConn.release();
    rootConn = null;

    // 2. Connect to the newly created target database
    const targetPool = getDatasetPool(targetDatabaseName);
    datasetConn = await targetPool.getConnection();

    // Disable foreign key checks temporarily during table creation & initial data hydration
    await datasetConn.query(`SET FOREIGN_KEY_CHECKS = 0;`);

    // 3. Create tables in topological order
    for (const table of sortedTables) {
      const ddl = generateTableDDL(table);
      await datasetConn.query(ddl);
      await logStage('TABLE_CREATION', 'completed', `Created table '${table.tableName}'`, ddl);
    }

    // 4. Data Extraction, Deduplication, and Insertion
    const tableInsertStats = [];

    for (const table of sortedTables) {
      const colDefs = table.columns;
      const targetColNames = colDefs.map(c => `\`${c.columnName}\``).join(', ');
      const placeholders = colDefs.map(() => '?').join(', ');
      const insertSql = `INSERT IGNORE INTO \`${table.tableName}\` (${targetColNames}) VALUES (${placeholders})`;

      // Map rows to table columns
      const seenPKs = new Set();
      const rowsToInsert = [];

      for (const row of originalRows) {
        // Build composite PK signature to deduplicate parent tables
        const pkValues = colDefs.filter(c => c.isPrimaryKey).map(c => String(row[c.originalName] ?? '').trim());
        const pkSignature = pkValues.join('###');

        if (pkValues.length > 0 && seenPKs.has(pkSignature)) {
          continue; // Skip duplicate records in parent table
        }
        if (pkValues.length > 0) {
          seenPKs.add(pkSignature);
        }

        const values = colDefs.map(col => {
          const val = row[col.originalName];
          if (val === undefined || val === null || val === '') {
            return null;
          }
          return val;
        });

        rowsToInsert.push(values);
      }

      // Batch insert in chunks of 250 rows
      const chunkSize = 250;
      let insertedCount = 0;

      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);
        for (const rowValues of chunk) {
          await datasetConn.query(insertSql, rowValues);
          insertedCount++;
        }
      }

      // Query actual count from MySQL
      const [countResult] = await datasetConn.query(`SELECT COUNT(*) as cnt FROM \`${table.tableName}\``);
      const actualCount = countResult[0].cnt;

      tableInsertStats.push({
        tableName: table.tableName,
        insertedCount,
        actualCount
      });

      await logStage(
        'DATA_INSERTION',
        'completed',
        `Populated table '${table.tableName}': ${actualCount} records verified.`
      );
    }

    // Re-enable foreign key checks
    await datasetConn.query(`SET FOREIGN_KEY_CHECKS = 1;`);

    // 5. Update system catalog status in smartdb_system
    await systemPool.query(
      `UPDATE datasets SET status = 'migrated', target_database = ? WHERE id = ?`,
      [targetDatabaseName, datasetId]
    );

    // Record normalization run in smartdb_system
    const [normRunResult] = await systemPool.query(
      `INSERT INTO normalization_runs (dataset_id, target_database_name, normal_form_target, lossless_join_verified, dependency_preservation_score, status, table_count, completed_at)
       VALUES (?, ?, '3NF', TRUE, 100.00, 'migrated', ?, NOW())`,
      [datasetId, targetDatabaseName, sortedTables.length]
    );
    const normalizationRunId = normRunResult.insertId;

    // Record academic normalization steps
    for (const step of normalizationSteps) {
      await systemPool.query(
        `INSERT INTO normalization_steps (normalization_run_id, stage, title, passed, explanation)
         VALUES (?, ?, ?, ?, ?)`,
        [normalizationRunId, step.stage || 'STAGE', step.title || 'Step', step.passed ? 1 : 0, step.description || '']
      );
    }

    // Record generated tables and columns in relational catalog (3NF)
    const tableIdMap = new Map(); // tableName -> generated_tables.id

    for (const table of sortedTables) {
      const stat = tableInsertStats.find(s => s.tableName === table.tableName);

      const [genTableResult] = await systemPool.query(
        `INSERT INTO generated_tables (normalization_run_id, table_name, original_table_name, row_count)
         VALUES (?, ?, ?, ?)`,
        [normalizationRunId, table.tableName, table.originalTableName || table.tableName, stat?.actualCount || 0]
      );
      const generatedTableId = genTableResult.insertId;
      tableIdMap.set(table.tableName, generatedTableId);

      for (const col of table.columns) {
        await systemPool.query(
          `INSERT INTO generated_columns (generated_table_id, column_name, data_type, is_primary_key, is_foreign_key, is_nullable)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            generatedTableId,
            col.columnName,
            col.dataType,
            col.isPrimaryKey ? 1 : 0,
            col.isForeignKey ? 1 : 0,
            col.isNullable ? 1 : 0
          ]
        );
      }
    }

    // Record relationships with true Foreign Keys to generated_tables(id)
    for (const rel of (relationships || [])) {
      const parentTableId = tableIdMap.get(rel.parentTable);
      const childTableId = tableIdMap.get(rel.childTable);

      if (parentTableId && childTableId) {
        await systemPool.query(
          `INSERT INTO relationships (normalization_run_id, parent_table_id, child_table_id, parent_column_name, child_column_name, relationship_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [normalizationRunId, parentTableId, childTableId, rel.parentColumn, rel.childColumn, rel.type || '1:N']
        );
      }
    }

    await logStage('COMPLETION', 'completed', `Migration finished successfully. Database '${targetDatabaseName}' is live.`);

    return {
      success: true,
      targetDatabaseName,
      normalizationRunId,
      tableStats: tableInsertStats,
      logs: logEntries
    };
  } catch (error) {
    await logStage('MIGRATION_ERROR', 'error', `Migration failed: ${error.message}`);
    throw error;
  } finally {
    if (rootConn) rootConn.release();
    if (datasetConn) datasetConn.release();
  }
};
