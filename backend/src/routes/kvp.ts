/**
 * KVP API Routes (Kontinuierlicher Verbesserungsprozess)
 * Handles all operations related to the KVP system
 */

import express, { Router } from 'express';
import { authenticateToken } from '../auth.js';
import kvpController from '../controllers/kvp.controller.js';

const router: Router = express.Router();

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
router.post('/:id/attachments', kvpController.uploadAttachment);
router.get('/attachments/:attachmentId/download', kvpController.downloadAttachment);

export default router;