/* eslint-disable max-lines */
/**
 * Calendar API Module
 * Handles all HTTP requests to the backend API
 * Normalizes v1/v2 API responses for consistent data handling
 */

import type { EventInput } from '@fullcalendar/core';
import type { User } from '../../types/api.types';
import { canViewAllEmployees } from '../../utils/auth-helpers';
import { getAuthToken } from '../auth/index';
import { showSuccessAlert, showErrorAlert } from '../utils/alerts';
import { ApiClient } from '../../utils/api-client';
import { state } from './state';
import type {
  ApiResponse,
  ApiV2Response,
  ApiV1Response,
  LegacyApiResponse,
  CalendarEvent,
  Department,
  Team,
  UserData,
} from './types';

// ============================================================================
// API Response Extraction & Normalization
// ============================================================================

/**
 * Extract events from V2 API response
 * Handles nested data structures from v2 API
 */
function extractV2Events(
  data: ApiResponse<CalendarEvent> | LegacyApiResponse<CalendarEvent> | CalendarEvent[],
): CalendarEvent[] | null {
  if (!('success' in data) || !('data' in data) || typeof data.data !== 'object' || Array.isArray(data.data)) {
    return null;
  }

  const apiData = data;
  const dataObj = apiData.data as Record<string, unknown>;

  if ('data' in dataObj && Array.isArray(dataObj.data)) {
    console.info('[CALENDAR API] v2 events found:', dataObj.data.length);
    return dataObj.data as CalendarEvent[];
  }

  if ('events' in dataObj && Array.isArray(dataObj.events)) {
    console.info('[CALENDAR API] v2 events (from data.events) found:', dataObj.events.length);
    return dataObj.events as CalendarEvent[];
  }

  return null;
}

/**
 * Extract events from legacy v1 API response
 */
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

/**
 * Extract events from API response (v1 or v2)
 * Tries v2 first, falls back to v1
 */
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
  showErrorAlert('Kalenderdaten konnten nicht geladen werden. API-Fehler.');
  return [];
}

/**
 * Map v2 API response fields to v1 format for consistency
 * The UI uses v1 field names (snake_case), so we normalize all responses
 */
export function mapV2EventFields(event: CalendarEvent): CalendarEvent {
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
 * Normalize event data from API response
 * Handles both direct event objects and wrapped responses
 */
export function normalizeEventData(data: unknown, alwaysV2: boolean = true): CalendarEvent {
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
    return mapV2EventFields(eventData);
  }
  return eventData;
}

/**
 * Extract dashboard events from API response
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
 * Generic helper for departments, teams, users endpoints
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

// ============================================================================
// Event Query Building
// ============================================================================

/**
 * Build query parameters for calendar events endpoint
 */
function buildEventQueryParams(fetchInfo: {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  timeZone: string;
}): URLSearchParams {
  const params = new URLSearchParams({
    start: fetchInfo.startStr,
    end: fetchInfo.endStr,
    filter: state.currentFilter,
  });

  if (state.currentSearch !== '' && state.currentSearch.trim() !== '') {
    params.append('search', state.currentSearch);
  }

  return params;
}

// ============================================================================
// User & Authentication
// ============================================================================

/**
 * Fetch current user data
 * Used for initializing user permissions and info
 */
export async function fetchUserData(): Promise<UserData> {
  const token = getAuthToken();
  if (token === null || token === '') {
    throw new Error('No authentication token found');
  }

  // Use ApiClient which automatically extracts .data from the response
  // Same as unified-navigation and auth/index.ts
  const apiClient = ApiClient.getInstance();
  return await apiClient.get<UserData>('/users/me');
}

// ============================================================================
// Calendar Events
// ============================================================================

/**
 * Format event for FullCalendar display
 * Converts CalendarEvent to FullCalendar's EventInput format
 */
function formatEventForCalendar(event: CalendarEvent): EventInput | null {
  // Color based on organization level - ALWAYS use org-level colors to match legend
  let color = '#3498db'; // Default blue

  // Org-level colors have priority (matching the legend)
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
    case 'area':
      color = '#f39c12'; // Yellow/Gold for area (Bereich)
      break;
    case 'personal':
      color = '#9b59b6'; // Purple for personal (Persönlich)
      break;
    default:
      // Only use custom color if no org_level is set
      color = event.color ?? '#3498db';
      break;
  }

  // Ensure we have valid dates
  const startTime = event.start_time !== '' ? event.start_time : (event.startTime ?? '');
  const endTime = event.end_time !== '' ? event.end_time : (event.endTime ?? '');

  if (startTime === '' || endTime === '') {
    console.error('[CALENDAR API] Event missing time fields:', event);
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
 * Handle permission error (403) by falling back to personal filter
 */
async function handlePermissionError(fetchInfo: {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  timeZone: string;
}): Promise<EventInput[]> {
  console.error('[CALENDAR API] Permission denied for filter:', state.currentFilter);
  state.currentFilter = 'personal';
  localStorage.setItem('calendarFilter', state.currentFilter);

  // Retry with personal filter
  return await loadCalendarEvents(fetchInfo);
}

/**
 * Load calendar events with filters and search
 * Returns FullCalendar-compatible event objects
 */
export async function loadCalendarEvents(fetchInfo: {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  timeZone: string;
}): Promise<EventInput[]> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') {
      window.location.href = '/login';
      throw new Error('No token found');
    }

    const params = buildEventQueryParams(fetchInfo);
    const apiUrl = `/api/v2/calendar/events?${params}`;

    console.info('[CALENDAR API] Loading events - v2: true, URL:', apiUrl);

    const response = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      if (response.status === 403 && state.currentFilter !== 'personal') {
        return await handlePermissionError(fetchInfo);
      }
      throw new Error('Failed to load events');
    }

    const data = (await response.json()) as
      | ApiResponse<CalendarEvent>
      | LegacyApiResponse<CalendarEvent>
      | CalendarEvent[];

    console.info('[CALENDAR API] API Response:', data);

    let events = extractEventsFromResponse(data);

    // Map v2 API response fields
    events = events.map(mapV2EventFields);

    console.info('[CALENDAR API] Formatted events for display:', events);
    const formattedEvents = events.map(formatEventForCalendar).filter((e): e is EventInput => e !== null);
    console.info('[CALENDAR API] Events to render:', formattedEvents);
    return formattedEvents;
  } catch (error: unknown) {
    console.error('Error loading events:', error);
    showErrorAlert('Fehler beim Laden der Termine.');
    return [];
  }
}

/**
 * Load upcoming events for dashboard sidebar
 * Returns raw CalendarEvent objects (not FullCalendar format)
 */
export async function loadUpcomingEvents(): Promise<CalendarEvent[]> {
  const token = getAuthToken();
  if (token === null || token === '') {
    throw new Error('No token found');
  }

  const apiUrl = '/api/v2/calendar/dashboard';
  console.info('[CALENDAR API] Loading dashboard - v2: true, URL:', apiUrl);

  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load upcoming events');
  }

  const data = (await response.json()) as CalendarEvent[] | ApiV2Response<CalendarEvent> | ApiV1Response<CalendarEvent>;
  console.info('[CALENDAR API] Dashboard response:', data);

  return extractDashboardEvents(data);
}

/**
 * Fetch single event details by ID
 */
export async function fetchEventData(eventId: number): Promise<CalendarEvent> {
  const token = getAuthToken();
  if (token === null || token === '') {
    throw new Error('No authentication token found');
  }

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

// ============================================================================
// Event Actions (Respond, Delete)
// ============================================================================

/**
 * Respond to event invitation
 * Updates user's response status (accepted, declined, tentative)
 */
export async function respondToEvent(eventId: number, response: string): Promise<boolean> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') return false;

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
      showSuccessAlert('Ihre Antwort wurde gespeichert.');
      return true;
    } else {
      const error = (await apiResponse.json()) as { message?: string };
      showErrorAlert(error.message ?? 'Fehler beim Speichern der Antwort');
      return false;
    }
  } catch (error: unknown) {
    console.error('Error responding to event:', error);
    showErrorAlert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    return false;
  }
}

/**
 * Delete event by ID
 * Returns true if successful
 */
export async function deleteEventById(eventId: number): Promise<boolean> {
  const token = getAuthToken();
  if (token === null || token === '') return false;

  try {
    const apiUrl = `/api/v2/calendar/events/${eventId}`;

    console.info('[CALENDAR API] Deleting event - v2: true, URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      console.info('[CALENDAR API] Delete successful');
      showSuccessAlert('Termin erfolgreich gelöscht!');
      return true;
    } else {
      const error = (await response.json()) as { message?: string };
      showErrorAlert(error.message ?? 'Fehler beim Löschen des Termins');
      return false;
    }
  } catch (error: unknown) {
    console.error('Error deleting event:', error);
    showErrorAlert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    return false;
  }
}

// ============================================================================
// Event Save (Create/Update)
// ============================================================================

/**
 * Event save parameters
 */
export interface EventSaveParams {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  orgLevel: string;
  color: string;
  departmentId?: number;
  teamId?: number;
  areaId?: number;
  reminderMinutes?: number;
  attendeeIds?: number[];
  recurrenceRule?: string;
}

/**
 * Convert datetime-local format (YYYY-MM-DDTHH:MM) to ISO 8601 UTC format
 * Backend validation (Zod v4) requires strict UTC format with Z suffix
 *
 * NOTE: This interprets the datetime-local string as UTC to preserve the date.
 * For all-day events, this prevents timezone shift (e.g., Nov 27 stays Nov 27).
 */
function convertToIsoDateTime(datetimeLocal: string): string {
  // Parse the datetime-local string as if it's UTC (prevents timezone shift)
  // Input: "2025-11-27T00:00" → Output: "2025-11-27T00:00:00Z"
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(datetimeLocal);

  if (parts === null) {
    throw new Error(`Invalid datetime-local format: ${datetimeLocal}`);
  }

  const [, year, month, day, hours, minutes] = parts;
  return `${year}-${month}-${day}T${hours}:${minutes}:00Z`;
}

/**
 * Build event data for v2 API
 */
function buildEventDataV2(params: EventSaveParams): Record<string, unknown> {
  const eventData: Record<string, unknown> = {
    title: params.title,
    description: params.description,
    startTime: convertToIsoDateTime(params.startTime),
    endTime: convertToIsoDateTime(params.endTime),
    allDay: params.allDay,
    location: params.location,
    orgLevel: params.orgLevel,
    color: params.color,
  };

  if (params.departmentId !== undefined) eventData.departmentId = params.departmentId;
  if (params.teamId !== undefined) eventData.teamId = params.teamId;
  if (params.areaId !== undefined) eventData.areaId = params.areaId;
  if (params.reminderMinutes !== undefined) eventData.reminderMinutes = params.reminderMinutes;
  if (params.attendeeIds !== undefined && params.attendeeIds.length > 0) eventData.attendeeIds = params.attendeeIds;
  if (params.recurrenceRule !== undefined && params.recurrenceRule !== '') {
    eventData.recurrenceRule = params.recurrenceRule;
  }

  return eventData;
}

/**
 * Save event (create or update)
 * Returns event ID if successful, null otherwise
 */
export async function saveEvent(params: EventSaveParams, eventId?: number): Promise<number | null> {
  const token = getAuthToken();
  if (token === null || token === '') {
    throw new Error('No authentication token found');
  }

  const eventData = buildEventDataV2(params);

  console.info('[CALENDAR API] Saving event data:', eventData);

  try {
    const url = eventId !== undefined ? `/api/v2/calendar/events/${eventId}` : '/api/v2/calendar/events';
    const method = eventId !== undefined ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(eventData),
    });

    if (response.ok) {
      // API v2 Response Format: { success: true, data: { event: { eventId: number } }, meta: {...} }
      const result = (await response.json()) as {
        success: boolean;
        data?: { event?: { eventId?: number } };
        message?: string;
      };
      console.info('[CALENDAR API] Save successful:', result);
      const message = eventId !== undefined ? 'Termin erfolgreich aktualisiert!' : 'Termin erfolgreich erstellt!';
      showSuccessAlert(message);

      // Extract event ID from nested response structure
      return result.data?.event?.eventId ?? eventId ?? null;
    } else {
      const error = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
        message?: string;
      };
      console.error('[CALENDAR API] Save error:', error);
      const errorMessage = error.error?.message ?? error.message ?? 'Fehler beim Speichern des Termins';
      showErrorAlert(errorMessage);
      return null;
    }
  } catch (error: unknown) {
    console.error('Error saving event:', error);
    showErrorAlert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    return null;
  }
}

// ============================================================================
// Organization Data (Departments, Teams, Employees)
// ============================================================================

/**
 * Generic fetch helper for API endpoints
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
async function loadDepartments(token: string): Promise<Department[]> {
  const url = '/api/v2/departments';
  const data = await fetchApiData(url, token);

  if (data !== null) {
    return extractArrayFromApiResponse<Department>(data);
  }

  return [];
}

/**
 * Load teams
 */
async function loadTeams(token: string): Promise<Team[]> {
  const url = '/api/v2/teams';
  const data = await fetchApiData(url, token);

  if (data !== null) {
    return extractArrayFromApiResponse<Team>(data);
  }

  return [];
}

/**
 * Load employees
 */
async function loadEmployees(token: string): Promise<User[]> {
  // Only admins can fetch users list
  if (!canViewAllEmployees()) {
    return [];
  }

  const url = '/api/v2/users';
  const data = await fetchApiData(url, token);

  if (data !== null) {
    const allEmployees = extractArrayFromApiResponse<User>(data);
    const currentUserId = getCurrentUserIdFromStorage();
    return allEmployees.filter((emp) => emp.id !== currentUserId);
  }

  return [];
}

/**
 * Load all organization data (departments, teams, employees)
 * Updates state with loaded data
 */
export async function loadDepartmentsAndTeams(): Promise<void> {
  const token = getAuthToken();
  if (token === null || token === '') return;

  try {
    const [departments, teams, employees] = await Promise.all([
      loadDepartments(token),
      loadTeams(token),
      loadEmployees(token),
    ]);

    // Update state
    state.departments = departments;
    state.teams = teams;
    state.employees = employees;

    console.info('[CALENDAR API] Loaded org data:', {
      departments: departments.length,
      teams: teams.length,
      employees: employees.length,
    });
  } catch (error: unknown) {
    console.error('Error loading departments, teams, and employees:', error);
  }
}

/**
 * Load employees list (alias for loadDepartmentsAndTeams)
 * This function already loads employees as part of loadDepartmentsAndTeams
 */
export async function loadEmployeesList(): Promise<void> {
  // Employees are already loaded by loadDepartmentsAndTeams
  // This is just for backward compatibility
  await Promise.resolve();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get display text for reminder minutes
 */
export function getReminderText(minutes: number): string {
  if (minutes === 0) return 'Keine Erinnerung';
  if (minutes === 5) return '5 Minuten vorher';
  if (minutes === 15) return '15 Minuten vorher';
  if (minutes === 30) return '30 Minuten vorher';
  if (minutes === 60) return '1 Stunde vorher';
  if (minutes === 1440) return '1 Tag vorher';
  return `${minutes} Minuten vorher`;
}

/**
 * Get display text for recurrence pattern
 */
export function getRecurrenceText(pattern: string): string {
  switch (pattern) {
    case 'none':
      return 'Keine Wiederholung';
    case 'daily':
      return 'Täglich';
    case 'weekly':
      return 'Wöchentlich';
    case 'monthly':
      return 'Monatlich';
    case 'yearly':
      return 'Jährlich';
    default:
      return 'Keine Wiederholung';
  }
}
