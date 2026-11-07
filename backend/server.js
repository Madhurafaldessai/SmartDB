import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { initializeDatabase, testConnection } from './config/database.js';
import uploadRoutes from './routes/uploadRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import normalizationRoutes from './routes/normalizationRoutes.js';
import migrationRoutes from './routes/migrationRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import crudRoutes from './routes/crudRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from backend directory regardless of cwd
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploaded files if needed
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbHealth = await testConnection();
  res.json({
    status: 'online',
    system: 'SmartDB Normalization Engine',
    timestamp: new Date().toISOString(),
    database: dbHealth
  });
});

// API Routes
app.use('/api', uploadRoutes);
app.use('/api', analysisRoutes);
app.use('/api', normalizationRoutes);
app.use('/api', migrationRoutes);
app.use('/api', exportRoutes);
app.use('/api', crudRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server & Initialize Database
const startServer = async () => {
  try {
    const initResult = await initializeDatabase();
    if (initResult.success) {
      console.log('✓ System metadata database initialized.');
    } else {
      console.warn('! MySQL initialization notice:', initResult.error);
      console.warn('  (Ensure MySQL Server is running and DB_USER/DB_PASSWORD in backend/.env are configured)');
    }

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  SmartDB Backend Server running on port ${PORT}`);
      console.log(`  Health API: http://localhost:${PORT}/api/health`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
};

startServer();
