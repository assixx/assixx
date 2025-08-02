/**
 * Blackboard API v2 Controller
 * HTTP handlers for company announcements and bulletin board
 */

import { Response } from "express";

import { AuthenticatedRequest } from "../../../types/request.types.js";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "../../../utils/apiResponse.js";
import { logger } from "../../../utils/logger.js";
import { ServiceError } from "../../../utils/ServiceError.js";

import { blackboardService } from "./blackboard.service.js";

// Request body interfaces
interface CreateEntryBody {
  title: string;
  content: string;
  orgLevel: "company" | "department" | "team";
  orgId?: number;
  expiresAt?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  color?: string;
  tags?: string[];
  requiresConfirmation?: boolean;
}

interface UpdateEntryBody {
  title?: string;
  content?: string;
  orgLevel?: "company" | "department" | "team";
  orgId?: number;
  expiresAt?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  color?: string;
  status?: "active" | "archived";
  requiresConfirmation?: boolean;
  tags?: string[];
}

interface AttachmentResponse {
  id: number;
  entryId: number;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  uploadedBy: number;
  uploadedAt: string;
  uploaderName?: string;
}

export async function listEntries(req: AuthenticatedRequest, res: Response) {
  try {
    const filters = {
      status: req.query.status as "active" | "archived" | undefined,
      filter: req.query.filter as
        | "all"
        | "company"
        | "department"
        | "team"
        | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
      sortBy: req.query.sortBy as string | undefined,
      sortDir: req.query.sortDir as "ASC" | "DESC" | undefined,
      priority: req.query.priority as string | undefined,
      requiresConfirmation:
        req.query.requiresConfirmation !== undefined
          ? req.query.requiresConfirmation === "true"
          : undefined,
    };

    const result = await blackboardService.listEntries(
      req.user.tenant_id,
      req.user.id,
      filters,
    );

    res.json(
      paginatedResponse(result.entries, {
        currentPage: result.pagination.page,
        totalPages: result.pagination.totalPages,
        pageSize: result.pagination.limit,
        totalItems: result.pagination.total,
      }),
    );
  } catch (error) {
    logger.error("Error listing blackboard entries:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to list entries"));
    }
  }
}

export async function getEntryById(req: AuthenticatedRequest, res: Response) {
  try {
    const entryId = parseInt(req.params.id, 10);
    const entry = await blackboardService.getEntryById(
      entryId,
      req.user.tenant_id,
      req.user.id,
    );

    res.json(successResponse(entry));
  } catch (error) {
    logger.error("Error getting blackboard entry:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get entry"));
    }
  }
}

export async function createEntry(req: AuthenticatedRequest, res: Response) {
  try {
    const body = req.body as CreateEntryBody;
    const entryData = {
      title: body.title,
      content: body.content,
      orgLevel: body.orgLevel,
      orgId: body.orgId,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      priority: body.priority,
      color: body.color,
      tags: body.tags,
      requiresConfirmation: body.requiresConfirmation,
    };

    const entry = await blackboardService.createEntry(
      entryData,
      req.user.tenant_id,
      req.user.id,
    );

    res.status(201).json(successResponse(entry));
  } catch (error) {
    logger.error("Error creating blackboard entry:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to create entry"));
    }
  }
}

export async function updateEntry(req: AuthenticatedRequest, res: Response) {
  try {
    const entryId = parseInt(req.params.id, 10);
    const body = req.body as UpdateEntryBody;
    const updateData = {
      title: body.title,
      content: body.content,
      orgLevel: body.orgLevel,
      orgId: body.orgId,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      priority: body.priority,
      color: body.color,
      status: body.status,
      requiresConfirmation: body.requiresConfirmation,
      tags: body.tags,
    };

    const entry = await blackboardService.updateEntry(
      entryId,
      updateData,
      req.user.tenant_id,
      req.user.id,
    );

    res.json(successResponse(entry));
  } catch (error) {
    logger.error("Error updating blackboard entry:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to update entry"));
    }
  }
}

export async function deleteEntry(req: AuthenticatedRequest, res: Response) {
  try {
    const entryId = parseInt(req.params.id, 10);
    const result = await blackboardService.deleteEntry(
      entryId,
      req.user.tenant_id,
      req.user.id,
    );

    res.json(successResponse(result));
  } catch (error) {
    logger.error("Error deleting blackboard entry:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to delete entry"));
    }
  }
}

export async function archiveEntry(req: AuthenticatedRequest, res: Response) {
  try {
    const entryId = parseInt(req.params.id, 10);
    const entry = await blackboardService.archiveEntry(
      entryId,
      req.user.tenant_id,
      req.user.id,
    );

    res.json(
      successResponse({ message: "Entry archived successfully", entry }),
    );
  } catch (error) {
    logger.error("Error archiving blackboard entry:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to archive entry"));
    }
  }
}

export async function unarchiveEntry(req: AuthenticatedRequest, res: Response) {
  try {
    const entryId = parseInt(req.params.id, 10);
    const entry = await blackboardService.unarchiveEntry(
      entryId,
      req.user.tenant_id,
      req.user.id,
    );

    res.json(
      successResponse({ message: "Entry unarchived successfully", entry }),
    );
  } catch (error) {
    logger.error("Error unarchiving blackboard entry:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to unarchive entry"));
    }
  }
}

export async function confirmEntry(req: AuthenticatedRequest, res: Response) {
  try {
    const entryId = parseInt(req.params.id, 10);
    const result = await blackboardService.confirmEntry(entryId, req.user.id);

    res.json(successResponse(result));
  } catch (error) {
    logger.error("Error confirming blackboard entry:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to confirm entry"));
    }
  }
}

export async function getConfirmationStatus(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const entryId = parseInt(req.params.id, 10);
    const users = await blackboardService.getConfirmationStatus(
      entryId,
      req.user.tenant_id,
    );

    res.json(successResponse(users));
  } catch (error) {
    logger.error("Error getting confirmation status:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(
          errorResponse("SERVER_ERROR", "Failed to get confirmation status"),
        );
    }
  }
}

export async function getDashboardEntries(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 3;
    const entries = await blackboardService.getDashboardEntries(
      req.user.tenant_id,
      req.user.id,
      limit,
    );

    res.json(successResponse(entries));
  } catch (error) {
    logger.error("Error getting dashboard entries:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get dashboard entries"));
    }
  }
}

export async function getAllTags(req: AuthenticatedRequest, res: Response) {
  try {
    const tags = await blackboardService.getAllTags(req.user.tenant_id);
    res.json(successResponse(tags));
  } catch (error) {
    logger.error("Error getting tags:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse("SERVER_ERROR", "Failed to get tags"));
    }
  }
}

export async function uploadAttachment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json(errorResponse("BAD_REQUEST", "No file uploaded"));
      return;
    }

    const entryId = parseInt(req.params.id, 10);

    // Check if entry exists and user has access
    await blackboardService.getEntryById(
      entryId,
      req.user.tenant_id,
      req.user.id,
    );

    const attachmentData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      filePath: req.file.path,
      uploadedBy: req.user.id,
    };

    const result = await blackboardService.addAttachment(
      entryId,
      attachmentData,
    );
    res.status(201).json(successResponse(result));
  } catch (error) {
    logger.error("Error uploading attachment:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to upload attachment"));
    }
  }
}

export async function getAttachments(req: AuthenticatedRequest, res: Response) {
  try {
    const entryId = parseInt(req.params.id, 10);

    // Check if entry exists and user has access
    await blackboardService.getEntryById(
      entryId,
      req.user.tenant_id,
      req.user.id,
    );

    const attachments = await blackboardService.getEntryAttachments(entryId);
    res.json(successResponse(attachments));
  } catch (error) {
    logger.error("Error getting attachments:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get attachments"));
    }
  }
}

export async function downloadAttachment(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const attachmentId = parseInt(req.params.attachmentId, 10);
    const attachment = (await blackboardService.getAttachmentById(
      attachmentId,
      req.user.tenant_id,
    )) as AttachmentResponse;

    // Send file
    res.download(attachment.filePath, attachment.originalName);
  } catch (error) {
    logger.error("Error downloading attachment:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to download attachment"));
    }
  }
}

export async function deleteAttachment(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const attachmentId = parseInt(req.params.attachmentId, 10);
    const result = await blackboardService.deleteAttachment(
      attachmentId,
      req.user.tenant_id,
    );

    res.json(successResponse(result));
  } catch (error) {
    logger.error("Error deleting attachment:", error);
    if (error instanceof ServiceError) {
      res
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to delete attachment"));
    }
  }
}
