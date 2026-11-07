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
  originalRows
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

    // Record normalization run
    const [normRunResult] = await systemPool.query(
      `INSERT INTO normalization_runs (dataset_id, target_database_name, status, table_count, completed_at) VALUES (?, ?, 'migrated', ?, NOW())`,
      [datasetId, targetDatabaseName, sortedTables.length]
    );
    const normalizationRunId = normRunResult.insertId;

    // Record generated tables and relationships in system catalog
    for (const table of sortedTables) {
      const pkNames = table.columns.filter(c => c.isPrimaryKey).map(c => c.columnName);
      const stat = tableInsertStats.find(s => s.tableName === table.tableName);

      const [genTableResult] = await systemPool.query(
        `INSERT INTO generated_tables (normalization_run_id, table_name, original_table_name, primary_keys, row_count) VALUES (?, ?, ?, ?, ?)`,
        [normalizationRunId, table.tableName, table.originalTableName || table.tableName, JSON.stringify(pkNames), stat?.actualCount || 0]
      );
      const generatedTableId = genTableResult.insertId;

      for (const col of table.columns) {
        await systemPool.query(
          `INSERT INTO generated_columns (generated_table_id, column_name, data_type, is_primary_key, is_foreign_key, foreign_table, foreign_column, is_nullable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generatedTableId,
            col.columnName,
            col.dataType,
            col.isPrimaryKey ? 1 : 0,
            col.isForeignKey ? 1 : 0,
            col.foreignTable,
            col.foreignColumn,
            col.isNullable ? 1 : 0
          ]
        );
      }
    }

    // Record relationships in system catalog
    for (const rel of (relationships || [])) {
      await systemPool.query(
        `INSERT INTO relationships (normalization_run_id, parent_table, child_table, parent_column, child_column, relationship_type) VALUES (?, ?, ?, ?, ?, ?)`,
        [normalizationRunId, rel.parentTable, rel.childTable, rel.parentColumn, rel.childColumn, rel.type || '1:N']
      );
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

