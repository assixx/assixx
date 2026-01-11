// =============================================================================
// KVP - USER STATE (Svelte 5 Runes)
// =============================================================================

import type { User } from './types';

/**
 * Determines effective role based on user and storage overrides
 */
function resolveEffectiveRole(user: User | null): string {
  if (user === null) {
    return 'employee';
  }

  // Check sessionStorage for role switch
  if (typeof sessionStorage !== 'undefined') {
    const roleSwitch = sessionStorage.getItem('roleSwitch');
    const canSwitch = user.role === 'admin' || user.role === 'root';
    if (canSwitch && roleSwitch === 'employee') {
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

/**
 * User state: current user, effective role, permissions
 */
function createUserState() {
  let currentUser = $state<User | null>(null);
  let effectiveRole = $state<string>('employee');

  const isAdmin = $derived(effectiveRole === 'admin' || effectiveRole === 'root');
  const isEmployee = $derived(effectiveRole === 'employee');

  function setUser(user: User | null): void {
    currentUser = user;
    effectiveRole = resolveEffectiveRole(user);
  }

  function updateEffectiveRole(): void {
    effectiveRole = resolveEffectiveRole(currentUser);
  }

  function reset(): void {
    currentUser = null;
    effectiveRole = 'employee';
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
    get isEmployee() {
      return isEmployee;
    },
    setUser,
    updateEffectiveRole,
    reset,
  };
}

export const userState = createUserState();
