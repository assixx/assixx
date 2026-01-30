/**
 * Tenant Deletion Executor — Multi-pass FK dependency resolution engine.
 *
 * WHY this is a separate service:
 * The multi-pass deletion logic (handling FK constraint failures via SAVEPOINT,
 * retrying across passes, user-related table cleanup) is a self-contained domain
 * with ~310 lines. Isolating it makes the deletion pipeline testable and auditable.
 *
 * Rule: This sub-service NEVER calls other sub-services (executor, exporter,
 * analyzer, audit). Only the facade orchestrates cross-service calls.
 */
import type { ResultSetHeader } from '../utils/db.js';
import type { ConnectionWrapper } from '../utils/dbWrapper.js';
import { logger } from '../utils/logger.js';
import {
  getTablesWithTenantId,
  getUserRelatedTables,
} from './tenant-deletion.helpers.js';
import {
  CRITICAL_TABLES,
  type DeletionLog,
  MAX_DELETION_PASSES,
  type TableNameRow,
} from './tenant-deletion.types.js';

export class TenantDeletionExecutor {
  /**
   * Execute core table deletions with multi-pass FK dependency resolution.
   *
   * Strategy:
   * 1. Get all tables with tenant_id
   * 2. Multi-pass deletion: retry failed tables until all deleted or no progress
   * 3. Handle user-related tables with same multi-pass approach
   * 4. Clear FK references in critical tables before deleting users
   * 5. Delete users
   * 6. Delete tenant
   */
  async executeDeletions(
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<DeletionLog[]> {
    const deletionLog: DeletionLog[] = [];

    // Phase 1: Get all tables with tenant_id column
    const allTables = await getTablesWithTenantId(conn);
    logger.info(`Found ${allTables.length} tables with tenant_id column`);

    // Separate tables into categories
    const regularTables = allTables
      .map((t: TableNameRow) => t.TABLE_NAME)
      .filter(
        (name: string) =>
          !CRITICAL_TABLES.includes(name) &&
          name !== 'users' &&
          name !== 'tenants',
      );

    // Phase 2: Multi-pass deletion of regular tables
    const regularResults = await this.multiPassDelete(
      regularTables,
      tenantId,
      conn,
    );
    deletionLog.push(...regularResults.deleted);

    if (regularResults.stuck.length > 0) {
      logger.warn(
        `Could not delete ${regularResults.stuck.length} tables after ${MAX_DELETION_PASSES} passes: ${regularResults.stuck.join(', ')}`,
      );
    }

    // Phase 3: Delete user-related tables (tables with user_id FK)
    const userRelatedTables = await getUserRelatedTables(conn);
    const userTableNames = userRelatedTables.map(
      (t: TableNameRow) => t.TABLE_NAME,
    );
    const userResults = await this.multiPassDeleteUserRelated(
      userTableNames,
      tenantId,
      conn,
    );
    deletionLog.push(...userResults.deleted);

    // Phase 4: Clear FK references in critical tables before deleting users
    await this.clearCriticalTableUserReferences(tenantId, conn);

    // Phase 5: Delete users
    const usersResult = await this.deleteFromTableDirect(
      'users',
      tenantId,
      conn,
    );
    if (usersResult) {
      deletionLog.push(usersResult);
    }

    // Phase 6: Delete tenant record
    const tenantResult = await this.deleteFromTableDirect(
      'tenants',
      tenantId,
      conn,
      'id',
    );
    if (tenantResult) {
      deletionLog.push(tenantResult);
    }

    return deletionLog;
  }

  /**
   * Multi-pass deletion for tables with tenant_id.
   * Keeps retrying failed tables until all succeed or no progress.
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity -- Multi-pass retry loop with FK dependency resolution
  private async multiPassDelete(
    tableNames: string[],
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<{ deleted: DeletionLog[]; stuck: string[] }> {
    const deletionLog: DeletionLog[] = [];
    let pendingTables = [...tableNames];

    for (
      let pass = 1;
      pass <= MAX_DELETION_PASSES && pendingTables.length > 0;
      pass++
    ) {
      logger.info(
        `Deletion pass ${pass}/${MAX_DELETION_PASSES}: ${pendingTables.length} tables remaining`,
      );

      const failedTables: string[] = [];
      let deletedCount = 0;

      for (const tableName of pendingTables) {
        const result = await this.deleteFromTable(tableName, tenantId, conn);

        if (result !== null) {
          deletionLog.push(result);
          deletedCount++;
        } else {
          failedTables.push(tableName);
        }
      }

      logger.info(
        `   Pass ${pass} complete: ${deletedCount} tables processed, ${failedTables.length} deferred`,
      );

      // No progress — likely circular dependency or unresolvable FK
      if (deletedCount === 0 && failedTables.length > 0) {
        logger.warn(
          `No progress in pass ${pass}. Remaining: ${failedTables.join(', ')}`,
        );
        return { deleted: deletionLog, stuck: failedTables };
      }

      pendingTables = failedTables;
    }

    return { deleted: deletionLog, stuck: pendingTables };
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

    for (
      let pass = 1;
      pass <= MAX_DELETION_PASSES && pendingTables.length > 0;
      pass++
    ) {
      const failedTables: string[] = [];

      for (const tableName of pendingTables) {
        const success = await this.processUserRelatedTable(
          tableName,
          tenantId,
          conn,
          deletionLog,
        );
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
   * Process a single user-related table deletion.
   * @returns true if processed successfully, false if FK constraint failed (needs retry)
   */
  private async processUserRelatedTable(
    tableName: string,
    tenantId: number,
    conn: ConnectionWrapper,
    deletionLog: DeletionLog[],
  ): Promise<boolean> {
    const result = await this.deleteFromUserRelatedTable(
      tableName,
      tenantId,
      conn,
    );

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
   * Delete data from a single table using SAVEPOINT for FK recovery
   */
  private async deleteFromTable(
    tableName: string,
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<DeletionLog | null> {
    const savepointName = `sp_${tableName.replace(/[^a-z0-9]/gi, '_')}`;

    try {
      await conn.query(`SAVEPOINT ${savepointName}`);

      const result = (await conn.query(
        `DELETE FROM "${tableName}" WHERE tenant_id = $1`,
        [tenantId],
      )) as unknown as ResultSetHeader;

      await conn.query(`RELEASE SAVEPOINT ${savepointName}`);

      const deleted = result.affectedRows;
      if (deleted > 0) {
        logger.info(`Deleted ${deleted} rows from ${tableName}`);
      }
      return { table: tableName, deleted };
    } catch (error) {
      try {
        await conn.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      } catch {
        // Savepoint might not exist, ignore
      }
      logger.warn(
        `Skipped ${tableName}: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return null;
    }
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

      return {
        table: `${tableName} (via users)`,
        deleted: result.affectedRows,
      };
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
   * Direct table deletion without SAVEPOINT (for final cleanup).
   * WHY no SAVEPOINT: These are the last tables deleted (users, tenants).
   * If they fail, the entire transaction must abort.
   */
  async deleteFromTableDirect(
    tableName: string,
    tenantId: number,
    conn: ConnectionWrapper,
    idColumn: string = 'tenant_id',
  ): Promise<DeletionLog | null> {
    try {
      const result = (await conn.query(
        `DELETE FROM "${tableName}" WHERE ${idColumn} = $1`,
        [tenantId],
      )) as unknown as ResultSetHeader;

      if (result.affectedRows > 0) {
        logger.info(`Deleted ${result.affectedRows} rows from ${tableName}`);
      }
      return { table: tableName, deleted: result.affectedRows };
    } catch (error) {
      logger.error(
        { err: error, tableName },
        `Failed to delete from ${tableName}`,
      );
      throw error;
    }
  }

  /**
   * Clear FK references to users in critical tables.
   * WHY: Allows deleting users without FK violations from audit/compliance tables.
   * Uses SAVEPOINT to prevent transaction abort on NOT NULL constraint violations.
   */
  async clearCriticalTableUserReferences(
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<void> {
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
        logger.info(`Cleared user references in ${tableName}`);
        return true;
      } catch (error) {
        try {
          await conn.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        } catch {
          // Ignore rollback errors
        }
        logger.warn(
          `Could not clear ${tableName} user refs: ${error instanceof Error ? error.message : 'Unknown'}`,
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
}
