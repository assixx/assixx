/**
 * Calendar Utility Functions
 * Pure functions for data formatting, filtering, and processing
 */
import { RowDataPacket, query as executeQuery } from '../../utils/db';
import user from '../user';
import { CountResult, DbCalendarEvent } from './calendar.types';

/**
 * Format datetime strings for MySQL (remove 'Z' and convert to local format)
 */
export function formatDateForMysql(dateString: string | Date | null): string | null {
  if (dateString == null || dateString === '') return null;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Process calendar events to map fields and convert buffers
 */
export function processCalendarEvents(events: DbCalendarEvent[]): void {
  events.forEach((event: DbCalendarEvent) => {
    // Map database column names to API property names
    event.start_time = event.start_date;
    event.end_time = event.end_date;
    event.reminder_time = event.reminder_minutes;
    event.created_by = event.user_id;

    // Convert Buffer description to String if needed
    if (event.description != null && Buffer.isBuffer(event.description)) {
      event.description = event.description.toString('utf8');
    } else if (
      event.description != null &&
      typeof event.description === 'object' &&
      'type' in event.description &&
      Array.isArray(event.description.data)
    ) {
      event.description = Buffer.from(event.description.data).toString('utf8');
    }
  });
}

/**
 * Apply org level filter to query
 */
export function applyOrgLevelFilter(
  query: string,
  params: unknown[],
  filter: string,
  userDepartmentId?: number | null,
  userTeamId?: number | null,
  userId?: number,
): { query: string; params: unknown[] } {
  let updatedQuery = query;
  const updatedParams = [...params];

  switch (filter) {
    case 'company':
      updatedQuery += " AND e.org_level = 'company'";
      break;
    case 'department':
      updatedQuery += " AND e.org_level = 'department' AND e.department_id = ?";
      updatedParams.push(userDepartmentId);
      break;
    case 'team':
      updatedQuery += " AND e.org_level = 'team' AND e.team_id = ?";
      updatedParams.push(userTeamId);
      break;
    case 'personal':
      updatedQuery +=
        " AND (e.org_level = 'personal' AND (e.user_id = ? OR EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)))";
      updatedParams.push(userId, userId);
      break;
  }

  return { query: updatedQuery, params: updatedParams };
}

/**
 * Apply date and search filters to query
 */
export function applyDateAndSearchFilters(
  query: string,
  params: unknown[],
  startDate?: string,
  endDate?: string,
  search?: string,
): { query: string; params: unknown[] } {
  let updatedQuery = query;
  const updatedParams = [...params];

  if (startDate !== undefined && startDate !== '') {
    updatedQuery += ' AND e.end_date >= ?';
    updatedParams.push(startDate);
  }

  if (endDate !== undefined && endDate !== '') {
    updatedQuery += ' AND e.start_date <= ?';
    updatedParams.push(endDate);
  }

  if (search !== undefined && search !== '') {
    updatedQuery += ' AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)';
    const searchTerm = `%${search}%`;
    updatedParams.push(searchTerm, searchTerm, searchTerm);
  }

  return { query: updatedQuery, params: updatedParams };
}

/**
 * Apply org level and access filters to query
 */
export function applyEventFilters(
  query: string,
  params: unknown[],
  options: {
    filter: string;
    userDepartmentId?: number | null;
    userTeamId?: number | null;
    userId: number;
    role?: string | null;
    startDate?: string;
    endDate?: string;
    search?: string;
    isCountQuery?: boolean;
  },
): { query: string; params: unknown[] } {
  let updatedQuery = query;
  let updatedParams = [...params];

  // Apply org level filter based on new structure
  if (options.filter !== 'all') {
    const orgResult = applyOrgLevelFilter(
      updatedQuery,
      updatedParams,
      options.filter,
      options.userDepartmentId,
      options.userTeamId,
      options.userId,
    );
    updatedQuery = orgResult.query;
    updatedParams = orgResult.params;
  }

  // Apply access control for ALL users (including admins) for privacy
  if (options.filter === 'all' && !options.isCountQuery) {
    updatedQuery += ` AND (
          e.org_level = 'company' OR
          (e.org_level = 'department' AND e.department_id = ?) OR
          (e.org_level = 'team' AND e.team_id = ?) OR
          e.user_id = ? OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
        )`;
    updatedParams.push(
      options.userDepartmentId,
      options.userTeamId,
      options.userId,
      options.userId,
    );
  }

  // Apply access control for non-admin users for count
  if (options.isCountQuery && options.role !== 'admin' && options.role !== 'root') {
    updatedQuery += ` AND (
          e.type IN ('meeting', 'training') OR
          e.user_id = ? OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
        )`;
    updatedParams.push(options.userId, options.userId);
  }

  // Apply date range and search filters
  const filterResult = applyDateAndSearchFilters(
    updatedQuery,
    updatedParams,
    options.startDate,
    options.endDate,
    options.search,
  );

  return { query: filterResult.query, params: filterResult.params };
}

/**
 * Get event count for pagination
 */
export async function getEventCount(
  tenantId: number,
  dbStatus: string,
  options: {
    filter: string;
    userDepartmentId?: number | null;
    userTeamId?: number | null;
    userId: number;
    role?: string | null;
    startDate?: string;
    endDate?: string;
    search?: string;
  },
): Promise<number> {
  const countQuery = `
    SELECT COUNT(*) as total
    FROM calendar_events e
    WHERE e.tenant_id = ? AND e.status = ?
  `;
  const countBaseParams: unknown[] = [tenantId, dbStatus];
  const { query: filteredCountQuery, params: countParams } = applyEventFilters(
    countQuery,
    countBaseParams,
    { ...options, isCountQuery: true },
  );
  const [countResult] = await executeQuery<CountResult[]>(filteredCountQuery, countParams);
  return countResult[0].total;
}

/**
 * Check if user has access to a specific event
 * @internal Used internally by CRUD operations
 */
export async function checkEventAccess(
  event: DbCalendarEvent,
  userId: number,
  role: string | null,
): Promise<boolean> {
  // Admins have access to all events
  if (role === 'admin' || role === 'root') {
    return true;
  }

  // Company events are visible to all employees
  if (event.org_level === 'company') {
    return true;
  }

  // Get user info for department and team checks
  const userInfo = await user.getUserDepartmentAndTeam(userId);

  // Department events are visible to department members
  if (
    event.org_level === 'department' &&
    event.department_id != null &&
    userInfo.departmentId === event.department_id
  ) {
    return true;
  }

  // Team events are visible to team members
  if (event.org_level === 'team' && event.team_id != null && userInfo.teamId === event.team_id) {
    return true;
  }

  // Check if user is creator or attendee for personal events
  if (event.user_id === userId) {
    return true;
  }

  // Check if event is public type
  if (event.type === 'meeting' || event.type === 'training') {
    return true;
  }

  // Check if user is an attendee
  const [attendeeRows] = await executeQuery<RowDataPacket[]>(
    'SELECT 1 FROM calendar_attendees WHERE event_id = ? AND user_id = ?',
    [event.id, userId],
  );

  return attendeeRows.length > 0;
}

/**
 * Get value for all_day field
 */
export function getAllDayValue(allDay: boolean | undefined): number | undefined {
  if (allDay === undefined) return undefined;
  return allDay ? 1 : 0;
}

/**
 * Get value for reminder_time field
 */
export function getReminderValue(
  reminderTime: number | string | null | undefined,
): number | null | undefined {
  if (reminderTime === undefined) return undefined;
  if (reminderTime === '' || reminderTime === null) return null;
  return Number.parseInt(reminderTime.toString(), 10);
}

/**
 * Create field mappings for event update
 */
function createEventFieldMappings(eventData: {
  title?: string;
  description?: string;
  location?: string;
  start_time?: string | Date;
  end_time?: string | Date;
  all_day?: boolean;
  org_level?: 'company' | 'department' | 'team' | 'personal';
  department_id?: number | null;
  team_id?: number | null;
  status?: 'active' | 'cancelled';
  reminder_time?: number | string | null;
  color?: string;
}): { condition: boolean; field: string; value: unknown }[] {
  return [
    { condition: eventData.title !== undefined, field: 'title', value: eventData.title },
    {
      condition: eventData.description !== undefined,
      field: 'description',
      value: eventData.description,
    },
    { condition: eventData.location !== undefined, field: 'location', value: eventData.location },
    {
      condition: eventData.start_time !== undefined,
      field: 'start_date',
      value:
        eventData.start_time !== undefined ? formatDateForMysql(eventData.start_time) : undefined,
    },
    {
      condition: eventData.end_time !== undefined,
      field: 'end_date',
      value: eventData.end_time !== undefined ? formatDateForMysql(eventData.end_time) : undefined,
    },
    {
      condition: eventData.all_day !== undefined,
      field: 'all_day',
      value: getAllDayValue(eventData.all_day),
    },
    {
      condition: eventData.org_level !== undefined,
      field: 'org_level',
      value: eventData.org_level,
    },
    {
      condition: eventData.department_id !== undefined,
      field: 'department_id',
      value: eventData.department_id,
    },
    { condition: eventData.team_id !== undefined, field: 'team_id', value: eventData.team_id },
    { condition: eventData.status !== undefined, field: 'status', value: eventData.status },
    {
      condition: eventData.reminder_time !== undefined,
      field: 'reminder_minutes',
      value: getReminderValue(eventData.reminder_time),
    },
    { condition: eventData.color !== undefined, field: 'color', value: eventData.color },
  ];
}

/**
 * Build update query for calendar event
 */
export function buildEventUpdateQuery(
  eventData: {
    title?: string;
    description?: string;
    location?: string;
    start_time?: string | Date;
    end_time?: string | Date;
    all_day?: boolean;
    org_level?: 'company' | 'department' | 'team' | 'personal';
    department_id?: number | null;
    team_id?: number | null;
    status?: 'active' | 'cancelled';
    reminder_time?: number | string | null;
    color?: string;
    created_by?: number;
    recurrence_rule?: string | null;
  },
  id: number,
  tenantId: number,
): { query: string; params: unknown[] } {
  const fieldMappings = createEventFieldMappings(eventData);

  let query = 'UPDATE calendar_events SET updated_at = NOW()';
  const queryParams: unknown[] = [];

  for (const { condition, field, value } of fieldMappings) {
    if (condition) {
      query += `, ${field} = ?`;
      queryParams.push(value);
    }
  }

  query += ' WHERE id = ? AND tenant_id = ?';
  queryParams.push(id, tenantId);

  return { query, params: queryParams };
}
