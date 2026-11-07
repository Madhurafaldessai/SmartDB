/**
 * Schema Generator for MySQL 8
 * Implements topological sort of table dependencies to guarantee safe foreign key creation.
 */

/**
 * Topologically sorts normalized tables so parent tables are created before child tables
 */
export const sortTablesTopologically = (tables) => {
  const tableMap = new Map(tables.map(t => [t.tableName, t]));
  const inDegree = new Map();
  const graph = new Map();

  tables.forEach(t => {
    inDegree.set(t.tableName, 0);
    graph.set(t.tableName, []);
  });

  // Build edges: Parent Table -> Child Table
  tables.forEach(table => {
    const foreignParents = new Set();
    table.columns.forEach(col => {
      if (col.isForeignKey && col.foreignTable && col.foreignTable !== table.tableName) {
        foreignParents.add(col.foreignTable);
      }
    });

    foreignParents.forEach(parentName => {
      if (graph.has(parentName)) {
        graph.get(parentName).push(table.tableName);
        inDegree.set(table.tableName, (inDegree.get(table.tableName) || 0) + 1);
      }
    });
  });

  // Queue of tables with 0 incoming dependencies (independent lookup tables)
  const queue = [];
  inDegree.forEach((degree, tableName) => {
    if (degree === 0) queue.push(tableName);
  });

  const sortedOrder = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sortedOrder.push(current);

    const neighbors = graph.get(current) || [];
    for (const neighbor of neighbors) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Fallback: If circular reference exists, append any remaining tables
  tables.forEach(t => {
    if (!sortedOrder.includes(t.tableName)) {
      sortedOrder.push(t.tableName);
    }
  });

  return sortedOrder.map(name => tableMap.get(name));
};

/**
 * Generates MySQL CREATE TABLE DDL for a single table
 */
export const generateTableDDL = (table) => {
  const lines = [];

  // Column definitions
  table.columns.forEach(col => {
    const nullable = col.isNullable && !col.isPrimaryKey ? 'NULL' : 'NOT NULL';
    lines.push(`  \`${col.columnName}\` ${col.dataType} ${nullable}`);
  });

  // Primary Key constraint
  const pkColumns = table.columns.filter(c => c.isPrimaryKey).map(c => `\`${c.columnName}\``);
  if (pkColumns.length > 0) {
    lines.push(`  PRIMARY KEY (${pkColumns.join(', ')})`);
  }

  // Foreign Key constraints
  table.columns.forEach(col => {
    if (col.isForeignKey && col.foreignTable && col.foreignColumn) {
      const fkName = `fk_${table.tableName}_${col.columnName}`.slice(0, 64);
      lines.push(
        `  CONSTRAINT \`${fkName}\` FOREIGN KEY (\`${col.columnName}\`) ` +
        `REFERENCES \`${col.foreignTable}\` (\`${col.foreignColumn}\`) ` +
        `ON DELETE RESTRICT ON UPDATE CASCADE`
      );
    }
  });

  return `CREATE TABLE IF NOT EXISTS \`${table.tableName}\` (\n${lines.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
};

/**
 * Generates complete SQL migration script including database creation and tables
 */
export const generateFullMigrationSQL = (databaseName, tables) => {
  const sortedTables = sortTablesTopologically(tables);

  let script = `-- =====================================================================\n`;
  script += `-- SmartDB Generated Normalization Schema\n`;
  script += `-- Target Database: \`${databaseName}\`\n`;
  script += `-- Generated on: ${new Date().toISOString()}\n`;
  script += `-- =====================================================================\n\n`;

  script += `CREATE DATABASE IF NOT EXISTS \`${databaseName}\`\n`;
  script += `  CHARACTER SET utf8mb4\n`;
  script += `  COLLATE utf8mb4_unicode_ci;\n\n`;

  script += `USE \`${databaseName}\`;\n\n`;

  script += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

  sortedTables.forEach(table => {
    script += `-- Table: ${table.tableName} (${table.normalFormLevel || '3NF'})\n`;
    if (table.description) {
      script += `-- Description: ${table.description}\n`;
    }
    script += generateTableDDL(table);
    script += `\n\n`;
  });

  script += `SET FOREIGN_KEY_CHECKS = 1;\n`;

  return {
    sqlScript: script,
    sortedTables
  };
};

