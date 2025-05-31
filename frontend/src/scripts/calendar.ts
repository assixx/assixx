/**
 * Calendar System
 * Client-side TypeScript for the company calendar feature
 */

import type { User } from '../types/api.types';
import { getAuthToken, showSuccess, showError } from './auth';
import { closeModal, openModal } from './dashboard-scripts';

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
let currentFilter: string = 'all';
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
document.addEventListener('DOMContentLoaded', () => {
  // Alle Schließen-Buttons einrichten
  setupCloseButtons();

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
        if (newEventBtn) {
          newEventBtn.style.display = isAdmin ? 'block' : 'none';
        }

        // Load departments and teams for form dropdowns
        loadDepartmentsAndTeams();

        // Initialize calendar
        initializeCalendar();

        // Load upcoming events
        loadUpcomingEvents();

        // Setup event listeners
        setupEventListeners();
      })
      .catch((error) => {
        console.error('Error loading user data:', error);
        window.location.href = '/pages/login.html';
      });
  } catch (error) {
    console.error('Error checking login:', error);
    window.location.href = '/pages/login.html';
  }
});

/**
 * Setup close buttons for all modals
 */
function setupCloseButtons(): void {
  // Füge Event-Listener zu allen Elementen mit data-action="close" hinzu
  document.querySelectorAll<HTMLElement>('[data-action="close"]').forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      // Finde das übergeordnete Modal
      const modal = this.closest('.modal-overlay') as HTMLElement;
      if (modal) {
        if (window.DashboardUI?.closeModal) {
          window.DashboardUI.closeModal(modal.id);
        } else {
          closeModal(modal.id);
        }
      } else {
        console.error('No parent modal found for close button');
      }
    });
  });

  // Schließen beim Klicken außerhalb des Modal-Inhalts
  document.querySelectorAll<HTMLElement>('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (event: MouseEvent) => {
      // Nur schließen, wenn der Klick auf den Modal-Hintergrund erfolgt (nicht auf den Inhalt)
      if (event.target === modal) {
        if (window.DashboardUI?.closeModal) {
          window.DashboardUI.closeModal(modal.id);
        } else {
          closeModal(modal.id);
        }
      }
    });
  });
}

/**
 * Initialize FullCalendar
 */
function initializeCalendar(): void {
  const calendarEl = document.getElementById('calendar') as HTMLElement;

  if (!calendarEl) {
    console.error('Calendar element not found');
    return;
  }

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
    selectable: isAdmin, // Only admins can select dates to create events
    select(info: FullCalendarSelectInfo) {
      if (isAdmin) {
        // Bei Klick auf einzelnen Tag: allDay = false
        // Nur wenn der ganze Tag ausgewählt wurde UND es die Monatsansicht ist
        const allDay = info.allDay && info.view.type === 'dayGridMonth';
        openEventForm(null, info.start, info.end, allDay);
      }
    },
    events: loadCalendarEvents,
    eventClick(info: FullCalendarEventClickInfo) {
      viewEvent(parseInt(info.event.id, 10));
    },
    eventMouseEnter(info: FullCalendarEventMouseEnterInfo) {
      // Show tooltip on hover
      const tooltip = document.createElement('div');
      tooltip.className = 'event-tooltip';
      tooltip.innerHTML = `
        <strong>${info.event.title}</strong><br>
        ${info.event.extendedProps?.description || ''}
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
}

/**
 * Setup all event listeners
 */
function setupEventListeners(): void {
  // Filter by level using pill buttons
  document.querySelectorAll<HTMLElement>('.filter-pill[data-value]').forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      // Remove active class from all pills
      document.querySelectorAll('.filter-pill').forEach((pill) => pill.classList.remove('active'));
      // Add active class to clicked pill
      this.classList.add('active');

      currentFilter = this.dataset.value || 'all';
      calendar.refetchEvents();
    });
  });

  // View buttons
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

  // New event button
  const newEventBtn = document.getElementById('newEventBtn') as HTMLButtonElement;
  if (newEventBtn) {
    newEventBtn.addEventListener('click', () => {
      openEventForm();
    });
  }

  // Save event button
  const saveEventBtn = document.getElementById('saveEventBtn') as HTMLButtonElement;
  if (saveEventBtn) {
    saveEventBtn.addEventListener('click', () => {
      saveEvent();
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

  // Attendee search
  const attendeeSearch = document.getElementById('attendeeSearch') as HTMLInputElement;
  if (attendeeSearch) {
    attendeeSearch.addEventListener('input', function (this: HTMLInputElement) {
      searchAttendees(this.value);
    });
  }
}

/**
 * Load calendar events
 */
async function loadCalendarEvents(fetchInfo: FullCalendarFetchInfo): Promise<FullCalendarEventInput[]> {
  try {
    // Get token from localStorage
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/pages/login.html';
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

    // Fetch events with authentication
    const response = await fetch(`/api/calendar?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/pages/login.html';
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to load events');
    }

    const data = await response.json();

    // Handle different response formats
    let events: CalendarEvent[] = [];

    if (Array.isArray(data)) {
      // Direct array response
      events = data;
    } else if (data && Array.isArray(data.events)) {
      // Paginated response with events array
      events = data.events;
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
  // Color based on organization level
  let color = event.color || '#3788d8'; // Default blue

  if (!event.color) {
    switch (event.org_level) {
      case 'company':
        color = '#28a745'; // Green for company
        break;
      case 'department':
        color = '#ffc107'; // Yellow for department
        break;
      case 'team':
        color = '#17a2b8'; // Cyan for team
        break;
      case 'personal':
        color = '#6c757d'; // Gray for personal
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
      window.location.href = '/pages/login.html';
      throw new Error('No token found');
    }

    // Fetch upcoming events
    const response = await fetch('/api/calendar/dashboard', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to load upcoming events');
    }

    const events: CalendarEvent[] = await response.json();
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
      viewEvent(event.id);
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
      window.location.href = '/pages/login.html';
      throw new Error('No token found');
    }

    // Fetch event details with authentication
    const response = await fetch(`/api/calendar/${eventId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/pages/login.html';
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to load event details');
    }

    const event: CalendarEvent = await response.json();

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
      <h3>${escapeHtml(event.title)}</h3>
      ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ''}
      
      <div class="event-details-grid">
        <div class="detail-item">
          <i class="fas fa-calendar"></i>
          <span>${event.all_day ? formattedStartDate : `${formattedStartDate} ${formattedStartTime}`}</span>
        </div>
        <div class="detail-item">
          <i class="fas fa-calendar-check"></i>
          <span>${event.all_day ? formattedEndDate : `${formattedEndDate} ${formattedEndTime}`}</span>
        </div>
        ${event.location ? `<div class="detail-item"><i class="fas fa-map-marker-alt"></i><span>${escapeHtml(event.location)}</span></div>` : ''}
        <div class="detail-item">
          <i class="fas fa-layer-group"></i>
          <span>${levelText}</span>
        </div>
        <div class="detail-item">
          <i class="fas fa-user"></i>
          <span>Erstellt von: ${escapeHtml(event.creator_name || 'Unknown')}</span>
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
          `${attendee.first_name || ''} ${attendee.last_name || ''}`.trim() || attendee.username || 'Unknown';
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
      modalContent += `
        <div class="response-buttons">
          <h4>Ihre Antwort</h4>
          <button class="btn btn-success" onclick="respondToEvent(${event.id}, 'accepted')">
            <i class="fas fa-check"></i> Zusagen
          </button>
          <button class="btn btn-warning" onclick="respondToEvent(${event.id}, 'tentative')">
            <i class="fas fa-question"></i> Vielleicht
          </button>
          <button class="btn btn-danger" onclick="respondToEvent(${event.id}, 'declined')">
            <i class="fas fa-times"></i> Absagen
          </button>
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
        </div>
      `;
    }

    // Show modal
    const modalBody = document.getElementById('eventDetailsContent') as HTMLElement;
    if (modalBody) {
      modalBody.innerHTML = modalContent;
      openModal('eventDetailsModal');
    }
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

    const apiResponse = await fetch(`/api/calendar/${eventId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ response }),
    });

    if (apiResponse.ok) {
      showSuccess('Ihre Antwort wurde gespeichert.');
      closeModal('eventDetailsModal');

      // Refresh calendar and upcoming events
      calendar.refetchEvents();
      loadUpcomingEvents();
    } else {
      const error = await apiResponse.json();
      showError(error.message || 'Fehler beim Speichern der Antwort');
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
  const modal = document.getElementById('eventFormModal') as HTMLElement;
  if (!modal) return;

  // Reset form
  const form = document.getElementById('eventForm') as HTMLFormElement;
  if (form) form.reset();

  // Reset color selection
  document.querySelectorAll('.color-option').forEach((option) => {
    option.classList.remove('active');
  });
  document.querySelector('.color-option[data-color="#3788d8"]')?.classList.add('active');

  // Clear attendees
  selectedAttendees = [];
  updateSelectedAttendees();

  if (eventId) {
    // Load event data for editing
    loadEventForEdit(eventId);
  } else {
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

  // Show modal
  openModal('eventFormModal');
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
  const orgIdContainer = document.getElementById('orgIdContainer') as HTMLElement;
  const orgIdDropdown = document.getElementById('orgIdDropdown') as HTMLElement;

  if (!orgIdContainer || !orgIdDropdown) return;

  orgIdDropdown.innerHTML = '';

  if (level === 'personal' || level === 'company') {
    orgIdContainer.style.display = 'none';
  } else if (level === 'department') {
    orgIdContainer.style.display = 'block';
    const label = orgIdContainer.querySelector('label');
    if (label) label.textContent = 'Abteilung';

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    departments.forEach((dept) => {
      const item = document.createElement('a');
      item.className = 'dropdown-item';
      item.href = '#';
      item.textContent = dept.name;
      item.onclick = (e) => {
        e.preventDefault();
        selectOrgId(dept.id, dept.name);
      };
      menu.appendChild(item);
    });
    orgIdDropdown.appendChild(menu);
  } else if (level === 'team') {
    orgIdContainer.style.display = 'block';
    const label = orgIdContainer.querySelector('label');
    if (label) label.textContent = 'Team';

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    teams.forEach((team) => {
      const item = document.createElement('a');
      item.className = 'dropdown-item';
      item.href = '#';
      item.textContent = team.name;
      item.onclick = (e) => {
        e.preventDefault();
        selectOrgId(team.id, team.name);
      };
      menu.appendChild(item);
    });
    orgIdDropdown.appendChild(menu);
  }
}

/**
 * Save event
 */
async function saveEvent(): Promise<void> {
  const form = document.getElementById('eventForm') as HTMLFormElement;
  if (!form) return;

  const formData = new FormData(form);
  const token = getAuthToken();
  if (!token) return;

  // Get selected color
  const selectedColor = document.querySelector('.color-option.active') as HTMLElement;
  const color = selectedColor?.dataset.color || '#3788d8';

  // Parse dates and times
  const startDate = formData.get('start_date') as string;
  const startTime = formData.get('start_time') as string;
  const endDate = formData.get('end_date') as string;
  const endTime = formData.get('end_time') as string;
  const allDay = (formData.get('all_day') as string) === 'on';

  let startDateTime: string;
  let endDateTime: string;

  if (allDay) {
    startDateTime = `${startDate}T00:00:00`;
    endDateTime = `${endDate}T23:59:59`;
  } else {
    startDateTime = `${startDate}T${startTime}:00`;
    endDateTime = `${endDate}T${endTime}:00`;
  }

  const eventData = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    start_time: startDateTime,
    end_time: endDateTime,
    all_day: allDay,
    location: formData.get('location') as string,
    org_level: formData.get('org_level') as string,
    org_id:
      formData.get('org_level') === 'personal' || formData.get('org_level') === 'company'
        ? null
        : parseInt(formData.get('org_id') as string),
    color,
    reminder_time: formData.get('reminder_time') ? parseInt(formData.get('reminder_time') as string) : null,
    attendee_ids: selectedAttendees,
  };

  try {
    const eventId = formData.get('event_id') as string;
    const url = eventId ? `/api/calendar/${eventId}` : '/api/calendar';
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
      showSuccess(eventId ? 'Termin erfolgreich aktualisiert!' : 'Termin erfolgreich erstellt!');
      closeModal('eventFormModal');

      // Refresh calendar
      calendar.refetchEvents();
      loadUpcomingEvents();
    } else {
      const error = await response.json();
      showError(error.message || 'Fehler beim Speichern des Termins');
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
    const response = await fetch(`/api/calendar/${eventId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const event: CalendarEvent = await response.json();

      // Fill form with event data
      const form = document.getElementById('eventForm') as HTMLFormElement;
      if (!form) return;

      (form.elements.namedItem('event_id') as HTMLInputElement).value = event.id.toString();
      (form.elements.namedItem('title') as HTMLInputElement).value = event.title;
      (form.elements.namedItem('description') as HTMLTextAreaElement).value = event.description || '';
      (form.elements.namedItem('location') as HTMLInputElement).value = event.location || '';
      (form.elements.namedItem('org_level') as HTMLSelectElement).value = event.org_level;

      // Parse dates
      const startDate = new Date(event.start_time);
      const endDate = new Date(event.end_time);

      (form.elements.namedItem('start_date') as HTMLInputElement).value = formatDateForInput(startDate);
      (form.elements.namedItem('end_date') as HTMLInputElement).value = formatDateForInput(endDate);

      const allDayCheckbox = form.elements.namedItem('all_day') as HTMLInputElement;
      allDayCheckbox.checked = Boolean(event.all_day);

      if (!event.all_day) {
        (form.elements.namedItem('start_time') as HTMLInputElement).value = formatTimeForInput(startDate);
        (form.elements.namedItem('end_time') as HTMLInputElement).value = formatTimeForInput(endDate);
      }

      // Update time inputs disabled state
      const timeInputs = document.querySelectorAll<HTMLInputElement>('.time-input');
      timeInputs.forEach((input) => {
        input.disabled = Boolean(event.all_day);
      });

      // Update org dropdown
      updateOrgIdDropdown(event.org_level);
      if (event.org_id) {
        const orgName = event.department_name || event.team_name || '';
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

      // Set reminder
      if (event.reminder_time !== undefined && event.reminder_time !== null) {
        (form.elements.namedItem('reminder_time') as HTMLSelectElement).value = event.reminder_time.toString();
      }

      // Load attendees
      if (event.attendees) {
        selectedAttendees = event.attendees.map((a) => a.user_id);
        updateSelectedAttendees();
      }
    } else {
      showError('Fehler beim Laden des Termins');
      closeModal('eventFormModal');
    }
  } catch (error) {
    console.error('Error loading event:', error);
    showError('Ein Fehler ist aufgetreten');
    closeModal('eventFormModal');
  }
}

/**
 * Delete event
 */
async function deleteEvent(eventId: number): Promise<void> {
  // eslint-disable-next-line no-alert
  if (!confirm('Möchten Sie diesen Termin wirklich löschen?')) {
    return;
  }

  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`/api/calendar/${eventId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      showSuccess('Termin erfolgreich gelöscht!');
      closeModal('eventDetailsModal');

      // Refresh calendar
      calendar.refetchEvents();
      loadUpcomingEvents();
    } else {
      const error = await response.json();
      showError(error.message || 'Fehler beim Löschen des Termins');
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
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
    const username = (emp.username || '').toLowerCase();
    const email = (emp.email || '').toLowerCase();
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
    const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username;
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
 * Update selected attendees display
 */
function updateSelectedAttendees(): void {
  const container = document.getElementById('selectedAttendees') as HTMLElement;
  if (!container) return;

  container.innerHTML = '';

  selectedAttendees.forEach((userId) => {
    const employee = employees.find((emp) => emp.id === userId);
    if (!employee) return;

    const name = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username;
    const chip = document.createElement('div');
    chip.className = 'attendee-chip';
    chip.innerHTML = `
      <span>${escapeHtml(name)}</span>
      <button onclick="removeAttendee(${userId})">
        <i class="fas fa-times"></i>
      </button>
    `;
    container.appendChild(chip);
  });
}

/**
 * Check if user is logged in
 */
function checkLoggedIn(): void {
  const token = getAuthToken();
  if (!token) {
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

  const response = await fetch('/api/user/profile', {
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
    const deptResponse = await fetch('/api/departments', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (deptResponse.ok) {
      departments = await deptResponse.json();
    }

    // Load teams
    const teamResponse = await fetch('/api/teams', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (teamResponse.ok) {
      teams = await teamResponse.json();
    }

    // Load employees for attendees
    const empResponse = await fetch('/api/users', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (empResponse.ok) {
      employees = await empResponse.json();
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
  }
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.viewEvent = viewEvent;
  window.editEvent = (eventId: number) => openEventForm(eventId);
  window.deleteEvent = deleteEvent;
  window.respondToEvent = respondToEvent;
  window.openEventForm = openEventForm;
  window.saveEvent = saveEvent;
  window.selectOrgId = selectOrgId;
  window.addAttendee = addAttendee;
  window.removeAttendee = removeAttendee;
}
