/**
 * Documents v2 Routes
 * RESTful API endpoints for document management
 */
import { Router } from 'express';

import { authenticateV2 } from '../../../middleware/v2/auth.middleware.js';
import { typed } from '../../../utils/routeHandlers.js';
import * as documentsController from './documents.controller.js';
import { documentsValidationZod } from './documents.validation.zod.js';

const router = Router();

// All routes require authentication
router.use(authenticateV2);

/**
 * GET /api/v2/documents
 * List documents with filters and pagination
 */
router.get('/', documentsValidationZod.list, typed.auth(documentsController.listDocuments));

/**
 * GET /api/v2/documents/stats
 * Get document statistics (unread count, storage, etc.)
 * Note: This must come before /:id to avoid route conflicts
 */
router.get('/stats', typed.auth(documentsController.getDocumentStats));

/**
 * GET /api/v2/documents/chat-folders
 * Get chat folders for document explorer
 * Returns conversations where user is participant AND has attachments
 * NEW 2025-12-04
 */
router.get('/chat-folders', typed.auth(documentsController.getChatFolders));

/**
 * GET /api/v2/documents/:id
 * Get a specific document by ID
 */
router.get('/:id', documentsValidationZod.getById, typed.auth(documentsController.getDocumentById));

/**
 * POST /api/v2/documents
 * Upload/Create a new document
 */
router.post(
  '/',
  documentsController.uploadMiddleware,
  documentsValidationZod.create,
  typed.auth(documentsController.createDocument),
);

/**
 * PUT /api/v2/documents/:id
 * Update document metadata
 */
router.put('/:id', documentsValidationZod.update, typed.auth(documentsController.updateDocument));

/**
 * DELETE /api/v2/documents/:id
 * Delete a document (admin only)
 */
router.delete(
  '/:id',
  documentsValidationZod.delete,
  typed.auth(documentsController.deleteDocument),
);

/**
 * POST /api/v2/documents/:id/archive
 * Archive a document (admin only)
 */
router.post(
  '/:id/archive',
  documentsValidationZod.archive,
  typed.auth(documentsController.archiveDocument),
);

/**
 * POST /api/v2/documents/:id/unarchive
 * Unarchive a document (admin only)
 */
router.post(
  '/:id/unarchive',
  documentsValidationZod.unarchive,
  typed.auth(documentsController.unarchiveDocument),
);

/**
 * GET /api/v2/documents/:id/download
 * Download a document file
 */
router.get(
  '/:id/download',
  documentsValidationZod.getById,
  typed.auth(documentsController.downloadDocument),
);

/**
 * GET /api/v2/documents/:id/preview
 * Preview a document inline (for iframes)
 */
router.get(
  '/:id/preview',
  documentsValidationZod.getById,
  typed.auth(documentsController.previewDocument),
);

/**
 * POST /api/v2/documents/:id/read
 * Mark document as read by current user
 * Updates document_read_status table for "Neu" badge tracking
 * NEW 2025-12-04
 */
router.post(
  '/:id/read',
  documentsValidationZod.getById,
  typed.auth(documentsController.markDocumentAsRead),
);

export default router;
