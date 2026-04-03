import { describe, expect, it } from 'vitest';

import { DEFAULT_ORG_SCOPE } from '$lib/types/organizational-scope';

import { deriveRoleFlags, resolveAutoTeam } from './server-helpers';

import type { OrganizationalScope } from '$lib/types/organizational-scope';
import type { User } from './types';

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

const FULL_SCOPE: OrganizationalScope = {
  ...DEFAULT_ORG_SCOPE,
  type: 'full',
};

function limitedScope(teamIds: number[]): OrganizationalScope {
  return {
    ...DEFAULT_ORG_SCOPE,
    type: 'limited',
    teamIds,
    isAnyLead: true,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'test',
    email: 'test@example.com',
    role: 'employee',
    tenantId: 1,
    isActive: 1,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveAutoTeam
// ---------------------------------------------------------------------------

describe('resolveAutoTeam', () => {
  describe('when scope is none (regular employee/admin)', () => {
    it('should auto-select primary team when user has one', () => {
      const result = resolveAutoTeam(DEFAULT_ORG_SCOPE, false, 5);
      expect(result).toEqual({ autoTeamId: 5, hasAutoTeam: true });
    });

    it('should return no auto-team when user has no team', () => {
      const result = resolveAutoTeam(DEFAULT_ORG_SCOPE, false, null);
      expect(result).toEqual({ autoTeamId: null, hasAutoTeam: false });
    });
  });

  describe('when scope is limited (lead/deputy)', () => {
    it('should auto-select the sole managed team for single-team managers', () => {
      const result = resolveAutoTeam(limitedScope([7]), true, 99);
      expect(result).toEqual({ autoTeamId: 7, hasAutoTeam: true });
    });

    it('should NOT auto-select for multi-team managers', () => {
      const result = resolveAutoTeam(limitedScope([7, 8, 9]), true, 99);
      expect(result).toEqual({ autoTeamId: 99, hasAutoTeam: false });
    });

    it('should NOT auto-select for managers with empty teamIds', () => {
      const result = resolveAutoTeam(limitedScope([]), true, 5);
      expect(result).toEqual({ autoTeamId: 5, hasAutoTeam: false });
    });
  });

  describe('when scope is full (root / has_full_access)', () => {
    it('should NOT auto-select — too many teams to pick one', () => {
      const result = resolveAutoTeam(FULL_SCOPE, true, 42);
      expect(result).toEqual({ autoTeamId: 42, hasAutoTeam: false });
    });

    it('should fall back to primaryTeamId', () => {
      const result = resolveAutoTeam(FULL_SCOPE, true, null);
      expect(result).toEqual({ autoTeamId: null, hasAutoTeam: false });
    });
  });
});

// ---------------------------------------------------------------------------
// deriveRoleFlags
// ---------------------------------------------------------------------------

describe('deriveRoleFlags', () => {
  it('should identify employee role', () => {
    const flags = deriveRoleFlags(makeUser({ role: 'employee' }));
    expect(flags.isEmployee).toBe(true);
    expect(flags.isAdminOrRoot).toBe(false);
  });

  it('should identify admin role', () => {
    const flags = deriveRoleFlags(makeUser({ role: 'admin' }));
    expect(flags.isEmployee).toBe(false);
    expect(flags.isAdminOrRoot).toBe(true);
  });

  it('should identify root role', () => {
    const flags = deriveRoleFlags(makeUser({ role: 'root' }));
    expect(flags.isEmployee).toBe(false);
    expect(flags.isAdminOrRoot).toBe(true);
  });

  it('should extract primaryTeamId from teamIds array', () => {
    const flags = deriveRoleFlags(makeUser({ teamIds: [10, 20] }));
    expect(flags.primaryTeamId).toBe(10);
  });

  it('should fall back to teamId when teamIds is missing', () => {
    const flags = deriveRoleFlags(makeUser({ teamIds: undefined, teamId: 5 }));
    expect(flags.primaryTeamId).toBe(5);
  });

  it('should return null when no team is assigned', () => {
    const flags = deriveRoleFlags(makeUser({ teamIds: undefined, teamId: undefined }));
    expect(flags.primaryTeamId).toBeNull();
  });

  it('should prefer teamIds[0] over teamId', () => {
    const flags = deriveRoleFlags(makeUser({ teamIds: [10], teamId: 99 }));
    expect(flags.primaryTeamId).toBe(10);
  });

  it('should return null for empty teamIds array with no teamId', () => {
    const flags = deriveRoleFlags(makeUser({ teamIds: [], teamId: undefined }));
    expect(flags.primaryTeamId).toBeNull();
  });
});
