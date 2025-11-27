/**
 * Blackboard API v2 Controller
 * HTTP handlers for company announcements and bulletin board
 * Updated 2025-11-24: Integrated with documents system for attachments
 */
import crypto from 'crypto';
import { Response } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import rootLog from '../../../models/rootLog.js';
import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { errorResponse, paginatedResponse, successResponse } from '../../../utils/apiResponse.js';
import { logger } from '../../../utils/logger.js';
import { documentsService } from '../documents/documents.service.js';
import { blackboardService } from './blackboard.service.js';

// ============================================================================
// Constants
// ============================================================================
const ERR_BAD_REQUEST = 'BAD_REQUEST';
const ERR_SERVER = 'SERVER_ERROR';
const MSG_ENTRY_ID_REQUIRED = 'Entry ID is required';
const MSG_ATTACHMENT_ID_REQUIRED = 'Attachment ID is required';
const MSG_COMMENT_ID_REQUIRED = 'Comment ID is required';

// ============================================================================
// Types
// ============================================================================

/** Entry data for create operations */
interface CreateEntryData {
  title: string;
  content: string;
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  orgLevel?: 'company' | 'department' | 'team' | 'area';
  orgId?: number;
  expiresAt?: Date;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
}

/** Entry data for update operations */
interface UpdateEntryData {
  title?: string;
  content?: string;
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  orgLevel?: 'company' | 'department' | 'team' | 'area';
  orgId?: number;
  expiresAt?: Date;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
  status?: 'active' | 'archived';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse entry ID from request params (supports both numeric and UUID)
 * NOTE: The Zod validation middleware (IdOrUuidSchema) already handles parsing,
 * so req.params['id'] comes pre-parsed as either a string (UUID) or number.
 * This function is kept for type safety and clarity.
 */
function parseEntryId(idParam: string | number): number | string {
  // If already processed by Zod, just return it
  if (typeof idParam === 'number') {
    return idParam;
  }

  // UUIDv7 pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidPattern.test(idParam)) {
    return idParam; // Return UUID as string
  }

  // Parse as numeric ID (fallback)
  return Number.parseInt(idParam, 10);
}

/** Build entry data for create operation from request body */
function buildCreateEntryData(body: CreateEntryBody): CreateEntryData {
  const data: CreateEntryData = { title: body.title, content: body.content };
  if (body.departmentIds !== undefined) data.departmentIds = body.departmentIds;
  if (body.teamIds !== undefined) data.teamIds = body.teamIds;
  if (body.areaIds !== undefined) data.areaIds = body.areaIds;
  if (body.orgLevel !== undefined) data.orgLevel = body.orgLevel;
  if (body.orgId !== undefined) data.orgId = body.orgId;
  if (body.expiresAt !== undefined) data.expiresAt = new Date(body.expiresAt);
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.color !== undefined) data.color = body.color;
  return data;
}

/** Assign basic fields for update operation */
function assignUpdateBasicFields(data: UpdateEntryData, body: UpdateEntryBody): void {
  if (body.title !== undefined) data.title = body.title;
  if (body.content !== undefined) data.content = body.content;
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.color !== undefined) data.color = body.color;
  if (body.status !== undefined) data.status = body.status;
}

/** Assign organization fields for update operation */
function assignUpdateOrgFields(data: UpdateEntryData, body: UpdateEntryBody): void {
  if (body.departmentIds !== undefined) data.departmentIds = body.departmentIds;
  if (body.teamIds !== undefined) data.teamIds = body.teamIds;
  if (body.areaIds !== undefined) data.areaIds = body.areaIds;
  if (body.orgLevel !== undefined) data.orgLevel = body.orgLevel;
  if (body.orgId !== undefined) data.orgId = body.orgId;
  if (body.expiresAt !== undefined) data.expiresAt = new Date(body.expiresAt);
}

/** Build entry data for update operation from request body */
function buildUpdateEntryData(body: UpdateEntryBody): UpdateEntryData {
  const data: UpdateEntryData = {};
  assignUpdateBasicFields(data, body);
  assignUpdateOrgFields(data, body);
  return data;
}

// Request body interfaces
interface CreateEntryBody {
  title: string;
  content: string;
  // Multi-organization support
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  // Legacy fields (backwards compatibility)
  orgLevel?: 'company' | 'department' | 'team' | 'area';
  orgId?: number;
  expiresAt?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
}

interface UpdateEntryBody {
  title?: string;
  content?: string;
  // Multi-organization support
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  // Legacy fields (backwards compatibility)
  orgLevel?: 'company' | 'department' | 'team' | 'area';
  orgId?: number;
  expiresAt?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
  status?: 'active' | 'archived';
}

// REMOVED 2025-11-24: AttachmentResponse interface no longer needed
// Now using documents system directly

interface BlackboardEntry {
  id: number;
  title: string;
  content: string;
  status: string;
  priority: string;
  [key: string]: unknown;
}

/** Filter type for listEntries */
interface ListEntriesFilters {
  status?: 'active' | 'archived';
  filter?: 'all' | 'company' | 'department' | 'team';
  search?: string;
  page: number;
  limit: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  priority?: string;
}

/** Build filters from query params for listEntries */
function buildListFilters(query: AuthenticatedRequest['query']): ListEntriesFilters {
  const filters: ListEntriesFilters = {
    page: query['page'] !== undefined ? Number.parseInt(query['page'] as string, 10) : 1,
    limit: query['limit'] !== undefined ? Number.parseInt(query['limit'] as string, 10) : 10,
  };

  const statusParam = query['status'] as 'active' | 'archived' | undefined;
  if (statusParam !== undefined) filters.status = statusParam;

  const filterParam = query['filter'] as 'all' | 'company' | 'department' | 'team' | undefined;
  if (filterParam !== undefined) filters.filter = filterParam;

  const searchParam = query['search'] as string | undefined;
  if (searchParam !== undefined) filters.search = searchParam;

  const sortByParam = query['sortBy'] as string | undefined;
  if (sortByParam !== undefined) filters.sortBy = sortByParam;

  const sortDirParam = query['sortDir'] as 'ASC' | 'DESC' | undefined;
  if (sortDirParam !== undefined) filters.sortDir = sortDirParam;

  const priorityParam = query['priority'] as string | undefined;
  if (priorityParam !== undefined) filters.priority = priorityParam;

  return filters;
}

/**
 * List blackboard entries with pagination and filters
 * @param req - The request object
 * @param res - The response object
 */
export async function listEntries(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters = buildListFilters(req.query);
    const serviceResult = await blackboardService.listEntries(
      req.user.tenant_id,
      req.user.id,
      filters,
    );

    const result = serviceResult as {
      entries: BlackboardEntry[];
      pagination: { page: number; totalPages: number; limit: number; total: number };
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
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to list entries'));
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
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ENTRY_ID_REQUIRED));
      return;
    }
    const entryId = parseEntryId(idParam); // Supports both numeric and UUID
    const entry = await blackboardService.getEntryById(entryId, req.user.tenant_id, req.user.id);

    res.json(successResponse(entry));
  } catch (error: unknown) {
    logger.error('Error getting blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to get entry'));
    }
  }
}

/**
 * Get full entry details with comments and attachments in one request
 * OPTIMIZATION: Reduces 3 HTTP roundtrips to 1
 * @param req - The request object
 * @param res - The response object
 */
export async function getEntryFull(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ENTRY_ID_REQUIRED));
      return;
    }
    const entryId = parseEntryId(idParam);

    // Fetch entry first to get numeric ID for attachments
    const entry = (await blackboardService.getEntryById(
      entryId,
      req.user.tenant_id,
      req.user.id,
    )) as BlackboardEntry;

    // Parallel fetch comments and attachments
    const [comments, attachments] = await Promise.all([
      blackboardService.getComments(entryId, req.user.tenant_id),
      documentsService.getDocumentsByBlackboardEntry(entry.id, req.user.tenant_id, req.user.id),
    ]);

    res.json(
      successResponse({
        entry,
        comments,
        attachments,
      }),
    );
  } catch (error: unknown) {
    logger.error('Error getting full blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to get entry details'));
    }
  }
}

/** Log blackboard entry creation */
async function logEntryCreation(
  req: AuthenticatedRequest,
  entryId: number,
  entryData: CreateEntryData,
): Promise<void> {
  await rootLog.create({
    tenant_id: req.user.tenant_id,
    user_id: req.user.id,
    action: 'create',
    entity_type: 'blackboard_entry',
    entity_id: entryId,
    details: `Erstellt: ${entryData.title}`,
    new_values: {
      title: entryData.title,
      content: entryData.content,
      org_level: entryData.orgLevel,
      org_id: entryData.orgId,
      priority: entryData.priority,
      expires_at: entryData.expiresAt,
      created_by: req.user.email,
    },
    ip_address: req.ip ?? req.socket.remoteAddress,
    user_agent: req.get('user-agent'),
    was_role_switched: false,
  });
}

/**
 * Create new blackboard entry
 * @param req - The request object
 * @param res - The response object
 */
export async function createEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const entryData = buildCreateEntryData(req.body as CreateEntryBody);
    const entry = await blackboardService.createEntry(entryData, req.user.tenant_id, req.user.id);
    await logEntryCreation(req, (entry as BlackboardEntry).id, entryData);
    res.status(201).json(successResponse(entry));
  } catch (error: unknown) {
    logger.error('Error creating blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to create entry'));
    }
  }
}

/** Log blackboard entry update */
async function logEntryUpdate(
  req: AuthenticatedRequest,
  numericId: number,
  oldEntry: BlackboardEntry,
  updateData: UpdateEntryData,
): Promise<void> {
  await rootLog.create({
    tenant_id: req.user.tenant_id,
    user_id: req.user.id,
    action: 'update',
    entity_type: 'blackboard_entry',
    entity_id: numericId,
    details: `Aktualisiert: ${updateData.title ?? 'Blackboard Eintrag'}`,
    old_values: {
      title: oldEntry.title,
      content: oldEntry.content,
      status: oldEntry.status,
      priority: oldEntry.priority,
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
}

/**
 * Update blackboard entry
 * @param req - The request object
 * @param res - The response object
 */
export async function updateEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ENTRY_ID_REQUIRED));
      return;
    }
    const entryId = parseEntryId(idParam);
    const updateData = buildUpdateEntryData(req.body as UpdateEntryBody);
    const oldEntry = (await blackboardService.getEntryById(
      entryId,
      req.user.tenant_id,
      req.user.id,
    )) as BlackboardEntry;
    const entry = await blackboardService.updateEntry(
      entryId,
      updateData,
      req.user.tenant_id,
      req.user.id,
    );
    const numericId = typeof entryId === 'string' ? oldEntry.id : entryId;
    await logEntryUpdate(req, numericId, oldEntry, updateData);
    res.json(successResponse(entry));
  } catch (error: unknown) {
    logger.error('Error updating blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to update entry'));
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
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ENTRY_ID_REQUIRED));
      return;
    }
    const entryId = parseEntryId(idParam); // Supports both numeric and UUID

    // Get entry data before deletion for logging
    const deletedEntry = await blackboardService.getEntryById(
      entryId,
      req.user.tenant_id,
      req.user.id,
    );

    const result = await blackboardService.deleteEntry(entryId, req.user.tenant_id, req.user.id);

    // Get numeric ID for logging (rootLog requires numeric ID)
    const numericId = (deletedEntry as BlackboardEntry).id;

    // Log blackboard entry deletion
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'delete',
      entity_type: 'blackboard_entry',
      entity_id: numericId,
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
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to delete entry'));
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
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ENTRY_ID_REQUIRED));
      return;
    }
    const entryId = parseEntryId(idParam); // Supports both numeric and UUID
    const entry = await blackboardService.archiveEntry(entryId, req.user.tenant_id, req.user.id);

    // Get numeric ID for logging (rootLog requires numeric ID)
    const numericId = (entry as BlackboardEntry).id;

    // Log blackboard entry archiving
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'archive',
      entity_type: 'blackboard_entry',
      entity_id: numericId,
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
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to archive entry'));
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
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ENTRY_ID_REQUIRED));
      return;
    }
    const entryId = parseEntryId(idParam); // Supports both numeric and UUID
    const entry = await blackboardService.unarchiveEntry(entryId, req.user.tenant_id, req.user.id);

    res.json(successResponse({ message: 'Entry unarchived successfully', entry }));
  } catch (error: unknown) {
    logger.error('Error unarchiving blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to unarchive entry'));
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
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ENTRY_ID_REQUIRED));
      return;
    }
    const entryId = parseEntryId(idParam); // Supports both numeric and UUID
    const result = await blackboardService.confirmEntry(entryId, req.user.id);

    res.json(successResponse(result));
  } catch (error: unknown) {
    logger.error('Error confirming blackboard entry:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to confirm entry'));
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
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ENTRY_ID_REQUIRED));
      return;
    }
    const entryId = parseEntryId(idParam); // Supports both numeric and UUID
    const users = await blackboardService.getConfirmationStatus(entryId, req.user.tenant_id);

    res.json(successResponse(users));
  } catch (error: unknown) {
    logger.error('Error getting confirmation status:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to get confirmation status'));
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
    const limit =
      req.query['limit'] !== undefined ? Number.parseInt(req.query['limit'] as string, 10) : 3;
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
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to get dashboard entries'));
    }
  }
}

/**
 * Upload attachment to blackboard entry
 * NEW 2025-11-24: Uses documents system instead of blackboard_attachments table
 * @param req - The request object
 * @param res - The response object
 */
export async function uploadAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, 'No file uploaded'));
      return;
    }

    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ENTRY_ID_REQUIRED));
      return;
    }
    const entryId = parseEntryId(idParam); // Supports both numeric and UUID

    // Check if entry exists and user has access
    const entry = await blackboardService.getEntryById(entryId, req.user.tenant_id, req.user.id);
    const numericId = (entry as BlackboardEntry).id; // Documents use numeric entry ID

    // Generate UUID and metadata for documents system
    const fileUuid = uuidv4();
    const extension = path.extname(req.file.originalname).toLowerCase();
    const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    // Build hierarchical storage path (like document-explorer)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const storagePath = path.join(
      'uploads',
      'documents',
      req.user.tenant_id.toString(),
      'blackboard',
      year.toString(),
      month,
      `${fileUuid}${extension}`,
    );

    // Create document with blackboard access scope
    const documentData = {
      filename: `${fileUuid}${extension}`,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      fileContent: req.file.buffer,
      mimeType: req.file.mimetype,
      category: 'blackboard',
      accessScope: 'blackboard' as const,
      blackboardEntryId: numericId,
      fileUuid,
      fileChecksum: checksum,
      filePath: storagePath,
      storageType: 'filesystem' as const,
    };

    const document = await documentsService.createDocument(
      documentData,
      req.user.id,
      req.user.tenant_id,
    );

    logger.info(`Blackboard attachment uploaded as document: ${String(document['id'])}`);
    res.status(201).json(successResponse(document));
  } catch (error: unknown) {
    logger.error('Error uploading attachment:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to upload attachment'));
    }
  }
}

/**
 * Get attachments for a blackboard entry
 * NEW 2025-11-24: Uses documents system instead of blackboard_attachments table
 * @param req - The request object
 * @param res - The response object
 */
export async function getAttachments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ENTRY_ID_REQUIRED));
      return;
    }
    const entryId = parseEntryId(idParam); // Supports both numeric and UUID

    // Check if entry exists and user has access
    const entry = await blackboardService.getEntryById(entryId, req.user.tenant_id, req.user.id);
    const numericId = (entry as BlackboardEntry).id; // Documents use numeric entry ID

    // Get documents with blackboard_entry_id = numericId
    const documents = await documentsService.getDocumentsByBlackboardEntry(
      numericId,
      req.user.tenant_id,
      req.user.id,
    );

    res.json(successResponse(documents));
  } catch (error: unknown) {
    logger.error('Error getting attachments:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to get attachments'));
    }
  }
}

/**
 * Download/preview attachment from blackboard entry
 * NEW 2025-11-24: Uses documents system for file retrieval
 * @param req - The request object
 * @param res - The response object
 */
export async function downloadAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const attachmentIdParam = req.params['attachmentId'];
    if (attachmentIdParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ATTACHMENT_ID_REQUIRED));
      return;
    }
    const documentId = Number.parseInt(attachmentIdParam, 10);

    // Get document content via documents service
    const documentContent = await documentsService.getDocumentContent(
      documentId,
      req.user.id,
      req.user.tenant_id,
    );

    // Set headers for download
    res.setHeader('Content-Type', documentContent.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${documentContent.originalName}"`);
    res.setHeader('Content-Length', documentContent.fileSize.toString());
    res.setHeader('Cache-Control', 'private, max-age=3600');

    // Send binary content
    res.end(documentContent.content);
  } catch (error: unknown) {
    logger.error('Error downloading attachment:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to download attachment'));
    }
  }
}

/**
 * Delete attachment from blackboard entry
 * NEW 2025-11-24: Uses documents system for deletion
 * @param req - The request object
 * @param res - The response object
 */
export async function deleteAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const attachmentIdParam = req.params['attachmentId'];
    if (attachmentIdParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ATTACHMENT_ID_REQUIRED));
      return;
    }
    const documentId = Number.parseInt(attachmentIdParam, 10);

    // Delete via documents service
    await documentsService.deleteDocument(documentId, req.user.id, req.user.tenant_id);

    res.json(successResponse({ message: 'Attachment deleted successfully' }));
  } catch (error: unknown) {
    logger.error('Error deleting attachment:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to delete attachment'));
    }
  }
}

/**
 * Preview attachment inline (for modal display)
 * NEW 2025-11-24: Uses documents system for preview
 * @param req - The request object
 * @param res - The response object
 */
export async function previewAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const attachmentIdParam = req.params['attachmentId'];
    if (attachmentIdParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ATTACHMENT_ID_REQUIRED));
      return;
    }
    const documentId = Number.parseInt(attachmentIdParam, 10);

    // Get document content via documents service
    const documentContent = await documentsService.getDocumentContent(
      documentId,
      req.user.id,
      req.user.tenant_id,
    );

    // Set headers for inline viewing
    res.setHeader('Content-Type', documentContent.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${documentContent.originalName}"`);
    res.setHeader('Content-Length', documentContent.fileSize.toString());
    res.setHeader('Accept-Ranges', 'bytes'); // Enable partial content support for PDFs
    res.setHeader('Cache-Control', 'private, max-age=3600');

    // Send binary content
    res.end(documentContent.content);
  } catch (error: unknown) {
    logger.error('Error previewing attachment:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to preview attachment'));
    }
  }
}

/**
 * Download attachment using file UUID (secure URL)
 * NEW 2025-11-26: Like KVP pattern - uses file_uuid for secure, non-guessable URLs
 * @param req - The request object
 * @param res - The response object
 */
export async function downloadByFileUuid(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const fileUuid = req.params['fileUuid'];
    if (fileUuid === undefined || fileUuid === '') {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, 'File UUID is required'));
      return;
    }

    // Get document content by file UUID via documents service
    const documentContent = await documentsService.getDocumentContentByFileUuid(
      fileUuid,
      req.user.id,
      req.user.tenant_id,
    );

    // Set headers for inline viewing (photos in gallery)
    res.setHeader('Content-Type', documentContent.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${documentContent.originalName}"`);
    res.setHeader('Content-Length', documentContent.fileSize.toString());
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=3600');

    // Send binary content
    res.end(documentContent.content);
  } catch (error: unknown) {
    logger.error('Error downloading attachment by fileUuid:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to download attachment'));
    }
  }
}

// ============================================================================
// Comment Handlers (NEW 2025-11-24)
// ============================================================================

interface AddCommentBody {
  comment: string;
  isInternal?: boolean;
}

/**
 * Get comments for a blackboard entry
 * @param req - The request object
 * @param res - The response object
 */
export async function getComments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ENTRY_ID_REQUIRED));
      return;
    }
    const entryId = parseEntryId(idParam); // Supports both numeric and UUID
    const comments = await blackboardService.getComments(entryId, req.user.tenant_id);

    res.json(successResponse(comments));
  } catch (error: unknown) {
    logger.error('Error getting comments:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to get comments'));
    }
  }
}

/**
 * Add a comment to a blackboard entry
 * @param req - The request object
 * @param res - The response object
 */
export async function addComment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_ENTRY_ID_REQUIRED));
      return;
    }
    const entryId = parseEntryId(idParam); // Supports both numeric and UUID
    const body = req.body as AddCommentBody;

    // Only admins/root can create internal comments
    const isInternal =
      body.isInternal === true && (req.user.role === 'admin' || req.user.role === 'root');

    const result = await blackboardService.addComment(
      entryId,
      req.user.id,
      req.user.tenant_id,
      body.comment,
      isInternal,
    );

    res.status(201).json(successResponse(result));
  } catch (error: unknown) {
    logger.error('Error adding comment:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to add comment'));
    }
  }
}

/**
 * Delete a comment from a blackboard entry
 * Admin only - can delete any comment
 * @param req - The request object
 * @param res - The response object
 */
export async function deleteComment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const commentIdParam = req.params['commentId'];
    if (commentIdParam === undefined) {
      res.status(400).json(errorResponse(ERR_BAD_REQUEST, MSG_COMMENT_ID_REQUIRED));
      return;
    }
    const commentId = Number.parseInt(commentIdParam, 10);

    const result = await blackboardService.deleteComment(commentId, req.user.tenant_id);

    res.json(successResponse(result));
  } catch (error: unknown) {
    logger.error('Error deleting comment:', error);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse(ERR_SERVER, 'Failed to delete comment'));
    }
  }
}
