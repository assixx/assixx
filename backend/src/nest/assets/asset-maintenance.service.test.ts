/**
 * Unit tests for AssetMaintenanceService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Maintenance history, add record (+ asset status update),
 *        upcoming maintenance, statistics aggregation, categories.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { InternalServerErrorException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { AssetMaintenanceService } from './asset-maintenance.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./assets.helpers.js', () => ({
  buildMaintenanceInsertParams: vi
    .fn()
    .mockReturnValue([
      10,
      1,
      'preventive',
      '2025-06-01',
      5,
      null,
      'Oil change',
      null,
      100,
      2,
      'operational',
      null,
      null,
      1,
    ]),
  hasContent: vi.fn((v: unknown) => typeof v === 'string' && v !== ''),
  mapDbAssetToApi: vi.fn((row: Record<string, unknown>) => ({
    id: row['id'],
    name: row['name'],
    status: row['status'],
  })),
  mapMaintenanceToApi: vi.fn((row: Record<string, unknown>) => ({
    id: row['id'],
    maintenanceType: row['maintenance_type'],
    performedDate: row['performed_date'],
  })),
  parseIntOrZero: vi.fn((v: unknown) => {
    if (typeof v === 'string') return Number.parseInt(v, 10);
    return typeof v === 'number' ? v : 0;
  }),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
  };
}

function createMockActivityLogger() {
  return {
    log: vi.fn(),
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  };
}

// =============================================================
// AssetMaintenanceService
// =============================================================

describe('AssetMaintenanceService', () => {
  let service: AssetMaintenanceService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    const mockActivityLogger = createMockActivityLogger();
    service = new AssetMaintenanceService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // getMaintenanceHistory
  // =============================================================

  describe('getMaintenanceHistory', () => {
    it('should return mapped history', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 1, maintenance_type: 'preventive', performed_date: '2025-06-01' },
      ]);

      const result = await service.getMaintenanceHistory(1, 10);

      expect(result).toHaveLength(1);
    });
  });

  // =============================================================
  // addMaintenanceRecord
  // =============================================================

  describe('addMaintenanceRecord', () => {
    it('should throw InternalServerErrorException on insert failure', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.addMaintenanceRecord({ assetId: 1, performedDate: '2025-06-01' } as never, 10, 1),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should add record and update asset status', async () => {
      // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);
      // UPDATE asset
      mockDb.query.mockResolvedValueOnce([]);
      // getMaintenanceHistory (re-fetch)
      mockDb.query.mockResolvedValueOnce([
        { id: 5, maintenance_type: 'preventive', performed_date: '2025-06-01' },
      ]);

      const result = await service.addMaintenanceRecord(
        { assetId: 1, performedDate: '2025-06-01' } as never,
        10,
        1,
      );

      expect(result.id).toBe(5);
    });

    it('should set repair status when statusAfter is needs_repair', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 6 }]); // INSERT
      mockDb.query.mockResolvedValueOnce([]); // UPDATE asset
      mockDb.query.mockResolvedValueOnce([
        { id: 6, maintenance_type: 'corrective', performed_date: '2025-07-01' },
      ]); // history

      const result = await service.addMaintenanceRecord(
        {
          assetId: 2,
          performedDate: '2025-07-01',
          maintenanceType: 'corrective',
          statusAfter: 'needs_repair',
          nextMaintenanceDate: '2025-08-01',
        } as never,
        10,
        1,
      );

      expect(result.id).toBe(6);
      // UPDATE asset called with 'repair' status and nextDate
      const updateCall = mockDb.query.mock.calls[1] as [string, unknown[]];
      expect(updateCall[1]?.[2]).toBe('repair');
      expect(updateCall[1]?.[1]).toEqual(new Date('2025-08-01'));
    });
  });

  // =============================================================
  // getUpcomingMaintenance
  // =============================================================

  describe('getUpcomingMaintenance', () => {
    it('should return mapped assets needing maintenance', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1, name: 'CNC-001', status: 'operational' }]);

      const result = await service.getUpcomingMaintenance(10, 30);

      expect(result).toHaveLength(1);
    });
  });

  // =============================================================
  // getStatistics
  // =============================================================

  describe('getStatistics', () => {
    it('should return zero stats when no assets', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getStatistics(10);

      expect(result.totalAssets).toBe(0);
      expect(result.operational).toBe(0);
    });

    it('should return aggregated stats', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        total_assets: '10',
        operational: '7',
        in_maintenance: '1',
        in_repair: '1',
        standby: '1',
        decommissioned: '0',
        needs_maintenance_soon: '2',
      });

      const result = await service.getStatistics(10);

      expect(result.totalAssets).toBe(10);
      expect(result.operational).toBe(7);
      expect(result.needsMaintenanceSoon).toBe(2);
    });
  });

  // =============================================================
  // getCategories
  // =============================================================

  describe('getCategories', () => {
    it('should return mapped categories', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          name: 'CNC Assets',
          sort_order: 1,
          is_active: IS_ACTIVE.ACTIVE,
          description: 'Computer numerically controlled',
          icon: 'cnc',
        },
      ]);

      const result = await service.getCategories();

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('CNC Assets');
      expect(result[0]?.description).toBe('Computer numerically controlled');
    });

    it('should omit description and icon when null', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 2,
          name: 'Pumps',
          sort_order: 2,
          is_active: IS_ACTIVE.ACTIVE,
          description: null,
          icon: null,
        },
      ]);

      const result = await service.getCategories();

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Pumps');
      expect(result[0]).not.toHaveProperty('description');
      expect(result[0]).not.toHaveProperty('icon');
    });
  });
});
