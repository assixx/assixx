/**
 * User Availability Service – Unit Tests
 *
 * Tests for pure helper methods + DB-mocked public methods.
 * Private methods tested via bracket notation.
 */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { UserRepository } from '../database/repositories/user.repository.js';
import {
  type AvailabilityFields,
  type AvailabilityRow,
  type UserAvailabilityRow,
  UserAvailabilityService,
} from './user-availability.service.js';

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(): {
  service: UserAvailabilityService;
  mockDb: { query: ReturnType<typeof vi.fn> };
  mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;
  mockUserRepo: Record<string, ReturnType<typeof vi.fn>>;
} {
  const mockDb = { query: vi.fn() };
  const mockActivityLogger = {
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  };
  const mockUserRepo = {
    resolveUuidToId: vi.fn(),
  };

  const service = new UserAvailabilityService(
    mockDb as unknown as DatabaseService,
    mockActivityLogger as unknown as ActivityLoggerService,
    mockUserRepo as unknown as UserRepository,
  );

  return { service, mockDb, mockActivityLogger, mockUserRepo };
}

// ============================================================
// Pure Helper Methods
// ============================================================

describe('UserAvailabilityService – pure helpers', () => {
  let service: UserAvailabilityService;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
  });

  describe('addAvailabilityInfo', () => {
    it('sets defaults when availability is undefined', () => {
      const response: AvailabilityFields = {
        availabilityStatus: null,
        availabilityStart: null,
        availabilityEnd: null,
        availabilityNotes: null,
      };

      service.addAvailabilityInfo(response, undefined);

      expect(response.availabilityStatus).toBe('available');
      expect(response.availabilityStart).toBeNull();
      expect(response.availabilityEnd).toBeNull();
      expect(response.availabilityNotes).toBeNull();
    });

    it('maps availability row to response fields', () => {
      const response: AvailabilityFields = {
        availabilityStatus: null,
        availabilityStart: null,
        availabilityEnd: null,
        availabilityNotes: null,
      };
      const availability: UserAvailabilityRow = {
        user_id: 1,
        status: 'sick',
        start_date: new Date('2025-06-01T00:00:00Z'),
        end_date: new Date('2025-06-15T00:00:00Z'),
        notes: 'Doctor appointment',
      };

      service.addAvailabilityInfo(response, availability);

      expect(response.availabilityStatus).toBe('sick');
      expect(response.availabilityStart).toBe('2025-06-01');
      expect(response.availabilityEnd).toBe('2025-06-15');
      expect(response.availabilityNotes).toBe('Doctor appointment');
    });

    it('handles null dates in availability', () => {
      const response: AvailabilityFields = {
        availabilityStatus: null,
        availabilityStart: null,
        availabilityEnd: null,
        availabilityNotes: null,
      };
      const availability: UserAvailabilityRow = {
        user_id: 1,
        status: 'vacation',
        start_date: null,
        end_date: null,
        notes: null,
      };

      service.addAvailabilityInfo(response, availability);

      expect(response.availabilityStatus).toBe('vacation');
      expect(response.availabilityStart).toBeNull();
      expect(response.availabilityEnd).toBeNull();
      expect(response.availabilityNotes).toBeNull();
    });
  });

  describe('mapAvailabilityRowToEntry', () => {
    it('maps DB row to API format', () => {
      const row: AvailabilityRow = {
        id: 1,
        user_id: 42,
        status: 'sick',
        start_date: new Date('2025-06-01T00:00:00Z'),
        end_date: new Date('2025-06-15T00:00:00Z'),
        reason: 'Flu',
        notes: 'With certificate',
        created_by: 10,
        created_by_name: 'Admin User',
        created_at: new Date('2025-05-30T10:00:00Z'),
        updated_at: new Date('2025-05-31T08:00:00Z'),
      };

      const result = service['mapAvailabilityRowToEntry'](row);

      expect(result.id).toBe(1);
      expect(result.userId).toBe(42);
      expect(result.status).toBe('sick');
      expect(result.startDate).toBe('2025-06-01');
      expect(result.endDate).toBe('2025-06-15');
      expect(result.reason).toBe('Flu');
      expect(result.notes).toBe('With certificate');
      expect(result.createdBy).toBe(10);
      expect(result.createdByName).toBe('Admin User');
    });

    it('handles null dates and metadata', () => {
      const row: AvailabilityRow = {
        id: 2,
        user_id: 43,
        status: 'vacation',
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

      expect(result.query).toContain('user_id = $1');
      expect(result.query).toContain('tenant_id = $2');
      expect(result.params).toEqual([42, 1]);
    });

    it('adds year filter', () => {
      const result = service['buildAvailabilityHistoryQuery'](42, 1, 2025);

      expect(result.query).toContain('EXTRACT(YEAR FROM ea.start_date) = $3');
      expect(result.params).toEqual([42, 1, 2025]);
    });

    it('adds year and month filters', () => {
      const result = service['buildAvailabilityHistoryQuery'](42, 1, 2025, 6);

      expect(result.query).toContain('EXTRACT(YEAR FROM ea.start_date) = $3');
      expect(result.query).toContain('EXTRACT(MONTH FROM ea.start_date) = $4');
      expect(result.params).toEqual([42, 1, 2025, 6]);
    });
  });

  describe('validateAvailabilityDates', () => {
    it('throws when non-available status has no start date', () => {
      const dto = {
        availabilityStatus: 'sick',
        availabilityStart: undefined,
        availabilityEnd: '2025-06-15',
      };

      expect(() => service['validateAvailabilityDates'](dto as never)).toThrow(
        BadRequestException,
      );
    });

    it('throws when end date is before start date', () => {
      const dto = {
        availabilityStatus: 'vacation',
        availabilityStart: '2025-06-15',
        availabilityEnd: '2025-06-01',
      };

      expect(() => service['validateAvailabilityDates'](dto as never)).toThrow(
        BadRequestException,
      );
    });

    it('does not throw for available status without dates', () => {
      const dto = {
        availabilityStatus: 'available',
        availabilityStart: undefined,
        availabilityEnd: undefined,
      };

      expect(() =>
        service['validateAvailabilityDates'](dto as never),
      ).not.toThrow();
    });
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('UserAvailabilityService – DB-mocked methods', () => {
  let service: UserAvailabilityService;
  let mockDb: { query: ReturnType<typeof vi.fn> };
  let mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockActivityLogger = result.mockActivityLogger;
  });

  describe('getUserAvailability', () => {
    it('returns null when no availability entry exists', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getUserAvailability(42, 1);

      expect(result).toBeNull();
    });

    it('returns first availability entry', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 42,
          status: 'vacation',
          start_date: new Date('2025-06-01'),
          end_date: new Date('2025-06-15'),
          notes: null,
        },
      ]);

      const result = await service.getUserAvailability(42, 1);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('vacation');
    });
  });

  describe('getUserAvailabilityBatch', () => {
    it('returns empty map for empty user IDs', async () => {
      const result = await service.getUserAvailabilityBatch([], 1);

      expect(result.size).toBe(0);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns map keyed by user_id', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 1,
          status: 'available',
          start_date: null,
          end_date: null,
          notes: null,
        },
        {
          user_id: 2,
          status: 'sick',
          start_date: null,
          end_date: null,
          notes: null,
        },
      ]);

      const result = await service.getUserAvailabilityBatch([1, 2], 1);

      expect(result.size).toBe(2);
      expect(result.get(1)?.status).toBe('available');
      expect(result.get(2)?.status).toBe('sick');
    });
  });

  describe('updateAvailability', () => {
    it('throws NotFoundException when user does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // userExists returns false

      await expect(
        service.updateAvailability(
          999,
          {
            availabilityStatus: 'vacation',
            availabilityStart: '2025-06-01',
            availabilityEnd: '2025-06-15',
          } as never,
          1,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when overlapping range exists', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 42 }]) // userExists
        .mockResolvedValueOnce([{ id: 1 }]); // overlapping check returns match

      await expect(
        service.updateAvailability(
          42,
          {
            availabilityStatus: 'vacation',
            availabilityStart: '2025-06-01',
            availabilityEnd: '2025-06-15',
          } as never,
          1,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateAvailabilityEntry', () => {
    it('throws NotFoundException when entry does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // findAvailabilityEntryById

      await expect(
        service.updateAvailabilityEntry(
          999,
          {
            status: 'sick',
            startDate: '2025-06-01',
            endDate: '2025-06-15',
          } as never,
          1,
          10,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for past entries', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));

      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 42,
          status: 'sick',
          start_date: new Date('2025-05-01'),
          end_date: new Date('2025-05-10'), // past
          reason: null,
          notes: null,
          created_by: null,
          created_at: null,
          updated_at: null,
        },
      ]);

      await expect(
        service.updateAvailabilityEntry(
          1,
          {
            status: 'vacation',
            startDate: '2025-06-01',
            endDate: '2025-06-15',
          } as never,
          1,
          10,
        ),
      ).rejects.toThrow(BadRequestException);

      vi.useRealTimers();
    });
  });

  describe('deleteAvailabilityEntry', () => {
    it('throws NotFoundException when entry does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // findAvailabilityEntryById

      await expect(service.deleteAvailabilityEntry(999, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes entry and logs activity', async () => {
      mockDb.query
        .mockResolvedValueOnce([
          {
            id: 1,
            user_id: 42,
            status: 'vacation',
            start_date: new Date('2025-06-01'),
            end_date: new Date('2025-06-15'),
            reason: null,
            notes: null,
            created_by: null,
            created_at: null,
            updated_at: null,
          },
        ]) // findAvailabilityEntryById
        .mockResolvedValueOnce([]); // DELETE

      const result = await service.deleteAvailabilityEntry(1, 1, 10);

      expect(result.message).toBe('Availability entry deleted successfully');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockActivityLogger.logDelete).toHaveBeenCalledOnce();
    });
  });

  describe('insertAvailabilityHistoryIfNeeded', () => {
    it('returns early when status is undefined', async () => {
      await service.insertAvailabilityHistoryIfNeeded(
        42,
        1,
        undefined,
        null,
        null,
        null,
        null,
        10,
      );

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns early when dates are null', async () => {
      await service.insertAvailabilityHistoryIfNeeded(
        42,
        1,
        'sick',
        null,
        null,
        null,
        null,
        10,
      );

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when end before start', async () => {
      await expect(
        service.insertAvailabilityHistoryIfNeeded(
          42,
          1,
          'sick',
          '2025-06-15',
          '2025-06-01',
          null,
          null,
          10,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
