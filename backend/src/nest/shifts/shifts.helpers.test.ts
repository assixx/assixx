import { describe, expect, it } from 'vitest';

import {
  buildTimestamp,
  calculateHours,
  convertTimeFieldsToTimestamps,
  parseDateToString,
  parseTimeFromDateTime,
} from './shifts.helpers.js';

// =============================================================
// parseTimeFromDateTime
// =============================================================

describe('parseTimeFromDateTime', () => {
  it('should extract HH:MM from ISO string', () => {
    expect(parseTimeFromDateTime('2025-06-15T14:30:00Z')).toBe('14:30');
  });

  it('should extract HH:MM from Date object', () => {
    const date = new Date('2025-06-15T09:05:00Z');

    expect(parseTimeFromDateTime(date)).toBe('09:05');
  });

  it('should return undefined for undefined input', () => {
    expect(parseTimeFromDateTime(undefined)).toBeUndefined();
  });

  it('should return undefined for invalid date string', () => {
    expect(parseTimeFromDateTime('not-a-date')).toBeUndefined();
  });

  it('should pad single-digit hours and minutes', () => {
    expect(parseTimeFromDateTime('2025-01-01T03:07:00Z')).toBe('03:07');
  });
});

// =============================================================
// parseDateToString
// =============================================================

describe('parseDateToString', () => {
  it('should format ISO string to YYYY-MM-DD', () => {
    expect(parseDateToString('2025-06-15T14:30:00Z')).toBe('2025-06-15');
  });

  it('should format Date object to YYYY-MM-DD', () => {
    const date = new Date('2025-11-08T10:00:00Z');

    expect(parseDateToString(date)).toBe('2025-11-08');
  });

  it('should return undefined for undefined input', () => {
    expect(parseDateToString(undefined)).toBeUndefined();
  });

  it('should return undefined for invalid date string', () => {
    expect(parseDateToString('not-a-date')).toBeUndefined();
  });
});

// =============================================================
// buildTimestamp
// =============================================================

describe('buildTimestamp', () => {
  it('should combine date and time into timestamp', () => {
    expect(buildTimestamp('2025-06-15', '14:30')).toBe('2025-06-15T14:30:00');
  });

  it('should extract date part from ISO string', () => {
    expect(buildTimestamp('2025-06-15T00:00:00Z', '09:00')).toBe(
      '2025-06-15T09:00:00',
    );
  });

  it('should use defaultTime when timeStr is empty', () => {
    expect(buildTimestamp('2025-06-15', '', '08:00')).toBe(
      '2025-06-15T08:00:00',
    );
  });

  it('should return null when dateStr is not a string', () => {
    expect(buildTimestamp(123, '14:30')).toBeNull();
  });

  it('should return null when dateStr is empty', () => {
    expect(buildTimestamp('', '14:30')).toBeNull();
  });

  it('should return null when both timeStr and defaultTime are missing', () => {
    expect(buildTimestamp('2025-06-15', undefined)).toBeNull();
  });
});

// =============================================================
// calculateHours
// =============================================================

describe('calculateHours', () => {
  it('should calculate hours between start and end', () => {
    expect(calculateHours('08:00', '16:00')).toBe(8);
  });

  it('should subtract break minutes', () => {
    expect(calculateHours('08:00', '16:00', 30)).toBe(7.5);
  });

  it('should handle partial hours', () => {
    expect(calculateHours('09:00', '12:30')).toBe(3.5);
  });

  it('should default break to 0 when undefined', () => {
    expect(calculateHours('08:00', '12:00')).toBe(4);
    expect(calculateHours('08:00', '12:00', undefined)).toBe(4);
  });
});

// =============================================================
// convertTimeFieldsToTimestamps
// =============================================================

describe('convertTimeFieldsToTimestamps', () => {
  it('should convert start_time and end_time to timestamps', () => {
    const data: Record<string, unknown> = {
      start_time: '08:00',
      end_time: '16:00',
    };

    convertTimeFieldsToTimestamps(data, '2025-06-15');

    expect(data['start_time']).toBe('2025-06-15T08:00:00');
    expect(data['end_time']).toBe('2025-06-15T16:00:00');
  });

  it('should skip fields that are not present', () => {
    const data: Record<string, unknown> = { other_field: 'value' };

    convertTimeFieldsToTimestamps(data, '2025-06-15');

    expect(data['start_time']).toBeUndefined();
    expect(data['end_time']).toBeUndefined();
    expect(data['other_field']).toBe('value');
  });

  it('should only convert present time fields', () => {
    const data: Record<string, unknown> = { start_time: '09:00' };

    convertTimeFieldsToTimestamps(data, '2025-06-15');

    expect(data['start_time']).toBe('2025-06-15T09:00:00');
    expect(data['end_time']).toBeUndefined();
  });
});
