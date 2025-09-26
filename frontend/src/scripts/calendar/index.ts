/* eslint-disable max-lines */
/**
 * Calendar System
 * Client-side TypeScript for the company calendar feature
 */

import type { User } from '../../types/api.types';
import { canViewAllEmployees } from '../../utils/auth-helpers';
import { $$, $all, $$id, setHTML } from '../../utils/dom-utils';
import { getAuthToken, showSuccess, showError } from '../auth/index';
import { modalManager } from '../utils/modal-manager';
import { shiftCalendarIntegration } from '../shifts/calendar-integration';

// Window.unifiedNav is already declared in global.d.ts

// API Response interfaces
interface ApiResponse<T = unknown> {
  success: boolean;
  data: {
    data: T[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

interface LegacyApiResponse<T = unknown> {
  data: T[];
  events?: T[];
}

// FullCalendar types
interface FullCalendarApi {
  render(): void;
  refetchEvents(): void;
  getEventById(id: string): FullCalendarEvent | null;
  getEvents(): FullCalendarEvent[];
  addEvent(event: FullCalendarEventInput): FullCalendarEvent;
  unselect(): void;
  changeView(viewName: string): void;
  view: {
    activeStart: Date;
    activeEnd: Date;
  };
  on(eventName: string, callback: (info: { start: Date; end: Date }) => void): void;
}

interface FullCalendarEvent {
  id: string;
  title: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
  extendedProps?: Record<string, unknown>;
  remove(): void;
}

interface FullCalendarEventInput {
  id?: string;
  title: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  classNames?: string[];
  extendedProps?: Record<string, unknown>;
}

interface FullCalendarSelectInfo {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  allDay: boolean;
  view: {
    type: string;
  };
}

interface FullCalendarEventClickInfo {
  event: FullCalendarEvent;
  el: HTMLElement;
  jsEvent: MouseEvent;
  view: unknown;
}

interface FullCalendarEventMouseEnterInfo {
  event: FullCalendarEvent;
  el: HTMLElement;
  jsEvent: MouseEvent;
  view: unknown;
}

interface FullCalendarOptions {
  plugins?: unknown[];
  initialView: string;
  locale?: string;
  firstDay?: number;
  slotMinTime?: string;
  slotMaxTime?: string;
  headerToolbar?: Record<string, string>;
  buttonText?: Record<string, string>;
  allDayText?: string;
  events?:
    | ((
        fetchInfo: FullCalendarFetchInfo,
        successCallback: (events: FullCalendarEventInput[]) => void,
        failureCallback: (error: Error) => void,
      ) => void)
    | FullCalendarEventInput[];
  editable?: boolean;
  selectable?: boolean;
  selectMirror?: boolean;
  dayMaxEvents?: boolean;
  weekends?: boolean;
  height?: string | number;
  nowIndicator?: boolean;
  navLinks?: boolean;
  dateClick?: (info: { date: Date; allDay: boolean }) => void;
  select?: (info: FullCalendarSelectInfo) => void;
  eventClick?: (info: FullCalendarEventClickInfo) => void;
  eventMouseEnter?: (info: FullCalendarEventMouseEnterInfo) => void;
  eventMouseLeave?: (info: FullCalendarEventMouseEnterInfo) => void;
}

interface FullCalendarFetchInfo {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  timeZone: string;
}

interface FullCalendarConstructor {
  Calendar: new (element: HTMLElement, options: FullCalendarOptions) => FullCalendarApi;
}

// Import FullCalendar types
declare global {
  interface Window {
    FullCalendar: FullCalendarConstructor;
  }
}

// API Response Types for proper typing
interface ApiV2Response<T> {
  success: boolean;
  data: {
    data: T[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface ApiV1Response<T> {
  data?: T[];
  events?: T[];
  success?: boolean;
}

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  startTime?: string; // v2 API field
  endTime?: string; // v2 API field
  all_day: boolean | number | string;
  allDay?: boolean | number | string; // v2 API field
  location?: string;
  org_level: 'personal' | 'company' | 'department' | 'team';
  orgLevel?: 'personal' | 'company' | 'department' | 'team'; // v2 API field
  org_id?: number;
  orgId?: number; // v2 API field
  color?: string;
  reminder_time?: number;
  reminderTime?: number; // v2 API field
  reminderMinutes?: number; // v2 API field
  requiresResponse?: boolean; // v2 API field
  requires_response?: boolean; // v1 API field
  created_by: number;
  createdBy?: number; // v2 API field
  created_at: string;
  createdAt?: string; // v2 API field
  updated_at: string;
  updatedAt?: string; // v2 API field
  // Additional fields from joins
  creator_name?: string;
  creatorName?: string; // v2 API field
  department_name?: string;
  departmentName?: string; // v2 API field
  team_name?: string;
  teamName?: string; // v2 API field
  // User-specific fields
  user_response?: 'accepted' | 'declined' | 'tentative' | 'pending';
  userResponse?: 'accepted' | 'declined' | 'tentative' | 'pending'; // v2 API field
  attendees?: EventAttendee[];
}

interface EventAttendee {
  id: number;
  event_id: number;
  user_id?: number;
  userId?: number; // v2 API uses camelCase
  response?: 'accepted' | 'declined' | 'tentative' | 'pending';
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'pending'; // v2 API field
  responded_at?: string;
  respondedAt?: string; // v2 API uses camelCase
  // User info
  username?: string;
  first_name?: string;
  firstName?: string; // v2 API uses camelCase
  last_name?: string;
  lastName?: string; // v2 API uses camelCase
  email?: string;
  profilePicture?: string; // v2 API additional field
}

interface UnreadEvent {
  id: number;
  title: string;
  startTime: string;
  requiresResponse: boolean;
}

// Interface for creating new calendar events - not used anymore, using inline types instead

interface Department {
  id: number;
  name: string;
}

interface Team {
  id: number;
  name: string;
  department_id?: number; // v1 API
  departmentId?: number; // v2 API
}

interface UserData extends User {
  departmentId?: number;
  department_id?: number;
  teamId?: number;
  team_id?: number;
}

// Global variables
let calendar: FullCalendarApi; // FullCalendar instance
// Always default to 'all' filter on page load
let currentFilter = 'all';
let currentSearch = '';
let departments: Department[] = [];
let teams: Team[] = [];
let employees: User[] = [];
let isAdmin = false;
let currentUserId: number | null = null;
let selectedAttendees: number[] = [];
let eventToDelete: number | null = null; // Track which event to delete
let calendarView = 'dayGridMonth'; // Default view

/**
 * Helper function to set selected organization ID
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

// Initialize when document is ready
async function initializeApp() {
  console.info('Calendar: Starting initialization...');

  // Register modal templates
  registerModalTemplates();

  // Check if user is logged in
  try {
    checkLoggedIn();
    // Load user data
    try {
      const userData = await fetchUserData();
      currentUserId = userData.id;
      isAdmin = userData.role === 'admin' || userData.role === 'root';

      // Show/hide "New Event" button based on permissions
      const newEventBtn = $$('#newEventBtn');
      console.info('Calendar: newEventBtn found:', newEventBtn !== null);
      if (newEventBtn !== null) {
        newEventBtn.style.display = isAdmin ? 'block' : 'none';
      }

      // Load departments and teams for form dropdowns
      void loadDepartmentsAndTeams();

      // Initialize calendar - wrapped to prevent redirect on calendar errors
      try {
        initializeCalendar();
        // Setup fullscreen controls
        setupFullscreenControls();
      } catch (calendarError) {
        console.error('Calendar initialization error:', calendarError);
        showError('Kalender konnte nicht geladen werden.');
      }

      // Load upcoming events
      void loadUpcomingEvents();

      // Setup event listeners
      console.info('Calendar: Setting up event listeners...');
      setupEventListeners();

      // Color picker removed - color is auto-determined by org_level

      // Check for unread events and show modal if necessary
      void checkUnreadEvents();

      console.info('Calendar: Initialization complete');
    } catch (error: unknown) {
      console.error('Error loading user data:', error);
      window.location.href = '/login';
    }
  } catch (error: unknown) {
    console.error('Error checking login:', error);
    window.location.href = '/login';
  }
}

// Wait for both DOM and scripts to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void initializeApp();
  });
} else {
  // DOM is already loaded, run directly
  setTimeout(() => {
    void initializeApp();
  }, 100); // Small delay to ensure all scripts are loaded
}

/**
 * Register all modal templates
 */
function registerModalTemplates(): void {
  console.info('Calendar: registerModalTemplates() called');

  // Event Form Modal Template
  const eventFormTemplate = getEventFormModalTemplate();
  console.info('Calendar: eventFormTemplate length:', eventFormTemplate.length);
  modalManager.registerTemplate('eventFormModal', eventFormTemplate);

  // Event Detail Modal Template
  modalManager.registerTemplate('eventDetailModal', getEventDetailModalTemplate());

  // Attendees Modal Template
  modalManager.registerTemplate('attendeesModal', getAttendeesModalTemplate());

  // Event Response Modal Template
  modalManager.registerTemplate('eventResponseModal', getEventResponseModalTemplate());

  // Confirmation Modal Template (for delete)
  modalManager.registerTemplate('confirmationModal', getConfirmationModalTemplate());

  // Unread Events Modal Template
  modalManager.registerTemplate('unreadEventsModal', getUnreadEventsModalTemplate());

  console.info('Calendar: All modal templates registered');
}

/**
 * Get Unread Events Modal Template
 */
function getUnreadEventsModalTemplate(): string {
  return `
    <div class="modal-overlay" id="unreadEventsModal">
      <div class="modal-container modal-lg">
        <div class="modal-header">
          <h2 class="modal-title">
            <i class="fas fa-bell"></i> Neue Termine mit Statusanfrage
          </h2>
          <button type="button" class="modal-close" data-action="close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div id="unreadEventsList" class="unread-events-list">
            <!-- Events will be loaded here -->
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-action="close">
            Schließen
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Check for unread events and show modal if necessary
 */
async function checkUnreadEvents(): Promise<void> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') return;

    const apiUrl = '/api/v2/calendar/unread-events';

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch unread events');
      return;
    }

    const data = (await response.json()) as { data?: { totalUnread?: number }; totalUnread?: number };
    const result = data.data;
    const totalUnread = result?.totalUnread ?? 0;

    // If there are unread events, show the modal
    if (totalUnread > 0) {
      // Check if badge was clicked or if we should auto-show
      const badge = $$('#calendar-unread-badge');
      if (badge && badge.style.display !== 'none') {
        // Auto-show modal when page loads with unread events
        setTimeout(() => {
          void showUnreadEventsModal();
        }, 1000);
      }
    }

    // Update badge in navigation
    if (window.unifiedNav) {
      window.unifiedNav.updateUnreadCalendarEvents();
    }
  } catch (error: unknown) {
    console.error('Error checking unread events:', error);
  }
}

/**
 * Show event details (wrapper for viewEvent)
 */
async function showEventDetails(eventId: number): Promise<void> {
  // Close the unread events modal first
  modalManager.hide('unreadEventsModal');

  // Show the event details
  await viewEvent(eventId);
}

// Helper: Fetch unread events from API
async function fetchUnreadEvents(): Promise<UnreadEvent[]> {
  const token = getAuthToken();
  if (token === null || token === '') return [];

  const apiUrl = '/api/v2/calendar/unread-events';

  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch unread events');
    return [];
  }

  const data = (await response.json()) as {
    data?: { eventsRequiringResponse?: UnreadEvent[] };
    eventsRequiringResponse?: UnreadEvent[];
  };
  const result = data.data;
  return result?.eventsRequiringResponse ?? [];
}

// Helper: Create action button for event
function createEventActionButton(
  eventId: number,
  action: string,
  response: string | null,
  btnClass: string,
  iconClass: string,
  text: string,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = `btn ${btnClass} btn-sm`;
  btn.dataset.action = action;
  btn.dataset.eventId = eventId.toString();
  if (response !== null && response !== '') btn.dataset.response = response;

  const icon = document.createElement('i');
  icon.className = iconClass;
  btn.append(icon);
  btn.append(document.createTextNode(' ' + text));

  return btn;
}

// Helper: Render empty state
function renderEmptyState(container: HTMLElement): void {
  const emptyDiv = document.createElement('div');
  emptyDiv.className = 'text-center p-4';

  const icon = document.createElement('i');
  icon.className = 'fas fa-check-circle text-success';
  icon.style.fontSize = '3rem';
  emptyDiv.append(icon);

  const text = document.createElement('p');
  text.className = 'mt-3';
  text.textContent = 'Keine Termine mit ausstehender Statusanfrage';
  emptyDiv.append(text);

  container.append(emptyDiv);
}

// Helper: Render unread event item
function renderUnreadEventItem(event: UnreadEvent): HTMLDivElement {
  const eventDiv = document.createElement('div');
  eventDiv.className = 'unread-event-item';
  eventDiv.dataset.eventId = event.id.toString();

  // Event info section
  const infoDiv = document.createElement('div');
  infoDiv.className = 'event-info';

  const title = document.createElement('h4');
  title.textContent = event.title;
  infoDiv.append(title);

  const dateP = document.createElement('p');
  dateP.className = 'text-muted';
  const clockIcon = document.createElement('i');
  clockIcon.className = 'fas fa-clock';
  dateP.append(clockIcon);
  dateP.append(document.createTextNode(' ' + new Date(event.startTime).toLocaleString('de-DE')));
  infoDiv.append(dateP);

  eventDiv.append(infoDiv);

  // Actions section
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'event-actions';

  actionsDiv.append(
    createEventActionButton(event.id, 'respond-event', 'accepted', 'btn-success', 'fas fa-check', 'Zusagen'),
  );
  actionsDiv.append(
    createEventActionButton(event.id, 'respond-event', 'declined', 'btn-danger', 'fas fa-times', 'Absagen'),
  );
  actionsDiv.append(
    createEventActionButton(event.id, 'show-event-details', null, 'btn-secondary', 'fas fa-info-circle', 'Details'),
  );

  eventDiv.append(actionsDiv);
  return eventDiv;
}

/**
 * Show unread events modal
 */
async function showUnreadEventsModal(): Promise<void> {
  try {
    const events = await fetchUnreadEvents();

    const modal = modalManager.show('unreadEventsModal');
    if (!modal) return;

    const listContainer = $$('#unreadEventsList');
    if (!listContainer) return;

    // Clear container
    while (listContainer.firstChild) {
      listContainer.firstChild.remove();
    }

    if (events.length === 0) {
      renderEmptyState(listContainer);
    } else {
      events.forEach((event) => {
        listContainer.append(renderUnreadEventItem(event));
      });
    }
  } catch (error: unknown) {
    console.error('Error loading unread events:', error);
  }
}

/**
 * Create and show event tooltip
 */
function showEventTooltip(info: FullCalendarEventMouseEnterInfo): void {
  const tooltip = document.createElement('div');
  tooltip.className = 'event-tooltip';
  const description = (info.event.extendedProps?.description as string | undefined) ?? '';
  const location = info.event.extendedProps?.location as string | undefined;

  // Clear tooltip
  while (tooltip.firstChild) {
    tooltip.firstChild.remove();
  }

  // Add title
  const strong = document.createElement('strong');
  strong.textContent = info.event.title;
  tooltip.append(strong);

  // Add line break
  tooltip.append(document.createElement('br'));

  // Add description
  if (description !== '') {
    tooltip.append(document.createTextNode(description));
  }

  // Add location if present
  if (location !== undefined && location !== '') {
    tooltip.append(document.createElement('br'));
    const locationIcon = document.createElement('i');
    locationIcon.className = 'fas fa-map-marker-alt';
    tooltip.append(locationIcon);
    tooltip.append(document.createTextNode(' ' + location));
  }
  document.body.append(tooltip);

  const rect = info.el.getBoundingClientRect();
  tooltip.style.position = 'absolute';
  tooltip.style.left = `${rect.left}px`;
  tooltip.style.top = `${rect.bottom + 5}px`;
  tooltip.style.zIndex = '9999';

  (info.el as HTMLElement & { _tooltip?: HTMLElement })._tooltip = tooltip;
}

/**
 * Hide event tooltip
 */
function hideEventTooltip(info: FullCalendarEventMouseEnterInfo): void {
  const el = info.el as HTMLElement & { _tooltip?: HTMLElement };
  if (el._tooltip) {
    el._tooltip.remove();
    delete el._tooltip;
  }
}

/**
 * Initialize FullCalendar
 */
let calendarInitialized = false;

// Helper: Check if user can create events
function canUserCreateEvents(userRole: string | null): boolean {
  return userRole === 'admin' || userRole === 'root';
}

// Helper: Handle date click
function handleDateClick(info: { date: Date; allDay: boolean }, userRole: string | null): void {
  console.info('Calendar: Date clicked:', info);
  if (canUserCreateEvents(userRole)) {
    openEventForm(null, info.date, info.date, info.allDay);
  } else {
    console.info('Calendar: Employees cannot create events');
  }
}

// Helper: Handle date select
function handleDateSelect(info: FullCalendarSelectInfo, userRole: string | null): void {
  console.info('Calendar: Date range selected:', info);
  if (canUserCreateEvents(userRole)) {
    const allDay = info.allDay && info.view.type === 'dayGridMonth';
    openEventForm(null, info.start, info.end, allDay);
  } else {
    console.info('Calendar: Employees cannot create events');
  }
}

// Helper: Create calendar configuration
function createCalendarConfig(userRole: string | null): FullCalendarOptions {
  const canCreate = canUserCreateEvents(userRole);

  return {
    initialView: calendarView,
    locale: 'de',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: '',
    },
    buttonText: {
      today: 'Heute',
      month: 'Monat',
      week: 'Woche',
      day: 'Tag',
      list: 'Liste',
    },
    allDayText: 'Ganztägig',
    firstDay: 1,
    slotMinTime: '07:00:00',
    slotMaxTime: '20:00:00',
    height: 'auto',
    nowIndicator: true,
    dayMaxEvents: true,
    navLinks: true,
    selectable: canCreate,
    selectMirror: canCreate,
    dateClick: (info: { date: Date; allDay: boolean }) => {
      handleDateClick(info, userRole);
    },
    select: (info: FullCalendarSelectInfo) => {
      handleDateSelect(info, userRole);
    },
    events(
      fetchInfo: FullCalendarFetchInfo,
      successCallback: (events: FullCalendarEventInput[]) => void,
      failureCallback: (error: Error) => void,
    ) {
      void loadCalendarEvents(fetchInfo).then(successCallback).catch(failureCallback);
    },
    eventClick(info: FullCalendarEventClickInfo) {
      void viewEvent(Number.parseInt(info.event.id, 10));
    },
    eventMouseEnter: showEventTooltip,
    eventMouseLeave: hideEventTooltip,
  };
}

function initializeCalendar(): void {
  if (calendarInitialized) {
    console.info('Calendar: Already initialized, skipping...');
    return;
  }

  console.info('Calendar: Initializing FullCalendar...');
  const calendarEl = $$('#calendar');
  console.info('Calendar: Calendar element found:', !!calendarEl);

  if (!calendarEl) {
    console.error('Calendar element not found');
    return;
  }

  console.info('Calendar: FullCalendar loaded:', typeof window.FullCalendar !== 'undefined');
  if (typeof window.FullCalendar === 'undefined') {
    console.info('Calendar: FullCalendar not yet loaded, waiting...');
    setTimeout(() => {
      initializeCalendar();
    }, 500);
    return;
  }

  const userRole = localStorage.getItem('userRole');
  console.info('Calendar: User role for permissions:', userRole);

  calendarInitialized = true;

  try {
    calendar = new window.FullCalendar.Calendar(calendarEl, createCalendarConfig(userRole));
    calendar.render();
    shiftCalendarIntegration.init(calendar);
  } catch (error: unknown) {
    console.error('Error initializing calendar:', error);
    showError('Fehler beim Initialisieren des Kalenders. Bitte laden Sie die Seite neu.');
  }
}

// Helper: Update filter button active state
function updateFilterButtonState(buttons: NodeListOf<Element>, activeButton: Element): void {
  buttons.forEach((btn) => {
    btn.classList.remove('active');
  });
  activeButton.classList.add('active');
}

// Helper: Handle filter change
function handleFilterChange(value: string): void {
  currentFilter = value;
  localStorage.setItem('calendarFilter', currentFilter);
  console.info('[CALENDAR] Filter changed to:', currentFilter);
  calendar.refetchEvents();
}

// Helper: Setup level filter buttons
function setupLevelFilterButtons(): void {
  const levelFilterButtons = $all('#levelFilter button.tab-btn') as NodeListOf<HTMLButtonElement>;
  levelFilterButtons.forEach((button) => {
    // Set initial active state based on saved filter
    button.classList.toggle('active', button.dataset.value === currentFilter);

    button.addEventListener('click', function (this: HTMLButtonElement) {
      updateFilterButtonState(levelFilterButtons, this);
      handleFilterChange(this.dataset.value ?? 'all');
    });
  });
}

// Helper: Setup legacy filter pills
function setupLegacyFilterPills(): void {
  const filterPills = $all('.filter-pill[data-value]');
  filterPills.forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      updateFilterButtonState(filterPills, this);
      handleFilterChange(this.dataset.value ?? 'all');
    });
  });
}

// Helper: Update view button states
function updateViewButtonStates(activeButton: HTMLElement): void {
  $all('.view-selector button').forEach((btn) => {
    btn.classList.remove('active', 'btn-primary');
    btn.classList.add('btn-outline-primary');
  });
  activeButton.classList.add('active', 'btn-primary');
  activeButton.classList.remove('btn-outline-primary');
}

// Helper: Setup view buttons
function setupViewButtons(): void {
  const viewButtons = [
    { id: 'monthView', view: 'dayGridMonth' },
    { id: 'weekView', view: 'timeGridWeek' },
    { id: 'dayView', view: 'timeGridDay' },
    { id: 'listView', view: 'listWeek' },
  ];

  viewButtons.forEach(({ id, view }) => {
    const button = $$id(id);
    if (button === null) return;

    button.addEventListener('click', () => {
      console.info('[CALENDAR] Changing view to:', view);
      calendarView = view;
      calendar.changeView(view);
      updateViewButtonStates(button);
    });
  });
}

// Helper: Setup legacy view buttons
function setupLegacyViewButtons(): void {
  $all('.view-btn').forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      const view = this.dataset.view;
      if (view === undefined || view === '') return;

      calendarView = view;
      calendar.changeView(view);
      updateFilterButtonState($all('.view-btn'), this);
    });
  });
}

// Helper: Setup search functionality
function setupSearchFunctionality(): void {
  const searchButton = $$('#searchButton');
  const searchInput = $$('#searchInput') as HTMLInputElement | null;

  if (searchButton === null || searchInput === null) return;

  searchButton.addEventListener('click', () => {
    currentSearch = searchInput.value.trim();
    calendar.refetchEvents();
  });

  searchInput.addEventListener('keypress', function (this: HTMLInputElement, e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    currentSearch = this.value.trim();
    calendar.refetchEvents();
  });
}

// Helper: Setup new event button
function setupNewEventButton(buttonId: string, logContext: string): void {
  const button = $$(buttonId);
  if (button === null) {
    console.info(`Calendar: ${buttonId} not found - ${logContext}`);
    return;
  }

  const userRole = localStorage.getItem('userRole');
  const canCreate = userRole === 'admin' || userRole === 'root';

  if (!canCreate) {
    console.info(`Calendar: Hiding ${buttonId} for employee`);
    button.style.display = 'none';
    return;
  }

  // Clone to remove existing listeners
  const newButton = button.cloneNode(true) as HTMLButtonElement;
  button.parentNode?.replaceChild(newButton, button);

  newButton.addEventListener('click', (e) => {
    console.info(`Calendar: ${buttonId} clicked`);
    e.preventDefault();
    e.stopPropagation();

    try {
      openEventForm();
      console.info(`Calendar: openEventForm() called from ${buttonId}`);
    } catch (error: unknown) {
      console.error(`Calendar: Error calling openEventForm from ${buttonId}:`, error);
    }
  });
}

// Handler Types
interface ClickHandler {
  selector: string;
  handler: (e: Event, element: HTMLElement) => void;
}

// Create click handler registry
// Helper: Get dropdown handlers
function getDropdownHandlers(): ClickHandler[] {
  return [
    { selector: '.dropdown-display', handler: handleDropdownDisplay },
    { selector: '.dropdown-option', handler: handleDropdownOption },
  ];
}

// Helper: Get event action handlers
function getEventActionHandlers(): ClickHandler[] {
  return [
    { selector: '[data-action="respond-event"]', handler: handleRespondEvent },
    { selector: '[data-action="show-event-details"]', handler: handleShowEventDetails },
    { selector: '[data-action="respond-modal"]', handler: handleRespondModal },
    { selector: '[data-action="edit-event"]', handler: handleEditEvent },
    { selector: '[data-action="delete-event"]', handler: handleDeleteEvent },
    { selector: '[data-action="confirm-delete-event"]', handler: handleConfirmDeleteEvent },
  ];
}

// Helper: Get attendee handlers
function getAttendeeHandlers(): ClickHandler[] {
  return [
    { selector: '[data-action="add-attendee"]', handler: handleAddAttendee },
    { selector: '[data-action="add-attendee-by-email"]', handler: handleAddAttendeeByEmail },
    { selector: '[data-action="remove-attendee"]', handler: handleRemoveAttendee },
  ];
}

// Helper: Get department/team handlers
function getDepartmentTeamHandlers(): ClickHandler[] {
  return [
    { selector: '[data-action="select-department"]', handler: handleSelectDepartment },
    { selector: '[data-action="select-department-with-teams"]', handler: handleSelectDepartmentWithTeams },
    { selector: '[data-action="select-team"]', handler: handleSelectTeam },
  ];
}

// Helper: Get recurrence handlers
function getRecurrenceHandlers(): ClickHandler[] {
  return [
    { selector: '[data-action="toggle-recurrence-end-dropdown"]', handler: handleToggleRecurrenceEnd },
    { selector: '[data-action="select-recurrence-end"]', handler: handleSelectRecurrenceEnd },
  ];
}

function createClickHandlerRegistry(): ClickHandler[] {
  return [
    ...getDropdownHandlers(),
    ...getEventActionHandlers(),
    ...getAttendeeHandlers(),
    ...getDepartmentTeamHandlers(),
    ...getRecurrenceHandlers(),
  ];
}

// Process click handlers
function processClickHandlers(e: Event, target: HTMLElement, handlers: ClickHandler[]): void {
  for (const handler of handlers) {
    const element = target.closest<HTMLElement>(handler.selector);
    if (element) {
      handler.handler(e, element);
      return;
    }
  }
}

// Individual handler functions
function handleDropdownDisplay(e: Event, display: HTMLElement): void {
  e.preventDefault();
  e.stopPropagation();

  const wrapper = display.closest('.custom-dropdown');
  const dropdown = wrapper?.querySelector('.dropdown-options');

  if (!dropdown) return;

  const wrapperId = wrapper?.id;

  switch (wrapperId) {
    case 'orgLevelWrapper':
      toggleOrgLevelDropdown();
      break;
    case 'reminderWrapper':
      toggleReminderDropdown();
      break;
    case 'recurrenceWrapper':
      toggleRecurrenceDropdown();
      break;
    case 'departmentWrapper':
      toggleDepartmentDropdown();
      break;
    case 'teamWrapper':
      toggleTeamDropdown();
      break;
    default:
      // No action for unknown wrapper IDs
      break;
  }
}

function handleDropdownOption(e: Event, option: HTMLElement): void {
  e.preventDefault();
  e.stopPropagation();

  const dropdown = option.closest('.dropdown-options');
  if (!dropdown) return;

  const value = option.dataset.value ?? '';
  const textContent = option.textContent;
  const text = textContent !== '' ? textContent.trim() : '';

  const dropdownId = dropdown.id;

  switch (dropdownId) {
    case 'orgLevelDropdown':
      selectOrgLevel(value, text);
      break;
    case 'reminderDropdown':
      selectReminder(value, text);
      break;
    case 'recurrenceDropdown':
      selectRecurrence(value, text);
      break;
    default:
      // No action for unknown dropdown IDs
      break;
  }
}

function handleRespondEvent(_e: Event, btn: HTMLElement): void {
  const eventId = btn.dataset.eventId;
  const response = btn.dataset.response;
  if (eventId !== undefined && response !== undefined) {
    void window.respondToEvent(Number.parseInt(eventId, 10), response as 'accepted' | 'declined');
  }
}

function handleShowEventDetails(_e: Event, btn: HTMLElement): void {
  const eventId = btn.dataset.eventId;
  if (eventId !== undefined) {
    void window.showEventDetails(Number.parseInt(eventId, 10));
  }
}

function handleRespondModal(_e: Event, btn: HTMLElement): void {
  const eventId = btn.dataset.eventId;
  const response = btn.dataset.response;
  if (eventId !== undefined && response !== undefined) {
    void window.respondToEvent(Number.parseInt(eventId, 10), response as 'accepted' | 'tentative' | 'declined');
  }
}

function handleEditEvent(_e: Event, btn: HTMLElement): void {
  const eventId = btn.dataset.eventId;
  if (eventId !== undefined) {
    window.editEvent(Number.parseInt(eventId, 10));
  }
}

function handleDeleteEvent(_e: Event, btn: HTMLElement): void {
  const eventId = btn.dataset.eventId;
  if (eventId !== undefined) {
    window.deleteEvent(Number.parseInt(eventId, 10));
  }
}

function handleConfirmDeleteEvent(_e: Event, _btn: HTMLElement): void {
  console.info('[CALENDAR] Confirm delete button clicked');
  void confirmDeleteEvent();
}

function handleAddAttendee(_e: Event, btn: HTMLElement): void {
  const empId = btn.dataset.empId;
  const empName = btn.dataset.empName;
  if (empId !== undefined && empName !== undefined) {
    addAttendee(Number.parseInt(empId, 10), empName);
  }
}

function handleAddAttendeeByEmail(_e: Event, _btn: HTMLElement): void {
  const emailInput = $$('#attendeeEmailInput') as HTMLInputElement | null;
  if (emailInput === null || emailInput.value === '') return;

  const email = emailInput.value.trim();
  if (!validateAndAddEmail(email)) {
    showError('Bitte geben Sie eine gültige E-Mail-Adresse ein');
  } else {
    emailInput.value = '';
  }
}

function validateAndAddEmail(email: string): boolean {
  const emailRegex = /^\S[^\s@]*@\S[^\s.]*\.\S{2,}$/;
  if (email === '' || !emailRegex.test(email)) return false;

  const emailsList = $$('#selectedAttendeesEmails');
  if (!emailsList) return false;

  const emailDiv = document.createElement('div');
  emailDiv.className = 'badge badge-secondary mr-2 mb-2';
  emailDiv.textContent = email;
  emailsList.append(emailDiv);
  return true;
}

function handleRemoveAttendee(_e: Event, btn: HTMLElement): void {
  const userId = btn.dataset.userId;
  if (userId !== undefined) {
    window.removeAttendee(Number.parseInt(userId, 10));
  }
}

function handleSelectDepartment(e: Event, option: HTMLElement): void {
  e.preventDefault();
  const deptId = option.dataset.deptId;
  const deptName = option.dataset.deptName;
  if (deptId !== undefined && deptName !== undefined) {
    selectDepartment(Number.parseInt(deptId, 10), deptName);
    closeAllDropdowns();
  }
}

function handleSelectDepartmentWithTeams(e: Event, option: HTMLElement): void {
  e.preventDefault();
  const deptId = option.dataset.deptId;
  const deptName = option.dataset.deptName;
  if (deptId !== undefined && deptName !== undefined) {
    const deptIdNum = Number.parseInt(deptId, 10);
    selectDepartment(deptIdNum, deptName);
    loadTeamsForDepartment(deptIdNum);
    closeAllDropdowns();
  }
}

function handleSelectTeam(e: Event, option: HTMLElement): void {
  e.preventDefault();
  const teamId = option.dataset.teamId;
  const teamName = option.dataset.teamName;
  if (teamId !== undefined && teamName !== undefined) {
    selectTeam(Number.parseInt(teamId, 10), teamName);
    closeAllDropdowns();
  }
}

function handleToggleRecurrenceEnd(_e: Event, _btn: HTMLElement): void {
  window.toggleRecurrenceEndDropdown();
}

function handleSelectRecurrenceEnd(_e: Event, option: HTMLElement): void {
  const endType = option.dataset.endType;
  const endText = option.dataset.endText;
  if (endType !== undefined && endText !== undefined) {
    window.selectRecurrenceEnd(endType, endText);
  }
}

/**
 * Setup all event listeners
 */
function setupEventListeners(): void {
  setupLevelFilterButtons();
  setupLegacyFilterPills();
  setupViewButtons();
  setupLegacyViewButtons();
  setupSearchFunctionality();

  // Setup new event buttons
  setupNewEventButton('#newEventBtn', 'filter bar button');
  setupNewEventButton('#newCalendarEventBtn', 'calendar header - ok if not on calendar page');

  // Save event button
  const saveEventBtn = $$('#saveEventBtn');
  if (saveEventBtn !== null) {
    saveEventBtn.addEventListener('click', () => {
      void saveEvent();
    });
  }

  // Organization level change
  const eventOrgLevel = $$('#eventOrgLevel') as HTMLInputElement | null;
  if (eventOrgLevel !== null) {
    eventOrgLevel.addEventListener('change', function (this: HTMLInputElement) {
      updateOrgIdDropdown(this.value);
    });
  }

  // Color selection removed - color is auto-determined by org_level

  // All day checkbox
  const allDayCheckbox = $$('#eventAllDay');
  if (allDayCheckbox !== null) {
    allDayCheckbox.addEventListener('change', function (this: HTMLInputElement) {
      const timeInputs = $all('.time-input') as NodeListOf<HTMLInputElement>;
      timeInputs.forEach((input) => {
        input.disabled = this.checked;
        if (this.checked) {
          input.value = '';
        }
      });
    });
  }

  // Add attendee button
  const addAttendeeBtn = $$('#addAttendeeBtn');
  if (addAttendeeBtn) {
    addAttendeeBtn.addEventListener('click', () => {
      // Only open modal if button is visible (for personal events)
      const orgLevelInput = $$('#orgLevelInput') as HTMLInputElement | null;
      if (orgLevelInput !== null && orgLevelInput.value === 'personal') {
        modalManager.show('attendeesModal');
        void loadEmployeesForAttendees();
      } else {
        console.warn('Attendees can only be added to personal events');
      }
    });
  }

  // Note: Event listeners for addSelectedAttendeesBtn and attendeeSearch
  // are now added dynamically in loadEmployeesForAttendees() function
  // because the modal content is created dynamically

  // Handler registry for click actions
  const clickHandlers = createClickHandlerRegistry();

  // Setup custom dropdown event delegation
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Process click handlers
    processClickHandlers(e, target, clickHandlers);

    // Close dropdowns when clicking outside
    if (!target.closest('.custom-dropdown')) {
      closeAllDropdowns();
    }
  });
}

// Helper: Build event query parameters
function buildEventQueryParams(fetchInfo: FullCalendarFetchInfo): URLSearchParams {
  const params = new URLSearchParams({
    start: fetchInfo.startStr,
    end: fetchInfo.endStr,
    filter: currentFilter,
  });

  if (currentSearch !== '' && currentSearch.trim() !== '') {
    params.append('search', currentSearch);
  }

  return params;
}

// Helper: Handle 403 permission error
async function handlePermissionError(fetchInfo: FullCalendarFetchInfo): Promise<FullCalendarEventInput[]> {
  console.error('[CALENDAR] Permission denied for filter:', currentFilter);
  currentFilter = 'personal';
  localStorage.setItem('calendarFilter', currentFilter);

  // Update UI to reflect filter change
  const filterButtons = $all('#levelFilter button.tab-btn') as NodeListOf<HTMLButtonElement>;
  filterButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === 'personal');
  });

  // Retry with personal filter
  return await loadCalendarEvents(fetchInfo);
}

// Helper: Extract events from V2 API response
function extractV2Events(
  data: ApiResponse<CalendarEvent> | LegacyApiResponse<CalendarEvent> | CalendarEvent[],
): CalendarEvent[] | null {
  if (!('success' in data) || !('data' in data) || typeof data.data !== 'object' || Array.isArray(data.data)) {
    return null;
  }

  const apiData = data;
  const dataObj = apiData.data as Record<string, unknown>;

  if ('data' in dataObj && Array.isArray(dataObj.data)) {
    console.info('[CALENDAR] v2 events found:', dataObj.data.length);
    return dataObj.data as CalendarEvent[];
  }

  if ('events' in dataObj && Array.isArray(dataObj.events)) {
    console.info('[CALENDAR] v2 events (from data.events) found:', dataObj.events.length);
    return dataObj.events as CalendarEvent[];
  }

  return null;
}

// Helper: Extract events from legacy response
function extractLegacyEvents(
  data: ApiResponse<CalendarEvent> | LegacyApiResponse<CalendarEvent> | CalendarEvent[],
): CalendarEvent[] | null {
  const legacyData = data as LegacyApiResponse<CalendarEvent>;

  if ('events' in legacyData && Array.isArray(legacyData.events)) {
    return legacyData.events;
  }

  if ('data' in legacyData && Array.isArray(legacyData.data)) {
    return legacyData.data;
  }

  return null;
}

// Helper: Extract events from API response
function extractEventsFromResponse(
  data: ApiResponse<CalendarEvent> | LegacyApiResponse<CalendarEvent> | CalendarEvent[],
): CalendarEvent[] {
  if (Array.isArray(data)) {
    return data;
  }

  const v2Events = extractV2Events(data);
  if (v2Events) return v2Events;

  const legacyEvents = extractLegacyEvents(data);
  if (legacyEvents) return legacyEvents;

  console.error('Calendar API returned unexpected response format:', data);
  showError('Kalenderdaten konnten nicht geladen werden. API-Fehler.');
  return [];
}

// Helper: Map v2 API response fields
function mapV2EventFields(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    start_time: event.startTime ?? event.start_time,
    end_time: event.endTime ?? event.end_time,
    all_day: event.allDay ?? event.all_day,
    org_level: event.orgLevel ?? event.org_level,
    org_id: event.orgId ?? event.org_id,
    created_by: event.createdBy ?? event.created_by,
    created_at: event.createdAt ?? event.created_at,
    updated_at: event.updatedAt ?? event.updated_at,
    reminder_time: event.reminderMinutes ?? event.reminderTime ?? event.reminder_time,
    creator_name: event.creatorName ?? event.creator_name,
    department_name: event.departmentName ?? event.department_name,
    team_name: event.teamName ?? event.team_name,
    user_response: event.userResponse ?? event.user_response,
  };
}

/**
 * Load calendar events
 */
async function loadCalendarEvents(fetchInfo: FullCalendarFetchInfo): Promise<FullCalendarEventInput[]> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') {
      window.location.href = '/login';
      throw new Error('No token found');
    }

    const params = buildEventQueryParams(fetchInfo);
    const apiUrl = `/api/v2/calendar/events?${params}`;

    console.info('[CALENDAR] Loading events - v2: true, URL:', apiUrl);

    const response = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      if (response.status === 403 && currentFilter !== 'personal') {
        return await handlePermissionError(fetchInfo);
      }
      throw new Error('Failed to load events');
    }

    const data = (await response.json()) as
      | ApiResponse<CalendarEvent>
      | LegacyApiResponse<CalendarEvent>
      | CalendarEvent[];

    console.info('[CALENDAR] API Response:', data);

    let events = extractEventsFromResponse(data);

    // Map v2 API response fields
    events = events.map(mapV2EventFields);

    console.info('[CALENDAR] Formatted events for display:', events);
    const formattedEvents = events.map(formatEventForCalendar).filter((e): e is FullCalendarEventInput => e !== null);
    console.info('[CALENDAR] Events to render:', formattedEvents);
    return formattedEvents;
  } catch (error: unknown) {
    console.error('Error loading events:', error);
    showError('Fehler beim Laden der Termine.');
    return [];
  }
}

/**
 * Format event for FullCalendar
 */
function formatEventForCalendar(event: CalendarEvent): FullCalendarEventInput | null {
  // Color based on organization level - matching the legend
  let color = event.color ?? '#3498db'; // Default blue

  if (event.color === undefined || event.color === '') {
    switch (event.org_level) {
      case 'company':
        color = '#3498db'; // Blue for company (Firma)
        break;
      case 'department':
        color = '#e67e22'; // Orange for department (Abteilung)
        break;
      case 'team':
        color = '#2ecc71'; // Green for team
        break;
      case 'personal':
        color = '#9b59b6'; // Purple for personal (Persönlich)
        break;
      default:
        color = '#3498db'; // Default blue
        break;
    }
  }

  // Ensure we have valid dates
  const startTime = event.start_time !== '' ? event.start_time : (event.startTime ?? '');
  const endTime = event.end_time !== '' ? event.end_time : (event.endTime ?? '');

  if (startTime === '' || endTime === '') {
    console.error('[CALENDAR] Event missing time fields:', event);
    return null;
  }

  return {
    id: event.id !== 0 ? event.id.toString() : '',
    title: event.title !== '' ? event.title : 'Unbenannter Termin',
    start: startTime,
    end: endTime,
    allDay: event.all_day === 1 || event.all_day === '1' || event.all_day === true,
    backgroundColor: color,
    borderColor: color,
    textColor: '#ffffff',
    classNames: [`fc-event-${event.org_level}`], // Add org_level as class
    extendedProps: {
      description: event.description,
      location: event.location,
      org_level: event.org_level,
      org_id: event.org_id,
      created_by: event.created_by,
      creator_name: event.creator_name,
      reminder_time: event.reminder_time,
      user_response: event.user_response,
      custom_color: event.color, // Store original color for editing
      all_day: event.all_day, // Store all_day flag for editing
    },
  };
}

/**
 * Extract events from dashboard API response
 */
function extractDashboardEvents(
  data: CalendarEvent[] | ApiV2Response<CalendarEvent> | ApiV1Response<CalendarEvent>,
): CalendarEvent[] {
  if (Array.isArray(data)) {
    return data;
  }

  if ('data' in data && data.data && Array.isArray((data as ApiV2Response<CalendarEvent>).data.data)) {
    return (data as ApiV2Response<CalendarEvent>).data.data;
  }

  if ('success' in data && data.success === true && 'data' in data && data.data) {
    return (data as ApiV1Response<CalendarEvent>).data ?? [];
  }

  console.error('Unexpected response format from dashboard:', data);
  return [];
}

/**
 * Load upcoming events for sidebar
 */
async function loadUpcomingEvents(): Promise<void> {
  try {
    // Get token from localStorage
    const token = getAuthToken();
    if (token === null || token === '') {
      window.location.href = '/login';
      throw new Error('No token found');
    }

    // Use v2 API endpoint
    const apiUrl = '/api/v2/calendar/dashboard';
    console.info('[CALENDAR] Loading dashboard - v2: true, URL:', apiUrl);

    // Fetch upcoming events
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to load upcoming events');
    }

    const data = (await response.json()) as
      | CalendarEvent[]
      | ApiV2Response<CalendarEvent>
      | ApiV1Response<CalendarEvent>;
    console.info('[CALENDAR] Dashboard response:', data);

    const events = extractDashboardEvents(data);
    displayUpcomingEvents(events);
  } catch (error: unknown) {
    console.error('Error loading upcoming events:', error);
    const upcomingEvents = $$('#upcomingEvents');
    if (upcomingEvents) {
      upcomingEvents.innerHTML = '<p class="text-center">Fehler beim Laden der Termine.</p>';
    }
  }
}

/**
 * Get event level info
 */
function getEventLevelInfo(orgLevel: string | undefined): { class: string; text: string } {
  if (orgLevel === 'company') {
    return { class: 'event-level-company', text: 'Firma' };
  } else if (orgLevel === 'department') {
    return { class: 'event-level-department', text: 'Abteilung' };
  } else if (orgLevel === 'team') {
    return { class: 'event-level-team', text: 'Team' };
  }
  return { class: 'event-level-personal', text: 'Persönlich' };
}

/**
 * Create event date section
 */
function createEventDateSection(event: CalendarEvent): HTMLElement {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  const day = startDate.getDate();
  const month = startDate.toLocaleDateString('de-DE', { month: 'short' });

  const timeStr =
    event.all_day === true || event.all_day === 1 || event.all_day === '1'
      ? 'Ganztägig'
      : `${startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

  const dateDiv = document.createElement('div');
  dateDiv.className = 'event-date';

  const daySpan = document.createElement('span');
  daySpan.className = 'event-day';
  daySpan.textContent = day.toString();
  dateDiv.append(daySpan);

  const monthSpan = document.createElement('span');
  monthSpan.className = 'event-month';
  monthSpan.textContent = month;
  dateDiv.append(monthSpan);

  const timeSpan = document.createElement('span');
  timeSpan.className = 'event-time';
  timeSpan.textContent = timeStr;
  dateDiv.append(timeSpan);

  return dateDiv;
}

/**
 * Create event details section
 */
function createEventDetailsSection(event: CalendarEvent): HTMLElement {
  const levelInfo = getEventLevelInfo(event.org_level);
  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'event-details';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'event-title';
  titleDiv.textContent = event.title;
  detailsDiv.append(titleDiv);

  if (event.location !== undefined && event.location !== '') {
    const locationDiv = document.createElement('div');
    locationDiv.className = 'event-location';
    const locationIcon = document.createElement('i');
    locationIcon.className = 'fas fa-map-marker-alt';
    locationDiv.append(locationIcon);
    locationDiv.append(document.createTextNode(' ' + event.location));
    detailsDiv.append(locationDiv);
  }

  const levelSpan = document.createElement('span');
  levelSpan.className = 'event-level ' + levelInfo.class;
  levelSpan.textContent = levelInfo.text;
  detailsDiv.append(levelSpan);

  if (event.user_response !== undefined) {
    const responseSpan = document.createElement('span');
    responseSpan.className = 'status-' + event.user_response + ' event-response';
    responseSpan.textContent = 'Ihr Status: ' + getResponseText(event.user_response);
    detailsDiv.append(responseSpan);
  }

  return detailsDiv;
}

/**
 * Create event item element
 */
function createEventItem(event: CalendarEvent): HTMLElement {
  const eventItem = document.createElement('div');
  eventItem.className = 'event-item';
  eventItem.dataset.id = event.id.toString();

  const dateDiv = createEventDateSection(event);
  eventItem.append(dateDiv);

  const detailsDiv = createEventDetailsSection(event);
  eventItem.append(detailsDiv);

  eventItem.addEventListener('click', () => {
    void viewEvent(event.id);
  });

  return eventItem;
}

/**
 * Display upcoming events in the sidebar
 */
function displayUpcomingEvents(events: CalendarEvent[]): void {
  const container = $$('#upcomingEvents');

  if (!container) {
    console.error('Upcoming events container not found');
    return;
  }

  container.innerHTML = '';

  if (events.length === 0) {
    container.innerHTML = '<p class="text-center">Keine anstehenden Termine gefunden.</p>';
    return;
  }

  events.forEach((event) => {
    const eventItem = createEventItem(event);
    container.append(eventItem);
  });
}

/**
 * Convert response status to readable text
 */
function getResponseText(response: string): string {
  switch (response) {
    case 'accepted':
      return 'Zugesagt';
    case 'declined':
      return 'Abgesagt';
    case 'tentative':
      return 'Vielleicht';
    default:
      return 'Ausstehend';
  }
}

/**
 * View a specific event
 */
// Helper: Ensure user data is loaded
function ensureUserDataLoaded(): void {
  if (currentUserId === null || currentUserId === 0) {
    const userStr = localStorage.getItem('user');
    if (userStr !== null && userStr !== '') {
      try {
        const user = JSON.parse(userStr) as UserData;
        currentUserId = user.id;
        isAdmin = user.role === 'admin' || user.role === 'root';
        console.info('[CALENDAR] Set from localStorage - currentUserId:', currentUserId, 'isAdmin:', isAdmin);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    }
  }
}

// Helper: Fetch event data from API
async function fetchEventData(eventId: number, token: string): Promise<CalendarEvent> {
  const apiUrl = `/api/v2/calendar/events/${eventId}`;

  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    throw new Error('Failed to load event details');
  }

  const data = (await response.json()) as unknown;
  return normalizeEventData(data, true);
}

// Helper: Normalize event data from API response
function normalizeEventData(data: unknown, alwaysV2 = true): CalendarEvent {
  let eventData: CalendarEvent;

  if (typeof data === 'object' && data !== null && 'data' in data) {
    const v2Data = data as { data: { event?: CalendarEvent } | CalendarEvent };
    if (typeof v2Data.data === 'object' && 'event' in v2Data.data && v2Data.data.event !== undefined) {
      eventData = v2Data.data.event;
    } else {
      eventData = v2Data.data as CalendarEvent;
    }
  } else {
    eventData = data as CalendarEvent;
  }

  if (alwaysV2) {
    return mapV2EventToV1Format(eventData);
  }
  return eventData;
}

// Helper: Map V2 API fields to V1 format
function mapV2EventToV1Format(eventData: CalendarEvent): CalendarEvent {
  return {
    ...eventData,
    start_time: eventData.startTime ?? eventData.start_time,
    end_time: eventData.endTime ?? eventData.end_time,
    all_day: eventData.allDay ?? eventData.all_day,
    org_level: eventData.orgLevel ?? eventData.org_level,
    org_id: eventData.orgId ?? eventData.org_id,
    created_by: eventData.createdBy ?? eventData.created_by,
    created_at: eventData.createdAt ?? eventData.created_at,
    updated_at: eventData.updatedAt ?? eventData.updated_at,
    reminder_time: eventData.reminderMinutes ?? eventData.reminderTime ?? eventData.reminder_time,
    creator_name: eventData.creatorName ?? eventData.creator_name,
    department_name: eventData.departmentName ?? eventData.department_name,
    team_name: eventData.teamName ?? eventData.team_name,
    user_response: eventData.userResponse ?? eventData.user_response,
  };
}

// Helper: Format event dates
interface FormattedDates {
  formattedStartDate: string;
  formattedEndDate: string;
  formattedStartTime: string;
  formattedEndTime: string;
}

function formatEventDates(event: CalendarEvent): FormattedDates {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };

  return {
    formattedStartDate: startDate.toLocaleDateString('de-DE', dateOptions),
    formattedEndDate: endDate.toLocaleDateString('de-DE', dateOptions),
    formattedStartTime: startDate.toLocaleTimeString('de-DE', timeOptions),
    formattedEndTime: endDate.toLocaleTimeString('de-DE', timeOptions),
  };
}

// Helper: Get event level text
function getEventLevelText(event: CalendarEvent): string {
  if (event.org_level === 'company') {
    return 'Firmentermin';
  }
  if (event.org_level === 'department') {
    return `Abteilungstermin${event.department_name !== undefined && event.department_name !== '' ? `: ${event.department_name}` : ''}`;
  }
  if (event.org_level === 'team') {
    return `Teamtermin${event.team_name !== undefined && event.team_name !== '' ? `: ${event.team_name}` : ''}`;
  }
  return 'Persönlicher Termin';
}

// Helper: Check if event is all day
function isAllDayEvent(event: CalendarEvent): boolean {
  return event.all_day === true || event.all_day === 1 || event.all_day === '1';
}

// Helper: Build event details section
function buildEventDetailsSection(event: CalendarEvent, dates: FormattedDates, levelText: string): string {
  const isAllDay = isAllDayEvent(event);
  const icon = isAllDay ? 'calendar-day' : 'clock';
  const title = event.title !== '' ? event.title : 'Unbenannter Termin';
  const description =
    event.description !== undefined && event.description !== '' ? `<p>${escapeHtml(event.description)}</p>` : '';

  const startTime = isAllDay ? dates.formattedStartDate : `${dates.formattedStartDate} um ${dates.formattedStartTime}`;
  const endTime = isAllDay ? dates.formattedEndDate : `${dates.formattedEndDate} um ${dates.formattedEndTime}`;

  const locationSection =
    event.location !== undefined && event.location !== ''
      ? `
      <div class="detail-item">
        <i class="fas fa-map-marker-alt"></i>
        <span><strong>Ort:</strong> ${escapeHtml(event.location)}</span>
      </div>`
      : '';

  return `
    <h3>
      <i class="fas fa-${icon}"></i>
      ${escapeHtml(title)}
    </h3>
    ${description}

    <div class="event-details-grid">
      <div class="detail-item">
        <i class="fas fa-calendar"></i>
        <span><strong>Beginn:</strong> ${startTime}</span>
      </div>
      <div class="detail-item">
        <i class="fas fa-calendar-check"></i>
        <span><strong>Ende:</strong> ${endTime}</span>
      </div>
      ${locationSection}
      <div class="detail-item">
        <i class="fas fa-layer-group"></i>
        <span><strong>Ebene:</strong> ${levelText}</span>
      </div>
      <div class="detail-item">
        <i class="fas fa-user"></i>
        <span><strong>Erstellt von:</strong> ${escapeHtml(event.creator_name ?? 'Unknown')}</span>
      </div>
    </div>
  `;
}

// Helper: Build attendee list section
function buildAttendeeListSection(
  attendees: {
    userId?: number;
    user_id?: number;
    firstName?: string;
    first_name?: string;
    lastName?: string;
    last_name?: string;
    username?: string;
    responseStatus?: string;
    response?: string;
  }[],
): string {
  if (attendees.length === 0) {
    return '';
  }

  const attendeeItems = attendees
    .map((attendee) => {
      const firstName = attendee.firstName ?? attendee.first_name ?? '';
      const lastName = attendee.lastName ?? attendee.last_name ?? '';
      const username = attendee.username ?? '';
      const responseStatus = attendee.responseStatus ?? attendee.response ?? 'pending';

      const name =
        `${firstName} ${lastName}`.trim() !== ''
          ? `${firstName} ${lastName}`.trim()
          : username !== ''
            ? username
            : 'Unknown';

      const statusIcon = getAttendeeStatusIcon(responseStatus);

      return `
        <div class="attendee-item">
          <span>${escapeHtml(name)}</span>
          <span class="attendee-status status-${responseStatus}" title="${getResponseText(responseStatus)}">
            ${statusIcon}
          </span>
        </div>
      `;
    })
    .join('');

  return `
    <h4>Teilnehmer (${attendees.length})</h4>
    <div class="attendee-list">
      ${attendeeItems}
    </div>
  `;
}

// Helper: Build user response buttons
function buildUserResponseButtons(event: CalendarEvent): string {
  if (!event.attendees) return '';

  const userAttendee = event.attendees.find((a) => {
    const userId = a.userId ?? a.user_id;
    return userId === currentUserId;
  });

  if (!userAttendee) return '';

  const currentResponse = userAttendee.responseStatus ?? userAttendee.response ?? 'pending';

  return `
    <div class="response-buttons">
      <h4>Ihre Antwort</h4>
      <div class="btn-group">
        <button class="btn ${currentResponse === 'accepted' ? 'btn-success' : 'btn-outline-success'}" data-action="respond-modal" data-event-id="${event.id}" data-response="accepted">
          <i class="fas fa-check"></i> Zusagen
        </button>
        <button class="btn ${currentResponse === 'tentative' ? 'btn-warning' : 'btn-outline-warning'}" data-action="respond-modal" data-event-id="${event.id}" data-response="tentative">
          <i class="fas fa-question"></i> Vielleicht
        </button>
        <button class="btn ${currentResponse === 'declined' ? 'btn-danger' : 'btn-outline-danger'}" data-action="respond-modal" data-event-id="${event.id}" data-response="declined">
          <i class="fas fa-times"></i> Absagen
        </button>
      </div>
    </div>
  `;
}

// Helper: Build action buttons
function buildActionButtons(event: CalendarEvent): string {
  const canEdit = event.created_by === currentUserId;
  const canDelete = event.created_by === currentUserId || isAdmin;

  if (canEdit) {
    return `
      <div class="modal-actions">
        <button class="btn btn-primary" data-action="edit-event" data-event-id="${event.id}">
          <i class="fas fa-edit"></i> Bearbeiten
        </button>
        <button class="btn btn-danger" data-action="delete-event" data-event-id="${event.id}">
          <i class="fas fa-trash"></i> Löschen
        </button>
        <button class="btn btn-secondary" data-action="close">
          <i class="fas fa-times"></i> Schließen
        </button>
      </div>
    `;
  }

  if (canDelete) {
    return `
      <div class="modal-actions">
        <button class="btn btn-danger" data-action="delete-event" data-event-id="${event.id}">
          <i class="fas fa-trash"></i> Löschen
        </button>
        <button class="btn btn-secondary" data-action="close">
          <i class="fas fa-times"></i> Schließen
        </button>
      </div>
    `;
  }

  return `
    <div class="modal-actions">
      <button class="btn btn-secondary" data-action="close">
        <i class="fas fa-times"></i> Schließen
      </button>
    </div>
  `;
}

// Helper: Build complete event modal content
function buildEventModalContent(event: CalendarEvent, dates: FormattedDates): string {
  const levelText = getEventLevelText(event);

  console.info(
    '[CALENDAR] viewEvent - created_by:',
    event.created_by,
    'currentUserId:',
    currentUserId,
    'isAdmin:',
    isAdmin,
  );

  const detailsSection = buildEventDetailsSection(event, dates, levelText);
  const attendeeSection = buildAttendeeListSection(event.attendees ?? []);
  const responseButtons = buildUserResponseButtons(event);
  const actionButtons = buildActionButtons(event);

  return detailsSection + attendeeSection + responseButtons + actionButtons;
}

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
    const event = await fetchEventData(eventId, token);

    // Format dates
    const dates = formatEventDates(event);

    // Build modal content
    const modalContent = buildEventModalContent(event, dates);

    // Show modal with content
    modalManager.show('eventDetailModal', {
      content: modalContent,
      onOpen: () => {
        // Content is already in the modal template
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
    showError('Fehler beim Laden der Termindetails.');
  }
}

/**
 * Get attendee status icon
 */
function getAttendeeStatusIcon(status: string): string {
  switch (status) {
    case 'accepted':
      return '<i class="fas fa-check-circle"></i>';
    case 'declined':
      return '<i class="fas fa-times-circle"></i>';
    case 'tentative':
      return '<i class="fas fa-question-circle"></i>';
    default:
      return '<i class="fas fa-clock"></i>';
  }
}

/**
 * Respond to event invitation
 */
async function respondToEvent(eventId: number, response: string): Promise<void> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') return;

    const apiUrl = `/api/v2/calendar/events/${eventId}/attendees/response`;

    const apiResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ response }),
    });

    if (apiResponse.ok) {
      showSuccess('Ihre Antwort wurde gespeichert.');

      // Close both possible modals
      modalManager.hide('eventDetailsModal');
      modalManager.hide('unreadEventsModal');

      // Refresh calendar and upcoming events
      calendar.refetchEvents();
      void loadUpcomingEvents();

      // Update unread events count
      void checkUnreadEvents();

      // Update badge in navigation
      if (window.unifiedNav) {
        window.unifiedNav.updateUnreadCalendarEvents();
      }

      // Reload the page to refresh everything
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      const error = (await apiResponse.json()) as { message?: string };
      showError(error.message ?? 'Fehler beim Speichern der Antwort');
    }
  } catch (error: unknown) {
    console.error('Error responding to event:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

/**
 * Check if user has permission to create events
 */
function checkEventPermission(): boolean {
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'admin' && userRole !== 'root') {
    console.warn('Calendar: Employees cannot create events');
    showError('Sie haben keine Berechtigung, Termine zu erstellen.');
    return false;
  }
  return true;
}

/**
 * Show event form modal
 */
function showEventModal(): HTMLElement | null {
  console.info('Calendar: modalManager exists:', typeof modalManager !== 'undefined');
  console.info('Calendar: modalManager.show exists:', typeof modalManager.show === 'function');

  // Force re-register template to ensure latest version is used
  const eventFormTemplate = getEventFormModalTemplate();
  modalManager.registerTemplate('eventFormModal', eventFormTemplate);

  // Try to show the modal using modalManager
  console.info('Calendar: Calling modalManager.show...');
  const modal = modalManager.show('eventFormModal');
  console.info('Calendar: modalManager.show returned:', !!modal);

  if (!modal) {
    console.error('Calendar: Failed to show eventFormModal!');
    return null;
  }

  return modal;
}

/**
 * Initialize form for new event
 */
function initializeNewEventForm(modal: HTMLElement, startDate?: Date, endDate?: Date, allDay?: boolean): void {
  // Update modal title
  const modalTitle = modal.querySelector('.modal-title');
  if (modalTitle) {
    modalTitle.textContent = 'Neuer Termin';
  }

  // Set default org level
  const orgLevelInput = $$('#eventOrgLevel') as HTMLInputElement | null;
  const selectedOrgLevelSpan = $$('#selectedOrgLevel');
  if (orgLevelInput) orgLevelInput.value = 'company';
  if (selectedOrgLevelSpan) selectedOrgLevelSpan.textContent = 'Firma';

  // Setup company attendees UI
  setTimeout(() => {
    setupCompanyAttendeesUI();
  }, 50);

  // Set dates if provided
  if (startDate) {
    setEventDateTime('#eventStartDate', '#eventStartTime', startDate, allDay);
  }
  if (endDate) {
    setEventDateTime('#eventEndDate', '#eventEndTime', endDate, allDay);
  }

  // Setup all-day checkbox
  const allDayCheckbox = $$('#eventAllDay') as HTMLInputElement | null;
  if (allDayCheckbox && allDay !== undefined) {
    allDayCheckbox.checked = allDay;
    const timeInputs = $all('.time-input') as NodeListOf<HTMLInputElement>;
    timeInputs.forEach((input) => {
      input.disabled = allDay;
    });
  }

  updateOrgIdDropdown('personal');
}

/**
 * Setup company attendees UI
 */
function setupCompanyAttendeesUI(): void {
  const attendeesGroup = $$('#attendeesGroup');
  const attendeesContainer = $$('#attendeesContainer');
  const addAttendeeBtn = $$('#addAttendeeBtn');

  if (attendeesGroup) attendeesGroup.style.display = 'block';
  if (addAttendeeBtn) addAttendeeBtn.style.display = 'none';
  if (attendeesContainer) {
    attendeesContainer.innerHTML =
      '<p class="text-info"><i class="fas fa-info-circle"></i> Alle Mitarbeiter der Firma werden automatisch eingeladen</p>';
  }

  const departmentGroup = $$('#departmentGroup');
  const teamGroup = $$('#teamGroup');
  if (departmentGroup) departmentGroup.style.display = 'none';
  if (teamGroup) teamGroup.style.display = 'none';
}

/**
 * Set event date and time inputs
 */
function setEventDateTime(dateSelector: string, timeSelector: string, date: Date, allDay?: boolean): void {
  const dateInput = $$(dateSelector) as HTMLInputElement | null;
  const timeInput = $$(timeSelector) as HTMLInputElement | null;

  if (dateInput) {
    dateInput.value = formatDateForInput(date);
  }
  if (allDay !== true && timeInput) {
    timeInput.value = formatTimeForInput(date);
  }
}

/**
 * Initialize form for editing event
 */
function initializeEditEventForm(modal: HTMLElement, eventId: number): void {
  const modalTitle = modal.querySelector('.modal-title');
  if (modalTitle) {
    modalTitle.textContent = 'Termin bearbeiten';
  }
  updateSelectedAttendees();
  void loadEventForEdit(eventId);
}

/**
 * Open event form for creating/editing
 */
function openEventForm(eventId?: number | null, startDate?: Date, endDate?: Date, allDay?: boolean): void {
  console.info('Calendar: openEventForm called with:', { eventId, startDate, endDate, allDay });

  // Check permissions
  if (!checkEventPermission()) {
    return;
  }

  // Show modal
  const modal = showEventModal();
  if (!modal) {
    return;
  }

  // Reset form
  const form = $$('#eventForm') as HTMLFormElement | null;
  if (form) {
    form.reset();
  }

  // Setup event listeners
  setupModalEventListeners();

  // Clear attendees
  selectedAttendees = [];

  // Initialize form based on mode (new or edit)
  if (eventId !== undefined && eventId !== null) {
    initializeEditEventForm(modal, eventId);
  } else {
    initializeNewEventForm(modal, startDate, endDate, allDay);
  }
}

/**
 * Format date for input
 */
function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format time for input
 */
function formatTimeForInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Clear container content
 */
function clearContainer(container: HTMLElement): void {
  while (container.firstChild) {
    container.firstChild.remove();
  }
}

/**
 * Create department dropdown option
 */
function createDepartmentOption(dept: { id: number; name: string }, action: string): HTMLDivElement {
  const option = document.createElement('div');
  option.className = 'dropdown-option';
  option.dataset.value = dept.id.toString();
  option.textContent = dept.name;
  option.dataset.action = action;
  option.dataset.deptId = dept.id.toString();
  option.dataset.deptName = dept.name;
  return option;
}

/**
 * Get attendee info message based on level
 */
function getAttendeeInfoMessage(level: string): string {
  switch (level) {
    case 'company':
      return ' Alle Mitarbeiter der Firma werden automatisch eingeladen';
    case 'department':
      return ' Alle Mitarbeiter der ausgewählten Abteilung werden automatisch eingeladen';
    case 'team':
      return ' Alle Mitglieder des ausgewählten Teams werden automatisch eingeladen';
    default:
      return '';
  }
}

/**
 * Setup personal attendees UI
 */
function setupPersonalAttendeesUI(
  attendeesGroup: HTMLElement,
  addAttendeeBtn: HTMLElement | null,
  attendeesContainer: HTMLElement | null,
): void {
  attendeesGroup.style.display = 'block';
  if (addAttendeeBtn) addAttendeeBtn.style.display = 'inline-flex';

  if (attendeesContainer && selectedAttendees.length === 0) {
    clearContainer(attendeesContainer);
    const noPara = document.createElement('p');
    noPara.className = 'text-muted';
    noPara.textContent = 'Keine Teilnehmer ausgewählt';
    attendeesContainer.append(noPara);
  }
}

/**
 * Setup automatic attendees UI
 */
function setupAutomaticAttendeesUI(
  level: string,
  attendeesGroup: HTMLElement,
  addAttendeeBtn: HTMLElement | null,
  attendeesContainer: HTMLElement | null,
): void {
  attendeesGroup.style.display = 'block';
  if (addAttendeeBtn) addAttendeeBtn.style.display = 'none';

  if (attendeesContainer) {
    clearContainer(attendeesContainer);
    const infoPara = document.createElement('p');
    infoPara.className = 'text-info';
    const infoIcon = document.createElement('i');
    infoIcon.className = 'fas fa-info-circle';
    infoPara.append(infoIcon);
    infoPara.append(document.createTextNode(getAttendeeInfoMessage(level)));
    attendeesContainer.append(infoPara);
  }

  selectedAttendees = [];
}

/**
 * Populate department dropdown
 */
function populateDepartmentDropdown(dropdown: HTMLElement | null, action: string): void {
  if (!dropdown) return;

  departments.forEach((dept) => {
    const option = createDepartmentOption(dept, action);
    dropdown.append(option);
  });
}

/**
 * Hide organization dropdowns
 */
function hideOrgDropdowns(): void {
  const departmentGroup = $$('#departmentGroup');
  const departmentDropdown = $$('#departmentDropdown');
  const teamGroup = $$('#teamGroup');
  const teamDropdown = $$('#teamDropdown');

  if (departmentDropdown) departmentDropdown.innerHTML = '';
  if (teamDropdown) teamDropdown.innerHTML = '';
  if (departmentGroup) departmentGroup.style.display = 'none';
  if (teamGroup) teamGroup.style.display = 'none';
}

/**
 * Setup attendees UI based on level
 */
function setupAttendeesUI(level: string): void {
  const attendeesGroup = $$('#attendeesGroup');
  const addAttendeeBtn = $$('#addAttendeeBtn');
  const attendeesContainer = $$('#attendeesContainer');

  if (!attendeesGroup) return;

  if (level === 'personal') {
    setupPersonalAttendeesUI(attendeesGroup, addAttendeeBtn, attendeesContainer);
  } else {
    setupAutomaticAttendeesUI(level, attendeesGroup, addAttendeeBtn, attendeesContainer);
  }
}

/**
 * Update organization ID dropdown based on level
 */
function updateOrgIdDropdown(level: string): void {
  hideOrgDropdowns();
  setupAttendeesUI(level);

  const departmentGroup = $$('#departmentGroup');
  const teamGroup = $$('#teamGroup');
  const departmentDropdown = $$('#departmentDropdown');

  if (level === 'department' && departmentGroup) {
    departmentGroup.style.display = 'block';
    populateDepartmentDropdown(departmentDropdown, 'select-department');
  } else if (level === 'team' && departmentGroup && teamGroup) {
    departmentGroup.style.display = 'block';
    teamGroup.style.display = 'block';
    populateDepartmentDropdown(departmentDropdown, 'select-department-with-teams');
  }
}

/**
 * Select department
 */
function selectDepartment(departmentId: number, departmentName: string): void {
  const selectedElement = $$('#selectedDepartment');
  const inputElement = $$('#eventDepartmentId') as HTMLInputElement | null;

  if (selectedElement) selectedElement.textContent = departmentName;
  if (inputElement) inputElement.value = departmentId.toString();
}

/**
 * Select team
 */
function selectTeam(teamId: number, teamName: string): void {
  const selectedElement = $$('#selectedTeam');
  const inputElement = $$('#eventTeamId') as HTMLInputElement | null;

  if (selectedElement) selectedElement.textContent = teamName;
  if (inputElement) inputElement.value = teamId.toString();
}

/**
 * Load teams for selected department
 */
function loadTeamsForDepartment(departmentId: number): void {
  const teamDropdown = $$('#teamDropdown');
  if (!teamDropdown) return;

  teamDropdown.innerHTML = '';

  // Filter teams by department
  // Handle both v1 (snake_case) and v2 (camelCase)
  const departmentTeams = teams.filter((team) => {
    const teamDeptId = team.department_id ?? team.departmentId;
    return teamDeptId === departmentId;
  });

  departmentTeams.forEach((team) => {
    const option = document.createElement('div');
    option.className = 'dropdown-option';
    option.dataset.value = team.id.toString();
    option.textContent = team.name;
    option.dataset.action = 'select-team';
    option.dataset.teamId = team.id.toString();
    option.dataset.teamName = team.name;
    teamDropdown.append(option);
  });

  // Reset team selection
  const selectedTeam = $$('#selectedTeam');
  if (selectedTeam) selectedTeam.textContent = '-- Team wählen --';
  const teamInput = $$('#eventTeamId') as HTMLInputElement | null;
  if (teamInput) teamInput.value = '';
}

/**
 * Validate form and authentication
 */
function validateFormAndAuth(): { form: HTMLElement; token: string } | null {
  const form = $$('#eventForm');
  if (form === null) {
    console.error('Form not found');
    return null;
  }

  const token = getAuthToken();
  if (token === null || token === '') {
    console.error('No token found');
    return null;
  }

  return { form, token };
}

/**
 * Get all form input values
 */
function getFormInputValues(): Record<string, HTMLInputElement | HTMLTextAreaElement | null> {
  return {
    titleInput: $$('#eventTitle') as HTMLInputElement | null,
    descriptionInput: $$('#eventDescription') as HTMLTextAreaElement | null,
    startDateInput: $$('#eventStartDate') as HTMLInputElement | null,
    startTimeInput: $$('#eventStartTime') as HTMLInputElement | null,
    endDateInput: $$('#eventEndDate') as HTMLInputElement | null,
    endTimeInput: $$('#eventEndTime') as HTMLInputElement | null,
    allDayInput: $$('#eventAllDay') as HTMLInputElement | null,
    locationInput: $$('#eventLocation') as HTMLInputElement | null,
    orgLevelInput: $$('#eventOrgLevel') as HTMLInputElement | null,
    departmentIdInput: $$('#eventDepartmentId') as HTMLInputElement | null,
    teamIdInput: $$('#eventTeamId') as HTMLInputElement | null,
    reminderTimeInput: $$('#eventReminderTime') as HTMLInputElement | null,
    eventIdInput: $$('#eventId') as HTMLInputElement | null,
    requiresResponseInput: $$('#eventRequiresResponse') as HTMLInputElement | null,
  };
}

/**
 * Validate required form fields
 */
function validateRequiredFields(inputs: Record<string, HTMLInputElement | HTMLTextAreaElement | null>): boolean {
  const { titleInput, startDateInput, endDateInput, orgLevelInput } = inputs;

  if (titleInput?.value === undefined || titleInput.value === '') {
    showError('Bitte geben Sie einen Titel ein');
    return false;
  }

  if (startDateInput?.value === undefined || startDateInput.value === '') {
    showError('Bitte wählen Sie ein Startdatum');
    return false;
  }

  if (endDateInput?.value === undefined || endDateInput.value === '') {
    showError('Bitte wählen Sie ein Enddatum');
    return false;
  }

  if (orgLevelInput?.value === undefined || orgLevelInput.value === '') {
    showError('Bitte wählen Sie aus, wer den Termin sehen soll');
    return false;
  }

  return true;
}

/**
 * Get event color based on org level
 */
function getEventColor(orgLevel: string): string {
  switch (orgLevel) {
    case 'company':
      return '#3498db';
    case 'department':
      return '#e67e22';
    case 'team':
      return '#2ecc71';
    case 'personal':
      return '#9b59b6';
    default:
      return '#3498db';
  }
}

/**
 * Build date time strings
 */
function buildDateTimeStrings(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  allDay: boolean,
): { startDateTime: string; endDateTime: string } | null {
  if (!allDay) {
    if (startTime === '') {
      showError('Bitte wählen Sie eine Startzeit');
      return null;
    }
    if (endTime === '') {
      showError('Bitte wählen Sie eine Endzeit');
      return null;
    }
  }

  const startDateTime = allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`;
  const endDateTime = allDay ? `${endDate}T23:59:59` : `${endDate}T${endTime}:00`;

  return { startDateTime, endDateTime };
}

/**
 * Build recurrence rule
 */
function buildRecurrenceRule(): string {
  const recurrenceTypeElement = $$('#eventRecurrence') as HTMLInputElement | null;
  const recurrenceType = recurrenceTypeElement?.value;

  if (recurrenceType === undefined || recurrenceType === '') {
    return '';
  }

  let recurrenceRule = recurrenceType;
  const recurrenceEnd = $$('#selectedRecurrenceEnd')?.textContent;
  const recurrenceCountElement = $$('#recurrenceCount') as HTMLInputElement | null;
  const recurrenceCount = recurrenceCountElement?.value;
  const recurrenceEndDateElement = $$('#recurrenceEndDate') as HTMLInputElement | null;
  const recurrenceEndDate = recurrenceEndDateElement?.value;

  if (recurrenceEnd === 'Nach ... Wiederholungen' && recurrenceCount !== undefined && recurrenceCount !== '') {
    recurrenceRule += `;COUNT=${recurrenceCount}`;
  } else if (recurrenceEnd === 'Am bestimmten Datum' && recurrenceEndDate !== undefined && recurrenceEndDate !== '') {
    recurrenceRule += `;UNTIL=${recurrenceEndDate}`;
  }

  return recurrenceRule;
}

/**
 * Parse input value to number
 */
function parseInputToNumber(input: HTMLInputElement | null): number | null {
  if (input?.value !== undefined && input.value !== '') {
    return Number.parseInt(input.value, 10);
  }
  return null;
}

/**
 * Get department and team IDs
 */
function getDepartmentAndTeamIds(
  orgLevel: string,
  departmentIdInput: HTMLInputElement | null,
  teamIdInput: HTMLInputElement | null,
): { departmentId: number | null; teamId: number | null } {
  if (orgLevel === 'department') {
    return {
      departmentId: parseInputToNumber(departmentIdInput),
      teamId: null,
    };
  }

  if (orgLevel === 'team') {
    return {
      departmentId: parseInputToNumber(departmentIdInput),
      teamId: parseInputToNumber(teamIdInput),
    };
  }

  return { departmentId: null, teamId: null };
}

/**
 * Build event data for v2 API
 */
function buildEventDataV2(params: {
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  allDay: boolean;
  location: string;
  orgLevel: string;
  color: string;
  requiresResponse: boolean;
  departmentId: number | null;
  teamId: number | null;
  reminderTime: number | undefined;
  recurrenceRule: string;
}): Record<string, unknown> {
  const eventData: Record<string, unknown> = {
    title: params.title,
    description: params.description,
    startTime: params.startDateTime,
    endTime: params.endDateTime,
    allDay: params.allDay,
    location: params.location,
    orgLevel: params.orgLevel,
    color: params.color,
    requiresResponse: params.requiresResponse,
  };

  if (params.departmentId !== null) eventData.departmentId = params.departmentId;
  if (params.teamId !== null) eventData.teamId = params.teamId;
  if (params.reminderTime !== undefined) eventData.reminderMinutes = params.reminderTime;
  if (selectedAttendees.length > 0) eventData.attendeeIds = selectedAttendees;
  if (params.recurrenceRule !== '') eventData.recurrenceRule = params.recurrenceRule;

  return eventData;
}

/**
 * Get save event URL
 */
function getSaveEventUrl(eventId: string | undefined): string {
  const hasEventId = eventId !== undefined && eventId !== '';

  if (hasEventId) {
    return `/api/v2/calendar/events/${eventId}`;
  }

  return '/api/v2/calendar/events';
}

/**
 * Handle save success
 */
function handleSaveSuccess(eventId: string | undefined, result: { id?: number; message?: string }): void {
  console.info('[CALENDAR] Save successful:', result);
  const message =
    eventId !== undefined && eventId !== '' ? 'Termin erfolgreich aktualisiert!' : 'Termin erfolgreich erstellt!';
  showSuccess(message);
  modalManager.hide('eventFormModal');
  calendar.refetchEvents();
  void loadUpcomingEvents();
}

/**
 * Send save event request
 */
async function sendSaveEventRequest(
  eventData: Record<string, unknown>,
  eventId: string | undefined,
  token: string,
): Promise<void> {
  const url = getSaveEventUrl(eventId);
  const method = eventId !== undefined && eventId !== '' ? 'PUT' : 'POST';

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(eventData),
  });

  if (response.ok) {
    const result = (await response.json()) as { id?: number; message?: string };
    handleSaveSuccess(eventId, result);
  } else {
    const error = (await response.json()) as { message?: string };
    console.error('[CALENDAR] Save error:', error);
    showError(error.message ?? 'Fehler beim Speichern des Termins');
  }
}

/**
 * Parse reminder time
 */
function parseReminderTime(input: HTMLElement | null): number | undefined {
  if (input instanceof HTMLInputElement && input.value !== '') {
    const parsed = Number.parseInt(input.value, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return undefined;
}

/**
 * Build event parameters
 */
function buildEventParams(inputs: ReturnType<typeof getFormInputValues>): {
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  allDay: boolean;
  location: string;
  orgLevel: string;
  color: string;
  requiresResponse: boolean;
  departmentId: number | null;
  teamId: number | null;
  reminderTime: number | undefined;
  recurrenceRule: string;
} | null {
  const orgLevel = inputs.orgLevelInput?.value ?? 'personal';
  const color = getEventColor(orgLevel);
  const allDay = inputs.allDayInput instanceof HTMLInputElement ? inputs.allDayInput.checked : false;

  const dateTimeResult = buildDateTimeStrings(
    inputs.startDateInput?.value ?? '',
    inputs.startTimeInput?.value ?? '',
    inputs.endDateInput?.value ?? '',
    inputs.endTimeInput?.value ?? '',
    allDay,
  );
  if (!dateTimeResult) return null;

  const { departmentId, teamId } = getDepartmentAndTeamIds(
    orgLevel,
    inputs.departmentIdInput instanceof HTMLInputElement ? inputs.departmentIdInput : null,
    inputs.teamIdInput instanceof HTMLInputElement ? inputs.teamIdInput : null,
  );

  return {
    title: inputs.titleInput?.value ?? '',
    description: inputs.descriptionInput?.value ?? '',
    startDateTime: dateTimeResult.startDateTime,
    endDateTime: dateTimeResult.endDateTime,
    allDay,
    location: inputs.locationInput?.value ?? '',
    orgLevel,
    color,
    requiresResponse:
      inputs.requiresResponseInput instanceof HTMLInputElement ? inputs.requiresResponseInput.checked : false,
    departmentId,
    teamId,
    reminderTime: parseReminderTime(inputs.reminderTimeInput),
    recurrenceRule: buildRecurrenceRule(),
  };
}

/**
 * Save event
 */
async function saveEvent(): Promise<void> {
  console.info('saveEvent called');

  const authData = validateFormAndAuth();
  if (!authData) return;

  const inputs = getFormInputValues();
  if (!validateRequiredFields(inputs)) return;

  const eventParams = buildEventParams(inputs);
  if (!eventParams) return;

  const eventData = buildEventDataV2(eventParams);

  console.info('Saving event data:', eventData);

  try {
    await sendSaveEventRequest(eventData, inputs.eventIdInput?.value, authData.token);
  } catch (error: unknown) {
    console.error('Error saving event:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

/**
 * Fetch event data from API
 */
async function fetchEventById(eventId: number, token: string): Promise<unknown> {
  const apiUrl = `/api/v2/calendar/events/${eventId}`;

  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch event');
  }

  return await response.json();
}

/**
 * Parse event API response and normalize data
 */
function parseEventApiResponse(data: unknown): CalendarEvent {
  let eventData: CalendarEvent;

  if (typeof data === 'object' && data !== null && 'data' in data) {
    const v2Data = data as { data: { event?: CalendarEvent } | CalendarEvent };
    if (typeof v2Data.data === 'object' && 'event' in v2Data.data && v2Data.data.event !== undefined) {
      eventData = v2Data.data.event;
    } else {
      eventData = v2Data.data as CalendarEvent;
    }
  } else {
    eventData = data as CalendarEvent;
  }

  // Map v2 API camelCase to snake_case for consistency
  return {
    ...eventData,
    start_time: eventData.startTime ?? eventData.start_time,
    end_time: eventData.endTime ?? eventData.end_time,
    all_day: eventData.allDay ?? eventData.all_day,
    org_level: eventData.orgLevel ?? eventData.org_level,
    org_id: eventData.orgId ?? eventData.org_id,
    created_by: eventData.createdBy ?? eventData.created_by,
    created_at: eventData.createdAt ?? eventData.created_at,
    updated_at: eventData.updatedAt ?? eventData.updated_at,
    reminder_time: eventData.reminderMinutes ?? eventData.reminderTime ?? eventData.reminder_time,
    creator_name: eventData.creatorName ?? eventData.creator_name,
    department_name: eventData.departmentName ?? eventData.department_name,
    team_name: eventData.teamName ?? eventData.team_name,
    user_response: eventData.userResponse ?? eventData.user_response,
  };
}

/**
 * Check if current user can edit the event
 */
function canUserEditEvent(event: CalendarEvent): boolean {
  if (currentUserId === null || currentUserId === 0) {
    const userStr = localStorage.getItem('user');
    if (userStr !== null && userStr !== '') {
      try {
        const user = JSON.parse(userStr) as UserData;
        currentUserId = user.id;
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    }
  }

  const createdBy = event.createdBy ?? event.created_by;
  return createdBy === currentUserId;
}

/**
 * Fill event form with basic fields
 */
function fillEventFormBasicFields(form: HTMLFormElement, event: CalendarEvent): void {
  // Set event ID
  const eventIdInput = form.elements.namedItem('event_id') as HTMLInputElement | null;
  if (eventIdInput !== null && event.id !== 0) {
    eventIdInput.value = event.id.toString();
  }

  // Set basic fields
  const titleInput = form.elements.namedItem('title') as HTMLInputElement;
  titleInput.value = event.title;

  const descInput = form.elements.namedItem('description') as HTMLTextAreaElement;
  descInput.value = event.description ?? '';

  const locationInput = form.elements.namedItem('location') as HTMLInputElement;
  locationInput.value = event.location ?? '';
}

/**
 * Fill event form date and time fields
 */
function fillEventFormDateTimeFields(form: HTMLFormElement, event: CalendarEvent): void {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  // Set date fields
  const startDateInput = form.elements.namedItem('start_date') as HTMLInputElement;
  startDateInput.value = formatDateForInput(startDate);

  const endDateInput = form.elements.namedItem('end_date') as HTMLInputElement;
  endDateInput.value = formatDateForInput(endDate);

  // Set all day checkbox
  const allDayCheckbox = form.elements.namedItem('all_day') as HTMLInputElement;
  allDayCheckbox.checked = Boolean(event.all_day);

  // Set time fields
  if (event.all_day !== true) {
    const startTimeInput = form.elements.namedItem('start_time') as HTMLInputElement;
    startTimeInput.value = formatTimeForInput(startDate);

    const endTimeInput = form.elements.namedItem('end_time') as HTMLInputElement;
    endTimeInput.value = formatTimeForInput(endDate);
  }

  // Update time inputs disabled state
  const timeInputs = $all('.time-input') as NodeListOf<HTMLInputElement>;
  timeInputs.forEach((input) => {
    input.disabled = Boolean(event.all_day);
  });
}

/**
 * Load event for editing
 */
async function loadEventForEdit(eventId: number): Promise<void> {
  const token = getAuthToken();
  if (token === null || token === '') return;

  try {
    const data = await fetchEventById(eventId, token);
    const event = parseEventApiResponse(data);

    // Check if user is the creator
    if (!canUserEditEvent(event)) {
      modalManager.hide('eventDetailModal');
      modalManager.hide('eventFormModal');
      showError(
        'Sie haben keine Berechtigung, diesen Termin zu bearbeiten. Nur der Ersteller kann Termine bearbeiten. Bitte wenden Sie sich an den Ersteller des Termins.',
      );
      return;
    }

    // Fill form with event data
    const form = $$('#eventForm') as HTMLFormElement | null;
    if (form === null) return;

    fillEventFormBasicFields(form, event);
    fillEventFormDateTimeFields(form, event);

    // Set org level dropdown
    fillEventFormOrgLevel(event);

    // Set additional fields
    fillEventFormAdditionalFields(form, event);

    // Load attendees
    loadEventAttendees(event);
  } catch (error: unknown) {
    console.error('Error loading event:', error);
    showError('Ein Fehler ist aufgetreten');
    modalManager.hide('eventFormModal');
  }
}

/**
 * Get org level text
 */
function getOrgLevelText(orgLevel: string): string {
  switch (orgLevel) {
    case 'company':
      return 'Alle Mitarbeiter';
    case 'department':
      return 'Bestimmte Abteilung';
    case 'team':
      return 'Bestimmtes Team';
    default:
      return 'Persönlicher Termin';
  }
}

/**
 * Fill org level dropdown in event form
 */
function fillEventFormOrgLevel(event: CalendarEvent): void {
  const selectedOrgLevelSpan = $$('#selectedOrgLevel');
  if (selectedOrgLevelSpan) {
    const orgLevelText = getOrgLevelText(event.org_level);
    selectedOrgLevelSpan.textContent = orgLevelText;
    selectedOrgLevelSpan.dataset.value = event.org_level;
  }

  // Update org dropdown
  updateOrgIdDropdown(event.org_level);
  if (event.org_id !== undefined && event.org_id !== 0) {
    const orgName = event.department_name ?? event.team_name ?? '';
    selectOrgId(event.org_id, orgName);
  }
}

/**
 * Fill additional form fields (reminder, response required)
 */
function fillEventFormAdditionalFields(_form: HTMLFormElement, event: CalendarEvent): void {
  // Set reminder if field exists
  const reminderSelect = $$('#eventReminderTime') as HTMLSelectElement | null;
  if (reminderSelect !== null && event.reminder_time !== undefined) {
    reminderSelect.value = event.reminder_time.toString();
  }

  // Set requires response checkbox
  const requiresResponseInput = $$('#eventRequiresResponse') as HTMLInputElement | null;
  if (requiresResponseInput !== null) {
    const requiresResponse = event.requiresResponse ?? event.requires_response ?? false;
    requiresResponseInput.checked = requiresResponse;
  }
}

/**
 * Load event attendees
 */
function loadEventAttendees(event: CalendarEvent): void {
  if (event.org_level === 'personal' && event.attendees) {
    selectedAttendees = event.attendees
      .map((a) => a.user_id ?? a.userId)
      .filter((id): id is number => id !== undefined);
    updateSelectedAttendees();
  } else {
    selectedAttendees = [];
  }
}

/**
 * Delete event
 */
function deleteEvent(eventId: number): void {
  console.info('[CALENDAR] deleteEvent called with ID:', eventId);

  // Store the event ID for later use
  eventToDelete = eventId;

  // Show confirmation modal using modalManager
  modalManager.show('confirmationModal', {
    onOpen: () => {
      console.info('[CALENDAR] Confirmation modal opened, eventToDelete:', eventToDelete);

      // Add click handler to the delete button when modal opens
      const confirmBtn = $$('#confirmDeleteBtn');
      if (confirmBtn) {
        confirmBtn.dataset.action = 'confirm-delete-event';
        confirmBtn.dataset.eventId = eventToDelete?.toString() ?? '';
      }
    },
  });
}

/**
 * Confirm and execute event deletion
 */
async function confirmDeleteEvent(): Promise<void> {
  console.info('[CALENDAR] confirmDeleteEvent called, eventToDelete:', eventToDelete);

  if (eventToDelete === null) {
    console.error('[CALENDAR] No event ID to delete');
    modalManager.hide('confirmationModal');
    return;
  }

  // Store the ID locally to avoid race conditions
  const eventId = eventToDelete;
  // Clear the global variable immediately to prevent race conditions
  eventToDelete = null;

  const token = getAuthToken();
  if (token === null || token === '') return;

  try {
    const apiUrl = `/api/v2/calendar/events/${eventId}`;

    console.info('[CALENDAR] Deleting event - v2: true, URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      console.info('[CALENDAR] Delete successful');
      showSuccess('Termin erfolgreich gelöscht!');
      modalManager.hide('confirmationModal');
      modalManager.hide('eventDetailModal');

      // Refresh calendar
      calendar.refetchEvents();
      void loadUpcomingEvents();
    } else {
      const error = (await response.json()) as { message?: string };
      showError(error.message ?? 'Fehler beim Löschen des Termins');
    }
  } catch (error: unknown) {
    console.error('Error deleting event:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

/**
 * Add attendee
 */
function addAttendee(userId: number, _name: string): void {
  if (!selectedAttendees.includes(userId)) {
    selectedAttendees.push(userId);
    updateSelectedAttendees();

    // Clear search
    const searchInput = $$('#attendeeSearch') as HTMLInputElement | null;
    const searchResults = $$('#attendeeSearchResults');
    if (searchInput !== null) searchInput.value = '';
    if (searchResults !== null) searchResults.innerHTML = '';
  }
}

/**
 * Remove attendee
 */
function removeAttendee(userId: number): void {
  selectedAttendees = selectedAttendees.filter((id) => id !== userId);
  updateSelectedAttendees();
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

/**
 * Fetch user data
 */
async function fetchUserData(): Promise<UserData> {
  const token = getAuthToken();
  if (token === null || token === '') {
    throw new Error('No authentication token found');
  }

  // Use AUTH feature flag for auth endpoints, not CALENDAR flag
  const profileUrl = '/api/v2/users/me';

  const response = await fetch(profileUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }

  return await (response.json() as Promise<UserData>);
}

/**
 * Load departments and teams
 */
/**
 * Extract array from v2 API response
 */
function extractV2Array(data: { data: unknown }): unknown[] | null {
  if (typeof data.data === 'object' && data.data !== null && 'data' in data.data) {
    const nestedData = data.data as { data: unknown };
    if (Array.isArray(nestedData.data)) {
      return nestedData.data as unknown[];
    }
  }
  if (Array.isArray(data.data)) {
    return data.data as unknown[];
  }
  return null;
}

/**
 * Extract array from API response (v1 or v2)
 */
function extractArrayFromApiResponse<T>(data: unknown): T[] {
  // Handle v2 API response
  if (typeof data === 'object' && data !== null && 'data' in data) {
    const v2Result = extractV2Array(data as { data: unknown });
    if (v2Result !== null) {
      return v2Result as T[];
    }
  }

  // Handle v1 API response or direct array
  if (Array.isArray(data)) {
    return data as T[];
  }

  return [];
}

/**
 * Fetch data from API endpoint
 */
async function fetchApiData(endpoint: string, token: string): Promise<unknown> {
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

/**
 * Get current user ID from localStorage
 */
function getCurrentUserIdFromStorage(): number {
  const userStr = localStorage.getItem('user');
  if (userStr === null || userStr === '') {
    return 0;
  }

  try {
    const user = JSON.parse(userStr) as UserData;
    return user.id;
  } catch (error) {
    console.error('Error parsing user from localStorage:', error);
    return 0;
  }
}

/**
 * Load departments
 */
async function loadDepartments(token: string): Promise<void> {
  const url = '/api/v2/departments';
  const data = await fetchApiData(url, token);

  if (data !== null) {
    departments = extractArrayFromApiResponse<Department>(data);
  }
}

/**
 * Load teams
 */
async function loadTeams(token: string): Promise<void> {
  const url = '/api/v2/teams';
  const data = await fetchApiData(url, token);

  if (data !== null) {
    teams = extractArrayFromApiResponse<Team>(data);
  }
}

/**
 * Load employees
 */
async function loadEmployees(token: string): Promise<void> {
  // Only admins can fetch users list
  if (!canViewAllEmployees()) {
    employees = [];
    return;
  }

  const url = '/api/v2/users';
  const data = await fetchApiData(url, token);

  if (data !== null) {
    const allEmployees = extractArrayFromApiResponse<User>(data);
    const currentUserId = getCurrentUserIdFromStorage();
    employees = allEmployees.filter((emp) => emp.id !== currentUserId);
  }
}

/**
 * Load departments, teams, and employees
 */
async function loadDepartmentsAndTeams(): Promise<void> {
  const token = getAuthToken();
  if (token === null || token === '') return;

  try {
    await Promise.all([loadDepartments(token), loadTeams(token), loadEmployees(token)]);
  } catch (error: unknown) {
    console.error('Error loading departments, teams, and employees:', error);
  }
}

/**
 * Utility function to escape HTML
 */
function escapeHtml(text: string | null | undefined): string {
  if (text === null || text === undefined || text === '') return '';
  const str = text;
  return str.replace(/["&'<>]/g, (m) => {
    // Use switch to avoid object injection issues
    switch (m) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#039;';
      default:
        return m;
    }
  });
}

// Extend window for calendar functions
declare global {
  interface Window {
    viewEvent: typeof viewEvent;
    showEventDetails: typeof showEventDetails;
    editEvent: (eventId: number) => void;
    deleteEvent: typeof deleteEvent;
    respondToEvent: typeof respondToEvent;
    openEventForm: typeof openEventForm;
    saveEvent: typeof saveEvent;
    selectOrgId: typeof selectOrgId;
    addAttendee: typeof addAttendee;
    removeAttendee: typeof removeAttendee;
    updateOrgIdDropdown: typeof updateOrgIdDropdown;
    toggleOrgLevelDropdown: typeof toggleOrgLevelDropdown;
    selectOrgLevel: typeof selectOrgLevel;
    toggleOrgIdDropdown: typeof toggleOrgIdDropdown;
    toggleReminderDropdown: typeof toggleReminderDropdown;
    selectReminder: typeof selectReminder;
    toggleRecurrenceDropdown: typeof toggleRecurrenceDropdown;
    selectRecurrence: typeof selectRecurrence;
    toggleRecurrenceEndDropdown: typeof toggleRecurrenceEndDropdown;
    selectRecurrenceEnd: typeof selectRecurrenceEnd;
    closeAllDropdowns: typeof closeAllDropdowns;
    confirmDeleteEvent: typeof confirmDeleteEvent;
  }
}

/**
 * Setup event listeners for modal buttons
 */
function setupModalEventListeners(): void {
  // Save event button
  const saveEventBtn = $$('#saveEventBtn');
  if (saveEventBtn !== null) {
    // Remove existing listeners by cloning
    const newButton = saveEventBtn.cloneNode(true) as HTMLButtonElement;
    saveEventBtn.parentNode?.replaceChild(newButton, saveEventBtn);

    newButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.info('Save button clicked');
      void saveEvent();
    });
  }

  // Add attendee button
  const addAttendeeBtn = $$('#addAttendeeBtn');
  if (addAttendeeBtn) {
    const newButton = addAttendeeBtn.cloneNode(true) as HTMLButtonElement;
    addAttendeeBtn.parentNode?.replaceChild(newButton, addAttendeeBtn);

    newButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      modalManager.show('attendeesModal');
      void loadEmployeesForAttendees();
    });
  }

  // All day checkbox
  const allDayCheckbox = $$('#eventAllDay');
  if (allDayCheckbox !== null) {
    const newCheckbox = allDayCheckbox.cloneNode(true) as HTMLInputElement;
    allDayCheckbox.parentNode?.replaceChild(newCheckbox, allDayCheckbox);

    newCheckbox.addEventListener('change', function (this: HTMLInputElement) {
      const timeInputs = $all('.time-input') as NodeListOf<HTMLInputElement>;
      timeInputs.forEach((input) => {
        input.disabled = this.checked;
        if (this.checked) {
          input.value = '';
        }
      });
    });
  }

  // Organization level change - handled by dropdown delegation
  console.info('Organization level input found');
}

// Custom dropdown functions
function toggleOrgLevelDropdown(): void {
  const dropdown = $$('#orgLevelDropdown');
  const display = dropdown?.previousElementSibling;

  if (dropdown && display) {
    if (dropdown.classList.contains('active')) {
      dropdown.classList.remove('active');
      display.classList.remove('active');
    } else {
      closeAllDropdowns();
      dropdown.classList.add('active');
      display.classList.add('active');
    }
  }
}

function selectOrgLevel(value: string, text: string): void {
  const selectedElement = $$('#selectedOrgLevel');
  const inputElement = $$('#eventOrgLevel') as HTMLInputElement | null;

  if (selectedElement !== null) selectedElement.textContent = text;
  if (inputElement !== null) inputElement.value = value;

  // Update org ID dropdown based on selection
  updateOrgIdDropdown(value);
  closeAllDropdowns();
}

function toggleOrgIdDropdown(): void {
  const display = $$('#orgIdDisplay');
  if (display?.classList.contains('disabled') === true) return;

  const dropdown = $$('#orgIdDropdown');
  if (dropdown && display) {
    if (dropdown.classList.contains('active')) {
      dropdown.classList.remove('active');
      display.classList.remove('active');
    } else {
      closeAllDropdowns();
      dropdown.classList.add('active');
      display.classList.add('active');
    }
  }
}

function toggleReminderDropdown(): void {
  const dropdown = $$('#reminderDropdown');
  const display = dropdown?.previousElementSibling;

  if (dropdown && display) {
    if (dropdown.classList.contains('active')) {
      dropdown.classList.remove('active');
      display.classList.remove('active');
    } else {
      closeAllDropdowns();
      dropdown.classList.add('active');
      display.classList.add('active');
    }
  }
}

function selectReminder(value: string, text: string): void {
  const selectedElement = $$('#selectedReminder');
  const inputElement = $$('#eventReminderTime') as HTMLInputElement | null;

  if (selectedElement !== null) selectedElement.textContent = text;
  if (inputElement !== null) inputElement.value = value;
  closeAllDropdowns();
}

function toggleRecurrenceDropdown(): void {
  const dropdown = $$('#recurrenceDropdown');
  const display = dropdown?.previousElementSibling;

  if (dropdown && display) {
    if (dropdown.classList.contains('active')) {
      dropdown.classList.remove('active');
      display.classList.remove('active');
    } else {
      closeAllDropdowns();
      dropdown.classList.add('active');
      display.classList.add('active');
    }
  }
}

function toggleDepartmentDropdown(): void {
  const dropdown = $$('#departmentDropdown');
  const display = dropdown?.previousElementSibling;

  if (dropdown && display) {
    if (dropdown.classList.contains('active')) {
      dropdown.classList.remove('active');
      display.classList.remove('active');
    } else {
      closeAllDropdowns();
      dropdown.classList.add('active');
      display.classList.add('active');
    }
  }
}

function toggleTeamDropdown(): void {
  const dropdown = $$('#teamDropdown');
  const display = dropdown?.previousElementSibling;

  if (dropdown && display) {
    if (dropdown.classList.contains('active')) {
      dropdown.classList.remove('active');
      display.classList.remove('active');
    } else {
      closeAllDropdowns();
      dropdown.classList.add('active');
      display.classList.add('active');
    }
  }
}

function selectRecurrence(value: string, text: string): void {
  const selectedElement = $$('#selectedRecurrence');
  const inputElement = $$('#eventRecurrence') as HTMLInputElement | null;

  if (selectedElement !== null) selectedElement.textContent = text;
  if (inputElement !== null) inputElement.value = value;

  // Show/hide recurrence end options
  const endWrapper = $$('#recurrenceEndWrapper');
  if (endWrapper) {
    endWrapper.style.display = value !== '' ? 'block' : 'none';
  }

  closeAllDropdowns();
}

function toggleRecurrenceEndDropdown(): void {
  const dropdown = $$('#recurrenceEndDropdown');
  const display = dropdown?.previousElementSibling;

  if (dropdown && display) {
    if (dropdown.classList.contains('active')) {
      dropdown.classList.remove('active');
      display.classList.remove('active');
    } else {
      closeAllDropdowns();
      dropdown.classList.add('active');
      display.classList.add('active');
    }
  }
}

function selectRecurrenceEnd(value: string, text: string): void {
  const selectedElement = $$('#selectedRecurrenceEnd');
  if (selectedElement) selectedElement.textContent = text;

  const countWrapper = $$('#recurrenceCountWrapper');
  const dateWrapper = $$('#recurrenceEndDateWrapper');

  if (countWrapper && dateWrapper) {
    if (value === 'after') {
      countWrapper.style.display = 'block';
      dateWrapper.style.display = 'none';
    } else if (value === 'date') {
      countWrapper.style.display = 'none';
      dateWrapper.style.display = 'block';
    } else {
      countWrapper.style.display = 'none';
      dateWrapper.style.display = 'none';
    }
  }

  closeAllDropdowns();
}

function closeAllDropdowns(): void {
  $all('.custom-dropdown').forEach((dropdown) => {
    dropdown.classList.remove('active');
  });
  $all('.dropdown-display').forEach((display) => {
    display.classList.remove('active');
  });
  $all('.dropdown-options').forEach((options) => {
    options.classList.remove('active');
  });
}

// Load employees for attendees modal
/**
 * Setup attendees UI for employees (email input)
 */
function setupEmployeeAttendeesUI(): void {
  const attendeesList = $$('#attendeesList');
  if (attendeesList) {
    attendeesList.innerHTML = `
      <div class="form-group">
        <label>Teilnehmer per E-Mail einladen:</label>
        <input type="email" id="attendeeEmailInput" class="form-control" placeholder="email@example.com">
        <button type="button" class="btn btn-primary mt-2" data-action="add-attendee-by-email">
          <i class="fas fa-plus"></i> Hinzufügen
        </button>
        <div id="selectedAttendeesEmails" class="mt-3"></div>
      </div>
    `;
  }

  // Hide the add selected attendees button for employees
  const addSelectedAttendeesBtn = $$('#addSelectedAttendeesBtn');
  if (addSelectedAttendeesBtn) {
    addSelectedAttendeesBtn.style.display = 'none';
  }
}

/**
 * Get user display name
 */
function getUserDisplayName(user: User): string {
  const firstName = user.first_name ?? '';
  const lastName = user.last_name ?? '';
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName !== '') return fullName;
  if (user.username !== '') return user.username;
  return user.email;
}

/**
 * Create attendee option element
 */
function createAttendeeOption(user: User): HTMLDivElement {
  const displayName = getUserDisplayName(user);
  const optionDiv = document.createElement('div');
  optionDiv.className = 'attendee-option';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `attendee-${user.id}`;
  checkbox.value = user.id.toString();
  optionDiv.append(checkbox);

  const label = document.createElement('label');
  label.htmlFor = `attendee-${user.id}`;
  label.textContent = `${displayName} (${user.email})`;
  optionDiv.append(label);

  return optionDiv;
}

/**
 * Populate attendees list with users
 */
function populateAttendeesList(users: User[]): void {
  const attendeesList = $$('#attendeesList');
  if (!attendeesList) return;

  // Clear existing content
  while (attendeesList.firstChild) {
    attendeesList.firstChild.remove();
  }

  // Add user options
  users.forEach((user) => {
    const optionDiv = createAttendeeOption(user);
    attendeesList.append(optionDiv);
  });
}

/**
 * Setup add selected attendees button
 */
function setupAddAttendeesButton(): void {
  const addSelectedAttendeesBtn = $$('#addSelectedAttendeesBtn');
  if (!addSelectedAttendeesBtn) return;

  // Remove any existing listeners by cloning
  const newButton = addSelectedAttendeesBtn.cloneNode(true) as HTMLButtonElement;
  addSelectedAttendeesBtn.parentNode?.replaceChild(newButton, addSelectedAttendeesBtn);

  newButton.addEventListener('click', () => {
    console.info('Add selected attendees button clicked');
    const checkboxes = $all('#attendeesList input[type="checkbox"]:checked') as NodeListOf<HTMLInputElement>;

    selectedAttendees = [];
    checkboxes.forEach((checkbox) => {
      const userId = Number.parseInt(checkbox.value, 10);
      if (!Number.isNaN(userId)) {
        selectedAttendees.push(userId);
      }
    });

    updateSelectedAttendees();
    modalManager.hide('attendeesModal');
  });
}

/**
 * Load employees for attendees selection
 */
async function loadEmployeesForAttendees(): Promise<void> {
  const token = getAuthToken();
  if (token === null || token === '') return;

  try {
    const userRole = localStorage.getItem('userRole');

    // For employees, show email input instead of user list
    if (userRole === 'employee') {
      setupEmployeeAttendeesUI();
      return;
    }

    // For admins, load and display user list
    const url = '/api/v2/users';
    const data = await fetchApiData(url, token);

    if (data !== null) {
      const users = extractArrayFromApiResponse<User>(data);
      const currentUserId = getCurrentUserIdFromStorage();

      // Store employees for later use
      employees = users.filter((user) => user.id !== currentUserId);

      // Populate the UI
      populateAttendeesList(employees);
      setupAddAttendeesButton();
    }
  } catch (error: unknown) {
    console.error('Error loading employees for attendees:', error);
  }
}

/**
 * Update selected attendees display
 */
function updateSelectedAttendees(): void {
  const container = $$('#attendeesContainer');
  if (!container) return;

  if (selectedAttendees.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine Teilnehmer ausgewählt</p>';
    return;
  }

  // Get employee details for selected attendees
  const attendeeHTML = selectedAttendees
    .map((userId) => {
      const employee = employees.find((emp) => emp.id === userId);
      if (employee) {
        // Handle both snake_case (v1) and camelCase (v2) field names
        const firstName = employee.first_name ?? '';
        const lastName = employee.last_name ?? '';
        const displayName =
          `${firstName} ${lastName}`.trim() !== ''
            ? `${firstName} ${lastName}`.trim()
            : employee.username !== ''
              ? employee.username
              : employee.email;

        return `
        <div class="attendee-item">
          <span class="attendee-name">
            ${escapeHtml(displayName)}
          </span>
          <button type="button" class="remove-attendee" data-action="remove-attendee" data-user-id="${userId}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      }
      return '';
    })
    .filter((html) => html !== '')
    .join('');

  // Use setHTML from dom-utils for safe HTML setting
  setHTML(container, attendeeHTML);
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  console.info('Calendar: Exporting functions to window...');
  window.viewEvent = viewEvent;
  window.showEventDetails = showEventDetails;
  window.editEvent = (eventId: number) => {
    openEventForm(eventId);
  };
  window.deleteEvent = deleteEvent;
  window.respondToEvent = respondToEvent;
  window.openEventForm = openEventForm;
  window.saveEvent = saveEvent;
  window.selectOrgId = selectOrgId;
  window.addAttendee = addAttendee;
  window.removeAttendee = removeAttendee;
  window.updateOrgIdDropdown = updateOrgIdDropdown;

  // Custom dropdown functions
  window.toggleOrgLevelDropdown = toggleOrgLevelDropdown;
  window.selectOrgLevel = selectOrgLevel;
  window.toggleOrgIdDropdown = toggleOrgIdDropdown;
  window.toggleReminderDropdown = toggleReminderDropdown;
  window.selectReminder = selectReminder;
  window.toggleRecurrenceDropdown = toggleRecurrenceDropdown;
  window.selectRecurrence = selectRecurrence;
  window.toggleRecurrenceEndDropdown = toggleRecurrenceEndDropdown;
  window.selectRecurrenceEnd = selectRecurrenceEnd;
  window.closeAllDropdowns = closeAllDropdowns;

  // Confirmation modal functions
  window.confirmDeleteEvent = confirmDeleteEvent;

  console.info('Calendar: window.openEventForm available:', typeof window.openEventForm);
}

/**
 * Get modal header template
 */
function getModalHeaderTemplate(): string {
  return `
    <div class="modal-header">
      <h2 class="modal-title">Neuer Termin</h2>
      <button type="button" class="modal-close" data-action="close">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
}

/**
 * Get title and description fields template
 */
function getTitleDescriptionTemplate(): string {
  return `
    <input type="hidden" id="eventId" name="event_id" />
    <!-- Titel und Inhalt -->
    <div class="form-group">
      <label for="eventTitle">
        <i class="fas fa-heading"></i> Titel <span class="required">*</span>
      </label>
      <input
        type="text"
        class="form-control"
        id="eventTitle"
        name="title"
        placeholder="Titel des Termins eingeben"
        required
      />
    </div>
    <div class="form-group">
      <label for="eventDescription">
        <i class="fas fa-align-left"></i> Beschreibung
      </label>
      <textarea
        class="form-control"
        id="eventDescription"
        name="description"
        rows="4"
        placeholder="Beschreibung des Termins (Markdown-Formatierung möglich)"
      ></textarea>
      <small class="form-text text-muted">
        <i class="fas fa-info-circle"></i> Markdown-Formatierung möglich
      </small>
    </div>
  `;
}

/**
 * Get date and time fields template
 */
function getDateTimeTemplate(): string {
  return `

    <!-- Datum und Zeit -->
    <div class="form-row">
      <div class="form-group col-md-6">
        <label for="eventStartDate">
          <i class="fas fa-calendar"></i> Startdatum <span class="required">*</span>
        </label>
        <input type="date" class="form-control" id="eventStartDate" name="start_date" required />
      </div>
      <div class="form-group col-md-6">
        <label for="eventStartTime">
          <i class="fas fa-clock"></i> Startzeit <span class="required">*</span>
        </label>
        <input type="time" class="form-control time-input" id="eventStartTime" name="start_time" required />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group col-md-6">
        <label for="eventEndDate">
          <i class="fas fa-calendar-check"></i> Enddatum <span class="required">*</span>
        </label>
        <input type="date" class="form-control" id="eventEndDate" name="end_date" required />
      </div>
      <div class="form-group col-md-6">
        <label for="eventEndTime">
          <i class="fas fa-clock"></i> Endzeit <span class="required">*</span>
        </label>
        <input type="time" class="form-control time-input" id="eventEndTime" name="end_time" required />
      </div>
    </div>
    <div class="form-group">
      <div class="custom-control custom-checkbox">
        <input type="checkbox" class="custom-control-input" id="eventAllDay" name="all_day" />
        <label class="custom-control-label" for="eventAllDay">
          <i class="fas fa-sun"></i> Ganztägiger Termin
        </label>
      </div>
    </div>
  `;
}

/**
 * Get location field template
 */
function getLocationTemplate(): string {
  return `

    <!-- Ort -->
    <div class="form-group">
      <label for="eventLocation">
        <i class="fas fa-map-marker-alt"></i> Ort
      </label>
      <input
        type="text"
        class="form-control"
        id="eventLocation"
        name="location"
        placeholder="z.B. Konferenzraum 1, Online Meeting, etc."
      />
    </div>
  `;
}

/**
 * Get organization level template
 */
function getOrgLevelTemplate(): string {
  return `

    <!-- Organisationseinheit -->
    <div class="form-group">
      <label>
        <i class="fas fa-users"></i> Event-Ebene <span class="required">*</span>
      </label>
      <div class="custom-dropdown" id="orgLevelWrapper">
        <div class="custom-select-display dropdown-display">
          <span id="selectedOrgLevel">Firma</span>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
        <div class="dropdown-options" id="orgLevelDropdown">
          <div class="dropdown-option" data-value="company">
            <i class="fas fa-building"></i> Firma (Alle Mitarbeiter)
          </div>
          <div class="dropdown-option" data-value="department">
            <i class="fas fa-sitemap"></i> Abteilung
          </div>
          <div class="dropdown-option" data-value="team">
            <i class="fas fa-user-friends"></i> Team
          </div>
          <div class="dropdown-option" data-value="personal">
            <i class="fas fa-user"></i> Persönlich
          </div>
        </div>
      </div>
      <input type="hidden" id="eventOrgLevel" name="org_level" required value="company" />
    </div>
  `;
}

/**
 * Get department and team selection template
 */
function getDepartmentTeamTemplate(): string {
  return `
    <!-- Department Selection (nur bei department oder team Events) -->
    <div class="form-group" id="departmentGroup" style="display: none;">
      <label>
        <i class="fas fa-sitemap"></i> Abteilung auswählen <span class="required">*</span>
      </label>
      <div class="custom-dropdown" id="departmentWrapper">
        <div class="custom-select-display dropdown-display" id="departmentDisplay">
          <span id="selectedDepartment">-- Abteilung wählen --</span>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
        <div class="dropdown-options" id="departmentDropdown">
          <!-- Wird dynamisch befüllt -->
        </div>
      </div>
      <input type="hidden" id="eventDepartmentId" name="department_id" />
    </div>
    <!-- Team Selection (nur bei team Events) -->
    <div class="form-group" id="teamGroup" style="display: none;">
      <label>
        <i class="fas fa-user-friends"></i> Team auswählen <span class="required">*</span>
      </label>
      <div class="custom-dropdown" id="teamWrapper">
        <div class="custom-select-display dropdown-display" id="teamDisplay">
          <span id="selectedTeam">-- Team wählen --</span>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
        <div class="dropdown-options" id="teamDropdown">
          <!-- Wird dynamisch befüllt basierend auf Department -->
        </div>
      </div>
      <input type="hidden" id="eventTeamId" name="team_id" />
    </div>
  `;
}

/**
 * Get attendees and response template
 */
function getAttendeesResponseTemplate(): string {
  return `
    <!-- Teilnehmer -->
    <div class="form-group" id="attendeesGroup" style="display: block;">
      <label>
        <i class="fas fa-users"></i> Teilnehmer
      </label>
      <div id="attendeesContainer">
        <p class="text-info"><i class="fas fa-info-circle"></i> Alle Mitarbeiter der Firma werden automatisch eingeladen</p>
      </div>
      <button type="button" class="btn btn-secondary mt-2" id="addAttendeeBtn" style="display: none;">
        <i class="fas fa-plus"></i> Teilnehmer hinzufügen
      </button>
    </div>
    <!-- Statusanfrage -->
    <div class="form-group" id="requiresResponseGroup">
      <label>
        <i class="fas fa-question-circle"></i> Statusanfrage
      </label>
      <div class="form-check form-switch">
        <input type="checkbox" class="form-check-input" id="eventRequiresResponse" name="requires_response" />
        <label class="form-check-label" for="eventRequiresResponse">
          Teilnehmer müssen Zusage/Absage geben
        </label>
      </div>
      <small class="form-text text-muted">
        <i class="fas fa-info-circle"></i> Bei Aktivierung werden Teilnehmer aufgefordert, ihre Teilnahme zu bestätigen
      </small>
    </div>
  `;
}

/**
 * Get recurrence template
 */
function getRecurrenceTemplate(): string {
  return `

    <!-- Wiederkehrend -->
    <div class="form-group">
      <label>
        <i class="fas fa-redo"></i> Wiederkehrend
      </label>
      <div class="custom-dropdown" id="recurrenceWrapper">
        <div class="custom-select-display dropdown-display">
          <span id="selectedRecurrence">Keine Wiederholung</span>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
        <div class="dropdown-options" id="recurrenceDropdown">
          <div class="dropdown-option" data-value="">Keine Wiederholung</div>
          <div class="dropdown-option" data-value="daily">Täglich</div>
          <div class="dropdown-option" data-value="weekly">Wöchentlich</div>
          <div class="dropdown-option" data-value="monthly">Monatlich</div>
          <div class="dropdown-option" data-value="yearly">Jährlich</div>
        </div>
      </div>
      <input type="hidden" id="eventRecurrence" />
    </div>
    <!-- Wiederkehrung Ende -->
    <div class="form-group" id="recurrenceEndWrapper" style="display: none;">
      <label>
        <i class="fas fa-calendar-times"></i> Wiederkehrung endet
      </label>
      <div class="custom-dropdown" id="recurrenceEndTypeWrapper">
        <div class="custom-select-display dropdown-display" data-action="toggle-recurrence-end-dropdown">
          <span id="selectedRecurrenceEnd">Nie</span>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
        <div class="dropdown-options" id="recurrenceEndDropdown">
          <div class="dropdown-option" data-value="never" data-action="select-recurrence-end" data-end-type="never" data-end-text="Nie">Nie</div>
          <div class="dropdown-option" data-value="after" data-action="select-recurrence-end" data-end-type="after" data-end-text="Nach Anzahl">Nach Anzahl</div>
          <div class="dropdown-option" data-value="until" data-action="select-recurrence-end" data-end-type="until" data-end-text="An Datum">An Datum</div>
        </div>
      </div>
      <input type="hidden" id="eventRecurrenceEndType" value="never" />
      <div class="mt-2" id="recurrenceEndDetails" style="display: none;">
        <input type="number" class="form-control" id="eventRecurrenceCount" placeholder="Anzahl der Wiederholungen" min="1" style="display: none;" />
        <input type="date" class="form-control" id="eventRecurrenceUntil" style="display: none;" />
      </div>
    </div>
  `;
}

/**
 * Get reminder template
 */
function getReminderTemplate(): string {
  return `

    <!-- Erinnerung -->
    <div class="form-group">
      <label>
        <i class="fas fa-bell"></i> Erinnerung
      </label>
      <div class="custom-dropdown" id="reminderWrapper">
        <div class="custom-select-display dropdown-display">
          <span id="selectedReminder">Keine Erinnerung</span>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
        <div class="dropdown-options" id="reminderDropdown">
          <div class="dropdown-option" data-value="">Keine Erinnerung</div>
          <div class="dropdown-option" data-value="15">15 Minuten vorher</div>
          <div class="dropdown-option" data-value="30">30 Minuten vorher</div>
          <div class="dropdown-option" data-value="60">1 Stunde vorher</div>
          <div class="dropdown-option" data-value="1440">1 Tag vorher</div>
        </div>
      </div>
      <input type="hidden" id="eventReminderTime" />
    </div>
  `;
}

/**
 * Get modal footer template
 */
function getModalFooterTemplate(): string {
  return `
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" data-action="close">Abbrechen</button>
      <button type="button" class="btn btn-primary" id="saveEventBtn">
        <i class="fas fa-save"></i> Speichern
      </button>
    </div>
  `;
}

/**
 * Get Event Form Modal Template
 */
function getEventFormModalTemplate(): string {
  return `
    <div class="modal-overlay" id="eventFormModal">
      <div class="modal-container modal-lg">
        ${getModalHeaderTemplate()}
        <div class="modal-body">
          <form id="eventForm">
            ${getTitleDescriptionTemplate()}
            ${getDateTimeTemplate()}
            ${getLocationTemplate()}
            ${getOrgLevelTemplate()}
            ${getDepartmentTeamTemplate()}
            ${getAttendeesResponseTemplate()}
            ${getRecurrenceTemplate()}
            ${getReminderTemplate()}
          </form>
        </div>
        ${getModalFooterTemplate()}
      </div>
    </div>
  `;
}

/**
 * Get Event Detail Modal Template
 */
function getEventDetailModalTemplate(): string {
  return `
    <div class="modal-overlay" id="eventDetailModal">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">
            <i class="fas fa-calendar-alt"></i>
            Termin Details
          </h2>
          <button type="button" class="modal-close" data-action="close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div id="eventDetailContent" class="fade-in">
            <!-- Wird dynamisch gefüllt -->
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get Attendees Modal Template
 */
function getAttendeesModalTemplate(): string {
  return `
    <div class="modal-overlay" id="attendeesModal">
      <div class="modal-container modal-md">
        <div class="modal-header">
          <h2 class="modal-title">Teilnehmer hinzufügen</h2>
          <button type="button" class="modal-close" data-action="close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <input
              type="text"
              class="form-control"
              id="attendeeSearch"
              placeholder="Mitarbeiter suchen..."
            />
          </div>
          <div id="attendeesList" class="attendees-list">
            <!-- Wird dynamisch befüllt -->
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-action="close">Abbrechen</button>
          <button type="button" class="btn btn-primary" id="addSelectedAttendeesBtn">
            <i class="fas fa-plus"></i> Ausgewählte hinzufügen
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get Event Response Modal Template
 */
function getEventResponseModalTemplate(): string {
  return `
    <div class="modal-overlay" id="eventResponseModal">
      <div class="modal-container modal-sm">
        <div class="modal-header">
          <h2 id="eventResponseModalLabel">Auf Einladung antworten</h2>
          <button type="button" class="modal-close" data-action="close">&times;</button>
        </div>
        <div class="modal-body">
          <p>Wie möchten Sie auf diese Einladung antworten?</p>
          <div class="response-buttons">
            <button type="button" class="response-btn" data-response="accepted">
              <i class="fas fa-check"></i>
              <span>Zusagen</span>
            </button>
            <button type="button" class="response-btn" data-response="tentative">
              <i class="fas fa-question"></i>
              <span>Vielleicht</span>
            </button>
            <button type="button" class="response-btn" data-response="declined">
              <i class="fas fa-times"></i>
              <span>Absagen</span>
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-action="close">Schließen</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get confirmation modal template
 */
function getConfirmationModalTemplate(): string {
  return `
    <div class="modal-overlay" id="confirmationModal">
      <div class="modal-container modal-sm">
        <div class="modal-header">
          <h2>Bestätigung</h2>
          <button type="button" class="modal-close" data-action="close">&times;</button>
        </div>
        <div class="modal-body">
          <p class="mb-0">Möchten Sie diesen Termin wirklich löschen?</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-action="close">Abbrechen</button>
          <button type="button" class="btn btn-danger" id="confirmDeleteBtn">
            <i class="fas fa-trash"></i> Löschen
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Enter fullscreen mode
 */
async function enterFullscreen(container: HTMLElement): Promise<void> {
  document.body.classList.add('calendar-fullscreen-mode');

  if ('requestFullscreen' in container) {
    await container.requestFullscreen();
  } else if ((container as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
    const elem = container as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (elem.webkitRequestFullscreen) {
      await elem.webkitRequestFullscreen();
    }
  } else if ((container as HTMLElement & { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen) {
    const elem = container as HTMLElement & { msRequestFullscreen?: () => Promise<void> };
    if (elem.msRequestFullscreen) {
      await elem.msRequestFullscreen();
    }
  }
}

/**
 * Exit fullscreen mode
 */
async function exitFullscreen(): Promise<void> {
  if ('exitFullscreen' in document) {
    await document.exitFullscreen();
  } else if ((document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen) {
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
    if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    }
  } else if ((document as Document & { msExitFullscreen?: () => Promise<void> }).msExitFullscreen) {
    const doc = document as Document & { msExitFullscreen?: () => Promise<void> };
    if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }
  }
}

/**
 * Update fullscreen button icon
 */
function updateFullscreenButton(button: HTMLElement, isFullscreen: boolean): void {
  const icon = button.querySelector('i');
  if (icon) {
    icon.className = isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
  }
  button.title = isFullscreen ? 'Vollbild beenden' : 'Vollbild';
}

/**
 * Toggle fullscreen mode
 */
async function toggleFullscreen(container: HTMLElement, button: HTMLElement): Promise<void> {
  try {
    const isFullscreen = document.fullscreenElement !== null;

    if (!isFullscreen) {
      await enterFullscreen(container);
    } else {
      await exitFullscreen();
    }

    updateFullscreenButton(button, !isFullscreen);
  } catch (error: unknown) {
    console.error('Calendar: Fullscreen error:', error);
    showError('Vollbild-Modus konnte nicht aktiviert werden');
  }
}

/**
 * Setup fullscreen controls for the calendar
 */
function setupFullscreenControls(): void {
  const fullscreenBtn = $$('#fullscreenBtn');
  const calendarContainer = $$('#calendarContainer');

  if (!fullscreenBtn || !calendarContainer) {
    console.warn('Calendar: Fullscreen elements not found');
    return;
  }

  // Enter fullscreen
  fullscreenBtn.addEventListener('click', () => {
    void toggleFullscreen(calendarContainer, fullscreenBtn);
  });

  // Listen for fullscreen changes
  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = document.fullscreenElement !== null;

    if (!isFullscreen) {
      document.body.classList.remove('calendar-fullscreen-mode');
    }

    updateFullscreenButton(fullscreenBtn, isFullscreen);

    // Refresh calendar layout after fullscreen change
    if (typeof calendar !== 'undefined') {
      setTimeout(() => {
        calendar.render();
      }, 100);
    }
  });
}
