import express from 'express';
import { runMigration, getMigrationStatus } from '../controllers/migrationController.js';

const router = express.Router();

router.post('/datasets/:id/migrate', runMigration);
router.get('/datasets/:id/status', getMigrationStatus);

export default router;

