/**
 * Shared upload middleware for profile pictures
 */
import fs from 'fs';
import multer from 'multer';
import path from 'path';

// Ensure upload directory exists
const uploadDir = 'uploads/profile_pictures/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  // eslint-disable-next-line promise/prefer-await-to-callbacks -- Multer requires callback-based API
  destination(_req, _file, cb) {
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- Multer requires callback-based API
    cb(null, uploadDir);
  },
  // eslint-disable-next-line promise/prefer-await-to-callbacks -- Multer requires callback-based API
  filename(_req, file, cb) {
    const uniqueSuffix = `${String(Date.now())}-${String(Math.round(Math.random() * 1e9))}`;
    const extension = path.extname(file.originalname);
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- Multer requires callback-based API
    cb(null, `profile-${uniqueSuffix}${extension}`);
  },
});

// File filter to accept only images
// eslint-disable-next-line promise/prefer-await-to-callbacks -- Multer requires callback-based API
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- Multer requires callback-based API
    cb(null, true);
  } else {
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- Multer requires callback-based API
    cb(new Error('Only image files are allowed'));
  }
};

// Create multer instance
export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});
