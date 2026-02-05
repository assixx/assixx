/**
 * Unit tests for BlackboardArchiveService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Cron-triggered archival, error resilience,
 *        manual trigger, zero-count path.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { BlackboardArchiveService } from './blackboard-archive.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

// =============================================================
// BlackboardArchiveService
// =============================================================

describe('BlackboardArchiveService', () => {
  let service: BlackboardArchiveService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new BlackboardArchiveService(
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // onModuleInit
  // =============================================================

  describe('onModuleInit', () => {
    it('should archive expired entries on startup', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      await service.onModuleInit();

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // archiveAtMidnight / archiveBackup
  // =============================================================

  describe('archiveAtMidnight', () => {
    it('should archive entries', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '3' }]);

      await service.archiveAtMidnight();

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('archiveBackup', () => {
    it('should archive entries as backup', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      await service.archiveBackup();

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // archiveExpiredEntriesManual
  // =============================================================

  describe('archiveExpiredEntriesManual', () => {
    it('should return archived count', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '5' }]);

      const result = await service.archiveExpiredEntriesManual();

      expect(result.archivedCount).toBe(5);
    });

    it('should return 0 when nothing to archive', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.archiveExpiredEntriesManual();

      expect(result.archivedCount).toBe(0);
    });
  });

  // =============================================================
  // Error handling
  // =============================================================

  describe('error handling', () => {
    it('should not throw on DB error in cron', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB down'));

      await expect(service.archiveAtMidnight()).resolves.toBeUndefined();
    });
  });
});
