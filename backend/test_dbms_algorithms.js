import {
  computeAttributeClosure,
  findCandidateKeys,
  computeMinimalCover,
  synthesize3NF,
  verifyLosslessJoin,
  verifyDependencyPreservation,
  analyzeBCNF
} from './services/dbmsAlgorithms.js';

console.log('====================================================');
console.log('Testing Phase 1: Academic DBMS Relational Algorithms');
console.log('====================================================\n');

// -----------------------------------------------------------------
// Test 1: Attribute Closure
// R(A, B, C, D, E, F) with F = { A -> BC, CD -> E, B -> D, E -> A }
// Closure of {A}: A+ should be {A, B, C, D, E}
// -----------------------------------------------------------------
console.log('--- Test 1: Attribute Closure ---');
const F1 = [
  { determinant: ['A'], dependents: ['B', 'C'] },
  { determinant: ['C', 'D'], dependents: ['E'] },
  { determinant: ['B'], dependents: ['D'] },
  { determinant: ['E'], dependents: ['A'] }
];
const closureA = Array.from(computeAttributeClosure(['A'], F1)).sort();
console.log('F1 = { A -> BC, CD -> E, B -> D, E -> A }');
console.log('A+ =', closureA.join(', '));
const expectedClosureA = ['A', 'B', 'C', 'D', 'E'];
const test1Pass = JSON.stringify(closureA) === JSON.stringify(expectedClosureA);
console.log(`Test 1 Result: ${test1Pass ? 'PASSED ✓' : 'FAILED ✗'}\n`);

// -----------------------------------------------------------------
// Test 2: Candidate Key Discovery
// In R(A, B, C, D, E, F) with F1, attribute F appears nowhere in F1, so F must be in every key.
// Since {A}+ = {A, B, C, D, E}, {A, F}+ = {A, B, C, D, E, F}.
// Also {E}+ = {A, B, C, D, E}, so {E, F}+ = {A, B, C, D, E, F}.
// Also {B, C}+ = {B, C, D, E, A}, so {B, C, F}+ = {A, B, C, D, E, F}.
// Also {C, D}+ = {C, D, E, A, B}, so {C, D, F}+ = {A, B, C, D, E, F}.
// -----------------------------------------------------------------
console.log('--- Test 2: Candidate Key Discovery ---');
const attrs1 = ['A', 'B', 'C', 'D', 'E', 'F'];
const candidateKeys1 = findCandidateKeys(attrs1, F1);
console.log('Candidate keys for R(A,B,C,D,E,F):', candidateKeys1.map(k => `[${k.join(', ')}]`).join(' | '));
const hasAF = candidateKeys1.some(k => JSON.stringify(k) === JSON.stringify(['A', 'F']));
const hasEF = candidateKeys1.some(k => JSON.stringify(k) === JSON.stringify(['E', 'F']));
const test2Pass = hasAF && hasEF;
console.log(`Test 2 Result: ${test2Pass ? 'PASSED ✓' : 'FAILED ✗'}\n`);

// -----------------------------------------------------------------
// Test 3: Minimal Cover (Canonical Cover)
// Textbook example: F = { A -> B, ABCD -> E, EF -> G, ACDF -> EG }
// Or standard: F = { A -> B, B -> C, A -> C, AB -> D }
// Minimal cover of { A -> B, B -> C, A -> C, AB -> D } should be:
// 1. A -> C is redundant (transitive via A -> B -> C)
// 2. B is extraneous in AB -> D (since A -> B, so A+ includes B, so A -> D)
// Minimal cover = { A -> B, B -> C, A -> D } = { A -> {B, D}, B -> C }
// -----------------------------------------------------------------
console.log('--- Test 3: Minimal Cover (Canonical Cover) ---');
const F2 = [
  { determinant: ['A'], dependents: ['B'] },
  { determinant: ['B'], dependents: ['C'] },
  { determinant: ['A'], dependents: ['C'] },
  { determinant: ['A', 'B'], dependents: ['D'] }
];
const minCover2 = computeMinimalCover(F2);
console.log('F2 = { A -> B, B -> C, A -> C, AB -> D }');
console.log('Minimal Cover Fc:');
minCover2.forEach(fd => console.log(`  [${fd.determinant.join(', ')}] -> [${fd.dependents.join(', ')}]`));
// Check that AB is reduced to A, and redundant A -> C is eliminated
const hasReducedA = minCover2.some(fd => fd.determinant.length === 1 && fd.determinant[0] === 'A' && fd.dependents.includes('D'));
const hasNoRedundantAC = !minCover2.some(fd => fd.determinant.length === 1 && fd.determinant[0] === 'A' && fd.dependents.includes('C') && !fd.dependents.includes('B'));
const test3Pass = hasReducedA && hasNoRedundantAC;
console.log(`Test 3 Result: ${test3Pass ? 'PASSED ✓' : 'FAILED ✗'}\n`);

// -----------------------------------------------------------------
// Test 4: 3NF Synthesis (Bernstein's Algorithm)
// R(A, B, C, D) with F = { A -> B, B -> C, A -> D }
// Minimal cover is already { A -> BD, B -> C }
// Candidate key is A.
// Synthesized relations should be:
// R1(A, B, D) with PK A
// R2(B, C) with PK B
// Lossless and dependency preserving.
// -----------------------------------------------------------------
console.log('--- Test 4: 3NF Synthesis (Bernstein) ---');
const attrs2 = ['A', 'B', 'C', 'D'];
const ckeys2 = findCandidateKeys(attrs2, minCover2);
const relations3NF = synthesize3NF(attrs2, minCover2, ckeys2);
console.log('Synthesized 3NF Relations:');
relations3NF.forEach(r => {
  console.log(`  Relation: [${r.schema.join(', ')}], PK: [${r.primaryKey.join(', ')}]`);
});
const test4Pass = relations3NF.length === 2 &&
  relations3NF.some(r => r.schema.includes('A') && r.schema.includes('B') && r.schema.includes('D')) &&
  relations3NF.some(r => r.schema.includes('B') && r.schema.includes('C'));
console.log(`Test 4 Result: ${test4Pass ? 'PASSED ✓' : 'FAILED ✗'}\n`);

// -----------------------------------------------------------------
// Test 5: Lossless Join & Dependency Preservation Verification
// -----------------------------------------------------------------
console.log('--- Test 5: Verification (Lossless Join & Dependency Preservation) ---');
const lossless = verifyLosslessJoin(relations3NF, minCover2, ckeys2);
console.log('Lossless Join:', lossless.isLossless ? 'VERIFIED ✓' : 'FAILED ✗');
console.log('Explanation:', lossless.explanation);

const depPres = verifyDependencyPreservation(relations3NF, F2);
console.log('Dependency Preservation:', depPres.isPreserved ? 'VERIFIED ✓' : 'FAILED ✗');
console.log(`Preserved ${depPres.preservedCount} / ${depPres.totalCount} dependencies.`);

// -----------------------------------------------------------------
// Test 6: BCNF Analysis
// In R1(A, B, D), A -> BD, A is superkey -> BCNF.
// In R2(B, C), B -> C, B is superkey -> BCNF.
// -----------------------------------------------------------------
console.log('\n--- Test 6: BCNF Analysis ---');
const bcnfReport = analyzeBCNF(relations3NF, minCover2);
bcnfReport.forEach(r => {
  console.log(`  Relation [${r.schema.join(', ')}]: isBCNF = ${r.isBCNF}`);
});

const allPassed = test1Pass && test2Pass && test3Pass && test4Pass && lossless.isLossless && depPres.isPreserved;
console.log('\n====================================================');
console.log(`OVERALL PHASE 1 STATUS: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);
console.log('====================================================');

if (!allPassed) process.exit(1);

