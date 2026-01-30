/**
 * Blackboard Comments Service
 *
 * Handles comment operations for blackboard entries.
 * CRUD operations for comments attached to entries.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { ERROR_ENTRY_NOT_FOUND } from './blackboard.constants.js';
import { transformComment } from './blackboard.helpers.js';
import type {
  BlackboardComment,
  DbBlackboardComment,
} from './blackboard.types.js';

@Injectable()
export class BlackboardCommentsService {
  private readonly logger = new Logger(BlackboardCommentsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get comments for an entry.
   */
  async getComments(
    id: number | string,
    tenantId: number,
  ): Promise<BlackboardComment[]> {
    this.logger.debug(`Getting comments for entry ${String(id)}`);

    // Get numeric ID
    const numericId = await this.resolveEntryId(id, tenantId);
    if (numericId === null) {
      return [];
    }

    const comments = await this.db.query<DbBlackboardComment>(
      `SELECT c.id, c.tenant_id, c.entry_id, c.user_id, c.comment, c.is_internal, c.created_at,
              u.username as user_name,
              u.first_name as user_first_name,
              u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_full_name,
              u.role as user_role,
              u.profile_picture as user_profile_picture
       FROM blackboard_comments c
       LEFT JOIN users u ON c.user_id = u.id AND u.tenant_id = c.tenant_id
       WHERE c.entry_id = $1 AND c.tenant_id = $2
       ORDER BY c.created_at ASC`,
      [numericId, tenantId],
    );

    return comments.map((c: DbBlackboardComment) => transformComment(c));
  }

  /**
   * Add a comment to an entry.
   */
  async addComment(
    id: number | string,
    userId: number,
    tenantId: number,
    comment: string,
    isInternal: boolean,
  ): Promise<{ id: number; message: string }> {
    this.logger.log(`Adding comment to entry ${String(id)}`);

    // Get numeric ID
    const numericId = await this.resolveEntryId(id, tenantId);
    if (numericId === null) {
      throw new NotFoundException(ERROR_ENTRY_NOT_FOUND);
    }

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO blackboard_comments (tenant_id, entry_id, user_id, comment, is_internal)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [tenantId, numericId, userId, comment, isInternal ? 1 : 0],
    );

    if (rows[0] === undefined) {
      throw new Error('Failed to add comment');
    }

    return { id: rows[0].id, message: 'Comment added successfully' };
  }

  /**
   * Delete a comment.
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
