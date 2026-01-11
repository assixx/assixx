// =============================================================================
// CALENDAR STATE - USER MODULE
// User state, role management, and permissions
// =============================================================================

import type { CalendarEvent } from './types';

function createUserState() {
  let currentUserId = $state<number | null>(null);
  let isAdmin = $state(false);
  let userRole = $state<string | null>(null);

  function setUser(user: { id: number; role?: string }) {
    currentUserId = user.id;
    userRole = user.role ?? null;
    isAdmin = user.role === 'admin' || user.role === 'root';
  }

  function canEditEvent(event: CalendarEvent): boolean {
    if (isAdmin) return true;
    return event.createdBy === currentUserId;
  }

  function canDeleteEvent(_event: CalendarEvent): boolean {
    return isAdmin;
  }

  function reset() {
    currentUserId = null;
    isAdmin = false;
    userRole = null;
  }

  return {
    get currentUserId() {
      return currentUserId;
    },
    get isAdmin() {
      return isAdmin;
    },
    get userRole() {
      return userRole;
    },
    get canCreateEvents() {
      return true;
    },
    setUser,
    canEditEvent,
    canDeleteEvent,
    reset,
  };
}

export const userState = createUserState();
