/**
 * Work Orders Comments Service
 *
 * Handles user comments and documentation on work orders.
 * Status-change comments are created automatically by WorkOrderStatusService.
 * Supports one-level-deep reply threading (parent_id).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { mapCommentRowToApi } from './work-orders.helpers.js';
import type { WorkOrderComment, WorkOrderCommentWithNameRow } from './work-orders.types.js';

/** Paginated comment list */
export interface PaginatedComments {
  items: WorkOrderComment[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class WorkOrderCommentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /** Add a user comment (or reply) to a work order */
  async addComment(
    tenantId: number,
    userId: number,
    workOrderUuid: string,
    content: string,
    parentId?: number,
  ): Promise<WorkOrderComment> {
    const wo = await this.resolveWorkOrder(tenantId, workOrderUuid);

    if (parentId !== undefined) {
      await this.validateParent(wo.id, parentId);
    }

    const row = await this.db.queryOne<WorkOrderCommentWithNameRow>(
      `INSERT INTO work_order_comments
         (uuid, tenant_id, work_order_id, user_id, content, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *,
         (SELECT first_name FROM users WHERE id = $4) AS first_name,
         (SELECT last_name FROM users WHERE id = $4) AS last_name,
         (SELECT profile_picture FROM users WHERE id = $4) AS profile_picture,
         '0' AS reply_count`,
      [uuidv7(), tenantId, wo.id, userId, content, parentId ?? null],
    );

    if (row === null) {
      throw new NotFoundException('Kommentar konnte nicht erstellt werden');
    }

    void this.activityLogger.logCreate(
      tenantId,
      userId,
      'work_order_comment',
      wo.id,
      `Kommentar zu "${wo.title}" hinzugefügt`,
      { workOrderUuid },
    );

    return mapCommentRowToApi(row);
  }

  /** List top-level comments for a work order (paginated, chronological) */
  async listComments(
    tenantId: number,
    workOrderUuid: string,
    page: number,
    limit: number,
  ): Promise<PaginatedComments> {
    const wo = await this.resolveWorkOrder(tenantId, workOrderUuid);
    const offset = (page - 1) * limit;

    const countResult = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM work_order_comments
       WHERE work_order_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE} AND parent_id IS NULL`,
      [wo.id],
    );
    const total = Number.parseInt(countResult?.count ?? '0', 10);

    const rows = await this.db.query<WorkOrderCommentWithNameRow>(
      `SELECT c.*, u.first_name, u.last_name, u.profile_picture,
              (SELECT COUNT(*)::text FROM work_order_comments r
               WHERE r.parent_id = c.id AND r.is_active = ${IS_ACTIVE.ACTIVE}) AS reply_count
       FROM work_order_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.work_order_id = $1 AND c.is_active = ${IS_ACTIVE.ACTIVE} AND c.parent_id IS NULL
       ORDER BY c.created_at ASC
       LIMIT $2 OFFSET $3`,
      [wo.id, limit, offset],
    );

    return {
      items: rows.map(mapCommentRowToApi),
      total,
      page,
      pageSize: limit,
    };
  }

  /** List replies for a specific comment (all, no pagination) */
  async listReplies(
    tenantId: number,
    workOrderUuid: string,
    commentId: number,
  ): Promise<WorkOrderComment[]> {
    const wo = await this.resolveWorkOrder(tenantId, workOrderUuid);

    const rows = await this.db.query<WorkOrderCommentWithNameRow>(
      `SELECT c.*, u.first_name, u.last_name, u.profile_picture,
              '0' AS reply_count
       FROM work_order_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.work_order_id = $1 AND c.parent_id = $2 AND c.is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY c.created_at ASC`,
      [wo.id, commentId],
    );

    return rows.map(mapCommentRowToApi);
  }

  /** Soft-delete a comment (own comment or admin) */
  async deleteComment(
    tenantId: number,
    userId: number,
    commentUuid: string,
    isAdmin: boolean,
  ): Promise<void> {
    const comment = await this.db.queryOne<{
      id: number;
      user_id: number;
      work_order_id: number;
    }>(
      `SELECT id, user_id, work_order_id FROM work_order_comments
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [commentUuid, tenantId],
    );

    if (comment === null) {
      throw new NotFoundException('Kommentar nicht gefunden');
    }

    if (comment.user_id !== userId && !isAdmin) {
      throw new ForbiddenException('Nur eigene Kommentare können gelöscht werden');
    }

    await this.db.query(
      `UPDATE work_order_comments SET is_active = ${IS_ACTIVE.DELETED}
       WHERE id = $1`,
      [comment.id],
    );

    void this.activityLogger.logDelete(
      tenantId,
      userId,
      'work_order_comment',
      comment.work_order_id,
      `Kommentar gelöscht`,
      { commentUuid },
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private async resolveWorkOrder(
    tenantId: number,
    uuid: string,
  ): Promise<{ id: number; title: string }> {
    const row = await this.db.queryOne<{ id: number; title: string }>(
      `SELECT id, title FROM work_orders
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [uuid, tenantId],
    );
    if (row === null) {
      throw new NotFoundException('Arbeitsauftrag nicht gefunden');
    }
    return row;
  }

  /** Validate that parent comment exists, belongs to same work order, and is top-level */
  private async validateParent(workOrderId: number, parentId: number): Promise<void> {
    const parent = await this.db.queryOne<{
      id: number;
      parent_id: number | null;
    }>(
      `SELECT id, parent_id FROM work_order_comments
       WHERE id = $1 AND work_order_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [parentId, workOrderId],
    );

    if (parent === null) {
      throw new NotFoundException('Elternkommentar nicht gefunden');
    }

    if (parent.parent_id !== null) {
      throw new BadRequestException('Antworten auf Antworten sind nicht erlaubt (nur eine Ebene)');
    }
  }
}
