/**
 * Shared upload middleware for profile pictures
 * Uses UUID-based naming like KVP for collision-free filenames
 */
import { Request } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Ensure upload directory exists
const uploadDir = 'uploads/profile_pictures/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage with UUID-based naming
const storage = multer.diskStorage({
  destination(
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) {
    cb(null, uploadDir);
  },
  filename(
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) {
    // Use UUID v4 for collision-free filenames (same pattern as KVP)
    const uuid = uuidv4();
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid}${extension}`);
  },
});

// File filter to accept only images
const fileFilter: multer.Options['fileFilter'] = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// Create multer instance
export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});
