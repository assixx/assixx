/**
 * Calendar v2 Service Layer
 * Handles all business logic for calendar events
 */
import CalendarModel from '../../../models/calendar.js';
import type {
  CalendarEvent,
  DbCalendarEvent,
  EventAttendee,
  EventCreateData,
  EventUpdateData,
} from '../../../models/calendar.js';
import { dbToApiEvent } from '../../../utils/fieldMapping.js';
import { ServiceError } from '../users/users.service.js';

export interface CalendarFilters {
  status?: 'active' | 'cancelled';
  filter?: 'all' | 'company' | 'department' | 'team' | 'personal';
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface CalendarEventData {
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  orgLevel: 'company' | 'department' | 'team' | 'personal';
  departmentId?: number; // Explizit für department/team Events
  teamId?: number; // Explizit für team Events
  reminderMinutes?: number;
  color?: string;
  recurrenceRule?: string;
  attendeeIds?: number[];
  requiresResponse?: boolean;
}

export interface CalendarEventUpdateData {
  title?: string;
  description?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  orgLevel?: 'company' | 'department' | 'team' | 'personal';
  departmentId?: number;
  teamId?: number;
  reminderMinutes?: number | null;
  color?: string;
  recurrenceRule?: string | null;
  status?: 'tentative' | 'confirmed' | 'cancelled';
}

/**
 *
 */
export class CalendarService {
  /**
   * Get paginated list of calendar events with filter optimization
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userDepartmentId - The userDepartmentId parameter
   * @param userTeamId - The userTeamId parameter
   * @param filters - The filter criteria
   */
  async listEvents(
    tenantId: number,
    userId: number,
    userDepartmentId: number | null,
    userTeamId: number | null,
    filters: CalendarFilters,
  ) {
    const page = Math.max(1, Number.parseInt(filters.page ?? '1', 10));
    // Performance-Limit: max 200 Events
    const limit = Math.min(200, Math.max(1, Number.parseInt(filters.limit ?? '50', 10)));
    // offset is calculated in the model

    // Map API field names to DB field names
    const sortByMap: Record<string, string> = {
      startDate: 'start_date',
      endDate: 'end_date',
      title: 'title',
      createdAt: 'created_at',
    };

    const sortBy = sortByMap[filters.sortBy ?? 'startDate'] ?? 'start_date';
    const sortDir: 'ASC' | 'DESC' = filters.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const queryOptions = {
      status: filters.status,
      filter: filters.filter,
      search: filters.search,
      start_date: filters.startDate,
      end_date: filters.endDate,
      page,
      limit,
      sortBy,
      sortDir,
      userDepartmentId,
      userTeamId,
    };

    try {
      const result = (await CalendarModel.getAllEvents(
        tenantId,
        userId,
        queryOptions,
      )) as unknown as {
        events: CalendarEvent[];
        pagination: { total: number };
      };

      // Map events to API format
      const events = result.events.map((event: CalendarEvent) => dbToApiEvent(event));

      const totalPages = Math.ceil(result.pagination.total / limit);

      return {
        data: events,
        pagination: {
          currentPage: page,
          totalPages,
          pageSize: limit,
          totalItems: result.pagination.total,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch {
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve calendar events', 500);
    }
  }

  /**
   * Get single event by ID
   * @param eventId - The eventId parameter
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param _userDepartmentId - The _userDepartmentId parameter
   */
  async getEventById(
    eventId: number,
    tenantId: number,
    userId: number,
    _userDepartmentId?: number | null,
  ) {
    try {
      const event = await CalendarModel.getEventById(eventId, tenantId, userId);
      if (!event) {
        throw new ServiceError('NOT_FOUND', 'Event not found', 404);
      }

      // Get attendees
      const attendees = await CalendarModel.getEventAttendees(eventId, tenantId);

      const apiEvent = dbToApiEvent(event);
      return {
        ...apiEvent,
        attendees: attendees.map((attendee: EventAttendee) => ({
          userId: attendee.user_id,
          responseStatus: attendee.response_status,
          respondedAt: attendee.responded_at,
          username: attendee.username,
          firstName: attendee.first_name,
          lastName: attendee.last_name,
          email: attendee.email,
          profilePicture: attendee.profile_picture,
        })),
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve event', 500);
    }
  }

  /**
   * Create new calendar event with permission checks
   * @param eventData - The eventData parameter
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   * @param userDepartmentId - The userDepartmentId parameter
   * @param userTeamId - The userTeamId parameter
   */
  async createEvent(
    eventData: CalendarEventData,
    tenantId: number,
    userId: number,
    userRole: string,
    userDepartmentId?: number | null,
    userTeamId?: number | null,
  ) {
    // Validate required fields
    if (!eventData.title) {
      throw new ServiceError('BAD_REQUEST', 'Title is required', 400, [
        { field: 'title', message: 'Title is required' },
      ]);
    }

    if (!eventData.startTime) {
      throw new ServiceError('BAD_REQUEST', 'Start time is required', 400, [
        { field: 'startTime', message: 'Start time is required' },
      ]);
    }

    if (!eventData.endTime) {
      throw new ServiceError('BAD_REQUEST', 'End time is required', 400, [
        { field: 'endTime', message: 'End time is required' },
      ]);
    }

    if (!eventData.orgLevel) {
      throw new ServiceError('BAD_REQUEST', 'Organization level is required', 400, [
        { field: 'orgLevel', message: 'Organization level is required' },
      ]);
    }

    // Validate dates
    const startDate = new Date(eventData.startTime);
    const endDate = new Date(eventData.endTime);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ServiceError('BAD_REQUEST', 'Invalid date format', 400, [
        { field: 'startTime/endTime', message: 'Must be valid ISO 8601 date' },
      ]);
    }

    if (endDate <= startDate) {
      throw new ServiceError('BAD_REQUEST', 'End time must be after start time', 400, [
        { field: 'endTime', message: 'Must be after start time' },
      ]);
    }

    // PERMISSION CHECKS basierend auf org_level
    switch (eventData.orgLevel) {
      case 'company':
        if (userRole !== 'admin') {
          throw new ServiceError('FORBIDDEN', 'Only admins can create company events', 403);
        }
        break;

      case 'department':
        if (!eventData.departmentId) {
          throw new ServiceError(
            'BAD_REQUEST',
            'departmentId is required for department events',
            400,
            [
              {
                field: 'departmentId',
                message: 'Required for department events',
              },
            ],
          );
        }
        if (userRole !== 'admin' && userRole !== 'lead') {
          throw new ServiceError(
            'FORBIDDEN',
            'Only admins and leads can create department events',
            403,
          );
        }
        if (userDepartmentId !== eventData.departmentId && userRole !== 'admin') {
          throw new ServiceError('FORBIDDEN', 'Cannot create events for other departments', 403);
        }
        break;

      case 'team':
        if (!eventData.teamId || !eventData.departmentId) {
          throw new ServiceError(
            'BAD_REQUEST',
            'Both teamId and departmentId are required for team events',
            400,
            [
              { field: 'teamId', message: 'Required for team events' },
              { field: 'departmentId', message: 'Required for team events' },
            ],
          );
        }
        if (userTeamId !== eventData.teamId && userRole !== 'admin') {
          throw new ServiceError('FORBIDDEN', 'Cannot create events for other teams', 403);
        }
        break;

      case 'personal':
        // Jeder kann persönliche Events erstellen
        break;

      default:
        throw new ServiceError('BAD_REQUEST', 'Invalid organization level', 400, [
          { field: 'orgLevel', message: 'Invalid organization level' },
        ]);
    }

    const createData: EventCreateData = {
      tenant_id: tenantId,
      title: eventData.title,
      description: eventData.description,
      location: eventData.location,
      start_time: eventData.startTime,
      end_time: eventData.endTime,
      all_day: eventData.allDay ?? false,
      org_level: eventData.orgLevel,
      department_id: eventData.departmentId ?? null,
      team_id: eventData.teamId ?? null,
      created_by: userId,
      created_by_role: userRole,
      allow_attendees: eventData.attendeeIds && eventData.attendeeIds.length > 0 ? true : false,
      reminder_time: eventData.reminderMinutes,
      color: eventData.color,
      recurrence_rule: eventData.recurrenceRule,
      requires_response: eventData.requiresResponse ?? false,
    };

    try {
      const createdEvent = await CalendarModel.createEvent(createData);

      if (!createdEvent) {
        throw new ServiceError('SERVER_ERROR', 'Failed to create event', 500);
      }

      // Add attendees if provided (für alle Event-Typen möglich)
      if (eventData.attendeeIds && eventData.attendeeIds.length > 0) {
        for (const attendeeId of eventData.attendeeIds) {
          await CalendarModel.addEventAttendee(
            createdEvent.id,
            attendeeId,
            'pending',
            tenantId, // Pass tenant_id for multi-tenant isolation
          );
        }
      }

      // Retrieve and return the created event with attendees
      return await this.getEventById(createdEvent.id, tenantId, userId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('SERVER_ERROR', 'Failed to create event', 500);
    }
  }

  /**
   * Update calendar event
   * @param eventId - The eventId parameter
   * @param updateData - The updateData parameter
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async updateEvent(
    eventId: number,
    updateData: CalendarEventUpdateData,
    tenantId: number,
    userId: number,
    userRole: string,
  ) {
    // First check if event exists
    const eventExists = await CalendarModel.checkEventExists(eventId, tenantId);
    if (!eventExists) {
      throw new ServiceError('NOT_FOUND', 'Event not found', 404);
    }

    // Then check if user has permission to view
    const event = await CalendarModel.getEventById(eventId, tenantId, userId);
    if (!event) {
      throw new ServiceError('FORBIDDEN', "You don't have permission to access this event", 403);
    }

    // Check permissions
    if (event.created_by !== userId && userRole !== 'admin' && userRole !== 'manager') {
      throw new ServiceError('FORBIDDEN', 'You can only update your own events', 403);
    }

    // Validate dates if provided
    if (updateData.startTime && updateData.endTime) {
      const startDate = new Date(updateData.startTime);
      const endDate = new Date(updateData.endTime);

      if (endDate <= startDate) {
        throw new ServiceError('BAD_REQUEST', 'End time must be after start time', 400, [
          { field: 'endTime', message: 'Must be after start time' },
        ]);
      }
    }

    // Map API fields to DB fields
    const dbUpdateData: EventUpdateData = {
      title: updateData.title,
      description: updateData.description,
      location: updateData.location,
      start_time: updateData.startTime,
      end_time: updateData.endTime,
      all_day: updateData.allDay,
      org_level: updateData.orgLevel,
      department_id: updateData.departmentId,
      team_id: updateData.teamId,
      reminder_time: updateData.reminderMinutes,
      color: updateData.color,
      recurrence_rule: updateData.recurrenceRule,
      // status is handled differently in the calendar model
    };

    try {
      const success = await CalendarModel.updateEvent(eventId, dbUpdateData, tenantId);
      if (!success) {
        throw new ServiceError('SERVER_ERROR', 'Failed to update event', 500);
      }

      // Return updated event
      return await this.getEventById(eventId, tenantId, userId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('SERVER_ERROR', 'Failed to update event', 500);
    }
  }

  /**
   * Delete calendar event
   * @param eventId - The eventId parameter
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async deleteEvent(eventId: number, tenantId: number, userId: number, userRole: string) {
    // First check if event exists
    const eventExists = await CalendarModel.checkEventExists(eventId, tenantId);
    if (!eventExists) {
      throw new ServiceError('NOT_FOUND', 'Event not found', 404);
    }

    // Then check if user has permission to view
    const event = await CalendarModel.getEventById(eventId, tenantId, userId);
    if (!event) {
      throw new ServiceError('FORBIDDEN', "You don't have permission to access this event", 403);
    }

    // Check permissions
    if (event.created_by !== userId && userRole !== 'admin' && userRole !== 'manager') {
      throw new ServiceError('FORBIDDEN', 'You can only delete your own events', 403);
    }

    try {
      const success = await CalendarModel.deleteEvent(eventId, tenantId);
      if (!success) {
        throw new ServiceError('SERVER_ERROR', 'Failed to delete event', 500);
      }
      return true;
    } catch (error: unknown) {
      // Re-throw ServiceErrors to preserve their status codes
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('SERVER_ERROR', 'Failed to delete event', 500);
    }
  }

  /**
   * Update attendee response
   * @param eventId - The eventId parameter
   * @param userId - The user ID
   * @param response - The response parameter
   * @param tenantId - The tenant ID
   */
  async updateAttendeeResponse(
    eventId: number,
    userId: number,
    response: 'accepted' | 'declined' | 'tentative',
    tenantId: number,
  ) {
    try {
      // Check if event exists
      const event = await CalendarModel.getEventById(eventId, tenantId, userId);
      if (!event) {
        throw new ServiceError('NOT_FOUND', 'Event not found', 404);
      }

      const success = await CalendarModel.respondToEvent(eventId, userId, response);
      if (!success) {
        throw new ServiceError('BAD_REQUEST', 'Failed to update response', 400);
      }

      return { success: true };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('SERVER_ERROR', 'Failed to update attendee response', 500);
    }
  }

  /**
   * Export events
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param _userDepartmentId - The _userDepartmentId parameter
   * @param format - The format parameter
   */
  async exportEvents(
    tenantId: number,
    userId: number,
    _userDepartmentId: number | null,
    format: 'ics' | 'csv',
  ) {
    try {
      const result = (await CalendarModel.getAllEvents(
        tenantId,
        userId,
        { limit: 1000 }, // Export up to 1000 events
      )) as unknown as {
        events: DbCalendarEvent[];
      };

      if (format === 'csv') {
        return this.generateCSV(result.events);
      } else {
        return this.generateICS(result.events);
      }
    } catch {
      throw new ServiceError('SERVER_ERROR', 'Failed to export events', 500);
    }
  }

  /**
   * Generate CSV export
   * @param events - The events parameter
   */
  private generateCSV(events: CalendarEvent[]): string {
    const headers = ['Title', 'Description', 'Location', 'Start', 'End', 'All Day', 'Status'];
    const rows = events.map((event) => [
      event.title,
      event.description ?? '',
      event.location ?? '',
      event.start_date.toISOString(),
      event.end_date.toISOString(),
      event.all_day ? 'Yes' : 'No',
      event.status ?? 'confirmed',
    ]);

    return [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join(
      '\n',
    );
  }

  /**
   * Get unread events (events requiring response)
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async getUnreadEvents(tenantId: number, userId: number) {
    try {
      // Get all events where user is an attendee with pending response
      const query = `
        SELECT 
          e.id,
          e.title,
          e.start_date as startTime,
          e.requires_response,
          a.response_status
        FROM calendar_events e
        JOIN calendar_attendees a ON e.id = a.event_id
        WHERE 
          e.tenant_id = ? 
          AND a.user_id = ?
          AND a.response_status = 'pending'
          AND e.requires_response = 1
          AND e.status = 'confirmed'
          AND e.start_date >= NOW()
        ORDER BY e.start_date ASC
        LIMIT 50
      `;

      // Import the query function
      const { query: executeQuery } = await import('../../../utils/db.js');
      const [result] = await executeQuery(query, [tenantId, userId]);

      // Type guard to ensure result is an array
      const events: CalendarEvent[] = Array.isArray(result) ? (result as CalendarEvent[]) : [];

      // Count total unread events
      const totalUnread = events.length;

      return {
        totalUnread,
        eventsRequiringResponse: events.map((event) => ({
          id: event.id,
          title: event.title,
          startTime: event.startTime as string,
          requiresResponse: true,
        })),
      };
    } catch (error: unknown) {
      console.error('Error getting unread events:', error);
      return {
        totalUnread: 0,
        eventsRequiringResponse: [],
      };
    }
  }

  /**
   * Generate ICS export
   * @param events - The events parameter
   */
  private generateICS(events: CalendarEvent[]): string {
    const icsEvents = events
      .map((event) => {
        const uid = `${event.id}@assixx.com`;
        const dtstart = event.start_date
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, '');
        const dtend = event.end_date
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, '');

        return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${new Date()
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, '')}Z
DTSTART:${dtstart}Z
DTEND:${dtend}Z
SUMMARY:${event.title}
DESCRIPTION:${event.description ?? ''}
LOCATION:${event.location ?? ''}
STATUS:${String((event.status ?? 'CONFIRMED').toUpperCase())}
END:VEVENT`;
      })
      .join('\n');

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Assixx//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${icsEvents}
END:VCALENDAR`;
  }
}

// Export a singleton instance
export const calendarService = new CalendarService();
