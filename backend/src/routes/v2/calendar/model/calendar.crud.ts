/**
 * Calendar CRUD Operations
 * Main business logic for calendar event management
 */
import { v7 as uuidv7 } from 'uuid';

import { ResultSetHeader, RowDataPacket, query as executeQuery } from '../../../../utils/db.js';
import { logger } from '../../../../utils/logger.js';
import user from '../../users/model/index.js';
import { addEventAttendee } from './calendar.attendees.js';
import { generateRecurringEvents } from './calendar.recurring.js';
import {
  DbCalendarEvent,
  EventCreateData,
  EventQueryOptions,
  EventUpdateData,
  EventsListResponse,
  UserInfo,
} from './calendar.types.js';
import {
  applyEventFilters,
  buildEventUpdateQuery,
  checkEventAccess,
  formatDateForMysql,
  getEventCount,
  processCalendarEvents,
} from './calendar.utils.js';

// Query result interfaces
interface UserIdResult extends RowDataPacket {
  user_id: number;
}

/** Filter options for event queries */
interface EventFilterOptions {
  filter: string;
  userDepartmentId?: number | null;
  userTeamId?: number | null;
  userId: number;
  role?: string | null;
  startDate?: string;
  endDate?: string;
  search?: string;
  isCountQuery?: boolean;
}

/** Build filter options from query options */
function buildFilterOptions(
  filter: string,
  userId: number,
  role: string | null,
  opts: {
    userDepartmentId?: number | null | undefined;
    userTeamId?: number | null | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    search?: string | undefined;
  },
  isCountQuery: boolean = false,
): EventFilterOptions {
  const result: EventFilterOptions = { filter, userId };
  if (!isCountQuery) result.isCountQuery = false;
  if (opts.userDepartmentId !== undefined) result.userDepartmentId = opts.userDepartmentId;
  if (opts.userTeamId !== undefined) result.userTeamId = opts.userTeamId;
  if (role !== null) result.role = role;
  if (opts.startDate !== undefined) result.startDate = opts.startDate;
  if (opts.endDate !== undefined) result.endDate = opts.endDate;
  if (opts.search !== undefined && opts.search !== '') result.search = opts.search;
  return result;
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

    const dbStatus = status === 'active' ? 'confirmed' : status;
    const { role } = await user.getUserDepartmentAndTeam(userId);
    const filterOpts = { userDepartmentId, userTeamId, startDate, endDate, search };

    // Build base query
    const baseQuery = `
        SELECT e.*, u.username as creator_name
        FROM calendar_events e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.tenant_id = $1 AND e.status = $2
      `;

    // Apply filters and execute query
    const filterOptions = buildFilterOptions(filter, userId, role, filterOpts, false);
    const { query: filteredQuery, params: queryParams } = applyEventFilters(
      baseQuery,
      [tenantId, dbStatus],
      filterOptions,
    );

    // Apply sorting and pagination
    const offset = (page - 1) * limit;
    const paramIndexLimit = queryParams.length + 1;
    const paramIndexOffset = queryParams.length + 2;
    const finalQuery =
      filteredQuery +
      ` ORDER BY e.${sortBy} ${sortDir} LIMIT $${paramIndexLimit} OFFSET $${paramIndexOffset}`;
    queryParams.push(Number.parseInt(limit.toString(), 10), offset);

    // Execute query
    const [events] = await executeQuery<DbCalendarEvent[]>(finalQuery, queryParams);
    processCalendarEvents(events);

    // Get total count for pagination
    const countOptions = buildFilterOptions(filter, userId, role, filterOpts, true);
    const totalEvents = await getEventCount(tenantId, dbStatus, countOptions);

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
      'SELECT 1 FROM calendar_events WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return rows.length > 0;
  } catch (error: unknown) {
    logger.error('Error in checkEventExists:', error);
    return false;
  }
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

    // Query the event
    const query = `
        SELECT e.*,
               u.username as creator_name
        FROM calendar_events e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.id = $1 AND e.tenant_id = $2
      `;

    const [events] = await executeQuery<DbCalendarEvent[]>(query, [id, tenantId]);

    if (events.length === 0) {
      return null;
    }

    const event = events[0];
    if (event === undefined) {
      return null;
    }

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

/** Build insert parameters for new event */
function buildEventInsertParams(eventData: EventCreateData, eventUuid: string): unknown[] {
  return [
    eventUuid,
    eventData.tenant_id,
    eventData.created_by, // user_id
    eventData.title,
    eventData.description ?? null,
    eventData.location ?? null,
    formatDateForMysql(eventData.start_time),
    formatDateForMysql(eventData.end_time),
    eventData.all_day === true ? 1 : 0,
    eventData.org_level,
    eventData.department_id ?? null,
    eventData.team_id ?? null,
    eventData.created_by_role ?? 'user',
    eventData.allow_attendees === true ? 1 : 0,
    'other', // type
    'confirmed', // status
    0, // is_private
    eventData.reminder_time ?? null,
    eventData.color ?? '#3498db',
    eventData.recurrence_rule ?? null,
    eventData.parent_event_id ?? null,
  ];
}

// POSTGRESQL: RETURNING id required to get insertId
const INSERT_EVENT_QUERY = `
  INSERT INTO calendar_events
  (uuid, tenant_id, user_id, title, description, location, start_date, end_date, all_day,
   org_level, department_id, team_id, created_by_role, allow_attendees,
   type, status, is_private, reminder_minutes, color, recurrence_rule, parent_event_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
  RETURNING id
`;

/**
 * Create a new calendar event
 */
export async function createEvent(eventData: EventCreateData): Promise<DbCalendarEvent | null> {
  try {
    const {
      tenant_id: tenantId,
      title,
      created_by: createdBy,
      start_time: startTime,
      end_time: endTime,
      recurrence_rule: recurrenceRule,
      parent_event_id: parentEventId,
    } = eventData;

    // Validate required fields
    if (tenantId === 0 || title === '' || createdBy === 0) {
      throw new Error('Missing required fields');
    }
    if (new Date(startTime) > new Date(endTime)) {
      throw new Error('Start time must be before end time');
    }

    // Generate UUIDv7 and insert event
    const eventUuid = uuidv7();
    // PostgreSQL: Use RETURNING id - result is array of rows, not ResultSetHeader
    const [result] = await executeQuery<RowDataPacket[]>(
      INSERT_EVENT_QUERY,
      buildEventInsertParams(eventData, eventUuid),
    );
    const eventId = (result[0] as { id: number }).id;

    // Get the created event and add creator as attendee
    const createdEvent = await getEventById(eventId, tenantId, createdBy);
    if (createdEvent) {
      await addEventAttendee(createdEvent.id, createdBy);
      // Generate recurring events if applicable
      if (recurrenceRule != null && recurrenceRule !== '' && parentEventId == null) {
        await generateRecurringEvents(createdEvent, recurrenceRule, createEvent);
      }
    }
    return createdEvent;
  } catch (error: unknown) {
    logger.error('Error in createEvent:', error);
    throw error;
  }
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
    const [eventRows] = await executeQuery<UserIdResult[]>(
      'SELECT user_id FROM calendar_events WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    if (eventRows.length === 0) {
      return null;
    }

    const eventRow = eventRows[0];
    if (eventRow === undefined) {
      return null;
    }

    return await getEventById(id, tenantId, eventRow.user_id);
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
    const query = 'DELETE FROM calendar_events WHERE id = $1 AND tenant_id = $2';
    const [result] = await executeQuery<ResultSetHeader>(query, [id, tenantId]);

    return result.affectedRows > 0;
  } catch (error: unknown) {
    logger.error('Error in deleteEvent:', error);
    throw error;
  }
}

/**
 * Get upcoming events for a user's dashboard
 */
export async function getDashboardEvents(
  tenantId: number,
  userId: number,
  days?: number,
  limit?: number,
): Promise<DbCalendarEvent[]> {
  try {
    const resolvedDays = days ?? 7;
    const resolvedLimit = limit ?? 5;

    // Get user info for access control
    const {
      role,
      departmentId: userDepartmentId,
      teamId: userTeamId,
    } = await user.getUserDepartmentAndTeam(userId);

    // Calculate date range
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + resolvedDays);

    // Format dates for MySQL
    const todayStr = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Build query for dashboard events
    let query = `
        SELECT e.*,
               u.username as creator_name
        FROM calendar_events e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.tenant_id = $1 AND e.status = 'confirmed'
        AND e.start_date >= $2 AND e.start_date <= $3
      `;

    const queryParams: unknown[] = [tenantId, todayStr, endDateStr];

    // Apply access control for non-admin users (dashboard shows all accessible events)
    if (role !== 'admin' && role !== 'root') {
      query += ` AND (
          e.org_level = 'company' OR
          (e.org_level = 'department' AND e.department_id = $4) OR
          (e.org_level = 'team' AND e.team_id = $5) OR
          e.user_id = $6 OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = $7)
        )`;
      queryParams.push(userDepartmentId, userTeamId, userId, userId);
    }

    // Sort by start time, limited to the next few events
    // PostgreSQL uses $n placeholders - calculate next index dynamically
    const limitParamIndex = queryParams.length + 1;
    query += `
        ORDER BY e.start_date ASC
        LIMIT $${limitParamIndex}
      `;
    queryParams.push(Number.parseInt(resolvedLimit.toString(), 10));

    const [events] = await executeQuery<DbCalendarEvent[]>(query, queryParams);
    processCalendarEvents(events);
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
      'SELECT * FROM calendar_events WHERE id = $1',
      [eventId],
    );

    if (events.length === 0) {
      return false;
    }

    const event = events[0];
    if (event === undefined) {
      return false;
    }

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
