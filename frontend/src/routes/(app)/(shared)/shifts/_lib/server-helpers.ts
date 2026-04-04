/**
 * Pure helper functions for shift SSR data loading.
 * Extracted from +page.server.ts for testability.
 */

import type { OrganizationalScope } from '$lib/types/organizational-scope';
import type { User } from './types';

/**
 * Derive which team (if any) should be auto-selected in SSR.
 * Single-team managers get their scoped team; non-managers get their assigned team.
 */
export function resolveAutoTeam(
  orgScope: OrganizationalScope,
  isManager: boolean,
  primaryTeamId: number | null,
): { autoTeamId: number | null; hasAutoTeam: boolean } {
  const isSingleTeamManager = orgScope.type === 'limited' && orgScope.teamIds.length === 1;
  const autoTeamId = isSingleTeamManager ? orgScope.teamIds[0] : primaryTeamId;
  const hasAutoTeam = isManager ? isSingleTeamManager : primaryTeamId !== null;
  return { autoTeamId, hasAutoTeam };
}

/**
 * Derive role flags from user data (kept for backward compat).
 */
export function deriveRoleFlags(userData: User) {
  return {
    isEmployee: userData.role === 'employee',
    primaryTeamId: userData.teamIds?.[0] ?? userData.teamId ?? null,
    isAdminOrRoot: userData.role === 'admin' || userData.role === 'root',
  };
}
