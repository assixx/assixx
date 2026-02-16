/**
 * Vacation Validation Service
 *
 * Encapsulates all business-rule validation for vacation requests:
 * advance notice, max consecutive days, overlap, balance, blackouts,
 * workday computation, and merge logic for edits.
 *
 * Extracted from VacationService to respect max-lines limit.
 * All queries via db.tenantTransaction() (ADR-019).
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { PoolClient } from 'pg';

import type { CreateVacationRequestDto } from './dto/create-vacation-request.dto.js';
import type { UpdateVacationRequestDto } from './dto/update-vacation-request.dto.js';
import { VacationBlackoutsService } from './vacation-blackouts.service.js';
import { VacationEntitlementsService } from './vacation-entitlements.service.js';
import { VacationHolidaysService } from './vacation-holidays.service.js';
import { VacationSettingsService } from './vacation-settings.service.js';
import type {
  VacationHalfDay,
  VacationRequestRow,
  VacationType,
} from './vacation.types.js';

/** Merged fields for edit validation */
export interface MergedRequestFields {
  startDate: string;
  endDate: string;
  halfDayStart: VacationHalfDay;
  halfDayEnd: VacationHalfDay;
  vacationType: VacationType;
}

@Injectable()
export class VacationValidationService {
  constructor(
    private readonly settingsService: VacationSettingsService,
    private readonly entitlementsService: VacationEntitlementsService,
    private readonly blackoutsService: VacationBlackoutsService,
    private readonly holidaysService: VacationHolidaysService,
  ) {}

  /** Validate a new request: past-date, advance notice, max consecutive, overlap. */
  async validateNewRequest(
    client: PoolClient,
    tenantId: number,
    userId: number,
    dto: CreateVacationRequestDto,
  ): Promise<void> {
    this.validateStartDateNotInPast(dto.startDate);
    const settings = await this.settingsService.getSettings(tenantId);
    this.validateAdvanceNotice(dto.startDate, settings.advanceNoticeDays);
    this.validateMaxConsecutive(
      dto.startDate,
      dto.endDate,
      settings.maxConsecutiveDays,
    );
    await this.checkOverlap(
      client,
      tenantId,
      userId,
      dto.startDate,
      dto.endDate,
    );
  }

  /** Check balance sufficiency and blackout conflicts. */
  async validateBalanceAndBlackouts(
    tenantId: number,
    userId: number,
    dto: CreateVacationRequestDto,
    computedDays: number,
    teamId: number,
    departmentId: number | undefined,
  ): Promise<void> {
    if (dto.vacationType !== 'unpaid') {
      await this.checkBalance(
        tenantId,
        userId,
        dto.startDate,
        dto.endDate,
        computedDays,
      );
    }
    await this.checkBlackouts(
      tenantId,
      dto.startDate,
      dto.endDate,
      teamId,
      departmentId,
    );
  }

  /** Compute workdays in range, throwing if zero. */
  async computeWorkdays(
    tenantId: number,
    startDate: string,
    endDate: string,
    halfDayStart: VacationHalfDay,
    halfDayEnd: VacationHalfDay,
  ): Promise<number> {
    const days = await this.holidaysService.countWorkdays(
      tenantId,
      startDate,
      endDate,
      halfDayStart,
      halfDayEnd,
    );
    if (days === 0) {
      throw new BadRequestException('Selected date range contains no workdays');
    }
    return days;
  }

  /** Count workdays without zero-check (for edit recomputation). */
  async countWorkdays(
    tenantId: number,
    startDate: string,
    endDate: string,
    halfDayStart: VacationHalfDay,
    halfDayEnd: VacationHalfDay,
  ): Promise<number> {
    return await this.holidaysService.countWorkdays(
      tenantId,
      startDate,
      endDate,
      halfDayStart,
      halfDayEnd,
    );
  }

  /** Re-check balance at approval time (approver flow). */
  async reCheckBalanceForApproval(
    tenantId: number,
    request: VacationRequestRow,
    computedDays: number,
  ): Promise<void> {
    const balance = await this.entitlementsService.getBalance(
      tenantId,
      request.requester_id,
      new Date(request.start_date).getFullYear(),
    );
    const available =
      balance.remainingDays - balance.pendingDays + computedDays;
    if (available < computedDays) {
      throw new BadRequestException(
        `Insufficient balance to approve. Available: ${String(available)}, required: ${String(computedDays)}`,
      );
    }
  }

  /** Guard that start_date is in the future (for withdrawal). */
  guardFutureStartDate(startDate: string): void {
    if (startDate <= this.formatDate(new Date())) {
      throw new ForbiddenException(
        'Cannot withdraw a vacation that has already started or is in the past',
      );
    }
  }

  /** Merge DTO partial fields with existing request values. */
  mergeWithExisting(
    dto: UpdateVacationRequestDto,
    existing: VacationRequestRow,
  ): MergedRequestFields {
    return {
      startDate: dto.startDate ?? this.fmtDateStr(existing.start_date),
      endDate: dto.endDate ?? this.fmtDateStr(existing.end_date),
      halfDayStart: dto.halfDayStart ?? existing.half_day_start,
      halfDayEnd: dto.halfDayEnd ?? existing.half_day_end,
      vacationType: dto.vacationType ?? existing.vacation_type,
    };
  }

  /** Validate merged fields for an edited request. */
  async validateEditedRequest(
    client: PoolClient,
    tenantId: number,
    requesterId: number,
    requestId: string,
    merged: MergedRequestFields,
    teamId: number,
    departmentId: number | undefined,
  ): Promise<void> {
    if (merged.endDate < merged.startDate) {
      throw new BadRequestException('End date must be on or after start date');
    }
    this.validateStartDateNotInPast(merged.startDate);
    const settings = await this.settingsService.getSettings(tenantId);
    this.validateAdvanceNotice(merged.startDate, settings.advanceNoticeDays);
    this.validateMaxConsecutive(
      merged.startDate,
      merged.endDate,
      settings.maxConsecutiveDays,
    );
    await this.checkOverlap(
      client,
      tenantId,
      requesterId,
      merged.startDate,
      merged.endDate,
      requestId,
    );
    const computedDays = await this.holidaysService.countWorkdays(
      tenantId,
      merged.startDate,
      merged.endDate,
      merged.halfDayStart,
      merged.halfDayEnd,
    );
    if (computedDays === 0) {
      throw new BadRequestException('Selected date range contains no workdays');
    }
    if (merged.vacationType !== 'unpaid') {
      await this.checkBalance(
        tenantId,
        requesterId,
        merged.startDate,
        merged.endDate,
        computedDays,
      );
    }
    await this.checkBlackouts(
      tenantId,
      merged.startDate,
      merged.endDate,
      teamId,
      departmentId,
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /** Reject start dates in the past — independent of advance_notice_days. */
  private validateStartDateNotInPast(startDate: string): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    if (start < today) {
      throw new BadRequestException(
        'Startdatum darf nicht in der Vergangenheit liegen',
      );
    }
  }

  private validateAdvanceNotice(startDate: string, advanceDays: number): void {
    if (advanceDays === 0) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const earliest = new Date(today);
    earliest.setDate(earliest.getDate() + advanceDays);
    if (new Date(startDate) < earliest) {
      throw new BadRequestException(
        `Vacation must be requested at least ${String(advanceDays)} day(s) in advance`,
      );
    }
  }

  private validateMaxConsecutive(
    startDate: string,
    endDate: string,
    maxDays: number | null,
  ): void {
    if (maxDays === null) return;
    const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();
    const calDays = Math.round(diffMs / 86400000) + 1;
    if (calDays > maxDays) {
      throw new BadRequestException(
        `Vacation cannot exceed ${String(maxDays)} consecutive calendar days`,
      );
    }
  }

  private async checkOverlap(
    client: PoolClient,
    tenantId: number,
    userId: number,
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<void> {
    let sql = `SELECT 1 FROM vacation_requests
      WHERE tenant_id = $1 AND requester_id = $2
        AND status IN ('pending','approved')
        AND is_active = 1 AND start_date <= $4 AND end_date >= $3`;
    const params: unknown[] = [tenantId, userId, startDate, endDate];
    if (excludeId !== undefined) {
      sql += ` AND id != $5`;
      params.push(excludeId);
    }
    if ((await client.query(sql, params)).rows.length > 0) {
      throw new ConflictException('Overlapping vacation request exists');
    }
  }

  private async checkBalance(
    tenantId: number,
    userId: number,
    startDate: string,
    endDate: string,
    _computedDays: number,
  ): Promise<void> {
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();
    if (startYear === endYear) {
      const bal = await this.entitlementsService.getBalance(
        tenantId,
        userId,
        startYear,
      );
      if (bal.projectedRemaining < 0) {
        throw new BadRequestException(
          `Insufficient balance for ${String(startYear)}`,
        );
      }
      return;
    }
    const [b1, b2] = await Promise.all([
      this.entitlementsService.getBalance(tenantId, userId, startYear),
      this.entitlementsService.getBalance(tenantId, userId, endYear),
    ]);
    if (b1.projectedRemaining < 0) {
      throw new BadRequestException(
        `Insufficient balance for ${String(startYear)}`,
      );
    }
    if (b2.projectedRemaining < 0) {
      throw new BadRequestException(
        `Insufficient balance for ${String(endYear)}`,
      );
    }
  }

  private async checkBlackouts(
    tenantId: number,
    startDate: string,
    endDate: string,
    teamId: number,
    departmentId: number | undefined,
  ): Promise<void> {
    const conflicts = await this.blackoutsService.getConflicts(
      tenantId,
      startDate,
      endDate,
      teamId,
      departmentId,
    );
    if (conflicts.length > 0) {
      const names = conflicts
        .map(
          (c: { name: string; startDate: string; endDate: string }) =>
            `"${c.name}" (${c.startDate}\u2013${c.endDate})`,
        )
        .join(', ');
      throw new BadRequestException(
        `Request conflicts with blackout period(s): ${names}`,
      );
    }
  }

  private fmtDateStr(dateInput: string | Date): string {
    if (typeof dateInput === 'string') return dateInput.slice(0, 10);
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${String(y)}-${m}-${d}`;
  }

  private formatDate(date: Date): string {
    return this.fmtDateStr(date);
  }
}
