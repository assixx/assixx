/**
 * Documents v2 Service Layer
 * Handles all business logic for document management
 */
// Model classes are exported as PascalCase objects for backward compatibility
// eslint-disable-next-line @typescript-eslint/naming-convention
import Department from '../../../models/department';
// eslint-disable-next-line @typescript-eslint/naming-convention
import Document, { DbDocument, DocumentUpdateData } from '../../../models/document';
// eslint-disable-next-line @typescript-eslint/naming-convention
import Team from '../../../models/team';
// eslint-disable-next-line @typescript-eslint/naming-convention
import User from '../../../models/user';
import { dbToApi } from '../../../utils/fieldMapping';
import { logger } from '../../../utils/logger';

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
    public statusCode = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export interface DocumentFilters {
  category?: string;
  recipientType?: string;
  userId?: number;
  teamId?: number;
  departmentId?: number;
  year?: number;
  month?: number;
  isArchived?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface DocumentCreateInput {
  filename: string;
  originalName: string;
  fileSize: number;
  fileContent: Buffer;
  mimeType: string;
  category: string;
  recipientType: string;
  userId?: number;
  teamId?: number;
  departmentId?: number;
  description?: string;
  year?: number;
  month?: number;
  tags?: string[];
  isPublic?: boolean;
  expiresAt?: Date;
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
export class DocumentsService {
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

      // Build filter object for model
      const modelFilters = {
        category: filters?.category,
        recipientType: filters?.recipientType,
        userId: filters?.userId,
        teamId: filters?.teamId,
        departmentId: filters?.departmentId,
        year: filters?.year,
        month: filters?.month?.toString(),
        isArchived: filters?.isArchived ?? false,
        searchTerm: filters?.search, // Map 'search' to 'searchTerm' for model
        limit,
        offset,
      };

      // Get documents based on user role
      let documents;
      let totalCount;

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

      // Get read status for each document
      const documentsWithStatus = await Promise.all(
        documents.map(async (doc) => {
          const isRead = await Document.isReadByUser(doc.id, userId, tenantId);
          const apiDoc = dbToApi(doc);

          // Map recipient IDs to proper names
          if (apiDoc.userId === null) apiDoc.userId = undefined;
          if (apiDoc.teamId === null) apiDoc.teamId = undefined;
          if (apiDoc.departmentId === null) apiDoc.departmentId = undefined;

          // Parse tags if stored as JSON string
          if (typeof apiDoc.tags === 'string') {
            try {
              apiDoc.tags = JSON.parse(apiDoc.tags);
            } catch {
              apiDoc.tags = [];
            }
          }

          return {
            ...apiDoc,
            isRead,
            downloadUrl: `/api/v2/documents/${doc.id}/download`,
            previewUrl: `/api/v2/documents/${doc.id}/preview`,
          };
        }),
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
   * Map null recipient IDs to undefined
   */
  private mapRecipientIds(apiDoc: Record<string, unknown>): void {
    if (apiDoc.userId === null) apiDoc.userId = undefined;

    if (apiDoc.teamId === null) apiDoc.teamId = undefined;

    if (apiDoc.departmentId === null) apiDoc.departmentId = undefined;
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
   */
  async getDocumentById(
    id: number,
    userId: number,
    tenantId: number,
  ): Promise<Record<string, unknown>> {
    try {
      const document = await Document.findById(id);

      // Validate document exists and belongs to tenant
      if (!document || document.tenant_id !== tenantId) {
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

      // Mark as read and get status
      await Document.markAsRead(id, userId, tenantId);
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
          'File type not allowed. Only PDF files are accepted',
          400,
        );
      }

      // Create document data (note: model expects camelCase for some fields)
      const documentData = {
        tenant_id: tenantId,
        userId: data.userId ?? createdBy, // Always set userId - use createdBy if not specified
        teamId: data.teamId,
        departmentId: data.departmentId,
        recipientType: data.recipientType as 'user' | 'team' | 'department' | 'company',
        category: data.category,
        fileName: data.filename, // Model expects fileName
        fileContent: data.fileContent,
        description: data.description,
        year: data.year,
        month: data.month?.toString(),
        createdBy: createdBy,
        tags: data.tags,
        mimeType: data.mimeType, // Pass the mime type to store it correctly
      };

      const documentId = await Document.create(documentData);

      // Return the created document
      return await this.getDocumentById(documentId, createdBy, tenantId);
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
      const document = await Document.findById(id);

      if (!document || document.tenant_id !== tenantId) {
        throw new ServiceError(ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.DOCUMENT_NOT_FOUND, 404);
      }

      await this.checkUpdatePermission(document, userId, tenantId);
      const updateData = this.buildUpdateData(data);
      await Document.update(id, updateData);
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
      const document = await Document.findById(id);

      if (!document || document.tenant_id !== tenantId) {
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

      await Document.delete(id);
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
      const document = await Document.findById(id);

      if (!document || document.tenant_id !== tenantId) {
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

      await Document.update(id, updateData);
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
      const document = await Document.findById(id);

      if (!document || document.tenant_id !== tenantId) {
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
      await Document.incrementDownloadCount(id);

      return {
        content: document.file_content ?? Buffer.from(''),
        originalName: String(document.original_name ?? document.filename),
        mimeType: String(document.mime_type ?? 'application/octet-stream'),
        fileSize: Number(document.file_size ?? 0),
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
   * Check if user has access to a document
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

    // Check based on recipient type
    switch (document.recipient_type) {
      case 'user':
        return document.user_id === userId;

      case 'team': {
        if (!document.team_id) return false;
        const teamMembers = await Team.getTeamMembers(Number(document.team_id));
        return teamMembers.some((member: { id: number }) => member.id === userId);
      }

      case 'department':
        return user.department_id === document.department_id;

      case 'company':
        return true; // All users in tenant can see company documents

      default:
        return false;
    }
  }

  /**
   * Validate user recipient
   */
  private async validateUserRecipient(userId: number | undefined, tenantId: number): Promise<void> {
    if (!userId) {
      throw new ServiceError(
        ERROR_CODES.BAD_REQUEST,
        'User ID is required for user recipient type',
        400,
      );
    }
    const user = await User.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError(ERROR_CODES.BAD_REQUEST, 'Invalid user ID', 400);
    }
  }

  /**
   * Validate team recipient
   */
  private async validateTeamRecipient(teamId: number | undefined, tenantId: number): Promise<void> {
    if (!teamId) {
      throw new ServiceError(
        ERROR_CODES.BAD_REQUEST,
        'Team ID is required for team recipient type',
        400,
      );
    }
    const team = await Team.findById(teamId);
    if (!team || team.tenant_id !== tenantId) {
      throw new ServiceError(ERROR_CODES.BAD_REQUEST, 'Invalid team ID', 400);
    }
  }

  /**
   * Validate department recipient
   */
  private async validateDepartmentRecipient(
    departmentId: number | undefined,
    tenantId: number,
  ): Promise<void> {
    if (!departmentId) {
      throw new ServiceError(
        ERROR_CODES.BAD_REQUEST,
        'Department ID is required for department recipient type',
        400,
      );
    }
    const dept = await Department.findById(departmentId, tenantId);
    if (!dept) {
      throw new ServiceError(ERROR_CODES.BAD_REQUEST, 'Invalid department ID', 400);
    }
  }

  /**
   * Validate recipient based on type
   * @param data - The data object
   * @param tenantId - The tenant ID
   */
  private async validateRecipient(data: DocumentCreateInput, tenantId: number): Promise<void> {
    if (data.recipientType === 'user') {
      await this.validateUserRecipient(data.userId, tenantId);
    } else if (data.recipientType === 'team') {
      await this.validateTeamRecipient(data.teamId, tenantId);
    } else if (data.recipientType === 'department') {
      await this.validateDepartmentRecipient(data.departmentId, tenantId);
    } else if (data.recipientType === 'company') {
      // No specific recipient needed
      return;
    } else {
      throw new ServiceError(ERROR_CODES.BAD_REQUEST, 'Invalid recipient type', 400);
    }
  }

  /**
   * Check if file type is allowed
   * @param mimeType - The mimeType parameter
   */
  private isAllowedFileType(mimeType: string): boolean {
    const allowedTypes = ['application/pdf'];
    return allowedTypes.includes(mimeType);
  }
}

// Export singleton instance
export const documentsService = new DocumentsService();
