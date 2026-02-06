/**
 * Calendar Service – Unit Tests
 *
 * Tests for pure helper methods + DB-mocked public methods.
 * Private methods tested via bracket notation.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { CalendarCreationService } from './calendar-creation.service.js';
import type { CalendarOverviewService } from './calendar-overview.service.js';
import type { CalendarPermissionService } from './calendar-permission.service.js';
import { CalendarService } from './calendar.service.js';

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(): {
  service: CalendarService;
  mockDb: { query: ReturnType<typeof vi.fn> };
  mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;
  mockPermission: Record<string, ReturnType<typeof vi.fn>>;
  mockCreation: Record<string, ReturnType<typeof vi.fn>>;
  mockOverview: Record<string, ReturnType<typeof vi.fn>>;
} {
  const mockDb = { query: vi.fn() };
  const mockActivityLogger = {
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  };
  const mockPermission = {
    getUserRole: vi.fn(),
    checkEventAccess: vi.fn(),
    getEventAttendees: vi.fn(),
    buildAdminOrgLevelFilter: vi.fn(),
    buildPermissionBasedFilter: vi.fn(),
  };
  const mockCreation = {
    insertEvent: vi.fn(),
    addAttendeesToEvent: vi.fn(),
    createChildEvents: vi.fn(),
    logEventCreated: vi.fn(),
    determineOrgTarget: vi.fn(),
  };
  const mockOverview = {
    getDashboardEvents: vi.fn(),
    getRecentlyAddedEvents: vi.fn(),
    getUpcomingCount: vi.fn(),
  };

  const service = new CalendarService(
    mockDb as unknown as DatabaseService,
    mockActivityLogger as unknown as ActivityLoggerService,
    mockPermission as unknown as CalendarPermissionService,
    mockCreation as unknown as CalendarCreationService,
    mockOverview as unknown as CalendarOverviewService,
  );

  return {
    service,
    mockDb,
    mockActivityLogger,
    mockPermission,
    mockCreation,
    mockOverview,
  };
}

// ============================================================
// Pure Private Methods
// ============================================================

describe('CalendarService – pure helpers', () => {
  let service: CalendarService;
  let mockCreation: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockCreation = result.mockCreation;
  });

  describe('getEventFieldMappings', () => {
    it('returns field mappings without orgLevel when hasAssignment is true', () => {
      const fields = service['getEventFieldMappings'](true);
      const keys = fields.map((f) => f.key);

      expect(keys).toContain('title');
      expect(keys).toContain('startTime');
      expect(keys).toContain('endTime');
      expect(keys).not.toContain('orgLevel');
    });

    it('includes orgLevel when hasAssignment is false', () => {
      const fields = service['getEventFieldMappings'](false);
      const keys = fields.map((f) => f.key);

      expect(keys).toContain('orgLevel');
    });

    it('transforms allDay to integer', () => {
      const fields = service['getEventFieldMappings'](false);
      const allDayField = fields.find((f) => f.key === 'allDay');

      expect(allDayField?.transform?.(true)).toBe(1);
      expect(allDayField?.transform?.(false)).toBe(0);
    });

    it('transforms status to confirmed/cancelled', () => {
      const fields = service['getEventFieldMappings'](false);
      const statusField = fields.find((f) => f.key === 'status');

      expect(statusField?.transform?.('cancelled')).toBe('cancelled');
      expect(statusField?.transform?.('confirmed')).toBe('confirmed');
      expect(statusField?.transform?.('other')).toBe('confirmed');
    });
  });

  describe('buildEventUpdateQuery', () => {
    it('builds query with simple field updates', () => {
      const dto = { title: 'New Title' };
      const result = service['buildEventUpdateQuery'](dto as never);

      expect(result.updates).toContain('updated_at = NOW()');
      expect(result.updates).toContain('title = $1');
      expect(result.params).toEqual(['New Title']);
    });

    it('builds query with assignment fields', () => {
      mockCreation.determineOrgTarget.mockReturnValue({
        orgLevel: 'department',
        departmentId: 5,
        teamId: null,
        areaId: null,
      });

      const dto = { departmentIds: [5] };
      const result = service['buildEventUpdateQuery'](dto as never);

      expect(result.updates).toContain('org_level = $1');
      expect(result.updates).toContain('department_id = $2');
      expect(result.params[0]).toBe('department');
      expect(result.params[1]).toBe(5);
    });
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('CalendarService – DB-mocked methods', () => {
  let service: CalendarService;
  let mockDb: { query: ReturnType<typeof vi.fn> };
  let mockPermission: Record<string, ReturnType<typeof vi.fn>>;
  let mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockOverview: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockPermission = result.mockPermission;
    mockActivityLogger = result.mockActivityLogger;
    mockOverview = result.mockOverview;
  });

  describe('getEventById', () => {
    it('throws NotFoundException when event does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // SELECT event

      await expect(service.getEventById(999, 1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when user has no access', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          title: 'Secret Event',
          user_id: 99,
          tenant_id: 1,
          start_date: new Date(),
          end_date: new Date(),
        },
      ]);
      mockPermission.getUserRole.mockResolvedValueOnce({
        role: 'employee',
        has_full_access: false,
      });
      mockPermission.checkEventAccess.mockResolvedValueOnce(false);

      await expect(service.getEventById(1, 1, 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateEvent', () => {
    it('throws NotFoundException when event does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // SELECT

      await expect(
        service.updateEvent(999, { title: 'New' } as never, 1, 1, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for non-owner non-admin', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          title: 'Event',
          user_id: 99, // owned by user 99
          tenant_id: 1,
          start_date: new Date(),
          end_date: new Date(),
        },
      ]);

      await expect(
        service.updateEvent(1, { title: 'New' } as never, 1, 5, 'employee'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteEvent', () => {
    it('throws NotFoundException when event does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // SELECT

      await expect(service.deleteEvent(999, 1, 1, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for non-owner non-admin', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          title: 'Event',
          user_id: 99,
          tenant_id: 1,
          start_date: new Date(),
          end_date: new Date(),
        },
      ]);

      await expect(service.deleteEvent(1, 1, 5, 'employee')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deletes event and attendees for admin', async () => {
      mockDb.query
        .mockResolvedValueOnce([
          {
            id: 1,
            title: 'Event',
            user_id: 5,
            tenant_id: 1,
            start_date: new Date(),
            end_date: new Date(),
          },
        ]) // SELECT
        .mockResolvedValueOnce([]) // DELETE attendees
        .mockResolvedValueOnce([]); // DELETE event

      mockActivityLogger.logDelete.mockResolvedValueOnce(undefined);

      const result = await service.deleteEvent(1, 1, 5, 'admin');

      expect(result.message).toBe('Event deleted successfully');
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('createEvent', () => {
    it('throws ForbiddenException when start is after end', async () => {
      await expect(
        service.createEvent(
          {
            title: 'Test',
            startTime: '2025-06-15T16:00:00Z',
            endTime: '2025-06-15T08:00:00Z', // end before start
          } as never,
          1,
          5,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('resolveEventIdByUuid', () => {
    it('throws NotFoundException when UUID not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service['resolveEventIdByUuid']('non-existent-uuid', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns ID for valid UUID', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service['resolveEventIdByUuid']('valid-uuid', 1);

      expect(result).toBe(42);
    });
  });

  describe('getDashboardEvents – delegation', () => {
    it('delegates to overview service', async () => {
      mockOverview.getDashboardEvents.mockResolvedValueOnce([]);

      const result = await service.getDashboardEvents(1, 5, 10);

      expect(mockOverview.getDashboardEvents).toHaveBeenCalledWith(1, 5, 10);
      expect(result).toEqual([]);
    });
  });

  describe('getUpcomingCount – delegation', () => {
    it('delegates to overview service', async () => {
      mockOverview.getUpcomingCount.mockResolvedValueOnce({ count: 7 });

      const result = await service.getUpcomingCount(1, 5, null, null);

      expect(mockOverview.getUpcomingCount).toHaveBeenCalledWith(
        1,
        5,
        null,
        null,
      );
      expect(result.count).toBe(7);
    });
  });
});
