/**
 * TPM Time Estimates Service
 *
 * Manages SOLL-Zeiten (expected durations) per maintenance interval.
 * One estimate per (plan, interval_type) combination.
 * Uses UPSERT pattern — setEstimate creates or updates in one operation.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import type { CreateTimeEstimateDto } from './dto/create-time-estimate.dto.js';
import type {
  TpmIntervalType,
  TpmTimeEstimate,
  TpmTimeEstimateRow,
} from './tpm.types.js';

/** Map DB row to API response (adds computed totalMinutes) */
function mapEstimateRowToApi(row: TpmTimeEstimateRow): TpmTimeEstimate {
  return {
    uuid: row.uuid.trim(),
    planId: row.plan_id,
    intervalType: row.interval_type,
    staffCount: row.staff_count,
    preparationMinutes: row.preparation_minutes,
    executionMinutes: row.execution_minutes,
    followupMinutes: row.followup_minutes,
    totalMinutes:
      row.preparation_minutes + row.execution_minutes + row.followup_minutes,
    isActive: row.is_active,
    createdAt:
      typeof row.created_at === 'string'
        ? row.created_at
        : new Date(row.created_at).toISOString(),
    updatedAt:
      typeof row.updated_at === 'string'
        ? row.updated_at
        : new Date(row.updated_at).toISOString(),
  };
}

@Injectable()
export class TpmTimeEstimatesService {
  private readonly logger = new Logger(TpmTimeEstimatesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Set (create or update) a time estimate for a plan+interval combination.
   * Uses PostgreSQL UPSERT: INSERT ... ON CONFLICT DO UPDATE.
   */
  async setEstimate(
    tenantId: number,
    dto: CreateTimeEstimateDto,
  ): Promise<TpmTimeEstimate> {
    this.logger.debug(
      `Setting estimate for plan ${dto.planUuid} / ${dto.intervalType}`,
    );

    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmTimeEstimate> => {
        const planId = await this.resolvePlanId(
          client,
          tenantId,
          dto.planUuid,
        );

        const result = await client.query<TpmTimeEstimateRow>(
          `INSERT INTO tpm_time_estimates
             (uuid, tenant_id, plan_id, interval_type, staff_count,
              preparation_minutes, execution_minutes, followup_minutes, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
           ON CONFLICT (plan_id, interval_type) WHERE is_active = 1
           DO UPDATE SET
             staff_count = EXCLUDED.staff_count,
             preparation_minutes = EXCLUDED.preparation_minutes,
             execution_minutes = EXCLUDED.execution_minutes,
             followup_minutes = EXCLUDED.followup_minutes,
             updated_at = NOW()
           RETURNING *`,
          [
            uuidv7(),
            tenantId,
            planId,
            dto.intervalType,
            dto.staffCount,
            dto.preparationMinutes,
            dto.executionMinutes,
            dto.followupMinutes,
          ],
        );

        const row = result.rows[0];
        if (row === undefined) {
          throw new Error('UPSERT tpm_time_estimates returned no rows');
        }

        return mapEstimateRowToApi(row);
      },
    );
  }

  /** Get all time estimates for a plan */
  async getEstimatesForPlan(
    tenantId: number,
    planUuid: string,
  ): Promise<TpmTimeEstimate[]> {
    const rows = await this.db.query<TpmTimeEstimateRow>(
      `SELECT te.*
       FROM tpm_time_estimates te
       JOIN tpm_maintenance_plans p ON te.plan_id = p.id
       WHERE p.uuid = $1 AND te.tenant_id = $2 AND te.is_active = 1
       ORDER BY te.interval_type`,
      [planUuid, tenantId],
    );

    return rows.map(mapEstimateRowToApi);
  }

  /** Get a single estimate for a plan+interval combination */
  async getEstimateForInterval(
    tenantId: number,
    planUuid: string,
    intervalType: TpmIntervalType,
  ): Promise<TpmTimeEstimate | null> {
    const row = await this.db.queryOne<TpmTimeEstimateRow>(
      `SELECT te.*
       FROM tpm_time_estimates te
       JOIN tpm_maintenance_plans p ON te.plan_id = p.id
       WHERE p.uuid = $1 AND te.tenant_id = $2
         AND te.interval_type = $3 AND te.is_active = 1`,
      [planUuid, tenantId, intervalType],
    );

    if (row === null) return null;

    return mapEstimateRowToApi(row);
  }

  /** Delete a time estimate (soft-delete: is_active = 4) */
  async deleteEstimate(
    tenantId: number,
    estimateUuid: string,
  ): Promise<void> {
    const result = await this.db.query<{ id: number }>(
      `UPDATE tpm_time_estimates
       SET is_active = 4, updated_at = NOW()
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1
       RETURNING id`,
      [estimateUuid, tenantId],
    );

    if (result[0] === undefined) {
      throw new NotFoundException(
        `Zeitschätzung ${estimateUuid} nicht gefunden`,
      );
    }
  }

  /** Resolve plan UUID → internal ID */
  private async resolvePlanId(
    client: PoolClient,
    tenantId: number,
    planUuid: string,
  ): Promise<number> {
    const result = await client.query<{ id: number }>(
      `SELECT id FROM tpm_maintenance_plans
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1`,
      [planUuid, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Wartungsplan ${planUuid} nicht gefunden`);
    }
    return row.id;
  }
}
