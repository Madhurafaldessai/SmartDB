/**
 * Functional Dependency Discovery & Violation Analysis Service
 *
 * Supports:
 * - Determinants up to size 3 (|X| <= 3) with non-minimal combinatorial pruning
 * - Equivalence class partitioning for sub-second execution
 * - Exact violation counts and violation rates (%)
 * - Clear separation of observed sample dependencies vs confirmed business rules
 */

/**
 * Tests whether determinant X functionally determines dependent column A on a dataset.
 * Computes:
 * - determinismRatio: proportion of determinant groups with zero conflicts (1.0 = perfect FD)
 * - violationCount: exact number of tuples conflicting with the majority dependent value
 * - violationRate: percentage of records violating the dependency
 * - totalGroups: number of distinct determinant values
 */
export const evaluateFunctionalDependency = (rows, determinantCols, dependentCol) => {
  if (rows.length === 0 || determinantCols.includes(dependentCol)) {
    return { isValid: false, determinismRatio: 0, violationCount: 0, violationRate: 0 };
  }

  // Group rows by determinant value: determinantKey -> Map<dependentValue, count>
  const groups = new Map();
  let totalEvaluatedRows = 0;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    let hasNullDet = false;
    const detKeyParts = new Array(determinantCols.length);

    for (let c = 0; c < determinantCols.length; c++) {
      const v = row[determinantCols[c]];
      if (v === null || v === undefined || String(v).trim() === '') {
        hasNullDet = true;
        break;
      }
      detKeyParts[c] = String(v).trim();
    }

    if (hasNullDet) continue;

    const depRaw = row[dependentCol];
    const depVal = depRaw !== null && depRaw !== undefined ? String(depRaw).trim() : 'NULL_VAL';

    const detKey = detKeyParts.join('||#||');
    totalEvaluatedRows++;

    let groupCounts = groups.get(detKey);
    if (!groupCounts) {
      groupCounts = new Map();
      groups.set(detKey, groupCounts);
    }
    groupCounts.set(depVal, (groupCounts.get(depVal) || 0) + 1);
  }

  const totalGroups = groups.size;
  if (totalGroups <= 1 && totalEvaluatedRows <= 1) {
    return { isValid: false, determinismRatio: 0, violationCount: 0, violationRate: 0 };
  }

  let consistentGroups = 0;
  let totalViolations = 0;

  for (const [_, depCounts] of groups.entries()) {
    if (depCounts.size === 1) {
      consistentGroups++;
    } else {
      let maxCount = 0;
      let groupTotal = 0;
      for (const count of depCounts.values()) {
        groupTotal += count;
        if (count > maxCount) maxCount = count;
      }
      totalViolations += (groupTotal - maxCount);
    }
  }

  const determinismRatio = totalGroups > 0 ? consistentGroups / totalGroups : 0;
  const violationRate = totalEvaluatedRows > 0 ? (totalViolations / totalEvaluatedRows) * 100 : 0;

  return {
    isValid: true,
    determinismRatio: parseFloat(determinismRatio.toFixed(4)),
    violationCount: totalViolations,
    violationRate: parseFloat(violationRate.toFixed(2)),
    totalEvaluatedRows,
    totalGroups
  };
};

/**
 * Helper to generate combinations of a given size from an array
 */
const getCombinations = (arr, size) => {
  const results = [];
  const helper = (start, combo) => {
    if (combo.length === size) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  };
  helper(0, []);
  return results;
};

/**
 * Discovers candidate functional dependencies from dataset up to determinant size 3 (|X| <= 3).
 *
 * @param {string[]} headers - Dataset column headers
 * @param {Array<Object>} rows - Data rows
 * @param {Object} options - Thresholds and candidate keys
 * @returns {Array<Object>} - Discovered functional dependencies with violation metrics
 */
export const detectFunctionalDependencies = (headers, rows, options = {}) => {
  const minConfidence = options.minConfidence !== undefined ? options.minConfidence : 0.95;
  const maxDeterminantSize = Math.min(options.maxDeterminantSize || 3, 3);
  const knownCandidateKeys = options.candidateKeys || [];

  const discoveredFDs = [];
  const superkeysFound = new Set();

  // Helper: Is this determinant a superset of an already discovered superkey?
  const isSuperkeySuperset = (detArray) => {
    const detSet = new Set(detArray);
    for (const sk of superkeysFound) {
      let isSuperset = true;
      for (const attr of sk) {
        if (!detSet.has(attr)) {
          isSuperset = false;
          break;
        }
      }
      if (isSuperset) return true;
    }
    return false;
  };

  // Helper: Has this dependent column already been determined by a proper subset of det?
  const isAlreadyDeterminedByProperSubset = (detArray, dep) => {
    for (const existing of discoveredFDs) {
      if (existing.dependents.includes(dep) && existing.confidence >= minConfidence) {
        if (existing.determinant.length < detArray.length &&
            existing.determinant.every(a => detArray.includes(a))) {
          return true;
        }
      }
    }
    return false;
  };

  // 1. Evaluate determinants of size 1, 2, and 3
  for (let size = 1; size <= maxDeterminantSize; size++) {
    const determinantCandidates = getCombinations(headers, size);

    for (const det of determinantCandidates) {
      // If determinant is already a superset of a known superkey, prune it
      if (size > 1 && isSuperkeySuperset(det)) {
        continue;
      }

      // Quick distinct check: constant columns cannot be determinants
      const distinctCheck = new Set();
      for (let r = 0; r < Math.min(rows.length, 50); r++) {
        const val = det.map(c => rows[r][c]).join('||');
        distinctCheck.add(val);
      }
      if (distinctCheck.size <= 1 && rows.length > 5) continue;

      const validDependents = [];
      const remainingCols = headers.filter(h => !det.includes(h));

      for (const dep of remainingCols) {
        // Skip if dep is already determined by a proper subset of det (extraneous LHS)
        if (size > 1 && isAlreadyDeterminedByProperSubset(det, dep)) {
          continue;
        }

        const evalResult = evaluateFunctionalDependency(rows, det, dep);

        if (evalResult.isValid && evalResult.determinismRatio >= minConfidence) {
          validDependents.push({
            column: dep,
            confidence: evalResult.determinismRatio,
            violationCount: evalResult.violationCount,
            violationRate: evalResult.violationRate
          });
        }
      }

      if (validDependents.length > 0) {
        const avgConfidence = validDependents.reduce((acc, d) => acc + d.confidence, 0) / validDependents.length;
        const totalViolations = validDependents.reduce((acc, d) => acc + d.violationCount, 0);
        const maxViolationRate = Math.max(...validDependents.map(d => d.violationRate));

        // Check if this determinant determines ALL remaining columns (superkey)
        const isSuperkey = validDependents.length === remainingCols.length && avgConfidence === 1.0;
        if (isSuperkey) {
          superkeysFound.add(det);
        }

        discoveredFDs.push({
          determinant: det.sort(),
          dependents: validDependents.map(d => d.column).sort(),
          confidence: parseFloat(avgConfidence.toFixed(4)),
          violationCount: totalViolations,
          violationRate: parseFloat(maxViolationRate.toFixed(2)),
          isPerfect: totalViolations === 0,
          isObserved: true,
          isConfirmed: avgConfidence >= 0.98 && totalViolations === 0,
          isCandidateKey: isSuperkey || knownCandidateKeys.some(k =>
            Array.isArray(k) && k.length === det.length && k.every(a => det.includes(a))
          )
        });
      }
    }
  }

  // 2. Canonical filtering:
  // Prioritize natural ID determinants (_id, _code, _num) over arbitrary text attributes
  const isIdColumn = (col) => /(_id|_code|_num)$/i.test(col);

  const enrichedFDs = discoveredFDs.map(fd => {
    const detIsId = fd.determinant.some(isIdColumn);
    const isRedundantAlternate = !detIsId && discoveredFDs.some(other =>
      other !== fd &&
      other.determinant.some(isIdColumn) &&
      fd.determinant.every(a => other.dependents.includes(a))
    );

    return {
      ...fd,
      isRecommended: !isRedundantAlternate && fd.confidence >= minConfidence
    };
  });

  return enrichedFDs;
};

/**
 * Classifies functional dependencies into 2NF (partial) and 3NF (transitive) violations
 */
export const classifyDependencies = (headers, dependencies, primaryKey) => {
  const pkList = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
  const pkSet = new Set(pkList);
  const isCompositePK = pkList.length > 1;

  const partialDependencies = [];
  const transitiveDependencies = [];
  const fullKeyDependencies = [];

  for (const fd of dependencies) {
    const det = fd.determinant;
    const isDetSubsetOfPK = isCompositePK && det.every(col => pkSet.has(col)) && det.length < pkList.length;
    const isDetExactPK = det.length === pkList.length && det.every(col => pkSet.has(col));

    if (isDetSubsetOfPK) {
      partialDependencies.push({
        ...fd,
        violation: '2NF',
        description: `Determinant [${det.join(', ')}] is a proper subset of composite primary key [${pkList.join(', ')}]. Violates 2NF (Partial Dependency).`
      });
    } else if (!isDetExactPK && !det.every(col => pkSet.has(col))) {
      transitiveDependencies.push({
        ...fd,
        violation: '3NF',
        description: `Determinant [${det.join(', ')}] is not a candidate key, determining non-key attributes [${fd.dependents.join(', ')}]. Violates 3NF (Transitive Dependency).`
      });
    } else {
      fullKeyDependencies.push(fd);
    }
  }

  return {
    primaryKey: pkList,
    isCompositePK,
    partialDependencies,
    transitiveDependencies,
    fullKeyDependencies
  };
};
