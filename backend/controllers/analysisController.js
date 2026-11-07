import path from 'path';
import { fileURLToPath } from 'url';
import { getSystemPool } from '../config/database.js';
import { parseUploadedFile } from '../services/fileParser.js';
import { profileDataset } from '../services/dataProfiler.js';
import { detectFunctionalDependencies, classifyDependencies } from '../services/dependencyAnalyzer.js';
import { findCandidateKeys, computeMinimalCover } from '../services/dbmsAlgorithms.js';
import { analyzeDataQuality } from '../services/mlQualityService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

export const analyzeDataset = async (req, res) => {
  try {
    const { id } = req.params;
    const systemPool = await getSystemPool();

    const [datasets] = await systemPool.query(`SELECT * FROM datasets WHERE id = ?`, [id]);
    if (datasets.length === 0) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }

    const dataset = datasets[0];
    const filePath = path.resolve(UPLOADS_DIR, dataset.stored_filename);

    const parsed = await parseUploadedFile(filePath, dataset.original_name);
    const profile = profileDataset(parsed.headers, parsed.rows);

    // Initial preliminary candidate keys from single/composite uniqueness
    const preliminaryKeys = [
      ...profile.singleCandidateKeys.map(k => [k]),
      ...profile.compositeCandidateKeys
    ];

    // Discover FDs up to determinant size 3 with violation metrics
    const detectedFDs = detectFunctionalDependencies(parsed.headers, parsed.rows, {
      candidateKeys: preliminaryKeys,
      maxDeterminantSize: 3,
      minConfidence: 0.90
    });

    // Compute formal minimal cover and candidate keys using academic algorithms
    const minimalCover = computeMinimalCover(detectedFDs);
    const formalCandidateKeys = findCandidateKeys(parsed.headers, minimalCover);

    const primaryKey = formalCandidateKeys.length > 0
      ? formalCandidateKeys[0]
      : (profile.singleCandidateKeys[0] ? [profile.singleCandidateKeys[0]] : [parsed.headers[0]]);

    const classification = classifyDependencies(parsed.headers, detectedFDs, primaryKey);

    // Run ML Data Quality Analysis (Isolation Forest + Fuzzy Duplicates)
    const dataQuality = analyzeDataQuality(parsed.rows, profile.columns);

    // Clear previously stored FDs for this dataset and re-insert with violation metrics
    await systemPool.query(`DELETE FROM functional_dependencies WHERE dataset_id = ?`, [id]);

    for (const fd of detectedFDs) {
      await systemPool.query(
        `INSERT INTO functional_dependencies (dataset_id, determinant, dependent, determinism_ratio, is_confirmed, dependency_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          JSON.stringify(fd.determinant),
          JSON.stringify(fd.dependents),
          fd.confidence,
          fd.isConfirmed ? 1 : 0,
          fd.isCandidateKey ? 'candidate_key' : 'full'
        ]
      );
    }

    await systemPool.query(`UPDATE datasets SET status = 'analyzed' WHERE id = ?`, [id]);

    return res.json({
      success: true,
      datasetId: id,
      profile,
      primaryKey,
      candidateKeys: formalCandidateKeys,
      minimalCover,
      dependencies: detectedFDs,
      classification,
      dataQuality
    });
  } catch (err) {
    console.error('Error analyzing dataset:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateFunctionalDependencies = async (req, res) => {
  try {
    const { id } = req.params;
    const { dependencies } = req.body;

    if (!Array.isArray(dependencies)) {
      return res.status(400).json({ success: false, message: 'dependencies must be an array' });
    }

    const systemPool = await getSystemPool();
    await systemPool.query(`DELETE FROM functional_dependencies WHERE dataset_id = ?`, [id]);

    for (const fd of dependencies) {
      await systemPool.query(
        `INSERT INTO functional_dependencies (dataset_id, determinant, dependent, determinism_ratio, is_confirmed, dependency_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          JSON.stringify(fd.determinant),
          JSON.stringify(fd.dependents),
          fd.confidence || 1.0,
          fd.isConfirmed ? 1 : 0,
          fd.dependencyType || 'full'
        ]
      );
    }

    return res.json({
      success: true,
      message: 'Functional dependencies updated successfully'
    });
  } catch (err) {
    console.error('Error updating FDs:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getDataQualityReport = async (req, res) => {
  try {
    const { id } = req.params;
    const systemPool = await getSystemPool();

    const [datasets] = await systemPool.query(`SELECT * FROM datasets WHERE id = ?`, [id]);
    if (datasets.length === 0) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }

    const dataset = datasets[0];
    const filePath = path.resolve(UPLOADS_DIR, dataset.stored_filename);

    const parsed = await parseUploadedFile(filePath, dataset.original_name);
    const profile = profileDataset(parsed.headers, parsed.rows);
    const dataQuality = analyzeDataQuality(parsed.rows, profile.columns);

    return res.json({
      success: true,
      datasetId: id,
      dataQuality
    });
  } catch (err) {
    console.error('Error getting data quality report:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
