/**
 * Machine Availability DTO – Unit Tests
 *
 * Validates Zod schemas for machine availability DTOs:
 * - UpdateMachineAvailabilitySchema (create entry)
 * - UpdateMachineAvailabilityEntrySchema (edit entry)
 * - MachineAvailabilityHistoryQuerySchema (query params)
 * - MachineAvailabilityStatusSchema (shared enum)
 */
import { describe, expect, it } from 'vitest';

import { MachineAvailabilityHistoryQuerySchema } from './machine-availability-history-query.dto.js';
import { MachineAvailabilityStatusSchema } from './machine-availability-shared.js';
import { UpdateMachineAvailabilityEntrySchema } from './update-machine-availability-entry.dto.js';
import { UpdateMachineAvailabilitySchema } from './update-machine-availability.dto.js';

// =============================================================
// MachineAvailabilityStatusSchema (shared enum)
// =============================================================

describe('MachineAvailabilityStatusSchema', () => {
  it.each([
    'operational',
    'maintenance',
    'repair',
    'standby',
    'cleaning',
    'other',
  ] as const)('should accept status=%s', (status) => {
    expect(MachineAvailabilityStatusSchema.safeParse(status).success).toBe(
      true,
    );
  });

  it('should reject invalid status', () => {
    expect(MachineAvailabilityStatusSchema.safeParse('invalid').success).toBe(
      false,
    );
  });

  it('should reject empty string', () => {
    expect(MachineAvailabilityStatusSchema.safeParse('').success).toBe(false);
  });
});

// =============================================================
// UpdateMachineAvailabilitySchema (create entry)
// =============================================================

describe('UpdateMachineAvailabilitySchema', () => {
  const valid = {
    availabilityStatus: 'maintenance' as const,
    availabilityStart: '2026-03-01',
    availabilityEnd: '2026-03-15',
  };

  it('should accept valid entry with all fields', () => {
    const data = UpdateMachineAvailabilitySchema.parse({
      ...valid,
      availabilityReason: 'Geplante Wartung',
      availabilityNotes: 'Ersatzteile bestellt',
    });

    expect(data.availabilityStatus).toBe('maintenance');
    expect(data.availabilityReason).toBe('Geplante Wartung');
  });

  it('should accept minimal entry (status only)', () => {
    expect(
      UpdateMachineAvailabilitySchema.safeParse({
        availabilityStatus: 'operational',
      }).success,
    ).toBe(true);
  });

  it('should reject missing availabilityStatus', () => {
    expect(
      UpdateMachineAvailabilitySchema.safeParse({
        availabilityStart: '2026-03-01',
      }).success,
    ).toBe(false);
  });

  it('should reject invalid date format for availabilityStart', () => {
    expect(
      UpdateMachineAvailabilitySchema.safeParse({
        ...valid,
        availabilityStart: '03-01-2026',
      }).success,
    ).toBe(false);
  });

  it('should reject reason longer than 255 characters', () => {
    expect(
      UpdateMachineAvailabilitySchema.safeParse({
        ...valid,
        availabilityReason: 'X'.repeat(256),
      }).success,
    ).toBe(false);
  });

  it('should reject notes longer than 500 characters', () => {
    expect(
      UpdateMachineAvailabilitySchema.safeParse({
        ...valid,
        availabilityNotes: 'X'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it('should accept reason at exactly 255 characters', () => {
    expect(
      UpdateMachineAvailabilitySchema.safeParse({
        ...valid,
        availabilityReason: 'X'.repeat(255),
      }).success,
    ).toBe(true);
  });

  it('should trim whitespace from reason', () => {
    const data = UpdateMachineAvailabilitySchema.parse({
      ...valid,
      availabilityReason: '  Wartung  ',
    });

    expect(data.availabilityReason).toBe('Wartung');
  });
});

// =============================================================
// UpdateMachineAvailabilityEntrySchema (edit entry)
// =============================================================

describe('UpdateMachineAvailabilityEntrySchema', () => {
  const valid = {
    status: 'repair' as const,
    startDate: '2026-03-01',
    endDate: '2026-03-15',
  };

  it('should accept valid entry', () => {
    const data = UpdateMachineAvailabilityEntrySchema.parse(valid);

    expect(data.status).toBe('repair');
    expect(data.startDate).toBe('2026-03-01');
    expect(data.endDate).toBe('2026-03-15');
  });

  it('should reject missing status', () => {
    const { status: _s, ...noStatus } = valid;

    expect(
      UpdateMachineAvailabilityEntrySchema.safeParse(noStatus).success,
    ).toBe(false);
  });

  it('should reject missing startDate', () => {
    const { startDate: _sd, ...noStart } = valid;

    expect(
      UpdateMachineAvailabilityEntrySchema.safeParse(noStart).success,
    ).toBe(false);
  });

  it('should reject missing endDate', () => {
    const { endDate: _ed, ...noEnd } = valid;

    expect(UpdateMachineAvailabilityEntrySchema.safeParse(noEnd).success).toBe(
      false,
    );
  });

  it('should reject invalid date format (not YYYY-MM-DD)', () => {
    expect(
      UpdateMachineAvailabilityEntrySchema.safeParse({
        ...valid,
        startDate: '2026/03/01',
      }).success,
    ).toBe(false);
  });

  it('should reject ISO datetime format (only YYYY-MM-DD allowed)', () => {
    expect(
      UpdateMachineAvailabilityEntrySchema.safeParse({
        ...valid,
        startDate: '2026-03-01T00:00:00Z',
      }).success,
    ).toBe(false);
  });

  it('should accept nullable reason', () => {
    const data = UpdateMachineAvailabilityEntrySchema.parse({
      ...valid,
      reason: null,
    });

    expect(data.reason).toBeNull();
  });

  it('should accept nullable notes', () => {
    const data = UpdateMachineAvailabilityEntrySchema.parse({
      ...valid,
      notes: null,
    });

    expect(data.notes).toBeNull();
  });

  it('should reject reason longer than 255 characters', () => {
    expect(
      UpdateMachineAvailabilityEntrySchema.safeParse({
        ...valid,
        reason: 'X'.repeat(256),
      }).success,
    ).toBe(false);
  });
});

// =============================================================
// MachineAvailabilityHistoryQuerySchema (query params)
// =============================================================

describe('MachineAvailabilityHistoryQuerySchema', () => {
  it('should accept empty object (no filters)', () => {
    expect(MachineAvailabilityHistoryQuerySchema.safeParse({}).success).toBe(
      true,
    );
  });

  it('should accept valid year', () => {
    const data = MachineAvailabilityHistoryQuerySchema.parse({
      year: '2026',
    });

    expect(data.year).toBe('2026');
  });

  it('should accept valid month', () => {
    const data = MachineAvailabilityHistoryQuerySchema.parse({
      month: '03',
    });

    expect(data.month).toBe('03');
  });

  it('should accept year and month together', () => {
    const data = MachineAvailabilityHistoryQuerySchema.parse({
      year: '2026',
      month: '12',
    });

    expect(data.year).toBe('2026');
    expect(data.month).toBe('12');
  });

  it('should reject 3-digit year', () => {
    expect(
      MachineAvailabilityHistoryQuerySchema.safeParse({ year: '202' }).success,
    ).toBe(false);
  });

  it('should reject 5-digit year', () => {
    expect(
      MachineAvailabilityHistoryQuerySchema.safeParse({ year: '20260' })
        .success,
    ).toBe(false);
  });

  it('should reject month 00', () => {
    expect(
      MachineAvailabilityHistoryQuerySchema.safeParse({ month: '00' }).success,
    ).toBe(false);
  });

  it('should reject month 13', () => {
    expect(
      MachineAvailabilityHistoryQuerySchema.safeParse({ month: '13' }).success,
    ).toBe(false);
  });

  it('should reject single-digit month', () => {
    expect(
      MachineAvailabilityHistoryQuerySchema.safeParse({ month: '3' }).success,
    ).toBe(false);
  });

  it.each([
    '01',
    '02',
    '03',
    '04',
    '05',
    '06',
    '07',
    '08',
    '09',
    '10',
    '11',
    '12',
  ])('should accept month=%s', (month) => {
    expect(
      MachineAvailabilityHistoryQuerySchema.safeParse({ month }).success,
    ).toBe(true);
  });
});
