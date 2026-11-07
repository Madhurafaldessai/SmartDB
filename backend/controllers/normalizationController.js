import path from 'path';
import { fileURLToPath } from 'url';
import { getSystemPool } from '../config/database.js';
import { parseUploadedFile } from '../services/fileParser.js';
import { profileDataset } from '../services/dataProfiler.js';
import { normalizeDataset } from '../services/normalizationEngine.js';
import { generateFullMigrationSQL } from '../services/schemaGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

export const suggestNormalization = async (req, res) => {
  try {
    const { id } = req.params;
    const { primaryKey: userPrimaryKey, confirmedDependencies } = req.body;

    const systemPool = await getSystemPool();
    const [datasets] = await systemPool.query(`SELECT * FROM datasets WHERE id = ?`, [id]);
    if (datasets.length === 0) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }

    const dataset = datasets[0];
    const filePath = path.resolve(UPLOADS_DIR, dataset.stored_filename);

    const parsed = await parseUploadedFile(filePath, dataset.original_name);
    const profile = profileDataset(parsed.headers, parsed.rows);

    // Fetch confirmed FDs from relational tables if not provided in body
    let dependencies = confirmedDependencies;
    if (!dependencies || !Array.isArray(dependencies) || dependencies.length === 0) {
      const [fdRows] = await systemPool.query(
        `SELECT 
          fd.id,
          fd.determinism_ratio,
          fd.is_confirmed,
          (SELECT GROUP_CONCAT(dc.column_name ORDER BY dc.column_index SEPARATOR '||')
           FROM fd_determinants fdd
           JOIN dataset_columns dc ON fdd.column_id = dc.id
           WHERE fdd.fd_id = fd.id) as determinant_str,
          (SELECT GROUP_CONCAT(dc.column_name ORDER BY dc.column_index SEPARATOR '||')
           FROM fd_dependents fdd
           JOIN dataset_columns dc ON fdd.column_id = dc.id
           WHERE fdd.fd_id = fd.id) as dependent_str
         FROM functional_dependencies fd
         WHERE fd.dataset_id = ? AND fd.is_confirmed = 1`,
        [id]
      );

      if (fdRows.length > 0) {
        dependencies = fdRows.map(row => ({
          determinant: row.determinant_str ? row.determinant_str.split('||') : [],
          dependents: row.dependent_str ? row.dependent_str.split('||') : [],
          confidence: parseFloat(row.determinism_ratio) || 1.0
        })).filter(fd => fd.determinant.length > 0 && fd.dependents.length > 0);
      }
    }

    // Fallback: If no confirmed FDs, load all discovered FDs for this dataset
    if (!dependencies || dependencies.length === 0) {
      const [allFdRows] = await systemPool.query(
        `SELECT 
          fd.id,
          fd.determinism_ratio,
          (SELECT GROUP_CONCAT(dc.column_name ORDER BY dc.column_index SEPARATOR '||')
           FROM fd_determinants fdd
           JOIN dataset_columns dc ON fdd.column_id = dc.id
           WHERE fdd.fd_id = fd.id) as determinant_str,
          (SELECT GROUP_CONCAT(dc.column_name ORDER BY dc.column_index SEPARATOR '||')
           FROM fd_dependents fdd
           JOIN dataset_columns dc ON fdd.column_id = dc.id
           WHERE fdd.fd_id = fd.id) as dependent_str
         FROM functional_dependencies fd
         WHERE fd.dataset_id = ?`,
        [id]
      );

      dependencies = allFdRows.map(row => ({
        determinant: row.determinant_str ? row.determinant_str.split('||') : [],
        dependents: row.dependent_str ? row.dependent_str.split('||') : [],
        confidence: parseFloat(row.determinism_ratio) || 1.0
      })).filter(fd => fd.determinant.length > 0 && fd.dependents.length > 0);
    }

    // Run Academic Normalization Engine (Bernstein's 3NF Synthesis)
    const normalizationResult = normalizeDataset({
      headers: parsed.headers,
      rows: parsed.rows,
      columnsProfile: profile.columns,
      dependencies,
      chosenPrimaryKey: userPrimaryKey
    });

    const targetDatabaseName = `smartdb_ds_${dataset.id}`;
    const { sqlScript, sortedTables } = generateFullMigrationSQL(targetDatabaseName, normalizationResult.tables);

    return res.json({
      success: true,
      datasetId: id,
      targetDatabaseName,
      primaryKey: normalizationResult.primaryKey,
      candidateKeys: normalizationResult.candidateKeys,
      minimalCover: normalizationResult.minimalCover,
      losslessJoinVerification: normalizationResult.losslessJoinVerification,
      dependencyPreservationVerification: normalizationResult.dependencyPreservationVerification,
      bcnfAnalysis: normalizationResult.bcnfAnalysis,
      steps: normalizationResult.steps,
      tables: sortedTables,
      relationships: normalizationResult.relationships,
      previewSQL: sqlScript
    });
  } catch (err) {
    console.error('Error suggesting normalization:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
