/**
 * Calendar CRUD Operations
 * Main business logic for calendar event management
 */
import { ResultSetHeader, RowDataPacket, query as executeQuery } from '../../utils/db';
import { logger } from '../../utils/logger';
import user from '../user';
import { addEventAttendee } from './calendar.attendees';
import { generateRecurringEvents } from './calendar.recurring';
import {
  DbCalendarEvent,
  EventCreateData,
  EventQueryOptions,
  EventUpdateData,
  EventsListResponse,
  UserInfo,
} from './calendar.types';
import {
  applyEventFilters,
  buildEventUpdateQuery,
  checkEventAccess,
  formatDateForMysql,
  getEventCount,
  processCalendarEvents,
} from './calendar.utils';

// Query result interfaces
interface UserIdResult extends RowDataPacket {
  user_id: number;
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
    const finalQuery = filteredQuery + ` ORDER BY e.${sortBy} ${sortDir} LIMIT ? OFFSET ?`;
    const offset = (page - 1) * limit;
    queryParams.push(Number.parseInt(limit.toString(), 10), offset);

    // Execute query
    const [events] = await executeQuery<DbCalendarEvent[]>(finalQuery, queryParams);
    processCalendarEvents(events);

    // Get total count for pagination
    const totalEvents = await getEventCount(tenantId, dbStatus, {
      filter,
      userDepartmentId,
      userTeamId,
      userId,
      role,
      startDate,
      endDate,
      search,
    });

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
      // Use Dependency Injection to pass createEvent function
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
      'SELECT user_id FROM calendar_events WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (eventRows.length === 0) {
      return null;
    }

    return await getEventById(id, tenantId, eventRows[0].user_id);
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
    queryParams.push(Number.parseInt(resolvedLimit.toString(), 10));

    const [events] = await executeQuery<DbCalendarEvent[]>(query, queryParams);

    // Map database fields to API fields
    events.forEach((event: DbCalendarEvent) => {
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
