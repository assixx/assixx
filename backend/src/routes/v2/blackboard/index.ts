/**
 * Blackboard API v2 Routes
 * Updated 2025-11-24: Now uses documents system for attachments (memoryStorage)

 * tags:
 *   - name: Blackboard v2
 *     description: Company announcements and bulletin board API v2
 */
import { Request, Router } from 'express';
import multer from 'multer';

import { authenticateV2 } from '../../../middleware/v2/auth.middleware.js';
import { requireRoleV2 } from '../../../middleware/v2/roleCheck.middleware.js';
import { typed } from '../../../utils/routeHandlers.js';
import * as blackboardController from './blackboard.controller.js';
import { blackboardValidationZod } from './blackboard.validation.zod.js';

const router = Router();

// Configure multer for blackboard attachments
// NEW 2025-11-24: Using memoryStorage since documents service handles file writing
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and images (JPEG, PNG, GIF) are allowed'));
    }
  },
});

/**

 * /api/v2/blackboard/entries:
 *   get:
 *     summary: List blackboard entries
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, archived]
 *         description: Filter by status
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, company, department, team]
 *         description: Filter by organization level
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and content
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by priority
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, title, priority, expires_at]
 *         description: Sort field
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: List of blackboard entries
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlackboardEntriesResponseV2'
 */
router.get(
  '/entries',
  authenticateV2,
  blackboardValidationZod.list,
  typed.auth(blackboardController.listEntries),
);

/**

 * /api/v2/blackboard/entries/\{id\}:
 *   get:
 *     summary: Get blackboard entry by ID
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Entry ID
 *     responses:
 *       200:
 *         description: Blackboard entry details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlackboardEntryResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.get(
  '/entries/:id',
  authenticateV2,
  blackboardValidationZod.getById,
  typed.auth(blackboardController.getEntryById),
);

/**
 * /api/v2/blackboard/entries/\{id\}/full:
 *   get:
 *     summary: Get full entry with comments and attachments (optimized)
 *     description: Combined endpoint that returns entry, comments, and attachments in one request
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           oneOf:
 *             - type: integer
 *             - type: string
 *               format: uuid
 *         description: Entry ID (numeric or UUID)
 *     responses:
 *       200:
 *         description: Full entry details with comments and attachments
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.get(
  '/entries/:id/full',
  authenticateV2,
  blackboardValidationZod.getById,
  typed.auth(blackboardController.getEntryFull),
);

/**

 * /api/v2/blackboard/entries:
 *   post:
 *     summary: Create new blackboard entry
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBlackboardEntryRequestV2'
 *     responses:
 *       201:
 *         description: Entry created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlackboardEntryResponseV2'
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 */
router.post(
  '/entries',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  blackboardValidationZod.create,
  typed.auth(blackboardController.createEntry),
);

/**

 * /api/v2/blackboard/entries/\{id\}:
 *   put:
 *     summary: Update blackboard entry
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBlackboardEntryRequestV2'
 *     responses:
 *       200:
 *         description: Entry updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlackboardEntryResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.put(
  '/entries/:id',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  blackboardValidationZod.update,
  typed.auth(blackboardController.updateEntry),
);

/**

 * /api/v2/blackboard/entries/\{id\}:
 *   delete:
 *     summary: Delete blackboard entry
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Entry ID
 *     responses:
 *       200:
 *         description: Entry deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.delete(
  '/entries/:id',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  blackboardValidationZod.delete,
  typed.auth(blackboardController.deleteEntry),
);

/**

 * /api/v2/blackboard/entries/\{id\}/archive:
 *   post:
 *     summary: Archive blackboard entry
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Entry ID
 *     responses:
 *       200:
 *         description: Entry archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.post(
  '/entries/:id/archive',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  blackboardValidationZod.archiveUnarchive,
  typed.auth(blackboardController.archiveEntry),
);

/**

 * /api/v2/blackboard/entries/\{id\}/unarchive:
 *   post:
 *     summary: Unarchive blackboard entry
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Entry ID
 *     responses:
 *       200:
 *         description: Entry unarchived successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.post(
  '/entries/:id/unarchive',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  blackboardValidationZod.archiveUnarchive,
  typed.auth(blackboardController.unarchiveEntry),
);

/**

 * /api/v2/blackboard/entries/\{id\}/confirm:
 *   post:
 *     summary: Confirm reading a blackboard entry
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Entry ID
 *     responses:
 *       200:
 *         description: Entry confirmed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponseV2'
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 */
router.post(
  '/entries/:id/confirm',
  authenticateV2,
  blackboardValidationZod.confirm,
  typed.auth(blackboardController.confirmEntry),
);

/**

 * /api/v2/blackboard/entries/\{id\}/confirmations:
 *   get:
 *     summary: Get confirmation status for an entry
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Entry ID
 *     responses:
 *       200:
 *         description: List of users and their confirmation status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConfirmationStatusResponseV2'
 */
router.get(
  '/entries/:id/confirmations',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  blackboardValidationZod.confirmationStatus,
  typed.auth(blackboardController.getConfirmationStatus),
);

/**

 * /api/v2/blackboard/dashboard:
 *   get:
 *     summary: Get dashboard entries for current user
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *         description: Number of entries to return
 *     responses:
 *       200:
 *         description: Priority entries for dashboard
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardEntriesResponseV2'
 */
router.get(
  '/dashboard',
  authenticateV2,
  blackboardValidationZod.dashboard,
  typed.auth(blackboardController.getDashboardEntries),
);

/**

 * /api/v2/blackboard/entries/\{id\}/attachments:
 *   post:
 *     summary: Upload attachment to entry
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: File to upload (PDF or image)
 *     responses:
 *       201:
 *         description: Attachment uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttachmentUploadResponseV2'
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 */
router.post(
  '/entries/:id/attachments',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  upload.single('attachment'),
  blackboardValidationZod.uploadAttachment,
  typed.auth(blackboardController.uploadAttachment),
);

/**

 * /api/v2/blackboard/entries/\{id\}/attachments:
 *   get:
 *     summary: Get attachments for an entry
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Entry ID
 *     responses:
 *       200:
 *         description: List of attachments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttachmentsResponseV2'
 */
router.get(
  '/entries/:id/attachments',
  authenticateV2,
  blackboardValidationZod.getAttachments,
  typed.auth(blackboardController.getAttachments),
);

/**

 * /api/v2/blackboard/attachments/\{attachmentId\}:
 *   get:
 *     summary: Download attachment
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attachment ID
 *     responses:
 *       200:
 *         description: File download
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.get(
  '/attachments/:attachmentId',
  authenticateV2,
  blackboardValidationZod.downloadAttachment,
  typed.auth(blackboardController.downloadAttachment),
);

/**

 * /api/v2/blackboard/attachments/\{attachmentId\}/preview:
 *   get:
 *     summary: Preview attachment inline
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attachment/Document ID
 *     responses:
 *       200:
 *         description: File for inline preview
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.get(
  '/attachments/:attachmentId/preview',
  authenticateV2,
  blackboardValidationZod.downloadAttachment,
  typed.auth(blackboardController.previewAttachment),
);

/**

 * /api/v2/blackboard/attachments/\{fileUuid\}/download:
 *   get:
 *     summary: Download attachment by file UUID (secure)
 *     description: Download using UUID for secure, non-guessable URLs (like KVP pattern)
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileUuid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: File UUID (prevents enumeration attacks)
 *     responses:
 *       200:
 *         description: File for inline viewing (photos/PDFs)
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.get(
  '/attachments/:fileUuid/download',
  authenticateV2,
  blackboardValidationZod.downloadByFileUuid,
  typed.auth(blackboardController.downloadByFileUuid),
);

/**

 * /api/v2/blackboard/attachments/\{attachmentId\}:
 *   delete:
 *     summary: Delete attachment
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attachment ID
 *     responses:
 *       200:
 *         description: Attachment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.delete(
  '/attachments/:attachmentId',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  blackboardValidationZod.deleteAttachment,
  typed.auth(blackboardController.deleteAttachment),
);

// ============================================================================
// Comment Routes (NEW 2025-11-24)
// ============================================================================

/**

 * /api/v2/blackboard/entries/\{id\}/comments:
 *   get:
 *     summary: Get comments for a blackboard entry
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           oneOf:
 *             - type: integer
 *             - type: string
 *               format: uuid
 *         description: Entry ID (numeric or UUID)
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentsResponseV2'
 */
router.get(
  '/entries/:id/comments',
  authenticateV2,
  blackboardValidationZod.getComments,
  typed.auth(blackboardController.getComments),
);

/**

 * /api/v2/blackboard/entries/\{id\}/comments:
 *   post:
 *     summary: Add a comment to a blackboard entry
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           oneOf:
 *             - type: integer
 *             - type: string
 *               format: uuid
 *         description: Entry ID (numeric or UUID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *                 maxLength: 5000
 *               isInternal:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentAddedResponseV2'
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 */
router.post(
  '/entries/:id/comments',
  authenticateV2,
  blackboardValidationZod.addComment,
  typed.auth(blackboardController.addComment),
);

/**

 * /api/v2/blackboard/comments/\{commentId\}:
 *   delete:
 *     summary: Delete a comment (admin only)
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.delete(
  '/comments/:commentId',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  blackboardValidationZod.deleteComment,
  typed.auth(blackboardController.deleteComment),
);

export default router;
