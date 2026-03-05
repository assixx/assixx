/**
 * TPM Card Cascade Service
 *
 * Handles interval-based cascade logic for maintenance cards.
 * When a higher interval triggers (e.g. monthly), all cards with
 * shorter intervals (daily, weekly) are also set to due.
 *
 * Uses batch SQL for performance — single UPDATE for all affected cards.
 * This mitigates Risk R1 (50+ cards going red simultaneously).
 *
 * All mutation methods accept a PoolClient for transaction composability.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../database/database.service.js';
import { type TpmCardJoinRow, mapCardRowToApi } from './tpm-cards.helpers.js';
import type { TpmCard, TpmIntervalType } from './tpm.types.js';
import { INTERVAL_ORDER_MAP } from './tpm.types.js';

/** Result of a cascade trigger operation */
export interface CascadeResult {
  affectedCount: number;
  triggerIntervalOrder: number;
  dueDate: string;
}

/** Preview of which cards would be affected by a cascade */
export interface CascadePreview {
  cards: TpmCard[];
  totalAffected: number;
  triggerIntervalOrder: number;
}

@Injectable()
export class TpmCardCascadeService {
  private readonly logger = new Logger(TpmCardCascadeService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Trigger an interval cascade — set all green cards with
   * interval_order <= triggerIntervalOrder to red (due).
   *
   * Uses a single batch UPDATE for performance.
   * Only affects active, green cards for the given asset.
   */
  async triggerCascade(
    client: PoolClient,
    tenantId: number,
    assetId: number,
    triggerIntervalOrder: number,
    dueDate: Date,
  ): Promise<CascadeResult> {
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    const result = await client.query<{ count: string }>(
      `WITH updated AS (
        UPDATE tpm_cards
        SET status = 'red',
            current_due_date = $4,
            updated_at = NOW()
        WHERE asset_id = $1
          AND tenant_id = $2
          AND interval_order <= $3
          AND status = 'green'
          AND is_active = 1
          AND (last_completed_at IS NULL OR last_completed_at::date < $4::date)
        RETURNING id
      )
      SELECT COUNT(*) AS count FROM updated`,
      [assetId, tenantId, triggerIntervalOrder, dueDateStr],
    );

    const affectedCount = Number.parseInt(result.rows[0]?.count ?? '0', 10);

    this.logger.debug(
      `Cascade triggered: asset ${assetId}, order <= ${triggerIntervalOrder}, ` +
        `${affectedCount} Karten → red (fällig: ${dueDateStr})`,
    );

    return {
      affectedCount,
      triggerIntervalOrder,
      dueDate: dueDateStr,
    };
  }

  /**
   * Preview which cards would be affected by a cascade.
   * Read-only — no mutations. Used for UI confirmation before triggering.
   */
  async getCascadePreview(
    tenantId: number,
    assetId: number,
    triggerIntervalOrder: number,
  ): Promise<CascadePreview> {
    const rows = await this.db.query<TpmCardJoinRow>(
      `SELECT c.*,
         p.uuid AS plan_uuid,
         m.name AS asset_name,
         t.uuid AS template_uuid,
         u_created.username AS created_by_name,
         u_completed.username AS last_completed_by_name
       FROM tpm_cards c
       LEFT JOIN tpm_maintenance_plans p ON c.plan_id = p.id
       LEFT JOIN assets m ON c.asset_id = m.id AND m.tenant_id = c.tenant_id
       LEFT JOIN tpm_card_templates t ON c.template_id = t.id
       LEFT JOIN users u_created ON c.created_by = u_created.id
       LEFT JOIN users u_completed ON c.last_completed_by = u_completed.id
       WHERE c.asset_id = $1
         AND c.tenant_id = $2
         AND c.interval_order <= $3
         AND c.status = 'green'
         AND c.is_active = 1
       ORDER BY c.interval_order ASC, c.sort_order ASC`,
      [assetId, tenantId, triggerIntervalOrder],
    );

    return {
      cards: rows.map(mapCardRowToApi),
      totalAffected: rows.length,
      triggerIntervalOrder,
    };
  }

  /**
   * Resolve an interval type to its cascade order number.
   * Convenience wrapper around INTERVAL_ORDER_MAP.
   */
  getIntervalOrder(intervalType: TpmIntervalType): number {
    return INTERVAL_ORDER_MAP[intervalType];
  }
}
