/**
 * Documents API Routes
 * Handles document upload, download, and management operations
 * @swagger
 * tags:
 *   name: Documents
 *   description: Document management operations
 */

import express, { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticateToken, authorizeRole } from '../auth';
// import { _checkFeature } from '../middleware/features';
import { checkDocumentAccess } from '../middleware/documentAccess';
import { logger } from '../utils/logger';
import { uploadLimiter } from '../middleware/security-enhanced';
import {
  validateDocumentUpload,
  validatePaginationQuery,
  validateFileUpload,
} from '../middleware/validators';

// Import models and services (now ES modules)
import Document from '../models/document';
import User from '../models/user';
import Feature from '../models/feature';
import emailService from '../utils/emailService';
import documentController from '../controllers/document.controller';

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
    cb(null, 'uploads/documents/');
  },
  filename(_req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Filename with timestamp
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF-Dateien sind erlaubt!'));
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
  '/upload',
  uploadLimiter as any,
  authenticateToken as any,
  authorizeRole('admin') as any,
  upload.single('document'),
  validateFileUpload(['pdf'], 5 * 1024 * 1024) as any, // 5MB limit for PDFs
  ...(validateDocumentUpload as any[]),
  async (req: any, res: any): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const adminId = authReq.user.id;
    logger.info(`Admin ${adminId} attempting to upload a document`);

    try {
      if (!req.file) {
        throw new Error('Keine Datei hochgeladen');
      }

      const { originalname, path: filePath } = req.file;
      const {
        userId,
        teamId,
        departmentId,
        recipientType,
        category,
        description,
        year,
        month,
      } = req.body;

      // Validate recipient based on type
      let recipientData: any = {
        recipient_type: recipientType || 'user',
        user_id: null,
        team_id: null,
        department_id: null,
      };

      switch (recipientType) {
        case 'user':
          if (!userId) {
            throw new Error('Kein Benutzer ausgewählt');
          }
          recipientData.user_id = parseInt(userId, 10);
          break;
        case 'team':
          if (!teamId) {
            throw new Error('Kein Team ausgewählt');
          }
          recipientData.team_id = parseInt(teamId, 10);
          break;
        case 'department':
          if (!departmentId) {
            throw new Error('Keine Abteilung ausgewählt');
          }
          recipientData.department_id = parseInt(departmentId, 10);
          break;
        case 'company':
          // No specific ID needed for company-wide documents
          break;
        default:
          throw new Error('Ungültiger Empfänger-Typ');
      }

      // Read file content
      const fileContent = await fs.readFile(filePath);

      const documentId = await Document.create({
        fileName: originalname,
        userId: recipientData.user_id,
        teamId: recipientData.team_id,
        departmentId: recipientData.department_id,
        recipientType: recipientData.recipient_type,
        fileContent,
        category: category || 'other',
        description: description || '',
        year: year ? parseInt(year, 10) : undefined,
        month: month || undefined,
        tenant_id: authReq.user.tenant_id,
      });

      // Delete temporary file
      await fs.unlink(filePath);

      logger.info(
        `Admin ${adminId} successfully uploaded document ${documentId} for user ${userId}`
      );

      // Send email notification if feature is enabled
      try {
        const isEmailFeatureEnabled = await Feature.isEnabledForTenant(
          'email_notifications',
          authReq.user.tenant_id
        );

        if (isEmailFeatureEnabled) {
          const documentInfo = {
            file_name: originalname,
            category: category || 'other',
            upload_date: new Date(),
          };

          switch (recipientType) {
            case 'user':
              // Send to individual user
              if (userId) {
                const user = await User.findById(
                  parseInt(userId, 10),
                  authReq.user.tenant_id
                );
                if (user && user.email) {
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

            case 'team':
              // TODO: Send to all team members
              logger.info(
                `Team notifications not yet implemented for document ${documentId}`
              );
              break;

            case 'department':
              // TODO: Send to all department members
              logger.info(
                `Department notifications not yet implemented for document ${documentId}`
              );
              break;

            case 'company':
              // TODO: Send to all company members
              logger.info(
                `Company-wide notifications not yet implemented for document ${documentId}`
              );
              break;
          }
        }
      } catch (emailError: any) {
        logger.warn(`Could not send email notification: ${emailError.message}`);
      }

      res.status(201).json({
        message: 'Dokument erfolgreich hochgeladen',
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
        message: 'Fehler beim Hochladen des Dokuments',
        error: error.message,
      });
    }
  }
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
  '/',
  authenticateToken as any,
  authorizeRole('admin') as any,
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
        page = '1',
        limit = '20',
        archived,
      } = queryReq.query;

      const filters = {
        category,
        userId: userId ? parseInt(userId, 10) : undefined,
        year: year ? parseInt(year, 10) : undefined,
        month,
        archived: archived === 'true',
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
        message: 'Fehler beim Abrufen der Dokumente',
        error: error.message,
      });
    }
  }
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
  '/preview/:documentId',
  authenticateToken as any,
  checkDocumentAccess({
    allowAdmin: true,
    requireOwnership: false,
  }) as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const documentReq = req as any;
      const document =
        documentReq.document ||
        (await Document.findById(parseInt(req.params.documentId, 10)));

      if (!document) {
        res.status(404).json({ message: 'Dokument nicht gefunden' });
        return;
      }

      // Set headers for inline display (not download)
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${document.fileName || document.file_name}"`
      );

      // Handle different possible buffer/content formats
      let contentBuffer: Buffer;
      if (document.fileContent) {
        contentBuffer = document.fileContent;
      } else if (document.file_content) {
        contentBuffer = document.file_content;
      } else {
        res.status(500).json({ message: 'Dokument hat keinen Inhalt' });
        return;
      }

      res.setHeader('Content-Length', contentBuffer.length.toString());

      // Send file content
      res.send(contentBuffer);

      logger.info(
        `Document ${req.params.documentId} previewed by user ${authReq.user.id}`
      );
    } catch (error: any) {
      logger.error(`Error previewing document: ${error.message}`);
      res.status(500).json({
        message: 'Fehler beim Anzeigen des Dokuments',
        error: error.message,
      });
    }
  }
);

// Download document
router.get(
  '/download/:documentId',
  authenticateToken as any,
  checkDocumentAccess({
    allowAdmin: true,
    requireOwnership: false,
  }) as any,
  async (req: any, res: any): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const documentReq = req as any;
      const document =
        documentReq.document ||
        (await Document.findById(parseInt(req.params.documentId, 10)));

      if (!document) {
        res.status(404).json({ message: 'Dokument nicht gefunden' });
        return;
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${document.fileName || document.file_name}"`
      );

      // Handle different possible buffer/content formats
      let contentBuffer: Buffer;
      if (document.fileContent) {
        contentBuffer = document.fileContent;
      } else if (document.file_content) {
        contentBuffer = document.file_content;
      } else {
        res.status(500).json({ message: 'Dokument hat keinen Inhalt' });
        return;
      }

      res.setHeader('Content-Length', contentBuffer.length.toString());

      // Send file content
      res.send(contentBuffer);

      logger.info(
        `Document ${req.params.documentId} downloaded by user ${authReq.user.id}`
      );
    } catch (error: any) {
      logger.error(`Error downloading document: ${error.message}`);
      res.status(500).json({
        message: 'Fehler beim Herunterladen des Dokuments',
        error: error.message,
      });
    }
  }
);

// Archive document
router.put(
  '/archive/:documentId',
  authenticateToken,
  authorizeRole('admin'),
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const success = await Document.archiveDocument(
        parseInt(req.params.documentId, 10)
      );

      if (!success) {
        res.status(404).json({ message: 'Dokument nicht gefunden' });
        return;
      }

      logger.info(
        `Document ${req.params.documentId} archived by admin ${authReq.user.id}`
      );
      res.json({ message: 'Dokument erfolgreich archiviert' });
    } catch (error: any) {
      logger.error(`Error archiving document: ${error.message}`);
      res.status(500).json({
        message: 'Fehler beim Archivieren des Dokuments',
        error: error.message,
      });
    }
  }
);

// Delete document
router.delete(
  '/:documentId',
  authenticateToken,
  authorizeRole('admin'),
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const success = await Document.delete(
        parseInt(req.params.documentId, 10)
      );

      if (!success) {
        res.status(404).json({ message: 'Dokument nicht gefunden' });
        return;
      }

      logger.info(
        `Document ${req.params.documentId} deleted by admin ${authReq.user.id}`
      );
      res.json({ message: 'Dokument erfolgreich gelöscht' });
    } catch (error: any) {
      logger.error(`Error deleting document: ${error.message}`);
      res.status(500).json({
        message: 'Fehler beim Löschen des Dokuments',
        error: error.message,
      });
    }
  }
);

// NEW ROUTES WITH CONTROLLER

// Get documents with scope-based filtering
router.get(
  '/v2',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    await documentController.getDocuments(req, res);
  }
);

// Get document by ID
router.get(
  '/v2/:id',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    await documentController.getDocumentById(req, res);
  }
);

// Download document
router.get(
  '/:id/download',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    await documentController.downloadDocument(req, res);
  }
);

// Mark document as read
router.post(
  '/:id/read',
  authenticateToken as any,
  async (req: any, res: any): Promise<void> => {
    await documentController.markDocumentAsRead(req, res);
  }
);

export default router;

// CommonJS compatibility
