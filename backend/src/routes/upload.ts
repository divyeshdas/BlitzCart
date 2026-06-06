import { Router } from 'express';
import multer from 'multer';
import { uploadImage } from '../lib/cloudinary.js';
import { requireAdmin } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.post('/', requireAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image provided', code: 'VALIDATION_ERROR', requestId: req.id });
    return;
  }

  try {
    const url = await uploadImage(req.file.buffer, req.file.originalname);
    logger.info({ url }, 'image uploaded to cloudinary');
    res.json({ url });
  } catch (err) {
    logger.error({ err }, 'cloudinary upload failed');
    res.status(500).json({ error: 'Upload failed', code: 'UPLOAD_ERROR', requestId: req.id });
  }
});

export default router;
