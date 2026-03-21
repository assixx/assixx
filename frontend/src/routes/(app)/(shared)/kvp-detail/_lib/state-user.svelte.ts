// =============================================================================
// KVP-DETAIL - USER STATE MODULE
// =============================================================================

import type { User } from './types';

/** Resolve effective role from storage overrides */
function resolveRole(user: User): string {
  if (typeof sessionStorage !== 'undefined') {
    const roleSwitch = sessionStorage.getItem('roleSwitch');
    if ((user.role === 'admin' || user.role === 'root') && roleSwitch === 'employee') {
      return 'employee';
    }
  }

  if (typeof localStorage !== 'undefined') {
    const activeRole = localStorage.getItem('activeRole');
    if (activeRole !== null && activeRole !== '' && activeRole !== user.role) {
      return activeRole;
    }
  }

  return user.role;
}

/** Creates user-related state (currentUser, effectiveRole, canManage) */
export function createUserState() {
  let currentUser = $state<User | null>(null);
  let effectiveRole = $state<string>('employee');
  let isTeamLead = $state(false);

  const isAdmin = $derived(effectiveRole === 'admin' || effectiveRole === 'root');
  const canManage = $derived(isAdmin || isTeamLead);

  function updateEffectiveRole() {
    effectiveRole = currentUser === null ? 'employee' : resolveRole(currentUser);
  }

  return {
    get currentUser() {
      return currentUser;
    },
    get effectiveRole() {
      return effectiveRole;
    },
    get isAdmin() {
      return isAdmin;
    },
    get isTeamLead() {
      return isTeamLead;
    },
    get canManage() {
      return canManage;
    },
    setUser: (user: User | null) => {
      currentUser = user;
      updateEffectiveRole();
    },
    setTeamLead: (value: boolean) => {
      isTeamLead = value;
    },
    updateEffectiveRole,
  };
}

export type UserState = ReturnType<typeof createUserState>;
