/**
 * Vacation Service — Core Business Logic
 *
 * Mutation operations for the vacation request lifecycle:
 * create, approve/deny, withdraw, cancel, edit.
 * Approver determination is in VacationApproverService (vacation-approver.service.ts).
 *
 * Read-only queries are in VacationQueriesService (vacation-queries.service.ts).
 * Validation logic is in VacationValidationService (vacation-validation.service.ts).
 *
 * All queries via db.tenantTransaction() (ADR-019).
 * Returns raw data — ResponseInterceptor wraps (ADR-007).
 * FOR UPDATE lock on status transitions (Race condition R6).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateVacationRequestDto } from './dto/create-vacation-request.dto.js';
import type { RespondVacationRequestDto } from './dto/respond-vacation-request.dto.js';
import type { UpdateVacationRequestDto } from './dto/update-vacation-request.dto.js';
import { VacationApproverService } from './vacation-approver.service.js';
import { VacationNotificationService } from './vacation-notification.service.js';
import { VacationValidationService } from './vacation-validation.service.js';
import type {
  ApproverResult,
  VacationRequest,
  VacationRequestRow,
  VacationRequestStatus,
} from './vacation.types.js';

/** User role lookup row */
interface UserRoleRow {
  id: number;
  role: string;
}

/** Computed/resolved values for inserting a vacation request */
interface InsertRequestParams {
  id: string;
  tenantId: number;
  requesterId: number;
  approverId: number | null;
  computedDays: number;
  status: VacationRequestStatus;
}

/** Team info with lead/deputy */
interface UserTeamInfoRow {
  team_id: number;
  team_name: string;
  team_lead_id: number | null;
  deputy_lead_id: number | null;
  department_id: number | null;
}

@Injectable()
export class VacationService {
  private readonly logger: Logger = new Logger(VacationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly approver: VacationApproverService,
    private readonly validation: VacationValidationService,
    private readonly notification: VacationNotificationService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ==========================================================================
  // Request lifecycle
  // ==========================================================================

  /** Create a new vacation request with full validation chain. */
  async createRequest(
    userId: number,
    tenantId: number,
    dto: CreateVacationRequestDto,
  ): Promise<VacationRequest> {
    const result = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationRequest> => {
        const teamInfo = await this.getUserTeamInfo(client, tenantId, userId);
        await this.validation.validateNewRequest(client, tenantId, userId, dto);
        const computedDays = await this.validation.computeWorkdays(
          tenantId,
          dto.startDate,
          dto.endDate,
          dto.halfDayStart,
          dto.halfDayEnd,
        );
        const approver = await this.approver.getApprover(tenantId, userId);
        const status: VacationRequestStatus =
          approver.autoApproved ? 'approved' : 'pending';
        await this.validation.validateBalanceAndBlackouts(
          tenantId,
          userId,
          dto,
          computedDays,
          teamInfo.team_id,
          teamInfo.department_id ?? undefined,
        );
        return await this.finalizeCreateRequest(
          client,
          tenantId,
          userId,
          dto,
          computedDays,
          status,
          approver,
        );
      },
    );

    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'create',
      entityType: 'vacation',
      details: `Urlaubsantrag erstellt: ${result.startDate} – ${result.endDate} (${result.vacationType}, ${String(result.computedDays)} Tage, Status: ${result.status})`,
      newValues: {
        requestId: result.id,
        startDate: result.startDate,
        endDate: result.endDate,
        vacationType: result.vacationType,
        computedDays: result.computedDays,
        status: result.status,
      },
    });

    return result;
  }

  /** Approve or deny a vacation request with FOR UPDATE lock. */
  async respondToRequest(
    responderId: number,
    tenantId: number,
    requestId: string,
    dto: RespondVacationRequestDto,
  ): Promise<VacationRequest> {
    const result = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationRequest> => {
        const request = await this.lockPendingRequest(
          client,
          tenantId,
          requestId,
        );
        await this.validateResponder(client, tenantId, responderId, request);
        return dto.action === 'approved' ?
            await this.approveRequest(
              client,
              tenantId,
              responderId,
              request,
              dto,
            )
          : await this.denyRequest(client, tenantId, responderId, request, dto);
      },
    );
    this.notification.notifyResponded(tenantId, result);

    void this.activityLogger.log({
      tenantId,
      userId: responderId,
      action: 'update',
      entityType: 'vacation',
      details: `Urlaubsantrag ${dto.action === 'approved' ? 'genehmigt' : 'abgelehnt'}: ${result.startDate} – ${result.endDate}`,
      oldValues: { status: 'pending' },
      newValues: {
        requestId: result.id,
        status: result.status,
        responseNote: dto.responseNote,
        isSpecialLeave: dto.isSpecialLeave,
      },
    });

    return result;
  }

  /** Withdraw a vacation request (requester only). */
  async withdrawRequest(
    requesterId: number,
    tenantId: number,
    requestId: string,
  ): Promise<void> {
    let approverId: number | null = null;
    let requesterName: string | undefined;

    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        const request = await this.lockOwnRequest(
          client,
          tenantId,
          requestId,
          requesterId,
        );
        approverId = request.approver_id;
        requesterName = await this.resolveUserName(
          client,
          tenantId,
          requesterId,
        );
        await this.executeWithdraw(
          client,
          tenantId,
          requestId,
          requesterId,
          request,
        );
      },
    );
    this.notification.notifyWithdrawn(
      tenantId,
      requestId,
      requesterId,
      approverId,
      requesterName,
    );

    void this.activityLogger.log({
      tenantId,
      userId: requesterId,
      action: 'update',
      entityType: 'vacation',
      details: `Urlaubsantrag zurückgezogen: ${requestId}`,
      newValues: { requestId, status: 'withdrawn' },
    });
  }

  /** Execute the withdraw status transition inside a transaction. */
  private async executeWithdraw(
    client: PoolClient,
    tenantId: number,
    requestId: string,
    requesterId: number,
    request: VacationRequestRow,
  ): Promise<void> {
    if (request.status === 'pending') {
      await this.transitionStatus(
        client,
        tenantId,
        requestId,
        'pending',
        'withdrawn',
        requesterId,
        null,
      );
      return;
    }
    if (request.status === 'approved') {
      this.validation.guardFutureStartDate(request.start_date);
      await this.transitionStatus(
        client,
        tenantId,
        requestId,
        'approved',
        'withdrawn',
        requesterId,
        null,
      );
      await this.deactivateAvailability(
        client,
        tenantId,
        request.requester_id,
        request.start_date,
        request.end_date,
      );
      return;
    }
    throw new ConflictException(
      `Cannot withdraw a request with status '${request.status}'`,
    );
  }

  /** Cancel an approved vacation request (admin/root/approver). */
  async cancelRequest(
    userId: number,
    tenantId: number,
    requestId: string,
    reason: string,
  ): Promise<void> {
    let requesterId = 0;

    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        const user = await this.getUserRole(client, tenantId, userId);
        const row = await this.lockRequestById(client, tenantId, requestId);

        this.assertCancelPermission(user, row, userId);

        requesterId = row.requester_id;
        await this.persistCancellation(
          client,
          tenantId,
          requestId,
          row,
          userId,
          reason,
        );
        this.logger.log(
          `Request ${requestId} cancelled by user ${String(userId)} (role: ${user.role})`,
        );
      },
    );
    this.notification.notifyCancelled(
      tenantId,
      requestId,
      requesterId,
      userId,
      reason,
    );
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'update',
      entityType: 'vacation',
      details: `Urlaubsantrag widerrufen: ${requestId} (Grund: ${reason})`,
      oldValues: { status: 'approved' },
      newValues: { requestId, status: 'cancelled', reason },
    });
  }

  /** Edit a pending vacation request (requester only). */
  async editRequest(
    requesterId: number,
    tenantId: number,
    requestId: string,
    dto: UpdateVacationRequestDto,
  ): Promise<VacationRequest> {
    const result = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationRequest> => {
        const existing = await this.lockOwnRequest(
          client,
          tenantId,
          requestId,
          requesterId,
        );
        if (existing.status !== 'pending') {
          throw new ConflictException(
            `Can only edit pending requests. Current: '${existing.status}'`,
          );
        }
        const merged = this.validation.mergeWithExisting(dto, existing);
        const teamInfo = await this.getUserTeamInfo(
          client,
          tenantId,
          requesterId,
        );
        await this.validation.validateEditedRequest(
          client,
          tenantId,
          requesterId,
          requestId,
          merged,
          teamInfo.team_id,
          teamInfo.department_id ?? undefined,
        );
        const row = await this.applyRequestUpdate(
          client,
          tenantId,
          requestId,
          requesterId,
          dto,
          merged,
        );
        this.logger.log(
          `Request ${requestId} edited by ${String(requesterId)}`,
        );
        return this.mapRowToRequest(row);
      },
    );

    this.logRequestEdited(tenantId, requesterId, result);

    return result;
  }

  // ==========================================================================
  // Private — createRequest helpers
  // ==========================================================================

  private async finalizeCreateRequest(
    client: PoolClient,
    tenantId: number,
    userId: number,
    dto: CreateVacationRequestDto,
    computedDays: number,
    status: VacationRequestStatus,
    approver: ApproverResult,
  ): Promise<VacationRequest> {
    const id: string = uuidv7();
    const row = await this.insertRequest(
      client,
      {
        id,
        tenantId,
        requesterId: userId,
        approverId: approver.approverId,
        computedDays,
        status,
      },
      dto,
    );
    await this.insertStatusLog(
      client,
      tenantId,
      id,
      null,
      status,
      userId,
      null,
    );
    if (approver.autoApproved) {
      await this.insertAvailability(
        client,
        tenantId,
        userId,
        dto.startDate,
        dto.endDate,
        userId,
      );
    }
    this.logger.log(
      `Vacation ${id} created (${status}) for user ${String(userId)}`,
    );
    const request = this.mapRowToRequest(row);
    this.notification.notifyCreated(tenantId, request);
    return request;
  }

  // ==========================================================================
  // Private — Approve/deny
  // ==========================================================================

  private async approveRequest(
    client: PoolClient,
    tenantId: number,
    responderId: number,
    request: VacationRequestRow,
    dto: RespondVacationRequestDto,
  ): Promise<VacationRequest> {
    if (!dto.isSpecialLeave && request.vacation_type !== 'unpaid') {
      await this.validation.reCheckBalanceForApproval(
        tenantId,
        request,
        Number.parseFloat(request.computed_days),
      );
    }
    const row = await this.updateStatus(
      client,
      tenantId,
      request.id,
      responderId,
      dto,
      'approved',
    );
    await this.insertStatusLog(
      client,
      tenantId,
      request.id,
      'pending',
      'approved',
      responderId,
      dto.responseNote ?? null,
    );
    await this.insertAvailability(
      client,
      tenantId,
      request.requester_id,
      request.start_date,
      request.end_date,
      responderId,
    );
    return this.mapRowToRequest(row);
  }

  private async denyRequest(
    client: PoolClient,
    tenantId: number,
    responderId: number,
    request: VacationRequestRow,
    dto: RespondVacationRequestDto,
  ): Promise<VacationRequest> {
    const row = await this.updateStatus(
      client,
      tenantId,
      request.id,
      responderId,
      dto,
      'denied',
    );
    await this.insertStatusLog(
      client,
      tenantId,
      request.id,
      'pending',
      'denied',
      responderId,
      dto.responseNote ?? null,
    );
    return this.mapRowToRequest(row);
  }

  // ==========================================================================
  // Private — Locking + authorization
  // ==========================================================================

  private async lockPendingRequest(
    client: PoolClient,
    tenantId: number,
    requestId: string,
  ): Promise<VacationRequestRow> {
    const row = await this.lockRequestById(client, tenantId, requestId);
    if (row.status !== 'pending') {
      throw new ConflictException(
        `Request has already been ${row.status}. Cannot respond.`,
      );
    }
    return row;
  }

  private async lockRequestById(
    client: PoolClient,
    tenantId: number,
    requestId: string,
  ): Promise<VacationRequestRow> {
    const result = await client.query<VacationRequestRow>(
      `SELECT * FROM vacation_requests
       WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE} FOR UPDATE`,
      [requestId, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined)
      throw new NotFoundException(`Request ${requestId} not found`);
    return row;
  }

  private async lockOwnRequest(
    client: PoolClient,
    tenantId: number,
    requestId: string,
    requesterId: number,
  ): Promise<VacationRequestRow> {
    const row = await this.lockRequestById(client, tenantId, requestId);
    if (row.requester_id !== requesterId) {
      throw new ForbiddenException('You can only modify your own requests');
    }
    return row;
  }

  private async validateResponder(
    client: PoolClient,
    tenantId: number,
    responderId: number,
    request: VacationRequestRow,
  ): Promise<void> {
    if (request.approver_id === responderId) return;
    const result = await client.query<{ has_full_access: number | null }>(
      `SELECT has_full_access FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [responderId, tenantId],
    );
    if (result.rows[0]?.has_full_access !== 1) {
      throw new ForbiddenException(
        'You are not authorized to respond to this request',
      );
    }
  }

  // ==========================================================================
  // Private — DB helpers
  // ==========================================================================

  private async resolveUserName(
    client: PoolClient,
    tenantId: number,
    userId: number,
  ): Promise<string | undefined> {
    const result = await client.query<{
      first_name: string | null;
      last_name: string | null;
    }>(
      `SELECT first_name, last_name FROM users WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) return undefined;
    const parts = [row.first_name, row.last_name].filter(
      (p: string | null): p is string => p !== null && p !== '',
    );
    return parts.length > 0 ? parts.join(' ') : undefined;
  }

  private async getUserTeamInfo(
    client: PoolClient,
    tenantId: number,
    userId: number,
  ): Promise<UserTeamInfoRow> {
    const result = await client.query<UserTeamInfoRow>(
      `SELECT t.id AS team_id, t.name AS team_name,
              t.team_lead_id, t.deputy_lead_id, t.department_id
       FROM teams t JOIN user_teams ut ON t.id = ut.team_id
       WHERE ut.user_id = $1 AND t.tenant_id = $2 AND t.is_active = ${IS_ACTIVE.ACTIVE}`,
      [userId, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new BadRequestException(
        'Employee must be assigned to a team before requesting vacation',
      );
    }
    return row;
  }

  private assertCancelPermission(
    user: UserRoleRow,
    row: VacationRequestRow,
    userId: number,
  ): void {
    const isAdminOrRoot = user.role === 'admin' || user.role === 'root';
    const isApprover = row.approver_id === userId;

    if (!isAdminOrRoot && !isApprover) {
      throw new ForbiddenException(
        'Nur Admins oder der genehmigende Vorgesetzte dürfen Anträge widerrufen',
      );
    }
    if (row.status !== 'approved') {
      throw new ConflictException(
        `Nur genehmigte Anträge können widerrufen werden. Aktuell: '${row.status}'`,
      );
    }
    const requestYear = new Date(row.start_date).getFullYear();
    const currentYear = new Date().getFullYear();
    if (requestYear !== currentYear) {
      throw new ConflictException(
        `Widerruf nur für das aktuelle Jahr (${String(currentYear)}) möglich`,
      );
    }
  }

  private async persistCancellation(
    client: PoolClient,
    tenantId: number,
    requestId: string,
    row: VacationRequestRow,
    userId: number,
    reason: string,
  ): Promise<void> {
    await this.transitionStatus(
      client,
      tenantId,
      requestId,
      'approved',
      'cancelled',
      userId,
      reason,
    );
    await client.query(
      `UPDATE vacation_requests
       SET response_note = $1, responded_by = $2, responded_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [reason, userId, requestId, tenantId],
    );
    await this.deactivateAvailability(
      client,
      tenantId,
      row.requester_id,
      row.start_date,
      row.end_date,
    );
  }

  private async getUserRole(
    client: PoolClient,
    tenantId: number,
    userId: number,
  ): Promise<UserRoleRow> {
    const result = await client.query<UserRoleRow>(
      `SELECT id, role FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [userId, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined)
      throw new NotFoundException(`User ${String(userId)} not found`);
    return row;
  }

  private async insertRequest(
    client: PoolClient,
    params: InsertRequestParams,
    dto: CreateVacationRequestDto,
  ): Promise<VacationRequestRow> {
    const result = await client.query<VacationRequestRow>(
      `INSERT INTO vacation_requests
         (id, tenant_id, requester_id, approver_id, substitute_id,
          start_date, end_date, half_day_start, half_day_end,
          vacation_type, status, computed_days, is_special_leave, request_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        params.id,
        params.tenantId,
        params.requesterId,
        params.approverId,
        dto.substituteId ?? null,
        dto.startDate,
        dto.endDate,
        dto.halfDayStart,
        dto.halfDayEnd,
        dto.vacationType,
        params.status,
        params.computedDays,
        false,
        dto.requestNote ?? null,
      ],
    );
    const row = result.rows[0];
    if (row === undefined)
      throw new Error('INSERT into vacation_requests returned no rows');
    return row;
  }

  private async insertStatusLog(
    client: PoolClient,
    tenantId: number,
    requestId: string,
    oldStatus: VacationRequestStatus | null,
    newStatus: VacationRequestStatus,
    changedBy: number,
    note: string | null,
  ): Promise<void> {
    await client.query(
      `INSERT INTO vacation_request_status_log
         (id, tenant_id, request_id, old_status, new_status, changed_by, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uuidv7(), tenantId, requestId, oldStatus, newStatus, changedBy, note],
    );
  }

  private async insertAvailability(
    client: PoolClient,
    tenantId: number,
    userId: number,
    startDate: string,
    endDate: string,
    createdBy: number,
  ): Promise<void> {
    await client.query(
      `INSERT INTO user_availability
         (user_id, tenant_id, status, start_date, end_date, reason, created_by)
       VALUES ($1,$2,'vacation',$3,$4,'Approved vacation',$5)`,
      [userId, tenantId, startDate, endDate, createdBy],
    );
  }

  private async deactivateAvailability(
    client: PoolClient,
    tenantId: number,
    userId: number,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    await client.query(
      `DELETE FROM user_availability
       WHERE user_id = $1 AND tenant_id = $2 AND status = 'vacation'
         AND start_date = $3 AND end_date = $4`,
      [userId, tenantId, startDate, endDate],
    );
  }

  private async updateStatus(
    client: PoolClient,
    tenantId: number,
    requestId: string,
    responderId: number,
    dto: RespondVacationRequestDto,
    status: 'approved' | 'denied',
  ): Promise<VacationRequestRow> {
    const result = await client.query<VacationRequestRow>(
      `UPDATE vacation_requests
       SET status = $1, is_special_leave = $2, response_note = $3,
           responded_at = NOW(), responded_by = $4, updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6 AND is_active = ${IS_ACTIVE.ACTIVE} RETURNING *`,
      [
        status,
        status === 'approved' ? dto.isSpecialLeave : false,
        dto.responseNote ?? null,
        responderId,
        requestId,
        tenantId,
      ],
    );
    const row = result.rows[0];
    if (row === undefined)
      throw new Error('UPDATE vacation_requests returned no rows');
    return row;
  }

  private async transitionStatus(
    client: PoolClient,
    tenantId: number,
    requestId: string,
    oldStatus: VacationRequestStatus,
    newStatus: VacationRequestStatus,
    changedBy: number,
    note: string | null,
  ): Promise<void> {
    await client.query(
      `UPDATE vacation_requests SET status = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [newStatus, requestId, tenantId],
    );
    await this.insertStatusLog(
      client,
      tenantId,
      requestId,
      oldStatus,
      newStatus,
      changedBy,
      note,
    );
  }

  // ==========================================================================
  // Private — Edit helpers
  // ==========================================================================

  private async applyRequestUpdate(
    client: PoolClient,
    tenantId: number,
    requestId: string,
    requesterId: number,
    dto: UpdateVacationRequestDto,
    merged: {
      startDate: string;
      endDate: string;
      halfDayStart: string;
      halfDayEnd: string;
      vacationType: string;
    },
  ): Promise<VacationRequestRow> {
    const computedDays = await this.validation.countWorkdays(
      tenantId,
      merged.startDate,
      merged.endDate,
      merged.halfDayStart as 'none' | 'morning' | 'afternoon',
      merged.halfDayEnd as 'none' | 'morning' | 'afternoon',
    );
    const result = await client.query<VacationRequestRow>(
      `UPDATE vacation_requests
       SET start_date=$1, end_date=$2, half_day_start=$3, half_day_end=$4,
           vacation_type=$5, computed_days=$6, substitute_id=$7,
           request_note=$8, updated_at=NOW()
       WHERE id=$9 AND tenant_id=$10 AND is_active = ${IS_ACTIVE.ACTIVE} RETURNING *`,
      [
        merged.startDate,
        merged.endDate,
        merged.halfDayStart,
        merged.halfDayEnd,
        merged.vacationType,
        computedDays,
        dto.substituteId,
        dto.requestNote,
        requestId,
        tenantId,
      ],
    );
    const row = result.rows[0];
    if (row === undefined)
      throw new Error('UPDATE vacation_requests returned no rows');
    await this.insertStatusLog(
      client,
      tenantId,
      requestId,
      'pending',
      'pending',
      requesterId,
      'Request edited',
    );
    return row;
  }

  // ==========================================================================
  // Private — Activity logging
  // ==========================================================================

  /** Log activity for an edited vacation request. */
  private logRequestEdited(
    tenantId: number,
    requesterId: number,
    request: VacationRequest,
  ): void {
    void this.activityLogger.log({
      tenantId,
      userId: requesterId,
      action: 'update',
      entityType: 'vacation',
      details: `Urlaubsantrag bearbeitet: ${request.startDate} – ${request.endDate}`,
      newValues: {
        requestId: request.id,
        startDate: request.startDate,
        endDate: request.endDate,
        vacationType: request.vacationType,
        computedDays: request.computedDays,
      },
    });
  }

  // ==========================================================================
  // Private — Mapping
  // ==========================================================================

  private mapRowToRequest(row: VacationRequestRow): VacationRequest {
    return {
      id: row.id,
      requesterId: row.requester_id,
      approverId: row.approver_id,
      substituteId: row.substitute_id,
      startDate: this.fmtDateStr(row.start_date),
      endDate: this.fmtDateStr(row.end_date),
      halfDayStart: row.half_day_start,
      halfDayEnd: row.half_day_end,
      vacationType: row.vacation_type,
      status: row.status,
      computedDays: Number.parseFloat(row.computed_days),
      isSpecialLeave: row.is_special_leave,
      requestNote: row.request_note,
      responseNote: row.response_note,
      respondedAt: row.responded_at,
      respondedBy: row.responded_by,
      createdAt:
        typeof row.created_at === 'string' ?
          row.created_at
        : new Date(row.created_at).toISOString(),
      updatedAt:
        typeof row.updated_at === 'string' ?
          row.updated_at
        : new Date(row.updated_at).toISOString(),
    };
  }

  private fmtDateStr(dateInput: string | Date): string {
    if (typeof dateInput === 'string') return dateInput.slice(0, 10);
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${String(y)}-${m}-${d}`;
  }
}
