/**
 * Log Retention Service
 *
 * Manages automatic cleanup of old audit logs based on per-tenant
 * retention settings. Runs daily at 3 AM.
 *
 * CRITICAL: This service DETACHES old partitions instead of DELETE
 * when partitioning is enabled, which is 100x faster for large datasets.
 *
 * Retention Settings (in tenant_settings):
 * - audit_log_retention_days: Days to keep logs (default: 365)
 * - Setting category: 'audit'
 *
 * @see ADR-009 Central Audit Logging
 */
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Pool } from 'pg';

import { PG_POOL } from '../database/database.constants.js';

/** Default retention period in days if not configured per-tenant */
const DEFAULT_RETENTION_DAYS = 365;

/** Minimum allowed retention (7 days) to prevent accidental data loss */
const MIN_RETENTION_DAYS = 7;

/** Maximum batch size for delete operations */
const DELETE_BATCH_SIZE = 10000;

/** Tenant retention configuration */
interface TenantRetentionConfig {
  tenantId: number;
  retentionDays: number;
}

@Injectable()
export class LogRetentionService implements OnModuleInit {
  private readonly logger = new Logger(LogRetentionService.name);
  private isPartitioningEnabled = false;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Check if partitioning is enabled on module init.
   */
  async onModuleInit(): Promise<void> {
    this.isPartitioningEnabled = await this.checkPartitioningEnabled();

    if (this.isPartitioningEnabled) {
      this.logger.log('Partitioning detected - using fast partition detach for cleanup');
    } else {
      this.logger.log('No partitioning - using batched DELETE for cleanup');
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

      return result.rows[0]?.relkind === 'p';
    } catch (error: unknown) {
      this.logger.error('Failed to check partitioning status', error);
      return false;
    }
  }

  /**
   * Cron job: Run daily cleanup at 3 AM.
   * '0 3 * * *' = At 03:00 every day
   */
  @Cron('0 3 * * *')
  async handleRetentionCron(): Promise<void> {
    this.logger.log('Starting daily log retention cleanup');

    try {
      const stats = await this.runRetentionCleanup();
      this.logger.log(
        `Retention cleanup completed: ${stats.totalDeleted} logs deleted ` +
          `across ${stats.tenantsProcessed} tenants`,
      );
    } catch (error: unknown) {
      this.logger.error('Retention cleanup failed', error);
    }
  }

  /**
   * Run retention cleanup for all tenants.
   * Returns cleanup statistics.
   */
  async runRetentionCleanup(): Promise<{
    tenantsProcessed: number;
    totalDeleted: number;
    errors: number;
  }> {
    const stats = {
      tenantsProcessed: 0,
      totalDeleted: 0,
      errors: 0,
    };

    // Get all tenant retention configs
    const configs = await this.getAllTenantRetentionConfigs();

    for (const config of configs) {
      try {
        const deleted = await this.cleanupTenantLogs(config);
        stats.totalDeleted += deleted;
        stats.tenantsProcessed++;
      } catch (error: unknown) {
        stats.errors++;
        this.logger.error(`Cleanup failed for tenant ${config.tenantId}`, error);
      }
    }

    // Also cleanup partitions if partitioning is enabled
    if (this.isPartitioningEnabled) {
      await this.cleanupOldPartitions();
    }

    return stats;
  }

  /**
   * Get retention configuration for all tenants.
   * Returns default if not configured.
   */
  private async getAllTenantRetentionConfigs(): Promise<TenantRetentionConfig[]> {
    // Get all tenants
    const tenantsResult = await this.pool.query<{ id: number }>(`SELECT id FROM tenants`);

    const configs: TenantRetentionConfig[] = [];

    for (const tenant of tenantsResult.rows) {
      const retentionDays = await this.getTenantRetentionDays(tenant.id);
      configs.push({
        tenantId: tenant.id,
        retentionDays,
      });
    }

    return configs;
  }

  /**
   * Get retention days for a specific tenant.
   * Returns default if not configured.
   */
  async getTenantRetentionDays(tenantId: number): Promise<number> {
    const result = await this.pool.query<{ setting_value: string }>(
      `SELECT setting_value FROM tenant_settings
       WHERE tenant_id = $1 AND setting_key = 'audit_log_retention_days'`,
      [tenantId],
    );

    if (result.rows.length === 0 || result.rows[0]?.setting_value === undefined) {
      return DEFAULT_RETENTION_DAYS;
    }

    const days = Number.parseInt(result.rows[0].setting_value, 10);

    // Enforce minimum retention
    if (Number.isNaN(days) || days < MIN_RETENTION_DAYS) {
      this.logger.warn(
        `Tenant ${tenantId} has invalid retention setting (${result.rows[0].setting_value}), ` +
          `using minimum ${MIN_RETENTION_DAYS} days`,
      );
      return MIN_RETENTION_DAYS;
    }

    return days;
  }

  /**
   * Set retention days for a tenant.
   * Uses upsert pattern.
   */
  async setTenantRetentionDays(tenantId: number, days: number): Promise<void> {
    // Enforce minimum
    const safeDays = Math.max(days, MIN_RETENTION_DAYS);

    await this.pool.query(
      `INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, value_type, category)
       VALUES ($1, 'audit_log_retention_days', $2, 'integer', 'audit')
       ON CONFLICT (tenant_id, setting_key)
       DO UPDATE SET setting_value = $2, updated_at = NOW()`,
      [tenantId, safeDays.toString()],
    );

    this.logger.log(`Set retention for tenant ${tenantId} to ${safeDays} days`);
  }

  /**
   * Cleanup logs for a specific tenant.
   * Uses batched DELETE to avoid locking.
   */
  private async cleanupTenantLogs(config: TenantRetentionConfig): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);

    let totalDeleted = 0;

    // Cleanup audit_trail (batched)
    let deletedBatch = DELETE_BATCH_SIZE;
    while (deletedBatch === DELETE_BATCH_SIZE) {
      const result = await this.pool.query<{ count: string }>(
        `WITH deleted AS (
          DELETE FROM audit_trail
          WHERE tenant_id = $1 AND created_at < $2
          LIMIT $3
          RETURNING 1
        )
        SELECT COUNT(*) as count FROM deleted`,
        [config.tenantId, cutoffDate, DELETE_BATCH_SIZE],
      );
      deletedBatch = Number.parseInt(result.rows[0]?.count ?? '0', 10);
      totalDeleted += deletedBatch;
    }

    // Cleanup root_logs (batched)
    deletedBatch = DELETE_BATCH_SIZE;
    while (deletedBatch === DELETE_BATCH_SIZE) {
      const result = await this.pool.query<{ count: string }>(
        `WITH deleted AS (
          DELETE FROM root_logs
          WHERE tenant_id = $1 AND created_at < $2
          LIMIT $3
          RETURNING 1
        )
        SELECT COUNT(*) as count FROM deleted`,
        [config.tenantId, cutoffDate, DELETE_BATCH_SIZE],
      );
      deletedBatch = Number.parseInt(result.rows[0]?.count ?? '0', 10);
      totalDeleted += deletedBatch;
    }

    if (totalDeleted > 0) {
      this.logger.debug(
        `Cleaned up ${totalDeleted} logs for tenant ${config.tenantId} ` +
          `(older than ${config.retentionDays} days)`,
      );
    }

    return totalDeleted;
  }

  /**
   * Cleanup old partitions (DETACH + DROP).
   * Much faster than DELETE for large datasets.
   *
   * Note: This is a global operation - detaches partitions older than
   * the maximum retention period across all tenants.
   */
  private async cleanupOldPartitions(): Promise<void> {
    const cutoffDate = await this.calculatePartitionCutoffDate();

    for (const tableName of ['audit_trail', 'root_logs']) {
      await this.cleanupTablePartitions(tableName, cutoffDate);
    }
  }

  /**
   * Calculate the cutoff date for partition cleanup.
   * Uses maximum retention days across all tenants + 30 days buffer.
   */
  private async calculatePartitionCutoffDate(): Promise<Date> {
    const result = await this.pool.query<{ max_retention: string }>(
      `SELECT COALESCE(MAX(setting_value::integer), $1) as max_retention
       FROM tenant_settings
       WHERE setting_key = 'audit_log_retention_days'`,
      [DEFAULT_RETENTION_DAYS],
    );

    const maxRetentionDays = Number.parseInt(result.rows[0]?.max_retention ?? '365', 10);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxRetentionDays - 30);

    return cutoffDate;
  }

  /**
   * Cleanup partitions for a specific table.
   */
  private async cleanupTablePartitions(tableName: string, cutoffDate: Date): Promise<void> {
    const partitions = await this.pool.query<{ partition_name: string }>(
      `SELECT inhrelid::regclass::text as partition_name
       FROM pg_inherits
       WHERE inhparent = $1::regclass`,
      [tableName],
    );

    const partitionRegex = /_(\d{4})_(\d{2})$/;

    for (const partition of partitions.rows) {
      const partitionDate = this.extractPartitionDate(partition.partition_name, partitionRegex);
      if (partitionDate === null) continue;

      if (partitionDate < cutoffDate) {
        await this.dropPartition(tableName, partition.partition_name);
      }
    }
  }

  /**
   * Extract date from partition name (format: table_YYYY_MM).
   */
  private extractPartitionDate(partitionName: string, regex: RegExp): Date | null {
    const match = regex.exec(partitionName);
    if (match === null) return null;

    const year = Number.parseInt(match[1] ?? '0', 10);
    const month = Number.parseInt(match[2] ?? '0', 10);

    return new Date(year, month - 1, 1);
  }

  /**
   * Detach and drop a partition.
   */
  private async dropPartition(tableName: string, partitionName: string): Promise<void> {
    try {
      await this.pool.query(`ALTER TABLE ${tableName} DETACH PARTITION ${partitionName}`);
      await this.pool.query(`DROP TABLE IF EXISTS ${partitionName}`);
      this.logger.log(`Dropped old partition: ${partitionName}`);
    } catch (error: unknown) {
      this.logger.error(`Failed to drop partition ${partitionName}`, error);
    }
  }

  /**
   * Get cleanup statistics for monitoring.
   */
  async getRetentionStats(): Promise<{
    defaultRetentionDays: number;
    minRetentionDays: number;
    tenantsWithCustomRetention: number;
    oldestLogDate: Date | null;
  }> {
    // Count tenants with custom retention
    const customResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM tenant_settings
       WHERE setting_key = 'audit_log_retention_days'`,
    );

    // Get oldest log date
    const oldestResult = await this.pool.query<{ oldest: Date | null }>(
      `SELECT MIN(created_at) as oldest FROM audit_trail`,
    );

    return {
      defaultRetentionDays: DEFAULT_RETENTION_DAYS,
      minRetentionDays: MIN_RETENTION_DAYS,
      tenantsWithCustomRetention: Number.parseInt(customResult.rows[0]?.count ?? '0', 10),
      oldestLogDate: oldestResult.rows[0]?.oldest ?? null,
    };
  }
}
