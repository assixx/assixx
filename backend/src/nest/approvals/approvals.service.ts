/**
 * Approvals Service — CRUD + status transitions (approve/reject)
 * @module approvals/approvals.service
 *
 * Core business logic for the approval lifecycle: create → pending → approved/rejected.
 * Self-approval prevention enforced. Root/Admin with full_access bypass config.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { eventBus } from '../../utils/event-bus.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ApprovalsConfigService } from './approvals-config.service.js';
import type {
  Approval,
  ApprovalListRow,
  ApprovalRow,
  ApprovalStats,
  ApprovalStatus,
} from './approvals.types.js';
import { mapApprovalRowToApi } from './approvals.types.js';
import type { CreateApprovalDto } from './dto/index.js';

/** Pagination parameters */
export interface ApprovalFilters {
  status?: ApprovalStatus | undefined;
  addonCode?: string | undefined;
  priority?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

/** Paginated response */
interface PaginatedApprovals {
  items: Approval[];
  total: number;
  page: number;
  pageSize: number;
}

/** Base SELECT with JOINed user names (no read-tracking) */
const BASE_SELECT = `
  SELECT a.*,
    req.first_name || ' ' || req.last_name AS requested_by_name,
    dec.first_name || ' ' || dec.last_name AS decided_by_name,
    asg.first_name || ' ' || asg.last_name AS assigned_to_name
  FROM approvals a
  INNER JOIN users req ON req.id = a.requested_by
  LEFT JOIN users dec ON dec.id = a.decided_by
  LEFT JOIN users asg ON asg.id = a.assigned_to
`;

/** Base SELECT with read-tracking (needs $userIdx and $tenantIdx params appended) */
function baseSelectWithRead(userParamIdx: number, tenantParamIdx: number): string {
  return `
  SELECT a.*,
    req.first_name || ' ' || req.last_name AS requested_by_name,
    dec.first_name || ' ' || dec.last_name AS decided_by_name,
    asg.first_name || ' ' || asg.last_name AS assigned_to_name,
    rs.read_at
  FROM approvals a
  INNER JOIN users req ON req.id = a.requested_by
  LEFT JOIN users dec ON dec.id = a.decided_by
  LEFT JOIN users asg ON asg.id = a.assigned_to
  LEFT JOIN approval_read_status rs
    ON rs.approval_id = a.id AND rs.user_id = $${String(userParamIdx)} AND rs.tenant_id = $${String(tenantParamIdx)}
  `;
}

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly configService: ApprovalsConfigService,
  ) {}

  /** List all approvals with optional filters + pagination + read-tracking */
  async findAll(
    filters: ApprovalFilters,
    userId: number,
    tenantId: number,
  ): Promise<PaginatedApprovals> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<PaginatedApprovals> => {
        const conditions: string[] = [`a.is_active = ${IS_ACTIVE.ACTIVE}`];
        const params: (string | number)[] = [];
        let paramIdx = 1;

        if (filters.status !== undefined) {
          conditions.push(`a.status = $${String(paramIdx)}`);
          params.push(filters.status);
          paramIdx++;
        }
        if (filters.addonCode !== undefined) {
          conditions.push(`a.addon_code = $${String(paramIdx)}`);
          params.push(filters.addonCode);
          paramIdx++;
        }
        if (filters.priority !== undefined) {
          conditions.push(`a.priority = $${String(paramIdx)}`);
          params.push(filters.priority);
          paramIdx++;
        }

        const where = conditions.join(' AND ');
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const offset = (page - 1) * limit;

        const countResult = await client.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM approvals a WHERE ${where}`,
          params,
        );
        const total = Number(countResult.rows[0]?.count ?? 0);

        // Read-tracking params appended after filter + pagination params
        const readUserIdx = paramIdx + 2;
        const readTenantIdx = paramIdx + 3;
        const dataResult = await client.query<ApprovalListRow>(
          `${baseSelectWithRead(readUserIdx, readTenantIdx)} WHERE ${where}
           ORDER BY a.created_at DESC
           LIMIT $${String(paramIdx)} OFFSET $${String(paramIdx + 1)}`,
          [...params, limit, offset, userId, tenantId],
        );

        return {
          items: dataResult.rows.map(mapApprovalRowToApi),
          total,
          page,
          pageSize: limit,
        };
      },
    );
  }

  /** Get single approval by UUID */
  async findById(uuid: string): Promise<Approval> {
    const row = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<ApprovalListRow> => {
        const result = await client.query<ApprovalListRow>(
          `${BASE_SELECT}
           WHERE a.uuid = $1 AND a.is_active = ${IS_ACTIVE.ACTIVE}`,
          [uuid],
        );
        const found = result.rows[0];
        if (found === undefined) {
          throw new NotFoundException('Approval not found');
        }
        return found;
      },
    );
    return mapApprovalRowToApi(row);
  }

  /** List approvals assigned to a specific user (with read-tracking) */
  async findByAssignee(
    userId: number,
    tenantId: number,
    filters: ApprovalFilters,
  ): Promise<PaginatedApprovals> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<PaginatedApprovals> => {
        const conditions: string[] = [`a.is_active = ${IS_ACTIVE.ACTIVE}`, `a.assigned_to = $1`];
        const params: (string | number)[] = [userId];
        let paramIdx = 2;

        if (filters.status !== undefined) {
          conditions.push(`a.status = $${String(paramIdx)}`);
          params.push(filters.status);
          paramIdx++;
        }

        const where = conditions.join(' AND ');
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const offset = (page - 1) * limit;

        const countResult = await client.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM approvals a WHERE ${where}`,
          params,
        );
        const total = Number(countResult.rows[0]?.count ?? 0);

        const readUserIdx = paramIdx + 2;
        const readTenantIdx = paramIdx + 3;
        const dataResult = await client.query<ApprovalListRow>(
          `${baseSelectWithRead(readUserIdx, readTenantIdx)} WHERE ${where}
           ORDER BY a.created_at DESC
           LIMIT $${String(paramIdx)} OFFSET $${String(paramIdx + 1)}`,
          [...params, limit, offset, userId, tenantId],
        );

        return {
          items: dataResult.rows.map(mapApprovalRowToApi),
          total,
          page,
          pageSize: limit,
        };
      },
    );
  }

  /** List approvals requested by a specific user */
  async findByRequester(userId: number): Promise<Approval[]> {
    const rows = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<ApprovalListRow[]> => {
        const result = await client.query<ApprovalListRow>(
          `${BASE_SELECT}
           WHERE a.requested_by = $1 AND a.is_active = ${IS_ACTIVE.ACTIVE}
           ORDER BY a.created_at DESC`,
          [userId],
        );
        return result.rows;
      },
    );
    return rows.map(mapApprovalRowToApi);
  }

  /** Create a new approval request */
  async create(dto: CreateApprovalDto, tenantId: number, requestedBy: number): Promise<Approval> {
    const row = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<ApprovalListRow> => {
        const uuid = uuidv7();
        const result = await client.query<ApprovalRow>(
          `INSERT INTO approvals
             (uuid, tenant_id, addon_code, source_entity_type, source_uuid,
              title, description, requested_by, assigned_to, priority)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            uuid,
            tenantId,
            dto.addonCode,
            dto.sourceEntityType,
            dto.sourceUuid,
            dto.title,
            dto.description ?? null,
            requestedBy,
            dto.assignedTo ?? null,
            dto.priority,
          ],
        );

        const inserted = result.rows[0];
        if (inserted === undefined) {
          throw new Error('Insert returned no rows');
        }

        // Re-fetch with JOINed names
        const full = await client.query<ApprovalListRow>(
          `${BASE_SELECT}
           WHERE a.id = $1`,
          [inserted.id],
        );
        const fullRow = full.rows[0];
        if (fullRow === undefined) {
          throw new Error('Re-fetch after insert failed');
        }
        return fullRow;
      },
    );

    void this.activityLogger.logCreate(
      tenantId,
      requestedBy,
      'approval',
      row.id,
      `Approval requested: ${dto.title} (${dto.addonCode})`,
      { addonCode: dto.addonCode, sourceUuid: dto.sourceUuid },
    );

    const mapped = mapApprovalRowToApi(row);
    void this.emitCreatedEvent(tenantId, mapped, requestedBy);
    return mapped;
  }

  /** Approve an approval request (optionally with reward amount) */
  async approve(
    uuid: string,
    tenantId: number,
    decidedBy: number,
    note: string | null = null,
    rewardAmount: number | null = null,
  ): Promise<Approval> {
    return await this.decide(uuid, tenantId, decidedBy, 'approved', note, rewardAmount);
  }

  /** Reject an approval request (note mandatory) */
  async reject(uuid: string, tenantId: number, decidedBy: number, note: string): Promise<Approval> {
    return await this.decide(uuid, tenantId, decidedBy, 'rejected', note);
  }

  /** Get approval statistics */
  async getStats(userId?: number): Promise<ApprovalStats> {
    return await this.db.tenantTransaction(async (client: PoolClient): Promise<ApprovalStats> => {
      let whereExtra = '';
      const params: number[] = [];

      if (userId !== undefined) {
        whereExtra = ' AND assigned_to = $1';
        params.push(userId);
      }

      const result = await client.query<{
        pending: string;
        approved: string;
        rejected: string;
        total: string;
      }>(
        `SELECT
             COUNT(*) FILTER (WHERE status = 'pending') AS pending,
             COUNT(*) FILTER (WHERE status = 'approved') AS approved,
             COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
             COUNT(*) AS total
           FROM approvals
           WHERE is_active = ${IS_ACTIVE.ACTIVE}${whereExtra}`,
        params,
      );

      const row = result.rows[0];
      return {
        pending: Number(row?.pending ?? 0),
        approved: Number(row?.approved ?? 0),
        rejected: Number(row?.rejected ?? 0),
        total: Number(row?.total ?? 0),
      };
    });
  }

  /** Shared decide logic for approve/reject */
  private async decide(
    uuid: string,
    tenantId: number,
    decidedBy: number,
    newStatus: 'approved' | 'rejected',
    note: string | null,
    rewardAmount: number | null = null,
  ): Promise<Approval> {
    const row = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<ApprovalListRow> => {
        // Lock the row to prevent race conditions
        const current = await client.query<ApprovalRow>(
          `SELECT * FROM approvals
           WHERE uuid = $1 AND is_active = ${IS_ACTIVE.ACTIVE}
           FOR UPDATE`,
          [uuid],
        );

        const approval = current.rows[0];
        if (approval === undefined) {
          throw new NotFoundException('Approval not found');
        }

        if (approval.status !== 'pending') {
          throw new BadRequestException(`Approval already decided: ${approval.status}`);
        }

        // Self-approval prevention (R2)
        if (approval.requested_by === decidedBy) {
          throw new ForbiddenException('Cannot approve/reject own approval request');
        }

        await client.query(
          `UPDATE approvals
           SET status = $1, decided_by = $2, decided_at = NOW(),
               decision_note = $3, reward_amount = $4, updated_at = NOW()
           WHERE id = $5`,
          [newStatus, decidedBy, note, rewardAmount, approval.id],
        );

        // Re-fetch with JOINed names
        const full = await client.query<ApprovalListRow>(`${BASE_SELECT} WHERE a.id = $1`, [
          approval.id,
        ]);
        const fullRow = full.rows[0];
        if (fullRow === undefined) {
          throw new Error('Re-fetch after update failed');
        }
        return fullRow;
      },
    );

    const action = newStatus === 'approved' ? 'approved' : 'rejected';
    void this.activityLogger.logUpdate(
      tenantId,
      decidedBy,
      'approval',
      row.id,
      `Approval ${action}: ${row.title}`,
      { status: newStatus, decisionNote: note },
    );

    const mapped = mapApprovalRowToApi(row);
    this.emitDecidedEvent(tenantId, mapped, row.requested_by);
    return mapped;
  }

  /** SSE: resolve approval masters and notify them about a new request */
  private async emitCreatedEvent(
    tenantId: number,
    approval: Approval,
    requestedBy: number,
  ): Promise<void> {
    const approverIds = await this.configService.resolveApprovers(approval.addonCode, requestedBy);
    eventBus.emitApprovalCreated(
      tenantId,
      {
        uuid: approval.uuid,
        title: approval.title,
        addonCode: approval.addonCode,
        status: approval.status,
        requestedByName: approval.requestedByName,
      },
      approverIds,
      requestedBy,
    );
  }

  /** SSE: notify the requester about the decision */
  private emitDecidedEvent(tenantId: number, approval: Approval, requestedByUserId: number): void {
    const payload: {
      uuid: string;
      title: string;
      addonCode: string;
      status: string;
      requestedByName: string;
      decidedByName?: string;
      decisionNote?: string | null;
    } = {
      uuid: approval.uuid,
      title: approval.title,
      addonCode: approval.addonCode,
      status: approval.status,
      requestedByName: approval.requestedByName,
    };
    if (approval.decidedByName !== null) {
      payload.decidedByName = approval.decidedByName;
    }
    if (approval.decisionNote !== null) {
      payload.decisionNote = approval.decisionNote;
    }
    eventBus.emitApprovalDecided(tenantId, payload, requestedByUserId);
  }
}
