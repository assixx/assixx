/**
 * KVP Approval Archive CRON Service
 *
 * Archives KVP suggestions in terminal states after 30 days:
 * - status = 'rejected' → 'archived'
 * - status = 'implemented' → 'archived'
 *
 * Pattern: Follows blackboard-archive.service.ts
 * - Primary: Daily at 00:01 (Europe/Berlin)
 * - Backup: Every 6 hours as fallback
 * - Startup: onModuleInit recovery
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class KvpApprovalArchiveCronService implements OnModuleInit {
  private readonly logger = new Logger(KvpApprovalArchiveCronService.name);

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Server startup: Checking for archivable KVP suggestions...');
    await this.archiveFinalKvps();
  }

  @Cron('1 0 * * *', {
    name: 'kvp-final-archive-midnight',
    timeZone: 'Europe/Berlin',
  })
  async archiveAtMidnight(): Promise<void> {
    this.logger.log('[Midnight] Checking for archivable KVP suggestions...');
    await this.archiveFinalKvps();
  }

  @Cron('1 */6 * * *', {
    name: 'kvp-final-archive-backup',
    timeZone: 'Europe/Berlin',
  })
  async archiveBackup(): Promise<void> {
    this.logger.debug('[Backup] Checking for archivable KVP suggestions...');
    await this.archiveFinalKvps();
  }

  private async archiveFinalKvps(): Promise<void> {
    try {
      const result = await this.db.systemQuery<{ count: string }>(
        `WITH archived AS (
          UPDATE kvp_suggestions
          SET status = 'archived', updated_at = NOW()
          WHERE status IN ('rejected', 'implemented')
            AND updated_at < NOW() - INTERVAL '30 days'
          RETURNING id
        )
        SELECT COUNT(*)::text AS count FROM archived`,
      );

      const archivedCount = Number.parseInt(result[0]?.count ?? '0', 10);

      if (archivedCount > 0) {
        this.logger.log(
          `Archived ${String(archivedCount)} KVP suggestions (rejected/implemented > 30 days)`,
        );
      }
    } catch (error: unknown) {
      this.logger.error('Failed to archive KVP suggestions', error);
    }
  }
}
