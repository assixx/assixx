/**
 * Unit tests for TpmTimeEstimatesService
 *
 * Mocked dependencies: DatabaseService (query, queryOne, tenantTransaction).
 * Tests: setEstimate (UPSERT, plan resolution, totalMinutes),
 * getEstimatesForPlan, getEstimateForInterval, deleteEstimate (soft-delete).
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { TpmTimeEstimatesService } from './tpm-time-estimates.service.js';
import type { TpmTimeEstimateRow } from './tpm.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createEstimateRow(
  overrides?: Partial<TpmTimeEstimateRow>,
): TpmTimeEstimateRow {
  return {
    id: 1,
    uuid: 'est-uuid-001                           ',
    tenant_id: 10,
    plan_id: 5,
    interval_type: 'weekly',
    staff_count: 2,
    preparation_minutes: 10,
    execution_minutes: 30,
    followup_minutes: 5,
    is_active: 1,
    created_at: '2026-02-18T00:00:00.000Z',
    updated_at: '2026-02-18T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================
// TpmTimeEstimatesService
// =============================================================

const mockActivityLogger = {
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue(undefined),
};

describe('TpmTimeEstimatesService', () => {
  let service: TpmTimeEstimatesService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new TpmTimeEstimatesService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // setEstimate
  // =============================================================

  describe('setEstimate()', () => {
    it('should UPSERT a time estimate and return mapped result', async () => {
      // resolvePlanId
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 5 }],
      });
      // UPSERT RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [createEstimateRow()],
      });

      const result = await service.setEstimate(10, 1, {
        planUuid: 'plan-uuid-001',
        intervalType: 'weekly',
        staffCount: 2,
        preparationMinutes: 10,
        executionMinutes: 30,
        followupMinutes: 5,
      });

      expect(result.intervalType).toBe('weekly');
      expect(result.staffCount).toBe(2);
      expect(result.preparationMinutes).toBe(10);
      expect(result.executionMinutes).toBe(30);
      expect(result.followupMinutes).toBe(5);
    });

    it('should compute totalMinutes as sum of preparation + execution + followup', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createEstimateRow({
            preparation_minutes: 15,
            execution_minutes: 45,
            followup_minutes: 10,
          }),
        ],
      });

      const result = await service.setEstimate(10, 1, {
        planUuid: 'plan-uuid-001',
        intervalType: 'monthly',
        staffCount: 1,
        preparationMinutes: 15,
        executionMinutes: 45,
        followupMinutes: 10,
      });

      expect(result.totalMinutes).toBe(70); // 15 + 45 + 10
    });

    it('should throw NotFoundException when plan UUID not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.setEstimate(10, 1, {
          planUuid: 'nonexistent',
          intervalType: 'daily',
          staffCount: 1,
          preparationMinutes: 5,
          executionMinutes: 10,
          followupMinutes: 0,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when UPSERT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.setEstimate(10, 1, {
          planUuid: 'plan-uuid-001',
          intervalType: 'daily',
          staffCount: 1,
          preparationMinutes: 5,
          executionMinutes: 10,
          followupMinutes: 0,
        }),
      ).rejects.toThrow('UPSERT tpm_time_estimates returned no rows');
    });
  });

  // =============================================================
  // getEstimatesForPlan
  // =============================================================

  describe('getEstimatesForPlan()', () => {
    it('should return mapped estimates for a plan', async () => {
      mockDb.query.mockResolvedValueOnce([
        createEstimateRow({ interval_type: 'daily' }),
        createEstimateRow({ id: 2, interval_type: 'weekly' }),
      ]);

      const result = await service.getEstimatesForPlan(10, 'plan-uuid-001');

      expect(result).toHaveLength(2);
      expect(result[0]?.intervalType).toBe('daily');
      expect(result[1]?.intervalType).toBe('weekly');
    });

    it('should return empty array when no estimates exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getEstimatesForPlan(10, 'plan-uuid-001');

      expect(result).toHaveLength(0);
    });
  });

  // =============================================================
  // getEstimateForInterval
  // =============================================================

  describe('getEstimateForInterval()', () => {
    it('should return a single estimate for plan+interval', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createEstimateRow());

      const result = await service.getEstimateForInterval(
        10,
        'plan-uuid-001',
        'weekly',
      );

      expect(result).not.toBeNull();
      expect(result?.intervalType).toBe('weekly');
      expect(result?.totalMinutes).toBe(45); // 10 + 30 + 5
    });

    it('should return null when no estimate found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getEstimateForInterval(
        10,
        'plan-uuid-001',
        'annual',
      );

      expect(result).toBeNull();
    });
  });

  // =============================================================
  // deleteEstimate
  // =============================================================

  describe('deleteEstimate()', () => {
    it('should soft-delete an estimate (is_active = 4)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      });

      await expect(
        service.deleteEstimate(10, 1, 'est-uuid-001'),
      ).resolves.toBeUndefined();

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('is_active = 4');
    });

    it('should throw NotFoundException when estimate not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.deleteEstimate(10, 1, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // UUID trimming
  // =============================================================

  describe('UUID trimming', () => {
    it('should trim whitespace from uuid in mapped result', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createEstimateRow({ uuid: '  abc-def-123   ' }),
      );

      const result = await service.getEstimateForInterval(
        10,
        'plan-uuid-001',
        'weekly',
      );

      expect(result?.uuid).toBe('abc-def-123');
    });
  });
});
