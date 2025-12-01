/**
 * Calendar Utility Functions
 * Pure functions for data formatting, filtering, and processing
 */
import { RowDataPacket, query as executeQuery } from '../../../../utils/db.js';
import user from '../../users/model/index.js';
import { CountResult, DbCalendarEvent } from './calendar.types.js';

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
    event.reminder_time = event.reminder_minutes ?? null;
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
  _userTeamId?: number | null, // Deprecated: Users can be in multiple teams via user_teams (N:M)
  userId?: number,
): { query: string; params: unknown[] } {
  let updatedQuery = query;
  const updatedParams = [...params];

  switch (filter) {
    case 'company':
      updatedQuery += " AND e.org_level = 'company'";
      break;
    case 'department':
      {
        const paramIndex = updatedParams.length + 1;
        updatedQuery += ` AND e.org_level = 'department' AND e.department_id = $${paramIndex}`;
        updatedParams.push(userDepartmentId);
      }
      break;
    case 'team':
      {
        // User can be in multiple teams via user_teams (N:M relation)
        const paramIndex = updatedParams.length + 1;
        updatedQuery += ` AND e.org_level = 'team' AND e.team_id IN (SELECT team_id FROM user_teams WHERE user_id = $${paramIndex})`;
        updatedParams.push(userId);
      }
      break;
    case 'area':
      {
        // User is assigned to area indirectly via department.area_id
        const paramIndex = updatedParams.length + 1;
        updatedQuery += ` AND e.org_level = 'area' AND e.area_id = (SELECT area_id FROM departments WHERE id = $${paramIndex})`;
        updatedParams.push(userDepartmentId);
      }
      break;
    case 'personal':
      {
        const paramIndex1 = updatedParams.length + 1;
        const paramIndex2 = updatedParams.length + 2;
        updatedQuery += ` AND (e.org_level = 'personal' AND (e.user_id = $${paramIndex1} OR EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = $${paramIndex2})))`;
        updatedParams.push(userId, userId);
      }
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
    const paramIndex = updatedParams.length + 1;
    updatedQuery += ` AND e.end_date >= $${paramIndex}`;
    updatedParams.push(startDate);
  }

  if (endDate !== undefined && endDate !== '') {
    const paramIndex = updatedParams.length + 1;
    updatedQuery += ` AND e.start_date <= $${paramIndex}`;
    updatedParams.push(endDate);
  }

  if (search !== undefined && search !== '') {
    const paramIndex = updatedParams.length + 1;
    updatedQuery += ` AND (e.title LIKE $${paramIndex} OR e.description LIKE $${paramIndex + 1} OR e.location LIKE $${paramIndex + 2})`;
    const searchTerm = `%${search}%`;
    updatedParams.push(searchTerm, searchTerm, searchTerm);
  }

  return { query: updatedQuery, params: updatedParams };
}

/**
 * Apply access control for 'all' filter (privacy protection)
 */
function applyAllFilterAccess(
  query: string,
  params: unknown[],
  userDepartmentId: number | null | undefined,
  userId: number,
): { query: string; params: unknown[] } {
  const baseParamCount = params.length;
  const accessQuery =
    query +
    ` AND (
      e.org_level = 'company' OR
      (e.org_level = 'department' AND e.department_id = $${baseParamCount + 1}) OR
      (e.org_level = 'team' AND e.team_id IN (SELECT team_id FROM user_teams WHERE user_id = $${baseParamCount + 2})) OR
      (e.org_level = 'area' AND e.area_id = (SELECT area_id FROM departments WHERE id = $${baseParamCount + 3})) OR
      e.user_id = $${baseParamCount + 4} OR
      EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = $${baseParamCount + 5})
    )`;
  return {
    query: accessQuery,
    params: [...params, userDepartmentId, userId, userDepartmentId, userId, userId],
  };
}

/**
 * Apply access control for count queries (non-admin users)
 */
function applyCountQueryAccess(
  query: string,
  params: unknown[],
  userId: number,
): { query: string; params: unknown[] } {
  const baseParamCount = params.length;
  const accessQuery =
    query +
    ` AND (
      e.type IN ('meeting', 'training') OR
      e.user_id = $${baseParamCount + 1} OR
      EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = $${baseParamCount + 2})
    )`;
  return { query: accessQuery, params: [...params, userId, userId] };
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
  let result = { query, params: [...params] };

  if (options.filter !== 'all') {
    result = applyOrgLevelFilter(
      result.query,
      result.params,
      options.filter,
      options.userDepartmentId,
      options.userTeamId,
      options.userId,
    );
  }

  if (options.filter === 'all' && options.isCountQuery !== true) {
    result = applyAllFilterAccess(
      result.query,
      result.params,
      options.userDepartmentId,
      options.userId,
    );
  }

  if (options.isCountQuery === true && options.role !== 'admin' && options.role !== 'root') {
    result = applyCountQueryAccess(result.query, result.params, options.userId);
  }

  return applyDateAndSearchFilters(
    result.query,
    result.params,
    options.startDate,
    options.endDate,
    options.search,
  );
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
    WHERE e.tenant_id = $1 AND e.status = $2
  `;
  const countBaseParams: unknown[] = [tenantId, dbStatus];
  const { query: filteredCountQuery, params: countParams } = applyEventFilters(
    countQuery,
    countBaseParams,
    { ...options, isCountQuery: true },
  );
  const [countResult] = await executeQuery<CountResult[]>(filteredCountQuery, countParams);

  if (countResult[0] === undefined) {
    return 0;
  }

  return countResult[0].total;
}

/**
 * Check if user is team member
 */
async function hasTeamAccess(userId: number, teamId: number): Promise<boolean> {
  const [teamRows] = await executeQuery<RowDataPacket[]>(
    'SELECT 1 FROM user_teams WHERE user_id = $1 AND team_id = $2',
    [userId, teamId],
  );
  return teamRows.length > 0;
}

/**
 * Check if user has area access via department
 */
async function hasAreaAccess(userDepartmentId: number | null, areaId: number): Promise<boolean> {
  if (userDepartmentId === null) return false;

  const [areaRows] = await executeQuery<RowDataPacket[]>(
    'SELECT 1 FROM departments WHERE id = $1 AND area_id = $2',
    [userDepartmentId, areaId],
  );
  return areaRows.length > 0;
}

/**
 * Check if user is event attendee
 */
async function isEventAttendee(eventId: number, userId: number): Promise<boolean> {
  const [attendeeRows] = await executeQuery<RowDataPacket[]>(
    'SELECT 1 FROM calendar_attendees WHERE event_id = $1 AND user_id = $2',
    [eventId, userId],
  );
  return attendeeRows.length > 0;
}

/**
 * Check if event is public type
 */
function isPublicEventType(eventType: string | undefined): boolean {
  if (eventType === undefined) return false;
  return eventType === 'meeting' || eventType === 'training';
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
  if (role === 'admin' || role === 'root') return true;

  // Company events are visible to all employees
  if (event.org_level === 'company') return true;

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
  if (
    event.org_level === 'team' &&
    event.team_id != null &&
    (await hasTeamAccess(userId, event.team_id))
  ) {
    return true;
  }

  // Area events are visible to users in departments assigned to that area
  if (
    event.org_level === 'area' &&
    event.area_id != null &&
    (await hasAreaAccess(userInfo.departmentId, event.area_id))
  ) {
    return true;
  }

  // Creator has access
  if (event.user_id === userId) return true;

  // Public event types are visible to all
  if (isPublicEventType(event.type)) return true;

  // Check if user is attendee
  return await isEventAttendee(event.id, userId);
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
  org_level?: 'company' | 'department' | 'team' | 'area' | 'personal';
  department_id?: number | null;
  team_id?: number | null;
  area_id?: number | null;
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
    { condition: eventData.area_id !== undefined, field: 'area_id', value: eventData.area_id },
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
    org_level?: 'company' | 'department' | 'team' | 'area' | 'personal';
    department_id?: number | null;
    team_id?: number | null;
    area_id?: number | null;
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

  // PostgreSQL: Dynamic $N parameter numbering
  for (const { condition, field, value } of fieldMappings) {
    if (condition) {
      const paramIndex = queryParams.length + 1;
      query += `, ${field} = $${paramIndex}`;
      queryParams.push(value);
    }
  }

  const whereIdIndex = queryParams.length + 1;
  const whereTenantIndex = queryParams.length + 2;
  query += ` WHERE id = $${whereIdIndex} AND tenant_id = $${whereTenantIndex}`;
  queryParams.push(id, tenantId);

  return { query, params: queryParams };
}
