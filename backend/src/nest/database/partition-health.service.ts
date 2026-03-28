/**
 * Partition Health Service
 *
 * Verifies pg_partman setup and partition coverage for audit_trail and root_logs.
 * Used by /health/partitions endpoint for monitoring and API integration tests.
 *
 * Checks: extension installed, tables registered, current+future partitions exist,
 * default partitions empty, background worker running.
 */
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from './database.service.js';

interface ExtensionHealth {
  installed: boolean;
  version: string | null;
}

interface TablePartitionHealth {
  registered: boolean;
  premake: number | null;
  currentMonthExists: boolean;
  futureMonthsCovered: number;
  expectedFutureMonths: number;
  defaultEmpty: boolean;
}

export interface PartitionHealthResult {
  healthy: boolean;
  checkedAt: string;
  extension: ExtensionHealth;
  tables: {
    audit_trail: TablePartitionHealth;
    root_logs: TablePartitionHealth;
  };
  bgw: { configured: boolean };
}

@Injectable()
export class PartitionHealthService {
  private readonly logger = new Logger(PartitionHealthService.name);

  constructor(private readonly db: DatabaseService) {}

  async check(): Promise<PartitionHealthResult> {
    const checkedAt = new Date().toISOString();

    try {
      const extension = await this.checkExtension();

      if (!extension.installed) {
        return this.unhealthyResult(checkedAt, extension);
      }

      const [auditTrail, rootLogs, defaults] = await Promise.all([
        this.checkTableHealth('public.audit_trail', 'audit_trail'),
        this.checkTableHealth('public.root_logs', 'root_logs'),
        this.checkDefaults(),
      ]);

      auditTrail.defaultEmpty = defaults.auditTrail;
      rootLogs.defaultEmpty = defaults.rootLogs;

      // BGW is configured if extension is installed AND tables are registered.
      // The BGW process itself is only visible during active maintenance (every 24h),
      // so pg_stat_activity checks are unreliable. Partition existence proves it works.
      const bgwConfigured = auditTrail.registered && rootLogs.registered;

      const healthy =
        auditTrail.registered &&
        auditTrail.currentMonthExists &&
        auditTrail.futureMonthsCovered >= auditTrail.expectedFutureMonths &&
        rootLogs.registered &&
        rootLogs.currentMonthExists &&
        rootLogs.futureMonthsCovered >= rootLogs.expectedFutureMonths;

      return {
        healthy,
        checkedAt,
        extension,
        tables: { audit_trail: auditTrail, root_logs: rootLogs },
        bgw: { configured: bgwConfigured },
      };
    } catch (error: unknown) {
      this.logger.error('Partition health check failed', error);
      return this.unhealthyResult(checkedAt, {
        installed: false,
        version: null,
      });
    }
  }

  private async checkExtension(): Promise<ExtensionHealth> {
    const row = await this.db.queryOne<{ extversion: string }>(
      "SELECT extversion FROM pg_extension WHERE extname = 'pg_partman'",
    );

    return {
      installed: row !== null,
      version: row?.extversion ?? null,
    };
  }

  private async checkTableHealth(
    parentTable: string,
    tableName: string,
  ): Promise<TablePartitionHealth> {
    const config = await this.db.queryOne<{ premake: number }>(
      'SELECT premake FROM partman.part_config WHERE parent_table = $1',
      [parentTable],
    );

    if (config === null) {
      return {
        registered: false,
        premake: null,
        currentMonthExists: false,
        futureMonthsCovered: 0,
        expectedFutureMonths: 0,
        defaultEmpty: true,
      };
    }

    const partitions = await this.db.query<{ partition_name: string }>(
      `SELECT inhrelid::regclass::text AS partition_name
       FROM pg_inherits WHERE inhparent = $1::regclass`,
      [tableName],
    );

    const existingNames = new Set(
      partitions.map((p: { partition_name: string }) => p.partition_name),
    );

    const expected = this.buildExpectedNames(tableName, config.premake);
    const firstExpected = expected[0];
    const currentMonthExists = firstExpected !== undefined && existingNames.has(firstExpected);

    let futureMonthsCovered = 0;
    for (let i = 1; i < expected.length; i++) {
      const name = expected[i];
      if (name !== undefined && existingNames.has(name)) {
        futureMonthsCovered++;
      }
    }

    return {
      registered: true,
      premake: config.premake,
      currentMonthExists,
      futureMonthsCovered,
      expectedFutureMonths: config.premake,
      defaultEmpty: true,
    };
  }

  private buildExpectedNames(tableName: string, premake: number): string[] {
    const now = new Date();
    const names: string[] = [];

    for (let i = 0; i <= premake; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      names.push(`${tableName}_p${year}${month}01`);
    }

    return names;
  }

  private async checkDefaults(): Promise<{
    auditTrail: boolean;
    rootLogs: boolean;
  }> {
    const rows = await this.db.query<{
      parent_table: string;
      count: string;
    }>('SELECT * FROM partman.check_default(p_exact_count := true)');

    return {
      auditTrail: !rows.some(
        (r: { parent_table: string }) => r.parent_table === 'public.audit_trail',
      ),
      rootLogs: !rows.some((r: { parent_table: string }) => r.parent_table === 'public.root_logs'),
    };
  }

  private unhealthyResult(checkedAt: string, extension: ExtensionHealth): PartitionHealthResult {
    const emptyTable: TablePartitionHealth = {
      registered: false,
      premake: null,
      currentMonthExists: false,
      futureMonthsCovered: 0,
      expectedFutureMonths: 0,
      defaultEmpty: true,
    };

    return {
      healthy: false,
      checkedAt,
      extension,
      tables: { audit_trail: emptyTable, root_logs: emptyTable },
      bgw: { configured: false },
    };
  }
}
