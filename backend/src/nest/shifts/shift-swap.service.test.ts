/**
 * Unit tests for ShiftSwapService
 *
 * Tests: Create (with validations), partner consent, cancel, list, execute swap.
 * Full rewrite for new schema (UUID PK, 2-step approval flow).
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { ShiftSwapService } from './shift-swap.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}

const mockActivityLogger = {
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue(undefined),
};

const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function swapRow(overrides: Record<string, unknown> = {}) {
  return {
    uuid: UUID,
    tenant_id: 1,
    requester_id: 10,
    requester_shift_id: 100,
    target_id: 20,
    target_shift_id: 200,
    team_id: 5,
    swap_scope: 'single_day',
    start_date: '2026-04-10',
    end_date: '2026-04-10',
    status: 'pending_partner',
    reason: null,
    partner_responded_at: null,
    partner_note: null,
    approval_uuid: null,
    is_active: 1,
    created_at: '2026-04-03T12:00:00Z',
    updated_at: '2026-04-03T12:00:00Z',
    requester_first_name: 'Alice',
    requester_last_name: 'Smith',
    target_first_name: 'Bob',
    target_last_name: 'Jones',
    requester_shift_date: '2026-04-10',
    requester_shift_type: 'early',
    target_shift_date: '2026-04-10',
    target_shift_type: 'late',
    ...overrides,
  };
}

const VALID_DTO = {
  requesterShiftId: 100,
  targetShiftId: 200,
  targetId: 20,
  swapScope: 'single_day' as const,
  startDate: '2026-04-10',
  endDate: '2026-04-10',
};

describe('ShiftSwapService', () => {
  let service: ShiftSwapService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new ShiftSwapService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // listSwapRequests
  // =============================================================

  describe('listSwapRequests', () => {
    it('should return mapped requests', async () => {
      mockDb.query.mockResolvedValueOnce([swapRow()]);
      const result = await service.listSwapRequests(1, {});
      expect(result).toHaveLength(1);
      expect(result[0]?.uuid).toBe(UUID);
      expect(result[0]?.requesterName).toBe('Alice Smith');
    });

    it('should apply userId filter', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await service.listSwapRequests(1, { userId: 10 });
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('requester_id');
    });

    it('should apply status filter', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await service.listSwapRequests(1, { status: 'approved' });
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('status');
    });
  });

  // =============================================================
  // createSwapRequest
  // =============================================================

  describe('createSwapRequest', () => {
    function setupCreateMocks(): void {
      // 1. assertSwapEnabled → settings
      mockDb.query.mockResolvedValueOnce([{ settings: { swapRequestsEnabled: true } }]);
      // 2. resolveUserShift (requester) → found in shifts table
      mockDb.query.mockResolvedValueOnce([{ id: 100, team_id: 5 }]);
      // 3. resolveUserShift (target) → found in shifts table
      mockDb.query.mockResolvedValueOnce([{ id: 200, team_id: 5 }]);
      // 4. assertNoDuplicate
      mockDb.query.mockResolvedValueOnce([]);
      // 5. INSERT RETURNING uuid
      mockDb.query.mockResolvedValueOnce([{ uuid: UUID }]);
      // 6. getSwapRequestByUuid (detail query for response)
      mockDb.query.mockResolvedValueOnce([swapRow()]);
    }

    it('should create and return swap request', async () => {
      setupCreateMocks();
      const result = await service.createSwapRequest(VALID_DTO, 1, 10);
      expect(result.uuid).toBe(UUID);
      expect(result.status).toBe('pending_partner');
      expect(result.requesterId).toBe(10);
      expect(result.targetId).toBe(20);
    });

    it('should throw ForbiddenException when swap is disabled', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { swapRequestsEnabled: false } }]);
      await expect(service.createSwapRequest(VALID_DTO, 1, 10)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for self-swap', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { swapRequestsEnabled: true } }]);
      await expect(
        service.createSwapRequest({ ...VALID_DTO, targetId: 10 }, 1, 10),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for cross-team swap', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { swapRequestsEnabled: true } }]);
      // resolveUserShift requester → team 5
      mockDb.query.mockResolvedValueOnce([{ id: 100, team_id: 5 }]);
      // resolveUserShift target → team 9
      mockDb.query.mockResolvedValueOnce([{ id: 200, team_id: 9 }]);
      await expect(service.createSwapRequest(VALID_DTO, 1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException for duplicate pending swap', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { swapRequestsEnabled: true } }]);
      // resolveUserShift requester + target
      mockDb.query.mockResolvedValueOnce([{ id: 100, team_id: 5 }]);
      mockDb.query.mockResolvedValueOnce([{ id: 200, team_id: 5 }]);
      mockDb.query.mockResolvedValueOnce([{ uuid: 'existing' }]); // duplicate found
      await expect(service.createSwapRequest(VALID_DTO, 1, 10)).rejects.toThrow(ConflictException);
    });
  });

  // =============================================================
  // respondToSwapRequest
  // =============================================================

  describe('respondToSwapRequest', () => {
    it('should accept and set status to pending_approval', async () => {
      mockDb.query.mockResolvedValueOnce([swapRow()]); // getRowOrThrow
      mockDb.query.mockResolvedValueOnce([]); // UPDATE
      mockDb.query.mockResolvedValueOnce([swapRow({ status: 'pending_approval' })]); // getByUuid

      const result = await service.respondToSwapRequest(UUID, 1, 20, true);
      expect(result.status).toBe('pending_approval');
    });

    it('should reject and set status to rejected', async () => {
      mockDb.query.mockResolvedValueOnce([swapRow()]); // getRowOrThrow
      mockDb.query.mockResolvedValueOnce([]); // UPDATE
      mockDb.query.mockResolvedValueOnce([swapRow({ status: 'rejected' })]); // getByUuid

      const result = await service.respondToSwapRequest(UUID, 1, 20, false, 'Keine Zeit');
      expect(result.status).toBe('rejected');
    });

    it('should throw ForbiddenException if not the target user', async () => {
      mockDb.query.mockResolvedValueOnce([swapRow()]);
      await expect(service.respondToSwapRequest(UUID, 1, 99, true)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if not in pending_partner status', async () => {
      mockDb.query.mockResolvedValueOnce([swapRow({ status: 'approved' })]);
      await expect(service.respondToSwapRequest(UUID, 1, 20, true)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // =============================================================
  // cancelSwapRequest
  // =============================================================

  describe('cancelSwapRequest', () => {
    it('should cancel when requester and pending_partner', async () => {
      mockDb.query.mockResolvedValueOnce([swapRow()]);
      mockDb.query.mockResolvedValueOnce([]);
      const result = await service.cancelSwapRequest(UUID, 1, 10);
      expect(result.message).toContain('cancelled');
    });

    it('should throw ForbiddenException if not requester', async () => {
      mockDb.query.mockResolvedValueOnce([swapRow()]);
      await expect(service.cancelSwapRequest(UUID, 1, 99)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if not pending_partner', async () => {
      mockDb.query.mockResolvedValueOnce([swapRow({ status: 'pending_approval' })]);
      await expect(service.cancelSwapRequest(UUID, 1, 10)).rejects.toThrow(ConflictException);
    });
  });

  // =============================================================
  // getSwapRequestByUuid
  // =============================================================

  describe('getSwapRequestByUuid', () => {
    it('should return mapped response', async () => {
      mockDb.query.mockResolvedValueOnce([swapRow()]);
      const result = await service.getSwapRequestByUuid(UUID, 1);
      expect(result.uuid).toBe(UUID);
      expect(result.requesterName).toBe('Alice Smith');
      expect(result.targetName).toBe('Bob Jones');
    });

    it('should throw NotFoundException when not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await expect(service.getSwapRequestByUuid('nonexistent', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // getMyPendingConsents
  // =============================================================

  describe('getMyPendingConsents', () => {
    it('should return pending requests for target user', async () => {
      mockDb.query.mockResolvedValueOnce([swapRow()]);
      const result = await service.getMyPendingConsents(1, 20);
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('pending_partner');
    });

    it('should return empty array when no pending consents', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      const result = await service.getMyPendingConsents(1, 20);
      expect(result).toHaveLength(0);
    });
  });

  // =============================================================
  // executeSwap
  // =============================================================

  describe('executeSwap', () => {
    it('should swap user_ids on all affected shifts using ID-based targeting', async () => {
      const mockClient = {
        query: vi.fn(),
      };
      // Lock swap request
      mockClient.query.mockResolvedValueOnce({
        rows: [swapRow({ status: 'pending_approval' })],
      });
      // Lock shifts (now includes team_id filter)
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 100, user_id: 10 },
          { id: 200, user_id: 20 },
        ],
        rowCount: 2,
      });
      // 3-step swap in shifts: requester→NULL, target→requester, NULL(by ID)→target
      mockClient.query.mockResolvedValueOnce({}); // Step 1
      mockClient.query.mockResolvedValueOnce({}); // Step 2
      mockClient.query.mockResolvedValueOnce({}); // Step 3
      // rotation_history: no entries
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // UPDATE swap status
      mockClient.query.mockResolvedValueOnce({});

      mockDb.tenantTransaction.mockImplementation(
        async (cb: (client: typeof mockClient) => Promise<void>) => {
          await cb(mockClient);
        },
      );

      await service.executeSwap(UUID, 1);

      // SELECT includes team_id filter
      const selectQuery = mockClient.query.mock.calls[1]?.[0] as string;
      expect(selectQuery).toContain('team_id');

      // Step 1: requester shifts → NULL (by ID)
      const step1 = mockClient.query.mock.calls[2];
      expect(step1?.[0]).toContain('user_id = NULL');
      expect(step1?.[0]).toContain('id = ANY');
      expect(step1?.[1]).toEqual([[100]]); // requester shift IDs
      // Step 2: target shifts → requester_id (by ID)
      const step2 = mockClient.query.mock.calls[3];
      expect(step2?.[1]).toEqual([10, [200]]); // requester_id, target shift IDs
      // Step 3: requester shifts → target_id (by ID, not NULL match)
      const step3 = mockClient.query.mock.calls[4];
      expect(step3?.[1]).toEqual([20, [100]]); // target_id, requester shift IDs
    });

    it('should swap user_ids in shift_rotation_history when no shifts exist', async () => {
      const mockClient = { query: vi.fn() };
      // Lock swap request
      mockClient.query.mockResolvedValueOnce({
        rows: [swapRow({ status: 'pending_approval' })],
      });
      // shifts: empty
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // rotation_history: has entries
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 500, user_id: 10 },
          { id: 501, user_id: 10 },
          { id: 600, user_id: 20 },
          { id: 601, user_id: 20 },
        ],
        rowCount: 4,
      });
      // 3-step rotation swap
      mockClient.query.mockResolvedValueOnce({}); // Step 1: requester → NULL
      mockClient.query.mockResolvedValueOnce({}); // Step 2: target → requester
      mockClient.query.mockResolvedValueOnce({}); // Step 3: NULL → target
      // UPDATE swap status
      mockClient.query.mockResolvedValueOnce({});

      mockDb.tenantTransaction.mockImplementation(
        async (cb: (client: typeof mockClient) => Promise<void>) => {
          await cb(mockClient);
        },
      );

      await service.executeSwap(UUID, 1);

      // Rotation SELECT uses shift_date column
      const rotationSelect = mockClient.query.mock.calls[2]?.[0] as string;
      expect(rotationSelect).toContain('shift_rotation_history');
      expect(rotationSelect).toContain('shift_date');

      // Step 1: requester rotation IDs → NULL
      const step1 = mockClient.query.mock.calls[3];
      expect(step1?.[0]).toContain('shift_rotation_history');
      expect(step1?.[1]).toEqual([[500, 501]]);
      // Step 2: target rotation IDs → requester_id
      const step2 = mockClient.query.mock.calls[4];
      expect(step2?.[1]).toEqual([10, [600, 601]]);
      // Step 3: requester rotation IDs → target_id
      const step3 = mockClient.query.mock.calls[5];
      expect(step3?.[1]).toEqual([20, [500, 501]]);
    });

    it('should swap in both shifts AND rotation_history tables', async () => {
      const mockClient = { query: vi.fn() };
      // Lock swap request
      mockClient.query.mockResolvedValueOnce({
        rows: [swapRow({ status: 'pending_approval' })],
      });
      // shifts: has entries
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 100, user_id: 10 },
          { id: 200, user_id: 20 },
        ],
        rowCount: 2,
      });
      // 3-step shifts swap
      mockClient.query.mockResolvedValueOnce({}); // Step 1
      mockClient.query.mockResolvedValueOnce({}); // Step 2
      mockClient.query.mockResolvedValueOnce({}); // Step 3
      // rotation_history: also has entries
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 500, user_id: 10 },
          { id: 600, user_id: 20 },
        ],
        rowCount: 2,
      });
      // 3-step rotation swap
      mockClient.query.mockResolvedValueOnce({}); // Step 1
      mockClient.query.mockResolvedValueOnce({}); // Step 2
      mockClient.query.mockResolvedValueOnce({}); // Step 3
      // UPDATE swap status
      mockClient.query.mockResolvedValueOnce({});

      mockDb.tenantTransaction.mockImplementation(
        async (cb: (client: typeof mockClient) => Promise<void>) => {
          await cb(mockClient);
        },
      );

      await service.executeSwap(UUID, 1);

      // Total queries: 1 lock + 1 shifts SELECT + 3 shifts swap + 1 rotation SELECT + 3 rotation swap + 1 status = 10
      expect(mockClient.query).toHaveBeenCalledTimes(10);
    });

    it('should throw ConflictException if not in pending_approval status', async () => {
      const mockClient = { query: vi.fn() };
      mockClient.query.mockResolvedValueOnce({
        rows: [swapRow({ status: 'pending_partner' })],
      });
      mockDb.tenantTransaction.mockImplementation(
        async (cb: (client: typeof mockClient) => Promise<void>) => {
          await cb(mockClient);
        },
      );
      await expect(service.executeSwap(UUID, 1)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if swap not found', async () => {
      const mockClient = { query: vi.fn() };
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockDb.tenantTransaction.mockImplementation(
        async (cb: (client: typeof mockClient) => Promise<void>) => {
          await cb(mockClient);
        },
      );
      await expect(service.executeSwap('nonexistent', 1)).rejects.toThrow(NotFoundException);
    });

    it('should update swap status to approved after execution', async () => {
      const mockClient = { query: vi.fn() };
      mockClient.query.mockResolvedValueOnce({
        rows: [swapRow({ status: 'pending_approval' })],
      });
      // shifts: empty
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // rotation_history: empty
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // UPDATE swap status
      mockClient.query.mockResolvedValueOnce({});
      mockDb.tenantTransaction.mockImplementation(
        async (cb: (client: typeof mockClient) => Promise<void>) => {
          await cb(mockClient);
        },
      );
      await service.executeSwap(UUID, 1);
      const statusUpdate = mockClient.query.mock.calls[3];
      expect(statusUpdate?.[0]).toContain("status = 'approved'");
    });
  });

  // =============================================================
  // createSwapRequest — additional edge cases
  // =============================================================

  describe('createSwapRequest — edge cases', () => {
    it('should throw NotFoundException when requester has no shift in either table', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { swapRequestsEnabled: true } }]);
      // Promise.all runs both resolveUserShift in parallel — provide enough empty mocks
      // for interleaved query consumption (shifts + rotation for each user)
      mockDb.query.mockResolvedValueOnce([]); // shifts (either user)
      mockDb.query.mockResolvedValueOnce([]); // shifts (either user)
      mockDb.query.mockResolvedValueOnce([]); // rotation (either user)
      mockDb.query.mockResolvedValueOnce([]); // rotation (either user)
      await expect(service.createSwapRequest(VALID_DTO, 1, 10)).rejects.toThrow(NotFoundException);
    });

    it('should succeed with rotation-only shift (null shiftId)', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { swapRequestsEnabled: true } }]);
      // resolveUserShift for requester: shifts → empty, rotation → found
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([{ team_id: 5 }]);
      // resolveUserShift for target: shifts → found
      mockDb.query.mockResolvedValueOnce([{ id: 200, team_id: 5 }]);
      // assertNoDuplicate
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT
      mockDb.query.mockResolvedValueOnce([{ uuid: UUID }]);
      // getSwapRequestByUuid
      mockDb.query.mockResolvedValueOnce([swapRow({ requester_shift_id: null })]);

      const result = await service.createSwapRequest(VALID_DTO, 1, 10);
      expect(result.uuid).toBe(UUID);
    });

    it('should throw BadRequestException for week scope with mismatched shift counts', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { swapRequestsEnabled: true } }]);
      // resolveUserShift requester + target
      mockDb.query.mockResolvedValueOnce([{ id: 100, team_id: 5 }]);
      mockDb.query.mockResolvedValueOnce([{ id: 200, team_id: 5 }]);
      // validateRangeShifts: requester has 3, target has 5
      mockDb.query.mockResolvedValueOnce([
        { user_id: 10, cnt: '3' },
        { user_id: 20, cnt: '5' },
      ]);
      const weekDto = {
        ...VALID_DTO,
        swapScope: 'week' as const,
        startDate: '2026-04-07',
        endDate: '2026-04-13',
      };
      await expect(service.createSwapRequest(weekDto, 1, 10)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for week scope when user has zero shifts', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { swapRequestsEnabled: true } }]);
      // resolveUserShift requester + target
      mockDb.query.mockResolvedValueOnce([{ id: 100, team_id: 5 }]);
      mockDb.query.mockResolvedValueOnce([{ id: 200, team_id: 5 }]);
      // validateRangeShifts: only requester has shifts
      mockDb.query.mockResolvedValueOnce([{ user_id: 10, cnt: '5' }]);
      const weekDto = {
        ...VALID_DTO,
        swapScope: 'week' as const,
        startDate: '2026-04-07',
        endDate: '2026-04-13',
      };
      await expect(service.createSwapRequest(weekDto, 1, 10)).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when setting is null', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);
      await expect(service.createSwapRequest(VALID_DTO, 1, 10)).rejects.toThrow(ForbiddenException);
    });

    it('should use UNION query for validateRangeShifts (checks both tables)', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { swapRequestsEnabled: true } }]);
      // resolveUserShift requester + target
      mockDb.query.mockResolvedValueOnce([{ id: 100, team_id: 5 }]);
      mockDb.query.mockResolvedValueOnce([{ id: 200, team_id: 5 }]);
      // validateRangeShifts: UNION query returns equal counts → passes
      mockDb.query.mockResolvedValueOnce([
        { user_id: 10, cnt: '5' },
        { user_id: 20, cnt: '5' },
      ]);
      // assertNoDuplicate
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT
      mockDb.query.mockResolvedValueOnce([{ uuid: UUID }]);
      // getSwapRequestByUuid
      mockDb.query.mockResolvedValueOnce([swapRow({ swap_scope: 'week' })]);

      const weekDto = {
        ...VALID_DTO,
        swapScope: 'week' as const,
        startDate: '2026-04-07',
        endDate: '2026-04-13',
      };
      const result = await service.createSwapRequest(weekDto, 1, 10);
      expect(result.uuid).toBe(UUID);

      // validateRangeShifts query should use UNION
      const rangeQuery = mockDb.query.mock.calls[3]?.[0] as string;
      expect(rangeQuery).toContain('UNION');
      expect(rangeQuery).toContain('shift_rotation_history');
    });
  });
});
