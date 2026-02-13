/**
 * Vacation Queries Service
 *
 * Read-only query methods for vacation requests:
 * - Single request lookup by ID
 * - Paginated own/incoming request lists
 * - Status history log
 * - Team calendar view
 *
 * Extracted from VacationService to respect max-lines limit.
 * All queries via db.tenantTransaction() (ADR-019).
 * Returns raw data — ResponseInterceptor wraps (ADR-007).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../database/database.service.js';
import type { VacationQueryDto } from './dto/vacation-query.dto.js';
import type {
  CalendarVacationEntry,
  PaginatedResult,
  TeamCalendarData,
  TeamCalendarEntry,
  VacationRequest,
  VacationRequestRow,
  VacationRequestStatus,
  VacationStatusLogEntry,
} from './vacation.types.js';

/** Request row with resolved names */
interface RequestWithNamesRow extends VacationRequestRow {
  requester_name: string | null;
  approver_name: string | null;
  substitute_name: string | null;
}

/** Paginated count */
interface CountRow {
  total: string;
}

/** Status log row with changer name */
interface StatusLogRow {
  id: string;
  request_id: string;
  old_status: VacationRequestStatus | null;
  new_status: VacationRequestStatus;
  changed_by: number;
  changed_by_name: string | null;
  note: string | null;
  created_at: string;
}

/** Calendar vacation row (own vacations for calendar indicator) */
interface CalVacRow {
  start_date: string;
  end_date: string;
  vacation_type: string;
  half_day_start: string;
  half_day_end: string;
}

/** Calendar query row */
interface CalRow {
  user_id: number;
  user_name: string;
  start_date: string;
  end_date: string;
  vacation_type: string;
  half_day_start: string;
  half_day_end: string;
}

@Injectable()
export class VacationQueriesService {
  constructor(private readonly db: DatabaseService) {}

  /** Get a single vacation request by ID with resolved names. */
  async getRequestById(
    tenantId: number,
    requestId: string,
  ): Promise<VacationRequest> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationRequest> => {
        const result = await client.query<RequestWithNamesRow>(
          `SELECT vr.*,
                  CONCAT(req.first_name, ' ', req.last_name) AS requester_name,
                  CONCAT(app.first_name, ' ', app.last_name) AS approver_name,
                  CONCAT(sub.first_name, ' ', sub.last_name) AS substitute_name
           FROM vacation_requests vr
           LEFT JOIN users req ON vr.requester_id = req.id
           LEFT JOIN users app ON vr.approver_id = app.id
           LEFT JOIN users sub ON vr.substitute_id = sub.id
           WHERE vr.id = $1 AND vr.tenant_id = $2 AND vr.is_active = 1`,
          [requestId, tenantId],
        );
        const row = result.rows[0];
        if (row === undefined) {
          throw new NotFoundException(`Request ${requestId} not found`);
        }
        return this.mapRowToRequestWithNames(row);
      },
    );
  }

  /** Get own vacation requests (paginated). */
  async getMyRequests(
    userId: number,
    tenantId: number,
    query: VacationQueryDto,
  ): Promise<PaginatedResult<VacationRequest>> {
    return await this.db.tenantTransaction(async (client: PoolClient) => {
      const { whereClauses, params } = this.buildFilters(tenantId, query);
      whereClauses.push(`vr.requester_id = $${params.length + 1}`);
      params.push(userId);
      return await this.paginatedQuery(
        client,
        whereClauses,
        params,
        query.page,
        query.limit,
      );
    });
  }

  /** Get incoming vacation requests for an approver (paginated). */
  async getIncomingRequests(
    approverId: number,
    tenantId: number,
    query: VacationQueryDto,
  ): Promise<PaginatedResult<VacationRequest>> {
    return await this.db.tenantTransaction(async (client: PoolClient) => {
      const { whereClauses, params } = this.buildFilters(tenantId, query);
      whereClauses.push(`vr.approver_id = $${params.length + 1}`);
      params.push(approverId);
      return await this.paginatedQuery(
        client,
        whereClauses,
        params,
        query.page,
        query.limit,
      );
    });
  }

  /** Get status history log for a request. */
  async getStatusLog(
    tenantId: number,
    requestId: string,
  ): Promise<VacationStatusLogEntry[]> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationStatusLogEntry[]> => {
        const result = await client.query<StatusLogRow>(
          `SELECT sl.id, sl.request_id, sl.old_status, sl.new_status,
                  sl.changed_by, sl.note, sl.created_at,
                  CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name
           FROM vacation_request_status_log sl
           LEFT JOIN users u ON sl.changed_by = u.id
           WHERE sl.request_id = $1 AND sl.tenant_id = $2
           ORDER BY sl.created_at ASC`,
          [requestId, tenantId],
        );
        return result.rows.map((row: StatusLogRow) =>
          this.mapStatusLogRow(row),
        );
      },
    );
  }

  /** Get team calendar for a given month (approved vacations). */
  async getTeamCalendar(
    tenantId: number,
    teamId: number,
    month: number,
    year: number,
  ): Promise<TeamCalendarData> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TeamCalendarData> => {
        const teamName = await this.getTeamName(client, tenantId, teamId);
        const { monthStart, monthEnd } = this.getMonthBounds(year, month);
        const entries = await this.queryCalendarEntries(
          client,
          tenantId,
          teamId,
          monthStart,
          monthEnd,
        );
        return { teamId, teamName, month, year, entries };
      },
    );
  }

  /** Get current user's approved vacations for calendar indicator display. */
  async getMyCalendarVacations(
    userId: number,
    tenantId: number,
    startDate: string,
    endDate: string,
  ): Promise<CalendarVacationEntry[]> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<CalendarVacationEntry[]> => {
        const result = await client.query<CalVacRow>(
          `SELECT vr.start_date, vr.end_date, vr.vacation_type,
                  vr.half_day_start, vr.half_day_end
           FROM vacation_requests vr
           WHERE vr.tenant_id = $1
             AND vr.requester_id = $2
             AND vr.status = 'approved'
             AND vr.is_active = 1
             AND vr.start_date <= $4
             AND vr.end_date >= $3
           ORDER BY vr.start_date ASC`,
          [tenantId, userId, startDate, endDate],
        );
        return result.rows.map(
          (row: CalVacRow): CalendarVacationEntry => ({
            startDate: this.fmtDate(row.start_date),
            endDate: this.fmtDate(row.end_date),
            vacationType:
              row.vacation_type as CalendarVacationEntry['vacationType'],
            halfDayStart:
              row.half_day_start as CalendarVacationEntry['halfDayStart'],
            halfDayEnd: row.half_day_end as CalendarVacationEntry['halfDayEnd'],
          }),
        );
      },
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private buildFilters(
    tenantId: number,
    query: VacationQueryDto,
  ): { whereClauses: string[]; params: unknown[] } {
    const whereClauses: string[] = [`vr.tenant_id = $1`, `vr.is_active = 1`];
    const params: unknown[] = [tenantId];
    if (query.year !== undefined) {
      whereClauses.push(
        `EXTRACT(YEAR FROM vr.start_date) = $${params.length + 1}`,
      );
      params.push(query.year);
    }
    if (query.status !== undefined) {
      whereClauses.push(`vr.status = $${params.length + 1}`);
      params.push(query.status);
    }
    if (query.vacationType !== undefined) {
      whereClauses.push(`vr.vacation_type = $${params.length + 1}`);
      params.push(query.vacationType);
    }
    return { whereClauses, params };
  }

  private async paginatedQuery(
    client: PoolClient,
    whereClauses: string[],
    params: unknown[],
    page: number,
    limit: number,
  ): Promise<PaginatedResult<VacationRequest>> {
    const whereSQL = whereClauses.join(' AND ');
    const countResult = await client.query<CountRow>(
      `SELECT COUNT(*)::text AS total FROM vacation_requests vr WHERE ${whereSQL}`,
      params,
    );
    const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const oIdx = params.length + 1;
    const lIdx = params.length + 2;
    params.push(offset, limit);

    const result = await client.query<RequestWithNamesRow>(
      `SELECT vr.*,
              CONCAT(req.first_name, ' ', req.last_name) AS requester_name,
              CONCAT(app.first_name, ' ', app.last_name) AS approver_name,
              CONCAT(sub.first_name, ' ', sub.last_name) AS substitute_name
       FROM vacation_requests vr
       LEFT JOIN users req ON vr.requester_id = req.id
       LEFT JOIN users app ON vr.approver_id = app.id
       LEFT JOIN users sub ON vr.substitute_id = sub.id
       WHERE ${whereSQL} ORDER BY vr.created_at DESC OFFSET $${oIdx} LIMIT $${lIdx}`,
      params,
    );
    const data = result.rows.map((row: RequestWithNamesRow) =>
      this.mapRowToRequestWithNames(row),
    );
    return { data, total, page, limit, totalPages };
  }

  private async getTeamName(
    client: PoolClient,
    tenantId: number,
    teamId: number,
  ): Promise<string> {
    const result = await client.query<{ name: string }>(
      `SELECT name FROM teams WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [teamId, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Team ${String(teamId)} not found`);
    }
    return row.name;
  }

  private getMonthBounds(
    year: number,
    month: number,
  ): { monthStart: string; monthEnd: string } {
    const m = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return {
      monthStart: `${String(year)}-${m}-01`,
      monthEnd: `${String(year)}-${m}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private async queryCalendarEntries(
    client: PoolClient,
    tenantId: number,
    teamId: number,
    monthStart: string,
    monthEnd: string,
  ): Promise<TeamCalendarEntry[]> {
    const result = await client.query<CalRow>(
      `SELECT vr.requester_id AS user_id,
              CONCAT(u.first_name, ' ', u.last_name) AS user_name,
              vr.start_date, vr.end_date, vr.vacation_type,
              vr.half_day_start, vr.half_day_end
       FROM vacation_requests vr
       JOIN user_teams ut ON vr.requester_id = ut.user_id
       JOIN users u ON vr.requester_id = u.id
       WHERE vr.tenant_id = $1 AND ut.team_id = $2 AND vr.status = 'approved'
         AND vr.is_active = 1 AND vr.start_date <= $4 AND vr.end_date >= $3
       ORDER BY vr.start_date ASC, u.last_name ASC`,
      [tenantId, teamId, monthStart, monthEnd],
    );
    return result.rows.map((row: CalRow) => ({
      userId: row.user_id,
      userName: row.user_name,
      startDate: this.fmtDate(row.start_date),
      endDate: this.fmtDate(row.end_date),
      vacationType: row.vacation_type as TeamCalendarEntry['vacationType'],
      halfDayStart: row.half_day_start as TeamCalendarEntry['halfDayStart'],
      halfDayEnd: row.half_day_end as TeamCalendarEntry['halfDayEnd'],
    }));
  }

  // ==========================================================================
  // Mapping
  // ==========================================================================

  private mapRowToRequest(row: VacationRequestRow): VacationRequest {
    return {
      id: row.id,
      requesterId: row.requester_id,
      approverId: row.approver_id,
      substituteId: row.substitute_id,
      startDate: this.fmtDate(row.start_date),
      endDate: this.fmtDate(row.end_date),
      halfDayStart: row.half_day_start,
      halfDayEnd: row.half_day_end,
      vacationType: row.vacation_type,
      status: row.status,
      computedDays: Number.parseFloat(row.computed_days),
      isSpecialLeave: row.is_special_leave,
      requestNote: row.request_note,
      responseNote: row.response_note,
      respondedAt: row.responded_at,
      respondedBy: row.responded_by,
      createdAt:
        typeof row.created_at === 'string' ?
          row.created_at
        : new Date(row.created_at).toISOString(),
      updatedAt:
        typeof row.updated_at === 'string' ?
          row.updated_at
        : new Date(row.updated_at).toISOString(),
    };
  }

  private mapRowToRequestWithNames(row: RequestWithNamesRow): VacationRequest {
    const base = this.mapRowToRequest(row);
    if (row.requester_name !== null) base.requesterName = row.requester_name;
    if (row.approver_name !== null) base.approverName = row.approver_name;
    if (row.substitute_name !== null) base.substituteName = row.substitute_name;
    return base;
  }

  private mapStatusLogRow(row: StatusLogRow): VacationStatusLogEntry {
    const entry: VacationStatusLogEntry = {
      id: row.id,
      requestId: row.request_id,
      oldStatus: row.old_status,
      newStatus: row.new_status,
      changedBy: row.changed_by,
      note: row.note,
      createdAt:
        typeof row.created_at === 'string' ?
          row.created_at
        : new Date(row.created_at).toISOString(),
    };
    if (row.changed_by_name !== null) {
      entry.changedByName = row.changed_by_name;
    }
    return entry;
  }

  /** Format a date value as YYYY-MM-DD. */
  private fmtDate(dateInput: string | Date): string {
    if (typeof dateInput === 'string') return dateInput.slice(0, 10);
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${String(y)}-${m}-${d}`;
  }
}
