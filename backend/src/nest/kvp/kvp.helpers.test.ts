import { describe, expect, it } from 'vitest';

import {
  buildFilterConditions,
  buildStatusFilter,
  buildVisibilityClause,
  hasExtendedOrgAccess,
  isUuid,
  mapOrgLevelToRecipient,
} from './kvp.helpers.js';

// Factory for ExtendedUserOrgInfo test data
function createOrgInfo(
  overrides: Partial<Parameters<typeof hasExtendedOrgAccess>[2]> = {},
): Parameters<typeof hasExtendedOrgAccess>[2] {
  return {
    hasFullAccess: false,
    teamIds: [],
    teamLeadOf: [],
    departmentIds: [],
    teamsDepartmentIds: [],
    departmentLeadOf: [],
    areaIds: [],
    departmentsAreaIds: [],
    areaLeadOf: [],
    ...overrides,
  };
}

// =============================================================
// isUuid
// =============================================================

describe('isUuid', () => {
  it('should return true for valid UUID', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('should return false for number input', () => {
    expect(isUuid(42)).toBe(false);
  });

  it('should return false for non-UUID string', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  it('should return false for UUID without hyphens', () => {
    expect(isUuid('550e8400e29b41d4a716446655440000')).toBe(false);
  });
});

// =============================================================
// hasExtendedOrgAccess (4-tier visibility)
// =============================================================

describe('hasExtendedOrgAccess', () => {
  it('should return true when user has full access', () => {
    const orgInfo = createOrgInfo({ hasFullAccess: true });

    expect(hasExtendedOrgAccess('team', 1, orgInfo)).toBe(true);
  });

  it('should return true for company-level (everyone sees)', () => {
    const orgInfo = createOrgInfo();

    expect(hasExtendedOrgAccess('company', 1, orgInfo)).toBe(true);
  });

  it('should return true for team member', () => {
    const orgInfo = createOrgInfo({ teamIds: [1, 2, 3] });

    expect(hasExtendedOrgAccess('team', 2, orgInfo)).toBe(true);
  });

  it('should return true for team lead', () => {
    const orgInfo = createOrgInfo({ teamLeadOf: [5] });

    expect(hasExtendedOrgAccess('team', 5, orgInfo)).toBe(true);
  });

  it('should return true for department member via team', () => {
    const orgInfo = createOrgInfo({ teamsDepartmentIds: [10] });

    expect(hasExtendedOrgAccess('department', 10, orgInfo)).toBe(true);
  });

  it('should return true for area lead', () => {
    const orgInfo = createOrgInfo({ areaLeadOf: [20] });

    expect(hasExtendedOrgAccess('area', 20, orgInfo)).toBe(true);
  });

  it('should return false when user has no access', () => {
    const orgInfo = createOrgInfo();

    expect(hasExtendedOrgAccess('team', 99, orgInfo)).toBe(false);
  });

  it('should return false for unknown org level', () => {
    const orgInfo = createOrgInfo();

    expect(hasExtendedOrgAccess('unknown', 1, orgInfo)).toBe(false);
  });
});

// =============================================================
// buildVisibilityClause (two-phase: unshared vs shared)
// =============================================================

describe('buildVisibilityClause', () => {
  it('should return empty clause when user has full access', () => {
    const orgInfo = createOrgInfo({ hasFullAccess: true });
    const result = buildVisibilityClause(orgInfo, 1, 3);

    expect(result.clause).toBe('');
    expect(result.params).toHaveLength(0);
  });

  it('should always include creator visibility (submitted_by)', () => {
    const orgInfo = createOrgInfo();
    const result = buildVisibilityClause(orgInfo, 42, 3);

    expect(result.clause).toContain('s.submitted_by =');
  });

  it('should always include implemented status visibility', () => {
    const orgInfo = createOrgInfo();
    const result = buildVisibilityClause(orgInfo, 1, 3);

    expect(result.clause).toContain("s.status = 'implemented'");
  });

  it('should always include company-level visibility', () => {
    const orgInfo = createOrgInfo();
    const result = buildVisibilityClause(orgInfo, 1, 3);

    expect(result.clause).toContain("s.org_level = 'company'");
  });

  it('should split unshared and shared visibility phases', () => {
    const orgInfo = createOrgInfo({ teamIds: [1] });
    const result = buildVisibilityClause(orgInfo, 1, 3);

    expect(result.clause).toContain('s.is_shared = false');
    expect(result.clause).toContain('s.is_shared = true');
  });

  it('should use direct user_teams check for unshared KVPs (not scope)', () => {
    const orgInfo = createOrgInfo({ teamIds: [1, 2, 3] });
    const result = buildVisibilityClause(orgInfo, 42, 3);

    // Unshared branch uses user_teams subquery, not ANY(teamIds)
    expect(result.clause).toContain('s.is_shared = false');
    expect(result.clause).toContain('user_teams ut');
    expect(result.clause).toContain('ut.user_id =');
  });

  it('should include team_lead/deputy_lead check for unshared KVPs', () => {
    const orgInfo = createOrgInfo();
    const result = buildVisibilityClause(orgInfo, 1, 3);

    // Unshared branch checks team_lead_id and deputy_lead_id
    expect(result.clause).toContain('t.team_lead_id =');
    expect(result.clause).toContain('t.deputy_lead_id =');
  });

  it('should include asset_teams check for unshared asset-level KVPs', () => {
    const orgInfo = createOrgInfo();
    const result = buildVisibilityClause(orgInfo, 1, 3);

    expect(result.clause).toContain('asset_teams ats');
  });

  it('should use scope-based ANY() checks for shared KVPs', () => {
    const orgInfo = createOrgInfo({
      teamIds: [1],
      departmentIds: [10],
      areaIds: [20],
    });
    const result = buildVisibilityClause(orgInfo, 1, 3);

    // Shared branch uses ANY() with scope arrays
    expect(result.clause).toContain('s.is_shared = true');
    expect(result.clause).toContain("s.org_level = 'team'");
    expect(result.clause).toContain("s.org_level = 'department'");
    expect(result.clause).toContain("s.org_level = 'area'");
  });

  it('should generate correct number of params (9 org arrays + userId)', () => {
    const orgInfo = createOrgInfo({ teamIds: [1, 2], departmentIds: [10] });
    const result = buildVisibilityClause(orgInfo, 42, 3);

    // 8 org arrays + 1 userId = 9 params
    expect(result.params).toHaveLength(9);
    // Last param is userId
    expect(result.params[8]).toBe(42);
  });
});

// =============================================================
// buildStatusFilter
// =============================================================

describe('buildStatusFilter', () => {
  it('should return archived clause for "archived" status', () => {
    const result = buildStatusFilter('archived', 3);

    expect(result.clause).toContain("status = 'archived'");
    expect(result.param).toBeNull();
    expect(result.nextIdx).toBe(3);
  });

  it('should use parameterized clause for specific status', () => {
    const result = buildStatusFilter('open', 3);

    expect(result.clause).toContain('status = $3');
    expect(result.param).toBe('open');
    expect(result.nextIdx).toBe(4);
  });

  it('should exclude archived by default when status is undefined', () => {
    const result = buildStatusFilter(undefined, 3);

    expect(result.clause).toContain("status != 'archived'");
    expect(result.param).toBeNull();
  });

  it('should exclude archived by default when status is empty string', () => {
    const result = buildStatusFilter('', 3);

    expect(result.clause).toContain("status != 'archived'");
  });
});

// =============================================================
// buildFilterConditions
// =============================================================

describe('buildFilterConditions', () => {
  it('should return status filter only for empty filters', () => {
    const result = buildFilterConditions(
      {} as Parameters<typeof buildFilterConditions>[0],
      3,
    );

    expect(result.clause).toContain("status != 'archived'");
    expect(result.params).toHaveLength(0);
  });

  it('should add category filter when categoryId provided', () => {
    const filters = { categoryId: 5 } as Parameters<
      typeof buildFilterConditions
    >[0];

    const result = buildFilterConditions(filters, 3);

    expect(result.clause).toContain('category_id = $3');
    expect(result.params).toContain(5);
  });

  it('should add search filter with ILIKE', () => {
    const filters = { search: 'test' } as Parameters<
      typeof buildFilterConditions
    >[0];

    const result = buildFilterConditions(filters, 3);

    expect(result.clause).toContain('title ILIKE');
    expect(result.clause).toContain('description ILIKE');
    expect(result.params).toContain('%test%');
  });
});

// =============================================================
// mapOrgLevelToRecipient
// =============================================================

describe('mapOrgLevelToRecipient', () => {
  it('should map team level to team recipient via teamIds', () => {
    const dto = {
      teamIds: [5],
      assetIds: [],
    } as Parameters<typeof mapOrgLevelToRecipient>[0];

    expect(mapOrgLevelToRecipient(dto)).toEqual({ type: 'team', id: 5 });
  });

  it('should map asset level to all', () => {
    const dto = {
      teamIds: [],
      assetIds: [10],
    } as Parameters<typeof mapOrgLevelToRecipient>[0];

    expect(mapOrgLevelToRecipient(dto)).toEqual({ type: 'all', id: null });
  });

  it('should map department level using departmentId (legacy fallback)', () => {
    const dto = {
      teamIds: [],
      assetIds: [],
      orgLevel: 'department',
      orgId: 10,
      departmentId: 7,
    } as Parameters<typeof mapOrgLevelToRecipient>[0];

    expect(mapOrgLevelToRecipient(dto)).toEqual({ type: 'department', id: 7 });
  });

  it('should map area level to department when departmentId exists (legacy fallback)', () => {
    const dto = {
      teamIds: [],
      assetIds: [],
      orgLevel: 'area',
      departmentId: 3,
    } as Parameters<typeof mapOrgLevelToRecipient>[0];

    expect(mapOrgLevelToRecipient(dto)).toEqual({ type: 'department', id: 3 });
  });

  it('should map area level to all when no departmentId (legacy fallback)', () => {
    const dto = {
      teamIds: [],
      assetIds: [],
      orgLevel: 'area',
    } as Parameters<typeof mapOrgLevelToRecipient>[0];

    expect(mapOrgLevelToRecipient(dto)).toEqual({ type: 'all', id: null });
  });

  it('should map company level to all (legacy fallback)', () => {
    const dto = {
      teamIds: [],
      assetIds: [],
      orgLevel: 'company',
    } as Parameters<typeof mapOrgLevelToRecipient>[0];

    expect(mapOrgLevelToRecipient(dto)).toEqual({ type: 'all', id: null });
  });
});
