/**
 * Unit tests for CalendarPermissionService
 *
 * Scope + Memberships based visibility (post-refactoring).
 * Focus: getUserMemberships, checkEventAccess (scope/membership/attendee),
 *        buildAdminOrgLevelFilter (pure), buildPermissionBasedFilter (scope-based).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { OrganizationalScope } from '../hierarchy-permission/organizational-scope.types.js';
import { CalendarPermissionService } from './calendar-permission.service.js';
import type { CalendarMemberships } from './calendar.types.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./calendar.helpers.js', () => ({
  buildVisibilityClause: vi.fn().mockReturnValue({
    clause: '(mocked_visibility)',
    params: [[0], [0], [0], 1],
  }),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn() };
}

function makeEvent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 1,
    user_id: 5,
    org_level: 'company',
    department_id: null,
    team_id: null,
    area_id: null,
    ...overrides,
  };
}

function makeScope(
  overrides: Partial<OrganizationalScope> = {},
): OrganizationalScope {
  return {
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
    ...overrides,
  };
}

function makeMemberships(
  overrides: Partial<CalendarMemberships> = {},
): CalendarMemberships {
  return {
    departmentIds: [3],
    teamIds: [7],
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
  // getUserMemberships
  // =============================================================

  describe('getUserMemberships', () => {
    it('should return department and team IDs', async () => {
      mockDb.query.mockResolvedValueOnce([
        { department_ids: [1, 2], team_ids: [3] },
      ]);

      const result = await service.getUserMemberships(5, 10);

      expect(result.departmentIds).toEqual([1, 2]);
      expect(result.teamIds).toEqual([3]);
    });

    it('should return empty arrays when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getUserMemberships(999, 10);

      expect(result.departmentIds).toEqual([]);
      expect(result.teamIds).toEqual([]);
    });

    it('should handle null arrays from DB (no memberships)', async () => {
      mockDb.query.mockResolvedValueOnce([
        { department_ids: null, team_ids: null },
      ]);

      const result = await service.getUserMemberships(5, 10);

      expect(result.departmentIds).toEqual([]);
      expect(result.teamIds).toEqual([]);
    });
  });

  // =============================================================
  // checkEventAccess
  // =============================================================

  describe('checkEventAccess', () => {
    it('should allow full-scope access', async () => {
      const result = await service.checkEventAccess(
        makeEvent({ user_id: 99 }) as never,
        5,
        makeScope({ type: 'full' }),
        makeMemberships(),
      );

      expect(result).toBe(true);
    });

    it('should allow event creator access', async () => {
      const result = await service.checkEventAccess(
        makeEvent({ user_id: 5 }) as never,
        5,
        makeScope(),
        makeMemberships(),
      );

      expect(result).toBe(true);
    });

    it('should allow company event access', async () => {
      const result = await service.checkEventAccess(
        makeEvent({ org_level: 'company', user_id: 99 }) as never,
        5,
        makeScope(),
        makeMemberships(),
      );

      expect(result).toBe(true);
    });

    it('should allow area event when area is in scope', async () => {
      const result = await service.checkEventAccess(
        makeEvent({ org_level: 'area', area_id: 10, user_id: 99 }) as never,
        5,
        makeScope({ areaIds: [10, 20] }),
        makeMemberships(),
      );

      expect(result).toBe(true);
    });

    it('should deny area event when area is NOT in scope', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no attendee

      const result = await service.checkEventAccess(
        makeEvent({ org_level: 'area', area_id: 99, user_id: 99 }) as never,
        5,
        makeScope({ areaIds: [10] }),
        makeMemberships(),
      );

      expect(result).toBe(false);
    });

    it('should allow department event via membership (no scope)', async () => {
      const result = await service.checkEventAccess(
        makeEvent({
          org_level: 'department',
          department_id: 3,
          user_id: 99,
        }) as never,
        5,
        makeScope(), // type: 'none', empty arrays
        makeMemberships({ departmentIds: [3, 8] }),
      );

      expect(result).toBe(true);
    });

    it('should allow department event via scope (no membership)', async () => {
      const result = await service.checkEventAccess(
        makeEvent({
          org_level: 'department',
          department_id: 30,
          user_id: 99,
        }) as never,
        5,
        makeScope({ departmentIds: [30] }),
        makeMemberships({ departmentIds: [] }),
      );

      expect(result).toBe(true);
    });

    it('should allow team event via membership (no scope)', async () => {
      const result = await service.checkEventAccess(
        makeEvent({ org_level: 'team', team_id: 7, user_id: 99 }) as never,
        5,
        makeScope(), // type: 'none'
        makeMemberships({ teamIds: [7, 12] }),
      );

      expect(result).toBe(true);
    });

    it('should deny team event for different team', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no attendee

      const result = await service.checkEventAccess(
        makeEvent({ org_level: 'team', team_id: 99, user_id: 99 }) as never,
        5,
        makeScope(),
        makeMemberships({ teamIds: [7, 12] }),
      );

      expect(result).toBe(false);
    });

    it('should allow access via attendee (overrides scope)', async () => {
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);

      const result = await service.checkEventAccess(
        makeEvent({ org_level: 'personal', user_id: 99 }) as never,
        5,
        makeScope(),
        makeMemberships({ departmentIds: [], teamIds: [] }),
      );

      expect(result).toBe(true);
    });

    it('should deny access when not attendee and out of scope', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkEventAccess(
        makeEvent({ org_level: 'personal', user_id: 99 }) as never,
        5,
        makeScope(),
        makeMemberships({ departmentIds: [], teamIds: [] }),
      );

      expect(result).toBe(false);
    });

    it('should merge scope + membership for visibility (UNION)', async () => {
      // Dept 30 from scope, dept 3 from membership — both should grant access
      const scope = makeScope({ departmentIds: [30] });
      const mem = makeMemberships({ departmentIds: [3] });

      const resultFromScope = await service.checkEventAccess(
        makeEvent({
          org_level: 'department',
          department_id: 30,
          user_id: 99,
        }) as never,
        5,
        scope,
        mem,
      );
      const resultFromMembership = await service.checkEventAccess(
        makeEvent({
          org_level: 'department',
          department_id: 3,
          user_id: 99,
        }) as never,
        5,
        scope,
        mem,
      );

      expect(resultFromScope).toBe(true);
      expect(resultFromMembership).toBe(true);
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
  // buildAdminOrgLevelFilter (pure — unchanged)
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

    it('should handle area filter', () => {
      const result = service.buildAdminOrgLevelFilter('area', 5, 3);

      expect(result.clause).toContain("'area'");
      expect(result.newParams).toEqual([]);
      expect(result.newIndex).toBe(3);
    });

    it('should handle department filter', () => {
      const result = service.buildAdminOrgLevelFilter('department', 5, 3);

      expect(result.clause).toContain("'department'");
      expect(result.newParams).toEqual([]);
      expect(result.newIndex).toBe(3);
    });

    it('should handle team filter', () => {
      const result = service.buildAdminOrgLevelFilter('team', 5, 3);

      expect(result.clause).toContain("'team'");
      expect(result.newParams).toEqual([]);
      expect(result.newIndex).toBe(3);
    });

    it('should handle default (all) filter', () => {
      const result = service.buildAdminOrgLevelFilter('all', 5, 3);

      expect(result.clause).toContain('org_level');
      expect(result.newParams).toContain(5);
    });
  });

  // =============================================================
  // buildPermissionBasedFilter (scope-based)
  // =============================================================

  describe('buildPermissionBasedFilter', () => {
    it('should include visibility clause and additional filter', () => {
      const result = service.buildPermissionBasedFilter(
        'department',
        makeScope(),
        makeMemberships(),
        5,
        3,
      );

      expect(result.clause).toContain('mocked_visibility');
      expect(result.clause).toContain("'department'");
      expect(result.newIndex).toBe(7); // startIdx 3 + 4 params
    });

    it('should omit additional filter for unknown type', () => {
      const result = service.buildPermissionBasedFilter(
        'all',
        makeScope(),
        makeMemberships(),
        5,
        3,
      );

      expect(result.clause).toContain('mocked_visibility');
      expect(result.newIndex).toBe(7);
    });
  });
});
