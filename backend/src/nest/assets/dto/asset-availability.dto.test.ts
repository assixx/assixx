/**
 * Asset Availability DTO – Unit Tests
 *
 * Validates Zod schemas for asset availability DTOs:
 * - UpdateAssetAvailabilitySchema (create entry)
 * - UpdateAssetAvailabilityEntrySchema (edit entry)
 * - AssetAvailabilityHistoryQuerySchema (query params)
 * - AssetAvailabilityStatusSchema (shared enum)
 */
import { describe, expect, it } from 'vitest';

import { AssetAvailabilityHistoryQuerySchema } from './asset-availability-history-query.dto.js';
import { AssetAvailabilityStatusSchema } from './asset-availability-shared.js';
import { UpdateAssetAvailabilityEntrySchema } from './update-asset-availability-entry.dto.js';
import { UpdateAssetAvailabilitySchema } from './update-asset-availability.dto.js';

// =============================================================
// AssetAvailabilityStatusSchema (shared enum)
// =============================================================

describe('AssetAvailabilityStatusSchema', () => {
  it.each(['operational', 'maintenance', 'repair', 'standby', 'cleaning', 'other'] as const)(
    'should accept status=%s',
    (status) => {
      expect(AssetAvailabilityStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it('should reject invalid status', () => {
    expect(AssetAvailabilityStatusSchema.safeParse('invalid').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(AssetAvailabilityStatusSchema.safeParse('').success).toBe(false);
  });
});

// =============================================================
// UpdateAssetAvailabilitySchema (create entry)
// =============================================================

describe('UpdateAssetAvailabilitySchema', () => {
  const valid = {
    availabilityStatus: 'maintenance' as const,
    availabilityStart: '2026-03-01',
    availabilityEnd: '2026-03-15',
  };

  it('should accept valid entry with all fields', () => {
    const data = UpdateAssetAvailabilitySchema.parse({
      ...valid,
      availabilityReason: 'Geplante Wartung',
      availabilityNotes: 'Ersatzteile bestellt',
    });

    expect(data.availabilityStatus).toBe('maintenance');
    expect(data.availabilityReason).toBe('Geplante Wartung');
  });

  it('should accept minimal entry (status only)', () => {
    expect(
      UpdateAssetAvailabilitySchema.safeParse({
        availabilityStatus: 'operational',
      }).success,
    ).toBe(true);
  });

  it('should reject missing availabilityStatus', () => {
    expect(
      UpdateAssetAvailabilitySchema.safeParse({
        availabilityStart: '2026-03-01',
      }).success,
    ).toBe(false);
  });

  it('should reject invalid date format for availabilityStart', () => {
    expect(
      UpdateAssetAvailabilitySchema.safeParse({
        ...valid,
        availabilityStart: '03-01-2026',
      }).success,
    ).toBe(false);
  });

  it('should reject reason longer than 255 characters', () => {
    expect(
      UpdateAssetAvailabilitySchema.safeParse({
        ...valid,
        availabilityReason: 'X'.repeat(256),
      }).success,
    ).toBe(false);
  });

  it('should reject notes longer than 500 characters', () => {
    expect(
      UpdateAssetAvailabilitySchema.safeParse({
        ...valid,
        availabilityNotes: 'X'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it('should accept reason at exactly 255 characters', () => {
    expect(
      UpdateAssetAvailabilitySchema.safeParse({
        ...valid,
        availabilityReason: 'X'.repeat(255),
      }).success,
    ).toBe(true);
  });

  it('should trim whitespace from reason', () => {
    const data = UpdateAssetAvailabilitySchema.parse({
      ...valid,
      availabilityReason: '  Wartung  ',
    });

    expect(data.availabilityReason).toBe('Wartung');
  });
});

// =============================================================
// UpdateAssetAvailabilityEntrySchema (edit entry)
// =============================================================

describe('UpdateAssetAvailabilityEntrySchema', () => {
  const valid = {
    status: 'repair' as const,
    startDate: '2026-03-01',
    endDate: '2026-03-15',
  };

  it('should accept valid entry', () => {
    const data = UpdateAssetAvailabilityEntrySchema.parse(valid);

    expect(data.status).toBe('repair');
    expect(data.startDate).toBe('2026-03-01');
    expect(data.endDate).toBe('2026-03-15');
  });

  it('should reject missing status', () => {
    const { status: _s, ...noStatus } = valid;

    expect(UpdateAssetAvailabilityEntrySchema.safeParse(noStatus).success).toBe(false);
  });

  it('should reject missing startDate', () => {
    const { startDate: _sd, ...noStart } = valid;

    expect(UpdateAssetAvailabilityEntrySchema.safeParse(noStart).success).toBe(false);
  });

  it('should reject missing endDate', () => {
    const { endDate: _ed, ...noEnd } = valid;

    expect(UpdateAssetAvailabilityEntrySchema.safeParse(noEnd).success).toBe(false);
  });

  it('should reject invalid date format (not YYYY-MM-DD)', () => {
    expect(
      UpdateAssetAvailabilityEntrySchema.safeParse({
        ...valid,
        startDate: '2026/03/01',
      }).success,
    ).toBe(false);
  });

  it('should reject ISO datetime format (only YYYY-MM-DD allowed)', () => {
    expect(
      UpdateAssetAvailabilityEntrySchema.safeParse({
        ...valid,
        startDate: '2026-03-01T00:00:00Z',
      }).success,
    ).toBe(false);
  });

  it('should accept nullable reason', () => {
    const data = UpdateAssetAvailabilityEntrySchema.parse({
      ...valid,
      reason: null,
    });

    expect(data.reason).toBeNull();
  });

  it('should accept nullable notes', () => {
    const data = UpdateAssetAvailabilityEntrySchema.parse({
      ...valid,
      notes: null,
    });

    expect(data.notes).toBeNull();
  });

  it('should reject reason longer than 255 characters', () => {
    expect(
      UpdateAssetAvailabilityEntrySchema.safeParse({
        ...valid,
        reason: 'X'.repeat(256),
      }).success,
    ).toBe(false);
  });
});

// =============================================================
// AssetAvailabilityHistoryQuerySchema (query params)
// =============================================================

describe('AssetAvailabilityHistoryQuerySchema', () => {
  it('should accept empty object (no filters)', () => {
    expect(AssetAvailabilityHistoryQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept valid year', () => {
    const data = AssetAvailabilityHistoryQuerySchema.parse({
      year: '2026',
    });

    expect(data.year).toBe('2026');
  });

  it('should accept valid month', () => {
    const data = AssetAvailabilityHistoryQuerySchema.parse({
      month: '03',
    });

    expect(data.month).toBe('03');
  });

  it('should accept year and month together', () => {
    const data = AssetAvailabilityHistoryQuerySchema.parse({
      year: '2026',
      month: '12',
    });

    expect(data.year).toBe('2026');
    expect(data.month).toBe('12');
  });

  it('should reject 3-digit year', () => {
    expect(AssetAvailabilityHistoryQuerySchema.safeParse({ year: '202' }).success).toBe(false);
  });

  it('should reject 5-digit year', () => {
    expect(AssetAvailabilityHistoryQuerySchema.safeParse({ year: '20260' }).success).toBe(false);
  });

  it('should reject month 00', () => {
    expect(AssetAvailabilityHistoryQuerySchema.safeParse({ month: '00' }).success).toBe(false);
  });

  it('should reject month 13', () => {
    expect(AssetAvailabilityHistoryQuerySchema.safeParse({ month: '13' }).success).toBe(false);
  });

  it('should reject single-digit month', () => {
    expect(AssetAvailabilityHistoryQuerySchema.safeParse({ month: '3' }).success).toBe(false);
  });

  it.each(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'])(
    'should accept month=%s',
    (month) => {
      expect(AssetAvailabilityHistoryQuerySchema.safeParse({ month }).success).toBe(true);
    },
  );
});
