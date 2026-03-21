/**
 * Unit tests for PartitionHealthService
 *
 * DatabaseService is mocked via constructor DI — no vi.mock() on module paths.
 * Uses vi.useFakeTimers() to control date-dependent partition name generation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from './database.service.js';
import { type PartitionHealthResult, PartitionHealthService } from './partition-health.service.js';

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

function buildPartitionNames(
  tableName: string,
  startYear: number,
  startMonth: number,
  count: number,
): { partition_name: string }[] {
  const names: { partition_name: string }[] = [];

  for (let i = 0; i < count; i++) {
    const date = new Date(startYear, startMonth - 1 + i, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    names.push({ partition_name: `${tableName}_p${y}${m}01` });
  }

  return names;
}

describe('PartitionHealthService', () => {
  let service: PartitionHealthService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 7))); // March 7, 2026 UTC
    mockDb = createMockDb();
    service = new PartitionHealthService(mockDb as unknown as DatabaseService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setupHealthyMocks(): void {
    mockDb.queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('pg_extension')) return { extversion: '5.4.3' };
      if (sql.includes('part_config')) return { premake: 12 };
      return null;
    });

    mockDb.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('pg_inherits')) {
        const tableName = params?.[0] as string;
        return buildPartitionNames(tableName, 2026, 3, 13);
      }
      if (sql.includes('check_default')) return [];
      return [];
    });
  }

  // =============================================================
  // check — healthy scenarios
  // =============================================================

  describe('check — healthy', () => {
    it('should return healthy when all checks pass', async () => {
      setupHealthyMocks();

      const result = await service.check();

      expect(result.healthy).toBe(true);
      expect(result.extension).toEqual({
        installed: true,
        version: '5.4.3',
      });
      expect(result.tables.audit_trail.registered).toBe(true);
      expect(result.tables.audit_trail.premake).toBe(12);
      expect(result.tables.audit_trail.currentMonthExists).toBe(true);
      expect(result.tables.audit_trail.futureMonthsCovered).toBe(12);
      expect(result.tables.root_logs.registered).toBe(true);
      expect(result.tables.root_logs.currentMonthExists).toBe(true);
      expect(result.tables.root_logs.futureMonthsCovered).toBe(12);
      expect(result.bgw.configured).toBe(true);
    });

    it('should include checkedAt as ISO timestamp', async () => {
      setupHealthyMocks();

      const result = await service.check();

      expect(result.checkedAt).toBe('2026-03-07T00:00:00.000Z');
    });

    it('should report defaults as empty when check_default returns no rows', async () => {
      setupHealthyMocks();

      const result = await service.check();

      expect(result.tables.audit_trail.defaultEmpty).toBe(true);
      expect(result.tables.root_logs.defaultEmpty).toBe(true);
    });
  });

  // =============================================================
  // check — unhealthy scenarios
  // =============================================================

  describe('check — unhealthy', () => {
    it('should short-circuit when extension is not installed', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await service.check();

      expect(result.healthy).toBe(false);
      expect(result.extension.installed).toBe(false);
      expect(result.extension.version).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should fail when one table is not registered', async () => {
      mockDb.queryOne.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes('pg_extension')) return { extversion: '5.4.3' };
        if (sql.includes('part_config')) {
          return (params?.[0] as string) === 'public.audit_trail' ? { premake: 12 } : null;
        }
        return null;
      });
      mockDb.query.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes('pg_inherits')) {
          return buildPartitionNames(params?.[0] as string, 2026, 3, 13);
        }
        if (sql.includes('check_default')) return [];
        return [];
      });

      const result = await service.check();

      expect(result.healthy).toBe(false);
      expect(result.tables.audit_trail.registered).toBe(true);
      expect(result.tables.root_logs.registered).toBe(false);
      expect(result.bgw.configured).toBe(false);
    });

    it('should fail when current month partition is missing', async () => {
      mockDb.queryOne.mockImplementation(async (sql: string) => {
        if (sql.includes('pg_extension')) return { extversion: '5.4.3' };
        if (sql.includes('part_config')) return { premake: 12 };
        return null;
      });
      mockDb.query.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes('pg_inherits')) {
          const tableName = params?.[0] as string;
          if (tableName === 'audit_trail') {
            return buildPartitionNames(tableName, 2026, 4, 12);
          }
          return buildPartitionNames(tableName, 2026, 3, 13);
        }
        if (sql.includes('check_default')) return [];
        return [];
      });

      const result = await service.check();

      expect(result.healthy).toBe(false);
      expect(result.tables.audit_trail.currentMonthExists).toBe(false);
      expect(result.tables.root_logs.currentMonthExists).toBe(true);
    });

    it('should fail when future months are insufficient', async () => {
      mockDb.queryOne.mockImplementation(async (sql: string) => {
        if (sql.includes('pg_extension')) return { extversion: '5.4.3' };
        if (sql.includes('part_config')) return { premake: 12 };
        return null;
      });
      mockDb.query.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes('pg_inherits')) {
          return buildPartitionNames(params?.[0] as string, 2026, 3, 7);
        }
        if (sql.includes('check_default')) return [];
        return [];
      });

      const result = await service.check();

      expect(result.healthy).toBe(false);
      expect(result.tables.audit_trail.futureMonthsCovered).toBe(6);
      expect(result.tables.audit_trail.expectedFutureMonths).toBe(12);
    });

    it('should return unhealthy on database error', async () => {
      mockDb.queryOne.mockRejectedValue(new Error('connection refused'));

      const result = await service.check();

      expect(result.healthy).toBe(false);
      expect(result.extension.installed).toBe(false);
    });
  });

  // =============================================================
  // check — default partitions
  // =============================================================

  describe('check — defaults', () => {
    it('should report defaultEmpty false when check_default finds data', async () => {
      mockDb.queryOne.mockImplementation(async (sql: string) => {
        if (sql.includes('pg_extension')) return { extversion: '5.4.3' };
        if (sql.includes('part_config')) return { premake: 12 };
        return null;
      });
      mockDb.query.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes('pg_inherits')) {
          return buildPartitionNames(params?.[0] as string, 2026, 3, 13);
        }
        if (sql.includes('check_default')) {
          return [{ parent_table: 'public.audit_trail', count: '5' }];
        }
        return [];
      });

      const result = await service.check();

      expect(result.healthy).toBe(true);
      expect(result.tables.audit_trail.defaultEmpty).toBe(false);
      expect(result.tables.root_logs.defaultEmpty).toBe(true);
    });
  });

  // =============================================================
  // check — year boundary
  // =============================================================

  describe('check — year boundary', () => {
    it('should generate correct names when months cross year boundary', async () => {
      vi.setSystemTime(new Date(Date.UTC(2026, 10, 15))); // November 2026

      const queriedNames: string[] = [];

      mockDb.queryOne.mockImplementation(async (sql: string) => {
        if (sql.includes('pg_extension')) return { extversion: '5.4.3' };
        if (sql.includes('part_config')) return { premake: 12 };
        return null;
      });
      mockDb.query.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes('pg_inherits')) {
          const tableName = params?.[0] as string;
          const partitions = buildPartitionNames(tableName, 2026, 11, 13);
          if (tableName === 'audit_trail') {
            queriedNames.push(
              ...partitions.map((p: { partition_name: string }) => p.partition_name),
            );
          }
          return partitions;
        }
        if (sql.includes('check_default')) return [];
        return [];
      });

      const result = await service.check();

      expect(result.healthy).toBe(true);
      expect(queriedNames).toContain('audit_trail_p20261101');
      expect(queriedNames).toContain('audit_trail_p20261201');
      expect(queriedNames).toContain('audit_trail_p20270101');
      expect(queriedNames).toContain('audit_trail_p20271101');
    });
  });

  // =============================================================
  // check — bgw.configured derivation
  // =============================================================

  describe('check — bgw', () => {
    it('should derive configured=true when both tables are registered', async () => {
      setupHealthyMocks();

      const result = await service.check();

      expect(result.bgw.configured).toBe(true);
    });

    it('should derive configured=false when extension is missing', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await service.check();

      expect(result.bgw.configured).toBe(false);
    });
  });

  // =============================================================
  // check — premake value forwarding
  // =============================================================

  describe('check — premake', () => {
    it('should use premake from part_config for expected future months', async () => {
      mockDb.queryOne.mockImplementation(async (sql: string) => {
        if (sql.includes('pg_extension')) return { extversion: '5.4.3' };
        if (sql.includes('part_config')) return { premake: 6 };
        return null;
      });
      mockDb.query.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes('pg_inherits')) {
          return buildPartitionNames(params?.[0] as string, 2026, 3, 7);
        }
        if (sql.includes('check_default')) return [];
        return [];
      });

      const result: PartitionHealthResult = await service.check();

      expect(result.healthy).toBe(true);
      expect(result.tables.audit_trail.premake).toBe(6);
      expect(result.tables.audit_trail.expectedFutureMonths).toBe(6);
      expect(result.tables.audit_trail.futureMonthsCovered).toBe(6);
    });
  });
});
