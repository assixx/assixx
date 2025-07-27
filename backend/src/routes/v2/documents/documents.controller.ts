/**
 * Documents v2 Controller
 * Handles HTTP requests and responses for document management
 */

import { Response } from "express";
import multer from "multer";

import { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { logger } from "../../../utils/logger.js";

import { documentsService, ServiceError } from "./documents.service.js";

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
 * List documents with filters
 */
export async function listDocuments(req: AuthenticatedRequest, res: Response) {
  try {
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
 * Get document by ID
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
 * Upload/Create a new document
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
 * Update a document
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
 * Delete a document
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
 * Archive a document
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
 * Unarchive a document
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
 * Download a document
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
 * Preview a document (inline viewing)
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
 * Get document statistics
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
