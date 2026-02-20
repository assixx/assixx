/**
 * TPM Scheduling Service
 *
 * Orchestrates due-date lifecycle for maintenance cards:
 *   1. Calculate initial due date on card creation
 *   2. Generate a year of scheduled dates (tpm_scheduled_dates)
 *   3. Advance to next date after card completion/approval
 *
 * All mutation methods accept a PoolClient for transaction composability.
 * Pure date math is delegated to TpmPlansIntervalService.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { TpmPlansIntervalService } from './tpm-plans-interval.service.js';
import type { TpmIntervalType } from './tpm.types.js';

/** Plan config needed for scheduling calculations */
export interface PlanSchedulingConfig {
  baseWeekday: number;
  baseRepeatEvery: number;
}

@Injectable()
export class TpmSchedulingService {
  private readonly logger = new Logger(TpmSchedulingService.name);

  constructor(private readonly intervalService: TpmPlansIntervalService) {}

  /**
   * Calculate the FIRST due date for a newly created card.
   *
   * Daily = today (immediately due).
   * Weekly = next base_weekday from today.
   * Monthly+ = interval from today.
   */
  calculateInitialDueDate(
    intervalType: TpmIntervalType,
    config: PlanSchedulingConfig,
    customDays: number | null,
  ): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (intervalType === 'daily') {
      return today;
    }

    if (intervalType === 'weekly') {
      return this.intervalService.getNextOccurrence(
        config.baseWeekday,
        config.baseRepeatEvery,
        today,
      );
    }

    // Monthly+ intervals: anchor to Nth weekday of target month
    return this.intervalService.calculateIntervalDate(
      today,
      intervalType,
      customDays,
      { weekday: config.baseWeekday, nth: config.baseRepeatEvery },
    );
  }

  /**
   * Generate a full year of scheduled dates for a card and INSERT them.
   * Also sets the card's initial current_due_date.
   */
  async initializeCardSchedule(
    client: PoolClient,
    tenantId: number,
    cardId: number,
    intervalType: TpmIntervalType,
    config: PlanSchedulingConfig,
    customDays: number | null,
  ): Promise<void> {
    const firstDate = this.calculateInitialDueDate(
      intervalType,
      config,
      customDays,
    );

    const dates = this.buildYearDates(
      firstDate,
      intervalType,
      config,
      customDays,
    );

    if (dates.length > 0) {
      await this.insertScheduledDates(client, tenantId, cardId, dates);
    }

    await this.updateCardDueDate(client, tenantId, cardId, firstDate);

    this.logger.debug(
      `Card ${String(cardId)}: scheduled ${String(dates.length)} dates, ` +
        `first due: ${toDateStr(firstDate)}`,
    );
  }

  /**
   * After card completion/approval: mark past dates as done,
   * advance current_due_date to next uncompleted scheduled date.
   *
   * Returns the new due date (null if schedule exhausted).
   */
  async advanceSchedule(
    client: PoolClient,
    tenantId: number,
    cardId: number,
  ): Promise<string | null> {
    await this.markPastDatesCompleted(client, tenantId, cardId);
    const nextDate = await this.getNextScheduledDate(client, tenantId, cardId);

    await client.query(
      `UPDATE tpm_cards SET current_due_date = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [nextDate, cardId, tenantId],
    );

    if (nextDate === null) {
      this.logger.warn(
        `Card ${String(cardId)}: schedule exhausted, no next date`,
      );
    }

    return nextDate;
  }

  // ============================================================================
  // PRIVATE — Date generation
  // ============================================================================

  /** Build up to 1 year of dates from a starting point */
  private buildYearDates(
    firstDate: Date,
    intervalType: TpmIntervalType,
    config: PlanSchedulingConfig,
    customDays: number | null,
  ): Date[] {
    const oneYearOut = new Date(firstDate);
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);

    const dates: Date[] = [new Date(firstDate)];
    let current = new Date(firstDate);

    while (dates.length < 400) {
      current = this.nextDate(current, intervalType, config, customDays);
      if (current > oneYearOut) break;
      dates.push(new Date(current));
    }

    return dates;
  }

  /** Calculate the next date after a given date for an interval type */
  private nextDate(
    from: Date,
    intervalType: TpmIntervalType,
    config: PlanSchedulingConfig,
    customDays: number | null,
  ): Date {
    if (intervalType === 'weekly') {
      return this.intervalService.getNextOccurrence(
        config.baseWeekday,
        config.baseRepeatEvery,
        from,
      );
    }
    // Monthly+ intervals: anchor to Nth weekday of target month
    return this.intervalService.calculateIntervalDate(
      from,
      intervalType,
      customDays,
      { weekday: config.baseWeekday, nth: config.baseRepeatEvery },
    );
  }

  // ============================================================================
  // PRIVATE — Database operations
  // ============================================================================

  /** Batch-insert scheduled dates (ON CONFLICT DO NOTHING for idempotency) */
  private async insertScheduledDates(
    client: PoolClient,
    tenantId: number,
    cardId: number,
    dates: Date[],
  ): Promise<void> {
    const values: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const d of dates) {
      values.push(`($${idx}, $${idx + 1}, $${idx + 2})`);
      params.push(tenantId, cardId, toDateStr(d));
      idx += 3;
    }

    await client.query(
      `INSERT INTO tpm_scheduled_dates (tenant_id, card_id, scheduled_date)
       VALUES ${values.join(', ')}
       ON CONFLICT (card_id, scheduled_date) DO NOTHING`,
      params,
    );
  }

  /** Mark all scheduled dates <= today as completed for a card */
  private async markPastDatesCompleted(
    client: PoolClient,
    tenantId: number,
    cardId: number,
  ): Promise<void> {
    await client.query(
      `UPDATE tpm_scheduled_dates
       SET is_completed = true, completed_at = NOW()
       WHERE card_id = $1 AND tenant_id = $2
         AND is_completed = false
         AND scheduled_date <= CURRENT_DATE`,
      [cardId, tenantId],
    );
  }

  /** Get the next uncompleted scheduled date for a card */
  private async getNextScheduledDate(
    client: PoolClient,
    tenantId: number,
    cardId: number,
  ): Promise<string | null> {
    const result = await client.query<{ scheduled_date: string }>(
      `SELECT scheduled_date FROM tpm_scheduled_dates
       WHERE card_id = $1 AND tenant_id = $2 AND is_completed = false
       ORDER BY scheduled_date ASC
       LIMIT 1`,
      [cardId, tenantId],
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    const raw = row.scheduled_date;
    return typeof raw === 'string' ?
        raw.slice(0, 10)
      : new Date(raw).toISOString().slice(0, 10);
  }

  /** Set a card's current_due_date directly */
  private async updateCardDueDate(
    client: PoolClient,
    tenantId: number,
    cardId: number,
    date: Date,
  ): Promise<void> {
    await client.query(
      `UPDATE tpm_cards SET current_due_date = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [toDateStr(date), cardId, tenantId],
    );
  }
}

/** Convert a Date to YYYY-MM-DD string */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
