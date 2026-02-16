/**
 * Vacation Settings Service
 *
 * Manages tenant-wide vacation configuration.
 * One row per tenant (UNIQUE tenant_id) with auto-created defaults.
 *
 * Settings table: `vacation_settings` (Migration 29)
 * - UNIQUE(tenant_id) — one settings row per tenant
 * - NUMERIC columns: `default_annual_days`, `max_carry_over_days` (come as strings from pg)
 * - RLS enforced via `db.tenantTransaction()` (ADR-019)
 *
 * Other services depend on these settings:
 * - Entitlements: `default_annual_days` for new entitlements
 * - Entitlements: `max_carry_over_days` + deadline for carry-over calculation
 * - Vacation: `advance_notice_days`, `max_consecutive_days` for request validation
 */
import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';
import type {
  VacationSettings,
  VacationSettingsRow,
} from './vacation.types.js';

@Injectable()
export class VacationSettingsService {
  private readonly logger: Logger = new Logger(VacationSettingsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /**
   * Get vacation settings for a tenant.
   * Auto-creates default settings if none exist.
   */
  async getSettings(tenantId: number): Promise<VacationSettings> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationSettings> => {
        const row: VacationSettingsRow | undefined = await this.findSettings(
          client,
          tenantId,
        );

        if (row !== undefined) {
          return this.mapRowToSettings(row);
        }

        // Auto-create defaults
        return await this.ensureDefaults(client, tenantId);
      },
    );
  }

  /**
   * Update tenant vacation settings.
   * Uses UPSERT (INSERT ON CONFLICT UPDATE) — creates defaults if missing.
   */
  async updateSettings(
    tenantId: number,
    userId: number,
    dto: UpdateSettingsDto,
  ): Promise<VacationSettings> {
    const result = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationSettings> => {
        const existing: VacationSettingsRow | undefined =
          await this.findSettings(client, tenantId);

        if (existing === undefined) {
          await this.ensureDefaults(client, tenantId, userId);
        }

        return await this.applyUpdate(client, tenantId, userId, dto);
      },
    );

    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'update',
      entityType: 'vacation_settings',
      details: `Urlaubseinstellungen aktualisiert (Tenant ${String(tenantId)})`,
      newValues: {
        defaultAnnualDays: dto.defaultAnnualDays,
        maxCarryOverDays: dto.maxCarryOverDays,
        carryOverDeadlineMonth: dto.carryOverDeadlineMonth,
        carryOverDeadlineDay: dto.carryOverDeadlineDay,
        advanceNoticeDays: dto.advanceNoticeDays,
        maxConsecutiveDays: dto.maxConsecutiveDays,
      },
    });

    return result;
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /** Find existing settings row for a tenant. */
  private async findSettings(
    client: PoolClient,
    tenantId: number,
  ): Promise<VacationSettingsRow | undefined> {
    const result = await client.query<VacationSettingsRow>(
      `SELECT id, tenant_id, default_annual_days, max_carry_over_days,
              carry_over_deadline_month, carry_over_deadline_day,
              advance_notice_days, max_consecutive_days,
              is_active, created_by, created_at, updated_at
       FROM vacation_settings
       WHERE tenant_id = $1 AND is_active = 1`,
      [tenantId],
    );

    return result.rows[0];
  }

  /**
   * Create default settings row for a tenant.
   * Uses INSERT ON CONFLICT DO NOTHING to be idempotent.
   * Defaults: 30 annual days, 10 carry-over, deadline 31.03, 0 advance notice.
   */
  private async ensureDefaults(
    client: PoolClient,
    tenantId: number,
    createdBy?: number,
  ): Promise<VacationSettings> {
    const id: string = uuidv7();

    await client.query(
      `INSERT INTO vacation_settings
         (id, tenant_id, default_annual_days, max_carry_over_days,
          carry_over_deadline_month, carry_over_deadline_day,
          advance_notice_days, created_by)
       VALUES ($1, $2, 30, 10, 3, 31, 0, $3)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [id, tenantId, createdBy ?? null],
    );

    // Re-fetch to get the actual row (might have been created by concurrent call)
    const row: VacationSettingsRow | undefined = await this.findSettings(
      client,
      tenantId,
    );

    if (row === undefined) {
      throw new Error(
        `Failed to create default vacation settings for tenant ${tenantId}`,
      );
    }

    this.logger.log(`Default settings created for tenant ${tenantId}`);
    return this.mapRowToSettings(row);
  }

  /** Apply partial update to existing settings. */
  private async applyUpdate(
    client: PoolClient,
    tenantId: number,
    userId: number,
    dto: UpdateSettingsDto,
  ): Promise<VacationSettings> {
    const { setClauses, params } = this.buildSetClauses(dto, userId);

    if (setClauses.length === 0) {
      const row: VacationSettingsRow | undefined = await this.findSettings(
        client,
        tenantId,
      );
      if (row === undefined) {
        throw new Error(`Settings not found for tenant ${tenantId}`);
      }
      return this.mapRowToSettings(row);
    }

    setClauses.push(`updated_at = NOW()`);
    const tenantParam: number = params.length + 1;
    params.push(tenantId);

    const result = await client.query<VacationSettingsRow>(
      `UPDATE vacation_settings
       SET ${setClauses.join(', ')}
       WHERE tenant_id = $${tenantParam} AND is_active = 1
       RETURNING id, tenant_id, default_annual_days, max_carry_over_days,
                 carry_over_deadline_month, carry_over_deadline_day,
                 advance_notice_days, max_consecutive_days,
                 is_active, created_by, created_at, updated_at`,
      params,
    );

    const row: VacationSettingsRow | undefined = result.rows[0];
    if (row === undefined) {
      throw new Error(
        `Settings update returned no rows for tenant ${tenantId}`,
      );
    }

    this.logger.log(`Settings updated for tenant ${tenantId}`);
    return this.mapRowToSettings(row);
  }

  /** Build dynamic SET clause for settings update. */
  private buildSetClauses(
    dto: UpdateSettingsDto,
    userId: number,
  ): { setClauses: string[]; params: unknown[] } {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx: number = 1;

    const fields: { column: string; value: unknown }[] = [
      { column: 'default_annual_days', value: dto.defaultAnnualDays },
      { column: 'max_carry_over_days', value: dto.maxCarryOverDays },
      {
        column: 'carry_over_deadline_month',
        value: dto.carryOverDeadlineMonth,
      },
      { column: 'carry_over_deadline_day', value: dto.carryOverDeadlineDay },
      { column: 'advance_notice_days', value: dto.advanceNoticeDays },
      { column: 'max_consecutive_days', value: dto.maxConsecutiveDays },
    ];

    for (const field of fields) {
      if (field.value !== undefined) {
        setClauses.push(`${field.column} = $${idx}`);
        params.push(field.value);
        idx++;
      }
    }

    // Always record who updated
    setClauses.push(`created_by = $${idx}`);
    params.push(userId);

    return { setClauses, params };
  }

  /** Map DB row to API response type (NUMERIC strings → numbers). */
  private mapRowToSettings(row: VacationSettingsRow): VacationSettings {
    return {
      id: row.id,
      defaultAnnualDays: Number.parseFloat(row.default_annual_days),
      maxCarryOverDays: Number.parseFloat(row.max_carry_over_days),
      carryOverDeadlineMonth: row.carry_over_deadline_month,
      carryOverDeadlineDay: row.carry_over_deadline_day,
      advanceNoticeDays: row.advance_notice_days,
      maxConsecutiveDays: row.max_consecutive_days,
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
  }
}
