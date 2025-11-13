/**
 * Documents v2 Service Layer
 * Handles all business logic for document management
 */
import fs from 'fs/promises';
import path from 'path';

// Model classes are exported as PascalCase objects for backward compatibility
// eslint-disable-next-line @typescript-eslint/naming-convention
import Department from '../../../models/department.js';
// eslint-disable-next-line @typescript-eslint/naming-convention
import Document, { DbDocument, DocumentUpdateData } from '../../../models/document.js';
// eslint-disable-next-line @typescript-eslint/naming-convention
import Team from '../../../models/team.js';
// eslint-disable-next-line @typescript-eslint/naming-convention
import User from '../../../models/user/index.js';
import { dbToApi } from '../../../utils/fieldMapping.js';
import { logger } from '../../../utils/logger.js';

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
    public message: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// NEW: Clean filter structure (refactored 2025-01-10)
export interface DocumentFilters {
  category?: string;
  accessScope?: 'personal' | 'team' | 'department' | 'company' | 'payroll';
  ownerUserId?: number;
  targetTeamId?: number;
  targetDepartmentId?: number;
  salaryYear?: number;
  salaryMonth?: number;
  isArchived?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// NEW: Clean create input structure (refactored 2025-01-10)
export interface DocumentCreateInput {
  filename: string;
  originalName: string;
  fileSize: number;
  fileContent: Buffer;
  mimeType: string;
  category: string;
  // NEW: Clean access control
  accessScope: 'personal' | 'team' | 'department' | 'company' | 'payroll';
  ownerUserId?: number;
  targetTeamId?: number;
  targetDepartmentId?: number;
  description?: string;
  // NEW: Payroll fields
  salaryYear?: number;
  salaryMonth?: number;
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

      // Get user for access control
      const user = await User.findById(userId, tenantId);
      if (!user) {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.USER_NOT_FOUND, 404);
      }

      // Build filter object for model (NEW: clean structure, refactored 2025-01-10)
      const modelFilters = {
        category: filters?.category,
        accessScope: filters?.accessScope,
        userId: filters?.ownerUserId, // Map ownerUserId -> userId for model compatibility
        salaryYear: filters?.salaryYear,
        salaryMonth: filters?.salaryMonth,
        isArchived: filters?.isArchived ?? false,
        searchTerm: filters?.search, // Map 'search' to 'searchTerm' for model
        limit,
        offset,
      };

      // Get documents based on user role
      let documents: DbDocument[];
      let totalCount: number;

      if (user.role === 'admin' || user.role === 'root') {
        // Admins can see all documents in their tenant
        const result = await Document.findWithFilters(tenantId, modelFilters);
        documents = result.documents;
        totalCount = result.total;
      } else {
        // Regular users only see documents they have access to
        const result = await Document.findByEmployeeWithAccess(userId, tenantId, modelFilters);
        documents = result.documents;
        totalCount = result.total;
      }

      // Enrich documents with metadata and access status
      const documentsWithStatus = await Promise.all(
        documents.map((doc: DbDocument) => this.enrichDocumentWithMetadata(doc, userId, tenantId)),
      );

      return {
        documents: documentsWithStatus,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
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
    if (typeof apiDoc.tags === 'string') {
      try {
        apiDoc.tags = JSON.parse(apiDoc.tags);
      } catch {
        apiDoc.tags = [];
      }
    }

    // Map recipient ID based on recipient type
    const recipientId = this.extractRecipientId(apiDoc);

    // Map fields for frontend compatibility (camelCase)
    return {
      ...apiDoc,
      // Frontend expects: filename = user-facing name, storedFilename = UUID-based
      filename: apiDoc.originalName ?? doc.original_name ?? apiDoc.filename,
      storedFilename: apiDoc.filename ?? doc.filename,
      uploadedBy: apiDoc.createdBy ?? doc.created_by ?? userId,
      uploaderName: apiDoc.uploadedByName ?? doc.uploaded_by_name ?? 'Unbekannt',
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
    const accessScope = apiDoc.accessScope as string;

    if (accessScope === 'personal' || accessScope === 'payroll') {
      return typeof apiDoc.ownerUserId === 'number' ? apiDoc.ownerUserId : null;
    }
    if (accessScope === 'team') {
      return typeof apiDoc.targetTeamId === 'number' ? apiDoc.targetTeamId : null;
    }
    if (accessScope === 'department') {
      return typeof apiDoc.targetDepartmentId === 'number' ? apiDoc.targetDepartmentId : null;
    }
    // Company-wide documents have no specific recipient
    return null;
  }

  /**
   * Map null recipient IDs to undefined
   * NEW: Uses clean field names (refactored 2025-01-10)
   */
  private mapRecipientIds(apiDoc: Record<string, unknown>): void {
    if (apiDoc.ownerUserId === null) apiDoc.ownerUserId = undefined;

    if (apiDoc.targetTeamId === null) apiDoc.targetTeamId = undefined;

    if (apiDoc.targetDepartmentId === null) apiDoc.targetDepartmentId = undefined;
  }

  /**
   * Parse tags from string to array
   */
  private parseTags(apiDoc: Record<string, unknown>): void {
    if (typeof apiDoc.tags === 'string') {
      try {
        apiDoc.tags = JSON.parse(apiDoc.tags);
      } catch {
        apiDoc.tags = [];
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
      // Validate recipient based on type
      await this.validateRecipient(data, tenantId);

      // Validate file type
      if (!this.isAllowedFileType(data.mimeType)) {
        throw new ServiceError(
          ERROR_CODES.BAD_REQUEST,
          'File type not allowed. Allowed types: PDF, JPG, PNG, DOCX, DOC, XLSX, XLS (max 5MB)',
          400,
        );
      }

      // Create document data (NEW: clean structure, refactored 2025-01-10)
      const documentData = {
        tenant_id: tenantId,
        // NEW: Clean access control
        accessScope: data.accessScope,
        ownerUserId:
          data.ownerUserId ??
          (data.accessScope === 'personal' || data.accessScope === 'payroll' ?
            createdBy
          : undefined),
        targetTeamId: data.targetTeamId,
        targetDepartmentId: data.targetDepartmentId,
        // File fields
        category: data.category,
        fileName: data.filename, // UUID-based filename for storage
        originalName: data.originalName, // User-visible name from modal input
        fileContent: data.fileContent,
        description: data.description,
        // NEW: Payroll fields
        salaryYear: data.salaryYear,
        salaryMonth: data.salaryMonth,
        createdBy: createdBy,
        tags: data.tags,
        mimeType: data.mimeType, // Pass the mime type to store it correctly
        // UUID-based storage
        fileUuid: data.fileUuid,
        fileChecksum: data.fileChecksum,
        storageType: data.storageType ?? 'filesystem',
      };

      // Write file to disk if storageType is 'filesystem' and filePath is provided
      if (data.storageType === 'filesystem' && data.filePath) {
        try {
          // Build absolute path from project root
          // Path is validated via path.join() which prevents path traversal attacks
          const absolutePath = path.join(process.cwd(), data.filePath);
          const directory = path.dirname(absolutePath);

          // Create directory structure recursively
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path is validated via path.join() and UUID-based, safe from traversal
          await fs.mkdir(directory, { recursive: true });

          // Write file to disk
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path is validated via path.join() and UUID-based, safe from traversal
          await fs.writeFile(absolutePath, data.fileContent);

          logger.info(`File written successfully: ${data.filePath}`);
        } catch (fsError: unknown) {
          logger.error(`Failed to write file to disk: ${(fsError as Error).message}`);
          throw new ServiceError(ERROR_CODES.SERVER_ERROR, 'Failed to write file to disk', 500);
        }
      }

      const documentId = await Document.create(documentData);

      // Return the created document without marking as read (so uploader sees "Neu" badge)
      return await this.getDocumentById(documentId, createdBy, tenantId, false);
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error creating document: ${(error as Error).message}`);
      throw new ServiceError(ERROR_CODES.SERVER_ERROR, 'Failed to create document', 500);
    }
  }

  /**
   * Build update data object from input
   */
  private buildUpdateData(data: DocumentUpdateInput): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};

    if (data.filename !== undefined) updateData.filename = data.filename;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.tags !== undefined) updateData.tags = data.tags;

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
        isArchived: archive,
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
      let content: Buffer;

      if (document.file_content != null) {
        // File stored in database (Buffer exists)
        content = document.file_content;
      } else if (document.file_path != null) {
        // File stored on filesystem
        const fs = await import('fs/promises');
        const path = await import('path');

        // Construct absolute path (file_path is relative from project root)
        // Safe: we already checked file_path != null above
        const absolutePath = path.join(process.cwd(), String(document.file_path));

        try {
          content = await fs.readFile(absolutePath);
        } catch (fsError) {
          logger.error(`Failed to read file from filesystem: ${absolutePath}`, fsError);
          throw new ServiceError(
            ERROR_CODES.NOT_FOUND,
            'Document file not found on filesystem',
            404,
          );
        }
      } else {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, 'Document has no content or file path', 404);
      }

      return {
        content,
        originalName: document.original_name ?? document.filename ?? '',
        mimeType: document.mime_type ?? 'application/octet-stream',
        fileSize: document.file_size ?? 0,
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      logger.error(`Error getting document content ${id}: ${(error as Error).message}`);
      throw new ServiceError(ERROR_CODES.SERVER_ERROR, 'Failed to get document content', 500);
    }
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
        if (!document.target_team_id) return false;
        const teamMembers = await Team.getTeamMembers(document.target_team_id);
        return teamMembers.some((member: { id: number }) => member.id === userId);
      }

      case 'department':
        // Check if user is in the target department
        return user.department_id === document.target_department_id;

      case 'company':
        // All users in tenant can see company documents
        return true;

      default:
        return false;
    }
  }

  /**
   * Validate owner user for personal/payroll documents
   * NEW: Validates ownerUserId (refactored 2025-01-10)
   */
  private async validateOwnerUser(userId: number | undefined, tenantId: number): Promise<void> {
    if (!userId) {
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
    if (!teamId) {
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
    if (!departmentId) {
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

      default:
        throw new ServiceError(ERROR_CODES.BAD_REQUEST, 'Invalid access scope', 400);
    }
  }

  /**
   * Check if file type is allowed
   * @param mimeType - The mimeType parameter
   */
  private isAllowedFileType(mimeType: string): boolean {
    const allowedTypes = [
      'application/pdf', // PDF
      'image/jpeg', // JPG/JPEG
      'image/png', // PNG
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/msword', // DOC
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      'application/vnd.ms-excel', // XLS
    ];
    return allowedTypes.includes(mimeType);
  }
}

// Export singleton instance
export const documentsService = new DocumentsService();
