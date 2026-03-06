/**
 * TPM Plans Service
 *
 * CRUD operations for maintenance plans.
 * Each plan belongs to exactly one asset (UNIQUE constraint).
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
  greenCount: number;
  redCount: number;
  yellowCount: number;
  overdueCount: number;
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
      `SELECT p.*, m.uuid AS asset_uuid, m.name AS asset_name, d.name AS department_name, u.username AS created_by_name
       FROM tpm_maintenance_plans p
       LEFT JOIN assets m ON p.asset_id = m.id AND m.tenant_id = p.tenant_id
       LEFT JOIN departments d ON m.department_id = d.id
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.uuid = $1 AND p.tenant_id = $2 AND p.is_active IN (1, 3)`,
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
       WHERE tenant_id = $1 AND is_active IN (1, 3)`,
      [tenantId],
    );
    const total = Number.parseInt(countResult?.count ?? '0', 10);

    const rows = await this.db.query<TpmPlanJoinRow>(
      `SELECT p.*, m.uuid AS asset_uuid, m.name AS asset_name, d.name AS department_name, u.username AS created_by_name
       FROM tpm_maintenance_plans p
       LEFT JOIN assets m ON p.asset_id = m.id AND m.tenant_id = p.tenant_id
       LEFT JOIN departments d ON m.department_id = d.id
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.tenant_id = $1 AND p.is_active IN (1, 3)
       ORDER BY p.is_active ASC, p.name ASC
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
      green_count: string;
      red_count: string;
      yellow_count: string;
      overdue_count: string;
    }

    const rows = await this.db.query<MatrixRow>(
      `SELECT p.uuid AS plan_uuid,
              c.interval_type,
              COUNT(*)::text AS card_count,
              COUNT(*) FILTER (WHERE c.status = 'green')::text AS green_count,
              COUNT(*) FILTER (WHERE c.status = 'red')::text AS red_count,
              COUNT(*) FILTER (WHERE c.status = 'yellow')::text AS yellow_count,
              COUNT(*) FILTER (WHERE c.status = 'overdue')::text AS overdue_count
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
      greenCount: Number.parseInt(r.green_count, 10),
      redCount: Number.parseInt(r.red_count, 10),
      yellowCount: Number.parseInt(r.yellow_count, 10),
      overdueCount: Number.parseInt(r.overdue_count, 10),
    }));
  }

  /** Get plan by asset ID (for slot assistant and inter-service lookups) */
  async getPlanByAssetId(
    tenantId: number,
    assetId: number,
  ): Promise<TpmPlan | null> {
    const row = await this.db.queryOne<TpmPlanJoinRow>(
      `SELECT p.*, m.uuid AS asset_uuid, m.name AS asset_name, d.name AS department_name, u.username AS created_by_name
       FROM tpm_maintenance_plans p
       LEFT JOIN assets m ON p.asset_id = m.id AND m.tenant_id = p.tenant_id
       LEFT JOIN departments d ON m.department_id = d.id
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.asset_id = $1 AND p.tenant_id = $2 AND p.is_active = 1`,
      [assetId, tenantId],
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
    this.logger.debug(`Creating plan "${dto.name}" for asset ${dto.assetUuid}`);

    const plan = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmPlan> => {
        // Resolve asset UUID → internal ID
        const assetId = await this.resolveAssetId(
          client,
          tenantId,
          dto.assetUuid,
        );

        // Check uniqueness: one active plan per asset
        await this.ensureNoPlanForAsset(client, tenantId, assetId);

        // INSERT
        const uuid = uuidv7();
        const result = await client.query<TpmPlanJoinRow>(
          `INSERT INTO tpm_maintenance_plans
             (uuid, tenant_id, asset_id, name, base_weekday, base_repeat_every,
              base_time, buffer_hours, shift_plan_required, notes, created_by, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1)
           RETURNING *`,
          [
            uuid,
            tenantId,
            assetId,
            dto.name,
            dto.baseWeekday,
            dto.baseRepeatEvery,
            dto.baseTime ?? null,
            dto.bufferHours,
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
      plan.assetId,
      `TPM-Wartungsplan erstellt: ${plan.name}`,
      { planUuid: plan.uuid, assetName: plan.assetName },
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
      plan.assetId,
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
      plan.assetId,
      `TPM-Wartungsplan gelöscht: ${plan.name}`,
      { planUuid, assetName: plan.assetName },
    );
  }

  /** Archive a maintenance plan (is_active = 3) */
  async archivePlan(
    tenantId: number,
    userId: number,
    planUuid: string,
  ): Promise<TpmPlan> {
    const plan = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmPlan> => {
        const existing = await this.lockPlanByUuid(client, tenantId, planUuid);

        await client.query(
          `UPDATE tpm_maintenance_plans
           SET is_active = 3, updated_at = NOW()
           WHERE uuid = $1 AND tenant_id = $2`,
          [planUuid, tenantId],
        );

        return mapPlanRowToApi(existing);
      },
    );

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'tpm_plan',
      plan.assetId,
      `TPM-Wartungsplan archiviert: ${plan.name}`,
      { planUuid, assetName: plan.assetName },
      { isActive: 3 },
    );

    return plan;
  }

  /** Unarchive a maintenance plan (is_active = 1) */
  async unarchivePlan(
    tenantId: number,
    userId: number,
    planUuid: string,
  ): Promise<TpmPlan> {
    const plan = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmPlan> => {
        const existing = await this.lockPlanByUuidAnyStatus(
          client,
          tenantId,
          planUuid,
        );

        if (existing.is_active !== 3) {
          throw new ConflictException(
            'Nur archivierte Pläne können wiederhergestellt werden',
          );
        }

        // Ensure no other active plan exists for the same asset
        await this.ensureNoPlanForAsset(client, tenantId, existing.asset_id);

        await client.query(
          `UPDATE tpm_maintenance_plans
           SET is_active = 1, updated_at = NOW()
           WHERE uuid = $1 AND tenant_id = $2`,
          [planUuid, tenantId],
        );

        return mapPlanRowToApi(existing);
      },
    );

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'tpm_plan',
      plan.assetId,
      `TPM-Wartungsplan wiederhergestellt: ${plan.name}`,
      { planUuid, assetName: plan.assetName },
      { isActive: 1 },
    );

    return plan;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /** Resolve asset UUID to internal ID within a transaction */
  private async resolveAssetId(
    client: PoolClient,
    tenantId: number,
    assetUuid: string,
  ): Promise<number> {
    const result = await client.query<{ id: number }>(
      `SELECT id FROM assets WHERE uuid = $1 AND tenant_id = $2`,
      [assetUuid, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Anlage ${assetUuid} nicht gefunden`);
    }
    return row.id;
  }

  /** Ensure no active plan exists for this asset (UNIQUE constraint guard) */
  private async ensureNoPlanForAsset(
    client: PoolClient,
    tenantId: number,
    assetId: number,
  ): Promise<void> {
    const result = await client.query<{ uuid: string }>(
      `SELECT uuid FROM tpm_maintenance_plans
       WHERE tenant_id = $1 AND asset_id = $2 AND is_active = 1`,
      [tenantId, assetId],
    );
    if (result.rows[0] !== undefined) {
      throw new ConflictException(
        'Für diese Anlage existiert bereits ein aktiver Wartungsplan',
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

  /** Lock a plan row regardless of is_active status (for unarchive) */
  private async lockPlanByUuidAnyStatus(
    client: PoolClient,
    tenantId: number,
    planUuid: string,
  ): Promise<TpmPlanJoinRow> {
    const result = await client.query<TpmPlanJoinRow>(
      `SELECT * FROM tpm_maintenance_plans
       WHERE uuid = $1 AND tenant_id = $2 AND is_active IN (1, 3)
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
