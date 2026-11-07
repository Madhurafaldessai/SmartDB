import ExcelJS from 'exceljs';
import { getDatasetPool } from '../config/database.js';

/**
 * Excel Exporter: Queries normalized tables directly from MySQL
 * and compiles them into a multi-worksheet Excel workbook.
 */
export const exportDatabaseToExcel = async (databaseName, tableNames) => {
  const pool = getDatasetPool(databaseName);
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'SmartDB Normalization System';
  workbook.lastModifiedBy = 'SmartDB Engine';
  workbook.created = new Date();
  workbook.modified = new Date();

  for (const tableName of tableNames) {
    // Validate table name identifier strictly
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) continue;

    const [rows, fields] = await pool.query(`SELECT * FROM \`${tableName}\``);
    const worksheet = workbook.addWorksheet(tableName.slice(0, 31)); // Excel sheet name limit is 31 chars

    if (fields && fields.length > 0) {
      // Setup columns
      worksheet.columns = fields.map(field => ({
        header: field.name,
        key: field.name,
        width: Math.max(field.name.length + 4, 15)
      }));

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' } // Deep Navy / Primary
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 24;

      // Add data rows
      rows.forEach(row => {
        worksheet.addRow(row);
      });

      // Style alternating rows (zebra striping) and borders
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          if (rowNumber % 2 === 0) {
            row.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' }
            };
          }
        }
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

