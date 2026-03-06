/**
 * Unit tests for WorkOrderStatusService
 *
 * Mocked dependencies: DatabaseService (tenantTransaction),
 * ActivityLoggerService (logUpdate).
 *
 * Tests: updateStatus (valid transitions, NotFoundException, BadRequestException,
 * auto-comment with is_status_change, completed_at logic),
 * verifyWorkOrder (happy path, verified_at/verified_by, NotFoundException,
 * BadRequestException when not completed).
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 * Call order per updateStatus: lockAndValidate → applyStatusUpdate → insertStatusComment.
 * Call order per verifyWorkOrder: lockAndValidate → direct UPDATE → insertStatusComment.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { WorkOrderStatusService } from './work-orders-status.service.js';
import type { WorkOrderStatus } from './work-orders.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return {
    logUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

function createWorkOrderRow(
  overrides?: Partial<{ id: number; status: WorkOrderStatus; title: string }>,
) {
  return {
    id: 42,
    status: 'open' as WorkOrderStatus,
    title: 'Defekte Dichtung ersetzen',
    ...overrides,
  };
}

// =============================================================
// WorkOrderStatusService
// =============================================================

describe('WorkOrderStatusService', () => {
  let service: WorkOrderStatusService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;

  const TENANT_ID = 10;
  const USER_ID = 7;
  const ADMIN_USER_ID = 3;
  const WO_UUID = '01935a2b-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    mockActivityLogger = createMockActivityLogger();

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new WorkOrderStatusService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // updateStatus
  // =============================================================

  describe('updateStatus()', () => {
    // ---- Happy paths: valid transitions ----------------------------

    it('should transition open → in_progress', async () => {
      // 1. lockAndValidate (SELECT FOR UPDATE)
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'open' })],
      });
      // 2. applyStatusUpdate (UPDATE status)
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 3. insertStatusComment (INSERT comment)
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'in_progress');

      // Verify lockAndValidate query contains FOR UPDATE
      const lockCall = mockClient.query.mock.calls[0];
      expect(lockCall[0]).toContain('FOR UPDATE');
      expect(lockCall[1]).toEqual([WO_UUID, TENANT_ID]);

      // Verify applyStatusUpdate sets status to in_progress
      const updateCall = mockClient.query.mock.calls[1];
      expect(updateCall[0]).toContain('SET status = $1');
      expect(updateCall[1]).toEqual(['in_progress', 42]);

      // Verify insertStatusComment contains is_status_change
      const commentCall = mockClient.query.mock.calls[2];
      expect(commentCall[0]).toContain('is_status_change');
      expect(commentCall[0]).toContain('work_order_comments');

      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });

    it('should transition open → completed', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'open' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'completed');

      const updateCall = mockClient.query.mock.calls[1];
      expect(updateCall[1]).toEqual(['completed', 42]);
    });

    it('should transition in_progress → completed', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'in_progress' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'completed');

      const updateCall = mockClient.query.mock.calls[1];
      expect(updateCall[1]).toEqual(['completed', 42]);
    });

    it('should transition completed → in_progress', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'completed' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'in_progress');

      const updateCall = mockClient.query.mock.calls[1];
      expect(updateCall[1]).toEqual(['in_progress', 42]);
    });

    it('should transition completed → verified', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'completed' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'verified');

      const updateCall = mockClient.query.mock.calls[1];
      expect(updateCall[1]).toEqual(['verified', 42]);
    });

    it('should transition verified → completed', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'verified' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'completed');

      const updateCall = mockClient.query.mock.calls[1];
      expect(updateCall[1]).toEqual(['completed', 42]);
    });

    // ---- completed_at logic ----------------------------------------

    it('should set completed_at = NOW() when transitioning TO completed', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'in_progress' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'completed');

      const updateSql = mockClient.query.mock.calls[1][0] as string;
      expect(updateSql).toContain('NOW()');
    });

    it('should NOT set completed_at = NOW() when transitioning to non-completed status', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'open' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'in_progress');

      const updateSql = mockClient.query.mock.calls[1][0] as string;
      expect(updateSql).not.toContain('NOW()');
      expect(updateSql).toContain('completed_at');
    });

    // ---- Auto-comment content --------------------------------------

    it('should insert auto-comment with is_status_change = true and correct statuses', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'open' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'in_progress');

      const commentCall = mockClient.query.mock.calls[2];
      const commentSql = commentCall[0] as string;
      const commentParams = commentCall[1] as unknown[];

      expect(commentSql).toContain('is_status_change');
      expect(commentSql).toContain('old_status');
      expect(commentSql).toContain('new_status');
      // Params: [uuid, tenantId, workOrderId, userId, content, oldStatus, newStatus]
      expect(commentParams[1]).toBe(TENANT_ID);
      expect(commentParams[2]).toBe(42);
      expect(commentParams[3]).toBe(USER_ID);
      expect(commentParams[4]).toContain('Offen');
      expect(commentParams[4]).toContain('In Bearbeitung');
      expect(commentParams[5]).toBe('open');
      expect(commentParams[6]).toBe('in_progress');
    });

    // ---- Activity logger -------------------------------------------

    it('should call activityLogger.logUpdate with German status labels', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'open' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'in_progress');

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        'work_order',
        42,
        expect.stringContaining('Offen'),
        { status: 'open' },
        { status: 'in_progress' },
      );
    });

    // ---- NotFoundException -----------------------------------------

    it('should throw NotFoundException when work order not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'in_progress'),
      ).rejects.toThrow(NotFoundException);

      // Re-mock for message assertion (previous mockResolvedValueOnce was consumed)
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'in_progress'),
      ).rejects.toThrow('Arbeitsauftrag nicht gefunden');
    });

    // ---- BadRequestException for invalid transitions ---------------

    it('should throw BadRequestException for open → verified (invalid)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'open' })],
      });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'verified'),
      ).rejects.toThrow(BadRequestException);

      // Reset for message check
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'open' })],
      });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'verified'),
      ).rejects.toThrow('Ungültiger Statusübergang');
    });

    it('should throw BadRequestException for in_progress → open (invalid)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'in_progress' })],
      });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'open'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for in_progress → verified (invalid)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'in_progress' })],
      });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'verified'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for verified → open (invalid)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'verified' })],
      });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'open'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for verified → in_progress (invalid)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'verified' })],
      });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'in_progress'),
      ).rejects.toThrow(BadRequestException);
    });

    // ---- No side effects on error ----------------------------------

    it('should not call applyStatusUpdate or insertStatusComment when WO not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'in_progress'),
      ).rejects.toThrow(NotFoundException);

      // Only the lock query should have been called
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('should not call applyStatusUpdate or insertStatusComment on invalid transition', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'open' })],
      });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, WO_UUID, 'verified'),
      ).rejects.toThrow(BadRequestException);

      // Only the lock query should have been called
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // verifyWorkOrder
  // =============================================================

  describe('verifyWorkOrder()', () => {
    // ---- Happy path: completed → verified --------------------------

    it('should verify a completed work order', async () => {
      // 1. lockAndValidate (SELECT FOR UPDATE)
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createWorkOrderRow({ status: 'completed', title: 'Leckage beheben' }),
        ],
      });
      // 2. Direct UPDATE (status, verified_at, verified_by)
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 3. insertStatusComment
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.verifyWorkOrder(TENANT_ID, ADMIN_USER_ID, WO_UUID);

      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });

    it('should set verified_at and verified_by in the UPDATE query', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createWorkOrderRow({ status: 'completed', title: 'Leckage beheben' }),
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.verifyWorkOrder(TENANT_ID, ADMIN_USER_ID, WO_UUID);

      const updateCall = mockClient.query.mock.calls[1];
      const updateSql = updateCall[0] as string;
      const updateParams = updateCall[1] as unknown[];

      expect(updateSql).toContain("status = 'verified'");
      expect(updateSql).toContain('verified_at = NOW()');
      expect(updateSql).toContain('verified_by = $1');
      expect(updateParams[0]).toBe(ADMIN_USER_ID);
      expect(updateParams[1]).toBe(42);
    });

    it('should insert auto-comment for verification', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'completed' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.verifyWorkOrder(TENANT_ID, ADMIN_USER_ID, WO_UUID);

      const commentCall = mockClient.query.mock.calls[2];
      const commentSql = commentCall[0] as string;
      const commentParams = commentCall[1] as unknown[];

      expect(commentSql).toContain('is_status_change');
      expect(commentParams[3]).toBe(ADMIN_USER_ID);
      expect(commentParams[4]).toContain('Abgeschlossen');
      expect(commentParams[4]).toContain('Verifiziert');
      expect(commentParams[5]).toBe('completed');
      expect(commentParams[6]).toBe('verified');
    });

    it('should call activityLogger.logUpdate with verification details', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createWorkOrderRow({ status: 'completed', title: 'Leckage beheben' }),
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.verifyWorkOrder(TENANT_ID, ADMIN_USER_ID, WO_UUID);

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        TENANT_ID,
        ADMIN_USER_ID,
        'work_order',
        42,
        expect.stringContaining('verifiziert'),
        { status: 'completed' },
        { status: 'verified', verifiedBy: ADMIN_USER_ID },
      );
    });

    // ---- NotFoundException -----------------------------------------

    it('should throw NotFoundException when work order not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.verifyWorkOrder(TENANT_ID, ADMIN_USER_ID, WO_UUID),
      ).rejects.toThrow('Arbeitsauftrag nicht gefunden');
    });

    // ---- BadRequestException when not completed --------------------

    it('should throw BadRequestException when status is open (not completed)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'open' })],
      });

      await expect(
        service.verifyWorkOrder(TENANT_ID, ADMIN_USER_ID, WO_UUID),
      ).rejects.toThrow(BadRequestException);

      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'open' })],
      });

      await expect(
        service.verifyWorkOrder(TENANT_ID, ADMIN_USER_ID, WO_UUID),
      ).rejects.toThrow('Ungültiger Statusübergang');
    });

    it('should throw BadRequestException when status is in_progress', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'in_progress' })],
      });

      await expect(
        service.verifyWorkOrder(TENANT_ID, ADMIN_USER_ID, WO_UUID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when status is already verified', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'verified' })],
      });

      // verified → verified is not a valid transition
      await expect(
        service.verifyWorkOrder(TENANT_ID, ADMIN_USER_ID, WO_UUID),
      ).rejects.toThrow(BadRequestException);
    });

    // ---- No side effects on error ----------------------------------

    it('should not execute UPDATE or comment INSERT when WO not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.verifyWorkOrder(TENANT_ID, ADMIN_USER_ID, WO_UUID),
      ).rejects.toThrow(NotFoundException);

      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('should not execute UPDATE or comment INSERT on invalid transition', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createWorkOrderRow({ status: 'open' })],
      });

      await expect(
        service.verifyWorkOrder(TENANT_ID, ADMIN_USER_ID, WO_UUID),
      ).rejects.toThrow(BadRequestException);

      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });
  });
});
