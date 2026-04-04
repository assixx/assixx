/**
 * Unit tests for Teams Lead Permission Auto-Seed/Cleanup
 *
 * @see docs/FEAT_ORGANIZATIONAL_SCOPE_ACCESS_MASTERPLAN.md Step 4.2
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ScopeService } from '../hierarchy-permission/scope.service.js';
import { TeamsService } from './teams.service.js';

const _query = vi.fn();
const mockDb = {
  query: _query,
  tenantQuery: _query,
  tenantQueryOne: vi.fn(),
} as unknown as DatabaseService;
const mockActivity = {
  logUpdate: vi.fn().mockResolvedValue(undefined),
} as unknown as ActivityLoggerService;
const mockScope = { getScope: vi.fn() } as unknown as ScopeService;

let service: TeamsService;

beforeEach(() => {
  vi.resetAllMocks();
  (mockScope.getScope as ReturnType<typeof vi.fn>).mockResolvedValue({
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
  service = new TeamsService(mockActivity, mockDb, mockScope);
});

function q(rows: unknown[]) {
  (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rows);
}

function team(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Linie 9',
    description: null,
    department_id: 10,
    team_lead_id: null,
    team_deputy_lead_id: null,
    is_active: 1,
    tenant_id: 3,
    created_at: new Date(),
    updated_at: new Date(),
    department_name: 'P',
    department_area_name: 'H',
    team_lead_name: null,
    team_deputy_lead_name: null,
    member_count: 5,
    asset_count: 2,
    member_names: null,
    asset_names: null,
    ...overrides,
  };
}

function sqls(): string[] {
  return (mockDb.query as ReturnType<typeof vi.fn>).mock.calls
    .map((c: unknown[]) => c[0])
    .filter((s: unknown): s is string => typeof s === 'string');
}

// =============================================================
// Seed: Deputy lead assignment (simplest path — no handleLeaderChange)
// =============================================================

describe('SECURITY: Seed permissions on deputy lead assignment', () => {
  it('should INSERT manage_hierarchy rows when deputy assigned', async () => {
    // DTO: { teamDeputyLeadId: 200 }  Old: team_deputy_lead_id=null
    // Query sequence:
    q([team()]); // FIND_TEAM_BY_ID (existing)
    q([{ id: 200, position: 'team_lead' }]); // validateLeader(200)
    q([]); // UPDATE teams SET team_deputy_lead_id=$1
    q([]); // seedLeadPermissions: INSERT manage-teams
    q([]); // seedLeadPermissions: INSERT manage-employees
    q([team({ team_deputy_lead_id: 200 })]); // FIND_TEAM_BY_ID (getTeamById result)

    await service.updateTeam(1, { teamDeputyLeadId: 200 }, 1, 3);

    const inserts = sqls().filter((s: string) => s.includes('manage_hierarchy'));
    expect(inserts).toHaveLength(2);
  });
});

// =============================================================
// Cleanup: Remove leader (leaderId=null)
// =============================================================

describe('SECURITY: Cleanup permissions on lead removal', () => {
  it('should DELETE permissions when lead removed and no other teams', async () => {
    // DTO: { leaderId: null }  Old: team_lead_id=100
    // validateLeader(null) → early return (no query)
    q([team({ team_lead_id: 100 })]); // FIND_TEAM_BY_ID
    q([]); // UPDATE teams SET team_lead_id=null
    // handleLeaderChange: leaderId=null → early return
    // syncLeadPermission(null, 100): cleanup!
    q([{ count: '0' }]); // COUNT remaining teams → 0
    q([]); // DELETE user_addon_permissions
    q([team()]); // FIND_TEAM_BY_ID (result)

    await service.updateTeam(1, { leaderId: null }, 1, 3);

    const deletes = sqls().filter((s: string) => s.includes('DELETE FROM user_addon_permissions'));
    expect(deletes).toHaveLength(1);
  });

  it('should NOT delete when lead still leads another team', async () => {
    q([team({ team_lead_id: 100 })]); // FIND_TEAM_BY_ID
    q([]); // UPDATE
    q([{ count: '1' }]); // COUNT remaining = 1 → skip DELETE
    q([team()]); // FIND_TEAM_BY_ID (result)

    await service.updateTeam(1, { leaderId: null }, 1, 3);

    const deletes = sqls().filter((s: string) => s.includes('DELETE FROM user_addon_permissions'));
    expect(deletes).toHaveLength(0);
  });
});

// =============================================================
// No lead change — no permission queries
// =============================================================

describe('SECURITY: No permission changes when leads unchanged', () => {
  it('should not seed/cleanup when only description changes', async () => {
    // DTO: { description: 'New' }  Both lead fields undefined → skip
    q([team({ team_lead_id: 100 })]); // FIND_TEAM_BY_ID
    q([]); // UPDATE teams SET description=$1
    // handleLeaderChange: leaderId=undefined → early return
    // syncLeadPermission: both lead fields undefined → skip
    q([team({ team_lead_id: 100 })]); // FIND_TEAM_BY_ID (result)

    await service.updateTeam(1, { description: 'New' }, 1, 3);

    const permCalls = sqls().filter(
      (s: string) => s.includes('manage_hierarchy') || s.includes('user_addon_permissions'),
    );
    expect(permCalls).toHaveLength(0);
  });
});
