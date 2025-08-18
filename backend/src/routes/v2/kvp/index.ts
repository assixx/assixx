/**
 * KVP API v2 Routes
 * Route definitions for Continuous Improvement Process
 * @swagger
 * tags:
 *   - name: KVP v2
 *     description: Continuous improvement process (Kontinuierlicher Verbesserungsprozess) API v2
 */

import path from "path";

import { Router } from "express";
import multer from "multer";

import { authenticateV2 } from "../../../middleware/v2/auth.middleware.js";
import {
  sanitizeFilename,
  getUploadDirectory,
} from "../../../utils/pathSecurity.js";
import { typed } from "../../../utils/routeHandlers.js";

import * as kvpController from "./kvp.controller.js";
import { kvpValidation } from "./kvp.validation.js";

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const uploadDir = getUploadDirectory("kvp");
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const sanitized = sanitizeFilename(file.originalname);
    const ext = path.extname(sanitized);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, PDF, DOC and DOCX files are allowed"));
    }
  },
});

// All routes require authentication
// Authentication is applied per route for better control

/**
 * @swagger
 * /api/v2/kvp/categories:
 *   get:
 *     summary: Get KVP categories
 *     description: Retrieve all available KVP categories for the tenant
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           color:
 *                             type: string
 *                           icon:
 *                             type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Categories endpoints
router.get(
  "/categories",
  authenticateV2,
  typed.auth(kvpController.getCategories),
);

/**
 * @swagger
 * /api/v2/kvp/dashboard/stats:
 *   get:
 *     summary: Get KVP dashboard statistics
 *     description: Retrieve statistics about KVP suggestions for dashboard display
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         totalSuggestions:
 *                           type: integer
 *                         newSuggestions:
 *                           type: integer
 *                         inProgress:
 *                           type: integer
 *                         implemented:
 *                           type: integer
 *                         rejected:
 *                           type: integer
 *                         avgSavings:
 *                           type: number
 *                           nullable: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Dashboard statistics
router.get(
  "/dashboard/stats",
  authenticateV2,
  typed.auth(kvpController.getDashboardStats),
);

/**
 * @swagger
 * /api/v2/kvp/points/award:
 *   post:
 *     summary: Award points to user
 *     description: Award points to a user for their KVP suggestion (admin only)
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - suggestionId
 *               - points
 *               - reason
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID to award points to
 *               suggestionId:
 *                 type: integer
 *                 description: Related suggestion ID
 *               points:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 1000
 *                 description: Number of points to award
 *               reason:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Reason for awarding points
 *     responses:
 *       201:
 *         description: Points awarded successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/KvpPointsV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
// Points endpoints
router.post(
  "/points/award",
  authenticateV2,
  kvpValidation.awardPoints,
  typed.auth(kvpController.awardPoints),
);

/**
 * @swagger
 * /api/v2/kvp/points/user/{userId}:
 *   get:
 *     summary: Get user points summary
 *     description: Get points summary for a specific user
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Points summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         totalPoints:
 *                           type: integer
 *                         totalAwards:
 *                           type: integer
 *                         suggestionsAwarded:
 *                           type: integer
 *                         latestAwards:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/KvpPointsV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/points/user/:userId",
  authenticateV2,
  kvpValidation.getUserPoints,
  typed.auth(kvpController.getUserPoints),
);

/**
 * @swagger
 * /api/v2/kvp/points/user:
 *   get:
 *     summary: Get current user points summary
 *     description: Get points summary for the authenticated user
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Points summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         totalPoints:
 *                           type: integer
 *                         totalAwards:
 *                           type: integer
 *                         suggestionsAwarded:
 *                           type: integer
 *                         latestAwards:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/KvpPointsV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/points/user",
  authenticateV2,
  kvpValidation.getUserPoints,
  typed.auth(kvpController.getUserPoints),
);

/**
 * @swagger
 * /api/v2/kvp:
 *   get:
 *     summary: List KVP suggestions
 *     description: Get a paginated list of KVP suggestions with filters
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [new, in_progress, implemented, rejected]
 *       - name: categoryId
 *         in: query
 *         schema:
 *           type: integer
 *       - name: priority
 *         in: query
 *         schema:
 *           type: string
 *           enum: [low, normal, high, urgent]
 *       - name: orgLevel
 *         in: query
 *         schema:
 *           type: string
 *           enum: [company, department, team]
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Suggestions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/KvpSuggestionV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Suggestions CRUD endpoints
router.get(
  "/",
  authenticateV2,
  kvpValidation.list,
  typed.auth(kvpController.listSuggestions),
);
/**
 * @swagger
 * /api/v2/kvp/{id}:
 *   get:
 *     summary: Get KVP suggestion by ID
 *     description: Retrieve a specific KVP suggestion with all details
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Suggestion ID
 *     responses:
 *       200:
 *         description: Suggestion retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/KvpSuggestionV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/:id",
  authenticateV2,
  kvpValidation.getById,
  typed.auth(kvpController.getSuggestionById),
);
/**
 * @swagger
 * /api/v2/kvp:
 *   post:
 *     summary: Create KVP suggestion
 *     description: Create a new KVP suggestion
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - categoryId
 *               - orgLevel
 *               - orgId
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *               categoryId:
 *                 type: integer
 *               orgLevel:
 *                 type: string
 *                 enum: [company, department, team]
 *               orgId:
 *                 type: integer
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 default: normal
 *               expectedBenefit:
 *                 type: string
 *                 maxLength: 500
 *               estimatedCost:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       201:
 *         description: Suggestion created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/KvpSuggestionV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/",
  authenticateV2,
  kvpValidation.create,
  typed.auth(kvpController.createSuggestion),
);

/**
 * @swagger
 * /api/v2/kvp/{id}:
 *   put:
 *     summary: Update KVP suggestion
 *     description: Update an existing KVP suggestion
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Suggestion ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *               categoryId:
 *                 type: integer
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *               status:
 *                 type: string
 *                 enum: [new, in_progress, implemented, rejected]
 *                 description: Only admin/manager can change status
 *               expectedBenefit:
 *                 type: string
 *                 maxLength: 500
 *               estimatedCost:
 *                 type: number
 *                 minimum: 0
 *               actualSavings:
 *                 type: number
 *                 minimum: 0
 *                 description: Only admin/manager can set actual savings
 *               implementationDate:
 *                 type: string
 *                 format: date
 *                 description: Only admin/manager can set implementation date
 *               assignedTo:
 *                 type: integer
 *                 description: User ID assigned to implement (admin/manager only)
 *     responses:
 *       200:
 *         description: Suggestion updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/KvpSuggestionV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  "/:id",
  authenticateV2,
  kvpValidation.update,
  typed.auth(kvpController.updateSuggestion),
);

/**
 * @swagger
 * /api/v2/kvp/{id}:
 *   delete:
 *     summary: Delete KVP suggestion
 *     description: Delete a KVP suggestion (only own suggestions or admin)
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Suggestion ID
 *     responses:
 *       200:
 *         description: Suggestion deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: null
 *                     message:
 *                       type: string
 *                       example: Suggestion deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  "/:id",
  authenticateV2,
  kvpValidation.delete,
  typed.auth(kvpController.deleteSuggestion),
);

/**
 * @swagger
 * /api/v2/kvp/{id}/comments:
 *   get:
 *     summary: Get comments for KVP suggestion
 *     description: Retrieve all comments for a specific KVP suggestion
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Suggestion ID
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/KvpCommentV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Comments endpoints
router.get(
  "/:id/comments",
  authenticateV2,
  kvpValidation.getById,
  typed.auth(kvpController.getComments),
);

/**
 * @swagger
 * /api/v2/kvp/{id}/comments:
 *   post:
 *     summary: Add comment to KVP suggestion
 *     description: Add a new comment to a specific KVP suggestion
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Suggestion ID
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
 *                 minLength: 1
 *                 maxLength: 2000
 *               isInternal:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/KvpCommentV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  "/:id/comments",
  authenticateV2,
  kvpValidation.addComment,
  typed.auth(kvpController.addComment),
);

/**
 * @swagger
 * /api/v2/kvp/{id}/attachments:
 *   get:
 *     summary: Get attachments for KVP suggestion
 *     description: Retrieve all attachments for a specific KVP suggestion
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Suggestion ID
 *     responses:
 *       200:
 *         description: Attachments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/KvpAttachmentV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Attachments endpoints
router.get(
  "/:id/attachments",
  authenticateV2,
  kvpValidation.getById,
  typed.auth(kvpController.getAttachments),
);

/**
 * @swagger
 * /api/v2/kvp/{id}/attachments:
 *   post:
 *     summary: Upload attachments to KVP suggestion
 *     description: Upload up to 5 attachments to a specific KVP suggestion
 *     tags: [KVP v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Suggestion ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: File attachments (JPG, PNG, PDF, DOC, DOCX - max 10MB each, max 5 files)
 *     responses:
 *       201:
 *         description: Attachments uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         uploadedCount:
 *                           type: integer
 *                         attachments:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/KvpAttachmentV2'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post(
  "/:id/attachments",
  authenticateV2,
  kvpValidation.getById,
  upload.array("files", 5), // Max 5 files
  typed.auth(kvpController.uploadAttachments),
);

/**
 * @swagger
 * /api/v2/kvp/attachments/{attachmentId}/download:
 *   get:
 *     summary: Download KVP attachment
 *     description: Download a specific attachment file
 *     tags: [KVP v2]
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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/attachments/:attachmentId/download",
  authenticateV2,
  kvpValidation.attachmentId,
  typed.auth(kvpController.downloadAttachment),
);

export default router;
