// =============================================================================
// CALENDAR - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
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
import { base } from '$app/paths';
import { goto } from '$app/navigation';

const apiClient = getApiClient();

// =============================================================================
// SESSION HANDLING
// =============================================================================

/**
 * Check if error is a session expired error
 */
function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}

/**
 * Handle session expired error
 */
export function handleSessionExpired(): void {
  goto(`${base}/login?session=expired`);
}

/**
 * Check for session expired and redirect
 */
export function checkSessionExpired(err: unknown): boolean {
  if (isSessionExpiredError(err)) {
    handleSessionExpired();
    return true;
  }
  return false;
}

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

/**
 * Format event for EventCalendar display
 */
function formatEventForCalendar(event: CalendarEvent): EventInput | null {
  if (event.startTime === '' || event.endTime === '') {
    console.error('[CALENDAR API] Event missing time fields:', event);
    return null;
  }

  const color = ORG_LEVEL_COLORS[event.orgLevel] ?? '#3498db';

  return {
    id: event.id.toString(),
    title: event.title !== '' ? event.title : 'Unbenannter Termin',
    start: event.startTime,
    end: event.endTime,
    allDay: event.allDay,
    backgroundColor: color,
    borderColor: color,
    textColor: '#ffffff',
    classNames: [`ec-event-${event.orgLevel}`],
    extendedProps: {
      description: event.description,
      location: event.location,
      orgLevel: event.orgLevel,
      orgId: event.orgId,
      createdBy: event.createdBy,
      creatorName: event.creatorName,
      reminderMinutes: event.reminderMinutes,
      userResponse: event.userResponse,
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

    const response = await apiClient.get<CalendarEventsResponse | CalendarEvent[]>(
      `${API_ENDPOINTS.EVENTS}?${params}`,
    );

    // Handle response: api-client unwraps { success, data } → returns { events: [...], pagination: {...} }
    // Support both array (legacy) and object (current) response formats
    const events: CalendarEvent[] = Array.isArray(response) ? response : (response.events ?? []);

    console.info('[CALENDAR API] Loaded events:', events.length);

    return events.map(formatEventForCalendar).filter((e): e is EventInput => e !== null);
  } catch (err) {
    console.error('[CALENDAR API] Error loading events:', err);
    checkSessionExpired(err);
    return [];
  }
}

/**
 * Load upcoming events for dashboard
 */
export async function loadUpcomingEvents(): Promise<CalendarEvent[]> {
  try {
    const response = await apiClient.get<CalendarEventsResponse | CalendarEvent[]>(
      API_ENDPOINTS.DASHBOARD,
    );

    // Handle response: api-client unwraps { success, data } → returns { events: [...] } or array directly
    return Array.isArray(response) ? response : (response.events ?? []);
  } catch (err) {
    console.error('[CALENDAR API] Error loading upcoming events:', err);
    checkSessionExpired(err);
    return [];
  }
}

/**
 * Fetch single event details
 */
export async function fetchEventData(eventId: number): Promise<CalendarEvent | null> {
  try {
    const response = await apiClient.get<CalendarEvent | { event: CalendarEvent }>(
      API_ENDPOINTS.EVENT(eventId),
    );

    // Handle both direct event and wrapped response
    if ('event' in response) {
      return response.event;
    }
    return response;
  } catch (err) {
    console.error('[CALENDAR API] Error fetching event:', err);
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
  return `${year ?? ''}-${month ?? ''}-${day ?? ''}T${hours ?? ''}:${minutes ?? ''}:00Z`;
}

/**
 * Save event (create or update)
 */
export async function saveEvent(
  formData: EventFormData,
  eventId?: number,
): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const payload = {
      title: formData.title,
      description: formData.description || undefined,
      startTime: convertToIsoDateTime(formData.startTime),
      endTime: convertToIsoDateTime(formData.endTime),
      allDay: formData.allDay,
      location: formData.location || undefined,
      orgLevel: formData.orgLevel,
      departmentId: formData.departmentId,
      teamId: formData.teamId,
      areaId: formData.areaId,
      reminderMinutes: formData.reminderMinutes,
      attendeeIds: formData.attendeeIds,
    };

    console.info('[CALENDAR API] Saving event:', payload);

    const isUpdate = eventId !== undefined;
    const response = await (isUpdate
      ? apiClient.put<{ id?: number }>(API_ENDPOINTS.EVENT(eventId), payload)
      : apiClient.post<{ id?: number }>(API_ENDPOINTS.EVENTS, payload));

    console.info('[CALENDAR API] Save successful:', response);

    return { success: true, id: response?.id ?? eventId };
  } catch (err) {
    console.error('[CALENDAR API] Error saving event:', err);
    checkSessionExpired(err);

    const message = err instanceof Error ? err.message : 'Fehler beim Speichern';
    return { success: false, error: message };
  }
}

/**
 * Delete event
 */
export async function deleteEvent(eventId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.delete(API_ENDPOINTS.EVENT(eventId));
    return { success: true };
  } catch (err) {
    console.error('[CALENDAR API] Error deleting event:', err);
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
export async function loadUserShifts(startDate: string, endDate: string): Promise<UserShift[]> {
  try {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });

    const response = await apiClient.get<{ data: UserShift[] } | UserShift[]>(
      `/shifts/my-calendar-shifts?${params}`,
    );

    // Handle response format
    const shifts: UserShift[] = Array.isArray(response) ? response : (response.data ?? []);

    console.info('[CALENDAR API] Loaded user shifts:', shifts.length);

    return shifts;
  } catch (err) {
    console.error('[CALENDAR API] Error loading user shifts:', err);
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
    const response = await apiClient.get<PaginatedResponse<Department> | Department[]>(
      API_ENDPOINTS.DEPARTMENTS,
    );
    return Array.isArray(response) ? response : (response.data ?? []);
  } catch (err) {
    console.error('[CALENDAR API] Error loading departments:', err);
    return [];
  }
}

/**
 * Load teams
 */
export async function loadTeams(): Promise<Team[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<Team> | Team[]>(API_ENDPOINTS.TEAMS);
    return Array.isArray(response) ? response : (response.data ?? []);
  } catch (err) {
    console.error('[CALENDAR API] Error loading teams:', err);
    return [];
  }
}

/**
 * Load areas
 */
export async function loadAreas(): Promise<Area[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<Area> | Area[]>(API_ENDPOINTS.AREAS);
    return Array.isArray(response) ? response : (response.data ?? []);
  } catch (err) {
    console.error('[CALENDAR API] Error loading areas:', err);
    return [];
  }
}

/**
 * Load users (for attendee selection)
 */
export async function loadUsers(): Promise<User[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<User> | User[]>(API_ENDPOINTS.USERS);
    return Array.isArray(response) ? response : (response.data ?? []);
  } catch (err) {
    console.error('[CALENDAR API] Error loading users:', err);
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

  console.info('[CALENDAR API] Loaded org data:', {
    departments: departments.length,
    teams: teams.length,
    areas: areas.length,
    users: users.length,
  });

  return { departments, teams, areas, users };
}
