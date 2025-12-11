/**
 * Shift Plans Service
 * Handles shift plan operations and favorites management
 */
import { v7 as uuidv7 } from 'uuid';

import { ServiceError } from '../../../utils/ServiceError.js';
import { RowDataPacket, execute, query } from '../../../utils/db.js';
import { dbToApi } from '../../../utils/fieldMapping.js';
import { logger } from '../../../utils/logger.js';
import { customRotationService } from './custom-rotation.service.js';
import { formatDateForMysql } from './shift-types.js';

interface ShiftPlanData {
  startDate: string;
  endDate: string;
  areaId?: number;
  departmentId: number;
  teamId?: number;
  machineId?: number;
  name?: string;
  shiftNotes?: string;
  customRotationPattern?: string;
  shifts: {
    userId: number;
    date: string;
    type: string;
    startTime: string;
    endTime: string;
  }[];
}

interface ShiftPlanUpdateData {
  startDate?: string;
  endDate?: string;
  areaId?: number;
  departmentId?: number;
  teamId?: number;
  machineId?: number;
  name?: string;
  shiftNotes?: string;
  shifts?: {
    date: string;
    type: string;
    userId: number;
    startTime?: string;
    endTime?: string;
  }[];
}

interface FavoriteData {
  name: string;
  areaId: number;
  areaName: string;
  departmentId: number;
  departmentName: string;
  machineId: number;
  machineName: string;
  teamId: number;
  teamName: string;
}

class ShiftPlansService {
  /**
   * Helper to get week number
   * @param date - Parameter description
   * @returns ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() !== 0 ? d.getUTCDay() : 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * Create a shift plan record in the database
   * @param data - Plan data
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param planName - Name of the plan
   * @param dateRange - Date range object
   * @returns Promise resolving to plan ID
   */
  private async createShiftPlanRecord(
    data: {
      shiftNotes?: string;
      departmentId: number;
      teamId?: number;
      machineId?: number;
      areaId?: number;
    },
    tenantId: number,
    userId: number,
    planName: string,
    dateRange: { planStartDate: string; planEndDate: string },
  ): Promise<number> {
    const planUuid = uuidv7();
    // PostgreSQL: Use RETURNING id to get the inserted row's ID
    const [planResult] = await execute(
      `INSERT INTO shift_plans (
        uuid, tenant_id, name, shift_notes,
        department_id, team_id, machine_id, area_id,
        start_date, end_date, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11)
      RETURNING id`,
      [
        planUuid,
        tenantId,
        planName,
        data.shiftNotes ?? '',
        data.departmentId,
        data.teamId ?? null,
        data.machineId ?? null,
        data.areaId ?? null,
        dateRange.planStartDate,
        dateRange.planEndDate,
        userId,
      ],
    );

    // PostgreSQL RETURNING gives us an array of rows
    const rows = planResult as { id: number }[];
    if (rows[0]?.id === undefined) {
      throw new ServiceError(
        'CREATE_PLAN_ERROR',
        'Failed to create shift plan record - no ID returned',
      );
    }
    return rows[0].id;
  }

  /**
   * Create shift records in the database
   * @param shifts - Array of shifts to create
   * @param planId - Associated plan ID
   * @param data - Additional shift data
   * @param tenantId - Tenant ID
   * @param userId - User ID creating the shifts
   * @returns Promise resolving to array of shift IDs
   */
  private async createShiftRecords(
    shifts: {
      userId: number;
      date: string;
      type: string;
      startTime: string;
      endTime: string;
    }[],
    planId: number,
    data: {
      areaId?: number;
      departmentId: number;
      teamId?: number;
      machineId?: number;
    },
    tenantId: number,
    userId: number,
  ): Promise<number[]> {
    const shiftIds: number[] = [];

    for (const shift of shifts) {
      // Use UPSERT: If shift already exists (created via drag & drop), update it with plan_id
      // If it doesn't exist, insert a new record
      // PostgreSQL: ON CONFLICT based on unique constraint (user_id, date, start_time)
      const [shiftResult] = await execute(
        `INSERT INTO shifts (
          tenant_id, plan_id, user_id,
          date, start_time, end_time, type,
          area_id, department_id, team_id, machine_id,
          status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'planned', $12)
        ON CONFLICT (user_id, date, start_time) DO UPDATE SET
          plan_id = EXCLUDED.plan_id,
          area_id = COALESCE(EXCLUDED.area_id, shifts.area_id),
          department_id = COALESCE(EXCLUDED.department_id, shifts.department_id),
          team_id = COALESCE(EXCLUDED.team_id, shifts.team_id),
          machine_id = COALESCE(EXCLUDED.machine_id, shifts.machine_id),
          updated_at = CURRENT_TIMESTAMP
        RETURNING id`,
        [
          tenantId,
          planId,
          shift.userId,
          shift.date,
          // Use formatDateForMysql for consistent timestamp format with drag & drop shifts
          formatDateForMysql(`${shift.date} ${shift.startTime}`),
          formatDateForMysql(`${shift.date} ${shift.endTime}`),
          shift.type,
          data.areaId ?? null,
          data.departmentId,
          data.teamId ?? null,
          data.machineId ?? null,
          userId,
        ],
      );
      // PostgreSQL RETURNING id gives us an array of rows
      const rows = shiftResult as { id: number }[];
      if (rows[0]?.id !== undefined) {
        shiftIds.push(rows[0].id);
      }
    }

    return shiftIds;
  }

  /**
   * Log shift plan creation error details
   */
  private logShiftPlanError(
    error: unknown,
    data: ShiftPlanData,
    tenantId: number,
    userId: number,
  ): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SHIFT PLAN ERROR] Details:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      data: {
        startDate: data.startDate,
        endDate: data.endDate,
        shiftsCount: data.shifts.length,
        tenantId,
        userId,
      },
    });
  }

  /**
   * Create a complete shift plan with shifts and notes
   * @param data - Shift plan data
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param userId - ID of user creating the plan
   * @returns Object containing planId, shiftIds array and success message
   */
  async createShiftPlan(
    data: ShiftPlanData,
    tenantId: number,
    userId: number,
  ): Promise<{ planId: number; shiftIds: number[]; message: string }> {
    try {
      console.info('[SHIFT PLAN CREATE] Starting with data:', {
        startDate: data.startDate,
        endDate: data.endDate,
        shiftsCount: data.shifts.length,
        departmentId: data.departmentId,
        teamId: data.teamId,
        machineId: data.machineId,
        areaId: data.areaId,
        tenantId,
        userId,
      });

      await query('START TRANSACTION');

      const weekNumber = this.getWeekNumber(new Date(data.startDate));
      const planName =
        data.name ??
        `Wochenplan KW ${String(weekNumber)}/${String(new Date(data.startDate).getFullYear())}`;

      const isCustomRotation = customRotationService.isCustomRotationPlan(
        planName,
        data.name,
        data.customRotationPattern,
      );
      const dateRange =
        isCustomRotation ?
          customRotationService.calculateCustomRotationDateRange(data.startDate, data.endDate)
        : { planStartDate: data.startDate, planEndDate: data.endDate };

      const planId = await this.createShiftPlanRecord(data, tenantId, userId, planName, dateRange);
      const shiftsToCreate = customRotationService.prepareShiftsForCreation(data, isCustomRotation);
      const shiftIds = await this.createShiftRecords(
        shiftsToCreate,
        planId,
        data,
        tenantId,
        userId,
      );

      await query('COMMIT');
      return {
        planId,
        shiftIds,
        message: `Schichtplan erfolgreich erstellt (${String(shiftIds.length)} Schichten)`,
      };
    } catch (error) {
      await query('ROLLBACK');
      logger.error('Error creating shift plan:', error);
      this.logShiftPlanError(error, data, tenantId, userId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ServiceError('CREATE_PLAN_ERROR', `Failed to create shift plan: ${errorMessage}`);
    }
  }

  /**
   * Build UPDATE query fields and values for shift plan
   * PostgreSQL: Dynamic $N parameter numbering
   * @param data - Update data
   * @returns Object with fields array and values array
   */
  private buildPlanUpdateQuery(data: ShiftPlanUpdateData): {
    fields: string[];
    values: unknown[];
  } {
    const updateFields: string[] = [];
    const updateValues: unknown[] = [];

    // Explicitly check each field to avoid object injection
    // PostgreSQL: Dynamic parameter numbering
    if (data.name !== undefined) {
      const paramIndex = updateValues.length + 1;
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(data.name);
    }
    if (data.shiftNotes !== undefined) {
      const paramIndex = updateValues.length + 1;
      updateFields.push(`shift_notes = $${paramIndex}`);
      updateValues.push(data.shiftNotes);
    }
    if (data.startDate !== undefined) {
      const paramIndex = updateValues.length + 1;
      updateFields.push(`start_date = $${paramIndex}`);
      updateValues.push(data.startDate);
    }
    if (data.endDate !== undefined) {
      const paramIndex = updateValues.length + 1;
      updateFields.push(`end_date = $${paramIndex}`);
      updateValues.push(data.endDate);
    }
    if (data.departmentId !== undefined) {
      const paramIndex = updateValues.length + 1;
      updateFields.push(`department_id = $${paramIndex}`);
      updateValues.push(data.departmentId);
    }
    if (data.teamId !== undefined) {
      const paramIndex = updateValues.length + 1;
      updateFields.push(`team_id = $${paramIndex}`);
      updateValues.push(data.teamId);
    }
    if (data.machineId !== undefined) {
      const paramIndex = updateValues.length + 1;
      updateFields.push(`machine_id = $${paramIndex}`);
      updateValues.push(data.machineId);
    }
    if (data.areaId !== undefined) {
      const paramIndex = updateValues.length + 1;
      updateFields.push(`area_id = $${paramIndex}`);
      updateValues.push(data.areaId);
    }

    // Always update timestamp
    updateFields.push('updated_at = NOW()');

    return { fields: updateFields, values: updateValues };
  }

  /**
   * Validate that a shift plan exists and belongs to tenant
   * @param planId - Plan ID to check
   * @param tenantId - Tenant ID for validation
   * @returns The existing plan data
   */
  private async validatePlanExists(
    planId: number,
    tenantId: number,
  ): Promise<{ id: number; department_id: number }> {
    const [existingPlans] = await execute(
      'SELECT id, department_id FROM shift_plans WHERE id = $1 AND tenant_id = $2',
      [planId, tenantId],
    );

    if ((existingPlans as unknown[]).length === 0) {
      throw new ServiceError('NOT_FOUND', 'Shift plan not found');
    }

    const plan = (existingPlans as { id: number; department_id: number }[])[0];
    if (plan === undefined) {
      throw new ServiceError('NOT_FOUND', 'Shift plan not found');
    }

    return plan;
  }

  /**
   * Replace all shifts for a plan
   * @param planId - Plan ID
   * @param shifts - New shifts to create
   * @param departmentId - Department ID for shifts
   * @param tenantId - Tenant ID
   * @param userId - User performing the update
   * @returns Array of new shift IDs
   */
  private async replacePlanShifts(
    planId: number,
    shifts: {
      date: string;
      type: string;
      userId: number;
      startTime?: string;
      endTime?: string;
    }[],
    departmentId: number,
    tenantId: number,
    userId: number,
  ): Promise<number[]> {
    // Delete existing shifts
    await execute('DELETE FROM shifts WHERE plan_id = $1 AND tenant_id = $2', [planId, tenantId]);

    // Insert new shifts
    const shiftIds: number[] = [];
    for (const shift of shifts) {
      // Combine date with time to create full timestamp for PostgreSQL
      // start_time and end_time are "timestamp with time zone" columns
      const startTimestamp = formatDateForMysql(`${shift.date} ${shift.startTime ?? '06:00:00'}`);
      const endTimestamp = formatDateForMysql(`${shift.date} ${shift.endTime ?? '14:00:00'}`);

      // PostgreSQL: Use RETURNING id to get the inserted row's ID
      const [result] = await execute(
        `INSERT INTO shifts (
          tenant_id, plan_id, user_id, date, type,
          start_time, end_time, department_id, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id`,
        [
          tenantId,
          planId,
          shift.userId,
          shift.date,
          shift.type,
          startTimestamp,
          endTimestamp,
          departmentId,
          userId,
        ],
      );

      // PostgreSQL RETURNING gives us an array of rows
      const rows = result as { id: number }[];
      if (rows[0]?.id !== undefined) {
        shiftIds.push(rows[0].id);
      }
    }

    return shiftIds;
  }

  /**
   * Build filter query conditions for shift plans
   * PostgreSQL: Dynamic $N parameter numbering
   */
  private buildPlanFilterQuery(
    filters: {
      areaId?: number;
      departmentId?: number;
      teamId?: number;
      machineId?: number;
      startDate?: string;
      endDate?: string;
    },
    tenantId: number,
  ): { query: string; params: (string | number)[] } {
    let query = 'SELECT * FROM shift_plans WHERE tenant_id = $1';
    const params: (string | number)[] = [tenantId];

    if (filters.departmentId !== undefined) {
      const paramIndex = params.length + 1;
      query += ` AND department_id = $${paramIndex}`;
      params.push(filters.departmentId);
    }
    if (filters.teamId !== undefined) {
      const paramIndex = params.length + 1;
      query += ` AND team_id = $${paramIndex}`;
      params.push(filters.teamId);
    }
    if (filters.machineId !== undefined) {
      const paramIndex = params.length + 1;
      query += ` AND machine_id = $${paramIndex}`;
      params.push(filters.machineId);
    }
    if (filters.areaId !== undefined) {
      const paramIndex = params.length + 1;
      query += ` AND area_id = $${paramIndex}`;
      params.push(filters.areaId);
    }
    if (
      filters.startDate !== undefined &&
      filters.startDate !== '' &&
      filters.endDate !== undefined &&
      filters.endDate !== ''
    ) {
      const endDateParamIndex = params.length + 1;
      const startDateParamIndex = params.length + 2;
      query += ` AND start_date <= $${endDateParamIndex} AND end_date >= $${startDateParamIndex}`;
      params.push(filters.endDate, filters.startDate);
    }
    query += ' ORDER BY created_at DESC LIMIT 1';
    return { query, params };
  }

  /**
   * Get shift plan with all shifts and notes
   */
  async getShiftPlan(
    filters: {
      areaId?: number;
      departmentId?: number;
      teamId?: number;
      machineId?: number;
      startDate?: string;
      endDate?: string;
    },
    tenantId: number,
  ): Promise<{ plan?: unknown; shifts: unknown[]; notes: unknown[] }> {
    try {
      const { query: planQuery, params } = this.buildPlanFilterQuery(filters, tenantId);
      const [plans] = await execute(planQuery, params);
      const plan = (plans as unknown[])[0];

      if (plan === undefined || plan === null) {
        return { shifts: [], notes: [] };
      }

      const [shifts] = await execute(
        `SELECT s.*, u.first_name, u.last_name, u.username FROM shifts s
         LEFT JOIN users u ON s.user_id = u.id WHERE s.plan_id = $1 ORDER BY s.date, s.start_time`,
        [(plan as { id: number }).id],
      );

      return {
        plan: dbToApi(plan as Record<string, unknown>),
        shifts: (shifts as unknown[]).map((s: unknown) => dbToApi(s as Record<string, unknown>)),
        notes: [],
      };
    } catch (error) {
      logger.error('Error getting shift plan:', error);
      throw new ServiceError('GET_PLAN_ERROR', 'Failed to get shift plan');
    }
  }

  /**
   * Update existing shift plan
   * @param planId - Plan ID to update
   * @param data - Update data containing optional startDate, endDate, areaId, departmentId, teamId, machineId, name, shiftNotes, and shifts array
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param userId - User ID performing the update
   * @returns Update result
   */
  async updateShiftPlan(
    planId: number,
    data: ShiftPlanUpdateData,
    tenantId: number,
    userId: number,
  ): Promise<{
    planId: number;
    shiftIds: number[];
    message: string;
  }> {
    try {
      await query('START TRANSACTION');

      // Validate plan exists
      const existingPlan = await this.validatePlanExists(planId, tenantId);
      const currentDepartmentId = data.departmentId ?? existingPlan.department_id;

      // Build and execute update query
      const { fields, values } = this.buildPlanUpdateQuery(data);

      if (fields.length > 0) {
        // PostgreSQL: Add planId and tenantId with dynamic param indexes
        const planIdParamIndex = values.length + 1;
        const tenantIdParamIndex = values.length + 2;
        values.push(planId, tenantId);
        await execute(
          `UPDATE shift_plans SET ${fields.join(', ')} WHERE id = $${planIdParamIndex} AND tenant_id = $${tenantIdParamIndex}`,
          values,
        );
      }

      // Handle shift updates if provided
      let shiftIds: number[] = [];
      if (data.shifts && data.shifts.length > 0) {
        shiftIds = await this.replacePlanShifts(
          planId,
          data.shifts,
          currentDepartmentId,
          tenantId,
          userId,
        );
      }

      await query('COMMIT');

      return {
        planId,
        shiftIds,
        message: `Schichtplan erfolgreich aktualisiert${
          shiftIds.length > 0 ? ` (${String(shiftIds.length)} Schichten)` : ''
        }`,
      };
    } catch (error) {
      await query('ROLLBACK');

      if (error instanceof ServiceError) {
        throw error;
      }

      throw new ServiceError(
        'UPDATE_FAILED',
        error instanceof Error ? error.message : 'Failed to update shift plan',
      );
    }
  }

  /**
   * Delete shift plan and associated shifts
   */
  async deleteShiftPlan(planId: number, tenantId: number): Promise<void> {
    // First check if the plan exists and belongs to this tenant
    const [plans] = await execute(
      'SELECT id, department_id, team_id FROM shift_plans WHERE id = $1 AND tenant_id = $2',
      [planId, tenantId],
    );

    if (!Array.isArray(plans) || plans.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Shift plan not found');
    }

    // Delete all shifts associated with this plan
    await execute('DELETE FROM shifts WHERE plan_id = $1 AND tenant_id = $2', [planId, tenantId]);

    // Delete the shift plan itself
    const [result] = await execute('DELETE FROM shift_plans WHERE id = $1 AND tenant_id = $2', [
      planId,
      tenantId,
    ]);

    const affectedRows = 'affectedRows' in result ? result.affectedRows : 0;

    if (affectedRows === 0) {
      throw new ServiceError('NOT_FOUND', 'Failed to delete shift plan');
    }

    console.info(
      `[SHIFTS] Deleted shift plan ${planId} and associated shifts for tenant ${tenantId}`,
    );
  }

  // ============= FAVORITES =============

  /**
   * List user's shift planning favorites
   */
  async listFavorites(tenantId: number, userId: number): Promise<unknown[]> {
    const [rows] = await query<RowDataPacket[]>(
      `SELECT
        id,
        name,
        area_id as "areaId",
        area_name as "areaName",
        department_id as "departmentId",
        department_name as "departmentName",
        machine_id as "machineId",
        machine_name as "machineName",
        team_id as "teamId",
        team_name as "teamName",
        created_at as "createdAt"
      FROM shift_favorites
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY created_at DESC`,
      [tenantId, userId],
    );
    return rows;
  }

  /**
   * Create new shift planning favorite
   */
  async createFavorite(tenantId: number, userId: number, data: FavoriteData): Promise<unknown> {
    // Check if a favorite with the same name already exists for this user
    const [existing] = await query<RowDataPacket[]>(
      'SELECT id FROM shift_favorites WHERE tenant_id = $1 AND user_id = $2 AND name = $3',
      [tenantId, userId, data.name],
    );

    if (existing.length > 0) {
      throw new ServiceError('DUPLICATE', 'Ein Favorit mit diesem Namen existiert bereits');
    }

    // Insert new favorite - PostgreSQL: Use RETURNING id
    const [result] = await execute(
      `INSERT INTO shift_favorites (
        tenant_id,
        user_id,
        name,
        area_id,
        area_name,
        department_id,
        department_name,
        machine_id,
        machine_name,
        team_id,
        team_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        tenantId,
        userId,
        data.name,
        data.areaId,
        data.areaName,
        data.departmentId,
        data.departmentName,
        data.machineId,
        data.machineName,
        data.teamId,
        data.teamName,
      ],
    );

    // PostgreSQL RETURNING gives us an array of rows
    const rows = result as { id: number }[];
    const insertId = rows[0]?.id ?? 0;

    return {
      id: insertId,
      ...data,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Delete shift planning favorite
   */
  async deleteFavorite(favoriteId: number, tenantId: number, userId: number): Promise<void> {
    // Delete the favorite (will fail if not exists or no permission)
    const [result] = await execute(
      'DELETE FROM shift_favorites WHERE id = $1 AND tenant_id = $2 AND user_id = $3',
      [favoriteId, tenantId, userId],
    );

    const affectedRows = 'affectedRows' in result ? result.affectedRows : 0;

    if (affectedRows === 0) {
      throw new ServiceError('NOT_FOUND', 'Favorit nicht gefunden oder keine Berechtigung');
    }
  }
}

// Export singleton instance
export const shiftPlansService = new ShiftPlansService();
