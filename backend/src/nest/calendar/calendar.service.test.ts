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
import type { ScopeService } from '../hierarchy-permission/scope.service.js';
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
  mockScope: { getScope: ReturnType<typeof vi.fn> };
} {
  const mockDb = { query: vi.fn() };
  const mockActivityLogger = {
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  };
  const mockPermission = {
    getUserMemberships: vi.fn().mockResolvedValue({
      departmentIds: [],
      teamIds: [],
    }),
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
  const mockScope = {
    getScope: vi.fn().mockResolvedValue({
      type: 'none',
      areaIds: [],
      departmentIds: [],
      teamIds: [],
      leadAreaIds: [],
      leadDepartmentIds: [],
      leadTeamIds: [],
      isAreaLead: false,
      isDepartmentLead: false,
      isTeamLead: false,
      isAnyLead: false,
    }),
  };

  const service = new CalendarService(
    mockDb as unknown as DatabaseService,
    mockActivityLogger as unknown as ActivityLoggerService,
    mockPermission as unknown as CalendarPermissionService,
    mockCreation as unknown as CalendarCreationService,
    mockOverview as unknown as CalendarOverviewService,
    mockScope as unknown as ScopeService,
  );

  return {
    service,
    mockDb,
    mockActivityLogger,
    mockPermission,
    mockCreation,
    mockOverview,
    mockScope,
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

    it('transforms startTime and endTime to Date objects', () => {
      const fields = service['getEventFieldMappings'](false);
      const startField = fields.find((f) => f.key === 'startTime');
      const endField = fields.find((f) => f.key === 'endTime');

      const startResult = startField?.transform?.('2026-03-14T10:00:00Z');
      const endResult = endField?.transform?.('2026-03-14T12:00:00Z');

      expect(startResult).toBeInstanceOf(Date);
      expect(endResult).toBeInstanceOf(Date);
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
  let mockCreation: Record<string, ReturnType<typeof vi.fn>>;
  let mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockOverview: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockPermission = result.mockPermission;
    mockCreation = result.mockCreation;
    mockActivityLogger = result.mockActivityLogger;
    mockOverview = result.mockOverview;
  });

  describe('getEventById', () => {
    it('throws NotFoundException when event does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // SELECT event

      await expect(service.getEventById(999, 1, 1)).rejects.toThrow(NotFoundException);
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
      mockPermission.checkEventAccess.mockResolvedValueOnce(false);

      await expect(service.getEventById(1, 1, 5)).rejects.toThrow(NotFoundException);
    });

    it('returns event with attendees on happy path', async () => {
      const now = new Date();
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          uuid: 'evt-uuid',
          title: 'Team Meeting',
          user_id: 5,
          tenant_id: 1,
          start_date: now,
          end_date: now,
          all_day: 0,
          is_private: 0,
          status: 'confirmed',
          org_level: 'company',
          department_id: null,
          team_id: null,
          area_id: null,
          allow_attendees: 1,
          created_at: now,
          updated_at: now,
        },
      ]);
      mockPermission.checkEventAccess.mockResolvedValueOnce(true);
      mockPermission.getEventAttendees.mockResolvedValueOnce([
        {
          user_id: 10,
          username: 'john',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@test.de',
          profile_picture: null,
        },
      ]);

      const result = await service.getEventById(1, 1, 5);

      expect(result).toHaveProperty('title', 'Team Meeting');
      expect(result).toHaveProperty('attendees');
      const attendees = result['attendees'] as unknown[];
      expect(attendees).toHaveLength(1);
      expect(mockPermission.getEventAttendees).toHaveBeenCalledWith(1, 1);
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
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          title: 'Event',
          user_id: 99, // owned by user 99
          tenant_id: 1,
          start_date: new Date(),
          end_date: tomorrow,
        },
      ]);

      await expect(
        service.updateEvent(1, { title: 'New' } as never, 1, 5, 'employee'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for past events', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          title: 'Past Event',
          user_id: 5,
          tenant_id: 1,
          start_date: yesterday,
          end_date: yesterday,
        },
      ]);

      await expect(
        service.updateEvent(1, { title: 'New' } as never, 1, 5, 'admin'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates future event as admin and logs activity', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const now = new Date();

      // SELECT existing event
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          uuid: 'evt-uuid',
          title: 'Original',
          user_id: 5,
          tenant_id: 1,
          start_date: now,
          end_date: tomorrow,
          all_day: 0,
          is_private: 0,
          status: 'confirmed',
          org_level: 'company',
          department_id: null,
          team_id: null,
          area_id: null,
          allow_attendees: 1,
          created_at: now,
          updated_at: now,
        },
      ]);
      // UPDATE query
      mockDb.query.mockResolvedValueOnce([]);
      // getEventById → SELECT event
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          uuid: 'evt-uuid',
          title: 'Updated',
          user_id: 5,
          tenant_id: 1,
          start_date: now,
          end_date: tomorrow,
          all_day: 0,
          is_private: 0,
          status: 'confirmed',
          org_level: 'company',
          department_id: null,
          team_id: null,
          area_id: null,
          allow_attendees: 1,
          created_at: now,
          updated_at: now,
        },
      ]);
      mockPermission.checkEventAccess.mockResolvedValueOnce(true);
      mockPermission.getEventAttendees.mockResolvedValueOnce([]);
      mockActivityLogger.logUpdate.mockResolvedValueOnce(undefined);

      const result = await service.updateEvent(1, { title: 'Updated' } as never, 1, 5, 'admin');

      expect(result).toHaveProperty('title', 'Updated');
      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        1,
        5,
        'calendar',
        1,
        expect.any(String),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('deleteEvent', () => {
    it('throws NotFoundException when event does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // SELECT

      await expect(service.deleteEvent(999, 1, 1, 'admin')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for non-owner non-admin', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          title: 'Event',
          user_id: 99,
          tenant_id: 1,
          start_date: new Date(),
          end_date: tomorrow,
        },
      ]);

      await expect(service.deleteEvent(1, 1, 5, 'employee')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when deleting past event', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          title: 'Past Event',
          user_id: 5,
          tenant_id: 1,
          start_date: yesterday,
          end_date: yesterday,
        },
      ]);

      await expect(service.deleteEvent(1, 1, 5, 'admin')).rejects.toThrow(ForbiddenException);
    });

    it('allows root user to delete event owned by another user', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      mockDb.query
        .mockResolvedValueOnce([
          {
            id: 1,
            title: 'Other User Event',
            user_id: 99, // owned by another user
            tenant_id: 1,
            start_date: new Date(),
            end_date: tomorrow,
          },
        ])
        .mockResolvedValueOnce([]) // DELETE attendees
        .mockResolvedValueOnce([]); // DELETE event
      mockActivityLogger.logDelete.mockResolvedValueOnce(undefined);

      const result = await service.deleteEvent(1, 1, 5, 'root');

      expect(result.message).toBe('Event deleted successfully');
    });

    it('deletes future event and attendees for admin', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      mockDb.query
        .mockResolvedValueOnce([
          {
            id: 1,
            title: 'Future Event',
            user_id: 5,
            tenant_id: 1,
            start_date: new Date(),
            end_date: tomorrow,
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

    it('creates event with attendees and returns result', async () => {
      const now = new Date();
      const later = new Date(now.getTime() + 3600000);

      mockCreation.insertEvent.mockResolvedValueOnce(42);
      mockCreation.addAttendeesToEvent.mockResolvedValueOnce(undefined);
      mockCreation.createChildEvents.mockResolvedValueOnce(undefined);
      mockCreation.logEventCreated.mockResolvedValueOnce(undefined);

      // getEventById called at the end → SELECT event + access check + attendees
      mockDb.query.mockResolvedValueOnce([
        {
          id: 42,
          uuid: 'new-uuid',
          title: 'New Event',
          user_id: 5,
          tenant_id: 1,
          start_date: now,
          end_date: later,
          all_day: 0,
          is_private: 0,
          status: 'confirmed',
          org_level: 'company',
          department_id: null,
          team_id: null,
          area_id: null,
          allow_attendees: 1,
          created_at: now,
          updated_at: now,
        },
      ]);
      mockPermission.checkEventAccess.mockResolvedValueOnce(true);
      mockPermission.getEventAttendees.mockResolvedValueOnce([]);

      const result = await service.createEvent(
        {
          title: 'New Event',
          startTime: now.toISOString(),
          endTime: later.toISOString(),
          attendeeIds: [10, 20],
        } as never,
        1,
        5,
      );

      expect(result).toHaveProperty('title', 'New Event');
      expect(mockCreation.insertEvent).toHaveBeenCalledOnce();
      expect(mockCreation.addAttendeesToEvent).toHaveBeenCalledWith(42, 5, [10, 20], 1);
      expect(mockCreation.createChildEvents).toHaveBeenCalledOnce();
      expect(mockCreation.logEventCreated).toHaveBeenCalledOnce();
    });
  });

  describe('countEvents (private)', () => {
    it('should default to 0 when COUNT returns no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service['countEvents']('SELECT COUNT(*) as count FROM x', []);

      expect(result).toBe(0);
    });
  });

  describe('resolveEventIdByUuid', () => {
    it('throws NotFoundException when UUID not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service['resolveEventIdByUuid']('non-existent-uuid', 1)).rejects.toThrow(
        NotFoundException,
      );
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

  describe('getRecentlyAddedEvents – delegation', () => {
    it('delegates to overview service', async () => {
      mockOverview.getRecentlyAddedEvents.mockResolvedValueOnce([{ title: 'Recent' }]);

      const result = await service.getRecentlyAddedEvents(1, 5, 3);

      expect(mockOverview.getRecentlyAddedEvents).toHaveBeenCalledWith(1, 5, 3);
      expect(result).toHaveLength(1);
    });
  });

  describe('getUpcomingCount – delegation', () => {
    it('delegates to overview service', async () => {
      mockOverview.getUpcomingCount.mockResolvedValueOnce({ count: 7 });

      const result = await service.getUpcomingCount(1, 5, null, null);

      expect(mockOverview.getUpcomingCount).toHaveBeenCalledWith(1, 5, null, null);
      expect(result.count).toBe(7);
    });
  });

  describe('listEvents', () => {
    it('returns paginated events for full-scope user', async () => {
      const now = new Date();
      const mockScope = {
        getScope: vi.fn().mockResolvedValue({ type: 'full' }),
      };
      const { service: svc, mockDb: db, mockPermission: perm } = createServiceWithMock();
      // Override scope mock
      Object.assign(svc, { scopeService: mockScope });

      perm.getUserMemberships.mockResolvedValueOnce({
        departmentIds: [],
        teamIds: [],
      });
      perm.buildAdminOrgLevelFilter.mockReturnValueOnce({
        clause: '',
        newParams: [],
        newIndex: 3,
      });

      // COUNT query
      db.query.mockResolvedValueOnce([{ count: '2' }]);
      // SELECT events
      db.query.mockResolvedValueOnce([
        {
          id: 1,
          uuid: 'u1',
          title: 'Event 1',
          user_id: 5,
          tenant_id: 1,
          start_date: now,
          end_date: now,
          all_day: 0,
          is_private: 0,
          status: 'confirmed',
          org_level: 'company',
          department_id: null,
          team_id: null,
          area_id: null,
          allow_attendees: 0,
          created_at: now,
          updated_at: now,
        },
        {
          id: 2,
          uuid: 'u2',
          title: 'Event 2',
          user_id: 5,
          tenant_id: 1,
          start_date: now,
          end_date: now,
          all_day: 0,
          is_private: 0,
          status: 'confirmed',
          org_level: 'company',
          department_id: null,
          team_id: null,
          area_id: null,
          allow_attendees: 0,
          created_at: now,
          updated_at: now,
        },
      ]);

      const result = await svc.listEvents(1, 5, null, null, {
        status: undefined,
        filter: undefined,
        search: undefined,
        startDate: undefined,
        endDate: undefined,
        page: 1,
        limit: 20,
        sortBy: undefined,
        sortOrder: undefined,
      });

      expect(result.events).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('uses permission-based filter for non-full scope', async () => {
      const mockScope = {
        getScope: vi.fn().mockResolvedValue({
          type: 'limited',
          areaIds: [1],
          departmentIds: [2],
          teamIds: [3],
        }),
      };
      const { service: svc, mockDb: db, mockPermission: perm } = createServiceWithMock();
      Object.assign(svc, { scopeService: mockScope });

      perm.getUserMemberships.mockResolvedValueOnce({
        departmentIds: [2],
        teamIds: [3],
      });
      perm.buildPermissionBasedFilter.mockReturnValueOnce({
        clause: ' AND e.id > 0',
        newParams: [],
        newIndex: 3,
      });

      db.query.mockResolvedValueOnce([{ count: '0' }]);
      db.query.mockResolvedValueOnce([]);

      const result = await svc.listEvents(1, 5, null, null, {
        status: 'cancelled',
        filter: 'my',
        search: undefined,
        startDate: undefined,
        endDate: undefined,
        page: undefined,
        limit: undefined,
        sortBy: 'title',
        sortOrder: 'DESC',
      });

      expect(result.events).toHaveLength(0);
      expect(perm.buildPermissionBasedFilter).toHaveBeenCalledOnce();
    });
  });

  describe('exportEvents', () => {
    it('returns ICS export string', async () => {
      const now = new Date();
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          uuid: 'u1',
          title: 'Export Event',
          user_id: 5,
          tenant_id: 1,
          start_date: now,
          end_date: now,
          all_day: 0,
          is_private: 0,
          status: 'confirmed',
          org_level: 'company',
          department_id: null,
          team_id: null,
          area_id: null,
          allow_attendees: 0,
          created_at: now,
          updated_at: now,
        },
      ]);

      const result = await service.exportEvents(1, 5, null, 'ics');

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('Export Event');
    });

    it('returns CSV export string', async () => {
      const now = new Date();
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          uuid: 'u1',
          title: 'CSV Event',
          user_id: 5,
          tenant_id: 1,
          start_date: now,
          end_date: now,
          all_day: 0,
          is_private: 0,
          status: 'confirmed',
          org_level: 'company',
          department_id: null,
          team_id: null,
          area_id: null,
          allow_attendees: 0,
          created_at: now,
          updated_at: now,
          creator_name: 'admin',
        },
      ]);

      const result = await service.exportEvents(1, 5, null, 'csv');

      expect(result).toContain('CSV Event');
    });
  });

  describe('UUID-based delegation methods', () => {
    it('getEventByUuid resolves UUID and delegates', async () => {
      const now = new Date();
      // resolveEventIdByUuid query
      mockDb.query.mockResolvedValueOnce([{ id: 10 }]);
      // getEventById query
      mockDb.query.mockResolvedValueOnce([
        {
          id: 10,
          uuid: 'test-uuid',
          title: 'UUID Event',
          user_id: 5,
          tenant_id: 1,
          start_date: now,
          end_date: now,
          all_day: 0,
          is_private: 0,
          status: 'confirmed',
          org_level: 'company',
          department_id: null,
          team_id: null,
          area_id: null,
          allow_attendees: 0,
          created_at: now,
          updated_at: now,
        },
      ]);
      mockPermission.checkEventAccess.mockResolvedValueOnce(true);
      mockPermission.getEventAttendees.mockResolvedValueOnce([]);

      const result = await service.getEventByUuid('test-uuid', 1, 5);

      expect(result).toHaveProperty('title', 'UUID Event');
    });

    it('updateEventByUuid resolves UUID and delegates', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const now = new Date();

      // resolveEventIdByUuid
      mockDb.query.mockResolvedValueOnce([{ id: 10 }]);
      // updateEvent → SELECT existing
      mockDb.query.mockResolvedValueOnce([
        {
          id: 10,
          uuid: 'test-uuid',
          title: 'Original',
          user_id: 5,
          tenant_id: 1,
          start_date: now,
          end_date: tomorrow,
          all_day: 0,
          is_private: 0,
          status: 'confirmed',
          org_level: 'company',
          department_id: null,
          team_id: null,
          area_id: null,
          allow_attendees: 0,
          created_at: now,
          updated_at: now,
        },
      ]);
      // UPDATE
      mockDb.query.mockResolvedValueOnce([]);
      // getEventById at end
      mockDb.query.mockResolvedValueOnce([
        {
          id: 10,
          uuid: 'test-uuid',
          title: 'Via UUID',
          user_id: 5,
          tenant_id: 1,
          start_date: now,
          end_date: tomorrow,
          all_day: 0,
          is_private: 0,
          status: 'confirmed',
          org_level: 'company',
          department_id: null,
          team_id: null,
          area_id: null,
          allow_attendees: 0,
          created_at: now,
          updated_at: now,
        },
      ]);
      mockPermission.checkEventAccess.mockResolvedValueOnce(true);
      mockPermission.getEventAttendees.mockResolvedValueOnce([]);
      mockActivityLogger.logUpdate.mockResolvedValueOnce(undefined);

      const result = await service.updateEventByUuid(
        'test-uuid',
        { title: 'Via UUID' } as never,
        1,
        5,
        'admin',
      );

      expect(result).toHaveProperty('title', 'Via UUID');
    });

    it('deleteEventByUuid resolves UUID and delegates', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // resolveEventIdByUuid
      mockDb.query.mockResolvedValueOnce([{ id: 10 }]);
      // deleteEvent → SELECT
      mockDb.query.mockResolvedValueOnce([
        {
          id: 10,
          title: 'Delete Me',
          user_id: 5,
          tenant_id: 1,
          start_date: new Date(),
          end_date: tomorrow,
        },
      ]);
      // DELETE attendees
      mockDb.query.mockResolvedValueOnce([]);
      // DELETE event
      mockDb.query.mockResolvedValueOnce([]);
      mockActivityLogger.logDelete.mockResolvedValueOnce(undefined);

      const result = await service.deleteEventByUuid('test-uuid', 1, 5, 'admin');

      expect(result.message).toBe('Event deleted successfully');
    });
  });
});
