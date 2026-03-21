/**
 * Unit tests for HierarchyPermissionService
 *
 * Phase 13 Batch C (C2): hasAccess flow + getAccessible*Ids.
 * Migrated from services/ — uses DI bypass pattern (no vi.mock).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { HierarchyPermissionService } from './hierarchy-permission.service.js';

// ============================================
// Mock Setup — DI bypass pattern
// ============================================

const mockDb = {
  query: vi.fn(),
} as unknown as DatabaseService;

let service: HierarchyPermissionService;

beforeEach(() => {
  vi.resetAllMocks();
  service = new HierarchyPermissionService(mockDb);
});

// ============================================
// Helpers
// ============================================

/** Mock db.query to return rows (DatabaseService.query returns T[] directly) */
function mockQueryReturn(rows: unknown[]) {
  (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rows);
}

/** Shortcut for mocking user query (always the first query in hasAccess) */
function mockUser(role: string, hasFullAccess: boolean) {
  mockQueryReturn([{ id: 1, role, has_full_access: hasFullAccess }]);
}

/** Mock user not found */
function mockUserNotFound() {
  mockQueryReturn([]);
}

// ============================================
// hasAccess — Core Flow
// ============================================

describe('SECURITY: hasAccess', () => {
  it('should return false when user not found', async () => {
    mockUserNotFound();

    const result = await service.hasAccess(999, 1, 'area', 1);

    expect(result).toBe(false);
  });

  it('should return true for root user', async () => {
    mockUser('root', false);

    const result = await service.hasAccess(1, 1, 'area', 1);

    expect(result).toBe(true);
  });

  it('should return true for user with has_full_access', async () => {
    mockUser('admin', true);

    const result = await service.hasAccess(1, 1, 'department', 5);

    expect(result).toBe(true);
  });

  it('should return false for unknown resource type', async () => {
    mockUser('employee', false);

    const result = await service.hasAccess(1, 1, 'unknown' as never, 1);

    expect(result).toBe(false);
  });

  it('should return false on error', async () => {
    (mockDb.query as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB down'));

    const result = await service.hasAccess(1, 1, 'area', 1);

    expect(result).toBe(false);
  });

  it('should default permission to read', async () => {
    mockUser('employee', false);
    // Area permission check: can_read=true
    mockQueryReturn([{ can_read: true, can_write: false, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'area', 1);

    expect(result).toBe(true);
  });
});

// ============================================
// hasAccess — Area Access
// ============================================

describe('SECURITY: hasAccess — area', () => {
  it('should grant access when user has area permission with read', async () => {
    mockUser('admin', false);
    mockQueryReturn([{ can_read: true, can_write: false, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'area', 10, 'read');

    expect(result).toBe(true);
  });

  it('should deny access when user has no area permission', async () => {
    mockUser('admin', false);
    mockQueryReturn([]);

    const result = await service.hasAccess(1, 1, 'area', 10, 'write');

    expect(result).toBe(false);
  });

  it('should deny access when permission level insufficient', async () => {
    mockUser('admin', false);
    mockQueryReturn([{ can_read: true, can_write: false, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'area', 10, 'delete');

    expect(result).toBe(false);
  });
});

// ============================================
// hasAccess — Department Access (with Area inheritance)
// ============================================

describe('SECURITY: hasAccess — department', () => {
  it('should grant access with direct department permission', async () => {
    mockUser('admin', false);
    // Direct dept permission
    mockQueryReturn([{ can_read: true, can_write: true, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'department', 5, 'write');

    expect(result).toBe(true);
  });

  it('should inherit access from area when direct dept permission absent', async () => {
    mockUser('admin', false);
    // No direct dept permission
    mockQueryReturn([]);
    // Department info with area_id
    mockQueryReturn([{ id: 5, area_id: 3 }]);
    // Area permission check
    mockQueryReturn([{ can_read: true, can_write: false, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'department', 5, 'read');

    expect(result).toBe(true);
  });

  it('should deny when no dept permission and dept has no area', async () => {
    mockUser('admin', false);
    // No direct dept permission
    mockQueryReturn([]);
    // Department info with null area_id
    mockQueryReturn([{ id: 5, area_id: null }]);

    const result = await service.hasAccess(1, 1, 'department', 5, 'read');

    expect(result).toBe(false);
  });
});

// ============================================
// hasAccess — Team Access
// ============================================

describe('SECURITY: hasAccess — team', () => {
  it('should grant access when user is team member', async () => {
    mockUser('employee', false);
    // 1. isTeamMember — is a member
    mockQueryReturn([{ user_id: 1 }]);

    const result = await service.hasAccess(1, 1, 'team', 10);

    expect(result).toBe(true);
  });

  it('should deny when not team member and no dept inheritance', async () => {
    mockUser('employee', false);
    // 1. isTeamMember — not a member
    mockQueryReturn([]);
    // 2. getTeamInfo — team with null department_id
    mockQueryReturn([{ id: 10, department_id: null }]);

    const result = await service.hasAccess(1, 1, 'team', 10);

    expect(result).toBe(false);
  });
});

// ============================================
// hasAccess — team inheritance chain (team → dept → area)
// ============================================

describe('SECURITY: hasAccess — team inheritance chain', () => {
  it('should inherit from department when not team member', async () => {
    mockUser('employee', false);
    // 1. isTeamMember → not a member
    mockQueryReturn([]);
    // 2. getTeamInfo → team has department_id
    mockQueryReturn([{ id: 10, department_id: 5 }]);
    // 3. checkDepartmentAccess → direct dept permission exists
    mockQueryReturn([{ can_read: true, can_write: false, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'team', 10);

    expect(result).toBe(true);
  });

  it('should inherit from area when no team membership and no dept permission', async () => {
    mockUser('admin', false);
    // 1. isTeamMember → not a member
    mockQueryReturn([]);
    // 2. getTeamInfo → team has department_id=5
    mockQueryReturn([{ id: 10, department_id: 5 }]);
    // 3. checkDepartmentAccess → no direct dept permission
    mockQueryReturn([]);
    // 4. getDepartmentInfo → dept has area_id=3
    mockQueryReturn([{ id: 5, area_id: 3 }]);
    // 5. checkAreaAccess → area permission exists
    mockQueryReturn([{ can_read: true, can_write: false, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'team', 10);

    expect(result).toBe(true);
  });

  it('should deny when full chain yields no permission', async () => {
    mockUser('employee', false);
    // 1. isTeamMember → not a member
    mockQueryReturn([]);
    // 2. getTeamInfo → team has department_id=5
    mockQueryReturn([{ id: 10, department_id: 5 }]);
    // 3. checkDepartmentAccess → no direct dept permission
    mockQueryReturn([]);
    // 4. getDepartmentInfo → dept has area_id=3
    mockQueryReturn([{ id: 5, area_id: 3 }]);
    // 5. checkAreaAccess → no area permission either
    mockQueryReturn([]);

    const result = await service.hasAccess(1, 1, 'team', 10);

    expect(result).toBe(false);
  });
});

// ============================================
// Permission level enforcement
// ============================================

describe('SECURITY: permission level enforcement', () => {
  it('should deny write when user only has can_read on area', async () => {
    mockUser('admin', false);
    // Area permission: can_read=true, can_write=false
    mockQueryReturn([{ can_read: true, can_write: false, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'area', 10, 'write');

    expect(result).toBe(false);
  });

  it('should deny access for unknown permission level', async () => {
    mockUser('admin', false);
    mockQueryReturn([{ can_read: true, can_write: true, can_delete: true }]);

    const result = await service.hasAccess(1, 1, 'area', 10, 'unknown' as never);

    expect(result).toBe(false);
  });

  it('should deny delete when user has can_read + can_write but not can_delete', async () => {
    mockUser('admin', false);
    // Area permission: can_read=true, can_write=true, can_delete=false
    mockQueryReturn([{ can_read: true, can_write: true, can_delete: false }]);

    const result = await service.hasAccess(1, 1, 'area', 10, 'delete');

    expect(result).toBe(false);
  });
});

// ============================================
// getAccessibleAreaIds
// ============================================

describe('SECURITY: getAccessibleAreaIds', () => {
  it('should return all areas for root user', async () => {
    mockUser('root', false);
    mockQueryReturn([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const result = await service.getAccessibleAreaIds(1, 1);

    expect(result).toEqual([1, 2, 3]);
  });

  it('should return empty when user not found', async () => {
    mockUserNotFound();

    const result = await service.getAccessibleAreaIds(999, 1);

    expect(result).toEqual([]);
  });

  it('should return directly assigned areas for regular user', async () => {
    mockUser('admin', false);
    mockQueryReturn([{ area_id: 10 }, { area_id: 20 }]);

    const result = await service.getAccessibleAreaIds(1, 1);

    expect(result).toEqual([10, 20]);
  });
});

// ============================================
// getAccessibleDepartmentIds
// ============================================

describe('SECURITY: getAccessibleDepartmentIds', () => {
  it('should return all departments for root user', async () => {
    mockUser('root', false);
    mockQueryReturn([{ id: 1 }, { id: 2 }]);

    const result = await service.getAccessibleDepartmentIds(1, 1);

    expect(result).toEqual([1, 2]);
  });

  it('should return empty when user not found', async () => {
    mockUserNotFound();

    const result = await service.getAccessibleDepartmentIds(999, 1);

    expect(result).toEqual([]);
  });

  it('should combine direct + inherited departments', async () => {
    mockUser('admin', false);
    // Direct department permissions
    mockQueryReturn([{ department_id: 10 }]);
    // getAccessibleAreaIds flow: getUserInfo (again)
    mockUser('admin', false);
    // getAccessibleAreaIds: area permissions
    mockQueryReturn([{ area_id: 5 }]);
    // Inherited departments from area
    mockQueryReturn([{ id: 20 }]);

    const result = await service.getAccessibleDepartmentIds(1, 1);

    expect(result).toContain(10);
    expect(result).toContain(20);
  });
});

// ============================================
// getAccessibleTeamIds
// ============================================

describe('SECURITY: getAccessibleTeamIds', () => {
  it('should return all teams for user with full access', async () => {
    mockUser('admin', true);
    mockQueryReturn([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const result = await service.getAccessibleTeamIds(1, 1);

    expect(result).toEqual([1, 2, 3]);
  });

  it('should return empty when user not found', async () => {
    mockUserNotFound();

    const result = await service.getAccessibleTeamIds(999, 1);

    expect(result).toEqual([]);
  });

  it('should combine member teams + inherited teams for regular admin', async () => {
    mockUser('admin', false);
    // 1. user_teams (member teams)
    mockQueryReturn([{ team_id: 10 }]);
    // 2. getAccessibleDepartmentIds flow:
    //    getUserInfo (again)
    mockUser('admin', false);
    //    direct dept permissions
    mockQueryReturn([{ department_id: 5 }]);
    //    getAccessibleAreaIds flow: getUserInfo
    mockUser('admin', false);
    //    area permissions (none)
    mockQueryReturn([]);
    // 3. inherited teams from depts (dept 5 → team 20)
    mockQueryReturn([{ id: 20 }]);

    const result = await service.getAccessibleTeamIds(1, 1);

    expect(result).toContain(10);
    expect(result).toContain(20);
  });
});

// ============================================
// getScope — Organizational Scope Resolution
// ============================================

/** Mock CTE query result for getScope */
function mockScopeCte(row: {
  area_ids?: number[];
  department_ids?: number[];
  team_ids?: number[];
  lead_area_ids?: number[];
  lead_department_ids?: number[];
  lead_team_ids?: number[];
}) {
  mockQueryReturn([
    {
      area_ids: row.area_ids ?? [],
      department_ids: row.department_ids ?? [],
      team_ids: row.team_ids ?? [],
      lead_area_ids: row.lead_area_ids ?? [],
      lead_department_ids: row.lead_department_ids ?? [],
      lead_team_ids: row.lead_team_ids ?? [],
    },
  ]);
}

describe('SECURITY: getScope', () => {
  // Scenario 1: Root user
  it('should return full scope for root user', async () => {
    mockUser('root', false);
    const scope = await service.getScope(1, 1);
    expect(scope.type).toBe('full');
  });

  // Scenario 2: Admin with has_full_access
  it('should return full scope for admin with has_full_access', async () => {
    mockUser('admin', true);
    const scope = await service.getScope(1, 1);
    expect(scope.type).toBe('full');
  });

  // Scenario 3: Admin with area permissions → cascaded depts/teams
  it('should return limited scope with area permissions + cascade', async () => {
    mockUser('admin', false);
    mockScopeCte({
      area_ids: [1],
      department_ids: [10, 11],
      team_ids: [100, 101],
      lead_area_ids: [],
    });

    const scope = await service.getScope(1, 1);

    expect(scope.type).toBe('limited');
    expect(scope.areaIds).toEqual([1]);
    expect(scope.departmentIds).toEqual([10, 11]);
    expect(scope.teamIds).toEqual([100, 101]);
  });

  // Scenario 4: Admin as area_lead (no admin_area_permissions)
  it('should include lead area in scope', async () => {
    mockUser('admin', false);
    mockScopeCte({
      area_ids: [5],
      lead_area_ids: [5],
      department_ids: [50],
      team_ids: [500],
    });

    const scope = await service.getScope(1, 1);

    expect(scope.type).toBe('limited');
    expect(scope.areaIds).toEqual([5]);
    expect(scope.leadAreaIds).toEqual([5]);
    expect(scope.isAreaLead).toBe(true);
  });

  // Scenario 5: Admin with dept permissions → cascaded teams
  it('should return limited scope with dept permissions', async () => {
    mockUser('admin', false);
    mockScopeCte({ department_ids: [10], team_ids: [100, 101] });

    const scope = await service.getScope(1, 1);

    expect(scope.type).toBe('limited');
    expect(scope.areaIds).toEqual([]);
    expect(scope.departmentIds).toEqual([10]);
    expect(scope.teamIds).toEqual([100, 101]);
  });

  // Scenario 6: Admin as department_lead
  it('should include lead department in scope', async () => {
    mockUser('admin', false);
    mockScopeCte({
      department_ids: [20],
      lead_department_ids: [20],
      team_ids: [200],
    });

    const scope = await service.getScope(1, 1);

    expect(scope.leadDepartmentIds).toEqual([20]);
    expect(scope.isDepartmentLead).toBe(true);
  });

  // Scenario 7: Admin as team_lead only
  it('should return only team scope for team lead admin', async () => {
    mockUser('admin', false);
    mockScopeCte({ team_ids: [300], lead_team_ids: [300] });

    const scope = await service.getScope(1, 1);

    expect(scope.type).toBe('limited');
    expect(scope.areaIds).toEqual([]);
    expect(scope.departmentIds).toEqual([]);
    expect(scope.teamIds).toEqual([300]);
    expect(scope.isTeamLead).toBe(true);
  });

  // Scenario 8: Admin without permissions and not a lead
  it('should return limited scope with empty arrays for admin without perms', async () => {
    mockUser('admin', false);
    mockScopeCte({});

    const scope = await service.getScope(1, 1);

    expect(scope.type).toBe('limited');
    expect(scope.areaIds).toEqual([]);
    expect(scope.departmentIds).toEqual([]);
    expect(scope.teamIds).toEqual([]);
    expect(scope.isAnyLead).toBe(false);
  });

  // Scenario 9: Employee as team_lead
  it('should return limited scope for employee team lead', async () => {
    mockUser('employee', false);
    mockScopeCte({ team_ids: [268], lead_team_ids: [268] });

    const scope = await service.getScope(106, 3);

    expect(scope.type).toBe('limited');
    expect(scope.teamIds).toEqual([268]);
    expect(scope.isTeamLead).toBe(true);
    expect(scope.isAnyLead).toBe(true);
  });

  // Scenario 10: Employee as team_deputy_lead (same behavior as team_lead, DEPUTY_EQUALS_LEAD)
  it('should return limited scope for employee team deputy lead', async () => {
    mockUser('employee', false);
    mockScopeCte({ team_ids: [268], lead_team_ids: [268] });

    const scope = await service.getScope(107, 3);

    expect(scope.type).toBe('limited');
    expect(scope.teamIds).toEqual([268]);
    expect(scope.isTeamLead).toBe(true);
  });

  // Scenario 10b: Admin as area_deputy_lead (DEPUTY_EQUALS_LEAD — CTE includes area via OR clause)
  it('should return limited scope for admin area deputy lead', async () => {
    mockUser('admin', false);
    mockScopeCte({
      area_ids: [5],
      lead_area_ids: [5],
      department_ids: [10, 11],
      team_ids: [20, 21],
    });

    const scope = await service.getScope(42, 3);

    expect(scope.type).toBe('limited');
    expect(scope.areaIds).toEqual([5]);
    expect(scope.isAreaLead).toBe(true);
    expect(scope.departmentIds).toEqual([10, 11]);
  });

  // Scenario 10c: Admin as department_deputy_lead (DEPUTY_EQUALS_LEAD)
  it('should return limited scope for admin department deputy lead', async () => {
    mockUser('admin', false);
    mockScopeCte({ department_ids: [15], lead_department_ids: [15], team_ids: [30] });

    const scope = await service.getScope(55, 3);

    expect(scope.type).toBe('limited');
    expect(scope.departmentIds).toEqual([15]);
    expect(scope.isDepartmentLead).toBe(true);
    expect(scope.teamIds).toEqual([30]);
  });

  // Scenario 11: Employee without lead position
  it('should return none scope for employee without lead', async () => {
    mockUser('employee', false);
    mockScopeCte({});

    const scope = await service.getScope(200, 3);

    expect(scope.type).toBe('none');
  });

  // Scenario 12: Dummy user
  it('should return none scope for dummy user', async () => {
    mockUser('dummy', false);

    const scope = await service.getScope(300, 1);

    expect(scope.type).toBe('none');
  });

  // Scenario 13: User not found
  it('should return none scope for user not found', async () => {
    mockUserNotFound();

    const scope = await service.getScope(999, 1);

    expect(scope.type).toBe('none');
  });

  // Scenario 14: CTE returns empty row (edge case)
  it('should return none for employee when CTE returns no rows', async () => {
    mockUser('employee', false);
    mockQueryReturn([]);

    const scope = await service.getScope(1, 1);

    expect(scope.type).toBe('none');
  });
});

// ============================================
// getVisibleUserIds
// ============================================

describe('SECURITY: getVisibleUserIds', () => {
  it('should return all for full scope', async () => {
    const result = await service.getVisibleUserIds(
      {
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
      },
      1,
    );
    expect(result).toBe('all');
  });

  it('should return empty array for none scope', async () => {
    const result = await service.getVisibleUserIds(
      {
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
      },
      1,
    );
    expect(result).toEqual([]);
  });

  it('should return empty when dept+team IDs are empty', async () => {
    const result = await service.getVisibleUserIds(
      {
        type: 'limited',
        areaIds: [1],
        departmentIds: [],
        teamIds: [],
        leadAreaIds: [],
        leadDepartmentIds: [],
        leadTeamIds: [],
        isAreaLead: false,
        isDepartmentLead: false,
        isTeamLead: false,
        isAnyLead: false,
      },
      1,
    );
    expect(result).toEqual([]);
  });

  it('should query users by dept+team IDs', async () => {
    mockQueryReturn([{ id: 10 }, { id: 20 }, { id: 30 }]);

    const result = await service.getVisibleUserIds(
      {
        type: 'limited',
        areaIds: [],
        departmentIds: [5],
        teamIds: [100],
        leadAreaIds: [],
        leadDepartmentIds: [],
        leadTeamIds: [],
        isAreaLead: false,
        isDepartmentLead: false,
        isTeamLead: false,
        isAnyLead: false,
      },
      1,
    );

    expect(result).toEqual([10, 20, 30]);
  });
});

// ============================================
// isEntityInScope (static)
// ============================================

describe('SECURITY: isEntityInScope', () => {
  it('should return true for full scope', () => {
    const result = HierarchyPermissionService.isEntityInScope(
      {
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
      },
      'team',
      999,
    );
    expect(result).toBe(true);
  });

  it('should return false for none scope', () => {
    const result = HierarchyPermissionService.isEntityInScope(
      {
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
      },
      'area',
      1,
    );
    expect(result).toBe(false);
  });

  it('should return true when entity is in scope', () => {
    const result = HierarchyPermissionService.isEntityInScope(
      {
        type: 'limited',
        areaIds: [1, 2],
        departmentIds: [10],
        teamIds: [100],
        leadAreaIds: [],
        leadDepartmentIds: [],
        leadTeamIds: [],
        isAreaLead: false,
        isDepartmentLead: false,
        isTeamLead: false,
        isAnyLead: false,
      },
      'area',
      2,
    );
    expect(result).toBe(true);
  });

  it('should return false when entity is not in scope', () => {
    const result = HierarchyPermissionService.isEntityInScope(
      {
        type: 'limited',
        areaIds: [1],
        departmentIds: [10],
        teamIds: [100],
        leadAreaIds: [],
        leadDepartmentIds: [],
        leadTeamIds: [],
        isAreaLead: false,
        isDepartmentLead: false,
        isTeamLead: false,
        isAnyLead: false,
      },
      'department',
      99,
    );
    expect(result).toBe(false);
  });

  it('should return false for unknown entity type', () => {
    const scope = {
      type: 'limited' as const,
      areaIds: [1],
      departmentIds: [10],
      teamIds: [100],
      leadAreaIds: [],
      leadDepartmentIds: [],
      leadTeamIds: [],
      isAreaLead: false,
      isDepartmentLead: false,
      isTeamLead: false,
      isAnyLead: false,
    };
    const result = HierarchyPermissionService.isEntityInScope(scope, 'unknown' as never, 1);
    expect(result).toBe(false);
  });

  it('should check correct entity type', () => {
    const scope = {
      type: 'limited' as const,
      areaIds: [1],
      departmentIds: [10],
      teamIds: [100],
      leadAreaIds: [],
      leadDepartmentIds: [],
      leadTeamIds: [],
      isAreaLead: false,
      isDepartmentLead: false,
      isTeamLead: false,
      isAnyLead: false,
    };
    expect(HierarchyPermissionService.isEntityInScope(scope, 'area', 1)).toBe(true);
    expect(HierarchyPermissionService.isEntityInScope(scope, 'department', 10)).toBe(true);
    expect(HierarchyPermissionService.isEntityInScope(scope, 'team', 100)).toBe(true);
    expect(HierarchyPermissionService.isEntityInScope(scope, 'area', 10)).toBe(false);
  });
});
