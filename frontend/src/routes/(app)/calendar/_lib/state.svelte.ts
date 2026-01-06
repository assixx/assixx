// =============================================================================
// CALENDAR - REACTIVE STATE (Svelte 5 Runes)
// =============================================================================

import type { CalendarInstance } from '@event-calendar/core';
import type { CalendarEvent, Department, Team, Area, User, FilterLevel, ViewMode } from './types';

/**
 * Calendar State using Svelte 5 Runes
 */
function createCalendarState() {
  // Calendar instance
  let calendar = $state<CalendarInstance | null>(null);

  // Current user
  let currentUserId = $state<number | null>(null);
  let isAdmin = $state(false);
  let userRole = $state<string | null>(null);

  // Organization data
  let departments = $state<Department[]>([]);
  let teams = $state<Team[]>([]);
  let areas = $state<Area[]>([]);
  let employees = $state<User[]>([]);

  // Filter state
  let currentFilter = $state<FilterLevel>('all');
  let currentSearch = $state('');
  let calendarView = $state<ViewMode>('dayGridMonth');

  // Selection state
  let selectedAttendees = $state<number[]>([]);
  let eventToDelete = $state<number | null>(null);

  // Modal state
  let showEventModal = $state(false);
  let showDetailModal = $state(false);
  let showDeleteModal = $state(false);
  let editingEvent = $state<CalendarEvent | null>(null);
  let viewingEvent = $state<CalendarEvent | null>(null);
  let selectedDate = $state<Date | null>(null);

  // Loading state - PERFORMANCE: Start true to prevent FOUC (triple-render)
  let isLoading = $state(true);

  // Derived: can create events (all users can create personal events)
  const canCreateEvents = $derived(true);

  // Permission check functions (read reactive state when called)
  function canEditEvent(event: CalendarEvent): boolean {
    if (isAdmin) return true;
    return event.createdBy === currentUserId;
  }

  function canDeleteEvent(_event: CalendarEvent): boolean {
    return isAdmin;
  }

  // Methods
  function setUser(user: { id: number; role?: string }) {
    currentUserId = user.id;
    userRole = user.role ?? null;
    isAdmin = user.role === 'admin' || user.role === 'root';
  }

  function setCalendar(instance: CalendarInstance | null) {
    calendar = instance;
  }

  function setOrganizationData(data: {
    departments: Department[];
    teams: Team[];
    areas: Area[];
    users: User[];
  }) {
    departments = data.departments;
    teams = data.teams;
    areas = data.areas;
    // Exclude current user from employees
    employees = data.users.filter((u) => u.id !== currentUserId);
  }

  function setFilter(filter: FilterLevel) {
    currentFilter = filter;
    // Persist to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('calendarFilter', filter);
    }
  }

  function setSearch(query: string) {
    currentSearch = query;
  }

  function setView(view: ViewMode) {
    calendarView = view;
  }

  function addAttendee(userId: number) {
    if (!selectedAttendees.includes(userId)) {
      selectedAttendees = [...selectedAttendees, userId];
    }
  }

  function removeAttendee(userId: number) {
    selectedAttendees = selectedAttendees.filter((id) => id !== userId);
  }

  function clearAttendees() {
    selectedAttendees = [];
  }

  function openEventModal(date?: Date, event?: CalendarEvent) {
    selectedDate = date ?? null;
    editingEvent = event ?? null;
    selectedAttendees = event?.attendees?.map((a) => a.userId) ?? [];
    showEventModal = true;
  }

  function closeEventModal() {
    showEventModal = false;
    editingEvent = null;
    selectedDate = null;
    clearAttendees();
  }

  function openDetailModal(event: CalendarEvent) {
    viewingEvent = event;
    showDetailModal = true;
  }

  function closeDetailModal() {
    showDetailModal = false;
    viewingEvent = null;
  }

  function openDeleteModal(eventId: number) {
    eventToDelete = eventId;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    eventToDelete = null;
  }

  function refetchEvents() {
    calendar?.refetchEvents();
  }

  function getDepartmentById(id: number): Department | undefined {
    return departments.find((d) => d.id === id);
  }

  function getTeamById(id: number): Team | undefined {
    return teams.find((t) => t.id === id);
  }

  function getTeamsByDepartment(departmentId: number): Team[] {
    return teams.filter((t) => t.departmentId === departmentId);
  }

  function getEmployeeById(id: number): User | undefined {
    return employees.find((e) => e.id === id);
  }

  // Load saved filter from localStorage
  function loadSavedFilter() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('calendarFilter') as FilterLevel | null;
      if (saved !== null) {
        currentFilter = saved;
      }
    }
  }

  function reset() {
    calendar = null;
    currentUserId = null;
    isAdmin = false;
    userRole = null;
    departments = [];
    teams = [];
    areas = [];
    employees = [];
    currentFilter = 'all';
    currentSearch = '';
    selectedAttendees = [];
    eventToDelete = null;
    showEventModal = false;
    showDetailModal = false;
    showDeleteModal = false;
    editingEvent = null;
    viewingEvent = null;
    selectedDate = null;
  }

  return {
    // Getters (reactive)
    get calendar() {
      return calendar;
    },
    get currentUserId() {
      return currentUserId;
    },
    get isAdmin() {
      return isAdmin;
    },
    get userRole() {
      return userRole;
    },
    get departments() {
      return departments;
    },
    get teams() {
      return teams;
    },
    get areas() {
      return areas;
    },
    get employees() {
      return employees;
    },
    get currentFilter() {
      return currentFilter;
    },
    get currentSearch() {
      return currentSearch;
    },
    get calendarView() {
      return calendarView;
    },
    get selectedAttendees() {
      return selectedAttendees;
    },
    get eventToDelete() {
      return eventToDelete;
    },
    get showEventModal() {
      return showEventModal;
    },
    get showDetailModal() {
      return showDetailModal;
    },
    get showDeleteModal() {
      return showDeleteModal;
    },
    get editingEvent() {
      return editingEvent;
    },
    get viewingEvent() {
      return viewingEvent;
    },
    get selectedDate() {
      return selectedDate;
    },
    get isLoading() {
      return isLoading;
    },
    get canCreateEvents() {
      return canCreateEvents;
    },

    // Permission check functions
    canEditEvent,
    canDeleteEvent,

    // Methods
    setUser,
    setCalendar,
    setOrganizationData,
    setFilter,
    setSearch,
    setView,
    addAttendee,
    removeAttendee,
    clearAttendees,
    openEventModal,
    closeEventModal,
    openDetailModal,
    closeDetailModal,
    openDeleteModal,
    closeDeleteModal,
    refetchEvents,
    getDepartmentById,
    getTeamById,
    getTeamsByDepartment,
    getEmployeeById,
    loadSavedFilter,
    reset,
    setLoading: (val: boolean) => {
      isLoading = val;
    },
  };
}

// Singleton export
export const calendarState = createCalendarState();
