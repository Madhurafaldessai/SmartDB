/**
 * Machine Learning & Statistical Data Quality Service
 *
 * Implements:
 * 1. Isolation Forest for multidimensional numerical anomaly detection
 * 2. Fuzzy duplicate detection using Jaro-Winkler string similarity
 * 3. Suspicious record explanation generation
 *
 * NOTE: As required by DBMS principles, ML findings are purely advisory
 * and do not automatically decide candidate keys or functional dependencies.
 */

// Euler-Mascheroni constant for Isolation Forest average path length
const EULER_MASCHERONI = 0.5772156649;

/**
 * Average path length of unsuccessful search in a Binary Search Tree (BST)
 */
const averagePathLength = (n) => {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER_MASCHERONI) - (2 * (n - 1) / n);
};

/**
 * Constructs an Isolation Tree (iTree) recursively
 */
const buildITree = (data, currentHeight, maxHeight) => {
  const n = data.length;
  if (currentHeight >= maxHeight || n <= 1) {
    return { size: n, isLeaf: true };
  }

  // Find columns that have variability
  const numFeatures = data[0].features.length;
  const validFeatures = [];

  for (let f = 0; f < numFeatures; f++) {
    const vals = data.map(d => d.features[f]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (max > min) {
      validFeatures.push({ featureIndex: f, min, max });
    }
  }

  if (validFeatures.length === 0) {
    return { size: n, isLeaf: true };
  }

  // Randomly select one feature and a random split point between min and max
  const chosen = validFeatures[Math.floor(Math.random() * validFeatures.length)];
  const splitValue = chosen.min + Math.random() * (chosen.max - chosen.min);

  const leftData = [];
  const rightData = [];

  for (let i = 0; i < n; i++) {
    if (data[i].features[chosen.featureIndex] < splitValue) {
      leftData.push(data[i]);
    } else {
      rightData.push(data[i]);
    }
  }

  return {
    isLeaf: false,
    splitFeature: chosen.featureIndex,
    splitValue,
    left: buildITree(leftData, currentHeight + 1, maxHeight),
    right: buildITree(rightData, currentHeight + 1, maxHeight)
  };
};

/**
 * Traverses an iTree to calculate path length for a single data point
 */
const getPathLength = (point, tree, currentDepth = 0) => {
  if (tree.isLeaf) {
    return currentDepth + averagePathLength(tree.size);
  }

  if (point.features[tree.splitFeature] < tree.splitValue) {
    return getPathLength(point, tree.left, currentDepth + 1);
  } else {
    return getPathLength(point, tree.right, currentDepth + 1);
  }
};

/**
 * Isolation Forest ensemble implementation
 */
export const runIsolationForest = (rows, numericalColumns, options = {}) => {
  if (numericalColumns.length === 0 || rows.length < 4) {
    return [];
  }

  const numTrees = options.numTrees || 50;
  const sampleSize = Math.min(rows.length, options.sampleSize || 256);
  const maxHeight = Math.ceil(Math.log2(Math.max(sampleSize, 2)));

  // Extract numerical vectors
  const dataset = rows.map((row, idx) => ({
    originalIndex: idx + 1,
    row,
    features: numericalColumns.map(col => {
      const val = parseFloat(row[col]);
      return isNaN(val) ? 0 : val;
    })
  }));

  // Build ensemble of iTrees
  const forest = [];
  for (let t = 0; t < numTrees; t++) {
    // Random sub-sampling without replacement
    const shuffled = [...dataset].sort(() => 0.5 - Math.random());
    const subSample = shuffled.slice(0, sampleSize);
    forest.push(buildITree(subSample, 0, maxHeight));
  }

  const c_n = averagePathLength(sampleSize);
  const anomalies = [];

  // Score each instance
  dataset.forEach((item) => {
    let totalPath = 0;
    for (const tree of forest) {
      totalPath += getPathLength(item, tree);
    }
    const avgPath = totalPath / numTrees;
    // Anomaly score s(x, n) = 2^(-E(h(x)) / c(n))
    const score = Math.pow(2, -avgPath / (c_n || 1));

    // Threshold >= 0.58 indicates significant statistical isolation (outlier)
    if (score >= 0.58) {
      // Identify which specific columns deviate most from column averages
      const outlierFeatures = [];
      numericalColumns.forEach((col, idx) => {
        const val = item.features[idx];
        const allVals = dataset.map(d => d.features[idx]);
        const mean = allVals.reduce((a, b) => a + b, 0) / allVals.length;
        const variance = allVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allVals.length;
        const stdDev = Math.sqrt(variance) || 1;
        const zScore = (val - mean) / stdDev;

        if (Math.abs(zScore) >= 1.75) {
          outlierFeatures.push({
            column: col,
            value: val,
            mean: parseFloat(mean.toFixed(2)),
            zScore: parseFloat(zScore.toFixed(2))
          });
        }
      });

      anomalies.push({
        rowIndex: item.originalIndex,
        record: item.row,
        anomalyScore: parseFloat(score.toFixed(3)),
        severity: score >= 0.70 ? 'HIGH' : 'MODERATE',
        deviatingColumns: outlierFeatures,
        explanation: outlierFeatures.length > 0
          ? `Outlier values in: ${outlierFeatures.map(f => `${f.column}=${f.value} (${f.zScore > 0 ? '+' : ''}${f.zScore} std dev)`).join(', ')}`
          : 'Multivariate anomaly detected across combination of numerical columns.'
      });
    }
  });

  return anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore);
};

/**
 * Jaro-Winkler string similarity algorithm for fuzzy duplicate detection
 */
export const jaroWinklerDistance = (s1, s2) => {
  const str1 = String(s1 || '').trim().toLowerCase();
  const str2 = String(s2 || '').trim().toLowerCase();

  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  const str1Matches = new Array(str1.length).fill(false);
  const str2Matches = new Array(str2.length).fill(false);

  let matches = 0;
  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, str2.length);

    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  const m = matches;
  const jaro = (m / str1.length + m / str2.length + (m - transpositions / 2) / m) / 3;

  // Winkler prefix scaling (up to 4 matching prefix characters)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(str1.length, str2.length)); i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
};

/**
 * Finds suspicious near-duplicate records across dataset string fields
 */
export const findPotentialDuplicates = (rows, stringColumns, similarityThreshold = 0.85) => {
  const potentialDuplicates = [];
  const maxRowsToCompare = Math.min(rows.length, 300); // Guard for UI responsiveness

  for (let i = 0; i < maxRowsToCompare; i++) {
    for (let j = i + 1; j < maxRowsToCompare; j++) {
      const rowA = rows[i];
      const rowB = rows[j];

      let totalScore = 0;
      let evaluatedCount = 0;
      const mismatchedCols = [];

      for (const col of stringColumns) {
        const valA = String(rowA[col] || '').trim();
        const valB = String(rowB[col] || '').trim();

        if (valA && valB) {
          const sim = jaroWinklerDistance(valA, valB);
          totalScore += sim;
          evaluatedCount++;

          if (sim >= 0.75 && sim < 1.0) {
            mismatchedCols.push({ column: col, valueA: valA, valueB: valB, similarity: parseFloat((sim * 100).toFixed(1)) });
          }
        }
      }

      if (evaluatedCount > 0) {
        const compositeSimilarity = totalScore / evaluatedCount;
        // If similarity is high, but records are NOT 100% identical (suspicious typo or near-duplicate)
        if (compositeSimilarity >= similarityThreshold && compositeSimilarity < 0.999 && mismatchedCols.length > 0) {
          potentialDuplicates.push({
            rowAIndex: i + 1,
            rowBIndex: j + 1,
            rowA,
            rowB,
            compositeSimilarity: parseFloat((compositeSimilarity * 100).toFixed(1)),
            suspiciousDifferences: mismatchedCols,
            explanation: `Potential near-duplicate detected between Row ${i + 1} and Row ${j + 1} (${(compositeSimilarity * 100).toFixed(0)}% match). Typo suspected in: ${mismatchedCols.map(m => `${m.column} ('${m.valueA}' vs '${m.valueB}')`).join(', ')}`
          });
        }
      }
    }
  }

  return potentialDuplicates.sort((a, b) => b.compositeSimilarity - a.compositeSimilarity);
};

/**
 * Evaluates comprehensive ML & Data Quality profile for an uploaded dataset
 */
export const analyzeDataQuality = (rows, columnsProfile) => {
  const numericalCols = columnsProfile
    .filter(c => ['INT', 'BIGINT', 'DECIMAL(10,2)'].includes(c.detectedType))
    .map(c => c.originalName);

  const stringCols = columnsProfile
    .filter(c => c.detectedType.startsWith('VARCHAR') || c.detectedType === 'TEXT')
    .map(c => c.originalName);

  const numericalAnomalies = runIsolationForest(rows, numericalCols);
  const potentialDuplicates = findPotentialDuplicates(rows, stringCols);

  // Compute overall Data Quality Score (0 - 100%)
  const totalRows = rows.length;
  const anomalyDeduction = totalRows > 0 ? (numericalAnomalies.length / totalRows) * 20 : 0;
  const duplicateDeduction = totalRows > 0 ? (potentialDuplicates.length / totalRows) * 20 : 0;
  const nullDeduction = columnsProfile.reduce((acc, c) => acc + (parseFloat(c.nullPercentage) || 0), 0) / (columnsProfile.length || 1);

  const qualityScore = Math.max(10, Math.min(100, Math.round(100 - anomalyDeduction - duplicateDeduction - (nullDeduction * 0.3))));

  return {
    qualityScore,
    totalRows,
    numericalColumnsEvaluated: numericalCols,
    stringColumnsEvaluated: stringCols,
    numericalAnomalies,
    potentialDuplicates,
    summary: {
      anomalousRecordCount: numericalAnomalies.length,
      potentialDuplicatePairCount: potentialDuplicates.length,
      qualityRating: qualityScore >= 85 ? 'EXCELLENT' : qualityScore >= 70 ? 'GOOD' : 'FAIR'
    }
  };
};

