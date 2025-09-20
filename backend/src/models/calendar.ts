/**
 * Calendar Model
 * Handles database operations for the calendar events and attendees
 */
import { ResultSetHeader, RowDataPacket, query as executeQuery } from '../utils/db';
import { logger } from '../utils/logger';
import user from './user';

/**
 * Format datetime strings for MySQL (remove 'Z' and convert to local format)
 */
function formatDateForMysql(dateString: string | Date | null): string | null {
  if (dateString == null || dateString === '') return null;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Database interfaces
interface DbCalendarEvent extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  title: string;
  description?: string | Buffer | { type: 'Buffer'; data: number[] };
  location?: string;
  start_date: Date;
  end_date: Date;
  all_day: boolean | number;
  type?: 'meeting' | 'training' | 'vacation' | 'sick_leave' | 'other';
  status?: 'tentative' | 'confirmed' | 'cancelled';
  is_private?: boolean | number;
  reminder_minutes?: number | null;
  color?: string;
  recurrence_rule?: string | null;
  parent_event_id?: number | null;
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  creator_name?: string;
  user_response?: string | null;
  // Aliases for API compatibility
  start_time?: Date;
  end_time?: Date;
  org_level?: 'company' | 'department' | 'team' | 'personal';
  department_id?: number | null;
  team_id?: number | null;
  created_by?: number;
  created_by_role?: 'admin' | 'lead' | 'user';
  allow_attendees?: boolean | number;
  reminder_time?: number | null;
}

interface DbEventAttendee extends RowDataPacket {
  user_id: number;
  response_status: 'pending' | 'accepted' | 'declined' | 'tentative';
  responded_at?: Date;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_picture?: string;
}

interface EventQueryOptions {
  status?: 'active' | 'cancelled';
  filter?: 'all' | 'company' | 'department' | 'team' | 'personal';
  search?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  userDepartmentId?: number | null;
  userTeamId?: number | null;
}

interface EventCreateData {
  tenant_id: number;
  title: string;
  description?: string;
  location?: string;
  start_time: string | Date;
  end_time: string | Date;
  all_day?: boolean;
  org_level: 'company' | 'department' | 'team' | 'personal';
  department_id?: number | null;
  team_id?: number | null;
  created_by: number;
  created_by_role?: string;
  allow_attendees?: boolean;
  reminder_time?: number | null;
  color?: string;
  recurrence_rule?: string | null;
  parent_event_id?: number | null;
  requires_response?: boolean;
}

interface EventUpdateData {
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
}

interface CountResult extends RowDataPacket {
  total: number;
}

interface UserInfo {
  role: string | null;
  departmentId: number | null;
  teamId: number | null;
}

export interface EventsListResponse {
  events: DbCalendarEvent[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Apply org level and access filters to query
 */
function applyEventFilters(
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
  const updatedParams = [...params];

  // Apply org level filter based on new structure
  if (options.filter !== 'all') {
    switch (options.filter) {
      case 'company':
        updatedQuery += " AND e.org_level = 'company'";
        break;
      case 'department':
        updatedQuery += " AND e.org_level = 'department' AND e.department_id = ?";
        updatedParams.push(options.userDepartmentId);
        break;
      case 'team':
        updatedQuery += " AND e.org_level = 'team' AND e.team_id = ?";
        updatedParams.push(options.userTeamId);
        break;
      case 'personal':
        updatedQuery +=
          " AND (e.org_level = 'personal' AND (e.user_id = ? OR EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)))";
        updatedParams.push(options.userId, options.userId);
        break;
    }
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

  // Apply date range filter
  if (options.startDate !== undefined && options.startDate !== '') {
    updatedQuery += ' AND e.end_date >= ?';
    updatedParams.push(options.startDate);
  }

  if (options.endDate !== undefined && options.endDate !== '') {
    updatedQuery += ' AND e.start_date <= ?';
    updatedParams.push(options.endDate);
  }

  // Apply search filter
  if (options.search !== undefined && options.search !== '') {
    updatedQuery += ' AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)';
    const searchTerm = `%${options.search}%`;
    updatedParams.push(searchTerm, searchTerm, searchTerm);
  }

  return { query: updatedQuery, params: updatedParams };
}

/**
 * Process calendar events to map fields and convert buffers
 */
function processCalendarEvents(events: DbCalendarEvent[]): void {
  events.forEach((event) => {
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
 * Get all calendar events visible to the user
 */
export async function getAllEvents(
  tenantId: number,
  userId: number,
  options: EventQueryOptions = {},
): Promise<EventsListResponse> {
  try {
    const {
      status = 'active',
      filter = 'all',
      search = '',
      start_date: startDate,
      end_date: endDate,
      page = 1,
      limit = 50,
      sortBy = 'start_date',
      sortDir = 'ASC',
      userDepartmentId,
      userTeamId,
    } = options;

    // Map status from API to database
    const dbStatus = status === 'active' ? 'confirmed' : status;

    // Determine user's role for access control
    const { role } = await user.getUserDepartmentAndTeam(userId);

    // Build base query
    const baseQuery = `
        SELECT e.*,
               u.username as creator_name,
               CASE WHEN a.id IS NOT NULL THEN a.response_status ELSE NULL END as user_response
        FROM calendar_events e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN calendar_attendees a ON e.id = a.event_id AND a.user_id = ?
        WHERE e.tenant_id = ? AND e.status = ?
      `;

    const baseParams: unknown[] = [userId, tenantId, dbStatus];

    // Apply filters
    const { query: filteredQuery, params: queryParams } = applyEventFilters(baseQuery, baseParams, {
      filter,
      userDepartmentId,
      userTeamId,
      userId,
      role,
      startDate,
      endDate,
      search,
      isCountQuery: false,
    });

    // Apply sorting and pagination
    const finalQuery = filteredQuery + ` ORDER BY e.${sortBy} ${sortDir}` + ' LIMIT ? OFFSET ?';
    const offset = (page - 1) * limit;
    queryParams.push(Number.parseInt(limit.toString(), 10), offset);

    // Execute query
    const [events] = await executeQuery<DbCalendarEvent[]>(finalQuery, queryParams);

    // Process events
    processCalendarEvents(events);

    // Count total events for pagination
    const countQuery = `
        SELECT COUNT(*) as total
        FROM calendar_events e
        WHERE e.tenant_id = ? AND e.status = ?
      `;

    const countBaseParams: unknown[] = [tenantId, dbStatus];

    const { query: filteredCountQuery, params: countParams } = applyEventFilters(
      countQuery,
      countBaseParams,
      {
        filter,
        userDepartmentId,
        userTeamId,
        userId,
        role,
        startDate,
        endDate,
        search,
        isCountQuery: true,
      },
    );

    const [countResult] = await executeQuery<CountResult[]>(filteredCountQuery, countParams);
    const totalEvents = countResult[0].total;

    return {
      events,
      pagination: {
        total: totalEvents,
        page: Number.parseInt(page.toString(), 10),
        limit: Number.parseInt(limit.toString(), 10),
        totalPages: Math.ceil(totalEvents / limit),
      },
    };
  } catch (error: unknown) {
    logger.error('Error in getAllEvents:', error);
    throw error;
  }
}

/**
 * Check if a calendar event exists (without permission check)
 */
export async function checkEventExists(id: number, tenantId: number): Promise<boolean> {
  try {
    const [rows] = await executeQuery<RowDataPacket[]>(
      'SELECT 1 FROM calendar_events WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    return rows.length > 0;
  } catch (error: unknown) {
    logger.error('Error in checkEventExists:', error);
    return false;
  }
}

/**
 * Check if user has access to a specific event
 */
async function checkEventAccess(
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
 * Get a specific calendar event by ID
 */
export async function getEventById(
  id: number,
  tenantId: number,
  userId: number,
): Promise<DbCalendarEvent | null> {
  try {
    // Determine user's role for access control
    const { role } = await user.getUserDepartmentAndTeam(userId);

    // Query the event with user response status
    const query = `
        SELECT e.*,
               u.username as creator_name,
               CASE WHEN a.id IS NOT NULL THEN a.response_status ELSE NULL END as user_response
        FROM calendar_events e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN calendar_attendees a ON e.id = a.event_id AND a.user_id = ?
        WHERE e.id = ? AND e.tenant_id = ?
      `;

    const [events] = await executeQuery<DbCalendarEvent[]>(query, [userId, id, tenantId]);

    if (events.length === 0) {
      return null;
    }

    const event = events[0];

    // Process event fields
    processCalendarEvents([event]);

    // Check access control
    const hasAccess = await checkEventAccess(event, userId, role);

    return hasAccess ? event : null;
  } catch (error: unknown) {
    logger.error('Error in getEventById:', error);
    throw error;
  }
}

/**
 * Create a new calendar event
 */
export async function createEvent(eventData: EventCreateData): Promise<DbCalendarEvent | null> {
  try {
    const {
      tenant_id: tenantId,
      title,
      description,
      location,
      start_time: startTime,
      end_time: endTime,
      all_day: allDay,
      org_level: orgLevel,
      department_id: departmentId,
      team_id: teamId,
      created_by: createdBy,
      created_by_role: createdByRole,
      allow_attendees: allowAttendees,
      reminder_time: reminderTime,
      color,
      recurrence_rule: recurrenceRule,
      parent_event_id: parentEventId,
    } = eventData;

    // Validate required fields
    if (tenantId === 0 || title === '' || createdBy === 0) {
      throw new Error('Missing required fields');
    }

    // Ensure dates are valid
    if (new Date(startTime) > new Date(endTime)) {
      throw new Error('Start time must be before end time');
    }

    // Insert new event
    const query = `
        INSERT INTO calendar_events
        (tenant_id, user_id, title, description, location, start_date, end_date, all_day,
         org_level, department_id, team_id, created_by_role, allow_attendees, requires_response,
         type, status, is_private, reminder_minutes, color, recurrence_rule, parent_event_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    const [result] = await executeQuery<ResultSetHeader>(query, [
      tenantId,
      createdBy, // user_id
      title,
      description ?? null,
      location ?? null,
      formatDateForMysql(startTime),
      formatDateForMysql(endTime),
      allDay === true ? 1 : 0,
      orgLevel,
      departmentId ?? null,
      teamId ?? null,
      createdByRole ?? 'user',
      allowAttendees === true ? 1 : 0,
      eventData.requires_response === true ? 1 : 0, // requires_response
      'other', // type
      'confirmed', // status
      0, // is_private
      reminderTime ?? null,
      color ?? '#3498db',
      recurrenceRule ?? null,
      parentEventId ?? null,
    ]);

    // Get the created event
    const createdEvent = await getEventById(result.insertId, tenantId, createdBy);

    // Add the creator as an attendee with 'accepted' status
    if (createdEvent) {
      await addEventAttendee(createdEvent.id, createdBy, 'accepted');

      // If this is a recurring event, generate future occurrences
      if (recurrenceRule != null && recurrenceRule !== '' && parentEventId == null) {
        await generateRecurringEvents(createdEvent, recurrenceRule);
      }
    }

    return createdEvent;
  } catch (error: unknown) {
    logger.error('Error in createEvent:', error);
    throw error;
  }
}

/**
 * Build update query for calendar event
 */
function buildEventUpdateQuery(
  eventData: EventUpdateData,
  id: number,
  tenantId: number,
): { query: string; params: unknown[] } {
  const fieldMappings: {
    condition: boolean;
    field: string;
    value: unknown;
  }[] = [
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
      value:
        eventData.all_day !== undefined ?
          eventData.all_day ?
            1
          : 0
        : undefined,
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
    {
      condition: eventData.team_id !== undefined,
      field: 'team_id',
      value: eventData.team_id,
    },
    { condition: eventData.status !== undefined, field: 'status', value: eventData.status },
    {
      condition: eventData.reminder_time !== undefined,
      field: 'reminder_minutes',
      value:
        eventData.reminder_time === '' || eventData.reminder_time === null ? null
        : eventData.reminder_time !== undefined ?
          Number.parseInt(eventData.reminder_time.toString())
        : undefined,
    },
    { condition: eventData.color !== undefined, field: 'color', value: eventData.color },
  ];

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

/**
 * Update a calendar event
 */
export async function updateEvent(
  id: number,
  eventData: EventUpdateData,
  tenantId: number,
): Promise<DbCalendarEvent | null> {
  try {
    // Build update query
    const { query, params: queryParams } = buildEventUpdateQuery(eventData, id, tenantId);

    // Execute update
    await executeQuery(query, queryParams);

    // Get the updated event - we need to get the current user_id first
    const [eventRows] = await executeQuery<RowDataPacket[]>(
      'SELECT user_id FROM calendar_events WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (eventRows.length === 0) {
      return null;
    }

    return await getEventById(id, tenantId, eventRows[0].user_id as number);
  } catch (error: unknown) {
    logger.error('Error in updateEvent:', error);
    throw error;
  }
}

/**
 * Delete a calendar event
 */
export async function deleteEvent(id: number, tenantId: number): Promise<boolean> {
  try {
    // Delete event
    const query = 'DELETE FROM calendar_events WHERE id = ? AND tenant_id = ?';
    const [result] = await executeQuery<ResultSetHeader>(query, [id, tenantId]);

    return result.affectedRows > 0;
  } catch (error: unknown) {
    logger.error('Error in deleteEvent:', error);
    throw error;
  }
}

/**
 * Add an attendee to a calendar event
 */
export async function addEventAttendee(
  eventId: number,
  userId: number,
  responseStatus: 'pending' | 'accepted' | 'declined' | 'tentative' = 'pending',
  tenantIdParam?: number,
): Promise<boolean> {
  try {
    // Check if already an attendee
    const [attendees] = await executeQuery<RowDataPacket[]>(
      'SELECT * FROM calendar_attendees WHERE event_id = ? AND user_id = ?',
      [eventId, userId],
    );

    if (attendees.length > 0) {
      // Update existing attendee status
      await executeQuery(
        'UPDATE calendar_attendees SET response_status = ?, responded_at = NOW() WHERE event_id = ? AND user_id = ?',
        [responseStatus, eventId, userId],
      );
    } else {
      // Get tenant_id from event if not provided
      let finalTenantId = tenantIdParam;
      if (finalTenantId == null || finalTenantId === 0) {
        const [event] = await executeQuery<DbCalendarEvent[]>(
          'SELECT tenant_id FROM calendar_events WHERE id = ?',
          [eventId],
        );
        if (event.length > 0) {
          finalTenantId = event[0].tenant_id;
        }
      }

      // Add new attendee with tenant_id
      await executeQuery(
        'INSERT INTO calendar_attendees (event_id, user_id, response_status, responded_at, tenant_id) VALUES (?, ?, ?, NOW(), ?)',
        [eventId, userId, responseStatus, finalTenantId],
      );
    }

    return true;
  } catch (error: unknown) {
    logger.error('Error in addEventAttendee:', error);
    throw error;
  }
}

/**
 * Remove an attendee from a calendar event
 */
export async function removeEventAttendee(eventId: number, userId: number): Promise<boolean> {
  try {
    // Remove attendee
    const query = 'DELETE FROM calendar_attendees WHERE event_id = ? AND user_id = ?';
    const [result] = await executeQuery<ResultSetHeader>(query, [eventId, userId]);

    return result.affectedRows > 0;
  } catch (error: unknown) {
    logger.error('Error in removeEventAttendee:', error);
    throw error;
  }
}

/**
 * user responds to a calendar event
 */
export async function respondToEvent(
  eventId: number,
  userId: number,
  response: string,
): Promise<boolean> {
  try {
    // Validate response
    const validResponses = ['accepted', 'declined', 'tentative'];
    if (!validResponses.includes(response)) {
      throw new Error('Invalid response status');
    }

    // Update response
    return await addEventAttendee(
      eventId,
      userId,
      response as 'accepted' | 'declined' | 'tentative',
    );
  } catch (error: unknown) {
    logger.error('Error in respondToEvent:', error);
    throw error;
  }
}

/**
 * Get attendees for a calendar event
 */
export async function getEventAttendees(
  eventId: number,
  tenantId: number,
): Promise<DbEventAttendee[]> {
  try {
    const query = `
        SELECT a.user_id, a.response_status, a.responded_at,
               u.username, u.first_name, u.last_name, u.email, u.profile_picture
        FROM calendar_attendees a
        JOIN users u ON a.user_id = u.id
        JOIN calendar_events e ON a.event_id = e.id
        WHERE a.event_id = ? AND e.tenant_id = ?
        ORDER BY u.first_name, u.last_name
      `;

    const [attendees] = await executeQuery<DbEventAttendee[]>(query, [eventId, tenantId]);
    return attendees;
  } catch (error: unknown) {
    logger.error('Error in getEventAttendees:', error);
    throw error;
  }
}

/**
 * Get upcoming events for a user's dashboard
 */
export async function getDashboardEvents(
  tenantId: number,
  userId: number,
  days = 7,
  limit = 5,
): Promise<DbCalendarEvent[]> {
  try {
    // Get user info for access control
    const {
      role,
      departmentId: userDepartmentId,
      teamId: userTeamId,
    } = await user.getUserDepartmentAndTeam(userId);

    // Calculate date range
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + days);

    // Format dates for MySQL
    const todayStr = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Build query for dashboard events
    let query = `
        SELECT e.*,
               u.username as creator_name,
               CASE WHEN a.id IS NOT NULL THEN a.response_status ELSE NULL END as user_response
        FROM calendar_events e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN calendar_attendees a ON e.id = a.event_id AND a.user_id = ?
        WHERE e.tenant_id = ? AND e.status = 'confirmed'
        AND e.start_date >= ? AND e.start_date <= ?
      `;

    const queryParams: unknown[] = [userId, tenantId, todayStr, endDateStr];

    // Apply access control for non-admin users (dashboard shows all accessible events)
    if (role !== 'admin' && role !== 'root') {
      query += ` AND (
          e.org_level = 'company' OR
          (e.org_level = 'department' AND e.department_id = ?) OR
          (e.org_level = 'team' AND e.team_id = ?) OR
          e.user_id = ? OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
        )`;
      queryParams.push(userDepartmentId, userTeamId, userId, userId);
    }

    // Sort by start time, limited to the next few events
    query += `
        ORDER BY e.start_date ASC
        LIMIT ?
      `;
    queryParams.push(Number.parseInt(limit.toString(), 10));

    const [events] = await executeQuery<DbCalendarEvent[]>(query, queryParams);

    // Map database fields to API fields
    events.forEach((event) => {
      // Map database column names to API property names
      event.start_time = event.start_date;
      event.end_time = event.end_date;
      event.reminder_time = event.reminder_minutes;
      event.created_by = event.user_id;

      // org_level and org_id are now stored directly in the database
      // No need to map them based on type

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

    return events;
  } catch (error: unknown) {
    logger.error('Error in getDashboardEvents:', error);
    throw error;
  }
}

/**
 * Check if a user can manage an event
 */
export async function canManageEvent(
  eventId: number,
  userId: number,
  userInfo: UserInfo | null = null,
): Promise<boolean> {
  try {
    // Get event details
    const [events] = await executeQuery<DbCalendarEvent[]>(
      'SELECT * FROM calendar_events WHERE id = ?',
      [eventId],
    );

    if (events.length === 0) {
      return false;
    }

    const event = events[0];

    // Get user info if not provided
    const userRole = userInfo ? userInfo.role : null;

    // Get user role
    let role: string | null;

    if (userRole !== null && userRole !== '') {
      role = userRole;
    } else {
      // Otherwise get it from the database
      const userDetails = await user.getUserDepartmentAndTeam(userId);
      role = userDetails.role;
    }

    // Admins can manage all events or event creator can manage their events
    return role === 'admin' || role === 'root' || event.user_id === userId;
  } catch (error: unknown) {
    logger.error('Error in canManageEvent:', error);
    throw error;
  }
}

/**
 * Parse recurrence rule options
 */
function parseRecurrenceOptions(options: string[]): { count: number; until: Date | null } {
  let count = 52; // Default to 1 year of weekly events
  let until: Date | null = null;

  for (const option of options) {
    if (option.startsWith('COUNT=')) {
      count = Number.parseInt(option.substring(6), 10);
    } else if (option.startsWith('UNTIL=')) {
      until = new Date(option.substring(6));
    }
  }

  return { count, until };
}

/**
 * Get interval days for recurrence pattern
 */
function getIntervalDays(pattern: string): number {
  switch (pattern) {
    case 'daily':
      return 1;
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'monthly':
      return 30; // Approximate
    case 'yearly':
      return 365;
    case 'weekdays':
      return 1; // Special handling needed
    default:
      return 1;
  }
}

/**
 * Skip weekends if pattern is weekdays
 */
function skipWeekends(date: Date): void {
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
}

/**
 * Convert event description to string
 */
function convertDescription(description: unknown): string {
  if (typeof description === 'string') {
    return description;
  }
  if (description == null) {
    return '';
  }
  if (Buffer.isBuffer(description)) {
    return description.toString('utf8');
  }
  return '';
}

/**
 * Move date to next occurrence based on pattern
 */
function moveToNextOccurrence(date: Date, pattern: string, intervalDays: number): void {
  if (pattern === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (pattern === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setDate(date.getDate() + intervalDays);
  }
}

/**
 * Create child event data from parent
 */
function createChildEventData(
  parentEvent: DbCalendarEvent,
  newStartDate: Date,
  newEndDate: Date,
): EventCreateData {
  return {
    tenant_id: parentEvent.tenant_id,
    title: parentEvent.title,
    description: convertDescription(parentEvent.description),
    location: parentEvent.location,
    start_time: newStartDate.toISOString(),
    end_time: newEndDate.toISOString(),
    all_day: Boolean(parentEvent.all_day),
    org_level: parentEvent.org_level ?? 'personal',
    department_id: parentEvent.department_id ?? null,
    team_id: parentEvent.team_id ?? null,
    created_by: parentEvent.created_by ?? parentEvent.user_id,
    reminder_time: parentEvent.reminder_time,
    color: parentEvent.color,
    parent_event_id: parentEvent.id,
  };
}

/**
 * Generate recurring events based on recurrence rule
 */

export async function generateRecurringEvents(
  parentEvent: DbCalendarEvent,
  recurrenceRule: string,
): Promise<void> {
  try {
    // Parse recurrence rule
    const [pattern, ...options] = recurrenceRule.split(';');
    const { count, until } = parseRecurrenceOptions(options);
    const intervalDays = getIntervalDays(pattern);

    // Generate occurrences
    const startDate = new Date(parentEvent.start_time ?? parentEvent.start_date);
    const endDate = new Date(parentEvent.end_time ?? parentEvent.end_date);
    const duration = endDate.getTime() - startDate.getTime();

    let currentDate = new Date(startDate);
    let occurrences = 0;

    while (occurrences < count && (!until || currentDate <= until)) {
      // Skip first occurrence (parent event)
      if (occurrences > 0) {
        // Skip weekends for weekdays pattern
        if (pattern === 'weekdays') {
          skipWeekends(currentDate);
        }

        const newStartDate = new Date(currentDate);
        const newEndDate = new Date(currentDate.getTime() + duration);

        // Create child event
        const childEventData = createChildEventData(parentEvent, newStartDate, newEndDate);
        await createEvent(childEventData);
      }

      // Move to next occurrence
      moveToNextOccurrence(currentDate, pattern, intervalDays);
      occurrences++;
    }
  } catch (error: unknown) {
    logger.error('Error generating recurring events:', error);
    throw error;
  }
}

// Backward compatibility object
const Calendar = {
  getAllEvents,
  getEventById,
  checkEventExists,
  createEvent,
  updateEvent,
  deleteEvent,
  addEventAttendee,
  removeEventAttendee,
  respondToEvent,
  getEventAttendees,
  getDashboardEvents,
  canManageEvent,
  generateRecurringEvents,
};

// Type exports
export type {
  DbCalendarEvent,
  DbCalendarEvent as CalendarEvent,
  DbEventAttendee,
  DbEventAttendee as EventAttendee,
  EventQueryOptions,
  EventCreateData,
  EventUpdateData,
};

// Default export
export default Calendar;
