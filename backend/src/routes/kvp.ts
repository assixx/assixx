/**
 * KVP API Routes (Kontinuierlicher Verbesserungsprozess)
 * Handles all operations related to the KVP system
 */

import express, { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken } from '../auth.js';
import kvpController from '../controllers/kvp.controller.js';

const router: Router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, 'uploads/kvp/');
  },
  filename(_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Nur JPG, JPEG und PNG Dateien sind erlaubt!'));
    }
  },
});

// All routes require authentication
router.use(authenticateToken);

// KVP Routes
router.get('/', kvpController.getAll);
router.get('/categories', kvpController.getCategories);
router.get('/stats', kvpController.getStatistics);
router.get('/:id', kvpController.getById);
router.post('/', kvpController.create);
router.put('/:id', kvpController.update);
router.delete('/:id', kvpController.delete);

// Share/unshare routes
router.post('/:id/share', kvpController.shareSuggestion);
router.post('/:id/unshare', kvpController.unshareSuggestion);

// Comments
router.get('/:id/comments', kvpController.getComments);
router.post('/:id/comments', kvpController.addComment);

// Attachments
router.get('/:id/attachments', kvpController.getAttachments);
router.post('/:id/attachments', upload.array('photos', 5), kvpController.uploadAttachment); // Max 5 photos
router.get('/attachments/:attachmentId/download', kvpController.downloadAttachment);

export default router;