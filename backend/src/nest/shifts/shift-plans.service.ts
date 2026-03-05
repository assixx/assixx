/**
 * Shift Plans Service
 *
 * Sub-service for shift plan management.
 * Handles plan CRUD, shift upserts, orphan cleanup, and UUID resolution.
 * Injected into the ShiftsService facade.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateShiftPlanDto } from './dto/shift-plan.dto.js';
import type { UpdateShiftPlanDto } from './dto/update-shift-plan.dto.js';
import { buildTimestamp } from './shifts.helpers.js';
import type {
  DbShiftPlanRow,
  ShiftPlanFilters,
  ShiftPlanResponse,
} from './shifts.types.js';

@Injectable()
export class ShiftPlansService {
  private readonly logger = new Logger(ShiftPlansService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /**
   * Finds the most recent shift plan matching the given filters.
   * Used by the facade for getShiftPlan orchestration.
   */
  async findPlan(
    filters: ShiftPlanFilters,
    tenantId: number,
  ): Promise<DbShiftPlanRow | undefined> {
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
    const plans = await this.databaseService.query<DbShiftPlanRow>(
      planQuery,
      planParams,
    );
    return plans[0];
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
        uuid, tenant_id, area_id, department_id, team_id, asset_id,
        name, start_date, end_date, shift_notes, is_tpm_mode, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        planUuid,
        tenantId,
        dto.areaId ?? null,
        dto.departmentId,
        dto.teamId ?? null,
        dto.assetId ?? null,
        dto.name ?? `Shift Plan ${dto.startDate}`,
        dto.startDate,
        dto.endDate,
        dto.shiftNotes ?? null,
        dto.isTpmMode ?? false,
        userId,
      ],
    );

    const planId = planResult[0]?.id ?? 0;
    const shiftIds =
      dto.shifts.length > 0 ?
        await this.insertPlanShifts(dto.shifts, planId, tenantId, dto, userId)
      : [];

    void this.activityLogger.logCreate(
      tenantId,
      userId,
      'shift_plan',
      planId,
      `Schichtplan erstellt: ${dto.name ?? dto.startDate}`,
      {
        name: dto.name,
        startDate: dto.startDate,
        endDate: dto.endDate,
        shiftCount: dto.shifts.length,
      },
    );

    return { planId, shiftIds, message: 'Shift plan created successfully' };
  }

  async updateShiftPlan(
    planId: number,
    dto: UpdateShiftPlanDto,
    tenantId: number,
    userId: number,
  ): Promise<ShiftPlanResponse> {
    this.logger.debug(
      `Updating shift plan ${planId}, DTO: ${JSON.stringify(dto, null, 2)}`,
    );

    const plans = await this.databaseService.query<DbShiftPlanRow>(
      `SELECT * FROM shift_plans WHERE id = $1 AND tenant_id = $2`,
      [planId, tenantId],
    );
    if (plans.length === 0) {
      throw new NotFoundException(`Shift plan ${planId} not found`);
    }

    // Update plan metadata if changed
    await this.applyShiftPlanUpdates(planId, tenantId, dto);

    // Upsert shifts and get IDs of shifts that should exist
    const plan = plans[0];
    const shiftIds =
      dto.shifts !== undefined && dto.shifts.length > 0 ?
        await this.upsertPlanShifts(
          dto.shifts,
          planId,
          tenantId,
          {
            departmentId: dto.departmentId ?? plan?.department_id,
            teamId: dto.teamId ?? plan?.team_id,
            areaId: dto.areaId ?? plan?.area_id,
            assetId: dto.assetId ?? plan?.asset_id,
          },
          userId,
        )
      : [];

    // Clean up orphaned shifts and rotation history
    await this.deleteOrphanedPlanShifts(
      planId,
      tenantId,
      shiftIds,
      dto.shifts?.length === 0,
    );
    const teamId = dto.teamId ?? plan?.team_id ?? null;
    if (teamId !== null && dto.shifts !== undefined) {
      await this.cleanupOrphanedRotationHistory(tenantId, teamId, dto.shifts);
    }

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'shift_plan',
      planId,
      `Schichtplan aktualisiert: ${dto.name ?? plan?.name ?? planId}`,
      undefined,
      {
        name: dto.name,
        shiftNotes: dto.shiftNotes,
        shiftCount: dto.shifts?.length,
      },
    );

    return { planId, shiftIds, message: 'Shift plan updated successfully' };
  }

  /**
   * Resolves a shift plan UUID to its internal ID
   * @throws NotFoundException
   */
  async resolveShiftPlanIdByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<number> {
    const result = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM shift_plans WHERE uuid = $1 AND tenant_id = $2`,
      [uuid, tenantId],
    );
    if (result[0] === undefined) {
      throw new NotFoundException(`Shift plan with UUID ${uuid} not found`);
    }
    return result[0].id;
  }

  /**
   * Update shift plan by UUID (wrapper for UUID-based API)
   */
  async updateShiftPlanByUuid(
    uuid: string,
    dto: UpdateShiftPlanDto,
    tenantId: number,
    userId: number,
  ): Promise<ShiftPlanResponse> {
    const planId = await this.resolveShiftPlanIdByUuid(uuid, tenantId);
    return await this.updateShiftPlan(planId, dto, tenantId, userId);
  }

  /**
   * Delete shift plan by UUID (wrapper for UUID-based API)
   */
  async deleteShiftPlanByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    const planId = await this.resolveShiftPlanIdByUuid(uuid, tenantId);
    await this.deleteShiftPlan(planId, tenantId, userId);
  }

  async deleteShiftPlan(
    planId: number,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    this.logger.debug(`Deleting shift plan ${planId} for tenant ${tenantId}`);

    const plans = await this.databaseService.query<DbShiftPlanRow>(
      `SELECT * FROM shift_plans WHERE id = $1 AND tenant_id = $2`,
      [planId, tenantId],
    );

    if (plans.length === 0) {
      throw new NotFoundException(`Shift plan ${planId} not found`);
    }

    const plan = plans[0];

    // Delete associated shifts first
    await this.databaseService.query(
      `DELETE FROM shifts WHERE plan_id = $1 AND tenant_id = $2`,
      [planId, tenantId],
    );

    // Delete the plan
    await this.databaseService.query(
      `DELETE FROM shift_plans WHERE id = $1 AND tenant_id = $2`,
      [planId, tenantId],
    );

    void this.activityLogger.logDelete(
      tenantId,
      userId,
      'shift_plan',
      planId,
      `Schichtplan gelöscht: ${plan?.name ?? planId}`,
      {
        name: plan?.name,
        startDate: plan?.start_date,
        endDate: plan?.end_date,
      },
    );
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Inserts shifts for a new plan
   */
  private async insertPlanShifts(
    shifts: CreateShiftPlanDto['shifts'],
    planId: number,
    tenantId: number,
    context: Pick<
      CreateShiftPlanDto,
      'areaId' | 'departmentId' | 'teamId' | 'assetId'
    >,
    createdBy: number,
  ): Promise<number[]> {
    const shiftIds: number[] = [];
    for (const shift of shifts) {
      const startTimestamp = buildTimestamp(shift.date, shift.startTime);
      const endTimestamp = buildTimestamp(shift.date, shift.endTime);
      const result = await this.databaseService.query<{ id: number }>(
        `INSERT INTO shifts (
          tenant_id, plan_id, user_id, date, start_time, end_time, type,
          area_id, department_id, team_id, asset_id, created_by
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
          context.assetId ?? null,
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
      assetId: number | null | undefined;
    },
    createdBy: number,
  ): Promise<number[]> {
    const shiftIds: number[] = [];
    for (const shift of shifts) {
      // Combine date + time to create full timestamps for PostgreSQL (with defaults)
      const startTimestamp = buildTimestamp(
        shift.date,
        shift.startTime,
        '08:00',
      );
      const endTimestamp = buildTimestamp(shift.date, shift.endTime, '16:00');

      const result = await this.databaseService.query<{ id: number }>(
        `INSERT INTO shifts (
          tenant_id, plan_id, user_id, date, start_time, end_time, type,
          area_id, department_id, team_id, asset_id, created_by
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
          context.assetId ?? null,
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
   * Apply updates to shift plan metadata (name, notes)
   */
  private async applyShiftPlanUpdates(
    planId: number,
    tenantId: number,
    dto: UpdateShiftPlanDto,
  ): Promise<void> {
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
    if (dto.isTpmMode !== undefined) {
      updates.push(`is_tpm_mode = $${idx++}`);
      params.push(dto.isTpmMode);
    }
    if (updates.length > 0) {
      params.push(planId, tenantId);
      await this.databaseService.query(
        `UPDATE shift_plans SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx++} AND tenant_id = $${idx}`,
        params,
      );
    }
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
    this.logger.debug(
      `deleteOrphanedPlanShifts: keepShiftIds=[${keepShiftIds.join(', ')}], deleteAll=${deleteAll}`,
    );
    if (keepShiftIds.length > 0) {
      const placeholders = keepShiftIds
        .map((_: number, i: number) => `$${i + 3}`)
        .join(', ');
      await this.databaseService.query(
        `DELETE FROM shifts WHERE plan_id = $1 AND tenant_id = $2 AND id NOT IN (${placeholders})`,
        [planId, tenantId, ...keepShiftIds],
      );
      this.logger.debug(`Cleaned up orphaned shifts for plan ${planId}`);
    } else if (deleteAll) {
      await this.databaseService.query(
        `DELETE FROM shifts WHERE plan_id = $1 AND tenant_id = $2`,
        [planId, tenantId],
      );
      this.logger.debug(
        `Deleted all shifts for plan ${planId} (empty shifts array)`,
      );
    }
  }

  /**
   * Cleans up rotation_history entries that no longer have corresponding shifts.
   * Called when a user edits a shift plan and removes employees from shifts.
   */
  private async cleanupOrphanedRotationHistory(
    tenantId: number,
    teamId: number,
    keptShifts: { userId: number; date: string }[],
  ): Promise<void> {
    if (keptShifts.length === 0) {
      return;
    }

    interface KeptShift {
      userId: number;
      date: string;
    }
    const dates = keptShifts.map((shift: KeptShift) => shift.date);
    const minDate = dates.reduce((a: string, b: string) => (a < b ? a : b));

    const keptValues = keptShifts
      .map(
        (_: KeptShift, i: number) =>
          `($${i * 2 + 4}::integer, $${i * 2 + 5}::date)`,
      )
      .join(', ');
    const keptParams = keptShifts.flatMap((s: KeptShift) => [s.userId, s.date]);

    const deleteQuery = `
      DELETE FROM shift_rotation_history
      WHERE tenant_id = $1
        AND team_id = $2
        AND shift_date >= $3::date
        AND shift_date <= (SELECT MAX(d) FROM (VALUES ${keptValues}) AS t(u, d))
        AND (user_id, shift_date) NOT IN (
          SELECT u, d FROM (VALUES ${keptValues}) AS kept(u, d)
        )
    `;

    const result = await this.databaseService.query<{ count: string }>(
      `WITH deleted AS (${deleteQuery} RETURNING *) SELECT COUNT(*) as count FROM deleted`,
      [tenantId, teamId, minDate, ...keptParams],
    );

    const deletedCount = Number.parseInt(result[0]?.count ?? '0', 10);
    if (deletedCount > 0) {
      this.logger.debug(
        `Cleaned up ${deletedCount} orphaned rotation_history entries for team ${teamId}`,
      );
    }
  }
}
