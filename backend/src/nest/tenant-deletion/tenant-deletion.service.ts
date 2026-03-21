/**
 * Tenant Deletion Service — Coordinator Facade
 *
 * Orchestrates tenant deletion workflow by delegating to specialized sub-services:
 * - TenantDeletionExecutor: Multi-pass FK dependency resolution engine
 * - TenantDeletionExporter: Backup & GDPR data export
 * - TenantDeletionAnalyzer: Dry-run estimation & post-deletion verification
 * - TenantDeletionAudit: Audit trail, legal holds & compliance notifications
 *
 * This facade owns: workflow orchestration, queue management, Redis cache, request lifecycle.
 *
 * Migrated from services/tenantDeletion.service.ts to NestJS \@Injectable.
 */
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { PoolClient } from 'pg';

import { getErrorMessage } from '../common/index.js';
import { DatabaseService } from '../database/database.service.js';
import { TenantDeletionAnalyzer } from './tenant-deletion-analyzer.service.js';
import { TenantDeletionAudit } from './tenant-deletion-audit.service.js';
import { TenantDeletionExecutor } from './tenant-deletion-executor.service.js';
import { TenantDeletionExporter } from './tenant-deletion-exporter.service.js';
import { validateTenantId } from './tenant-deletion.helpers.js';
import {
  type DeletionLog,
  type DeletionResult,
  GRACE_PERIOD_MINUTES,
  type LegalHoldRow,
  type QueueRow,
} from './tenant-deletion.types.js';

/**
 * Coordinator facade for the tenant deletion domain.
 * Delegates heavy lifting to executor, exporter, analyzer, and audit sub-services.
 */
@Injectable()
export class TenantDeletionService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDeletionService.name);

  /** Redis client for cache clearing (lazy-initialized) */
  private redisClient: Redis | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly executor: TenantDeletionExecutor,
    private readonly exporter: TenantDeletionExporter,
    private readonly analyzer: TenantDeletionAnalyzer,
    private readonly audit: TenantDeletionAudit,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient !== null) {
      await this.redisClient.quit();
    }
  }

  /**
   * Main deletion method — DYNAMIC approach.
   * Owns the transaction lifecycle and delegates to sub-services.
   */
  public async deleteTenant(
    tenantId: number,
    queueId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<DeletionResult> {
    validateTenantId(tenantId);
    this.logger.warn(`STARTING DYNAMIC DELETION FOR TENANT ${tenantId}`);

    return await this.db.transaction(async (client: PoolClient) => {
      try {
        await this.audit.checkLegalHolds(tenantId, client);
        const exportPath = await this.exporter.createTenantDataExport(tenantId, client);
        this.logger.log(`GDPR export created: ${exportPath}`);
        await this.audit.createDeletionAuditTrail(tenantId, requestedBy, reason, ipAddress, client);

        const deletionLog = await this.executor.executeDeletions(tenantId, client);

        await client.query(
          'UPDATE tenant_deletion_queue SET status = $1, completed_at = NOW() WHERE id = $2',
          ['completed', queueId],
        );
        await this.clearRedisCache(tenantId);
        await this.analyzer.verifyCompleteDeletion(tenantId, client);
        return this.logAndReturnResult(tenantId, deletionLog, exportPath);
      } catch (error: unknown) {
        this.logger.error(`DELETION FAILED for tenant ${tenantId}: ${getErrorMessage(error)}`);

        try {
          await client.query(
            'UPDATE tenant_deletion_queue SET status = $1, error_message = $2 WHERE id = $3',
            ['failed', getErrorMessage(error), queueId],
          );
        } catch (updateError: unknown) {
          this.logger.debug(`Could not update queue status: ${getErrorMessage(updateError)}`);
        }
        throw error;
      }
    });
  }

  /**
   * Request tenant deletion (requires approval).
   * Creates queue entry, sends warning emails, and creates audit trail.
   */
  async requestDeletion(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<number> {
    validateTenantId(tenantId);

    // Check if already queued
    const existing = await this.db.query<QueueRow>(
      "SELECT * FROM tenant_deletion_queue WHERE tenant_id = $1 AND status IN ('pending_approval', 'processing')",
      [tenantId],
    );

    if (existing.length > 0) {
      throw new Error('Deletion already requested for this tenant');
    }

    // Check legal holds
    const legalHolds = await this.db.query<LegalHoldRow>(
      'SELECT * FROM legal_holds WHERE tenant_id = $1 AND active = true',
      [tenantId],
    );

    if (legalHolds.length > 0) {
      throw new Error('Cannot delete tenant with active legal hold');
    }

    // Create queue entry
    const scheduledDate = new Date();
    scheduledDate.setTime(scheduledDate.getTime() + GRACE_PERIOD_MINUTES * 60 * 1000);

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO tenant_deletion_queue
       (tenant_id, created_by, scheduled_deletion_date, status, approval_status, deletion_reason, ip_address)
       VALUES ($1, $2, $3, 'pending_approval', 'pending', $4, $5)
       RETURNING id`,
      [tenantId, requestedBy, scheduledDate, reason ?? null, ipAddress ?? null],
    );

    const queueId = rows[0]?.id ?? 0;

    // Update tenant status
    await this.db.query('UPDATE tenants SET deletion_status = $1 WHERE id = $2', [
      'marked_for_deletion',
      tenantId,
    ]);

    // Send warning emails & create audit trail
    await this.audit.sendDeletionWarningEmails(tenantId, scheduledDate);
    await this.audit.createDeletionAuditTrail(tenantId, requestedBy, reason, ipAddress);

    this.logger.log(`Tenant deletion requested: ${tenantId}, Queue ID: ${queueId}`);
    return queueId;
  }

  /**
   * Cancel deletion request (supports both pending_approval and queued status).
   * @param isEmergencyStop - If true, sets emergency_stop fields for audit trail
   */
  async cancelDeletion(
    tenantId: number,
    cancelledBy: number,
    isEmergencyStop: boolean = false,
  ): Promise<void> {
    const queue = await this.db.query<QueueRow>(
      "SELECT * FROM tenant_deletion_queue WHERE tenant_id = $1 AND status IN ('pending_approval', 'queued')",
      [tenantId],
    );

    if (queue.length === 0) {
      throw new Error('No active deletion found (must be pending_approval or queued)');
    }

    const firstQueueItem = queue[0];
    if (!firstQueueItem) {
      throw new Error('No pending deletion found');
    }

    if (isEmergencyStop) {
      await this.db.query(
        `UPDATE tenant_deletion_queue
         SET status = 'cancelled',
             completed_at = NOW(),
             emergency_stop = true,
             emergency_stopped_at = NOW(),
             emergency_stopped_by = $1
         WHERE id = $2`,
        [cancelledBy, firstQueueItem.id],
      );
      this.logger.warn(
        `EMERGENCY STOP: Tenant ${tenantId} deletion stopped by user ${cancelledBy}`,
      );
    } else {
      await this.db.query(
        "UPDATE tenant_deletion_queue SET status = 'cancelled', completed_at = NOW() WHERE id = $1",
        [firstQueueItem.id],
      );
      this.logger.log(`Deletion cancelled for tenant ${tenantId} by user ${cancelledBy}`);
    }

    await this.db.query('UPDATE tenants SET deletion_status = NULL WHERE id = $1', [tenantId]);
  }

  /**
   * Process deletion queue (called by worker)
   */
  async processQueue(): Promise<void> {
    try {
      const queueItems = await this.db.query<QueueRow>(
        `SELECT * FROM tenant_deletion_queue
         WHERE status = 'queued'
         AND approval_status = 'approved'
         AND (scheduled_deletion_date IS NULL OR scheduled_deletion_date <= NOW())
         ORDER BY created_at ASC
         LIMIT 1`,
      );

      if (queueItems.length === 0) {
        return;
      }

      const queueItem = queueItems[0];
      if (!queueItem) {
        return;
      }

      await this.deleteTenant(
        queueItem.tenant_id,
        queueItem.id,
        queueItem.created_by,
        queueItem.deletion_reason,
        queueItem.ip_address,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Error processing deletion queue: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  /**
   * Perform dry run to estimate deletion impact.
   * Delegates entirely to analyzer (manages its own read-only transaction).
   */
  async performDryRun(tenantId: number): Promise<{
    tenantId: number;
    estimatedDuration: number;
    affectedRecords: Record<string, number>;
    warnings: string[];
    blockers: string[];
    totalRecords: number;
  }> {
    return await this.analyzer.performDryRun(tenantId);
  }

  // ==========================================================================
  // COMPATIBILITY METHODS — For backward compatibility with routes
  // ==========================================================================

  /**
   * Alias for requestDeletion — kept for backward compatibility
   */
  async requestTenantDeletion(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<{ queueId: number; scheduledDate: Date }> {
    const queueId = await this.requestDeletion(tenantId, requestedBy, reason, ipAddress);
    const scheduledDate = new Date();
    scheduledDate.setTime(scheduledDate.getTime() + GRACE_PERIOD_MINUTES * 60 * 1000);
    return { queueId, scheduledDate };
  }

  /**
   * Approve a deletion request (process it immediately).
   * NOTE: approved_by column does not exist in DB schema — using second_approver_id instead
   */
  async approveDeletion(queueId: number, approvedBy: number, _comment?: string): Promise<void> {
    await this.db.query(
      `UPDATE tenant_deletion_queue
       SET approval_status = 'approved',
           second_approver_id = $1,
           approved_at = NOW(),
           status = 'queued'
       WHERE id = $2 AND approval_status = 'pending'`,
      [approvedBy, queueId],
    );

    await this.processQueue();
  }

  async rejectDeletion(queueId: number, rejectedBy: number, _reason?: string): Promise<void> {
    const queueRows = await this.db.query<QueueRow>(
      'SELECT tenant_id FROM tenant_deletion_queue WHERE id = $1',
      [queueId],
    );

    if (queueRows.length > 0) {
      const firstRow = queueRows[0];
      if (firstRow) {
        await this.cancelDeletion(firstRow.tenant_id, rejectedBy);
      }
    }
  }

  /**
   * Emergency stop for deletion.
   * Sets emergency_stop = true and tracks who stopped it.
   */
  async emergencyStop(tenantId: number, stoppedBy: number): Promise<void> {
    await this.cancelDeletion(tenantId, stoppedBy, true);
  }

  /**
   * Trigger emergency stop (alias)
   */
  async triggerEmergencyStop(tenantId: number, stoppedBy: number): Promise<void> {
    await this.emergencyStop(tenantId, stoppedBy);
  }

  async getDeletionStatus(tenantId: number): Promise<{
    status: string;
    queueId?: number;
    scheduledDate?: Date;
    approvalStatus?: string;
  }> {
    const rows = await this.db.query<QueueRow>(
      `SELECT id, status, scheduled_deletion_date, approval_status
       FROM tenant_deletion_queue
       WHERE tenant_id = $1 AND status != 'cancelled'
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId],
    );

    if (rows.length === 0) {
      return { status: 'not_scheduled' };
    }

    const row = rows[0];
    if (!row) {
      return { status: 'not_scheduled' };
    }

    const result: {
      status: string;
      queueId?: number;
      scheduledDate?: Date;
      approvalStatus?: string;
    } = {
      status: row.status,
      queueId: row.id,
      approvalStatus: row.approval_status,
    };

    if (row.scheduled_deletion_date !== undefined) {
      result.scheduledDate = row.scheduled_deletion_date;
    }

    return result;
  }

  async retryDeletion(queueId: number): Promise<void> {
    await this.db.query(
      `UPDATE tenant_deletion_queue
       SET status = 'queued',
           error_message = NULL,
           retry_count = retry_count + 1
       WHERE id = $1 AND status = 'failed'`,
      [queueId],
    );

    await this.processQueue();
  }

  // ==========================================================================
  // PRIVATE — Infrastructure (Redis, logging)
  // ==========================================================================

  /**
   * Get or create Redis client (lazy initialization)
   */
  private getRedis(): Redis {
    if (this.redisClient === null) {
      const redisPassword = this.configService.get<string>('REDIS_PASSWORD') ?? undefined;
      this.redisClient = new Redis({
        host: this.configService.get<string>('REDIS_HOST') ?? 'redis',
        port: Number.parseInt(this.configService.get<string>('REDIS_PORT') ?? '6379', 10),
        // SECURITY: Redis authentication — only include password if configured
        ...(redisPassword !== undefined && redisPassword !== '' && { password: redisPassword }),
        keyPrefix: 'tenant-deletion:',
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
      });

      this.redisClient.on('error', (err: Error) => {
        this.logger.error(`TenantDeletion Redis Client Error: ${err.message}`);
      });
    }
    return this.redisClient;
  }

  private async clearRedisCache(tenantId: number): Promise<void> {
    const redis = this.getRedis();
    const pattern = `tenant:${tenantId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      for (const key of keys) {
        await redis.del(key);
      }
    }
  }

  private logAndReturnResult(
    tenantId: number,
    deletionLog: DeletionLog[],
    exportPath: string,
  ): DeletionResult {
    const totalDeleted = deletionLog.reduce(
      (sum: number, log: DeletionLog) => sum + log.deleted,
      0,
    );

    this.logger.warn(`
      ========================================
      TENANT ${tenantId} DELETION COMPLETE
      ========================================
      Tables affected: ${deletionLog.length}
      Total rows deleted: ${totalDeleted}
      GDPR Export: ${exportPath}
      ========================================
    `);

    return {
      success: true,
      tablesAffected: deletionLog.length,
      totalRowsDeleted: totalDeleted,
      details: deletionLog,
    };
  }
}
