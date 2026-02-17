/**
 * Blackboard Comments Service
 *
 * Handles comment operations for blackboard entries.
 * Supports threaded comments (parent_id) and pagination.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { ERROR_ENTRY_NOT_FOUND } from './blackboard.constants.js';
import { transformComment } from './blackboard.helpers.js';
import type {
  BlackboardComment,
  DbBlackboardComment,
  PaginatedBlackboardComments,
} from './blackboard.types.js';

/** Shared SELECT columns for comment queries */
const COMMENT_SELECT = `
  c.id, c.tenant_id, c.entry_id, c.user_id, c.comment,
  c.is_internal, c.parent_id, c.created_at,
  u.username AS user_name,
  u.first_name AS user_first_name,
  u.last_name AS user_last_name,
  CONCAT(u.first_name, ' ', u.last_name) AS user_full_name,
  u.role AS user_role,
  u.profile_picture AS user_profile_picture,
  (SELECT COUNT(*)::int FROM blackboard_comments r WHERE r.parent_id = c.id) AS reply_count
`;

const COMMENT_JOIN = `
  FROM blackboard_comments c
  LEFT JOIN users u ON c.user_id = u.id AND u.tenant_id = c.tenant_id
`;

@Injectable()
export class BlackboardCommentsService {
  private readonly logger = new Logger(BlackboardCommentsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get top-level comments for an entry with pagination.
   * Only returns comments where parent_id IS NULL (top-level).
   * Each comment includes a reply_count sub-query.
   */
  async getComments(
    id: number | string,
    tenantId: number,
    limit: number = 20,
    offset: number = 0,
  ): Promise<PaginatedBlackboardComments> {
    this.logger.debug(`Getting comments for entry ${String(id)}`);

    const numericId = await this.resolveEntryId(id, tenantId);
    if (numericId === null) {
      return { comments: [], total: 0, hasMore: false };
    }

    const [countResult, comments] = await Promise.all([
      this.db.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM blackboard_comments
         WHERE entry_id = $1 AND tenant_id = $2 AND parent_id IS NULL`,
        [numericId, tenantId],
      ),
      this.db.query<DbBlackboardComment>(
        `SELECT ${COMMENT_SELECT}
         ${COMMENT_JOIN}
         WHERE c.entry_id = $1 AND c.tenant_id = $2 AND c.parent_id IS NULL
         ORDER BY c.created_at DESC
         LIMIT $3 OFFSET $4`,
        [numericId, tenantId, limit, offset],
      ),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      comments: comments.map(transformComment),
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get all replies for a top-level comment.
   * Sorted by created_at ASC (oldest first).
   */
  async getReplies(
    commentId: number,
    tenantId: number,
  ): Promise<BlackboardComment[]> {
    this.logger.debug(`Getting replies for comment ${commentId}`);

    const replies = await this.db.query<DbBlackboardComment>(
      `SELECT ${COMMENT_SELECT}
       ${COMMENT_JOIN}
       WHERE c.parent_id = $1 AND c.tenant_id = $2
       ORDER BY c.created_at ASC`,
      [commentId, tenantId],
    );

    return replies.map(transformComment);
  }

  /**
   * Add a comment (or reply) to an entry.
   * When parentId is provided, validates that the parent exists
   * and belongs to the same entry.
   */
  async addComment(
    id: number | string,
    userId: number,
    tenantId: number,
    comment: string,
    isInternal: boolean,
    parentId?: number,
  ): Promise<{ id: number; message: string }> {
    this.logger.log(`Adding comment to entry ${String(id)}`);

    const numericId = await this.resolveEntryId(id, tenantId);
    if (numericId === null) {
      throw new NotFoundException(ERROR_ENTRY_NOT_FOUND);
    }

    if (parentId !== undefined) {
      const parentRows = await this.db.query<{ entry_id: number }>(
        `SELECT entry_id FROM blackboard_comments
         WHERE id = $1 AND tenant_id = $2`,
        [parentId, tenantId],
      );

      if (parentRows[0] === undefined) {
        throw new BadRequestException('Parent comment not found');
      }
      if (parentRows[0].entry_id !== numericId) {
        throw new BadRequestException(
          'Parent comment does not belong to this entry',
        );
      }
    }

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO blackboard_comments (tenant_id, entry_id, user_id, comment, is_internal, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        tenantId,
        numericId,
        userId,
        comment,
        isInternal ? 1 : 0,
        parentId ?? null,
      ],
    );

    if (rows[0] === undefined) {
      throw new Error('Failed to add comment');
    }

    return { id: rows[0].id, message: 'Comment added successfully' };
  }

  /**
   * Delete a comment. Replies cascade-delete via FK constraint.
   */
  async deleteComment(
    commentId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting comment ${commentId}`);

    await this.db.query(
      'DELETE FROM blackboard_comments WHERE id = $1 AND tenant_id = $2',
      [commentId, tenantId],
    );

    return { message: 'Comment deleted successfully' };
  }

  /**
   * Resolve entry ID (UUID or numeric) to numeric ID.
   * Returns null if entry not found.
   */
  private async resolveEntryId(
    id: number | string,
    tenantId: number,
  ): Promise<number | null> {
    if (typeof id === 'number') {
      return id;
    }

    const entries = await this.db.query<{ id: number }>(
      'SELECT id FROM blackboard_entries WHERE uuid = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    return entries[0]?.id ?? null;
  }
}
