/**
 * Tenant Deletion Analyzer — Dry-run estimation & post-deletion verification.
 *
 * WHY this is a separate service:
 * Analysis (read-only impact estimation + verification) is conceptually
 * distinct from execution (destructive multi-pass deletion). Separating
 * them ensures the analyzer can never accidentally delete data.
 *
 * Rule: This sub-service NEVER calls other sub-services.
 */
import { type PoolConnection, query, transaction } from '../utils/db.js';
import type { ConnectionWrapper } from '../utils/dbWrapper.js';
import { wrapConnection } from '../utils/dbWrapper.js';
import { logger } from '../utils/logger.js';
import {
  getTablesWithTenantId,
  validateTenantId,
} from './tenant-deletion.helpers.js';
import {
  CRITICAL_TABLES,
  type CountResult,
  type LegalHoldResult,
} from './tenant-deletion.types.js';

export class TenantDeletionAnalyzer {
  /**
   * Perform dry run to estimate deletion impact.
   * Manages its own read-only transaction — facade does NOT need to wrap this.
   */
  async performDryRun(tenantId: number): Promise<{
    tenantId: number;
    estimatedDuration: number;
    affectedRecords: Record<string, number>;
    warnings: string[];
    blockers: string[];
    totalRecords: number;
  }> {
    validateTenantId(tenantId);

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
      const tables = await getTablesWithTenantId(wrappedConn);

      for (const tableRow of tables) {
        const tableName = tableRow.TABLE_NAME;

        try {
          const countResult = await wrappedConn.query<CountResult[]>(
            `SELECT COUNT(*) as count FROM "${tableName}" WHERE tenant_id = $1`,
            [tenantId],
          );

          const firstResult: CountResult | undefined = countResult[0];
          // PostgreSQL COUNT(*) returns bigint as string — must convert
          const count: number = Number(firstResult?.count ?? 0);
          Object.defineProperty(report.affectedRecords, tableName, {
            value: count,
            writable: true,
            enumerable: true,
            configurable: true,
          });
          report.totalRecords += count;
          report.estimatedDuration += count * 0.001;
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

  /**
   * Verify that all tenant data was deleted.
   * Called by facade AFTER executeDeletions within the same transaction.
   * @throws Error if data remains in non-critical tables
   */
  async verifyCompleteDeletion(
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<string[]> {
    const tables = await getTablesWithTenantId(conn);
    const remainingData: string[] = [];

    for (const tableRow of tables) {
      const tableName = tableRow.TABLE_NAME;

      if (CRITICAL_TABLES.includes(tableName)) {
        continue;
      }

      const countResult = await conn.query<CountResult[]>(
        `SELECT COUNT(*) as count FROM "${tableName}" WHERE tenant_id = $1`,
        [tenantId],
      );

      const firstResult: CountResult | undefined = countResult[0];
      if (firstResult !== undefined && Number(firstResult.count) > 0) {
        remainingData.push(
          `${tableName}: ${String(firstResult.count)} rows remaining`,
        );
      }
    }

    if (remainingData.length > 0) {
      logger.error(
        { tenantId, remainingData },
        'INCOMPLETE DELETION - Data remains',
      );
      throw new Error(
        `Deletion incomplete: ${remainingData.length} tables still contain data`,
      );
    }

    logger.info('Deletion verified - all data removed successfully');
    return remainingData;
  }
}
