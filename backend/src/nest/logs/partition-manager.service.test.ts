/**
 * Unit tests for PartitionManagerService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Partition creation (idempotent), cron guard,
 *        partitionExists check, listPartitions, getPartitionStats.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PartitionManagerService } from './partition-manager.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockPool() {
  return {
    query: vi.fn(),
  };
}

// =============================================================
// PartitionManagerService
// =============================================================

describe('PartitionManagerService', () => {
  let service: PartitionManagerService;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = createMockPool();
    service = new PartitionManagerService(mockPool as never);
  });

  // =============================================================
  // onModuleInit
  // =============================================================

  describe('onModuleInit', () => {
    it('should disable partitioning when table is not partitioned', async () => {
      // checkPartitioningEnabled: relkind = 'r' (regular table)
      mockPool.query.mockResolvedValueOnce({
        rows: [{ relkind: 'r' }],
      });

      await service.onModuleInit();

      // handlePartitionCron should do nothing
      await service.handlePartitionCron();
      // Only 1 query (the check), no partition creation
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should enable and create partitions when table is partitioned', async () => {
      // checkPartitioningEnabled: relkind = 'p'
      mockPool.query.mockResolvedValueOnce({
        rows: [{ relkind: 'p' }],
      });

      // createUpcomingPartitions: 4 months × 2 tables = 8 partitionExists checks
      // Each partitionExists returns false → then CREATE TABLE
      for (let i = 0; i < 8; i++) {
        // partitionExists check
        mockPool.query.mockResolvedValueOnce({ rows: [{ exists: false }] });
        // CREATE TABLE
        mockPool.query.mockResolvedValueOnce({ rows: [] });
      }

      await service.onModuleInit();

      // 1 (check) + 8 × 2 (exists + create) = 17 queries
      expect(mockPool.query).toHaveBeenCalledTimes(17);
    });

    it('should skip existing partitions', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ relkind: 'p' }],
      });

      // All partitions already exist
      for (let i = 0; i < 8; i++) {
        mockPool.query.mockResolvedValueOnce({ rows: [{ exists: true }] });
      }

      await service.onModuleInit();

      // 1 (check) + 8 (exists only, no CREATE) = 9
      expect(mockPool.query).toHaveBeenCalledTimes(9);
    });

    it('should handle check error gracefully', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('DB down'));

      await service.onModuleInit();

      // Partitioning disabled, no further queries
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // handlePartitionCron
  // =============================================================

  describe('handlePartitionCron', () => {
    it('should do nothing when partitioning is disabled', async () => {
      // Init with non-partitioned table
      mockPool.query.mockResolvedValueOnce({ rows: [{ relkind: 'r' }] });
      await service.onModuleInit();
      vi.clearAllMocks();

      await service.handlePartitionCron();

      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  // =============================================================
  // listPartitions
  // =============================================================

  describe('listPartitions', () => {
    it('should return partition names', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { partition_name: 'audit_trail_2025_01' },
          { partition_name: 'audit_trail_2025_02' },
        ],
      });

      const result = await service.listPartitions('audit_trail');

      expect(result).toEqual([
        'audit_trail_2025_01',
        'audit_trail_2025_02',
      ]);
    });
  });

  // =============================================================
  // getPartitionStats
  // =============================================================

  describe('getPartitionStats', () => {
    it('should return stats for all partitioned tables', async () => {
      // audit_trail listPartitions
      mockPool.query.mockResolvedValueOnce({
        rows: [{ partition_name: 'audit_trail_2025_01' }],
      });
      // audit_trail count
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: '1000' }],
      });
      // root_logs listPartitions
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });
      // root_logs count
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

      const result = await service.getPartitionStats();

      expect(result).toHaveLength(2);
      expect(result[0]?.tableName).toBe('audit_trail');
      expect(result[0]?.partitionCount).toBe(1);
      expect(result[0]?.totalRows).toBe(1000);
      expect(result[1]?.tableName).toBe('root_logs');
      expect(result[1]?.totalRows).toBe(0);
      expect(result[1]?.oldestPartition).toBeNull();
    });
  });
});
