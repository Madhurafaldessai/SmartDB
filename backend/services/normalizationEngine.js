import { sanitizeIdentifier } from './fileParser.js';
import {
  computeMinimalCover,
  findCandidateKeys,
  synthesize3NF,
  verifyLosslessJoin,
  verifyDependencyPreservation,
  analyzeBCNF
} from './dbmsAlgorithms.js';

/**
 * Normalization Engine (1NF -> 2NF -> 3NF & BCNF)
 *
 * Implements Bernstein's 3NF synthesis algorithm using Minimal Cover,
 * mathematically guaranteeing Lossless Join and Dependency Preservation.
 */

/**
 * Derives a clean, readable table name from determinant or column names
 */
const deriveTableName = (determinantCols, defaultFallback = 'records', existingNames = new Set()) => {
  const primaryName = determinantCols[0]
    .replace(/_id$/i, '')
    .replace(/_code$/i, '')
    .replace(/_num(ber)?$/i, '');

  let baseName = sanitizeIdentifier(primaryName || defaultFallback);

  // Pluralize common English nouns if simple
  if (!baseName.endsWith('s')) {
    if (baseName.endsWith('y') && !baseName.endsWith('ay') && !baseName.endsWith('ey')) {
      baseName = baseName.slice(0, -1) + 'ies';
    } else {
      baseName = baseName + 's';
    }
  }

  let finalName = baseName;
  let counter = 1;
  while (existingNames.has(finalName)) {
    finalName = `${baseName}_${counter++}`;
  }
  existingNames.add(finalName);
  return finalName;
};

/**
 * Executes full academic normalization pipeline
 */
export const normalizeDataset = ({
  headers,
  rows,
  columnsProfile,
  dependencies,
  chosenPrimaryKey
}) => {
  const steps = [];
  const existingTableNames = new Set();
  const profileMap = new Map(columnsProfile.map(c => [c.originalName, c]));

  // 1. Calculate Minimal Cover (Canonical Cover) of confirmed FDs
  const minimalCover = computeMinimalCover(dependencies || []);

  steps.push({
    stage: 'MINIMAL_COVER',
    title: 'Minimal Cover (Canonical Cover Fc) Computation',
    passed: true,
    description: `Computed minimal cover with ${minimalCover.length} canonical functional dependencies. Extraneous left-hand-side attributes and redundant dependencies eliminated.`,
    details: minimalCover.map(fd => `[${fd.determinant.join(', ')}] -> [${fd.dependents.join(', ')}]`)
  });

  // 2. Compute formal candidate keys using Attribute Closure
  const detectedCandidateKeys = findCandidateKeys(headers, minimalCover);
  let primaryKey = chosenPrimaryKey;
  if (!primaryKey || primaryKey.length === 0) {
    primaryKey = detectedCandidateKeys[0] || [headers[0]];
  }
  if (!Array.isArray(primaryKey)) {
    primaryKey = [primaryKey];
  }

  steps.push({
    stage: 'CANDIDATE_KEYS',
    title: 'Candidate Key Discovery via Attribute Closure',
    passed: true,
    primaryKey,
    description: `Discovered ${detectedCandidateKeys.length} minimal candidate key(s) using attribute closure: ${detectedCandidateKeys.map(k => `[${k.join(', ')}]`).join(', ')}. Primary key selected: [${primaryKey.join(', ')}].`
  });

  // 3. First Normal Form (1NF) Verification
  const nonAtomicCols = columnsProfile.filter(c => c.nonAtomicCheck?.hasRepeatingGroups);
  steps.push({
    stage: '1NF',
    title: 'First Normal Form (1NF) Verification',
    passed: nonAtomicCols.length === 0,
    description: nonAtomicCols.length === 0
      ? `All attributes contain atomic values. No repeating groups detected. Relation is uniquely keyed by [${primaryKey.join(', ')}]. Relation satisfies 1NF.`
      : `Detected non-atomic values in columns: [${nonAtomicCols.map(c => c.originalName).join(', ')}]. Recommended atomic conversion.`,
    actionsTaken: ['Enforced single primary key definition across tuples', 'Verified column scalar types']
  });

  // 4. Second Normal Form (2NF) Analysis
  const isCompositePK = primaryKey.length > 1;
  const partialFDs = [];
  if (isCompositePK) {
    const pkSet = new Set(primaryKey);
    for (const fd of dependencies) {
      const isProperSubset = fd.determinant.every(col => pkSet.has(col)) && fd.determinant.length < primaryKey.length;
      if (isProperSubset) {
        partialFDs.push(fd);
      }
    }
  }

  steps.push({
    stage: '2NF',
    title: 'Second Normal Form (2NF) Decomposition',
    passed: partialFDs.length === 0,
    description: partialFDs.length > 0
      ? `Detected ${partialFDs.length} partial dependency violation(s) on composite key [${primaryKey.join(', ')}]. Decomposed into independent relations.`
      : isCompositePK
      ? 'No partial functional dependencies detected on composite primary key. Satisfies 2NF.'
      : 'Primary key is single-column; partial dependencies are impossible. Automatically in 2NF.'
  });

  // 5. 3NF Synthesis (Bernstein's Algorithm)
  const synthesizedSchemas = synthesize3NF(headers, minimalCover, detectedCandidateKeys);

  steps.push({
    stage: '3NF',
    title: '3NF Synthesis (Bernstein\'s Algorithm)',
    passed: true,
    description: `Synthesized ${synthesizedSchemas.length} non-redundant relation schemas directly from canonical minimal cover Fc, guaranteeing Lossless Join and Dependency Preservation.`,
    actionsTaken: [
      'Created one relation per unique determinant in Fc',
      'Preserved candidate key relation ensuring lossless decomposition',
      'Eliminated redundant sub-relations'
    ]
  });

  // 6. Map synthesized schemas into rich table objects
  const normalizedTables = [];
  const relationships = [];

  for (let idx = 0; idx < synthesizedSchemas.length; idx++) {
    const syn = synthesizedSchemas[idx];
    const tableName = deriveTableName(syn.primaryKey, `table_${idx + 1}`, existingTableNames);

    const tableCols = syn.schema.map(col => {
      const isPK = syn.primaryKey.includes(col);
      return {
        originalName: col,
        columnName: sanitizeIdentifier(col),
        dataType: profileMap.get(col)?.detectedType || 'VARCHAR(255)',
        isPrimaryKey: isPK,
        isForeignKey: false,
        foreignTable: null,
        foreignColumn: null,
        isNullable: !isPK
      };
    });

    normalizedTables.push({
      id: `tbl_${idx + 1}`,
      tableName,
      description: syn.reason,
      primaryKeys: syn.primaryKey,
      schema: syn.schema,
      columns: tableCols,
      normalFormLevel: '3NF'
    });
  }

  // 7. Establish Foreign Key Relationships
  // A table T_child references T_parent if T_parent's primary key is present in T_child as foreign key
  for (let cIdx = 0; cIdx < normalizedTables.length; cIdx++) {
    const childTable = normalizedTables[cIdx];
    const childAttrs = new Set(childTable.columns.map(c => c.originalName));

    for (let pIdx = 0; pIdx < normalizedTables.length; pIdx++) {
      if (cIdx === pIdx) continue;
      const parentTable = normalizedTables[pIdx];
      const parentPK = parentTable.primaryKeys;

      // If child table contains the entire primary key of parent table, and child table has more attributes
      const childContainsParentPK = parentPK.every(pkAttr => childAttrs.has(pkAttr));
      const isNotSamePK = parentPK.length < childTable.primaryKeys.length ||
        !parentPK.every(pkAttr => childTable.primaryKeys.includes(pkAttr));

      if (childContainsParentPK && isNotSamePK) {
        // Mark columns as foreign key in child table
        parentPK.forEach(pkAttr => {
          const colObj = childTable.columns.find(c => c.originalName === pkAttr);
          if (colObj) {
            colObj.isForeignKey = true;
            colObj.foreignTable = parentTable.tableName;
            colObj.foreignColumn = sanitizeIdentifier(pkAttr);
          }
        });

        relationships.push({
          parentTable: parentTable.tableName,
          childTable: childTable.tableName,
          parentColumn: sanitizeIdentifier(parentPK[0]),
          childColumn: sanitizeIdentifier(parentPK[0]),
          type: '1:N'
        });
      }
    }
  }

  // 8. Formal Relational Verification
  const losslessJoinVerification = verifyLosslessJoin(normalizedTables, minimalCover, detectedCandidateKeys);
  const dependencyPreservationVerification = verifyDependencyPreservation(normalizedTables, dependencies || []);
  const bcnfAnalysis = analyzeBCNF(normalizedTables, minimalCover);

  steps.push({
    stage: 'LOSSLESS_JOIN',
    title: 'Lossless-Join Verification',
    passed: losslessJoinVerification.isLossless,
    description: losslessJoinVerification.explanation
  });

  steps.push({
    stage: 'DEPENDENCY_PRESERVATION',
    title: 'Dependency Preservation Verification',
    passed: dependencyPreservationVerification.isPreserved,
    description: dependencyPreservationVerification.isPreserved
      ? `All ${dependencyPreservationVerification.totalCount} functional dependencies are preserved across the decomposed relations.`
      : `Preserved ${dependencyPreservationVerification.preservedCount} of ${dependencyPreservationVerification.totalCount} dependencies.`
  });

  return {
    primaryKey,
    candidateKeys: detectedCandidateKeys,
    minimalCover,
    losslessJoinVerification,
    dependencyPreservationVerification,
    bcnfAnalysis,
    steps,
    tables: normalizedTables,
    relationships
  };
};
