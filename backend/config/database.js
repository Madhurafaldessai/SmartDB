import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from backend directory regardless of cwd
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
};

const SYSTEM_DB_NAME = process.env.DB_SYSTEM_NAME || 'smartdb_system';

// Dynamic pool cache to prevent connection leaks
const poolCache = new Map();

// Base server pool (not bound to specific database) to allow CREATE / DROP DATABASE
export const rootPool = mysql.createPool({
  ...dbConfig
});

// System metadata pool (bound to smartdb_system)
let systemPool = null;

export const getSystemPool = async () => {
  if (!systemPool) {
    systemPool = mysql.createPool({
      ...dbConfig,
      database: SYSTEM_DB_NAME
    });
  }
  return systemPool;
};

// Factory for dataset-specific database connections
export const getDatasetPool = (databaseName) => {
  // Validate database identifier strictly to prevent SQL injection
  if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
    throw new Error(`Invalid database name identifier: ${databaseName}`);
  }

  if (poolCache.has(databaseName)) {
    return poolCache.get(databaseName);
  }

  const pool = mysql.createPool({
    ...dbConfig,
    database: databaseName
  });

  poolCache.set(databaseName, pool);
  return pool;
};

// Closes and unregisters a dataset pool (called on dataset deletion)
export const closeDatasetPool = async (databaseName) => {
  if (poolCache.has(databaseName)) {
    const pool = poolCache.get(databaseName);
    try {
      await pool.end();
    } catch (e) {
      console.warn(`Error closing pool for ${databaseName}:`, e.message);
    }
    poolCache.delete(databaseName);
  }
};

// Ensure system database and metadata tables exist on server startup
export const initializeDatabase = async () => {
  let connection;
  try {
    connection = await rootPool.getConnection();
    console.log(`[Database] Connected to MySQL server at ${dbConfig.host}:${dbConfig.port} as user '${dbConfig.user}'`);

    // Create system metadata database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${SYSTEM_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);

    // Read and run schema.sql
    const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await connection.query(schemaSql);
      console.log(`[Database] Verified and initialized catalog tables in \`${SYSTEM_DB_NAME}\``);
    }

    return { success: true, message: 'Database initialized successfully' };
  } catch (error) {
    console.error(`[Database Error] Could not initialize MySQL database: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    if (connection) connection.release();
  }
};

// Test health of database connection
export const testConnection = async () => {
  try {
    const connection = await rootPool.getConnection();
    await connection.ping();
    connection.release();
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
};
