/**
 * Asset Availability Service – Unit Tests
 *
 * Tests for pure helper methods + DB-mocked public methods.
 * Private methods tested via bracket notation.
 * Pattern: mirrors user-availability.service.test.ts
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import {
  type AssetAvailabilityFields,
  type AssetAvailabilityRow,
  AssetAvailabilityService,
} from './asset-availability.service.js';

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(): {
  service: AssetAvailabilityService;
  mockDb: { query: ReturnType<typeof vi.fn> };
  mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;
} {
  const mockDb = { query: vi.fn() };
  const mockActivityLogger = {
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  };

  const service = new AssetAvailabilityService(
    mockDb as unknown as DatabaseService,
    mockActivityLogger as unknown as ActivityLoggerService,
  );

  return { service, mockDb, mockActivityLogger };
}

// ============================================================
// Pure Helper Methods
// ============================================================

describe('AssetAvailabilityService – pure helpers', () => {
  let service: AssetAvailabilityService;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
  });

  describe('addAvailabilityInfo', () => {
    it('sets defaults when availability is undefined', () => {
      const response: AssetAvailabilityFields = {
        availabilityStatus: null,
        availabilityStart: null,
        availabilityEnd: null,
        availabilityNotes: null,
      };

      service.addAvailabilityInfo(response, undefined);

      expect(response.availabilityStatus).toBe('operational');
      expect(response.availabilityStart).toBeNull();
      expect(response.availabilityEnd).toBeNull();
      expect(response.availabilityNotes).toBeNull();
    });

    it('maps availability row to response fields', () => {
      const response: AssetAvailabilityFields = {
        availabilityStatus: null,
        availabilityStart: null,
        availabilityEnd: null,
        availabilityNotes: null,
      };
      const availability: AssetAvailabilityRow = {
        asset_id: 1,
        status: 'maintenance',
        start_date: new Date('2026-03-01T00:00:00Z'),
        end_date: new Date('2026-03-15T00:00:00Z'),
        notes: 'Geplante Wartung',
      };

      service.addAvailabilityInfo(response, availability);

      expect(response.availabilityStatus).toBe('maintenance');
      expect(response.availabilityStart).toBe('2026-03-01');
      expect(response.availabilityEnd).toBe('2026-03-15');
      expect(response.availabilityNotes).toBe('Geplante Wartung');
    });

    it('handles null dates in availability', () => {
      const response: AssetAvailabilityFields = {
        availabilityStatus: null,
        availabilityStart: null,
        availabilityEnd: null,
        availabilityNotes: null,
      };
      const availability: AssetAvailabilityRow = {
        asset_id: 1,
        status: 'standby',
        start_date: null,
        end_date: null,
        notes: null,
      };

      service.addAvailabilityInfo(response, availability);

      expect(response.availabilityStatus).toBe('standby');
      expect(response.availabilityStart).toBeNull();
      expect(response.availabilityEnd).toBeNull();
      expect(response.availabilityNotes).toBeNull();
    });
  });

  describe('mapAvailabilityRowToEntry', () => {
    it('maps DB row to API format', () => {
      const row = {
        id: 1,
        asset_id: 42,
        status: 'repair',
        start_date: new Date('2026-03-01T00:00:00Z'),
        end_date: new Date('2026-03-15T00:00:00Z'),
        reason: 'Defektes Lager',
        notes: 'Ersatzteil bestellt',
        created_by: 10,
        created_by_name: 'Admin User',
        created_at: new Date('2026-02-28T10:00:00Z'),
        updated_at: new Date('2026-02-28T12:00:00Z'),
      };

      const result = service['mapAvailabilityRowToEntry'](row);

      expect(result.id).toBe(1);
      expect(result.assetId).toBe(42);
      expect(result.status).toBe('repair');
      expect(result.startDate).toBe('2026-03-01');
      expect(result.endDate).toBe('2026-03-15');
      expect(result.reason).toBe('Defektes Lager');
      expect(result.notes).toBe('Ersatzteil bestellt');
      expect(result.createdBy).toBe(10);
      expect(result.createdByName).toBe('Admin User');
    });

    it('handles null dates and metadata', () => {
      const row = {
        id: 2,
        asset_id: 43,
        status: 'cleaning',
        start_date: null,
        end_date: null,
        reason: null,
        notes: null,
        created_by: null,
        created_by_name: null,
        created_at: null,
        updated_at: null,
      };

      const result = service['mapAvailabilityRowToEntry'](row);

      expect(result.startDate).toBe('');
      expect(result.endDate).toBe('');
      expect(result.createdAt).toBe('');
      expect(result.updatedAt).toBe('');
    });
  });

  describe('buildAvailabilityHistoryQuery', () => {
    it('builds base query without filters', () => {
      const result = service['buildAvailabilityHistoryQuery'](42, 1);

      expect(result.query).toContain('ma.asset_id = $1');
      expect(result.query).toContain('ma.tenant_id = $2');
      expect(result.params).toEqual([42, 1]);
    });

    it('adds year filter', () => {
      const result = service['buildAvailabilityHistoryQuery'](42, 1, 2026);

      expect(result.query).toContain('EXTRACT(YEAR FROM ma.start_date) = $3');
      expect(result.params).toEqual([42, 1, 2026]);
    });

    it('adds year and month filters', () => {
      const result = service['buildAvailabilityHistoryQuery'](42, 1, 2026, 3);

      expect(result.query).toContain('EXTRACT(YEAR FROM ma.start_date) = $3');
      expect(result.query).toContain('EXTRACT(MONTH FROM ma.start_date) = $4');
      expect(result.params).toEqual([42, 1, 2026, 3]);
    });

    it('includes ORDER BY start_date DESC', () => {
      const result = service['buildAvailabilityHistoryQuery'](42, 1);

      expect(result.query).toContain('ORDER BY ma.start_date DESC');
    });
  });

  describe('validateAvailabilityDates', () => {
    it('throws when non-operational status has no start date', () => {
      const dto = {
        availabilityStatus: 'maintenance',
        availabilityStart: undefined,
        availabilityEnd: '2026-03-15',
      };

      expect(() => service['validateAvailabilityDates'](dto as never)).toThrow(BadRequestException);
    });

    it('throws when end date is before start date', () => {
      const dto = {
        availabilityStatus: 'repair',
        availabilityStart: '2026-03-15',
        availabilityEnd: '2026-03-01',
      };

      expect(() => service['validateAvailabilityDates'](dto as never)).toThrow(BadRequestException);
    });

    it('does not throw for operational status without dates', () => {
      const dto = {
        availabilityStatus: 'operational',
        availabilityStart: undefined,
        availabilityEnd: undefined,
      };

      expect(() => service['validateAvailabilityDates'](dto as never)).not.toThrow();
    });

    it('does not throw for valid date range', () => {
      const dto = {
        availabilityStatus: 'maintenance',
        availabilityStart: '2026-03-01',
        availabilityEnd: '2026-03-15',
      };

      expect(() => service['validateAvailabilityDates'](dto as never)).not.toThrow();
    });

    it('does not throw when start equals end', () => {
      const dto = {
        availabilityStatus: 'cleaning',
        availabilityStart: '2026-03-01',
        availabilityEnd: '2026-03-01',
      };

      expect(() => service['validateAvailabilityDates'](dto as never)).not.toThrow();
    });
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('AssetAvailabilityService – DB-mocked methods', () => {
  let service: AssetAvailabilityService;
  let mockDb: { query: ReturnType<typeof vi.fn> };
  let mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockActivityLogger = result.mockActivityLogger;
  });

  describe('getAssetAvailability', () => {
    it('returns null when no availability entry exists', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAssetAvailability(42, 1);

      expect(result).toBeNull();
    });

    it('returns first availability entry', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          asset_id: 42,
          status: 'maintenance',
          start_date: new Date('2026-03-01'),
          end_date: new Date('2026-03-15'),
          notes: null,
        },
      ]);

      const result = await service.getAssetAvailability(42, 1);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('maintenance');
    });
  });

  describe('getAssetAvailabilityBatch', () => {
    it('returns empty map for empty asset IDs', async () => {
      const result = await service.getAssetAvailabilityBatch([], 1);

      expect(result.size).toBe(0);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns map keyed by asset_id', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          asset_id: 1,
          status: 'operational',
          start_date: null,
          end_date: null,
          notes: null,
        },
        {
          asset_id: 2,
          status: 'repair',
          start_date: null,
          end_date: null,
          notes: null,
        },
      ]);

      const result = await service.getAssetAvailabilityBatch([1, 2], 1);

      expect(result.size).toBe(2);
      expect(result.get(1)?.status).toBe('operational');
      expect(result.get(2)?.status).toBe('repair');
    });
  });

  describe('resolveAssetIdByUuid', () => {
    it('returns asset ID for valid UUID', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service['resolveAssetIdByUuid']('valid-uuid', 1);

      expect(result).toBe(42);
    });

    it('throws NotFoundException when UUID not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service['resolveAssetIdByUuid']('bad-uuid', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAssetAvailabilityForDateRange', () => {
    it('returns mapped entries for overlapping date range', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          asset_id: 42,
          status: 'maintenance',
          start_date: new Date('2026-03-01'),
          end_date: new Date('2026-03-15'),
          reason: 'Wartung',
          notes: null,
          created_by: 10,
          created_by_name: 'Admin',
          created_at: new Date('2026-02-28'),
          updated_at: new Date('2026-02-28'),
        },
      ]);

      const result = await service.getAssetAvailabilityForDateRange(
        42,
        1,
        '2026-03-01',
        '2026-03-31',
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('maintenance');
      expect(result[0]?.assetId).toBe(42);
      expect(result[0]?.startDate).toBe('2026-03-01');
    });

    it('returns empty array when no overlapping entries', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAssetAvailabilityForDateRange(
        42,
        1,
        '2026-06-01',
        '2026-06-30',
      );

      expect(result).toEqual([]);
    });
  });

  describe('updateAvailability', () => {
    it('throws NotFoundException when asset does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // assetExists returns false

      await expect(
        service.updateAvailability(
          999,
          {
            availabilityStatus: 'maintenance',
            availabilityStart: '2026-03-01',
            availabilityEnd: '2026-03-15',
          } as never,
          1,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when overlapping range exists', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 42 }]) // assetExists
        .mockResolvedValueOnce([{ id: 1 }]); // overlapping check returns match

      await expect(
        service.updateAvailability(
          42,
          {
            availabilityStatus: 'maintenance',
            availabilityStart: '2026-03-01',
            availabilityEnd: '2026-03-15',
          } as never,
          1,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('inserts record when no overlap exists', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 42 }]) // assetExists
        .mockResolvedValueOnce([]) // no overlapping
        .mockResolvedValueOnce([]); // INSERT

      const result = await service.updateAvailability(
        42,
        {
          availabilityStatus: 'maintenance',
          availabilityStart: '2026-03-01',
          availabilityEnd: '2026-03-15',
        } as never,
        1,
      );

      expect(result.message).toBe('Asset availability updated successfully');
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('updateAvailability – operational status (no dates)', () => {
    it('skips insert when operational status has no dates', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]); // assetExists

      const result = await service.updateAvailability(
        42,
        { availabilityStatus: 'operational' } as never,
        1,
      );

      expect(result.message).toBe('Asset availability updated successfully');
      expect(mockDb.query).toHaveBeenCalledTimes(1); // only assetExists, no insert
    });
  });

  describe('createFromTpmPlan', () => {
    it('inserts maintenance availability entry', async () => {
      mockDb.query.mockResolvedValueOnce([]); // INSERT

      await service.createFromTpmPlan(1, 42, '2026-04-01', '2026-04-02', 'TPM Wartung', 10);

      expect(mockDb.query).toHaveBeenCalledOnce();
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('INSERT INTO asset_availability');
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([1, 42, '2026-04-01', '2026-04-02', 'TPM Wartung', 10]);
    });
  });

  describe('updateAvailabilityByUuid', () => {
    it('throws NotFoundException when UUID not found', async () => {
      mockDb.query.mockResolvedValueOnce([]); // resolveAssetIdByUuid

      await expect(
        service.updateAvailabilityByUuid(
          'nonexistent-uuid',
          {
            availabilityStatus: 'maintenance',
            availabilityStart: '2026-03-01',
            availabilityEnd: '2026-03-15',
          } as never,
          1,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('resolves UUID and delegates to updateAvailability', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 42 }]) // resolveAssetIdByUuid
        .mockResolvedValueOnce([{ id: 42 }]) // assetExists (inside updateAvailability)
        .mockResolvedValueOnce([]) // no overlapping
        .mockResolvedValueOnce([]); // INSERT

      const result = await service.updateAvailabilityByUuid(
        'valid-uuid',
        {
          availabilityStatus: 'maintenance',
          availabilityStart: '2026-03-01',
          availabilityEnd: '2026-03-15',
        } as never,
        1,
      );

      expect(result.message).toBe('Asset availability updated successfully');
    });
  });

  describe('updateAvailabilityEntry', () => {
    it('throws NotFoundException when entry does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // findAvailabilityEntryById

      await expect(
        service.updateAvailabilityEntry(
          999,
          {
            status: 'repair',
            startDate: '2026-03-01',
            endDate: '2026-03-15',
          } as never,
          1,
          10,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for past entries', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));

      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          asset_id: 42,
          status: 'maintenance',
          start_date: new Date('2026-02-01'),
          end_date: new Date('2026-02-10'), // past
          reason: null,
          notes: null,
          created_by: null,
          created_at: null,
          updated_at: null,
        },
      ]);

      void (await expect(
        service.updateAvailabilityEntry(
          1,
          {
            status: 'repair',
            startDate: '2026-03-01',
            endDate: '2026-03-15',
          } as never,
          1,
          10,
        ),
      ).rejects.toThrow(BadRequestException));

      vi.useRealTimers();
    });

    it('allows editing entry with null end_date (open-ended)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));

      mockDb.query
        .mockResolvedValueOnce([
          {
            id: 1,
            asset_id: 42,
            status: 'standby',
            start_date: new Date('2026-01-01'),
            end_date: null,
            reason: null,
            notes: null,
            created_by: null,
            created_at: null,
            updated_at: null,
          },
        ])
        .mockResolvedValueOnce([]); // UPDATE

      const result = await service.updateAvailabilityEntry(
        1,
        {
          status: 'repair',
          startDate: '2026-03-01',
          endDate: '2026-03-20',
        } as never,
        1,
        10,
      );

      expect(result.message).toBe('Asset availability entry updated successfully');

      vi.useRealTimers();
    });

    it('updates entry and logs activity for current/future entries', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));

      mockDb.query
        .mockResolvedValueOnce([
          {
            id: 1,
            asset_id: 42,
            status: 'maintenance',
            start_date: new Date('2026-03-01'),
            end_date: new Date('2026-03-15'), // future
            reason: 'Wartung',
            notes: null,
            created_by: null,
            created_at: null,
            updated_at: null,
          },
        ]) // findAvailabilityEntryById
        .mockResolvedValueOnce([]); // UPDATE

      const result = await service.updateAvailabilityEntry(
        1,
        {
          status: 'repair',
          startDate: '2026-03-01',
          endDate: '2026-03-20',
        } as never,
        1,
        10,
      );

      expect(result.message).toBe('Asset availability entry updated successfully');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockActivityLogger.logUpdate).toHaveBeenCalledOnce();

      vi.useRealTimers();
    });
  });

  describe('deleteAvailabilityEntry', () => {
    it('throws NotFoundException when entry does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // findAvailabilityEntryById

      await expect(service.deleteAvailabilityEntry(999, 1, 10)).rejects.toThrow(NotFoundException);
    });

    it('deletes entry and logs activity', async () => {
      mockDb.query
        .mockResolvedValueOnce([
          {
            id: 1,
            asset_id: 42,
            status: 'maintenance',
            start_date: new Date('2026-03-01'),
            end_date: new Date('2026-03-15'),
            reason: null,
            notes: null,
            created_by: null,
            created_at: null,
            updated_at: null,
          },
        ]) // findAvailabilityEntryById
        .mockResolvedValueOnce([]); // DELETE

      const result = await service.deleteAvailabilityEntry(1, 1, 10);

      expect(result.message).toBe('Asset availability entry deleted successfully');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockActivityLogger.logDelete).toHaveBeenCalledWith(
        1,
        10,
        'asset_availability',
        1,
        'Anlagenverfügbarkeit gelöscht: maintenance (2026-03-01 - 2026-03-15)',
        expect.objectContaining({
          status: 'maintenance',
          startDate: '2026-03-01',
          endDate: '2026-03-15',
        }),
      );
    });
  });

  describe('getAvailabilityHistoryByUuid', () => {
    it('throws NotFoundException when asset UUID not found', async () => {
      mockDb.query.mockResolvedValueOnce([]); // findAssetBasicInfoByUuid

      await expect(service.getAvailabilityHistoryByUuid('nonexistent-uuid', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns history with asset info and entries', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 42, uuid: 'abc-123', name: 'CNC Mill A1' }]) // findAssetBasicInfoByUuid
        .mockResolvedValueOnce([
          {
            id: 1,
            asset_id: 42,
            status: 'maintenance',
            start_date: new Date('2026-03-01'),
            end_date: new Date('2026-03-15'),
            reason: 'Wartung',
            notes: null,
            created_by: 10,
            created_by_name: 'Admin',
            created_at: new Date('2026-02-28'),
            updated_at: new Date('2026-02-28'),
          },
        ]); // history query

      const result = await service.getAvailabilityHistoryByUuid('abc-123', 1);

      expect(result.asset.id).toBe(42);
      expect(result.asset.uuid).toBe('abc-123');
      expect(result.asset.name).toBe('CNC Mill A1');
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.status).toBe('maintenance');
      expect(result.meta.total).toBe(1);
      expect(result.meta.year).toBeNull();
      expect(result.meta.month).toBeNull();
    });

    it('passes year and month filters through', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 42, uuid: 'abc-123', name: 'CNC Mill A1' }]) // findAssetBasicInfoByUuid
        .mockResolvedValueOnce([]); // history query

      const result = await service.getAvailabilityHistoryByUuid('abc-123', 1, 2026, 3);

      expect(result.meta.year).toBe(2026);
      expect(result.meta.month).toBe(3);
      expect(result.entries).toHaveLength(0);
    });
  });
});
