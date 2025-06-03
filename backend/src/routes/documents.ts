/**
 * Documents API Routes
 * Handles document upload, download, and management operations
 */

import express, { Router, Request } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { authenticateToken, authorizeRole } from "../auth";
// import { _checkFeature } from '../middleware/features';
import { checkDocumentAccess } from "../middleware/documentAccess";
import { logger } from "../utils/logger";
import { uploadLimiter } from "../middleware/security-enhanced";
import {
  validateDocumentUpload,
  validatePaginationQuery,
  validateFileUpload,
} from "../middleware/validators";

// Import models and services (now ES modules)
import Document from "../models/document";
import User from "../models/user";
import Feature from "../models/feature";
import emailService from "../utils/emailService";

const router: Router = express.Router();

// Extended Request interfaces
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    tenant_id: number;
    username: string;
    email: string;
    role: string;
  };
  // eslint-disable-next-line no-undef
  file?: Express.Multer.File;
}

interface DocumentQueryRequest extends AuthenticatedRequest {
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, "uploads/documents/");
  },
  filename(_req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Filename with timestamp
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

// Upload document
router.post(
  "/upload",
  uploadLimiter as any,
  authenticateToken as any,
  authorizeRole("admin") as any,
  upload.single("document"),
  validateFileUpload(["pdf"], 5 * 1024 * 1024) as any, // 5MB limit for PDFs
  ...(validateDocumentUpload as any[]),
  async (req: any, res: any): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const adminId = authReq.user.id;
    logger.info(`Admin ${adminId} attempting to upload a document`);

    try {
      if (!req.file) {
        throw new Error("Keine Datei hochgeladen");
      }

      const { originalname, path: filePath } = req.file;
      const { userId, category, description, year, month } = req.body;

      if (!userId) {
        throw new Error("Kein Benutzer ausgewählt");
      }

      // Read file content
      const fileContent = await fs.readFile(filePath);

      const documentId = await Document.create({
        fileName: originalname,
        userId: parseInt(userId, 10),
        fileContent,
        category: category || "other",
        description: description || "",
        year: year ? parseInt(year, 10) : undefined,
        month: month || undefined,
        tenant_id: authReq.user.tenant_id,
      });

      // Delete temporary file
      await fs.unlink(filePath);

      logger.info(
        `Admin ${adminId} successfully uploaded document ${documentId} for user ${userId}`,
      );

      // Send email notification if feature is enabled
      try {
        const isEmailFeatureEnabled = await Feature.isEnabledForTenant(
          "email_notifications",
          authReq.user.tenant_id,
        );

        if (isEmailFeatureEnabled) {
          const user = await User.findById(parseInt(userId, 10), authReq.user.tenant_id);
          if (user && user.email) {
            await emailService.sendNewDocumentNotification(user, {
              file_name: originalname,
              category: category || "other",
              upload_date: new Date(),
            });
            logger.info(
              `Email notification sent to ${user.email} for document ${documentId}`,
            );
          }
        }
      } catch (emailError: any) {
        logger.warn(`Could not send email notification: ${emailError.message}`);
      }

      res.status(201).json({
        message: "Dokument erfolgreich hochgeladen",
        documentId,
        fileName: originalname,
      });
    } catch (error: any) {
      logger.error(`Error uploading document: ${error.message}`);

      // Clean up file if it was uploaded
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError: any) {
          logger.error(`Error deleting temporary file: ${unlinkError.message}`);
        }
      }

      res.status(500).json({
        message: "Fehler beim Hochladen des Dokuments",
        error: error.message,
      });
    }
  },
);

// Get documents (admin only)
router.get(
  "/",
  authenticateToken as any,
  authorizeRole("admin") as any,
  validatePaginationQuery as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
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
        tenant_id: authReq.user.tenant_id,
      };

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);

      const documents = await Document.findWithFilters(filters);
      const total = documents.length;

      res.json({
        documents,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalDocuments: total,
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1,
        },
      });
    } catch (error: any) {
      logger.error(`Error retrieving documents: ${error.message}`);
      res.status(500).json({
        message: "Fehler beim Abrufen der Dokumente",
        error: error.message,
      });
    }
  },
);

// Download document
router.get(
  "/download/:documentId",
  authenticateToken as any,
  checkDocumentAccess as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const document = await Document.findById(
        parseInt(req.params.documentId, 10),
      );

      if (!document) {
        res.status(404).json({ message: "Dokument nicht gefunden" });
        return;
      }

      // Set headers for file download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${document.fileName}"`,
      );
      res.setHeader("Content-Length", document.fileContent.length);

      // Send file content
      res.send(document.fileContent);

      logger.info(
        `Document ${req.params.documentId} downloaded by user ${authReq.user.id}`,
      );
    } catch (error: any) {
      logger.error(`Error downloading document: ${error.message}`);
      res.status(500).json({
        message: "Fehler beim Herunterladen des Dokuments",
        error: error.message,
      });
    }
  },
);

// Archive document
router.put(
  "/archive/:documentId",
  authenticateToken,
  authorizeRole("admin"),
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const success = await Document.archiveDocument(
        parseInt(req.params.documentId, 10),
      );

      if (!success) {
        res.status(404).json({ message: "Dokument nicht gefunden" });
        return;
      }

      logger.info(
        `Document ${req.params.documentId} archived by admin ${authReq.user.id}`,
      );
      res.json({ message: "Dokument erfolgreich archiviert" });
    } catch (error: any) {
      logger.error(`Error archiving document: ${error.message}`);
      res.status(500).json({
        message: "Fehler beim Archivieren des Dokuments",
        error: error.message,
      });
    }
  },
);

// Delete document
router.delete(
  "/:documentId",
  authenticateToken,
  authorizeRole("admin"),
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const success = await Document.delete(
        parseInt(req.params.documentId, 10),
      );

      if (!success) {
        res.status(404).json({ message: "Dokument nicht gefunden" });
        return;
      }

      logger.info(
        `Document ${req.params.documentId} deleted by admin ${authReq.user.id}`,
      );
      res.json({ message: "Dokument erfolgreich gelöscht" });
    } catch (error: any) {
      logger.error(`Error deleting document: ${error.message}`);
      res.status(500).json({
        message: "Fehler beim Löschen des Dokuments",
        error: error.message,
      });
    }
  },
);

export default router;

// CommonJS compatibility
