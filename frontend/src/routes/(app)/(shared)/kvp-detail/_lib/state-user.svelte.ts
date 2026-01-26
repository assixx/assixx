// =============================================================================
// KVP-DETAIL - USER STATE MODULE
// =============================================================================

import type { User } from './types';

/** Creates user-related state (currentUser, effectiveRole) */
export function createUserState() {
  let currentUser = $state<User | null>(null);
  let effectiveRole = $state<string>('employee');

  const isAdmin = $derived(effectiveRole === 'admin' || effectiveRole === 'root');

  function updateEffectiveRole() {
    if (currentUser === null) {
      effectiveRole = 'employee';
      return;
    }

    // Check sessionStorage for role switch
    if (typeof sessionStorage !== 'undefined') {
      const roleSwitch = sessionStorage.getItem('roleSwitch');
      if (
        (currentUser.role === 'admin' || currentUser.role === 'root') &&
        roleSwitch === 'employee'
      ) {
        effectiveRole = 'employee';
        return;
      }
    }

    // Check localStorage for activeRole
    if (typeof localStorage !== 'undefined') {
      const activeRole = localStorage.getItem('activeRole');
      if (activeRole !== null && activeRole !== '' && activeRole !== currentUser.role) {
        effectiveRole = activeRole;
        return;
      }
    }

    effectiveRole = currentUser.role;
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
    setUser: (user: User | null) => {
      currentUser = user;
      updateEffectiveRole();
    },
    updateEffectiveRole,
  };
}

export type UserState = ReturnType<typeof createUserState>;
