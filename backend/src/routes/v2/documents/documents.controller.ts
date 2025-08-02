/**
 * Documents v2 Controller
 * Handles HTTP requests and responses for document management
 * @swagger
 * tags:
 *   name: Documents v2
 *   description: Document management API v2
 */

import { Response } from "express";
import multer from "multer";

import { AuthenticatedRequest } from "../../../types/request.types";
import { successResponse, errorResponse } from "../../../utils/apiResponse";
import { logger } from "../../../utils/logger";

import { documentsService, ServiceError } from "./documents.service";

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

export const uploadMiddleware = upload.single("document");

/**
 * @swagger
 * /api/v2/documents:
 *   get:
 *     summary: List documents with filters
 *     tags: [Documents v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [general, personal, work, training, hr, salary]
 *         description: Filter by document category
 *       - in: query
 *         name: recipientType
 *         schema:
 *           type: string
 *           enum: [user, team, department, company]
 *         description: Filter by recipient type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter by user ID (admin only)
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: integer
 *         description: Filter by team ID
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: integer
 *         description: Filter by department ID
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Filter by year (for salary documents)
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Filter by month (for salary documents)
 *       - in: query
 *         name: isArchived
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filter archived documents
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in filename and description
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DocumentsListResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function listDocuments(req: AuthenticatedRequest, res: Response) {
  try {
    logger.info("Documents v2: listDocuments called", {
      userId: req.user?.id,
      tenantId: req.user?.tenant_id,
    });
    const filters = {
      category: req.query.category as string,
      recipientType: req.query.recipientType as string,
      userId: req.query.userId
        ? parseInt(req.query.userId as string)
        : undefined,
      teamId: req.query.teamId
        ? parseInt(req.query.teamId as string)
        : undefined,
      departmentId: req.query.departmentId
        ? parseInt(req.query.departmentId as string)
        : undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      month: req.query.month ? parseInt(req.query.month as string) : undefined,
      isArchived: req.query.isArchived === "true",
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await documentsService.listDocuments(
      req.user.id,
      req.user.tenant_id,
      filters,
    );

    res.json(successResponse(result));
  } catch (error) {
    logger.error(`List documents error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to list documents"));
    }
  }
}

/**
 * @swagger
 * /api/v2/documents/{id}:
 *   get:
 *     summary: Get document by ID
 *     tags: [Documents v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DocumentResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - No access to document
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
export async function getDocumentById(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const documentId = parseInt(req.params.id);

    const document = await documentsService.getDocumentById(
      documentId,
      req.user.id,
      req.user.tenant_id,
    );

    res.json(successResponse(document));
  } catch (error) {
    logger.error(`Get document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get document"));
    }
  }
}

/**
 * @swagger
 * /api/v2/documents:
 *   post:
 *     summary: Upload a new document
 *     tags: [Documents v2]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *               - category
 *               - recipientType
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to upload
 *               category:
 *                 type: string
 *                 enum: [general, personal, work, training, hr, salary]
 *               recipientType:
 *                 type: string
 *                 enum: [user, team, department, company]
 *               userId:
 *                 type: integer
 *                 description: Required when recipientType is 'user'
 *               teamId:
 *                 type: integer
 *                 description: Required when recipientType is 'team'
 *               departmentId:
 *                 type: integer
 *                 description: Required when recipientType is 'department'
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               tags:
 *                 type: string
 *                 description: JSON array of tags
 *               year:
 *                 type: integer
 *                 description: Required for salary documents
 *               month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *                 description: Required for salary documents
 *     responses:
 *       201:
 *         description: Document created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DocumentResponse'
 *       400:
 *         description: Bad request - Invalid data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       500:
 *         description: Server error
 */
export async function createDocument(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.file) {
      res.status(400).json(errorResponse("BAD_REQUEST", "No file uploaded"));
      return;
    }

    // Cast req.body to proper type for form data
    const body = req.body as Record<string, string>;

    const documentData = {
      filename: req.file.filename || req.file.originalname,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      fileContent: req.file.buffer,
      mimeType: req.file.mimetype,
      category: body.category,
      recipientType: body.recipientType,
      userId: body.userId ? parseInt(body.userId) : undefined,
      teamId: body.teamId ? parseInt(body.teamId) : undefined,
      departmentId: body.departmentId ? parseInt(body.departmentId) : undefined,
      description: body.description,
      year: body.year ? parseInt(body.year) : undefined,
      month: body.month ? parseInt(body.month) : undefined,
      tags: body.tags ? JSON.parse(body.tags) : undefined,
      isPublic: body.isPublic === "true",
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    };

    const document = await documentsService.createDocument(
      documentData,
      req.user.id,
      req.user.tenant_id,
    );

    res.status(201).json(successResponse(document));
  } catch (error) {
    logger.error(`Create document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to create document"));
    }
  }
}

/**
 * @swagger
 * /api/v2/documents/{id}:
 *   put:
 *     summary: Update document metadata
 *     tags: [Documents v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filename:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [general, personal, work, training, hr, salary]
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               isPublic:
 *                 type: boolean
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Document updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DocumentResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
export async function updateDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const documentId = parseInt(req.params.id);
    interface UpdateDocumentBody {
      filename?: string;
      category?: string;
      description?: string;
      tags?: string[];
      isPublic?: boolean;
      expiresAt?: string;
    }

    const body = req.body as UpdateDocumentBody;

    const updateData = {
      filename: body.filename,
      category: body.category,
      description: body.description,
      tags: body.tags,
      isPublic: body.isPublic,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    };

    const document = await documentsService.updateDocument(
      documentId,
      updateData,
      req.user.id,
      req.user.tenant_id,
    );

    res.json(successResponse(document));
  } catch (error) {
    logger.error(`Update document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to update document"));
    }
  }
}

/**
 * @swagger
 * /api/v2/documents/{id}:
 *   delete:
 *     summary: Delete a document
 *     tags: [Documents v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
export async function deleteDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const documentId = parseInt(req.params.id);

    const result = await documentsService.deleteDocument(
      documentId,
      req.user.id,
      req.user.tenant_id,
    );

    res.json(successResponse(result));
  } catch (error) {
    logger.error(`Delete document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to delete document"));
    }
  }
}

/**
 * @swagger
 * /api/v2/documents/{id}/archive:
 *   post:
 *     summary: Archive a document
 *     tags: [Documents v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
export async function archiveDocument(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const documentId = parseInt(req.params.id);
    logger.info(`Archiving document ${documentId} for user ${req.user.id}`);

    const result = await documentsService.archiveDocument(
      documentId,
      true,
      req.user.id,
      req.user.tenant_id,
    );

    res.json(successResponse(result));
  } catch (error) {
    logger.error(`Archive document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to archive document"));
    }
  }
}

/**
 * @swagger
 * /api/v2/documents/{id}/unarchive:
 *   post:
 *     summary: Unarchive a document
 *     tags: [Documents v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document unarchived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
export async function unarchiveDocument(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const documentId = parseInt(req.params.id);

    const result = await documentsService.archiveDocument(
      documentId,
      false,
      req.user.id,
      req.user.tenant_id,
    );

    res.json(successResponse(result));
  } catch (error) {
    logger.error(`Unarchive document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to unarchive document"));
    }
  }
}

/**
 * @swagger
 * /api/v2/documents/{id}/download:
 *   get:
 *     summary: Download a document file
 *     tags: [Documents v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - No access to document
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
export async function downloadDocument(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const documentId = parseInt(req.params.id);

    const documentContent = await documentsService.getDocumentContent(
      documentId,
      req.user.id,
      req.user.tenant_id,
    );

    // Set headers for download
    res.setHeader("Content-Type", documentContent.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${documentContent.filename}"`,
    );
    res.setHeader("Content-Length", documentContent.size.toString());

    // Send file content
    res.send(documentContent.content);
  } catch (error) {
    logger.error(`Download document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to download document"));
    }
  }
}

/**
 * @swagger
 * /api/v2/documents/{id}/preview:
 *   get:
 *     summary: Preview a document inline
 *     tags: [Documents v2]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document file for preview
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - No access to document
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
export async function previewDocument(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const documentId = parseInt(req.params.id);

    const documentContent = await documentsService.getDocumentContent(
      documentId,
      req.user.id,
      req.user.tenant_id,
    );

    // Set headers for inline viewing
    res.setHeader("Content-Type", documentContent.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${documentContent.filename}"`,
    );
    res.setHeader("Content-Length", documentContent.size.toString());

    // Send file content
    res.send(documentContent.content);
  } catch (error) {
    logger.error(`Preview document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to preview document"));
    }
  }
}

/**
 * @swagger
 * /api/v2/documents/stats:
 *   get:
 *     summary: Get document statistics
 *     tags: [Documents v2]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Document statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     unreadCount:
 *                       type: integer
 *                       description: Number of unread documents
 *                     totalCount:
 *                       type: integer
 *                       description: Total number of documents
 *                     storageUsed:
 *                       type: integer
 *                       description: Storage used in bytes (admin only)
 *                     documentsByCategory:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                       description: Document count by category
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function getDocumentStats(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const stats = await documentsService.getDocumentStats(
      req.user.id,
      req.user.tenant_id,
    );

    res.json(successResponse(stats));
  } catch (error) {
    logger.error(`Get document stats error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get document stats"));
    }
  }
}
