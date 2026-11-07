import express from 'express';
import { exportExcel, exportSqlScript, getERDData, getNormalizationAuditReport } from '../controllers/exportController.js';

const router = express.Router();

router.get('/datasets/:datasetId/excel', exportExcel);
router.get('/datasets/:datasetId/sql', exportSqlScript);
router.get('/datasets/:datasetId/erd', getERDData);
router.get('/datasets/:datasetId/report', getNormalizationAuditReport);

export default router;

