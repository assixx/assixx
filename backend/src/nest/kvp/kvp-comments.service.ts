/**
 * KVP Comments Sub-Service
 *
 * Manages comments on KVP suggestions. Own bounded context with kvp_comments table.
 * Called by KvpService facade — never directly by the controller.
 */
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { DbComment, KVPComment } from './kvp.types.js';

@Injectable()
export class KvpCommentsService {
  private readonly logger = new Logger(KvpCommentsService.name);

  constructor(private readonly db: DatabaseService) {}

  /** Get comments for a suggestion */
  async getComments(
    numericId: number,
    tenantId: number,
    userRole: string,
  ): Promise<KVPComment[]> {
    this.logger.debug(`Getting comments for suggestion ${numericId}`);

    let query = `
      SELECT c.*, u.first_name, u.last_name, u.role, u.profile_picture
      FROM kvp_comments c
      JOIN kvp_suggestions s ON c.suggestion_id = s.id
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.suggestion_id = $1 AND s.tenant_id = $2
    `;

    if (userRole === 'employee') {
      query += ' AND c.is_internal = FALSE';
    }

    query += ' ORDER BY c.created_at ASC';

    const rows = await this.db.query<DbComment>(query, [numericId, tenantId]);

    return rows.map((row: DbComment) => {
      const comment: KVPComment = {
        id: row.id,
        suggestionId: row.suggestion_id,
        comment: row.comment,
        isInternal: row.is_internal,
        createdBy: row.user_id,
        createdAt: row.created_at.toISOString(),
      };
      if (row.first_name !== undefined) comment.createdByName = row.first_name;
      if (row.last_name !== undefined)
        comment.createdByLastname = row.last_name;
      if (row.profile_picture !== undefined)
        comment.profilePicture = row.profile_picture;
      return comment;
    });
  }

  /** Add a comment to a suggestion (only admin and root, Defense in Depth) */
  async addComment(
    numericId: number,
    userId: number,
    tenantId: number,
    comment: string,
    isInternal: boolean,
    userRole: string,
  ): Promise<KVPComment> {
    this.logger.log(`Adding comment to suggestion ${numericId}`);

    // Security: Only admin/root can add comments (Defense in Depth - also enforced at controller level)
    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException(
        'Only admins can add comments to KVP suggestions',
      );
    }

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO kvp_comments (tenant_id, suggestion_id, user_id, comment, is_internal)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [tenantId, numericId, userId, comment, isInternal],
    );

    if (rows[0] === undefined) {
      throw new Error('Failed to add comment');
    }

    return {
      id: rows[0].id,
      suggestionId: numericId,
      comment,
      isInternal,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
  }
}
