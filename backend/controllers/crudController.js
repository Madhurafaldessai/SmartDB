import { getSystemPool, getDatasetPool } from '../config/database.js';

/**
 * Validates that tableName only contains alphanumeric characters and underscores
 */
const isValidIdentifier = (identifier) => {
  return /^[a-zA-Z0-9_]+$/.test(identifier);
};

/**
 * Helper to retrieve target dataset pool and verify table existence
 */
const getVerifiedTableContext = async (datasetId, tableName) => {
  if (!isValidIdentifier(tableName)) {
    throw new Error(`Invalid table identifier: '${tableName}'`);
  }

  const systemPool = await getSystemPool();
  const [datasets] = await systemPool.query(
    `SELECT id, status, target_database FROM datasets WHERE id = ?`,
    [datasetId]
  );

  if (datasets.length === 0) {
    const err = new Error('Dataset not found');
    err.statusCode = 404;
    throw err;
  }

  const dataset = datasets[0];
  if (dataset.status !== 'migrated' || !dataset.target_database) {
    const err = new Error('Dataset has not been migrated to a physical MySQL database yet.');
    err.statusCode = 400;
    throw err;
  }

  const targetPool = getDatasetPool(dataset.target_database);

  // Inspect column details from MySQL INFORMATION_SCHEMA
  const [columns] = await targetPool.query(
    `SELECT 
      COLUMN_NAME as columnName,
      DATA_TYPE as dataType,
      COLUMN_TYPE as columnType,
      IS_NULLABLE as isNullable,
      COLUMN_KEY as columnKey,
      EXTRA as extra
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION ASC`,
    [dataset.target_database, tableName]
  );

  if (columns.length === 0) {
    const err = new Error(`Table '${tableName}' does not exist in target database '${dataset.target_database}'`);
    err.statusCode = 404;
    throw err;
  }

  // Inspect Foreign Key constraints from INFORMATION_SCHEMA
  const [foreignKeys] = await targetPool.query(
    `SELECT 
      COLUMN_NAME as columnName,
      REFERENCED_TABLE_NAME as referencedTable,
      REFERENCED_COLUMN_NAME as referencedColumn
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [dataset.target_database, tableName]
  );

  const fkMap = new Map();
  for (const fk of foreignKeys) {
    fkMap.set(fk.columnName, {
      referencedTable: fk.referencedTable,
      referencedColumn: fk.referencedColumn
    });
  }

  const primaryKeys = columns.filter(c => c.columnKey === 'PRI').map(c => c.columnName);

  const enrichedColumns = columns.map(c => ({
    name: c.columnName,
    dataType: c.dataType.toUpperCase(),
    columnType: c.columnType,
    isNullable: c.isNullable === 'YES',
    isPrimaryKey: c.columnKey === 'PRI',
    isForeignKey: fkMap.has(c.columnName),
    foreignReference: fkMap.get(c.columnName) || null
  }));

  return {
    dataset,
    targetPool,
    tableName,
    columns: enrichedColumns,
    primaryKeys
  };
};

/**
 * 1. GET /api/datasets/:id/tables
 * Lists all generated tables in the dataset's database with their column schemas and row counts
 */
export const getGeneratedTables = async (req, res) => {
  try {
    const { id } = req.params;
    const systemPool = await getSystemPool();

    const [datasets] = await systemPool.query(
      `SELECT id, status, target_database FROM datasets WHERE id = ?`,
      [id]
    );

    if (datasets.length === 0) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }

    const dataset = datasets[0];
    if (dataset.status !== 'migrated' || !dataset.target_database) {
      return res.json({
        success: true,
        databaseName: null,
        tables: []
      });
    }

    const targetPool = getDatasetPool(dataset.target_database);
    const [tableRows] = await targetPool.query(`SHOW TABLES`);

    const tableList = [];
    for (const row of tableRows) {
      const tblName = Object.values(row)[0];
      const context = await getVerifiedTableContext(id, tblName);
      const [cnt] = await targetPool.query(`SELECT COUNT(*) as count FROM \`${tblName}\``);

      tableList.push({
        tableName: tblName,
        rowCount: cnt[0].count,
        primaryKeys: context.primaryKeys,
        columns: context.columns
      });
    }

    return res.json({
      success: true,
      databaseName: dataset.target_database,
      tables: tableList
    });
  } catch (err) {
    console.error('Error fetching generated tables:', err);
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * 2. GET /api/datasets/:id/tables/:tableName/records
 * Queries records from a specific generated table with search and pagination
 */
export const getTableRecords = async (req, res) => {
  try {
    const { id, tableName } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize, 10) || 15));
    const search = (req.query.search || '').trim();

    const { targetPool, columns, primaryKeys } = await getVerifiedTableContext(id, tableName);

    let whereClause = '';
    const queryParams = [];

    if (search) {
      const searchConditions = columns.map(col => {
        queryParams.push(`%${search}%`);
        return `\`${col.name}\` LIKE ?`;
      });
      whereClause = `WHERE (${searchConditions.join(' OR ')})`;
    }

    // Total count query
    const [countResult] = await targetPool.query(
      `SELECT COUNT(*) as total FROM \`${tableName}\` ${whereClause}`,
      queryParams
    );
    const totalRecords = countResult[0].total;

    // Order by primary key if exists, else first column
    const orderCol = primaryKeys[0] || columns[0].name;
    const offset = (page - 1) * pageSize;

    const [records] = await targetPool.query(
      `SELECT * FROM \`${tableName}\` ${whereClause} ORDER BY \`${orderCol}\` ASC LIMIT ? OFFSET ?`,
      [...queryParams, pageSize, offset]
    );

    return res.json({
      success: true,
      tableName,
      primaryKeys,
      columns,
      totalRecords,
      page,
      pageSize,
      totalPages: Math.ceil(totalRecords / pageSize) || 1,
      records
    });
  } catch (err) {
    console.error(`Error querying records from table:`, err);
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * 3. POST /api/datasets/:id/tables/:tableName/records
 * Inserts a new record into the specified generated table
 */
export const createRecord = async (req, res) => {
  try {
    const { id, tableName } = req.params;
    const { record } = req.body;

    if (!record || typeof record !== 'object') {
      return res.status(400).json({ success: false, message: 'Missing record object in request body.' });
    }

    const { targetPool, columns } = await getVerifiedTableContext(id, tableName);

    const validColNames = new Set(columns.map(c => c.name));
    const insertCols = [];
    const insertVals = [];
    const placeholders = [];

    for (const [key, val] of Object.entries(record)) {
      if (validColNames.has(key)) {
        insertCols.push(`\`${key}\``);
        placeholders.push('?');
        insertVals.push(val === '' || val === undefined ? null : val);
      }
    }

    if (insertCols.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid columns provided to insert.' });
    }

    const insertSql = `INSERT INTO \`${tableName}\` (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const [result] = await targetPool.query(insertSql, insertVals);

    return res.status(201).json({
      success: true,
      message: `Record successfully inserted into '${tableName}'.`,
      insertId: result.insertId,
      affectedRows: result.affectedRows
    });
  } catch (err) {
    console.error('Error inserting record:', err);
    // User-friendly MySQL error messages
    if (err.errno === 1062) {
      return res.status(409).json({
        success: false,
        message: `Primary key or Unique constraint violation: A record with these key values already exists in '${req.params.tableName}'.`
      });
    }
    if (err.errno === 1452) {
      return res.status(400).json({
        success: false,
        message: `Foreign Key Constraint Violation: The referenced parent row does not exist in the related table.`
      });
    }
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * 4. PUT /api/datasets/:id/tables/:tableName/records
 * Updates an existing record identified by its primary keys
 */
export const updateRecord = async (req, res) => {
  try {
    const { id, tableName } = req.params;
    const { keys, updates } = req.body;

    if (!keys || typeof keys !== 'object' || Object.keys(keys).length === 0) {
      return res.status(400).json({ success: false, message: 'Missing primary key identifier (keys) in request body.' });
    }
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Missing updates object in request body.' });
    }

    const { targetPool, columns, primaryKeys } = await getVerifiedTableContext(id, tableName);

    const validColNames = new Set(columns.map(c => c.name));

    // Construct SET clauses
    const setClauses = [];
    const setVals = [];
    for (const [col, val] of Object.entries(updates)) {
      if (validColNames.has(col)) {
        setClauses.push(`\`${col}\` = ?`);
        setVals.push(val === '' || val === undefined ? null : val);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid column fields to update.' });
    }

    // Construct WHERE clauses using primary keys
    const whereClauses = [];
    const whereVals = [];
    for (const [pkCol, pkVal] of Object.entries(keys)) {
      if (validColNames.has(pkCol)) {
        whereClauses.push(`\`${pkCol}\` = ?`);
        whereVals.push(pkVal);
      }
    }

    if (whereClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid primary key values provided.' });
    }

    const updateSql = `UPDATE \`${tableName}\` SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    const [result] = await targetPool.query(updateSql, [...setVals, ...whereVals]);

    return res.json({
      success: true,
      message: `Record successfully updated in '${tableName}'.`,
      affectedRows: result.affectedRows
    });
  } catch (err) {
    console.error('Error updating record:', err);
    if (err.errno === 1451) {
      return res.status(400).json({
        success: false,
        message: `Foreign Key Constraint Violation: Cannot update key because dependent records in another table reference it.`
      });
    }
    if (err.errno === 1452) {
      return res.status(400).json({
        success: false,
        message: `Foreign Key Constraint Violation: Referenced foreign key does not exist in parent table.`
      });
    }
    if (err.errno === 1062) {
      return res.status(409).json({
        success: false,
        message: `Unique Constraint Violation: The updated value conflicts with an existing record.`
      });
    }
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * 5. DELETE /api/datasets/:id/tables/:tableName/records
 * Deletes a record identified by its primary keys
 */
export const deleteRecord = async (req, res) => {
  try {
    const { id, tableName } = req.params;
    const { keys } = req.body;

    if (!keys || typeof keys !== 'object' || Object.keys(keys).length === 0) {
      return res.status(400).json({ success: false, message: 'Missing primary key identifier (keys) in request body.' });
    }

    const { targetPool, columns } = await getVerifiedTableContext(id, tableName);
    const validColNames = new Set(columns.map(c => c.name));

    const whereClauses = [];
    const whereVals = [];
    for (const [pkCol, pkVal] of Object.entries(keys)) {
      if (validColNames.has(pkCol)) {
        whereClauses.push(`\`${pkCol}\` = ?`);
        whereVals.push(pkVal);
      }
    }

    if (whereClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid primary key values provided.' });
    }

    const deleteSql = `DELETE FROM \`${tableName}\` WHERE ${whereClauses.join(' AND ')}`;
    const [result] = await targetPool.query(deleteSql, whereVals);

    return res.json({
      success: true,
      message: `Record successfully deleted from '${tableName}'.`,
      affectedRows: result.affectedRows
    });
  } catch (err) {
    console.error('Error deleting record:', err);
    if (err.errno === 1451) {
      return res.status(400).json({
        success: false,
        message: `Referential Integrity Error: Cannot delete this row because other related tables reference it via foreign key constraints. Delete dependent child records first.`
      });
    }
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};
