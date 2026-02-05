/**
 * Unit tests for MachineMaintenanceService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Maintenance history, add record (+ machine status update),
 *        upcoming maintenance, statistics aggregation, categories.
 */
import { InternalServerErrorException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { MachineMaintenanceService } from './machine-maintenance.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./machines.helpers.js', () => ({
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
  mapDbMachineToApi: vi.fn((row: Record<string, unknown>) => ({
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

// =============================================================
// MachineMaintenanceService
// =============================================================

describe('MachineMaintenanceService', () => {
  let service: MachineMaintenanceService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new MachineMaintenanceService(
      mockDb as unknown as DatabaseService,
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
        service.addMaintenanceRecord(
          { machineId: 1, performedDate: '2025-06-01' } as never,
          10,
          1,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should add record and update machine status', async () => {
      // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);
      // UPDATE machine
      mockDb.query.mockResolvedValueOnce([]);
      // getMaintenanceHistory (re-fetch)
      mockDb.query.mockResolvedValueOnce([
        { id: 5, maintenance_type: 'preventive', performed_date: '2025-06-01' },
      ]);

      const result = await service.addMaintenanceRecord(
        { machineId: 1, performedDate: '2025-06-01' } as never,
        10,
        1,
      );

      expect(result.id).toBe(5);
    });
  });

  // =============================================================
  // getUpcomingMaintenance
  // =============================================================

  describe('getUpcomingMaintenance', () => {
    it('should return mapped machines needing maintenance', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 1, name: 'CNC-001', status: 'operational' },
      ]);

      const result = await service.getUpcomingMaintenance(10, 30);

      expect(result).toHaveLength(1);
    });
  });

  // =============================================================
  // getStatistics
  // =============================================================

  describe('getStatistics', () => {
    it('should return zero stats when no machines', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getStatistics(10);

      expect(result.totalMachines).toBe(0);
      expect(result.operational).toBe(0);
    });

    it('should return aggregated stats', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        total_machines: '10',
        operational: '7',
        in_maintenance: '1',
        in_repair: '1',
        standby: '1',
        decommissioned: '0',
        needs_maintenance_soon: '2',
      });

      const result = await service.getStatistics(10);

      expect(result.totalMachines).toBe(10);
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
          name: 'CNC Machines',
          sort_order: 1,
          is_active: 1,
          description: 'Computer numerically controlled',
          icon: 'cnc',
        },
      ]);

      const result = await service.getCategories();

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('CNC Machines');
      expect(result[0]?.description).toBe('Computer numerically controlled');
    });
  });
});
