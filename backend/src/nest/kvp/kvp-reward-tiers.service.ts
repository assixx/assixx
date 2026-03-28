/**
 * KVP Reward Tiers Service — CRUD for predefined reward amounts per tenant
 *
 * Root users configure reward tiers in /settings/company.
 * KVP approval masters select a tier when approving a suggestion.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { getErrorMessage } from '../common/utils/error.utils.js';
import { DatabaseService } from '../database/database.service.js';

interface RewardTierRow {
  id: number;
  amount: string;
  sort_order: number;
  is_active: number;
}

export interface RewardTier {
  id: number;
  amount: number;
  sortOrder: number;
}

@Injectable()
export class KvpRewardTiersService {
  constructor(private readonly db: DatabaseService) {}

  /** List all active reward tiers for a tenant (sorted by sort_order, then amount) */
  async findAll(tenantId: number): Promise<RewardTier[]> {
    const rows = await this.db.query<RewardTierRow>(
      `SELECT id, amount, sort_order, is_active
       FROM kvp_reward_tiers
       WHERE tenant_id = $1 AND is_active = $2
       ORDER BY sort_order ASC, amount ASC`,
      [tenantId, IS_ACTIVE.ACTIVE],
    );

    return rows.map((row: RewardTierRow) => ({
      id: row.id,
      amount: Number(row.amount),
      sortOrder: row.sort_order,
    }));
  }

  /** Create a new reward tier */
  async create(tenantId: number, amount: number): Promise<RewardTier> {
    try {
      const maxSort = await this.db.query<{ max: string | null }>(
        `SELECT MAX(sort_order)::text AS max
         FROM kvp_reward_tiers
         WHERE tenant_id = $1 AND is_active = $2`,
        [tenantId, IS_ACTIVE.ACTIVE],
      );
      const nextSort = Number(maxSort[0]?.max ?? '0') + 1;

      const rows = await this.db.query<RewardTierRow>(
        `INSERT INTO kvp_reward_tiers (tenant_id, amount, sort_order)
         VALUES ($1, $2, $3)
         RETURNING id, amount, sort_order, is_active`,
        [tenantId, amount, nextSort],
      );

      const row = rows[0];
      if (row === undefined) {
        throw new Error('Insert returned no rows');
      }

      return { id: row.id, amount: Number(row.amount), sortOrder: row.sort_order };
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      if (msg.includes('idx_kvp_reward_tiers_tenant_amount')) {
        throw new ConflictException(`Betrag ${String(amount)}€ existiert bereits`);
      }
      throw error;
    }
  }

  /** Soft-delete a reward tier */
  async remove(tenantId: number, tierId: number): Promise<void> {
    const result = await this.db.query<{ id: number }>(
      `UPDATE kvp_reward_tiers
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND is_active = $4
       RETURNING id`,
      [IS_ACTIVE.DELETED, tierId, tenantId, IS_ACTIVE.ACTIVE],
    );

    if (result.length === 0) {
      throw new NotFoundException('Reward-Stufe nicht gefunden');
    }
  }
}
