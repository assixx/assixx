/* eslint-disable max-lines */
/**
 * Calendar System - Refactored Index
 * Main orchestration file for calendar functionality
 *
 * ARCHITECTURE:
 * - Imports from modular files (types, state, api, modals, filters, ui)
 * - Event handlers and orchestration only
 * - Reduced from 4519 lines → ~800 lines (82% reduction)
 */

// ============================================================================
// IMPORTS - External Dependencies
// ============================================================================

import type { EventClickArg, DateSelectArg, EventHoveringArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import { $$, $$id, $all, setHTML } from '../../utils/dom-utils';
import { getAuthToken } from '../auth/index';
import { showErrorAlert } from '../utils/alerts';
import { shiftCalendarIntegration } from '../shifts/calendar-integration';
// ============================================================================
// IMPORTS - Calendar Modules
// ============================================================================
import type { CalendarEvent } from './types';
import { state } from './state';
import * as api from './api';
import * as modals from './modals';
import * as filters from './filters';
import * as ui from './ui';
import { initializeCalendar } from './fullcalendar-loader';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * CSS class for fullscreen mode
 */
const FULLSCREEN_MODE_CLASS = 'calendar-fullscreen-mode';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Simple Modal Manager - Replaces deprecated modal-manager.ts
 * Only handles show/hide logic for Design System modals
 */
const modalTemplates = new Map<string, string>();

function registerModalTemplate(id: string, template: string): void {
  modalTemplates.set(id, template);
}

function showModal(modalId: string, config?: { onOpen?: () => void }): void {
  let modal = $$id(modalId);

  // Create modal if it doesn't exist
  if (!modal) {
    const template = modalTemplates.get(modalId);
    if (template === undefined || template === '') return;

    const div = document.createElement('div');
    // eslint-disable-next-line no-unsanitized/property -- Template content is controlled internally
    div.innerHTML = template;
    modal = div.firstElementChild as HTMLElement;
    document.body.append(modal);
  }

  // Show modal with Design System BEM modifier class
  modal.classList.remove('modal-overlay--active');
  void modal.offsetHeight; // Force reflow
  window.requestAnimationFrame(() => {
    modal.classList.add('modal-overlay--active');
    config?.onOpen?.();
  });
}

function hideModal(modalId: string): void {
  const modal = $$id(modalId);
  if (!modal) return;

  modal.classList.remove('modal-overlay--active');
  setTimeout(() => {
    modal.remove();
  }, 300);
}

/**
 * Check if user is logged in
 */
function checkLoggedIn(): void {
  const token = getAuthToken();
  if (token === null || token === '') {
    console.error('No authentication token found');
    window.location.href = '/login';
    throw new Error('No authentication token found');
  }
}

// Store dropdown cleanup functions to prevent memory leaks
const dropdownCleanupFunctions: (() => void)[] = [];

/**
 * Initialize a single dropdown (generic handler)
 * Uses event delegation to prevent memory leaks
 */
function initDropdown(
  triggerId: string,
  menuId: string,
  hiddenInputId: string,
  updateCallback?: (value: string) => void,
): void {
  const trigger = $$(triggerId);
  const menu = $$(menuId);
  const hiddenInput = $$(hiddenInputId) as HTMLInputElement | null;

  if (trigger === null || menu === null) {
    console.warn(`[CALENDAR] Dropdown elements not found: ${triggerId}, ${menuId}`);
    return;
  }

  // Toggle menu on trigger click
  const triggerHandler = (e: Event): void => {
    e.stopPropagation();
    trigger.classList.toggle('active');
    menu.classList.toggle('active');
  };
  trigger.addEventListener('click', triggerHandler);

  // Handle option selection (event delegation on menu)
  const optionsHandler = (e: Event): void => {
    const target = e.target as HTMLElement;
    const option = target.closest('.dropdown__option');
    if (option === null || !(option instanceof HTMLElement)) return;

    const value = option.dataset['value'] ?? '';
    const text = option.textContent;

    // Update hidden input
    if (hiddenInput !== null) {
      hiddenInput.value = value;
    }

    // Update trigger text
    const triggerSpan = trigger.querySelector('span');
    if (triggerSpan !== null) {
      triggerSpan.textContent = text;
    }

    // Close menu
    menu.classList.remove('active');
    trigger.classList.remove('active');

    // Call update callback if provided
    if (updateCallback !== undefined) {
      updateCallback(value);
    }
  };
  menu.addEventListener('click', optionsHandler);

  // Close menu on outside click
  const outsideHandler = (e: Event): void => {
    const target = e.target as HTMLElement;
    if (!trigger.contains(target) && !menu.contains(target)) {
      menu.classList.remove('active');
      trigger.classList.remove('active');
    }
  };
  document.addEventListener('click', outsideHandler);

  // Store cleanup function
  dropdownCleanupFunctions.push(() => {
    trigger.removeEventListener('click', triggerHandler);
    menu.removeEventListener('click', optionsHandler);
    document.removeEventListener('click', outsideHandler);
  });
}

/**
 * Cleanup all dropdown event listeners
 * Prevents memory leaks when modal is closed
 */
function cleanupCalendarDropdowns(): void {
  console.info('[CALENDAR] Cleaning up dropdown event listeners...');
  dropdownCleanupFunctions.forEach((cleanup) => {
    cleanup();
  });
  dropdownCleanupFunctions.length = 0; // Clear array
  console.info('[CALENDAR] Dropdown cleanup complete');
}

/**
 * Initialize all calendar form dropdowns
 * Called when event form modal opens
 */
function initCalendarDropdowns(): void {
  console.info('[CALENDAR] Initializing form dropdowns...');

  // Clean up any existing listeners first
  cleanupCalendarDropdowns();

  // Org Level Dropdown
  initDropdown('#orgLevelWrapper .dropdown__trigger', '#orgLevelDropdown', '#eventOrgLevel', (value) => {
    ui.updateOrgIdDropdown(value);
  });

  // Department Dropdown
  initDropdown('#departmentDisplay', '#departmentDropdown', '#eventDepartmentId');

  // Team Dropdown
  initDropdown('#teamDisplay', '#teamDropdown', '#eventTeamId');

  // Recurrence Dropdown
  initDropdown('#recurrenceWrapper .dropdown__trigger', '#recurrenceDropdown', '#eventRecurrence', (value) => {
    const endWrapper = $$('#recurrenceEndWrapper');
    if (endWrapper !== null) {
      if (value !== '') {
        endWrapper.style.display = 'block';
      } else {
        endWrapper.style.display = 'none';
      }
    }
  });

  // Recurrence End Type Dropdown
  initDropdown(
    '#recurrenceEndTypeWrapper .dropdown__trigger',
    '#recurrenceEndDropdown',
    '#eventRecurrenceEndType',
    (value) => {
      const detailsDiv = $$('#recurrenceEndDetails');
      const countInput = $$('#eventRecurrenceCount');
      const untilInput = $$('#eventRecurrenceUntil');

      if (detailsDiv !== null && countInput !== null && untilInput !== null) {
        if (value === 'after') {
          detailsDiv.style.display = 'block';
          countInput.style.display = 'block';
          untilInput.style.display = 'none';
        } else if (value === 'until') {
          detailsDiv.style.display = 'block';
          countInput.style.display = 'none';
          untilInput.style.display = 'block';
        } else {
          detailsDiv.style.display = 'none';
          countInput.style.display = 'none';
          untilInput.style.display = 'none';
        }
      }
    },
  );

  // Reminder Dropdown
  initDropdown('#reminderWrapper .dropdown__trigger', '#reminderDropdown', '#eventReminderTime');

  console.info('[CALENDAR] Form dropdowns initialized');
}

/**
 * Ensure user data is loaded
 */
function ensureUserDataLoaded(): void {
  if (state.currentUserId === null || state.currentUserId === 0) {
    const userStr = localStorage.getItem('user');
    if (userStr !== null && userStr !== '') {
      try {
        const user = JSON.parse(userStr) as { id: number; role?: string };
        state.setUser(user);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    }
  }
}

/**
 * Check if user has permission to create events
 * All authenticated users can create events (employees: personal only)
 */
function checkEventPermission(): boolean {
  // All users can create events - employees can create personal events
  // The modal will be configured to only show personal option for employees
  return true;
}

/**
 * Helper to set selected organization ID in form
 */
function selectOrgId(id: number, name: string): void {
  const selectedOrgIdElement = $$('#selectedOrgId');
  const eventOrgIdElement = $$('#eventOrgId') as HTMLInputElement | null;

  if (selectedOrgIdElement) {
    selectedOrgIdElement.textContent = name;
  }
  if (eventOrgIdElement !== null) {
    eventOrgIdElement.value = id.toString();
  }
}

// ============================================================================
// MODAL REGISTRATION
// ============================================================================

/**
 * Register all modal templates
 */
function registerModalTemplates(): void {
  console.info('Calendar: Registering modal templates...');

  registerModalTemplate('eventFormModal', modals.getEventFormModalTemplate());
  registerModalTemplate('eventDetailModal', modals.getEventDetailModalTemplate());
  registerModalTemplate('attendeesModal', modals.getAttendeesModalTemplate());
  registerModalTemplate('eventResponseModal', modals.getEventResponseModalTemplate());
  registerModalTemplate('confirmationModal', modals.getConfirmationModalTemplate());

  console.info('Calendar: All modal templates registered');
}

// ============================================================================
// FULLCALENDAR INITIALIZATION
// ============================================================================

/**
 * Handle date click (create event on click)
 * All users can create events (employees: personal only, admins: all types)
 */
function handleDateClick(info: { date: Date; allDay: boolean }, _userRole: string | null): void {
  console.info('Calendar: Date clicked:', info);

  // Disable date click in fullscreen mode - only allow event detail view
  const isFullscreen = document.body.classList.contains(FULLSCREEN_MODE_CLASS);
  if (isFullscreen) {
    console.info('[CALENDAR] Date click disabled in fullscreen mode');
    return;
  }

  // All users can create events - modal will be configured based on role
  openEventForm(null, info.date, info.date, info.allDay);
}

/**
 * Handle date select (create event on drag)
 * All users can create events (employees: personal only, admins: all types)
 */
function handleDateSelect(info: DateSelectArg, _userRole: string | null): void {
  console.info('Calendar: Date range selected:', info);

  // Disable date selection in fullscreen mode - only allow event detail view
  const isFullscreen = document.body.classList.contains(FULLSCREEN_MODE_CLASS);
  if (isFullscreen) {
    console.info('[CALENDAR] Date selection disabled in fullscreen mode');
    return;
  }

  // All users can create events - modal will be configured based on role
  const allDay = info.allDay && info.view.type === 'dayGridMonth';
  openEventForm(null, info.start, info.end, allDay);
}

/**
 * Show event tooltip on hover using Design System tooltip component
 */
function showEventTooltip(info: EventHoveringArg): void {
  const extendedProps = info.event.extendedProps as {
    description?: string;
    location?: string;
  };
  const description = extendedProps.description ?? '';
  const location = extendedProps.location;

  // Build tooltip content
  let content = `<strong>${info.event.title}</strong>`;

  if (description !== '') {
    content += `<br>${description}`;
  }

  if (location !== undefined && location !== '') {
    content += `<br><i class="fas fa-map-marker-alt"></i> ${location}`;
  }

  // Create Design System tooltip (using --info semantic variant like admin-profile)
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip__content tooltip__content--info tooltip__content--bottom show';
  tooltip.setAttribute('role', 'tooltip');
  setHTML(tooltip, content);

  document.body.append(tooltip);

  // Position tooltip below event element
  const rect = info.el.getBoundingClientRect();
  tooltip.style.position = 'fixed'; // Use fixed for viewport positioning
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.bottom + 8}px`;
  tooltip.style.transform = 'translateX(-50%)'; // Center horizontally

  (info.el as HTMLElement & { _tooltip?: HTMLElement })._tooltip = tooltip;
}

/**
 * Hide event tooltip
 */
function hideEventTooltip(info: EventHoveringArg): void {
  const el = info.el as HTMLElement & { _tooltip?: HTMLElement };
  if (el._tooltip) {
    el._tooltip.remove();
    delete el._tooltip;
  }
}

// ============================================================================
// VIEW EVENT
// ============================================================================

/**
 * View event details
 */
async function viewEvent(eventId: number): Promise<void> {
  try {
    // Get token from localStorage
    const token = getAuthToken();
    if (token === null || token === '') {
      window.location.href = '/login';
      throw new Error('No token found');
    }

    // Ensure currentUserId and isAdmin are set
    ensureUserDataLoaded();

    // Fetch and normalize event data
    const event = await api.fetchEventData(eventId);

    // Build modal content
    const modalContent = modals.buildEventModalContent(event);

    // Show modal with content
    showModal('eventDetailModal', {
      onOpen: () => {
        // Inject content into modal body
        const modalBody = $$('#eventDetailContent');
        if (modalBody) {
          // Clear existing content
          while (modalBody.firstChild) {
            modalBody.firstChild.remove();
          }
          // Use setHTML from dom-utils for safe HTML setting
          // modalContent is already escaped via escapeHtml() function
          setHTML(modalBody, modalContent);
        }
      },
    });
  } catch (error: unknown) {
    console.error('Error viewing event:', error);
    showErrorAlert('Fehler beim Laden der Termindetails.');
  }
}

// ============================================================================
// RESPOND TO EVENT
// ============================================================================

/**
 * Respond to event invitation
 */
async function respondToEvent(eventId: number, response: string): Promise<void> {
  try {
    const success = await api.respondToEvent(eventId, response);

    if (success) {
      // Close event details modal
      hideModal('eventDetailsModal');

      // Refresh calendar and upcoming events
      state.calendar?.refetchEvents();

      const upcomingEvents = await api.loadUpcomingEvents();
      ui.displayUpcomingEvents(upcomingEvents, viewEvent);

      // Update badge in navigation
      if (window.unifiedNav) {
        window.unifiedNav.updateUnreadCalendarEvents();
      }

      // Reload the page to refresh everything
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  } catch (error: unknown) {
    console.error('Error responding to event:', error);
  }
}

// ============================================================================
// DELETE EVENT
// ============================================================================

/**
 * Delete event
 */
function deleteEvent(eventId: number): void {
  console.info('[CALENDAR] deleteEvent called with ID:', eventId);

  // Store the event ID in state
  state.eventToDelete = eventId;

  // Show confirmation modal using modalManager
  showModal('confirmationModal', {
    onOpen: () => {
      console.info('[CALENDAR] Confirmation modal opened, eventToDelete:', state.eventToDelete);

      // Add click handler to the delete button when modal opens
      const confirmBtn = $$('#confirmDeleteBtn');
      if (confirmBtn) {
        confirmBtn.dataset['action'] = 'confirm-delete-event';
        confirmBtn.dataset['eventId'] = state.eventToDelete?.toString() ?? '';
      }
    },
  });
}

/**
 * Confirm and execute event deletion
 */
async function confirmDeleteEvent(): Promise<void> {
  console.info('[CALENDAR] confirmDeleteEvent called, eventToDelete:', state.eventToDelete);

  if (state.eventToDelete === null) {
    console.error('[CALENDAR] No event ID to delete');
    hideModal('confirmationModal');
    return;
  }

  // Store the ID locally to avoid race conditions
  const eventId = state.eventToDelete;
  // Clear the global variable immediately to prevent race conditions
  state.eventToDelete = null;

  const success = await api.deleteEventById(eventId);

  if (success) {
    hideModal('confirmationModal');
    hideModal('eventDetailModal');

    // Refresh calendar
    state.calendar?.refetchEvents();

    const upcomingEvents = await api.loadUpcomingEvents();
    ui.displayUpcomingEvents(upcomingEvents, viewEvent);
  }
}

// ============================================================================
// ATTENDEES MANAGEMENT
// ============================================================================

/**
 * Add attendee
 */
function addAttendee(userId: number, _name: string): void {
  state.addAttendee(userId);
  ui.updateSelectedAttendees();

  // Clear search
  const searchInput = $$('#attendeeSearch') as HTMLInputElement | null;
  const searchResults = $$('#attendeeSearchResults');
  if (searchInput !== null) searchInput.value = '';
  if (searchResults !== null) searchResults.innerHTML = '';
}

/**
 * Remove attendee
 */
function removeAttendee(userId: number): void {
  state.removeAttendee(userId);
  ui.updateSelectedAttendees();
}

// ============================================================================
// OPEN EVENT FORM
// ============================================================================

/**
 * Format Date to datetime-local input format (YYYY-MM-DDTHH:MM) using local timezone
 * NOTE: Use this instead of toISOString() to avoid UTC conversion issues
 */
function formatDatetimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Open event form for creating or editing
 */
function openEventForm(eventId: number | null, startDate: Date | null, endDate: Date | null, allDay: boolean): void {
  console.info('[CALENDAR] Opening event form:', { eventId, startDate, endDate, allDay });

  // Show modal
  showModal('eventFormModal', {
    onOpen: () => {
      void initializeEventForm(eventId, startDate, endDate, allDay);
    },
  });
}

/**
 * Initialize event form (extracted for lower complexity)
 */
async function initializeEventForm(
  eventId: number | null,
  startDate: Date | null,
  endDate: Date | null,
  allDay: boolean,
): Promise<void> {
  // Set form mode
  setFormTitle(eventId);

  // Configure modal based on user role (hide org selects for employees)
  configureModalForRole();

  // Load departments, teams, and areas first
  await api.loadDepartmentsAndTeams();

  // Populate organization dropdowns with loaded data
  populateOrgDropdowns();

  // Initialize dropdown event handlers
  initCalendarDropdowns();

  // Populate dropdowns (will be populated when org level changes)
  ui.updateOrgIdDropdown('company');

  // If editing, load event data
  if (eventId !== null) {
    await editEvent(eventId);
  } else {
    await initializeNewEvent(startDate, endDate, allDay);
  }

  // Setup attendee search
  setupAttendeeSearch();

  // Setup company-wide toggle
  setupCompanyWideToggle();
}

/**
 * Clear and disable organization selects
 */
function disableOrgSelects(
  areaSelect: HTMLSelectElement | null,
  deptSelect: HTMLSelectElement | null,
  teamSelect: HTMLSelectElement | null,
): void {
  if (areaSelect) {
    areaSelect.disabled = true;
    Array.from(areaSelect.options).forEach((opt) => (opt.selected = false));
  }
  if (deptSelect) {
    deptSelect.disabled = true;
    Array.from(deptSelect.options).forEach((opt) => (opt.selected = false));
  }
  if (teamSelect) {
    teamSelect.disabled = true;
    Array.from(teamSelect.options).forEach((opt) => (opt.selected = false));
  }
}

/**
 * Enable organization selects
 */
function enableOrgSelects(
  areaSelect: HTMLSelectElement | null,
  deptSelect: HTMLSelectElement | null,
  teamSelect: HTMLSelectElement | null,
): void {
  if (areaSelect) areaSelect.disabled = false;
  if (deptSelect) deptSelect.disabled = false;
  if (teamSelect) teamSelect.disabled = false;
}

/**
 * Setup company-wide toggle event listener
 * Disables/enables organization selects based on toggle state
 */
function setupCompanyWideToggle(): void {
  const companyToggle = $$('#event-company-wide') as HTMLInputElement | null;
  if (!companyToggle) return;

  companyToggle.addEventListener('change', () => {
    const areaSelect = $$('#event-area-select') as HTMLSelectElement | null;
    const deptSelect = $$('#event-department-select') as HTMLSelectElement | null;
    const teamSelect = $$('#event-team-select') as HTMLSelectElement | null;

    if (companyToggle.checked) {
      disableOrgSelects(areaSelect, deptSelect, teamSelect);
      console.info('[CALENDAR] Company-wide mode enabled - organization selects disabled');
    } else {
      enableOrgSelects(areaSelect, deptSelect, teamSelect);
      console.info('[CALENDAR] Company-wide mode disabled - organization selects enabled');
    }
  });
}

/**
 * Set form title based on mode
 */
function setFormTitle(eventId: number | null): void {
  const titleElement = $$('#eventFormModalLabel');
  if (titleElement !== null) {
    titleElement.textContent = eventId !== null ? 'Termin bearbeiten' : 'Neuer Termin';
  }
}

/**
 * Populate organization dropdowns (areas, departments, teams)
 * Called after loadDepartmentsAndTeams() completes
 */
function populateOrgDropdowns(): void {
  // Populate Areas
  const areaSelect = $$('#event-area-select') as HTMLSelectElement | null;
  if (areaSelect !== null) {
    areaSelect.innerHTML = ''; // Clear existing options
    state.areas.forEach((area) => {
      const option = document.createElement('option');
      option.value = area.id.toString();
      option.textContent = area.name;
      areaSelect.appendChild(option);
    });
    console.info('[CALENDAR] Populated areas dropdown:', state.areas.length);
  }

  // Populate Departments
  const departmentSelect = $$('#event-department-select') as HTMLSelectElement | null;
  if (departmentSelect !== null) {
    departmentSelect.innerHTML = ''; // Clear existing options
    state.departments.forEach((dept) => {
      const option = document.createElement('option');
      option.value = dept.id.toString();
      option.textContent = dept.name;
      departmentSelect.appendChild(option);
    });
    console.info('[CALENDAR] Populated departments dropdown:', state.departments.length);
  }

  // Populate Teams
  const teamSelect = $$('#event-team-select') as HTMLSelectElement | null;
  if (teamSelect !== null) {
    teamSelect.innerHTML = ''; // Clear existing options
    state.teams.forEach((team) => {
      const option = document.createElement('option');
      option.value = team.id.toString();
      option.textContent = team.name;
      teamSelect.appendChild(option);
    });
    console.info('[CALENDAR] Populated teams dropdown:', state.teams.length);
  }
}

/**
 * Initialize form for new event
 */
async function initializeNewEvent(startDate: Date | null, endDate: Date | null, allDay: boolean): Promise<void> {
  // Set dates for new event
  const startInput = $$('#eventStart') as HTMLInputElement | null;
  const endInput = $$('#eventEnd') as HTMLInputElement | null;
  const allDayCheckbox = $$('#eventAllDay') as HTMLInputElement | null;

  if (startDate !== null && startInput !== null) {
    // Use local timezone formatting instead of toISOString() to avoid UTC conversion
    startInput.value = formatDatetimeLocal(startDate);
  }
  if (endDate !== null && endInput !== null) {
    // Use local timezone formatting instead of toISOString() to avoid UTC conversion
    endInput.value = formatDatetimeLocal(endDate);
  }
  if (allDayCheckbox !== null) {
    allDayCheckbox.checked = allDay;
  }

  // Clear attendees
  state.clearAttendees();
  ui.updateSelectedAttendees();

  // Load employees list for attendee selection
  await api.loadEmployeesList();
  ui.populateAttendeesList(state.employees);
}

/**
 * Edit existing event
 */
async function editEvent(eventId: number): Promise<void> {
  try {
    const event = await api.fetchEventData(eventId);

    // Populate all form sections
    populateBasicEventFields(event);
    populateEventDateTime(event);
    populateEventSettings(event);
    await populateEventAttendees(event);

    // Store event ID for saving
    const eventIdInput = $$('#eventId') as HTMLInputElement | null;
    if (eventIdInput !== null) {
      eventIdInput.value = eventId.toString();
    }
  } catch (error: unknown) {
    console.error('[CALENDAR] Error loading event for edit:', error);
    showErrorAlert('Fehler beim Laden des Termins.');
  }
}

/**
 * Populate basic event form fields
 */
function populateBasicEventFields(event: CalendarEvent): void {
  const titleInput = $$('#eventTitle') as HTMLInputElement | null;
  const descInput = $$('#eventDescription') as HTMLTextAreaElement | null;
  const locationInput = $$('#eventLocation') as HTMLInputElement | null;

  if (titleInput !== null) titleInput.value = event.title;
  if (descInput !== null) descInput.value = event.description ?? '';
  if (locationInput !== null) locationInput.value = event.location ?? '';
}

/**
 * Populate event date and time fields
 */
function populateEventDateTime(event: CalendarEvent): void {
  const startInput = $$('#eventStart') as HTMLInputElement | null;
  const endInput = $$('#eventEnd') as HTMLInputElement | null;
  const allDayCheckbox = $$('#eventAllDay') as HTMLInputElement | null;

  // Handle dates
  const startTime = event.start_time;
  const endTime = event.end_time;

  if (startInput !== null && startTime !== '') {
    const startDate = new Date(startTime);
    // Use local timezone formatting instead of toISOString() to avoid UTC conversion
    startInput.value = formatDatetimeLocal(startDate);
  }

  if (endInput !== null && endTime !== '') {
    const endDate = new Date(endTime);
    // Use local timezone formatting instead of toISOString() to avoid UTC conversion
    endInput.value = formatDatetimeLocal(endDate);
  }

  // All day
  if (allDayCheckbox !== null) {
    allDayCheckbox.checked = Boolean(event.all_day);
  }
}

/**
 * Populate event settings (org level, reminder, recurrence)
 */
function populateEventSettings(event: CalendarEvent): void {
  // Org level
  ui.updateOrgIdDropdown(event.org_level);

  // Set org ID based on level
  if ((event.org_level === 'department' || event.org_level === 'team') && event.org_id !== undefined) {
    selectOrgId(event.org_id, '');
  }

  // Reminder
  const reminderMinutes = event.reminder_time ?? 0;
  const reminderBtn = $$('#reminderDisplay');
  if (reminderBtn !== null) {
    reminderBtn.textContent = api.getReminderText(reminderMinutes);
  }
  const reminderInput = $$('#eventReminder') as HTMLInputElement | null;
  if (reminderInput !== null) {
    reminderInput.value = reminderMinutes.toString();
  }

  // Recurrence (not implemented in current API)
  const recurrenceBtn = $$('#recurrenceDisplay');
  if (recurrenceBtn !== null) {
    recurrenceBtn.textContent = 'Keine';
  }
  const recurrenceInput = $$('#eventRecurrence') as HTMLInputElement | null;
  if (recurrenceInput !== null) {
    recurrenceInput.value = 'none';
  }
}

/**
 * Populate event attendees
 */
async function populateEventAttendees(event: CalendarEvent): Promise<void> {
  // Load attendees - convert to user IDs
  const attendeeIds = (event.attendees ?? [])
    .map((a: { userId?: number; user_id?: number }) => a.userId ?? a.user_id ?? 0)
    .filter((id: number) => id !== 0);
  state.selectedAttendees = attendeeIds;
  ui.updateSelectedAttendees();

  // Load employees list for adding more attendees
  await api.loadEmployeesList();
  ui.populateAttendeesList(state.employees);
}

// ============================================================================
// SAVE EVENT
// ============================================================================

/**
 * Collect event form data
 */
interface EventFormData {
  eventId: number | null;
  titleInput: HTMLInputElement | null;
  descInput: HTMLTextAreaElement | null;
  locationInput: HTMLInputElement | null;
  startInput: HTMLInputElement | null;
  endInput: HTMLInputElement | null;
  allDayCheckbox: HTMLInputElement | null;
  reminderInput: HTMLInputElement | null;
  recurrenceInput: HTMLInputElement | null;
  orgLevel: 'personal' | 'company' | 'department' | 'team' | 'area';
  orgId: number | null;
}

function collectEventFormData(): EventFormData {
  const eventIdInput = $$('#eventId') as HTMLInputElement | null;
  const eventId = eventIdInput !== null && eventIdInput.value !== '' ? Number.parseInt(eventIdInput.value, 10) : null;

  // Read org_level from hidden input (updated by initDropdown)
  const orgLevelInput = $$('#eventOrgLevel') as HTMLInputElement | null;
  const orgIdInput = $$('#eventOrgId') as HTMLInputElement | null;
  const orgLevel = (orgLevelInput?.value ?? 'personal') as 'personal' | 'company' | 'department' | 'team' | 'area';
  const orgId = orgIdInput !== null && orgIdInput.value !== '' ? Number.parseInt(orgIdInput.value, 10) : null;

  return {
    eventId,
    titleInput: $$('#eventTitle') as HTMLInputElement | null,
    descInput: $$('#eventDescription') as HTMLTextAreaElement | null,
    locationInput: $$('#eventLocation') as HTMLInputElement | null,
    startInput: $$('#eventStart') as HTMLInputElement | null,
    endInput: $$('#eventEnd') as HTMLInputElement | null,
    allDayCheckbox: $$('#eventAllDay') as HTMLInputElement | null,
    reminderInput: $$('#eventReminder') as HTMLInputElement | null,
    recurrenceInput: $$('#eventRecurrence') as HTMLInputElement | null,
    orgLevel,
    orgId,
  };
}

/**
 * Validate event form data
 */
function validateEventFormData(formData: EventFormData): boolean {
  if (formData.titleInput === null || formData.titleInput.value.trim() === '') {
    showErrorAlert('Bitte geben Sie einen Titel ein.');
    return false;
  }

  if (formData.startInput === null || formData.startInput.value === '') {
    showErrorAlert('Bitte geben Sie eine Startzeit ein.');
    return false;
  }

  if (formData.endInput === null || formData.endInput.value === '') {
    showErrorAlert('Bitte geben Sie eine Endzeit ein.');
    return false;
  }

  return true;
}

/**
 * Normalize all-day event times (00:00 to 23:59)
 */
function normalizeAllDayTimes(startTime: string, endTime: string): { start: string; end: string } {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  return {
    start: formatDatetimeLocal(startDate),
    end: formatDatetimeLocal(endDate),
  };
}

/**
 * Assign org-specific ID based on org level
 */
function assignOrgId(eventData: api.EventSaveParams, orgLevel: string, orgId: number | null): void {
  if (orgId === null) return;

  if (orgLevel === 'department') {
    eventData.departmentId = orgId;
  } else if (orgLevel === 'team') {
    eventData.teamId = orgId;
  } else if (orgLevel === 'area') {
    eventData.areaId = orgId;
  }
}

/**
 * Build event save parameters
 */
function buildEventSaveParams(formData: EventFormData): api.EventSaveParams {
  // Get start/end times from form
  let startTime = formData.startInput?.value ?? '';
  let endTime = formData.endInput?.value ?? '';
  const isAllDay = formData.allDayCheckbox?.checked ?? false;

  // For all-day events, normalize times to 00:00 - 23:59
  if (isAllDay && startTime !== '' && endTime !== '') {
    const normalized = normalizeAllDayTimes(startTime, endTime);
    startTime = normalized.start;
    endTime = normalized.end;
  }

  // Build event data object
  const eventData: api.EventSaveParams = {
    title: formData.titleInput?.value.trim() ?? '',
    description: formData.descInput?.value.trim() ?? '',
    location: formData.locationInput?.value.trim() ?? '',
    startTime,
    endTime,
    allDay: isAllDay,
    orgLevel: formData.orgLevel,
    color: '#3788d8', // Default calendar blue
    reminderMinutes:
      formData.reminderInput !== null && formData.reminderInput.value !== ''
        ? Number.parseInt(formData.reminderInput.value, 10)
        : undefined,
    recurrenceRule: formData.recurrenceInput?.value !== 'none' ? formData.recurrenceInput?.value : undefined,
    attendeeIds: state.selectedAttendees.length > 0 ? state.selectedAttendees : undefined,
  };

  // Assign org-specific ID
  assignOrgId(eventData, formData.orgLevel, formData.orgId);

  return eventData;
}

/**
 * Handle successful event save
 */
async function handleEventSaveSuccess(): Promise<void> {
  // Close modal
  hideModal('eventFormModal');

  // Refresh calendar
  state.calendar?.refetchEvents();

  // Refresh upcoming events
  const upcomingEvents = await api.loadUpcomingEvents();
  ui.displayUpcomingEvents(upcomingEvents, viewEvent);
}

/**
 * Save event (create or update)
 */
async function saveEvent(): Promise<void> {
  console.info('[CALENDAR] Saving event...');

  // Collect form data
  const formData = collectEventFormData();

  // Validation
  if (!validateEventFormData(formData)) {
    return;
  }

  // Build event data
  const eventData = buildEventSaveParams(formData);
  console.info('[CALENDAR] Event data:', eventData);

  // Save via API
  const savedEventId = await api.saveEvent(eventData, formData.eventId ?? undefined);

  if (savedEventId !== null) {
    await handleEventSaveSuccess();
  }
}

// ============================================================================
// DROPDOWN HANDLERS
// ============================================================================

/**
 * Handle dropdown display click (toggle dropdown)
 */
function handleDropdownDisplay(e: Event, display: HTMLElement): void {
  e.stopPropagation();
  const dropdown = display.nextElementSibling;
  if (dropdown?.classList.contains('dropdown-options') === true) {
    dropdown.classList.toggle('show');
  }
}

/**
 * Get dropdown elements from option
 */
interface DropdownElements {
  value: string | undefined;
  label: string;
  dropdownOptions: Element;
  customDropdown: Element;
  display: Element;
}

function getDropdownElements(option: HTMLElement): DropdownElements | null {
  const dropdownOptions = option.closest('.dropdown-options');
  if (dropdownOptions === null) return null;

  const customDropdown = dropdownOptions.closest('.custom-dropdown');
  if (customDropdown === null) return null;

  const display = customDropdown.querySelector('.dropdown-display');
  if (display === null) return null;

  return {
    value: option.dataset['value'],
    label: option.textContent.trim(),
    dropdownOptions,
    customDropdown,
    display,
  };
}

/**
 * Update dropdown display
 */
function updateDropdownDisplay(elements: DropdownElements): void {
  // Update display text
  elements.display.textContent = elements.label;

  // Hide dropdown
  elements.dropdownOptions.classList.remove('show');
}

/**
 * Handle specific dropdown actions
 */
function handleDropdownAction(dropdownId: string, value: string | undefined): void {
  switch (dropdownId) {
    case 'orgLevelDropdown':
      if (value !== undefined) {
        ui.updateOrgIdDropdown(value as 'personal' | 'company' | 'department' | 'team');
      }
      break;

    case 'reminderDropdown': {
      const reminderInput = $$('#eventReminder') as HTMLInputElement | null;
      if (reminderInput !== null && value !== undefined) {
        reminderInput.value = value;
      }
      break;
    }

    case 'recurrenceDropdown': {
      const recurrenceInput = $$('#eventRecurrence') as HTMLInputElement | null;
      if (recurrenceInput !== null && value !== undefined) {
        recurrenceInput.value = value;
      }
      break;
    }
  }
}

/**
 * Handle dropdown option selection
 */
function handleDropdownOption(e: Event, option: HTMLElement): void {
  e.stopPropagation();

  // Get dropdown elements
  const elements = getDropdownElements(option);
  if (elements === null) return;

  // Update display
  updateDropdownDisplay(elements);

  // Handle dropdown-specific actions
  handleDropdownAction(elements.customDropdown.id, elements.value);
}

/**
 * Handle department selection
 */
function handleSelectDepartment(e: Event, option: HTMLElement): void {
  e.stopPropagation();

  const departmentId = option.dataset['departmentId'];
  const departmentName = option.textContent.trim();

  if (departmentId !== undefined) {
    selectOrgId(Number.parseInt(departmentId, 10), departmentName);
  }

  // Hide dropdown
  const dropdownOptions = option.closest('.dropdown-options');
  if (dropdownOptions !== null) {
    dropdownOptions.classList.remove('show');
  }
}

/**
 * Handle department selection with teams (show teams sub-menu)
 */
function handleSelectDepartmentWithTeams(e: Event, option: HTMLElement): void {
  e.stopPropagation();

  const departmentId = option.dataset['departmentId'];
  if (departmentId === undefined) return;

  const deptId = Number.parseInt(departmentId, 10);

  // Find teams for this department
  const teams = state.teams.filter((team) => team.departmentId === deptId);

  // Build teams submenu
  const teamsSubmenu = document.createElement('div');
  teamsSubmenu.className = 'dropdown-options show teams-submenu';
  teamsSubmenu.style.position = 'absolute';
  teamsSubmenu.style.left = '100%';
  teamsSubmenu.style.top = '0';

  teams.forEach((team) => {
    const teamOption = document.createElement('div');
    teamOption.className = 'dropdown-option';
    teamOption.dataset['action'] = 'select-team';
    teamOption.dataset['teamId'] = team.id.toString();
    teamOption.textContent = team.name;
    teamsSubmenu.append(teamOption);
  });

  // Remove any existing submenu
  const existingSubmenu = option.querySelector('.teams-submenu');
  if (existingSubmenu !== null) {
    existingSubmenu.remove();
  }

  // Append submenu
  option.style.position = 'relative';
  option.append(teamsSubmenu);
}

/**
 * Handle team selection
 */
function handleSelectTeam(e: Event, option: HTMLElement): void {
  e.stopPropagation();

  const teamId = option.dataset['teamId'];
  const teamName = option.textContent.trim();

  if (teamId !== undefined) {
    selectOrgId(Number.parseInt(teamId, 10), teamName);
  }

  // Hide all dropdowns
  $all('.dropdown-options').forEach((dropdown) => {
    dropdown.classList.remove('show');
  });
}

// ============================================================================
// ATTENDEE SEARCH
// ============================================================================

/**
 * Setup attendee search functionality
 */
function setupAttendeeSearch(): void {
  const searchInput = $$('#attendeeSearch') as HTMLInputElement | null;
  if (searchInput === null) return;

  searchInput.addEventListener('input', function (this: HTMLInputElement) {
    const query = this.value.trim().toLowerCase();
    const resultsContainer = $$('#attendeeSearchResults');

    if (resultsContainer === null) return;

    // Clear results
    while (resultsContainer.firstChild) {
      resultsContainer.firstChild.remove();
    }

    if (query === '') return;

    // Filter employees
    const matches = state.employees.filter((emp) => {
      const firstName = emp.firstName ?? '';
      const lastName = emp.lastName ?? '';
      const email = emp.email;

      return (
        firstName.toLowerCase().includes(query) ||
        lastName.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query)
      );
    });

    // Display results
    matches.slice(0, 10).forEach((emp) => {
      const resultItem = document.createElement('div');
      resultItem.className = 'attendee-search-result';
      resultItem.dataset['action'] = 'add-attendee';
      resultItem.dataset['userId'] = emp.id.toString();

      const displayName = ui.getUserDisplayName(emp);
      resultItem.textContent = displayName;

      resultsContainer.append(resultItem);
    });
  });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Handle data-action click events
 */
function handleActionClick(e: MouseEvent, actionElement: HTMLElement): void {
  const action = actionElement.dataset['action'];
  if (action === undefined || action === '') return;

  // Handle modal close action
  if (action === 'close') {
    const modal = actionElement.closest('.modal-overlay');
    if (modal instanceof HTMLElement && modal.id !== '') {
      hideModal(modal.id);
    }
    return;
  }

  // Shift toggle is handled by calendar-integration.ts via direct click handler
  if (action === 'toggle-shifts') {
    return;
  }

  // Handle event-related actions
  if (handleEventActions(action, actionElement)) return;

  // Handle attendee actions
  if (handleAttendeeActions(action, actionElement)) return;

  // Handle dropdown actions
  if (handleDropdownActions(action, actionElement, e)) return;

  // Unknown action
  console.warn('[CALENDAR] Unknown action:', action);
}

/**
 * Handle CRUD event actions
 */
function handleCrudEventActions(action: string, element: HTMLElement): boolean {
  switch (action) {
    case 'create-event':
      if (checkEventPermission()) {
        openEventForm(null, new Date(), new Date(), false);
      }
      return true;

    case 'save-event':
      void saveEvent();
      return true;

    case 'edit-event': {
      const eventId = element.dataset['eventId'];
      if (eventId !== undefined && eventId !== '') {
        hideModal('eventDetailModal');
        openEventForm(Number.parseInt(eventId, 10), null, null, false);
      }
      return true;
    }

    case 'delete-event': {
      const eventId = element.dataset['eventId'];
      if (eventId !== undefined && eventId !== '') {
        deleteEvent(Number.parseInt(eventId, 10));
      }
      return true;
    }
  }
  return false;
}

/**
 * Handle event view actions
 */
function handleViewEventActions(action: string, element: HTMLElement): boolean {
  switch (action) {
    case 'view-event':
    case 'show-event-details': {
      const eventId = element.dataset['eventId'];
      if (eventId !== undefined && eventId !== '') {
        void viewEvent(Number.parseInt(eventId, 10));
      }
      return true;
    }
  }
  return false;
}

/**
 * Handle event response actions
 */
function handleResponseEventActions(action: string, element: HTMLElement): boolean {
  switch (action) {
    case 'confirm-delete-event':
      void confirmDeleteEvent();
      return true;

    case 'respond-event': {
      const eventId = element.dataset['eventId'];
      const response = element.dataset['response'];
      if (eventId !== undefined && eventId !== '' && response !== undefined) {
        void respondToEvent(Number.parseInt(eventId, 10), response);
      }
      return true;
    }
  }
  return false;
}

/**
 * Handle event-related actions
 */
function handleEventActions(action: string, element: HTMLElement): boolean {
  // Try CRUD actions
  if (handleCrudEventActions(action, element)) return true;

  // Try view actions
  if (handleViewEventActions(action, element)) return true;

  // Try response actions
  if (handleResponseEventActions(action, element)) return true;

  return false;
}

/**
 * Handle attendee-related actions
 */
function handleAttendeeActions(action: string, element: HTMLElement): boolean {
  switch (action) {
    case 'add-attendee': {
      const userId = element.dataset['userId'];
      const userName = element.textContent.trim();
      if (userId !== undefined && userId !== '') {
        addAttendee(Number.parseInt(userId, 10), userName);
      }
      return true;
    }

    case 'remove-attendee': {
      const userId = element.dataset['userId'];
      if (userId !== undefined && userId !== '') {
        removeAttendee(Number.parseInt(userId, 10));
      }
      return true;
    }
  }
  return false;
}

/**
 * Handle dropdown-related actions
 */
function handleDropdownActions(action: string, element: HTMLElement, e: MouseEvent): boolean {
  switch (action) {
    case 'dropdown-display':
      handleDropdownDisplay(e, element);
      return true;

    case 'dropdown-option':
      handleDropdownOption(e, element);
      return true;

    case 'select-department':
      handleSelectDepartment(e, element);
      return true;

    case 'select-department-with-teams':
      handleSelectDepartmentWithTeams(e, element);
      return true;

    case 'select-team':
      handleSelectTeam(e, element);
      return true;
  }
  return false;
}

/**
 * Setup dropdown close handler
 */
function setupDropdownCloseHandler(): void {
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      $all('.dropdown-options').forEach((dropdown) => {
        dropdown.classList.remove('show');
      });
    }
  });
}

/**
 * Setup all event listeners using delegation pattern
 */
function setupEventListeners(): void {
  console.info('[CALENDAR] Setting up event listeners...');

  // Global click handler for data-action delegation
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Find element with data-action (could be parent)
    const actionElement = target.closest('[data-action]');
    if (!(actionElement instanceof HTMLElement)) return;

    handleActionClick(e, actionElement);
  });

  // Close dropdowns when clicking outside
  setupDropdownCloseHandler();

  console.info('[CALENDAR] Event listeners setup complete');
}

// ============================================================================
// FULLCALENDAR INITIALIZATION
// ============================================================================

// Console log separators
const LOG_SEPARATOR = '[CALENDAR] ========================================';

/**
 * Build calendar options
 * Extracted to reduce complexity of initializeFullCalendar
 */
function buildCalendarOptions(
  canEdit: boolean,
  userRole: string | null,
): Partial<import('@fullcalendar/core').CalendarOptions> {
  return {
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
    },
    // Explicit button texts for German locale (fixes missing text bug)
    // IMPORTANT: Use exact view names as keys, not generic names
    buttonText: {
      today: 'Heute',
      dayGridMonth: 'Monat',
      timeGridWeek: 'Woche',
      timeGridDay: 'Tag',
      listWeek: 'Liste',
    },
    editable: canEdit,
    selectable: canEdit,
    selectMirror: true,
    dayMaxEvents: true,
    weekends: true,
    nowIndicator: true,
    height: 'auto',

    // Event sources
    events: async (fetchInfo, successCallback, failureCallback) => {
      try {
        const events = await api.loadCalendarEvents(fetchInfo);
        successCallback(events);
      } catch (error: unknown) {
        console.error('[CALENDAR] Error loading events:', error);
        failureCallback(error as Error);
      }
    },

    // Event handlers
    eventClick: (info: EventClickArg) => {
      info.jsEvent.preventDefault();
      const eventId = Number.parseInt(info.event.id, 10);
      if (!Number.isNaN(eventId)) {
        void viewEvent(eventId);
      }
    },

    dateClick: (info: DateClickArg) => {
      handleDateClick({ date: info.date, allDay: info.allDay }, userRole);
    },

    select: (info: DateSelectArg) => {
      handleDateSelect(info, userRole);
    },

    eventMouseEnter: (info: EventHoveringArg) => {
      showEventTooltip(info);
    },

    eventMouseLeave: (info: EventHoveringArg) => {
      hideEventTooltip(info);
    },
  };
}

/**
 * Initialize FullCalendar using lazy loader
 */
async function initializeFullCalendar(): Promise<void> {
  console.info(LOG_SEPARATOR);
  console.info('[CALENDAR] STARTING FullCalendar Initialization...');
  console.info(LOG_SEPARATOR);

  const calendarElement = $$('#calendar');
  console.info('[CALENDAR] Calendar DOM element:', calendarElement);

  if (calendarElement === null) {
    console.error('[CALENDAR] ❌ Calendar element #calendar NOT FOUND in DOM!');
    return;
  }

  console.info('[CALENDAR] ✅ Calendar element found:', {
    id: calendarElement.id,
    className: calendarElement.className,
    parentElement: calendarElement.parentElement?.className,
  });

  const userRole = localStorage.getItem('userRole');
  const canEdit = userRole === 'admin' || userRole === 'root';

  console.info('[CALENDAR] User permissions:', { userRole, canEdit });

  try {
    console.info('[CALENDAR] 📦 Loading FullCalendar via lazy loader...');

    // Build calendar options
    const options = buildCalendarOptions(canEdit, userRole);

    // Use lazy loader for FullCalendar
    const { calendar } = await initializeCalendar(calendarElement, 'month', canEdit, options);

    // Store calendar instance in state
    state.calendar = calendar;

    console.info('[CALENDAR] ✅ Calendar instance created and stored in state');
    console.info('[CALENDAR] 🎨 Rendering calendar to DOM...');

    // Render the calendar
    calendar.render();

    console.info(LOG_SEPARATOR);
    console.info('[CALENDAR] ✅ FullCalendar initialized successfully!');
    console.info(LOG_SEPARATOR);
  } catch (error: unknown) {
    console.error(LOG_SEPARATOR);
    console.error('[CALENDAR] ❌ ERROR initializing FullCalendar!');
    console.error('[CALENDAR] Error details:', error);
    console.error(LOG_SEPARATOR);
    showErrorAlert('Fehler beim Laden des Kalenders.');
  }
}

// ============================================================================
// MAIN INITIALIZATION
// ============================================================================

/**
 * Setup UI event handlers (badges, buttons)
 * Extracted to reduce complexity of initializeApp
 */

// ============================================================================
// Event Creation Controls & Role-based Modal Configuration
// ============================================================================

/**
 * Render event creation button
 * All users can create events (employees: personal only, admins: all types)
 */
function renderCreateEventButton(): void {
  const container = $$('#newEventBtnContainer');
  if (container === null) {
    console.warn('[CALENDAR] newEventBtnContainer not found');
    return;
  }

  // All users can create events (employees can create personal events)
  const button = document.createElement('button');
  button.id = 'newEventBtn';
  button.className = 'btn btn-primary';
  button.setAttribute('data-action', 'create-event');
  button.innerHTML = '<i class="fas fa-plus mr-2"></i>Neuer Termin';

  container.appendChild(button);
  console.info('[CALENDAR] Create event button rendered');
}

/**
 * Configure modal for user role
 * Employees: Hide org selects, auto-set orgLevel to "personal"
 * Admins: Show all options
 */
function configureModalForRole(): void {
  const userRole = localStorage.getItem('userRole');
  const isAdmin = userRole === 'admin' || userRole === 'root';

  // Elements to hide for employees
  const adminOnlyElements = ['#adminOnlyOrgLevel', '#adminOnlyOrgSelects', '#adminOnlyAttendees'];

  if (!isAdmin) {
    // Employee: Hide org-related sections
    adminOnlyElements.forEach((selector) => {
      const element = $$(selector);
      if (element !== null) {
        element.style.display = 'none';
      }
    });

    // Auto-set orgLevel to "personal" for employees
    const orgLevelInput = $$('#eventOrgLevel') as HTMLInputElement | null;
    if (orgLevelInput !== null) {
      orgLevelInput.value = 'personal';
    }

    console.info('[CALENDAR] Modal configured for employee (personal events only)');
  } else {
    // Admin/Root: Show all sections
    adminOnlyElements.forEach((selector) => {
      const element = $$(selector);
      if (element !== null) {
        element.style.display = 'block';
      }
    });

    console.info('[CALENDAR] Modal configured for admin (all event types)');
  }
}

/**
 * Setup handler for create event button
 */
function setupCreateEventHandler(): void {
  console.info('[CALENDAR] Step 11: Setting up create event button...');
  const createEventBtn = $$('#createEventBtn');
  if (createEventBtn !== null) {
    createEventBtn.addEventListener('click', () => {
      if (checkEventPermission()) {
        openEventForm(null, new Date(), new Date(), false);
      }
    });
    console.info('[CALENDAR] ✅ Create event button handler attached');
  }
}

/**
 * Request native browser fullscreen mode
 */
async function requestFullscreenMode(): Promise<void> {
  try {
    // Add class for CSS styling
    document.body.classList.add(FULLSCREEN_MODE_CLASS);

    // Request native browser fullscreen (shows ESC hint)
    const elem = document.documentElement as Document['documentElement'] & {
      webkitRequestFullscreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };

    if ('requestFullscreen' in document.documentElement) {
      await document.documentElement.requestFullscreen();
    } else if (elem.webkitRequestFullscreen !== undefined) {
      await elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen !== undefined) {
      await elem.msRequestFullscreen();
    }

    console.info('[CALENDAR] Native fullscreen mode activated');
  } catch (error) {
    console.error('[CALENDAR] Error entering fullscreen:', error);
    document.body.classList.remove(FULLSCREEN_MODE_CLASS);
  }
}

/**
 * Handle native fullscreen change events (e.g., ESC key)
 */
function handleFullscreenChange(): void {
  const isFullscreen = !!(
    document.fullscreenElement ??
    (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ??
    (document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement ??
    (document as Document & { msFullscreenElement?: Element }).msFullscreenElement
  );

  if (!isFullscreen) {
    // User exited fullscreen (via ESC or browser controls)
    document.body.classList.remove(FULLSCREEN_MODE_CLASS);
    console.info('[CALENDAR] Fullscreen mode exited');
  }
}

/**
 * Setup fullscreen button and change event listeners
 */
function setupFullscreenHandlers(): void {
  console.info('[CALENDAR] Step 12: Setting up fullscreen button with native Browser API...');

  // Fullscreen button: Aktiviert native Browser Fullscreen
  const fullscreenBtn = $$('#fullscreenBtn');
  if (fullscreenBtn !== null) {
    fullscreenBtn.addEventListener('click', () => {
      void requestFullscreenMode();
    });
    console.info('[CALENDAR] ✅ Fullscreen button handler attached');
  }

  // Handle native fullscreen change events (e.g., ESC key)
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);

  console.info('[CALENDAR] ✅ Native fullscreen API handlers attached');
}

/**
 * Setup all calendar UI event handlers
 */
function setupCalendarUIHandlers(): void {
  // Render create event button (all users can create personal events)
  renderCreateEventButton();
  setupCreateEventHandler();
  setupFullscreenHandlers();
}

/**
 * Main application initialization
 */
async function initializeApp(): Promise<void> {
  console.info('[CALENDAR] 🚀 Starting calendar application...');

  try {
    // Step 1: Register modal templates
    console.info('[CALENDAR] Step 1: Registering modal templates...');
    registerModalTemplates();

    // Step 2: Check authentication
    console.info('[CALENDAR] Step 2: Checking authentication...');
    checkLoggedIn();

    // Step 3: Load user data
    console.info('[CALENDAR] Step 3: Loading user data...');
    ensureUserDataLoaded();
    const userData = await api.fetchUserData();
    state.setUser(userData);
    console.info('[CALENDAR] ✅ User data loaded:', { userId: state.currentUserId, isAdmin: state.isAdmin });

    // Step 4: Load departments and teams
    console.info('[CALENDAR] Step 4: Loading departments and teams...');
    await api.loadDepartmentsAndTeams();
    console.info('[CALENDAR] ✅ Departments and teams loaded');

    // Step 5: Initialize FullCalendar
    console.info('[CALENDAR] Step 5: Initializing FullCalendar...');
    await initializeFullCalendar();

    // Step 6: Initialize filters
    console.info('[CALENDAR] Step 6: Initializing filters...');
    if (state.calendar !== null) {
      filters.initializeFilters(state.calendar);
      console.info('[CALENDAR] ✅ Filters initialized');
    } else {
      console.warn('[CALENDAR] ⚠️  Calendar instance is null, skipping filters');
    }

    // Step 6.5: Initialize shift calendar integration (adds "Schicht anzeigen" checkbox)
    console.info('[CALENDAR] Step 6.5: Initializing shift integration...');
    if (state.calendar !== null) {
      shiftCalendarIntegration.init(state.calendar);
      console.info('[CALENDAR] ✅ Shift integration initialized');
    }

    // Step 7: Load and display upcoming events
    console.info('[CALENDAR] Step 7: Loading upcoming events...');
    const upcomingEvents = await api.loadUpcomingEvents();
    ui.displayUpcomingEvents(upcomingEvents, viewEvent);
    console.info('[CALENDAR] ✅ Upcoming events displayed:', upcomingEvents.length);

    // Step 8: Setup event listeners
    console.info('[CALENDAR] Step 8: Setting up event listeners...');
    setupEventListeners();
    console.info('[CALENDAR] ✅ Event listeners ready');

    // Step 9: Setup UI handlers (badges, buttons)
    setupCalendarUIHandlers();

    console.info(LOG_SEPARATOR);
    console.info('[CALENDAR] 🎉 Calendar application initialized successfully!');
    console.info(LOG_SEPARATOR);
  } catch (error: unknown) {
    console.error(LOG_SEPARATOR);
    console.error('[CALENDAR] ❌ FATAL ERROR initializing calendar app!');
    console.error('[CALENDAR] Error:', error);
    console.error(LOG_SEPARATOR);
    showErrorAlert('Fehler beim Laden der Kalender-Anwendung.');
  }
}

// ============================================================================
// DOCUMENT READY
// ============================================================================

/**
 * Start app when DOM is ready
 */
console.info('[CALENDAR] 📄 Calendar script loaded');
console.info('[CALENDAR] Document ready state:', document.readyState);

if (document.readyState === 'loading') {
  console.info('[CALENDAR] ⏳ DOM still loading, waiting for DOMContentLoaded event...');
  document.addEventListener('DOMContentLoaded', () => {
    console.info('[CALENDAR] ✅ DOMContentLoaded event fired!');
    void initializeApp();
  });
} else {
  console.info('[CALENDAR] ✅ DOM already loaded, starting app in 100ms...');
  // DOM already loaded, start immediately
  setTimeout(() => {
    console.info('[CALENDAR] ⏰ Timeout fired, starting app now...');
    void initializeApp();
  }, 100);
}

// ============================================================================
// WINDOW EXPORTS (for backward compatibility)
// ============================================================================

/**
 * Export functions to window for inline event handlers
 * (to be removed once all inline handlers are migrated to data-action)
 */
declare global {
  interface Window {
    calendarApp?: {
      viewEvent: typeof viewEvent;
      editEvent: typeof editEvent;
      deleteEvent: typeof deleteEvent;
      respondToEvent: typeof respondToEvent;
      openEventForm: typeof openEventForm;
      saveEvent: typeof saveEvent;
    };
  }
}

window.calendarApp = {
  viewEvent,
  editEvent: (eventId: number) => editEvent(eventId),
  deleteEvent,
  respondToEvent,
  openEventForm,
  saveEvent,
};
