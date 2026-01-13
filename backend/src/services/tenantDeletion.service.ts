/* eslint-disable max-lines */
/**
 * DYNAMIC TENANT DELETION SERVICE - Best Practice Implementation
 * Automatically finds and deletes ALL tables with tenant_id
 * No manual maintenance needed - adapts to schema changes automatically!
 */
import fs from 'fs/promises';
import { Redis } from 'ioredis';
import path from 'path';

import {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
  execute,
  query,
  transaction,
} from '../utils/db.js';
import { ConnectionWrapper as DbConnectionWrapper, wrapConnection } from '../utils/dbWrapper.js';
import emailService from '../utils/emailService.js';
import { logger } from '../utils/logger.js';

/**
 * Grace period before tenant deletion (in minutes)
 * Default: 43200 (30 days)
 * For testing: Set TENANT_DELETION_GRACE_MINUTES=5 in .env
 */
const parsedGracePeriod = Number(process.env['TENANT_DELETION_GRACE_MINUTES']);
const GRACE_PERIOD_MINUTES: number = parsedGracePeriod > 0 ? parsedGracePeriod : 43200;

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
 * Minimal user interface for email notifications
 * Only the fields needed for sending deletion warning emails
 */
interface DeletionWarningUser extends RowDataPacket {
  email: string;
  first_name: string | null;
  last_name: string | null;
}

/**
 * Dynamic Tenant Deletion Service
 * Finds and deletes ALL data for a tenant automatically
 */
export class TenantDeletionService {
  /** Redis client for cache clearing (lazy-initialized) */
  private redisClient: Redis | null = null;

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
   * NOTE: Uses PostgreSQL information_schema with table_schema = 'public'
   */
  private async getTablesWithTenantId(conn: ConnectionWrapper): Promise<TableNameRow[]> {
    return await conn.query<TableNameRow[]>(`
      SELECT DISTINCT table_name AS "TABLE_NAME"
      FROM information_schema.columns
      WHERE column_name = 'tenant_id'
      AND table_schema = 'public'
      AND table_name NOT LIKE 'v_%'
      ORDER BY table_name
    `);
  }

  /**
   * Get user-related tables (with user_id FK)
   * NOTE: Uses PostgreSQL information_schema with table_schema = 'public'
   */
  private async getUserRelatedTables(conn: ConnectionWrapper): Promise<TableNameRow[]> {
    // PostgreSQL: Generate sequential $1, $2, $3... for each table name
    const placeholders = this.CRITICAL_TABLES.map((_: string, idx: number) => `$${idx + 1}`).join(
      ',',
    );
    return await conn.query<TableNameRow[]>(
      `SELECT DISTINCT table_name AS "TABLE_NAME"
      FROM information_schema.columns
      WHERE column_name = 'user_id'
      AND table_schema = 'public'
      ${placeholders !== '' ? `AND table_name NOT IN (${placeholders})` : ''}`,
      this.CRITICAL_TABLES,
    );
  }

  /**
   * Check for legal holds
   */
  private async checkLegalHolds(tenantId: number, conn: ConnectionWrapper): Promise<void> {
    const holds = await conn.query<LegalHoldRow[]>(
      'SELECT * FROM legal_holds WHERE tenant_id = $1 AND active = true',
      [tenantId],
    );

    if (holds.length > 0) {
      const firstHold = holds[0];
      if (!firstHold) {
        throw new Error('Tenant has active legal hold: No reason specified');
      }
      throw new Error(`Tenant has active legal hold: ${firstHold.reason ?? 'No reason specified'}`);
    }
  }

  /**
   * Sanitize company name for use in file/folder names
   */
  private sanitizeCompanyName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]/gi, '_') // Replace special chars with underscore
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^_|_$/g, '') // Trim underscores
      .substring(0, 50); // Limit length
  }

  /**
   * Generate SQL INSERT statement for a single row
   */
  private generateInsertStatement(tableName: string, row: Record<string, unknown>): string {
    const entries = Object.entries(row);
    const columns = entries.map(([col]: [string, unknown]) => `"${col}"`);
    const values = entries.map(([, val]: [string, unknown]) => this.formatSqlValue(val));
    return `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
  }

  /**
   * Format a value for SQL INSERT statement
   */
  private formatSqlValue(val: unknown): string {
    if (val === null) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (val instanceof Date) return `'${val.toISOString()}'`;
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    // Objects/Arrays → JSON string
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    return 'NULL';
  }

  /**
   * Create SQL backup file with INSERT statements for all tenant data
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
  private async createSqlBackup(
    tenantId: number,
    companyName: string,
    sqlBackupPath: string,
    conn: ConnectionWrapper,
  ): Promise<void> {
    const tables = await this.getTablesWithTenantId(conn);
    const tableNames = tables.map((t: TableNameRow) => t.TABLE_NAME);

    let sqlContent = `-- Tenant Backup: ${companyName} (ID: ${tenantId})\n`;
    sqlContent += `-- Created: ${new Date().toISOString()}\n`;
    sqlContent += `-- Tables: ${tableNames.length}\n\n`;

    for (const tableName of tableNames) {
      try {
        const data = await conn.query(`SELECT * FROM "${tableName}" WHERE tenant_id = $1`, [
          tenantId,
        ]);
        if (data.length > 0) {
          sqlContent += `-- Table: ${tableName} (${data.length} rows)\n`;
          for (const row of data) {
            sqlContent += this.generateInsertStatement(tableName, row as Record<string, unknown>);
          }
          sqlContent += '\n';
        }
      } catch (error) {
        sqlContent += `-- ERROR exporting ${tableName}: ${error instanceof Error ? error.message : 'Unknown'}\n`;
      }
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by caller
    await fs.writeFile(sqlBackupPath, sqlContent);
    logger.info(`✅ SQL backup created: ${sqlBackupPath}`);
  }

  /**
   * Export tenant data to JSON files
   */
  private async exportTablesToJson(
    tenantId: number,
    dataDir: string,
    conn: ConnectionWrapper,
  ): Promise<{ tables: TableNameRow[]; totalRecords: number }> {
    const tables = await this.getTablesWithTenantId(conn);
    let totalRecords = 0;

    for (const tableRow of tables) {
      const tableName = tableRow.TABLE_NAME;
      try {
        const data = await conn.query(`SELECT * FROM "${tableName}" WHERE tenant_id = $1`, [
          tenantId,
        ]);
        if (data.length > 0) {
          const jsonPath = path.join(dataDir, `${tableName}.json`);
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated, tableName from DB schema
          await fs.writeFile(jsonPath, JSON.stringify(data, null, 2));
          totalRecords += data.length;
          logger.info(`Exported ${data.length} records from ${tableName}`);
        }
      } catch (error) {
        logger.warn(
          `Could not export ${tableName}: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    return { tables, totalRecords };
  }

  /**
   * Create complete tenant backup before deletion
   * Includes: SQL dump + JSON exports + metadata
   */
  private async createTenantDataExport(tenantId: number, conn: ConnectionWrapper): Promise<string> {
    // 1. Get tenant info
    const tenantInfo = await conn.query<TenantInfoRow[]>(
      'SELECT company_name, subdomain, email, created_at FROM tenants WHERE id = $1',
      [tenantId],
    );
    const tenant = tenantInfo[0];
    const companyName = tenant?.company_name ?? 'unknown';

    // 2. Setup backup directories
    const sanitizedName = this.sanitizeCompanyName(companyName);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupDirName = `${sanitizedName}_${tenantId}_${timestamp}`;
    const backupDir = `/backups/tenant_deletions/${backupDirName}`;
    const dataDir = `${backupDir}/data`;

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path is safe: sanitizedName removes special chars
    await fs.mkdir(dataDir, { recursive: true });
    logger.info(`📦 Creating tenant backup in ${backupDir}`);

    // 3. Create SQL backup
    await this.createSqlBackup(tenantId, companyName, `${backupDir}/backup.sql`, conn);

    // 4. Export JSON files
    const { tables, totalRecords } = await this.exportTablesToJson(tenantId, dataDir, conn);

    // 5. Create metadata
    const metadata = {
      tenantId,
      companyName,
      subdomain: tenant?.subdomain ?? null,
      email: tenant?.email ?? null,
      tenantCreatedAt: tenant?.created_at ?? null,
      backupCreatedAt: new Date().toISOString(),
      tablesExported: tables.length,
      totalRecords,
      backupType: 'pre_deletion',
      version: '1.0',
    };
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated above
    await fs.writeFile(`${backupDir}/metadata.json`, JSON.stringify(metadata, null, 2));

    // 6. Create archive and store in DB
    const archivePath = `${backupDir}.tar.gz`;
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    await promisify(exec)(
      `tar -czf "${archivePath}" -C /backups/tenant_deletions "${backupDirName}"`,
    );

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path is safe: constructed from sanitized values above
    const archiveStats = await fs.stat(archivePath);
    await conn.query(
      `INSERT INTO tenant_deletion_backups (tenant_id, backup_file, backup_size, backup_type) VALUES ($1, $2, $3, 'final')`,
      [tenantId, archivePath, archiveStats.size],
    );
    await conn.query(
      'INSERT INTO tenant_data_exports (tenant_id, file_path, file_size) VALUES ($1, $2, $3)',
      [tenantId, archivePath, archiveStats.size],
    );

    logger.info(`📦 Backup complete: ${archivePath} (${Math.round(archiveStats.size / 1024)} KB)`);
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
    // Use SAVEPOINT to recover from FK constraint violations without aborting the whole transaction
    const savepointName = `sp_${tableName.replace(/[^a-z0-9]/gi, '_')}`;

    try {
      await conn.query(`SAVEPOINT ${savepointName}`);

      const result = (await conn.query(`DELETE FROM "${tableName}" WHERE tenant_id = $1`, [
        tenantId,
      ])) as unknown as ResultSetHeader;

      await conn.query(`RELEASE SAVEPOINT ${savepointName}`);

      const deleted = result.affectedRows;
      if (deleted > 0) {
        logger.info(`✅ Deleted ${deleted} rows from ${tableName}`);
      }
      return { table: tableName, deleted };
    } catch (error) {
      // Rollback to savepoint to recover from error (FK constraint, etc.)
      try {
        await conn.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      } catch {
        // Savepoint might not exist, ignore
      }
      logger.warn(`⚠️ Skipped ${tableName}: ${error instanceof Error ? error.message : 'Unknown'}`);
      return null;
    }
  }

  /**
   * Send notification emails
   */
  private async sendDeletionWarningEmails(tenantId: number, scheduledDate: Date): Promise<void> {
    const [admins] = await query<DeletionWarningUser[]>(
      "SELECT email, first_name, last_name FROM users WHERE tenant_id = $1 AND role IN ('admin', 'root')",
      [tenantId],
    );

    for (const admin of admins) {
      const nameParts = [admin.first_name, admin.last_name].filter(Boolean).join(' ');
      const displayName = nameParts !== '' ? nameParts : 'Nutzer';
      await emailService.sendEmail({
        to: admin.email,
        subject: 'Wichtig: Ihr Assixx-Konto wird in 30 Tagen gelöscht',
        html: `
          <h2>Ihr Assixx-Konto wird gelöscht</h2>
          <p>Sehr geehrte/r ${displayName},</p>
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
      const tenantResults = await conn.query<TenantInfoRow[]>(
        'SELECT * FROM tenants WHERE id = $1',
        [tenantId],
      );
      const tenantInfo = tenantResults[0];

      const userResults = await conn.query<CountResult[]>(
        'SELECT COUNT(*) as count FROM users WHERE tenant_id = $1',
        [tenantId],
      );
      const firstUserResult: CountResult | undefined = userResults[0];
      const userCount = firstUserResult?.count ?? 0;

      await conn.query(
        `INSERT INTO deletion_audit_trail
         (tenant_id, tenant_name, user_count, deleted_by, deleted_by_ip, deletion_reason, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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

  /**
   * Maximum number of deletion passes before giving up
   * Prevents infinite loops in case of circular FK dependencies
   */
  private readonly MAX_DELETION_PASSES = 15;

  /**
   * Execute core table deletions with multi-pass FK dependency resolution
   *
   * Strategy:
   * 1. Get all tables with tenant_id
   * 2. Multi-pass deletion: retry failed tables until all deleted or no progress
   * 3. Handle user-related tables with same multi-pass approach
   * 4. Clear FK references in critical tables before deleting users
   * 5. Delete users
   * 6. Delete tenant
   */
  private async executeDeletions(
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<DeletionLog[]> {
    const deletionLog: DeletionLog[] = [];

    // Phase 1: Get all tables with tenant_id column
    const allTables = await this.getTablesWithTenantId(conn);
    logger.info(`Found ${allTables.length} tables with tenant_id column`);

    // Separate tables into categories
    const regularTables = allTables
      .map((t: TableNameRow) => t.TABLE_NAME)
      .filter(
        (name: string) =>
          !this.CRITICAL_TABLES.includes(name) && name !== 'users' && name !== 'tenants',
      );

    // Phase 2: Multi-pass deletion of regular tables
    const regularResults = await this.multiPassDelete(regularTables, tenantId, conn);
    deletionLog.push(...regularResults.deleted);

    if (regularResults.stuck.length > 0) {
      logger.warn(
        `Could not delete ${regularResults.stuck.length} tables after ${this.MAX_DELETION_PASSES} passes: ${regularResults.stuck.join(', ')}`,
      );
    }

    // Phase 3: Delete user-related tables (tables with user_id FK)
    const userRelatedTables = await this.getUserRelatedTables(conn);
    const userTableNames = userRelatedTables.map((t: TableNameRow) => t.TABLE_NAME);
    const userResults = await this.multiPassDeleteUserRelated(userTableNames, tenantId, conn);
    deletionLog.push(...userResults.deleted);

    // Phase 4: Clear FK references in critical tables before deleting users
    // This allows us to delete users without violating FK constraints
    await this.clearCriticalTableUserReferences(tenantId, conn);

    // Phase 5: Delete users
    const usersResult = await this.deleteFromTableDirect('users', tenantId, conn);
    if (usersResult) {
      deletionLog.push(usersResult);
    }

    // Phase 6: Delete tenant record
    const tenantResult = await this.deleteFromTableDirect('tenants', tenantId, conn, 'id');
    if (tenantResult) {
      deletionLog.push(tenantResult);
    }

    return deletionLog;
  }

  /**
   * Multi-pass deletion for tables with tenant_id
   * Keeps retrying failed tables until all succeed or no progress
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
  private async multiPassDelete(
    tableNames: string[],
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<{ deleted: DeletionLog[]; stuck: string[] }> {
    const deletionLog: DeletionLog[] = [];
    let pendingTables = [...tableNames];

    for (let pass = 1; pass <= this.MAX_DELETION_PASSES && pendingTables.length > 0; pass++) {
      logger.info(
        `🔄 Deletion pass ${pass}/${this.MAX_DELETION_PASSES}: ${pendingTables.length} tables remaining`,
      );

      const failedTables: string[] = [];
      let deletedCount = 0;

      for (const tableName of pendingTables) {
        const result = await this.deleteFromTable(tableName, tenantId, conn);

        if (result !== null) {
          // Success - table processed (even if 0 rows deleted)
          deletionLog.push(result);
          deletedCount++;
        } else {
          // Failed due to FK constraint - retry in next pass
          failedTables.push(tableName);
        }
      }

      logger.info(
        `   Pass ${pass} complete: ${deletedCount} tables processed, ${failedTables.length} deferred`,
      );

      // Check for progress
      if (deletedCount === 0 && failedTables.length > 0) {
        // No progress this pass - likely circular dependency or unresolvable FK
        logger.warn(`⚠️ No progress in pass ${pass}. Remaining: ${failedTables.join(', ')}`);
        return { deleted: deletionLog, stuck: failedTables };
      }

      pendingTables = failedTables;
    }

    return { deleted: deletionLog, stuck: pendingTables };
  }

  /**
   * Process a single user-related table deletion
   * @returns true if processed successfully, false if FK constraint failed (needs retry)
   */
  private async processUserRelatedTable(
    tableName: string,
    tenantId: number,
    conn: ConnectionWrapper,
    deletionLog: DeletionLog[],
  ): Promise<boolean> {
    const result = await this.deleteFromUserRelatedTable(tableName, tenantId, conn);

    if (result === null) {
      return false;
    }

    if (result.deleted > 0) {
      deletionLog.push(result);
    }
    return true;
  }

  /**
   * Check if deletion pass made no progress (all tables failed)
   */
  private hasNoProgress(failedCount: number, pendingCount: number): boolean {
    return failedCount === pendingCount && failedCount > 0;
  }

  /**
   * Multi-pass deletion for user-related tables (via user_id FK)
   */
  private async multiPassDeleteUserRelated(
    tableNames: string[],
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<{ deleted: DeletionLog[]; stuck: string[] }> {
    const deletionLog: DeletionLog[] = [];
    let pendingTables = [...tableNames];

    for (let pass = 1; pass <= this.MAX_DELETION_PASSES && pendingTables.length > 0; pass++) {
      const failedTables: string[] = [];

      for (const tableName of pendingTables) {
        const success = await this.processUserRelatedTable(tableName, tenantId, conn, deletionLog);
        if (!success) {
          failedTables.push(tableName);
        }
      }

      if (this.hasNoProgress(failedTables.length, pendingTables.length)) {
        return { deleted: deletionLog, stuck: failedTables };
      }

      pendingTables = failedTables;
    }

    return { deleted: deletionLog, stuck: pendingTables };
  }

  /**
   * Delete from a single user-related table using JOIN with users
   */
  private async deleteFromUserRelatedTable(
    tableName: string,
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<DeletionLog | null> {
    const savepointName = `sp_user_${tableName.replace(/[^a-z0-9]/gi, '_')}`;

    try {
      await conn.query(`SAVEPOINT ${savepointName}`);

      const result = (await conn.query(
        `DELETE FROM "${tableName}"
         USING users u
         WHERE "${tableName}".user_id = u.id AND u.tenant_id = $1`,
        [tenantId],
      )) as unknown as ResultSetHeader;

      await conn.query(`RELEASE SAVEPOINT ${savepointName}`);

      return { table: `${tableName} (via users)`, deleted: result.affectedRows };
    } catch {
      try {
        await conn.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      } catch {
        // Ignore rollback errors
      }
      return null;
    }
  }

  /**
   * Clear FK references to users in critical tables
   * This allows deleting users without FK violations
   * Uses SAVEPOINT to prevent transaction abort on NOT NULL constraint violations
   */
  private async clearCriticalTableUserReferences(
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<void> {
    // Helper to safely update with SAVEPOINT (prevents transaction abort)
    const safeUpdate = async (
      tableName: string,
      sql: string,
      params: unknown[],
    ): Promise<boolean> => {
      const savepointName = `sp_clear_${tableName}`;
      try {
        await conn.query(`SAVEPOINT ${savepointName}`);
        await conn.query(sql, params);
        await conn.query(`RELEASE SAVEPOINT ${savepointName}`);
        logger.info(`✅ Cleared user references in ${tableName}`);
        return true;
      } catch (error) {
        try {
          await conn.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        } catch {
          // Ignore rollback errors
        }
        logger.warn(
          `⚠️ Could not clear ${tableName} user refs: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
        return false;
      }
    };

    // tenant_deletion_queue has created_by -> users FK (NULLable)
    await safeUpdate(
      'tenant_deletion_queue',
      `UPDATE tenant_deletion_queue
       SET created_by = NULL,
           second_approver_id = NULL,
           emergency_stopped_by = NULL
       WHERE tenant_id = $1`,
      [tenantId],
    );

    // deletion_audit_trail has deleted_by -> users FK
    // Note: deleted_by may have NOT NULL constraint, so this might fail
    await safeUpdate(
      'deletion_audit_trail',
      `UPDATE deletion_audit_trail SET deleted_by = NULL WHERE tenant_id = $1`,
      [tenantId],
    );

    // legal_holds has created_by and released_by -> users FK
    await safeUpdate(
      'legal_holds',
      `UPDATE legal_holds SET created_by = NULL, released_by = NULL WHERE tenant_id = $1`,
      [tenantId],
    );
  }

  /**
   * Direct table deletion without SAVEPOINT (for final cleanup)
   */
  private async deleteFromTableDirect(
    tableName: string,
    tenantId: number,
    conn: ConnectionWrapper,
    idColumn: string = 'tenant_id',
  ): Promise<DeletionLog | null> {
    try {
      const result = (await conn.query(`DELETE FROM "${tableName}" WHERE ${idColumn} = $1`, [
        tenantId,
      ])) as unknown as ResultSetHeader;

      if (result.affectedRows > 0) {
        logger.info(`✅ Deleted ${result.affectedRows} rows from ${tableName}`);
      }
      return { table: tableName, deleted: result.affectedRows };
    } catch (error) {
      logger.error({ err: error, tableName }, `Failed to delete from ${tableName}`);
      throw error; // Re-throw for final tables - these must succeed
    }
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

        // Delete all tenant data (uses SAVEPOINT to handle FK constraint violations gracefully)
        const deletionLog = await this.executeDeletions(tenantId, wrappedConn);

        await wrappedConn.query(
          'UPDATE tenant_deletion_queue SET status = $1, completed_at = NOW() WHERE id = $2',
          ['completed', queueId],
        );
        await this.clearRedisCache(tenantId);
        await this.verifyCompleteDeletion(tenantId, wrappedConn);
        return this.logAndReturnResult(tenantId, deletionLog, exportPath);
      } catch (error) {
        // Log the ORIGINAL error before trying any recovery
        logger.error({ err: error, tenantId }, `DELETION FAILED for tenant ${tenantId}`);

        // Try to update queue status, but this may fail if transaction is aborted
        try {
          await wrappedConn.query(
            'UPDATE tenant_deletion_queue SET status = $1, error_message = $2 WHERE id = $3',
            ['failed', error instanceof Error ? error.message : 'Unknown error', queueId],
          );
        } catch (updateError) {
          // Queue update failed (transaction aborted), original error already logged above
          logger.debug({ err: updateError }, 'Could not update queue status');
        }
        throw error;
      }
    });
  }

  /**
   * Get or create Redis client (lazy initialization)
   */
  private getRedis(): Redis {
    if (this.redisClient === null) {
      const redisPassword = process.env['REDIS_PASSWORD'];
      this.redisClient = new Redis({
        host: process.env['REDIS_HOST'] ?? 'redis',
        port: Number.parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
        // SECURITY: Redis authentication - only include password if configured
        ...(redisPassword !== undefined && redisPassword !== '' && { password: redisPassword }),
        keyPrefix: 'tenant-deletion:',
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error({ err }, 'TenantDeletion Redis Client Error');
      });
    }
    return this.redisClient;
  }

  /**
   * Clear Redis cache for tenant
   */
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
        `SELECT COUNT(*) as count FROM "${tableName}" WHERE tenant_id = $1`,
        [tenantId],
      );

      const firstResult: CountResult | undefined = countResult[0];
      if (firstResult !== undefined && firstResult.count > 0) {
        remainingData.push(`${tableName}: ${String(firstResult.count)} rows remaining`);
      }
    }

    if (remainingData.length > 0) {
      logger.error({ tenantId, remainingData }, 'INCOMPLETE DELETION - Data remains');
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
      "SELECT * FROM tenant_deletion_queue WHERE tenant_id = $1 AND status IN ('pending_approval', 'processing')",
      [tenantId],
    );

    if (existing.length > 0) {
      throw new Error('Deletion already requested for this tenant');
    }

    // Check legal holds
    const [legalHolds] = await query<RowDataPacket[]>(
      'SELECT * FROM legal_holds WHERE tenant_id = $1 AND active = true',
      [tenantId],
    );

    if (legalHolds.length > 0) {
      throw new Error('Cannot delete tenant with active legal hold');
    }

    // Create queue entry
    const scheduledDate = new Date();
    scheduledDate.setTime(scheduledDate.getTime() + GRACE_PERIOD_MINUTES * 60 * 1000); // Configurable grace period

    const [rows] = await execute<{ id: number }[]>(
      `INSERT INTO tenant_deletion_queue
       (tenant_id, created_by, scheduled_deletion_date, status, approval_status, deletion_reason, ip_address)
       VALUES ($1, $2, $3, 'pending_approval', 'pending', $4, $5)
       RETURNING id`,
      [tenantId, requestedBy, scheduledDate, reason ?? null, ipAddress ?? null],
    );

    const queueId = rows[0]?.id ?? 0;

    // Update tenant status
    await execute('UPDATE tenants SET deletion_status = $1 WHERE id = $2', [
      'marked_for_deletion',
      tenantId,
    ]);

    // Send warning emails
    await this.sendDeletionWarningEmails(tenantId, scheduledDate);

    // Create audit trail
    await this.createDeletionAuditTrail(tenantId, requestedBy, reason, ipAddress);

    logger.info(`Tenant deletion requested: ${tenantId}, Queue ID: ${queueId}`);

    return queueId;
  }

  /**
   * Cancel deletion request (supports both pending_approval and queued status)
   * @param tenantId - The tenant ID
   * @param cancelledBy - User ID who cancelled
   * @param isEmergencyStop - If true, sets emergency_stop fields for audit trail
   */
  async cancelDeletion(
    tenantId: number,
    cancelledBy: number,
    isEmergencyStop: boolean = false,
  ): Promise<void> {
    // Support both pending_approval AND queued status for emergency stop
    const [queue] = await query<QueueRow[]>(
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
      // Emergency stop: set all tracking fields for audit
      await execute(
        `UPDATE tenant_deletion_queue
         SET status = 'cancelled',
             completed_at = NOW(),
             emergency_stop = true,
             emergency_stopped_at = NOW(),
             emergency_stopped_by = $1
         WHERE id = $2`,
        [cancelledBy, firstQueueItem.id],
      );
      logger.warn(`EMERGENCY STOP: Tenant ${tenantId} deletion stopped by user ${cancelledBy}`);
    } else {
      // Normal cancel
      await execute(
        "UPDATE tenant_deletion_queue SET status = 'cancelled', completed_at = NOW() WHERE id = $1",
        [firstQueueItem.id],
      );
      logger.info(`Deletion cancelled for tenant ${tenantId} by user ${cancelledBy}`);
    }

    await execute('UPDATE tenants SET deletion_status = NULL WHERE id = $1', [tenantId]);
  }

  /**
   * Process deletion queue (called by worker)
   */
  async processQueue(): Promise<void> {
    try {
      // Get next approved item ready for deletion
      const [queueItems] = await query<QueueRow[]>(
        `SELECT * FROM tenant_deletion_queue
         WHERE status = 'queued'
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
      logger.error({ err: error }, 'Error processing deletion queue');
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
      'SELECT * FROM legal_holds WHERE tenant_id = $1 AND active = true',
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
            `SELECT COUNT(*) as count FROM "${tableName}" WHERE tenant_id = $1`,
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
    scheduledDate.setTime(scheduledDate.getTime() + GRACE_PERIOD_MINUTES * 60 * 1000); // Configurable grace period
    return { queueId, scheduledDate };
  }

  /**
   * Approve a deletion request (process it immediately)
   * NOTE: approved_by column does not exist in DB schema - using second_approver_id instead
   */
  async approveDeletion(queueId: number, approvedBy: number, _comment?: string): Promise<void> {
    // Update approval status
    // Using second_approver_id since approved_by column doesn't exist in current schema
    await execute(
      `UPDATE tenant_deletion_queue
       SET approval_status = 'approved',
           second_approver_id = $1,
           approved_at = NOW(),
           status = 'queued'
       WHERE id = $2 AND approval_status = 'pending'`,
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
      'SELECT tenant_id FROM tenant_deletion_queue WHERE id = $1',
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
   * Sets emergency_stop = true and tracks who stopped it
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

  /**
   * Retry a failed deletion
   */
  async retryDeletion(queueId: number): Promise<void> {
    // Reset status to queued to retry
    await execute(
      `UPDATE tenant_deletion_queue
       SET status = 'queued',
           error_message = NULL,
           retry_count = retry_count + 1
       WHERE id = $1 AND status = 'failed'`,
      [queueId],
    );

    // Process the queue to retry
    await this.processQueue();
  }
}

// Export singleton instance
export const tenantDeletionService = new TenantDeletionService();
