/* eslint-disable max-lines */
/**
 * Calendar Service
 *
 * Native NestJS implementation for calendar event management.
 * No Express dependencies - uses DatabaseService directly.
 */
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { FeatureVisitsService } from '../feature-visits/feature-visits.service.js';
import { generateCsvExport, generateIcsExport } from './calendar-export.utils.js';
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
 * User role info with full access flag
 */
interface UserRoleInfo {
  role: string | null;
  department_id: number | null;
  team_id: number | null;
  has_full_access: boolean;
}

// ============================================
// Constants
// ============================================

const ERROR_EVENT_NOT_FOUND = 'Event not found';

const ALLOWED_SORT_COLUMNS = new Set([
  'start_date',
  'end_date',
  'title',
  'created_at',
  'updated_at',
]);

/**
 * SQL query for permission-based event visibility
 * Params: $1=tenantId, $2=startOfDay, $3=endOfWeek, $4=lastVisited, $5=userId
 */
const PERMISSION_BASED_COUNT_QUERY = `
  SELECT COUNT(DISTINCT e.id) as count
  FROM calendar_events e
  WHERE e.tenant_id = $1
    AND e.start_date >= $2
    AND e.start_date < $3
    AND e.status != 'cancelled'
    AND e.created_at > $4
    AND e.user_id != $5
    AND (
      -- 1. Company level: everyone sees
      e.org_level = 'company'
      -- 2. Area level: check area permissions
      OR (e.org_level = 'area' AND (
        EXISTS (SELECT 1 FROM admin_area_permissions aap
                WHERE aap.admin_user_id = $5 AND aap.area_id = e.area_id AND aap.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM areas a
                   WHERE a.id = e.area_id AND a.area_lead_id = $5 AND a.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM user_departments ud
                   JOIN departments d ON ud.department_id = d.id
                   WHERE ud.user_id = $5 AND ud.tenant_id = $1 AND d.area_id = e.area_id)
      ))
      -- 3. Department level: check department permissions
      OR (e.org_level = 'department' AND (
        EXISTS (SELECT 1 FROM admin_department_permissions adp
                WHERE adp.admin_user_id = $5 AND adp.department_id = e.department_id AND adp.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM departments d
                   WHERE d.id = e.department_id AND d.department_lead_id = $5 AND d.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM user_departments ud
                   WHERE ud.user_id = $5 AND ud.department_id = e.department_id AND ud.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM departments d
                   JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                   WHERE d.id = e.department_id AND aap.admin_user_id = $5 AND aap.tenant_id = $1)
      ))
      -- 4. Team level: check team membership or lead
      OR (e.org_level = 'team' AND (
        EXISTS (SELECT 1 FROM user_teams ut
                WHERE ut.user_id = $5 AND ut.team_id = e.team_id AND ut.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM teams t
                   WHERE t.id = e.team_id AND t.team_lead_id = $5 AND t.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM teams t
                   JOIN admin_department_permissions adp ON adp.department_id = t.department_id
                   WHERE t.id = e.team_id AND adp.admin_user_id = $5 AND adp.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM teams t
                   JOIN departments d ON t.department_id = d.id
                   JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                   WHERE t.id = e.team_id AND aap.admin_user_id = $5 AND aap.tenant_id = $1)
      ))
    )
`;

const SORT_BY_MAP: Record<string, string> = {
  startDate: 'start_date',
  endDate: 'end_date',
  title: 'title',
  createdAt: 'created_at',
};

/**
 * Build SQL visibility clause for permission-based event access
 * Checks: admin permissions, lead positions, department/team memberships, personal, attendees
 * @param userIdx - Parameter index for userId
 * @param tenantIdx - Parameter index for tenantId
 */
function buildVisibilityClause(userIdx: number, tenantIdx: number): string {
  return `(
    e.org_level = 'company'
    OR (e.org_level = 'area' AND (
      EXISTS (SELECT 1 FROM admin_area_permissions aap
              WHERE aap.admin_user_id = $${userIdx} AND aap.area_id = e.area_id AND aap.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM areas a
                 WHERE a.id = e.area_id AND a.area_lead_id = $${userIdx} AND a.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM user_departments ud
                 JOIN departments d ON ud.department_id = d.id
                 WHERE ud.user_id = $${userIdx} AND ud.tenant_id = $${tenantIdx} AND d.area_id = e.area_id)
    ))
    OR (e.org_level = 'department' AND (
      EXISTS (SELECT 1 FROM admin_department_permissions adp
              WHERE adp.admin_user_id = $${userIdx} AND adp.department_id = e.department_id AND adp.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM departments d
                 WHERE d.id = e.department_id AND d.department_lead_id = $${userIdx} AND d.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM user_departments ud
                 WHERE ud.user_id = $${userIdx} AND ud.department_id = e.department_id AND ud.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM departments d
                 JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                 WHERE d.id = e.department_id AND aap.admin_user_id = $${userIdx} AND aap.tenant_id = $${tenantIdx})
    ))
    OR (e.org_level = 'team' AND (
      EXISTS (SELECT 1 FROM user_teams ut
              WHERE ut.user_id = $${userIdx} AND ut.team_id = e.team_id AND ut.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM teams t
                 WHERE t.id = e.team_id AND t.team_lead_id = $${userIdx} AND t.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM teams t
                 JOIN admin_department_permissions adp ON adp.department_id = t.department_id
                 WHERE t.id = e.team_id AND adp.admin_user_id = $${userIdx} AND adp.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM teams t
                 JOIN departments d ON t.department_id = d.id
                 JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                 WHERE t.id = e.team_id AND aap.admin_user_id = $${userIdx} AND aap.tenant_id = $${tenantIdx})
    ))
    OR (e.org_level = 'personal' AND e.user_id = $${userIdx})
    OR EXISTS (SELECT 1 FROM calendar_attendees ca WHERE ca.event_id = e.id AND ca.user_id = $${userIdx})
  )`;
}

// ============================================
// Service
// ============================================

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly featureVisitsService: FeatureVisitsService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ============================================
  // Public Methods
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
    // No log for READ operations - reduces noise

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

    // CRITICAL: Only root OR has_full_access=true gets unrestricted access
    const filterType = filters.filter ?? 'all';
    const hasUnrestrictedAccess = userRole.has_full_access || userRole.role === 'root';

    if (!hasUnrestrictedAccess) {
      // Users without full access get permission-based visibility filtering
      const permissionFilter = this.buildPermissionBasedFilter(
        filterType,
        userId,
        tenantId,
        paramIndex,
      );
      query += permissionFilter.clause;
      params.push(...permissionFilter.newParams);
      paramIndex = permissionFilter.newIndex;
    } else {
      // Full access users can see all events, apply UI filter only
      const adminFilter = this.buildAdminOrgLevelFilter(filterType, userId, paramIndex);
      query += adminFilter.clause;
      params.push(...adminFilter.newParams);
      paramIndex = adminFilter.newIndex;
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
    // No log for READ operations

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

    // Check access
    const userRole = await this.getUserRole(userId, tenantId);
    const hasAccess = await this.checkEventAccess(event, userId, userRole);
    if (!hasAccess) {
      throw new NotFoundException(ERROR_EVENT_NOT_FOUND);
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
    const recurrenceDates = this.calculateRecurrenceDates(
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

    const parentEventId = await this.insertEvent(
      dto,
      tenantId,
      userId,
      firstDate,
      new Date(firstDate.getTime() + durationMs),
      null,
      recurrenceStr,
    );

    // Add attendees to parent event
    await this.addAttendeesToEvent(parentEventId, userId, dto.attendeeIds, tenantId);

    // Create child events for remaining occurrences
    await this.createChildEvents(recurrenceDates, dto, tenantId, userId, durationMs, parentEventId);

    // Log activity to root_logs
    await this.logEventCreated(tenantId, userId, parentEventId, dto);

    return await this.getEventById(parentEventId, tenantId, userId);
  }

  /** Create child events for recurrence series */
  private async createChildEvents(
    recurrenceDates: Date[],
    dto: CreateEventDto,
    tenantId: number,
    userId: number,
    durationMs: number,
    parentEventId: number,
  ): Promise<void> {
    for (let i = 1; i < recurrenceDates.length; i++) {
      const childStart = recurrenceDates[i];
      if (childStart === undefined) continue;

      const childEnd = new Date(childStart.getTime() + durationMs);
      const childEventId = await this.insertEvent(
        dto,
        tenantId,
        userId,
        childStart,
        childEnd,
        parentEventId,
        null,
      );
      await this.addAttendeesToEvent(childEventId, userId, dto.attendeeIds, tenantId);
    }
  }

  /** Log calendar event creation to root_logs */
  private async logEventCreated(
    tenantId: number,
    userId: number,
    eventId: number,
    dto: CreateEventDto,
  ): Promise<void> {
    await this.activityLogger.logCreate(
      tenantId,
      userId,
      'calendar',
      eventId,
      `Kalender-Event erstellt: ${dto.title}`,
      {
        title: dto.title,
        startTime: dto.startTime,
        endTime: dto.endTime,
        recurrence: dto.recurrence ?? null,
      },
    );
  }

  /**
   * Add creator and additional attendees to an event
   */
  private async addAttendeesToEvent(
    eventId: number,
    creatorId: number,
    attendeeIds: number[] | undefined,
    tenantId: number,
  ): Promise<void> {
    await this.addEventAttendee(eventId, creatorId, tenantId);
    if (attendeeIds !== undefined && attendeeIds.length > 0) {
      for (const attendeeId of attendeeIds) {
        await this.addEventAttendee(eventId, attendeeId, tenantId);
      }
    }
  }

  /**
   * Determine org_level, department_id, team_id, and area_id from DTO
   * Priority for orgLevel: area \> department \> team \> company \> personal
   * IMPORTANT: Keep ALL provided IDs (area, department, team can coexist)
   * The orgLevel only determines primary visibility scope
   */
  private determineOrgTarget(dto: CreateEventDto | UpdateEventDto): {
    orgLevel: string;
    departmentId: number | null;
    teamId: number | null;
    areaId: number | null;
  } {
    // Extract all IDs - keep them ALL, don't nullify any
    const departmentId = dto.departmentIds?.[0] ?? null;
    const teamId = dto.teamIds?.[0] ?? null;
    const areaId = dto.areaIds?.[0] ?? null;

    // Determine orgLevel based on highest priority (for visibility)
    // Priority: area > department > team > company > personal
    let orgLevel: string;
    if (areaId !== null) {
      orgLevel = 'area';
    } else if (departmentId !== null) {
      orgLevel = 'department';
    } else if (teamId !== null) {
      orgLevel = 'team';
    } else if (dto.orgLevel === 'company') {
      orgLevel = 'company';
    } else {
      orgLevel = dto.orgLevel ?? 'personal';
    }

    return {
      orgLevel,
      departmentId,
      teamId,
      areaId,
    };
  }

  /**
   * Insert a single event into the database
   */
  private async insertEvent(
    dto: CreateEventDto,
    tenantId: number,
    userId: number,
    startDate: Date,
    endDate: Date,
    parentEventId: number | null,
    recurrenceRule: string | null,
  ): Promise<number> {
    const eventUuid = uuidv7();
    const { orgLevel, departmentId, teamId, areaId } = this.determineOrgTarget(dto);

    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO calendar_events
       (uuid, tenant_id, user_id, title, description, location, start_date, end_date, all_day,
        org_level, department_id, team_id, area_id, created_by_role, allow_attendees,
        type, status, is_private, reminder_minutes, color, recurrence_rule, parent_event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
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
        orgLevel,
        departmentId,
        teamId,
        areaId,
        'user',
        1, // allow_attendees
        'other',
        'confirmed',
        0, // is_private
        dto.reminderMinutes ?? null,
        dto.color ?? '#3498db',
        recurrenceRule,
        parentEventId,
      ],
    );

    const eventId = result[0]?.id;
    if (eventId === undefined) {
      throw new Error('Failed to create event');
    }

    return eventId;
  }

  /**
   * Calculate all recurrence dates based on recurrence settings
   * Returns array of start dates for each occurrence
   */
  private calculateRecurrenceDates(
    startDate: Date,
    recurrence: string | undefined,
    endType: string | undefined,
    count: number | undefined,
    untilDate: string | undefined,
  ): Date[] {
    const dates: Date[] = [new Date(startDate)];

    // No recurrence - return single date
    if (recurrence === undefined) {
      return dates;
    }

    // Determine max occurrences
    const MAX_OCCURRENCES = 52; // Safety limit (1 year of weekly events)
    let maxCount = MAX_OCCURRENCES;

    if (endType === 'after' && count !== undefined) {
      maxCount = Math.min(count, MAX_OCCURRENCES);
    }

    const untilDateObj = untilDate !== undefined ? new Date(untilDate) : null;

    // Generate dates
    let currentDate = new Date(startDate);
    while (dates.length < maxCount) {
      currentDate = this.addRecurrenceInterval(currentDate, recurrence);

      // Check if we've passed the until date
      if (endType === 'until' && untilDateObj !== null && currentDate > untilDateObj) {
        break;
      }

      dates.push(new Date(currentDate));
    }

    return dates;
  }

  /**
   * Add interval to date based on recurrence type
   */
  private addRecurrenceInterval(date: Date, recurrence: string): Date {
    const newDate = new Date(date);

    switch (recurrence) {
      case 'daily':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'weekly':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'monthly':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'yearly':
        newDate.setFullYear(newDate.getFullYear() + 1);
        break;
      default:
        throw new Error(`Unknown recurrence type: ${recurrence}`);
    }

    return newDate;
  }

  /** Build update query parts for event */
  private buildEventUpdateQuery(dto: UpdateEventDto): { updates: string[]; params: unknown[] } {
    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Handle assignment fields specially - use determineOrgTarget for consistency
    const hasAssignmentUpdate =
      dto.areaIds !== undefined || dto.departmentIds !== undefined || dto.teamIds !== undefined;

    if (hasAssignmentUpdate) {
      const { orgLevel, departmentId, teamId, areaId } = this.determineOrgTarget(dto);

      updates.push(`org_level = $${paramIndex}`);
      params.push(orgLevel);
      paramIndex++;

      updates.push(`department_id = $${paramIndex}`);
      params.push(departmentId);
      paramIndex++;

      updates.push(`team_id = $${paramIndex}`);
      params.push(teamId);
      paramIndex++;

      updates.push(`area_id = $${paramIndex}`);
      params.push(areaId);
      paramIndex++;
    }

    // Handle non-assignment fields
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

    // Only include orgLevel if no assignment update (otherwise already handled above)
    if (!hasAssignmentUpdate) {
      fields.push({ key: 'orgLevel', column: 'org_level' });
    }

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
      throw new NotFoundException(ERROR_EVENT_NOT_FOUND);
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
      { title: existing.title, startDate: existing.start_date, endDate: existing.end_date },
      { title: dto.title ?? existing.title, startTime: dto.startTime, endTime: dto.endTime },
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
   * @throws NotFoundException if event not found
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

  /**
   * Get event by UUID
   */
  async getEventByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<CalendarEventResponse> {
    const eventId = await this.resolveEventIdByUuid(uuid, tenantId);
    return await this.getEventById(eventId, tenantId, userId);
  }

  /**
   * Update event by UUID
   */
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

  /**
   * Delete event by UUID
   */
  async deleteEventByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ message: string }> {
    const eventId = await this.resolveEventIdByUuid(uuid, tenantId);
    return await this.deleteEvent(eventId, tenantId, userId, userRole);
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
   * Get dashboard events for the CURRENT MONTH
   * Shows upcoming events starting from today until end of current month
   */
  async getDashboardEvents(
    tenantId: number,
    userId: number,
    limit: number = 10,
  ): Promise<CalendarEventResponse[]> {
    const today = new Date();
    // End of current month
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const todayStr = today.toISOString().split('T')[0];
    const endOfMonthStr = endOfMonth.toISOString().split('T')[0];

    const userRole = await this.getUserRole(userId, tenantId);
    const hasUnrestrictedAccess = userRole.has_full_access || userRole.role === 'root';

    let query = `
      SELECT e.*, u.username as creator_name
      FROM calendar_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.tenant_id = $1 AND e.status = 'confirmed'
      AND e.start_date >= $2 AND e.start_date <= $3
    `;
    const params: unknown[] = [tenantId, todayStr, endOfMonthStr];

    // Permission-based access control
    if (!hasUnrestrictedAccess) {
      // Regular users: full visibility check
      query += ` AND ${buildVisibilityClause(4, 1)}`;
      params.push(userId);
    } else {
      // ADR-010: Even admins/root can only see their OWN personal events
      query += ` AND (e.org_level != 'personal' OR e.user_id = $4)`;
      params.push(userId);
    }

    const limitIndex = params.length + 1;
    query += ` ORDER BY e.start_date ASC LIMIT $${limitIndex}`;
    params.push(limit);

    const events = await this.databaseService.query<DbCalendarEvent>(query, params);
    return events.map((e: DbCalendarEvent) => this.dbToApiEvent(e));
  }

  /**
   * Get recently added events (last 3 by created_at)
   * Shows the newest events regardless of their start date
   */
  async getRecentlyAddedEvents(
    tenantId: number,
    userId: number,
    limit: number = 3,
  ): Promise<CalendarEventResponse[]> {
    const userRole = await this.getUserRole(userId, tenantId);
    const hasUnrestrictedAccess = userRole.has_full_access || userRole.role === 'root';

    let query = `
      SELECT e.*, u.username as creator_name
      FROM calendar_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.tenant_id = $1 AND e.status = 'confirmed'
    `;
    const params: unknown[] = [tenantId];

    // Permission-based access control
    if (!hasUnrestrictedAccess) {
      // Regular users: full visibility check
      query += ` AND ${buildVisibilityClause(2, 1)}`;
      params.push(userId);
    } else {
      // ADR-010: Even admins/root can only see their OWN personal events
      query += ` AND (e.org_level != 'personal' OR e.user_id = $2)`;
      params.push(userId);
    }

    const limitIndex = params.length + 1;
    query += ` ORDER BY e.created_at DESC LIMIT $${limitIndex}`;
    params.push(limit);

    const events = await this.databaseService.query<DbCalendarEvent>(query, params);
    return events.map((e: DbCalendarEvent) => this.dbToApiEvent(e));
  }

  // ============================================
  // Private Helper Methods
  // ============================================
  /**
   * Get user role info with department and team
   */
  private async getUserRole(userId: number, tenantId: number): Promise<UserRoleInfo> {
    const rows = await this.databaseService.query<UserRoleInfo>(
      `SELECT u.role,
              u.has_full_access,
              ud.department_id,
              ut.team_id
       FROM users u
       LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
       LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
       WHERE u.id = $1 AND u.tenant_id = $2
       LIMIT 1`,
      [userId, tenantId],
    );
    return (
      rows[0] ?? {
        role: null,
        department_id: null,
        team_id: null,
        has_full_access: false,
      }
    );
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
   * Build org level filter for ADMIN users (UI filter only, no visibility restrictions)
   * Admins can see ALL events but may want to filter by org_level type
   */
  private buildAdminOrgLevelFilter(
    filterType: string,
    userId: number,
    startIndex: number,
  ): { clause: string; newParams: unknown[]; newIndex: number } {
    const params: unknown[] = [];
    let clause = '';
    let index = startIndex;

    switch (filterType) {
      case 'company':
        clause = ` AND e.org_level = 'company'`;
        break;
      case 'area':
        clause = ` AND e.org_level = 'area'`;
        break;
      case 'department':
        clause = ` AND e.org_level = 'department'`;
        break;
      case 'team':
        clause = ` AND e.org_level = 'team'`;
        break;
      case 'personal':
        // For admins, show their own personal events only
        clause = ` AND e.org_level = 'personal' AND e.user_id = $${index}`;
        params.push(userId);
        index++;
        break;
      default:
        // 'all' - show everything EXCEPT other users' personal events
        // ADR-010: personal events are ONLY visible to their creator
        clause = ` AND (e.org_level != 'personal' OR e.user_id = $${index})`;
        params.push(userId);
        index++;
        break;
    }

    return { clause, newParams: params, newIndex: index };
  }

  /**
   * Build permission-based filter for users without full_access
   * Uses shared buildVisibilityClause helper for consistency
   */
  private buildPermissionBasedFilter(
    filterType: string,
    userId: number,
    tenantId: number,
    startIndex: number,
  ): { clause: string; newParams: unknown[]; newIndex: number } {
    // Use helper to build visibility clause with correct parameter indices
    const visibilityClause = buildVisibilityClause(startIndex, startIndex + 1);
    let clause = ` AND ${visibilityClause}`;

    // Apply additional UI filter if requested
    const orgLevelFilters: Record<string, string> = {
      company: ` AND e.org_level = 'company'`,
      area: ` AND e.org_level = 'area'`,
      department: ` AND e.org_level = 'department'`,
      team: ` AND e.org_level = 'team'`,
      personal: ` AND e.org_level = 'personal'`,
    };
    clause += orgLevelFilters[filterType] ?? '';

    return { clause, newParams: [userId, tenantId], newIndex: startIndex + 2 };
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
    return { page, limit, offset: (page - 1) * limit };
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

  // ==========================================================================
  // NOTIFICATION COUNT METHODS
  // ==========================================================================
  /**
   * Get count of upcoming events for notification badge
   * Counts events created AFTER user's last visit to calendar
   * Events must also start within the next 7 days
   */
  async getUpcomingCount(
    tenantId: number,
    userId: number,
    _userDepartmentId: number | null,
    _userTeamId: number | null,
  ): Promise<{ count: number }> {
    const userRole = await this.getUserRole(userId, tenantId);
    const lastVisited = await this.featureVisitsService.getLastVisited(
      tenantId,
      userId,
      'calendar',
    );

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(startOfDay);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    // CRITICAL: Only root OR has_full_access=true gets unrestricted access
    // Regular admins use permission-based visibility like employees
    const hasUnrestrictedAccess = userRole.has_full_access || userRole.role === 'root';
    const lastVisitDate = lastVisited ?? new Date('1970-01-01');

    const count =
      hasUnrestrictedAccess ?
        await this.countUpcomingForFullAccess(
          tenantId,
          userId,
          startOfDay,
          endOfWeek,
          lastVisitDate,
        )
      : await this.countUpcomingWithPermissions(
          tenantId,
          userId,
          startOfDay,
          endOfWeek,
          lastVisitDate,
        );

    return { count };
  }

  /**
   * Count upcoming events for users with unrestricted access (root or has_full_access=true)
   */
  private async countUpcomingForFullAccess(
    tenantId: number,
    userId: number,
    startOfDay: Date,
    endOfWeek: Date,
    lastVisited: Date,
  ): Promise<number> {
    // ADR-010: Exclude other users' personal events from count
    const query = `
      SELECT COUNT(DISTINCT e.id) as count
      FROM calendar_events e
      WHERE e.tenant_id = $1
        AND e.start_date >= $2
        AND e.start_date < $3
        AND e.status != 'cancelled'
        AND e.created_at > $4
        AND e.user_id != $5
        AND (e.org_level != 'personal' OR e.user_id = $5)
    `;
    const result = await this.databaseService.query<{ count: string }>(query, [
      tenantId,
      startOfDay,
      endOfWeek,
      lastVisited,
      userId,
    ]);
    return Number.parseInt(result[0]?.count ?? '0', 10);
  }

  /**
   * Count upcoming events with permission-based visibility
   * Uses PERMISSION_BASED_COUNT_QUERY constant for visibility rules
   */
  private async countUpcomingWithPermissions(
    tenantId: number,
    userId: number,
    startOfDay: Date,
    endOfWeek: Date,
    lastVisited: Date,
  ): Promise<number> {
    const result = await this.databaseService.query<{ count: string }>(
      PERMISSION_BASED_COUNT_QUERY,
      [tenantId, startOfDay, endOfWeek, lastVisited, userId],
    );
    return Number.parseInt(result[0]?.count ?? '0', 10);
  }
}
