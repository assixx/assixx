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
 *
 * Migrated from services/ — uses PoolClient instead of ConnectionWrapper.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { getErrorMessage } from '../common/index.js';
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

@Injectable()
export class TenantDeletionExecutor {
  private readonly logger = new Logger(TenantDeletionExecutor.name);

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
    client: PoolClient,
  ): Promise<DeletionLog[]> {
    const deletionLog: DeletionLog[] = [];

    // Phase 1: Get all tables with tenant_id column
    const allTables = await getTablesWithTenantId(client);
    this.logger.log(`Found ${allTables.length} tables with tenant_id column`);

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
      client,
    );
    deletionLog.push(...regularResults.deleted);

    if (regularResults.stuck.length > 0) {
      this.logger.warn(
        `Could not delete ${regularResults.stuck.length} tables after ${MAX_DELETION_PASSES} passes: ${regularResults.stuck.join(', ')}`,
      );
    }

    // Phase 3: Delete user-related tables (tables with user_id FK)
    const userRelatedTables = await getUserRelatedTables(client);
    const userTableNames = userRelatedTables.map(
      (t: TableNameRow) => t.TABLE_NAME,
    );
    const userResults = await this.multiPassDeleteUserRelated(
      userTableNames,
      tenantId,
      client,
    );
    deletionLog.push(...userResults.deleted);

    // Phase 4: Clear FK references in critical tables before deleting users
    await this.clearCriticalTableUserReferences(tenantId, client);

    // Phase 5: Delete users
    const usersResult = await this.deleteFromTableDirect(
      'users',
      tenantId,
      client,
    );
    if (usersResult) {
      deletionLog.push(usersResult);
    }

    // Phase 6: Delete tenant record
    const tenantResult = await this.deleteFromTableDirect(
      'tenants',
      tenantId,
      client,
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
    client: PoolClient,
  ): Promise<{ deleted: DeletionLog[]; stuck: string[] }> {
    const deletionLog: DeletionLog[] = [];
    let pendingTables = [...tableNames];

    for (
      let pass = 1;
      pass <= MAX_DELETION_PASSES && pendingTables.length > 0;
      pass++
    ) {
      this.logger.log(
        `Deletion pass ${pass}/${MAX_DELETION_PASSES}: ${pendingTables.length} tables remaining`,
      );

      const failedTables: string[] = [];
      let deletedCount = 0;

      for (const tableName of pendingTables) {
        const result = await this.deleteFromTable(tableName, tenantId, client);

        if (result !== null) {
          deletionLog.push(result);
          deletedCount++;
        } else {
          failedTables.push(tableName);
        }
      }

      this.logger.log(
        `   Pass ${pass} complete: ${deletedCount} tables processed, ${failedTables.length} deferred`,
      );

      // No progress — likely circular dependency or unresolvable FK
      if (deletedCount === 0 && failedTables.length > 0) {
        this.logger.warn(
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
    client: PoolClient,
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
          client,
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
    client: PoolClient,
    deletionLog: DeletionLog[],
  ): Promise<boolean> {
    const result = await this.deleteFromUserRelatedTable(
      tableName,
      tenantId,
      client,
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
    client: PoolClient,
  ): Promise<DeletionLog | null> {
    const savepointName = `sp_${tableName.replace(/[^a-z0-9]/gi, '_')}`;

    try {
      await client.query(`SAVEPOINT ${savepointName}`);

      const result = await client.query(
        `DELETE FROM "${tableName}" WHERE tenant_id = $1`,
        [tenantId],
      );

      await client.query(`RELEASE SAVEPOINT ${savepointName}`);

      const deleted = result.rowCount ?? 0;
      if (deleted > 0) {
        this.logger.log(`Deleted ${deleted} rows from ${tableName}`);
      }
      return { table: tableName, deleted };
    } catch (error: unknown) {
      try {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      } catch {
        // Savepoint might not exist, ignore
      }
      this.logger.warn(`Skipped ${tableName}: ${getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * Delete from a single user-related table using JOIN with users
   */
  private async deleteFromUserRelatedTable(
    tableName: string,
    tenantId: number,
    client: PoolClient,
  ): Promise<DeletionLog | null> {
    const savepointName = `sp_user_${tableName.replace(/[^a-z0-9]/gi, '_')}`;

    try {
      await client.query(`SAVEPOINT ${savepointName}`);

      const result = await client.query(
        `DELETE FROM "${tableName}"
         USING users u
         WHERE "${tableName}".user_id = u.id AND u.tenant_id = $1`,
        [tenantId],
      );

      await client.query(`RELEASE SAVEPOINT ${savepointName}`);

      return {
        table: `${tableName} (via users)`,
        deleted: result.rowCount ?? 0,
      };
    } catch {
      try {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
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
    client: PoolClient,
    idColumn: string = 'tenant_id',
  ): Promise<DeletionLog | null> {
    try {
      const result = await client.query(
        `DELETE FROM "${tableName}" WHERE ${idColumn} = $1`,
        [tenantId],
      );

      const deleted = result.rowCount ?? 0;
      if (deleted > 0) {
        this.logger.log(`Deleted ${deleted} rows from ${tableName}`);
      }
      return { table: tableName, deleted };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to delete from ${tableName}: ${getErrorMessage(error)}`,
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
    client: PoolClient,
  ): Promise<void> {
    const safeUpdate = async (
      tableName: string,
      sql: string,
      params: unknown[],
    ): Promise<boolean> => {
      const savepointName = `sp_clear_${tableName}`;
      try {
        await client.query(`SAVEPOINT ${savepointName}`);
        await client.query(sql, params);
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        this.logger.log(`Cleared user references in ${tableName}`);
        return true;
      } catch (error: unknown) {
        try {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        } catch {
          // Ignore rollback errors
        }
        this.logger.warn(
          `Could not clear ${tableName} user refs: ${getErrorMessage(error)}`,
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
