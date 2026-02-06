// =============================================================================
// SHIFTS STATE - USER MODULE
// User state, role management, and permissions
// =============================================================================

import type { User } from './types';

/**
 * Determine effective role based on user and storage settings
 */
function determineEffectiveRole(user: User | null): string {
  if (user === null) return 'employee';

  // Check sessionStorage for role switch
  if (typeof sessionStorage !== 'undefined') {
    const roleSwitch = sessionStorage.getItem('roleSwitch');
    if (
      (user.role === 'admin' || user.role === 'root') &&
      roleSwitch === 'employee'
    ) {
      return 'employee';
    }
  }

  // Check localStorage for activeRole
  if (typeof localStorage !== 'undefined') {
    const activeRole = localStorage.getItem('activeRole');
    if (activeRole !== null && activeRole !== '' && activeRole !== user.role) {
      return activeRole;
    }
  }

  return user.role;
}

function createUserState() {
  let currentUser = $state<User | null>(null);
  let effectiveRole = $state<string>('employee');
  let currentUserId = $state<number | null>(null);
  let hasFullAccess = $state(false);

  function updateEffectiveRole() {
    effectiveRole = determineEffectiveRole(currentUser);
  }

  function setUser(user: User | null) {
    currentUser = user;
    if (user !== null) {
      currentUserId = user.id;
      hasFullAccess = user.hasFullAccess === true || user.hasFullAccess === 1;
    }
    updateEffectiveRole();
  }

  function setHasFullAccess(access: boolean) {
    hasFullAccess = access;
  }

  function reset() {
    currentUser = null;
    effectiveRole = 'employee';
    currentUserId = null;
    hasFullAccess = false;
  }

  return {
    get currentUser() {
      return currentUser;
    },
    get effectiveRole() {
      return effectiveRole;
    },
    get currentUserId() {
      return currentUserId;
    },
    get hasFullAccess() {
      return hasFullAccess;
    },
    setUser,
    updateEffectiveRole,
    setHasFullAccess,
    reset,
  };
}

export const userState = createUserState();
