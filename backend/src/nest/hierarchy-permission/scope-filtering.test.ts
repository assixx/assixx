/**
 * Unit tests for Scope Filtering Logic
 *
 * Tests the buildLimitedScope helper and the OrganizationalScope constants.
 * Service-level scope filtering (Areas, Departments, Teams, Users) is verified
 * through these pure-function tests + API integration tests (Phase 7).
 *
 * @see docs/FEAT_ORGANIZATIONAL_SCOPE_ACCESS_MASTERPLAN.md Step 4.3
 */
import { describe, expect, it } from 'vitest';

import {
  DEPUTY_EQUALS_LEAD,
  FULL_SCOPE,
  NO_SCOPE,
  buildLimitedScope,
} from './organizational-scope.types.js';

// =============================================================
// Constants
// =============================================================

describe('SECURITY: Scope Constants', () => {
  it('FULL_SCOPE should have type full with empty arrays', () => {
    expect(FULL_SCOPE.type).toBe('full');
    expect(FULL_SCOPE.areaIds).toEqual([]);
    expect(FULL_SCOPE.isAnyLead).toBe(false);
  });

  it('NO_SCOPE should have type none with empty arrays', () => {
    expect(NO_SCOPE.type).toBe('none');
    expect(NO_SCOPE.teamIds).toEqual([]);
    expect(NO_SCOPE.isAnyLead).toBe(false);
  });

  it('DEPUTY_EQUALS_LEAD should be true (V1)', () => {
    expect(DEPUTY_EQUALS_LEAD).toBe(true);
  });
});

// =============================================================
// buildLimitedScope
// =============================================================

describe('SECURITY: buildLimitedScope', () => {
  it('should build scope with correct IDs from CTE row', () => {
    const scope = buildLimitedScope({
      area_ids: [1, 2],
      department_ids: [10, 20],
      team_ids: [100, 101],
      lead_area_ids: [1],
      lead_department_ids: [],
      lead_team_ids: [100],
    });

    expect(scope.type).toBe('limited');
    expect(scope.areaIds).toEqual([1, 2]);
    expect(scope.departmentIds).toEqual([10, 20]);
    expect(scope.teamIds).toEqual([100, 101]);
    expect(scope.leadAreaIds).toEqual([1]);
    expect(scope.leadDepartmentIds).toEqual([]);
    expect(scope.leadTeamIds).toEqual([100]);
  });

  it('should derive boolean flags from lead arrays', () => {
    const withLeads = buildLimitedScope({
      area_ids: [],
      department_ids: [],
      team_ids: [268],
      lead_area_ids: [],
      lead_department_ids: [],
      lead_team_ids: [268],
    });

    expect(withLeads.isAreaLead).toBe(false);
    expect(withLeads.isDepartmentLead).toBe(false);
    expect(withLeads.isTeamLead).toBe(true);
    expect(withLeads.isAnyLead).toBe(true);
  });

  it('should set isAnyLead=true for any lead type', () => {
    const areaLead = buildLimitedScope({
      area_ids: [1],
      department_ids: [],
      team_ids: [],
      lead_area_ids: [1],
      lead_department_ids: [],
      lead_team_ids: [],
    });
    expect(areaLead.isAnyLead).toBe(true);
    expect(areaLead.isAreaLead).toBe(true);

    const deptLead = buildLimitedScope({
      area_ids: [],
      department_ids: [10],
      team_ids: [],
      lead_area_ids: [],
      lead_department_ids: [10],
      lead_team_ids: [],
    });
    expect(deptLead.isAnyLead).toBe(true);
    expect(deptLead.isDepartmentLead).toBe(true);
  });

  it('should set all flags false for empty arrays', () => {
    const empty = buildLimitedScope({
      area_ids: [],
      department_ids: [],
      team_ids: [],
      lead_area_ids: [],
      lead_department_ids: [],
      lead_team_ids: [],
    });

    expect(empty.type).toBe('limited');
    expect(empty.isAnyLead).toBe(false);
    expect(empty.isAreaLead).toBe(false);
    expect(empty.isDepartmentLead).toBe(false);
    expect(empty.isTeamLead).toBe(false);
  });

  it('should handle combined area permission + dept lead (union)', () => {
    const combined = buildLimitedScope({
      area_ids: [1],
      department_ids: [10, 20],
      team_ids: [100, 101, 200],
      lead_area_ids: [],
      lead_department_ids: [20],
      lead_team_ids: [],
    });

    expect(combined.areaIds).toEqual([1]);
    expect(combined.departmentIds).toEqual([10, 20]);
    expect(combined.teamIds).toEqual([100, 101, 200]);
    expect(combined.isDepartmentLead).toBe(true);
    expect(combined.isAreaLead).toBe(false);
  });
});
