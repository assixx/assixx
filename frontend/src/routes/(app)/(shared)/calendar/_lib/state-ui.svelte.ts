// =============================================================================
// CALENDAR STATE - UI MODULE
// Modals, filters, loading, selections
// =============================================================================

import type { CalendarEvent, FilterLevel, ViewMode } from './types';

// Loading - start true to prevent FOUC
let isLoading = $state(true);

// Filters
let currentFilter = $state<FilterLevel>('all');
let currentSearch = $state('');
let calendarView = $state<ViewMode>('dayGridMonth');

// Selection
let selectedAttendees = $state<number[]>([]);
let eventToDelete = $state<number | null>(null);

// Modals
let showEventModal = $state(false);
let showDetailModal = $state(false);
let showDeleteModal = $state(false);
let editingEvent = $state<CalendarEvent | null>(null);
let viewingEvent = $state<CalendarEvent | null>(null);
let selectedDate = $state<Date | null>(null);

// Filter methods
function setFilter(filter: FilterLevel) {
  currentFilter = filter;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('calendarFilter', filter);
  }
}

function loadSavedFilter() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('calendarFilter') as FilterLevel | null;
    if (saved !== null) {
      currentFilter = saved;
    }
  }
}

function setSearch(query: string) {
  currentSearch = query;
}

function setView(view: ViewMode) {
  calendarView = view;
}

// Attendee methods
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

// Modal methods
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

function reset() {
  isLoading = false;
  currentFilter = 'all';
  currentSearch = '';
  calendarView = 'dayGridMonth';
  selectedAttendees = [];
  eventToDelete = null;
  showEventModal = false;
  showDetailModal = false;
  showDeleteModal = false;
  editingEvent = null;
  viewingEvent = null;
  selectedDate = null;
}

export const uiState = {
  // Getters
  get isLoading() {
    return isLoading;
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
  // Methods
  setLoading: (val: boolean) => {
    isLoading = val;
  },
  setFilter,
  loadSavedFilter,
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
  reset,
};
