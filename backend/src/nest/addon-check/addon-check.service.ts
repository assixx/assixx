/**
 * Addon Check Service
 *
 * Checks addon access for tenants and logs addon usage.
 * Replaces FeatureCheckService with addon-aware logic:
 *   - Core addons (is_core=true) → always accessible, no DB lookup
 *   - Purchasable addons → check tenant_addons for status + trial expiry
 *
 * @see ADR-033 (Addon-based SaaS Model)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger } from '@nestjs/common';

import { getErrorMessage } from '../common/index.js';
import { DatabaseService } from '../database/database.service.js';

interface DbAddon {
  id: number;
  is_core: boolean;
}

@Injectable()
export class AddonCheckService {
  private readonly logger = new Logger(AddonCheckService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Check if a tenant has access to a specific addon.
   *
   * Core addons → always true (no tenant_addons lookup needed).
   * Purchasable addons → check tenant_addons for active/trial status.
   */
  async checkTenantAccess(tenantId: number, addonCode: string): Promise<boolean> {
    try {
      // Step 1: Check if addon exists and whether it's core
      const addons = await this.db.query<DbAddon>(
        'SELECT id, is_core FROM addons WHERE code = $1',
        [addonCode],
      );
      const addon = addons[0];

      if (addon === undefined) {
        this.logger.warn(`Addon "${addonCode}" not found in addons table`);
        return false;
      }

      // Core addons are always accessible — no tenant subscription needed
      if (addon.is_core) {
        return true;
      }

      // Step 2: Purchasable addon — check tenant_addons
      const rows = await this.db.query<{ id: string }>(
        `SELECT ta.id
         FROM tenant_addons ta
         WHERE ta.tenant_id = $1
           AND ta.addon_id = $2
           AND ta.is_active = ${IS_ACTIVE.ACTIVE}
           AND ta.status IN ('active', 'trial')
           AND (ta.trial_ends_at IS NULL OR ta.trial_ends_at > NOW())`,
        [tenantId, addon.id],
      );

      return rows.length > 0;
    } catch (error: unknown) {
      this.logger.error(`Error checking addon access: ${getErrorMessage(error)}`);
      return false;
    }
  }

  /** Log usage of an addon for a tenant. */
  async logUsage(
    tenantId: number,
    addonCode: string,
    userId: number | null = null,
    metadata: Record<string, unknown> = {},
  ): Promise<boolean> {
    try {
      const addons = await this.db.query<DbAddon>(
        'SELECT id, is_core FROM addons WHERE code = $1',
        [addonCode],
      );
      const addon = addons[0];

      if (addon === undefined) {
        this.logger.warn(`Addon "${addonCode}" not found for logging`);
        return false;
      }

      await this.db.query(
        `INSERT INTO addon_usage_logs
           (tenant_id, addon_id, user_id, action, metadata)
         VALUES ($1, $2, $3, 'usage', $4)`,
        [tenantId, addon.id, userId, JSON.stringify(metadata)],
      );

      return true;
    } catch (error: unknown) {
      this.logger.error(`Error logging addon usage: ${getErrorMessage(error)}`);
      return false;
    }
  }
}
