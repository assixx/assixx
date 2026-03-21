/**
 * KVP Comments Sub-Service
 *
 * Manages comments on KVP suggestions. Supports threaded comments (parent_id) and pagination.
 * Called by KvpService facade — never directly by the controller.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { DbComment, KVPComment, PaginatedKVPComments } from './kvp.types.js';

/** Shared SELECT columns for comment queries */
const COMMENT_SELECT = `
  c.*, u.first_name, u.last_name, u.role, u.profile_picture,
  (SELECT COUNT(*)::int FROM kvp_comments r WHERE r.parent_id = c.id) AS reply_count
`;

const COMMENT_JOIN = `
  FROM kvp_comments c
  JOIN kvp_suggestions s ON c.suggestion_id = s.id
  LEFT JOIN users u ON c.user_id = u.id
`;

/** Map a DB comment row to the API response shape */
function mapComment(row: DbComment): KVPComment {
  const comment: KVPComment = {
    id: row.id,
    suggestionId: row.suggestion_id,
    comment: row.comment,
    isInternal: row.is_internal,
    parentId: row.parent_id,
    replyCount: row.reply_count ?? 0,
    createdBy: row.user_id,
    createdAt: row.created_at.toISOString(),
  };
  if (row.first_name !== undefined) comment.createdByName = row.first_name;
  if (row.last_name !== undefined) comment.createdByLastname = row.last_name;
  if (row.profile_picture !== undefined) comment.profilePicture = row.profile_picture;
  return comment;
}

@Injectable()
export class KvpCommentsService {
  private readonly logger = new Logger(KvpCommentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /**
   * Get top-level comments for a suggestion with pagination.
   * Only returns comments where parent_id IS NULL.
   * Employees cannot see internal comments.
   */
  async getComments(
    numericId: number,
    tenantId: number,
    userRole: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<PaginatedKVPComments> {
    this.logger.debug(`Getting comments for suggestion ${numericId}`);

    const internalFilter = userRole === 'employee' ? ' AND c.is_internal = FALSE' : '';

    const [countResult, rows] = await Promise.all([
      this.db.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM kvp_comments c
         JOIN kvp_suggestions s ON c.suggestion_id = s.id
         WHERE c.suggestion_id = $1 AND s.tenant_id = $2
           AND c.parent_id IS NULL${internalFilter}`,
        [numericId, tenantId],
      ),
      this.db.query<DbComment>(
        `SELECT ${COMMENT_SELECT}
         ${COMMENT_JOIN}
         WHERE c.suggestion_id = $1 AND s.tenant_id = $2
           AND c.parent_id IS NULL${internalFilter}
         ORDER BY c.created_at DESC
         LIMIT $3 OFFSET $4`,
        [numericId, tenantId, limit, offset],
      ),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      comments: rows.map(mapComment),
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get all replies for a top-level comment.
   * Sorted by created_at ASC (oldest first).
   */
  async getReplies(commentId: number, tenantId: number, userRole: string): Promise<KVPComment[]> {
    this.logger.debug(`Getting replies for comment ${commentId}`);

    const internalFilter = userRole === 'employee' ? ' AND c.is_internal = FALSE' : '';

    const rows = await this.db.query<DbComment>(
      `SELECT ${COMMENT_SELECT}
       ${COMMENT_JOIN}
       WHERE c.parent_id = $1 AND s.tenant_id = $2${internalFilter}
       ORDER BY c.created_at ASC`,
      [commentId, tenantId],
    );

    return rows.map(mapComment);
  }

  /**
   * Add a comment (or reply) to a suggestion.
   * Access: PermissionGuard enforces kvp-comments.canWrite.
   * Internal comments are restricted to admin/root — employees are forced to isInternal=false.
   * When parentId is provided, validates the parent belongs to the same suggestion.
   */
  async addComment(
    numericId: number,
    userId: number,
    tenantId: number,
    comment: string,
    isInternal: boolean,
    userRole: string,
    parentId?: number,
  ): Promise<KVPComment> {
    this.logger.log(`Adding comment to suggestion ${numericId}`);

    const safeIsInternal = userRole === 'admin' || userRole === 'root' ? isInternal : false;

    if (parentId !== undefined) {
      const parentRows = await this.db.query<{ suggestion_id: number }>(
        `SELECT suggestion_id FROM kvp_comments
         WHERE id = $1`,
        [parentId],
      );

      if (parentRows[0] === undefined) {
        throw new BadRequestException('Parent comment not found');
      }
      if (parentRows[0].suggestion_id !== numericId) {
        throw new BadRequestException('Parent comment does not belong to this suggestion');
      }
    }

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO kvp_comments (tenant_id, suggestion_id, user_id, comment, is_internal, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [tenantId, numericId, userId, comment, safeIsInternal, parentId ?? null],
    );

    if (rows[0] === undefined) {
      throw new Error('Failed to add comment');
    }

    void this.activityLogger.logCreate(
      tenantId,
      userId,
      'kvp',
      numericId,
      `KVP-Kommentar erstellt: Vorschlag ${String(numericId)}`,
      { suggestionId: numericId, commentId: rows[0].id },
    );

    return {
      id: rows[0].id,
      suggestionId: numericId,
      comment,
      isInternal: safeIsInternal,
      parentId: parentId ?? null,
      replyCount: 0,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
  }
}
