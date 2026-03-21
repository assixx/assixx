/**
 * Tenant Deletion Analyzer — Dry-run estimation & post-deletion verification.
 *
 * WHY this is a separate service:
 * Analysis (read-only impact estimation + verification) is conceptually
 * distinct from execution (destructive multi-pass deletion). Separating
 * them ensures the analyzer can never accidentally delete data.
 *
 * Rule: This sub-service NEVER calls other sub-services.
 *
 * Migrated from services/ — uses DatabaseService for standalone queries,
 * PoolClient for transaction-scoped verification.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { getErrorMessage } from '../common/index.js';
import { DatabaseService } from '../database/database.service.js';
import { getTablesWithTenantId, validateTenantId } from './tenant-deletion.helpers.js';
import {
  CRITICAL_TABLES,
  type CountResult,
  type LegalHoldResult,
} from './tenant-deletion.types.js';

@Injectable()
export class TenantDeletionAnalyzer {
  private readonly logger = new Logger(TenantDeletionAnalyzer.name);

  constructor(private readonly db: DatabaseService) {}

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
    const legalHolds = await this.db.query<LegalHoldResult>(
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
    await this.db.transaction(async (client: PoolClient) => {
      const tables = await getTablesWithTenantId(client);

      for (const tableRow of tables) {
        const tableName = tableRow.TABLE_NAME;

        try {
          const countResult = await client.query<CountResult>(
            `SELECT COUNT(*) as count FROM "${tableName}" WHERE tenant_id = $1`,
            [tenantId],
          );

          const firstResult = countResult.rows[0];
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
        } catch (error: unknown) {
          report.warnings.push(`Could not estimate ${tableName}: ${getErrorMessage(error)}`);
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
  async verifyCompleteDeletion(tenantId: number, client: PoolClient): Promise<string[]> {
    const tables = await getTablesWithTenantId(client);
    const remainingData: string[] = [];

    for (const tableRow of tables) {
      const tableName = tableRow.TABLE_NAME;

      if (CRITICAL_TABLES.includes(tableName)) {
        continue;
      }

      const countResult = await client.query<CountResult>(
        `SELECT COUNT(*) as count FROM "${tableName}" WHERE tenant_id = $1`,
        [tenantId],
      );

      const firstResult = countResult.rows[0];
      if (firstResult !== undefined && Number(firstResult.count) > 0) {
        remainingData.push(`${tableName}: ${String(firstResult.count)} rows remaining`);
      }
    }

    if (remainingData.length > 0) {
      this.logger.error(`INCOMPLETE DELETION - Data remains: ${JSON.stringify(remainingData)}`);
      throw new Error(`Deletion incomplete: ${remainingData.length} tables still contain data`);
    }

    this.logger.log('Deletion verified - all data removed successfully');
    return remainingData;
  }
}
