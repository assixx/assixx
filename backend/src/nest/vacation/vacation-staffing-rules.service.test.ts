/**
 * Vacation Staffing Rules Service – Unit Tests (Phase 3, Session 14)
 *
 * Mocked dependency: DatabaseService (tenantTransaction).
 * Tests: CRUD, getForAssets (bulk query), ConflictException on duplicate.
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { VacationStaffingRulesService } from './vacation-staffing-rules.service.js';
import type { VacationStaffingRuleRow } from './vacation.types.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return { log: vi.fn().mockResolvedValue(undefined) };
}

/** Extended row with asset_name from JOIN */
interface StaffingRuleWithAssetRow extends VacationStaffingRuleRow {
  asset_name: string | null;
}

function createMockStaffingRuleRow(
  overrides?: Partial<StaffingRuleWithAssetRow>,
): StaffingRuleWithAssetRow {
  return {
    id: 'sr-001',
    tenant_id: 1,
    asset_id: 100,
    min_staff_count: 2,
    is_active: IS_ACTIVE.ACTIVE,
    created_by: 10,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    asset_name: 'CNC Mill',
    ...overrides,
  };
}

// =============================================================
// Test Suite
// =============================================================

describe('VacationStaffingRulesService', () => {
  let service: VacationStaffingRulesService;
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

    service = new VacationStaffingRulesService(
      mockDb as unknown as DatabaseService,
      createMockActivityLogger() as unknown as ActivityLoggerService,
    );
  });

  // -----------------------------------------------------------
  // getStaffingRules
  // -----------------------------------------------------------

  describe('getStaffingRules()', () => {
    it('should return mapped staffing rules', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockStaffingRuleRow()],
      });

      const result = await service.getStaffingRules(1);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('sr-001');
      expect(result[0]?.assetId).toBe(100);
      expect(result[0]?.minStaffCount).toBe(2);
      expect(result[0]?.assetName).toBe('CNC Mill');
    });

    it('should return empty array when no rules exist', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getStaffingRules(1);

      expect(result).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------
  // createStaffingRule
  // -----------------------------------------------------------

  describe('createStaffingRule()', () => {
    it('should create and return a staffing rule', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockStaffingRuleRow()],
      });

      const result = await service.createStaffingRule(1, 10, {
        assetId: 100,
        minStaffCount: 2,
      });

      expect(result.assetId).toBe(100);
      expect(result.minStaffCount).toBe(2);
      expect(result.assetName).toBe('CNC Mill');
    });

    it('should throw ConflictException on duplicate asset (23505)', async () => {
      const pgError = new Error('unique_violation');
      (pgError as unknown as { code: string }).code = '23505';
      mockClient.query.mockRejectedValueOnce(pgError);

      await expect(
        service.createStaffingRule(1, 10, {
          assetId: 100,
          minStaffCount: 2,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // -----------------------------------------------------------
  // updateStaffingRule
  // -----------------------------------------------------------

  describe('updateStaffingRule()', () => {
    it('should update and return updated rule', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockStaffingRuleRow({ min_staff_count: 3 })],
      });

      const result = await service.updateStaffingRule(1, 10, 'sr-001', {
        minStaffCount: 3,
      });

      expect(result.minStaffCount).toBe(3);
    });

    it('should throw NotFoundException when rule not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateStaffingRule(1, 10, 'nonexistent', { minStaffCount: 3 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------
  // deleteStaffingRule
  // -----------------------------------------------------------

  describe('deleteStaffingRule()', () => {
    it('should soft-delete successfully', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'sr-001', asset_id: 100, min_staff_count: 2 }],
      });

      await expect(
        service.deleteStaffingRule(1, 10, 'sr-001'),
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when rule not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.deleteStaffingRule(1, 10, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------
  // getForAssets — bulk query
  // -----------------------------------------------------------

  describe('getForAssets()', () => {
    it('should return Map of assetId → minStaffCount', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { asset_id: 100, min_staff_count: 2 },
          { asset_id: 200, min_staff_count: 3 },
        ],
      });

      const result = await service.getForAssets(1, [100, 200]);

      expect(result).toBeInstanceOf(Map);
      expect(result.get(100)).toBe(2);
      expect(result.get(200)).toBe(3);
      expect(result.size).toBe(2);
    });

    it('should return empty Map for empty assetIds array', async () => {
      const result = await service.getForAssets(1, []);

      expect(result.size).toBe(0);
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
    });

    it('should build parameterized IN clause for multiple assets', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.getForAssets(1, [100, 200, 300]);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('$2, $3, $4'),
        [1, 100, 200, 300],
      );
    });

    it('should return partial Map when some assets have no rules', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ asset_id: 100, min_staff_count: 2 }],
      });

      const result = await service.getForAssets(1, [100, 200]);

      expect(result.size).toBe(1);
      expect(result.has(100)).toBe(true);
      expect(result.has(200)).toBe(false);
    });
  });
});
