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
  EventQueryOptions,
  EventUpdateData,
} from '../../../models/calendar.js';
import { dbToApiEvent } from '../../../utils/fieldMapping.js';
import { ServiceError } from '../users/users.service.js';

export interface CalendarFilters {
  status?: 'active' | 'cancelled';
  filter?: 'all' | 'company' | 'department' | 'team' | 'area' | 'personal';
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
  // Multi-organization support - arrays of IDs
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  // Legacy fields (backwards compatibility)
  orgLevel?: 'company' | 'department' | 'team' | 'area' | 'personal';
  departmentId?: number; // Explizit für department/team Events
  teamId?: number; // Explizit für team Events
  areaId?: number; // Explizit für area Events
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
  // Multi-organization support - arrays of IDs
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  // Legacy fields (backwards compatibility)
  orgLevel?: 'company' | 'department' | 'team' | 'area' | 'personal';
  departmentId?: number;
  teamId?: number;
  areaId?: number;
  reminderMinutes?: number | null;
  color?: string;
  recurrenceRule?: string | null;
  status?: 'tentative' | 'confirmed' | 'cancelled';
}

/** Map API field names to DB field names for sorting */
const SORT_BY_MAP: Record<string, string> = {
  startDate: 'start_date',
  endDate: 'end_date',
  title: 'title',
  createdAt: 'created_at',
};

/**
 *
 */
class CalendarService {
  /**
   * Build query options from filters
   */
  private buildEventQueryOptions(
    filters: CalendarFilters,
    userDepartmentId: number | null,
    userTeamId: number | null,
  ): { queryOptions: EventQueryOptions; page: number; limit: number } {
    const page = Math.max(1, Number.parseInt(filters.page ?? '1', 10));
    const limit = Math.min(200, Math.max(1, Number.parseInt(filters.limit ?? '50', 10)));

    const sortBy = SORT_BY_MAP[filters.sortBy ?? 'startDate'] ?? 'start_date';
    const sortDir: 'ASC' | 'DESC' = filters.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const queryOptions: EventQueryOptions = {
      page,
      limit,
      sortBy,
      sortDir,
      userDepartmentId,
      userTeamId,
    };

    if (filters.status !== undefined) queryOptions.status = filters.status;
    if (filters.filter !== undefined) queryOptions.filter = filters.filter;
    if (filters.search !== undefined) queryOptions.search = filters.search;
    if (filters.startDate !== undefined) queryOptions.start_date = filters.startDate;
    if (filters.endDate !== undefined) queryOptions.end_date = filters.endDate;

    return { queryOptions, page, limit };
  }

  /**
   * Get paginated list of calendar events with filter optimization
   */
  async listEvents(
    tenantId: number,
    userId: number,
    userDepartmentId: number | null,
    userTeamId: number | null,
    filters: CalendarFilters,
  ): Promise<{
    events: CalendarEvent[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { queryOptions, page, limit } = this.buildEventQueryOptions(
      filters,
      userDepartmentId,
      userTeamId,
    );

    try {
      const result = (await calendarModel.getAllEvents(
        tenantId,
        userId,
        queryOptions,
      )) as unknown as {
        events: CalendarEvent[];
        pagination: { total: number };
      };

      const events = result.events.map(
        (event: DbCalendarEvent) => dbToApiEvent(event) as CalendarEvent,
      );
      const totalPages = Math.ceil(result.pagination.total / limit);

      return {
        events,
        pagination: { page, limit, total: result.pagination.total, totalPages },
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
      case 'area':
        this.validateAreaEvent(eventData, userRole);
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
    if (eventData.departmentId === undefined) {
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
    if (eventData.teamId === undefined || eventData.departmentId === undefined) {
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
   * Validate area event creation
   */
  private validateAreaEvent(eventData: CalendarEventData, userRole: string): void {
    if (eventData.areaId === undefined) {
      throw new ServiceError('BAD_REQUEST', 'areaId is required for area events', 400, [
        { field: 'areaId', message: 'Required for area events' },
      ]);
    }

    if (userRole !== 'admin' && userRole !== 'lead') {
      throw new ServiceError('FORBIDDEN', 'Only admins and leads can create area events', 403);
    }
  }

  /**
   * Apply optional string/boolean fields to create data
   */
  private applyOptionalEventFields(
    createData: EventCreateData,
    eventData: CalendarEventData,
  ): void {
    if (eventData.description !== undefined) createData.description = eventData.description;
    if (eventData.location !== undefined) createData.location = eventData.location;
    createData.all_day = eventData.allDay ?? false;
    if (eventData.reminderMinutes !== undefined)
      createData.reminder_time = eventData.reminderMinutes;
    if (eventData.color !== undefined) createData.color = eventData.color;
    if (eventData.recurrenceRule !== undefined)
      createData.recurrence_rule = eventData.recurrenceRule;
  }

  /**
   * Apply organization-related fields to create data
   */
  private applyOrgFields(createData: EventCreateData, eventData: CalendarEventData): void {
    if (eventData.orgLevel !== undefined) createData.org_level = eventData.orgLevel;
    if (eventData.departmentId !== undefined)
      createData.department_id = eventData.departmentId ?? null;
    if (eventData.teamId !== undefined) createData.team_id = eventData.teamId ?? null;
    if (eventData.areaId !== undefined) createData.area_id = eventData.areaId ?? null;
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
    const createData: EventCreateData = {
      tenant_id: tenantId,
      title: eventData.title,
      start_time: eventData.startTime,
      end_time: eventData.endTime,
      created_by: userId,
      created_by_role: userRole,
    };

    this.applyOptionalEventFields(createData, eventData);
    this.applyOrgFields(createData, eventData);

    if (eventData.attendeeIds !== undefined && eventData.attendeeIds.length > 0) {
      createData.allow_attendees = true;
    }

    return createData;
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
      await calendarModel.addEventAttendee(eventId, attendeeId, tenantId);
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
    if (updateData.startTime === undefined || updateData.endTime === undefined) {
      return;
    }
    if (updateData.startTime === '' || updateData.endTime === '') {
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

  /**
   * Apply core fields to update data
   */
  private applyUpdateCoreFields(
    dbData: EventUpdateData,
    updateData: CalendarEventUpdateData,
  ): void {
    if (updateData.title !== undefined) dbData.title = updateData.title;
    if (updateData.description !== undefined) dbData.description = updateData.description;
    if (updateData.location !== undefined) dbData.location = updateData.location;
    if (updateData.startTime !== undefined) dbData.start_time = updateData.startTime;
    if (updateData.endTime !== undefined) dbData.end_time = updateData.endTime;
    if (updateData.allDay !== undefined) dbData.all_day = updateData.allDay;
  }

  /**
   * Apply org and optional fields to update data
   */
  private applyUpdateOptionalFields(
    dbData: EventUpdateData,
    updateData: CalendarEventUpdateData,
  ): void {
    if (updateData.orgLevel !== undefined) dbData.org_level = updateData.orgLevel;
    if (updateData.departmentId !== undefined) dbData.department_id = updateData.departmentId;
    if (updateData.teamId !== undefined) dbData.team_id = updateData.teamId;
    if (updateData.areaId !== undefined) dbData.area_id = updateData.areaId;
    if (updateData.reminderMinutes !== undefined) dbData.reminder_time = updateData.reminderMinutes;
    if (updateData.color !== undefined) dbData.color = updateData.color;
    if (updateData.recurrenceRule !== undefined) dbData.recurrence_rule = updateData.recurrenceRule;
  }

  /**
   * Build update data from input
   */
  private buildEventUpdateData(updateData: CalendarEventUpdateData): EventUpdateData {
    const dbData: EventUpdateData = {};
    this.applyUpdateCoreFields(dbData, updateData);
    this.applyUpdateOptionalFields(dbData, updateData);
    return dbData;
  }

  async updateEvent(
    eventId: number,
    updateData: CalendarEventUpdateData,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ success: boolean }> {
    await this.validateUpdatePermissions(eventId, tenantId, userId, userRole);
    this.validateDateRange(updateData);

    const dbUpdateData = this.buildEventUpdateData(updateData);

    try {
      const success = await calendarModel.updateEvent(eventId, dbUpdateData, tenantId);
      if (!success) {
        throw new ServiceError('SERVER_ERROR', 'Failed to update event', 500);
      }
      return { success: true };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
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
    if (eventData.title === '') {
      throw new ServiceError('BAD_REQUEST', 'Title is required', 400, [
        { field: 'title', message: 'Title is required' },
      ]);
    }

    if (eventData.startTime === '') {
      throw new ServiceError('BAD_REQUEST', 'Start time is required', 400, [
        { field: 'startTime', message: 'Start time is required' },
      ]);
    }

    if (eventData.endTime === '') {
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
    if (description === undefined) return '';
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
    const rows: string[][] = events.map((event: CalendarEvent) => [
      event.title,
      this.convertDescriptionToString(event.description),
      event.location ?? '',
      event.start_date.toISOString(),
      event.end_date.toISOString(),
      event.all_day === true ? 'Yes' : 'No',
      event.status ?? 'confirmed',
    ]);

    return [
      headers.join(','),
      ...rows.map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(',')),
    ].join('\n');
  }

  /**
   * Get unread events (DEPRECATED - feature removed)
   * @returns Empty results for backward compatibility
   */
  getUnreadEvents(): { totalUnread: number; eventsRequiringResponse: unknown[] } {
    // NOTE: This feature has been removed as requires_response functionality was deprecated
    return {
      totalUnread: 0,
      eventsRequiringResponse: [],
    };
  }

  /**
   * Generate ICS export
   * @param events - The events parameter
   */
  private generateICS(events: CalendarEvent[]): string {
    const icsEvents = events
      .map((event: CalendarEvent) => {
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
