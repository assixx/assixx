/**
 * Unit tests for TpmPlanApprovalService
 *
 * Mocked dependencies: DatabaseService, ApprovalsService, ActivityLoggerService,
 * eventBus (module-level mock), uuid.
 *
 * Tests: requestApproval (D6 gate), hasPendingApproval (D3),
 * getApprovalStatusForPlans (batch), event handler (approve/reject/ignore),
 * startup reconciliation.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApprovalsService } from '../approvals/approvals.service.js';
import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { TpmPlanApprovalService } from './tpm-plan-approval.service.js';

// =============================================================
// Module-level mocks (vi.hoisted runs before vi.mock hoisting)
// =============================================================

type EventHandler = (data: {
  tenantId: number;
  approval: {
    uuid: string;
    addonCode: string;
    status: string;
    title: string;
    requestedByName: string;
  };
  requestedByUserId: number;
  decidedByUserId?: number;
}) => void;

let capturedHandler: EventHandler | null = null;

const { mockEventBus } = vi.hoisted(() => ({
  mockEventBus: {
    on: vi.fn((event: string, handler: EventHandler) => {
      if (event === 'approval.decided') {
        capturedHandler = handler;
      }
    }),
  },
}));

vi.mock('../../utils/event-bus.js', () => ({
  eventBus: mockEventBus,
}));

vi.mock('uuid', () => ({
  v7: vi.fn(() => 'mock-uuid-v7-001'),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb(): {
  query: ReturnType<typeof vi.fn>;
  tenantQuery: ReturnType<typeof vi.fn>;
  tenantQueryOne: ReturnType<typeof vi.fn>;
  queryAsTenant: ReturnType<typeof vi.fn>;
  systemQuery: ReturnType<typeof vi.fn>;
} {
  // All DB entry points alias the same spy so tests can count total DB calls
  // regardless of whether the service uses tenantQuery, queryAsTenant
  // (explicit tenantId), or systemQuery (cross-tenant reconciliation).
  const queryFn = vi.fn().mockResolvedValue([]);
  return {
    query: queryFn,
    tenantQuery: queryFn,
    tenantQueryOne: vi.fn().mockResolvedValue(null),
    queryAsTenant: queryFn,
    systemQuery: queryFn,
  };
}

function createMockApprovalsService(): {
  create: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn().mockResolvedValue({ uuid: 'approval-uuid-001' }),
  };
}

function createMockActivityLogger(): {
  logUpdate: ReturnType<typeof vi.fn>;
} {
  return {
    logUpdate: vi.fn(),
  };
}

// =============================================================
// Tests
// =============================================================

describe('TpmPlanApprovalService', () => {
  let service: TpmPlanApprovalService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockApprovals: ReturnType<typeof createMockApprovalsService>;
  let mockLogger: ReturnType<typeof createMockActivityLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
    mockDb = createMockDb();
    mockApprovals = createMockApprovalsService();
    mockLogger = createMockActivityLogger();

    // Note: onModuleInit() is NOT called by `new` — NestJS calls it.
    // No reconcile mock needed here.
    service = new TpmPlanApprovalService(
      mockDb as unknown as DatabaseService,
      mockApprovals as unknown as ApprovalsService,
      mockLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // hasApprovalConfig (D6)
  // =============================================================

  describe('hasApprovalConfig()', () => {
    it('should return true when configs exist', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '2' }]);

      const result = await service.hasApprovalConfig(10);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('approval_configs'), [
        'tpm',
        10,
        IS_ACTIVE.ACTIVE,
      ]);
    });

    it('should return false when no configs exist', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.hasApprovalConfig(10);

      expect(result).toBe(false);
    });
  });

  // =============================================================
  // hasPendingApproval (D3)
  // =============================================================

  describe('hasPendingApproval()', () => {
    it('should return true when pending approval exists', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);

      const result = await service.hasPendingApproval(10, 'plan-uuid-001');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining("status = 'pending'"), [
        'tpm',
        'tpm_plan',
        'plan-uuid-001',
        10,
        IS_ACTIVE.ACTIVE,
      ]);
    });

    it('should return false when no pending approval', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.hasPendingApproval(10, 'plan-uuid-001');

      expect(result).toBe(false);
    });
  });

  // =============================================================
  // requestApproval (D4, D6)
  // =============================================================

  describe('requestApproval()', () => {
    it('should create approval via ApprovalsService when config exists', async () => {
      // hasApprovalConfig → true
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);

      await service.requestApproval(10, 5, 'plan-uuid-001', 'Wartungsplan A', 'Presse P17');

      expect(mockApprovals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          addonCode: 'tpm',
          sourceEntityType: 'tpm_plan',
          sourceUuid: 'plan-uuid-001',
          title: 'TPM Plan: Wartungsplan A (Presse P17)',
          priority: 'medium',
        }),
        10,
        5,
      );
    });

    it('should skip approval when no config exists (D6)', async () => {
      // hasApprovalConfig → false
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      await service.requestApproval(10, 5, 'plan-uuid-001', 'Wartungsplan A', 'Presse P17');

      expect(mockApprovals.create).not.toHaveBeenCalled();
    });

    it('should resolve asset name via DB when assetName is empty', async () => {
      // hasApprovalConfig → true
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);
      // Asset name resolution query
      mockDb.query.mockResolvedValueOnce([{ asset_name: 'Presse P17' }]);

      await service.requestApproval(10, 5, 'plan-uuid-001', 'Wartungsplan A', '');

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(2, expect.stringContaining('JOIN assets a ON'), [
        'plan-uuid-001',
        10,
      ]);
      expect(mockApprovals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'TPM Plan: Wartungsplan A (Presse P17)',
        }),
        10,
        5,
      );
    });

    it('should fallback to empty string when asset not found', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);
      // Asset name resolution returns no rows
      mockDb.query.mockResolvedValueOnce([]);

      await service.requestApproval(10, 5, 'plan-uuid-001', 'Wartungsplan A', '');

      expect(mockApprovals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'TPM Plan: Wartungsplan A ()',
        }),
        10,
        5,
      );
    });

    it('should not throw when ApprovalsService.create fails', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);
      mockApprovals.create.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.requestApproval(10, 5, 'plan-uuid-001', 'Plan', 'Asset'),
      ).resolves.toBeUndefined();
    });
  });

  // =============================================================
  // getApprovalStatusForPlans
  // =============================================================

  describe('getApprovalStatusForPlans()', () => {
    it('should return empty map for empty input', async () => {
      const result = await service.getApprovalStatusForPlans(10, []);

      expect(result).toEqual(new Map());
      // Should not query DB at all for empty input
      expect(mockDb.query).toHaveBeenCalledTimes(0);
    });

    it('should return correct map for mixed statuses', async () => {
      mockDb.query.mockResolvedValueOnce([
        { source_uuid: 'plan-a ', status: 'approved' },
        { source_uuid: 'plan-b ', status: 'pending' },
      ]);

      const result = await service.getApprovalStatusForPlans(10, ['plan-a', 'plan-b', 'plan-c']);

      expect(result.get('plan-a')).toBe('approved');
      expect(result.get('plan-b')).toBe('pending');
      expect(result.has('plan-c')).toBe(false);
    });
  });

  // =============================================================
  // Event Handler (approval.decided)
  // =============================================================

  describe('approval.decided event handler', () => {
    it('should subscribe to approval.decided on construction', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith('approval.decided', expect.any(Function));
      expect(capturedHandler).not.toBeNull();
    });

    it('should ignore events for non-TPM addons', () => {
      capturedHandler?.({
        tenantId: 10,
        approval: {
          uuid: 'approval-uuid',
          addonCode: 'kvp',
          status: 'approved',
          title: 'KVP Suggestion',
          requestedByName: 'User',
        },
        requestedByUserId: 5,
        decidedByUserId: 3,
      });

      // No DB queries for non-TPM addon
      expect(mockDb.query).toHaveBeenCalledTimes(0);
    });

    it('should not update plan on rejection (D1)', async () => {
      capturedHandler?.({
        tenantId: 10,
        approval: {
          uuid: 'approval-uuid',
          addonCode: 'tpm',
          status: 'rejected',
          title: 'TPM Plan',
          requestedByName: 'User',
        },
        requestedByUserId: 5,
        decidedByUserId: 3,
      });

      // Give async handler time to settle
      await vi.waitFor(() => {
        // No DB queries — rejected is a no-op
        expect(mockDb.query).toHaveBeenCalledTimes(0);
      });
    });

    it('should resolve sourceUuid and bump approval_version on approval (D7)', async () => {
      // getSourceUuidFromApproval
      mockDb.query.mockResolvedValueOnce([{ source_uuid: 'plan-uuid-001 ' }]);
      // bumpApprovalVersion: SELECT FOR UPDATE
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          uuid: 'plan-uuid-001',
          tenant_id: 10,
          asset_id: 42,
          name: 'Wartungsplan A',
          base_weekday: 1,
          base_repeat_every: 1,
          base_time: '08:00',
          buffer_hours: '2.0',
          notes: null,
          revision_number: 3,
          approval_version: 1,
          revision_minor: 2,
          created_by: 5,
          is_active: 1,
          created_at: '2026-01-01',
          updated_at: '2026-03-29',
        },
      ]);
      // UPDATE tpm_maintenance_plans
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT tpm_plan_revisions
      mockDb.query.mockResolvedValueOnce([]);

      capturedHandler?.({
        tenantId: 10,
        approval: {
          uuid: 'approval-uuid-001',
          addonCode: 'tpm',
          status: 'approved',
          title: 'TPM Plan',
          requestedByName: 'User',
        },
        requestedByUserId: 5,
        decidedByUserId: 3,
      });

      await vi.waitFor(() => {
        // sourceUuid(0) + SELECT FOR UPDATE(1) + UPDATE(2) + INSERT revision(3)
        expect(mockDb.query).toHaveBeenCalledTimes(4);
      });

      // Verify UPDATE sets approval_version = 2, revision_minor = 0
      const updateCall = mockDb.query.mock.calls[2];
      expect(updateCall?.[1]).toEqual([2, 1, 10]); // [newApprovalVersion, planId, tenantId]

      // Verify revision snapshot INSERT
      const insertCall = mockDb.query.mock.calls[3];
      const insertParams = insertCall?.[1] as unknown[];
      expect(insertParams?.[4]).toBe(2); // approval_version
      expect(insertParams?.[5]).toBe(0); // revision_minor reset
      expect(insertParams?.[14]).toBe('Approved: v2.0'); // change_reason
    });
  });

  // =============================================================
  // Startup Reconciliation
  // =============================================================

  describe('reconcilePendingApprovals()', () => {
    it('should sync plans with missed approval decisions', async () => {
      // Reset to test reconciliation with data
      vi.clearAllMocks();
      capturedHandler = null;

      // reconcile query returns plans with mismatched versions
      mockDb.query.mockResolvedValueOnce([
        {
          tenant_id: 10,
          plan_uuid: 'plan-missed-001',
          plan_id: 42,
          plan_approval_version: 1,
          approved_count: 3,
        },
      ]);
      // UPDATE for the reconciled plan
      mockDb.query.mockResolvedValueOnce([]);

      service = new TpmPlanApprovalService(
        mockDb as unknown as DatabaseService,
        mockApprovals as unknown as ApprovalsService,
        mockLogger as unknown as ActivityLoggerService,
      );

      // Manually trigger onModuleInit (NestJS lifecycle)
      await service.onModuleInit();

      // reconcile SELECT(0) + UPDATE(1) = 2 calls
      expect(mockDb.query).toHaveBeenCalledTimes(2);

      // The UPDATE should set approval_version = 3 (approved_count)
      const updateCall = mockDb.query.mock.calls[1];
      expect(updateCall?.[1]).toEqual([3, 42, 10]);
    });
  });
});
