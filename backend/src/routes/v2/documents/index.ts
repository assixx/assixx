/**
 * Documents v2 Routes
 * RESTful API endpoints for document management
 */

import { Router } from "express";

import { authenticateV2 } from "../../../middleware/v2/auth.middleware";
import { typed } from "../../../utils/routeHandlers";

import * as documentsController from "./documents.controller";
import { documentsValidation } from "./documents.validation";

const router = Router();

// All routes require authentication
router.use(authenticateV2);

/**
 * GET /api/v2/documents
 * List documents with filters and pagination
 */
router.get(
  "/",
  documentsValidation.list,
  typed.auth(documentsController.listDocuments),
);

/**
 * GET /api/v2/documents/stats
 * Get document statistics (unread count, storage, etc.)
 * Note: This must come before /:id to avoid route conflicts
 */
router.get("/stats", typed.auth(documentsController.getDocumentStats));

/**
 * GET /api/v2/documents/:id
 * Get a specific document by ID
 */
router.get(
  "/:id",
  documentsValidation.getById,
  typed.auth(documentsController.getDocumentById),
);

/**
 * POST /api/v2/documents
 * Upload/Create a new document
 */
router.post(
  "/",
  documentsController.uploadMiddleware,
  documentsValidation.create,
  typed.auth(documentsController.createDocument),
);

/**
 * PUT /api/v2/documents/:id
 * Update document metadata
 */
router.put(
  "/:id",
  documentsValidation.update,
  typed.auth(documentsController.updateDocument),
);

/**
 * DELETE /api/v2/documents/:id
 * Delete a document (admin only)
 */
router.delete(
  "/:id",
  documentsValidation.documentAction,
  typed.auth(documentsController.deleteDocument),
);

/**
 * POST /api/v2/documents/:id/archive
 * Archive a document (admin only)
 */
router.post(
  "/:id/archive",
  documentsValidation.documentAction,
  typed.auth(documentsController.archiveDocument),
);

/**
 * POST /api/v2/documents/:id/unarchive
 * Unarchive a document (admin only)
 */
router.post(
  "/:id/unarchive",
  documentsValidation.documentAction,
  typed.auth(documentsController.unarchiveDocument),
);

/**
 * GET /api/v2/documents/:id/download
 * Download a document file
 */
router.get(
  "/:id/download",
  documentsValidation.getById,
  typed.auth(documentsController.downloadDocument),
);

/**
 * GET /api/v2/documents/:id/preview
 * Preview a document inline (for iframes)
 */
router.get(
  "/:id/preview",
  documentsValidation.getById,
  typed.auth(documentsController.previewDocument),
);

export default router;
