import { sanitizeIdentifier } from './fileParser.js';

/**
 * Infers appropriate MySQL data type from array of sample string values
 */
export const inferDataType = (values) => {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonNullValues.length === 0) return 'VARCHAR(255)';

  let isInt = true;
  let isDecimal = true;
  let isDate = true;
  let isBoolean = true;
  let maxLen = 0;

  const boolRegex = /^(true|false|0|1|yes|no)$/i;
  const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;

  for (const rawVal of nonNullValues) {
    const val = String(rawVal).trim();
    maxLen = Math.max(maxLen, val.length);

    if (isInt && !/^-?\d+$/.test(val)) {
      isInt = false;
    }
    if (isDecimal && !/^-?\d+(\.\d+)?$/.test(val)) {
      isDecimal = false;
    }
    if (isBoolean && !boolRegex.test(val)) {
      isBoolean = false;
    }
    if (isDate && (isNaN(Date.parse(val)) || !dateRegex.test(val) && !val.includes('-') && !val.includes('/'))) {
      isDate = false;
    }
  }

  if (isBoolean && nonNullValues.length > 0) return 'TINYINT(1)';
  if (isInt) {
    // Check range
    const maxVal = Math.max(...nonNullValues.map(v => parseInt(v, 10)));
    return maxVal > 2147483647 ? 'BIGINT' : 'INT';
  }
  if (isDecimal) return 'DECIMAL(10,2)';
  if (isDate) return 'DATETIME';
  if (maxLen > 255) return 'TEXT';
  return `VARCHAR(${Math.max(64, Math.min(255, Math.ceil(maxLen * 1.5)))})`;
};

/**
 * Checks if a column exhibits non-atomic (repeating/multi-valued) patterns (1NF check)
 */
export const detectNonAtomicValues = (values) => {
  let flaggedCount = 0;
  const nonNull = values.filter(v => v && typeof v === 'string');
  if (nonNull.length === 0) return { hasRepeatingGroups: false, sampleViolations: [] };

  const samples = [];
  const delimiterPattern = /[,;|]\s*[^,;|]+/;

  for (const v of nonNull) {
    // Check if cell contains delimiters like comma, semicolon, or pipe between words
    if (delimiterPattern.test(v) && !/^\d{4}-\d{2}-\d{2}/.test(v)) {
      flaggedCount++;
      if (samples.length < 3) {
        samples.push(v);
      }
    }
  }

  const ratio = flaggedCount / nonNull.length;
  return {
    hasRepeatingGroups: ratio > 0.15, // If >15% of cells have multi-values
    violationRatio: ratio,
    sampleViolations: samples
  };
};

/**
 * Profiles the full dataset to compute metrics, candidate keys, and potential anomalies
 */
export const profileDataset = (headers, rows) => {
  const totalRows = rows.length;
  const columnsProfile = [];
  const singleCandidateKeys = [];

  headers.forEach((header, colIndex) => {
    const rawValues = rows.map(r => r[header]);
    const nonNullValues = rawValues.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    const nullCount = totalRows - nonNullValues.length;
    const uniqueValues = new Set(nonNullValues.map(v => String(v).trim()));
    const uniqueCount = uniqueValues.size;

    const detectedType = inferDataType(rawValues);
    const nonAtomicCheck = detectNonAtomicValues(rawValues);

    // A single column candidate key must have 0 nulls and 100% uniqueness
    const isCandidateKey = (totalRows > 0) && (nullCount === 0) && (uniqueCount === totalRows);
    if (isCandidateKey) {
      singleCandidateKeys.push(header);
    }

    columnsProfile.push({
      columnIndex: colIndex,
      originalName: header,
      sanitizedName: sanitizeIdentifier(header),
      detectedType,
      nullCount,
      nullPercentage: totalRows > 0 ? ((nullCount / totalRows) * 100).toFixed(1) : 0,
      uniqueCount,
      uniquenessRatio: totalRows > 0 ? (uniqueCount / totalRows).toFixed(4) : 0,
      isCandidateKey,
      nonAtomicCheck,
      sampleValues: Array.from(uniqueValues).slice(0, 5)
    });
  });

  // Calculate duplicate rows across the entire dataset
  const rowSignatures = new Set();
  let duplicateRowCount = 0;
  for (const row of rows) {
    const signature = headers.map(h => String(row[h] || '').trim()).join('|###|');
    if (rowSignatures.has(signature)) {
      duplicateRowCount++;
    } else {
      rowSignatures.add(signature);
    }
  }

  // Composite candidate key search if no single candidate key found
  let compositeCandidateKeys = [];
  if (singleCandidateKeys.length === 0 && headers.length >= 2 && totalRows > 0) {
    for (let i = 0; i < headers.length; i++) {
      for (let j = i + 1; j < headers.length; j++) {
        const col1 = headers[i];
        const col2 = headers[j];
        const pairSet = new Set();
        let pairUnique = true;

        for (const row of rows) {
          const v1 = row[col1];
          const v2 = row[col2];
          if (!v1 || !v2) {
            pairUnique = false;
            break;
          }
          const pairKey = `${v1}__##__${v2}`;
          if (pairSet.has(pairKey)) {
            pairUnique = false;
            break;
          }
          pairSet.add(pairKey);
        }

        if (pairUnique && pairSet.size === totalRows) {
          compositeCandidateKeys.push([col1, col2]);
          if (compositeCandidateKeys.length >= 3) break; // Limit search
        }
      }
      if (compositeCandidateKeys.length >= 3) break;
    }
  }

  return {
    totalRows,
    totalColumns: headers.length,
    duplicateRowCount,
    hasDuplicates: duplicateRowCount > 0,
    singleCandidateKeys,
    compositeCandidateKeys,
    columns: columnsProfile
  };
};

