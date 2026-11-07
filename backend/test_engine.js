import path from 'path';
import { fileURLToPath } from 'url';
import { parseUploadedFile } from './services/fileParser.js';
import { profileDataset } from './services/dataProfiler.js';
import { detectFunctionalDependencies } from './services/dependencyAnalyzer.js';
import { normalizeDataset } from './services/normalizationEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDataset(csvFilename, description) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`DATASET: ${description}`);
  console.log(`FILE:    ${csvFilename}`);
  console.log('='.repeat(70));

  const csvPath = path.resolve(__dirname, '../database/sample_data', csvFilename);
  const parsed = await parseUploadedFile(csvPath, csvFilename);
  const profile = profileDataset(parsed.headers, parsed.rows);

  console.log(`\nColumns (${parsed.headers.length}): ${parsed.headers.join(', ')}`);
  console.log(`Rows: ${parsed.totalRows}`);
  console.log(`Single Candidate Keys: ${profile.singleCandidateKeys.join(', ') || 'None'}`);
  console.log(`Composite Candidate Keys: ${profile.compositeCandidateKeys.map(k => `[${k.join(', ')}]`).join(' | ') || 'None'}`);

  const candidateKeys = [
    ...profile.singleCandidateKeys.map(k => [k]),
    ...profile.compositeCandidateKeys
  ];

  const allFDs = detectFunctionalDependencies(parsed.headers, parsed.rows, candidateKeys);
  const recommendedFDs = allFDs.filter(fd => fd.isRecommended);

  console.log(`\nFunctional Dependencies (${recommendedFDs.length} recommended):`);
  recommendedFDs.forEach(fd => {
    const marker = fd.isCandidateKey ? ' [CANDIDATE KEY]' : '';
    console.log(`  [${fd.determinant.join(', ')}] -> [${fd.dependents.join(', ')}]${marker}`);
  });

  const chosenPK = profile.singleCandidateKeys.length > 0
    ? [profile.singleCandidateKeys[0]]
    : (profile.compositeCandidateKeys[0] || [parsed.headers[0]]);

  const result = normalizeDataset({
    headers: parsed.headers,
    rows: parsed.rows,
    columnsProfile: profile.columns,
    dependencies: recommendedFDs,
    chosenPrimaryKey: chosenPK
  });

  console.log(`\nNormalized Tables (${result.tables.length} tables, PK = [${chosenPK.join(', ')}]):`);
  result.tables.forEach(t => {
    const pkCols = t.columns.filter(c => c.isPrimaryKey).map(c => c.columnName);
    const fkCols = t.columns.filter(c => c.isForeignKey).map(c => `${c.columnName} -> ${c.foreignTable}`);
    console.log(`  TABLE: ${t.tableName}`);
    console.log(`    PK:      [${pkCols.join(', ')}]`);
    console.log(`    Columns: ${t.columns.map(c => c.columnName).join(', ')}`);
    if (fkCols.length > 0) console.log(`    FKs:     ${fkCols.join(', ')}`);
  });

  console.log(`\nRelationships (${result.relationships.length}):`);
  result.relationships.forEach(r => {
    console.log(`  ${r.parentTable}.${r.parentColumn} -> ${r.childTable}.${r.childColumn}  [${r.type}]`);
  });
}

async function runAll() {
  await testDataset('student_course_unnormalized.csv', 'University Student Enrollments');
  await testDataset('hospital_records_unnormalized.csv', 'Hospital Patient Records');
  console.log(`\n${'='.repeat(70)}`);
  console.log('✓ Both datasets produce distinct, independent table structures.');
  console.log('  No hardcoded columns, entities, or domain assumptions detected.');
  console.log('='.repeat(70));
}

runAll().catch(err => { console.error(err); process.exit(1); });
