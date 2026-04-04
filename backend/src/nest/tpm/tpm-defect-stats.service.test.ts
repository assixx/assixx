/**
 * Unit tests for TpmDefectStatsService (Mängelgrafik)
 *
 * Mocked dependencies: DatabaseService (query, queryOne).
 * Tests: getDefectStats — weekly aggregation, baselines, cumulative sums, edge cases.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TpmDefectStatsService } from './tpm-defect-stats.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const qf = vi.fn();
  const qof = vi.fn();
  return {
    query: qf,
    tenantQuery: qf,
    queryOne: qof,
    tenantQueryOne: qof,
  };
}
type MockDb = ReturnType<typeof createMockDb>;

// =============================================================
// TpmDefectStatsService
// =============================================================

describe('TpmDefectStatsService', () => {
  let service: TpmDefectStatsService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new TpmDefectStatsService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // getDefectStats
  // =============================================================

  describe('getDefectStats()', () => {
    const TENANT_ID = 1;
    const PLAN_UUID = '019d36c6-a20a-748e-8457-60d0773ad74d';
    const YEAR = 2026;

    function setupMocks(overrides?: {
      planRow?: { name: string; asset_name: string } | null;
      detected?: { week: string; count: string }[];
      resolved?: { week: string; count: string }[];
      baseDetected?: { count: string } | null;
      baseResolved?: { count: string } | null;
      years?: { year: string }[];
    }): void {
      const opts = overrides ?? {};

      // queryOne: 1st call = plan info, 3rd = base detected, 4th = base resolved
      mockDb.queryOne
        .mockResolvedValueOnce(opts.planRow ?? { name: 'Testplan', asset_name: 'Säge 17' })
        .mockResolvedValueOnce(opts.baseDetected ?? { count: '0' })
        .mockResolvedValueOnce(opts.baseResolved ?? { count: '0' });

      // query: 1st call = detected weeks, 2nd = resolved weeks, 3rd = available years
      mockDb.query
        .mockResolvedValueOnce(opts.detected ?? [])
        .mockResolvedValueOnce(opts.resolved ?? [])
        .mockResolvedValueOnce(opts.years ?? []);
    }

    it('should return 52 weeks with all zeros when no defects exist', async () => {
      setupMocks();

      const result = await service.getDefectStats(TENANT_ID, PLAN_UUID, YEAR);

      expect(result.year).toBe(YEAR);
      expect(result.assetName).toBe('Säge 17');
      expect(result.planName).toBe('Testplan');
      expect(result.weeks).toHaveLength(52);
      expect(result.baseDetected).toBe(0);
      expect(result.baseResolved).toBe(0);
      expect(result.totalDetected).toBe(0);
      expect(result.totalResolved).toBe(0);
    });

    it('should calculate cumulative sums correctly', async () => {
      setupMocks({
        detected: [
          { week: '3', count: '2' },
          { week: '7', count: '5' },
        ],
        resolved: [{ week: '5', count: '1' }],
      });

      const result = await service.getDefectStats(TENANT_ID, PLAN_UUID, YEAR);

      // Week 3: cumDetected=2, cumResolved=0
      expect(result.weeks[2]).toEqual({
        week: 3,
        detected: 2,
        resolved: 0,
        cumulativeDetected: 2,
        cumulativeResolved: 0,
      });

      // Week 5: cumDetected=2, cumResolved=1
      expect(result.weeks[4]).toEqual({
        week: 5,
        detected: 0,
        resolved: 1,
        cumulativeDetected: 2,
        cumulativeResolved: 1,
      });

      // Week 7: cumDetected=7, cumResolved=1
      expect(result.weeks[6]).toEqual({
        week: 7,
        detected: 5,
        resolved: 0,
        cumulativeDetected: 7,
        cumulativeResolved: 1,
      });

      expect(result.totalDetected).toBe(7);
      expect(result.totalResolved).toBe(1);
    });

    it('should include baselines from previous years', async () => {
      setupMocks({
        baseDetected: { count: '245' },
        baseResolved: { count: '240' },
        detected: [{ week: '1', count: '3' }],
        resolved: [{ week: '1', count: '1' }],
      });

      const result = await service.getDefectStats(TENANT_ID, PLAN_UUID, YEAR);

      expect(result.baseDetected).toBe(245);
      expect(result.baseResolved).toBe(240);

      // Week 1: base + this week's data
      expect(result.weeks[0]!.cumulativeDetected).toBe(248);
      expect(result.weeks[0]!.cumulativeResolved).toBe(241);

      // Week 52: same as week 1 (no further data)
      expect(result.weeks[51]!.cumulativeDetected).toBe(248);
      expect(result.weeks[51]!.cumulativeResolved).toBe(241);
    });

    it('should include current year in availableYears even if no data', async () => {
      setupMocks({ years: [] });

      const result = await service.getDefectStats(TENANT_ID, PLAN_UUID, YEAR);

      expect(result.availableYears).toContain(YEAR);
    });

    it('should sort availableYears ascending', async () => {
      setupMocks({
        years: [{ year: '2025' }, { year: '2024' }],
      });

      const result = await service.getDefectStats(TENANT_ID, PLAN_UUID, YEAR);

      expect(result.availableYears).toEqual([2024, 2025, 2026]);
    });

    it('should throw NotFoundException when plan does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.getDefectStats(TENANT_ID, PLAN_UUID, YEAR)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle null baseline counts gracefully', async () => {
      setupMocks({
        baseDetected: null,
        baseResolved: null,
      });

      const result = await service.getDefectStats(TENANT_ID, PLAN_UUID, YEAR);

      expect(result.baseDetected).toBe(0);
      expect(result.baseResolved).toBe(0);
    });

    it('should not duplicate current year in availableYears', async () => {
      setupMocks({
        years: [{ year: '2026' }],
      });

      const result = await service.getDefectStats(TENANT_ID, PLAN_UUID, YEAR);

      const yearOccurrences = result.availableYears.filter((y: number) => y === YEAR);
      expect(yearOccurrences).toHaveLength(1);
    });
  });
});
