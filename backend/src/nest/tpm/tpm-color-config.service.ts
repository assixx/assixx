/**
 * TPM Color Config Service
 *
 * Manages per-tenant color customization for:
 * - Card status colors (green, red, yellow, overdue)
 * - Interval type colors (daily, weekly, monthly, etc.)
 *
 * Both use the same tpm_color_config table (status_key VARCHAR(20)).
 * Falls back to code defaults when no tenant-specific config exists.
 * Uses UPSERT pattern for updates and DELETE for reset-to-defaults.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { UpdateColorConfigDto } from './dto/update-color-config.dto.js';
import type { UpdateIntervalColorConfigDto } from './dto/update-interval-color-config.dto.js';
import type {
  TpmCardStatus,
  TpmColorConfigEntry,
  TpmColorConfigRow,
  TpmIntervalType,
} from './tpm.types.js';
import {
  DEFAULT_COLORS,
  DEFAULT_INTERVAL_COLORS,
  INTERVAL_TYPES_ORDERED,
} from './tpm.types.js';

/** Map DB row to API response */
function mapColorRowToApi(row: TpmColorConfigRow): TpmColorConfigEntry {
  return {
    statusKey: row.status_key,
    colorHex: row.color_hex,
    label: row.label,
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

/** Build default color entry for card status */
function buildDefaultEntry(statusKey: TpmCardStatus): TpmColorConfigEntry {
  const def = DEFAULT_COLORS[statusKey];
  const now = new Date().toISOString();
  return {
    statusKey,
    colorHex: def.hex,
    label: def.label,
    createdAt: now,
    updatedAt: now,
  };
}

/** Build default color entry for interval type */
function buildDefaultIntervalEntry(
  intervalKey: TpmIntervalType,
): TpmColorConfigEntry {
  const def = DEFAULT_INTERVAL_COLORS[intervalKey];
  const now = new Date().toISOString();
  return {
    statusKey: intervalKey,
    colorHex: def.hex,
    label: def.label,
    createdAt: now,
    updatedAt: now,
  };
}

@Injectable()
export class TpmColorConfigService {
  private readonly logger = new Logger(TpmColorConfigService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /**
   * Get all status colors for a tenant.
   * Merges tenant-specific overrides with defaults —
   * every status key is always present in the result.
   */
  async getColors(tenantId: number): Promise<TpmColorConfigEntry[]> {
    const rows = await this.db.query<TpmColorConfigRow>(
      `SELECT * FROM tpm_color_config
       WHERE tenant_id = $1
       ORDER BY status_key`,
      [tenantId],
    );

    // Build a map of tenant-specific overrides
    const overrides = new Map<string, TpmColorConfigEntry>();
    for (const row of rows) {
      overrides.set(row.status_key, mapColorRowToApi(row));
    }

    // Merge with defaults: tenant override wins, fallback to default
    const statusKeys: TpmCardStatus[] = ['green', 'red', 'yellow', 'overdue'];
    return statusKeys.map(
      (key: TpmCardStatus) => overrides.get(key) ?? buildDefaultEntry(key),
    );
  }

  /**
   * Update (or create) a single status color.
   * Uses PostgreSQL UPSERT: INSERT ... ON CONFLICT DO UPDATE.
   */
  async updateColor(
    tenantId: number,
    userId: number,
    dto: UpdateColorConfigDto,
  ): Promise<TpmColorConfigEntry> {
    this.logger.debug(`Updating color for status "${dto.statusKey}"`);

    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmColorConfigEntry> => {
        const result = await client.query<TpmColorConfigRow>(
          `INSERT INTO tpm_color_config (tenant_id, status_key, color_hex, label)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, status_key)
           DO UPDATE SET
             color_hex = EXCLUDED.color_hex,
             label = EXCLUDED.label,
             updated_at = NOW()
           RETURNING *`,
          [tenantId, dto.statusKey, dto.colorHex, dto.label],
        );

        const row = result.rows[0];
        if (row === undefined) {
          throw new Error('UPSERT tpm_color_config returned no rows');
        }

        void this.activityLogger.logUpdate(
          tenantId,
          userId,
          'tpm_color_config',
          0,
          `TPM-Statusfarbe aktualisiert: ${dto.statusKey}`,
          undefined,
          { statusKey: dto.statusKey, colorHex: dto.colorHex },
        );

        return mapColorRowToApi(row);
      },
    );
  }

  /**
   * Reset all status colors to defaults.
   * Deletes tenant-specific card status overrides only (not interval colors).
   */
  async resetToDefaults(
    tenantId: number,
    userId: number,
  ): Promise<TpmColorConfigEntry[]> {
    this.logger.debug(`Resetting card status colors for tenant ${tenantId}`);

    const statusKeys: TpmCardStatus[] = ['green', 'red', 'yellow', 'overdue'];

    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        await client.query(
          `DELETE FROM tpm_color_config
           WHERE tenant_id = $1 AND status_key = ANY($2)`,
          [tenantId, statusKeys],
        );
      },
    );

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'tpm_color_config',
      0,
      'TPM-Statusfarben auf Standard zurückgesetzt',
    );

    return statusKeys.map(buildDefaultEntry);
  }

  // ============================================================================
  // INTERVAL COLORS
  // ============================================================================

  /**
   * Get all interval type colors for a tenant.
   * Merges tenant overrides with DEFAULT_INTERVAL_COLORS.
   */
  async getIntervalColors(tenantId: number): Promise<TpmColorConfigEntry[]> {
    const intervalKeys: readonly string[] = INTERVAL_TYPES_ORDERED;

    const rows = await this.db.query<TpmColorConfigRow>(
      `SELECT * FROM tpm_color_config
       WHERE tenant_id = $1 AND status_key = ANY($2)
       ORDER BY status_key`,
      [tenantId, intervalKeys],
    );

    const overrides = new Map<string, TpmColorConfigEntry>();
    for (const row of rows) {
      overrides.set(row.status_key, mapColorRowToApi(row));
    }

    return INTERVAL_TYPES_ORDERED.map(
      (key: TpmIntervalType) =>
        overrides.get(key) ?? buildDefaultIntervalEntry(key),
    );
  }

  /**
   * Update (or create) a single interval type color.
   * Uses UPSERT on (tenant_id, status_key).
   */
  async updateIntervalColor(
    tenantId: number,
    userId: number,
    dto: UpdateIntervalColorConfigDto,
  ): Promise<TpmColorConfigEntry> {
    this.logger.debug(`Updating interval color for "${dto.intervalKey}"`);

    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmColorConfigEntry> => {
        const result = await client.query<TpmColorConfigRow>(
          `INSERT INTO tpm_color_config (tenant_id, status_key, color_hex, label)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, status_key)
           DO UPDATE SET
             color_hex = EXCLUDED.color_hex,
             label = EXCLUDED.label,
             updated_at = NOW()
           RETURNING *`,
          [tenantId, dto.intervalKey, dto.colorHex, dto.label],
        );

        const row = result.rows[0];
        if (row === undefined) {
          throw new Error('UPSERT tpm_color_config returned no rows');
        }

        void this.activityLogger.logUpdate(
          tenantId,
          userId,
          'tpm_color_config',
          0,
          `TPM-Intervallfarbe aktualisiert: ${dto.intervalKey}`,
          undefined,
          { intervalKey: dto.intervalKey, colorHex: dto.colorHex },
        );

        return mapColorRowToApi(row);
      },
    );
  }

  /**
   * Reset all interval type colors to defaults.
   * Deletes tenant-specific interval overrides only (not card status colors).
   */
  async resetIntervalColorsToDefaults(
    tenantId: number,
    userId: number,
  ): Promise<TpmColorConfigEntry[]> {
    this.logger.debug(`Resetting interval colors for tenant ${tenantId}`);

    const intervalKeys: readonly string[] = INTERVAL_TYPES_ORDERED;

    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        await client.query(
          `DELETE FROM tpm_color_config
           WHERE tenant_id = $1 AND status_key = ANY($2)`,
          [tenantId, intervalKeys],
        );
      },
    );

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'tpm_color_config',
      0,
      'TPM-Intervallfarben auf Standard zurückgesetzt',
    );

    return INTERVAL_TYPES_ORDERED.map(buildDefaultIntervalEntry);
  }
}
