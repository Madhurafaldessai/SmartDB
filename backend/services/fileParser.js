import fs from 'fs';
import { parse } from 'csv-parse';
import ExcelJS from 'exceljs';

/**
 * Sanitizes header names to safe MySQL-compliant column identifiers (snake_case)
 * while preserving original display labels.
 */
export const sanitizeIdentifier = (name) => {
  if (!name || typeof name !== 'string') return 'column_unnamed';
  
  let clean = name.trim().toLowerCase()
    .replace(/[^a-zA-Z0-9_]/g, '_')   // Replace spaces and special characters with underscore
    .replace(/_+/g, '_')               // Collapse consecutive underscores
    .replace(/^_+|_+$/g, '');          // Strip leading/trailing underscores

  if (/^[0-9]/.test(clean)) {
    clean = 'col_' + clean;            // Prefix if starts with a digit
  }

  // Check against MySQL reserved keywords
  const reservedWords = new Set([
    'order', 'group', 'table', 'select', 'where', 'from', 'join', 'insert',
    'update', 'delete', 'key', 'index', 'primary', 'foreign', 'check', 'schema',
    'database', 'date', 'time', 'datetime', 'timestamp', 'year', 'status', 'rank'
  ]);

  if (reservedWords.has(clean)) {
    clean = `${clean}_val`;
  }

  return clean || 'col';
};

/**
 * Parses a CSV file from disk into structured rows and column headers
 */
export const parseCsvFile = async (filePath, options = {}) => {
  const maxRows = options.maxRows || Infinity;
  const rows = [];
  let headers = [];

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });

    let rowCount = 0;

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        if (rowCount === 0) {
          headers = Object.keys(record);
        }
        if (rowCount < maxRows) {
          rows.push(record);
        }
        rowCount++;
      }
    });

    parser.on('error', (err) => {
      reject(new Error(`Failed to parse CSV: ${err.message}`));
    });

    parser.on('end', () => {
      resolve({
        headers,
        sanitizedHeaders: headers.map(h => ({ original: h, sanitized: sanitizeIdentifier(h) })),
        rows,
        totalRows: rowCount
      });
    });

    fileStream.pipe(parser);
  });
};

/**
 * Parses an Excel (.xlsx / .xls) workbook from disk
 */
export const parseExcelFile = async (filePath, options = {}) => {
  const maxRows = options.maxRows || Infinity;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel file has no worksheets.');
  }

  const headers = [];
  const rows = [];
  let rowCount = 0;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];

    if (rowNumber === 1) {
      // First row contains column headers
      values.forEach((val) => {
        headers.push(val ? String(val).trim() : `Column_${headers.length + 1}`);
      });
    } else {
      rowCount++;
      if (rows.length < maxRows) {
        const rowObj = {};
        headers.forEach((header, index) => {
          let cellValue = values[index];
          if (cellValue === undefined || cellValue === null) {
            rowObj[header] = '';
          } else if (typeof cellValue === 'object' && cellValue.text) {
            rowObj[header] = String(cellValue.text).trim();
          } else if (cellValue instanceof Date) {
            rowObj[header] = cellValue.toISOString().slice(0, 19).replace('T', ' ');
          } else {
            rowObj[header] = String(cellValue).trim();
          }
        });
        rows.push(rowObj);
      }
    }
  });

  return {
    headers,
    sanitizedHeaders: headers.map(h => ({ original: h, sanitized: sanitizeIdentifier(h) })),
    rows,
    totalRows: rowCount
  };
};

/**
 * Dispatches file parsing depending on extension
 */
export const parseUploadedFile = async (filePath, originalName, options = {}) => {
  const ext = originalName.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    return await parseCsvFile(filePath, options);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return await parseExcelFile(filePath, options);
  } else {
    throw new Error(`Unsupported file extension: .${ext}. Only CSV and XLSX are supported.`);
  }
};

