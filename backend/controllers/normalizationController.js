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

    // Fetch confirmed FDs from database or request body
    let dependencies = confirmedDependencies;
    if (!dependencies) {
      const [fdRows] = await systemPool.query(
        `SELECT determinant, dependent, determinism_ratio FROM functional_dependencies WHERE dataset_id = ? AND is_confirmed = 1`,
        [id]
      );
      dependencies = fdRows.map(row => ({
        determinant: typeof row.determinant === 'string' ? JSON.parse(row.determinant) : row.determinant,
        dependents: typeof row.dependent === 'string' ? JSON.parse(row.dependent) : row.dependent,
        confidence: parseFloat(row.determinism_ratio)
      }));
    }

    // Fallback if no confirmed FDs exist yet
    if (!dependencies || dependencies.length === 0) {
      const [allFdRows] = await systemPool.query(
        `SELECT determinant, dependent, determinism_ratio FROM functional_dependencies WHERE dataset_id = ?`,
        [id]
      );
      dependencies = allFdRows.map(row => ({
        determinant: typeof row.determinant === 'string' ? JSON.parse(row.determinant) : row.determinant,
        dependents: typeof row.dependent === 'string' ? JSON.parse(row.dependent) : row.dependent,
        confidence: parseFloat(row.determinism_ratio)
      }));
    }

    // Run Academic Normalization Engine
    const normalizationResult = normalizeDataset({
      headers: parsed.headers,
      rows: parsed.rows,
      columnsProfile: profile.columns,
      dependencies,
      chosenPrimaryKey: userPrimaryKey
    });

    const targetDatabaseName = `smartdb_ds_${dataset.id}_${Date.now().toString(36)}`;
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
