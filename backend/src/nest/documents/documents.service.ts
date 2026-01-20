/* eslint-disable max-lines */
/**
 * Documents Service
 *
 * Native NestJS implementation for document management.
 * No Express dependencies - uses DatabaseService directly.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import fs from 'fs/promises';
import path from 'path';

import { eventBus } from '../../utils/eventBus.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
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
  accessScope: 'personal' | 'team' | 'department' | 'company' | 'payroll' | 'blackboard' | 'chat';
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
interface DocumentFilters {
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

const ALLOWED_CATEGORIES = [
  'general',
  'contract',
  'certificate',
  'payroll',
  'training',
  'other',
  'blackboard',
  'chat',
];

const ERROR_USER_NOT_FOUND = 'User not found';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

// ============================================
// Service
// ============================================

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ============================================
  // Public Methods
  // ============================================

  /**
   * List documents with filters and pagination
   */
  async listDocuments(
    tenantId: number,
    userId: number,
    query: ListDocumentsQueryDto,
  ): Promise<PaginatedDocumentsResult> {
    this.logger.log(`Listing documents for tenant ${tenantId}, user ${userId}`);

    const page = query.page;
    const limit = query.limit;
    const offset = (page - 1) * limit;
    const isActive = query.isActive;

    const user = await this.getUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_USER_NOT_FOUND);
    }
    const isAdmin = user.role === 'admin' || user.role === 'root';
    const filters = this.buildDocumentFilters(query, isActive);

    const { baseQuery, params, paramIndex } = this.buildDocumentQuery(
      tenantId,
      isActive,
      filters,
      isAdmin,
      userId,
    );
    const total = await this.getDocumentsCount(baseQuery, params);

    const paginatedQuery = `${baseQuery} ORDER BY d.uploaded_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const documents = await this.databaseService.query<DbDocument>(paginatedQuery, [
      ...params,
      limit,
      offset,
    ]);
    const apiDocuments = await Promise.all(
      documents.map((doc: DbDocument) => this.enrichDocument(doc, userId, tenantId)),
    );

    return {
      documents: apiDocuments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Build document filters from query parameters */
  private buildDocumentFilters(query: ListDocumentsQueryDto, isActive: number): DocumentFilters {
    return {
      isActive,
      category: query.category,
      accessScope: query.accessScope,
      ownerUserId: query.ownerUserId,
      targetTeamId: query.targetTeamId,
      targetDepartmentId: query.targetDepartmentId,
      salaryYear: query.salaryYear,
      salaryMonth: query.salaryMonth,
      blackboardEntryId: query.blackboardEntryId,
      conversationId: query.conversationId,
      search: query.search,
    };
  }

  /** Build document query with filters and access control */
  private buildDocumentQuery(
    tenantId: number,
    isActive: number,
    filters: DocumentFilters,
    isAdmin: boolean,
    userId: number,
  ): { baseQuery: string; params: unknown[]; paramIndex: number } {
    let baseQuery = `
      SELECT d.*, u.username as uploaded_by_name
      FROM documents d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.tenant_id = $1 AND d.is_active = $2
    `;
    const params: unknown[] = [tenantId, isActive];
    let paramIndex = 3;

    const filterResult = this.applyDocumentFilters(baseQuery, params, paramIndex, filters);
    baseQuery = filterResult.baseQuery;
    paramIndex = filterResult.paramIndex;

    if (!isAdmin) {
      baseQuery += ` AND (
        d.access_scope = 'company' OR
        (d.access_scope = 'personal' AND d.owner_user_id = $${paramIndex}) OR
        (d.access_scope = 'payroll' AND d.owner_user_id = $${paramIndex})
      )`;
      params.push(userId);
      paramIndex++;
    }

    return { baseQuery, params, paramIndex };
  }

  /** Apply document filters to query */
  private applyDocumentFilters(
    baseQuery: string,
    params: unknown[],
    paramIndex: number,
    filters: DocumentFilters,
  ): { baseQuery: string; paramIndex: number } {
    let query = baseQuery;
    let idx = paramIndex;

    if (filters.category !== undefined) {
      query += ` AND d.category = $${idx}`;
      params.push(filters.category);
      idx++;
    }
    if (filters.accessScope !== undefined) {
      query += ` AND d.access_scope = $${idx}`;
      params.push(filters.accessScope);
      idx++;
    }
    if (filters.ownerUserId !== undefined) {
      query += ` AND d.owner_user_id = $${idx}`;
      params.push(filters.ownerUserId);
      idx++;
    }
    if (filters.blackboardEntryId !== undefined) {
      query += ` AND d.blackboard_entry_id = $${idx}`;
      params.push(filters.blackboardEntryId);
      idx++;
    }
    if (filters.conversationId !== undefined) {
      query += ` AND d.conversation_id = $${idx}`;
      params.push(filters.conversationId);
      idx++;
    }
    if (filters.search !== undefined && filters.search !== '') {
      query += ` AND (d.filename ILIKE $${idx} OR d.original_name ILIKE $${idx} OR d.description ILIKE $${idx})`;
      params.push(`%${filters.search}%`);
      idx++;
    }

    return { baseQuery: query, paramIndex: idx };
  }

  /** Get total count of documents matching query */
  private async getDocumentsCount(baseQuery: string, params: unknown[]): Promise<number> {
    const countQuery = baseQuery.replace(
      'SELECT d.*, u.username as uploaded_by_name',
      'SELECT COUNT(*) as count',
    );
    const countResult = await this.databaseService.query<{ count: string }>(countQuery, params);
    return Number.parseInt(countResult[0]?.count ?? '0', 10);
  }

  /**
   * Get document by ID
   */
  async getDocumentById(
    documentId: number,
    tenantId: number,
    userId: number,
  ): Promise<DocumentResponse> {
    this.logger.log(`Getting document ${documentId} for tenant ${tenantId}`);

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
    const hasAccess = await this.checkDocumentAccess(document, userId, tenantId);
    if (!hasAccess) {
      throw new ForbiddenException("You don't have access to this document");
    }

    // Mark as read
    await this.markDocumentAsRead(documentId, tenantId, userId);

    return await this.enrichDocument(document, userId, tenantId);
  }

  /**
   * Get document by file UUID
   */
  async getDocumentByFileUuid(
    fileUuid: string,
    tenantId: number,
    userId: number,
  ): Promise<DocumentResponse | null> {
    this.logger.log(`Getting document by fileUuid ${fileUuid}`);

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
    const hasAccess = await this.checkDocumentAccess(document, userId, tenantId);
    if (!hasAccess) {
      return null;
    }

    return await this.enrichDocument(document, userId, tenantId);
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    documentId: number,
    dto: UpdateDocumentDto,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Updating document ${documentId}`);

    const document = await this.getDocumentRow(documentId, tenantId);
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
      throw new ForbiddenException("You don't have permission to update this document");
    }

    // Build and execute update
    const { updates, params, paramIndex } = this.buildDocumentUpdateClause(dto);
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

  /**
   * Delete a document (soft delete)
   */
  async deleteDocument(
    documentId: number,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting document ${documentId}`);

    const document = await this.getDocumentRow(documentId, tenantId);
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

  /**
   * Archive a document
   */
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

  /**
   * Unarchive a document
   */
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
      throw new ForbiddenException('Only administrators can unarchive documents');
    }

    await this.databaseService.query(
      `UPDATE documents SET is_active = 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId],
    );

    return { message: 'Document unarchived successfully' };
  }

  /**
   * Get document content for download
   */
  async getDocumentContent(
    documentId: number,
    tenantId: number,
    userId: number,
  ): Promise<DocumentContentResponse> {
    this.logger.log(`Getting document content ${documentId}`);

    const document = await this.getDocumentRow(documentId, tenantId);
    if (document === null) {
      throw new NotFoundException(ERROR_DOCUMENT_NOT_FOUND);
    }

    const hasAccess = await this.checkDocumentAccess(document, userId, tenantId);
    if (!hasAccess) {
      throw new ForbiddenException("You don't have access to this document");
    }

    // Increment download count
    await this.databaseService.query(
      `UPDATE documents SET download_count = download_count + 1 WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId],
    );

    // Get content
    const content = await this.resolveFileContent(document);

    return {
      content,
      originalName: document.original_name ?? document.filename,
      mimeType: document.mime_type ?? 'application/octet-stream',
      fileSize: document.file_size ?? 0,
    };
  }

  /**
   * Mark document as read
   */
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

  /**
   * Resolve document ID from UUID
   * @throws NotFoundException if document not found
   */
  private async resolveDocumentIdByUuid(uuid: string, tenantId: number): Promise<number> {
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
   * Get document by UUID
   */
  async getDocumentByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<DocumentResponse> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.getDocumentById(documentId, tenantId, userId);
  }

  /**
   * Update document by UUID
   */
  async updateDocumentByUuid(
    uuid: string,
    dto: UpdateDocumentDto,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.updateDocument(documentId, dto, tenantId, userId);
  }

  /**
   * Delete document by UUID
   */
  async deleteDocumentByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.deleteDocument(documentId, tenantId, userId);
  }

  /**
   * Archive document by UUID
   */
  async archiveDocumentByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.archiveDocument(documentId, tenantId, userId);
  }

  /**
   * Unarchive document by UUID
   */
  async unarchiveDocumentByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.unarchiveDocument(documentId, tenantId, userId);
  }

  /**
   * Get document content by UUID
   */
  async getDocumentContentByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<DocumentContentResponse> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.getDocumentContent(documentId, tenantId, userId);
  }

  /**
   * Mark document as read by UUID
   */
  async markDocumentAsReadByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<{ success: boolean }> {
    const documentId = await this.resolveDocumentIdByUuid(uuid, tenantId);
    return await this.markDocumentAsRead(documentId, tenantId, userId);
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(tenantId: number, userId: number): Promise<DocumentStatsResponse> {
    this.logger.log(`Getting document stats for tenant ${tenantId}`);

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
    const categoryResults = await this.databaseService.query<{ category: string; count: string }>(
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
   * Get count of unread documents for notification badge
   * Applies the same access_scope filter as listDocuments to ensure consistency
   */
  async getUnreadCount(
    tenantId: number,
    userId: number,
    userRole: 'root' | 'admin' | 'employee',
  ): Promise<UnreadCountResponse> {
    this.logger.log(`Getting unread document count for user ${userId} (role: ${userRole})`);

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

    // Apply access scope filter for non-admin users (same logic as buildDocumentsBaseQuery)
    if (!isAdmin) {
      query += ` AND (
        d.access_scope = 'company' OR
        (d.access_scope = 'personal' AND d.owner_user_id = $3) OR
        (d.access_scope = 'payroll' AND d.owner_user_id = $3)
      )`;
      params.push(userId);
    }

    const result = await this.databaseService.query<{ count: string }>(query, params);
    const count = Number.parseInt(result[0]?.count ?? '0', 10);

    return { count };
  }

  /**
   * Get chat folders for document explorer
   */
  async getChatFolders(
    tenantId: number,
    userId: number,
  ): Promise<{ folders: ChatFolderResponse[]; total: number }> {
    this.logger.log(`Getting chat folders for user ${userId}`);

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

  /**
   * Create a new document
   */
  async createDocument(
    data: DocumentCreateInput,
    userId: number,
    tenantId: number,
  ): Promise<DocumentResponse> {
    this.logger.log(`Creating document for tenant ${tenantId}`);
    this.validateDocumentInput(data);

    if (data.storageType === 'filesystem' && data.filePath !== undefined) {
      await this.writeFileToDisk(data.filePath, data.fileContent);
    }

    const documentId = await this.insertDocumentRecord(data, userId, tenantId);
    const createdDocument = await this.getDocumentById(documentId, tenantId, userId);

    eventBus.emitDocumentUploaded(tenantId, {
      id: documentId,
      filename: data.originalName,
      category: data.category,
    });

    // Create persistent notification for ADR-004
    const recipientMapping = this.mapAccessScopeToRecipient(data);
    if (recipientMapping !== null) {
      void this.notificationsService.createFeatureNotification(
        'document',
        documentId,
        `Neues Dokument: ${data.originalName}`,
        `Kategorie: ${data.category}`,
        recipientMapping.type,
        recipientMapping.id,
        tenantId,
        userId,
      );
    }

    return createdDocument;
  }

  /**
   * Map document access scope to notification recipient
   * Returns null for scopes that don't need notifications (payroll, blackboard, chat)
   */
  private mapAccessScopeToRecipient(
    data: DocumentCreateInput,
  ): { type: 'user' | 'department' | 'team' | 'all'; id: number | null } | null {
    switch (data.accessScope) {
      case 'personal':
        return data.ownerUserId !== undefined ? { type: 'user', id: data.ownerUserId } : null;
      case 'team':
        return data.targetTeamId !== undefined ? { type: 'team', id: data.targetTeamId } : null;
      case 'department':
        return data.targetDepartmentId !== undefined ?
            { type: 'department', id: data.targetDepartmentId }
          : null;
      case 'company':
        return { type: 'all', id: null };
      default:
        // payroll, blackboard, chat have their own notification mechanisms
        return null;
    }
  }

  /** Validate document input data */
  private validateDocumentInput(data: DocumentCreateInput): void {
    if (!ALLOWED_CATEGORIES.includes(data.category)) {
      throw new BadRequestException('Invalid document category');
    }
    if (!ALLOWED_MIME_TYPES.includes(data.mimeType)) {
      throw new BadRequestException('File type not allowed');
    }
  }

  /** Insert document record and return its ID */
  private async insertDocumentRecord(
    data: DocumentCreateInput,
    userId: number,
    tenantId: number,
  ): Promise<number> {
    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO documents (
        uuid, tenant_id, filename, original_name, file_size, mime_type, category,
        access_scope, owner_user_id, target_team_id, target_department_id,
        description, salary_year, salary_month, blackboard_entry_id, conversation_id,
        tags, created_by, file_uuid, file_checksum, file_path, storage_type, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, 1
      ) RETURNING id`,
      [
        data.fileUuid,
        tenantId,
        data.filename,
        data.originalName,
        data.fileSize,
        data.mimeType,
        data.category,
        data.accessScope,
        data.ownerUserId ??
          (data.accessScope === 'personal' || data.accessScope === 'payroll' ? userId : null),
        data.targetTeamId ?? null,
        data.targetDepartmentId ?? null,
        data.description ?? null,
        data.salaryYear ?? null,
        data.salaryMonth ?? null,
        data.blackboardEntryId ?? null,
        data.conversationId ?? null,
        data.tags !== undefined ? JSON.stringify(data.tags) : null,
        userId,
        data.fileUuid ?? null,
        data.fileChecksum ?? null,
        data.filePath ?? null,
        data.storageType ?? 'filesystem',
      ],
    );

    const documentId = result[0]?.id;
    if (documentId === undefined) {
      throw new Error('Failed to create document');
    }
    return documentId;
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /** Build document update clause from DTO */
  private buildDocumentUpdateClause(dto: UpdateDocumentDto): {
    updates: string[];
    params: unknown[];
    paramIndex: number;
  } {
    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (dto.filename !== undefined) {
      updates.push(`filename = $${paramIndex++}`);
      params.push(dto.filename);
    }
    if (dto.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      params.push(dto.category);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(dto.description);
    }
    if (dto.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(JSON.stringify(dto.tags));
    }

    return { updates, params, paramIndex };
  }

  /**
   * Get user by ID
   */
  private async getUserById(userId: number, tenantId: number): Promise<{ role: string } | null> {
    const rows = await this.databaseService.query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    return rows[0] ?? null;
  }

  /**
   * Get document row by ID
   */
  private async getDocumentRow(documentId: number, tenantId: number): Promise<DbDocument | null> {
    const rows = await this.databaseService.query<DbDocument>(
      `SELECT * FROM documents WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId],
    );
    return rows[0] ?? null;
  }

  /**
   * Check document access
   */
  private async checkDocumentAccess(
    document: DbDocument,
    userId: number,
    tenantId: number,
  ): Promise<boolean> {
    const user = await this.getUserById(userId, tenantId);
    if (user === null) return false;

    // Admins can access all
    if (user.role === 'admin' || user.role === 'root') {
      return true;
    }

    switch (document.access_scope) {
      case 'personal':
      case 'payroll':
        return document.owner_user_id === userId;
      case 'company':
        return true;
      case 'team':
        // Simplified - would need team membership check
        return true;
      case 'department':
        // Simplified - would need department membership check
        return true;
      case 'chat':
        if (document.conversation_id === null) return false;
        return await this.isConversationParticipant(userId, document.conversation_id, tenantId);
      default:
        return false;
    }
  }

  /**
   * Check if user is conversation participant
   */
  private async isConversationParticipant(
    userId: number,
    conversationId: number,
    tenantId: number,
  ): Promise<boolean> {
    const rows = await this.databaseService.query<{ user_id: number }>(
      `SELECT user_id FROM conversation_participants cp
       JOIN conversations c ON cp.conversation_id = c.id
       WHERE cp.conversation_id = $1 AND cp.user_id = $2 AND c.tenant_id = $3`,
      [conversationId, userId, tenantId],
    );
    return rows.length > 0;
  }

  /**
   * Check if document is read
   */
  private async isDocumentRead(
    documentId: number,
    userId: number,
    tenantId: number,
  ): Promise<boolean> {
    const rows = await this.databaseService.query<{ read_at: Date }>(
      `SELECT read_at FROM document_read_status
       WHERE document_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [documentId, userId, tenantId],
    );
    return rows.length > 0;
  }

  /**
   * Parse tags from JSONB field
   * Handles both already-parsed arrays and string fallback
   */
  private parseTags(tags: unknown): string[] {
    if (tags === null || tags === undefined) {
      return [];
    }

    // PostgreSQL JSONB returns already-parsed objects
    if (Array.isArray(tags)) {
      return tags.filter((t: unknown): t is string => typeof t === 'string');
    }

    // Fallback: if somehow it's a string, try to parse
    if (typeof tags === 'string') {
      try {
        const parsed: unknown = JSON.parse(tags);
        if (Array.isArray(parsed)) {
          return parsed.filter((t: unknown): t is string => typeof t === 'string');
        }
        return [];
      } catch {
        return [];
      }
    }

    return [];
  }

  /**
   * Enrich document with metadata
   */
  private async enrichDocument(
    doc: DbDocument,
    userId: number,
    tenantId: number,
  ): Promise<DocumentResponse> {
    const isRead = await this.isDocumentRead(doc.id, userId, tenantId);
    const tags = this.parseTags(doc.tags);

    // Get extension from original_name for storedFilename construction
    const extension =
      doc.original_name !== null && doc.original_name !== '' ?
        doc.original_name.substring(doc.original_name.lastIndexOf('.'))
      : '';

    return {
      id: doc.id,
      tenantId: doc.tenant_id,
      filename: doc.filename, // Display name (custom or original)
      storedFilename:
        doc.file_uuid !== null && doc.file_uuid !== '' ?
          `${doc.file_uuid}${extension}`
        : doc.filename,
      originalName: doc.original_name,
      fileSize: doc.file_size,
      mimeType: doc.mime_type,
      category: doc.category,
      accessScope: doc.access_scope,
      ownerUserId: doc.owner_user_id,
      targetTeamId: doc.target_team_id,
      targetDepartmentId: doc.target_department_id,
      description: doc.description,
      salaryYear: doc.salary_year,
      salaryMonth: doc.salary_month,
      blackboardEntryId: doc.blackboard_entry_id,
      conversationId: doc.conversation_id,
      tags,
      isActive: doc.is_active,
      createdBy: doc.created_by,
      uploaderName: doc.uploaded_by_name ?? 'Unknown',
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
      fileUuid: doc.file_uuid,
      downloadCount: doc.download_count,
      isRead,
      downloadUrl: `/api/v2/documents/${doc.id}/download`,
      previewUrl: `/api/v2/documents/${doc.id}/preview`,
    };
  }

  /**
   * Resolve file content
   */
  private async resolveFileContent(document: DbDocument): Promise<Buffer> {
    if (document.file_content !== null) {
      return document.file_content;
    }
    if (document.file_path !== null) {
      return await this.readFileFromDisk(document.file_path);
    }
    throw new NotFoundException('Document has no content or file path');
  }

  /**
   * Write file to disk
   */
  private async writeFileToDisk(filePath: string, content: Buffer): Promise<void> {
    const baseDir = process.cwd();
    const absolutePath = path.join(baseDir, filePath);

    // Security: Validate path
    if (!absolutePath.startsWith(baseDir)) {
      throw new BadRequestException('Invalid file path');
    }

    const directory = path.dirname(absolutePath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated above
    await fs.mkdir(directory, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated above
    await fs.writeFile(absolutePath, content);
  }

  /**
   * Read file from disk
   */
  private async readFileFromDisk(filePath: string): Promise<Buffer> {
    const baseDir = process.cwd();
    const absolutePath = path.join(baseDir, filePath);

    // Security: Validate path
    if (!absolutePath.startsWith(baseDir)) {
      throw new ForbiddenException('Invalid file path');
    }

    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated above
      return await fs.readFile(absolutePath);
    } catch {
      throw new NotFoundException('Document file not found');
    }
  }
}
