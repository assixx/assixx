/**
 * Calendar Service
 *
 * Native NestJS implementation for calendar event management.
 * No Express dependencies - uses DatabaseService directly.
 */
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import type { UpdateEventDto } from './dto/update-event.dto.js';

// ============================================
// Types
// ============================================

/**
 * Database representation of a calendar event
 */
export interface DbCalendarEvent {
  id: number;
  uuid: string;
  tenant_id: number;
  user_id: number;
  title: string;
  description: string | null;
  location: string | null;
  start_date: Date;
  end_date: Date;
  all_day: boolean | number;
  type: string | null;
  status: string | null;
  is_private: boolean | number;
  reminder_minutes: number | null;
  color: string | null;
  recurrence_rule: string | null;
  parent_event_id: number | null;
  created_at: Date;
  updated_at: Date;
  creator_name?: string;
  org_level: string | null;
  department_id: number | null;
  team_id: number | null;
  area_id: number | null;
  created_by_role: string | null;
  allow_attendees: boolean | number;
}

/**
 * Database representation of an event attendee
 */
export interface DbEventAttendee {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  profile_picture: string | null;
}

/**
 * API response type for calendar event
 */
export type CalendarEventResponse = Record<string, unknown>;

/**
 * Paginated result type
 */
export interface PaginatedEventsResult {
  events: CalendarEventResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Filter options for listing events
 */
export interface EventFilters {
  status: string | undefined;
  filter: string | undefined;
  search: string | undefined;
  startDate: string | undefined;
  endDate: string | undefined;
  page: number | undefined;
  limit: number | undefined;
  sortBy: string | undefined;
  sortOrder: string | undefined;
}

/**
 * User role info
 */
interface UserRoleInfo {
  role: string | null;
  department_id: number | null;
  team_id: number | null;
}

// ============================================
// Constants
// ============================================

const ALLOWED_SORT_COLUMNS = new Set([
  'start_date',
  'end_date',
  'title',
  'created_at',
  'updated_at',
]);

const SORT_BY_MAP: Record<string, string> = {
  startDate: 'start_date',
  endDate: 'end_date',
  title: 'title',
  createdAt: 'created_at',
};

// ============================================
// Service
// ============================================

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  // ============================================
  // Public Methods
  // ============================================

  /**
   * List events with filters and pagination
   */
  async listEvents(
    tenantId: number,
    userId: number,
    userDepartmentId: number | null,
    userTeamId: number | null,
    filters: EventFilters,
  ): Promise<PaginatedEventsResult> {
    this.logger.log(`Listing events for tenant ${tenantId}, user ${userId}`);

    const { page, limit, offset } = this.normalizePagination(filters);
    const status = filters.status === 'cancelled' ? 'cancelled' : 'confirmed';
    const userRole = await this.getUserRole(userId, tenantId);

    let query = `
      SELECT e.*, u.username as creator_name
      FROM calendar_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.tenant_id = $1 AND e.status = $2
    `;
    const params: unknown[] = [tenantId, status];
    let paramIndex = 3;

    // Apply org level filter
    const filterType = filters.filter ?? 'all';
    if (filterType !== 'all' && userRole.role !== 'admin' && userRole.role !== 'root') {
      const orgFilter = this.buildOrgLevelFilter(
        filterType,
        userId,
        userDepartmentId,
        userTeamId,
        paramIndex,
      );
      query += orgFilter.clause;
      params.push(...orgFilter.newParams);
      paramIndex = orgFilter.newIndex;
    }

    // Apply date and search filters
    const dateSearch = this.appendDateSearchFilters(filters, params, paramIndex);
    query += dateSearch.clause;
    paramIndex = dateSearch.newIndex;

    // Get total count before pagination
    const total = await this.countEvents(query, params);

    // Apply sorting and pagination
    const sortBy = this.validateSortColumn(
      SORT_BY_MAP[filters.sortBy ?? 'startDate'] ?? 'start_date',
    );
    const sortDir = filters.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    query += ` ORDER BY e.${sortBy} ${sortDir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const events = await this.databaseService.query<DbCalendarEvent>(query, params);

    return {
      events: events.map((e: DbCalendarEvent) => this.dbToApiEvent(e)),
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
    this.logger.log(`Getting event ${eventId} for tenant ${tenantId}`);

    const events = await this.databaseService.query<DbCalendarEvent>(
      `SELECT e.*, u.username as creator_name
       FROM calendar_events e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.id = $1 AND e.tenant_id = $2`,
      [eventId, tenantId],
    );

    const event = events[0];
    if (event === undefined) {
      throw new NotFoundException('Event not found');
    }

    // Check access
    const userRole = await this.getUserRole(userId, tenantId);
    const hasAccess = await this.checkEventAccess(event, userId, userRole);
    if (!hasAccess) {
      throw new NotFoundException('Event not found');
    }

    const attendees = await this.getEventAttendees(eventId, tenantId);
    const apiEvent = this.dbToApiEvent(event);

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

  /**
   * Create a new event
   */
  async createEvent(
    dto: CreateEventDto,
    tenantId: number,
    userId: number,
  ): Promise<CalendarEventResponse> {
    this.logger.log(`Creating event: ${dto.title}`);

    const eventUuid = uuidv7();
    const startDate = new Date(dto.startTime);
    const endDate = new Date(dto.endTime);

    if (startDate > endDate) {
      throw new ForbiddenException('Start time must be before end time');
    }

    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO calendar_events
       (uuid, tenant_id, user_id, title, description, location, start_date, end_date, all_day,
        org_level, department_id, team_id, created_by_role, allow_attendees,
        type, status, is_private, reminder_minutes, color, recurrence_rule, parent_event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING id`,
      [
        eventUuid,
        tenantId,
        userId,
        dto.title,
        dto.description ?? null,
        dto.location ?? null,
        startDate,
        endDate,
        dto.allDay === true ? 1 : 0,
        dto.orgLevel ?? 'personal',
        dto.departmentIds.length > 0 ? dto.departmentIds[0] : null,
        dto.teamIds.length > 0 ? dto.teamIds[0] : null,
        'user',
        1, // allow_attendees
        'other',
        'confirmed',
        0, // is_private
        dto.reminderMinutes ?? null,
        dto.color ?? '#3498db',
        dto.recurrenceRule ?? null,
        null, // parent_event_id
      ],
    );

    const eventId = result[0]?.id;
    if (eventId === undefined) {
      throw new Error('Failed to create event');
    }

    // Add creator as attendee
    await this.addEventAttendee(eventId, userId, tenantId);

    // Add other attendees
    if (dto.attendeeIds !== undefined && dto.attendeeIds.length > 0) {
      for (const attendeeId of dto.attendeeIds) {
        await this.addEventAttendee(eventId, attendeeId, tenantId);
      }
    }

    return await this.getEventById(eventId, tenantId, userId);
  }

  /** Build update query parts for event */
  private buildEventUpdateQuery(dto: UpdateEventDto): { updates: string[]; params: unknown[] } {
    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fields: {
      key: keyof UpdateEventDto;
      column: string;
      transform?: (v: unknown) => unknown;
    }[] = [
      { key: 'title', column: 'title' },
      { key: 'description', column: 'description' },
      { key: 'location', column: 'location' },
      { key: 'startTime', column: 'start_date', transform: (v: unknown) => new Date(v as string) },
      { key: 'endTime', column: 'end_date', transform: (v: unknown) => new Date(v as string) },
      { key: 'allDay', column: 'all_day', transform: (v: unknown) => (v === true ? 1 : 0) },
      {
        key: 'status',
        column: 'status',
        transform: (v: unknown) => (v === 'cancelled' ? 'cancelled' : 'confirmed'),
      },
      { key: 'color', column: 'color' },
    ];

    for (const { key, column, transform } of fields) {
      // Safe: key is from hardcoded array with keyof UpdateEventDto, not user input

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
      throw new NotFoundException('Event not found');
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
      throw new NotFoundException('Event not found');
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

    return { message: 'Event deleted successfully' };
  }

  /**
   * Export events
   */
  async exportEvents(
    tenantId: number,
    _userId: number,
    _userDepartmentId: number | null,
    format: 'ics' | 'csv',
  ): Promise<string> {
    this.logger.log(`Exporting events as ${format} for tenant ${tenantId}`);

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
      return this.generateIcsExport(events);
    }
    return this.generateCsvExport(events);
  }

  /**
   * Get dashboard events
   */
  async getDashboardEvents(
    tenantId: number,
    userId: number,
    days: number = 7,
    limit: number = 5,
  ): Promise<CalendarEventResponse[]> {
    this.logger.log(`Getting dashboard events for tenant ${tenantId}`);

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + days);

    const todayStr = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const userRole = await this.getUserRole(userId, tenantId);

    let query = `
      SELECT e.*, u.username as creator_name
      FROM calendar_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.tenant_id = $1 AND e.status = 'confirmed'
      AND e.start_date >= $2 AND e.start_date <= $3
    `;
    const params: unknown[] = [tenantId, todayStr, endDateStr];

    // Access control for non-admins
    if (userRole.role !== 'admin' && userRole.role !== 'root') {
      query += ` AND (
        e.org_level = 'company' OR
        (e.org_level = 'department' AND e.department_id = $4) OR
        (e.org_level = 'team' AND e.team_id = $5) OR
        e.user_id = $6 OR
        EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = $7)
      )`;
      params.push(userRole.department_id, userRole.team_id, userId, userId);
    }

    const limitIndex = params.length + 1;
    query += ` ORDER BY e.start_date ASC LIMIT $${limitIndex}`;
    params.push(limit);

    const events = await this.databaseService.query<DbCalendarEvent>(query, params);
    return events.map((e: DbCalendarEvent) => this.dbToApiEvent(e));
  }

  /**
   * Get unread events (deprecated - returns empty)
   */
  getUnreadEvents(): { totalUnread: number; eventsRequiringResponse: never[] } {
    return {
      totalUnread: 0,
      eventsRequiringResponse: [],
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Get user role info
   */
  private async getUserRole(userId: number, tenantId: number): Promise<UserRoleInfo> {
    const rows = await this.databaseService.query<UserRoleInfo>(
      `SELECT role, NULL as department_id, NULL as team_id FROM users WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    return rows[0] ?? { role: null, department_id: null, team_id: null };
  }

  /**
   * Check if user has access to event
   */
  private async checkEventAccess(
    event: DbCalendarEvent,
    userId: number,
    userRole: UserRoleInfo,
  ): Promise<boolean> {
    // Admins/root can see all events
    if (userRole.role === 'admin' || userRole.role === 'root') {
      return true;
    }

    // Creator can see their event
    if (event.user_id === userId) {
      return true;
    }

    // Company events visible to all
    if (event.org_level === 'company') {
      return true;
    }

    // Department events visible to department members
    if (event.org_level === 'department' && event.department_id === userRole.department_id) {
      return true;
    }

    // Team events visible to team members
    if (event.org_level === 'team' && event.team_id === userRole.team_id) {
      return true;
    }

    // Check if user is an attendee
    const attendees = await this.databaseService.query<{ user_id: number }>(
      `SELECT user_id FROM calendar_attendees WHERE event_id = $1 AND user_id = $2`,
      [event.id, userId],
    );
    return attendees.length > 0;
  }

  /**
   * Build org level filter clause
   */
  private buildOrgLevelFilter(
    filterType: string,
    userId: number,
    userDepartmentId: number | null,
    userTeamId: number | null,
    startIndex: number,
  ): { clause: string; newParams: unknown[]; newIndex: number } {
    const params: unknown[] = [];
    let clause = '';
    let index = startIndex;

    switch (filterType) {
      case 'company':
        clause = ` AND e.org_level = 'company'`;
        break;
      case 'department':
        clause = ` AND e.org_level = 'department' AND e.department_id = $${index}`;
        params.push(userDepartmentId);
        index++;
        break;
      case 'team':
        clause = ` AND e.org_level = 'team' AND e.team_id = $${index}`;
        params.push(userTeamId);
        index++;
        break;
      case 'personal':
        clause = ` AND (e.org_level = 'personal' AND e.user_id = $${index})`;
        params.push(userId);
        index++;
        break;
      default:
        // 'all' - show accessible events
        clause = ` AND (
          e.org_level = 'company' OR
          (e.org_level = 'department' AND e.department_id = $${index}) OR
          (e.org_level = 'team' AND e.team_id = $${index + 1}) OR
          e.user_id = $${index + 2} OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = $${index + 3})
        )`;
        params.push(userDepartmentId, userTeamId, userId, userId);
        index += 4;
    }

    return { clause, newParams: params, newIndex: index };
  }

  /**
   * Get event attendees
   */
  private async getEventAttendees(eventId: number, tenantId: number): Promise<DbEventAttendee[]> {
    return await this.databaseService.query<DbEventAttendee>(
      `SELECT a.user_id, u.username, u.first_name, u.last_name, u.email, u.profile_picture
       FROM calendar_attendees a
       JOIN users u ON a.user_id = u.id
       JOIN calendar_events e ON a.event_id = e.id
       WHERE a.event_id = $1 AND e.tenant_id = $2
       ORDER BY u.first_name, u.last_name`,
      [eventId, tenantId],
    );
  }

  /**
   * Add event attendee
   */
  private async addEventAttendee(eventId: number, userId: number, tenantId: number): Promise<void> {
    // Check if already attendee
    const existing = await this.databaseService.query<{ user_id: number }>(
      `SELECT user_id FROM calendar_attendees WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId],
    );

    if (existing.length > 0) {
      return;
    }

    await this.databaseService.query(
      `INSERT INTO calendar_attendees (event_id, user_id, tenant_id) VALUES ($1, $2, $3)`,
      [eventId, userId, tenantId],
    );
  }

  /** Normalize pagination parameters */
  private normalizePagination(filters: EventFilters): {
    page: number;
    limit: number;
    offset: number;
  } {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
  }

  /** Append date and search filters to query */
  private appendDateSearchFilters(
    filters: EventFilters,
    params: unknown[],
    startIndex: number,
  ): { clause: string; newIndex: number } {
    let clause = '';
    let paramIndex = startIndex;

    if (filters.startDate !== undefined) {
      clause += ` AND e.start_date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    if (filters.endDate !== undefined) {
      clause += ` AND e.end_date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }
    if (filters.search !== undefined && filters.search !== '') {
      clause += ` AND (e.title ILIKE $${paramIndex} OR e.description ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    return { clause, newIndex: paramIndex };
  }

  /** Count total events matching the query */
  private async countEvents(baseQuery: string, params: unknown[]): Promise<number> {
    const countQuery = baseQuery.replace(
      'SELECT e.*, u.username as creator_name',
      'SELECT COUNT(*) as count',
    );
    const countResult = await this.databaseService.query<{ count: string }>(countQuery, params);
    return Number.parseInt(countResult[0]?.count ?? '0', 10);
  }

  /**
   * Validate sort column
   */
  private validateSortColumn(sortBy: string): string {
    return ALLOWED_SORT_COLUMNS.has(sortBy) ? sortBy : 'start_date';
  }

  /**
   * Convert DB event to API format
   */
  private dbToApiEvent(event: DbCalendarEvent): CalendarEventResponse {
    return {
      id: event.id,
      uuid: event.uuid,
      tenantId: event.tenant_id,
      userId: event.user_id,
      title: event.title,
      description: event.description,
      location: event.location,
      startTime: event.start_date,
      endTime: event.end_date,
      allDay: event.all_day === 1 || event.all_day === true,
      type: event.type,
      status: event.status,
      isPrivate: event.is_private === 1 || event.is_private === true,
      reminderMinutes: event.reminder_minutes,
      color: event.color,
      recurrenceRule: event.recurrence_rule,
      parentEventId: event.parent_event_id,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
      creatorName: event.creator_name,
      orgLevel: event.org_level,
      departmentId: event.department_id,
      teamId: event.team_id,
      areaId: event.area_id,
    };
  }

  /**
   * Generate ICS format export
   */
  private generateIcsExport(events: DbCalendarEvent[]): string {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Assixx//Calendar//EN'];

    for (const event of events) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${event.id}@assixx`);
      lines.push(`DTSTART:${this.formatDateIcs(event.start_date)}`);
      lines.push(`DTEND:${this.formatDateIcs(event.end_date)}`);
      lines.push(`SUMMARY:${event.title}`);
      if (event.description !== null && event.description !== '') {
        lines.push(`DESCRIPTION:${event.description}`);
      }
      if (event.location !== null && event.location !== '') {
        lines.push(`LOCATION:${event.location}`);
      }
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /**
   * Generate CSV format export
   */
  private generateCsvExport(events: DbCalendarEvent[]): string {
    const headers = ['ID', 'Title', 'Start', 'End', 'Location', 'Description', 'Status'];
    const rows = events.map((event: DbCalendarEvent) => {
      const desc = typeof event.description === 'string' ? event.description : '';
      return [
        event.id.toString(),
        `"${event.title.replace(/"/g, '""')}"`,
        event.start_date.toISOString(),
        event.end_date.toISOString(),
        `"${(event.location ?? '').replace(/"/g, '""')}"`,
        `"${desc.replace(/"/g, '""')}"`,
        event.status ?? 'confirmed',
      ];
    });

    return [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
  }

  /**
   * Format date for ICS
   */
  private formatDateIcs(date: Date): string {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }
}
