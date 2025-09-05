/**
 * Blackboard API v2 Controller
 * HTTP handlers for company announcements and bulletin board
 */
import { Response } from 'express';

import rootLog from '../../../models/rootLog';
import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { errorResponse, paginatedResponse, successResponse } from '../../../utils/apiResponse.js';
import { logger } from '../../../utils/logger.js';
import { blackboardService } from './blackboard.service.js';

// Request body interfaces
interface CreateEntryBody {
  title: string;
  content: string;
  orgLevel: 'company' | 'department' | 'team';
  orgId?: number;
  expiresAt?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
  tags?: string[];
  requiresConfirmation?: boolean;
}

interface UpdateEntryBody {
  title?: string;
  content?: string;
  orgLevel?: 'company' | 'department' | 'team';
  orgId?: number;
  expiresAt?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
  status?: 'active' | 'archived';
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

interface BlackboardEntry {
  id: number;
  title: string;
  content: string;
  status: string;
  priority: string;
  [key: string]: unknown;
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function listEntries(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters = {
      status: req.query.status as 'active' | 'archived' | undefined,
      filter: req.query.filter as 'all' | 'company' | 'department' | 'team' | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page !== undefined ? Number.parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit !== undefined ? Number.parseInt(req.query.limit as string, 10) : 10,
      sortBy: req.query.sortBy as string | undefined,
      sortDir: req.query.sortDir as 'ASC' | 'DESC' | undefined,
      priority: req.query.priority as string | undefined,
      requiresConfirmation:
        req.query.requiresConfirmation !== undefined ?
          req.query.requiresConfirmation === 'true'
        : undefined,
    };

    const serviceResult = await blackboardService.listEntries(
      req.user.tenant_id,
      req.user.id,
      filters,
    );

    // Type assertion to satisfy ESLint
    const result = serviceResult as {
      entries: BlackboardEntry[];
      pagination: {
        page: number;
        totalPages: number;
        limit: number;
        total: number;
      };
    };

    res.json(
      paginatedResponse(result.entries, {
        currentPage: result.pagination.page,
        totalPages: result.pagination.totalPages,
        pageSize: result.pagination.limit,
        totalItems: result.pagination.total,
      }),
    );
  } catch (error: unknown) {
    logger.error('Error listing blackboard entries:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to list entries'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function getEntryById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const entryId = Number.parseInt(req.params.id, 10);
    const entry = await blackboardService.getEntryById(entryId, req.user.tenant_id, req.user.id);

    res.json(successResponse(entry));
  } catch (error: unknown) {
    logger.error('Error getting blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get entry'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function createEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
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

    const entry = await blackboardService.createEntry(entryData, req.user.tenant_id, req.user.id);

    // Log blackboard entry creation
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'create',
      entity_type: 'blackboard_entry',
      entity_id: (entry as BlackboardEntry).id,
      details: `Erstellt: ${entryData.title}`,
      new_values: {
        title: entryData.title,
        content: entryData.content,
        org_level: entryData.orgLevel,
        org_id: entryData.orgId,
        priority: entryData.priority,
        expires_at: entryData.expiresAt,
        requires_confirmation: entryData.requiresConfirmation,
        created_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get('user-agent'),
      was_role_switched: false,
    });

    res.status(201).json(successResponse(entry));
  } catch (error: unknown) {
    logger.error('Error creating blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to create entry'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function updateEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const entryId = Number.parseInt(req.params.id, 10);
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

    // Get old entry data for logging
    const oldEntry = await blackboardService.getEntryById(entryId, req.user.tenant_id, req.user.id);

    const entry = await blackboardService.updateEntry(
      entryId,
      updateData,
      req.user.tenant_id,
      req.user.id,
    );

    // Log blackboard entry update
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'update',
      entity_type: 'blackboard_entry',
      entity_id: entryId,
      details: `Aktualisiert: ${updateData.title ?? 'Blackboard Eintrag'}`,
      old_values: {
        title: (oldEntry as BlackboardEntry).title,
        content: (oldEntry as BlackboardEntry).content,
        status: (oldEntry as BlackboardEntry).status,
        priority: (oldEntry as BlackboardEntry).priority,
      },
      new_values: {
        title: updateData.title,
        content: updateData.content,
        status: updateData.status,
        priority: updateData.priority,
        updated_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get('user-agent'),
      was_role_switched: false,
    });

    res.json(successResponse(entry));
  } catch (error: unknown) {
    logger.error('Error updating blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to update entry'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function deleteEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const entryId = Number.parseInt(req.params.id, 10);

    // Get entry data before deletion for logging
    const deletedEntry = await blackboardService.getEntryById(
      entryId,
      req.user.tenant_id,
      req.user.id,
    );

    const result = await blackboardService.deleteEntry(entryId, req.user.tenant_id, req.user.id);

    // Log blackboard entry deletion
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'delete',
      entity_type: 'blackboard_entry',
      entity_id: entryId,
      details: `Gelöscht: ${(deletedEntry as BlackboardEntry).title}`,
      old_values: {
        title: (deletedEntry as BlackboardEntry).title,
        content: (deletedEntry as BlackboardEntry).content,
        status: (deletedEntry as BlackboardEntry).status,
        priority: (deletedEntry as BlackboardEntry).priority,
        deleted_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get('user-agent'),
      was_role_switched: false,
    });

    res.json(successResponse(result));
  } catch (error: unknown) {
    logger.error('Error deleting blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to delete entry'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function archiveEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const entryId = Number.parseInt(req.params.id, 10);
    const entry = await blackboardService.archiveEntry(entryId, req.user.tenant_id, req.user.id);

    // Log blackboard entry archiving
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'archive',
      entity_type: 'blackboard_entry',
      entity_id: entryId,
      details: `Archiviert: Schwarzes Brett Eintrag`,
      new_values: {
        status: 'archived',
        archived_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get('user-agent'),
      was_role_switched: false,
    });

    res.json(successResponse({ message: 'Entry archived successfully', entry }));
  } catch (error: unknown) {
    logger.error('Error archiving blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to archive entry'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function unarchiveEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const entryId = Number.parseInt(req.params.id, 10);
    const entry = await blackboardService.unarchiveEntry(entryId, req.user.tenant_id, req.user.id);

    res.json(successResponse({ message: 'Entry unarchived successfully', entry }));
  } catch (error: unknown) {
    logger.error('Error unarchiving blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to unarchive entry'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function confirmEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const entryId = Number.parseInt(req.params.id, 10);
    const result = await blackboardService.confirmEntry(entryId, req.user.id);

    res.json(successResponse(result));
  } catch (error: unknown) {
    logger.error('Error confirming blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to confirm entry'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function getConfirmationStatus(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const entryId = Number.parseInt(req.params.id, 10);
    const users = await blackboardService.getConfirmationStatus(entryId, req.user.tenant_id);

    res.json(successResponse(users));
  } catch (error: unknown) {
    logger.error('Error getting confirmation status:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get confirmation status'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function getDashboardEntries(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 3;
    const entries = await blackboardService.getDashboardEntries(
      req.user.tenant_id,
      req.user.id,
      limit,
    );

    res.json(successResponse(entries));
  } catch (error: unknown) {
    logger.error('Error getting dashboard entries:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get dashboard entries'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function getAllTags(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const tags = await blackboardService.getAllTags(req.user.tenant_id);
    res.json(successResponse(tags));
  } catch (error: unknown) {
    logger.error('Error getting tags:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get tags'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function uploadAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json(errorResponse('BAD_REQUEST', 'No file uploaded'));
      return;
    }

    const entryId = Number.parseInt(req.params.id, 10);

    // Check if entry exists and user has access
    await blackboardService.getEntryById(entryId, req.user.tenant_id, req.user.id);

    const attachmentData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      filePath: req.file.path,
      uploadedBy: req.user.id,
    };

    const result = await blackboardService.addAttachment(entryId, attachmentData);
    res.status(201).json(successResponse(result));
  } catch (error: unknown) {
    logger.error('Error uploading attachment:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to upload attachment'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function getAttachments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const entryId = Number.parseInt(req.params.id, 10);

    // Check if entry exists and user has access
    await blackboardService.getEntryById(entryId, req.user.tenant_id, req.user.id);

    const attachments = await blackboardService.getEntryAttachments(entryId);
    res.json(successResponse(attachments));
  } catch (error: unknown) {
    logger.error('Error getting attachments:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get attachments'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function downloadAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const attachmentId = Number.parseInt(req.params.attachmentId, 10);
    const attachment = (await blackboardService.getAttachmentById(
      attachmentId,
      req.user.tenant_id,
    )) as unknown as AttachmentResponse;

    // Send file
    res.download(attachment.filePath, attachment.originalName);
  } catch (error: unknown) {
    logger.error('Error downloading attachment:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to download attachment'));
    }
  }
}

/**
 *
 * @param req - The request object
 * @param res - The response object
 */
export async function deleteAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const attachmentId = Number.parseInt(req.params.attachmentId, 10);
    const result = await blackboardService.deleteAttachment(attachmentId, req.user.tenant_id);

    res.json(successResponse(result));
  } catch (error: unknown) {
    logger.error('Error deleting attachment:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to delete attachment'));
    }
  }
}
