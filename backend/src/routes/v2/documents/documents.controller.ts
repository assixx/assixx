/**
 * Documents v2 Controller
 * Handles HTTP requests and responses for document management

 * tags:
 *   name: Documents v2
 *   description: Document management API v2
 */
import crypto from 'crypto';
import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v7 as uuidv7 } from 'uuid';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import { logger } from '../../../utils/logger.js';
import rootLog from '../logs/logs.service.js';
import {
  DocumentCreateInput,
  DocumentFilters,
  DocumentUpdateInput,
  ServiceError,
  documentsService,
} from './documents.service.js';
import { ALLOWED_CATEGORIES, type DocumentCategory } from './documents.validation.zod.js';

// NEW: Clean document interface (refactored 2025-01-10)
interface Document {
  id: number;
  filename: string;
  category?: string;
  fileSize?: number;
  mimeType?: string;
  accessScope?: 'personal' | 'team' | 'department' | 'company' | 'payroll';
  [key: string]: unknown;
}

// Error message constants
const ERROR_DOCUMENT_ID_REQUIRED = 'Document ID is required';

/**
 * Check if query parameter has a value (not undefined)
 */
function hasQueryParam(value: unknown): value is string {
  return value !== undefined;
}

/**
 * Parse query parameter as integer with default value
 */
function parseQueryInt(value: unknown, defaultValue: number): number {
  if (value === undefined || typeof value !== 'string') return defaultValue;
  const parsed = Number.parseInt(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

// Configure multer for file uploads
const storage = multer.memoryStorage();

// Allowed file types with their MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf', // PDF
  'image/jpeg', // JPG/JPEG
  'image/png', // PNG
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/msword', // DOC
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  'application/vnd.ms-excel', // XLS
] as const;

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Check if file type is allowed
    if (ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      // Multer requires callback-style, cannot use async/await
      cb(null, true);
    } else {
      cb(
        new Error(
          'File type not allowed. Allowed types: PDF, JPG, PNG, DOCX, DOC, XLSX, XLS (max 5MB)',
        ),
      );
    }
  },
});

export const uploadMiddleware = upload.single('document');

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

/**
 * Build hierarchical storage path with UUID
 */
function buildStoragePath(
  tenantId: number,
  category: string,
  uuid: string,
  extension: string,
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  return path.join(
    'uploads',
    'documents',
    tenantId.toString(),
    category,
    year.toString(),
    month,
    `${uuid}${extension}`,
  );
}

/**
 * @param req - The request object
 * @param res - The response object

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
 *         name: isActive
 *         schema:
 *           type: integer
 *           enum: [0, 1, 3, 4]
 *           default: 1
 *         description: Filter by status (0=inactive, 1=active, 3=archived, 4=deleted)
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
// NEW: Parse filters with clean structure (refactored 2025-01-10)
// UPDATED: isArchived removed, using isActive status (2025-12-02)
function parseDocumentFilters(query: AuthenticatedRequest['query']): DocumentFilters {
  const filters: DocumentFilters = {
    // Status: 0=inactive, 1=active, 3=archived, 4=deleted
    isActive: parseQueryInt(query['isActive'], 1),
    page: parseQueryInt(query['page'], 1),
    limit: parseQueryInt(query['limit'], 20),
  };

  // Only add optional properties when they're defined
  const category = query['category'] as string | undefined;
  if (category !== undefined) {
    filters.category = category;
  }

  const accessScope = query['accessScope'] as
    | 'personal'
    | 'team'
    | 'department'
    | 'company'
    | 'payroll'
    | undefined;
  if (accessScope !== undefined) {
    filters.accessScope = accessScope;
  }

  if (hasQueryParam(query['ownerUserId'])) {
    filters.ownerUserId = Number.parseInt(query['ownerUserId']);
  }

  if (hasQueryParam(query['targetTeamId'])) {
    filters.targetTeamId = Number.parseInt(query['targetTeamId']);
  }

  if (hasQueryParam(query['targetDepartmentId'])) {
    filters.targetDepartmentId = Number.parseInt(query['targetDepartmentId']);
  }

  if (hasQueryParam(query['salaryYear'])) {
    filters.salaryYear = Number.parseInt(query['salaryYear']);
  }

  if (hasQueryParam(query['salaryMonth'])) {
    filters.salaryMonth = Number.parseInt(query['salaryMonth']);
  }

  const search = query['search'] as string | undefined;
  if (search !== undefined) {
    filters.search = search;
  }

  return filters;
}

export async function listDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    logger.info('Documents v2: listDocuments called', {
      userId: req.user.id,
      tenantId: req.user.tenant_id,
    });
    const filters = parseDocumentFilters(req.query);

    const result = await documentsService.listDocuments(req.user.id, req.user.tenant_id, filters);

    res.json(successResponse(result));
  } catch (error: unknown) {
    logger.error(`List documents error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to list documents'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/documents/\{id\}:
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
export async function getDocumentById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse('BAD_REQUEST', ERROR_DOCUMENT_ID_REQUIRED));
      return;
    }
    const documentId = Number.parseInt(idParam);

    const document = await documentsService.getDocumentById(
      documentId,
      req.user.id,
      req.user.tenant_id,
    );

    res.json(successResponse(document));
  } catch (error: unknown) {
    logger.error(`Get document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get document'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

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
/**
 * Ensure filename has file extension
 * If user provides "document" but file is "document['pdf']", result will be "document['pdf']"
 */
function ensureFileExtension(userProvidedName: string, originalFilename: string): string {
  const trimmedName = userProvidedName.trim();
  const fileExtension = path.extname(originalFilename); // e.g., ".jpg"

  // If user already provided extension, use as-is
  if (path.extname(trimmedName) !== '') {
    return trimmedName;
  }

  // Otherwise, append the original file extension
  return trimmedName + fileExtension;
}

/**
 * Add optional fields to document input from body
 */
function addOptionalDocumentFields(
  docInput: DocumentCreateInput,
  body: Record<string, string>,
): void {
  if (body['ownerUserId'] !== undefined)
    docInput.ownerUserId = Number.parseInt(body['ownerUserId']);
  if (body['targetTeamId'] !== undefined)
    docInput.targetTeamId = Number.parseInt(body['targetTeamId']);
  if (body['targetDepartmentId'] !== undefined)
    docInput.targetDepartmentId = Number.parseInt(body['targetDepartmentId']);
  if (body['description'] !== undefined) docInput.description = body['description'];
  if (body['salaryYear'] !== undefined) docInput.salaryYear = Number.parseInt(body['salaryYear']);
  if (body['salaryMonth'] !== undefined)
    docInput.salaryMonth = Number.parseInt(body['salaryMonth']);
  if (body['tags'] !== undefined) docInput.tags = JSON.parse(body['tags']) as string[];
  if (body['expiresAt'] !== undefined) docInput.expiresAt = new Date(body['expiresAt']);
}

/**
 * Get user-provided document name with extension
 */
function getUserProvidedName(body: Record<string, string>, originalName: string): string {
  const documentNameValue = body['documentName'];
  if (documentNameValue !== undefined && documentNameValue.trim() !== '') {
    return ensureFileExtension(documentNameValue.trim(), originalName);
  }
  return originalName;
}

/**
 * SECURITY: Validate category against allowlist before path construction
 * This is the critical sanitization point that prevents path traversal
 * @param category - User-provided category value
 * @returns Validated category (type-safe)
 * @throws Error if category is not in allowlist
 */
function validateCategory(category: string | undefined): DocumentCategory {
  if (category === undefined) {
    throw new Error('Category is required');
  }
  // SECURITY: Find the matching value FROM the allowlist constant
  // This breaks the taint chain - we return the constant value, not user input
  const matchedCategory = ALLOWED_CATEGORIES.find(
    (allowed: DocumentCategory) => allowed === category,
  );
  if (matchedCategory === undefined) {
    logger.warn(`Invalid category rejected: ${category}`);
    throw new Error(`Invalid category. Allowed values: ${ALLOWED_CATEGORIES.join(', ')}`);
  }
  // Return the value from ALLOWED_CATEGORIES constant (untainted), not user input
  return matchedCategory;
}

// NEW: Parse document data with clean structure (refactored 2025-01-10)
function parseDocumentData(
  file: Express.Multer.File,
  body: Record<string, string>,
  tenantId: number,
): DocumentCreateInput {
  const metadata = generateFileMetadata(file);

  // SECURITY: Validate category BEFORE using in path construction
  // This ensures only allowlisted values are used in file paths
  const validatedCategory = validateCategory(body['category']);

  // Safe: validatedCategory is now guaranteed to be from ALLOWED_CATEGORIES
  const storagePath = buildStoragePath(
    tenantId,
    validatedCategory,
    metadata.uuid,
    metadata.extension,
  );
  const userProvidedName = getUserProvidedName(body, file.originalname);

  logger.info(
    `Document name mapping: documentName="${body['documentName'] ?? 'undefined'}" → originalName="${userProvidedName}"`,
  );

  const docInput: DocumentCreateInput = {
    filename: `${metadata.uuid}${metadata.extension}`,
    originalName: userProvidedName,
    fileSize: file.size,
    fileContent: file.buffer,
    mimeType: file.mimetype,
    category: validatedCategory,
    accessScope: body['accessScope'] as
      | 'personal'
      | 'team'
      | 'department'
      | 'company'
      | 'payroll'
      | 'blackboard',
    isPublic: body['isPublic'] === 'true',
    fileUuid: metadata.uuid,
    fileChecksum: metadata.checksum,
    filePath: storagePath,
    storageType: 'filesystem',
  };

  addOptionalDocumentFields(docInput, body);
  return docInput;
}

// NEW: Log document upload with clean structure (refactored 2025-01-10)
async function logDocumentUpload(
  document: unknown,
  documentData: DocumentCreateInput,
  req: AuthenticatedRequest,
): Promise<void> {
  const doc = document as Document;
  // doc.filename is required string, so check for empty string only
  const effectiveFilename = doc.filename !== '' ? doc.filename : documentData.filename;

  await rootLog.create({
    tenant_id: req.user.tenant_id,
    user_id: req.user.id,
    action: 'upload',
    entity_type: 'document',
    entity_id: doc.id,
    details: `Hochgeladen: ${effectiveFilename}`,
    new_values: {
      filename: effectiveFilename,
      category: documentData.category,
      file_size: documentData.fileSize,
      mime_type: documentData.mimeType,
      // NEW: Clean access control logging
      access_scope: documentData.accessScope,
      owner_user_id: documentData.ownerUserId,
      target_team_id: documentData.targetTeamId,
      target_department_id: documentData.targetDepartmentId,
      salary_year: documentData.salaryYear,
      salary_month: documentData.salaryMonth,
      uploaded_by: req.user.email,
    },
    ip_address: req.ip ?? req.socket.remoteAddress,
    user_agent: req.get('user-agent'),
    was_role_switched: false,
  });
}

export async function createDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json(errorResponse('BAD_REQUEST', 'No file uploaded'));
      return;
    }

    const body = req.body as Record<string, string>;
    const documentData = parseDocumentData(req.file, body, req.user.tenant_id);

    const document = await documentsService.createDocument(
      documentData,
      req.user.id,
      req.user.tenant_id,
    );

    await logDocumentUpload(document, documentData, req);

    res.status(201).json(successResponse(document));
  } catch (error: unknown) {
    logger.error(`Create document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to create document'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/documents/\{id\}:
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
interface UpdateDocumentBody {
  filename?: string;
  category?: string;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  expiresAt?: string;
}

/**
 * Build update data from request body
 */
function buildDocumentUpdateData(body: UpdateDocumentBody): DocumentUpdateInput {
  const updateData: DocumentUpdateInput = {};
  if (body.filename !== undefined) updateData.filename = body.filename;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.tags !== undefined) updateData.tags = body.tags;
  if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
  if (body.expiresAt !== undefined) updateData.expiresAt = new Date(body.expiresAt);
  return updateData;
}

export async function updateDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse('BAD_REQUEST', ERROR_DOCUMENT_ID_REQUIRED));
      return;
    }
    const documentId = Number.parseInt(idParam);
    const updateData = buildDocumentUpdateData(req.body as UpdateDocumentBody);

    await documentsService.updateDocument(documentId, updateData, req.user.id, req.user.tenant_id);

    res.json(successResponse({ message: 'Document updated successfully' }));
  } catch (error: unknown) {
    logger.error(`Update document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to update document'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/documents/\{id\}:
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
export async function deleteDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse('BAD_REQUEST', ERROR_DOCUMENT_ID_REQUIRED));
      return;
    }
    const documentId = Number.parseInt(idParam);

    // Get document details before deletion for logging
    const document = await documentsService.getDocumentById(
      documentId,
      req.user.id,
      req.user.tenant_id,
    );

    await documentsService.deleteDocument(documentId, req.user.id, req.user.tenant_id);

    const doc = document as unknown as Document | null;
    const recipientType = doc !== null ? (doc['recipientType'] as string | undefined) : undefined;

    // Log document deletion
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'delete',
      entity_type: 'document',
      entity_id: documentId,
      details: `Gelöscht: ${doc?.filename ?? 'unknown'}`,
      old_values: {
        filename: doc?.filename ?? 'unknown',
        category: doc?.category ?? 'unknown',
        file_size: doc?.fileSize ?? 0,
        mime_type: doc?.mimeType ?? 'unknown',
        recipient_type: recipientType ?? 'unknown',
        deleted_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get('user-agent'),
      was_role_switched: false,
    });

    res.json(successResponse({ message: 'Document deleted successfully' }));
  } catch (error: unknown) {
    logger.error(`Delete document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to delete document'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/documents/\{id\}/archive:
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
export async function archiveDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse('BAD_REQUEST', ERROR_DOCUMENT_ID_REQUIRED));
      return;
    }
    const documentId = Number.parseInt(idParam);
    logger.info(`Archiving document ${documentId} for user ${req.user.id}`);

    await documentsService.archiveDocument(documentId, true, req.user.id, req.user.tenant_id);

    res.json(successResponse({ message: 'Document archived successfully' }));
  } catch (error: unknown) {
    logger.error(`Archive document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to archive document'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/documents/\{id\}/unarchive:
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
export async function unarchiveDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse('BAD_REQUEST', ERROR_DOCUMENT_ID_REQUIRED));
      return;
    }
    const documentId = Number.parseInt(idParam);

    await documentsService.archiveDocument(documentId, false, req.user.id, req.user.tenant_id);

    res.json(successResponse({ message: 'Document unarchived successfully' }));
  } catch (error: unknown) {
    logger.error(`Unarchive document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to unarchive document'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/documents/\{id\}/download:
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
export async function downloadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse('BAD_REQUEST', ERROR_DOCUMENT_ID_REQUIRED));
      return;
    }
    const documentId = Number.parseInt(idParam);

    const documentContent = await documentsService.getDocumentContent(
      documentId,
      req.user.id,
      req.user.tenant_id,
    );

    // Set headers for download
    res.setHeader('Content-Type', documentContent.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${documentContent.originalName}"`);
    res.setHeader('Content-Length', documentContent.fileSize.toString());
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

    // Send binary content (use res.end for Buffer to avoid encoding corruption)
    // res.send() would convert Buffer to UTF-8 string, corrupting binary files
    // IMPORTANT: Do NOT specify encoding parameter - Buffer must be sent directly
    res.end(documentContent.content);
  } catch (error: unknown) {
    logger.error(`Download document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to download document'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

 * /api/v2/documents/\{id\}/preview:
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
export async function previewDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params['id'];
    if (idParam === undefined) {
      res.status(400).json(errorResponse('BAD_REQUEST', ERROR_DOCUMENT_ID_REQUIRED));
      return;
    }
    const documentId = Number.parseInt(idParam);

    const documentContent = await documentsService.getDocumentContent(
      documentId,
      req.user.id,
      req.user.tenant_id,
    );

    // Mark document as read (non-blocking - errors are logged but don't fail the request)
    // This ensures "Neu" badge disappears after first preview
    void documentsService.markDocumentAsRead(documentId, req.user.id, req.user.tenant_id);

    // Set headers for inline viewing
    res.setHeader('Content-Type', documentContent.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${documentContent.originalName}"`);
    res.setHeader('Content-Length', documentContent.fileSize.toString());
    res.setHeader('Accept-Ranges', 'bytes'); // Enable partial content support for PDFs
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

    // Send binary content (use res.end for Buffer to avoid encoding corruption)
    // res.send() would convert Buffer to UTF-8 string, corrupting binary PDFs
    // IMPORTANT: Do NOT specify encoding parameter - Buffer must be sent directly
    res.end(documentContent.content);
  } catch (error: unknown) {
    logger.error(`Preview document error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to preview document'));
    }
  }
}

/**
 * @param req - The request object
 * @param res - The response object

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
export async function getDocumentStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const stats = await documentsService.getDocumentStats(req.user.id, req.user.tenant_id);

    res.json(successResponse(stats));
  } catch (error: unknown) {
    logger.error(`Get document stats error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get document stats'));
    }
  }
}

/**
 * GET /api/v2/documents/chat-folders
 * Get chat folders for document explorer
 * Returns conversations where user is participant AND has attachments
 * NEW 2025-12-04: Chat attachment folders for document explorer
 */
export async function getChatFolders(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    logger.info('Documents v2: getChatFolders called', {
      userId: req.user.id,
      tenantId: req.user.tenant_id,
    });

    const folders = await documentsService.getChatFolders(req.user.id, req.user.tenant_id);

    res.json(
      successResponse({
        folders,
        total: folders.length,
      }),
    );
  } catch (error: unknown) {
    logger.error(`Get chat folders error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to get chat folders'));
    }
  }
}

/**
 * POST /api/v2/documents/:id/read
 * Mark a document as read by the current user
 * Updates document_read_status table
 * NEW 2025-12-04: Endpoint for tracking read status
 */
export async function markDocumentAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const documentId = Number.parseInt(req.params['id'] ?? '0', 10);
    if (documentId === 0 || Number.isNaN(documentId)) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', ERROR_DOCUMENT_ID_REQUIRED));
      return;
    }

    await documentsService.markDocumentAsRead(documentId, req.user.id, req.user.tenant_id);

    res.json(successResponse({ success: true }));
  } catch (error: unknown) {
    logger.error(`Mark document as read error: ${(error as Error).message}`);
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to mark document as read'));
    }
  }
}
