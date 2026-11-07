import express from 'express';
import {
  getGeneratedTables,
  getTableRecords,
  createRecord,
  updateRecord,
  deleteRecord
} from '../controllers/crudController.js';

const router = express.Router();

router.get('/datasets/:id/tables', getGeneratedTables);
router.get('/datasets/:id/tables/:tableName/records', getTableRecords);
router.post('/datasets/:id/tables/:tableName/records', createRecord);
router.put('/datasets/:id/tables/:tableName/records', updateRecord);
router.delete('/datasets/:id/tables/:tableName/records', deleteRecord);

export default router;
