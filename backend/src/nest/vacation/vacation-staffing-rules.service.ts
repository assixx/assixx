/**
 * Vacation Staffing Rules Service
 *
 * Manages minimum staffing requirements per asset.
 * Each rule says: "Asset X needs at least N operators available."
 * The capacity service uses these rules to determine if a vacation
 * request can be approved without understaffing a asset.
 *
 * Staffing rules table: `vacation_staffing_rules` (Migration 29)
 * - UNIQUE(tenant_id, asset_id) — one rule per asset per tenant
 * - CHECK(min_staff_count \> 0) — must require at least 1 person
 * - RLS enforced via `db.tenantTransaction()` (ADR-019)
 *
 * Used by: Capacity service (asset availability analysis)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
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
import type { CreateStaffingRuleDto } from './dto/create-staffing-rule.dto.js';
import type { UpdateStaffingRuleDto } from './dto/update-staffing-rule.dto.js';
import type {
  VacationStaffingRule,
  VacationStaffingRuleRow,
} from './vacation.types.js';

/** Row shape for staffing rule query with asset name JOIN */
interface StaffingRuleWithAssetRow extends VacationStaffingRuleRow {
  asset_name: string | null;
}

@Injectable()
export class VacationStaffingRulesService {
  private readonly logger: Logger = new Logger(
    VacationStaffingRulesService.name,
  );

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /**
   * Get all active staffing rules for a tenant.
   * JOINs assets table to include asset name.
   */
  async getStaffingRules(tenantId: number): Promise<VacationStaffingRule[]> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationStaffingRule[]> => {
        const result = await client.query<StaffingRuleWithAssetRow>(
          `SELECT vsr.id, vsr.tenant_id, vsr.asset_id, vsr.min_staff_count,
                  vsr.is_active, vsr.created_by, vsr.created_at, vsr.updated_at,
                  m.name AS asset_name
           FROM vacation_staffing_rules vsr
           LEFT JOIN assets m ON vsr.asset_id = m.id
           WHERE vsr.tenant_id = $1 AND vsr.is_active = ${IS_ACTIVE.ACTIVE}
           ORDER BY m.name ASC NULLS LAST`,
          [tenantId],
        );

        return result.rows.map((row: StaffingRuleWithAssetRow) =>
          this.mapRowToStaffingRule(row),
        );
      },
    );
  }

  /**
   * Create a new staffing rule for a asset.
   * Throws ConflictException on duplicate (tenant_id, asset_id).
   */
  async createStaffingRule(
    tenantId: number,
    userId: number,
    dto: CreateStaffingRuleDto,
  ): Promise<VacationStaffingRule> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationStaffingRule> => {
        const id: string = uuidv7();

        try {
          const result = await client.query<StaffingRuleWithAssetRow>(
            `WITH inserted AS (
              INSERT INTO vacation_staffing_rules
                (id, tenant_id, asset_id, min_staff_count, created_by)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING *
            )
            SELECT ins.id, ins.tenant_id, ins.asset_id, ins.min_staff_count,
                   ins.is_active, ins.created_by, ins.created_at, ins.updated_at,
                   m.name AS asset_name
            FROM inserted ins
            LEFT JOIN assets m ON ins.asset_id = m.id`,
            [id, tenantId, dto.assetId, dto.minStaffCount, userId],
          );

          const row: StaffingRuleWithAssetRow | undefined = result.rows[0];
          if (row === undefined) {
            throw new Error(
              'INSERT into vacation_staffing_rules returned no rows',
            );
          }

          this.logger.log(
            `Staffing rule created: asset ${dto.assetId} → min ${dto.minStaffCount} (tenant ${tenantId})`,
          );

          void this.activityLogger.log({
            tenantId,
            userId,
            action: 'create',
            entityType: 'vacation_staffing_rule',
            details: `Besetzungsregel erstellt: Anlage ${String(dto.assetId)} → min. ${String(dto.minStaffCount)}`,
            newValues: {
              ruleId: id,
              assetId: dto.assetId,
              minStaffCount: dto.minStaffCount,
            },
          });

          return this.mapRowToStaffingRule(row);
        } catch (error: unknown) {
          if (this.isUniqueViolation(error)) {
            throw new ConflictException(
              `A staffing rule already exists for asset ${dto.assetId}`,
            );
          }
          throw error;
        }
      },
    );
  }

  /**
   * Update an existing staffing rule.
   * Throws NotFoundException if not found or soft-deleted.
   */
  async updateStaffingRule(
    tenantId: number,
    userId: number,
    id: string,
    dto: UpdateStaffingRuleDto,
  ): Promise<VacationStaffingRule> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationStaffingRule> => {
        const result = await client.query<StaffingRuleWithAssetRow>(
          `WITH updated AS (
            UPDATE vacation_staffing_rules
            SET min_staff_count = $1, updated_at = NOW()
            WHERE id = $2 AND tenant_id = $3 AND is_active = ${IS_ACTIVE.ACTIVE}
            RETURNING *
          )
          SELECT upd.id, upd.tenant_id, upd.asset_id, upd.min_staff_count,
                 upd.is_active, upd.created_by, upd.created_at, upd.updated_at,
                 m.name AS asset_name
          FROM updated upd
          LEFT JOIN assets m ON upd.asset_id = m.id`,
          [dto.minStaffCount, id, tenantId],
        );

        const row: StaffingRuleWithAssetRow | undefined = result.rows[0];
        if (row === undefined) {
          throw new NotFoundException(`Staffing rule ${id} not found`);
        }

        this.logger.log(
          `Staffing rule updated: ${id} → min ${dto.minStaffCount} (tenant ${tenantId})`,
        );

        void this.activityLogger.log({
          tenantId,
          userId,
          action: 'update',
          entityType: 'vacation_staffing_rule',
          details: `Besetzungsregel aktualisiert: ${row.asset_name ?? String(row.asset_id)} → min. ${String(dto.minStaffCount)}`,
          newValues: {
            ruleId: id,
            assetId: row.asset_id,
            minStaffCount: dto.minStaffCount,
          },
        });

        return this.mapRowToStaffingRule(row);
      },
    );
  }

  /**
   * Soft-delete a staffing rule (is_active = 4).
   * Throws NotFoundException if not found.
   */
  async deleteStaffingRule(
    tenantId: number,
    userId: number,
    id: string,
  ): Promise<void> {
    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        const result = await client.query<{
          id: string;
          asset_id: number;
          min_staff_count: number;
        }>(
          `UPDATE vacation_staffing_rules
           SET is_active = ${IS_ACTIVE.DELETED}, updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
           RETURNING id, asset_id, min_staff_count`,
          [id, tenantId],
        );

        const deleted = result.rows[0];
        if (deleted === undefined) {
          throw new NotFoundException(`Staffing rule ${id} not found`);
        }

        this.logger.log(
          `Staffing rule soft-deleted: ${id} (tenant ${tenantId})`,
        );

        void this.activityLogger.log({
          tenantId,
          userId,
          action: 'delete',
          entityType: 'vacation_staffing_rule',
          details: `Besetzungsregel gelöscht: Anlage ${String(deleted.asset_id)} (${id})`,
          oldValues: {
            ruleId: id,
            assetId: deleted.asset_id,
            minStaffCount: deleted.min_staff_count,
          },
        });
      },
    );
  }

  /**
   * Bulk-query staffing rules for multiple assets.
   * Returns a Map of assetId to minStaffCount for efficient lookup.
   *
   * Used by the capacity service to check all assets in one query
   * instead of N+1 queries per asset.
   */
  async getForAssets(
    tenantId: number,
    assetIds: number[],
  ): Promise<Map<number, number>> {
    if (assetIds.length === 0) {
      return new Map<number, number>();
    }

    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<Map<number, number>> => {
        // Build parameterized IN clause: $2, $3, $4, ...
        const placeholders: string = assetIds
          .map((_: number, i: number) => `$${i + 2}`)
          .join(', ');

        const result = await client.query<
          Pick<VacationStaffingRuleRow, 'asset_id' | 'min_staff_count'>
        >(
          `SELECT asset_id, min_staff_count
           FROM vacation_staffing_rules
           WHERE tenant_id = $1
             AND is_active = ${IS_ACTIVE.ACTIVE}
             AND asset_id IN (${placeholders})`,
          [tenantId, ...assetIds],
        );

        const ruleMap: Map<number, number> = new Map<number, number>();
        for (const row of result.rows) {
          ruleMap.set(row.asset_id, row.min_staff_count);
        }

        return ruleMap;
      },
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /** Map DB row to API response type (snake_case → camelCase). */
  private mapRowToStaffingRule(
    row: StaffingRuleWithAssetRow,
  ): VacationStaffingRule {
    const base: VacationStaffingRule = {
      id: row.id,
      assetId: row.asset_id,
      minStaffCount: row.min_staff_count,
      createdBy: row.created_by,
      createdAt:
        typeof row.created_at === 'string' ?
          row.created_at
        : new Date(row.created_at).toISOString(),
      updatedAt:
        typeof row.updated_at === 'string' ?
          row.updated_at
        : new Date(row.updated_at).toISOString(),
    };

    if (row.asset_name !== null) {
      base.assetName = row.asset_name;
    }

    return base;
  }

  /** Check if a PostgreSQL error is a unique constraint violation (23505). */
  private isUniqueViolation(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    );
  }
}
