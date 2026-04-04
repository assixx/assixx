/**
 * Unit tests for CalendarCreationService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Event insertion, child event creation, attendee management,
 *        determineOrgTarget (pure function), activity logging.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { CalendarCreationService } from './calendar-creation.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { tenantQuery: vi.fn(), tenantQueryOne: vi.fn().mockResolvedValue(null) };
}

function createMockActivityLogger() {
  return { logCreate: vi.fn().mockResolvedValue(undefined) };
}

function makeCreateDto(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Team Meeting',
    description: 'Weekly sync',
    startTime: '2025-06-15T10:00:00Z',
    endTime: '2025-06-15T11:00:00Z',
    ...overrides,
  };
}

// =============================================================
// CalendarCreationService
// =============================================================

describe('CalendarCreationService', () => {
  let service: CalendarCreationService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockLogger: ReturnType<typeof createMockActivityLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockLogger = createMockActivityLogger();
    service = new CalendarCreationService(
      mockDb as unknown as DatabaseService,
      mockLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // insertEvent
  // =============================================================

  describe('insertEvent', () => {
    it('should insert event and return id', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service.insertEvent(
        makeCreateDto() as never,
        10,
        5,
        new Date('2025-06-15T10:00:00Z'),
        new Date('2025-06-15T11:00:00Z'),
        null,
        null,
      );

      expect(result).toBe(42);
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(1);
    });

    it('should pass description as null when undefined', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 1 }]);

      await service.insertEvent(
        makeCreateDto({ description: undefined }) as never,
        10,
        5,
        new Date('2025-06-15T10:00:00Z'),
        new Date('2025-06-15T11:00:00Z'),
        null,
        null,
      );

      const params = mockDb.tenantQuery.mock.calls[0]?.[1] as unknown[];
      expect(params[4]).toBeNull();
    });

    it('should convert allDay boolean to integer', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 1 }]);

      await service.insertEvent(
        makeCreateDto({ allDay: true }) as never,
        10,
        5,
        new Date('2025-06-15T10:00:00Z'),
        new Date('2025-06-15T11:00:00Z'),
        null,
        null,
      );

      const params = mockDb.tenantQuery.mock.calls[0]?.[1] as unknown[];
      expect(params[8]).toBe(1);
    });

    it('should throw when insert returns no id', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(
        service.insertEvent(makeCreateDto() as never, 10, 5, new Date(), new Date(), null, null),
      ).rejects.toThrow('Failed to create event');
    });
  });

  // =============================================================
  // addEventAttendee
  // =============================================================

  describe('addEventAttendee', () => {
    it('should skip if already attendee', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ user_id: 5 }]);

      await service.addEventAttendee(42, 5, 10);

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(1);
    });

    it('should insert attendee if not existing', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.addEventAttendee(42, 5, 10);

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================
  // addAttendeesToEvent
  // =============================================================

  describe('addAttendeesToEvent', () => {
    it('should add creator only when no attendeeIds', async () => {
      // addEventAttendee for creator: check + insert
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.addAttendeesToEvent(42, 5, undefined, 10);

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(2);
    });

    it('should add creator and additional attendees', async () => {
      // creator: check + insert
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      // attendee 1: check + insert
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.addAttendeesToEvent(42, 5, [8], 10);

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(4);
    });
  });

  // =============================================================
  // createChildEvents
  // =============================================================

  describe('createChildEvents', () => {
    it('should skip index 0 and create child events for remaining dates', async () => {
      const dates = [
        new Date('2025-06-15T10:00:00Z'),
        new Date('2025-06-22T10:00:00Z'),
        new Date('2025-06-29T10:00:00Z'),
      ];
      const durationMs = 3600000; // 1h

      // For each child (2 children): insertEvent + addAttendeesToEvent (creator check + insert)
      mockDb.tenantQuery
        .mockResolvedValueOnce([{ id: 100 }]) // child 1 insertEvent
        .mockResolvedValueOnce([]) // child 1 attendee check
        .mockResolvedValueOnce([]) // child 1 attendee insert
        .mockResolvedValueOnce([{ id: 101 }]) // child 2 insertEvent
        .mockResolvedValueOnce([]) // child 2 attendee check
        .mockResolvedValueOnce([]); // child 2 attendee insert

      await service.createChildEvents(dates, makeCreateDto() as never, 10, 5, durationMs, 1);

      // 2 insertEvent calls (index 1 and 2, skipping index 0)
      const insertCalls = mockDb.tenantQuery.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          (call[0] as string).includes('INSERT INTO calendar_events'),
      );
      expect(insertCalls).toHaveLength(2);
    });

    it('should create no children for single-date array', async () => {
      await service.createChildEvents(
        [new Date('2025-06-15T10:00:00Z')],
        makeCreateDto() as never,
        10,
        5,
        3600000,
        1,
      );

      expect(mockDb.tenantQuery).not.toHaveBeenCalled();
    });
  });

  // =============================================================
  // determineOrgTarget (pure function)
  // =============================================================

  describe('determineOrgTarget', () => {
    it('should return area when areaIds provided', () => {
      const result = service.determineOrgTarget({
        areaIds: [1],
        departmentIds: [2],
        teamIds: [3],
      } as never);

      expect(result.orgLevel).toBe('area');
      expect(result.areaId).toBe(1);
      expect(result.departmentId).toBe(2);
      expect(result.teamId).toBe(3);
    });

    it('should return department when no area', () => {
      const result = service.determineOrgTarget({
        departmentIds: [2],
      } as never);

      expect(result.orgLevel).toBe('department');
      expect(result.departmentId).toBe(2);
    });

    it('should return team when no area or department', () => {
      const result = service.determineOrgTarget({
        teamIds: [3],
      } as never);

      expect(result.orgLevel).toBe('team');
    });

    it('should return company when specified', () => {
      const result = service.determineOrgTarget({
        orgLevel: 'company',
      } as never);

      expect(result.orgLevel).toBe('company');
    });

    it('should default to personal', () => {
      const result = service.determineOrgTarget({} as never);

      expect(result.orgLevel).toBe('personal');
    });
  });

  // =============================================================
  // logEventCreated
  // =============================================================

  describe('logEventCreated', () => {
    it('should delegate to activityLogger', async () => {
      const dto = makeCreateDto();

      await service.logEventCreated(10, 5, 42, dto as never);

      expect(mockLogger.logCreate).toHaveBeenCalledWith(
        10,
        5,
        'calendar',
        42,
        expect.stringContaining('Team Meeting'),
        expect.objectContaining({ title: 'Team Meeting' }),
      );
    });
  });
});
