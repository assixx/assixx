/**
 * KVP API v2 Controller
 * HTTP request handlers for Continuous Improvement Process
 */

import { Response } from "express";

import { RootLog } from "../../../models/rootLog.js";
import { AuthenticatedRequest } from "../../../types/request.types.js";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "../../../utils/apiResponse.js";
import { ServiceError } from "../../../utils/ServiceError.js";

import { kvpService } from "./kvp.service.js";
import type {
  KVPCreateData,
  KVPUpdateData,
  KVPSuggestion,
  CommentData,
  PointsData,
} from "./kvp.service.js";

// Request body interfaces
interface CreateSuggestionBody {
  title: string;
  description: string;
  categoryId: number;
  orgLevel: "company" | "department" | "team";
  orgId: number;
  priority?: "low" | "normal" | "high" | "urgent";
  expectedBenefit?: string;
  estimatedCost?: number;
}

interface UpdateSuggestionBody {
  title?: string;
  description?: string;
  categoryId?: number;
  priority?: "low" | "normal" | "high" | "urgent";
  expectedBenefit?: string;
  estimatedCost?: number;
  actualSavings?: number;
  status?:
    | "new"
    | "in_review"
    | "approved"
    | "implemented"
    | "rejected"
    | "archived";
  assignedTo?: number;
}

interface AddCommentBody {
  comment: string;
  isInternal?: boolean;
}

interface AwardPointsBody {
  userId: number;
  suggestionId: number;
  points: number;
  reason: string;
}

/**
 * Get all KVP categories
 */
export async function getCategories(req: AuthenticatedRequest, res: Response) {
  try {
    const categories = await kvpService.getCategories(req.user.tenant_id);
    res.json(successResponse(categories));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get categories"));
    }
  }
}

/**
 * List KVP suggestions with pagination and filters
 */
export async function listSuggestions(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const filters = {
      status: req.query.status as string,
      categoryId: req.query.categoryId
        ? parseInt(req.query.categoryId as string)
        : undefined,
      priority: req.query.priority as string,
      orgLevel: req.query.orgLevel as string,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await kvpService.listSuggestions(
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      filters,
    );

    res.json(
      paginatedResponse(result.suggestions, {
        currentPage: result.pagination.currentPage,
        totalPages: result.pagination.totalPages,
        pageSize: result.pagination.pageSize,
        totalItems: result.pagination.totalItems,
      }),
    );
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to list suggestions"));
    }
  }
}

/**
 * Get a specific KVP suggestion by ID
 */
export async function getSuggestionById(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const suggestionId = parseInt(req.params.id);
    const suggestion = await kvpService.getSuggestionById(
      suggestionId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    res.json(successResponse(suggestion));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get suggestion"));
    }
  }
}

/**
 * Create a new KVP suggestion
 */
export async function createSuggestion(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const body = req.body as CreateSuggestionBody;
    const data: KVPCreateData = {
      title: body.title,
      description: body.description,
      categoryId: body.categoryId,
      orgLevel: body.orgLevel,
      orgId: body.orgId,
      priority: body.priority,
      expectedBenefit: body.expectedBenefit,
      estimatedCost: body.estimatedCost,
    };
    const suggestion = await kvpService.createSuggestion(
      data,
      req.user.tenant_id,
      req.user.id,
    );

    // Log KVP suggestion creation
    await RootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: "create",
      entity_type: "kvp_suggestion",
      entity_id: (suggestion as KVPSuggestion).id,
      details: `Erstellt: ${data.title}`,
      new_values: {
        title: data.title,
        description: data.description,
        category_id: data.categoryId,
        org_level: data.orgLevel,
        org_id: data.orgId,
        priority: data.priority,
        expected_benefit: data.expectedBenefit,
        estimated_cost: data.estimatedCost,
        created_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get("user-agent"),
      was_role_switched: false,
    });

    res.status(201).json(successResponse(suggestion));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to create suggestion"));
    }
  }
}

/**
 * Update a KVP suggestion
 */
export async function updateSuggestion(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const suggestionId = parseInt(req.params.id);
    const body = req.body as UpdateSuggestionBody;
    const data: KVPUpdateData = {
      title: body.title,
      description: body.description,
      categoryId: body.categoryId,
      priority: body.priority,
      expectedBenefit: body.expectedBenefit,
      estimatedCost: body.estimatedCost,
      actualSavings: body.actualSavings,
      status: body.status,
      assignedTo: body.assignedTo,
    };
    // Get old suggestion data for logging
    const oldSuggestion = await kvpService.getSuggestionById(
      suggestionId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    const suggestion = await kvpService.updateSuggestion(
      suggestionId,
      data,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    // Log KVP suggestion update
    await RootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: "update",
      entity_type: "kvp_suggestion",
      entity_id: suggestionId,
      details: `Aktualisiert: ${data.title}`,
      old_values: {
        title: (oldSuggestion as KVPSuggestion | null)?.title,
        description: (oldSuggestion as KVPSuggestion | null)?.description,
        status: (oldSuggestion as KVPSuggestion | null)?.status,
        priority: (oldSuggestion as KVPSuggestion | null)?.priority,
        estimated_cost: (oldSuggestion as KVPSuggestion | null)?.estimatedCost,
        actual_savings: (oldSuggestion as KVPSuggestion | null)?.actualSavings,
      },
      new_values: {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        estimated_cost: data.estimatedCost,
        actual_savings: data.actualSavings,
        updated_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get("user-agent"),
      was_role_switched: false,
    });

    res.json(successResponse(suggestion));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to update suggestion"));
    }
  }
}

/**
 * Delete a KVP suggestion
 */
export async function deleteSuggestion(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const suggestionId = parseInt(req.params.id);

    // Get suggestion data before deletion for logging
    const deletedSuggestion = await kvpService.getSuggestionById(
      suggestionId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    await kvpService.deleteSuggestion(
      suggestionId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    // Log KVP suggestion deletion
    await RootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: "delete",
      entity_type: "kvp_suggestion",
      entity_id: suggestionId,
      details: `Gelöscht: ${(deletedSuggestion as KVPSuggestion | null)?.title}`,
      old_values: {
        title: (deletedSuggestion as KVPSuggestion | null)?.title,
        description: (deletedSuggestion as KVPSuggestion | null)?.description,
        status: (deletedSuggestion as KVPSuggestion | null)?.status,
        priority: (deletedSuggestion as KVPSuggestion | null)?.priority,
        deleted_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get("user-agent"),
      was_role_switched: false,
    });

    res.json(successResponse({ message: "Suggestion deleted successfully" }));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to delete suggestion"));
    }
  }
}

/**
 * Get comments for a suggestion
 */
export async function getComments(req: AuthenticatedRequest, res: Response) {
  try {
    const suggestionId = parseInt(req.params.id);
    const comments = await kvpService.getComments(
      suggestionId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    res.json(successResponse(comments));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get comments"));
    }
  }
}

/**
 * Add a comment to a suggestion
 */
export async function addComment(req: AuthenticatedRequest, res: Response) {
  try {
    const suggestionId = parseInt(req.params.id);
    const body = req.body as AddCommentBody;
    const data: CommentData = {
      comment: body.comment,
      isInternal: body.isInternal,
    };
    const comment = await kvpService.addComment(
      suggestionId,
      data,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    // Log comment addition
    await RootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: "add_comment",
      entity_type: "kvp_suggestion",
      entity_id: suggestionId,
      details: `Kommentar hinzugefügt`,
      new_values: {
        comment: data.comment,
        is_internal: data.isInternal,
        comment_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get("user-agent"),
      was_role_switched: false,
    });

    res.status(201).json(successResponse(comment));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to add comment"));
    }
  }
}

/**
 * Get attachments for a suggestion
 */
export async function getAttachments(req: AuthenticatedRequest, res: Response) {
  try {
    const suggestionId = parseInt(req.params.id);
    const attachments = await kvpService.getAttachments(
      suggestionId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    res.json(successResponse(attachments));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get attachments"));
    }
  }
}

/**
 * Upload attachments to a suggestion
 */
export async function uploadAttachments(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const suggestionId = parseInt(req.params.id);
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res
        .status(400)
        .json(errorResponse("VALIDATION_ERROR", "No files uploaded"));
      return;
    }

    const attachments = await Promise.all(
      files.map((file) =>
        kvpService.addAttachment(
          suggestionId,
          {
            fileName: file.filename,
            filePath: file.path,
            fileType: file.mimetype,
            fileSize: file.size,
            uploadedBy: req.user.id,
          },
          req.user.tenant_id,
          req.user.id,
          req.user.role,
        ),
      ),
    );

    // Log attachment upload
    await RootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: "upload_attachment",
      entity_type: "kvp_suggestion",
      entity_id: suggestionId,
      details: `Anhänge hochgeladen: ${files.map((f) => f.filename).join(", ")}`,
      new_values: {
        files_count: files.length,
        file_names: files.map((f) => f.filename).join(", "),
        total_size: files.reduce((sum, f) => sum + f.size, 0),
        uploaded_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get("user-agent"),
      was_role_switched: false,
    });

    res.status(201).json(successResponse(attachments));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to upload attachments"));
    }
  }
}

/**
 * Download an attachment
 */
export async function downloadAttachment(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const attachmentId = parseInt(req.params.attachmentId);
    const attachment = await kvpService.getAttachment(
      attachmentId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    // Send the file
    const attachmentData = attachment as { filePath: string; fileName: string };
    res.download(attachmentData.filePath, attachmentData.fileName);
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to download attachment"));
    }
  }
}

/**
 * Award points to a user (Admin only)
 */
export async function awardPoints(req: AuthenticatedRequest, res: Response) {
  try {
    const body = req.body as AwardPointsBody;
    const data: PointsData = {
      userId: body.userId,
      suggestionId: body.suggestionId,
      points: body.points,
      reason: body.reason,
    };
    const points = await kvpService.awardPoints(
      data,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    // Log points awarding
    await RootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: "award_points",
      entity_type: "kvp_points",
      entity_id: data.suggestionId,
      details: `Punkte vergeben: ${data.points} Punkte`,
      new_values: {
        user_id: data.userId,
        suggestion_id: data.suggestionId,
        points: data.points,
        reason: data.reason,
        awarded_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get("user-agent"),
      was_role_switched: false,
    });

    res.status(201).json(successResponse(points));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to award points"));
    }
  }
}

/**
 * Get user points summary
 */
export async function getUserPoints(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.params.userId
      ? parseInt(req.params.userId)
      : req.user.id;

    // Users can only see their own points, admins can see all
    if (
      userId !== req.user.id &&
      req.user.role !== "admin" &&
      req.user.role !== "root"
    ) {
      res
        .status(403)
        .json(errorResponse("FORBIDDEN", "You can only view your own points"));
      return;
    }

    const points = await kvpService.getUserPoints(req.user.tenant_id, userId);
    res.json(successResponse(points));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get user points"));
    }
  }
}

/**
 * Get KVP dashboard statistics
 */
export async function getDashboardStats(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const stats = await kvpService.getDashboardStats(req.user.tenant_id);
    res.json(successResponse(stats));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode ?? 500)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res
        .status(500)
        .json(errorResponse("SERVER_ERROR", "Failed to get dashboard stats"));
    }
  }
}
