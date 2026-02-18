/**
 * TPM Color Config Service
 *
 * Manages per-tenant status color customization.
 * Falls back to DEFAULT_COLORS when no tenant-specific config exists.
 * Uses UPSERT pattern for updateColor and DELETE for resetToDefaults.
 */
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { UpdateColorConfigDto } from './dto/update-color-config.dto.js';
import type {
  TpmCardStatus,
  TpmColorConfigEntry,
  TpmColorConfigRow,
} from './tpm.types.js';
import { DEFAULT_COLORS } from './tpm.types.js';

/** Map DB row to API response */
function mapColorRowToApi(row: TpmColorConfigRow): TpmColorConfigEntry {
  return {
    statusKey: row.status_key,
    colorHex: row.color_hex,
    label: row.label,
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

/** Build default color entry (when no tenant-specific config exists) */
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

@Injectable()
export class TpmColorConfigService {
  private readonly logger = new Logger(TpmColorConfigService.name);

  constructor(private readonly db: DatabaseService) {}

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
    dto: UpdateColorConfigDto,
  ): Promise<TpmColorConfigEntry> {
    this.logger.debug(`Updating color for status "${dto.statusKey}"`);

    const rows = await this.db.query<TpmColorConfigRow>(
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

    const row = rows[0];
    if (row === undefined) {
      throw new Error('UPSERT tpm_color_config returned no rows');
    }

    return mapColorRowToApi(row);
  }

  /**
   * Reset all status colors to defaults.
   * Deletes all tenant-specific color overrides — getColors() will
   * then return DEFAULT_COLORS for every status key.
   */
  async resetToDefaults(tenantId: number): Promise<TpmColorConfigEntry[]> {
    this.logger.debug(`Resetting colors to defaults for tenant ${tenantId}`);

    await this.db.query(
      `DELETE FROM tpm_color_config WHERE tenant_id = $1`,
      [tenantId],
    );

    // Return the defaults
    const statusKeys: TpmCardStatus[] = ['green', 'red', 'yellow', 'overdue'];
    return statusKeys.map(buildDefaultEntry);
  }
}
