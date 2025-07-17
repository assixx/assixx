/**
 * Documents API Routes
 * Handles document upload, download, and management operations
 * @swagger
 * tags:
 *   name: Documents
 *   description: Document management operations
 */

import express, { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
// Authentication is handled via security middleware
import { checkDocumentAccess } from "../middleware/documentAccess";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/errorHandler";
import { security } from "../middleware/security";
import { rateLimiter } from "../middleware/rateLimiter";
import {
  validatePath,
  sanitizeFilename,
  getUploadDirectory,
  safeDeleteFile,
} from "../utils/pathSecurity";
import {
  validateDocumentUpload,
  validatePaginationQuery,
  validateFileUpload,
} from "../middleware/validators";
import { AuthenticatedRequest, PaginatedRequest } from "../types/request.types";
import { successResponse, errorResponse } from "../types/response.types";
import { typed } from "../utils/routeHandlers";

// Import models and services (now ES modules)
import Document from "../models/document";
import User from "../models/user";
import Feature from "../models/feature";
import emailService from "../utils/emailService";
import documentController from "../controllers/document.controller";

const router: Router = express.Router();

// Extended Request interfaces
interface DocumentQueryRequest extends PaginatedRequest {
  query: {
    category?: string;
    userId?: string;
    year?: string;
    month?: string;
    page?: string;
    limit?: string;
    archived?: string;
  };
}

interface DocumentUploadRequest extends AuthenticatedRequest {
  body: {
    userId?: string;
    teamId?: string;
    departmentId?: string;
    recipientType?: string;
    category?: string;
    description?: string;
    year?: string;
    month?: string;
  };
}

interface DocumentAccessRequest extends AuthenticatedRequest {
  document?: unknown; // Populated by checkDocumentAccess middleware
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const uploadDir = getUploadDirectory("documents");
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    // Sanitize the original filename and add timestamp
    const sanitized = sanitizeFilename(file.originalname);
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);
    const secureFilename = `${Date.now()}-${base}${ext}`;
    cb(null, secureFilename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Nur PDF-Dateien sind erlaubt!"));
    }
  },
});

/**
 * @swagger
 * /documents/upload:
 *   post:
 *     summary: Upload a document
 *     description: Upload a PDF document to the system (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *               - category
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to upload (max 5MB)
 *               title:
 *                 type: string
 *                 description: Document title
 *                 example: Arbeitsvertrag
 *               description:
 *                 type: string
 *                 description: Document description
 *                 example: Arbeitsvertrag für neuen Mitarbeiter
 *               category:
 *                 type: string
 *                 enum: [personal, company, department, team, payroll]
 *                 description: Document category
 *               userId:
 *                 type: integer
 *                 description: Target user ID (for personal documents)
 *               teamId:
 *                 type: integer
 *                 description: Target team ID (for team documents)
 *               departmentId:
 *                 type: integer
 *                 description: Target department ID (for department documents)
 *               year:
 *                 type: integer
 *                 description: Year (for payroll documents)
 *                 example: 2025
 *               month:
 *                 type: integer
 *                 description: Month (for payroll documents)
 *                 example: 6
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dokument erfolgreich hochgeladen
 *                 documentId:
 *                   type: integer
 *                   description: ID of the uploaded document
 *                   example: 123
 *       400:
 *         description: Bad request - Invalid file or parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Nur PDF-Dateien sind erlaubt!
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Upload document
router.post(
  "/upload",
  ...security.admin(validateDocumentUpload),
  rateLimiter.upload,
  upload.single("document"),
  validateFileUpload(["pdf"], 5 * 1024 * 1024),
  typed.auth(async (req, res) => {
    const uploadReq = req as DocumentUploadRequest;
    const adminId = uploadReq.user.id;
    logger.info(`Admin ${adminId} attempting to upload a document`);

    try {
      if (!uploadReq.file) {
        res.status(400).json(errorResponse("Keine Datei hochgeladen", 400));
        return;
      }

      const { originalname, path: filePath } = uploadReq.file;
      const {
        userId,
        teamId,
        departmentId,
        recipientType,
        category,
        description,
        year,
        month,
      } = uploadReq.body;

      // Validate recipient based on type
      let recipientData: {
        recipient_type: string;
        user_id: number | null;
        team_id: number | null;
        department_id: number | null;
      } = {
        recipient_type: recipientType ?? "user",
        user_id: null,
        team_id: null,
        department_id: null,
      };

      switch (recipientType) {
        case "user":
          if (!userId) {
            throw new Error("Kein Benutzer ausgewählt");
          }
          recipientData.user_id = parseInt(userId, 10);
          break;
        case "team":
          if (!teamId) {
            throw new Error("Kein Team ausgewählt");
          }
          recipientData.team_id = parseInt(teamId, 10);
          break;
        case "department":
          if (!departmentId) {
            throw new Error("Keine Abteilung ausgewählt");
          }
          recipientData.department_id = parseInt(departmentId, 10);
          break;
        case "company":
          // No specific ID needed for company-wide documents
          break;
        default:
          throw new Error("Ungültiger Empfänger-Typ");
      }

      // Validate and read file content
      const uploadDir = getUploadDirectory("documents");
      const validatedPath = validatePath(path.basename(filePath), uploadDir);
      if (!validatedPath) {
        // Safely delete the uploaded file
        await safeDeleteFile(filePath);
        res.status(400).json(errorResponse("Ungültiger Dateipfad", 400));
        return;
      }
      const fileContent = await fs.readFile(validatedPath);

      const documentId = await Document.create({
        fileName: originalname,
        userId: recipientData.user_id,
        teamId: recipientData.team_id,
        departmentId: recipientData.department_id,
        recipientType: recipientData.recipient_type as
          | "company"
          | "user"
          | "team"
          | "department",
        fileContent,
        category: category ?? "other",
        description: description ?? "",
        year: year ? parseInt(year, 10) : undefined,
        month: month ?? undefined,
        tenant_id: uploadReq.user.tenant_id,
      });

      // Delete temporary file
      await fs.unlink(validatedPath);

      logger.info(
        `Admin ${adminId} successfully uploaded document ${documentId} for user ${userId}`
      );

      // Send email notification if feature is enabled
      try {
        const isEmailFeatureEnabled = await Feature.isEnabledForTenant(
          "email_notifications",
          uploadReq.user.tenant_id
        );

        if (isEmailFeatureEnabled) {
          const documentInfo = {
            file_name: originalname,
            category: category ?? "other",
            upload_date: new Date(),
          };

          switch (recipientType) {
            case "user":
              // Send to individual user
              if (userId) {
                const user = await User.findById(
                  parseInt(userId, 10),
                  uploadReq.user.tenant_id
                );
                if (user?.email) {
                  await emailService.sendNewDocumentNotification(
                    user,
                    documentInfo
                  );
                  logger.info(
                    `Email notification sent to ${user.email} for document ${documentId}`
                  );
                }
              }
              break;

            case "team":
              // TODO: Send to all team members
              logger.info(
                `Team notifications not yet implemented for document ${documentId}`
              );
              break;

            case "department":
              // TODO: Send to all department members
              logger.info(
                `Department notifications not yet implemented for document ${documentId}`
              );
              break;

            case "company":
              // TODO: Send to all company members
              logger.info(
                `Company-wide notifications not yet implemented for document ${documentId}`
              );
              break;
          }
        }
      } catch (emailError) {
        logger.warn(
          `Could not send email notification: ${getErrorMessage(emailError)}`
        );
      }

      res.status(201).json(
        successResponse({
          message: "Dokument erfolgreich hochgeladen",
          documentId,
          fileName: originalname,
        })
      );
    } catch (error) {
      logger.error(`Error uploading document: ${getErrorMessage(error)}`);

      // Clean up file if it was uploaded
      if (uploadReq.file?.path) {
        try {
          await safeDeleteFile(uploadReq.file.path);
        } catch (unlinkError) {
          logger.error(
            `Error deleting temporary file: ${getErrorMessage(unlinkError)}`
          );
        }
      }

      res
        .status(500)
        .json(errorResponse("Fehler beim Hochladen des Dokuments", 500));
    }
  })
);

// Get documents (admin only)
/**
 * @swagger
 * /documents:
 *   get:
 *     summary: Get all documents
 *     description: Retrieve a list of documents with optional filtering (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [personal, company, department, team, payroll]
 *         description: Filter by document category
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter by target user ID
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Filter by year (for payroll documents)
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         description: Filter by month (for payroll documents)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: archived
 *         schema:
 *           type: boolean
 *         description: Filter by archived status
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 documents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Document'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalDocuments:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not an admin
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
router.get(
  "/",
  ...security.admin(),
  validatePaginationQuery,
  typed.auth(async (req, res) => {
    try {
      const queryReq = req as DocumentQueryRequest;
      const {
        category,
        userId,
        year,
        month,
        page = "1",
        limit = "20",
        archived,
      } = queryReq.query;

      const filters = {
        category,
        userId: userId ? parseInt(userId, 10) : undefined,
        year: year ? parseInt(year, 10) : undefined,
        month,
        archived: archived === "true",
        tenant_id: queryReq.user.tenant_id,
      };

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);

      const documents = await Document.findWithFilters(filters);
      const total = documents.length;

      res.json(
        successResponse({
          documents,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(total / limitNum),
            totalDocuments: total,
            hasNext: pageNum * limitNum < total,
            hasPrev: pageNum > 1,
          },
        })
      );
    } catch (error) {
      logger.error(`Error retrieving documents: ${getErrorMessage(error)}`);
      res
        .status(500)
        .json(errorResponse("Fehler beim Abrufen der Dokumente", 500));
    }
  })
);

/**
 * @swagger
 * /documents/preview/{documentId}:
 *   get:
 *     summary: Preview document
 *     description: Get document content for inline preview (iframe display)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID to preview
 *     responses:
 *       200:
 *         description: Document content for preview
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: application/pdf
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: inline; filename="document.pdf"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - No access to this document
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Kein Zugriff auf dieses Dokument
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dokument nicht gefunden
 *       500:
 *         description: Server error or document has no content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dokument hat keinen Inhalt
 */
// Preview document (for iframe display)
router.get(
  "/preview/:documentId",
  ...security.user(),
  checkDocumentAccess({
    allowAdmin: true,
    requireOwnership: false,
  }),
  typed.params<{ documentId: string }>(async (req, res) => {
    try {
      const documentReq = req as DocumentAccessRequest;
      const document =
        documentReq.document ||
        (await Document.findById(parseInt(req.params.documentId, 10)));

      if (!document) {
        res.status(404).json(errorResponse("Dokument nicht gefunden", 404));
        return;
      }

      // Type guard for document properties
      interface DocumentWithContent {
        fileName?: string;
        file_name?: string;
        fileContent?: Buffer;
        file_content?: Buffer;
      }

      const doc = document as DocumentWithContent;
      const fileName = doc.fileName ?? (doc.file_name || "document.pdf");

      // Set headers for inline display (not download)
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

      // Handle different possible buffer/content formats
      let contentBuffer: Buffer;
      if (doc.fileContent) {
        contentBuffer = doc.fileContent;
      } else if (doc.file_content) {
        contentBuffer = doc.file_content;
      } else {
        res.status(500).json(errorResponse("Dokument hat keinen Inhalt", 500));
        return;
      }

      res.setHeader("Content-Length", contentBuffer.length.toString());

      // Send file content
      res.send(contentBuffer);

      logger.info(
        `Document ${req.params.documentId} previewed by user ${req.user.id}`
      );
    } catch (error) {
      logger.error(`Error previewing document: ${getErrorMessage(error)}`);
      res
        .status(500)
        .json(errorResponse("Fehler beim Anzeigen des Dokuments", 500));
    }
  })
);

// Download document
router.get(
  "/download/:documentId",
  ...security.user(),
  rateLimiter.download,
  checkDocumentAccess({
    allowAdmin: true,
    requireOwnership: false,
  }),
  typed.params<{ documentId: string }>(async (req, res) => {
    try {
      const documentReq = req as DocumentAccessRequest;
      const document =
        documentReq.document ||
        (await Document.findById(parseInt(req.params.documentId, 10)));

      if (!document) {
        res.status(404).json(errorResponse("Dokument nicht gefunden", 404));
        return;
      }

      // Type guard for document properties
      interface DocumentWithContent {
        fileName?: string;
        file_name?: string;
        fileContent?: Buffer;
        file_content?: Buffer;
      }

      const doc = document as DocumentWithContent;
      const fileName = doc.fileName ?? (doc.file_name || "document.pdf");

      // Set headers for file download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );

      // Handle different possible buffer/content formats
      let contentBuffer: Buffer;
      if (doc.fileContent) {
        contentBuffer = doc.fileContent;
      } else if (doc.file_content) {
        contentBuffer = doc.file_content;
      } else {
        res.status(500).json(errorResponse("Dokument hat keinen Inhalt", 500));
        return;
      }

      res.setHeader("Content-Length", contentBuffer.length.toString());

      // Send file content
      res.send(contentBuffer);

      logger.info(
        `Document ${req.params.documentId} downloaded by user ${req.user.id}`
      );
    } catch (error) {
      logger.error(`Error downloading document: ${getErrorMessage(error)}`);
      res
        .status(500)
        .json(errorResponse("Fehler beim Herunterladen des Dokuments", 500));
    }
  })
);

// Archive document
router.put(
  "/archive/:documentId",
  ...security.admin(),
  typed.auth(async (req, res) => {
    try {
      const success = await Document.archiveDocument(
        parseInt(req.params.documentId, 10)
      );

      if (!success) {
        res.status(404).json(errorResponse("Dokument nicht gefunden", 404));
        return;
      }

      logger.info(
        `Document ${req.params.documentId} archived by admin ${req.user.id}`
      );
      res.json(successResponse({ message: "Dokument erfolgreich archiviert" }));
    } catch (error) {
      logger.error(`Error archiving document: ${getErrorMessage(error)}`);
      res
        .status(500)
        .json(errorResponse("Fehler beim Archivieren des Dokuments", 500));
    }
  })
);

// Delete document
router.delete(
  "/:documentId",
  ...security.admin(),
  typed.auth(async (req, res) => {
    try {
      const success = await Document.delete(
        parseInt(req.params.documentId, 10)
      );

      if (!success) {
        res.status(404).json(errorResponse("Dokument nicht gefunden", 404));
        return;
      }

      logger.info(
        `Document ${req.params.documentId} deleted by admin ${req.user.id}`
      );
      res.json(successResponse({ message: "Dokument erfolgreich gelöscht" }));
    } catch (error) {
      logger.error(`Error deleting document: ${getErrorMessage(error)}`);
      res
        .status(500)
        .json(errorResponse("Fehler beim Löschen des Dokuments", 500));
    }
  })
);

// NEW ROUTES WITH CONTROLLER

// Get documents with scope-based filtering
router.get(
  "/v2",
  ...security.user(),
  typed.auth(async (req, res) => {
    await documentController.getDocuments(req, res);
  })
);

// Get document by ID
router.get(
  "/v2/:id",
  ...security.user(),
  typed.auth(async (req, res) => {
    await documentController.getDocumentById(req, res);
  })
);

// Download document
router.get(
  "/:id/download",
  ...security.user(),
  rateLimiter.download,
  typed.auth(async (req, res) => {
    await documentController.downloadDocument(req, res);
  })
);

// Mark document as read
router.post(
  "/:id/read",
  ...security.user(),
  typed.auth(async (req, res) => {
    await documentController.markDocumentAsRead(req, res);
  })
);

export default router;

// CommonJS compatibility
