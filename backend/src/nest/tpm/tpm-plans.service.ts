/**
 * TPM Plans Service
 *
 * CRUD operations for maintenance plans.
 * Each plan belongs to exactly one machine (UNIQUE constraint).
 * Uses tenantTransaction() for mutations, direct queries for reads.
 */
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateMaintenancePlanDto } from './dto/create-maintenance-plan.dto.js';
import type { UpdateMaintenancePlanDto } from './dto/update-maintenance-plan.dto.js';
import {
  type TpmPlanJoinRow,
  buildPlanUpdateFields,
  mapPlanRowToApi,
} from './tpm-plans.helpers.js';
import type { TpmIntervalType, TpmPlan } from './tpm.types.js';

/** Single entry in the interval matrix: one plan × one interval */
export interface IntervalMatrixEntry {
  planUuid: string;
  intervalType: TpmIntervalType;
  cardCount: number;
}

/** Paginated plan list response */
export interface PaginatedPlans {
  data: TpmPlan[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class TpmPlansService {
  private readonly logger = new Logger(TpmPlansService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /** Get a single plan by UUID */
  async getPlan(tenantId: number, planUuid: string): Promise<TpmPlan> {
    const row = await this.db.queryOne<TpmPlanJoinRow>(
      `SELECT p.*, m.name AS machine_name, u.username AS created_by_name
       FROM tpm_maintenance_plans p
       LEFT JOIN machines m ON p.machine_id = m.id AND m.tenant_id = p.tenant_id
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.uuid = $1 AND p.tenant_id = $2 AND p.is_active = 1`,
      [planUuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException(`Wartungsplan ${planUuid} nicht gefunden`);
    }

    return mapPlanRowToApi(row);
  }

  /** List plans with pagination */
  async listPlans(
    tenantId: number,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedPlans> {
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM tpm_maintenance_plans
       WHERE tenant_id = $1 AND is_active = 1`,
      [tenantId],
    );
    const total = Number.parseInt(countResult?.count ?? '0', 10);

    const rows = await this.db.query<TpmPlanJoinRow>(
      `SELECT p.*, m.name AS machine_name, u.username AS created_by_name
       FROM tpm_maintenance_plans p
       LEFT JOIN machines m ON p.machine_id = m.id AND m.tenant_id = p.tenant_id
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.tenant_id = $1 AND p.is_active = 1
       ORDER BY p.name ASC
       LIMIT $2 OFFSET $3`,
      [tenantId, pageSize, offset],
    );

    return {
      data: rows.map(mapPlanRowToApi),
      total,
      page,
      pageSize,
    };
  }

  /** Get interval matrix: which plans have cards for which interval types */
  async getIntervalMatrix(tenantId: number): Promise<IntervalMatrixEntry[]> {
    interface MatrixRow {
      plan_uuid: string;
      interval_type: TpmIntervalType;
      card_count: string;
    }

    const rows = await this.db.query<MatrixRow>(
      `SELECT p.uuid AS plan_uuid, c.interval_type, COUNT(*)::text AS card_count
       FROM tpm_cards c
       JOIN tpm_maintenance_plans p ON c.plan_id = p.id
       WHERE c.tenant_id = $1 AND c.is_active = 1 AND p.is_active = 1
       GROUP BY p.uuid, c.interval_type
       ORDER BY p.uuid, c.interval_type`,
      [tenantId],
    );

    return rows.map((r: MatrixRow) => ({
      planUuid: r.plan_uuid,
      intervalType: r.interval_type,
      cardCount: Number.parseInt(r.card_count, 10),
    }));
  }

  /** Get plan by machine ID (for slot assistant and inter-service lookups) */
  async getPlanByMachineId(
    tenantId: number,
    machineId: number,
  ): Promise<TpmPlan | null> {
    const row = await this.db.queryOne<TpmPlanJoinRow>(
      `SELECT p.*, m.name AS machine_name, u.username AS created_by_name
       FROM tpm_maintenance_plans p
       LEFT JOIN machines m ON p.machine_id = m.id AND m.tenant_id = p.tenant_id
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.machine_id = $1 AND p.tenant_id = $2 AND p.is_active = 1`,
      [machineId, tenantId],
    );

    if (row === null) return null;

    return mapPlanRowToApi(row);
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  /** Create a new maintenance plan */
  async createPlan(
    tenantId: number,
    userId: number,
    dto: CreateMaintenancePlanDto,
  ): Promise<TpmPlan> {
    this.logger.debug(
      `Creating plan "${dto.name}" for machine ${dto.machineUuid}`,
    );

    const plan = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmPlan> => {
        // Resolve machine UUID → internal ID
        const machineId = await this.resolveMachineId(
          client,
          tenantId,
          dto.machineUuid,
        );

        // Check uniqueness: one active plan per machine
        await this.ensureNoPlanForMachine(client, tenantId, machineId);

        // INSERT
        const uuid = uuidv7();
        const result = await client.query<TpmPlanJoinRow>(
          `INSERT INTO tpm_maintenance_plans
             (uuid, tenant_id, machine_id, name, base_weekday, base_repeat_every,
              base_time, shift_plan_required, notes, created_by, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
           RETURNING *`,
          [
            uuid,
            tenantId,
            machineId,
            dto.name,
            dto.baseWeekday,
            dto.baseRepeatEvery,
            dto.baseTime ?? null,
            dto.shiftPlanRequired,
            dto.notes ?? null,
            userId,
          ],
        );

        const row = result.rows[0];
        if (row === undefined) {
          throw new Error('INSERT into tpm_maintenance_plans returned no rows');
        }

        return mapPlanRowToApi(row);
      },
    );

    void this.activityLogger.logCreate(
      tenantId,
      userId,
      'tpm_plan',
      plan.machineId,
      `TPM-Wartungsplan erstellt: ${plan.name}`,
      { planUuid: plan.uuid, machineName: plan.machineName },
    );

    return plan;
  }

  /** Update an existing maintenance plan */
  async updatePlan(
    tenantId: number,
    userId: number,
    planUuid: string,
    dto: UpdateMaintenancePlanDto,
  ): Promise<TpmPlan> {
    const plan = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmPlan> => {
        // Lock the row
        const existing = await this.lockPlanByUuid(client, tenantId, planUuid);

        // Build dynamic SET clause
        const { setClauses, params, nextParamIndex } = buildPlanUpdateFields(
          dto as Record<string, unknown>,
        );

        if (setClauses.length === 0) {
          return mapPlanRowToApi(existing);
        }

        // Append WHERE params
        params.push(planUuid, tenantId);
        const sql = `UPDATE tpm_maintenance_plans
                     SET ${setClauses.join(', ')}, updated_at = NOW()
                     WHERE uuid = $${nextParamIndex} AND tenant_id = $${nextParamIndex + 1} AND is_active = 1
                     RETURNING *`;

        const result = await client.query<TpmPlanJoinRow>(sql, params);
        const row = result.rows[0];
        if (row === undefined) {
          throw new Error('UPDATE tpm_maintenance_plans returned no rows');
        }

        return mapPlanRowToApi(row);
      },
    );

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'tpm_plan',
      plan.machineId,
      `TPM-Wartungsplan aktualisiert: ${plan.name}`,
      { planUuid },
      dto as Record<string, unknown>,
    );

    return plan;
  }

  /** Soft-delete a maintenance plan (is_active = 4) */
  async deletePlan(
    tenantId: number,
    userId: number,
    planUuid: string,
  ): Promise<void> {
    const plan = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmPlan> => {
        const existing = await this.lockPlanByUuid(client, tenantId, planUuid);

        await client.query(
          `UPDATE tpm_maintenance_plans
           SET is_active = 4, updated_at = NOW()
           WHERE uuid = $1 AND tenant_id = $2`,
          [planUuid, tenantId],
        );

        return mapPlanRowToApi(existing);
      },
    );

    void this.activityLogger.logDelete(
      tenantId,
      userId,
      'tpm_plan',
      plan.machineId,
      `TPM-Wartungsplan gelöscht: ${plan.name}`,
      { planUuid, machineName: plan.machineName },
    );
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /** Resolve machine UUID to internal ID within a transaction */
  private async resolveMachineId(
    client: PoolClient,
    tenantId: number,
    machineUuid: string,
  ): Promise<number> {
    const result = await client.query<{ id: number }>(
      `SELECT id FROM machines WHERE uuid = $1 AND tenant_id = $2`,
      [machineUuid, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Maschine ${machineUuid} nicht gefunden`);
    }
    return row.id;
  }

  /** Ensure no active plan exists for this machine (UNIQUE constraint guard) */
  private async ensureNoPlanForMachine(
    client: PoolClient,
    tenantId: number,
    machineId: number,
  ): Promise<void> {
    const result = await client.query<{ uuid: string }>(
      `SELECT uuid FROM tpm_maintenance_plans
       WHERE tenant_id = $1 AND machine_id = $2 AND is_active = 1`,
      [tenantId, machineId],
    );
    if (result.rows[0] !== undefined) {
      throw new ConflictException(
        'Für diese Maschine existiert bereits ein aktiver Wartungsplan',
      );
    }
  }

  /** Lock a plan row by UUID for safe mutation (SELECT ... FOR UPDATE) */
  private async lockPlanByUuid(
    client: PoolClient,
    tenantId: number,
    planUuid: string,
  ): Promise<TpmPlanJoinRow> {
    const result = await client.query<TpmPlanJoinRow>(
      `SELECT * FROM tpm_maintenance_plans
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1
       FOR UPDATE`,
      [planUuid, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Wartungsplan ${planUuid} nicht gefunden`);
    }
    return row;
  }
}
