/**
 * TPM Plans Interval Service
 *
 * Pure calculation logic for interval-based maintenance scheduling.
 * No database dependency — takes data as input, returns calculated dates.
 *
 * Used by card status service and slot assistant to determine due dates.
 */
import { Injectable } from '@nestjs/common';

import type { TpmIntervalType } from './tpm.types.js';

/** Result of a next-due-date calculation for a single interval type */
export interface IntervalDueDate {
  intervalType: TpmIntervalType;
  dueDate: Date;
}

/** Weekday anchor: which occurrence of which weekday in a month */
export interface WeekdayAnchor {
  /** TPM format: 0=Mo ... 6=So */
  weekday: number;
  /** 1=first, 2=second, 3=third, etc. */
  nth: number;
}

/** Months to add per interval type (only monthly+ intervals) */
const INTERVAL_MONTHS: Partial<Record<TpmIntervalType, number>> = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
};

@Injectable()
export class TpmPlansIntervalService {
  /**
   * Calculate the next occurrence of a given weekday, respecting repeat frequency.
   *
   * @param weekday - Target weekday (0=Monday ... 6=Sunday)
   * @param repeatEvery - Every Nth week (e.g. 2 = every 2nd week)
   * @param fromDate - Starting point for calculation
   * @returns Next matching date
   *
   * @example
   * getNextOccurrence(3, 2, new Date('2026-02-18'))
   * // → next 2nd Thursday from 2026-02-18
   */
  getNextOccurrence(weekday: number, repeatEvery: number, fromDate: Date): Date {
    const result = new Date(fromDate);
    result.setUTCHours(0, 0, 0, 0);

    // JS: 0=Sunday, 1=Monday ... 6=Saturday
    // TPM: 0=Monday ... 6=Sunday
    // Convert TPM weekday to JS weekday
    const jsWeekday = (weekday + 1) % 7;

    // Find next matching weekday
    const currentJsDay = result.getUTCDay();
    let daysUntil = jsWeekday - currentJsDay;
    if (daysUntil <= 0) {
      daysUntil += 7;
    }
    result.setUTCDate(result.getUTCDate() + daysUntil);

    // Apply repeat frequency (skip weeks if repeatEvery > 1)
    if (repeatEvery > 1) {
      result.setUTCDate(result.getUTCDate() + (repeatEvery - 1) * 7);
    }

    return result;
  }

  /**
   * Find the Nth occurrence of a weekday in a given month.
   * Falls back to last occurrence if Nth doesn't exist
   * (e.g. 5th Wednesday in a month with only 4 Wednesdays).
   *
   * @param year - Target year
   * @param month - Target month (0-indexed, JS convention)
   * @param weekday - TPM weekday (0=Mo ... 6=So)
   * @param nth - Which occurrence (1=first, 2=second, ...)
   */
  getNthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date {
    const jsWeekday = (weekday + 1) % 7;
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    firstOfMonth.setUTCHours(0, 0, 0, 0);

    let daysUntilFirst = jsWeekday - firstOfMonth.getUTCDay();
    if (daysUntilFirst < 0) daysUntilFirst += 7;

    const nthDay = 1 + daysUntilFirst + (nth - 1) * 7;
    const result = new Date(Date.UTC(year, month, nthDay));
    result.setUTCHours(0, 0, 0, 0);

    // Overflow into next month → fall back to last occurrence
    if (result.getUTCMonth() !== month) {
      result.setUTCDate(result.getUTCDate() - 7);
    }

    return result;
  }

  /**
   * Calculate the next date for a given interval type, starting from a base date.
   *
   * For monthly+ intervals with a weekday anchor, the due date lands on
   * the Nth weekday of the target month (e.g. 2nd Wednesday of next month).
   *
   * @param baseDate - The reference date (e.g. last completed date or plan creation)
   * @param intervalType - The interval type to calculate
   * @param customDays - Required when intervalType is 'custom'
   * @param anchor - Weekday anchor for monthly+ intervals (Nth weekday of month)
   */
  calculateIntervalDate(
    baseDate: Date,
    intervalType: TpmIntervalType,
    customDays?: number | null,
    anchor?: WeekdayAnchor | null,
  ): Date {
    const monthsToAdd = INTERVAL_MONTHS[intervalType];

    if (anchor != null && monthsToAdd != null) {
      return this.anchoredIntervalDate(baseDate, monthsToAdd, anchor);
    }

    return this.simpleIntervalDate(baseDate, intervalType, customDays);
  }

  /** Weekday-anchored calculation: find Nth weekday in the target month */
  private anchoredIntervalDate(baseDate: Date, monthsToAdd: number, anchor: WeekdayAnchor): Date {
    const target = new Date(baseDate);
    target.setUTCHours(0, 0, 0, 0);
    target.setUTCMonth(target.getUTCMonth() + monthsToAdd);

    return this.getNthWeekdayOfMonth(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      anchor.weekday,
      anchor.nth,
    );
  }

  /** Simple calendar-based calculation for daily/weekly/custom */
  private simpleIntervalDate(
    baseDate: Date,
    intervalType: TpmIntervalType,
    customDays?: number | null,
  ): Date {
    const result = new Date(baseDate);
    result.setUTCHours(0, 0, 0, 0);

    switch (intervalType) {
      case 'daily': {
        result.setUTCDate(result.getUTCDate() + 1);
        break;
      }
      case 'weekly': {
        result.setUTCDate(result.getUTCDate() + 7);
        break;
      }
      case 'monthly': {
        result.setUTCMonth(result.getUTCMonth() + 1);
        break;
      }
      case 'quarterly': {
        result.setUTCMonth(result.getUTCMonth() + 3);
        break;
      }
      case 'semi_annual': {
        result.setUTCMonth(result.getUTCMonth() + 6);
        break;
      }
      case 'annual': {
        result.setUTCFullYear(result.getUTCFullYear() + 1);
        break;
      }
      case 'custom': {
        result.setUTCDate(result.getUTCDate() + (customDays ?? 30));
        break;
      }
    }

    return result;
  }

  /**
   * Calculate next due dates for all interval types of a plan.
   *
   * Returns one entry per interval type, sorted by due date ascending.
   * Used by the card status service to batch-update due dates after completion.
   *
   * @param baseWeekday - Plan's base weekday (0=Mo ... 6=So)
   * @param baseRepeatEvery - Plan's repeat frequency
   * @param fromDate - Starting point (typically last completion date)
   * @param intervalTypes - Which intervals to calculate (defaults to all standard)
   * @param customDays - Days for 'custom' interval (if included)
   */
  calculateNextDueDates(
    baseWeekday: number,
    baseRepeatEvery: number,
    fromDate: Date,
    intervalTypes?: TpmIntervalType[],
    customDays?: number | null,
  ): IntervalDueDate[] {
    const types: TpmIntervalType[] = intervalTypes ?? [
      'daily',
      'weekly',
      'monthly',
      'quarterly',
      'semi_annual',
      'annual',
    ];

    const results: IntervalDueDate[] = [];
    const anchor: WeekdayAnchor = {
      weekday: baseWeekday,
      nth: baseRepeatEvery,
    };

    for (const intervalType of types) {
      let dueDate: Date;

      if (intervalType === 'weekly') {
        // Weekly uses the plan's base weekday and repeat frequency
        dueDate = this.getNextOccurrence(baseWeekday, baseRepeatEvery, fromDate);
      } else {
        // Monthly+ intervals anchor to Nth weekday of target month
        dueDate = this.calculateIntervalDate(fromDate, intervalType, customDays, anchor);
      }

      results.push({ intervalType, dueDate });
    }

    // Sort by due date ascending (nearest first)
    results.sort(
      (a: IntervalDueDate, b: IntervalDueDate) => a.dueDate.getTime() - b.dueDate.getTime(),
    );

    return results;
  }
}
