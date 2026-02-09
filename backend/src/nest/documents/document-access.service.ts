/**
 * Document Access Service
 *
 * Handles document access control, query building with access scope filtering,
 * and read-status checks.
 */
import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { DbDocument, DocumentFilters } from './documents.service.js';

@Injectable()
export class DocumentAccessService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Check if a user has access to a document based on access_scope.
   * Chat documents are ALWAYS private — only conversation participants
   * can access them, regardless of role (admin/root included).
   * Admins/root can access all OTHER document types.
   */
  async checkDocumentAccess(
    document: DbDocument,
    userId: number,
    tenantId: number,
  ): Promise<boolean> {
    const user = await this.getUserRole(userId, tenantId);
    if (user === null) return false;

    // Chat is ALWAYS private — check BEFORE admin bypass
    if (document.access_scope === 'chat') {
      if (document.conversation_id === null) return false;
      return await this.isConversationParticipant(
        userId,
        document.conversation_id,
        tenantId,
      );
    }

    // Admins can access all non-chat documents
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
      default:
        return false;
    }
  }

  /** Check if user is a conversation participant */
  async isConversationParticipant(
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

  /** Check if a document has been read by a user */
  async isDocumentRead(
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
   * Build document query with filters and access control.
   * Non-admin users see only documents matching their access scope.
   */
  buildDocumentQuery(
    tenantId: number,
    isActive: number,
    filters: DocumentFilters,
    isAdmin: boolean,
    userId: number,
  ): { baseQuery: string; params: unknown[]; paramIndex: number } {
    let baseQuery = `
      SELECT d.*, COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.username) as uploaded_by_name
      FROM documents d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.tenant_id = $1 AND d.is_active = $2
    `;
    const params: unknown[] = [tenantId, isActive];
    let paramIndex = 3;

    const filterResult = this.applyDocumentFilters(
      baseQuery,
      params,
      paramIndex,
      filters,
    );
    baseQuery = filterResult.baseQuery;
    paramIndex = filterResult.paramIndex;

    // Chat privacy: ALL users (including admins) can only see chat docs
    // where they are a conversation participant
    baseQuery += ` AND (
      d.access_scope != 'chat'
      OR EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = d.conversation_id AND cp.user_id = $${paramIndex}
      )
    )`;
    params.push(userId);
    paramIndex++;

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
  applyDocumentFilters(
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

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Get user role by ID.
   * SECURITY: Only returns data for ACTIVE users (is_active = 1).
   */
  private async getUserRole(
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
