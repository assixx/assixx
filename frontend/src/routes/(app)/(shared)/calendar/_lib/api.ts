// =============================================================================
// CALENDAR - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';
import { checkSessionExpired } from '$lib/utils/session-expired.js';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';

import { API_ENDPOINTS, ORG_LEVEL_COLORS } from './constants';

import type {
  CalendarEvent,
  EventInput,
  EventFormData,
  Department,
  Team,
  Area,
  User,
  FilterLevel,
  PaginatedResponse,
} from './types';

const log = createLogger('CalendarApi');

const apiClient = getApiClient();

// =============================================================================
// USER DATA
// =============================================================================

/**
 * Fetch current user data
 * DELEGATES to shared user service (prevents duplicate /users/me calls)
 */
export async function fetchUserData(): Promise<User> {
  const result = await fetchSharedUser();
  if (result.user === null) {
    throw new Error('User not authenticated');
  }
  return result.user as unknown as User;
}

// =============================================================================
// CALENDAR EVENTS
// =============================================================================

/** Check if value is a valid ID (not null/undefined) */
function hasValidId(id: number | null | undefined): boolean {
  return id !== null && id !== undefined;
}

/** Multi-org assignment class lookup (A=area, D=department, T=team) */
const MULTI_ORG_CLASSES: Record<string, string> = {
  ADT: 'ec-event-area-department-team',
  AD: 'ec-event-area-department',
  AT: 'ec-event-area-team',
  DT: 'ec-event-department-team',
};

/**
 * Determine event class based on multi-assignment
 * Returns gradient class for combinations, single class for single assignment
 */
function getEventClassName(event: CalendarEvent): string {
  // Build assignment key: A=area, D=department, T=team
  const key =
    (hasValidId(event.areaId) ? 'A' : '') +
    (hasValidId(event.departmentId) ? 'D' : '') +
    (hasValidId(event.teamId) ? 'T' : '');

  // Multi-assignment → gradient class, single → orgLevel class
  return MULTI_ORG_CLASSES[key] ?? `ec-event-${event.orgLevel}`;
}

/**
 * Format event for EventCalendar display
 */
function formatEventForCalendar(event: CalendarEvent): EventInput | null {
  if (event.startTime === '' || event.endTime === '') {
    log.error({ event }, 'Event missing time fields');
    return null;
  }

  const color = ORG_LEVEL_COLORS[event.orgLevel];
  const eventClassName = getEventClassName(event);

  return {
    id: event.id.toString(),
    title: event.title !== '' ? event.title : 'Unbenannter Termin',
    start: event.startTime,
    end: event.endTime,
    allDay: event.allDay,
    backgroundColor: color,
    borderColor: color,
    textColor: '#ffffff',
    classNames: [eventClassName],
    extendedProps: {
      description: event.description,
      location: event.location,
      orgLevel: event.orgLevel,
      orgId: event.orgId,
      userId: event.userId,
      creatorName: event.creatorName,
      userResponse: event.userResponse,
      areaId: event.areaId,
      departmentId: event.departmentId,
      teamId: event.teamId,
    },
  };
}

/**
 * Calendar events API response format
 * API returns { events: CalendarEvent[], pagination?: {...} } after api-client unwraps success wrapper
 */
interface CalendarEventsResponse {
  events: CalendarEvent[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Load calendar events with filters
 */
export async function loadCalendarEvents(
  startStr: string,
  endStr: string,
  filter: FilterLevel,
  search?: string,
): Promise<EventInput[]> {
  try {
    const params = new URLSearchParams({
      start: startStr,
      end: endStr,
      filter,
    });

    if (search !== undefined && search.trim() !== '') {
      params.append('search', search);
    }

    const response = await apiClient.get<
      CalendarEventsResponse | CalendarEvent[]
    >(`${API_ENDPOINTS.EVENTS}?${params}`);

    // Handle response: api-client unwraps { success, data } → returns { events: [...], pagination: {...} }
    // Support both array (legacy) and object (current) response formats
    const events: CalendarEvent[] =
      Array.isArray(response) ? response : response.events;

    return events
      .map(formatEventForCalendar)
      .filter((e): e is EventInput => e !== null);
  } catch (err: unknown) {
    log.error({ err }, 'Error loading events');
    checkSessionExpired(err);
    return [];
  }
}

/**
 * Load upcoming events for dashboard
 */
export async function loadUpcomingEvents(): Promise<CalendarEvent[]> {
  try {
    const response = await apiClient.get<
      CalendarEventsResponse | CalendarEvent[]
    >(API_ENDPOINTS.DASHBOARD);

    // Handle response: api-client unwraps { success, data } → returns { events: [...] } or array directly
    return Array.isArray(response) ? response : response.events;
  } catch (err: unknown) {
    log.error({ err }, 'Error loading upcoming events');
    checkSessionExpired(err);
    return [];
  }
}

/**
 * Fetch single event details
 */
export async function fetchEventData(
  eventId: number,
): Promise<CalendarEvent | null> {
  try {
    const response = await apiClient.get<
      CalendarEvent | { event: CalendarEvent }
    >(API_ENDPOINTS.event(eventId));

    // Handle both direct event and wrapped response
    if ('event' in response) {
      return response.event;
    }
    return response;
  } catch (err: unknown) {
    log.error({ err }, 'Error fetching event');
    checkSessionExpired(err);
    return null;
  }
}

/**
 * Convert datetime-local format to ISO 8601 UTC
 */
function convertToIsoDateTime(datetimeLocal: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(datetimeLocal);
  if (parts === null) {
    throw new Error(`Invalid datetime-local format: ${datetimeLocal}`);
  }
  const [, year, month, day, hours, minutes] = parts;
  return `${year}-${month}-${day}T${hours}:${minutes}:00Z`;
}

/**
 * Save event (create or update)
 */
export async function saveEvent(
  formData: EventFormData,
  eventId?: number,
): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    // Arrays are already in correct format from multi-select bindings
    // Filter out null/undefined values (can happen from multi-select edge cases)
    // and only include non-empty arrays
    const filterValidIds = (ids: number[]): number[] | undefined => {
      // Cast to handle edge cases where null values slip into the array
      const valid = (ids as (number | null | undefined)[]).filter(
        (id): id is number => typeof id === 'number',
      );
      return valid.length > 0 ? valid : undefined;
    };
    const departmentIds = filterValidIds(formData.departmentIds);
    const teamIds = filterValidIds(formData.teamIds);
    const areaIds = filterValidIds(formData.areaIds);

    const payload = {
      title: formData.title,
      description: formData.description || undefined,
      startTime: convertToIsoDateTime(formData.startTime),
      endTime: convertToIsoDateTime(formData.endTime),
      allDay: formData.allDay,
      location: formData.location || undefined,
      orgLevel: formData.orgLevel,
      departmentIds,
      teamIds,
      areaIds,
      attendeeIds: formData.attendeeIds,
      // Recurrence fields
      recurrence: formData.recurrence,
      recurrenceEndType: formData.recurrenceEndType,
      recurrenceCount: formData.recurrenceCount,
      recurrenceUntil: formData.recurrenceUntil,
    };

    const isUpdate = eventId !== undefined;
    const response = await (isUpdate ?
      apiClient.put<{ id?: number }>(API_ENDPOINTS.event(eventId), payload)
    : apiClient.post<{ id?: number }>(API_ENDPOINTS.EVENTS, payload));

    return { success: true, id: response.id ?? eventId };
  } catch (err: unknown) {
    log.error({ err }, 'Error saving event');
    checkSessionExpired(err);

    const message =
      err instanceof Error ? err.message : 'Fehler beim Speichern';
    return { success: false, error: message };
  }
}

/**
 * Delete event
 */
export async function deleteEvent(
  eventId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.delete(API_ENDPOINTS.event(eventId));
    return { success: true };
  } catch (err: unknown) {
    log.error({ err }, 'Error deleting event');
    checkSessionExpired(err);

    const message = err instanceof Error ? err.message : 'Fehler beim Löschen';
    return { success: false, error: message };
  }
}

// =============================================================================
// USER SHIFTS (Calendar Integration - Legacy DOM-based)
// =============================================================================

/**
 * User shift from API
 */
export interface UserShift {
  date: string;
  type: 'F' | 'S' | 'N';
}

/**
 * Load user's shift assignments for calendar display
 * API: GET /api/v2/shifts/my-calendar-shifts
 * Returns raw shift data - DOM rendering handled by component
 */
export async function loadUserShifts(
  startDate: string,
  endDate: string,
): Promise<UserShift[]> {
  try {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });

    const response = await apiClient.get<{ data: UserShift[] } | UserShift[]>(
      `/shifts/my-calendar-shifts?${params}`,
    );

    // Handle response format
    const shifts: UserShift[] =
      Array.isArray(response) ? response : response.data;

    return shifts;
  } catch (err: unknown) {
    log.error({ err }, 'Error loading user shifts');
    return [];
  }
}

// =============================================================================
// USER VACATIONS (Calendar Integration - Legacy DOM-based)
// =============================================================================

/**
 * Approved vacation range from API
 * Represents a date range (not expanded days) for calendar indicator rendering.
 */
export interface CalendarVacationEntry {
  startDate: string;
  endDate: string;
  vacationType: string;
  halfDayStart: string;
  halfDayEnd: string;
}

/**
 * Load user's approved vacations for calendar display
 * API: GET /api/v2/vacation/my-calendar-vacations
 * Returns date ranges — DOM rendering + expansion handled by component
 */
export async function loadUserVacations(
  startDate: string,
  endDate: string,
): Promise<CalendarVacationEntry[]> {
  try {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });

    const response = await apiClient.get<CalendarVacationEntry[]>(
      `/vacation/my-calendar-vacations?${params}`,
    );

    return Array.isArray(response) ? response : [];
  } catch (err: unknown) {
    log.error({ err }, 'Error loading user vacations');
    return [];
  }
}

// =============================================================================
// ORGANIZATION DATA
// =============================================================================

/**
 * Load departments
 */
export async function loadDepartments(): Promise<Department[]> {
  try {
    const response = await apiClient.get<
      PaginatedResponse<Department> | Department[]
    >(API_ENDPOINTS.DEPARTMENTS);
    return Array.isArray(response) ? response : response.data;
  } catch (err: unknown) {
    log.error({ err }, 'Error loading departments');
    return [];
  }
}

/**
 * Load teams
 */
export async function loadTeams(): Promise<Team[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<Team> | Team[]>(
      API_ENDPOINTS.TEAMS,
    );
    return Array.isArray(response) ? response : response.data;
  } catch (err: unknown) {
    log.error({ err }, 'Error loading teams');
    return [];
  }
}

/**
 * Load areas
 */
export async function loadAreas(): Promise<Area[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<Area> | Area[]>(
      API_ENDPOINTS.AREAS,
    );
    return Array.isArray(response) ? response : response.data;
  } catch (err: unknown) {
    log.error({ err }, 'Error loading areas');
    return [];
  }
}

/**
 * Load users (for attendee selection)
 */
export async function loadUsers(): Promise<User[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<User> | User[]>(
      API_ENDPOINTS.USERS,
    );
    return Array.isArray(response) ? response : response.data;
  } catch (err: unknown) {
    log.error({ err }, 'Error loading users');
    return [];
  }
}

/**
 * Load all organization data in parallel
 */
export async function loadOrganizationData(): Promise<{
  departments: Department[];
  teams: Team[];
  areas: Area[];
  users: User[];
}> {
  const [departments, teams, areas, users] = await Promise.all([
    loadDepartments(),
    loadTeams(),
    loadAreas(),
    loadUsers(),
  ]);

  return { departments, teams, areas, users };
}

// =============================================================================
// FEATURE VISITS - BADGE RESET
// =============================================================================

/**
 * Mark calendar as visited - resets the notification badge
 * Called on page mount to update last_visited_at timestamp
 */
export async function markCalendarVisited(): Promise<void> {
  try {
    await apiClient.post('/feature-visits/mark', { feature: 'calendar' });
    log.debug('Calendar marked as visited');
  } catch (err: unknown) {
    // Non-critical error - don't break the page
    log.warn({ err }, 'Failed to mark calendar as visited');
  }
}
