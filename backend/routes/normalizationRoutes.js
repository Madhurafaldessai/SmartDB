import express from 'express';
import { suggestNormalization } from '../controllers/normalizationController.js';

const router = express.Router();

router.post('/datasets/:id/normalize', suggestNormalization);

export default router;

