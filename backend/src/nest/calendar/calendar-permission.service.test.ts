/**
 * Unit tests for CalendarPermissionService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: getUserRole fallback, checkEventAccess (role/org/attendee),
 *        buildAdminOrgLevelFilter (pure), buildPermissionBasedFilter (pure).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { CalendarPermissionService } from './calendar-permission.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./calendar.helpers.js', () => ({
  buildVisibilityClause: vi
    .fn()
    .mockImplementation(
      (idx1: number, idx2: number) => `(visibility_$${idx1}_$${idx2})`,
    ),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    user_id: 5,
    org_level: 'company',
    department_id: null,
    team_id: null,
    ...overrides,
  };
}

function makeUserRole(overrides: Record<string, unknown> = {}) {
  return {
    role: 'employee',
    department_id: 3,
    team_id: 7,
    has_full_access: false,
    ...overrides,
  };
}

// =============================================================
// CalendarPermissionService
// =============================================================

describe('SECURITY: CalendarPermissionService', () => {
  let service: CalendarPermissionService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new CalendarPermissionService(
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // getUserRole
  // =============================================================

  describe('getUserRole', () => {
    it('should return user role info', async () => {
      mockDb.query.mockResolvedValueOnce([
        { role: 'admin', department_id: 1, team_id: 2, has_full_access: true },
      ]);

      const result = await service.getUserRole(5, 10);

      expect(result.role).toBe('admin');
      expect(result.has_full_access).toBe(true);
    });

    it('should return fallback when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getUserRole(999, 10);

      expect(result.role).toBeNull();
      expect(result.has_full_access).toBe(false);
    });
  });

  // =============================================================
  // checkEventAccess
  // =============================================================

  describe('checkEventAccess', () => {
    it('should allow admin access', async () => {
      const result = await service.checkEventAccess(
        makeEvent() as never,
        5,
        makeUserRole({ role: 'admin' }) as never,
      );

      expect(result).toBe(true);
    });

    it('should allow event creator access', async () => {
      const result = await service.checkEventAccess(
        makeEvent({ user_id: 5 }) as never,
        5,
        makeUserRole() as never,
      );

      expect(result).toBe(true);
    });

    it('should allow company event access', async () => {
      const result = await service.checkEventAccess(
        makeEvent({ org_level: 'company', user_id: 99 }) as never,
        5,
        makeUserRole() as never,
      );

      expect(result).toBe(true);
    });

    it('should allow department event for same department', async () => {
      const result = await service.checkEventAccess(
        makeEvent({
          org_level: 'department',
          department_id: 3,
          user_id: 99,
        }) as never,
        5,
        makeUserRole({ department_id: 3 }) as never,
      );

      expect(result).toBe(true);
    });

    it('should check attendees for other events', async () => {
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);

      const result = await service.checkEventAccess(
        makeEvent({
          org_level: 'personal',
          user_id: 99,
        }) as never,
        5,
        makeUserRole() as never,
      );

      expect(result).toBe(true);
    });

    it('should deny access when not attendee', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkEventAccess(
        makeEvent({
          org_level: 'personal',
          user_id: 99,
        }) as never,
        5,
        makeUserRole() as never,
      );

      expect(result).toBe(false);
    });
  });

  // =============================================================
  // getEventAttendees
  // =============================================================

  describe('getEventAttendees', () => {
    it('should return attendees list', async () => {
      mockDb.query.mockResolvedValueOnce([
        { user_id: 5, username: 'max', first_name: 'Max' },
      ]);

      const result = await service.getEventAttendees(1, 10);

      expect(result).toHaveLength(1);
    });
  });

  // =============================================================
  // buildAdminOrgLevelFilter (pure)
  // =============================================================

  describe('buildAdminOrgLevelFilter', () => {
    it('should handle company filter', () => {
      const result = service.buildAdminOrgLevelFilter('company', 5, 3);

      expect(result.clause).toContain("'company'");
      expect(result.newParams).toEqual([]);
      expect(result.newIndex).toBe(3);
    });

    it('should handle personal filter with userId param', () => {
      const result = service.buildAdminOrgLevelFilter('personal', 5, 3);

      expect(result.clause).toContain('$3');
      expect(result.newParams).toContain(5);
      expect(result.newIndex).toBe(4);
    });

    it('should handle default (all) filter', () => {
      const result = service.buildAdminOrgLevelFilter('all', 5, 3);

      expect(result.clause).toContain('org_level');
      expect(result.newParams).toContain(5);
    });
  });

  // =============================================================
  // buildPermissionBasedFilter (pure)
  // =============================================================

  describe('buildPermissionBasedFilter', () => {
    it('should include visibility clause and additional filter', () => {
      const result = service.buildPermissionBasedFilter('department', 5, 10, 3);

      expect(result.clause).toContain('visibility');
      expect(result.clause).toContain("'department'");
      expect(result.newParams).toEqual([5, 10]);
      expect(result.newIndex).toBe(5);
    });

    it('should omit additional filter for unknown type', () => {
      const result = service.buildPermissionBasedFilter('all', 5, 10, 3);

      expect(result.clause).toContain('visibility');
      expect(result.newIndex).toBe(5);
    });
  });
});
