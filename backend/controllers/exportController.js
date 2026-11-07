import { getSystemPool, getDatasetPool } from '../config/database.js';
import { exportDatabaseToExcel } from '../services/excelExporter.js';

export const exportExcel = async (req, res) => {
  try {
    const { datasetId } = req.params;
    const systemPool = await getSystemPool();

    const [runs] = await systemPool.query(
      `SELECT * FROM normalization_runs WHERE dataset_id = ? AND status = 'migrated' ORDER BY id DESC LIMIT 1`,
      [datasetId]
    );

    if (runs.length === 0) {
      return res.status(404).json({ success: false, message: 'No migrated database found for this dataset.' });
    }

    const targetDbName = runs[0].target_database_name;
    const [genTables] = await systemPool.query(
      `SELECT table_name FROM generated_tables WHERE normalization_run_id = ?`,
      [runs[0].id]
    );

    const tableNames = genTables.map(t => t.table_name);
    const excelBuffer = await exportDatabaseToExcel(targetDbName, tableNames);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${targetDbName}_normalized.xlsx"`);
    return res.send(excelBuffer);
  } catch (err) {
    console.error('Error exporting Excel:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const exportSqlScript = async (req, res) => {
  try {
    const { datasetId } = req.params;
    const systemPool = await getSystemPool();

    const [runs] = await systemPool.query(
      `SELECT * FROM normalization_runs WHERE dataset_id = ? ORDER BY id DESC LIMIT 1`,
      [datasetId]
    );

    if (runs.length === 0) {
      return res.status(404).json({ success: false, message: 'No schema found for this dataset.' });
    }

    const runId = runs[0].id;
    const targetDbName = runs[0].target_database_name;

    const [tables] = await systemPool.query(
      `SELECT * FROM generated_tables WHERE normalization_run_id = ?`,
      [runId]
    );

    let sql = `-- =====================================================================\n`;
    sql += `-- SmartDB SQL Export: ${targetDbName}\n`;
    sql += `-- Exported on: ${new Date().toISOString()}\n`;
    sql += `-- =====================================================================\n\n`;

    sql += `CREATE DATABASE IF NOT EXISTS \`${targetDbName}\`;\nUSE \`${targetDbName}\`;\n\n`;

    // Query DDL and data for each table from live MySQL
    const datasetPool = getDatasetPool(targetDbName);

    for (const tbl of tables) {
      const tableName = tbl.table_name;
      try {
        const [createTableResult] = await datasetPool.query(`SHOW CREATE TABLE \`${tableName}\``);
        if (createTableResult.length > 0) {
          sql += `-- Table structure for table \`${tableName}\`\n`;
          sql += `${createTableResult[0]['Create Table']};\n\n`;
        }

        const [rows] = await datasetPool.query(`SELECT * FROM \`${tableName}\``);
        if (rows.length > 0) {
          sql += `-- Dumping data for table \`${tableName}\`\n`;
          const keys = Object.keys(rows[0]);
          const colsStr = keys.map(k => `\`${k}\``).join(', ');

          const valuesList = rows.map(r => {
            const vals = keys.map(k => {
              const v = r[k];
              if (v === null || v === undefined) return 'NULL';
              if (typeof v === 'number') return v;
              return `'${String(v).replace(/'/g, "''")}'`;
            });
            return `  (${vals.join(', ')})`;
          });

          sql += `INSERT INTO \`${tableName}\` (${colsStr}) VALUES\n${valuesList.join(',\n')};\n\n`;
        }
      } catch (tableErr) {
        console.warn(`Error generating SQL dump for ${tableName}:`, tableErr.message);
      }
    }

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${targetDbName}_dump.sql"`);
    return res.send(sql);
  } catch (err) {
    console.error('Error generating SQL script:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getERDData = async (req, res) => {
  try {
    const { datasetId } = req.params;
    const systemPool = await getSystemPool();

    const [runs] = await systemPool.query(
      `SELECT * FROM normalization_runs WHERE dataset_id = ? ORDER BY id DESC LIMIT 1`,
      [datasetId]
    );

    if (runs.length === 0) {
      return res.status(404).json({ success: false, message: 'No schema found for this dataset' });
    }

    const runId = runs[0].id;
    const [tables] = await systemPool.query(
      `SELECT * FROM generated_tables WHERE normalization_run_id = ?`,
      [runId]
    );

    const erdTables = [];
    for (const t of tables) {
      const [cols] = await systemPool.query(
        `SELECT * FROM generated_columns WHERE generated_table_id = ?`,
        [t.id]
      );
      erdTables.push({
        id: t.id,
        tableName: t.table_name,
        rowCount: t.row_count,
        columns: cols.map(c => ({
          name: c.column_name,
          type: c.data_type,
          isPK: Boolean(c.is_primary_key),
          isFK: Boolean(c.is_foreign_key),
          foreignTable: c.foreign_table,
          foreignColumn: c.foreign_column
        }))
      });
    }

    const [relationships] = await systemPool.query(
      `SELECT * FROM relationships WHERE normalization_run_id = ?`,
      [runId]
    );

    return res.json({
      success: true,
      databaseName: runs[0].target_database_name,
      tables: erdTables,
      relationships
    });
  } catch (err) {
    console.error('Error fetching ERD data:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getNormalizationAuditReport = async (req, res) => {
  try {
    const { datasetId } = req.params;
    const systemPool = await getSystemPool();

    const [datasets] = await systemPool.query(`SELECT * FROM datasets WHERE id = ?`, [datasetId]);
    if (datasets.length === 0) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }

    const [fds] = await systemPool.query(`SELECT * FROM functional_dependencies WHERE dataset_id = ?`, [datasetId]);
    const [runs] = await systemPool.query(`SELECT * FROM normalization_runs WHERE dataset_id = ? ORDER BY id DESC LIMIT 1`, [datasetId]);
    
    let generatedTables = [];
    if (runs.length > 0) {
      const [gt] = await systemPool.query(`SELECT * FROM generated_tables WHERE normalization_run_id = ?`, [runs[0].id]);
      generatedTables = gt;
    }

    return res.json({
      success: true,
      dataset: datasets[0],
      run: runs[0] || null,
      functionalDependencies: fds,
      generatedTables
    });
  } catch (err) {
    console.error('Error fetching audit report:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

