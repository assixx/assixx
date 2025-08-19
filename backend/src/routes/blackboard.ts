/**
 * Blackboard API Routes
 * Handles all operations related to the blackboard system
 * @swagger
 * tags:
 *   name: Blackboard
 *   description: Company announcements and bulletin board (Schwarzes Brett)
 */

import fs from "fs/promises";
import path from "path";

import { param } from "express-validator";
import multer from "multer";

import express, { Router, Request, Response, NextFunction } from "express";

const router: Router = express.Router();

import { authenticateToken } from "../middleware/auth";
import { rateLimiter } from "../middleware/rateLimiter";
import { security } from "../middleware/security";
import { createValidation } from "../middleware/validation";
import blackboardModel, {
  DbBlackboardEntry,
  EntryQueryOptions,
  EntryCreateData,
  EntryUpdateData,
} from "../models/blackboard";
import type { AuthenticatedRequest } from "../types/request.types";
import { successResponse, errorResponse } from "../types/response.types";
import { getErrorMessage, getErrorStack } from "../utils/errorHandler";
import { logger } from "../utils/logger";
import { sanitizeFilename, getUploadDirectory } from "../utils/pathSecurity";
import { typed } from "../utils/routeHandlers";
/**
 * Blackboard API Routes
 * Handles all operations related to the blackboard system
 * @swagger
 * tags:
 *   name: Blackboard
 *   description: Company announcements and bulletin board (Schwarzes Brett)
 */

// Import blackboard model (now ES modules)
// Configure multer for blackboard attachments
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    void (async () => {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenant_id;
      const baseUploadDir = getUploadDirectory("blackboard");
      const uploadDir = path.join(baseUploadDir, tenantId.toString());

      // Ensure directory exists
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error: unknown) {
        cb(new Error(getErrorMessage(error)), uploadDir);
      }
    })();
  },
  filename: (_req, file, cb) => {
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
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Nur PDF und Bilder (JPEG, PNG, GIF) sind erlaubt!"));
    }
  },
});

// Extended Request interfaces for blackboard-specific features
interface BlackboardRequest extends AuthenticatedRequest {
  entry?: DbBlackboardEntry; // Set by middleware
}

// Import the EntryQueryOptions, EntryCreateData and EntryUpdateData types from the model
// Blackboard entry body type
interface BlackboardEntryBody {
  title: string;
  content: string;
  org_level: string;
  org_id?: number;
  priority?: string;
  priority_level?: string; // Legacy field name support
  color?: string;
  tags?: string[];
  expires_at?: string;
  requires_confirmation?: boolean;
  status?: string;
}

// Validation schemas for blackboard routes
const getEntriesValidation = createValidation([]);
const updateEntryValidation = createValidation([]);

// Helper function to get tenant ID from user object
function getTenantId(user: AuthenticatedRequest["user"]): number {
  return user.tenant_id;
}

// Helper function to check if user can manage the entry
async function canManageEntry(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const entryId = req.params.id;
    const authReq = req as BlackboardRequest;
    const tenantId = getTenantId(authReq.user);

    const entry = await blackboardModel.getEntryById(
      Number.parseInt(entryId, 10),
      tenantId,
      authReq.user.id,
    );

    if (!entry) {
      res.status(404).json({ message: "Entry not found" });
      return;
    }

    // Check if user is admin or the author of the entry
    const isAdmin =
      authReq.user.role === "admin" || authReq.user.role === "root";
    const isAuthor = entry.author_id === authReq.user.id;

    // Admins have permission always
    if (isAdmin) {
      (req as BlackboardRequest).entry = entry;
      next();
      return;
    }

    // Authors only if they're not admins
    if (isAuthor) {
      (req as BlackboardRequest).entry = entry;
      next();
      return;
    }

    // Neither admin nor author
    res
      .status(403)
      .json({ message: "You do not have permission to manage this entry" });
  } catch (error: unknown) {
    console.error("Error in canManageEntry middleware:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// Helper function to check if user can create entry for specified org level
function canCreateForOrgLevel(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const authReq = req as AuthenticatedRequest;
    const { org_level, org_id } = req.body as {
      org_level: string;
      org_id: number;
    };
    const role = authReq.user.role;
    // Note: department_id exists on user, but teamId doesn't
    const departmentId = authReq.user.department_id;
    const teamId = authReq.user.team_id; // Get team_id from user

    // Admins can create entries for any org level
    if (role === "admin" || role === "root") {
      next();
      return;
    }

    // Check permissions based on org level
    if (org_level === "company") {
      res
        .status(403)
        .json({ message: "Only admins can create company-wide entries" });
      return;
    }

    if (org_level === "department") {
      // Check if user is department head
      if (role !== "department_head" || departmentId !== org_id) {
        res.status(403).json({
          message:
            "You can only create department entries for your own department",
        });
        return;
      }
    }

    if (org_level === "team") {
      // Check if user is team leader
      if (role !== "team_leader" || teamId == null || teamId !== org_id) {
        res.status(403).json({
          message: "You can only create team entries for your own team",
        });
        return;
      }
    }

    next();
  } catch (error: unknown) {
    console.error("Error in canCreateForOrgLevel middleware:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * @swagger
 * /blackboard:
 *   get:
 *     summary: Get all blackboard entries
 *     description: Retrieve all blackboard entries visible to the user with pagination and filtering
 *     tags: [Blackboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, archived]
 *           default: active
 *         description: Filter by entry status
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, company, department, team, personal]
 *           default: all
 *         description: Filter by visibility scope
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and content
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
 *           default: 18
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, title, priority]
 *           default: created_at
 *         description: Sort by field
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: Blackboard entries retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entries:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BlackboardEntry'
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
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
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
/**
 * @route GET /api/blackboard
 * @desc Get all blackboard entries visible to the user
 */
router.get(
  "/",
  ...security.user(getEntriesValidation),
  typed.auth(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);

      const options: EntryQueryOptions = {
        status: ((req.query.status as string) || "active") as
          | "active"
          | "archived",
        filter: ((req.query.filter as string) || "all") as
          | "all"
          | "company"
          | "department"
          | "team",
        search: (req.query.search as string) || "",
        page: Number.parseInt((req.query.page as string) || "1", 10),
        limit: Number.parseInt((req.query.limit as string) || "18", 10),
        sortBy: (req.query.sortBy as string) || "created_at",
        sortDir: ((req.query.sortDir as string) || "DESC") as "ASC" | "DESC",
      };

      const result = await blackboardModel.getAllEntries(
        tenantId,
        req.user.id,
        options,
      );

      res.json(successResponse(result));
    } catch (error: unknown) {
      console.error("Error in GET /api/blackboard:", error);
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Abrufen der Blackboard-Einträge", 500),
        );
    }
  }),
);

/**
 * @route GET /api/blackboard/dashboard
 * @desc Get blackboard entries for dashboard widget
 */
router.get(
  "/dashboard",
  authenticateToken,
  typed.auth(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);
      const limitParam = req.query.limit;
      const limit = Number.parseInt(
        typeof limitParam === "string" ? limitParam : "3",
        10,
      );

      const entries = await blackboardModel.getDashboardEntries(
        tenantId,
        req.user.id,
        limit,
      );
      res.json(entries);
    } catch (error: unknown) {
      console.error("Error in GET /api/blackboard/dashboard:", error);
      res.status(500).json({ message: "Error retrieving dashboard entries" });
    }
  }),
);

/**
 * @route GET /api/blackboard/entries
 * @desc Alias for GET /api/blackboard - for backwards compatibility
 */
router.get(
  "/entries",
  ...security.user(getEntriesValidation),
  typed.auth(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);

      const options: EntryQueryOptions = {
        status: ((req.query.status as string) || "active") as
          | "active"
          | "archived",
        filter: ((req.query.filter as string) || "all") as
          | "all"
          | "company"
          | "department"
          | "team",
        search: (req.query.search as string) || "",
        page: Number.parseInt((req.query.page as string) || "1", 10),
        limit: Number.parseInt((req.query.limit as string) || "18", 10),
        sortBy: (req.query.sortBy as string) || "created_at",
        sortDir: (((req.query.sortOrder ?? req.query.sortDir) as string) ||
          "DESC") as "ASC" | "DESC",
      };

      const result = await blackboardModel.getAllEntries(
        tenantId,
        req.user.id,
        options,
      );

      res.json(successResponse(result));
    } catch (error: unknown) {
      console.error("Error in GET /api/blackboard/entries:", error);
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Abrufen der Blackboard-Einträge", 500),
        );
    }
  }),
);

/**
 * @route GET /api/blackboard/:id
 * @desc Get a specific blackboard entry
 */
router.get(
  "/:id",
  authenticateToken,
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);

      const entry = await blackboardModel.getEntryById(
        Number.parseInt(req.params.id, 10),
        tenantId,
        req.user.id,
      );

      if (!entry) {
        res.status(404).json({ message: "Entry not found" });
        return;
      }

      res.json(entry);
    } catch (error: unknown) {
      console.error("Error in GET /api/blackboard/:id:", error);
      res.status(500).json({ message: "Error retrieving blackboard entry" });
    }
  }),
);

/**
 * @swagger
 * /blackboard:
 *   post:
 *     summary: Create blackboard entry
 *     description: Create a new blackboard entry with optional file attachment
 *     tags: [Blackboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *               - org_level
 *             properties:
 *               title:
 *                 type: string
 *                 description: Entry title
 *                 example: Wichtige Ankündigung
 *               content:
 *                 type: string
 *                 description: Entry content (supports Markdown)
 *                 example: Dies ist eine wichtige Mitteilung für alle Mitarbeiter.
 *               org_level:
 *                 type: string
 *                 enum: [company, department, team]
 *                 description: Organizational level
 *               org_id:
 *                 type: integer
 *                 description: Department/Team ID (not needed for company level)
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 default: normal
 *                 description: Entry priority
 *               color:
 *                 type: string
 *                 enum: [blue, green, yellow, red, purple]
 *                 default: blue
 *                 description: Display color
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *                 description: Expiration date (optional)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tags for categorization
 *               requires_confirmation:
 *                 type: boolean
 *                 default: false
 *                 description: Whether users must confirm reading
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: Optional file attachment (PDF, JPEG, PNG, GIF - max 10MB)
 *     responses:
 *       201:
 *         description: Entry created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Blackboard entry created successfully
 *                 entry:
 *                   $ref: '#/components/schemas/BlackboardEntry'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - No permission for this org level
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: You do not have permission to create entries at this level
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Nur PDF und Bilder (JPEG, PNG, GIF) sind erlaubt!
 *       500:
 *         description: Server error
 */
/**
 * @route POST /api/blackboard
 * @desc Create a new blackboard entry (with optional direct attachment)
 */
router.post(
  "/",
  authenticateToken,
  upload.single("attachment"), // Handle single file upload
  canCreateForOrgLevel,
  typed.body<BlackboardEntryBody>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);

      // Convert org_id to number if it's a string, or set to null for company level
      let org_id: number | null = req.body.org_id ?? null;
      if (req.body.org_level === "company") {
        org_id = null;
      } else if (typeof org_id === "string") {
        org_id = Number.parseInt(org_id, 10);
      }

      // Handle priority_level vs priority field name
      const priority = req.body.priority ?? req.body.priority_level ?? "medium";

      const entryData: EntryCreateData = {
        tenant_id: tenantId,
        title: req.body.title,
        content: req.body.content,
        org_level: req.body.org_level as "company" | "department" | "team",
        org_id: org_id ?? null,
        author_id: req.user.id,
        expires_at:
          req.body.expires_at != null && req.body.expires_at !== ""
            ? new Date(req.body.expires_at)
            : null,
        priority: priority as "low" | "medium" | "high" | "urgent",
        color: req.body.color ?? "blue",
        tags: req.body.tags ?? [],
        requires_confirmation: req.body.requires_confirmation ?? false,
      };

      // Create the entry
      const entry = await blackboardModel.createEntry(entryData);

      if (!entry) {
        res.status(500).json({
          message: "Failed to create blackboard entry",
        });
        return;
      }

      // If there's an uploaded file, add it as an attachment
      if (req.file) {
        try {
          const attachmentId = await blackboardModel.addAttachment(entry.id, {
            filename: req.file.filename,
            originalName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            filePath: req.file.path,
            uploadedBy: req.user.id,
          });

          // The full attachment data will be loaded when fetching the entry
          // Don't try to manually set attachments here as it causes type issues

          logger.info(
            `User ${req.user.id} created entry ${entry.id} with direct attachment ${attachmentId}`,
          );
        } catch (attachError: unknown) {
          // If attachment fails, still return the created entry
          logger.error(
            `Failed to add attachment to entry ${entry.id}:`,
            attachError,
          );
        }
      }

      res
        .status(201)
        .json(
          successResponse(entry, "Blackboard-Eintrag erfolgreich erstellt"),
        );
    } catch (error: unknown) {
      console.error("Error in POST /api/blackboard:", error);
      console.error("Error details:", getErrorMessage(error));
      const stack = getErrorStack(error);
      if (stack != null && stack !== "") {
        console.error("Error stack:", stack);
      }
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Erstellen des Blackboard-Eintrags", 500),
        );
    }
  }),
);

/**
 * @route PUT /api/blackboard/:id
 * @desc Update a blackboard entry
 */
router.put(
  "/:id",
  ...security.user(updateEntryValidation),
  canManageEntry,
  typed.paramsBody<{ id: string }, BlackboardEntryBody>(async (req, res) => {
    try {
      const entryData: Partial<EntryUpdateData> = {
        title: req.body.title,
        content: req.body.content,
        org_level: req.body.org_level as
          | "company"
          | "department"
          | "team"
          | undefined,
        org_id: req.body.org_id,
        priority: req.body.priority as
          | "low"
          | "medium"
          | "high"
          | "urgent"
          | undefined,
        color: req.body.color,
        tags: req.body.tags,
        expires_at:
          req.body.expires_at != null && req.body.expires_at !== ""
            ? new Date(req.body.expires_at)
            : undefined,
        requires_confirmation: req.body.requires_confirmation,
        status: req.body.status as "active" | "archived" | undefined,
      };

      const tenantId = getTenantId(req.user);
      const updatedEntry = await blackboardModel.updateEntry(
        Number.parseInt(req.params.id, 10),
        entryData,
        tenantId,
      );

      res.json(
        successResponse(
          updatedEntry,
          "Blackboard-Eintrag erfolgreich aktualisiert",
        ),
      );
    } catch (error: unknown) {
      console.error("Error in PUT /api/blackboard/:id:", error);
      res
        .status(500)
        .json(
          errorResponse(
            "Fehler beim Aktualisieren des Blackboard-Eintrags",
            500,
          ),
        );
    }
  }),
);

/**
 * @route DELETE /api/blackboard/:id
 * @desc Delete a blackboard entry
 */
router.delete(
  "/:id",
  ...security.user(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Ungültige Entry-ID"),
    ]),
  ),
  canManageEntry,
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);
      const success = await blackboardModel.deleteEntry(
        Number.parseInt(req.params.id, 10),
        tenantId,
      );

      if (!success) {
        res.status(404).json(errorResponse("Eintrag nicht gefunden", 404));
        return;
      }

      res.json(successResponse(null, "Eintrag erfolgreich gelöscht"));
    } catch (error: unknown) {
      console.error("Error in DELETE /api/blackboard/:id:", error);
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Löschen des Blackboard-Eintrags", 500),
        );
    }
  }),
);

/**
 * @route POST /api/blackboard/:id/confirm
 * @desc Mark a blackboard entry as read
 */
router.post(
  "/:id/confirm",
  ...security.user(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Ungültige Entry-ID"),
    ]),
  ),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const success = await blackboardModel.confirmEntry(
        Number.parseInt(req.params.id, 10),
        req.user.id,
      );

      if (!success) {
        res
          .status(400)
          .json(
            errorResponse(
              "Eintrag existiert nicht oder erfordert keine Bestätigung",
              400,
            ),
          );
        return;
      }

      res.json(successResponse(null, "Eintrag erfolgreich bestätigt"));
    } catch (error: unknown) {
      console.error("Error in POST /api/blackboard/:id/confirm:", error);
      res
        .status(500)
        .json(
          errorResponse("Fehler beim Bestätigen des Blackboard-Eintrags", 500),
        );
    }
  }),
);

/**
 * @route GET /api/blackboard/:id/confirmations
 * @desc Get confirmation status for an entry
 */
router.get(
  "/:id/confirmations",
  ...security.admin(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Ungültige Entry-ID"),
    ]),
  ),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);
      const confirmations = await blackboardModel.getConfirmationStatus(
        Number.parseInt(req.params.id, 10),
        tenantId,
      );

      res.json(successResponse(confirmations));
    } catch (error: unknown) {
      console.error("Error in GET /api/blackboard/:id/confirmations:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen des Bestätigungsstatus", 500));
    }
  }),
);

/**
 * @route POST /api/blackboard/:id/attachments
 * @desc Upload attachments to a blackboard entry
 */
router.post(
  "/:id/attachments",
  ...security.user(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Ungültige Entry-ID"),
    ]),
  ),
  canManageEntry,
  upload.array("attachments", 5), // Max 5 files at once
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const entryId = Number.parseInt(req.params.id, 10);
      const files = req.files as Express.Multer.File[];

      if (files.length === 0) {
        res.status(400).json(errorResponse("Keine Dateien hochgeladen", 400));
        return;
      }

      const attachments = [];

      for (const file of files) {
        const attachmentId = await blackboardModel.addAttachment(entryId, {
          filename: file.filename,
          originalName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          filePath: file.path,
          uploadedBy: req.user.id,
        });

        attachments.push({
          id: attachmentId,
          filename: file.filename,
          original_name: file.originalname,
          size: file.size,
          mime_type: file.mimetype,
        });
      }

      logger.info(
        `User ${req.user.id} uploaded ${attachments.length} attachments to entry ${entryId}`,
      );

      res.status(201).json(
        successResponse(
          {
            attachments,
          },
          "Anhänge erfolgreich hochgeladen",
        ),
      );
    } catch (error: unknown) {
      console.error("Error in POST /api/blackboard/:id/attachments:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Hochladen der Anhänge", 500));
    }
  }),
);

/**
 * @route GET /api/blackboard/:id/attachments
 * @desc Get all attachments for a blackboard entry
 */
router.get(
  "/:id/attachments",
  ...security.user(
    createValidation([
      param("id").isInt({ min: 1 }).withMessage("Ungültige Entry-ID"),
    ]),
  ),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const entryId = Number.parseInt(req.params.id, 10);
      const attachments = await blackboardModel.getEntryAttachments(entryId);
      res.json(successResponse(attachments));
    } catch (error: unknown) {
      console.error("Error in GET /api/blackboard/:id/attachments:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Anhänge", 500));
    }
  }),
);

/**
 * @route GET /api/blackboard/attachments/:attachmentId
 * @desc Download a specific attachment
 */
router.get(
  "/attachments/:attachmentId",
  ...security.user(
    createValidation([
      param("attachmentId")
        .isInt({ min: 1 })
        .withMessage("Ungültige Attachment-ID"),
    ]),
  ),
  rateLimiter.download,
  typed.params<{ attachmentId: string }>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);
      const attachmentId = Number.parseInt(req.params.attachmentId, 10);

      const attachment = await blackboardModel.getAttachmentById(
        attachmentId,
        tenantId,
      );

      if (!attachment) {
        res.status(404).json(errorResponse("Anhang nicht gefunden", 404));
        return;
      }

      // Check if file exists
      try {
        await fs.access(attachment.file_path);
      } catch {
        res.status(404).json(errorResponse("Datei nicht gefunden", 404));
        return;
      }

      // Set appropriate headers
      // Use 'inline' for preview, 'attachment' only if download is requested
      const disposition =
        req.query.download === "true" ? "attachment" : "inline";
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${attachment.original_name}"`,
      );
      res.setHeader("Content-Type", attachment.mime_type);

      // Override X-Frame-Options to allow embedding
      res.setHeader("X-Frame-Options", "SAMEORIGIN");

      // Validate and send file
      // If the file_path is already absolute, use it directly
      let filePath = attachment.file_path;

      // If it's a relative path, resolve it relative to uploads directory
      if (!path.isAbsolute(filePath)) {
        const baseDir = path.resolve(process.cwd(), "uploads");
        filePath = path.join(baseDir, filePath);
      }

      // Ensure the file is within the uploads directory
      const uploadsBase = path.resolve(process.cwd(), "uploads");
      const resolvedPath = path.resolve(filePath);

      if (!resolvedPath.startsWith(uploadsBase)) {
        logger.warn(
          `Path traversal attempt for attachment ${attachmentId}: ${filePath}`,
        );
        res.status(400).json(errorResponse("Ungültiger Dateipfad", 400));
        return;
      }

      res.sendFile(resolvedPath);
    } catch (error: unknown) {
      console.error("Error in GET /api/blackboard/attachments/:id:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Herunterladen der Datei", 500));
    }
  }),
);

/**
 * @route GET /api/blackboard/attachments/:attachmentId/preview
 * @desc Get a preview of an attachment (optimized for inline display)
 */
router.get(
  "/attachments/:attachmentId/preview",
  ...security.user(
    createValidation([
      param("attachmentId")
        .isInt({ min: 1 })
        .withMessage("Ungültige Attachment-ID"),
    ]),
  ),
  rateLimiter.download,
  typed.params<{ attachmentId: string }>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);
      const attachmentId = Number.parseInt(req.params.attachmentId, 10);

      const attachment = await blackboardModel.getAttachmentById(
        attachmentId,
        tenantId,
      );

      if (!attachment) {
        res.status(404).json(errorResponse("Anhang nicht gefunden", 404));
        return;
      }

      // Check if file exists
      try {
        await fs.access(attachment.file_path);
      } catch {
        res.status(404).json(errorResponse("Datei nicht gefunden", 404));
        return;
      }

      // Set appropriate headers for preview
      res.setHeader("Content-Type", attachment.mime_type);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${attachment.original_name}"`,
      );

      // Add cache headers for better performance
      res.setHeader("Cache-Control", "public, max-age=3600");

      // Override X-Frame-Options to allow embedding
      res.setHeader("X-Frame-Options", "SAMEORIGIN");

      // Validate and send file
      // If the file_path is already absolute, use it directly
      let filePath = attachment.file_path;

      // If it's a relative path, resolve it relative to uploads directory
      if (!path.isAbsolute(filePath)) {
        const baseDir = path.resolve(process.cwd(), "uploads");
        filePath = path.join(baseDir, filePath);
      }

      // Ensure the file is within the uploads directory
      const uploadsBase = path.resolve(process.cwd(), "uploads");
      const resolvedPath = path.resolve(filePath);

      if (!resolvedPath.startsWith(uploadsBase)) {
        logger.warn(
          `Path traversal attempt for attachment preview ${attachmentId}: ${filePath}`,
        );
        res.status(400).json(errorResponse("Ungültiger Dateipfad", 400));
        return;
      }

      res.sendFile(resolvedPath);
    } catch (error: unknown) {
      console.error(
        "Error in GET /api/blackboard/attachments/:id/preview:",
        error,
      );
      res
        .status(500)
        .json(errorResponse("Fehler beim Laden der Vorschau", 500));
    }
  }),
);

/**
 * @route DELETE /api/blackboard/attachments/:attachmentId
 * @desc Delete an attachment
 */
router.delete(
  "/attachments/:attachmentId",
  ...security.user(
    createValidation([
      param("attachmentId")
        .isInt({ min: 1 })
        .withMessage("Ungültige Attachment-ID"),
    ]),
  ),
  typed.params<{ attachmentId: string }>(async (req, res) => {
    try {
      const tenantId = getTenantId(req.user);
      const attachmentId = Number.parseInt(req.params.attachmentId, 10);

      // Get attachment details before deletion
      const attachment = await blackboardModel.getAttachmentById(
        attachmentId,
        tenantId,
      );

      if (!attachment) {
        res.status(404).json(errorResponse("Anhang nicht gefunden", 404));
        return;
      }

      // Check if user can delete (must be uploader or admin)
      if (
        req.user.role !== "admin" &&
        req.user.role !== "root" &&
        attachment.uploaded_by !== req.user.id
      ) {
        res
          .status(403)
          .json(
            errorResponse("Keine Berechtigung zum Löschen dieses Anhangs", 403),
          );
        return;
      }

      // Delete from database
      const deleted = await blackboardModel.deleteAttachment(
        attachmentId,
        tenantId,
      );

      if (deleted) {
        // Try to delete physical file
        try {
          await fs.unlink(attachment.file_path);
        } catch (error: unknown) {
          logger.warn(`Could not delete file ${attachment.file_path}:`, error);
        }

        logger.info(`User ${req.user.id} deleted attachment ${attachmentId}`);

        res.json(successResponse(null, "Anhang erfolgreich gelöscht"));
      } else {
        res
          .status(500)
          .json(errorResponse("Fehler beim Löschen des Anhangs", 500));
      }
    } catch (error: unknown) {
      console.error("Error in DELETE /api/blackboard/attachments/:id:", error);
      res
        .status(500)
        .json(errorResponse("Fehler beim Löschen des Anhangs", 500));
    }
  }),
);

export default router;

// CommonJS compatibility
