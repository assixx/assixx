/**
 * Unit tests for SwapApprovalBridgeService
 *
 * Tests: approval creation, approval config on-the-fly, event handling.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { eventBus } from '../../utils/event-bus.js';
import type { ApprovalsConfigService } from '../approvals/approvals-config.service.js';
import type { ApprovalsService } from '../approvals/approvals.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ShiftSwapService } from './shift-swap.service.js';
import { SwapApprovalBridgeService } from './swap-approval-bridge.service.js';

function createMockDb() {
  const query = vi.fn();
  return { query, tenantQuery: query, tenantQueryOne: vi.fn() };
}

function createMockApprovalsService() {
  return {
    create: vi.fn().mockResolvedValue({ uuid: 'approval-uuid-1', status: 'pending' }),
  };
}

function createMockConfigService() {
  return { createConfig: vi.fn().mockResolvedValue({}) };
}

function createMockSwapService() {
  return { executeSwap: vi.fn().mockResolvedValue(undefined) };
}

describe('SwapApprovalBridgeService', () => {
  let bridge: SwapApprovalBridgeService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockApprovalsService: ReturnType<typeof createMockApprovalsService>;
  let mockConfigService: ReturnType<typeof createMockConfigService>;
  let mockSwapService: ReturnType<typeof createMockSwapService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockApprovalsService = createMockApprovalsService();
    mockConfigService = createMockConfigService();
    mockSwapService = createMockSwapService();
    bridge = new SwapApprovalBridgeService(
      mockDb as unknown as DatabaseService,
      mockApprovalsService as unknown as ApprovalsService,
      mockConfigService as unknown as ApprovalsConfigService,
      mockSwapService as unknown as ShiftSwapService,
    );
  });

  // =============================================================
  // createApprovalForSwap
  // =============================================================

  describe('createApprovalForSwap', () => {
    it('should create approval with correct addon and entity type', async () => {
      // ensureApprovalConfig: config exists
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // UPDATE swap request with approval_uuid
      mockDb.query.mockResolvedValueOnce([]);

      await bridge.createApprovalForSwap('swap-uuid', 1, 10, 'Tausch A↔B');

      expect(mockApprovalsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          addonCode: 'shift_planning',
          sourceEntityType: 'shift_swap_request',
          sourceUuid: 'swap-uuid',
          title: 'Tausch A↔B',
          priority: 'medium',
        }),
        1,
        10,
      );
    });

    it('should link approval UUID back to swap request', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      mockDb.query.mockResolvedValueOnce([]);

      await bridge.createApprovalForSwap('swap-uuid', 1, 10, 'Tausch');

      const updateCall = mockDb.query.mock.calls[1];
      expect(updateCall?.[0]).toContain('approval_uuid');
      expect(updateCall?.[1]).toContain('approval-uuid-1');
    });

    it('should create approval config on-the-fly if missing (C2 fix)', async () => {
      // ensureApprovalConfig: no config exists
      mockDb.query.mockResolvedValueOnce([]);
      // UPDATE swap request
      mockDb.query.mockResolvedValueOnce([]);

      await bridge.createApprovalForSwap('swap-uuid', 1, 10, 'Tausch');

      expect(mockConfigService.createConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          addonCode: 'shift_planning',
          approverType: 'team_lead',
        }),
        1,
        0,
      );
    });

    it('should NOT create config if already exists', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      mockDb.query.mockResolvedValueOnce([]);

      await bridge.createApprovalForSwap('swap-uuid', 1, 10, 'Tausch');

      expect(mockConfigService.createConfig).not.toHaveBeenCalled();
    });
  });

  // =============================================================
  // onModuleInit
  // =============================================================

  describe('onModuleInit', () => {
    it('should not throw during initialization', () => {
      expect(() => bridge.onModuleInit()).not.toThrow();
    });
  });

  // =============================================================
  // handleApprovalDecision (via EventBus emission)
  // =============================================================

  describe('handleApprovalDecision (event-driven)', () => {
    afterEach(() => {
      eventBus.removeAllListeners('approval.decided');
    });

    it('should call executeSwap when approval is approved', async () => {
      bridge.onModuleInit(); // subscribes to eventBus
      // getApprovalSource → found with correct entity type
      mockDb.query.mockResolvedValueOnce([
        { source_uuid: 'swap-uuid-1', source_entity_type: 'shift_swap_request' },
      ]);

      eventBus.emit('approval.decided', {
        tenantId: 1,
        approval: {
          uuid: 'approval-1',
          title: 'Schichttausch',
          addonCode: 'shift_planning',
          status: 'approved',
          requestedByName: 'John',
        },
        requestedByUserId: 10,
      });

      // Event handler is async — wait for microtasks
      await vi.waitFor(() => {
        expect(mockSwapService.executeSwap).toHaveBeenCalledWith('swap-uuid-1', 1);
      });
    });

    it('should update swap status to rejected when approval is rejected', async () => {
      bridge.onModuleInit();
      mockDb.query.mockResolvedValueOnce([
        { source_uuid: 'swap-uuid-2', source_entity_type: 'shift_swap_request' },
      ]);
      // UPDATE status
      mockDb.query.mockResolvedValueOnce([]);

      eventBus.emit('approval.decided', {
        tenantId: 1,
        approval: {
          uuid: 'approval-2',
          title: 'Schichttausch',
          addonCode: 'shift_planning',
          status: 'rejected',
          requestedByName: 'John',
        },
        requestedByUserId: 10,
      });

      await vi.waitFor(() => {
        const updateCall = mockDb.query.mock.calls[1];
        expect(updateCall?.[0]).toContain("status = 'rejected'");
        expect(updateCall?.[1]).toContain('swap-uuid-2');
      });
    });

    it('should skip non-shift_planning approvals', async () => {
      bridge.onModuleInit();

      eventBus.emit('approval.decided', {
        tenantId: 1,
        approval: {
          uuid: 'approval-other',
          title: 'KVP',
          addonCode: 'kvp',
          status: 'approved',
          requestedByName: 'Jane',
        },
        requestedByUserId: 10,
      });

      // Give async handler time to potentially fire
      await new Promise((r: (v: void) => void) => setTimeout(r, 50));
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockSwapService.executeSwap).not.toHaveBeenCalled();
    });

    it('should skip when source entity type is not shift_swap_request', async () => {
      bridge.onModuleInit();
      // getApprovalSource returns different entity type
      mockDb.query.mockResolvedValueOnce([
        { source_uuid: 'plan-uuid', source_entity_type: 'shift_plan' },
      ]);

      eventBus.emit('approval.decided', {
        tenantId: 1,
        approval: {
          uuid: 'approval-plan',
          title: 'Plan approval',
          addonCode: 'shift_planning',
          status: 'approved',
          requestedByName: 'John',
        },
        requestedByUserId: 10,
      });

      await new Promise((r: (v: void) => void) => setTimeout(r, 50));
      expect(mockSwapService.executeSwap).not.toHaveBeenCalled();
    });

    it('should handle missing approval source gracefully', async () => {
      bridge.onModuleInit();
      // getApprovalSource → not found
      mockDb.query.mockResolvedValueOnce([]);

      eventBus.emit('approval.decided', {
        tenantId: 1,
        approval: {
          uuid: 'approval-missing',
          title: 'Unknown',
          addonCode: 'shift_planning',
          status: 'approved',
          requestedByName: 'John',
        },
        requestedByUserId: 10,
      });

      await new Promise((r: (v: void) => void) => setTimeout(r, 50));
      expect(mockSwapService.executeSwap).not.toHaveBeenCalled();
    });
  });
});
