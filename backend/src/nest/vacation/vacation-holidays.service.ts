/**
 * Vacation Holidays Service
 *
 * Manages tenant holidays and provides the critical `countWorkdays()` algorithm
 * that ALL other vacation services depend on.
 *
 * Holiday table: `vacation_holidays` (Migration 29)
 * - UNIQUE(tenant_id, holiday_date) — no duplicate dates per tenant
 * - `recurring` flag — if true, matched by month+day across years
 * - RLS enforced via `db.tenantTransaction()` (ADR-019)
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
import type { CreateHolidayDto } from './dto/create-holiday.dto.js';
import type { UpdateHolidayDto } from './dto/update-holiday.dto.js';
import type {
  VacationHalfDay,
  VacationHoliday,
  VacationHolidayRow,
} from './vacation.types.js';

@Injectable()
export class VacationHolidaysService {
  private readonly logger: Logger = new Logger(VacationHolidaysService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all active holidays for a tenant, optionally filtered by year.
   * Recurring holidays are included regardless of year (matched by month+day).
   */
  async getHolidays(
    tenantId: number,
    year?: number,
  ): Promise<VacationHoliday[]> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationHoliday[]> => {
        let sql: string = `
          SELECT id, tenant_id, holiday_date, name, recurring,
                 created_by, created_at, updated_at
          FROM vacation_holidays
          WHERE tenant_id = $1 AND is_active = 1`;
        const params: unknown[] = [tenantId];

        if (year !== undefined) {
          // Non-recurring: exact year match
          // Recurring: always included (apply by month+day in code)
          sql += ` AND (recurring = true OR EXTRACT(YEAR FROM holiday_date) = $2)`;
          params.push(year);
        }

        sql += ` ORDER BY holiday_date ASC`;

        const result = await client.query<VacationHolidayRow>(sql, params);
        return result.rows.map((row: VacationHolidayRow) =>
          this.mapRowToHoliday(row),
        );
      },
    );
  }

  /**
   * Create a new tenant holiday.
   * Throws ConflictException on duplicate (tenant_id, holiday_date).
   */
  async createHoliday(
    tenantId: number,
    userId: number,
    dto: CreateHolidayDto,
  ): Promise<VacationHoliday> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationHoliday> => {
        const id: string = uuidv7();

        try {
          const result = await client.query<VacationHolidayRow>(
            `INSERT INTO vacation_holidays
               (id, tenant_id, holiday_date, name, recurring, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, tenant_id, holiday_date, name, recurring,
                       created_by, created_at, updated_at`,
            [id, tenantId, dto.holidayDate, dto.name, dto.recurring, userId],
          );

          const row: VacationHolidayRow | undefined = result.rows[0];
          if (row === undefined) {
            throw new Error('INSERT into vacation_holidays returned no rows');
          }

          this.logger.log(
            `Holiday created: ${dto.name} on ${dto.holidayDate} (tenant ${tenantId})`,
          );
          return this.mapRowToHoliday(row);
        } catch (error: unknown) {
          if (this.isUniqueViolation(error)) {
            throw new ConflictException(
              `A holiday already exists for date ${dto.holidayDate}`,
            );
          }
          throw error;
        }
      },
    );
  }

  /**
   * Update an existing holiday.
   * Throws NotFoundException if not found or soft-deleted.
   * Throws ConflictException if new date conflicts with existing.
   */
  async updateHoliday(
    tenantId: number,
    id: string,
    dto: UpdateHolidayDto,
  ): Promise<VacationHoliday> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationHoliday> => {
        const { setClauses, params } = this.buildHolidaySetClauses(dto);

        if (setClauses.length === 0) {
          return await this.getHolidayById(client, tenantId, id);
        }

        setClauses.push(`updated_at = NOW()`);
        const idParam: number = params.length + 1;
        params.push(id);
        const tenantParam: number = params.length + 1;
        params.push(tenantId);

        try {
          const result = await client.query<VacationHolidayRow>(
            `UPDATE vacation_holidays
             SET ${setClauses.join(', ')}
             WHERE id = $${idParam} AND tenant_id = $${tenantParam} AND is_active = 1
             RETURNING id, tenant_id, holiday_date, name, recurring,
                       created_by, created_at, updated_at`,
            params,
          );

          const row: VacationHolidayRow | undefined = result.rows[0];
          if (row === undefined) {
            throw new NotFoundException(`Holiday ${id} not found`);
          }

          return this.mapRowToHoliday(row);
        } catch (error: unknown) {
          if (error instanceof NotFoundException) {
            throw error;
          }
          if (this.isUniqueViolation(error)) {
            throw new ConflictException(
              `A holiday already exists for date ${dto.holidayDate ?? '(unchanged)'}`,
            );
          }
          throw error;
        }
      },
    );
  }

  /**
   * Soft-delete a holiday (is_active = 4).
   * Throws NotFoundException if not found.
   */
  async deleteHoliday(tenantId: number, id: string): Promise<void> {
    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        const result = await client.query<{ id: string }>(
          `UPDATE vacation_holidays
           SET is_active = 4, updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2 AND is_active = 1
           RETURNING id`,
          [id, tenantId],
        );

        if (result.rows[0] === undefined) {
          throw new NotFoundException(`Holiday ${id} not found`);
        }

        this.logger.log(`Holiday soft-deleted: ${id} (tenant ${tenantId})`);
      },
    );
  }

  /**
   * Check if a specific date is a holiday for the tenant.
   * Handles recurring holidays by matching month+day.
   */
  async isHoliday(tenantId: number, date: Date): Promise<boolean> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<boolean> => {
        const dateStr: string = this.formatDate(date);
        const month: number = date.getMonth() + 1;
        const day: number = date.getDate();

        const result = await client.query<{ found: boolean }>(
          `SELECT EXISTS (
            SELECT 1 FROM vacation_holidays
            WHERE tenant_id = $1
              AND is_active = 1
              AND (
                (recurring = false AND holiday_date = $2)
                OR (recurring = true AND EXTRACT(MONTH FROM holiday_date) = $3
                    AND EXTRACT(DAY FROM holiday_date) = $4)
              )
          ) AS found`,
          [tenantId, dateStr, month, day],
        );

        return result.rows[0]?.found === true;
      },
    );
  }

  /**
   * Count workdays between two dates, excluding weekends and holidays.
   * Supports half-day modifiers on start and end dates.
   *
   * THIS IS THE CORE ALGORITHM — every other vacation service depends on it.
   *
   * @param tenantId - Tenant for holiday lookup
   * @param startDate - First day of range (inclusive)
   * @param endDate - Last day of range (inclusive)
   * @param halfDayStart - 'morning' or 'afternoon' = 0.5 day, 'none' = full day
   * @param halfDayEnd - 'morning' or 'afternoon' = 0.5 day, 'none' = full day
   * @returns Number of workdays (can be 0.5 increments)
   */
  async countWorkdays(
    tenantId: number,
    startDate: string,
    endDate: string,
    halfDayStart: VacationHalfDay = 'none',
    halfDayEnd: VacationHalfDay = 'none',
  ): Promise<number> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<number> => {
        const start: Date = new Date(startDate);
        const end: Date = new Date(endDate);

        // Load all holidays for the date range in ONE query (avoid N+1)
        const holidaySet: Set<string> = await this.loadHolidaySet(
          client,
          tenantId,
          start,
          end,
        );

        const isSingleDay: boolean = start.getTime() === end.getTime();
        let totalDays: number = 0;

        const current: Date = new Date(start);
        while (current <= end) {
          const dayOfWeek: number = current.getDay();
          const isWeekend: boolean = dayOfWeek === 0 || dayOfWeek === 6;
          const isHolidayDate: boolean = holidaySet.has(
            this.formatDate(current),
          );

          if (!isWeekend && !isHolidayDate) {
            totalDays += this.calculateDayValue(
              current,
              start,
              end,
              isSingleDay,
              halfDayStart,
              halfDayEnd,
            );
          }

          current.setDate(current.getDate() + 1);
        }

        return totalDays;
      },
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /**
   * Load all holiday dates in a range into a Set for O(1) lookup.
   * Handles recurring holidays by projecting them into each year of the range.
   */
  private async loadHolidaySet(
    client: PoolClient,
    tenantId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<Set<string>> {
    const startStr: string = this.formatDate(startDate);
    const endStr: string = this.formatDate(endDate);

    // Get non-recurring holidays in range + all recurring holidays
    const result = await client.query<
      Pick<VacationHolidayRow, 'holiday_date' | 'recurring'>
    >(
      `SELECT holiday_date, recurring
       FROM vacation_holidays
       WHERE tenant_id = $1
         AND is_active = 1
         AND (
           (recurring = false AND holiday_date >= $2 AND holiday_date <= $3)
           OR recurring = true
         )`,
      [tenantId, startStr, endStr],
    );

    const holidaySet: Set<string> = new Set<string>();

    for (const row of result.rows) {
      if (row.recurring) {
        this.projectRecurringHoliday(
          row.holiday_date,
          startDate,
          endDate,
          holidaySet,
        );
      } else {
        holidaySet.add(this.formatDate(new Date(row.holiday_date)));
      }
    }

    return holidaySet;
  }

  /** Build dynamic SET clause and params for holiday update. */
  private buildHolidaySetClauses(dto: UpdateHolidayDto): {
    setClauses: string[];
    params: unknown[];
  } {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex: number = 1;

    const fields: { column: string; value: unknown }[] = [
      { column: 'holiday_date', value: dto.holidayDate },
      { column: 'name', value: dto.name },
      { column: 'recurring', value: dto.recurring },
    ];

    for (const field of fields) {
      if (field.value !== undefined) {
        setClauses.push(`${field.column} = $${paramIndex}`);
        params.push(field.value);
        paramIndex++;
      }
    }

    return { setClauses, params };
  }

  /** Calculate the day value (0.5 or 1) for a workday considering half-day modifiers. */
  private calculateDayValue(
    current: Date,
    start: Date,
    end: Date,
    isSingleDay: boolean,
    halfDayStart: VacationHalfDay,
    halfDayEnd: VacationHalfDay,
  ): number {
    if (isSingleDay) {
      // Single day: if either modifier is not 'none', count as 0.5
      return halfDayStart !== 'none' || halfDayEnd !== 'none' ? 0.5 : 1;
    }

    const isFirstDay: boolean = current.getTime() === start.getTime();
    if (isFirstDay && halfDayStart !== 'none') {
      return 0.5;
    }

    const isLastDay: boolean = current.getTime() === end.getTime();
    if (isLastDay && halfDayEnd !== 'none') {
      return 0.5;
    }

    return 1;
  }

  /** Project a recurring holiday (month+day) into each year of the range. */
  private projectRecurringHoliday(
    holidayDate: string | Date,
    startDate: Date,
    endDate: Date,
    holidaySet: Set<string>,
  ): void {
    const date: Date = new Date(holidayDate);
    const hMonth: number = date.getMonth();
    const hDay: number = date.getDate();

    for (
      let year: number = startDate.getFullYear();
      year <= endDate.getFullYear();
      year++
    ) {
      const projected: Date = new Date(year, hMonth, hDay);
      if (projected >= startDate && projected <= endDate) {
        holidaySet.add(this.formatDate(projected));
      }
    }
  }

  /**
   * Get a single holiday by ID (internal helper).
   */
  private async getHolidayById(
    client: PoolClient,
    tenantId: number,
    id: string,
  ): Promise<VacationHoliday> {
    const result = await client.query<VacationHolidayRow>(
      `SELECT id, tenant_id, holiday_date, name, recurring,
              created_by, created_at, updated_at
       FROM vacation_holidays
       WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [id, tenantId],
    );

    const row: VacationHolidayRow | undefined = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Holiday ${id} not found`);
    }

    return this.mapRowToHoliday(row);
  }

  /** Map DB row to API response type (snake_case → camelCase) */
  private mapRowToHoliday(row: VacationHolidayRow): VacationHoliday {
    return {
      id: row.id,
      holidayDate:
        typeof row.holiday_date === 'string' ?
          row.holiday_date.slice(0, 10)
        : this.formatDate(new Date(row.holiday_date)),
      name: row.name,
      recurring: row.recurring,
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

  /** Format a Date as YYYY-MM-DD (no timezone issues) */
  private formatDate(date: Date): string {
    const year: number = date.getFullYear();
    const month: string = String(date.getMonth() + 1).padStart(2, '0');
    const day: string = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Check if a PostgreSQL error is a unique constraint violation (23505) */
  private isUniqueViolation(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    );
  }
}
