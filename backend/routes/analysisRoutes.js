import express from 'express';
import { analyzeDataset, updateFunctionalDependencies, getDataQualityReport } from '../controllers/analysisController.js';

const router = express.Router();

router.post('/datasets/:id/analyze', analyzeDataset);
router.put('/datasets/:id/dependencies', updateFunctionalDependencies);
router.get('/datasets/:id/quality', getDataQualityReport);

export default router;
