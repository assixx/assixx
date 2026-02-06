import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatDate,
  formatDateTime,
  formatRelativeDate,
  formatTime,
  isToday,
  isWithinDays,
} from './date-helpers.js';

describe('formatDate', () => {
  it('should format Date object to DD.MM.YYYY', () => {
    const date = new Date('2025-11-08T12:00:00Z');

    const result = formatDate(date);

    expect(result).toBe('08.11.2025');
  });

  it('should format ISO string to DD.MM.YYYY', () => {
    expect(formatDate('2025-01-15T12:00:00Z')).toBe('15.01.2025');
  });
});

describe('formatDateTime', () => {
  it('should format Date object to DD.MM.YYYY HH:MM', () => {
    const date = new Date('2025-11-08T14:30:00Z');

    const result = formatDateTime(date);

    expect(result).toMatch(/08\.11\.2025/);
    expect(result).toMatch(/14:30/);
  });

  it('should format ISO string to DD.MM.YYYY HH:MM', () => {
    const result = formatDateTime('2025-06-01T09:15:00Z');

    expect(result).toMatch(/01\.06\.2025/);
    expect(result).toMatch(/09:15/);
  });
});

describe('formatTime', () => {
  it('should format Date object to HH:MM', () => {
    const date = new Date('2025-11-08T14:30:00Z');

    expect(formatTime(date)).toBe('14:30');
  });

  it('should format ISO string to HH:MM', () => {
    expect(formatTime('2025-11-08T09:05:00Z')).toBe('09:05');
  });
});

describe('formatRelativeDate', () => {
  const NOW = new Date('2025-06-15T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "gerade eben" for less than 60 seconds ago', () => {
    const thirtySecsAgo = new Date('2025-06-15T11:59:30Z');

    expect(formatRelativeDate(thirtySecsAgo)).toBe('gerade eben');
  });

  it('should return "vor 1 Minute" for exactly 1 minute ago', () => {
    const oneMinAgo = new Date('2025-06-15T11:59:00Z');

    expect(formatRelativeDate(oneMinAgo)).toBe('vor 1 Minute');
  });

  it('should return "vor 5 Minuten" for 5 minutes ago', () => {
    const fiveMinAgo = new Date('2025-06-15T11:55:00Z');

    expect(formatRelativeDate(fiveMinAgo)).toBe('vor 5 Minuten');
  });

  it('should return "vor 1 Stunde" for 1 hour ago', () => {
    const oneHourAgo = new Date('2025-06-15T11:00:00Z');

    expect(formatRelativeDate(oneHourAgo)).toBe('vor 1 Stunde');
  });

  it('should return "vor 3 Stunden" for 3 hours ago', () => {
    const threeHoursAgo = new Date('2025-06-15T09:00:00Z');

    expect(formatRelativeDate(threeHoursAgo)).toBe('vor 3 Stunden');
  });

  it('should return "gestern" for 1 day ago', () => {
    const yesterday = new Date('2025-06-14T12:00:00Z');

    expect(formatRelativeDate(yesterday)).toBe('gestern');
  });

  it('should return "vor 3 Tagen" for 3 days ago', () => {
    const threeDaysAgo = new Date('2025-06-12T12:00:00Z');

    expect(formatRelativeDate(threeDaysAgo)).toBe('vor 3 Tagen');
  });

  it('should return "vor 1 Woche" for 7 days ago', () => {
    const oneWeekAgo = new Date('2025-06-08T12:00:00Z');

    expect(formatRelativeDate(oneWeekAgo)).toBe('vor 1 Woche');
  });

  it('should return "vor 2 Wochen" for 14 days ago', () => {
    const twoWeeksAgo = new Date('2025-06-01T12:00:00Z');

    expect(formatRelativeDate(twoWeeksAgo)).toBe('vor 2 Wochen');
  });

  it('should return "vor 1 Monat" for 30 days ago', () => {
    const oneMonthAgo = new Date('2025-05-16T12:00:00Z');

    expect(formatRelativeDate(oneMonthAgo)).toBe('vor 1 Monat');
  });

  it('should return "vor 6 Monaten" for 180 days ago', () => {
    const sixMonthsAgo = new Date('2024-12-17T12:00:00Z');

    expect(formatRelativeDate(sixMonthsAgo)).toBe('vor 6 Monaten');
  });

  it('should return "vor 1 Jahr" for 365 days ago', () => {
    const oneYearAgo = new Date('2024-06-15T12:00:00Z');

    expect(formatRelativeDate(oneYearAgo)).toBe('vor 1 Jahr');
  });

  it('should return "vor 2 Jahren" for 730 days ago', () => {
    const twoYearsAgo = new Date('2023-06-16T12:00:00Z');

    expect(formatRelativeDate(twoYearsAgo)).toBe('vor 2 Jahren');
  });

  it('should accept ISO string input', () => {
    expect(formatRelativeDate('2025-06-15T11:59:30Z')).toBe('gerade eben');
  });
});

describe('isToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return true for today', () => {
    expect(isToday(new Date('2025-06-15T08:00:00Z'))).toBe(true);
  });

  it('should return false for yesterday', () => {
    expect(isToday(new Date('2025-06-14T23:59:59Z'))).toBe(false);
  });

  it('should accept ISO string input', () => {
    expect(isToday('2025-06-15T18:00:00Z')).toBe(true);
  });
});

describe('isWithinDays', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return true for date within range', () => {
    const threeDaysAgo = new Date('2025-06-12T12:00:00Z');

    expect(isWithinDays(threeDaysAgo, 7)).toBe(true);
  });

  it('should return false for date outside range', () => {
    const tenDaysAgo = new Date('2025-06-05T12:00:00Z');

    expect(isWithinDays(tenDaysAgo, 7)).toBe(false);
  });

  it('should return true for today with days=0', () => {
    const today = new Date('2025-06-15T08:00:00Z');

    expect(isWithinDays(today, 0)).toBe(true);
  });

  it('should return false for future dates', () => {
    const tomorrow = new Date('2025-06-16T12:00:00Z');

    expect(isWithinDays(tomorrow, 7)).toBe(false);
  });
});
