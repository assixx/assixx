/**
 * Unit tests for CalendarOverviewService
 *
 * Scope + Memberships based visibility (post-refactoring).
 * Focus: Dashboard events, recently added events, upcoming count
 *        with scope branching (full vs limited/none).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AddonVisitsService } from '../addon-visits/addon-visits.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { OrganizationalScope } from '../hierarchy-permission/organizational-scope.types.js';
import type { ScopeService } from '../hierarchy-permission/scope.service.js';
import { CalendarOverviewService } from './calendar-overview.service.js';
import type { CalendarPermissionService } from './calendar-permission.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./calendar.helpers.js', () => ({
  buildVisibilityClause: vi.fn().mockReturnValue({
    clause: '(mocked_visibility)',
    params: [[0], [0], [0], 1],
  }),
  dbToApiEvent: vi.fn((row: Record<string, unknown>) => ({
    id: row['id'],
    title: row['title'],
    startDate: row['start_date'],
  })),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb(): {
  query: ReturnType<typeof vi.fn>;
  tenantQuery: ReturnType<typeof vi.fn>;
} {
  const qf = vi.fn();
  return { query: qf, tenantQuery: qf };
}

function createMockAddonVisits(): {
  getLastVisited: ReturnType<typeof vi.fn>;
} {
  return { getLastVisited: vi.fn() };
}

function createMockPermissionService(): {
  getUserMemberships: ReturnType<typeof vi.fn>;
} {
  return {
    getUserMemberships: vi.fn().mockResolvedValue({
      departmentIds: [3],
      teamIds: [7],
    }),
  };
}

function createMockScopeService(scopeType: 'full' | 'limited' | 'none' = 'none'): {
  getScope: ReturnType<typeof vi.fn>;
} {
  const scope: OrganizationalScope = {
    type: scopeType,
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
  };
  return { getScope: vi.fn().mockResolvedValue(scope) };
}

// =============================================================
// CalendarOverviewService
// =============================================================

describe('CalendarOverviewService', () => {
  let service: CalendarOverviewService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockAddonVisits: ReturnType<typeof createMockAddonVisits>;
  let mockPermission: ReturnType<typeof createMockPermissionService>;
  let mockScope: ReturnType<typeof createMockScopeService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockAddonVisits = createMockAddonVisits();
    mockPermission = createMockPermissionService();
    mockScope = createMockScopeService('none');
    service = new CalendarOverviewService(
      mockDb as unknown as DatabaseService,
      mockAddonVisits as unknown as AddonVisitsService,
      mockPermission as unknown as CalendarPermissionService,
      mockScope as unknown as ScopeService,
    );
  });

  // =============================================================
  // getDashboardEvents
  // =============================================================

  describe('getDashboardEvents', () => {
    it('should return mapped events for employee', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1, title: 'Meeting', start_date: '2025-06-15' }]);

      const result = await service.getDashboardEvents(10, 5);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should use admin path for full-scope user', async () => {
      mockScope.getScope.mockResolvedValueOnce({
        type: 'full',
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
      });
      mockDb.query.mockResolvedValueOnce([]);

      await service.getDashboardEvents(10, 1);

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall?.[0]).toContain('org_level');
    });

    it('should use visibility clause for non-full scope', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getDashboardEvents(10, 5);

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall?.[0]).toContain('mocked_visibility');
    });
  });

  // =============================================================
  // getRecentlyAddedEvents
  // =============================================================

  describe('getRecentlyAddedEvents', () => {
    it('should return recently added events with limit', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 2, title: 'Workshop', start_date: '2025-07-01' },
        { id: 3, title: 'Standup', start_date: '2025-07-02' },
      ]);

      const result = await service.getRecentlyAddedEvents(10, 5, 3);

      expect(result).toHaveLength(2);
    });

    it('should use personal-event filter for full-scope user', async () => {
      mockScope.getScope.mockResolvedValueOnce({
        type: 'full',
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
      });
      mockDb.query.mockResolvedValueOnce([]);

      await service.getRecentlyAddedEvents(10, 1, 3);

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall?.[0]).toContain('org_level');
      expect(queryCall?.[0]).toContain('personal');
    });
  });

  // =============================================================
  // getUpcomingCount
  // =============================================================

  describe('getUpcomingCount', () => {
    it('should use full-access path for full scope', async () => {
      mockScope.getScope.mockResolvedValueOnce({
        type: 'full',
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
      });
      mockAddonVisits.getLastVisited.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce([{ count: '5' }]);

      const result = await service.getUpcomingCount(10, 1, null, null);

      expect(result.count).toBe(5);
    });

    it('should use permission-based path for non-full scope', async () => {
      mockAddonVisits.getLastVisited.mockResolvedValueOnce(new Date('2025-06-01'));
      // countUpcomingWithPermissions calls getScope + getUserMemberships + query
      mockScope.getScope.mockResolvedValueOnce({
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
      });
      mockDb.query.mockResolvedValueOnce([{ count: '2' }]);

      const result = await service.getUpcomingCount(10, 5, 3, 7);

      expect(result.count).toBe(2);
    });

    it('should default to epoch when no last visit', async () => {
      mockAddonVisits.getLastVisited.mockResolvedValueOnce(null);
      mockScope.getScope.mockResolvedValueOnce({
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
      });
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.getUpcomingCount(10, 5, null, null);

      expect(result.count).toBe(0);
    });

    it('should return 0 for scope=none with no memberships', async () => {
      mockAddonVisits.getLastVisited.mockResolvedValueOnce(null);
      mockScope.getScope.mockResolvedValueOnce({
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
      });
      mockPermission.getUserMemberships.mockResolvedValueOnce({
        departmentIds: [],
        teamIds: [],
      });

      const result = await service.getUpcomingCount(10, 5, null, null);

      expect(result.count).toBe(0);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });
});
