import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}_${cleanName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type '${ext}'. Please upload a CSV (.csv) or Excel (.xlsx, .xls) file.`), false);
  }
};

const maxFileSize = (parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB, 10) || 25) * 1024 * 1024;

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxFileSize }
});

