/**
 * Work Orders Service — Core CRUD
 *
 * Handles creation, retrieval, listing, updating, and soft-deletion
 * of work orders. All queries use tenant-scoped transactions (ADR-019).
 * Returns raw data — ResponseInterceptor wraps automatically (ADR-007).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import {
  mapAssigneeRowToApi,
  mapWorkOrderRowToApi,
  mapWorkOrderRowToListItem,
} from './work-orders.helpers.js';
import type {
  WorkOrder,
  WorkOrderAssigneeWithNameRow,
  WorkOrderListItem,
  WorkOrderStats,
  WorkOrderWithCountsRow,
} from './work-orders.types.js';

// ============================================================================
// SQL Fragments
// ============================================================================

const ORDER_SELECT_SQL = `
  SELECT wo.*,
    CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
    (SELECT COUNT(*) FROM work_order_assignees a WHERE a.work_order_id = wo.id) AS assignee_count,
    (SELECT STRING_AGG(CONCAT(au.first_name, ' ', au.last_name), ', ' ORDER BY au.last_name)
       FROM work_order_assignees wa
       JOIN users au ON wa.user_id = au.id
       WHERE wa.work_order_id = wo.id) AS assignee_names,
    (SELECT COUNT(*) FROM work_order_comments c WHERE c.work_order_id = wo.id AND c.is_active = 1) AS comment_count,
    (SELECT COUNT(*) FROM work_order_photos p WHERE p.work_order_id = wo.id) AS photo_count
  FROM work_orders wo
  JOIN users u ON wo.created_by = u.id`;

// ============================================================================
// Exported types
// ============================================================================

export interface PaginatedWorkOrders {
  items: WorkOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Shared query filter shape (all optional fields accept undefined) */
interface ListQuery {
  status?: string | undefined;
  priority?: string | undefined;
  sourceType?: string | undefined;
  assigneeUuid?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

// ============================================================================
// Pure helper: dynamic WHERE clause builder
// ============================================================================

interface WhereResult {
  whereClause: string;
  params: unknown[];
  nextIdx: number;
}

function buildWhereClause(
  tenantId: number,
  forUserId: number | null,
  query: ListQuery,
): WhereResult {
  const conditions: string[] = ['wo.tenant_id = $1', 'wo.is_active = 1'];
  const params: unknown[] = [tenantId];
  let idx = 2;

  if (forUserId !== null) {
    conditions.push(
      `EXISTS (SELECT 1 FROM work_order_assignees a2
               WHERE a2.work_order_id = wo.id AND a2.user_id = $${idx++})`,
    );
    params.push(forUserId);
  }
  if (query.status !== undefined) {
    conditions.push(`wo.status = $${idx++}`);
    params.push(query.status);
  }
  if (query.priority !== undefined) {
    conditions.push(`wo.priority = $${idx++}`);
    params.push(query.priority);
  }
  if (query.sourceType !== undefined) {
    conditions.push(`wo.source_type = $${idx++}`);
    params.push(query.sourceType);
  }
  if (query.assigneeUuid !== undefined) {
    conditions.push(
      `EXISTS (SELECT 1 FROM work_order_assignees a3
               JOIN users ua ON a3.user_id = ua.id
               WHERE a3.work_order_id = wo.id AND ua.uuid = $${idx++})`,
    );
    params.push(query.assigneeUuid);
  }

  return { whereClause: conditions.join(' AND '), params, nextIdx: idx };
}

// ============================================================================
// Service
// ============================================================================

/** DTO shape for createWorkOrder — all optional fields accept undefined */
interface CreateDto {
  title: string;
  description?: string | null | undefined;
  priority?: string | undefined;
  sourceType?: string | undefined;
  sourceUuid?: string | null | undefined;
  dueDate?: string | null | undefined;
  assigneeUuids?: string[] | undefined;
}

/** DTO shape for updateWorkOrder — all fields optional + undefined */
interface UpdateDto {
  title?: string | undefined;
  description?: string | null | undefined;
  priority?: string | undefined;
  dueDate?: string | null | undefined;
}

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /** Create a work order, optionally with initial assignees */
  async createWorkOrder(
    tenantId: number,
    userId: number,
    dto: CreateDto,
  ): Promise<WorkOrder> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<WorkOrder> => {
        const order = await this.insertWorkOrder(client, tenantId, userId, dto);
        const assignees = await this.insertAssignees(
          client,
          tenantId,
          order.id,
          userId,
          dto.assigneeUuids ?? [],
        );

        void this.activityLogger.logCreate(
          tenantId,
          userId,
          'work_order',
          order.id,
          `Arbeitsauftrag "${dto.title}" erstellt`,
          { uuid: order.uuid, title: dto.title, priority: dto.priority },
        );

        return mapWorkOrderRowToApi(order, assignees.map(mapAssigneeRowToApi));
      },
    );
  }

  /** Get a single work order by UUID with full enrichment */
  async getWorkOrder(tenantId: number, uuid: string): Promise<WorkOrder> {
    const row = await this.db.queryOne<WorkOrderWithCountsRow>(
      `${ORDER_SELECT_SQL}
       WHERE wo.uuid = $1 AND wo.tenant_id = $2 AND wo.is_active = 1`,
      [uuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException('Arbeitsauftrag nicht gefunden');
    }

    const assigneeRows = await this.db.query<WorkOrderAssigneeWithNameRow>(
      `SELECT a.*, u.first_name, u.last_name, u.profile_picture
       FROM work_order_assignees a
       JOIN users u ON a.user_id = u.id
       WHERE a.work_order_id = $1`,
      [row.id],
    );

    return mapWorkOrderRowToApi(row, assigneeRows.map(mapAssigneeRowToApi));
  }

  /** List all work orders (admin view) with filters and pagination */
  async listWorkOrders(
    tenantId: number,
    query: ListQuery,
  ): Promise<PaginatedWorkOrders> {
    return await this.buildPaginatedList(tenantId, null, query);
  }

  /** List only work orders assigned to a specific user */
  async listMyWorkOrders(
    tenantId: number,
    userId: number,
    query: ListQuery,
  ): Promise<PaginatedWorkOrders> {
    return await this.buildPaginatedList(tenantId, userId, query);
  }

  /** Update work order fields (admin only) */
  async updateWorkOrder(
    tenantId: number,
    userId: number,
    uuid: string,
    dto: UpdateDto,
  ): Promise<WorkOrder> {
    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        const existing = await this.lockByUuid(client, tenantId, uuid);

        const sets: string[] = [];
        const params: unknown[] = [];
        let idx = 3; // $1=uuid, $2=tenantId

        if (dto.title !== undefined) {
          sets.push(`title = $${idx++}`);
          params.push(dto.title);
        }
        if (dto.description !== undefined) {
          sets.push(`description = $${idx++}`);
          params.push(dto.description);
        }
        if (dto.priority !== undefined) {
          sets.push(`priority = $${idx++}`);
          params.push(dto.priority);
        }
        if (dto.dueDate !== undefined) {
          sets.push(`due_date = $${idx}`);
          params.push(dto.dueDate);
        }

        if (sets.length === 0) return;

        await client.query(
          `UPDATE work_orders SET ${sets.join(', ')}
           WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1`,
          [uuid, tenantId, ...params],
        );

        void this.activityLogger.logUpdate(
          tenantId,
          userId,
          'work_order',
          existing.id,
          `Arbeitsauftrag "${existing.title}" aktualisiert`,
          { title: existing.title, priority: existing.priority },
          dto as Record<string, unknown>,
        );
      },
    );

    // Read AFTER commit — getWorkOrder uses db.queryOne (new pool connection),
    // which can only see committed data, not in-flight transaction changes.
    return await this.getWorkOrder(tenantId, uuid);
  }

  /** Soft-delete a work order (is_active = 4) */
  async deleteWorkOrder(
    tenantId: number,
    userId: number,
    uuid: string,
  ): Promise<void> {
    const row = await this.db.queryOne<{ id: number; title: string }>(
      `SELECT id, title FROM work_orders
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1`,
      [uuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException('Arbeitsauftrag nicht gefunden');
    }

    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        await client.query(
          `UPDATE work_orders SET is_active = 4
           WHERE uuid = $1 AND tenant_id = $2`,
          [uuid, tenantId],
        );
      },
    );

    void this.activityLogger.logDelete(
      tenantId,
      userId,
      'work_order',
      row.id,
      `Arbeitsauftrag "${row.title}" gelöscht`,
      { uuid, title: row.title },
    );
  }

  /** Get stats (counts per status) for dashboard — all work orders */
  async getStats(tenantId: number): Promise<WorkOrderStats> {
    return await this.queryStats(
      `FROM work_orders
       WHERE tenant_id = $1 AND is_active = 1`,
      [tenantId],
    );
  }

  /** Get stats filtered to work orders assigned to a specific user */
  async getMyStats(tenantId: number, userId: number): Promise<WorkOrderStats> {
    return await this.queryStats(
      `FROM work_orders wo
       JOIN work_order_assignees woa ON woa.work_order_id = wo.id
       WHERE wo.tenant_id = $1 AND wo.is_active = 1 AND woa.user_id = $2`,
      [tenantId, userId],
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /** Shared stats query — DRY helper for getStats + getMyStats */
  private async queryStats(
    fromClause: string,
    params: (number | string)[],
  ): Promise<WorkOrderStats> {
    const row = await this.db.queryOne<{
      open: string;
      in_progress: string;
      completed: string;
      verified: string;
      total: string;
      overdue: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open') AS open,
         COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed,
         COUNT(*) FILTER (WHERE status = 'verified') AS verified,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status IN ('open', 'in_progress')) AS overdue
       ${fromClause}`,
      params,
    );

    return {
      open: Number.parseInt(row?.open ?? '0', 10),
      inProgress: Number.parseInt(row?.in_progress ?? '0', 10),
      completed: Number.parseInt(row?.completed ?? '0', 10),
      verified: Number.parseInt(row?.verified ?? '0', 10),
      total: Number.parseInt(row?.total ?? '0', 10),
      overdue: Number.parseInt(row?.overdue ?? '0', 10),
    };
  }

  /** INSERT work_order row and return it with counts */
  private async insertWorkOrder(
    client: PoolClient,
    tenantId: number,
    userId: number,
    dto: CreateDto,
  ): Promise<WorkOrderWithCountsRow> {
    const uuid = uuidv7();
    const result = await client.query<WorkOrderWithCountsRow>(
      `INSERT INTO work_orders (uuid, tenant_id, title, description, priority, source_type, source_uuid, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *,
         (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = $9) AS created_by_name,
         '0' AS assignee_count,
         NULL AS assignee_names,
         '0' AS comment_count,
         '0' AS photo_count`,
      [
        uuid,
        tenantId,
        dto.title,
        dto.description ?? null,
        dto.priority ?? 'medium',
        dto.sourceType ?? 'manual',
        dto.sourceUuid ?? null,
        dto.dueDate ?? null,
        userId,
      ],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(
        'Arbeitsauftrag konnte nicht erstellt werden',
      );
    }
    return row;
  }

  /** INSERT assignees for a work order */
  private async insertAssignees(
    client: PoolClient,
    tenantId: number,
    workOrderId: number,
    assignedBy: number,
    userUuids: string[],
  ): Promise<WorkOrderAssigneeWithNameRow[]> {
    if (userUuids.length === 0) return [];

    const rows: WorkOrderAssigneeWithNameRow[] = [];
    for (const userUuid of userUuids) {
      const result = await client.query<WorkOrderAssigneeWithNameRow>(
        `INSERT INTO work_order_assignees (uuid, tenant_id, work_order_id, user_id, assigned_by)
         SELECT $1, $2, $3, u.id, $5
         FROM users u
         WHERE u.uuid = $4 AND u.tenant_id = $2 AND u.is_active = 1
         RETURNING *, (SELECT first_name FROM users WHERE id = user_id) AS first_name,
                      (SELECT last_name FROM users WHERE id = user_id) AS last_name,
                      (SELECT profile_picture FROM users WHERE id = user_id) AS profile_picture`,
        [uuidv7(), tenantId, workOrderId, userUuid, assignedBy],
      );
      if (result.rows[0] !== undefined) {
        rows.push(result.rows[0]);
      }
    }
    return rows;
  }

  /** Lock a work order row FOR UPDATE and return it */
  private async lockByUuid(
    client: PoolClient,
    tenantId: number,
    uuid: string,
  ): Promise<{ id: number; title: string; priority: string }> {
    const result = await client.query<{
      id: number;
      title: string;
      priority: string;
    }>(
      `SELECT id, title, priority FROM work_orders
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1
       FOR UPDATE`,
      [uuid, tenantId],
    );

    if (result.rows[0] === undefined) {
      throw new NotFoundException('Arbeitsauftrag nicht gefunden');
    }

    return result.rows[0];
  }

  /** Build paginated list with dynamic WHERE clause */
  private async buildPaginatedList(
    tenantId: number,
    forUserId: number | null,
    query: ListQuery,
  ): Promise<PaginatedWorkOrders> {
    const { whereClause, params, nextIdx } = buildWhereClause(
      tenantId,
      forUserId,
      query,
    );
    const page = query.page ?? 1;
    const pageSize = query.limit ?? 20;
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM work_orders wo
       JOIN users u ON wo.created_by = u.id
       WHERE ${whereClause}`,
      params,
    );
    const total = Number.parseInt(countResult?.count ?? '0', 10);

    const limitIdx = nextIdx;
    const offsetIdx = nextIdx + 1;
    const rows = await this.db.query<WorkOrderWithCountsRow>(
      `${ORDER_SELECT_SQL}
       WHERE ${whereClause}
       ORDER BY
         CASE wo.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
         wo.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, pageSize, offset],
    );

    return {
      items: rows.map(mapWorkOrderRowToListItem),
      total,
      page,
      pageSize,
    };
  }
}
