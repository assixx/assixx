/**
 * Shift Plans Service
 * Handles shift plan operations and favorites management
 */
import { RowDataPacket } from 'mysql2';

import { ServiceError } from '../../../utils/ServiceError';
import { execute, query } from '../../../utils/db';
import { dbToApi } from '../../../utils/fieldMapping';
import { logger } from '../../../utils/logger';
import { kontischichtService } from './kontischicht.service';

interface ShiftPlanData {
  startDate: string;
  endDate: string;
  areaId?: number;
  departmentId: number;
  teamId?: number;
  machineId?: number;
  name?: string;
  shiftNotes?: string;
  kontischichtPattern?: string;
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

export class ShiftPlansService {
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
    const [planResult] = await execute(
      `INSERT INTO shift_plans (
        tenant_id, name, shift_notes,
        department_id, team_id, machine_id, area_id,
        start_date, end_date, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [
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

    return (planResult as { insertId: number }).insertId;
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
      const [shiftResult] = await execute(
        `INSERT INTO shifts (
          tenant_id, plan_id, user_id,
          date, start_time, end_time, type,
          area_id, department_id, team_id, machine_id,
          status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?)`,
        [
          tenantId,
          planId,
          shift.userId,
          shift.date,
          `${shift.date} ${shift.startTime}:00`,
          `${shift.date} ${shift.endTime}:00`,
          shift.type,
          data.areaId ?? null,
          data.departmentId,
          data.teamId ?? null,
          data.machineId ?? null,
          userId,
        ],
      );
      shiftIds.push((shiftResult as { insertId: number }).insertId);
    }

    return shiftIds;
  }

  /**
   * Create a complete shift plan with shifts and notes
   * @param data - Shift plan data containing startDate, endDate, areaId, departmentId, teamId, machineId, name, shiftNotes, and shifts array
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

      // Prepare plan name
      const weekNumber = this.getWeekNumber(new Date(data.startDate));
      const planName =
        data.name ??
        `Wochenplan KW ${String(weekNumber)}/${String(new Date(data.startDate).getFullYear())}`;

      // Determine date range based on plan type
      const isKontischicht = kontischichtService.isKontischichtPlan(
        planName,
        data.name,
        data.kontischichtPattern,
      );

      const dateRange =
        isKontischicht ?
          kontischichtService.calculateKontischichtDateRange(data.startDate, data.endDate)
        : { planStartDate: data.startDate, planEndDate: data.endDate };

      // Create the shift plan
      const planId = await this.createShiftPlanRecord(data, tenantId, userId, planName, dateRange);

      // Prepare shifts (with Kontischicht pattern generation if needed)
      const shiftsToCreate = kontischichtService.prepareShiftsForCreation(data, isKontischicht);

      // Create all shifts
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

      throw new ServiceError('CREATE_PLAN_ERROR', `Failed to create shift plan: ${errorMessage}`);
    }
  }

  /**
   * Build UPDATE query fields and values for shift plan
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
    if (data.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(data.name);
    }
    if (data.shiftNotes !== undefined) {
      updateFields.push('shift_notes = ?');
      updateValues.push(data.shiftNotes);
    }
    if (data.startDate !== undefined) {
      updateFields.push('start_date = ?');
      updateValues.push(data.startDate);
    }
    if (data.endDate !== undefined) {
      updateFields.push('end_date = ?');
      updateValues.push(data.endDate);
    }
    if (data.departmentId !== undefined) {
      updateFields.push('department_id = ?');
      updateValues.push(data.departmentId);
    }
    if (data.teamId !== undefined) {
      updateFields.push('team_id = ?');
      updateValues.push(data.teamId);
    }
    if (data.machineId !== undefined) {
      updateFields.push('machine_id = ?');
      updateValues.push(data.machineId);
    }
    if (data.areaId !== undefined) {
      updateFields.push('area_id = ?');
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
      'SELECT id, department_id FROM shift_plans WHERE id = ? AND tenant_id = ?',
      [planId, tenantId],
    );

    if ((existingPlans as unknown[]).length === 0) {
      throw new ServiceError('NOT_FOUND', 'Shift plan not found');
    }

    return (existingPlans as { id: number; department_id: number }[])[0];
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
    await execute('DELETE FROM shifts WHERE plan_id = ? AND tenant_id = ?', [planId, tenantId]);

    // Insert new shifts
    const shiftIds: number[] = [];
    for (const shift of shifts) {
      const [result] = await execute(
        `INSERT INTO shifts (
          tenant_id, plan_id, user_id, date, type,
          start_time, end_time, department_id, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          tenantId,
          planId,
          shift.userId,
          shift.date,
          shift.type,
          shift.startTime ?? '06:00:00',
          shift.endTime ?? '14:00:00',
          departmentId,
          userId,
        ],
      );

      shiftIds.push((result as { insertId: number }).insertId);
    }

    return shiftIds;
  }

  /**
   * Get shift plan with all shifts and notes
   * @param filters - Filter object containing areaId, departmentId, teamId, machineId, startDate, and endDate
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @returns Object containing plan details, shifts array and notes
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
  ): Promise<{
    plan?: unknown;
    shifts: unknown[];
    notes: unknown[];
  }> {
    try {
      // Find plan
      let planQuery = `
        SELECT * FROM shift_plans
        WHERE tenant_id = ?
      `;
      const params: (string | number)[] = [tenantId];

      if (filters.departmentId !== undefined) {
        planQuery += ' AND department_id = ?';
        params.push(filters.departmentId);
      }
      if (filters.teamId !== undefined) {
        planQuery += ' AND team_id = ?';
        params.push(filters.teamId);
      }
      if (filters.machineId !== undefined) {
        planQuery += ' AND machine_id = ?';
        params.push(filters.machineId);
      }
      if (filters.areaId !== undefined) {
        planQuery += ' AND area_id = ?';
        params.push(filters.areaId);
      }
      if (
        filters.startDate !== undefined &&
        filters.startDate !== '' &&
        filters.endDate !== undefined &&
        filters.endDate !== ''
      ) {
        planQuery += ' AND start_date <= ? AND end_date >= ?';
        params.push(filters.endDate, filters.startDate);
      }

      planQuery += ' ORDER BY created_at DESC LIMIT 1';

      const [plans] = await execute(planQuery, params);
      const plan = (plans as unknown[])[0];

      if (plan === undefined || plan === null) {
        return { shifts: [], notes: [] };
      }

      // Get shifts for this plan
      const [shifts] = await execute(
        `SELECT s.*, u.first_name, u.last_name, u.username
         FROM shifts s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.plan_id = ?
         ORDER BY s.date, s.start_time`,
        [(plan as { id: number }).id],
      );

      // REMOVED: Loading from shift_notes - using shift_plans.description instead
      // The plan.description contains the weekly notes
      // Return empty notes array for backward compatibility

      return {
        plan: dbToApi(plan as Record<string, unknown>),
        shifts: (shifts as unknown[]).map((s) => dbToApi(s as Record<string, unknown>)),
        notes: [], // Empty - notes are in plan.description now
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
        values.push(planId, tenantId);
        await execute(
          `UPDATE shift_plans SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
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
      'SELECT id, department_id, team_id FROM shift_plans WHERE id = ? AND tenant_id = ?',
      [planId, tenantId],
    );

    if (!Array.isArray(plans) || plans.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Shift plan not found');
    }

    // Delete all shifts associated with this plan
    await execute('DELETE FROM shifts WHERE plan_id = ? AND tenant_id = ?', [planId, tenantId]);

    // Delete the shift plan itself
    const [result] = await execute('DELETE FROM shift_plans WHERE id = ? AND tenant_id = ?', [
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
        area_id as areaId,
        area_name as areaName,
        department_id as departmentId,
        department_name as departmentName,
        machine_id as machineId,
        machine_name as machineName,
        team_id as teamId,
        team_name as teamName,
        created_at as createdAt
      FROM shift_favorites
      WHERE tenant_id = ? AND user_id = ?
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
      'SELECT id FROM shift_favorites WHERE tenant_id = ? AND user_id = ? AND name = ?',
      [tenantId, userId, data.name],
    );

    if (existing.length > 0) {
      throw new ServiceError('DUPLICATE', 'Ein Favorit mit diesem Namen existiert bereits');
    }

    // Insert new favorite
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    const insertId = 'insertId' in result ? result.insertId : 0;

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
      'DELETE FROM shift_favorites WHERE id = ? AND tenant_id = ? AND user_id = ?',
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
