import { describe, expect, it } from 'vitest';

import {
  buildFilterConditions,
  buildStatusFilter,
  buildSuggestionUpdateClause,
  buildVisibilityClause,
  hasExtendedOrgAccess,
  isUuid,
  mapTeamToRecipient,
  transformSuggestion,
  validateApprovalStatusTransition,
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

  it('should use only team_lead/deputy_lead check for unshared KVPs (not user_teams)', () => {
    const orgInfo = createOrgInfo({ teamIds: [1, 2, 3] });
    const result = buildVisibilityClause(orgInfo, 42, 3);

    // Unshared branch uses team_lead_id/team_deputy_lead_id only, NOT user_teams
    expect(result.clause).toContain('s.is_shared = false');
    expect(result.clause).toContain('t.team_lead_id =');
    expect(result.clause).toContain('t.team_deputy_lead_id =');
    // Extract only the unshared block (between is_shared = false and is_shared = true)
    const unsharedBlock = result.clause.split('s.is_shared = true')[0] ?? '';
    expect(unsharedBlock).not.toContain('user_teams');
  });

  it('should include team_lead/deputy_lead check for unshared KVPs', () => {
    const orgInfo = createOrgInfo();
    const result = buildVisibilityClause(orgInfo, 1, 3);

    // Unshared branch checks team_lead_id and team_deputy_lead_id
    expect(result.clause).toContain('t.team_lead_id =');
    expect(result.clause).toContain('t.team_deputy_lead_id =');
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

  it('should generate correct number of params (7 org arrays + userId)', () => {
    const orgInfo = createOrgInfo({ teamIds: [1, 2], departmentIds: [10] });
    const result = buildVisibilityClause(orgInfo, 42, 3);

    // 7 org arrays + 1 userId = 8 params (teamIds removed — uses user_teams JOIN instead)
    expect(result.params).toHaveLength(8);
    // Last param is userId
    expect(result.params[7]).toBe(42);
  });

  it('should include approval master visibility clause', () => {
    const orgInfo = createOrgInfo();
    const result = buildVisibilityClause(orgInfo, 1, 3);

    expect(result.clause).toContain('approval_configs');
    expect(result.clause).toContain("ac.addon_code = 'kvp'");
    expect(result.clause).toContain('ac.approver_user_id');
    expect(result.clause).toContain('ac.approver_position_id');
  });

  it('should include scope matching in approval master clause', () => {
    const orgInfo = createOrgInfo();
    const result = buildVisibilityClause(orgInfo, 1, 3);

    expect(result.clause).toContain('ac.scope_area_ids IS NULL');
    expect(result.clause).toContain('ac.scope_department_ids IS NULL');
    expect(result.clause).toContain('ac.scope_team_ids IS NULL');
    expect(result.clause).toContain('ANY(ac.scope_area_ids)');
    expect(result.clause).toContain('ANY(ac.scope_department_ids)');
    expect(result.clause).toContain('ANY(ac.scope_team_ids)');
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
    const result = buildFilterConditions({} as Parameters<typeof buildFilterConditions>[0], 3);

    expect(result.clause).toContain("status != 'archived'");
    expect(result.params).toHaveLength(0);
  });

  it('should add category filter when categoryId provided', () => {
    const filters = { categoryId: 5 } as Parameters<typeof buildFilterConditions>[0];

    const result = buildFilterConditions(filters, 3);

    expect(result.clause).toContain('category_id = $3');
    expect(result.params).toContain(5);
  });

  it('should add search filter with ILIKE', () => {
    const filters = { search: 'test' } as Parameters<typeof buildFilterConditions>[0];

    const result = buildFilterConditions(filters, 3);

    expect(result.clause).toContain('title ILIKE');
    expect(result.clause).toContain('description ILIKE');
    expect(result.params).toContain('%test%');
  });
});

// =============================================================
// mapTeamToRecipient
// =============================================================

// =============================================================
// buildFilterConditions — additional filter branches
// =============================================================

describe('buildFilterConditions (additional filters)', () => {
  it('should add customCategoryId filter', () => {
    const filters = { customCategoryId: 7 } as Parameters<typeof buildFilterConditions>[0];

    const result = buildFilterConditions(filters, 3);

    expect(result.clause).toContain('custom_category_id = $3');
    expect(result.params).toContain(7);
  });

  it('should add priority filter', () => {
    const filters = { priority: 'high' } as Parameters<typeof buildFilterConditions>[0];

    const result = buildFilterConditions(filters, 3);

    expect(result.clause).toContain('priority = $3');
    expect(result.params).toContain('high');
  });

  it('should add orgLevel filter', () => {
    const filters = { orgLevel: 'team' } as Parameters<typeof buildFilterConditions>[0];

    const result = buildFilterConditions(filters, 3);

    expect(result.clause).toContain('org_level = $3');
    expect(result.params).toContain('team');
  });

  it('should add teamId filter', () => {
    const filters = { teamId: 42 } as Parameters<typeof buildFilterConditions>[0];

    const result = buildFilterConditions(filters, 3);

    expect(result.clause).toContain('team_id = $3');
    expect(result.params).toContain(42);
  });

  it('should combine multiple filters with correct indices', () => {
    const filters = {
      categoryId: 5,
      customCategoryId: 7,
      priority: 'urgent',
      orgLevel: 'department',
      teamId: 10,
      search: 'test',
    } as Parameters<typeof buildFilterConditions>[0];

    const result = buildFilterConditions(filters, 3);

    expect(result.params).toEqual([5, 7, 'urgent', 'department', 10, '%test%']);
  });
});

// =============================================================
// transformSuggestion — confirmation/firstSeen timestamps
// =============================================================

describe('transformSuggestion (confirmation timestamps)', () => {
  /** Minimal DB suggestion for transform tests */
  function makeDbSuggestion(
    overrides: Record<string, unknown> = {},
  ): Parameters<typeof transformSuggestion>[0] {
    return {
      id: 1,
      uuid: 'test-uuid',
      tenant_id: 42,
      title: 'Test',
      description: 'Desc',
      category_id: 1,
      custom_category_id: null,
      org_level: 'team' as const,
      org_id: 1,
      department_id: null,
      team_id: 1,
      is_shared: false,
      submitted_by: 3,
      priority: 'normal' as const,
      status: 'open',
      created_at: new Date('2025-06-01'),
      updated_at: new Date('2025-06-01'),
      ...overrides,
    };
  }

  it('should map confirmedAt when confirmed_at is present', () => {
    const suggestion = makeDbSuggestion({
      is_confirmed: true,
      confirmed_at: '2025-06-15T10:00:00Z',
    });

    const result = transformSuggestion(suggestion);

    expect(result.isConfirmed).toBe(true);
    expect(result.confirmedAt).toBe(new Date('2025-06-15T10:00:00Z').toISOString());
  });

  it('should map firstSeenAt when first_seen_at is present', () => {
    const suggestion = makeDbSuggestion({
      first_seen_at: '2025-06-10T08:00:00Z',
    });

    const result = transformSuggestion(suggestion);

    expect(result.firstSeenAt).toBe(new Date('2025-06-10T08:00:00Z').toISOString());
  });

  it('should not convert confirmedAt to ISO string when confirmed_at is null', () => {
    const suggestion = makeDbSuggestion({
      is_confirmed: false,
      confirmed_at: null,
    });

    const result = transformSuggestion(suggestion);

    expect(result.isConfirmed).toBe(false);
    // dbToApi maps null → null (not converted to ISO string by attachConfirmationStatus)
    expect(result.confirmedAt).toBeNull();
  });

  it('should not convert firstSeenAt to ISO string when first_seen_at is null', () => {
    const suggestion = makeDbSuggestion({ first_seen_at: null });

    const result = transformSuggestion(suggestion);

    // dbToApi maps null → null (not converted to ISO string by attachConfirmationStatus)
    expect(result.firstSeenAt).toBeNull();
  });
});

// =============================================================
// buildSuggestionUpdateClause — status-specific branches
// =============================================================

describe('buildSuggestionUpdateClause', () => {
  it('should handle "rejected" status — set rejection_reason, clear implementation_date', () => {
    const dto = {
      status: 'rejected',
      rejectionReason: 'Not feasible',
    } as Parameters<typeof buildSuggestionUpdateClause>[0];

    const result = buildSuggestionUpdateClause(dto, 5);

    expect(result.updates).toContain('updated_at = NOW()');
    expect(result.updates.join(' ')).toContain('status');
    expect(result.updates.join(' ')).toContain('rejection_reason');
    expect(result.updates.join(' ')).toContain('implementation_date');
    expect(result.params).toContain('rejected');
    expect(result.params).toContain('Not feasible');
    // implementation_date cleared to null
    expect(result.params[result.params.length - 1]).toBeNull();
  });

  it('should handle "implemented" status — set implementation_date, clear rejection_reason', () => {
    const dto = {
      status: 'implemented',
    } as Parameters<typeof buildSuggestionUpdateClause>[0];

    const result = buildSuggestionUpdateClause(dto, 5);

    expect(result.updates.join(' ')).toContain('implementation_date = CURRENT_DATE');
    expect(result.updates.join(' ')).toContain('rejection_reason');
    // rejection_reason cleared to null
    expect(result.params).toContain(null);
  });

  it('should handle other status — clear both rejection_reason and implementation_date', () => {
    const dto = {
      status: 'approved',
    } as Parameters<typeof buildSuggestionUpdateClause>[0];

    const result = buildSuggestionUpdateClause(dto, 5);

    expect(result.updates.join(' ')).toContain('rejection_reason');
    expect(result.updates.join(' ')).toContain('implementation_date');
    // Both cleared to null (last two params)
    const lastTwo = result.params.slice(-2);
    expect(lastTwo).toEqual([null, null]);
  });

  it('should only update rejection_reason when no status change', () => {
    const dto = {
      rejectionReason: 'Updated reason',
    } as Parameters<typeof buildSuggestionUpdateClause>[0];

    const result = buildSuggestionUpdateClause(dto);

    expect(result.updates.join(' ')).toContain('rejection_reason');
    expect(result.updates.join(' ')).not.toContain('status');
    expect(result.params).toContain('Updated reason');
  });

  it('should include assignedTo when status is set', () => {
    const dto = {
      status: 'in_progress',
    } as Parameters<typeof buildSuggestionUpdateClause>[0];

    const result = buildSuggestionUpdateClause(dto, 99);

    expect(result.updates.join(' ')).toContain('assigned_to');
    expect(result.params).toContain(99);
  });
});

// =============================================================
// mapTeamToRecipient
// =============================================================

describe('mapTeamToRecipient', () => {
  it('should return team recipient with given teamId', () => {
    expect(mapTeamToRecipient(5)).toEqual({ type: 'team', id: 5 });
  });
});

// =============================================================
// validateApprovalStatusTransition
// =============================================================

describe('validateApprovalStatusTransition', () => {
  describe('without approval config', () => {
    it('should allow all transitions', () => {
      expect(validateApprovalStatusTransition('new', 'approved', false).allowed).toBe(true);
      expect(validateApprovalStatusTransition('new', 'rejected', false).allowed).toBe(true);
      expect(validateApprovalStatusTransition('in_review', 'approved', false).allowed).toBe(true);
    });
  });

  describe('with approval config', () => {
    it('should allow new → rejected (direct reject)', () => {
      expect(validateApprovalStatusTransition('new', 'rejected', true).allowed).toBe(true);
    });

    it('should allow restored → rejected (like new)', () => {
      expect(validateApprovalStatusTransition('restored', 'rejected', true).allowed).toBe(true);
    });

    it('should allow approved → implemented', () => {
      expect(validateApprovalStatusTransition('approved', 'implemented', true).allowed).toBe(true);
    });

    it('should BLOCK new → approved (only via approval master)', () => {
      const result = validateApprovalStatusTransition('new', 'approved', true);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Freigabe-Master');
    });

    it('should BLOCK new → in_review (only via requestApproval)', () => {
      const result = validateApprovalStatusTransition('new', 'in_review', true);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('automatisch');
    });

    it('should BLOCK in_review → any (waiting for master)', () => {
      const result = validateApprovalStatusTransition('in_review', 'rejected', true);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('gesperrt');
    });

    it('should BLOCK rejected → any (final state)', () => {
      const result = validateApprovalStatusTransition('rejected', 'new', true);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK implemented → any (final state)', () => {
      const result = validateApprovalStatusTransition('implemented', 'new', true);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK approved → rejected', () => {
      const result = validateApprovalStatusTransition('approved', 'rejected', true);
      expect(result.allowed).toBe(false);
    });
  });
});
