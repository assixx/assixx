/**
 * Calendar Permission Service
 *
 * Handles access control and permission-based filtering for calendar events.
 * Determines user visibility based on org hierarchy, roles, and memberships.
 */
import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { OrganizationalScope } from '../hierarchy-permission/organizational-scope.types.js';
import { buildVisibilityClause } from './calendar.helpers.js';
import type { CalendarMemberships, DbCalendarEvent, DbEventAttendee } from './calendar.types.js';

@Injectable()
export class CalendarPermissionService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Get user's organizational memberships (departments + teams).
   * Separate from OrganizationalScope (manage-page access) — see R7 in masterplan.
   */
  async getUserMemberships(userId: number, tenantId: number): Promise<CalendarMemberships> {
    const rows = await this.databaseService.query<{
      department_ids: number[] | null;
      team_ids: number[] | null;
    }>(
      `SELECT
         (SELECT ARRAY_AGG(DISTINCT ud.department_id)
          FROM user_departments ud
          WHERE ud.user_id = u.id AND ud.tenant_id = u.tenant_id) AS department_ids,
         (SELECT ARRAY_AGG(DISTINCT ut.team_id)
          FROM user_teams ut
          WHERE ut.user_id = u.id AND ut.tenant_id = u.tenant_id) AS team_ids
       FROM users u
       WHERE u.id = $1 AND u.tenant_id = $2`,
      [userId, tenantId],
    );

    const row = rows[0];
    return {
      departmentIds: row?.department_ids ?? [],
      teamIds: row?.team_ids ?? [],
    };
  }

  /**
   * Check if user has access to a specific event.
   * Uses Scope (management access) + Memberships (content visibility).
   * Bug-Fix F2: Now includes area-level check via scope.areaIds.
   */
  async checkEventAccess(
    event: DbCalendarEvent,
    userId: number,
    scope: OrganizationalScope,
    memberships: CalendarMemberships,
  ): Promise<boolean> {
    if (scope.type === 'full') return true;
    if (event.user_id === userId) return true;
    if (event.org_level === 'company') return true;

    // Merge scope + memberships for visibility
    const deptIds = [...new Set([...scope.departmentIds, ...memberships.departmentIds])];
    const teamIds = [...new Set([...scope.teamIds, ...memberships.teamIds])];

    if (
      event.org_level === 'area' &&
      event.area_id !== null &&
      scope.areaIds.includes(event.area_id)
    ) {
      return true;
    }

    if (
      event.org_level === 'department' &&
      event.department_id !== null &&
      deptIds.includes(event.department_id)
    ) {
      return true;
    }

    if (event.org_level === 'team' && event.team_id !== null && teamIds.includes(event.team_id)) {
      return true;
    }

    // Attendee check (DB query, last resort)
    const attendees = await this.databaseService.query<{ user_id: number }>(
      `SELECT user_id FROM calendar_attendees WHERE event_id = $1 AND user_id = $2`,
      [event.id, userId],
    );
    return attendees.length > 0;
  }

  /**
   * Get event attendees
   */
  async getEventAttendees(eventId: number, tenantId: number): Promise<DbEventAttendee[]> {
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
   * Build org level filter for ADMIN users (UI filter only, no visibility restrictions)
   * Admins can see ALL events but may want to filter by org_level type
   */
  buildAdminOrgLevelFilter(
    filterType: string,
    userId: number,
    startIndex: number,
  ): { clause: string; newParams: unknown[]; newIndex: number } {
    const params: unknown[] = [];
    // eslint-disable-next-line no-useless-assignment -- init required, TypeScript needs definite assignment before switch
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
   * Build permission-based filter for users without full_access.
   * Combines scope-based visibility clause with optional org-level UI filter.
   */
  buildPermissionBasedFilter(
    filterType: string,
    scope: OrganizationalScope,
    memberships: CalendarMemberships,
    userId: number,
    startIndex: number,
  ): { clause: string; newParams: unknown[]; newIndex: number } {
    const { clause: visClause, params } = buildVisibilityClause(
      scope,
      memberships,
      userId,
      startIndex,
    );

    let clause = ` AND ${visClause}`;

    // Apply additional UI filter if requested
    const orgLevelFilters: Record<string, string> = {
      company: ` AND e.org_level = 'company'`,
      area: ` AND e.org_level = 'area'`,
      department: ` AND e.org_level = 'department'`,
      team: ` AND e.org_level = 'team'`,
      personal: ` AND e.org_level = 'personal'`,
    };
    clause += orgLevelFilters[filterType] ?? '';

    // 4 params: areaIds, deptIds, teamIds, userId
    return { clause, newParams: params, newIndex: startIndex + 4 };
  }
}
