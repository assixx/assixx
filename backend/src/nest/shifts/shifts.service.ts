/**
 * Shifts Service (Facade)
 *
 * Thin orchestration layer for shift management.
 * Delegates plan operations to ShiftPlansService and
 * swap operations to ShiftSwapService.
 * Keeps shifts CRUD, favorites, overtime, export, and calendar
 * (all under the Decision Framework threshold for own sub-services).
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';

import { apiToDb, dbToApi } from '../../utils/fieldMapper.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateShiftDto } from './dto/create-shift.dto.js';
import type { CreateSwapRequestDto } from './dto/create-swap-request.dto.js';
import type { CreateFavoriteDto } from './dto/favorite.dto.js';
import type { CreateShiftPlanDto } from './dto/shift-plan.dto.js';
import type { UpdateSwapRequestStatusDto } from './dto/swap-request-status.dto.js';
import type { UpdateShiftPlanDto } from './dto/update-shift-plan.dto.js';
import type { UpdateShiftDto } from './dto/update-shift.dto.js';
import { ShiftPlansService } from './shift-plans.service.js';
import { ShiftSwapService } from './shift-swap.service.js';
import {
  buildTimestamp,
  calculateHours,
  convertTimeFieldsToTimestamps,
  dbShiftToApi,
} from './shifts.helpers.js';
import type {
  AssignmentCountResponse,
  CalendarShiftResponse,
  DbFavoriteRow,
  DbShiftRow,
  ExportFilters,
  FavoriteResponse,
  OvertimeFilters,
  ShiftFilters,
  ShiftPlanFilters,
  ShiftPlanResponse,
  ShiftResponse,
  SwapRequestFilters,
  SwapRequestResponse,
} from './shifts.types.js';

// Re-export types for backward compatibility (controller and index.ts import from here)
export type {
  AssignmentCountResponse,
  CalendarShiftResponse,
  ExportFilters,
  FavoriteResponse,
  OvertimeFilters,
  ShiftFilters,
  ShiftPlanFilters,
  ShiftPlanResponse,
  ShiftResponse,
  SwapRequestFilters,
  SwapRequestResponse,
} from './shifts.types.js';

/** DB row shape for assignment count query */
interface DbAssignmentCountRow {
  user_id: number;
  first_name: string;
  last_name: string;
  week_count: string;
  month_count: string;
  year_count: string;
}

/** UNION ALL query: shifts + shift_rotation_history with period FILTER */
const ASSIGNMENT_COUNTS_SQL = `
  WITH team_employees AS (
    SELECT DISTINCT ut.user_id
    FROM user_teams ut
    JOIN users u ON u.id = ut.user_id
    WHERE ut.team_id = $2 AND ut.tenant_id = $1 AND u.role = 'employee'
  ),
  all_shifts AS (
    SELECT s.user_id, s.date
    FROM shifts s
    WHERE s.tenant_id = $1
      AND s.user_id IN (SELECT user_id FROM team_employees)
    UNION ALL
    SELECT h.user_id, h.shift_date AS date
    FROM shift_rotation_history h
    WHERE h.tenant_id = $1
      AND h.user_id IN (SELECT user_id FROM team_employees)
  )
  SELECT
    te.user_id, u.first_name, u.last_name,
    COUNT(a.date) FILTER (
      WHERE a.date >= DATE_TRUNC('week', $3::date)
        AND a.date < DATE_TRUNC('week', $3::date) + INTERVAL '7 days'
    ) AS week_count,
    COUNT(a.date) FILTER (
      WHERE a.date >= DATE_TRUNC('month', $3::date)
        AND a.date < DATE_TRUNC('month', $3::date) + INTERVAL '1 month'
    ) AS month_count,
    COUNT(a.date) FILTER (
      WHERE a.date >= DATE_TRUNC('year', $3::date)
        AND a.date < DATE_TRUNC('year', $3::date) + INTERVAL '1 year'
    ) AS year_count
  FROM team_employees te
  JOIN users u ON u.id = te.user_id
  LEFT JOIN all_shifts a ON a.user_id = te.user_id
  GROUP BY te.user_id, u.first_name, u.last_name
  ORDER BY u.last_name, u.first_name`;

function mapAssignmentCountRow(
  r: DbAssignmentCountRow,
): AssignmentCountResponse {
  return {
    employeeId: r.user_id,
    firstName: r.first_name,
    lastName: r.last_name,
    weekCount: Number.parseInt(r.week_count, 10),
    monthCount: Number.parseInt(r.month_count, 10),
    yearCount: Number.parseInt(r.year_count, 10),
  };
}

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly shiftPlansService: ShiftPlansService,
    private readonly shiftSwapService: ShiftSwapService,
  ) {}

  // ============================================================
  // SHIFTS CRUD
  // ============================================================

  /**
   * Builds WHERE conditions and params for shift filters
   */
  private buildShiftFilterConditions(
    filters: ShiftFilters,
    startParamIndex: number,
  ): { conditions: string; params: unknown[]; nextIndex: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = startParamIndex;

    const filterMap: {
      key: keyof ShiftFilters;
      column: string;
      isDate?: boolean;
    }[] = [
      { key: 'date', column: 'DATE(s.date)', isDate: true },
      { key: 'startDate', column: 's.date' },
      { key: 'endDate', column: 's.date' },
      { key: 'userId', column: 's.user_id' },
      { key: 'departmentId', column: 's.department_id' },
      { key: 'teamId', column: 's.team_id' },
      { key: 'status', column: 's.status' },
      { key: 'type', column: 's.type' },
      { key: 'planId', column: 's.plan_id' },
    ];

    for (const { key, column, isDate } of filterMap) {
      if (filters[key] === undefined) continue;
      const op =
        key === 'startDate' ? '>='
        : key === 'endDate' ? '<='
        : '=';
      conditions.push(
        isDate === true ? `${column} = $${idx}` : `${column} ${op} $${idx}`,
      );

      params.push(filters[key]);
      idx++;
    }

    return { conditions: conditions.join(' AND '), params, nextIndex: idx };
  }

  async listShifts(
    tenantId: number,
    filters: ShiftFilters,
  ): Promise<ShiftResponse[]> {
    this.logger.debug(`Listing shifts for tenant ${tenantId}`);

    const baseQuery = `
      SELECT s.*, u.username as user_name, u.first_name, u.last_name,
        d.name as department_name, t.name as team_name
      FROM shifts s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN teams t ON s.team_id = t.id
      WHERE s.tenant_id = $1`;

    const {
      conditions,
      params: filterParams,
      nextIndex,
    } = this.buildShiftFilterConditions(filters, 2);
    const params: unknown[] = [tenantId, ...filterParams];

    const filterClause = conditions.length > 0 ? ` AND ${conditions}` : '';

    // SECURITY FIX: Whitelist map for ORDER BY to prevent SQL injection
    // Defense-in-depth: Even though Zod validates, we use explicit mapping
    const SORT_COLUMN_MAP: Record<string, string> = {
      date: 's.date',
      startTime: 's.start_time',
      endTime: 's.end_time',
      userId: 's.user_id',
      status: 's.status',
      type: 's.type',
    };
    const sortColumn = SORT_COLUMN_MAP[filters.sortBy] ?? 's.date';
    const sortDirection =
      filters.sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const orderClause = ` ORDER BY ${sortColumn} ${sortDirection}`;
    const limitClause = ` LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`;
    params.push(filters.limit, (filters.page - 1) * filters.limit);

    const query = baseQuery + filterClause + orderClause + limitClause;
    const shifts = await this.databaseService.query<DbShiftRow>(query, params);
    return shifts.map((s: DbShiftRow) => dbShiftToApi(s));
  }

  async getShiftById(id: number, tenantId: number): Promise<ShiftResponse> {
    this.logger.debug(`Getting shift ${id} for tenant ${tenantId}`);

    const shifts = await this.databaseService.query<DbShiftRow>(
      `SELECT s.*,
        u.username as user_name, u.first_name, u.last_name,
        d.name as department_name, t.name as team_name
       FROM shifts s
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN teams t ON s.team_id = t.id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [id, tenantId],
    );

    const shift = shifts[0];
    if (shift === undefined) {
      throw new NotFoundException(`Shift ${id} not found`);
    }

    return dbShiftToApi(shift);
  }

  async createShift(
    dto: CreateShiftDto,
    tenantId: number,
    userId: number,
  ): Promise<ShiftResponse> {
    this.logger.debug(
      `Creating shift for tenant ${tenantId} by user ${userId}`,
    );

    const dbData = apiToDb(dto as unknown as Record<string, unknown>);

    // Combine date + time to create full timestamps for PostgreSQL
    const startTime = buildTimestamp(dbData['date'], dbData['start_time']);
    const endTime = buildTimestamp(dbData['date'], dbData['end_time']);

    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO shifts (
        tenant_id, plan_id, user_id, date, start_time, end_time,
        title, required_employees, break_minutes, status, type, notes,
        area_id, department_id, team_id, machine_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id`,
      [
        tenantId,
        dbData['plan_id'] ?? null,
        dbData['user_id'],
        dbData['date'],
        startTime,
        endTime,
        dbData['title'] ?? null,
        dbData['required_employees'] ?? null,
        dbData['break_minutes'] ?? null,
        dbData['status'] ?? 'planned',
        dbData['type'] ?? null,
        dbData['notes'] ?? null,
        dbData['area_id'] ?? null,
        dbData['department_id'],
        dbData['team_id'] ?? null,
        dbData['machine_id'] ?? null,
        userId,
      ],
    );

    const shiftId = result[0]?.id ?? 0;

    await this.activityLogger.logCreate(
      tenantId,
      userId,
      'shift',
      shiftId,
      `Schicht erstellt: ${dto.date}`,
      {
        date: dto.date,
        userId: dto.userId,
        type: dto.type,
      },
    );

    return await this.getShiftById(shiftId, tenantId);
  }

  async updateShift(
    id: number,
    dto: UpdateShiftDto,
    tenantId: number,
    userId: number,
  ): Promise<ShiftResponse> {
    this.logger.debug(`Updating shift ${id} for tenant ${tenantId}`);

    // Check if shift exists and get current data for date reference
    const existingShift = await this.getShiftById(id, tenantId);

    const dbData = apiToDb(dto as unknown as Record<string, unknown>);

    // Determine the date for timestamp construction (new date or existing)
    const rawDate = dbData['date'];
    const existingDate =
      typeof existingShift.date === 'string' ? existingShift.date : '';
    const dateForTimestamp =
      typeof rawDate === 'string' ? rawDate : existingDate;

    // Convert time-only fields to full timestamps
    convertTimeFieldsToTimestamps(dbData, dateForTimestamp);

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(dbData)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    params.push(id, tenantId);
    await this.databaseService.query(
      `UPDATE shifts SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}`,
      params,
    );

    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'shift',
      id,
      `Schicht aktualisiert: ${existingShift.date}`,
      {
        date: existingShift.date,
        type: existingShift.type,
        status: existingShift.status,
      },
      {
        date: dto.date ?? existingShift.date,
        type: dto.type ?? existingShift.type,
        status: dto.status ?? existingShift.status,
      },
    );

    return await this.getShiftById(id, tenantId);
  }

  async deleteShift(
    id: number,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.debug(`Deleting shift ${id} for tenant ${tenantId}`);

    const existingShift = await this.getShiftById(id, tenantId);
    await this.databaseService.query(
      `DELETE FROM shifts WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    await this.activityLogger.logDelete(
      tenantId,
      userId,
      'shift',
      id,
      `Schicht gelöscht: ${existingShift.date}`,
      {
        date: existingShift.date,
        type: existingShift.type,
        userId: existingShift.userId,
      },
    );

    return { message: 'Shift deleted successfully' };
  }

  /**
   * Delete all shifts for a team in a date range
   */
  async deleteShiftsByWeek(
    teamId: number,
    startDate: string,
    endDate: string,
    tenantId: number,
  ): Promise<{ shiftsDeleted: number }> {
    this.logger.debug(
      `Deleting shifts for team ${teamId} from ${startDate} to ${endDate}`,
    );

    const result = await this.databaseService.query<{ count: string }>(
      `WITH deleted AS (
        DELETE FROM shifts
        WHERE tenant_id = $1 AND team_id = $2 AND date >= $3 AND date <= $4
        RETURNING *
      ) SELECT COUNT(*) as count FROM deleted`,
      [tenantId, teamId, startDate, endDate],
    );

    const shiftsDeleted = Number.parseInt(result[0]?.count ?? '0', 10);
    this.logger.debug(`Deleted ${shiftsDeleted} shifts`);

    return { shiftsDeleted };
  }

  /**
   * Delete ALL shifts for a team (no date range)
   */
  async deleteShiftsByTeam(
    teamId: number,
    tenantId: number,
  ): Promise<{ shiftsDeleted: number }> {
    this.logger.debug(`Deleting ALL shifts for team ${teamId}`);

    const result = await this.databaseService.query<{ count: string }>(
      `WITH deleted AS (
        DELETE FROM shifts
        WHERE tenant_id = $1 AND team_id = $2
        RETURNING *
      ) SELECT COUNT(*) as count FROM deleted`,
      [tenantId, teamId],
    );

    const shiftsDeleted = Number.parseInt(result[0]?.count ?? '0', 10);
    this.logger.debug(`Deleted ${shiftsDeleted} shifts for team ${teamId}`);

    return { shiftsDeleted };
  }

  // ============================================================
  // SHIFT PLANS (delegated to ShiftPlansService)
  // ============================================================

  /**
   * Gets shift plan with shifts — orchestrates findPlan + listShifts
   */
  async getShiftPlan(
    filters: ShiftPlanFilters,
    tenantId: number,
  ): Promise<{ plan?: unknown; shifts: unknown[]; notes: unknown[] }> {
    this.logger.debug(`Getting shift plan for tenant ${tenantId}`);

    const plan = await this.shiftPlansService.findPlan(filters, tenantId);

    // Get shifts for the date range — if we have a plan, use plan_id for more accurate filtering
    const shifts = await this.listShifts(tenantId, {
      startDate: filters.startDate,
      endDate: filters.endDate,
      departmentId: filters.departmentId,
      teamId: filters.teamId,
      planId: plan?.id,
      page: 1,
      limit: 1000,
      sortBy: 'date',
      sortOrder: 'asc',
    });

    return {
      plan:
        plan !== undefined ?
          dbToApi(plan as unknown as Record<string, unknown>)
        : undefined,
      shifts,
      notes: [],
    };
  }

  async createShiftPlan(
    dto: CreateShiftPlanDto,
    tenantId: number,
    userId: number,
  ): Promise<ShiftPlanResponse> {
    return await this.shiftPlansService.createShiftPlan(dto, tenantId, userId);
  }

  async updateShiftPlan(
    planId: number,
    dto: UpdateShiftPlanDto,
    tenantId: number,
    userId: number,
  ): Promise<ShiftPlanResponse> {
    return await this.shiftPlansService.updateShiftPlan(
      planId,
      dto,
      tenantId,
      userId,
    );
  }

  async updateShiftPlanByUuid(
    uuid: string,
    dto: UpdateShiftPlanDto,
    tenantId: number,
    userId: number,
  ): Promise<ShiftPlanResponse> {
    return await this.shiftPlansService.updateShiftPlanByUuid(
      uuid,
      dto,
      tenantId,
      userId,
    );
  }

  async deleteShiftPlanByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    await this.shiftPlansService.deleteShiftPlanByUuid(uuid, tenantId, userId);
  }

  async deleteShiftPlan(
    planId: number,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    await this.shiftPlansService.deleteShiftPlan(planId, tenantId, userId);
  }

  // ============================================================
  // SWAP REQUESTS (delegated to ShiftSwapService)
  // ============================================================

  async listSwapRequests(
    tenantId: number,
    filters: SwapRequestFilters,
  ): Promise<SwapRequestResponse[]> {
    return await this.shiftSwapService.listSwapRequests(tenantId, filters);
  }

  /**
   * Creates a swap request — verifies shift ownership (cross-domain) then delegates
   */
  async createSwapRequest(
    dto: CreateSwapRequestDto,
    tenantId: number,
    userId: number,
  ): Promise<SwapRequestResponse> {
    // Verify shift exists and belongs to user (cross-domain coordination)
    const shift = await this.getShiftById(dto.shiftId, tenantId);
    if (shift.userId !== userId) {
      throw new ForbiddenException(
        'You can only request swaps for your own shifts',
      );
    }

    return await this.shiftSwapService.createSwapRequest(dto, tenantId, userId);
  }

  async updateSwapRequestStatus(
    id: number,
    dto: UpdateSwapRequestStatusDto,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    return await this.shiftSwapService.updateSwapRequestStatus(
      id,
      dto,
      tenantId,
      userId,
    );
  }

  // ============================================================
  // OVERTIME
  // ============================================================

  async getOvertimeReport(
    filters: OvertimeFilters,
    tenantId: number,
  ): Promise<Record<string, unknown>> {
    this.logger.debug(`Getting overtime report for tenant ${tenantId}`);

    const result = await this.databaseService.query<{
      total_shifts: string;
      total_hours: string;
      total_break_hours: string;
    }>(
      `SELECT
        COUNT(*) as total_shifts,
        COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600), 0) as total_hours,
        COALESCE(SUM(break_minutes / 60.0), 0) as total_break_hours
       FROM shifts
       WHERE user_id = $1 AND tenant_id = $2 AND date BETWEEN $3 AND $4`,
      [filters.userId, tenantId, filters.startDate, filters.endDate],
    );

    const row = result[0];
    return {
      userId: filters.userId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      totalShifts: Number.parseInt(row?.total_shifts ?? '0', 10),
      totalHours: Number.parseFloat(row?.total_hours ?? '0'),
      totalBreakHours: Number.parseFloat(row?.total_break_hours ?? '0'),
      netHours:
        Number.parseFloat(row?.total_hours ?? '0') -
        Number.parseFloat(row?.total_break_hours ?? '0'),
    };
  }

  // ============================================================
  // EXPORT
  // ============================================================

  async exportShifts(
    filters: ExportFilters,
    tenantId: number,
    format: 'csv' | 'excel',
  ): Promise<string> {
    this.logger.debug(`Exporting shifts for tenant ${tenantId} as ${format}`);

    if (format === 'excel') {
      throw new NotImplementedException('Excel export not yet implemented');
    }

    const shifts = await this.listShifts(tenantId, {
      startDate: filters.startDate,
      endDate: filters.endDate,
      departmentId: filters.departmentId,
      teamId: filters.teamId,
      userId: filters.userId,
      page: 1,
      limit: 10000,
      sortBy: 'date',
      sortOrder: 'asc',
    });

    const headers = [
      'Date',
      'Employee',
      'Start Time',
      'End Time',
      'Break (min)',
      'Total Hours',
      'Type',
      'Status',
      'Department',
      'Notes',
    ];

    const rows = shifts.map((shift: ShiftResponse) => [
      shift.date,
      shift.userName ?? shift.userId,
      shift.startTime,
      shift.endTime,
      shift.breakMinutes ?? 0,
      calculateHours(shift.startTime, shift.endTime, shift.breakMinutes),
      shift.type,
      shift.status,
      shift.departmentName ?? shift.departmentId,
      shift.notes ?? '',
    ]);

    return [
      headers.join(','),
      ...rows.map((row: unknown[]) =>
        row.map((cell: unknown) => `"${String(cell)}"`).join(','),
      ),
    ].join('\n');
  }

  // ============================================================
  // CALENDAR SHIFTS
  // ============================================================

  async getUserCalendarShifts(
    userId: number,
    tenantId: number,
    startDate: string,
    endDate: string,
  ): Promise<CalendarShiftResponse[]> {
    this.logger.debug(
      `Getting calendar shifts for user ${userId} in tenant ${tenantId}`,
    );

    const rows = await this.databaseService.query<{
      date: string;
      type: string;
    }>(
      `SELECT DISTINCT date, type FROM (
        SELECT DATE(date) as date, type::TEXT as type
        FROM shifts
        WHERE user_id = $1 AND tenant_id = $2 AND date BETWEEN $3 AND $4
          AND type IN ('F', 'S', 'N', 'early', 'late', 'night')
        UNION
        SELECT DATE(shift_date) as date, shift_type::TEXT as type
        FROM shift_rotation_history
        WHERE user_id = $5 AND tenant_id = $6 AND shift_date BETWEEN $7 AND $8
      ) AS combined_shifts
      ORDER BY date ASC`,
      [
        userId,
        tenantId,
        startDate,
        endDate,
        userId,
        tenantId,
        startDate,
        endDate,
      ],
    );

    return rows.map((row: { date: string; type: string }) => ({
      date: row.date,
      type:
        row.type === 'early' ? 'F'
        : row.type === 'late' ? 'S'
        : row.type === 'night' ? 'N'
        : row.type,
    }));
  }

  // ============================================================
  // ASSIGNMENT COUNTS
  // ============================================================

  /**
   * Counts shift assignments per employee across both data sources
   * (shifts + shift_rotation_history) for week, month, and year.
   */
  async getAssignmentCounts(
    tenantId: number,
    teamId: number,
    referenceDate: string,
  ): Promise<AssignmentCountResponse[]> {
    this.logger.debug(
      `Getting assignment counts for team ${teamId}, ref ${referenceDate}`,
    );

    const rows = await this.databaseService.query<DbAssignmentCountRow>(
      ASSIGNMENT_COUNTS_SQL,
      [tenantId, teamId, referenceDate],
    );

    return rows.map((r: DbAssignmentCountRow) => mapAssignmentCountRow(r));
  }

  // ============================================================
  // FAVORITES
  // ============================================================

  async listFavorites(
    tenantId: number,
    userId: number,
  ): Promise<FavoriteResponse[]> {
    this.logger.debug(
      `Listing favorites for user ${userId} in tenant ${tenantId}`,
    );

    const favorites = await this.databaseService.query<DbFavoriteRow>(
      `SELECT * FROM shift_favorites WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
      [tenantId, userId],
    );

    return favorites.map(
      (f: DbFavoriteRow) =>
        dbToApi(f as unknown as Record<string, unknown>) as FavoriteResponse,
    );
  }

  async createFavorite(
    dto: CreateFavoriteDto,
    tenantId: number,
    userId: number,
  ): Promise<FavoriteResponse> {
    this.logger.debug(
      `Creating favorite for user ${userId} in tenant ${tenantId}`,
    );

    let result: { id: number }[];
    try {
      result = await this.databaseService.query<{ id: number }>(
        `INSERT INTO shift_favorites (
          tenant_id, user_id, name, area_id, area_name, department_id, department_name,
          machine_id, machine_name, team_id, team_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          tenantId,
          userId,
          dto.name,
          dto.areaId,
          dto.areaName,
          dto.departmentId,
          dto.departmentName,
          dto.machineId,
          dto.machineName,
          dto.teamId,
          dto.teamName,
        ],
      );
    } catch (error: unknown) {
      // PostgreSQL unique_violation = 23505 (constraint: tenant_id, user_id, name)
      if (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new ConflictException(
          `A favorite with the name "${dto.name}" already exists`,
        );
      }
      throw error;
    }

    const favoriteId = result[0]?.id ?? 0;
    const favorites = await this.databaseService.query<DbFavoriteRow>(
      `SELECT * FROM shift_favorites WHERE id = $1 AND tenant_id = $2`,
      [favoriteId, tenantId],
    );

    return dbToApi(
      favorites[0] as unknown as Record<string, unknown>,
    ) as FavoriteResponse;
  }

  async deleteFavorite(
    favoriteId: number,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    this.logger.debug(
      `Deleting favorite ${favoriteId} for user ${userId} in tenant ${tenantId}`,
    );

    const favorites = await this.databaseService.query<DbFavoriteRow>(
      `SELECT * FROM shift_favorites WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
      [favoriteId, tenantId, userId],
    );

    if (favorites.length === 0) {
      throw new NotFoundException(`Favorite ${favoriteId} not found`);
    }

    await this.databaseService.query(
      `DELETE FROM shift_favorites WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
      [favoriteId, tenantId, userId],
    );
  }
}
