/**
 * Vacation Entitlements Service
 *
 * Manages per-user per-year vacation entitlements and provides the critical
 * `getBalance()` algorithm that the vacation service depends on.
 *
 * Entitlements table: `vacation_entitlements` (Migration 29)
 * - UNIQUE(tenant_id, user_id, year) — one entitlement per user per year
 * - NUMERIC columns: `total_days`, `carried_over_days`, `additional_days` (come as strings from pg)
 * - RLS enforced via `db.tenantTransaction()` (ADR-019)
 *
 * Depends on: VacationHolidaysService (for cross-year workday splitting)
 * Depends on: VacationSettingsService (for default_annual_days, max_carry_over)
 */
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import type { CreateEntitlementDto } from './dto/create-entitlement.dto.js';
import type { UpdateEntitlementDto } from './dto/update-entitlement.dto.js';
import { VacationHolidaysService } from './vacation-holidays.service.js';
import { VacationSettingsService } from './vacation-settings.service.js';
import type {
  VacationBalance,
  VacationEntitlement,
  VacationEntitlementRow,
} from './vacation.types.js';

/** Row shape for the used/pending days query */
interface DaysSumRow {
  total: string | null;
}

/** Row shape for cross-year request splitting */
interface CrossYearRequestRow {
  id: string;
  start_date: string;
  end_date: string;
  half_day_start: string;
  half_day_end: string;
  computed_days: string;
}

@Injectable()
export class VacationEntitlementsService {
  private readonly logger: Logger = new Logger(
    VacationEntitlementsService.name,
  );

  constructor(
    private readonly db: DatabaseService,
    private readonly holidaysService: VacationHolidaysService,
    private readonly settingsService: VacationSettingsService,
  ) {}

  /**
   * Get a user's entitlement for a specific year.
   * Returns undefined if no entitlement exists.
   */
  async getEntitlement(
    tenantId: number,
    userId: number,
    year: number,
  ): Promise<VacationEntitlement | undefined> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationEntitlement | undefined> => {
        const row: VacationEntitlementRow | undefined =
          await this.findEntitlement(client, tenantId, userId, year);

        return row !== undefined ? this.mapRowToEntitlement(row) : undefined;
      },
    );
  }

  /**
   * THE critical balance calculation.
   *
   * Computes: available, used, pending, remaining, projectedRemaining.
   * Handles cross-year request splitting via countWorkdays().
   * Excludes special_leave from usedDays/pendingDays.
   * Respects carry-over expiry date.
   */
  async getBalance(
    tenantId: number,
    userId: number,
    year?: number,
  ): Promise<VacationBalance> {
    const targetYear: number = year ?? new Date().getFullYear();

    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationBalance> => {
        // 1. Get entitlement (or create default)
        let entitlement: VacationEntitlementRow | undefined =
          await this.findEntitlement(client, tenantId, userId, targetYear);

        entitlement ??= await this.createDefaultEntitlement(
          client,
          tenantId,
          userId,
          targetYear,
        );

        // 2. Calculate effective carry-over (respects expiry)
        const effectiveCarriedOver: number = this.calculateEffectiveCarryOver(
          entitlement.carried_over_days,
          entitlement.carry_over_expires_at,
        );

        // 3. Calculate available days
        const totalDays: number = Number.parseFloat(entitlement.total_days);
        const additionalDays: number = Number.parseFloat(
          entitlement.additional_days,
        );
        const availableDays: number =
          totalDays + effectiveCarriedOver + additionalDays;

        // 4. Calculate used + pending days (with cross-year splitting)
        const usedDays: number = await this.calculateDaysForStatus(
          client,
          tenantId,
          userId,
          targetYear,
          'approved',
        );
        const pendingDays: number = await this.calculateDaysForStatus(
          client,
          tenantId,
          userId,
          targetYear,
          'pending',
        );

        // 5. Compute remaining
        const remainingDays: number = availableDays - usedDays;
        const projectedRemaining: number = remainingDays - pendingDays;

        return {
          year: targetYear,
          totalDays,
          carriedOverDays: Number.parseFloat(entitlement.carried_over_days),
          effectiveCarriedOver,
          additionalDays,
          availableDays,
          usedDays,
          remainingDays,
          pendingDays,
          projectedRemaining,
        };
      },
    );
  }

  /**
   * Create or update a user's entitlement (UPSERT).
   * INSERT ON CONFLICT UPDATE on (tenant_id, user_id, year).
   */
  async createOrUpdateEntitlement(
    tenantId: number,
    userId: number,
    dto: CreateEntitlementDto,
  ): Promise<VacationEntitlement> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationEntitlement> => {
        const id: string = uuidv7();

        try {
          const result = await client.query<VacationEntitlementRow>(
            `INSERT INTO vacation_entitlements
               (id, tenant_id, user_id, year, total_days, carried_over_days,
                additional_days, carry_over_expires_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (tenant_id, user_id, year) DO UPDATE SET
               total_days = EXCLUDED.total_days,
               carried_over_days = EXCLUDED.carried_over_days,
               additional_days = EXCLUDED.additional_days,
               carry_over_expires_at = EXCLUDED.carry_over_expires_at,
               updated_at = NOW()
             RETURNING id, tenant_id, user_id, year, total_days,
                       carried_over_days, additional_days,
                       carry_over_expires_at, is_active,
                       created_by, created_at, updated_at`,
            [
              id,
              tenantId,
              dto.userId,
              dto.year,
              dto.totalDays,
              dto.carriedOverDays,
              dto.additionalDays,
              dto.carryOverExpiresAt ?? null,
              userId,
            ],
          );

          const row: VacationEntitlementRow | undefined = result.rows[0];
          if (row === undefined) {
            throw new Error(
              'UPSERT into vacation_entitlements returned no rows',
            );
          }

          this.logger.log(
            `Entitlement upserted: user ${dto.userId}, year ${dto.year} (tenant ${tenantId})`,
          );
          return this.mapRowToEntitlement(row);
        } catch (error: unknown) {
          if (this.isUniqueViolation(error)) {
            throw new ConflictException(
              `Entitlement already exists for user ${dto.userId}, year ${dto.year}`,
            );
          }
          throw error;
        }
      },
    );
  }

  /**
   * Add additional days to a user's entitlement for a year.
   * Throws NotFoundException if no entitlement exists.
   */
  async addDays(
    tenantId: number,
    userId: number,
    year: number,
    days: number,
  ): Promise<VacationEntitlement> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationEntitlement> => {
        const result = await client.query<VacationEntitlementRow>(
          `UPDATE vacation_entitlements
           SET additional_days = additional_days + $1, updated_at = NOW()
           WHERE tenant_id = $2 AND user_id = $3 AND year = $4 AND is_active = 1
           RETURNING id, tenant_id, user_id, year, total_days,
                     carried_over_days, additional_days,
                     carry_over_expires_at, is_active,
                     created_by, created_at, updated_at`,
          [days, tenantId, userId, year],
        );

        const row: VacationEntitlementRow | undefined = result.rows[0];
        if (row === undefined) {
          throw new NotFoundException(
            `No entitlement found for user ${userId}, year ${year}`,
          );
        }

        this.logger.log(
          `Added ${days} days to user ${userId}, year ${year} (tenant ${tenantId})`,
        );
        return this.mapRowToEntitlement(row);
      },
    );
  }

  /**
   * Carry over remaining days from one year to the next.
   * Respects max_carry_over_days from tenant settings.
   * Sets carry_over_expires_at based on tenant deadline settings.
   */
  async carryOverRemainingDays(
    tenantId: number,
    userId: number,
    fromYear: number,
  ): Promise<VacationEntitlement> {
    // Get balance for source year and settings for limits
    const [balance, settings] = await Promise.all([
      this.getBalance(tenantId, userId, fromYear),
      this.settingsService.getSettings(tenantId),
    ]);

    const remainingDays: number = Math.max(0, balance.remainingDays);
    const carryOver: number = Math.min(
      remainingDays,
      settings.maxCarryOverDays,
    );

    // Calculate carry-over expiry date
    const toYear: number = fromYear + 1;
    const expiresAt: string = this.buildCarryOverExpiryDate(
      toYear,
      settings.carryOverDeadlineMonth,
      settings.carryOverDeadlineDay,
    );

    // Ensure target year entitlement exists, then set carry-over
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationEntitlement> => {
        await this.ensureEntitlementExists(client, tenantId, userId, toYear);

        const result = await client.query<VacationEntitlementRow>(
          `UPDATE vacation_entitlements
           SET carried_over_days = $1, carry_over_expires_at = $2, updated_at = NOW()
           WHERE tenant_id = $3 AND user_id = $4 AND year = $5 AND is_active = 1
           RETURNING id, tenant_id, user_id, year, total_days,
                     carried_over_days, additional_days,
                     carry_over_expires_at, is_active,
                     created_by, created_at, updated_at`,
          [carryOver, expiresAt, tenantId, userId, toYear],
        );

        const row: VacationEntitlementRow | undefined = result.rows[0];
        if (row === undefined) {
          throw new Error(
            `Carry-over update failed for user ${userId}, year ${toYear}`,
          );
        }

        this.logger.log(
          `Carried over ${carryOver} days from ${fromYear} to ${toYear} for user ${userId} (expires ${expiresAt})`,
        );
        return this.mapRowToEntitlement(row);
      },
    );
  }

  /**
   * Update an existing entitlement by ID.
   * Throws NotFoundException if not found.
   */
  async updateEntitlement(
    tenantId: number,
    id: string,
    dto: UpdateEntitlementDto,
  ): Promise<VacationEntitlement> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationEntitlement> => {
        const { setClauses, params } = this.buildEntitlementSetClauses(dto);

        if (setClauses.length === 0) {
          return await this.getEntitlementByIdOrThrow(client, tenantId, id);
        }

        setClauses.push(`updated_at = NOW()`);
        const idParam: number = params.length + 1;
        params.push(id);
        const tenantParam: number = params.length + 1;
        params.push(tenantId);

        const result = await client.query<VacationEntitlementRow>(
          `UPDATE vacation_entitlements
           SET ${setClauses.join(', ')}
           WHERE id = $${idParam} AND tenant_id = $${tenantParam} AND is_active = 1
           RETURNING id, tenant_id, user_id, year, total_days,
                     carried_over_days, additional_days,
                     carry_over_expires_at, is_active,
                     created_by, created_at, updated_at`,
          params,
        );

        const row: VacationEntitlementRow | undefined = result.rows[0];
        if (row === undefined) {
          throw new NotFoundException(`Entitlement ${id} not found`);
        }

        return this.mapRowToEntitlement(row);
      },
    );
  }

  // ==========================================================================
  // Private helpers — Balance calculation
  // ==========================================================================

  /**
   * Calculate effective carry-over considering expiry date.
   * If expired, returns 0 (carry-over is forfeited).
   */
  private calculateEffectiveCarryOver(
    carriedOverDays: string,
    expiresAt: string | null,
  ): number {
    const days: number = Number.parseFloat(carriedOverDays);
    if (days === 0) {
      return 0;
    }

    if (expiresAt === null) {
      return days;
    }

    const now: Date = new Date();
    const expiry: Date = new Date(expiresAt);
    return now <= expiry ? days : 0;
  }

  /**
   * Calculate total days for a status (approved/pending) for a specific year.
   * Handles cross-year requests by splitting workdays per year.
   * Excludes special_leave requests.
   */
  private async calculateDaysForStatus(
    client: PoolClient,
    tenantId: number,
    userId: number,
    year: number,
    status: 'approved' | 'pending',
  ): Promise<number> {
    // First: get simple same-year requests (fast path — no splitting needed)
    const sameYearResult = await client.query<DaysSumRow>(
      `SELECT COALESCE(SUM(computed_days), 0) AS total
       FROM vacation_requests
       WHERE tenant_id = $1
         AND requester_id = $2
         AND status = $3
         AND is_special_leave = false
         AND is_active = 1
         AND EXTRACT(YEAR FROM start_date) = $4
         AND EXTRACT(YEAR FROM end_date) = $4`,
      [tenantId, userId, status, year],
    );

    const sameYearDays: number = Number.parseFloat(
      sameYearResult.rows[0]?.total ?? '0',
    );

    // Second: get cross-year requests that overlap this year
    const crossYearDays: number = await this.calculateCrossYearDays(
      client,
      tenantId,
      userId,
      year,
      status,
    );

    return sameYearDays + crossYearDays;
  }

  /**
   * Calculate workdays from cross-year requests that fall into the target year.
   * For each request spanning years, clamp dates to the year boundary and
   * use countWorkdays() for the clamped range.
   */
  private async calculateCrossYearDays(
    client: PoolClient,
    tenantId: number,
    userId: number,
    year: number,
    status: 'approved' | 'pending',
  ): Promise<number> {
    const yearStart: string = `${year}-01-01`;
    const yearEnd: string = `${year}-12-31`;

    // Requests that start before this year and end in/after this year
    // OR start in this year and end after this year
    const result = await client.query<CrossYearRequestRow>(
      `SELECT id, start_date, end_date, half_day_start, half_day_end, computed_days
       FROM vacation_requests
       WHERE tenant_id = $1
         AND requester_id = $2
         AND status = $3
         AND is_special_leave = false
         AND is_active = 1
         AND EXTRACT(YEAR FROM start_date) <> EXTRACT(YEAR FROM end_date)
         AND start_date <= $4
         AND end_date >= $5`,
      [tenantId, userId, status, yearEnd, yearStart],
    );

    let totalDays: number = 0;

    for (const row of result.rows) {
      totalDays += await this.calculateYearPortionDays(
        tenantId,
        row,
        yearStart,
        yearEnd,
      );
    }

    return totalDays;
  }

  /**
   * Calculate workdays for the portion of a cross-year request that falls
   * within the target year. Clamps start/end to year boundaries and applies
   * half-day modifiers only on the original boundaries.
   */
  private async calculateYearPortionDays(
    tenantId: number,
    row: CrossYearRequestRow,
    yearStart: string,
    yearEnd: string,
  ): Promise<number> {
    const startDate: string = row.start_date;
    const endDate: string = row.end_date;

    // Clamp to year boundaries
    const clampedStart: string = startDate < yearStart ? yearStart : startDate;
    const clampedEnd: string = endDate > yearEnd ? yearEnd : endDate;

    // Half-day modifiers only apply on the original boundaries
    const halfDayStart: string =
      clampedStart === startDate ? row.half_day_start : 'none';
    const halfDayEnd: string =
      clampedEnd === endDate ? row.half_day_end : 'none';

    return await this.holidaysService.countWorkdays(
      tenantId,
      clampedStart,
      clampedEnd,
      halfDayStart as 'none' | 'morning' | 'afternoon',
      halfDayEnd as 'none' | 'morning' | 'afternoon',
    );
  }

  // ==========================================================================
  // Private helpers — CRUD
  // ==========================================================================

  /** Find an entitlement row by tenant + user + year. */
  private async findEntitlement(
    client: PoolClient,
    tenantId: number,
    userId: number,
    year: number,
  ): Promise<VacationEntitlementRow | undefined> {
    const result = await client.query<VacationEntitlementRow>(
      `SELECT id, tenant_id, user_id, year, total_days,
              carried_over_days, additional_days,
              carry_over_expires_at, is_active,
              created_by, created_at, updated_at
       FROM vacation_entitlements
       WHERE tenant_id = $1 AND user_id = $2 AND year = $3 AND is_active = 1`,
      [tenantId, userId, year],
    );

    return result.rows[0];
  }

  /** Get entitlement by ID or throw NotFoundException. */
  private async getEntitlementByIdOrThrow(
    client: PoolClient,
    tenantId: number,
    id: string,
  ): Promise<VacationEntitlement> {
    const result = await client.query<VacationEntitlementRow>(
      `SELECT id, tenant_id, user_id, year, total_days,
              carried_over_days, additional_days,
              carry_over_expires_at, is_active,
              created_by, created_at, updated_at
       FROM vacation_entitlements
       WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [id, tenantId],
    );

    const row: VacationEntitlementRow | undefined = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Entitlement ${id} not found`);
    }

    return this.mapRowToEntitlement(row);
  }

  /**
   * Create a default entitlement using tenant settings.
   * Returns the created row for immediate use.
   */
  private async createDefaultEntitlement(
    client: PoolClient,
    tenantId: number,
    userId: number,
    year: number,
  ): Promise<VacationEntitlementRow> {
    const settings = await this.settingsService.getSettings(tenantId);
    const id: string = uuidv7();

    const result = await client.query<VacationEntitlementRow>(
      `INSERT INTO vacation_entitlements
         (id, tenant_id, user_id, year, total_days)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, user_id, year) DO NOTHING
       RETURNING id, tenant_id, user_id, year, total_days,
                 carried_over_days, additional_days,
                 carry_over_expires_at, is_active,
                 created_by, created_at, updated_at`,
      [id, tenantId, userId, year, settings.defaultAnnualDays],
    );

    // If ON CONFLICT hit, re-fetch the existing row
    if (result.rows[0] === undefined) {
      const existing = await this.findEntitlement(
        client,
        tenantId,
        userId,
        year,
      );
      if (existing === undefined) {
        throw new Error(
          `Failed to create default entitlement for user ${userId}, year ${year}`,
        );
      }
      return existing;
    }

    this.logger.log(
      `Default entitlement created: user ${userId}, year ${year}, ${settings.defaultAnnualDays} days (tenant ${tenantId})`,
    );
    return result.rows[0];
  }

  /** Ensure an entitlement exists for a user+year (for carry-over target). */
  private async ensureEntitlementExists(
    client: PoolClient,
    tenantId: number,
    userId: number,
    year: number,
  ): Promise<void> {
    const existing = await this.findEntitlement(client, tenantId, userId, year);
    if (existing !== undefined) {
      return;
    }

    await this.createDefaultEntitlement(client, tenantId, userId, year);
  }

  /** Build carry-over expiry date string (YYYY-MM-DD). */
  private buildCarryOverExpiryDate(
    year: number,
    month: number,
    day: number,
  ): string {
    const m: string = String(month).padStart(2, '0');
    const d: string = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  /** Build dynamic SET clause for entitlement update. */
  private buildEntitlementSetClauses(dto: UpdateEntitlementDto): {
    setClauses: string[];
    params: unknown[];
  } {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx: number = 1;

    const fields: { column: string; value: unknown }[] = [
      { column: 'total_days', value: dto.totalDays },
      { column: 'carried_over_days', value: dto.carriedOverDays },
      { column: 'additional_days', value: dto.additionalDays },
      { column: 'carry_over_expires_at', value: dto.carryOverExpiresAt },
    ];

    for (const field of fields) {
      if (field.value !== undefined) {
        setClauses.push(`${field.column} = $${idx}`);
        params.push(field.value);
        idx++;
      }
    }

    return { setClauses, params };
  }

  /** Map DB row to API response type (NUMERIC strings → numbers). */
  private mapRowToEntitlement(
    row: VacationEntitlementRow,
  ): VacationEntitlement {
    return {
      id: row.id,
      userId: row.user_id,
      year: row.year,
      totalDays: Number.parseFloat(row.total_days),
      carriedOverDays: Number.parseFloat(row.carried_over_days),
      additionalDays: Number.parseFloat(row.additional_days),
      carryOverExpiresAt: row.carry_over_expires_at,
      createdBy: row.created_by,
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

  /** Check if a PostgreSQL error is a unique constraint violation (23505). */
  private isUniqueViolation(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    );
  }
}
