/**
 * KVP API v2 Controller
 * HTTP request handlers for Continuous Improvement Process
 */
import crypto from 'crypto';
import { Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { v7 as uuidv7 } from 'uuid';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { errorResponse, paginatedResponse, successResponse } from '../../../utils/apiResponse.js';
import { logger } from '../../../utils/logger.js';
import { getUploadDirectory } from '../../../utils/pathSecurity.js';
import rootLog from '../logs/logs.service.js';
import { kvpService } from './kvp.service.js';
import type {
  CommentData,
  KVPCreateData,
  KVPSuggestion,
  KVPUpdateData,
  PointsData,
} from './kvp.service.js';

// Constants
const USER_AGENT_HEADER = 'user-agent';
const MSG_ID_REQUIRED = 'ID is required';

/**
 * Build hierarchical storage path for KVP attachments
 * Pattern: `uploads/kvp-attachments/{tenantId}/{suggestionId}/{uuid}.ext`
 * This prevents filename collisions and organizes files by suggestion
 */
function buildKvpStoragePath(
  tenantId: number,
  suggestionId: number | string,
  uuid: string,
  extension: string,
): string {
  return path.join(
    getUploadDirectory('kvp'), // uploads/kvp-attachments
    tenantId.toString(),
    suggestionId.toString(),
    `${uuid}${extension}`,
  );
}

/**
 * Generate UUID and file metadata for upload
 */
function generateFileMetadata(file: Express.Multer.File): {
  uuid: string;
  checksum: string;
  extension: string;
} {
  const uuid = uuidv7();
  const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const extension = path.extname(file.originalname).toLowerCase();

  return {
    uuid,
    checksum,
    extension,
  };
}

// Request body interfaces
interface CreateSuggestionBody {
  title: string;
  description: string;
  categoryId: number;
  departmentId?: number | null;
  orgLevel: 'company' | 'department' | 'area' | 'team';
  orgId: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  expectedBenefit?: string;
  estimatedCost?: string;
}

interface UpdateSuggestionBody {
  title?: string;
  description?: string;
  categoryId?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  expectedBenefit?: string;
  estimatedCost?: string;
  actualSavings?: number;
  status?: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  assignedTo?: number;
  rejectionReason?: string;
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
 * @param req - The request object
 * @param res - The response object
 */
export async function getCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const categories = await kvpService.getCategories(req.user.tenant_id);
    res.json(successResponse(categories));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get categories'));
    }
  }
}

/** Filter options for listing suggestions */
interface ListFilters {
  filter?: string;
  status?: string;
  categoryId?: number;
  priority?: string;
  orgLevel?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Build list filters from request query parameters */
function buildListFilters(query: Record<string, unknown>): ListFilters {
  const filters: ListFilters = {};
  if (query['filter'] !== undefined) filters.filter = query['filter'] as string;
  if (query['status'] !== undefined) filters.status = query['status'] as string;
  if (query['categoryId'] !== undefined) {
    filters.categoryId = Number.parseInt(query['categoryId'] as string, 10);
  }
  if (query['priority'] !== undefined) filters.priority = query['priority'] as string;
  if (query['orgLevel'] !== undefined) filters.orgLevel = query['orgLevel'] as string;
  if (query['search'] !== undefined) filters.search = query['search'] as string;
  if (query['page'] !== undefined) filters.page = Number.parseInt(query['page'] as string, 10);
  if (query['limit'] !== undefined) filters.limit = Number.parseInt(query['limit'] as string, 10);
  return filters;
}

/** Build update data from request body */
function buildUpdateData(body: UpdateSuggestionBody): KVPUpdateData {
  const data: KVPUpdateData = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId;
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.expectedBenefit !== undefined) data.expectedBenefit = body.expectedBenefit;
  if (body.estimatedCost !== undefined) data.estimatedCost = body.estimatedCost;
  if (body.actualSavings !== undefined) data.actualSavings = body.actualSavings;
  if (body.status !== undefined) data.status = body.status;
  if (body.assignedTo !== undefined) data.assignedTo = body.assignedTo;
  if (body.rejectionReason !== undefined) data.rejectionReason = body.rejectionReason;
  return data;
}

/** Process a single file for attachment upload */
async function processAttachmentFile(
  file: Express.Multer.File,
  tenantId: number,
  suggestionId: string | number,
  userId: number,
  role: string,
): Promise<unknown> {
  const metadata = generateFileMetadata(file);
  const storagePath = buildKvpStoragePath(
    tenantId,
    suggestionId,
    metadata.uuid,
    metadata.extension,
  );
  const directory = path.dirname(storagePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- storagePath is generated by buildKvpStoragePath() which uses validated paths
  await fs.mkdir(directory, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- storagePath is generated by buildKvpStoragePath() which uses validated paths
  await fs.writeFile(storagePath, file.buffer);
  logger.info(
    `KVP attachment saved: ${storagePath} (UUID: ${metadata.uuid}, Size: ${file.size} bytes)`,
  );
  return await kvpService.addAttachment(
    suggestionId,
    {
      fileName: file.originalname,
      filePath: storagePath,
      fileType: file.mimetype,
      fileSize: file.size,
      uploadedBy: userId,
      fileUuid: metadata.uuid,
      fileChecksum: metadata.checksum,
    },
    tenantId,
    userId,
    role,
  );
}

/** Log attachment upload action */
async function logAttachmentUpload(
  req: AuthenticatedRequest,
  suggestionId: string | number,
  files: Express.Multer.File[],
): Promise<void> {
  await rootLog.create({
    tenant_id: req.user.tenant_id,
    user_id: req.user.id,
    action: 'upload_attachment',
    entity_type: 'kvp_suggestion',
    entity_id: typeof suggestionId === 'number' ? suggestionId : 0,
    details: `Anhänge hochgeladen: ${files.map((f: Express.Multer.File) => f.originalname).join(', ')}`,
    new_values: {
      files_count: files.length,
      file_names: files.map((f: Express.Multer.File) => f.originalname).join(', '),
      total_size: files.reduce((sum: number, f: Express.Multer.File) => sum + f.size, 0),
      uploaded_by: req.user.email,
    },
    ip_address: req.ip ?? req.socket.remoteAddress,
    user_agent: req.get(USER_AGENT_HEADER),
    was_role_switched: false,
  });
}

/** Log share/unshare action */
async function logShareAction(
  req: AuthenticatedRequest,
  suggestionId: string | number,
  action: 'share' | 'unshare',
  details: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
): Promise<void> {
  await rootLog.create({
    tenant_id: req.user.tenant_id,
    user_id: req.user.id,
    action,
    entity_type: 'kvp_suggestion',
    entity_id: typeof suggestionId === 'number' ? suggestionId : 0,
    details,
    old_values: oldValues,
    new_values: newValues,
    ip_address: req.ip ?? req.socket.remoteAddress,
    user_agent: req.get(USER_AGENT_HEADER),
    was_role_switched: false,
  });
}

/** Log KVP suggestion update */
async function logKvpUpdate(
  req: AuthenticatedRequest,
  suggestionId: string | number,
  data: KVPUpdateData,
  oldSuggestion: KVPSuggestion | null,
): Promise<void> {
  await rootLog.create({
    tenant_id: req.user.tenant_id,
    user_id: req.user.id,
    action: 'update',
    entity_type: 'kvp_suggestion',
    entity_id: typeof suggestionId === 'number' ? suggestionId : 0,
    details: `Aktualisiert: ${data.title ?? 'KVP-Vorschlag'}`,
    old_values: {
      title: oldSuggestion?.title,
      description: oldSuggestion?.description,
      status: oldSuggestion?.status,
      priority: oldSuggestion?.priority,
      estimated_cost: oldSuggestion?.estimatedCost,
      actual_savings: oldSuggestion?.actualSavings,
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
    user_agent: req.get(USER_AGENT_HEADER),
    was_role_switched: false,
  });
}

/**
 * List KVP suggestions with pagination and filters
 * @param req - The request object
 * @param res - The response object
 */
export async function listSuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters = buildListFilters(req.query as Record<string, unknown>);
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
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to list suggestions'));
    }
  }
}

/**
 * Get suggestion by ID or UUID (Dual-ID support for transition period)
 * Accepts both numeric ID and UUIDv7 string in req.params['id']
 * @param req - The request object (expects req.params['id'] as numeric ID or UUID string)
 * @param res - The response object
 */
export async function getSuggestionById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // NEW: Pass id as-is (string or number) - Zod validation already handled UUID vs numeric ID
    const id = req.params['id'];
    if (id === undefined) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', MSG_ID_REQUIRED));
      return;
    }

    const suggestion = await kvpService.getSuggestionById(
      id,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    res.json(successResponse(suggestion));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get suggestion'));
    }
  }
}

/**
 * Create a new KVP suggestion
 * @param req - The request object
 * @param res - The response object
 */
export async function createSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const body = req.body as CreateSuggestionBody;
    // Build data object conditionally to satisfy exactOptionalPropertyTypes
    const data: KVPCreateData = {
      title: body.title,
      description: body.description,
      categoryId: body.categoryId,
      orgLevel: body.orgLevel,
      orgId: body.orgId,
    };

    // Add optional fields only if they are defined
    if (body.departmentId !== undefined) {
      data.departmentId = body.departmentId;
    }
    if (body.priority !== undefined) {
      data.priority = body.priority;
    }
    if (body.expectedBenefit !== undefined) {
      data.expectedBenefit = body.expectedBenefit;
    }
    if (body.estimatedCost !== undefined) {
      data.estimatedCost = body.estimatedCost;
    }

    const suggestion = await kvpService.createSuggestion(data, req.user.tenant_id, req.user.id);

    // Log KVP suggestion creation
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'create',
      entity_type: 'kvp_suggestion',
      entity_id: (suggestion as unknown as KVPSuggestion).id,
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
      user_agent: req.get(USER_AGENT_HEADER),
      was_role_switched: false,
    });

    res.status(201).json(successResponse(suggestion));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to create suggestion'));
    }
  }
}

/**
 * Update a KVP suggestion
 * @param req - The request object
 * @param res - The response object
 */
export async function updateSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const suggestionId = req.params['id'];
    if (suggestionId === undefined) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', MSG_ID_REQUIRED));
      return;
    }

    const data = buildUpdateData(req.body as UpdateSuggestionBody);
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

    await logKvpUpdate(req, suggestionId, data, oldSuggestion as KVPSuggestion | null);
    res.json(successResponse(suggestion));
  } catch (error: unknown) {
    console.error('[updateSuggestion] Error:', error);
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to update suggestion'));
    }
  }
}

/**
 * Delete a KVP suggestion
 * @param req - The request object
 * @param res - The response object
 */
export async function deleteSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // NEW: Pass id as-is (string or number) - Zod validation already handled UUID vs numeric ID
    const suggestionId = req.params['id'];
    if (suggestionId === undefined) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', MSG_ID_REQUIRED));
      return;
    }

    // Get suggestion data before deletion for logging
    const deletedSuggestion = await kvpService.getSuggestionById(
      suggestionId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    await kvpService.deleteSuggestion(suggestionId, req.user.tenant_id, req.user.id, req.user.role);

    // Log KVP suggestion deletion
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'delete',
      entity_type: 'kvp_suggestion',
      entity_id: typeof suggestionId === 'number' ? suggestionId : 0, // TODO: Update log model for UUID support
      details: `Gelöscht: ${String((deletedSuggestion as KVPSuggestion | null)?.title)}`,
      old_values: {
        title: (deletedSuggestion as KVPSuggestion | null)?.title,
        description: (deletedSuggestion as KVPSuggestion | null)?.description,
        status: (deletedSuggestion as KVPSuggestion | null)?.status,
        priority: (deletedSuggestion as KVPSuggestion | null)?.priority,
        deleted_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get(USER_AGENT_HEADER),
      was_role_switched: false,
    });

    res.json(successResponse({ message: 'Suggestion deleted successfully' }));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to delete suggestion'));
    }
  }
}

/**
 * Get comments for a suggestion
 * @param req - The request object
 * @param res - The response object
 */
export async function getComments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // NEW: Support both UUID and numeric ID (validated by Zod)
    const id = req.params['id'];
    if (id === undefined) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', MSG_ID_REQUIRED));
      return;
    }

    const comments = await kvpService.getComments(
      id,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    res.json(successResponse(comments));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get comments'));
    }
  }
}

/**
 * Add a comment to a suggestion
 * @param req - The request object
 * @param res - The response object
 */
export async function addComment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // NEW: Pass id as-is (string or number) - Zod validation already handled UUID vs numeric ID
    const suggestionId = req.params['id'];
    if (suggestionId === undefined) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', MSG_ID_REQUIRED));
      return;
    }

    const body = req.body as AddCommentBody;
    // Build data object conditionally to satisfy exactOptionalPropertyTypes
    const data: CommentData = {
      comment: body.comment,
    };

    if (body.isInternal !== undefined) {
      data.isInternal = body.isInternal;
    }

    const comment = await kvpService.addComment(
      suggestionId,
      data,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    // Log comment addition - use resolved numeric ID from service response
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'add_comment',
      entity_type: 'kvp_suggestion',
      entity_id: comment.suggestionId as number,
      details: `Kommentar hinzugefügt`,
      new_values: {
        comment: data.comment,
        is_internal: data.isInternal,
        comment_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get(USER_AGENT_HEADER),
      was_role_switched: false,
    });

    res.status(201).json(successResponse(comment));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to add comment'));
    }
  }
}

/**
 * Get attachments for a suggestion
 * @param req - The request object
 * @param res - The response object
 */
export async function getAttachments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // NEW: Support both UUID and numeric ID
    const id = req.params['id'];
    if (id === undefined) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', MSG_ID_REQUIRED));
      return;
    }

    const attachments = await kvpService.getAttachments(
      id,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    res.json(successResponse(attachments));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get attachments'));
    }
  }
}

/**
 * Upload attachments to a suggestion
 * NEW: Uses hierarchical storage like document-explorer
 * Pattern: `uploads/kvp-attachments/{tenantId}/{suggestionId}/{uuid}.ext`
 * @param req - The request object
 * @param res - The response object
 */
export async function uploadAttachments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const suggestionId = req.params['id'];
    if (suggestionId === undefined) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', MSG_ID_REQUIRED));
      return;
    }

    const files = req.files;
    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'No files uploaded'));
      return;
    }

    const attachments = await Promise.all(
      files.map((file: Express.Multer.File) =>
        processAttachmentFile(file, req.user.tenant_id, suggestionId, req.user.id, req.user.role),
      ),
    );

    await logAttachmentUpload(req, suggestionId, files);
    res.status(201).json(successResponse(attachments));
  } catch (error: unknown) {
    logger.error(`Upload attachments error: ${(error as Error).message}`);
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to upload attachments'));
    }
  }
}

/**
 * Download an attachment using UUID (secure, non-guessable)
 * @param req - The request object
 * @param res - The response object
 */
export async function downloadAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Use file_uuid instead of sequential ID for security (prevents enumeration attacks)
    const fileUuid = req.params['fileUuid'];
    if (fileUuid === undefined) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'File UUID is required'));
      return;
    }

    const attachment = await kvpService.getAttachment(
      fileUuid,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    // Send the file
    const attachmentData = attachment as { filePath: string; fileName: string };
    res.download(attachmentData.filePath, attachmentData.fileName);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to download attachment'));
    }
  }
}

/**
 * Award points to a user (Admin only)
 * @param req - The request object
 * @param res - The response object
 */
export async function awardPoints(req: AuthenticatedRequest, res: Response): Promise<void> {
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
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'award_points',
      entity_type: 'kvp_points',
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
      user_agent: req.get(USER_AGENT_HEADER),
      was_role_switched: false,
    });

    res.status(201).json(successResponse(points));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to award points'));
    }
  }
}

/**
 * Get user points summary
 * @param req - The request object
 * @param res - The response object
 */
export async function getUserPoints(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userIdParam = req.params['userId'];
    const hasUserIdParam = userIdParam !== undefined && userIdParam !== '';
    const userId = hasUserIdParam ? Number.parseInt(userIdParam, 10) : req.user.id;

    // Users can only see their own points, admins can see all
    if (userId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'root') {
      res.status(403).json(errorResponse('FORBIDDEN', 'You can only view your own points'));
      return;
    }

    const points = await kvpService.getUserPoints(req.user.tenant_id, userId);
    res.json(successResponse(points));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get user points'));
    }
  }
}

/**
 * Unshare a KVP suggestion (reset to team level)
 * @param req - The request object
 * @param res - The response object
 */
export async function unshareSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Only admin and root can unshare suggestions
    if (req.user.role === 'employee') {
      res
        .status(403)
        .json(errorResponse('FORBIDDEN', 'Nur Admins und Root können Teilen rückgängig machen'));
      return;
    }

    // NEW: Pass id as-is (string or number) - Zod validation already handled UUID vs numeric ID
    const suggestionId = req.params['id'];
    if (suggestionId === undefined) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', MSG_ID_REQUIRED));
      return;
    }

    // Get the suggestion to verify it exists and get its team_id
    const suggestion = await kvpService.getSuggestionById(
      suggestionId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    // Check if suggestion has a team_id to revert to
    const teamId = Number(suggestion.teamId);
    if (teamId === 0 || Number.isNaN(teamId)) {
      res
        .status(400)
        .json(errorResponse('BAD_REQUEST', 'Dieser Vorschlag hat kein Team zugeordnet'));
      return;
    }

    await kvpService.unshareSuggestion(suggestionId, req.user.tenant_id, teamId);
    await logShareAction(
      req,
      suggestionId,
      'unshare',
      'Teilen rückgängig gemacht - zurück auf Teamebene',
      { orgLevel: suggestion.orgLevel, orgId: suggestion.orgId },
      { orgLevel: 'team', orgId: suggestion.teamId },
    );
    res.json(successResponse({ message: 'Teilen wurde rückgängig gemacht' }));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to unshare suggestion'));
    }
  }
}

/**
 * Get KVP dashboard statistics
 * @param req - The request object
 * @param res - The response object
 */
export async function getDashboardStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const stats = await kvpService.getDashboardStats(req.user.tenant_id);
    res.json(successResponse(stats));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get dashboard stats'));
    }
  }
}

/**
 * Share a KVP suggestion at specified organization level
 * @param req - The request object
 * @param res - The response object
 */
/**
 * Get German label for organization level
 */
function getOrgLevelLabel(orgLevel: 'company' | 'department' | 'area' | 'team'): string {
  switch (orgLevel) {
    case 'company':
      return 'Firmenebene';
    case 'department':
      return 'Abteilungsebene';
    case 'area':
      return 'Bereichsebene';
    case 'team':
      return 'Teamebene';
  }
}

export async function shareSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Only admin and root can share suggestions
    if (req.user.role === 'employee') {
      res
        .status(403)
        .json(errorResponse('FORBIDDEN', 'Nur Admins und Root können Vorschläge teilen'));
      return;
    }

    // NEW: Pass id as-is (string or number) - Zod validation already handled UUID vs numeric ID
    const suggestionId = req.params['id'];
    if (suggestionId === undefined) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', MSG_ID_REQUIRED));
      return;
    }

    const { orgLevel, orgId } = req.body as {
      orgLevel: 'company' | 'department' | 'area' | 'team';
      orgId: number;
    };

    // Validate that admin has access to the suggestion
    // This will throw if the suggestion doesn't exist or user doesn't have access
    const suggestion = await kvpService.getSuggestionById(
      suggestionId,
      req.user.tenant_id,
      req.user.id,
      req.user.role,
    );

    await kvpService.shareSuggestion(
      suggestionId,
      req.user.tenant_id,
      req.user.id,
      orgLevel,
      orgId,
    );
    await logShareAction(
      req,
      suggestionId,
      'share',
      `Geteilt auf Ebene: ${orgLevel} (ID: ${String(orgId)})`,
      { orgLevel: suggestion.orgLevel, orgId: suggestion.orgId },
      { orgLevel, orgId },
    );
    res.json(
      successResponse({ message: `Vorschlag wurde auf ${getOrgLevelLabel(orgLevel)} geteilt` }),
    );
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const serviceError = error as ServiceError;
      res
        .status(serviceError.statusCode)
        .json(errorResponse(serviceError.code, serviceError.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to share suggestion'));
    }
  }
}
