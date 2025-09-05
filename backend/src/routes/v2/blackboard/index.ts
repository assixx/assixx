/**
 * Blackboard API v2 Routes

 * tags:
 *   - name: Blackboard v2
 *     description: Company announcements and bulletin board API v2
 */
import { Router } from 'express';
import fsCallback from 'fs';
import multer from 'multer';
import path from 'path';

import { authenticateV2 } from '../../../middleware/v2/auth.middleware.js';
import { requireRoleV2 } from '../../../middleware/v2/roleCheck.middleware.js';
import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { getUploadDirectory, sanitizeFilename } from '../../../utils/pathSecurity.js';
import { typed } from '../../../utils/routeHandlers.js';
import * as blackboardController from './blackboard.controller.js';
import { blackboardValidation } from './blackboard.validation.js';

const router = Router();

// Configure multer for blackboard attachments
// Note: multer requires callback-based API, cannot use async/await
const storage = multer.diskStorage({
  // eslint-disable-next-line promise/prefer-await-to-callbacks
  destination: (req, _file, cb) => {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user.tenant_id;
    const baseUploadDir = getUploadDirectory('blackboard');
    const uploadDir = path.join(baseUploadDir, tenantId.toString());

    // Use callback version of fs.mkdir to match multer's callback pattern
    // We MUST use callbacks here because:
    // 1. Multer's diskStorage.destination expects a callback, not a Promise
    // 2. Using fs/promises would create a "promise-in-callback" anti-pattern
    // 3. The callback version is the only way to properly integrate with multer
    // eslint-disable-next-line security/detect-non-literal-fs-filename, promise/prefer-await-to-callbacks
    fsCallback.mkdir(uploadDir, { recursive: true }, (error) => {
      if (error) {
        // eslint-disable-next-line promise/prefer-await-to-callbacks
        cb(error, '');
      } else {
        // eslint-disable-next-line promise/prefer-await-to-callbacks
        cb(null, uploadDir);
      }
    });
  },
  // eslint-disable-next-line promise/prefer-await-to-callbacks
  filename: (_req, file, cb) => {
    const sanitized = sanitizeFilename(file.originalname);
    const ext = path.extname(sanitized);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  // eslint-disable-next-line promise/prefer-await-to-callbacks
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

    if (allowedTypes.includes(file.mimetype)) {
      // eslint-disable-next-line promise/prefer-await-to-callbacks
      cb(null, true);
    } else {
      // eslint-disable-next-line promise/prefer-await-to-callbacks
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
 *         name: requiresConfirmation
 *         schema:
 *           type: boolean
 *         description: Filter by confirmation requirement
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
  blackboardValidation.list,
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
  blackboardValidation.getById,
  typed.auth(blackboardController.getEntryById),
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
  blackboardValidation.create,
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
  blackboardValidation.update,
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
  blackboardValidation.delete,
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
  blackboardValidation.archiveUnarchive,
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
  blackboardValidation.archiveUnarchive,
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
  blackboardValidation.confirm,
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
  blackboardValidation.getById,
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
  blackboardValidation.dashboard,
  typed.auth(blackboardController.getDashboardEntries),
);

/**

 * /api/v2/blackboard/tags:
 *   get:
 *     summary: Get all available tags
 *     tags: [Blackboard v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tags
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TagsResponseV2'
 */
router.get('/tags', authenticateV2, typed.auth(blackboardController.getAllTags));

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
  blackboardValidation.uploadAttachment,
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
  blackboardValidation.getAttachments,
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
  blackboardValidation.downloadAttachment,
  typed.auth(blackboardController.downloadAttachment),
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
  blackboardValidation.deleteAttachment,
  typed.auth(blackboardController.deleteAttachment),
);

export default router;
