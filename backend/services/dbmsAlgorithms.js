/**
 * SmartDB Core Relational Theory & DBMS Algorithms Module
 *
 * Implements standard academic relational database design algorithms:
 * 1. Attribute Closure: computeAttributeClosure(X, F)
 * 2. Candidate Keys: findCandidateKeys(attributes, F)
 * 3. Minimal Cover (Canonical Cover): computeMinimalCover(F)
 * 4. 3NF Synthesis (Bernstein's Algorithm): synthesize3NF(attributes, F, candidateKeys)
 * 5. Lossless Join Verification: verifyLosslessJoin(decomposition, F, candidateKeys)
 * 6. Dependency Preservation Verification: verifyDependencyPreservation(decomposition, F)
 * 7. BCNF Analysis: analyzeBCNF(decomposition, F)
 */

/**
 * Standardizes an FD into canonical object format { determinant: string[], dependents: string[] }
 */
export const normalizeFD = (fd) => {
  const determinant = Array.isArray(fd.determinant) ? [...fd.determinant] : [fd.determinant];
  const dependents = Array.isArray(fd.dependents || fd.dependent)
    ? [...(fd.dependents || fd.dependent)]
    : [fd.dependents || fd.dependent];
  return {
    determinant: determinant.map(String).sort(),
    dependents: dependents.map(String).sort()
  };
};

/**
 * Computes the attribute closure X+ with respect to functional dependencies F.
 * @param {string[]|Set<string>} X - Initial set of attributes
 * @param {Array<{determinant: string[], dependents: string[]}>} F - Functional dependencies
 * @returns {Set<string>} - The attribute closure X+
 */
export const computeAttributeClosure = (X, F) => {
  const closure = new Set(Array.isArray(X) ? X : Array.from(X));
  const normalizedF = F.map(normalizeFD);

  let changed = true;
  while (changed) {
    changed = false;
    for (const fd of normalizedF) {
      // If determinant is a subset of current closure
      const detIsSubset = fd.determinant.every(attr => closure.has(attr));
      if (detIsSubset) {
        for (const dep of fd.dependents) {
          if (!closure.has(dep)) {
            closure.add(dep);
            changed = true;
          }
        }
      }
    }
  }

  return closure;
};

/**
 * Helper to check if set A is a subset of set B
 */
const isSubsetOf = (subset, superset) => {
  for (const item of subset) {
    if (!superset.has(item)) return false;
  }
  return true;
};

/**
 * Helper to generate all combinations of a given size from an array
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
 * Finds all candidate keys for relation schema R under functional dependencies F.
 * Uses attribute classification (L, R, B, N) to prune the search space exponentially:
 * - L: attributes appearing only on LHS (must be in every candidate key)
 * - R: attributes appearing only on RHS (can never be in any candidate key)
 * - B: attributes appearing on both LHS and RHS
 * - N: attributes appearing on neither (must be in every candidate key)
 *
 * @param {string[]} allAttributes - All attributes in relation R
 * @param {Array<{determinant: string[], dependents: string[]}>} F - Functional dependencies
 * @returns {Array<string[]>} - List of all minimal candidate keys
 */
export const findCandidateKeys = (allAttributes, F) => {
  const allAttrsSet = new Set(allAttributes);
  const normalizedF = F.map(normalizeFD);

  if (normalizedF.length === 0 || allAttributes.length === 0) {
    return [allAttributes];
  }

  const lhsAttrs = new Set();
  const rhsAttrs = new Set();

  normalizedF.forEach(fd => {
    fd.determinant.forEach(a => lhsAttrs.add(a));
    fd.dependents.forEach(a => rhsAttrs.add(a));
  });

  const L = new Set([...lhsAttrs].filter(a => !rhsAttrs.has(a) && allAttrsSet.has(a)));
  const R = new Set([...rhsAttrs].filter(a => !lhsAttrs.has(a) && allAttrsSet.has(a)));
  const B = [...allAttrsSet].filter(a => lhsAttrs.has(a) && rhsAttrs.has(a));
  const N = [...allAttrsSet].filter(a => !lhsAttrs.has(a) && !rhsAttrs.has(a));

  // Must-have attributes: L U N
  const essential = new Set([...L, ...N]);

  // Check if essential attributes already form a candidate key
  const essentialClosure = computeAttributeClosure(essential, normalizedF);
  if (essentialClosure.size === allAttributes.length) {
    return [Array.from(essential).sort()];
  }

  // Otherwise, search combinations of B of increasing size
  const candidateKeys = [];
  const candidateKeySets = [];

  for (let size = 1; size <= B.length; size++) {
    const combos = getCombinations(B, size);
    for (const combo of combos) {
      const candidateCandidate = new Set([...essential, ...combo]);

      // Prune if this candidate is a superset of an already found candidate key
      const isSuperset = candidateKeySets.some(key => isSubsetOf(key, candidateCandidate));
      if (isSuperset) continue;

      const closure = computeAttributeClosure(candidateCandidate, normalizedF);
      if (closure.size === allAttributes.length) {
        candidateKeys.push(Array.from(candidateCandidate).sort());
        candidateKeySets.push(candidateCandidate);
      }
    }
    // If we found candidate keys of this size, continue searching for other keys of the same or larger size
    // but only if they are not supersets of already found keys.
  }

  // Fallback: If no candidate key found through FDs, all attributes form the key
  if (candidateKeys.length === 0) {
    return [allAttributes.slice().sort()];
  }

  return candidateKeys;
};

/**
 * Computes the Minimal Cover (Canonical Cover) Fc for functional dependencies F:
 * 1. Decompose RHS into singletons (X -> {A, B} => X -> A, X -> B).
 * 2. Eliminate extraneous LHS attributes using attribute closure.
 * 3. Eliminate redundant functional dependencies.
 *
 * @param {Array<{determinant: string[], dependents: string[]}>} F - Initial functional dependencies
 * @returns {Array<{determinant: string[], dependents: string[]}>} - Canonical minimal cover
 */
export const computeMinimalCover = (F) => {
  // Step 1: Singleton RHS
  let singletons = [];
  for (const rawFd of F) {
    const fd = normalizeFD(rawFd);
    for (const dep of fd.dependents) {
      if (!fd.determinant.includes(dep)) {
        singletons.push({
          determinant: [...fd.determinant],
          dependents: [dep]
        });
      }
    }
  }

  // Step 2: Remove extraneous LHS attributes
  // An attribute B in X is extraneous in X -> A if A in (X - {B})+ under current F
  for (let i = 0; i < singletons.length; i++) {
    const fd = singletons[i];
    if (fd.determinant.length > 1) {
      const targetDep = fd.dependents[0];
      const currentDet = [...fd.determinant];

      for (const attr of currentDet) {
        if (fd.determinant.length <= 1) break;

        const reducedDet = fd.determinant.filter(a => a !== attr);
        // Compute closure of reducedDet with respect to the entire set of singletons
        const closure = computeAttributeClosure(reducedDet, singletons);

        if (closure.has(targetDep)) {
          // attr is extraneous! Remove it from determinant
          fd.determinant = reducedDet;
        }
      }
    }
  }

  // Step 3: Remove redundant functional dependencies
  // An FD f: X -> A is redundant in F if A in X+ under (F - {f})
  let minimalCover = [];
  for (let i = 0; i < singletons.length; i++) {
    const candidateFd = singletons[i];
    const targetDep = candidateFd.dependents[0];

    // Other FDs excluding candidateFd and already removed FDs
    const otherFDs = [
      ...minimalCover,
      ...singletons.slice(i + 1)
    ];

    const closureWithoutCandidate = computeAttributeClosure(candidateFd.determinant, otherFDs);
    if (!closureWithoutCandidate.has(targetDep)) {
      // Not redundant! Keep it
      minimalCover.push(candidateFd);
    }
  }

  // Step 4: Group FDs with identical determinants for cleaner presentation
  const groupedMap = new Map();
  for (const fd of minimalCover) {
    const key = fd.determinant.slice().sort().join(',');
    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        determinant: fd.determinant,
        dependents: []
      });
    }
    groupedMap.get(key).dependents.push(...fd.dependents);
  }

  return Array.from(groupedMap.values()).map(g => ({
    determinant: g.determinant.sort(),
    dependents: Array.from(new Set(g.dependents)).sort()
  }));
};

/**
 * 3NF Synthesis (Bernstein's Algorithm)
 * Guaranteed to produce a decomposition that is both LOSSLESS and DEPENDENCY-PRESERVING.
 *
 * Algorithm:
 * 1. Compute minimal cover Fc.
 * 2. For each unique determinant X in Fc, create relation schema Ri = X U dependents.
 * 3. If no relation contains a candidate key of R, add relation R_key = K for one candidate key K.
 * 4. Eliminate redundant relations (Ri subset of Rj).
 *
 * @param {string[]} allAttributes - All attributes in original relation R
 * @param {Array<{determinant: string[], dependents: string[]}>} minimalCover - Minimal cover Fc
 * @param {Array<string[]>} candidateKeys - Candidate keys of R
 * @returns {Array<{schema: string[], primaryKey: string[], reason: string}>} - Synthesized relations
 */
export const synthesize3NF = (allAttributes, minimalCover, candidateKeys) => {
  const relations = [];

  // Step 2: Create relation for each grouped FD in minimal cover
  for (const fd of minimalCover) {
    const relationAttrs = Array.from(new Set([...fd.determinant, ...fd.dependents])).sort();
    relations.push({
      schema: relationAttrs,
      primaryKey: [...fd.determinant].sort(),
      reason: `Synthesized from functional dependency: [${fd.determinant.join(', ')}] -> [${fd.dependents.join(', ')}]`
    });
  }

  // Step 3: Check if any relation contains a candidate key of R
  const hasCandidateKey = candidateKeys.some(candidateKey => {
    const candidateSet = new Set(candidateKey);
    return relations.some(rel => {
      const relSet = new Set(rel.schema);
      return isSubsetOf(candidateSet, relSet);
    });
  });

  if (!hasCandidateKey && candidateKeys.length > 0) {
    // Add relation containing one candidate key to guarantee Lossless Join
    const chosenKey = candidateKeys[0];
    relations.push({
      schema: [...chosenKey].sort(),
      primaryKey: [...chosenKey].sort(),
      reason: `Added candidate key relation [${chosenKey.join(', ')}] to guarantee Lossless Join property`
    });
  }

  // Step 4: Eliminate redundant relations (where Ri is a proper subset of Rj)
  const nonRedundant = [];
  for (let i = 0; i < relations.length; i++) {
    const rA = relations[i];
    const setA = new Set(rA.schema);

    let isContained = false;
    for (let j = 0; j < relations.length; j++) {
      if (i === j) continue;
      const rB = relations[j];
      const setB = new Set(rB.schema);

      // If setA is a proper subset of setB, or if identical and j < i
      if (isSubsetOf(setA, setB)) {
        if (setA.size < setB.size || (setA.size === setB.size && j < i)) {
          isContained = true;
          break;
        }
      }
    }

    if (!isContained) {
      nonRedundant.push(rA);
    }
  }

  return nonRedundant;
};

/**
 * Verifies if a decomposition satisfies the Lossless Join property with respect to F.
 * Uses Theorem: A decomposition D = {R1, ..., Rk} has a lossless join under F
 * if at least one Ri contains a candidate key of R.
 *
 * @param {Array<{schema: string[]}>} decomposition - Decomposed relations
 * @param {Array<{determinant: string[], dependents: string[]}>} F - Functional dependencies
 * @param {Array<string[]>} candidateKeys - Candidate keys of R
 * @returns {{isLossless: boolean, explanation: string, containingRelations: string[]}}
 */
export const verifyLosslessJoin = (decomposition, F, candidateKeys) => {
  const containingRelations = [];

  for (const key of candidateKeys) {
    const keySet = new Set(key);
    for (const rel of decomposition) {
      const relSet = new Set(rel.schema || rel.columns?.map(c => c.originalName || c.columnName) || []);
      if (isSubsetOf(keySet, relSet)) {
        containingRelations.push({
          key: key.join(', '),
          relation: rel.tableName || rel.schema?.join(', ')
        });
      }
    }
  }

  const isLossless = containingRelations.length > 0;
  return {
    isLossless,
    explanation: isLossless
      ? `Lossless join verified: candidate key [${containingRelations[0].key}] is preserved in relation '${containingRelations[0].relation}'. Natural join reconstructs original relation without spurious tuples.`
      : `Lossless join condition not satisfied: none of the decomposed relations contains a candidate key of the original schema.`,
    containingRelations
  };
};

/**
 * Verifies if a decomposition satisfies the Dependency Preservation property.
 * A decomposition D is dependency-preserving if for every X -> Y in F,
 * Y is in the closure of X with respect to the projected dependencies on each Ri.
 *
 * @param {Array<{schema: string[]}>} decomposition - Decomposed relations
 * @param {Array<{determinant: string[], dependents: string[]}>} F - Functional dependencies
 * @returns {{isPreserved: boolean, preservedCount: number, totalCount: number, details: Array}}
 */
export const verifyDependencyPreservation = (decomposition, F) => {
  const normalizedF = F.map(normalizeFD);
  const details = [];
  let preservedCount = 0;

  const relAttributeSets = decomposition.map(rel =>
    new Set(rel.schema || rel.columns?.map(c => c.originalName || c.columnName) || [])
  );

  for (const fd of normalizedF) {
    const detSet = new Set(fd.determinant);
    const depSet = new Set(fd.dependents);
    const allFdAttrs = new Set([...fd.determinant, ...fd.dependents]);

    // Check if the entire FD is locally contained within at least one relation schema
    const locallyContainedIn = relAttributeSets.findIndex(relSet => isSubsetOf(allFdAttrs, relSet));

    if (locallyContainedIn !== -1) {
      preservedCount++;
      details.push({
        fd: `[${fd.determinant.join(', ')}] -> [${fd.dependents.join(', ')}]`,
        isPreserved: true,
        type: 'local',
        relationIndex: locallyContainedIn
      });
    } else {
      // Test if FD is implied by projections across relations
      let closure = new Set(fd.determinant);
      let changed = true;

      while (changed) {
        changed = false;
        for (const relSet of relAttributeSets) {
          // Intersection of current closure with relation
          const intersection = [...closure].filter(a => relSet.has(a));
          if (intersection.length > 0) {
            const localClosure = computeAttributeClosure(intersection, normalizedF);
            for (const attr of localClosure) {
              if (relSet.has(attr) && !closure.has(attr)) {
                closure.add(attr);
                changed = true;
              }
            }
          }
        }
      }

      const allDepsInClosure = fd.dependents.every(dep => closure.has(dep));
      if (allDepsInClosure) {
        preservedCount++;
        details.push({
          fd: `[${fd.determinant.join(', ')}] -> [${fd.dependents.join(', ')}]`,
          isPreserved: true,
          type: 'transitive_closure'
        });
      } else {
        details.push({
          fd: `[${fd.determinant.join(', ')}] -> [${fd.dependents.join(', ')}]`,
          isPreserved: false,
          type: 'lost'
        });
      }
    }
  }

  const isPreserved = preservedCount === normalizedF.length;
  return {
    isPreserved,
    preservedCount,
    totalCount: normalizedF.length,
    details
  };
};

/**
 * Analyzes whether each decomposed relation satisfies Boyce-Codd Normal Form (BCNF).
 * A relation R_i is in BCNF if for every non-trivial FD X -> Y holding on R_i, X is a superkey of R_i.
 *
 * @param {Array<{schema: string[]}>} decomposition - Decomposed relations
 * @param {Array<{determinant: string[], dependents: string[]}>} F - Functional dependencies
 * @returns {Array<{schema: string[], isBCNF: boolean, violations: Array}>}
 */
export const analyzeBCNF = (decomposition, F) => {
  const normalizedF = F.map(normalizeFD);

  return decomposition.map(rel => {
    const relAttrs = rel.schema || rel.columns?.map(c => c.originalName || c.columnName) || [];
    const relSet = new Set(relAttrs);
    const violations = [];

    for (const fd of normalizedF) {
      const detSubset = fd.determinant.every(a => relSet.has(a));
      if (detSubset) {
        // Find dependents that belong to this relation
        const validDeps = fd.dependents.filter(d => relSet.has(d) && !fd.determinant.includes(d));
        if (validDeps.length > 0) {
          // Check if determinant is a superkey of this relation
          const closure = computeAttributeClosure(fd.determinant, normalizedF);
          const isSuperkey = relAttrs.every(a => closure.has(a));

          if (!isSuperkey) {
            violations.push({
              determinant: fd.determinant,
              dependents: validDeps,
              explanation: `Determinant [${fd.determinant.join(', ')}] determines [${validDeps.join(', ')}], but is not a superkey for relation [${relAttrs.join(', ')}].`
            });
          }
        }
      }
    }

    return {
      schema: relAttrs,
      isBCNF: violations.length === 0,
      violations
    };
  });
};

