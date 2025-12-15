/**
 * Documents v2 Service Layer
 * Handles all business logic for document management
 */
import fs from 'fs/promises';
import path from 'path';

import { dbToApi } from '../../../utils/fieldMapping.js';
import { logger } from '../../../utils/logger.js';
import { getEntryById as getBlackboardEntry } from '../blackboard/blackboard.model.js';
// Model classes are exported as PascalCase objects for backward compatibility
// eslint-disable-next-line @typescript-eslint/naming-convention
import Department from '../departments/department.model.js';
// eslint-disable-next-line @typescript-eslint/naming-convention
import Team from '../teams/team.model.js';
// eslint-disable-next-line @typescript-eslint/naming-convention
import User from '../users/model/index.js';
// eslint-disable-next-line @typescript-eslint/naming-convention
import Document, { DbDocument, DocumentUpdateData } from './document.model.js';
import { ALLOWED_CATEGORIES, DocumentCategory } from './documents.validation.zod.js';

// Error constants
const ERROR_CODES = {
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;

// Error messages
const ERROR_MESSAGES = {
  USER_NOT_FOUND: 'User not found',
  DOCUMENT_NOT_FOUND: 'Document not found',
} as const;

/**
 *
 */
export class ServiceError extends Error {
  /**
   *
   * @param code - The code parameter
   * @param message - The message parameter
   * @param statusCode - The statusCode parameter
   * @param details - The details parameter
   */
  constructor(
    public code: string,
    public override message: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// NEW: Clean filter structure (refactored 2025-01-10)
// Updated 2025-11-24: Added 'blackboard' accessScope and blackboardEntryId filter
// Updated 2025-12-02: Unified is_active status (0=inactive, 1=active, 3=archived, 4=deleted)
// Updated 2025-12-03: Added 'chat' accessScope and conversationId filter
export interface DocumentFilters {
  category?: string;
  accessScope?: 'personal' | 'team' | 'department' | 'company' | 'payroll' | 'blackboard' | 'chat';
  ownerUserId?: number;
  targetTeamId?: number;
  targetDepartmentId?: number;
  salaryYear?: number;
  salaryMonth?: number;
  blackboardEntryId?: number;
  conversationId?: number; // NEW 2025-12-03: For chat attachments
  isActive?: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  search?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

// NEW: Clean create input structure (refactored 2025-01-10)
// Updated 2025-11-24: Added 'blackboard' accessScope and blackboardEntryId
// Updated 2025-12-03: Added 'chat' accessScope and conversationId
export interface DocumentCreateInput {
  filename: string;
  originalName: string;
  fileSize: number;
  fileContent: Buffer;
  mimeType: string;
  category: string;
  // NEW: Clean access control (updated 2025-12-03: added 'chat')
  accessScope: 'personal' | 'team' | 'department' | 'company' | 'payroll' | 'blackboard' | 'chat';
  ownerUserId?: number;
  targetTeamId?: number;
  targetDepartmentId?: number;
  description?: string;
  // NEW: Payroll fields
  salaryYear?: number;
  salaryMonth?: number;
  // NEW: Blackboard reference (2025-11-24)
  blackboardEntryId?: number;
  // NEW: Chat/Conversation reference (2025-12-03)
  conversationId?: number;
  tags?: string[];
  isPublic?: boolean;
  expiresAt?: Date;
  // UUID-based storage
  fileUuid?: string;
  fileChecksum?: string;
  filePath?: string;
  storageType?: 'database' | 'filesystem' | 's3';
}

export interface DocumentUpdateInput {
  filename?: string;
  category?: string;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  expiresAt?: Date;
}

export interface DocumentListResponse {
  documents: Record<string, unknown>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Interface for document creation data */
// Updated 2025-12-03: Added 'chat' accessScope and conversationId
interface DocumentCreateData {
  tenant_id: number;
  accessScope: 'personal' | 'team' | 'department' | 'company' | 'payroll' | 'blackboard' | 'chat';
  ownerUserId?: number | null;
  targetTeamId?: number | null;
  targetDepartmentId?: number | null;
  category?: string;
  fileName: string;
  originalName?: string;
  fileContent?: Buffer;
  description?: string;
  salaryYear?: number;
  salaryMonth?: number;
  blackboardEntryId?: number | null;
  conversationId?: number | null; // NEW 2025-12-03: Chat attachments
  createdBy?: number;
  tags?: string[];
  mimeType?: string;
  fileUuid?: string;
  fileChecksum?: string;
  storageType?: 'database' | 'filesystem' | 's3';
}

/** Add optional metadata fields to document data */
function addOptionalMetadata(documentData: DocumentCreateData, data: DocumentCreateInput): void {
  if (data.description !== undefined) documentData.description = data.description;
  if (data.tags !== undefined) documentData.tags = data.tags;
  if (data.fileUuid !== undefined) documentData.fileUuid = data.fileUuid;
  if (data.fileChecksum !== undefined) documentData.fileChecksum = data.fileChecksum;
}

/** Build document creation data from input */
// Updated 2025-12-03: Added conversationId for chat attachments
function buildDocumentCreateData(
  data: DocumentCreateInput,
  createdBy: number,
  tenantId: number,
): DocumentCreateData {
  const documentData: DocumentCreateData = {
    tenant_id: tenantId,
    accessScope: data.accessScope,
    fileName: data.filename,
    originalName: data.originalName,
    fileContent: data.fileContent,
    createdBy,
    storageType: data.storageType ?? 'filesystem',
    category: data.category,
    mimeType: data.mimeType,
  };

  const isPersonalOrPayroll = data.accessScope === 'personal' || data.accessScope === 'payroll';
  const ownerUserId = data.ownerUserId ?? (isPersonalOrPayroll ? createdBy : undefined);
  if (ownerUserId !== undefined) documentData.ownerUserId = ownerUserId;
  if (data.targetTeamId !== undefined) documentData.targetTeamId = data.targetTeamId;
  if (data.targetDepartmentId !== undefined)
    documentData.targetDepartmentId = data.targetDepartmentId;
  if (data.salaryYear !== undefined) documentData.salaryYear = data.salaryYear;
  if (data.salaryMonth !== undefined) documentData.salaryMonth = data.salaryMonth;
  if (data.blackboardEntryId !== undefined) documentData.blackboardEntryId = data.blackboardEntryId;
  // NEW 2025-12-03: Chat attachment support
  if (data.conversationId !== undefined) documentData.conversationId = data.conversationId;
  addOptionalMetadata(documentData, data);

  return documentData;
}

/**
 * SECURITY: Validate that a path stays within the allowed base directory
 * Prevents path traversal attacks (CWE-22)
 * @param filePath - The file path to validate (relative)
 * @param baseDir - The base directory that must contain the path
 * @returns true if path is safe, false otherwise
 */
function isPathWithinBase(filePath: string, baseDir: string): boolean {
  const absolutePath = path.resolve(baseDir, filePath);
  const normalizedBase = path.resolve(baseDir);
  return absolutePath.startsWith(normalizedBase + path.sep);
}

/**
 * SECURITY: Validate category is in allowlist
 * Defense in depth - Zod validates first, this is a second check
 * @param category - The category to validate
 * @returns true if category is valid
 */
function isValidCategory(category: string): category is DocumentCategory {
  return ALLOWED_CATEGORIES.includes(category as DocumentCategory);
}

/** Write file to disk for filesystem storage */
async function writeFileToDisk(filePath: string, content: Buffer): Promise<void> {
  const baseDir = process.cwd();
  const absolutePath = path.join(baseDir, filePath);
  const directory = path.dirname(absolutePath);

  // SECURITY: Verify path stays within base directory (defense in depth)
  if (!isPathWithinBase(filePath, baseDir)) {
    logger.error(`Path traversal attempt blocked: ${filePath}`);
    throw new Error('Invalid file path: path traversal detected');
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated via isPathWithinBase() above
  await fs.mkdir(directory, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated via isPathWithinBase() above
  await fs.writeFile(absolutePath, content);
  logger.info(`File written successfully: ${filePath}`);
}

/**
 * Read file content from filesystem with path validation
 * SECURITY: Validates path stays within base directory before reading
 * @param filePath - Relative file path from project root
 * @returns File content as Buffer
 * @throws ServiceError if path traversal detected or file not found
 */
async function readFileFromDisk(filePath: string): Promise<Buffer> {
  const baseDir = process.cwd();

  // SECURITY: Validate path stays within base directory (defense in depth)
  if (!isPathWithinBase(filePath, baseDir)) {
    logger.error(`Path traversal attempt blocked on read: ${filePath}`);
    throw new ServiceError(ERROR_CODES.FORBIDDEN, 'Invalid file path', 403);
  }

  const absolutePath = path.join(baseDir, filePath);

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated via isPathWithinBase() above
    return await fs.readFile(absolutePath);
  } catch (fsError) {
    logger.error(`Failed to read file from filesystem: ${absolutePath}`, fsError);
    throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Document file not found on filesystem', 404);
  }
}

/** Build model filters from input filters */
// Updated 2025-12-03: Added conversationId for chat attachments
function buildModelFilters(
  filters: DocumentFilters | undefined,
  limit: number,
  offset: number,
): DocumentFilters {
  // Default: show active and inactive (exclude archived=3 and deleted=4)
  const modelFilters: DocumentFilters = { isActive: filters?.isActive ?? 1, limit, offset };
  if (filters?.category !== undefined) modelFilters.category = filters.category;
  if (filters?.accessScope !== undefined) modelFilters.accessScope = filters.accessScope;
  if (filters?.ownerUserId !== undefined) modelFilters.ownerUserId = filters.ownerUserId;
  if (filters?.salaryYear !== undefined) modelFilters.salaryYear = filters.salaryYear;
  if (filters?.salaryMonth !== undefined) modelFilters.salaryMonth = filters.salaryMonth;
  if (filters?.blackboardEntryId !== undefined)
    modelFilters.blackboardEntryId = filters.blackboardEntryId;
  // NEW 2025-12-03: Chat attachment filter
  if (filters?.conversationId !== undefined) modelFilters.conversationId = filters.conversationId;
  if (filters?.search !== undefined) modelFilters.search = filters.search;
  return modelFilters;
}

/**
 *
 */
class DocumentsService {
  /**
   * List documents with filters
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   * @param filters - The filter criteria
   */
  async listDocuments(
    userId: number,
    tenantId: number,
    filters?: DocumentFilters,
  ): Promise<DocumentListResponse> {
    try {
      const page = filters?.page ?? 1;
      const limit = filters?.limit ?? 20;
      const offset = (page - 1) * limit;

      const user = await User.findById(userId, tenantId);
      if (!user) {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.USER_NOT_FOUND, 404);
      }

      const modelFilters = buildModelFilters(filters, limit, offset);

      // Get documents based on user role
      const isAdmin = user.role === 'admin' || user.role === 'root';
      const result =
        isAdmin ?
          await Document.findWithFilters(tenantId, modelFilters)
        : await Document.findByEmployeeWithAccess(userId, tenantId, modelFilters);

      const documentsWithStatus = await Promise.all(
        result.documents.map((doc: DbDocument) =>
          this.enrichDocumentWithMetadata(doc, userId, tenantId),
        ),
      );

      return {
        documents: documentsWithStatus,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error listing documents: ${(error as Error).message}`);
      throw new ServiceError(ERROR_CODES.SERVER_ERROR, 'Failed to list documents', 500);
    }
  }

  /**
   * Enrich document with metadata, read status, and URLs
   * Extracted to reduce cognitive complexity
   */
  private async enrichDocumentWithMetadata(
    doc: DbDocument,
    userId: number,
    tenantId: number,
  ): Promise<Record<string, unknown>> {
    const isRead = await Document.isReadByUser(doc.id, userId, tenantId);
    const apiDoc = dbToApi(doc);

    // Parse tags if stored as JSON string
    if (typeof apiDoc['tags'] === 'string') {
      try {
        apiDoc['tags'] = JSON.parse(apiDoc['tags']);
      } catch {
        apiDoc['tags'] = [];
      }
    }

    // Map recipient ID based on recipient type
    const recipientId = this.extractRecipientId(apiDoc);

    // Map fields for frontend compatibility (camelCase)
    return {
      ...apiDoc,
      // Frontend expects: filename = user-facing name, storedFilename = UUID-based
      filename: apiDoc['originalName'] ?? doc.original_name ?? apiDoc['filename'],
      storedFilename: apiDoc['filename'] ?? doc.filename,
      uploadedBy: apiDoc['createdBy'] ?? doc.created_by ?? userId,
      uploaderName: apiDoc['uploadedByName'] ?? doc.uploaded_by_name ?? 'Unbekannt',
      recipientId,
      isRead,
      downloadUrl: `/api/v2/documents/${doc.id}/download`,
      previewUrl: `/api/v2/documents/${doc.id}/preview`,
    };
  }

  /**
   * Extract recipient ID based on access scope
   * NEW: Uses clean access_scope structure (refactored 2025-01-10)
   */
  private extractRecipientId(apiDoc: Record<string, unknown>): number | null {
    const accessScope = apiDoc['accessScope'] as string;

    if (accessScope === 'personal' || accessScope === 'payroll') {
      return typeof apiDoc['ownerUserId'] === 'number' ? apiDoc['ownerUserId'] : null;
    }
    if (accessScope === 'team') {
      return typeof apiDoc['targetTeamId'] === 'number' ? apiDoc['targetTeamId'] : null;
    }
    if (accessScope === 'department') {
      return typeof apiDoc['targetDepartmentId'] === 'number' ? apiDoc['targetDepartmentId'] : null;
    }
    // Company-wide documents have no specific recipient
    return null;
  }

  /**
   * Map null recipient IDs to undefined
   * NEW: Uses clean field names (refactored 2025-01-10)
   */
  private mapRecipientIds(apiDoc: Record<string, unknown>): void {
    if (apiDoc['ownerUserId'] === null) apiDoc['ownerUserId'] = undefined;

    if (apiDoc['targetTeamId'] === null) apiDoc['targetTeamId'] = undefined;

    if (apiDoc['targetDepartmentId'] === null) apiDoc['targetDepartmentId'] = undefined;
  }

  /**
   * Parse tags from string to array
   */
  private parseTags(apiDoc: Record<string, unknown>): void {
    if (typeof apiDoc['tags'] === 'string') {
      try {
        apiDoc['tags'] = JSON.parse(apiDoc['tags']);
      } catch {
        apiDoc['tags'] = [];
      }
    }
  }

  /**
   * Get document by ID
   * @param id - The resource ID
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   * @param shouldMarkAsRead - Whether to mark document as read (default: true, false for upload response)
   */
  async getDocumentById(
    id: number,
    userId: number,
    tenantId: number,
    shouldMarkAsRead: boolean = true,
  ): Promise<Record<string, unknown>> {
    try {
      const document = await Document.findById(id, tenantId);

      // Validate document exists (tenant_id already filtered in query)
      if (document === null) {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.DOCUMENT_NOT_FOUND, 404);
      }

      // Check access permissions
      const hasAccess = await this.checkDocumentAccess(document, userId, tenantId);
      if (!hasAccess) {
        throw new ServiceError(
          ERROR_CODES.FORBIDDEN,
          "You don't have access to this document",
          403,
        );
      }

      // Mark as read only if requested (skip for upload to show "Neu" badge)
      if (shouldMarkAsRead) {
        await Document.markAsRead(id, userId, tenantId);
      }
      const isRead = await Document.isReadByUser(id, userId, tenantId);

      const apiDoc = dbToApi(document);

      // Clean up response data
      this.mapRecipientIds(apiDoc);
      this.parseTags(apiDoc);

      return {
        ...apiDoc,
        isRead,
        downloadUrl: `/api/v2/documents/${document.id}/download`,
        previewUrl: `/api/v2/documents/${document.id}/preview`,
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error getting document ${id}: ${(error as Error).message}`);
      throw new ServiceError(ERROR_CODES.SERVER_ERROR, 'Failed to get document', 500);
    }
  }

  /**
   * Create a new document
   * @param data - The data object
   * @param createdBy - The createdBy parameter
   * @param tenantId - The tenant ID
   */
  async createDocument(
    data: DocumentCreateInput,
    createdBy: number,
    tenantId: number,
  ): Promise<Record<string, unknown>> {
    try {
      // SECURITY: Validate category (defense in depth - Zod validates first)
      if (!isValidCategory(data.category)) {
        logger.error(`Invalid category rejected: ${data.category}`);
        throw new ServiceError(ERROR_CODES.BAD_REQUEST, 'Invalid document category', 400);
      }

      await this.validateRecipient(data, tenantId);

      if (!this.isAllowedFileType(data.mimeType)) {
        throw new ServiceError(
          ERROR_CODES.BAD_REQUEST,
          'File type not allowed. Allowed types: PDF, JPG, PNG, DOCX, DOC, XLSX, XLS (max 5MB)',
          400,
        );
      }

      const documentData = buildDocumentCreateData(data, createdBy, tenantId);

      // Write file to disk if storageType is 'filesystem' and filePath is provided
      const filePath = data.filePath;
      if (data.storageType === 'filesystem' && filePath !== undefined && filePath !== '') {
        await writeFileToDisk(filePath, data.fileContent);
      }

      const documentId = await Document.create(documentData);
      return await this.getDocumentById(documentId, createdBy, tenantId, false);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error(`Error creating document: ${(error as Error).message}`);
      throw new ServiceError(ERROR_CODES.SERVER_ERROR, 'Failed to create document', 500);
    }
  }

  /**
   * Build update data object from input
   */
  private buildUpdateData(data: DocumentUpdateInput): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};

    if (data.filename !== undefined) updateData['filename'] = data.filename;
    if (data.category !== undefined) updateData['category'] = data.category;
    if (data.description !== undefined) updateData['description'] = data.description;
    if (data.tags !== undefined) updateData['tags'] = data.tags;

    return updateData;
  }

  /**
   * Check if user can update document
   */
  private async checkUpdatePermission(
    document: DbDocument,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    const user = await User.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    const isAdminOrRoot = user.role === 'admin' || user.role === 'root';
    const isCreator = document.created_by === userId;

    if (!isAdminOrRoot && !isCreator) {
      throw new ServiceError(
        ERROR_CODES.FORBIDDEN,
        "You don't have permission to update this document",
        403,
      );
    }
  }

  /**
   * Update a document
   * @param id - The resource ID
   * @param data - The data object
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async updateDocument(
    id: number,
    data: DocumentUpdateInput,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    try {
      const document = await Document.findById(id, tenantId);

      if (document === null) {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.DOCUMENT_NOT_FOUND, 404);
      }

      await this.checkUpdatePermission(document, userId, tenantId);
      const updateData = this.buildUpdateData(data);
      await Document.update(id, updateData, tenantId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error updating document ${id}: ${(error as Error).message}`);
      throw new ServiceError(ERROR_CODES.SERVER_ERROR, 'Failed to update document', 500);
    }
  }

  /**
   * Delete a document
   * @param id - The resource ID
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async deleteDocument(id: number, userId: number, tenantId: number): Promise<void> {
    try {
      // Get document
      const document = await Document.findById(id, tenantId);

      if (document === null) {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.DOCUMENT_NOT_FOUND, 404);
      }

      // Check permissions
      const user = await User.findById(userId, tenantId);
      if (!user) {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.USER_NOT_FOUND, 404);
      }

      // Only admin can delete documents
      if (user.role !== 'admin' && user.role !== 'root') {
        throw new ServiceError(
          ERROR_CODES.FORBIDDEN,
          'Only administrators can delete documents',
          403,
        );
      }

      await Document.delete(id, tenantId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error deleting document ${id}: ${(error as Error).message}`);
      throw new ServiceError(ERROR_CODES.SERVER_ERROR, 'Failed to delete document', 500);
    }
  }

  /**
   * Archive/Unarchive a document
   * @param id - The resource ID
   * @param archive - The archive parameter
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async archiveDocument(
    id: number,
    archive: boolean,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    try {
      // Get document
      const document = await Document.findById(id, tenantId);

      if (document === null) {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.DOCUMENT_NOT_FOUND, 404);
      }

      // Check permissions
      const user = await User.findById(userId, tenantId);
      if (!user) {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.USER_NOT_FOUND, 404);
      }

      // Only admin can archive documents
      if (user.role !== 'admin' && user.role !== 'root') {
        throw new ServiceError(
          ERROR_CODES.FORBIDDEN,
          'Only administrators can archive documents',
          403,
        );
      }

      const updateData: DocumentUpdateData = {
        isActive: archive ? 3 : 1, // 3 = archived, 1 = active
      };

      await Document.update(id, updateData, tenantId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error archiving document ${id}: ${(error as Error).message}`);
      throw new ServiceError(ERROR_CODES.SERVER_ERROR, 'Failed to archive document', 500);
    }
  }

  /**
   * Get document content for download/preview
   * @param id - The resource ID
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async getDocumentContent(
    id: number,
    userId: number,
    tenantId: number,
  ): Promise<{
    content: Buffer;
    originalName: string;
    mimeType: string;
    fileSize: number;
  }> {
    try {
      const document = await Document.findById(id, tenantId);

      if (document === null) {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.DOCUMENT_NOT_FOUND, 404);
      }

      // Check access
      const hasAccess = await this.checkDocumentAccess(document, userId, tenantId);

      if (!hasAccess) {
        throw new ServiceError(
          ERROR_CODES.FORBIDDEN,
          "You don't have access to this document",
          403,
        );
      }

      // Increment download count
      await Document.incrementDownloadCount(id, tenantId);

      // Get file content: try DB first, then filesystem
      const content = await this.resolveFileContent(document);

      return {
        content,
        originalName: document.original_name ?? document.filename ?? '',
        mimeType: document.mime_type ?? 'application/octet-stream',
        fileSize: document.file_size ?? 0,
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error(`Error getting document content ${id}: ${(error as Error).message}`);
      throw new ServiceError(ERROR_CODES.SERVER_ERROR, 'Failed to get document content', 500);
    }
  }

  /**
   * Get document content by file UUID (secure download URL)
   * Used by blackboard and other systems that use UUID-based URLs
   * @param fileUuid - The file UUID (UUIDv7)
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async getDocumentContentByFileUuid(
    fileUuid: string,
    userId: number,
    tenantId: number,
  ): Promise<{
    content: Buffer;
    originalName: string;
    mimeType: string;
    fileSize: number;
  }> {
    try {
      const document = await Document.findByFileUuid(fileUuid, tenantId);

      if (document === null) {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.DOCUMENT_NOT_FOUND, 404);
      }

      // Check access
      const hasAccess = await this.checkDocumentAccess(document, userId, tenantId);

      if (!hasAccess) {
        throw new ServiceError(
          ERROR_CODES.FORBIDDEN,
          "You don't have access to this document",
          403,
        );
      }

      // Increment download count
      await Document.incrementDownloadCount(document.id, tenantId);

      // Get file content: try DB first, then filesystem
      const content = await this.resolveFileContent(document);

      return {
        content,
        originalName: document.original_name ?? document.filename ?? '',
        mimeType: document.mime_type ?? 'application/octet-stream',
        fileSize: document.file_size ?? 0,
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error(
        `Error getting document content by fileUuid ${fileUuid}: ${(error as Error).message}`,
      );
      throw new ServiceError(ERROR_CODES.SERVER_ERROR, 'Failed to get document content', 500);
    }
  }

  /**
   * Resolve file content from database or filesystem
   * SECURITY: Uses readFileFromDisk which validates path containment
   * @param document - The document with file_content or file_path
   * @returns File content as Buffer
   */
  private async resolveFileContent(document: DbDocument): Promise<Buffer> {
    if (document.file_content != null) {
      return document.file_content;
    }
    if (document.file_path != null) {
      return await readFileFromDisk(document.file_path);
    }
    throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Document has no content or file path', 404);
  }

  /**
   * Get document statistics
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async getDocumentStats(userId: number, tenantId: number): Promise<Record<string, unknown>> {
    try {
      const user = await User.findById(userId, tenantId);
      if (!user) {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.USER_NOT_FOUND, 404);
      }

      // Get unread count
      const unreadCount = await Document.getUnreadCountForUser(userId, tenantId);

      // Get total storage used (admin only)
      let storageUsed = 0;
      if (user.role === 'admin' || user.role === 'root') {
        storageUsed = await Document.getTotalStorageUsed(tenantId);
      }

      // Get document counts by category
      const categoryCounts = await Document.getCountsByCategory(tenantId, userId);

      return {
        unreadCount,
        storageUsed,
        categoryCounts,
      };
    } catch (error: unknown) {
      logger.error(`Error getting document stats: ${(error as Error).message}`);
      throw new ServiceError(ERROR_CODES.SERVER_ERROR, 'Failed to get document stats', 500);
    }
  }

  /**
   * Mark document as read by user
   * Updates document_read_status table to track that user has viewed the document
   * @param documentId - Document ID
   * @param userId - User ID
   * @param tenantId - Tenant ID
   */
  async markDocumentAsRead(documentId: number, userId: number, tenantId: number): Promise<void> {
    try {
      await Document.markAsRead(documentId, userId, tenantId);
      logger.info(`Document ${documentId} marked as read by user ${userId}`);
    } catch (error: unknown) {
      logger.error(`Error marking document ${documentId} as read: ${(error as Error).message}`);
      // Don't throw - marking as read is non-critical, shouldn't block document viewing
      // User can still view document even if read tracking fails
    }
  }

  /**
   * Check if user has access to a document
   * NEW: Uses clean access_scope structure (refactored 2025-01-10)
   * @param document - The document parameter
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity -- Inherent complexity due to multiple access_scope cases
  private async checkDocumentAccess(
    document: DbDocument,
    userId: number,
    tenantId: number,
  ): Promise<boolean> {
    const user = await User.findById(userId, tenantId);
    if (!user) return false;

    // Admins have access to all documents
    if (user.role === 'admin' || user.role === 'root') {
      return true;
    }

    // Check based on access_scope (NEW: clean structure)
    switch (document.access_scope) {
      case 'personal':
      case 'payroll':
        // Only the owner can access personal/payroll documents
        return document.owner_user_id === userId;

      case 'team': {
        // Check if user is member of the target team
        if (document.target_team_id === null || document.target_team_id === undefined) return false;
        const teamMembers = await Team.getTeamMembers(document.target_team_id);
        return teamMembers.some((member: { id: number }) => member.id === userId);
      }

      case 'department':
        // Check if user is in the target department
        // N:M REFACTORING: department_id now from user_departments (primary dept)
        return user['department_id'] === document.target_department_id;

      case 'company':
        // All users in tenant can see company documents
        return true;

      case 'blackboard': {
        // Check if user can see the parent blackboard entry
        // Entry visibility is based on org_level (company/department/team)
        if (document.blackboard_entry_id === null || document.blackboard_entry_id === undefined) {
          // No parent entry - should not happen, but allow admins
          return user.role === 'admin' || user.role === 'root';
        }

        try {
          // getBlackboardEntry returns null if user has no access
          const entry = await getBlackboardEntry(document.blackboard_entry_id, tenantId, userId);
          return entry !== null;
        } catch {
          // Error accessing entry - deny access
          return false;
        }
      }

      case 'chat': {
        // NEW 2025-12-03: Check if user is a participant of the conversation
        if (document.conversation_id === null || document.conversation_id === undefined) {
          // No conversation linked - should not happen, deny access
          return false;
        }

        // Check conversation participation using model function
        return await Document.isConversationParticipant(userId, document.conversation_id, tenantId);
      }

      default:
        return false;
    }
  }

  /**
   * Validate owner user for personal/payroll documents
   * NEW: Validates ownerUserId (refactored 2025-01-10)
   */
  private async validateOwnerUser(userId: number | undefined, tenantId: number): Promise<void> {
    if (userId === undefined || userId === 0) {
      throw new ServiceError(
        ERROR_CODES.BAD_REQUEST,
        'Owner user ID is required for personal/payroll documents',
        400,
      );
    }
    const user = await User.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError(ERROR_CODES.BAD_REQUEST, 'Invalid owner user ID', 400);
    }
  }

  /**
   * Validate target team for team documents
   * NEW: Validates targetTeamId (refactored 2025-01-10)
   */
  private async validateTargetTeam(teamId: number | undefined, tenantId: number): Promise<void> {
    if (teamId === undefined || teamId === 0) {
      throw new ServiceError(
        ERROR_CODES.BAD_REQUEST,
        'Target team ID is required for team documents',
        400,
      );
    }
    const team = await Team.findById(teamId, tenantId);
    if (!team) {
      throw new ServiceError(ERROR_CODES.BAD_REQUEST, 'Invalid target team ID', 400);
    }
  }

  /**
   * Validate target department for department documents
   * NEW: Validates targetDepartmentId (refactored 2025-01-10)
   */
  private async validateTargetDepartment(
    departmentId: number | undefined,
    tenantId: number,
  ): Promise<void> {
    if (departmentId === undefined || departmentId === 0) {
      throw new ServiceError(
        ERROR_CODES.BAD_REQUEST,
        'Target department ID is required for department documents',
        400,
      );
    }
    const dept = await Department.findById(departmentId, tenantId);
    if (!dept) {
      throw new ServiceError(ERROR_CODES.BAD_REQUEST, 'Invalid target department ID', 400);
    }
  }

  /**
   * Validate recipient based on access scope
   * NEW: Uses clean access_scope (refactored 2025-01-10)
   * Updated 2025-12-03: Added 'chat' accessScope validation
   * @param data - The data object
   * @param tenantId - The tenant ID
   */
  private async validateRecipient(data: DocumentCreateInput, tenantId: number): Promise<void> {
    switch (data.accessScope) {
      case 'personal':
      case 'payroll':
        await this.validateOwnerUser(data.ownerUserId, tenantId);
        break;

      case 'team':
        await this.validateTargetTeam(data.targetTeamId, tenantId);
        break;

      case 'department':
        await this.validateTargetDepartment(data.targetDepartmentId, tenantId);
        break;

      case 'company':
        // No specific recipient needed for company-wide documents
        break;

      case 'blackboard':
        // Blackboard documents require entry ID (validated separately)
        // Access is determined by blackboard entry visibility, not document recipients
        break;

      case 'chat':
        // Chat documents require conversation ID
        // Access is determined by conversation participation (validated in controller)
        if (data.conversationId === undefined || data.conversationId === 0) {
          throw new ServiceError(
            ERROR_CODES.BAD_REQUEST,
            'Conversation ID is required for chat attachments',
            400,
          );
        }
        break;

      default:
        throw new ServiceError(ERROR_CODES.BAD_REQUEST, 'Invalid access scope', 400);
    }
  }

  /**
   * Check if file type is allowed
   * Updated 2025-11-24: Added image/gif for blackboard attachments
   * @param mimeType - The mimeType parameter
   */
  private isAllowedFileType(mimeType: string): boolean {
    const allowedTypes = [
      'application/pdf', // PDF
      'image/jpeg', // JPG/JPEG
      'image/png', // PNG
      'image/gif', // GIF (for blackboard)
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/msword', // DOC
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      'application/vnd.ms-excel', // XLS
    ];
    return allowedTypes.includes(mimeType);
  }

  /**
   * Get documents for a specific blackboard entry
   * NEW 2025-11-24: For blackboard attachment integration
   * @param entryId - Blackboard entry ID
   * @param tenantId - Tenant ID
   * @param userId - User ID for access validation
   */
  async getDocumentsByBlackboardEntry(
    entryId: number,
    tenantId: number,
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    try {
      const result = await this.listDocuments(userId, tenantId, {
        accessScope: 'blackboard',
        blackboardEntryId: entryId,
        limit: 100, // Max attachments per entry
      });
      return result.documents;
    } catch (error: unknown) {
      logger.error(`Error getting blackboard documents: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Get documents (attachments) for a specific conversation
   * NEW 2025-12-03: For chat attachment integration
   * @param conversationId - Conversation ID
   * @param tenantId - Tenant ID
   * @param userId - User ID for access validation (must be participant)
   */
  async getDocumentsByConversation(
    conversationId: number,
    tenantId: number,
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    try {
      // First check if user is a participant (permission check)
      const isParticipant = await Document.isConversationParticipant(
        userId,
        conversationId,
        tenantId,
      );

      if (!isParticipant) {
        logger.warn(
          `User ${userId} attempted to access attachments for conversation ${conversationId} without being a participant`,
        );
        throw new ServiceError(
          ERROR_CODES.FORBIDDEN,
          'You are not a participant of this conversation',
          403,
        );
      }

      // Get all attachments for this conversation
      const documents = await Document.findByConversation(conversationId, tenantId, userId);

      // Transform to API format
      return documents.map((doc: DbDocument) => {
        const apiDoc = dbToApi(doc);
        const uuid = doc['file_uuid'];
        const docId = doc.id;
        const fileIdentifier: string = typeof uuid === 'string' ? uuid : String(docId);
        return {
          ...apiDoc,
          downloadUrl: `/api/v2/chat/attachments/${fileIdentifier}/download`,
          // Use download endpoint with inline=true for preview (no separate preview endpoint)
          previewUrl: `/api/v2/chat/attachments/${fileIdentifier}/download?inline=true`,
        };
      });
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(
        `Error getting chat attachments for conversation ${conversationId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Get chat folders for document explorer
   * Returns conversations where user is participant AND has attachments
   * NEW 2025-12-04: Chat folders for document explorer
   * @param userId - Current user ID
   * @param tenantId - Tenant ID
   * @returns Array of chat folders with participant info and attachment count
   */
  async getChatFolders(
    userId: number,
    tenantId: number,
  ): Promise<
    {
      conversationId: number;
      conversationUuid: string;
      participantName: string;
      participantId: number;
      attachmentCount: number;
      isGroup: boolean;
      groupName: string | null;
    }[]
  > {
    try {
      return await Document.getChatFoldersForUser(userId, tenantId);
    } catch (error: unknown) {
      logger.error(`Error getting chat folders for user ${userId}: ${(error as Error).message}`);
      return [];
    }
  }
}

// Export singleton instance
export const documentsService = new DocumentsService();
