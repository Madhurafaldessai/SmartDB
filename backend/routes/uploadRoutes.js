import express from 'express';
import { upload } from '../middleware/uploadMiddleware.js';
import {
  uploadDatasetFile,
  getAllDatasets,
  getDatasetDetails,
  deleteDataset
} from '../controllers/uploadController.js';

const router = express.Router();

router.post('/upload', upload.single('file'), uploadDatasetFile);
router.get('/datasets', getAllDatasets);
router.get('/datasets/:id', getDatasetDetails);
router.delete('/datasets/:id', deleteDataset);

export default router;
