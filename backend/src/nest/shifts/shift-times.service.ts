/**
 * Shift Times Service
 *
 * Manages tenant-configurable shift time definitions (Schichtzeiten).
 * Provides CRUD operations and lazy-initialization of defaults
 * for tenants that don't have custom shift times yet.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { ShiftTimeResponse } from './dto/shift-time-response.dto.js';

interface DbShiftTimeRow {
  shift_key: string;
  label: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  is_active: number;
}

/** Default shift times seeded for new tenants */
const DEFAULT_SHIFT_TIMES: readonly {
  shiftKey: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
}[] = [
  {
    shiftKey: 'early',
    label: 'Frühschicht',
    startTime: '06:00',
    endTime: '14:00',
    sortOrder: 1,
  },
  {
    shiftKey: 'late',
    label: 'Spätschicht',
    startTime: '14:00',
    endTime: '22:00',
    sortOrder: 2,
  },
  {
    shiftKey: 'night',
    label: 'Nachtschicht',
    startTime: '22:00',
    endTime: '06:00',
    sortOrder: 3,
  },
] as const;

@Injectable()
export class ShiftTimesService {
  private readonly logger = new Logger(ShiftTimesService.name);

  constructor(private readonly db: DatabaseService) {}

  /** Map DB row to API response */
  private mapRowToResponse(row: DbShiftTimeRow): ShiftTimeResponse {
    return {
      shiftKey: row.shift_key,
      label: row.label,
      startTime: this.formatTime(row.start_time),
      endTime: this.formatTime(row.end_time),
      sortOrder: row.sort_order,
      isActive: row.is_active,
    };
  }

  /** Format PostgreSQL TIME to HH:MM string */
  private formatTime(pgTime: string): string {
    // PostgreSQL TIME comes as "HH:MM:SS" — strip seconds
    return pgTime.slice(0, 5);
  }

  /** Get all shift times for a tenant. Lazy-initializes defaults if none exist. */
  async getByTenant(tenantId: number): Promise<ShiftTimeResponse[]> {
    const rows = await this.db.query<DbShiftTimeRow>(
      `SELECT shift_key, label, start_time::TEXT, end_time::TEXT, sort_order, is_active
       FROM shift_times
       WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY sort_order ASC`,
      [tenantId],
    );

    if (rows.length === 0) {
      await this.ensureDefaults(tenantId);
      const defaultRows = await this.db.query<DbShiftTimeRow>(
        `SELECT shift_key, label, start_time::TEXT, end_time::TEXT, sort_order, is_active
         FROM shift_times
         WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE}
         ORDER BY sort_order ASC`,
        [tenantId],
      );
      return defaultRows.map((row: DbShiftTimeRow) =>
        this.mapRowToResponse(row),
      );
    }

    return rows.map((row: DbShiftTimeRow) => this.mapRowToResponse(row));
  }

  /** Update a single shift time definition */
  async update(
    tenantId: number,
    shiftKey: string,
    data: { label: string; startTime: string; endTime: string },
  ): Promise<ShiftTimeResponse> {
    // Ensure defaults exist before updating
    await this.ensureDefaults(tenantId);

    const rows = await this.db.query<DbShiftTimeRow>(
      `UPDATE shift_times
       SET label = $1, start_time = $2::TIME, end_time = $3::TIME
       WHERE tenant_id = $4 AND shift_key = $5
       RETURNING shift_key, label, start_time::TEXT, end_time::TEXT, sort_order, is_active`,
      [data.label, data.startTime, data.endTime, tenantId, shiftKey],
    );

    const row = rows[0];
    if (row === undefined) {
      // Should not happen after ensureDefaults, but defensive
      this.logger.error(
        `Shift time not found: tenant=${tenantId}, key=${shiftKey}`,
      );
      throw new Error(
        `Shift time '${shiftKey}' not found for tenant ${tenantId}`,
      );
    }

    return this.mapRowToResponse(row);
  }

  /** Bulk update all shift times at once */
  async updateAll(
    tenantId: number,
    shiftTimes: {
      shiftKey: string;
      label: string;
      startTime: string;
      endTime: string;
    }[],
  ): Promise<ShiftTimeResponse[]> {
    // update() calls ensureDefaults() internally — no redundant call here
    const results: ShiftTimeResponse[] = [];

    for (const entry of shiftTimes) {
      const result = await this.update(tenantId, entry.shiftKey, {
        label: entry.label,
        startTime: entry.startTime,
        endTime: entry.endTime,
      });
      results.push(result);
    }

    return results;
  }

  /** Reset all shift times to defaults for a tenant */
  async resetToDefaults(tenantId: number): Promise<ShiftTimeResponse[]> {
    for (const def of DEFAULT_SHIFT_TIMES) {
      await this.db.query(
        `UPDATE shift_times
         SET label = $1, start_time = $2::TIME, end_time = $3::TIME, is_active = ${IS_ACTIVE.ACTIVE}
         WHERE tenant_id = $4 AND shift_key = $5`,
        [def.label, def.startTime, def.endTime, tenantId, def.shiftKey],
      );
    }

    return await this.getByTenant(tenantId);
  }

  /** Insert default shift times if none exist for this tenant */
  async ensureDefaults(tenantId: number): Promise<void> {
    const countResult = await this.db.query<{ count: string }>(
      'SELECT COUNT(*)::TEXT AS count FROM shift_times WHERE tenant_id = $1',
      [tenantId],
    );

    const count = Number.parseInt(countResult[0]?.count ?? '0', 10);
    if (count > 0) return;

    this.logger.log(`Initializing default shift times for tenant ${tenantId}`);

    for (const def of DEFAULT_SHIFT_TIMES) {
      await this.db.query(
        `INSERT INTO shift_times (tenant_id, shift_key, label, start_time, end_time, sort_order)
         VALUES ($1, $2, $3, $4::TIME, $5::TIME, $6)
         ON CONFLICT (tenant_id, shift_key) DO NOTHING`,
        [
          tenantId,
          def.shiftKey,
          def.label,
          def.startTime,
          def.endTime,
          def.sortOrder,
        ],
      );
    }
  }
}
