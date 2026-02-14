// =============================================================================
// CALENDAR STATE - USER MODULE
// User state, role management, and permissions
//
// ADR-010: Permission checks respect has_full_access flag
// - Root: always full access
// - Admin with has_full_access=true: full access
// - Admin without full access: only own events (area permissions checked by backend)
// - Employee: only own events
// =============================================================================

import type { CalendarEvent } from './types';

function createUserState() {
  let currentUserId = $state<number | null>(null);
  let isAdmin = $state(false);
  let isRoot = $state(false);
  let hasFullAccess = $state(false);
  let userRole = $state<string | null>(null);

  function setUser(user: {
    id: number;
    role?: string;
    hasFullAccess?: boolean;
  }) {
    currentUserId = user.id;
    userRole = user.role ?? null;
    isRoot = user.role === 'root';
    isAdmin = user.role === 'admin' || user.role === 'root';
    hasFullAccess = user.hasFullAccess ?? false;
  }

  /**
   * Check if user has management access to event (ADR-010 compliant)
   * - Root: always
   * - Admin with has_full_access: always
   * - Others: only their own events
   */
  function hasEventManagementAccess(event: CalendarEvent): boolean {
    if (isRoot) return true;
    if (isAdmin && hasFullAccess) return true;
    return event.userId === currentUserId;
  }

  /** Check if event end time is in the past */
  function isEventPast(event: CalendarEvent): boolean {
    return new Date(event.endTime) < new Date();
  }

  /** Check if user can edit event (past events are locked) */
  function canEditEvent(event: CalendarEvent): boolean {
    if (isEventPast(event)) return false;
    return hasEventManagementAccess(event);
  }

  /** Check if user can delete event */
  function canDeleteEvent(event: CalendarEvent): boolean {
    return hasEventManagementAccess(event);
  }

  function reset() {
    currentUserId = null;
    isAdmin = false;
    isRoot = false;
    hasFullAccess = false;
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
    isEventPast,
    canEditEvent,
    canDeleteEvent,
    reset,
  };
}

export const userState = createUserState();
