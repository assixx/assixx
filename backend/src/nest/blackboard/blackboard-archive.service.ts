/**
 * Blackboard Archive Service
 *
 * Handles automatic archiving of expired blackboard entries.
 * - Primary: Runs daily at 00:01 (right after midnight)
 * - Backup: Runs every 6 hours as fallback
 * - Startup: Runs on server start to catch missed jobs
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class BlackboardArchiveService implements OnModuleInit {
  private readonly logger = new Logger(BlackboardArchiveService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Run archival check on server startup
   * Catches any entries that expired while server was down
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Server startup: Checking for expired blackboard entries...');
    await this.archiveExpiredEntries();
  }

  /**
   * Primary: Archive expired blackboard entries at midnight
   * Runs daily at 00:01 (Europe/Berlin timezone)
   */
  @Cron('1 0 * * *', {
    name: 'blackboard-archive-midnight',
    timeZone: 'Europe/Berlin',
  })
  async archiveAtMidnight(): Promise<void> {
    this.logger.log('[Midnight] Checking for expired entries...');
    await this.archiveExpiredEntries();
  }

  /**
   * Backup: Run every 6 hours as fallback
   * Catches any missed entries if midnight job failed
   */
  @Cron('1 */6 * * *', {
    name: 'blackboard-archive-backup',
    timeZone: 'Europe/Berlin',
  })
  async archiveBackup(): Promise<void> {
    this.logger.debug('[Backup] Checking for expired entries...');
    await this.archiveExpiredEntries();
  }

  /**
   * Core archival logic - archives all expired entries
   * Called by: onModuleInit, archiveAtMidnight, archiveBackup, manual trigger
   */
  private async archiveExpiredEntries(): Promise<void> {
    try {
      const result = await this.db.query<{ count: string }>(
        `WITH archived AS (
          UPDATE blackboard_entries
          SET is_active = $1, updated_at = NOW()
          WHERE is_active = $2
            AND expires_at IS NOT NULL
            AND expires_at < NOW()
          RETURNING id
        )
        SELECT COUNT(*)::text as count FROM archived`,
        [IS_ACTIVE.ARCHIVED, IS_ACTIVE.ACTIVE],
      );

      const archivedCount = Number.parseInt(result[0]?.count ?? '0', 10);

      if (archivedCount > 0) {
        this.logger.log(`Archived ${archivedCount} expired blackboard entries`);
      }
      // No log when nothing to archive - reduces noise
    } catch (error: unknown) {
      this.logger.error('Failed to archive expired entries', error);
    }
  }

  /**
   * Manual trigger for archiving expired entries
   * Can be called from controller for testing or manual trigger
   */
  async archiveExpiredEntriesManual(): Promise<{ archivedCount: number }> {
    this.logger.log('Manual archival triggered');

    const result = await this.db.query<{ count: string }>(
      `WITH archived AS (
        UPDATE blackboard_entries
        SET is_active = $1, updated_at = NOW()
        WHERE is_active = $2
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
        RETURNING id
      )
      SELECT COUNT(*)::text as count FROM archived`,
      [IS_ACTIVE.ARCHIVED, IS_ACTIVE.ACTIVE],
    );

    const archivedCount = Number.parseInt(result[0]?.count ?? '0', 10);
    this.logger.log(`Manually archived ${archivedCount} expired entries`);

    return { archivedCount };
  }
}
