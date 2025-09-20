/**
 * Calendar v2 Service Layer
 * Handles all business logic for calendar events
 */
import calendarModel from '../../../models/calendar.js';
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
  ): Promise<{
    events: CalendarEvent[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
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
      const result = (await calendarModel.getAllEvents(
        tenantId,
        userId,
        queryOptions,
      )) as unknown as {
        events: CalendarEvent[];
        pagination: { total: number };
      };

      // Map events to API format
      const events = result.events.map(
        (event: DbCalendarEvent) => dbToApiEvent(event) as CalendarEvent,
      );

      const totalPages = Math.ceil(result.pagination.total / limit);

      return {
        events,
        pagination: {
          page,
          limit,
          total: result.pagination.total,
          totalPages,
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
  ): Promise<CalendarEvent> {
    try {
      const event = await calendarModel.getEventById(eventId, tenantId, userId);
      if (!event) {
        throw new ServiceError('NOT_FOUND', 'Event not found', 404);
      }

      // Get attendees
      const attendees = await calendarModel.getEventAttendees(eventId, tenantId);

      const apiEvent = dbToApiEvent(event) as CalendarEvent;
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
  /**
   * Validate permissions for creating events
   */
  private validateCreatePermissions(
    eventData: CalendarEventData,
    userRole: string,
    userDepartmentId?: number | null,
    userTeamId?: number | null,
  ): void {
    switch (eventData.orgLevel) {
      case 'company':
        if (userRole !== 'admin') {
          throw new ServiceError('FORBIDDEN', 'Only admins can create company events', 403);
        }
        break;
      case 'department':
        this.validateDepartmentEvent(eventData, userRole, userDepartmentId);
        break;
      case 'team':
        this.validateTeamEvent(eventData, userRole, userTeamId);
        break;
      case 'personal':
        // Everyone can create personal events
        break;
      default:
        // This should never happen due to TypeScript, but handle it for runtime safety
        throw new ServiceError('BAD_REQUEST', 'Invalid organization level', 400, [
          { field: 'orgLevel', message: 'Invalid organization level' },
        ]);
    }
  }

  /**
   * Validate department event creation
   */
  private validateDepartmentEvent(
    eventData: CalendarEventData,
    userRole: string,
    userDepartmentId?: number | null,
  ): void {
    if (!eventData.departmentId) {
      throw new ServiceError('BAD_REQUEST', 'departmentId is required for department events', 400, [
        { field: 'departmentId', message: 'Required for department events' },
      ]);
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
  }

  /**
   * Validate team event creation
   */
  private validateTeamEvent(
    eventData: CalendarEventData,
    userRole: string,
    userTeamId?: number | null,
  ): void {
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
  }

  /**
   * Build event create data from input
   */
  private buildEventCreateData(
    eventData: CalendarEventData,
    tenantId: number,
    userId: number,
    userRole: string,
  ): EventCreateData {
    return {
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
      allow_attendees: Boolean(eventData.attendeeIds && eventData.attendeeIds.length > 0),
      reminder_time: eventData.reminderMinutes,
      color: eventData.color,
      recurrence_rule: eventData.recurrenceRule,
      requires_response: eventData.requiresResponse ?? false,
    };
  }

  /**
   * Add attendees to event
   */
  private async addAttendeesToEvent(
    eventId: number,
    attendeeIds: number[] | undefined,
    tenantId: number,
  ): Promise<void> {
    if (!attendeeIds || attendeeIds.length === 0) {
      return;
    }

    for (const attendeeId of attendeeIds) {
      await calendarModel.addEventAttendee(eventId, attendeeId, 'pending', tenantId);
    }
  }

  async createEvent(
    eventData: CalendarEventData,
    tenantId: number,
    userId: number,
    userRole: string,
    userDepartmentId?: number | null,
    userTeamId?: number | null,
  ): Promise<{ eventId: number }> {
    // Validate event data
    this.validateEventData(eventData);

    // Validate permissions
    this.validateCreatePermissions(eventData, userRole, userDepartmentId, userTeamId);

    // Build create data
    const createData = this.buildEventCreateData(eventData, tenantId, userId, userRole);

    try {
      const createdEvent = await calendarModel.createEvent(createData);
      if (!createdEvent) {
        throw new ServiceError('SERVER_ERROR', 'Failed to create event', 500);
      }

      // Add attendees if provided
      await this.addAttendeesToEvent(createdEvent.id, eventData.attendeeIds, tenantId);

      // Retrieve and return the created event
      const event = await this.getEventById(createdEvent.id, tenantId, userId);
      return { eventId: event.id };
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
  /**
   * Validate update permissions for events
   */
  private async validateUpdatePermissions(
    eventId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<DbCalendarEvent> {
    const eventExists = await calendarModel.checkEventExists(eventId, tenantId);
    if (!eventExists) {
      throw new ServiceError('NOT_FOUND', 'Event not found', 404);
    }

    const event = await calendarModel.getEventById(eventId, tenantId, userId);
    if (!event) {
      throw new ServiceError('FORBIDDEN', "You don't have permission to access this event", 403);
    }

    const canUpdate = event.created_by === userId || userRole === 'admin' || userRole === 'manager';

    if (!canUpdate) {
      throw new ServiceError('FORBIDDEN', 'You can only update your own events', 403);
    }

    return event;
  }

  /**
   * Validate date range for event updates
   */
  private validateDateRange(updateData: CalendarEventUpdateData): void {
    if (!updateData.startTime || !updateData.endTime) {
      return;
    }

    const startDate = new Date(updateData.startTime);
    const endDate = new Date(updateData.endTime);

    if (endDate <= startDate) {
      throw new ServiceError('BAD_REQUEST', 'End time must be after start time', 400, [
        { field: 'endTime', message: 'Must be after start time' },
      ]);
    }
  }

  async updateEvent(
    eventId: number,
    updateData: CalendarEventUpdateData,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ success: boolean }> {
    // Validate permissions and get event
    await this.validateUpdatePermissions(eventId, tenantId, userId, userRole);

    // Validate dates if provided
    this.validateDateRange(updateData);

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
    };

    try {
      const success = await calendarModel.updateEvent(eventId, dbUpdateData, tenantId);
      if (!success) {
        throw new ServiceError('SERVER_ERROR', 'Failed to update event', 500);
      }

      return { success: true };
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
  async deleteEvent(
    eventId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ success: boolean }> {
    // First check if event exists
    const eventExists = await calendarModel.checkEventExists(eventId, tenantId);
    if (!eventExists) {
      throw new ServiceError('NOT_FOUND', 'Event not found', 404);
    }

    // Then check if user has permission to view
    const event = await calendarModel.getEventById(eventId, tenantId, userId);
    if (!event) {
      throw new ServiceError('FORBIDDEN', "You don't have permission to access this event", 403);
    }

    // Check permissions
    if (event.created_by !== userId && userRole !== 'admin' && userRole !== 'manager') {
      throw new ServiceError('FORBIDDEN', 'You can only delete your own events', 403);
    }

    try {
      const success = await calendarModel.deleteEvent(eventId, tenantId);
      if (!success) {
        throw new ServiceError('SERVER_ERROR', 'Failed to delete event', 500);
      }
      return { success: true };
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
  ): Promise<{ success: boolean }> {
    try {
      // Check if event exists
      const event = await calendarModel.getEventById(eventId, tenantId, userId);
      if (!event) {
        throw new ServiceError('NOT_FOUND', 'Event not found', 404);
      }

      const success = await calendarModel.respondToEvent(eventId, userId, response);
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
  ): Promise<string> {
    try {
      const result = (await calendarModel.getAllEvents(
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
   * Validate event data fields
   * @param eventData - The event data to validate
   */
  private validateEventData(eventData: CalendarEventData): void {
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

    const startDate = new Date(eventData.startTime);
    const endDate = new Date(eventData.endTime);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new ServiceError('BAD_REQUEST', 'Invalid date format', 400, [
        { field: 'startTime/endTime', message: 'Must be valid ISO 8601 date' },
      ]);
    }

    if (endDate <= startDate) {
      throw new ServiceError('BAD_REQUEST', 'End time must be after start time', 400, [
        { field: 'endTime', message: 'Must be after start time' },
      ]);
    }
  }

  /**
   * Convert description field to string (handles Buffer types)
   * @param description - The description field that can be string, Buffer, or Buffer-like object
   */
  private convertDescriptionToString(
    description?: string | Buffer | { type: 'Buffer'; data: number[] },
  ): string {
    if (!description) return '';
    if (typeof description === 'string') return description;
    if (Buffer.isBuffer(description)) return description.toString('utf8');
    // Handle Buffer-like object from MySQL
    if (
      typeof description === 'object' &&
      'type' in description &&
      'data' in description &&
      Array.isArray(description.data)
    ) {
      return Buffer.from(description.data).toString('utf8');
    }
    return '';
  }

  /**
   * Generate CSV export
   * @param events - The events parameter
   */
  private generateCSV(events: CalendarEvent[]): string {
    const headers = ['Title', 'Description', 'Location', 'Start', 'End', 'All Day', 'Status'];
    const rows: string[][] = events.map((event) => [
      event.title,
      this.convertDescriptionToString(event.description),
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
  async getUnreadEvents(
    tenantId: number,
    userId: number,
  ): Promise<{
    totalUnread: number;
    eventsRequiringResponse: {
      id: number;
      title: string;
      startTime: string;
      requiresResponse: boolean;
    }[];
  }> {
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
DESCRIPTION:${this.convertDescriptionToString(event.description)}
LOCATION:${event.location ?? ''}
STATUS:${(event.status ?? 'CONFIRMED').toUpperCase()}
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
