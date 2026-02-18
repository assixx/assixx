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
  getNextOccurrence(
    weekday: number,
    repeatEvery: number,
    fromDate: Date,
  ): Date {
    const result = new Date(fromDate);
    result.setHours(0, 0, 0, 0);

    // JS: 0=Sunday, 1=Monday ... 6=Saturday
    // TPM: 0=Monday ... 6=Sunday
    // Convert TPM weekday to JS weekday
    const jsWeekday = (weekday + 1) % 7;

    // Find next matching weekday
    const currentJsDay = result.getDay();
    let daysUntil = jsWeekday - currentJsDay;
    if (daysUntil <= 0) {
      daysUntil += 7;
    }
    result.setDate(result.getDate() + daysUntil);

    // Apply repeat frequency (skip weeks if repeatEvery > 1)
    if (repeatEvery > 1) {
      result.setDate(result.getDate() + (repeatEvery - 1) * 7);
    }

    return result;
  }

  /**
   * Calculate the next date for a given interval type, starting from a base date.
   *
   * @param baseDate - The reference date (e.g. last completed date or plan creation)
   * @param intervalType - The interval type to calculate
   * @param customDays - Required when intervalType is 'custom'
   * @returns Calculated due date
   */
  calculateIntervalDate(
    baseDate: Date,
    intervalType: TpmIntervalType,
    customDays?: number | null,
  ): Date {
    const result = new Date(baseDate);
    result.setHours(0, 0, 0, 0);

    switch (intervalType) {
      case 'daily': {
        result.setDate(result.getDate() + 1);
        break;
      }
      case 'weekly': {
        result.setDate(result.getDate() + 7);
        break;
      }
      case 'monthly': {
        result.setMonth(result.getMonth() + 1);
        break;
      }
      case 'quarterly': {
        result.setMonth(result.getMonth() + 3);
        break;
      }
      case 'semi_annual': {
        result.setMonth(result.getMonth() + 6);
        break;
      }
      case 'annual': {
        result.setFullYear(result.getFullYear() + 1);
        break;
      }
      case 'long_runner': {
        // Long runner: 2 years (industry convention for major overhauls)
        result.setFullYear(result.getFullYear() + 2);
        break;
      }
      case 'custom': {
        const days = customDays ?? 30;
        result.setDate(result.getDate() + days);
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
      'long_runner',
    ];

    const results: IntervalDueDate[] = [];

    for (const intervalType of types) {
      let dueDate: Date;

      if (intervalType === 'weekly') {
        // Weekly uses the plan's base weekday and repeat frequency
        dueDate = this.getNextOccurrence(
          baseWeekday,
          baseRepeatEvery,
          fromDate,
        );
      } else {
        dueDate = this.calculateIntervalDate(
          fromDate,
          intervalType,
          customDays,
        );
      }

      results.push({ intervalType, dueDate });
    }

    // Sort by due date ascending (nearest first)
    results.sort(
      (a: IntervalDueDate, b: IntervalDueDate) =>
        a.dueDate.getTime() - b.dueDate.getTime(),
    );

    return results;
  }
}
