/**
 * Calendar Overview Service
 *
 * Handles dashboard views and notification counts for calendar.
 * Provides aggregated event data for overview pages and badge counts.
 */
import { Injectable } from '@nestjs/common';

import { AddonVisitsService } from '../addon-visits/addon-visits.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ScopeService } from '../hierarchy-permission/scope.service.js';
import { CalendarPermissionService } from './calendar-permission.service.js';
import { buildVisibilityClause, dbToApiEvent } from './calendar.helpers.js';
import type { CalendarEventResponse, DbCalendarEvent } from './calendar.types.js';

@Injectable()
export class CalendarOverviewService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly addonVisitsService: AddonVisitsService,
    private readonly permissionService: CalendarPermissionService,
    private readonly scopeService: ScopeService,
  ) {}

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

    const scope = await this.scopeService.getScope();
    const memberships = await this.permissionService.getUserMemberships(userId, tenantId);

    let query = `
      SELECT e.*, u.username as creator_name
      FROM calendar_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.tenant_id = $1 AND e.status = 'confirmed'
      AND e.start_date >= $2 AND e.start_date <= $3
    `;
    const params: unknown[] = [tenantId, todayStr, endOfMonthStr];

    if (scope.type === 'full') {
      // ADR-010: Even admins/root can only see their OWN personal events
      query += ` AND (e.org_level != 'personal' OR e.user_id = $4)`;
      params.push(userId);
    } else {
      const { clause, params: visParams } = buildVisibilityClause(scope, memberships, userId, 4);
      query += ` AND ${clause}`;
      params.push(...visParams);
    }

    const limitIndex = params.length + 1;
    query += ` ORDER BY e.start_date ASC LIMIT $${limitIndex}`;
    params.push(limit);

    const events = await this.databaseService.query<DbCalendarEvent>(query, params);
    return events.map((e: DbCalendarEvent) => dbToApiEvent(e));
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
    const scope = await this.scopeService.getScope();
    const memberships = await this.permissionService.getUserMemberships(userId, tenantId);

    let query = `
      SELECT e.*, u.username as creator_name
      FROM calendar_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.tenant_id = $1 AND e.status = 'confirmed'
    `;
    const params: unknown[] = [tenantId];

    if (scope.type === 'full') {
      // ADR-010: Even admins/root can only see their OWN personal events
      query += ` AND (e.org_level != 'personal' OR e.user_id = $2)`;
      params.push(userId);
    } else {
      const { clause, params: visParams } = buildVisibilityClause(scope, memberships, userId, 2);
      query += ` AND ${clause}`;
      params.push(...visParams);
    }

    const limitIndex = params.length + 1;
    query += ` ORDER BY e.created_at DESC LIMIT $${limitIndex}`;
    params.push(limit);

    const events = await this.databaseService.query<DbCalendarEvent>(query, params);
    return events.map((e: DbCalendarEvent) => dbToApiEvent(e));
  }

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
    const scope = await this.scopeService.getScope();
    const lastVisited = await this.addonVisitsService.getLastVisited(tenantId, userId, 'calendar');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(startOfDay);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const lastVisitDate = lastVisited ?? new Date('1970-01-01');

    const count =
      scope.type === 'full' ?
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
   * Count upcoming events with scope + membership visibility.
   * Preserves e.user_id != $N (creator-exclusion for badge count).
   */
  private async countUpcomingWithPermissions(
    tenantId: number,
    userId: number,
    startOfDay: Date,
    endOfWeek: Date,
    lastVisited: Date,
  ): Promise<number> {
    const scope = await this.scopeService.getScope();
    const memberships = await this.permissionService.getUserMemberships(userId, tenantId);

    if (
      scope.type === 'none' &&
      memberships.departmentIds.length === 0 &&
      memberships.teamIds.length === 0
    ) {
      return 0;
    }

    const { clause, params: visParams } = buildVisibilityClause(scope, memberships, userId, 6);

    const query = `
      SELECT COUNT(DISTINCT e.id) as count
      FROM calendar_events e
      WHERE e.tenant_id = $1
        AND e.start_date >= $2
        AND e.start_date < $3
        AND e.status != 'cancelled'
        AND e.created_at > $4
        AND e.user_id != $5
        AND ${clause}
    `;

    const result = await this.databaseService.query<{ count: string }>(query, [
      tenantId,
      startOfDay,
      endOfWeek,
      lastVisited,
      userId,
      ...visParams,
    ]);
    return Number.parseInt(result[0]?.count ?? '0', 10);
  }
}
