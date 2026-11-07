import path from 'path';
import { fileURLToPath } from 'url';
import { getSystemPool } from '../config/database.js';
import { parseUploadedFile } from '../services/fileParser.js';
import { profileDataset } from '../services/dataProfiler.js';
import { detectFunctionalDependencies, classifyDependencies } from '../services/dependencyAnalyzer.js';
import { findCandidateKeys, computeMinimalCover } from '../services/dbmsAlgorithms.js';

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

    // Discover FDs up to determinant size 3 with exact violation counts and violation rates
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

    // Fetch column mapping (sanitized name -> dataset_columns.id)
    const [colRows] = await systemPool.query(
      `SELECT id, column_name, sanitized_name FROM dataset_columns WHERE dataset_id = ?`,
      [id]
    );
    const colMapByName = new Map();
    for (const c of colRows) {
      colMapByName.set(c.column_name, c.id);
      colMapByName.set(c.sanitized_name, c.id);
    }

    // --- Persist Candidate Keys to 3NF relational tables ---
    await systemPool.query(`DELETE FROM candidate_keys WHERE dataset_id = ?`, [id]);

    for (let kIdx = 0; kIdx < formalCandidateKeys.length; kIdx++) {
      const keyCols = formalCandidateKeys[kIdx];
      const isPrimary = JSON.stringify(keyCols) === JSON.stringify(primaryKey);
      const keyName = `CK_${kIdx + 1} (${keyCols.join(', ')})`;

      const [ckResult] = await systemPool.query(
        `INSERT INTO candidate_keys (dataset_id, key_name, is_selected_primary) VALUES (?, ?, ?)`,
        [id, keyName, isPrimary ? 1 : 0]
      );
      const candidateKeyId = ckResult.insertId;

      for (const colName of keyCols) {
        const colId = colMapByName.get(colName);
        if (colId) {
          await systemPool.query(
            `INSERT IGNORE INTO candidate_key_attributes (candidate_key_id, column_id) VALUES (?, ?)`,
            [candidateKeyId, colId]
          );
        }
      }
    }

    // --- Persist Functional Dependencies to 3NF relational tables (No JSON arrays) ---
    await systemPool.query(`DELETE FROM functional_dependencies WHERE dataset_id = ?`, [id]);

    for (const fd of detectedFDs) {
      const depType = fd.isCandidateKey ? 'candidate_key' : 'full';
      const [fdResult] = await systemPool.query(
        `INSERT INTO functional_dependencies (dataset_id, determinism_ratio, violation_count, violation_rate, is_confirmed, dependency_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          fd.confidence,
          fd.violationCount || 0,
          parseFloat(fd.violationRate) || 0.00,
          fd.isConfirmed ? 1 : 0,
          depType
        ]
      );
      const fdId = fdResult.insertId;

      // Insert LHS determinants
      for (const detCol of fd.determinant) {
        const colId = colMapByName.get(detCol);
        if (colId) {
          await systemPool.query(
            `INSERT IGNORE INTO fd_determinants (fd_id, column_id) VALUES (?, ?)`,
            [fdId, colId]
          );
        }
      }

      // Insert RHS dependents
      for (const depCol of fd.dependents) {
        const colId = colMapByName.get(depCol);
        if (colId) {
          await systemPool.query(
            `INSERT IGNORE INTO fd_dependents (fd_id, column_id) VALUES (?, ?)`,
            [fdId, colId]
          );
        }
      }
    }

    // Update dataset status
    await systemPool.query(`UPDATE datasets SET status = 'analyzed' WHERE id = ?`, [id]);

    return res.json({
      success: true,
      datasetId: id,
      profile,
      primaryKey,
      candidateKeys: formalCandidateKeys,
      minimalCover,
      dependencies: detectedFDs,
      classification
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

    // Fetch column mapping
    const [colRows] = await systemPool.query(
      `SELECT id, column_name, sanitized_name FROM dataset_columns WHERE dataset_id = ?`,
      [id]
    );
    const colMapByName = new Map();
    for (const c of colRows) {
      colMapByName.set(c.column_name, c.id);
      colMapByName.set(c.sanitized_name, c.id);
    }

    // Clear and re-populate FDs
    await systemPool.query(`DELETE FROM functional_dependencies WHERE dataset_id = ?`, [id]);

    for (const fd of dependencies) {
      const [fdResult] = await systemPool.query(
        `INSERT INTO functional_dependencies (dataset_id, determinism_ratio, violation_count, violation_rate, is_confirmed, dependency_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          fd.confidence !== undefined ? fd.confidence : 1.0,
          fd.violationCount || 0,
          parseFloat(fd.violationRate) || 0.00,
          fd.isConfirmed ? 1 : 0,
          fd.isCandidateKey ? 'candidate_key' : 'full'
        ]
      );
      const fdId = fdResult.insertId;

      const determinants = Array.isArray(fd.determinant) ? fd.determinant : [fd.determinant];
      for (const detCol of determinants) {
        const colId = colMapByName.get(detCol);
        if (colId) {
          await systemPool.query(
            `INSERT IGNORE INTO fd_determinants (fd_id, column_id) VALUES (?, ?)`,
            [fdId, colId]
          );
        }
      }

      const dependents = Array.isArray(fd.dependents || fd.dependent) ? (fd.dependents || fd.dependent) : [fd.dependents || fd.dependent];
      for (const depCol of dependents) {
        const colId = colMapByName.get(depCol);
        if (colId) {
          await systemPool.query(
            `INSERT IGNORE INTO fd_dependents (fd_id, column_id) VALUES (?, ?)`,
            [fdId, colId]
          );
        }
      }
    }

    return res.json({
      success: true,
      message: `Updated ${dependencies.length} functional dependencies in relational catalog.`
    });
  } catch (err) {
    console.error('Error updating functional dependencies:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
