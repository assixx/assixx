/**
 * TPM Due Date Cron Service
 *
 * Runs 2x/day (06:00 + 18:00 Europe/Berlin) to detect green cards
 * whose current_due_date has arrived and trigger the Kamishibai cascade.
 *
 * Flow per run:
 *   1. Find all green cards where current_due_date <= today
 *   2. Group by (tenant_id, asset_id) and find max interval_order
 *   3. For each group: triggerCascade → batch-SET all lower-order cards to red
 *
 * Concurrency safety:
 *   - isProcessing guard prevents parallel runs within the same process
 *   - Cascade uses batch UPDATE (single SQL per asset)
 *
 * Startup recovery via OnModuleInit catches cards that expired while offline.
 *
 * Pattern: mirrors TpmEscalationService cron structure.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../database/database.service.js';
import { TpmCardCascadeService } from './tpm-card-cascade.service.js';

/** Due card group: one entry per (tenant, asset) */
interface DueCardGroup {
  tenant_id: number;
  asset_id: number;
  max_interval_order: number;
}

@Injectable()
export class TpmDueDateCronService implements OnModuleInit {
  private readonly logger = new Logger(TpmDueDateCronService.name);
  private isProcessing = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly cascadeService: TpmCardCascadeService,
  ) {}

  /** Startup recovery — catch cards that became due while server was down */
  async onModuleInit(): Promise<void> {
    this.logger.log('Startup recovery: checking for due TPM cards...');
    await this.processDueCards();
  }

  /** Cron: 06:00 Europe/Berlin */
  @Cron('0 6 * * *', {
    name: 'tpm-due-date-morning',
    timeZone: 'Europe/Berlin',
  })
  async handleMorningCheck(): Promise<void> {
    await this.processDueCards();
  }

  /** Cron: 18:00 Europe/Berlin */
  @Cron('0 18 * * *', {
    name: 'tpm-due-date-evening',
    timeZone: 'Europe/Berlin',
  })
  async handleEveningCheck(): Promise<void> {
    await this.processDueCards();
  }

  // ============================================================================
  // CORE PROCESSING
  // ============================================================================

  /** Find all due cards and trigger cascade per asset */
  private async processDueCards(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('Due date check already in progress, skipping');
      return;
    }

    this.isProcessing = true;
    try {
      const groups = await this.findDueCardGroups();
      if (groups.length === 0) return;

      this.logger.log(`Found ${String(groups.length)} asset(s) with due TPM cards`);

      for (const group of groups) {
        await this.triggerGroupCascade(group);
      }
    } catch (error: unknown) {
      this.logger.error(`Due date processing failed: ${String(error)}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Find green cards due today or earlier, grouped by (tenant, asset).
   * Returns max interval_order per group for cascade trigger.
   *
   * System-level query (no RLS context) — sees all tenants.
   */
  private async findDueCardGroups(): Promise<DueCardGroup[]> {
    return await this.db.query<DueCardGroup>(
      `SELECT tenant_id, asset_id,
              MAX(interval_order) AS max_interval_order
       FROM tpm_cards
       WHERE status = 'green'
         AND is_active = ${IS_ACTIVE.ACTIVE}
         AND current_due_date IS NOT NULL
         AND current_due_date <= CURRENT_DATE
       GROUP BY tenant_id, asset_id`,
    );
  }

  /** Trigger cascade for a single (tenant, asset) group */
  private async triggerGroupCascade(group: DueCardGroup): Promise<void> {
    try {
      await this.db.transaction(
        async (client: PoolClient) => {
          const result = await this.cascadeService.triggerCascade(
            client,
            group.tenant_id,
            group.asset_id,
            group.max_interval_order,
            new Date(),
          );

          this.logger.log(
            `Cascade: asset ${String(group.asset_id)}, ` +
              `order <= ${String(group.max_interval_order)}, ` +
              `${String(result.affectedCount)} Karten → red`,
          );
        },
        { tenantId: group.tenant_id },
      );
    } catch (error: unknown) {
      this.logger.error(`Cascade failed for asset ${String(group.asset_id)}: ${String(error)}`);
    }
  }
}
