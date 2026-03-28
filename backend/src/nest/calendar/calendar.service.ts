/**
 * Calendar Service (Facade)
 *
 * Orchestrates calendar event management by delegating to sub-services.
 * Maintains public API compatibility while keeping business logic in focused sub-services.
 *
 * Sub-services:
 * - CalendarPermissionService: Access control and permission filtering
 * - CalendarCreationService: Event creation and attendee management
 * - CalendarOverviewService: Dashboard views and notification counts
 *
 * Helpers:
 * - calendar.helpers.ts: Pure functions (mappers, recurrence, visibility clause)
 */
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ScopeService } from '../hierarchy-permission/scope.service.js';
import { CalendarCreationService } from './calendar-creation.service.js';
import { generateCsvExport, generateIcsExport } from './calendar-export.utils.js';
import { CalendarOverviewService } from './calendar-overview.service.js';
import { CalendarPermissionService } from './calendar-permission.service.js';
import {
  ERROR_EVENT_NOT_FOUND,
  SORT_BY_MAP,
  appendDateSearchFilters,
  calculateRecurrenceDates,
  dbToApiEvent,
  normalizePagination,
  validateSortColumn,
} from './calendar.helpers.js';
import type {
  CalendarEventResponse,
  DbCalendarEvent,
  DbEventAttendee,
  EventFilters,
  PaginatedEventsResult,
} from './calendar.types.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import type { UpdateEventDto } from './dto/update-event.dto.js';

// Re-export types for backward compatibility
export type {
  CalendarEventResponse,
  DbCalendarEvent,
  DbEventAttendee,
  EventFilters,
  PaginatedEventsResult,
} from './calendar.types.js';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly permissionService: CalendarPermissionService,
    private readonly creationService: CalendarCreationService,
    private readonly overviewService: CalendarOverviewService,
    private readonly scopeService: ScopeService,
  ) {}

  // ============================================
  // Public Methods - List & Get
  // ============================================

  /**
   * List events with filters and pagination
   */
  async listEvents(
    tenantId: number,
    userId: number,
    _userDepartmentId: number | null,
    _userTeamId: number | null,
    filters: EventFilters,
  ): Promise<PaginatedEventsResult> {
    const { page, limit, offset } = normalizePagination(filters);
    const status = filters.status === 'cancelled' ? 'cancelled' : 'confirmed';
    const scope = await this.scopeService.getScope();
    const memberships = await this.permissionService.getUserMemberships(userId, tenantId);

    let query = `
      SELECT e.*, u.username as creator_name
      FROM calendar_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.tenant_id = $1 AND e.status = $2
    `;
    const params: unknown[] = [tenantId, status];
    let paramIndex = 3;

    const filterType = filters.filter ?? 'all';

    const accessFilter =
      scope.type === 'full' ?
        this.permissionService.buildAdminOrgLevelFilter(filterType, userId, paramIndex)
      : this.permissionService.buildPermissionBasedFilter(
          filterType,
          scope,
          memberships,
          userId,
          paramIndex,
        );
    query += accessFilter.clause;
    params.push(...accessFilter.newParams);
    paramIndex = accessFilter.newIndex;

    // Apply date and search filters
    const dateSearch = appendDateSearchFilters(filters, params, paramIndex);
    query += dateSearch.clause;
    paramIndex = dateSearch.newIndex;

    // Get total count before pagination
    const total = await this.countEvents(query, params);

    // Apply sorting and pagination
    const sortBy = validateSortColumn(SORT_BY_MAP[filters.sortBy ?? 'startDate'] ?? 'start_date');
    const sortDir = filters.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    query += ` ORDER BY e.${sortBy} ${sortDir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const events = await this.databaseService.query<DbCalendarEvent>(query, params);

    return {
      events: events.map((e: DbCalendarEvent) => dbToApiEvent(e)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get event by ID
   */
  async getEventById(
    eventId: number,
    tenantId: number,
    userId: number,
  ): Promise<CalendarEventResponse> {
    const events = await this.databaseService.query<DbCalendarEvent>(
      `SELECT e.*, u.username as creator_name
       FROM calendar_events e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.id = $1 AND e.tenant_id = $2`,
      [eventId, tenantId],
    );

    const event = events[0];
    if (event === undefined) {
      throw new NotFoundException(ERROR_EVENT_NOT_FOUND);
    }

    // Check access via scope + memberships
    const scope = await this.scopeService.getScope();
    const memberships = await this.permissionService.getUserMemberships(userId, tenantId);
    const hasAccess = await this.permissionService.checkEventAccess(
      event,
      userId,
      scope,
      memberships,
    );
    if (!hasAccess) {
      throw new NotFoundException(ERROR_EVENT_NOT_FOUND);
    }

    const attendees = await this.permissionService.getEventAttendees(eventId, tenantId);
    const apiEvent = dbToApiEvent(event);

    return {
      ...apiEvent,
      attendees: attendees.map((a: DbEventAttendee) => ({
        userId: a.user_id,
        username: a.username,
        firstName: a.first_name,
        lastName: a.last_name,
        email: a.email,
        profilePicture: a.profile_picture,
      })),
    };
  }

  // ============================================
  // Public Methods - Create, Update, Delete
  // ============================================

  /**
   * Create a new event (with optional recurrence)
   */
  async createEvent(
    dto: CreateEventDto,
    tenantId: number,
    userId: number,
  ): Promise<CalendarEventResponse> {
    this.logger.log(`Creating event: ${dto.title}`);

    const startDate = new Date(dto.startTime);
    const endDate = new Date(dto.endTime);

    if (startDate > endDate) {
      throw new ForbiddenException('Start time must be before end time');
    }

    // Calculate event duration in milliseconds
    const durationMs = endDate.getTime() - startDate.getTime();

    // Calculate recurrence dates (first date is the original event)
    const recurrenceDates = calculateRecurrenceDates(
      startDate,
      dto.recurrence as string | undefined,
      dto.recurrenceEndType as string | undefined,
      dto.recurrenceCount,
      dto.recurrenceUntil,
    );

    this.logger.debug(`Creating ${recurrenceDates.length} event instance(s)`);

    // Create parent event (first occurrence)
    const firstDate = recurrenceDates[0] ?? startDate;
    const recurrenceStr = dto.recurrence ?? null;

    const parentEventId = await this.creationService.insertEvent(
      dto,
      tenantId,
      userId,
      firstDate,
      new Date(firstDate.getTime() + durationMs),
      null,
      recurrenceStr,
    );

    // Add attendees to parent event
    await this.creationService.addAttendeesToEvent(
      parentEventId,
      userId,
      dto.attendeeIds,
      tenantId,
    );

    // Create child events for remaining occurrences
    await this.creationService.createChildEvents(
      recurrenceDates,
      dto,
      tenantId,
      userId,
      durationMs,
      parentEventId,
    );

    // Log activity to root_logs
    await this.creationService.logEventCreated(tenantId, userId, parentEventId, dto);

    return await this.getEventById(parentEventId, tenantId, userId);
  }

  /**
   * Update an event
   */
  async updateEvent(
    eventId: number,
    dto: UpdateEventDto,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<CalendarEventResponse> {
    this.logger.log(`Updating event ${eventId}`);

    const events = await this.databaseService.query<DbCalendarEvent>(
      `SELECT * FROM calendar_events WHERE id = $1 AND tenant_id = $2`,
      [eventId, tenantId],
    );

    const existing = events[0];
    if (existing === undefined) {
      throw new NotFoundException(ERROR_EVENT_NOT_FOUND);
    }

    // Past-event protection: events whose end_date is in the past cannot be edited
    const endDate = new Date(existing.end_date);
    if (endDate < new Date()) {
      throw new ForbiddenException('Vergangene Kalendereinträge können nicht bearbeitet werden');
    }

    if (existing.user_id !== userId && userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('You do not have permission to update this event');
    }

    const { updates, params } = this.buildEventUpdateQuery(dto);
    const paramIndex = params.length + 1;

    params.push(eventId, tenantId);
    await this.databaseService.query(
      `UPDATE calendar_events SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}`,
      params,
    );

    // Log activity to root_logs
    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'calendar',
      eventId,
      `Kalender-Event aktualisiert: ${existing.title}`,
      {
        title: existing.title,
        startDate: existing.start_date,
        endDate: existing.end_date,
      },
      {
        title: dto.title ?? existing.title,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    );

    return await this.getEventById(eventId, tenantId, userId);
  }

  /**
   * Delete an event
   */
  async deleteEvent(
    eventId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting event ${eventId}`);

    const events = await this.databaseService.query<DbCalendarEvent>(
      `SELECT * FROM calendar_events WHERE id = $1 AND tenant_id = $2`,
      [eventId, tenantId],
    );

    const existing = events[0];
    if (existing === undefined) {
      throw new NotFoundException(ERROR_EVENT_NOT_FOUND);
    }

    // Past-event protection: events whose end_date is in the past cannot be deleted
    const endDate = new Date(existing.end_date);
    if (endDate < new Date()) {
      throw new ForbiddenException('Vergangene Kalendereinträge können nicht gelöscht werden');
    }

    if (existing.user_id !== userId && userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('You do not have permission to delete this event');
    }

    // Delete attendees first
    await this.databaseService.query(`DELETE FROM calendar_attendees WHERE event_id = $1`, [
      eventId,
    ]);

    // Delete event
    await this.databaseService.query(
      `DELETE FROM calendar_events WHERE id = $1 AND tenant_id = $2`,
      [eventId, tenantId],
    );

    // Log activity to root_logs
    await this.activityLogger.logDelete(
      tenantId,
      userId,
      'calendar',
      eventId,
      `Kalender-Event gelöscht: ${existing.title}`,
      {
        title: existing.title,
        startDate: existing.start_date,
        endDate: existing.end_date,
      },
    );

    return { message: 'Event deleted successfully' };
  }

  // ============================================
  // UUID-based methods (for API consistency)
  // ============================================

  /**
   * Resolve event ID from UUID
   */
  private async resolveEventIdByUuid(uuid: string, tenantId: number): Promise<number> {
    const result = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM calendar_events WHERE uuid = $1 AND tenant_id = $2`,
      [uuid, tenantId],
    );
    const event = result[0];
    if (event === undefined) {
      throw new NotFoundException(ERROR_EVENT_NOT_FOUND);
    }
    return event.id;
  }

  async getEventByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<CalendarEventResponse> {
    const eventId = await this.resolveEventIdByUuid(uuid, tenantId);
    return await this.getEventById(eventId, tenantId, userId);
  }

  async updateEventByUuid(
    uuid: string,
    dto: UpdateEventDto,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<CalendarEventResponse> {
    const eventId = await this.resolveEventIdByUuid(uuid, tenantId);
    return await this.updateEvent(eventId, dto, tenantId, userId, userRole);
  }

  async deleteEventByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ message: string }> {
    const eventId = await this.resolveEventIdByUuid(uuid, tenantId);
    return await this.deleteEvent(eventId, tenantId, userId, userRole);
  }

  // ============================================
  // Export & Dashboard (delegated)
  // ============================================

  /**
   * Export events
   */
  async exportEvents(
    tenantId: number,
    _userId: number,
    _userDepartmentId: number | null,
    format: 'ics' | 'csv',
  ): Promise<string> {
    const events = await this.databaseService.query<DbCalendarEvent>(
      `SELECT e.*, u.username as creator_name
       FROM calendar_events e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.tenant_id = $1 AND e.status = 'confirmed'
       ORDER BY e.start_date ASC
       LIMIT 1000`,
      [tenantId],
    );

    if (format === 'ics') {
      return generateIcsExport(events);
    }
    return generateCsvExport(events);
  }

  /**
   * Get dashboard events - delegates to overview service
   */
  async getDashboardEvents(
    tenantId: number,
    userId: number,
    limit: number = 10,
  ): Promise<CalendarEventResponse[]> {
    return await this.overviewService.getDashboardEvents(tenantId, userId, limit);
  }

  /**
   * Get recently added events - delegates to overview service
   */
  async getRecentlyAddedEvents(
    tenantId: number,
    userId: number,
    limit: number = 3,
  ): Promise<CalendarEventResponse[]> {
    return await this.overviewService.getRecentlyAddedEvents(tenantId, userId, limit);
  }

  /**
   * Get upcoming count - delegates to overview service
   */
  async getUpcomingCount(
    tenantId: number,
    userId: number,
    userDepartmentId: number | null,
    userTeamId: number | null,
  ): Promise<{ count: number }> {
    return await this.overviewService.getUpcomingCount(
      tenantId,
      userId,
      userDepartmentId,
      userTeamId,
    );
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Count total events matching the query
   */
  private async countEvents(baseQuery: string, params: unknown[]): Promise<number> {
    const countQuery = baseQuery.replace(
      'SELECT e.*, u.username as creator_name',
      'SELECT COUNT(*) as count',
    );
    const countResult = await this.databaseService.query<{ count: string }>(countQuery, params);
    return Number.parseInt(countResult[0]?.count ?? '0', 10);
  }

  /**
   * Build update query parts for event
   */
  private buildEventUpdateQuery(dto: UpdateEventDto): {
    updates: string[];
    params: unknown[];
  } {
    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Handle assignment fields specially
    const hasAssignmentUpdate =
      dto.areaIds !== undefined || dto.departmentIds !== undefined || dto.teamIds !== undefined;

    if (hasAssignmentUpdate) {
      const { orgLevel, departmentId, teamId, areaId } =
        this.creationService.determineOrgTarget(dto);

      const assignments: [string, unknown][] = [
        ['org_level', orgLevel],
        ['department_id', departmentId],
        ['team_id', teamId],
        ['area_id', areaId],
      ];

      for (const [column, value] of assignments) {
        updates.push(`${column} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    // Handle non-assignment fields
    const fields = this.getEventFieldMappings(hasAssignmentUpdate);

    for (const { key, column, transform } of fields) {
      const fieldValue = (dto as Record<string, unknown>)[key];
      if (fieldValue !== undefined) {
        const value = transform !== undefined ? transform(fieldValue) : fieldValue;
        updates.push(`${column} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    return { updates, params };
  }

  /**
   * Field-to-column mappings for event updates
   */
  private getEventFieldMappings(hasAssignmentUpdate: boolean): {
    key: keyof UpdateEventDto;
    column: string;
    transform?: (v: unknown) => unknown;
  }[] {
    const fields: {
      key: keyof UpdateEventDto;
      column: string;
      transform?: (v: unknown) => unknown;
    }[] = [
      { key: 'title', column: 'title' },
      { key: 'description', column: 'description' },
      { key: 'location', column: 'location' },
      {
        key: 'startTime',
        column: 'start_date',
        transform: (v: unknown) => new Date(v as string),
      },
      {
        key: 'endTime',
        column: 'end_date',
        transform: (v: unknown) => new Date(v as string),
      },
      {
        key: 'allDay',
        column: 'all_day',
        transform: (v: unknown) => (v === true ? 1 : 0),
      },
      {
        key: 'status',
        column: 'status',
        transform: (v: unknown) => (v === 'cancelled' ? 'cancelled' : 'confirmed'),
      },
      { key: 'color', column: 'color' },
    ];

    if (!hasAssignmentUpdate) {
      fields.push({ key: 'orgLevel', column: 'org_level' });
    }

    return fields;
  }
}
