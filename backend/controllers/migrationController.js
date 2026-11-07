import path from 'path';
import { fileURLToPath } from 'url';
import { getSystemPool, getDatasetPool } from '../config/database.js';
import { parseUploadedFile } from '../services/fileParser.js';
import { executeMigration } from '../services/migrationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

export const runMigration = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetDatabaseName, tables, relationships } = req.body;

    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or missing tables schema' });
    }

    const systemPool = await getSystemPool();
    const [datasets] = await systemPool.query(`SELECT * FROM datasets WHERE id = ?`, [id]);
    if (datasets.length === 0) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }

    const dataset = datasets[0];
    const finalDbName = targetDatabaseName || `smartdb_ds_${dataset.id}`;

    // Read full rows from stored file
    const filePath = path.resolve(UPLOADS_DIR, dataset.stored_filename);
    const parsed = await parseUploadedFile(filePath, dataset.original_name);

    const result = await executeMigration({
      datasetId: id,
      targetDatabaseName: finalDbName,
      tables,
      relationships: relationships || [],
      originalRows: parsed.rows
    });

    return res.json({
      success: true,
      message: `Database '${finalDbName}' generated and populated successfully in MySQL!`,
      result
    });
  } catch (err) {
    console.error('Migration failed:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getMigrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const systemPool = await getSystemPool();

    const [logs] = await systemPool.query(
      `SELECT * FROM migration_logs WHERE dataset_id = ? ORDER BY id ASC`,
      [id]
    );

    const [runs] = await systemPool.query(
      `SELECT nr.*, 
        (SELECT COUNT(*) FROM generated_tables gt WHERE gt.normalization_run_id = nr.id) as table_count
       FROM normalization_runs nr 
       WHERE nr.dataset_id = ? 
       ORDER BY nr.created_at DESC`,
      [id]
    );

    let liveTableData = [];
    if (runs.length > 0 && runs[0].status === 'migrated') {
      const dbName = runs[0].target_database_name;
      try {
        const pool = getDatasetPool(dbName);
        const [tables] = await pool.query(`SHOW TABLES`);
        for (const t of tables) {
          const tableName = Object.values(t)[0];
          const [cntResult] = await pool.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
          const [sampleRows] = await pool.query(`SELECT * FROM \`${tableName}\` LIMIT 5`);
          liveTableData.push({
            tableName,
            rowCount: cntResult[0].count,
            preview: sampleRows
          });
        }
      } catch (poolErr) {
        console.warn(`Could not query live table data from ${dbName}:`, poolErr.message);
      }
    }

    return res.json({
      success: true,
      logs,
      runs,
      liveTableData
    });
  } catch (err) {
    console.error('Error fetching migration status:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
