import path from 'path';
import { fileURLToPath } from 'url';
import { getSystemPool } from '../config/database.js';
import { parseUploadedFile } from '../services/fileParser.js';
import { profileDataset } from '../services/dataProfiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

export const uploadDatasetFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { originalname, filename, size, path: filePath } = req.file;
    const ext = originalname.split('.').pop().toLowerCase();

    // Parse the uploaded file (load preview rows first for snappy feedback)
    const parsed = await parseUploadedFile(filePath, originalname, { maxRows: 100 });
    const fullParsed = await parseUploadedFile(filePath, originalname);

    // Initial profiling
    const initialProfile = profileDataset(parsed.headers, fullParsed.rows);

    const datasetCode = `DS_${Date.now().toString(36).toUpperCase()}`;

    // Insert into smartdb_system.datasets
    const systemPool = await getSystemPool();
    const [datasetResult] = await systemPool.query(
      `INSERT INTO datasets (dataset_code, original_name, stored_filename, file_type, file_size_bytes, row_count, column_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded')`,
      [datasetCode, originalname, filename, ext, size, fullParsed.totalRows, parsed.headers.length]
    );

    const datasetId = datasetResult.insertId;

    // Insert column profiles
    for (const col of initialProfile.columns) {
      await systemPool.query(
        `INSERT INTO dataset_columns (dataset_id, column_index, column_name, sanitized_name, detected_type, null_count, unique_count, is_candidate_key, sample_values)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          datasetId,
          col.columnIndex,
          col.originalName,
          col.sanitizedName,
          col.detectedType,
          col.nullCount,
          col.uniqueCount,
          col.isCandidateKey ? 1 : 0,
          JSON.stringify(col.sampleValues)
        ]
      );
    }

    return res.status(201).json({
      success: true,
      message: 'File uploaded and parsed successfully.',
      dataset: {
        id: datasetId,
        datasetCode,
        originalName: originalname,
        storedFilename: filename,
        fileType: ext,
        fileSizeBytes: size,
        rowCount: fullParsed.totalRows,
        columnCount: parsed.headers.length,
        status: 'uploaded',
        previewHeaders: parsed.headers,
        previewRows: parsed.rows.slice(0, 15),
        profile: initialProfile
      }
    });
  } catch (err) {
    console.error('Error uploading file:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllDatasets = async (req, res) => {
  try {
    const systemPool = await getSystemPool();
    const [datasets] = await systemPool.query(`
      SELECT 
        d.*,
        (SELECT COUNT(*) FROM normalization_runs nr WHERE nr.dataset_id = d.id) as normalization_count
      FROM datasets d
      ORDER BY d.created_at DESC
    `);

    // Fetch dashboard aggregations
    const [stats] = await systemPool.query(`
      SELECT 
        COUNT(*) as total_datasets,
        SUM(CASE WHEN status = 'migrated' THEN 1 ELSE 0 END) as migrated_datasets,
        (SELECT COUNT(*) FROM generated_tables) as total_generated_tables
      FROM datasets
    `);

    return res.json({
      success: true,
      datasets,
      stats: stats[0] || { total_datasets: 0, migrated_datasets: 0, total_generated_tables: 0 }
    });
  } catch (err) {
    console.error('Error fetching datasets:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getDatasetDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const systemPool = await getSystemPool();

    const [datasets] = await systemPool.query(`SELECT * FROM datasets WHERE id = ?`, [id]);
    if (datasets.length === 0) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }

    const dataset = datasets[0];
    const [columns] = await systemPool.query(
      `SELECT * FROM dataset_columns WHERE dataset_id = ? ORDER BY column_index ASC`,
      [id]
    );

    // Read preview rows from disk file
    const filePath = path.resolve(UPLOADS_DIR, dataset.stored_filename);
    let preview = { rows: [], headers: [] };
    try {
      preview = await parseUploadedFile(filePath, dataset.original_name, { maxRows: 50 });
    } catch (parseErr) {
      console.warn('Could not read stored file preview:', parseErr.message);
    }

    return res.json({
      success: true,
      dataset,
      columns,
      previewHeaders: preview.headers,
      previewRows: preview.rows
    });
  } catch (err) {
    console.error('Error fetching dataset details:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

