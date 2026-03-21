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
  return { query: vi.fn() };
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
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

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
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should throw when insert returns no id', async () => {
      mockDb.query.mockResolvedValueOnce([]);

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
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);

      await service.addEventAttendee(42, 5, 10);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should insert attendee if not existing', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.addEventAttendee(42, 5, 10);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================
  // addAttendeesToEvent
  // =============================================================

  describe('addAttendeesToEvent', () => {
    it('should add creator only when no attendeeIds', async () => {
      // addEventAttendee for creator: check + insert
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.addAttendeesToEvent(42, 5, undefined, 10);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should add creator and additional attendees', async () => {
      // creator: check + insert
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);
      // attendee 1: check + insert
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.addAttendeesToEvent(42, 5, [8], 10);

      expect(mockDb.query).toHaveBeenCalledTimes(4);
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
