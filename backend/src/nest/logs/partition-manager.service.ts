/**
 * Partition Manager Service
 *
 * Manages time-based partitions for audit_trail and root_logs tables.
 * Runs monthly cron job to create partitions 3 months ahead.
 *
 * CRITICAL: This service requires the partitioned tables from
 * migration 004-audit-log-partitioning.sql to be applied first.
 *
 * @see ADR-009 Central Audit Logging
 */
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Pool } from 'pg';

import { PG_POOL } from '../database/database.constants.js';

/** Number of months to create partitions ahead */
const MONTHS_AHEAD = 3;

/** Table configuration for partitioning */
interface PartitionTable {
  tableName: string;
  partitionPrefix: string;
}

const PARTITIONED_TABLES: readonly PartitionTable[] = [
  { tableName: 'audit_trail', partitionPrefix: 'audit_trail' },
  { tableName: 'root_logs', partitionPrefix: 'root_logs' },
] as const;

@Injectable()
export class PartitionManagerService implements OnModuleInit {
  private readonly logger = new Logger(PartitionManagerService.name);
  private isPartitioningEnabled = false;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Check if tables are partitioned on module init.
   * If not partitioned, disable cron job.
   */
  async onModuleInit(): Promise<void> {
    this.isPartitioningEnabled = await this.checkPartitioningEnabled();

    if (this.isPartitioningEnabled) {
      this.logger.log('Partitioning detected - PartitionManagerService active');
      // Create partitions for upcoming months on startup
      await this.createUpcomingPartitions();
    } else {
      this.logger.warn(
        'Tables are not partitioned - PartitionManagerService disabled. ' +
          'Run migration 004-audit-log-partitioning.sql to enable.',
      );
    }
  }

  /**
   * Check if audit_trail is a partitioned table.
   */
  private async checkPartitioningEnabled(): Promise<boolean> {
    try {
      const result = await this.pool.query<{ relkind: string }>(
        `SELECT relkind FROM pg_class WHERE relname = 'audit_trail'`,
      );

      // 'p' = partitioned table, 'r' = regular table
      return result.rows[0]?.relkind === 'p';
    } catch (error: unknown) {
      this.logger.error('Failed to check partitioning status', error);
      return false;
    }
  }

  /**
   * Cron job: Create partitions for upcoming months.
   * Runs at 00:00 on the 1st day of each month.
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handlePartitionCron(): Promise<void> {
    if (!this.isPartitioningEnabled) {
      return;
    }

    this.logger.log('Running monthly partition creation cron');
    await this.createUpcomingPartitions();
  }

  /**
   * Create partitions for the next N months.
   * Idempotent - won't fail if partition already exists.
   */
  async createUpcomingPartitions(): Promise<void> {
    const now = new Date();

    for (let i = 0; i <= MONTHS_AHEAD; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      await this.createMonthlyPartitions(targetDate);
    }
  }

  /**
   * Create monthly partitions for a specific month.
   * Creates partitions for all configured tables.
   */
  private async createMonthlyPartitions(targetDate: Date): Promise<void> {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1; // 1-indexed
    const monthPadded = month.toString().padStart(2, '0');

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    for (const table of PARTITIONED_TABLES) {
      const partitionName = `${table.partitionPrefix}_${year}_${monthPadded}`;

      try {
        // Check if partition already exists
        const exists = await this.partitionExists(partitionName);
        if (exists) {
          this.logger.debug(`Partition ${partitionName} already exists`);
          continue;
        }

        // Create partition
        const startDateStr = startDate.toISOString().split('T')[0] ?? '';
        const endDateStr = endDate.toISOString().split('T')[0] ?? '';

        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS ${partitionName}
          PARTITION OF ${table.tableName}
          FOR VALUES FROM ('${startDateStr}')
          TO ('${endDateStr}')
        `);

        this.logger.log(`Created partition: ${partitionName}`);
      } catch (error: unknown) {
        // Ignore "already exists" errors (race condition safe)
        if (error instanceof Error && error.message.includes('already exists')) {
          this.logger.debug(`Partition ${partitionName} already exists (concurrent creation)`);
        } else {
          this.logger.error(`Failed to create partition ${partitionName}`, error);
        }
      }
    }
  }

  /**
   * Check if a partition table exists.
   */
  private async partitionExists(partitionName: string): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = $1
      ) as exists`,
      [partitionName],
    );

    return result.rows[0]?.exists === true;
  }

  /**
   * Get list of all partitions for a table.
   * Useful for monitoring and cleanup.
   */
  async listPartitions(tableName: string): Promise<string[]> {
    const result = await this.pool.query<{ partition_name: string }>(
      `SELECT inhrelid::regclass::text as partition_name
       FROM pg_inherits
       WHERE inhparent = $1::regclass
       ORDER BY inhrelid::regclass::text`,
      [tableName],
    );

    return result.rows.map((row: { partition_name: string }) => row.partition_name);
  }

  /**
   * Get partition statistics for monitoring.
   */
  async getPartitionStats(): Promise<
    {
      tableName: string;
      partitionCount: number;
      totalRows: number;
      oldestPartition: string | null;
      newestPartition: string | null;
    }[]
  > {
    const stats: {
      tableName: string;
      partitionCount: number;
      totalRows: number;
      oldestPartition: string | null;
      newestPartition: string | null;
    }[] = [];

    for (const table of PARTITIONED_TABLES) {
      const partitions = await this.listPartitions(table.tableName);

      // Get total row count
      const countResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${table.tableName}`,
      );

      stats.push({
        tableName: table.tableName,
        partitionCount: partitions.length,
        totalRows: Number.parseInt(countResult.rows[0]?.count ?? '0', 10),
        oldestPartition: partitions[0] ?? null,
        newestPartition: partitions[partitions.length - 1] ?? null,
      });
    }

    return stats;
  }
}
