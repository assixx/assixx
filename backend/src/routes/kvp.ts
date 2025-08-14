/**
 * KVP API Routes (Kontinuierlicher Verbesserungsprozess)
 * Handles all operations related to the KVP system
 * @swagger
 * tags:
 *   name: KVP
 *   description: Continuous improvement process (Kontinuierlicher Verbesserungsprozess)
 */

import path from "path";

import express, { Router, Request, Response } from "express";
import multer from "multer";

import { authenticateToken } from "../auth.js";
import kvpController from "../controllers/kvp.controller.js";
import { sanitizeFilename, getUploadDirectory } from "../utils/pathSecurity";

const router: Router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const uploadDir = getUploadDirectory("kvp");
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const sanitized = sanitizeFilename(file.originalname);
    const ext = path.extname(sanitized);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Nur JPG, JPEG und PNG Dateien sind erlaubt!"));
    }
  },
});

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /kvp:
 *   get:
 *     summary: Get all KVP suggestions
 *     description: Retrieve all KVP suggestions visible to the user with pagination and filtering
 *     tags: [KVP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, implemented, rejected]
 *         description: Filter by suggestion status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: shared
 *         schema:
 *           type: boolean
 *         description: Filter by shared/private status
 *     responses:
 *       200:
 *         description: KVP suggestions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/KvpSuggestion'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     itemsPerPage:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// KVP Routes
router.get("/", async (req, res) => kvpController.getAll(req, res));

/**
 * @swagger
 * /kvp/categories:
 *   get:
 *     summary: Get KVP categories
 *     description: Retrieve all available KVP categories
 *     tags: [KVP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example: ['Sicherheit', 'Produktivität', 'Qualität', 'Kosten', 'Umwelt', 'Sonstiges']
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/categories", async (req, res) =>
  kvpController.getCategories(req, res),
);

/**
 * @swagger
 * /kvp/stats:
 *   get:
 *     summary: Get KVP statistics
 *     description: Retrieve statistics about KVP suggestions
 *     tags: [KVP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Total number of suggestions
 *                 byStatus:
 *                   type: object
 *                   properties:
 *                     pending:
 *                       type: integer
 *                     approved:
 *                       type: integer
 *                     implemented:
 *                       type: integer
 *                     rejected:
 *                       type: integer
 *                 byCategory:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *                 thisMonth:
 *                   type: integer
 *                   description: Suggestions created this month
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/stats", async (req, res) => kvpController.getStatistics(req, res));

/**
 * @swagger
 * /kvp/{id}:
 *   get:
 *     summary: Get KVP suggestion by ID
 *     description: Retrieve a specific KVP suggestion with all details
 *     tags: [KVP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: KVP suggestion ID
 *     responses:
 *       200:
 *         description: KVP suggestion retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KvpSuggestion'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Suggestion not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Vorschlag nicht gefunden
 */
router.get("/:id", async (req, res) => kvpController.getById(req, res));

/**
 * @swagger
 * /kvp:
 *   post:
 *     summary: Create KVP suggestion
 *     description: Create a new KVP suggestion
 *     tags: [KVP]
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
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *                 description: Suggestion title
 *                 example: Optimierung der Pausenzeiten
 *               description:
 *                 type: string
 *                 description: Detailed description
 *                 example: Durch versetzte Pausenzeiten können wir die Produktivität steigern...
 *               category:
 *                 type: string
 *                 enum: ['Sicherheit', 'Produktivität', 'Qualität', 'Kosten', 'Umwelt', 'Sonstiges']
 *                 description: Suggestion category
 *               potential_savings:
 *                 type: number
 *                 description: Estimated savings in EUR
 *                 example: 5000
 *               implementation_effort:
 *                 type: string
 *                 enum: ['low', 'medium', 'high']
 *                 description: Effort required
 *               is_shared:
 *                 type: boolean
 *                 default: false
 *                 description: Share with other users
 *     responses:
 *       201:
 *         description: Suggestion created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: KVP-Vorschlag erfolgreich erstellt
 *                 suggestion:
 *                   $ref: '#/components/schemas/KvpSuggestion'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", async (req, res) => kvpController.create(req, res));

router.put("/:id", async (req, res) => kvpController.update(req, res));
router.delete("/:id", async (req, res) => kvpController.delete(req, res));

// Share/unshare routes
router.post("/:id/share", async (req, res) =>
  kvpController.shareSuggestion(req, res),
);
router.post("/:id/unshare", async (req, res) =>
  kvpController.unshareSuggestion(req, res),
);

/**
 * @swagger
 * /kvp/{id}/comments:
 *   get:
 *     summary: Get comments for KVP suggestion
 *     description: Retrieve all comments for a specific KVP suggestion
 *     tags: [KVP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: KVP suggestion ID
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 comments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       comment:
 *                         type: string
 *                       created_by:
 *                         type: integer
 *                       created_by_name:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                   example:
 *                     - id: 1
 *                       comment: "Sehr gute Idee! Das sollten wir umsetzen."
 *                       created_by: 42
 *                       created_by_name: "Max Mustermann"
 *                       created_at: "2025-06-23T10:30:00Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Suggestion not found
 */
/**
 * @swagger
 * /kvp/{id}/comments:
 *   post:
 *     summary: Add comment to KVP suggestion
 *     description: Add a new comment to a specific KVP suggestion
 *     tags: [KVP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: KVP suggestion ID
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
 *                 description: Comment text
 *                 example: "Sehr gute Idee! Das sollten wir umsetzen."
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Kommentar erfolgreich hinzugefügt
 *                 comment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     comment:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Suggestion not found
 */
// Comments
router.get("/:id/comments", async (req, res) =>
  kvpController.getComments(req, res),
);
router.post("/:id/comments", async (req, res) =>
  kvpController.addComment(req, res),
);

// Attachments
router.get("/:id/attachments", async (req, res) =>
  kvpController.getAttachments(req, res),
);
router.post(
  "/:id/attachments",
  upload.array("photos", 5),
  async (req: Request, res: Response) =>
    kvpController.uploadAttachment(
      req as Request & {
        params: { id: string };
        files?: Express.Multer.File[];
      },
      res,
    ), // Multer adds files to request
); // Max 5 photos
router.get("/attachments/:attachmentId/download", async (req, res) =>
  kvpController.downloadAttachment(req, res),
);

export default router;
