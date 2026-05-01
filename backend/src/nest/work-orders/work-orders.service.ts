/**
 * Work Orders Service — Core CRUD
 *
 * Handles creation, retrieval, listing, updating, and archiving
 * of work orders. All queries use tenant-scoped transactions (ADR-019).
 * Returns raw data — ResponseInterceptor wraps automatically (ADR-007).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ScopeService } from '../hierarchy-permission/scope.service.js';
import {
  mapAssigneeRowToApi,
  mapCalendarWorkOrderRow,
  mapWorkOrderRowToApi,
  mapWorkOrderRowToListItem,
} from './work-orders.helpers.js';
import type {
  CalendarWorkOrder,
  CalendarWorkOrderRow,
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
    (SELECT COUNT(*) FROM work_order_comments c WHERE c.work_order_id = wo.id AND c.is_active = ${IS_ACTIVE.ACTIVE}) AS comment_count,
    (SELECT COUNT(*) FROM work_order_photos p WHERE p.work_order_id = wo.id) AS photo_count
  FROM work_orders wo
  JOIN users u ON wo.created_by = u.id`;

/** Extended SELECT with is_read column (requires LEFT JOIN on rs) */
const ORDER_SELECT_WITH_READ_SQL = `
  SELECT wo.*,
    CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
    (SELECT COUNT(*) FROM work_order_assignees a WHERE a.work_order_id = wo.id) AS assignee_count,
    (SELECT STRING_AGG(CONCAT(au.first_name, ' ', au.last_name), ', ' ORDER BY au.last_name)
       FROM work_order_assignees wa
       JOIN users au ON wa.user_id = au.id
       WHERE wa.work_order_id = wo.id) AS assignee_names,
    (SELECT COUNT(*) FROM work_order_comments c WHERE c.work_order_id = wo.id AND c.is_active = ${IS_ACTIVE.ACTIVE}) AS comment_count,
    (SELECT COUNT(*) FROM work_order_photos p WHERE p.work_order_id = wo.id) AS photo_count,
    CASE WHEN rs.id IS NOT NULL THEN 1 ELSE 0 END AS is_read
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
  sourceUuid?: string | undefined;
  assigneeUuid?: string | undefined;
  isActive?: string | undefined;
  overdue?: 'true' | undefined;
  // Phase 1.2a-B (2026-05-01): server-side title/description ILIKE search.
  // Undefined/empty ⇒ no WHERE clause (backwards-compat invariant).
  search?: string | undefined;
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

/** Append optional query filters to WHERE clause (extracted for complexity budget) */
function appendQueryFilters(
  conditions: string[],
  params: unknown[],
  startIdx: number,
  query: ListQuery,
): number {
  let idx = startIdx;
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
  if (query.sourceUuid !== undefined) {
    conditions.push(`wo.source_uuid = $${idx++}`);
    params.push(query.sourceUuid);
  }
  if (query.assigneeUuid !== undefined) {
    conditions.push(
      `EXISTS (SELECT 1 FROM work_order_assignees a3
               JOIN users ua ON a3.user_id = ua.id
               WHERE a3.work_order_id = wo.id AND ua.uuid = $${idx++})`,
    );
    params.push(query.assigneeUuid);
  }
  if (query.overdue === 'true') {
    conditions.push(`wo.due_date < CURRENT_DATE AND wo.status IN ('open', 'in_progress')`);
  }
  // Phase 1.2a-B: case-insensitive title/description substring search.
  // Single bound param reused twice via $${idx} → $${idx} (one push, one increment).
  if (query.search !== undefined && query.search !== '') {
    conditions.push(`(wo.title ILIKE $${idx} OR wo.description ILIKE $${idx})`);
    params.push(`%${query.search}%`);
    idx++;
  }
  return idx;
}

function buildWhereClause(
  tenantId: number,
  forUserId: number | null,
  query: ListQuery,
  scopeTeamIds?: number[],
): WhereResult {
  const isActiveCondition =
    query.isActive === 'archived' ? `wo.is_active = ${IS_ACTIVE.ARCHIVED}`
    : query.isActive === 'all' ? `wo.is_active IN (${IS_ACTIVE.ACTIVE}, ${IS_ACTIVE.ARCHIVED})`
    : `wo.is_active = ${IS_ACTIVE.ACTIVE}`;

  const conditions: string[] = ['wo.tenant_id = $1', isActiveCondition];
  const params: unknown[] = [tenantId];
  let idx = 2;

  if (forUserId !== null) {
    conditions.push(
      `EXISTS (SELECT 1 FROM work_order_assignees a2
               WHERE a2.work_order_id = wo.id AND a2.user_id = $${idx++})`,
    );
    params.push(forUserId);
  }

  // Scope filter: limited users see only work orders with assignees in their teams
  if (scopeTeamIds !== undefined && scopeTeamIds.length > 0) {
    conditions.push(
      `EXISTS (SELECT 1 FROM work_order_assignees sa
               JOIN user_teams ut ON ut.user_id = sa.user_id
               WHERE sa.work_order_id = wo.id AND ut.team_id = ANY($${idx++}::int[]))`,
    );
    params.push(scopeTeamIds);
  }

  const nextIdx = appendQueryFilters(conditions, params, idx, query);
  return { whereClause: conditions.join(' AND '), params, nextIdx };
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
  dueDate: string;
  assigneeUuids?: string[] | undefined;
}

/** DTO shape for updateWorkOrder — all fields optional + undefined */
interface UpdateDto {
  title?: string | undefined;
  description?: string | null | undefined;
  priority?: string | undefined;
  dueDate?: string | undefined;
}

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly scopeService: ScopeService,
  ) {}

  /** Create a work order, optionally with initial assignees */
  async createWorkOrder(tenantId: number, userId: number, dto: CreateDto): Promise<WorkOrder> {
    if (dto.sourceUuid != null && dto.sourceType !== 'manual') {
      await this.ensureNoActiveLinkedWorkOrder(tenantId, dto.sourceUuid);
    }

    return await this.db.tenantTransaction(async (client: PoolClient): Promise<WorkOrder> => {
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
    });
  }

  /** Get a single work order by UUID with full enrichment */
  async getWorkOrder(tenantId: number, uuid: string): Promise<WorkOrder> {
    const row = await this.db.tenantQueryOne<WorkOrderWithCountsRow>(
      `${ORDER_SELECT_SQL}
       WHERE wo.uuid = $1 AND wo.tenant_id = $2
         AND wo.is_active IN (${IS_ACTIVE.ACTIVE}, ${IS_ACTIVE.ARCHIVED})`,
      [uuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException('Arbeitsauftrag nicht gefunden');
    }

    const assigneeRows = await this.db.tenantQuery<WorkOrderAssigneeWithNameRow>(
      `SELECT a.*, u.first_name, u.last_name, u.profile_picture
       FROM work_order_assignees a
       JOIN users u ON a.user_id = u.id
       WHERE a.work_order_id = $1`,
      [row.id],
    );

    const workOrder = mapWorkOrderRowToApi(row, assigneeRows.map(mapAssigneeRowToApi));

    if (row.source_type === 'kvp_proposal' && row.source_uuid !== null) {
      const kvp = await this.db.tenantQueryOne<{ expected_benefit: string | null }>(
        `SELECT expected_benefit FROM kvp_suggestions
         WHERE uuid = $1 AND tenant_id = $2`,
        [row.source_uuid.trim(), tenantId],
      );
      workOrder.sourceExpectedBenefit = kvp?.expected_benefit ?? null;
    }

    return workOrder;
  }

  /** List all work orders (admin view) with filters and pagination — scope-filtered for leads */
  async listWorkOrders(
    tenantId: number,
    currentUserId: number,
    query: ListQuery,
  ): Promise<PaginatedWorkOrders> {
    const scopeTeamIds = await this.resolveScopeTeamIds();
    return await this.buildPaginatedList(tenantId, null, currentUserId, query, scopeTeamIds);
  }

  /** List only work orders assigned to a specific user */
  async listMyWorkOrders(
    tenantId: number,
    userId: number,
    query: ListQuery,
  ): Promise<PaginatedWorkOrders> {
    return await this.buildPaginatedList(tenantId, userId, userId, query);
  }

  /** Update work order fields (admin only) */
  async updateWorkOrder(
    tenantId: number,
    userId: number,
    uuid: string,
    dto: UpdateDto,
  ): Promise<WorkOrder> {
    await this.db.tenantTransaction(async (client: PoolClient): Promise<void> => {
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
           WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
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
    });

    // Read AFTER commit — getWorkOrder uses db.queryOne (new pool connection),
    // which can only see committed data, not in-flight transaction changes.
    return await this.getWorkOrder(tenantId, uuid);
  }

  /** Archive a work order (is_active = 3) — work orders are never deleted */
  async archiveWorkOrder(tenantId: number, userId: number, uuid: string): Promise<void> {
    const row = await this.db.tenantQueryOne<{ id: number; title: string }>(
      `SELECT id, title FROM work_orders
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [uuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException('Arbeitsauftrag nicht gefunden');
    }

    await this.db.tenantTransaction(async (client: PoolClient): Promise<void> => {
      await client.query(
        `UPDATE work_orders SET is_active = ${IS_ACTIVE.ARCHIVED}
           WHERE uuid = $1 AND tenant_id = $2`,
        [uuid, tenantId],
      );
    });

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'work_order',
      row.id,
      `Arbeitsauftrag "${row.title}" archiviert`,
      { uuid, title: row.title },
      { isActive: IS_ACTIVE.ARCHIVED },
    );
  }

  /** Restore an archived work order back to active (is_active = 1) */
  async restoreWorkOrder(tenantId: number, userId: number, uuid: string): Promise<void> {
    const row = await this.db.tenantQueryOne<{ id: number; title: string }>(
      `SELECT id, title FROM work_orders
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ARCHIVED}`,
      [uuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException('Archivierter Arbeitsauftrag nicht gefunden');
    }

    await this.db.tenantTransaction(async (client: PoolClient): Promise<void> => {
      await client.query(
        `UPDATE work_orders SET is_active = ${IS_ACTIVE.ACTIVE}
           WHERE uuid = $1 AND tenant_id = $2`,
        [uuid, tenantId],
      );
    });

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'work_order',
      row.id,
      `Arbeitsauftrag "${row.title}" wiederhergestellt`,
      { uuid, title: row.title },
      { isActive: IS_ACTIVE.ACTIVE },
    );
  }

  /** Get stats (counts per status) for dashboard — scope-filtered for leads */
  async getStats(tenantId: number): Promise<WorkOrderStats> {
    const scopeTeamIds = await this.resolveScopeTeamIds();

    if (scopeTeamIds === undefined) {
      return await this.queryStats(
        `FROM work_orders
         WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE}`,
        [tenantId],
      );
    }

    return await this.queryStats(
      `FROM work_orders wo
       WHERE wo.tenant_id = $1 AND wo.is_active = ${IS_ACTIVE.ACTIVE}
         AND EXISTS (SELECT 1 FROM work_order_assignees sa
                     JOIN user_teams ut ON ut.user_id = sa.user_id
                     WHERE sa.work_order_id = wo.id AND ut.team_id = ANY($2::int[]))`,
      [tenantId, scopeTeamIds],
    );
  }

  /** Get work orders with due dates for calendar display */
  async getCalendarWorkOrders(
    tenantId: number,
    userId: number,
    isAdmin: boolean,
    startDate: string,
    endDate: string,
  ): Promise<CalendarWorkOrder[]> {
    const conditions = [
      'wo.tenant_id = $1',
      `wo.is_active = ${IS_ACTIVE.ACTIVE}`,
      'wo.due_date IS NOT NULL',
      'wo.due_date >= $2::date',
      'wo.due_date <= $3::date',
      `EXISTS (SELECT 1 FROM work_order_assignees woa WHERE woa.work_order_id = wo.id)`,
    ];
    const params: (string | number)[] = [tenantId, startDate, endDate];

    if (!isAdmin) {
      conditions.push(
        `EXISTS (SELECT 1 FROM work_order_assignees woa2
                 WHERE woa2.work_order_id = wo.id AND woa2.user_id = $4)`,
      );
      params.push(userId);
    }

    const rows = await this.db.tenantQuery<CalendarWorkOrderRow>(
      `SELECT wo.uuid, wo.title, wo.due_date::text AS due_date, wo.status, wo.priority, wo.source_type
       FROM work_orders wo
       WHERE ${conditions.join(' AND ')}
       ORDER BY wo.due_date`,
      params,
    );

    return rows.map(mapCalendarWorkOrderRow);
  }

  /** Get stats filtered to work orders assigned to a specific user */
  async getMyStats(tenantId: number, userId: number): Promise<WorkOrderStats> {
    return await this.queryStats(
      `FROM work_orders wo
       JOIN work_order_assignees woa ON woa.work_order_id = wo.id
       WHERE wo.tenant_id = $1 AND wo.is_active = ${IS_ACTIVE.ACTIVE} AND woa.user_id = $2`,
      [tenantId, userId],
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /** Shared stats query — DRY helper for getStats + getMyStats */
  private async queryStats(
    fromClause: string,
    params: (number | string | number[])[],
  ): Promise<WorkOrderStats> {
    const row = await this.db.tenantQueryOne<{
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
        dto.dueDate,
        userId,
      ],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException('Arbeitsauftrag konnte nicht erstellt werden');
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
         WHERE u.uuid = $4 AND u.tenant_id = $2 AND u.is_active = ${IS_ACTIVE.ACTIVE}
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

  /** Reject creation if an active (non-verified) work order already exists for this source */
  private async ensureNoActiveLinkedWorkOrder(tenantId: number, sourceUuid: string): Promise<void> {
    const existing = await this.db.tenantQueryOne<{ uuid: string; status: string }>(
      `SELECT uuid, status FROM work_orders
       WHERE source_uuid = $1 AND tenant_id = $2
         AND is_active = ${IS_ACTIVE.ACTIVE} AND status != 'verified'
       LIMIT 1`,
      [sourceUuid, tenantId],
    );
    if (existing !== null) {
      throw new ConflictException(
        'Es existiert bereits ein aktiver Arbeitsauftrag für diese Quelle. ' +
          'Erst nach Verifizierung kann ein neuer erstellt werden.',
      );
    }
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
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
       FOR UPDATE`,
      [uuid, tenantId],
    );

    if (result.rows[0] === undefined) {
      throw new NotFoundException('Arbeitsauftrag nicht gefunden');
    }

    return result.rows[0];
  }

  /** Resolve team IDs for scope filtering — undefined = full access (no filter) */
  private async resolveScopeTeamIds(): Promise<number[] | undefined> {
    const scope = await this.scopeService.getScope();
    if (scope.type === 'full') return undefined;
    return scope.teamIds;
  }

  /** Build paginated list with dynamic WHERE clause + read-status LEFT JOIN */
  private async buildPaginatedList(
    tenantId: number,
    forUserId: number | null,
    currentUserId: number,
    query: ListQuery,
    scopeTeamIds?: number[],
  ): Promise<PaginatedWorkOrders> {
    const { whereClause, params, nextIdx } = buildWhereClause(
      tenantId,
      forUserId,
      query,
      scopeTeamIds,
    );
    const page = query.page ?? 1;
    const pageSize = query.limit ?? 20;
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.tenantQueryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM work_orders wo
       JOIN users u ON wo.created_by = u.id
       WHERE ${whereClause}`,
      params,
    );
    const total = Number.parseInt(countResult?.count ?? '0', 10);

    const readUserIdx = nextIdx;
    const readTenantIdx = nextIdx + 1;
    const limitIdx = nextIdx + 2;
    const offsetIdx = nextIdx + 3;
    const rows = await this.db.tenantQuery<WorkOrderWithCountsRow>(
      `${ORDER_SELECT_WITH_READ_SQL}
       LEFT JOIN work_order_read_status rs
         ON rs.work_order_id = wo.id AND rs.user_id = $${readUserIdx} AND rs.tenant_id = $${readTenantIdx}
       WHERE ${whereClause}
       ORDER BY
         CASE wo.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
         wo.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, currentUserId, tenantId, pageSize, offset],
    );

    return {
      items: rows.map(mapWorkOrderRowToListItem),
      total,
      page,
      pageSize,
    };
  }
}
