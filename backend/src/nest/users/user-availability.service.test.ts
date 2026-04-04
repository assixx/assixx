/**
 * User Availability Service – Unit Tests
 *
 * Tests for pure helper methods + DB-mocked public methods.
 * Private methods tested via bracket notation.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
  mockDb: { tenantQuery: ReturnType<typeof vi.fn> };
  mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;
  mockUserRepo: Record<string, ReturnType<typeof vi.fn>>;
} {
  const mockDb = { tenantQuery: vi.fn() };
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

      expect(() => service['validateAvailabilityDates'](dto as never)).toThrow(BadRequestException);
    });

    it('throws when end date is before start date', () => {
      const dto = {
        availabilityStatus: 'vacation',
        availabilityStart: '2025-06-15',
        availabilityEnd: '2025-06-01',
      };

      expect(() => service['validateAvailabilityDates'](dto as never)).toThrow(BadRequestException);
    });

    it('does not throw for available status without dates', () => {
      const dto = {
        availabilityStatus: 'available',
        availabilityStart: undefined,
        availabilityEnd: undefined,
      };

      expect(() => service['validateAvailabilityDates'](dto as never)).not.toThrow();
    });
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('UserAvailabilityService – DB-mocked methods', () => {
  let service: UserAvailabilityService;
  let mockDb: { tenantQuery: ReturnType<typeof vi.fn> };
  let mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockUserRepo: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockActivityLogger = result.mockActivityLogger;
    mockUserRepo = result.mockUserRepo;
  });

  describe('getUserAvailability', () => {
    it('returns null when no availability entry exists', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.getUserAvailability(42, 1);

      expect(result).toBeNull();
    });

    it('returns first availability entry', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
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
      expect(mockDb.tenantQuery).not.toHaveBeenCalled();
    });

    it('returns map keyed by user_id', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
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
      mockDb.tenantQuery.mockResolvedValueOnce([]); // userExists returns false

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
      mockDb.tenantQuery
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
      mockDb.tenantQuery.mockResolvedValueOnce([]); // findAvailabilityEntryById

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

      mockDb.tenantQuery.mockResolvedValueOnce([
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
      mockDb.tenantQuery.mockResolvedValueOnce([]); // findAvailabilityEntryById

      await expect(service.deleteAvailabilityEntry(999, 1, 10)).rejects.toThrow(NotFoundException);
    });

    it('deletes entry and logs activity', async () => {
      mockDb.tenantQuery
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
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(2);
      expect(mockActivityLogger.logDelete).toHaveBeenCalledOnce();
    });
  });

  describe('insertAvailabilityHistoryIfNeeded', () => {
    it('returns early when status is undefined', async () => {
      await service.insertAvailabilityHistoryIfNeeded(42, 1, undefined, null, null, null, null, 10);

      expect(mockDb.tenantQuery).not.toHaveBeenCalled();
    });

    it('returns early when dates are null', async () => {
      await service.insertAvailabilityHistoryIfNeeded(42, 1, 'sick', null, null, null, null, 10);

      expect(mockDb.tenantQuery).not.toHaveBeenCalled();
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

    it('returns early when startDate is undefined', async () => {
      await service.insertAvailabilityHistoryIfNeeded(
        42,
        1,
        'sick',
        undefined,
        '2025-06-15',
        null,
        null,
        10,
      );

      expect(mockDb.tenantQuery).not.toHaveBeenCalled();
    });

    it('returns early when endDate is undefined', async () => {
      await service.insertAvailabilityHistoryIfNeeded(
        42,
        1,
        'sick',
        '2025-06-01',
        undefined,
        null,
        null,
        10,
      );

      expect(mockDb.tenantQuery).not.toHaveBeenCalled();
    });

    it('throws ConflictException when overlapping range exists', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 99 }]); // overlapping check

      await expect(
        service.insertAvailabilityHistoryIfNeeded(
          42,
          1,
          'sick',
          '2025-06-01',
          '2025-06-15',
          null,
          null,
          10,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('inserts record when dates are valid and no overlap', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([]) // no overlapping
        .mockResolvedValueOnce([]); // INSERT

      await service.insertAvailabilityHistoryIfNeeded(
        42,
        1,
        'sick',
        '2025-06-01',
        '2025-06-15',
        'Flu',
        'Doctor note',
        10,
      );

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(2);
      // Verify INSERT query params
      const insertCall = mockDb.tenantQuery.mock.calls[1] as unknown[];
      const insertParams = insertCall[1] as unknown[];
      expect(insertParams).toEqual([
        42,
        1,
        'sick',
        '2025-06-01',
        '2025-06-15',
        'Flu',
        'Doctor note',
        10,
      ]);
    });

    it('inserts record with null reason and notes when not provided', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([]) // no overlapping
        .mockResolvedValueOnce([]); // INSERT

      await service.insertAvailabilityHistoryIfNeeded(
        42,
        1,
        'vacation',
        '2025-07-01',
        '2025-07-14',
        undefined,
        undefined,
        10,
      );

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(2);
      const insertCall = mockDb.tenantQuery.mock.calls[1] as unknown[];
      const insertParams = insertCall[1] as unknown[];
      expect(insertParams).toEqual([42, 1, 'vacation', '2025-07-01', '2025-07-14', null, null, 10]);
    });
  });

  // ============================================================
  // updateAvailability – success path
  // ============================================================

  describe('updateAvailability – success paths', () => {
    it('inserts availability when user exists, no overlap, valid dates', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([{ id: 42 }]) // userExists
        .mockResolvedValueOnce([]) // no overlapping
        .mockResolvedValueOnce([]); // INSERT

      const result = await service.updateAvailability(
        42,
        {
          availabilityStatus: 'vacation',
          availabilityStart: '2025-07-01',
          availabilityEnd: '2025-07-14',
          availabilityReason: 'Summer break',
          availabilityNotes: 'OOO',
        } as never,
        1,
        10,
      );

      expect(result.message).toBe('Availability updated successfully');
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(3);
    });

    it('does not insert when dates are undefined (available status)', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 42 }]); // userExists

      const result = await service.updateAvailability(
        42,
        {
          availabilityStatus: 'available',
          availabilityStart: undefined,
          availabilityEnd: undefined,
        } as never,
        1,
      );

      expect(result.message).toBe('Availability updated successfully');
      // Only userExists query, no insert
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException for non-available status without dates', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 42 }]); // userExists

      await expect(
        service.updateAvailability(
          42,
          {
            availabilityStatus: 'sick',
            availabilityStart: undefined,
            availabilityEnd: undefined,
          } as never,
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when end date is before start date', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 42 }]); // userExists

      await expect(
        service.updateAvailability(
          42,
          {
            availabilityStatus: 'vacation',
            availabilityStart: '2025-07-14',
            availabilityEnd: '2025-07-01',
          } as never,
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // updateAvailabilityByUuid
  // ============================================================

  describe('updateAvailabilityByUuid', () => {
    it('resolves UUID and delegates to updateAvailability', async () => {
      mockUserRepo.resolveUuidToId.mockResolvedValueOnce(42);
      mockDb.tenantQuery
        .mockResolvedValueOnce([{ id: 42 }]) // userExists
        .mockResolvedValueOnce([]) // no overlapping
        .mockResolvedValueOnce([]); // INSERT

      const result = await service.updateAvailabilityByUuid(
        'test-uuid-123',
        {
          availabilityStatus: 'vacation',
          availabilityStart: '2025-07-01',
          availabilityEnd: '2025-07-14',
        } as never,
        1,
        10,
      );

      expect(result.message).toBe('Availability updated successfully');
      expect(mockUserRepo.resolveUuidToId).toHaveBeenCalledWith('test-uuid-123', 1);
    });

    it('throws NotFoundException when UUID cannot be resolved', async () => {
      mockUserRepo.resolveUuidToId.mockResolvedValueOnce(null);

      await expect(
        service.updateAvailabilityByUuid(
          'nonexistent-uuid',
          {
            availabilityStatus: 'sick',
            availabilityStart: '2025-06-01',
            availabilityEnd: '2025-06-15',
          } as never,
          1,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // getAvailabilityHistoryByUuid
  // ============================================================

  describe('getAvailabilityHistoryByUuid', () => {
    it('returns history result with employee info and entries', async () => {
      // findUserBasicInfoByUuid
      mockDb.tenantQuery.mockResolvedValueOnce([
        {
          id: 42,
          uuid: 'abc-uuid',
          first_name: 'Max',
          last_name: 'Mustermann',
          email: 'max@example.com',
        },
      ]);
      // history query
      mockDb.tenantQuery.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 42,
          status: 'vacation',
          start_date: new Date('2025-06-01T00:00:00Z'),
          end_date: new Date('2025-06-15T00:00:00Z'),
          reason: 'Holiday',
          notes: null,
          created_by: 10,
          created_by_name: 'Admin',
          created_at: new Date('2025-05-30T10:00:00Z'),
          updated_at: new Date('2025-05-30T10:00:00Z'),
        },
      ]);

      const result = await service.getAvailabilityHistoryByUuid('abc-uuid', 1, 2025, 6);

      expect(result.employee.id).toBe(42);
      expect(result.employee.uuid).toBe('abc-uuid');
      expect(result.employee.firstName).toBe('Max');
      expect(result.employee.lastName).toBe('Mustermann');
      expect(result.employee.email).toBe('max@example.com');
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.status).toBe('vacation');
      expect(result.meta.total).toBe(1);
      expect(result.meta.year).toBe(2025);
      expect(result.meta.month).toBe(6);
    });

    it('throws NotFoundException when user UUID not found', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]); // findUserBasicInfoByUuid

      await expect(service.getAvailabilityHistoryByUuid('nonexistent', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns empty entries when no history exists', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([
          {
            id: 42,
            uuid: 'abc-uuid',
            first_name: null,
            last_name: null,
            email: 'user@example.com',
          },
        ])
        .mockResolvedValueOnce([]); // no history entries

      const result = await service.getAvailabilityHistoryByUuid('abc-uuid', 1);

      expect(result.employee.firstName).toBe('');
      expect(result.employee.lastName).toBe('');
      expect(result.entries).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.year).toBeNull();
      expect(result.meta.month).toBeNull();
    });
  });

  // ============================================================
  // updateAvailabilityEntry – success and edge cases
  // ============================================================

  describe('updateAvailabilityEntry – success and edge cases', () => {
    it('updates entry and logs activity when entry is editable', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

      mockDb.tenantQuery
        .mockResolvedValueOnce([
          {
            id: 1,
            user_id: 42,
            status: 'vacation',
            start_date: new Date('2025-06-01'),
            end_date: new Date('2025-06-15'),
            reason: 'Holiday',
            notes: 'Approved',
            created_by: 10,
            created_at: new Date('2025-05-30'),
            updated_at: new Date('2025-05-30'),
          },
        ]) // findAvailabilityEntryById
        .mockResolvedValueOnce([]); // UPDATE query

      const result = await service.updateAvailabilityEntry(
        1,
        {
          status: 'sick',
          startDate: '2025-06-01',
          endDate: '2025-06-10',
          reason: 'Flu',
          notes: 'Doctor note',
        } as never,
        1,
        10,
      );

      expect(result.message).toBe('Availability entry updated successfully');
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(2);
      expect(mockActivityLogger.logUpdate).toHaveBeenCalledOnce();

      // Verify logUpdate was called with old and new values
      const logCall = mockActivityLogger.logUpdate.mock.calls[0] as unknown[];
      expect(logCall[0]).toBe(1); // tenantId
      expect(logCall[1]).toBe(10); // actingUserId
      expect(logCall[2]).toBe('availability'); // entity type
      expect(logCall[3]).toBe(1); // entryId

      vi.useRealTimers();
    });

    it('allows editing entry with null end_date', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));

      mockDb.tenantQuery
        .mockResolvedValueOnce([
          {
            id: 5,
            user_id: 42,
            status: 'training',
            start_date: new Date('2025-06-10'),
            end_date: null, // open-ended entry
            reason: null,
            notes: null,
            created_by: null,
            created_at: null,
            updated_at: null,
          },
        ]) // findAvailabilityEntryById
        .mockResolvedValueOnce([]); // UPDATE query

      const result = await service.updateAvailabilityEntry(
        5,
        {
          status: 'training',
          startDate: '2025-06-10',
          endDate: '2025-06-20',
        } as never,
        1,
        10,
      );

      expect(result.message).toBe('Availability entry updated successfully');

      vi.useRealTimers();
    });

    it('allows editing entry whose end_date is today', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));

      mockDb.tenantQuery
        .mockResolvedValueOnce([
          {
            id: 3,
            user_id: 42,
            status: 'sick',
            start_date: new Date('2025-06-10'),
            end_date: new Date('2025-06-15'), // ends today — should be editable
            reason: null,
            notes: null,
            created_by: null,
            created_at: null,
            updated_at: null,
          },
        ])
        .mockResolvedValueOnce([]); // UPDATE

      const result = await service.updateAvailabilityEntry(
        3,
        {
          status: 'sick',
          startDate: '2025-06-10',
          endDate: '2025-06-16',
        } as never,
        1,
        10,
      );

      expect(result.message).toBe('Availability entry updated successfully');

      vi.useRealTimers();
    });
  });

  // ============================================================
  // deleteAvailabilityEntry – with null dates
  // ============================================================

  describe('deleteAvailabilityEntry – edge cases', () => {
    it('deletes entry with null dates and logs activity', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([
          {
            id: 7,
            user_id: 42,
            status: 'other',
            start_date: null,
            end_date: null,
            reason: null,
            notes: null,
            created_by: null,
            created_at: null,
            updated_at: null,
          },
        ])
        .mockResolvedValueOnce([]); // DELETE

      const result = await service.deleteAvailabilityEntry(7, 1, 10);

      expect(result.message).toBe('Availability entry deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalledOnce();

      // Verify deleted values include null dates
      const logCall = mockActivityLogger.logDelete.mock.calls[0] as unknown[];
      const deletedValues = logCall[5] as Record<string, unknown>;
      expect(deletedValues.startDate).toBeNull();
      expect(deletedValues.endDate).toBeNull();
    });
  });
});
