// =============================================================================
// CALENDAR - REACTIVE STATE (Svelte 5 Runes)
// Main entry point - composes all state modules
// =============================================================================

import { dataState } from './state-data.svelte';
import { uiState } from './state-ui.svelte';
import { userState } from './state-user.svelte';

import type { CalendarInstance } from '@event-calendar/core';

// Calendar instance (only reference that lives here)
let calendar = $state<CalendarInstance | null>(null);

/**
 * Set calendar instance
 */
function setCalendar(instance: CalendarInstance | null) {
  calendar = instance;
}

/**
 * Refetch calendar events
 */
function refetchEvents() {
  calendar?.refetchEvents();
}

/**
 * Reset all state to initial values
 */
function reset() {
  calendar = null;
  userState.reset();
  dataState.reset();
  uiState.reset();
}

/**
 * Unified calendar state - re-exports all modules
 */
export const calendarState = {
  // Calendar instance
  get calendar() {
    return calendar;
  },
  setCalendar,
  refetchEvents,

  // User state
  get currentUserId() {
    return userState.currentUserId;
  },
  get isAdmin() {
    return userState.isAdmin;
  },
  get userRole() {
    return userState.userRole;
  },
  get isDummy() {
    return userState.isDummy;
  },
  get canCreateEvents() {
    return userState.canCreateEvents;
  },
  setUser: userState.setUser,
  isEventPast: userState.isEventPast,
  canEditEvent: userState.canEditEvent,
  canDeleteEvent: userState.canDeleteEvent,

  // Data state
  get departments() {
    return dataState.departments;
  },
  get teams() {
    return dataState.teams;
  },
  get areas() {
    return dataState.areas;
  },
  get employees() {
    return dataState.employees;
  },
  setOrganizationData: dataState.setOrganizationData,
  getDepartmentById: dataState.getDepartmentById,
  getTeamById: dataState.getTeamById,
  getTeamsByDepartment: dataState.getTeamsByDepartment,
  getEmployeeById: dataState.getEmployeeById,

  // UI state
  get isLoading() {
    return uiState.isLoading;
  },
  get currentFilter() {
    return uiState.currentFilter;
  },
  get currentSearch() {
    return uiState.currentSearch;
  },
  get calendarView() {
    return uiState.calendarView;
  },
  get selectedAttendees() {
    return uiState.selectedAttendees;
  },
  get eventToDelete() {
    return uiState.eventToDelete;
  },
  get showEventModal() {
    return uiState.showEventModal;
  },
  get showDetailModal() {
    return uiState.showDetailModal;
  },
  get showDeleteModal() {
    return uiState.showDeleteModal;
  },
  get editingEvent() {
    return uiState.editingEvent;
  },
  get viewingEvent() {
    return uiState.viewingEvent;
  },
  get selectedDate() {
    return uiState.selectedDate;
  },
  setLoading: uiState.setLoading,
  setFilter: uiState.setFilter,
  loadSavedFilter: uiState.loadSavedFilter,
  setSearch: uiState.setSearch,
  setView: uiState.setView,
  addAttendee: uiState.addAttendee,
  removeAttendee: uiState.removeAttendee,
  clearAttendees: uiState.clearAttendees,
  openEventModal: uiState.openEventModal,
  closeEventModal: uiState.closeEventModal,
  openDetailModal: uiState.openDetailModal,
  closeDetailModal: uiState.closeDetailModal,
  openDeleteModal: uiState.openDeleteModal,
  closeDeleteModal: uiState.closeDeleteModal,

  // Global reset
  reset,
};
