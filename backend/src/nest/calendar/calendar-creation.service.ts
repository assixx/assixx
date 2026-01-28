/**
 * Calendar Creation Service
 *
 * Handles event creation logic including:
 * - Event insertion with org target determination
 * - Recurrence child event creation
 * - Attendee management
 * - Activity logging
 */
import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { OrgTarget } from './calendar.types.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import type { UpdateEventDto } from './dto/update-event.dto.js';

@Injectable()
export class CalendarCreationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /**
   * Insert a single event into the database
   */
  async insertEvent(
    dto: CreateEventDto,
    tenantId: number,
    userId: number,
    startDate: Date,
    endDate: Date,
    parentEventId: number | null,
    recurrenceRule: string | null,
  ): Promise<number> {
    const eventUuid = uuidv7();
    const { orgLevel, departmentId, teamId, areaId } =
      this.determineOrgTarget(dto);

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
   * Create child events for recurrence series
   */
  async createChildEvents(
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
      await this.addAttendeesToEvent(
        childEventId,
        userId,
        dto.attendeeIds,
        tenantId,
      );
    }
  }

  /**
   * Add creator and additional attendees to an event
   */
  async addAttendeesToEvent(
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
   * Add single event attendee (idempotent)
   */
  async addEventAttendee(
    eventId: number,
    userId: number,
    tenantId: number,
  ): Promise<void> {
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

  /**
   * Determine org_level, department_id, team_id, and area_id from DTO
   * Priority for orgLevel: area \> department \> team \> company \> personal
   * IMPORTANT: Keep ALL provided IDs (area, department, team can coexist)
   * The orgLevel only determines primary visibility scope
   */
  determineOrgTarget(dto: CreateEventDto | UpdateEventDto): OrgTarget {
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
   * Log calendar event creation to root_logs
   */
  async logEventCreated(
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
}
