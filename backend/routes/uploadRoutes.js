import express from 'express';
import { upload } from '../middleware/uploadMiddleware.js';
import { uploadDatasetFile, getAllDatasets, getDatasetDetails } from '../controllers/uploadController.js';

const router = express.Router();

router.post('/upload', upload.single('file'), uploadDatasetFile);
router.get('/datasets', getAllDatasets);
router.get('/datasets/:id', getDatasetDetails);

export default router;

