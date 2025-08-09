/**
 * Calendar System
 * Client-side TypeScript for the company calendar feature
 */

import type { User } from '../types/api.types';
import { featureFlags } from '../utils/feature-flags';

import { getAuthToken, showSuccess, showError } from './auth';
import { modalManager } from './utils/modal-manager';

// FullCalendar types
interface FullCalendarApi {
  render(): void;
  refetchEvents(): void;
  getEventById(id: string): FullCalendarEvent | null;
  getEvents(): FullCalendarEvent[];
  addEvent(event: FullCalendarEventInput): FullCalendarEvent;
  unselect(): void;
  changeView(viewName: string): void;
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

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  all_day: boolean | number | string;
  location?: string;
  org_level: 'personal' | 'company' | 'department' | 'team';
  org_id?: number;
  color?: string;
  reminder_time?: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  // Additional fields from joins
  creator_name?: string;
  department_name?: string;
  team_name?: string;
  // User-specific fields
  user_response?: 'accepted' | 'declined' | 'tentative' | 'pending';
  attendees?: EventAttendee[];
}

interface EventAttendee {
  id: number;
  event_id: number;
  user_id: number;
  response: 'accepted' | 'declined' | 'tentative' | 'pending';
  responded_at?: string;
  // User info
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

// Interface for creating new calendar events
interface CreateCalendarEventData {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location: string;
  org_level: string;
  color: string;
  department_id?: number;
  team_id?: number;
  reminder_time?: number;
  attendee_ids?: number[];
  recurrence_rule?: string;
  org_id?: number;
}

interface Department {
  id: number;
  name: string;
}

interface Team {
  id: number;
  name: string;
  department_id: number;
}

interface UserData extends User {
  departmentId?: number;
  department_id?: number;
  teamId?: number;
  team_id?: number;
}

// Global variables
let calendar: FullCalendarApi; // FullCalendar instance
// Load filter from localStorage or default to 'all'
let currentFilter: string = localStorage.getItem('calendarFilter') ?? 'all';
let currentSearch: string = '';
let departments: Department[] = [];
let teams: Team[] = [];
let employees: User[] = [];
let isAdmin: boolean = false;
let currentUserId: number | null = null;
let selectedAttendees: number[] = [];
let calendarView: string = 'dayGridMonth'; // Default view

/**
 * Helper function to set selected organization ID
 */
function selectOrgId(id: number, name: string): void {
  const selectedOrgIdElement = document.getElementById('selectedOrgId') as HTMLElement;
  const eventOrgIdElement = document.getElementById('eventOrgId') as HTMLInputElement;

  if (selectedOrgIdElement) {
    selectedOrgIdElement.textContent = name;
  }
  if (eventOrgIdElement) {
    eventOrgIdElement.value = id.toString();
  }
}

// Initialize when document is ready
function initializeApp() {
  console.info('Calendar: Starting initialization...');

  // Register modal templates
  registerModalTemplates();

  // Check if user is logged in
  try {
    checkLoggedIn();
    // Load user data
    fetchUserData()
      .then((userData: UserData) => {
        currentUserId = userData.id;
        isAdmin = userData.role === 'admin' || userData.role === 'root';

        // Show/hide "New Event" button based on permissions
        const newEventBtn = document.getElementById('newEventBtn') as HTMLButtonElement;
        console.info('Calendar: newEventBtn found:', !!newEventBtn);
        if (newEventBtn) {
          newEventBtn.style.display = isAdmin ? 'block' : 'none';
        }

        // Load departments and teams for form dropdowns
        void loadDepartmentsAndTeams();

        // Initialize calendar - wrapped to prevent redirect on calendar errors
        try {
          initializeCalendar();
        } catch (calendarError) {
          console.error('Calendar initialization error:', calendarError);
          showError('Kalender konnte nicht geladen werden.');
        }

        // Load upcoming events
        void loadUpcomingEvents();

        // Setup event listeners
        console.info('Calendar: Setting up event listeners...');
        setupEventListeners();

        // Setup color picker
        setupColorPicker();

        console.info('Calendar: Initialization complete');
      })
      .catch((error) => {
        console.error('Error loading user data:', error);
        window.location.href = '/login';
      });
  } catch (error) {
    console.error('Error checking login:', error);
    window.location.href = '/login';
  }
}

// Wait for both DOM and scripts to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already loaded, run directly
  setTimeout(initializeApp, 100); // Small delay to ensure all scripts are loaded
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

  console.info('Calendar: All modal templates registered');
}

/**
 * Initialize FullCalendar
 */
let calendarInitialized = false;

function initializeCalendar(): void {
  if (calendarInitialized) {
    console.info('Calendar: Already initialized, skipping...');
    return;
  }

  console.info('Calendar: Initializing FullCalendar...');

  const calendarEl = document.getElementById('calendar') as HTMLElement;
  console.info('Calendar: Calendar element found:', !!calendarEl);

  if (!calendarEl) {
    console.error('Calendar element not found');
    return;
  }

  // Check if FullCalendar is loaded
  console.info('Calendar: FullCalendar loaded:', typeof window.FullCalendar !== 'undefined');
  if (typeof window.FullCalendar === 'undefined') {
    console.info('Calendar: FullCalendar not yet loaded, waiting...');
    // Try again after a short delay
    setTimeout(() => initializeCalendar(), 500);
    return;
  }

  // Get user role for permission checks
  const userRole = localStorage.getItem('userRole');
  console.info('Calendar: User role for permissions:', userRole);

  calendarInitialized = true;

  try {
    calendar = new window.FullCalendar.Calendar(calendarEl, {
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
      firstDay: 1, // Monday as first day
      slotMinTime: '07:00:00',
      slotMaxTime: '20:00:00',
      height: 'auto',
      nowIndicator: true,
      dayMaxEvents: true,
      navLinks: true,
      selectable: userRole === 'admin' || userRole === 'root', // Only admins and root can select dates
      selectMirror: userRole === 'admin' || userRole === 'root', // Show visual feedback only for admins/root
      dateClick(info: { date: Date; allDay: boolean }) {
        console.info('Calendar: Date clicked:', info);
        // Only admins and root can create events
        if (userRole === 'admin' || userRole === 'root') {
          // Open event form for single day click
          openEventForm(null, info.date, info.date, info.allDay);
        } else {
          console.info('Calendar: Employees cannot create events');
        }
      },
      select(info: FullCalendarSelectInfo) {
        console.info('Calendar: Date range selected:', info);
        // Only admins and root can create events
        if (userRole === 'admin' || userRole === 'root') {
          // Bei Klick auf einzelnen Tag: allDay = false
          // Nur wenn der ganze Tag ausgewählt wurde UND es die Monatsansicht ist
          const allDay = info.allDay && info.view.type === 'dayGridMonth';
          openEventForm(null, info.start, info.end, allDay);
        } else {
          console.info('Calendar: Employees cannot create events');
        }
      },
      events(
        fetchInfo: FullCalendarFetchInfo,
        successCallback: (events: FullCalendarEventInput[]) => void,
        failureCallback: (error: Error) => void,
      ) {
        loadCalendarEvents(fetchInfo).then(successCallback).catch(failureCallback);
      },
      eventClick(info: FullCalendarEventClickInfo) {
        void viewEvent(parseInt(info.event.id, 10));
      },
      eventMouseEnter(info: FullCalendarEventMouseEnterInfo) {
        // Show tooltip on hover
        const tooltip = document.createElement('div');
        tooltip.className = 'event-tooltip';
        tooltip.innerHTML = `
        <strong>${info.event.title}</strong><br>
        ${info.event.extendedProps?.description ?? ''}
        ${info.event.extendedProps?.location ? `<br><i class="fas fa-map-marker-alt"></i> ${info.event.extendedProps.location}` : ''}
      `;
        document.body.appendChild(tooltip);

        const rect = info.el.getBoundingClientRect();
        tooltip.style.position = 'absolute';
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 5}px`;
        tooltip.style.zIndex = '9999';

        (info.el as HTMLElement & { _tooltip?: HTMLElement })._tooltip = tooltip;
      },
      eventMouseLeave(info: FullCalendarEventMouseEnterInfo) {
        const el = info.el as HTMLElement & { _tooltip?: HTMLElement };
        if (el._tooltip) {
          el._tooltip.remove();
          delete el._tooltip;
        }
      },
    });

    calendar.render();
  } catch (error) {
    console.error('Error initializing calendar:', error);
    showError('Fehler beim Initialisieren des Kalenders. Bitte laden Sie die Seite neu.');
  }
}

/**
 * Setup all event listeners
 */
function setupEventListeners(): void {
  // Filter by level using tab buttons (Gesamt/Firma/Abteilung/Team/Meine)
  const levelFilterButtons = document.querySelectorAll<HTMLButtonElement>('#levelFilter button.tab-btn');
  levelFilterButtons.forEach((button) => {
    // Set initial active state based on saved filter
    if (button.dataset.value === currentFilter) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }

    button.addEventListener('click', function (this: HTMLButtonElement) {
      // Remove active class from all buttons
      levelFilterButtons.forEach((btn) => btn.classList.remove('active'));
      // Add active class to clicked button
      this.classList.add('active');

      currentFilter = this.dataset.value ?? 'all';
      // Save filter to localStorage
      localStorage.setItem('calendarFilter', currentFilter);
      console.info('[CALENDAR] Filter changed to:', currentFilter);
      calendar.refetchEvents();
    });
  });

  // Legacy: Filter by level using pill buttons (if any exist)
  document.querySelectorAll<HTMLElement>('.filter-pill[data-value]').forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      // Remove active class from all pills
      document.querySelectorAll('.filter-pill').forEach((pill) => pill.classList.remove('active'));
      // Add active class to clicked pill
      this.classList.add('active');

      currentFilter = this.dataset.value ?? 'all';
      // Save filter to localStorage
      localStorage.setItem('calendarFilter', currentFilter);
      calendar.refetchEvents();
    });
  });

  // View buttons - Support both class-based and ID-based selectors
  const viewButtons = [
    { id: 'monthView', view: 'dayGridMonth' },
    { id: 'weekView', view: 'timeGridWeek' },
    { id: 'dayView', view: 'timeGridDay' },
    { id: 'listView', view: 'listWeek' },
  ];

  viewButtons.forEach(({ id, view }) => {
    const button = document.getElementById(id);
    if (button) {
      button.addEventListener('click', () => {
        console.info('[CALENDAR] Changing view to:', view);
        calendarView = view;
        calendar.changeView(view);

        // Update active state
        document.querySelectorAll('.view-selector button').forEach((btn) => {
          btn.classList.remove('active');
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-outline-primary');
        });
        button.classList.add('active');
        button.classList.remove('btn-outline-primary');
        button.classList.add('btn-primary');
      });
    }
  });

  // Also support legacy view-btn class approach
  document.querySelectorAll<HTMLElement>('.view-btn').forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      const view = this.dataset.view;
      if (view) {
        calendarView = view;
        calendar.changeView(view);

        // Update active state
        document.querySelectorAll('.view-btn').forEach((btn) => btn.classList.remove('active'));
        this.classList.add('active');
      }
    });
  });

  // Search button
  const searchButton = document.getElementById('searchButton') as HTMLButtonElement;
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;

  if (searchButton && searchInput) {
    searchButton.addEventListener('click', () => {
      currentSearch = searchInput.value.trim();
      calendar.refetchEvents();
    });

    searchInput.addEventListener('keypress', function (this: HTMLInputElement, e: KeyboardEvent) {
      if (e.key === 'Enter') {
        currentSearch = this.value.trim();
        calendar.refetchEvents();
      }
    });
  }

  // New event button (in filter bar) - only for admins and root
  const newEventBtn = document.getElementById('newEventBtn') as HTMLButtonElement;
  console.info('Calendar: Looking for newEventBtn:', newEventBtn);

  // Get user role
  const currentUserRole = localStorage.getItem('userRole');
  const canCreate = currentUserRole === 'admin' || currentUserRole === 'root';

  if (newEventBtn) {
    if (!canCreate) {
      // Hide button for employees
      console.info('Calendar: Hiding new event button for employee');
      newEventBtn.style.display = 'none';
    } else {
      console.info('Calendar: Adding click listener to newEventBtn');
      // Remove any existing listeners
      const newButton = newEventBtn.cloneNode(true) as HTMLButtonElement;
      newEventBtn.parentNode?.replaceChild(newButton, newEventBtn);

      newButton.addEventListener('click', (e) => {
        console.info('Calendar: New Event button clicked');
        e.preventDefault();
        e.stopPropagation();

        // Debug check
        console.info('Calendar: About to call openEventForm...');
        try {
          openEventForm();
          console.info('Calendar: openEventForm() call completed');
        } catch (error) {
          console.error('Calendar: Error calling openEventForm:', error);
        }
      });
    }
  } else {
    console.error('Calendar: newEventBtn not found!');
  }

  // New event button in calendar card header - only for admins and root
  const newCalendarEventBtn = document.getElementById('newCalendarEventBtn') as HTMLButtonElement;
  console.info('Calendar: Looking for newCalendarEventBtn:', newCalendarEventBtn);

  // Check user role
  const userRole = localStorage.getItem('userRole');
  const canCreateEvents = userRole === 'admin' || userRole === 'root';

  if (newCalendarEventBtn) {
    if (!canCreateEvents) {
      // Hide button for employees
      console.info('Calendar: Hiding new event button for employee');
      newCalendarEventBtn.style.display = 'none';
    } else {
      console.info('Calendar: Adding click listener to newCalendarEventBtn');
      // Remove any existing listeners
      const newButton = newCalendarEventBtn.cloneNode(true) as HTMLButtonElement;
      newCalendarEventBtn.parentNode?.replaceChild(newButton, newCalendarEventBtn);

      newButton.addEventListener('click', (e) => {
        console.info('Calendar: New Calendar Event button clicked');
        e.preventDefault();
        e.stopPropagation();

        try {
          openEventForm();
          console.info('Calendar: openEventForm() call completed from calendar header');
        } catch (error) {
          console.error('Calendar: Error calling openEventForm:', error);
        }
      });
    }
  } else {
    console.info('Calendar: newCalendarEventBtn not found - this is ok if not on calendar page');
  }

  // Save event button
  const saveEventBtn = document.getElementById('saveEventBtn') as HTMLButtonElement;
  if (saveEventBtn) {
    saveEventBtn.addEventListener('click', () => {
      void saveEvent();
    });
  }

  // Organization level change
  const eventOrgLevel = document.getElementById('eventOrgLevel') as HTMLSelectElement;
  if (eventOrgLevel) {
    eventOrgLevel.addEventListener('change', function (this: HTMLSelectElement) {
      updateOrgIdDropdown(this.value);
    });
  }

  // Color selection
  document.querySelectorAll<HTMLElement>('.color-option').forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      // Remove active class from all color options
      document.querySelectorAll('.color-option').forEach((option) => option.classList.remove('active'));
      // Add active class to clicked option
      this.classList.add('active');
    });
  });

  // All day checkbox
  const allDayCheckbox = document.getElementById('eventAllDay') as HTMLInputElement;
  if (allDayCheckbox) {
    allDayCheckbox.addEventListener('change', function (this: HTMLInputElement) {
      const timeInputs = document.querySelectorAll<HTMLInputElement>('.time-input');
      timeInputs.forEach((input) => {
        input.disabled = this.checked;
        if (this.checked) {
          input.value = '';
        }
      });
    });
  }

  // Add attendee button
  const addAttendeeBtn = document.getElementById('addAttendeeBtn');
  if (addAttendeeBtn) {
    addAttendeeBtn.addEventListener('click', () => {
      // Only open modal if button is visible (for personal events)
      const orgLevelInput = document.getElementById('orgLevelInput') as HTMLInputElement;
      if (orgLevelInput && orgLevelInput.value === 'personal') {
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

  // Setup custom dropdown event delegation
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle dropdown toggles
    if (target.closest('.dropdown-display')) {
      e.preventDefault();
      e.stopPropagation();

      const display = target.closest('.dropdown-display') as HTMLElement;
      const wrapper = display.closest('.custom-dropdown');
      const dropdown = wrapper?.querySelector('.dropdown-options') as HTMLElement;

      if (dropdown) {
        // Check which dropdown was clicked
        if (wrapper?.id === 'orgLevelWrapper') {
          toggleOrgLevelDropdown();
        } else if (wrapper?.id === 'reminderWrapper') {
          toggleReminderDropdown();
        } else if (wrapper?.id === 'recurrenceWrapper') {
          toggleRecurrenceDropdown();
        } else if (wrapper?.id === 'departmentWrapper') {
          toggleDepartmentDropdown();
        } else if (wrapper?.id === 'teamWrapper') {
          toggleTeamDropdown();
        }
      }
    }

    // Handle dropdown option clicks
    if (target.closest('.dropdown-option')) {
      e.preventDefault();
      e.stopPropagation();

      const option = target.closest('.dropdown-option') as HTMLElement;
      const dropdown = option.closest('.dropdown-options');

      if (dropdown?.id === 'orgLevelDropdown') {
        // Extract value and text from the option
        const value = option.dataset.value ?? '';
        const text = option.textContent?.trim() ?? '';
        selectOrgLevel(value, text);
      } else if (dropdown?.id === 'reminderDropdown') {
        const value = option.dataset.value ?? '';
        const text = option.textContent?.trim() ?? '';
        selectReminder(value, text);
      } else if (dropdown?.id === 'recurrenceDropdown') {
        const value = option.dataset.value ?? '';
        const text = option.textContent?.trim() ?? '';
        selectRecurrence(value, text);
      }
    }

    // Close dropdowns when clicking outside
    if (!target.closest('.custom-dropdown')) {
      closeAllDropdowns();
    }
  });
}

/**
 * Load calendar events
 */
async function loadCalendarEvents(fetchInfo: FullCalendarFetchInfo): Promise<FullCalendarEventInput[]> {
  try {
    // Get token from localStorage
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login';
      throw new Error('No token found');
    }

    // Build query parameters
    const params = new URLSearchParams({
      start: fetchInfo.startStr,
      end: fetchInfo.endStr,
      filter: currentFilter,
    });

    if (currentSearch) {
      params.append('search', currentSearch);
    }

    // Determine API endpoint based on feature flag
    const useV2 = featureFlags.isEnabled('USE_API_V2_CALENDAR');
    const apiUrl = useV2 ? `/api/v2/calendar/events?${params}` : `/api/calendar?${params}`;

    console.info('[CALENDAR] Loading events - v2:', useV2, 'URL:', apiUrl);

    // Fetch events with authentication
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
      // Handle permission errors for specific filters
      if (response.status === 403 && currentFilter !== 'personal') {
        console.error('[CALENDAR] Permission denied for filter:', currentFilter);
        // Fallback to personal filter
        currentFilter = 'personal';
        localStorage.setItem('calendarFilter', currentFilter);
        // Update UI to reflect filter change
        const filterButtons = document.querySelectorAll<HTMLButtonElement>('#levelFilter button.tab-btn');
        filterButtons.forEach((btn) => {
          if (btn.dataset.value === 'personal') {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
        // Retry with personal filter
        return loadCalendarEvents(fetchInfo);
      }
      throw new Error('Failed to load events');
    }

    const data = await response.json();
    console.info('[CALENDAR] API Response:', data);

    // Handle different response formats
    let events: CalendarEvent[] = [];

    if (Array.isArray(data)) {
      // Direct array response (v1)
      events = data;
    } else if (data?.data?.data && Array.isArray(data.data.data)) {
      // v2 API response: {success, data: {data: [...], pagination: {...}}}
      events = data.data.data;
      console.info('[CALENDAR] v2 events found:', events.length);
    } else if (data && Array.isArray(data.events)) {
      // Paginated response with events array
      events = data.events;
    } else if (data?.data && Array.isArray(data.data)) {
      // Standard API response format with data wrapper
      events = data.data;
    } else if (data?.data && Array.isArray(data.data.events)) {
      // Paginated response wrapped in data
      events = data.data.events;
    } else {
      console.error('Calendar API returned unexpected response format:', data);
      showError('Kalenderdaten konnten nicht geladen werden. API-Fehler.');
      return [];
    }

    return events.map(formatEventForCalendar);
  } catch (error) {
    console.error('Error loading events:', error);
    showError('Fehler beim Laden der Termine.');
    return [];
  }
}

/**
 * Format event for FullCalendar
 */
function formatEventForCalendar(event: CalendarEvent): FullCalendarEventInput {
  // Color based on organization level - matching the legend
  let color = event.color ?? '#3498db'; // Default blue

  if (!event.color) {
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

  return {
    id: event.id.toString(),
    title: event.title,
    start: event.start_time,
    end: event.end_time,
    allDay: event.all_day === 1 || event.all_day === '1' || event.all_day === true,
    backgroundColor: color,
    borderColor: color,
    textColor: '#ffffff',
    classNames: [`fc-event-${event.org_level ?? 'personal'}`], // Add org_level as class
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
 * Load upcoming events for sidebar
 */
async function loadUpcomingEvents(): Promise<void> {
  try {
    // Get token from localStorage
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login';
      throw new Error('No token found');
    }

    // Determine API endpoint based on feature flag
    const useV2 = featureFlags.isEnabled('USE_API_V2_CALENDAR');
    const apiUrl = useV2 ? '/api/v2/calendar/dashboard' : '/api/calendar/dashboard';
    console.info('[CALENDAR] Loading dashboard - v2:', useV2, 'URL:', apiUrl);

    // Fetch upcoming events
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to load upcoming events');
    }

    const data = await response.json();
    console.info('[CALENDAR] Dashboard response:', data);
    let events: CalendarEvent[] = [];

    // Handle API response format
    if (Array.isArray(data)) {
      events = data;
    } else if (data?.data && Array.isArray(data.data)) {
      events = data.data;
    } else if (data?.success && data?.data) {
      // v2 format: {success: true, data: [...]}
      events = data.data;
    } else {
      console.error('Unexpected response format from dashboard:', data);
      events = [];
    }

    displayUpcomingEvents(events);
  } catch (error) {
    console.error('Error loading upcoming events:', error);
    const upcomingEvents = document.getElementById('upcomingEvents') as HTMLElement;
    if (upcomingEvents) {
      upcomingEvents.innerHTML = '<p class="text-center">Fehler beim Laden der Termine.</p>';
    }
  }
}

/**
 * Display upcoming events in the sidebar
 */
function displayUpcomingEvents(events: CalendarEvent[]): void {
  const container = document.getElementById('upcomingEvents') as HTMLElement;

  if (!container) {
    console.error('Upcoming events container not found');
    return;
  }

  container.innerHTML = '';

  if (!events || events.length === 0) {
    container.innerHTML = '<p class="text-center">Keine anstehenden Termine gefunden.</p>';
    return;
  }

  events.forEach((event) => {
    // Parse dates
    const startDate = new Date(event.start_time);
    const endDate = new Date(event.end_time);

    // Format date components
    const day = startDate.getDate();
    const month = startDate.toLocaleDateString('de-DE', { month: 'short' });

    // Format time (only if not all day)
    const timeStr = event.all_day
      ? 'Ganztägig'
      : `${startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

    // Determine level badge class
    let levelClass = 'event-level-personal';
    let levelText = 'Persönlich';

    if (event.org_level === 'company') {
      levelClass = 'event-level-company';
      levelText = 'Firma';
    } else if (event.org_level === 'department') {
      levelClass = 'event-level-department';
      levelText = 'Abteilung';
    } else if (event.org_level === 'team') {
      levelClass = 'event-level-team';
      levelText = 'Team';
    }

    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    eventItem.setAttribute('data-id', event.id.toString());

    eventItem.innerHTML = `
      <div class="event-date">
        <span class="event-day">${day}</span>
        <span class="event-month">${month}</span>
        <span class="event-time">${timeStr}</span>
      </div>
      <div class="event-details">
        <div class="event-title">${escapeHtml(event.title)}</div>
        ${event.location ? `<div class="event-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(event.location)}</div>` : ''}
        <span class="event-level ${levelClass}">${levelText}</span>
        ${event.user_response ? `<span class="status-${event.user_response} event-response">Ihr Status: ${getResponseText(event.user_response)}</span>` : ''}
      </div>
    `;

    // Add click event
    eventItem.addEventListener('click', () => {
      void viewEvent(event.id);
    });

    container.appendChild(eventItem);
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
async function viewEvent(eventId: number): Promise<void> {
  try {
    // Get token from localStorage
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login';
      throw new Error('No token found');
    }

    // Determine API endpoint based on feature flag
    const useV2 = featureFlags.isEnabled('USE_API_V2_CALENDAR');
    const apiUrl = useV2 ? `/api/v2/calendar/events/${eventId}` : `/api/calendar/${eventId}`;

    // Fetch event details with authentication
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

    const data = await response.json();
    const event: CalendarEvent = data.data ?? data;

    // Format dates
    const startDate = new Date(event.start_time);
    const endDate = new Date(event.end_time);

    const formattedStartDate = startDate.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedEndDate = endDate.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedStartTime = startDate.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const formattedEndTime = endDate.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Determine level text
    let levelText = 'Persönlicher Termin';
    if (event.org_level === 'company') {
      levelText = 'Firmentermin';
    } else if (event.org_level === 'department') {
      levelText = `Abteilungstermin${event.department_name ? `: ${event.department_name}` : ''}`;
    } else if (event.org_level === 'team') {
      levelText = `Teamtermin${event.team_name ? `: ${event.team_name}` : ''}`;
    }

    // Build modal content
    let modalContent = `
      <h3>
        <i class="fas fa-${event.all_day ? 'calendar-day' : 'clock'}"></i>
        ${escapeHtml(event.title)}
      </h3>
      ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ''}

      <div class="event-details-grid">
        <div class="detail-item">
          <i class="fas fa-calendar"></i>
          <span><strong>Beginn:</strong> ${event.all_day ? formattedStartDate : `${formattedStartDate} um ${formattedStartTime}`}</span>
        </div>
        <div class="detail-item">
          <i class="fas fa-calendar-check"></i>
          <span><strong>Ende:</strong> ${event.all_day ? formattedEndDate : `${formattedEndDate} um ${formattedEndTime}`}</span>
        </div>
        ${
          event.location
            ? `
        <div class="detail-item">
          <i class="fas fa-map-marker-alt"></i>
          <span><strong>Ort:</strong> ${escapeHtml(event.location)}</span>
        </div>`
            : ''
        }
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

    // Add attendee list if available
    if (event.attendees && event.attendees.length > 0) {
      modalContent += `
        <h4>Teilnehmer (${event.attendees.length})</h4>
        <div class="attendee-list">
      `;

      event.attendees.forEach((attendee) => {
        const name =
          (`${attendee.first_name ?? ''} ${attendee.last_name ?? ''}`.trim() || attendee.username) ?? 'Unknown';
        const statusIcon = getAttendeeStatusIcon(attendee.response);
        modalContent += `
          <div class="attendee-item">
            <span>${escapeHtml(name)}</span>
            <span class="attendee-status status-${attendee.response}" title="${getResponseText(attendee.response)}">
              ${statusIcon}
            </span>
          </div>
        `;
      });

      modalContent += '</div>';
    }

    // Add user response buttons
    if (event.attendees?.some((a) => a.user_id === currentUserId)) {
      const currentAttendee = event.attendees.find((a) => a.user_id === currentUserId);
      const currentResponse = currentAttendee?.response ?? 'pending';

      modalContent += `
        <div class="response-buttons">
          <h4>Ihre Antwort</h4>
          <div class="btn-group">
            <button class="btn ${currentResponse === 'accepted' ? 'btn-success' : 'btn-outline-success'}" onclick="respondToEvent(${event.id}, 'accepted')">
              <i class="fas fa-check"></i> Zusagen
            </button>
            <button class="btn ${currentResponse === 'tentative' ? 'btn-warning' : 'btn-outline-warning'}" onclick="respondToEvent(${event.id}, 'tentative')">
              <i class="fas fa-question"></i> Vielleicht
            </button>
            <button class="btn ${currentResponse === 'declined' ? 'btn-danger' : 'btn-outline-danger'}" onclick="respondToEvent(${event.id}, 'declined')">
              <i class="fas fa-times"></i> Absagen
            </button>
          </div>
        </div>
      `;
    }

    // Add action buttons if user is creator or admin
    if (event.created_by === currentUserId || isAdmin) {
      modalContent += `
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="editEvent(${event.id})">
            <i class="fas fa-edit"></i> Bearbeiten
          </button>
          <button class="btn btn-danger" onclick="deleteEvent(${event.id})">
            <i class="fas fa-trash"></i> Löschen
          </button>
          <button class="btn btn-secondary" data-action="close">
            <i class="fas fa-times"></i> Schließen
          </button>
        </div>
      `;
    } else {
      modalContent += `
        <div class="modal-actions">
          <button class="btn btn-secondary" data-action="close">
            <i class="fas fa-times"></i> Schließen
          </button>
        </div>
      `;
    }

    // Show modal with content
    modalManager.show('eventDetailModal', {
      content: modalContent,
      onOpen: () => {
        // Content is already in the modal template
        const modalBody = document.getElementById('eventDetailContent');
        if (modalBody) {
          modalBody.innerHTML = modalContent;
        }
      },
    });
  } catch (error) {
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
    if (!token) return;

    const useV2 = featureFlags.isEnabled('USE_API_V2_CALENDAR');
    const apiUrl = useV2 ? `/api/v2/calendar/events/${eventId}/respond` : `/api/calendar/${eventId}/respond`;

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ response }),
    });

    if (apiResponse.ok) {
      showSuccess('Ihre Antwort wurde gespeichert.');
      modalManager.hide('eventDetailsModal');

      // Refresh calendar and upcoming events
      calendar.refetchEvents();
      void loadUpcomingEvents();
    } else {
      const error = await apiResponse.json();
      showError(error.message ?? 'Fehler beim Speichern der Antwort');
    }
  } catch (error) {
    console.error('Error responding to event:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

/**
 * Open event form for creating/editing
 */
function openEventForm(eventId?: number | null, startDate?: Date, endDate?: Date, allDay?: boolean): void {
  console.info('Calendar: openEventForm called with:', { eventId, startDate, endDate, allDay });

  // Check user role - only admins and root can create events
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'admin' && userRole !== 'root') {
    console.warn('Calendar: Employees cannot create events');
    showError('Sie haben keine Berechtigung, Termine zu erstellen.');
    return;
  }

  // Check if modalManager exists
  console.info('Calendar: modalManager exists:', typeof modalManager !== 'undefined');
  console.info('Calendar: modalManager.show exists:', typeof modalManager?.show === 'function');

  // Force re-register template to ensure latest version is used
  const eventFormTemplate = getEventFormModalTemplate();
  modalManager.registerTemplate('eventFormModal', eventFormTemplate);

  // Try to show the modal using modalManager
  console.info('Calendar: Calling modalManager.show...');
  const modal = modalManager.show('eventFormModal');
  console.info('Calendar: modalManager.show returned:', !!modal);

  if (!modal) {
    console.error('Calendar: Failed to show eventFormModal!');
    return;
  }

  // Reset form
  const form = document.getElementById('eventForm') as HTMLFormElement;
  if (form) form.reset();

  // Reset color selection
  document.querySelectorAll('.color-option').forEach((option) => {
    option.classList.remove('selected');
  });
  document.querySelector('.color-option[data-color="#3498db"]')?.classList.add('selected');

  // Setup color picker for this modal instance
  setupModalColorPicker();

  // Setup event listeners for modal buttons
  setupModalEventListeners();

  // Clear attendees
  selectedAttendees = [];

  // Set default org level and show info message
  const orgLevelInput = document.getElementById('eventOrgLevel') as HTMLInputElement;
  const selectedOrgLevelSpan = document.getElementById('selectedOrgLevel') as HTMLElement;

  if (!eventId) {
    // For new events, set default to company and show appropriate UI
    if (orgLevelInput) orgLevelInput.value = 'company';
    if (selectedOrgLevelSpan) selectedOrgLevelSpan.textContent = 'Firma';

    // Use setTimeout to ensure DOM is fully rendered before updating
    setTimeout(() => {
      // Show attendees section with company info by default
      const attendeesGroup = document.getElementById('attendeesGroup') as HTMLElement;
      const attendeesContainer = document.getElementById('attendeesContainer') as HTMLElement;
      const addAttendeeBtn = document.getElementById('addAttendeeBtn') as HTMLButtonElement;

      if (attendeesGroup) attendeesGroup.style.display = 'block';
      if (addAttendeeBtn) addAttendeeBtn.style.display = 'none'; // Hide for company events
      if (attendeesContainer) {
        attendeesContainer.innerHTML =
          '<p class="text-info"><i class="fas fa-info-circle"></i> Alle Mitarbeiter der Firma werden automatisch eingeladen</p>';
      }

      // Also update the department/team groups visibility for company events
      const departmentGroup = document.getElementById('departmentGroup') as HTMLElement;
      const teamGroup = document.getElementById('teamGroup') as HTMLElement;
      if (departmentGroup) departmentGroup.style.display = 'none';
      if (teamGroup) teamGroup.style.display = 'none';
    }, 50);

    // Don't call updateSelectedAttendees for company events as it would overwrite the info text
  } else {
    // Only update attendees display for edit mode
    updateSelectedAttendees();
  }

  if (eventId) {
    // Update modal title for editing
    const modalTitle = modal.querySelector('.modal-title');
    if (modalTitle) {
      modalTitle.textContent = 'Termin bearbeiten';
    }
    // Load event data for editing
    void loadEventForEdit(eventId);
  } else {
    // Update modal title for new event
    const modalTitle = modal.querySelector('.modal-title');
    if (modalTitle) {
      modalTitle.textContent = 'Neuer Termin';
    }
    // New event
    if (startDate) {
      const startInput = document.getElementById('eventStartDate') as HTMLInputElement;
      const startTimeInput = document.getElementById('eventStartTime') as HTMLInputElement;

      if (startInput) {
        startInput.value = formatDateForInput(startDate);
      }

      if (!allDay && startTimeInput) {
        startTimeInput.value = formatTimeForInput(startDate);
      }
    }

    if (endDate) {
      const endInput = document.getElementById('eventEndDate') as HTMLInputElement;
      const endTimeInput = document.getElementById('eventEndTime') as HTMLInputElement;

      if (endInput) {
        endInput.value = formatDateForInput(endDate);
      }

      if (!allDay && endTimeInput) {
        endTimeInput.value = formatTimeForInput(endDate);
      }
    }

    const allDayCheckbox = document.getElementById('eventAllDay') as HTMLInputElement;
    if (allDayCheckbox && allDay !== undefined) {
      allDayCheckbox.checked = allDay;
      const timeInputs = document.querySelectorAll<HTMLInputElement>('.time-input');
      timeInputs.forEach((input) => {
        input.disabled = allDay;
      });
    }

    updateOrgIdDropdown('personal');
  }

  // Modal is already shown above, no need to show again
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
 * Update organization ID dropdown based on level
 */
function updateOrgIdDropdown(level: string): void {
  // Handle department dropdown
  const departmentGroup = document.getElementById('departmentGroup') as HTMLElement;
  const departmentDropdown = document.getElementById('departmentDropdown') as HTMLElement;

  // Handle team dropdown
  const teamGroup = document.getElementById('teamGroup') as HTMLElement;
  const teamDropdown = document.getElementById('teamDropdown') as HTMLElement;

  // Handle attendees section
  const attendeesGroup = document.getElementById('attendeesGroup') as HTMLElement;
  const addAttendeeBtn = document.getElementById('addAttendeeBtn') as HTMLButtonElement;
  const attendeesContainer = document.getElementById('attendeesContainer') as HTMLElement;

  // Clear dropdowns
  if (departmentDropdown) departmentDropdown.innerHTML = '';
  if (teamDropdown) teamDropdown.innerHTML = '';

  // Hide all by default
  if (departmentGroup) departmentGroup.style.display = 'none';
  if (teamGroup) teamGroup.style.display = 'none';

  // Handle attendees visibility based on org_level
  if (attendeesGroup) {
    if (level === 'personal') {
      // Show attendees section for personal events
      attendeesGroup.style.display = 'block';
      if (addAttendeeBtn) addAttendeeBtn.style.display = 'inline-flex';
      if (attendeesContainer) {
        if (selectedAttendees.length === 0) {
          attendeesContainer.innerHTML = '<p class="text-muted">Keine Teilnehmer ausgewählt</p>';
        }
      }
    } else {
      // Hide attendees section for other event types
      attendeesGroup.style.display = 'block'; // Keep container visible for info text
      if (addAttendeeBtn) addAttendeeBtn.style.display = 'none';

      // Show info text about automatic attendees
      if (attendeesContainer) {
        let infoText = '';
        switch (level) {
          case 'company':
            infoText =
              '<p class="text-info"><i class="fas fa-info-circle"></i> Alle Mitarbeiter der Firma werden automatisch eingeladen</p>';
            break;
          case 'department':
            infoText =
              '<p class="text-info"><i class="fas fa-info-circle"></i> Alle Mitarbeiter der ausgewählten Abteilung werden automatisch eingeladen</p>';
            break;
          case 'team':
            infoText =
              '<p class="text-info"><i class="fas fa-info-circle"></i> Alle Mitglieder des ausgewählten Teams werden automatisch eingeladen</p>';
            break;
        }
        attendeesContainer.innerHTML = infoText;
      }

      // Clear selected attendees for non-personal events
      selectedAttendees = [];
    }
  }

  if (level === 'personal' || level === 'company') {
    // No additional selection needed
    return;
  } else if (level === 'department') {
    // Show only department selection
    if (departmentGroup) {
      departmentGroup.style.display = 'block';

      // Populate dropdown with departments
      departments.forEach((dept) => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.dataset.value = dept.id.toString();
        option.textContent = dept.name;
        option.onclick = (e) => {
          e.preventDefault();
          selectDepartment(dept.id, dept.name);
          closeAllDropdowns();
        };
        departmentDropdown?.appendChild(option);
      });
    }
  } else if (level === 'team') {
    // Show both department and team selection
    if (departmentGroup && teamGroup) {
      departmentGroup.style.display = 'block';
      teamGroup.style.display = 'block';

      // Populate department dropdown
      departments.forEach((dept) => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.dataset.value = dept.id.toString();
        option.textContent = dept.name;
        option.onclick = (e) => {
          e.preventDefault();
          selectDepartment(dept.id, dept.name);
          // Load teams for this department
          loadTeamsForDepartment(dept.id);
          closeAllDropdowns();
        };
        departmentDropdown?.appendChild(option);
      });
    }
  }
}

/**
 * Select department
 */
function selectDepartment(departmentId: number, departmentName: string): void {
  const selectedElement = document.getElementById('selectedDepartment');
  const inputElement = document.getElementById('eventDepartmentId') as HTMLInputElement;

  if (selectedElement) selectedElement.textContent = departmentName;
  if (inputElement) inputElement.value = departmentId.toString();
}

/**
 * Select team
 */
function selectTeam(teamId: number, teamName: string): void {
  const selectedElement = document.getElementById('selectedTeam');
  const inputElement = document.getElementById('eventTeamId') as HTMLInputElement;

  if (selectedElement) selectedElement.textContent = teamName;
  if (inputElement) inputElement.value = teamId.toString();
}

/**
 * Load teams for selected department
 */
function loadTeamsForDepartment(departmentId: number): void {
  const teamDropdown = document.getElementById('teamDropdown') as HTMLElement;
  if (!teamDropdown) return;

  teamDropdown.innerHTML = '';

  // Filter teams by department
  const departmentTeams = teams.filter((team) => team.department_id === departmentId);

  departmentTeams.forEach((team) => {
    const option = document.createElement('div');
    option.className = 'dropdown-option';
    option.dataset.value = team.id.toString();
    option.textContent = team.name;
    option.onclick = (e) => {
      e.preventDefault();
      selectTeam(team.id, team.name);
      closeAllDropdowns();
    };
    teamDropdown.appendChild(option);
  });

  // Reset team selection
  const selectedTeam = document.getElementById('selectedTeam');
  if (selectedTeam) selectedTeam.textContent = '-- Team wählen --';
  const teamInput = document.getElementById('eventTeamId') as HTMLInputElement;
  if (teamInput) teamInput.value = '';
}

/**
 * Save event
 */
async function saveEvent(): Promise<void> {
  console.info('saveEvent called');

  const form = document.getElementById('eventForm') as HTMLFormElement;
  if (!form) {
    console.error('Form not found');
    return;
  }

  const token = getAuthToken();
  if (!token) {
    console.error('No token found');
    return;
  }

  // Get form values directly from elements
  const titleInput = document.getElementById('eventTitle') as HTMLInputElement;
  const descriptionInput = document.getElementById('eventDescription') as HTMLTextAreaElement;
  const startDateInput = document.getElementById('eventStartDate') as HTMLInputElement;
  const startTimeInput = document.getElementById('eventStartTime') as HTMLInputElement;
  const endDateInput = document.getElementById('eventEndDate') as HTMLInputElement;
  const endTimeInput = document.getElementById('eventEndTime') as HTMLInputElement;
  const allDayInput = document.getElementById('eventAllDay') as HTMLInputElement;
  const locationInput = document.getElementById('eventLocation') as HTMLInputElement;
  const orgLevelInput = document.getElementById('eventOrgLevel') as HTMLInputElement;
  const departmentIdInput = document.getElementById('eventDepartmentId') as HTMLInputElement;
  const teamIdInput = document.getElementById('eventTeamId') as HTMLInputElement;
  const colorInput = document.getElementById('eventColor') as HTMLInputElement;
  const reminderTimeInput = document.getElementById('eventReminderTime') as HTMLInputElement;
  const eventIdInput = document.getElementById('eventId') as HTMLInputElement;

  // Validate required fields
  if (!titleInput?.value) {
    showError('Bitte geben Sie einen Titel ein');
    return;
  }

  if (!startDateInput?.value) {
    showError('Bitte wählen Sie ein Startdatum');
    return;
  }

  if (!endDateInput?.value) {
    showError('Bitte wählen Sie ein Enddatum');
    return;
  }

  if (!orgLevelInput?.value) {
    showError('Bitte wählen Sie aus, wer den Termin sehen soll');
    return;
  }

  // Get selected color
  const selectedColor = document.querySelector('.color-option.selected') as HTMLElement;
  const color = selectedColor?.dataset.color ?? (colorInput?.value || '#3498db');

  // Parse dates and times
  const startDate = startDateInput.value;
  const startTime = startTimeInput.value;
  const endDate = endDateInput.value;
  const endTime = endTimeInput.value;
  const allDay = allDayInput.checked;

  // Validate time fields for non-all-day events
  if (!allDay) {
    if (!startTime) {
      showError('Bitte wählen Sie eine Startzeit');
      return;
    }
    if (!endTime) {
      showError('Bitte wählen Sie eine Endzeit');
      return;
    }
  }

  let startDateTime: string;
  let endDateTime: string;

  if (allDay) {
    startDateTime = `${startDate}T00:00:00`;
    endDateTime = `${endDate}T23:59:59`;
  } else {
    startDateTime = `${startDate}T${startTime}:00`;
    endDateTime = `${endDate}T${endTime}:00`;
  }

  // Get recurrence data
  const recurrenceType = (document.getElementById('eventRecurrence') as HTMLInputElement)?.value;
  let recurrenceRule = '';

  if (recurrenceType && recurrenceType !== '') {
    // Build recurrence rule based on selection
    const recurrenceEnd = (document.getElementById('selectedRecurrenceEnd') as HTMLElement)?.textContent;
    const recurrenceCount = (document.getElementById('recurrenceCount') as HTMLInputElement)?.value;
    const recurrenceEndDate = (document.getElementById('recurrenceEndDate') as HTMLInputElement)?.value;

    // Build simplified recurrence rule
    recurrenceRule = recurrenceType;

    if (recurrenceEnd === 'Nach ... Wiederholungen' && recurrenceCount) {
      recurrenceRule += `;COUNT=${recurrenceCount}`;
    } else if (recurrenceEnd === 'Am bestimmten Datum' && recurrenceEndDate) {
      recurrenceRule += `;UNTIL=${recurrenceEndDate}`;
    }
  }

  // Determine department_id and team_id based on org_level
  let departmentId = null;
  let teamId = null;

  if (orgLevelInput.value === 'department') {
    departmentId = departmentIdInput.value ? parseInt(departmentIdInput.value) : null;
  } else if (orgLevelInput.value === 'team') {
    departmentId = departmentIdInput.value ? parseInt(departmentIdInput.value) : null;
    teamId = teamIdInput.value ? parseInt(teamIdInput.value) : null;
  }

  // Handle reminder_time properly - check if value is valid number
  let reminderTime = undefined;
  if (reminderTimeInput.value && reminderTimeInput.value !== '') {
    const parsed = parseInt(reminderTimeInput.value);
    if (!isNaN(parsed) && parsed >= 0) {
      reminderTime = parsed;
    }
  }

  const eventData: CreateCalendarEventData = {
    title: titleInput.value,
    description: descriptionInput.value,
    start_time: startDateTime,
    end_time: endDateTime,
    all_day: allDay,
    location: locationInput.value,
    org_level: orgLevelInput.value ?? 'personal',
    color,
  };

  // Only add optional fields if they have values
  if (departmentId) eventData.department_id = departmentId;
  if (teamId) eventData.team_id = teamId;
  if (reminderTime !== undefined) eventData.reminder_time = reminderTime;
  if (selectedAttendees.length > 0) eventData.attendee_ids = selectedAttendees;
  if (recurrenceRule) eventData.recurrence_rule = recurrenceRule;

  // For API v1 compatibility, add org_id based on org_level
  const useV2 = featureFlags.isEnabled('USE_API_V2_CALENDAR');
  if (!useV2) {
    if (orgLevelInput.value === 'department' && departmentId) {
      eventData.org_id = departmentId;
    } else if (orgLevelInput.value === 'team' && teamId) {
      eventData.org_id = teamId;
    }
  }

  console.info('Saving event data:', eventData); // Debug log

  try {
    const eventId = eventIdInput.value;
    const url = eventId
      ? useV2
        ? `/api/v2/calendar/events/${eventId}`
        : `/api/calendar/${eventId}`
      : useV2
        ? '/api/v2/calendar/events'
        : '/api/calendar';
    const method = eventId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(eventData),
    });

    if (response.ok) {
      const result = await response.json();
      console.info('[CALENDAR] Save successful:', result);
      showSuccess(eventId ? 'Termin erfolgreich aktualisiert!' : 'Termin erfolgreich erstellt!');
      modalManager.hide('eventFormModal');

      // Refresh calendar
      calendar.refetchEvents();
      void loadUpcomingEvents();
    } else {
      const error = await response.json();
      console.error('[CALENDAR] Save error:', error);
      showError(error.message ?? 'Fehler beim Speichern des Termins');
    }
  } catch (error) {
    console.error('Error saving event:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

/**
 * Load event for editing
 */
async function loadEventForEdit(eventId: number): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const useV2 = featureFlags.isEnabled('USE_API_V2_CALENDAR');
    const apiUrl = useV2 ? `/api/v2/calendar/events/${eventId}` : `/api/calendar/${eventId}`;

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const event: CalendarEvent = data.data ?? data;

      // Fill form with event data
      const form = document.getElementById('eventForm') as HTMLFormElement;
      if (!form) return;

      // Set event ID
      const eventIdInput = form.elements.namedItem('event_id') as HTMLInputElement;
      if (eventIdInput) eventIdInput.value = event.id.toString();

      // Set basic fields
      const titleInput = form.elements.namedItem('title') as HTMLInputElement;
      if (titleInput) titleInput.value = event.title;

      const descInput = form.elements.namedItem('description') as HTMLTextAreaElement;
      if (descInput) descInput.value = event.description ?? '';

      const locationInput = form.elements.namedItem('location') as HTMLInputElement;
      if (locationInput) locationInput.value = event.location ?? '';

      // Set org level using custom dropdown
      const selectedOrgLevelSpan = document.getElementById('selectedOrgLevel');
      if (selectedOrgLevelSpan) {
        const orgLevelText =
          event.org_level === 'company'
            ? 'Alle Mitarbeiter'
            : event.org_level === 'department'
              ? 'Bestimmte Abteilung'
              : event.org_level === 'team'
                ? 'Bestimmtes Team'
                : 'Persönlicher Termin';
        selectedOrgLevelSpan.textContent = orgLevelText;
        selectedOrgLevelSpan.dataset.value = event.org_level;
      }

      // Parse dates
      const startDate = new Date(event.start_time);
      const endDate = new Date(event.end_time);

      // Set date fields
      const startDateInput = form.elements.namedItem('start_date') as HTMLInputElement;
      if (startDateInput) startDateInput.value = formatDateForInput(startDate);

      const endDateInput = form.elements.namedItem('end_date') as HTMLInputElement;
      if (endDateInput) endDateInput.value = formatDateForInput(endDate);

      // Set all day checkbox
      const allDayCheckbox = form.elements.namedItem('all_day') as HTMLInputElement;
      if (allDayCheckbox) {
        allDayCheckbox.checked = Boolean(event.all_day);
      }

      // Set time fields
      if (!event.all_day) {
        const startTimeInput = form.elements.namedItem('start_time') as HTMLInputElement;
        if (startTimeInput) startTimeInput.value = formatTimeForInput(startDate);

        const endTimeInput = form.elements.namedItem('end_time') as HTMLInputElement;
        if (endTimeInput) endTimeInput.value = formatTimeForInput(endDate);
      }

      // Update time inputs disabled state
      const timeInputs = document.querySelectorAll<HTMLInputElement>('.time-input');
      timeInputs.forEach((input) => {
        input.disabled = Boolean(event.all_day);
      });

      // Update org dropdown
      updateOrgIdDropdown(event.org_level);
      if (event.org_id) {
        const orgName = event.department_name ?? event.team_name ?? '';
        selectOrgId(event.org_id, orgName);
      }

      // Select color
      document.querySelectorAll('.color-option').forEach((option) => {
        option.classList.remove('active');
      });
      const colorOption = document.querySelector(`.color-option[data-color="${event.color}"]`) as HTMLElement;
      if (colorOption) {
        colorOption.classList.add('active');
      }

      // Set reminder if field exists
      const reminderSelect = document.getElementById('eventReminderTime') as HTMLSelectElement;
      if (reminderSelect && event.reminder_time !== undefined && event.reminder_time !== null) {
        reminderSelect.value = event.reminder_time.toString();
      }

      // Load attendees only for personal events
      if (event.org_level === 'personal' && event.attendees) {
        selectedAttendees = event.attendees.map((a) => a.user_id);
        updateSelectedAttendees();
      } else {
        selectedAttendees = [];
      }
    } else {
      showError('Fehler beim Laden des Termins');
      modalManager.hide('eventFormModal');
    }
  } catch (error) {
    console.error('Error loading event:', error);
    showError('Ein Fehler ist aufgetreten');
    modalManager.hide('eventFormModal');
  }
}

/**
 * Delete event
 */
function deleteEvent(eventId: number): void {
  // Create confirmation modal dynamically
  const modalHtml = `
    <div class="modal-overlay" id="confirmationModal">
      <div class="modal-container modal-sm">
        <div class="modal-header">
          <h2>Bestätigung</h2>
          <button type="button" class="modal-close" onclick="window.closeConfirmationModal()">&times;</button>
        </div>
        <div class="modal-body">
          <p class="mb-0">Möchten Sie diesen Termin wirklich löschen?</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="window.closeConfirmationModal()">Abbrechen</button>
          <button type="button" class="btn btn-danger" onclick="window.confirmDeleteEvent(${eventId})">Löschen</button>
        </div>
      </div>
    </div>
  `;

  // Add modal to body if it doesn't exist
  if (!document.getElementById('confirmationModal')) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  // Show modal
  modalManager.show('confirmationModal');
}

/**
 * Close confirmation modal and remove from DOM
 */
function closeConfirmationModal(): void {
  const modal = document.getElementById('confirmationModal');
  if (modal) {
    modalManager.hide('confirmationModal');
    // Remove modal from DOM after animation
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

/**
 * Confirm and execute event deletion
 */
async function confirmDeleteEvent(eventId: number): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const useV2 = featureFlags.isEnabled('USE_API_V2_CALENDAR');
    const apiUrl = useV2 ? `/api/v2/calendar/events/${eventId}` : `/api/calendar/${eventId}`;

    console.info('[CALENDAR] Deleting event - v2:', useV2, 'URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      console.info('[CALENDAR] Delete successful');
      showSuccess('Termin erfolgreich gelöscht!');
      closeConfirmationModal();
      modalManager.hide('eventDetailsModal');

      // Refresh calendar
      calendar.refetchEvents();
      void loadUpcomingEvents();
    } else {
      const error = await response.json();
      showError(error.message ?? 'Fehler beim Löschen des Termins');
    }
  } catch (error) {
    console.error('Error deleting event:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

/**
 * Search attendees
 */
function searchAttendees(query: string): void {
  const searchResults = document.getElementById('attendeeSearchResults') as HTMLElement;
  if (!searchResults) return;

  if (!query || query.length < 2) {
    searchResults.innerHTML = '';
    return;
  }

  // Filter employees based on query
  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.toLowerCase();
    const username = (emp.username ?? '').toLowerCase();
    const email = (emp.email ?? '').toLowerCase();
    return (
      fullName.includes(query.toLowerCase()) ||
      username.includes(query.toLowerCase()) ||
      email.includes(query.toLowerCase())
    );
  });

  searchResults.innerHTML = '';

  filteredEmployees.forEach((emp) => {
    if (selectedAttendees.includes(emp.id)) return; // Skip already selected

    const item = document.createElement('div');
    item.className = 'search-result-item';
    const name = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || emp.username;
    item.innerHTML = `
      <span>${escapeHtml(name)}</span>
      <button class="btn btn-sm btn-primary" onclick="addAttendee(${emp.id}, '${escapeHtml(name)}')">
        <i class="fas fa-plus"></i>
      </button>
    `;
    searchResults.appendChild(item);
  });
}

/**
 * Add attendee
 */
function addAttendee(userId: number, _name: string): void {
  if (!selectedAttendees.includes(userId)) {
    selectedAttendees.push(userId);
    updateSelectedAttendees();

    // Clear search
    const searchInput = document.getElementById('attendeeSearch') as HTMLInputElement;
    const searchResults = document.getElementById('attendeeSearchResults') as HTMLElement;
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.innerHTML = '';
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
  if (!token) {
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
  if (!token) {
    throw new Error('No authentication token found');
  }

  const useV2 = featureFlags.isEnabled('USE_API_V2_CALENDAR');
  const profileUrl = useV2 ? '/api/v2/auth/profile' : '/api/user/profile';

  const response = await fetch(profileUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }

  return response.json();
}

/**
 * Load departments and teams
 */
async function loadDepartmentsAndTeams(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    // Load departments
    const useV2 = featureFlags.isEnabled('USE_API_V2_CALENDAR');
    const deptUrl = useV2 ? '/api/v2/departments' : '/api/departments';
    const deptResponse = await fetch(deptUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (deptResponse.ok) {
      const deptData = await deptResponse.json();
      departments = useV2 && deptData.data ? deptData.data : deptData;
    }

    // Load teams
    const teamUrl = useV2 ? '/api/v2/teams' : '/api/teams';
    const teamResponse = await fetch(teamUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (teamResponse.ok) {
      const teamData = await teamResponse.json();
      teams = useV2 && teamData.data ? teamData.data : teamData;
    }

    // Load employees for attendees
    const empUrl = useV2 ? '/api/v2/users' : '/api/users';
    const empResponse = await fetch(empUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (empResponse.ok) {
      const empData = await empResponse.json();
      const allEmployees = useV2 && empData.data ? empData.data : empData;
      // Get current user ID to exclude from employees list
      const userStr = localStorage.getItem('user');
      let currentUserId = 0;
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          currentUserId = user.id || 0;
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
        }
      }
      employees = allEmployees.filter((emp: User) => emp.id !== currentUserId);
    }
  } catch (error) {
    console.error('Error loading departments, teams, and employees:', error);
  }
}

/**
 * Utility function to escape HTML
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Extend window for calendar functions
declare global {
  interface Window {
    viewEvent: typeof viewEvent;
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
    closeConfirmationModal: typeof closeConfirmationModal;
    confirmDeleteEvent: typeof confirmDeleteEvent;
  }
}

/**
 * Setup color picker functionality
 */
function setupColorPicker(): void {
  // This function is now empty as we use setupModalColorPicker when modal opens
}

/**
 * Setup color picker for modal instance
 */
function setupModalColorPicker(): void {
  const colorOptions = document.querySelectorAll('.color-option');
  const colorInput = document.getElementById('eventColor') as HTMLInputElement;

  colorOptions.forEach((option) => {
    // Remove existing listeners by cloning
    const newOption = option.cloneNode(true) as HTMLElement;
    option.parentNode?.replaceChild(newOption, option);

    newOption.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Remove selected class from all
      document.querySelectorAll('.color-option').forEach((opt) => opt.classList.remove('selected'));
      // Add selected class to clicked
      newOption.classList.add('selected');
      // Update hidden input
      if (colorInput) {
        colorInput.value = newOption.dataset.color ?? '#3498db';
      }
    });
  });
}

/**
 * Setup event listeners for modal buttons
 */
function setupModalEventListeners(): void {
  // Save event button
  const saveEventBtn = document.getElementById('saveEventBtn') as HTMLButtonElement;
  if (saveEventBtn) {
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
  const addAttendeeBtn = document.getElementById('addAttendeeBtn');
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
  const allDayCheckbox = document.getElementById('eventAllDay') as HTMLInputElement;
  if (allDayCheckbox) {
    const newCheckbox = allDayCheckbox.cloneNode(true) as HTMLInputElement;
    allDayCheckbox.parentNode?.replaceChild(newCheckbox, allDayCheckbox);

    newCheckbox.addEventListener('change', function (this: HTMLInputElement) {
      const timeInputs = document.querySelectorAll<HTMLInputElement>('.time-input');
      timeInputs.forEach((input) => {
        input.disabled = this.checked;
        if (this.checked) {
          input.value = '';
        }
      });
    });
  }

  // Organization level change
  const eventOrgLevel = document.getElementById('eventOrgLevel') as HTMLInputElement;
  if (eventOrgLevel) {
    // This is already handled by the dropdown delegation
    console.info('Organization level input found');
  }
}

// Custom dropdown functions
function toggleOrgLevelDropdown(): void {
  const dropdown = document.getElementById('orgLevelDropdown');
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
  const selectedElement = document.getElementById('selectedOrgLevel');
  const inputElement = document.getElementById('eventOrgLevel') as HTMLInputElement;

  if (selectedElement) selectedElement.textContent = text;
  if (inputElement) inputElement.value = value;

  // Update org ID dropdown based on selection
  updateOrgIdDropdown(value);
  closeAllDropdowns();
}

function toggleOrgIdDropdown(): void {
  const display = document.getElementById('orgIdDisplay');
  if (display?.classList.contains('disabled')) return;

  const dropdown = document.getElementById('orgIdDropdown');
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
  const dropdown = document.getElementById('reminderDropdown');
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
  const selectedElement = document.getElementById('selectedReminder');
  const inputElement = document.getElementById('eventReminderTime') as HTMLInputElement;

  if (selectedElement) selectedElement.textContent = text;
  if (inputElement) inputElement.value = value;
  closeAllDropdowns();
}

function toggleRecurrenceDropdown(): void {
  const dropdown = document.getElementById('recurrenceDropdown');
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
  const dropdown = document.getElementById('departmentDropdown');
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
  const dropdown = document.getElementById('teamDropdown');
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
  const selectedElement = document.getElementById('selectedRecurrence');
  const inputElement = document.getElementById('eventRecurrence') as HTMLInputElement;

  if (selectedElement) selectedElement.textContent = text;
  if (inputElement) inputElement.value = value;

  // Show/hide recurrence end options
  const endWrapper = document.getElementById('recurrenceEndWrapper');
  if (endWrapper) {
    endWrapper.style.display = value && value !== '' ? 'block' : 'none';
  }

  closeAllDropdowns();
}

function toggleRecurrenceEndDropdown(): void {
  const dropdown = document.getElementById('recurrenceEndDropdown');
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
  const selectedElement = document.getElementById('selectedRecurrenceEnd');
  if (selectedElement) selectedElement.textContent = text;

  const countWrapper = document.getElementById('recurrenceCountWrapper');
  const dateWrapper = document.getElementById('recurrenceEndDateWrapper');

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
  document.querySelectorAll('.custom-dropdown').forEach((dropdown) => {
    dropdown.classList.remove('active');
  });
  document.querySelectorAll('.dropdown-display').forEach((display) => {
    display.classList.remove('active');
  });
  document.querySelectorAll('.dropdown-options').forEach((options) => {
    options.classList.remove('active');
  });
}

// Load employees for attendees modal
async function loadEmployeesForAttendees(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const userRole = localStorage.getItem('userRole');

    // For employees, show a simple input field instead of user list
    if (userRole === 'employee') {
      const attendeesList = document.getElementById('attendeesList');
      if (attendeesList) {
        attendeesList.innerHTML = `
          <div class="form-group">
            <label>Teilnehmer per E-Mail einladen:</label>
            <input type="email" id="attendeeEmailInput" class="form-control" placeholder="email@example.com">
            <button type="button" class="btn btn-primary mt-2" onclick="addAttendeeByEmail()">
              <i class="fas fa-plus"></i> Hinzufügen
            </button>
            <div id="selectedAttendeesEmails" class="mt-3"></div>
          </div>
        `;
      }
      // Register event handler for add button
      const addSelectedAttendeesBtn = document.getElementById('addSelectedAttendeesBtn');
      if (addSelectedAttendeesBtn) {
        addSelectedAttendeesBtn.style.display = 'none'; // Hide for employees
      }
      return;
    }

    // For admins, load user list as before
    const useV2 = featureFlags.isEnabled('USE_API_V2_CALENDAR');
    const apiUrl = useV2 ? '/api/v2/users' : '/api/users';

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const users = useV2 && data.data ? data.data : data;
      const attendeesList = document.getElementById('attendeesList');

      // Get current user ID to exclude from list
      const userStr = localStorage.getItem('user');
      let currentUserId = 0;
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          currentUserId = user.id || 0;
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
        }
      }

      if (attendeesList) {
        attendeesList.innerHTML = users
          .filter((user: User) => user.id !== currentUserId) // Exclude current user
          .map(
            (user: User) => `
          <div class="attendee-option">
            <input type="checkbox" id="attendee-${user.id}" value="${user.id}" />
            <label for="attendee-${user.id}">
              ${escapeHtml(user.first_name ?? '')} ${escapeHtml(user.last_name ?? '')}
              (${escapeHtml(user.username)})
            </label>
          </div>
        `,
          )
          .join('');
      }

      // Re-attach event listener for the "Add Selected" button after modal content is loaded
      const addSelectedAttendeesBtn = document.getElementById('addSelectedAttendeesBtn');
      if (addSelectedAttendeesBtn) {
        // Remove any existing listeners by cloning
        const newButton = addSelectedAttendeesBtn.cloneNode(true) as HTMLButtonElement;
        addSelectedAttendeesBtn.parentNode?.replaceChild(newButton, addSelectedAttendeesBtn);

        newButton.addEventListener('click', () => {
          console.info('Add selected attendees button clicked');
          const checkboxes = document.querySelectorAll<HTMLInputElement>(
            '#attendeesList input[type="checkbox"]:checked',
          );
          console.info('Found checked boxes:', checkboxes.length);

          checkboxes.forEach((checkbox) => {
            const userId = parseInt(checkbox.value);
            if (!selectedAttendees.includes(userId)) {
              selectedAttendees.push(userId);
              console.info('Added attendee:', userId);
            }
          });

          updateSelectedAttendees();
          modalManager.hide('attendeesModal');
        });
      }

      // Also re-attach the search functionality
      const attendeeSearch = document.getElementById('attendeeSearch') as HTMLInputElement;
      if (attendeeSearch) {
        const newSearch = attendeeSearch.cloneNode(true) as HTMLInputElement;
        attendeeSearch.parentNode?.replaceChild(newSearch, attendeeSearch);

        newSearch.addEventListener('input', function (this: HTMLInputElement) {
          searchAttendees(this.value);
        });
      }
    }
  } catch (error) {
    console.error('Error loading employees:', error);
  }
}

// Update selected attendees display
function updateSelectedAttendees(): void {
  const container = document.getElementById('attendeesContainer');
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
        return `
        <div class="attendee-item">
          <span class="attendee-name">
            ${escapeHtml(employee.first_name ?? '')} ${escapeHtml(employee.last_name ?? '')}
          </span>
          <button type="button" class="remove-attendee" onclick="removeAttendee(${userId})">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      }
      return '';
    })
    .filter((html) => html !== '')
    .join('');

  container.innerHTML = attendeeHTML;
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  console.info('Calendar: Exporting functions to window...');
  window.viewEvent = viewEvent;
  window.editEvent = (eventId: number) => openEventForm(eventId);
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
  window.closeConfirmationModal = closeConfirmationModal;
  window.confirmDeleteEvent = confirmDeleteEvent;

  console.info('Calendar: window.openEventForm available:', typeof window.openEventForm);
}

/**
 * Get Event Form Modal Template
 */
function getEventFormModalTemplate(): string {
  return `
    <div class="modal-overlay" id="eventFormModal">
      <div class="modal-container modal-lg">
        <div class="modal-header">
          <h2 class="modal-title">Neuer Termin</h2>
          <button type="button" class="modal-close" data-action="close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="eventForm">
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

            <!-- Datum und Zeit -->
            <div class="form-row">
              <div class="form-group col-md-6">
                <label for="eventStartDate">
                  <i class="fas fa-calendar"></i> Startdatum <span class="required">*</span>
                </label>
                <input
                  type="date"
                  class="form-control"
                  id="eventStartDate"
                  name="start_date"
                  required
                />
              </div>
              <div class="form-group col-md-6">
                <label for="eventStartTime">
                  <i class="fas fa-clock"></i> Startzeit <span class="required">*</span>
                </label>
                <input
                  type="time"
                  class="form-control time-input"
                  id="eventStartTime"
                  name="start_time"
                  required
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group col-md-6">
                <label for="eventEndDate">
                  <i class="fas fa-calendar-check"></i> Enddatum <span class="required">*</span>
                </label>
                <input
                  type="date"
                  class="form-control"
                  id="eventEndDate"
                  name="end_date"
                  required
                />
              </div>
              <div class="form-group col-md-6">
                <label for="eventEndTime">
                  <i class="fas fa-clock"></i> Endzeit <span class="required">*</span>
                </label>
                <input
                  type="time"
                  class="form-control time-input"
                  id="eventEndTime"
                  name="end_time"
                  required
                />
              </div>
            </div>

            <div class="form-group">
              <div class="custom-control custom-checkbox">
                <input
                  type="checkbox"
                  class="custom-control-input"
                  id="eventAllDay"
                  name="all_day"
                />
                <label class="custom-control-label" for="eventAllDay">
                  <i class="fas fa-sun"></i> Ganztägiger Termin
                </label>
              </div>
            </div>

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

            <!-- Farbe -->
            <div class="form-group">
              <label>
                <i class="fas fa-palette"></i> Farbe
              </label>
              <div class="color-picker">
                <div class="color-option selected" data-color="#3498db" style="background-color: #3498db" title="Blau"></div>
                <div class="color-option" data-color="#2ecc71" style="background-color: #2ecc71" title="Grün"></div>
                <div class="color-option" data-color="#e67e22" style="background-color: #e67e22" title="Orange"></div>
                <div class="color-option" data-color="#e74c3c" style="background-color: #e74c3c" title="Rot"></div>
                <div class="color-option" data-color="#9b59b6" style="background-color: #9b59b6" title="Lila"></div>
                <div class="color-option" data-color="#f39c12" style="background-color: #f39c12" title="Gelb"></div>
                <div class="color-option" data-color="#1abc9c" style="background-color: #1abc9c" title="Türkis"></div>
              </div>
              <input type="hidden" id="eventColor" value="#3498db" />
            </div>

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
                  <div class="dropdown-option" data-value="">
                    Keine Wiederholung
                  </div>
                  <div class="dropdown-option" data-value="daily">
                    Täglich
                  </div>
                  <div class="dropdown-option" data-value="weekly">
                    Wöchentlich
                  </div>
                  <div class="dropdown-option" data-value="monthly">
                    Monatlich
                  </div>
                  <div class="dropdown-option" data-value="yearly">
                    Jährlich
                  </div>
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
                <div class="custom-select-display dropdown-display" onclick="window.toggleRecurrenceEndDropdown()">
                  <span id="selectedRecurrenceEnd">Nie</span>
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  </svg>
                </div>
                <div class="dropdown-options" id="recurrenceEndDropdown">
                  <div class="dropdown-option" data-value="never" onclick="window.selectRecurrenceEnd('never', 'Nie')">
                    Nie
                  </div>
                  <div class="dropdown-option" data-value="after" onclick="window.selectRecurrenceEnd('after', 'Nach Anzahl')">
                    Nach Anzahl
                  </div>
                  <div class="dropdown-option" data-value="until" onclick="window.selectRecurrenceEnd('until', 'An Datum')">
                    An Datum
                  </div>
                </div>
              </div>
              <input type="hidden" id="eventRecurrenceEndType" value="never" />

              <div class="mt-2" id="recurrenceEndDetails" style="display: none;">
                <input type="number" class="form-control" id="eventRecurrenceCount" placeholder="Anzahl der Wiederholungen" min="1" style="display: none;" />
                <input type="date" class="form-control" id="eventRecurrenceUntil" style="display: none;" />
              </div>
            </div>

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
                  <div class="dropdown-option" data-value="">
                    Keine Erinnerung
                  </div>
                  <div class="dropdown-option" data-value="15">
                    15 Minuten vorher
                  </div>
                  <div class="dropdown-option" data-value="30">
                    30 Minuten vorher
                  </div>
                  <div class="dropdown-option" data-value="60">
                    1 Stunde vorher
                  </div>
                  <div class="dropdown-option" data-value="1440">
                    1 Tag vorher
                  </div>
                </div>
              </div>
              <input type="hidden" id="eventReminderTime" />
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-action="close">Abbrechen</button>
          <button type="button" class="btn btn-primary" id="saveEventBtn">
            <i class="fas fa-save"></i> Speichern
          </button>
        </div>
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
