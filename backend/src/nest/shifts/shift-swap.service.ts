/**
 * Shift Swap Service
 *
 * Handles the full lifecycle of shift swap requests:
 * create → partner consent → team lead approval → execute swap.
 *
 * 2-step approval: pending_partner → pending_approval → approved/rejected.
 * @see docs/FEAT_SWAP_REQUEST_MASTERPLAN.md
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';

import { eventBus } from '../../utils/event-bus.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateSwapRequestDto } from './dto/create-swap-request.dto.js';
import type {
  DbSwapRequestDetailRow,
  DbSwapRequestRow,
  SwapRequestFilters,
  SwapRequestResponse,
} from './shift-swap.types.js';

// ============================================================
// SQL CONSTANTS
// ============================================================

const SELECT_DETAIL = `
  SELECT
    ssr.*,
    ru.first_name AS requester_first_name, ru.last_name AS requester_last_name,
    tu.first_name AS target_first_name, tu.last_name AS target_last_name,
    rs.date AS requester_shift_date, rs.type AS requester_shift_type,
    ts.date AS target_shift_date, ts.type AS target_shift_type
  FROM shift_swap_requests ssr
  LEFT JOIN users ru ON ssr.requester_id = ru.id
  LEFT JOIN users tu ON ssr.target_id = tu.id
  LEFT JOIN shifts rs ON ssr.requester_shift_id = rs.id
  LEFT JOIN shifts ts ON ssr.target_shift_id = ts.id
`;

const SETTING_QUERY = `SELECT settings FROM tenants WHERE id = $1`;

// ============================================================
// HELPERS
// ============================================================

function mapRowToResponse(r: DbSwapRequestDetailRow): SwapRequestResponse {
  return {
    uuid: r.uuid,
    requesterId: r.requester_id,
    requesterName: formatName(r.requester_first_name, r.requester_last_name),
    requesterShiftId: r.requester_shift_id,
    requesterShiftDate: r.requester_shift_date ?? r.start_date,
    requesterShiftType: r.requester_shift_type ?? '',
    targetId: r.target_id,
    targetName: formatName(r.target_first_name, r.target_last_name),
    targetShiftId: r.target_shift_id,
    targetShiftDate: r.target_shift_date ?? r.start_date,
    targetShiftType: r.target_shift_type ?? '',
    teamId: r.team_id,
    swapScope: r.swap_scope,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    reason: r.reason,
    partnerRespondedAt: r.partner_responded_at,
    partnerNote: r.partner_note,
    approvalUuid: r.approval_uuid,
    createdAt: r.created_at,
  };
}

function formatName(first: string | null, last: string | null): string | null {
  if (first === null && last === null) return null;
  return `${first ?? ''} ${last ?? ''}`.trim();
}

// ============================================================
// SERVICE
// ============================================================

@Injectable()
export class ShiftSwapService {
  private readonly logger = new Logger(ShiftSwapService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ----------------------------------------------------------
  // CREATE
  // ----------------------------------------------------------

  async createSwapRequest(
    dto: CreateSwapRequestDto,
    tenantId: number,
    requesterId: number,
  ): Promise<SwapRequestResponse> {
    const { teamId, requesterShiftId, targetShiftId } = await this.validateSwapRequest(
      dto,
      tenantId,
      requesterId,
    );

    const rows = await this.db.query<{ uuid: string }>(
      `INSERT INTO shift_swap_requests
         (tenant_id, requester_id, requester_shift_id, target_id, target_shift_id,
          team_id, swap_scope, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING uuid`,
      [
        tenantId,
        requesterId,
        requesterShiftId,
        dto.targetId,
        targetShiftId,
        teamId,
        dto.swapScope,
        dto.startDate,
        dto.endDate,
        dto.reason ?? null,
      ],
    );

    const uuid = rows[0]?.uuid ?? '';

    void this.activityLogger.logCreate(
      tenantId,
      requesterId,
      'shift_swap',
      0,
      `Swap-Anfrage erstellt (${uuid})`,
      {
        uuid,
        targetId: dto.targetId,
        swapScope: dto.swapScope,
      },
    );

    // Notify target user via SSE
    const response = await this.getSwapRequestByUuid(uuid, tenantId);
    eventBus.emitSwapRequestCreated(tenantId, dto.targetId, {
      uuid,
      requesterName: response.requesterName ?? 'Unbekannt',
      startDate: dto.startDate,
    });

    return response;
  }

  // ----------------------------------------------------------
  // PARTNER CONSENT
  // ----------------------------------------------------------

  async respondToSwapRequest(
    uuid: string,
    tenantId: number,
    targetId: number,
    accept: boolean,
    note?: string,
  ): Promise<SwapRequestResponse> {
    const request = await this.getRowOrThrow(uuid, tenantId);

    if (request.target_id !== targetId) {
      throw new ForbiddenException('Only the target user can respond');
    }
    if (request.status !== 'pending_partner') {
      throw new ConflictException(`Cannot respond: status is ${request.status}`);
    }

    const newStatus = accept ? 'pending_approval' : 'rejected';

    await this.db.query(
      `UPDATE shift_swap_requests
       SET status = $1, partner_responded_at = NOW(), partner_note = $2
       WHERE uuid = $3::uuid AND tenant_id = $4`,
      [newStatus, note ?? null, uuid, tenantId],
    );

    void this.activityLogger.logUpdate(
      tenantId,
      targetId,
      'shift_swap',
      0,
      `Swap-Anfrage ${accept ? 'akzeptiert' : 'abgelehnt'} (${uuid})`,
      undefined,
      {
        uuid,
        accept,
      },
    );

    return await this.getSwapRequestByUuid(uuid, tenantId);
  }

  // ----------------------------------------------------------
  // CANCEL
  // ----------------------------------------------------------

  async cancelSwapRequest(
    uuid: string,
    tenantId: number,
    requesterId: number,
  ): Promise<{ message: string }> {
    const request = await this.getRowOrThrow(uuid, tenantId);

    if (request.requester_id !== requesterId) {
      throw new ForbiddenException('Only the requester can cancel');
    }
    if (request.status !== 'pending_partner') {
      throw new ConflictException('Can only cancel requests in pending_partner status');
    }

    await this.db.query(
      `UPDATE shift_swap_requests SET status = 'cancelled' WHERE uuid = $1::uuid AND tenant_id = $2`,
      [uuid, tenantId],
    );

    return { message: 'Swap request cancelled' };
  }

  // ----------------------------------------------------------
  // EXECUTE SWAP (called by approval bridge on team lead approval)
  // ----------------------------------------------------------

  async executeSwap(uuid: string, tenantId: number): Promise<void> {
    await this.db.tenantTransaction(async (client: PoolClient) => {
      const swap = await this.lockSwapRequest(client, uuid, tenantId);

      const shiftCount = await this.swapUserIdsInTable(client, 'shifts', 'date', swap);
      const rotationCount = await this.swapUserIdsInTable(
        client,
        'shift_rotation_history',
        'shift_date',
        swap,
      );

      await client.query(
        `UPDATE shift_swap_requests SET status = 'approved' WHERE uuid = $1::uuid`,
        [uuid],
      );

      this.logger.log(
        `Swap ${uuid} executed: ${String(shiftCount + rotationCount)} swapped (${String(shiftCount)} shifts + ${String(rotationCount)} rotation)`,
      );
    });
  }

  /** Lock swap request row and validate status */
  private async lockSwapRequest(
    client: PoolClient,
    uuid: string,
    tenantId: number,
  ): Promise<DbSwapRequestRow> {
    const swapRows = await client.query<DbSwapRequestRow>(
      `SELECT * FROM shift_swap_requests WHERE uuid = $1::uuid AND tenant_id = $2 FOR UPDATE`,
      [uuid, tenantId],
    );
    const swap = swapRows.rows[0];
    if (swap === undefined) throw new NotFoundException(`Swap request ${uuid} not found`);
    if (swap.status !== 'pending_approval') {
      throw new ConflictException(`Cannot execute: status is ${swap.status}`);
    }
    return swap;
  }

  /** 3-step user_id swap via NULL in a given table. Returns count of swapped rows. */
  private async swapUserIdsInTable(
    client: PoolClient,
    table: string,
    dateColumn: string,
    swap: DbSwapRequestRow,
  ): Promise<number> {
    const rows = await client.query<{ id: number; user_id: number }>(
      `SELECT id, user_id FROM ${table}
       WHERE tenant_id = $1 AND ${dateColumn} >= $2 AND ${dateColumn} <= $3
         AND user_id IN ($4, $5) AND team_id = $6
       ORDER BY id FOR UPDATE`,
      [
        swap.tenant_id,
        swap.start_date,
        swap.end_date,
        swap.requester_id,
        swap.target_id,
        swap.team_id,
      ],
    );

    const reqIds = rows.rows
      .filter((s: { id: number; user_id: number }) => s.user_id === swap.requester_id)
      .map((s: { id: number; user_id: number }) => s.id);
    const tgtIds = rows.rows
      .filter((s: { id: number; user_id: number }) => s.user_id === swap.target_id)
      .map((s: { id: number; user_id: number }) => s.id);

    if (reqIds.length === 0 && tgtIds.length === 0) return 0;

    // Step 1: requester → NULL, Step 2: target → requester, Step 3: NULL → target
    if (reqIds.length > 0) {
      await client.query(`UPDATE ${table} SET user_id = NULL WHERE id = ANY($1::int[])`, [reqIds]);
    }
    if (tgtIds.length > 0) {
      await client.query(`UPDATE ${table} SET user_id = $1 WHERE id = ANY($2::int[])`, [
        swap.requester_id,
        tgtIds,
      ]);
    }
    if (reqIds.length > 0) {
      await client.query(`UPDATE ${table} SET user_id = $1 WHERE id = ANY($2::int[])`, [
        swap.target_id,
        reqIds,
      ]);
    }

    return reqIds.length + tgtIds.length;
  }

  // ----------------------------------------------------------
  // QUERIES
  // ----------------------------------------------------------

  async listSwapRequests(
    tenantId: number,
    filters: SwapRequestFilters,
  ): Promise<SwapRequestResponse[]> {
    let query = `${SELECT_DETAIL} WHERE ssr.tenant_id = $1 AND ssr.is_active = 1`;
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (filters.userId !== undefined) {
      query += ` AND (ssr.requester_id = $${idx} OR ssr.target_id = $${idx})`;
      params.push(filters.userId);
      idx++;
    }
    if (filters.status !== undefined) {
      query += ` AND ssr.status = $${idx}`;
      params.push(filters.status);
      idx++;
    }
    if (filters.teamId !== undefined) {
      query += ` AND ssr.team_id = $${idx}`;
      params.push(filters.teamId);
    }

    query += ` ORDER BY ssr.created_at DESC`;

    const rows = await this.db.query<DbSwapRequestDetailRow>(query, params);
    return rows.map(mapRowToResponse);
  }

  async getSwapRequestByUuid(uuid: string, tenantId: number): Promise<SwapRequestResponse> {
    const rows = await this.db.query<DbSwapRequestDetailRow>(
      `${SELECT_DETAIL} WHERE ssr.uuid = $1::uuid AND ssr.tenant_id = $2 AND ssr.is_active = 1`,
      [uuid, tenantId],
    );
    if (rows.length === 0) {
      throw new NotFoundException(`Swap request ${uuid} not found`);
    }
    return mapRowToResponse(rows[0] as DbSwapRequestDetailRow);
  }

  async getMyPendingConsents(tenantId: number, userId: number): Promise<SwapRequestResponse[]> {
    const rows = await this.db.query<DbSwapRequestDetailRow>(
      `${SELECT_DETAIL} WHERE ssr.tenant_id = $1 AND ssr.target_id = $2
       AND ssr.status = 'pending_partner' AND ssr.is_active = 1
       ORDER BY ssr.created_at DESC`,
      [tenantId, userId],
    );
    return rows.map(mapRowToResponse);
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  /** Validate all preconditions for a swap request. Returns teamId + resolved shift IDs. */
  private async validateSwapRequest(
    dto: CreateSwapRequestDto,
    tenantId: number,
    requesterId: number,
  ): Promise<{ teamId: number; requesterShiftId: number | null; targetShiftId: number | null }> {
    await this.assertSwapEnabled(tenantId);

    if (requesterId === dto.targetId) {
      throw new BadRequestException('Cannot swap with yourself');
    }

    // Resolve shifts from both tables (shifts + shift_rotation_history)
    const [requesterShift, targetShift] = await Promise.all([
      this.resolveUserShift(tenantId, requesterId, dto.startDate),
      this.resolveUserShift(tenantId, dto.targetId, dto.startDate),
    ]);

    if (requesterShift.teamId !== targetShift.teamId) {
      throw new BadRequestException('Swap is only allowed within the same team');
    }

    if (dto.swapScope !== 'single_day') {
      await this.validateRangeShifts(
        tenantId,
        requesterId,
        dto.targetId,
        dto.startDate,
        dto.endDate,
      );
    }

    await this.assertNoDuplicate(tenantId, requesterId, dto.targetId, dto.startDate, dto.endDate);

    return {
      teamId: requesterShift.teamId,
      requesterShiftId: dto.requesterShiftId ?? requesterShift.shiftId,
      targetShiftId: dto.targetShiftId ?? targetShift.shiftId,
    };
  }

  /**
   * Resolve a user's shift on a date — checks shifts table first, then shift_rotation_history.
   * Returns shiftId (null if rotation-only) and teamId for validation.
   */
  private async resolveUserShift(
    tenantId: number,
    userId: number,
    date: string,
  ): Promise<{ shiftId: number | null; teamId: number }> {
    // 1. Try shifts table
    const shiftRows = await this.db.query<{ id: number; team_id: number | null }>(
      `SELECT id, team_id FROM shifts WHERE tenant_id = $1 AND user_id = $2 AND date = $3 LIMIT 1`,
      [tenantId, userId, date],
    );
    if (shiftRows.length > 0 && shiftRows[0] !== undefined) {
      return { shiftId: shiftRows[0].id, teamId: shiftRows[0].team_id ?? 0 };
    }

    // 2. Try shift_rotation_history
    const rotationRows = await this.db.query<{ team_id: number }>(
      `SELECT team_id FROM shift_rotation_history
       WHERE tenant_id = $1 AND user_id = $2 AND shift_date = $3 LIMIT 1`,
      [tenantId, userId, date],
    );
    if (rotationRows.length > 0 && rotationRows[0] !== undefined) {
      return { shiftId: null, teamId: rotationRows[0].team_id };
    }

    throw new NotFoundException(`No shift found for user ${userId} on ${date}`);
  }

  private async assertSwapEnabled(tenantId: number): Promise<void> {
    const rows = await this.db.query<{ settings: Record<string, unknown> | null }>(SETTING_QUERY, [
      tenantId,
    ]);
    const settings = rows[0]?.settings;
    const enabled = (settings?.['swapRequestsEnabled'] as boolean | undefined) ?? false;
    if (!enabled) {
      throw new ForbiddenException('Shift swap requests are disabled for this tenant');
    }
  }

  private async validateRangeShifts(
    tenantId: number,
    requesterId: number,
    targetId: number,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    const counts = await this.db.query<{ user_id: number; cnt: string }>(
      `SELECT user_id, COUNT(*) AS cnt FROM (
         SELECT user_id, date FROM shifts
         WHERE tenant_id = $1 AND date >= $2 AND date <= $3 AND user_id IN ($4, $5)
         UNION
         SELECT user_id, shift_date AS date FROM shift_rotation_history
         WHERE tenant_id = $1 AND shift_date >= $2 AND shift_date <= $3 AND user_id IN ($4, $5)
       ) combined
       GROUP BY user_id`,
      [tenantId, startDate, endDate, requesterId, targetId],
    );

    const requesterCount = Number(
      counts.find((c: { user_id: number; cnt: string }) => c.user_id === requesterId)?.cnt ?? 0,
    );
    const targetCount = Number(
      counts.find((c: { user_id: number; cnt: string }) => c.user_id === targetId)?.cnt ?? 0,
    );

    if (requesterCount === 0 || targetCount === 0) {
      throw new BadRequestException(
        'Both users must have shifts in the entire date range for a week/range swap',
      );
    }
    if (requesterCount !== targetCount) {
      throw new BadRequestException(
        `Shift count mismatch: requester has ${requesterCount}, target has ${targetCount} shifts in range`,
      );
    }
  }

  private async assertNoDuplicate(
    tenantId: number,
    requesterId: number,
    targetId: number,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    const rows = await this.db.query<{ uuid: string }>(
      `SELECT uuid FROM shift_swap_requests
       WHERE tenant_id = $1 AND requester_id = $2 AND target_id = $3
         AND start_date = $4 AND end_date = $5
         AND status IN ('pending_partner', 'pending_approval')
         AND is_active = 1`,
      [tenantId, requesterId, targetId, startDate, endDate],
    );
    if (rows.length > 0) {
      throw new ConflictException('A pending swap request already exists for this shift pair');
    }
  }

  private async getRowOrThrow(uuid: string, tenantId: number): Promise<DbSwapRequestRow> {
    const rows = await this.db.query<DbSwapRequestRow>(
      `SELECT * FROM shift_swap_requests WHERE uuid = $1::uuid AND tenant_id = $2 AND is_active = 1`,
      [uuid, tenantId],
    );
    if (rows.length === 0) {
      throw new NotFoundException(`Swap request ${uuid} not found`);
    }
    return rows[0] as DbSwapRequestRow;
  }
}
