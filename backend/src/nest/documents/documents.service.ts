/**
 * Documents Service (Facade)
 *
 * Orchestrates document CRUD operations by delegating to sub-services:
 * - DocumentAccessService: access control, query building, read status
 * - DocumentStorageService: file I/O, content resolution
 * - DocumentNotificationService: upload notifications
 *
 * Pure functions live in documents.helpers.ts.
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { eventBus } from '../../utils/eventBus.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { DocumentAccessService } from './document-access.service.js';
import { DocumentNotificationService } from './document-notification.service.js';
import { DocumentStorageService } from './document-storage.service.js';
import {
  buildDocumentFilters,
  buildDocumentUpdateClause,
  enrichDocument,
  getDocumentRow,
  getDocumentsCount,
  insertDocumentRecord,
  validateDocumentInput,
} from './documents.helpers.js';
import type { ListDocumentsQueryDto } from './dto/query-documents.dto.js';
import type { UpdateDocumentDto } from './dto/update-document.dto.js';

// ============================================
// Types
// ============================================

/**
 * Database representation of a document
 */
export interface DbDocument {
  id: number;
  tenant_id: number;
  filename: string;
  original_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
  access_scope: string | null;
  owner_user_id: number | null;
  target_team_id: number | null;
  target_department_id: number | null;
  description: string | null;
  salary_year: number | null;
  salary_month: number | null;
  blackboard_entry_id: number | null;
  conversation_id: number | null;
  tags: string | null;
  is_active: number;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  file_uuid: string | null;
  file_checksum: string | null;
  file_path: string | null;
  file_content: Buffer | null;
  storage_type: string | null;
  download_count: number;
  uploaded_by_name?: string;
}

/**
 * API response type for document
 */
export type DocumentResponse = Record<string, unknown>;

/**
 * Paginated result type
 */
export interface PaginatedDocumentsResult {
  documents: DocumentResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Document content response for downloads
 */
export interface DocumentContentResponse {
  content: Buffer;
  originalName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Document statistics response
 */
export interface DocumentStatsResponse {
  unreadCount: number;
  storageUsed: number;
  categoryCounts: Record<string, number>;
}

/**
 * Unread count response for notification badge
 */
export interface UnreadCountResponse {
  count: number;
}

/**
 * Chat folder response
 */
export interface ChatFolderResponse {
  conversationId: number;
  conversationUuid: string;
  participantName: string;
  participantId: number;
  attachmentCount: number;
  isGroup: boolean;
  groupName: string | null;
}

/**
 * Document create input
 */
export interface DocumentCreateInput {
  filename: string;
  originalName: string;
  fileSize: number;
  fileContent: Buffer;
  mimeType: string;
  category: string;
  accessScope:
    | 'personal'
    | 'team'
    | 'department'
    | 'company'
    | 'payroll'
    | 'blackboard'
    | 'chat';
  ownerUserId?: number;
  targetTeamId?: number;
  targetDepartmentId?: number;
  description?: string;
  salaryYear?: number;
  salaryMonth?: number;
  blackboardEntryId?: number;
  conversationId?: number;
  tags?: string[];
  isPublic?: boolean;
  expiresAt?: Date;
  fileUuid?: string;
  fileChecksum?: string;
  filePath?: string;
  storageType?: 'database' | 'filesystem' | 's3';
}

/**
 * Document filters
 */
export interface DocumentFilters {
  category?: string | undefined;
  accessScope?: string | undefined;
  ownerUserId?: number | undefined;
  targetTeamId?: number | undefined;
  targetDepartmentId?: number | undefined;
  salaryYear?: number | undefined;
  salaryMonth?: number | undefined;
  blackboardEntryId?: number | undefined;
  conversationId?: number | undefined;
  isActive?: number | undefined;
  search?: string | undefined;
}

// ============================================
// Constants
// ============================================

const ERROR_DOCUMENT_NOT_FOUND = 'Document not found';
const ERROR_USER_NOT_FOUND = 'User not found';

// ============================================
// Service
// ============================================

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly accessService: DocumentAccessService,
    private readonly storageService: DocumentStorageService,
    private readonly notificationService: DocumentNotificationService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ============================================
  // Public Methods
  // ============================================

  /** List documents with filters and pagination */
  async listDocuments(
    tenantId: number,
    userId: number,
    query: ListDocumentsQueryDto,
  ): Promise<PaginatedDocumentsResult> {
    const page = query.page;
    const limit = query.limit;
    const offset = (page - 1) * limit;
    const isActive = query.isActive;

    const user = await this.getUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_USER_NOT_FOUND);
    }
    const isAdmin = user.role === 'admin' || user.role === 'root';
    const filters = buildDocumentFilters(query, isActive);

    const { baseQuery, params, paramIndex } =
      this.accessService.buildDocumentQuery(
        tenantId,
        isActive,
        filters,
        isAdmin,
        userId,
      );
    const total = await getDocumentsCount(
      this.databaseService,
      baseQuery,
      params,
    );

    const paginatedQuery = `${baseQuery} ORDER BY d.uploaded_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const documents = await this.databaseService.query<DbDocument>(
      paginatedQuery,
      [...params, limit, offset],
    );
    const apiDocuments = await Promise.all(
      documents.map(async (doc: DbDocument) => {
        const isRead = await this.accessService.isDocumentRead(
          doc.id,
          userId,
          tenantId,
        );
        return enrichDocument(doc, isRead);
      }),
    );

    return {
      documents: apiDocuments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Get document by ID */
  async getDocumentById(
    documentId: number,
    tenantId: number,
    userId: number,
  ): Promise<DocumentResponse> {
    this.logger.debug(`Getting document ${documentId} for tenant ${tenantId}`);

    const documents = await this.databaseService.query<DbDocument>(
      `SELECT d.*, u.username as uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.id = $1 AND d.tenant_id = $2`,
      [documentId, tenantId],
    );

    const document = documents[0];
    if (document === undefined) {
      throw new NotFoundException(ERROR_DOCUMENT_NOT_FOUND);
    }

    // Check access
    const hasAccess = await this.accessService.checkDocumentAccess(
      document,
      userId,
      tenantId,
    );
    if (!hasAccess) {
      throw new ForbiddenException("You don't have access to this document");
    }

    // Mark as read
    await this.markDocumentAsRead(documentId, tenantId, userId);

    const isRead = await this.accessService.isDocumentRead(
      documentId,
      userId,
      tenantId,
    );
    return enrichDocument(document, isRead);
  }

  /** Get document by file UUID */
  async getDocumentByFileUuid(
    fileUuid: string,
    tenantId: number,
    userId: number,
  ): Promise<DocumentResponse | null> {
    this.logger.debug(`Getting document by fileUuid ${fileUuid}`);

    const documents = await this.databaseService.query<DbDocument>(
      `SELECT d.*, u.username as uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.file_uuid = $1 AND d.tenant_id = $2`,
      [fileUuid, tenantId],
    );

    const document = documents[0];
    if (document === undefined) {
      return null;
    }

    // Check access
    const hasAccess = await this.accessService.checkDocumentAccess(
      document,
      userId,
      tenantId,
    );
    if (!hasAccess) {
      return null;
    }

    const isRead = await this.accessService.isDocumentRead(
      document.id,
      userId,
      tenantId,
    );
    return enrichDocument(document, isRead);
  }

  /** Update document metadata */
  async updateDocument(
    documentId: number,
    dto: UpdateDocumentDto,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Updating document ${documentId}`);

    const document = await getDocumentRow(
      this.databaseService,
      documentId,
      tenantId,
    );
    if (document === null) {
      throw new NotFoundException(ERROR_DOCUMENT_NOT_FOUND);
    }

    // Check permission
    const user = await this.getUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_USER_NOT_FOUND);
    }
    const isAdmin = user.role === 'admin' || user.role === 'root';
    const isCreator = document.created_by === userId;
    if (!isAdmin && !isCreator) {
      throw new ForbiddenException(
        "You don't have permission to update this document",
      );
    }

    // Build and execute update
    const { updates, params, paramIndex } = buildDocumentUpdateClause(dto);
    params.push(documentId, tenantId);
    await this.databaseService.query(
      `UPDATE documents SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}`,
      params,
    );

    // Log activity
    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'document',
      documentId,
      `Dokument aktualisiert: ${document.original_name ?? document.filename}`,
      {
        filename: document.filename,
        category: document.category,
        description: document.description,
      },
      {
        filename: dto.filename ?? document.filename,
        category: dto.category ?? document.category,
        description: dto.description ?? document.description,
      },
    );

    return { message: 'Document updated successfully' };
  }

  /** Delete a document (soft delete) */
  async deleteDocument(
    documentId: number,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting document ${documentId}`);

    const document = await getDocumentRow(
      this.databaseService,
      documentId,
      tenantId,
    );
    if (document === null) {
      throw new NotFoundException(ERROR_DOCUMENT_NOT_FOUND);
    }

    const user = await this.getUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_USER_NOT_FOUND);
    }
    if (user.role !== 'admin' && user.role !== 'root') {
      throw new ForbiddenException('Only administrators can delete documents');
    }

    // Soft delete (is_active = 4)
    await this.databaseService.query(
      `UPDATE documents SET is_active = 4, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId],
    );

    // Log activity
    await this.activityLogger.logDelete(
      tenantId,
      userId,
      'document',
      documentId,
      `Dokument gelöscht: ${document.original_name ?? document.filename}`,
      {
        filename: document.filename,
        originalName: document.original_name,
        category: document.category,
        accessScope: document.access_scope,
        fileSize: document.file_size,
      },
    );

    return { message: 'Document deleted successfully' };
  }

  /** Archive a document */
  async archiveDocument(
    documentId: number,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Archiving document ${documentId}`);

    const user = await this.getUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_USER_NOT_FOUND);
    }
    if (user.role !== 'admin' && user.role !== 'root') {
      throw new ForbiddenException('Only administrators can archive documents');
    }

    await this.databaseService.query(
      `UPDATE documents SET is_active = 3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId],
    );

    return { message: 'Document archived successfully' };
  }

  /** Unarchive a document */
  async unarchiveDocument(
    documentId: number,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Unarchiving document ${documentId}`);

    const user = await this.getUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_USER_NOT_FOUND);
    }
    if (user.role !== 'admin' && user.role !== 'root') {
      throw new ForbiddenException(
        'Only administrators can unarchive documents',
      );
    }

    await this.databaseService.query(
      `UPDATE documents SET is_active = 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId],
    );

    return { message: 'Document unarchived successfully' };
  }

  /** Get document content for download */
  async getDocumentContent(
    documentId: number,
    tenantId: number,
    userId: number,
  ): Promise<DocumentContentResponse> {
    this.logger.debug(`Getting document content ${documentId}`);

    const document = await getDocumentRow(
      this.databaseService,
      documentId,
      tenantId,
    );
    if (document === null) {
      throw new NotFoundException(ERROR_DOCUMENT_NOT_FOUND);
    }

    const hasAccess = await this.accessService.checkDocumentAccess(
      document,
      userId,
      tenantId,
    );
    if (!hasAccess) {
      throw new ForbiddenException("You don't have access to this document");
    }

    return await this.storageService.getDocumentContent(document);
  }

  /** Mark document as read */
  async markDocumentAsRead(
    documentId: number,
    tenantId: number,
    userId: number,
  ): Promise<{ success: boolean }> {
    await this.databaseService.query(
      `INSERT INTO document_read_status (document_id, user_id, tenant_id, read_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (document_id, user_id, tenant_id) DO UPDATE SET read_at = NOW()`,
      [documentId, userId, tenantId],
    );
    return { success: true };
  }

  // ============================================
  // UUID-based methods (for API consistency)
  // ============================================

  /** Get document by UUID */
  async getDocumentByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<DocumentResponse> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.getDocumentById(documentId, tenantId, userId);
  }

  /** Update document by UUID */
  async updateDocumentByUuid(
    uuid: string,
    dto: UpdateDocumentDto,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.updateDocument(documentId, dto, tenantId, userId);
  }

  /** Delete document by UUID */
  async deleteDocumentByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.deleteDocument(documentId, tenantId, userId);
  }

  /** Archive document by UUID */
  async archiveDocumentByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.archiveDocument(documentId, tenantId, userId);
  }

  /** Unarchive document by UUID */
  async unarchiveDocumentByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.unarchiveDocument(documentId, tenantId, userId);
  }

  /** Get document content by UUID */
  async getDocumentContentByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<DocumentContentResponse> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.getDocumentContent(documentId, tenantId, userId);
  }

  /** Mark document as read by UUID */
  async markDocumentAsReadByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<{ success: boolean }> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.markDocumentAsRead(documentId, tenantId, userId);
  }

  /** Get document statistics */
  async getDocumentStats(
    tenantId: number,
    userId: number,
  ): Promise<DocumentStatsResponse> {
    this.logger.debug(`Getting document stats for tenant ${tenantId}`);

    const user = await this.getUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_USER_NOT_FOUND);
    }

    // Get unread count
    const unreadResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM documents d
       WHERE d.tenant_id = $1 AND d.is_active = 1
       AND NOT EXISTS (
         SELECT 1 FROM document_read_status rs
         WHERE rs.document_id = d.id AND rs.user_id = $2
       )`,
      [tenantId, userId],
    );
    const unreadCount = Number.parseInt(unreadResult[0]?.count ?? '0', 10);

    // Get storage (admin only)
    let storageUsed = 0;
    if (user.role === 'admin' || user.role === 'root') {
      const storageResult = await this.databaseService.query<{ total: string }>(
        `SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = $1 AND is_active = 1`,
        [tenantId],
      );
      storageUsed = Number.parseInt(storageResult[0]?.total ?? '0', 10);
    }

    // Get category counts
    const categoryResults = await this.databaseService.query<{
      category: string;
      count: string;
    }>(
      `SELECT category, COUNT(*) as count FROM documents
       WHERE tenant_id = $1 AND is_active = 1
       GROUP BY category`,
      [tenantId],
    );
    const categoryCounts: Record<string, number> = {};
    for (const row of categoryResults) {
      categoryCounts[row.category] = Number.parseInt(row.count, 10);
    }

    return { unreadCount, storageUsed, categoryCounts };
  }

  /**
   * Get count of unread documents for notification badge.
   * Applies the same access_scope filter as listDocuments to ensure consistency.
   */
  async getUnreadCount(
    tenantId: number,
    userId: number,
    userRole: 'root' | 'admin' | 'employee',
  ): Promise<UnreadCountResponse> {
    const isAdmin = userRole === 'admin' || userRole === 'root';

    // Build query with same access scope filter as listDocuments
    let query = `
      SELECT COUNT(*) as count FROM documents d
      WHERE d.tenant_id = $1 AND d.is_active = 1
      AND NOT EXISTS (
        SELECT 1 FROM document_read_status rs
        WHERE rs.document_id = d.id AND rs.user_id = $2
      )
    `;
    const params: unknown[] = [tenantId, userId];

    // Apply access scope filter for non-admin users (same logic as buildDocumentQuery)
    if (!isAdmin) {
      query += ` AND (
        d.access_scope = 'company' OR
        (d.access_scope = 'personal' AND d.owner_user_id = $3) OR
        (d.access_scope = 'payroll' AND d.owner_user_id = $3)
      )`;
      params.push(userId);
    }

    const result = await this.databaseService.query<{ count: string }>(
      query,
      params,
    );
    const count = Number.parseInt(result[0]?.count ?? '0', 10);

    return { count };
  }

  /** Get chat folders for document explorer */
  async getChatFolders(
    tenantId: number,
    userId: number,
  ): Promise<{ folders: ChatFolderResponse[]; total: number }> {
    this.logger.debug(`Getting chat folders for user ${userId}`);

    const folders = await this.databaseService.query<ChatFolderResponse>(
      `SELECT DISTINCT ON (c.id)
         c.id as "conversationId",
         c.uuid as "conversationUuid",
         COALESCE(u.first_name || ' ' || u.last_name, u.username) as "participantName",
         u.id as "participantId",
         (COUNT(d.id) OVER (PARTITION BY c.id))::integer as "attachmentCount",
         c.is_group as "isGroup",
         c.name as "groupName"
       FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id
       JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id != $1
       JOIN users u ON cp2.user_id = u.id
       LEFT JOIN documents d ON d.conversation_id = c.id AND d.is_active = 1
       WHERE cp.user_id = $1 AND c.tenant_id = $2
       AND EXISTS (SELECT 1 FROM documents WHERE conversation_id = c.id AND is_active = 1)
       ORDER BY c.id, c.updated_at DESC`,
      [userId, tenantId],
    );

    return { folders, total: folders.length };
  }

  /** Create a new document */
  async createDocument(
    data: DocumentCreateInput,
    userId: number,
    tenantId: number,
  ): Promise<DocumentResponse> {
    this.logger.log(`Creating document for tenant ${tenantId}`);
    validateDocumentInput(data);

    if (data.storageType === 'filesystem' && data.filePath !== undefined) {
      await this.storageService.writeFileToDisk(
        data.filePath,
        data.fileContent,
      );
    }

    const documentId = await insertDocumentRecord(
      this.databaseService,
      data,
      userId,
      tenantId,
    );
    const createdDocument = await this.getDocumentById(
      documentId,
      tenantId,
      userId,
    );

    eventBus.emitDocumentUploaded(tenantId, {
      id: documentId,
      filename: data.originalName,
      category: data.category,
    });

    // Create persistent notification for ADR-004
    this.notificationService.createUploadNotification(
      data,
      documentId,
      tenantId,
      userId,
    );

    // Log activity to root_logs
    await this.activityLogger.logCreate(
      tenantId,
      userId,
      'document',
      documentId,
      `Dokument hochgeladen: ${data.originalName}`,
      {
        filename: data.originalName,
        category: data.category,
        accessScope: data.accessScope,
      },
    );

    return createdDocument;
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Resolve document ID from UUID.
   * @throws NotFoundException if document not found
   */
  private async resolveDocumentIdByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<number> {
    const result = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM documents WHERE uuid = $1 AND tenant_id = $2`,
      [uuid, tenantId],
    );
    const doc = result[0];
    if (doc === undefined) {
      throw new NotFoundException(ERROR_DOCUMENT_NOT_FOUND);
    }
    return doc.id;
  }

  /**
   * Get user by ID.
   * SECURITY: Only returns data for ACTIVE users (is_active = 1).
   */
  private async getUserById(
    userId: number,
    tenantId: number,
  ): Promise<{ role: string } | null> {
    const rows = await this.databaseService.query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [userId, tenantId],
    );
    return rows[0] ?? null;
  }
}
