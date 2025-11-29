/**
 * DYNAMIC TENANT DELETION SERVICE - Best Practice Implementation
 * Automatically finds and deletes ALL tables with tenant_id
 * No manual maintenance needed - adapts to schema changes automatically!
 */
import fs from 'fs/promises';
import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import path from 'path';

import { getRedisClient } from '../config/redis.js';
import { DbUser } from '../routes/v2/users/model/index.js';
import { execute, query, transaction } from '../utils/db.js';
import { ConnectionWrapper as DbConnectionWrapper, wrapConnection } from '../utils/dbWrapper.js';
import emailService from '../utils/emailService.js';
import { logger } from '../utils/logger.js';

type ConnectionWrapper = DbConnectionWrapper;

interface TableNameRow extends RowDataPacket {
  TABLE_NAME: string;
}

interface CountResult extends RowDataPacket {
  count: number;
}

interface TenantInfoRow extends RowDataPacket {
  id: number;
  company_name: string;
  subdomain: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  created_at?: string | Date;
}

interface QueueRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  approval_status: string;
  created_by: number;
  status: string;
  scheduled_deletion_date?: Date;
  created_at?: Date;
  deletion_reason?: string;
  ip_address?: string;
}

interface LegalHoldResult extends RowDataPacket {
  reason: string;
  active: number;
}

interface DeletionResult {
  success: boolean;
  tablesAffected: number;
  totalRowsDeleted: number;
  details: { table: string; deleted: number }[];
}

interface DeletionLog {
  table: string;
  deleted: number;
}

interface LegalHoldRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  reason?: string;
  active: number;
}

/**
 * Dynamic Tenant Deletion Service
 * Finds and deletes ALL data for a tenant automatically
 */
export class TenantDeletionService {
  private readonly CRITICAL_TABLES = [
    'tenant_deletion_queue', // Needed for the deletion process itself
    'deletion_audit_trail', // Audit must be kept
    'tenant_deletion_backups', // Backups must be kept
    'archived_tenant_invoices', // Archived invoices (10 year retention)
    'tenant_data_exports', // GDPR exports
    'legal_holds', // Legal compliance
    'audit_trail', // Audit trail for compliance
  ];

  /**
   * Validate tenant ID
   */
  private validateTenantId(tenantId: number): void {
    if (tenantId <= 0 || !Number.isInteger(tenantId)) {
      throw new Error(`INVALID TENANT_ID: ${tenantId} - must be positive integer`);
    }
  }

  /**
   * Get all tables with tenant_id column
   */
  private async getTablesWithTenantId(conn: ConnectionWrapper): Promise<TableNameRow[]> {
    const [tables] = (await conn.query<TableNameRow[]>(`
      SELECT DISTINCT TABLE_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME = 'tenant_id'
      AND TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME NOT LIKE 'v_%'
      ORDER BY TABLE_NAME
    `)) as unknown as [TableNameRow[], unknown];
    return tables;
  }

  /**
   * Get user-related tables (with user_id FK)
   */
  private async getUserRelatedTables(conn: ConnectionWrapper): Promise<TableNameRow[]> {
    const placeholders = this.CRITICAL_TABLES.map(() => '?').join(',');
    const [tables] = (await conn.query<TableNameRow[]>(
      `SELECT DISTINCT TABLE_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME = 'user_id'
      AND TABLE_SCHEMA = DATABASE()
      ${placeholders !== '' ? `AND TABLE_NAME NOT IN (${placeholders})` : ''}`,
      this.CRITICAL_TABLES,
    )) as unknown as [TableNameRow[], unknown];
    return tables;
  }

  /**
   * Check for legal holds
   */
  private async checkLegalHolds(tenantId: number, conn: ConnectionWrapper): Promise<void> {
    const [holds] = (await conn.query<LegalHoldRow[]>(
      'SELECT * FROM legal_holds WHERE tenant_id = ? AND active = 1',
      [tenantId],
    )) as unknown as [LegalHoldRow[], unknown];

    if (holds.length > 0) {
      const firstHold = holds[0];
      if (!firstHold) {
        throw new Error('Tenant has active legal hold: No reason specified');
      }
      throw new Error(`Tenant has active legal hold: ${firstHold.reason ?? 'No reason specified'}`);
    }
  }

  /**
   * Create GDPR data export before deletion
   */
  private async createTenantDataExport(tenantId: number, conn: ConnectionWrapper): Promise<string> {
    const exportDir = `/tmp/tenant_exports/${tenantId}_${Date.now()}`;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path is safe: tenantId is validated as positive integer, base path is hardcoded, Date.now() is secure
    await fs.mkdir(exportDir, { recursive: true });

    logger.info(`Creating GDPR data export for tenant ${tenantId} in ${exportDir}`);

    // Export all tenant data to JSON files
    const tables = await this.getTablesWithTenantId(conn);

    for (const tableRow of tables) {
      const tableName = tableRow.TABLE_NAME;

      try {
        const [data] = await conn.query(`SELECT * FROM \`${tableName}\` WHERE tenant_id = ?`, [
          tenantId,
        ]);

        if ((data as unknown[]).length > 0) {
          const jsonPath = path.join(exportDir, `${tableName}.json`);
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path is safe: exportDir is validated, tableName comes from DB schema
          await fs.writeFile(jsonPath, JSON.stringify(data, null, 2));
          logger.info(`Exported ${(data as unknown[]).length} records from ${tableName}`);
        }
      } catch (error) {
        logger.warn(
          `Could not export ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Create archive
    const archivePath = `${exportDir}.tar.gz`;
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await execAsync(`tar -czf ${archivePath} -C /tmp/tenant_exports ${path.basename(exportDir)}`);

    // Store export path in database
    await conn.query(
      'INSERT INTO tenant_data_exports (tenant_id, export_path, created_at) VALUES (?, ?, NOW())',
      [tenantId, archivePath],
    );

    return archivePath;
  }

  /**
   * Delete data from a single table
   */
  private async deleteFromTable(
    tableName: string,
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<DeletionLog | null> {
    try {
      const result = (await conn.query(`DELETE FROM \`${tableName}\` WHERE tenant_id = ?`, [
        tenantId,
      ])) as unknown as ResultSetHeader;

      const deleted = result.affectedRows;
      if (deleted > 0) {
        logger.info(`✅ Deleted ${deleted} rows from ${tableName}`);
      }
      return { table: tableName, deleted };
    } catch (error) {
      logger.error(`❌ Failed to delete from ${tableName}:`, error);
      return null;
    }
  }

  /**
   * Delete from user-related tables (via JOIN with users table)
   */
  private async deleteFromUserRelatedTables(
    tables: TableNameRow[],
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<DeletionLog[]> {
    const deletionLog: DeletionLog[] = [];

    for (const tableRow of tables) {
      const tableName = tableRow.TABLE_NAME;

      try {
        const result = (await conn.query(
          `DELETE t FROM \`${tableName}\` t
           INNER JOIN users u ON t.user_id = u.id
           WHERE u.tenant_id = ?`,
          [tenantId],
        )) as unknown as ResultSetHeader;

        const deleted = result.affectedRows;
        if (deleted > 0) {
          deletionLog.push({ table: `${tableName} (via users)`, deleted });
          logger.info(`✅ Deleted ${deleted} rows from ${tableName} (user-related)`);
        }
      } catch (error) {
        logger.debug(
          `Skipped ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return deletionLog;
  }

  /**
   * Send notification emails
   */
  private async sendDeletionWarningEmails(tenantId: number, scheduledDate: Date): Promise<void> {
    const [admins] = await query<DbUser[]>(
      'SELECT * FROM users WHERE tenant_id = ? AND role IN ("admin", "root")',
      [tenantId],
    );

    for (const admin of admins) {
      await emailService.sendEmail({
        to: admin.email,
        subject: 'Wichtig: Ihr Assixx-Konto wird in 30 Tagen gelöscht',
        html: `
          <h2>Ihr Assixx-Konto wird gelöscht</h2>
          <p>Sehr geehrte/r ${admin.first_name} ${admin.last_name},</p>
          <p>Ihr Assixx-Konto wurde zur Löschung markiert und wird am <strong>${scheduledDate.toLocaleDateString('de-DE')}</strong> endgültig gelöscht.</p>
          <h3>Was Sie jetzt tun können:</h3>
          <ul>
            <li>Laden Sie Ihre Daten herunter über das Export-Tool</li>
            <li>Kontaktieren Sie den Support, wenn dies ein Fehler ist</li>
            <li>Sichern Sie wichtige Dokumente und Informationen</li>
          </ul>
          <p>Nach der Löschung sind Ihre Daten unwiderruflich verloren.</p>
        `,
      });
    }
  }

  /**
   * Create audit trail entry
   */
  private async createDeletionAuditTrail(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
    connection?: ConnectionWrapper,
  ): Promise<void> {
    const executeAudit = async (conn: ConnectionWrapper): Promise<void> => {
      const [tenantResults] = await conn.query<TenantInfoRow[]>(
        'SELECT * FROM tenants WHERE id = ?',
        [tenantId],
      );
      const tenantInfo = (tenantResults?.[0] as TenantInfoRow | undefined) ?? undefined;

      const userResults = await conn.query<CountResult[]>(
        'SELECT COUNT(*) as count FROM users WHERE tenant_id = ?',
        [tenantId],
      );
      const firstUserResult: CountResult | undefined = userResults[0];
      const userCount = firstUserResult?.count ?? 0;

      await conn.query(
        `INSERT INTO deletion_audit_trail
         (tenant_id, tenant_name, user_count, deleted_by, deleted_by_ip, deletion_reason, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          tenantInfo?.company_name ?? 'Unknown',
          userCount,
          requestedBy,
          ipAddress ?? 'unknown',
          reason ?? 'No reason provided',
          JSON.stringify({
            subdomain: tenantInfo?.subdomain ?? null,
            created_at: tenantInfo?.created_at ?? null,
          }),
        ],
      );
    };

    if (connection) {
      await executeAudit(connection);
    } else {
      await transaction(async (conn: PoolConnection) => {
        const wrappedConn = wrapConnection(conn);
        await executeAudit(wrappedConn);
      });
    }
  }

  /** Execute core table deletions */
  private async executeDeletions(
    tenantId: number,
    wrappedConn: ConnectionWrapper,
  ): Promise<DeletionLog[]> {
    const deletionLog: DeletionLog[] = [];
    const tables = await this.getTablesWithTenantId(wrappedConn);
    logger.info(`Found ${tables.length} tables with tenant_id column`);

    for (const tableRow of tables) {
      const tableName = tableRow.TABLE_NAME;
      if (this.CRITICAL_TABLES.includes(tableName)) {
        logger.info(`⏭️ Skipping critical table: ${tableName}`);
        continue;
      }
      const result = await this.deleteFromTable(tableName, tenantId, wrappedConn);
      if (result) deletionLog.push(result);
    }

    // Delete user-related tables
    const userRelatedTables = await this.getUserRelatedTables(wrappedConn);
    const userDeletions = await this.deleteFromUserRelatedTables(
      userRelatedTables,
      tenantId,
      wrappedConn,
    );
    deletionLog.push(...userDeletions);

    // Delete tenant record
    const tenantResult = (await wrappedConn.query('DELETE FROM tenants WHERE id = ?', [
      tenantId,
    ])) as unknown as ResultSetHeader;
    deletionLog.push({ table: 'tenants', deleted: tenantResult.affectedRows });

    return deletionLog;
  }

  /**
   * Main deletion method - DYNAMIC approach
   */
  public async deleteTenant(
    tenantId: number,
    queueId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<DeletionResult> {
    this.validateTenantId(tenantId);
    logger.warn(`🚨 STARTING DYNAMIC DELETION FOR TENANT ${tenantId}`);

    return await transaction(async (conn: PoolConnection) => {
      const wrappedConn = wrapConnection(conn);

      try {
        await this.checkLegalHolds(tenantId, wrappedConn);
        const exportPath = await this.createTenantDataExport(tenantId, wrappedConn);
        logger.info(`GDPR export created: ${exportPath}`);
        await this.createDeletionAuditTrail(tenantId, requestedBy, reason, ipAddress, wrappedConn);

        await wrappedConn.query('SET FOREIGN_KEY_CHECKS = 0');
        let deletionLog: DeletionLog[];
        try {
          deletionLog = await this.executeDeletions(tenantId, wrappedConn);
        } finally {
          await wrappedConn.query('SET FOREIGN_KEY_CHECKS = 1');
        }

        await wrappedConn.query(
          'UPDATE tenant_deletion_queue SET status = ?, completed_at = NOW() WHERE id = ?',
          ['completed', queueId],
        );
        await this.clearRedisCache(tenantId);
        await this.verifyCompleteDeletion(tenantId, wrappedConn);
        return this.logAndReturnResult(tenantId, deletionLog, exportPath);
      } catch (error) {
        await wrappedConn.query(
          'UPDATE tenant_deletion_queue SET status = ?, error_message = ? WHERE id = ?',
          ['failed', error instanceof Error ? error.message : 'Unknown error', queueId],
        );
        throw error;
      }
    });
  }

  /**
   * Clear Redis cache for tenant
   */
  private async clearRedisCache(tenantId: number): Promise<void> {
    const redis = await getRedisClient();
    const pattern = `tenant:${tenantId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      for (const key of keys) {
        await redis.del(key);
      }
    }
  }

  /**
   * Log deletion completion and return result
   */
  private logAndReturnResult(
    tenantId: number,
    deletionLog: DeletionLog[],
    exportPath: string,
  ): DeletionResult {
    const totalDeleted = deletionLog.reduce(
      (sum: number, log: DeletionLog) => sum + log.deleted,
      0,
    );

    logger.warn(`
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

  /**
   * Verify that all data was deleted
   */
  private async verifyCompleteDeletion(
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<string[]> {
    const tables = await this.getTablesWithTenantId(conn);
    const remainingData: string[] = [];

    for (const tableRow of tables) {
      const tableName = tableRow.TABLE_NAME;

      if (this.CRITICAL_TABLES.includes(tableName)) {
        continue;
      }

      const countResult = await conn.query<CountResult[]>(
        `SELECT COUNT(*) as count FROM \`${tableName}\` WHERE tenant_id = ?`,
        [tenantId],
      );

      const firstResult: CountResult | undefined = countResult[0];
      if (firstResult !== undefined && firstResult.count > 0) {
        remainingData.push(`${tableName}: ${String(firstResult.count)} rows remaining`);
      }
    }

    if (remainingData.length > 0) {
      logger.error(`⚠️ INCOMPLETE DELETION - Data remains in: ${remainingData.join(', ')}`);
      throw new Error(`Deletion incomplete: ${remainingData.length} tables still contain data`);
    }

    logger.info('✅ Deletion verified - all data removed successfully');
    return remainingData;
  }

  /**
   * Request tenant deletion (requires approval)
   */
  async requestDeletion(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<number> {
    this.validateTenantId(tenantId);

    // Check if already queued
    const [existing] = await query<QueueRow[]>(
      'SELECT * FROM tenant_deletion_queue WHERE tenant_id = ? AND status IN ("pending", "approved", "processing")',
      [tenantId],
    );

    if (existing.length > 0) {
      throw new Error('Deletion already requested for this tenant');
    }

    // Check legal holds
    const [legalHolds] = await query<RowDataPacket[]>(
      'SELECT * FROM legal_holds WHERE tenant_id = ? AND active = 1',
      [tenantId],
    );

    if (legalHolds.length > 0) {
      throw new Error('Cannot delete tenant with active legal hold');
    }

    // Create queue entry
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 30); // 30 days grace period

    const [result] = await execute<ResultSetHeader>(
      `INSERT INTO tenant_deletion_queue
       (tenant_id, created_by, scheduled_deletion_date, status, approval_status, deletion_reason, ip_address)
       VALUES (?, ?, ?, 'pending', 'pending', ?, ?)`,
      [tenantId, requestedBy, scheduledDate, reason ?? null, ipAddress ?? null],
    );

    const queueId = result.insertId;

    // Update tenant status
    await execute('UPDATE tenants SET deletion_status = ? WHERE id = ?', ['scheduled', tenantId]);

    // Send warning emails
    await this.sendDeletionWarningEmails(tenantId, scheduledDate);

    // Create audit trail
    await this.createDeletionAuditTrail(tenantId, requestedBy, reason, ipAddress);

    logger.info(`Tenant deletion requested: ${tenantId}, Queue ID: ${queueId}`);

    return queueId;
  }

  /**
   * Cancel deletion request
   */
  async cancelDeletion(tenantId: number, cancelledBy: number): Promise<void> {
    const [queue] = await query<QueueRow[]>(
      'SELECT * FROM tenant_deletion_queue WHERE tenant_id = ? AND status = "pending"',
      [tenantId],
    );

    if (queue.length === 0) {
      throw new Error('No pending deletion found');
    }

    const firstQueueItem = queue[0];
    if (!firstQueueItem) {
      throw new Error('No pending deletion found');
    }

    await execute(
      'UPDATE tenant_deletion_queue SET status = "cancelled", completed_at = NOW() WHERE id = ?',
      [firstQueueItem.id],
    );

    await execute('UPDATE tenants SET deletion_status = NULL WHERE id = ?', [tenantId]);

    logger.info(`Deletion cancelled for tenant ${tenantId} by user ${cancelledBy}`);
  }

  /**
   * Process deletion queue (called by worker)
   */
  async processQueue(): Promise<void> {
    try {
      // Get next approved item ready for deletion
      const [queueItems] = await query<QueueRow[]>(
        `SELECT * FROM tenant_deletion_queue
         WHERE status = 'pending'
         AND approval_status = 'approved'
         AND (scheduled_deletion_date IS NULL OR scheduled_deletion_date <= NOW())
         ORDER BY created_at ASC
         LIMIT 1`,
      );

      if (queueItems.length === 0) {
        return; // Nothing to process
      }

      const queueItem = queueItems[0];
      if (!queueItem) {
        return; // Nothing to process
      }

      await this.deleteTenant(
        queueItem.tenant_id,
        queueItem.id,
        queueItem.created_by,
        queueItem.deletion_reason,
        queueItem.ip_address,
      );
    } catch (error: unknown) {
      logger.error('Error processing deletion queue:', error);
    }
  }

  /**
   * Perform dry run to estimate deletion impact
   */
  async performDryRun(tenantId: number): Promise<{
    tenantId: number;
    estimatedDuration: number;
    affectedRecords: Record<string, number>;
    warnings: string[];
    blockers: string[];
    totalRecords: number;
  }> {
    this.validateTenantId(tenantId);

    const report = {
      tenantId,
      estimatedDuration: 0,
      affectedRecords: {} as Record<string, number>,
      warnings: [] as string[],
      blockers: [] as string[],
      totalRecords: 0,
    };

    // Check blockers
    const [legalHolds] = await query<LegalHoldResult[]>(
      'SELECT * FROM legal_holds WHERE tenant_id = ? AND active = 1',
      [tenantId],
    );

    if (legalHolds.length > 0) {
      const firstHold = legalHolds[0];
      if (firstHold) {
        report.blockers.push(`Legal hold active: ${firstHold.reason}`);
      }
    }

    // Count records in each table
    await transaction(async (conn: PoolConnection) => {
      const wrappedConn = wrapConnection(conn);
      const tables = await this.getTablesWithTenantId(wrappedConn);

      for (const tableRow of tables) {
        const tableName = tableRow.TABLE_NAME;

        try {
          const countResult = await wrappedConn.query<CountResult[]>(
            `SELECT COUNT(*) as count FROM \`${tableName}\` WHERE tenant_id = ?`,
            [tenantId],
          );

          const firstResult: CountResult | undefined = countResult[0];
          const count: number = firstResult?.count ?? 0;
          // Use Object.defineProperty to safely set the property and avoid injection
          Object.defineProperty(report.affectedRecords, tableName, {
            value: count,
            writable: true,
            enumerable: true,
            configurable: true,
          });
          report.totalRecords += count;
          report.estimatedDuration += count * 0.001; // 1ms per record estimate
        } catch (error) {
          report.warnings.push(
            `Could not estimate ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    });

    // Convert to minutes
    report.estimatedDuration = Math.ceil(report.estimatedDuration / 60);

    return report;
  }

  // ============================================================================
  // COMPATIBILITY METHODS - For backward compatibility with routes
  // ============================================================================

  /**
   * Alias for requestDeletion - kept for backward compatibility
   */
  async requestTenantDeletion(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<{ queueId: number; scheduledDate: Date }> {
    const queueId = await this.requestDeletion(tenantId, requestedBy, reason, ipAddress);
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 30); // 30 days grace period
    return { queueId, scheduledDate };
  }

  /**
   * Approve a deletion request (process it immediately)
   */
  async approveDeletion(queueId: number, approvedBy: number, _comment?: string): Promise<void> {
    // Update approval status
    await execute(
      `UPDATE tenant_deletion_queue
       SET approval_status = 'approved',
           approved_by = ?,
           approved_at = NOW(),
           status = 'pending'
       WHERE id = ? AND approval_status = 'pending'`,
      [approvedBy, queueId],
    );

    // Process the queue to handle approved deletions
    await this.processQueue();
  }

  /**
   * Reject a deletion request
   */
  async rejectDeletion(queueId: number, rejectedBy: number, _reason?: string): Promise<void> {
    const [queueRows] = await query<QueueRow[]>(
      'SELECT tenant_id FROM tenant_deletion_queue WHERE id = ?',
      [queueId],
    );

    if (queueRows.length > 0) {
      const firstRow = queueRows[0];
      if (firstRow) {
        const tenantId = firstRow.tenant_id;
        await this.cancelDeletion(tenantId, rejectedBy);
      }
    }
  }

  /**
   * Emergency stop for deletion
   */
  async emergencyStop(tenantId: number, stoppedBy: number): Promise<void> {
    await this.cancelDeletion(tenantId, stoppedBy);
  }

  /**
   * Trigger emergency stop (alias)
   */
  async triggerEmergencyStop(tenantId: number, stoppedBy: number): Promise<void> {
    await this.emergencyStop(tenantId, stoppedBy);
  }

  /**
   * Get deletion status for a tenant
   */
  async getDeletionStatus(tenantId: number): Promise<{
    status: string;
    queueId?: number;
    scheduledDate?: Date;
    approvalStatus?: string;
  }> {
    const [rows] = await query<QueueRow[]>(
      `SELECT id, status, scheduled_deletion_date, approval_status
       FROM tenant_deletion_queue
       WHERE tenant_id = ? AND status != 'cancelled'
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

  /**
   * Retry a failed deletion
   */
  async retryDeletion(queueId: number): Promise<void> {
    // Reset status to pending to retry
    await execute(
      `UPDATE tenant_deletion_queue
       SET status = 'pending',
           error_message = NULL,
           retry_count = retry_count + 1
       WHERE id = ? AND status = 'failed'`,
      [queueId],
    );

    // Process the queue to retry
    await this.processQueue();
  }
}

// Export singleton instance
export const tenantDeletionService = new TenantDeletionService();
