/* eslint-disable max-lines */
/**
 * Shifts Service
 *
 * Native NestJS implementation for shift management.
 * No Express dependencies - uses DatabaseService directly.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { apiToDb, dbToApi } from '../../utils/fieldMapping.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateShiftDto } from './dto/create-shift.dto.js';
import type { CreateSwapRequestDto } from './dto/create-swap-request.dto.js';
import type { CreateFavoriteDto } from './dto/favorite.dto.js';
import type { CreateShiftPlanDto } from './dto/shift-plan.dto.js';
import type { UpdateSwapRequestStatusDto } from './dto/swap-request-status.dto.js';
import type { UpdateShiftPlanDto } from './dto/update-shift-plan.dto.js';
import type { UpdateShiftDto } from './dto/update-shift.dto.js';

// ============================================================
// RESPONSE TYPES
// ============================================================

/**
 * Shift response type
 */
export interface ShiftResponse {
  id: number;
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number | undefined;
  type?: string | undefined;
  status?: string | undefined;
  departmentId?: number | undefined;
  departmentName?: string | undefined;
  userName?: string | undefined;
  notes?: string | undefined;
  [key: string]: unknown;
}

/**
 * Shift plan response
 */
export interface ShiftPlanResponse {
  planId: number;
  shiftIds: number[];
  message: string;
}

/**
 * Swap request response
 */
export interface SwapRequestResponse {
  id: number;
  shiftId: number;
  requestedBy: number;
  requestedWith?: number | undefined;
  status: string;
  reason?: string | undefined;
  message?: string | undefined;
  [key: string]: unknown;
}

/**
 * Calendar shift response
 */
export interface CalendarShiftResponse {
  date: string;
  type: string;
}

/**
 * Favorite response
 */
export interface FavoriteResponse {
  id: number;
  name: string;
  areaId: number;
  areaName: string;
  departmentId: number;
  departmentName: string;
  machineId: number;
  machineName: string;
  teamId: number;
  teamName: string;
  [key: string]: unknown;
}

// ============================================================
// FILTER TYPES
// ============================================================

/**
 * Shift list filters
 */
export interface ShiftFilters {
  date?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  userId?: number | undefined;
  departmentId?: number | undefined;
  teamId?: number | undefined;
  status?: string | undefined;
  type?: string | undefined;
  templateId?: number | undefined;
  planId?: number | undefined;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Shift plan filters
 */
export interface ShiftPlanFilters {
  areaId?: number | undefined;
  departmentId?: number | undefined;
  teamId?: number | undefined;
  machineId?: number | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

/**
 * Swap request filters
 */
export interface SwapRequestFilters {
  userId?: number | undefined;
  status?: string | undefined;
}

/**
 * Overtime filters
 */
export interface OvertimeFilters {
  userId: number;
  startDate: string;
  endDate: string;
}

/**
 * Export filters
 */
export interface ExportFilters {
  startDate: string;
  endDate: string;
  departmentId?: number | undefined;
  teamId?: number | undefined;
  userId?: number | undefined;
}

// ============================================================
// DATABASE ROW TYPES
// ============================================================

interface DbShiftRow {
  id: number;
  tenant_id: number;
  plan_id: number | null;
  user_id: number;
  date: string | Date;
  start_time: string | Date;
  end_time: string | Date;
  title: string | null;
  required_employees: number | null;
  actual_start: string | null;
  actual_end: string | null;
  break_minutes: number | null;
  status: string | null;
  type: string | null;
  notes: string | null;
  area_id: number | null;
  department_id: number;
  team_id: number | null;
  machine_id: number | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  user_name?: string | undefined;
  first_name?: string | undefined;
  last_name?: string | undefined;
  department_name?: string | undefined;
  team_name?: string | undefined;
}

interface DbSwapRequestRow {
  id: number;
  tenant_id: number;
  shift_id: number;
  requested_by: number;
  requested_with: number | null;
  status: string;
  reason: string | null;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  created_at: Date;
}

interface DbFavoriteRow {
  id: number;
  tenant_id: number;
  user_id: number;
  name: string;
  area_id: number;
  area_name: string;
  department_id: number;
  department_name: string;
  machine_id: number;
  machine_name: string;
  team_id: number;
  team_name: string;
  created_at: Date;
}

interface DbShiftPlanRow {
  id: number;
  tenant_id: number;
  area_id: number | null;
  department_id: number;
  team_id: number | null;
  machine_id: number | null;
  name: string | null;
  start_date: string;
  end_date: string;
  shift_notes: string | null;
  custom_rotation_pattern: string | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

// ============================================================
// SERVICE IMPLEMENTATION
// ============================================================

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  // ============================================================
  // Helper Methods
  // ============================================================

  private parseTimeFromDateTime(dateTimeValue: string | Date | undefined): string | undefined {
    if (dateTimeValue === undefined) return undefined;
    try {
      const dateTime = new Date(dateTimeValue);
      if (Number.isNaN(dateTime.getTime())) return undefined;
      const hours = dateTime.getHours().toString().padStart(2, '0');
      const minutes = dateTime.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return undefined;
    }
  }

  private parseDateToString(dateValue: string | Date | undefined): string | undefined {
    if (dateValue === undefined) return undefined;
    try {
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return undefined;
      return date.toISOString().split('T')[0];
    } catch {
      return undefined;
    }
  }

  /**
   * Builds a full timestamp from date and time strings for PostgreSQL
   * @param dateStr - Date in YYYY-MM-DD format (or ISO string)
   * @param timeStr - Time in HH:MM format
   * @param defaultTime - Optional default time if timeStr is invalid
   * @returns Full timestamp string or null if inputs are invalid
   */
  private buildTimestamp(dateStr: unknown, timeStr: unknown, defaultTime?: string): string | null {
    if (typeof dateStr !== 'string' || dateStr === '') return null;
    const datePart: string = dateStr.split('T')[0] ?? dateStr;
    if (typeof timeStr === 'string' && timeStr !== '') {
      const timePart: string = timeStr;
      return `${datePart}T${timePart}:00`;
    }
    if (defaultTime !== undefined && defaultTime !== '') {
      const defTime: string = defaultTime;
      return `${datePart}T${defTime}:00`;
    }
    return null;
  }

  /**
   * Converts time fields in dbData to full timestamps using the provided date
   */
  private convertTimeFieldsToTimestamps(
    dbData: Record<string, unknown>,
    dateForTimestamp: string,
  ): void {
    const startTime = dbData['start_time'];
    if (startTime !== undefined) {
      const builtTime = this.buildTimestamp(dateForTimestamp, startTime);
      if (builtTime !== null) dbData['start_time'] = builtTime;
    }
    const endTime = dbData['end_time'];
    if (endTime !== undefined) {
      const builtTime = this.buildTimestamp(dateForTimestamp, endTime);
      if (builtTime !== null) dbData['end_time'] = builtTime;
    }
  }

  private dbShiftToApi(dbShift: DbShiftRow): ShiftResponse {
    const apiShift = dbToApi(dbShift as unknown as Record<string, unknown>) as ShiftResponse;
    const startTime = this.parseTimeFromDateTime(dbShift.start_time);
    if (startTime !== undefined && startTime !== '') {
      apiShift.startTime = startTime;
    }
    const endTime = this.parseTimeFromDateTime(dbShift.end_time);
    if (endTime !== undefined && endTime !== '') {
      apiShift.endTime = endTime;
    }
    const formattedDate = this.parseDateToString(dbShift.date);
    if (formattedDate !== undefined && formattedDate !== '') {
      apiShift.date = formattedDate;
    }
    // Add nested user object for frontend compatibility
    // user_id is always defined (required field in DbShiftRow)
    apiShift['user'] = {
      id: dbShift.user_id,
      username: dbShift.user_name ?? '',
      firstName: dbShift.first_name ?? '',
      lastName: dbShift.last_name ?? '',
    };
    return apiShift;
  }

  private calculateHours(startTime: string, endTime: string, breakMinutes?: number): number {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const breakHours = (breakMinutes ?? 0) / 60;
    return Math.round((diffHours - breakHours) * 100) / 100;
  }

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

    const filterMap: { key: keyof ShiftFilters; column: string; isDate?: boolean }[] = [
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
      // eslint-disable-next-line security/detect-object-injection -- key is from hardcoded filterMap, not user input
      if (filters[key] === undefined) continue;
      const op =
        key === 'startDate' ? '>='
        : key === 'endDate' ? '<='
        : '=';
      conditions.push(isDate === true ? `${column} = $${idx}` : `${column} ${op} $${idx}`);
      // eslint-disable-next-line security/detect-object-injection -- key is from hardcoded filterMap, not user input
      params.push(filters[key]);
      idx++;
    }

    return { conditions: conditions.join(' AND '), params, nextIndex: idx };
  }

  async listShifts(tenantId: number, filters: ShiftFilters): Promise<ShiftResponse[]> {
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
    const sortColumn = filters.sortBy === 'date' ? 's.date' : `s.${filters.sortBy}`;
    const orderClause = ` ORDER BY ${sortColumn} ${filters.sortOrder.toUpperCase()}`;
    const limitClause = ` LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`;
    params.push(filters.limit, (filters.page - 1) * filters.limit);

    const query = baseQuery + filterClause + orderClause + limitClause;
    const shifts = await this.databaseService.query<DbShiftRow>(query, params);
    return shifts.map((s: DbShiftRow) => this.dbShiftToApi(s));
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

    return this.dbShiftToApi(shift);
  }

  async createShift(
    dto: CreateShiftDto,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<ShiftResponse> {
    this.logger.debug(`Creating shift for tenant ${tenantId} by user ${userId}`);

    const dbData = apiToDb(dto as unknown as Record<string, unknown>);

    // Combine date + time to create full timestamps for PostgreSQL
    const startTime = this.buildTimestamp(dbData['date'], dbData['start_time']);
    const endTime = this.buildTimestamp(dbData['date'], dbData['end_time']);

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
    return await this.getShiftById(shiftId, tenantId);
  }

  async updateShift(
    id: number,
    dto: UpdateShiftDto,
    tenantId: number,
    _userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<ShiftResponse> {
    this.logger.debug(`Updating shift ${id} for tenant ${tenantId}`);

    // Check if shift exists and get current data for date reference
    const existingShift = await this.getShiftById(id, tenantId);

    const dbData = apiToDb(dto as unknown as Record<string, unknown>);

    // Determine the date for timestamp construction (new date or existing)
    const rawDate = dbData['date'];
    const existingDate = typeof existingShift.date === 'string' ? existingShift.date : '';
    const dateForTimestamp = typeof rawDate === 'string' ? rawDate : existingDate;

    // Convert time-only fields to full timestamps
    this.convertTimeFieldsToTimestamps(dbData, dateForTimestamp);

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

    return await this.getShiftById(id, tenantId);
  }

  async deleteShift(
    id: number,
    tenantId: number,
    _userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<{ message: string }> {
    this.logger.debug(`Deleting shift ${id} for tenant ${tenantId}`);

    await this.getShiftById(id, tenantId);
    await this.databaseService.query(`DELETE FROM shifts WHERE id = $1 AND tenant_id = $2`, [
      id,
      tenantId,
    ]);

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
    this.logger.debug(`Deleting shifts for team ${teamId} from ${startDate} to ${endDate}`);

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
  async deleteShiftsByTeam(teamId: number, tenantId: number): Promise<{ shiftsDeleted: number }> {
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
  // SHIFT PLANS
  // ============================================================

  async getShiftPlan(
    filters: ShiftPlanFilters,
    tenantId: number,
  ): Promise<{ plan?: unknown; shifts: unknown[]; notes: unknown[] }> {
    this.logger.debug(`Getting shift plan for tenant ${tenantId}`);

    let planQuery = `SELECT * FROM shift_plans WHERE tenant_id = $1`;
    const planParams: unknown[] = [tenantId];
    let planParamIndex = 2;

    if (filters.departmentId !== undefined) {
      planQuery += ` AND department_id = $${planParamIndex}`;
      planParams.push(filters.departmentId);
      planParamIndex++;
    }
    if (filters.teamId !== undefined) {
      planQuery += ` AND team_id = $${planParamIndex}`;
      planParams.push(filters.teamId);
      planParamIndex++;
    }
    if (filters.startDate !== undefined && filters.endDate !== undefined) {
      planQuery += ` AND start_date <= $${planParamIndex} AND end_date >= $${planParamIndex + 1}`;
      planParams.push(filters.endDate, filters.startDate);
    }

    planQuery += ` ORDER BY created_at DESC LIMIT 1`;
    const plans = await this.databaseService.query<DbShiftPlanRow>(planQuery, planParams);
    const plan = plans[0];

    // Get shifts for the date range - if we have a plan, use plan_id for more accurate filtering
    const shifts = await this.listShifts(tenantId, {
      startDate: filters.startDate,
      endDate: filters.endDate,
      departmentId: filters.departmentId,
      teamId: filters.teamId,
      planId: plan?.id, // Filter by plan_id if plan exists
      page: 1,
      limit: 1000,
      sortBy: 'date',
      sortOrder: 'asc',
    });

    return {
      plan: plan !== undefined ? dbToApi(plan as unknown as Record<string, unknown>) : undefined,
      shifts,
      notes: [],
    };
  }

  async createShiftPlan(
    dto: CreateShiftPlanDto,
    tenantId: number,
    userId: number,
  ): Promise<ShiftPlanResponse> {
    this.logger.debug(`Creating shift plan for tenant ${tenantId}`);

    const planUuid = uuidv7();
    const planResult = await this.databaseService.query<{ id: number }>(
      `INSERT INTO shift_plans (
        uuid, tenant_id, area_id, department_id, team_id, machine_id,
        name, start_date, end_date, shift_notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        planUuid,
        tenantId,
        dto.areaId ?? null,
        dto.departmentId,
        dto.teamId ?? null,
        dto.machineId ?? null,
        dto.name ?? `Shift Plan ${dto.startDate}`,
        dto.startDate,
        dto.endDate,
        dto.shiftNotes ?? null,
        userId,
      ],
    );

    const planId = planResult[0]?.id ?? 0;
    const shiftIds =
      dto.shifts.length > 0 ?
        await this.insertPlanShifts(dto.shifts, planId, tenantId, dto, userId)
      : [];

    return { planId, shiftIds, message: 'Shift plan created successfully' };
  }

  /**
   * Inserts shifts for a new plan
   */
  private async insertPlanShifts(
    shifts: CreateShiftPlanDto['shifts'],
    planId: number,
    tenantId: number,
    context: Pick<CreateShiftPlanDto, 'areaId' | 'departmentId' | 'teamId' | 'machineId'>,
    createdBy: number,
  ): Promise<number[]> {
    const shiftIds: number[] = [];
    for (const shift of shifts) {
      const startTimestamp = this.buildTimestamp(shift.date, shift.startTime);
      const endTimestamp = this.buildTimestamp(shift.date, shift.endTime);
      const result = await this.databaseService.query<{ id: number }>(
        `INSERT INTO shifts (
          tenant_id, plan_id, user_id, date, start_time, end_time, type,
          area_id, department_id, team_id, machine_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id`,
        [
          tenantId,
          planId,
          shift.userId,
          shift.date,
          startTimestamp,
          endTimestamp,
          shift.type,
          context.areaId ?? null,
          context.departmentId,
          context.teamId ?? null,
          context.machineId ?? null,
          createdBy,
        ],
      );
      if (result[0] !== undefined) {
        shiftIds.push(result[0].id);
      }
    }
    return shiftIds;
  }

  /**
   * Upserts shifts for a plan, returns created/updated shift IDs
   */
  private async upsertPlanShifts(
    shifts: {
      userId: number;
      date: string;
      startTime?: string | undefined;
      endTime?: string | undefined;
      type?: string | undefined;
    }[],
    planId: number,
    tenantId: number,
    context: {
      departmentId: number | undefined;
      teamId: number | null | undefined;
      areaId: number | null | undefined;
      machineId: number | null | undefined;
    },
    createdBy: number,
  ): Promise<number[]> {
    const shiftIds: number[] = [];
    for (const shift of shifts) {
      // Combine date + time to create full timestamps for PostgreSQL (with defaults)
      const startTimestamp = this.buildTimestamp(shift.date, shift.startTime, '08:00');
      const endTimestamp = this.buildTimestamp(shift.date, shift.endTime, '16:00');

      const result = await this.databaseService.query<{ id: number }>(
        `INSERT INTO shifts (
          tenant_id, plan_id, user_id, date, start_time, end_time, type,
          area_id, department_id, team_id, machine_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (tenant_id, plan_id, user_id, date) DO UPDATE SET
           start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, type = EXCLUDED.type
         RETURNING id`,
        [
          tenantId,
          planId,
          shift.userId,
          shift.date,
          startTimestamp,
          endTimestamp,
          shift.type,
          context.areaId ?? null,
          context.departmentId,
          context.teamId ?? null,
          context.machineId ?? null,
          createdBy,
        ],
      );
      if (result[0] !== undefined) {
        shiftIds.push(result[0].id);
      }
    }
    return shiftIds;
  }

  async updateShiftPlan(
    planId: number,
    dto: UpdateShiftPlanDto,
    tenantId: number,
    userId: number,
  ): Promise<ShiftPlanResponse> {
    this.logger.debug(`Updating shift plan ${planId} for tenant ${tenantId}`);

    const plans = await this.databaseService.query<DbShiftPlanRow>(
      `SELECT * FROM shift_plans WHERE id = $1 AND tenant_id = $2`,
      [planId, tenantId],
    );
    if (plans.length === 0) {
      throw new NotFoundException(`Shift plan ${planId} not found`);
    }

    // Build update fields dynamically
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (dto.name !== undefined) {
      updates.push(`name = $${idx++}`);
      params.push(dto.name);
    }
    if (dto.shiftNotes !== undefined) {
      updates.push(`shift_notes = $${idx++}`);
      params.push(dto.shiftNotes);
    }
    if (updates.length > 0) {
      params.push(planId, tenantId);
      await this.databaseService.query(
        `UPDATE shift_plans SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx++} AND tenant_id = $${idx}`,
        params,
      );
    }

    // Upsert shifts and get IDs of shifts that should exist
    const shiftIds =
      dto.shifts !== undefined && dto.shifts.length > 0 ?
        await this.upsertPlanShifts(
          dto.shifts,
          planId,
          tenantId,
          {
            departmentId: dto.departmentId ?? plans[0]?.department_id,
            teamId: dto.teamId ?? plans[0]?.team_id,
            areaId: dto.areaId ?? plans[0]?.area_id,
            machineId: dto.machineId ?? plans[0]?.machine_id,
          },
          userId,
        )
      : [];

    // Clean up orphaned shifts (those removed by user)
    await this.deleteOrphanedPlanShifts(planId, tenantId, shiftIds, dto.shifts?.length === 0);

    return { planId, shiftIds, message: 'Shift plan updated successfully' };
  }

  /**
   * Deletes shifts that are no longer part of a plan (removed by user)
   */
  private async deleteOrphanedPlanShifts(
    planId: number,
    tenantId: number,
    keepShiftIds: number[],
    deleteAll: boolean,
  ): Promise<void> {
    if (keepShiftIds.length > 0) {
      const placeholders = keepShiftIds.map((_: number, i: number) => `$${i + 3}`).join(', ');
      await this.databaseService.query(
        `DELETE FROM shifts WHERE plan_id = $1 AND tenant_id = $2 AND id NOT IN (${placeholders})`,
        [planId, tenantId, ...keepShiftIds],
      );
      this.logger.debug(`Cleaned up orphaned shifts for plan ${planId}`);
    } else if (deleteAll) {
      await this.databaseService.query(`DELETE FROM shifts WHERE plan_id = $1 AND tenant_id = $2`, [
        planId,
        tenantId,
      ]);
      this.logger.debug(`Deleted all shifts for plan ${planId} (empty shifts array)`);
    }
  }

  async deleteShiftPlan(planId: number, tenantId: number): Promise<void> {
    this.logger.debug(`Deleting shift plan ${planId} for tenant ${tenantId}`);

    const plans = await this.databaseService.query<DbShiftPlanRow>(
      `SELECT * FROM shift_plans WHERE id = $1 AND tenant_id = $2`,
      [planId, tenantId],
    );

    if (plans.length === 0) {
      throw new NotFoundException(`Shift plan ${planId} not found`);
    }

    // Delete associated shifts first
    await this.databaseService.query(`DELETE FROM shifts WHERE plan_id = $1 AND tenant_id = $2`, [
      planId,
      tenantId,
    ]);

    // Delete the plan
    await this.databaseService.query(`DELETE FROM shift_plans WHERE id = $1 AND tenant_id = $2`, [
      planId,
      tenantId,
    ]);
  }

  // ============================================================
  // SWAP REQUESTS
  // ============================================================

  async listSwapRequests(
    tenantId: number,
    filters: SwapRequestFilters,
  ): Promise<SwapRequestResponse[]> {
    this.logger.debug(`Listing swap requests for tenant ${tenantId}`);

    let query = `SELECT * FROM shift_swap_requests WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters.userId !== undefined) {
      query += ` AND (requested_by = $${paramIndex} OR requested_with = $${paramIndex})`;
      params.push(filters.userId);
      paramIndex++;
    }
    if (filters.status !== undefined) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
    }

    query += ` ORDER BY created_at DESC`;

    const requests = await this.databaseService.query<DbSwapRequestRow>(query, params);
    return requests.map(
      (r: DbSwapRequestRow) =>
        dbToApi(r as unknown as Record<string, unknown>) as SwapRequestResponse,
    );
  }

  async createSwapRequest(
    dto: CreateSwapRequestDto,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<SwapRequestResponse> {
    this.logger.debug(`Creating swap request for tenant ${tenantId}`);

    // Verify shift exists and belongs to user
    const shift = await this.getShiftById(dto.shiftId, tenantId);
    if (shift.userId !== userId) {
      throw new ForbiddenException('You can only request swaps for your own shifts');
    }

    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO shift_swap_requests (tenant_id, shift_id, requested_by, requested_with, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [tenantId, dto.shiftId, userId, dto.requestedWithUserId ?? null, dto.reason ?? null],
    );

    const requestId = result[0]?.id ?? 0;

    return {
      id: requestId,
      shiftId: dto.shiftId,
      requestedBy: userId,
      requestedWith: dto.requestedWithUserId,
      status: 'pending',
      reason: dto.reason,
      message: 'Swap request created successfully',
    };
  }

  async updateSwapRequestStatus(
    id: number,
    dto: UpdateSwapRequestStatusDto,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<{ message: string }> {
    this.logger.debug(`Updating swap request ${id} status for tenant ${tenantId}`);

    const requests = await this.databaseService.query<DbSwapRequestRow>(
      `SELECT * FROM shift_swap_requests WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    if (requests.length === 0) {
      throw new NotFoundException(`Swap request ${id} not found`);
    }

    await this.databaseService.query(
      `UPDATE shift_swap_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [dto.status, userId, id, tenantId],
    );

    return { message: `Swap request ${dto.status} successfully` };
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
      this.calculateHours(shift.startTime, shift.endTime, shift.breakMinutes),
      shift.type,
      shift.status,
      shift.departmentName ?? shift.departmentId,
      shift.notes ?? '',
    ]);

    return [
      headers.join(','),
      ...rows.map((row: unknown[]) => row.map((cell: unknown) => `"${String(cell)}"`).join(',')),
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
    this.logger.debug(`Getting calendar shifts for user ${userId} in tenant ${tenantId}`);

    const rows = await this.databaseService.query<{ date: string; type: string }>(
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
      [userId, tenantId, startDate, endDate, userId, tenantId, startDate, endDate],
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
  // FAVORITES
  // ============================================================

  async listFavorites(tenantId: number, userId: number): Promise<FavoriteResponse[]> {
    this.logger.debug(`Listing favorites for user ${userId} in tenant ${tenantId}`);

    const favorites = await this.databaseService.query<DbFavoriteRow>(
      `SELECT * FROM shift_favorites WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
      [tenantId, userId],
    );

    return favorites.map(
      (f: DbFavoriteRow) => dbToApi(f as unknown as Record<string, unknown>) as FavoriteResponse,
    );
  }

  async createFavorite(
    dto: CreateFavoriteDto,
    tenantId: number,
    userId: number,
  ): Promise<FavoriteResponse> {
    this.logger.debug(`Creating favorite for user ${userId} in tenant ${tenantId}`);

    const result = await this.databaseService.query<{ id: number }>(
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

    const favoriteId = result[0]?.id ?? 0;
    const favorites = await this.databaseService.query<DbFavoriteRow>(
      `SELECT * FROM shift_favorites WHERE id = $1 AND tenant_id = $2`,
      [favoriteId, tenantId],
    );

    return dbToApi(favorites[0] as unknown as Record<string, unknown>) as FavoriteResponse;
  }

  async deleteFavorite(favoriteId: number, tenantId: number, userId: number): Promise<void> {
    this.logger.debug(`Deleting favorite ${favoriteId} for user ${userId} in tenant ${tenantId}`);

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
