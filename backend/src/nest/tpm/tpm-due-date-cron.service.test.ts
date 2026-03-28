/**
 * Unit tests for TpmDueDateCronService
 *
 * Covers: processDueCards (finds due groups, triggers cascade per asset),
 * isProcessing guard (prevents parallel runs), error handling.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { TpmCardCascadeService } from './tpm-card-cascade.service.js';
import { TpmDueDateCronService } from './tpm-due-date-cron.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    transaction: vi.fn(),
  };
}

function createMockCascade() {
  return {
    triggerCascade: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;
type MockCascade = ReturnType<typeof createMockCascade>;

// =============================================================
// TpmDueDateCronService
// =============================================================

describe('TpmDueDateCronService', () => {
  let service: TpmDueDateCronService;
  let mockDb: MockDb;
  let mockCascade: MockCascade;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockCascade = createMockCascade();

    service = new TpmDueDateCronService(
      mockDb as unknown as DatabaseService,
      mockCascade as unknown as TpmCardCascadeService,
    );
  });

  describe('handleMorningCheck()', () => {
    it('should do nothing when no due cards found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.handleMorningCheck();

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should trigger cascade for each asset group', async () => {
      mockDb.query.mockResolvedValueOnce([
        { tenant_id: 10, asset_id: 1, max_interval_order: 3 },
        { tenant_id: 10, asset_id: 2, max_interval_order: 6 },
      ]);

      // transaction calls: each returns void
      mockDb.transaction.mockImplementation(async (fn: (client: unknown) => Promise<void>) => {
        await fn({});
      });
      mockCascade.triggerCascade.mockResolvedValue({ affectedCount: 2 });

      await service.handleMorningCheck();

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.transaction).toHaveBeenCalledTimes(2);
      expect(mockCascade.triggerCascade).toHaveBeenCalledTimes(2);
    });

    it('should use correct GROUP BY query', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.handleMorningCheck();

      const queryCall = mockDb.query.mock.calls[0];
      const sql = queryCall[0] as string;
      expect(sql).toContain('GROUP BY tenant_id, asset_id');
      expect(sql).toContain('MAX(interval_order)');
      expect(sql).toContain("status = 'green'");
      expect(sql).toContain('current_due_date <= CURRENT_DATE');
    });

    it('should continue processing if one group fails', async () => {
      mockDb.query.mockResolvedValueOnce([
        { tenant_id: 10, asset_id: 1, max_interval_order: 3 },
        { tenant_id: 10, asset_id: 2, max_interval_order: 6 },
      ]);

      // First group fails, second succeeds
      mockDb.transaction
        .mockRejectedValueOnce(new Error('DB error'))
        .mockImplementation(async (fn: (client: unknown) => Promise<void>) => {
          await fn({});
        });
      mockCascade.triggerCascade.mockResolvedValue({ affectedCount: 1 });

      await service.handleMorningCheck();

      // Should still attempt second group
      expect(mockDb.transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleEveningCheck()', () => {
    it('should call same logic as morning check', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.handleEveningCheck();

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });
});
