/**
 * Unit tests for ShiftSwapService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: List with filters, create swap, update status (NotFoundException).
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { ShiftSwapService } from './shift-swap.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('../../utils/fieldMapper.js', () => ({
  dbToApi: vi.fn((row: Record<string, unknown>) => ({ ...row })),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

// =============================================================
// ShiftSwapService
// =============================================================

describe('ShiftSwapService', () => {
  let service: ShiftSwapService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new ShiftSwapService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // listSwapRequests
  // =============================================================

  describe('listSwapRequests', () => {
    it('should return mapped requests', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 1, status: 'pending', requested_by: 5 },
      ]);

      const result = await service.listSwapRequests(10, {});

      expect(result).toHaveLength(1);
    });

    it('should apply userId filter', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.listSwapRequests(10, { userId: 5 });

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall?.[0]).toContain('requested_by');
      expect(queryCall?.[1]).toContain(5);
    });

    it('should apply status filter', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.listSwapRequests(10, { status: 'approved' });

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall?.[0]).toContain('status');
    });
  });

  // =============================================================
  // createSwapRequest
  // =============================================================

  describe('createSwapRequest', () => {
    it('should create and return swap request', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service.createSwapRequest(
        { shiftId: 1, reason: 'Vacation' } as never,
        10,
        5,
      );

      expect(result.id).toBe(42);
      expect(result.status).toBe('pending');
      expect(result.message).toBe('Swap request created successfully');
    });
  });

  // =============================================================
  // updateSwapRequestStatus
  // =============================================================

  describe('updateSwapRequestStatus', () => {
    it('should throw NotFoundException when not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.updateSwapRequestStatus(
          999,
          { status: 'approved' } as never,
          10,
          1,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update status', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1, status: 'pending' }]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.updateSwapRequestStatus(
        1,
        { status: 'approved' } as never,
        10,
        1,
      );

      expect(result.message).toContain('approved');
    });
  });
});
