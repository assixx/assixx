/**
 * Vacation Service – Unit Tests (Phase 3, Session 13)
 *
 * Core business logic: create, respond (approve/deny), withdraw, cancel, edit.
 * Mocked dependencies: DatabaseService (tenantTransaction), VacationApproverService,
 * VacationValidationService, VacationNotificationService.
 * Approver tests are in vacation-approver.service.test.ts.
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { VacationApproverService } from './vacation-approver.service.js';
import type { VacationNotificationService } from './vacation-notification.service.js';
import type { VacationValidationService } from './vacation-validation.service.js';
import { VacationService } from './vacation.service.js';
import type { VacationRequestRow } from './vacation.types.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockApprover() {
  return {
    getApprover: vi.fn().mockResolvedValue({
      approverId: 10,
      autoApproved: false,
    }),
  };
}

function createMockActivityLogger() {
  return { log: vi.fn().mockResolvedValue(undefined) };
}

function createMockNotification() {
  return {
    notifyCreated: vi.fn(),
    notifyResponded: vi.fn(),
    notifyWithdrawn: vi.fn(),
    notifyCancelled: vi.fn(),
  };
}

function createMockValidation() {
  return {
    validateNewRequest: vi.fn().mockResolvedValue(undefined),
    computeWorkdays: vi.fn().mockResolvedValue(5),
    validateBalanceAndBlackouts: vi.fn().mockResolvedValue(undefined),
    reCheckBalanceForApproval: vi.fn().mockResolvedValue(undefined),
    guardFutureStartDate: vi.fn(),
    mergeWithExisting: vi.fn().mockReturnValue({
      startDate: '2026-07-01',
      endDate: '2026-07-05',
      halfDayStart: 'none',
      halfDayEnd: 'none',
      vacationType: 'regular',
    }),
    validateEditedRequest: vi.fn().mockResolvedValue(undefined),
    countWorkdays: vi.fn().mockResolvedValue(5),
  };
}

function createMockRequestRow(
  overrides?: Partial<VacationRequestRow>,
): VacationRequestRow {
  return {
    id: 'req-001',
    tenant_id: 1,
    requester_id: 5,
    approver_id: 10,
    substitute_id: null,
    start_date: '2026-07-01',
    end_date: '2026-07-05',
    half_day_start: 'none',
    half_day_end: 'none',
    vacation_type: 'regular',
    status: 'pending',
    computed_days: '5',
    is_special_leave: false,
    request_note: null,
    response_note: null,
    responded_at: null,
    responded_by: null,
    is_active: IS_ACTIVE.ACTIVE,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================
// Test Suite
// =============================================================

describe('VacationService', () => {
  let service: VacationService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let mockApprover: ReturnType<typeof createMockApprover>;
  let mockValidation: ReturnType<typeof createMockValidation>;
  let mockNotification: ReturnType<typeof createMockNotification>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    mockApprover = createMockApprover();
    mockValidation = createMockValidation();
    mockNotification = createMockNotification();

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new VacationService(
      mockDb as unknown as DatabaseService,
      mockApprover as unknown as VacationApproverService,
      mockValidation as unknown as VacationValidationService,
      mockNotification as unknown as VacationNotificationService,
      createMockActivityLogger() as unknown as ActivityLoggerService,
    );
  });

  // -----------------------------------------------------------
  // createRequest
  // -----------------------------------------------------------

  describe('createRequest()', () => {
    it('should create a pending request with approver', async () => {
      // getUserTeamInfo
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            team_id: 1,
            team_name: 'Team A',
            team_lead_id: 10,
            deputy_lead_id: null,
            department_id: 1,
          },
        ],
      });
      // approver.getApprover already mocked via createMockApprover (returns approverId: 10)
      // insertRequest → RETURNING *
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ status: 'pending', approver_id: 10 })],
      });
      // insertStatusLog
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.createRequest(5, 1, {
        startDate: '2026-07-01',
        endDate: '2026-07-05',
        halfDayStart: 'none',
        halfDayEnd: 'none',
        vacationType: 'regular',
      });

      expect(result.status).toBe('pending');
      expect(result.approverId).toBe(10);
      expect(result.requesterId).toBe(5);
      expect(mockApprover.getApprover).toHaveBeenCalledWith(1, 5);
      expect(mockValidation.validateNewRequest).toHaveBeenCalledOnce();
      expect(mockValidation.computeWorkdays).toHaveBeenCalledOnce();
      expect(mockValidation.validateBalanceAndBlackouts).toHaveBeenCalledOnce();
    });
  });

  // -----------------------------------------------------------
  // respondToRequest
  // -----------------------------------------------------------

  describe('respondToRequest()', () => {
    it('should approve a pending request', async () => {
      // lockPendingRequest (lockRequestById → FOR UPDATE)
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow()],
      });
      // validateResponder → approver matches
      // updateStatus → RETURNING *
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ status: 'approved' })],
      });
      // insertStatusLog
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // insertAvailability
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.respondToRequest(10, 1, 'req-001', {
        action: 'approved',
        isSpecialLeave: false,
      });

      expect(result.status).toBe('approved');
      expect(mockValidation.reCheckBalanceForApproval).toHaveBeenCalledOnce();
    });

    it('should deny a pending request', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow()],
      });
      // updateStatus → denied
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ status: 'denied' })],
      });
      // insertStatusLog
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.respondToRequest(10, 1, 'req-001', {
        action: 'denied',
        isSpecialLeave: false,
        responseNote: 'Not enough staff',
      });

      expect(result.status).toBe('denied');
    });

    it('should throw ConflictException when responding to non-pending request', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ status: 'approved' })],
      });

      await expect(
        service.respondToRequest(10, 1, 'req-001', {
          action: 'approved',
          isSpecialLeave: false,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should use FOR UPDATE lock to prevent race conditions (R6)', async () => {
      // The lockRequestById query must contain FOR UPDATE to prevent
      // concurrent approvals of the same request (two managers clicking
      // approve simultaneously). Verify the lock is in the query.
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow()],
      });
      // updateStatus
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ status: 'approved' })],
      });
      // insertStatusLog
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // insertAvailability
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.respondToRequest(10, 1, 'req-001', {
        action: 'approved',
        isSpecialLeave: false,
      });

      // First query in the transaction is the lock query
      const lockQuery = mockClient.query.mock.calls[0]?.[0] as string;
      expect(lockQuery).toContain('FOR UPDATE');
    });

    it('should throw ForbiddenException when non-approver responds', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow()],
      });
      // validateResponder → not the approver, check has_full_access
      mockClient.query.mockResolvedValueOnce({
        rows: [{ has_full_access: 0 }],
      });

      await expect(
        service.respondToRequest(99, 1, 'req-001', {
          action: 'approved',
          isSpecialLeave: false,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when request not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.respondToRequest(10, 1, 'nonexistent', {
          action: 'approved',
          isSpecialLeave: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip balance re-check for special_leave approval', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createMockRequestRow({ status: 'approved', is_special_leave: true }),
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.respondToRequest(10, 1, 'req-001', {
        action: 'approved',
        isSpecialLeave: true,
      });

      expect(mockValidation.reCheckBalanceForApproval).not.toHaveBeenCalled();
    });

    it('should skip balance re-check for unpaid vacation approval', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ vacation_type: 'unpaid' })],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createMockRequestRow({ status: 'approved', vacation_type: 'unpaid' }),
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.respondToRequest(10, 1, 'req-001', {
        action: 'approved',
        isSpecialLeave: false,
      });

      expect(mockValidation.reCheckBalanceForApproval).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // withdrawRequest
  // -----------------------------------------------------------

  describe('withdrawRequest()', () => {
    it('should withdraw own pending request', async () => {
      // lockOwnRequest → pending
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow()],
      });
      // transitionStatus: UPDATE + insertStatusLog
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.withdrawRequest(5, 1, 'req-001'),
      ).resolves.toBeUndefined();
    });

    it('should withdraw own approved future request and deactivate availability', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureStr = futureDate.toISOString().slice(0, 10);

      mockClient.query.mockResolvedValueOnce({
        rows: [
          createMockRequestRow({
            status: 'approved',
            start_date: futureStr,
            end_date: futureStr,
          }),
        ],
      });
      // transitionStatus
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // deactivateAvailability
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.withdrawRequest(5, 1, 'req-001'),
      ).resolves.toBeUndefined();

      expect(mockValidation.guardFutureStartDate).toHaveBeenCalledWith(
        futureStr,
      );
    });

    it('should throw ConflictException when withdrawing denied request', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ status: 'denied' })],
      });
      // resolveUserName
      mockClient.query.mockResolvedValueOnce({
        rows: [{ first_name: 'Test', last_name: 'User' }],
      });

      await expect(service.withdrawRequest(5, 1, 'req-001')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ForbiddenException when withdrawing others request', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ requester_id: 99 })],
      });

      await expect(service.withdrawRequest(5, 1, 'req-001')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // -----------------------------------------------------------
  // cancelRequest
  // -----------------------------------------------------------

  describe('cancelRequest()', () => {
    it('should cancel approved request when admin', async () => {
      // getUserRole → admin
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 20, role: 'admin' }],
      });
      // lockRequestById → approved
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ status: 'approved' })],
      });
      // transitionStatus
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // deactivateAvailability
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.cancelRequest(20, 1, 'req-001', 'Schedule conflict'),
      ).resolves.toBeUndefined();
    });

    it('should cancel approved request when root', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, role: 'root' }],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ status: 'approved' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.cancelRequest(1, 1, 'req-001', 'Override'),
      ).resolves.toBeUndefined();
    });

    it('should throw ForbiddenException when employee tries to cancel', async () => {
      // getUserRole → employee
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 5, role: 'employee' }],
      });
      // lockRequestById → row with approver_id: 10 (not userId 5)
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ status: 'approved' })],
      });

      await expect(
        service.cancelRequest(5, 1, 'req-001', 'I want to cancel'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when cancelling non-approved request', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 20, role: 'admin' }],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ status: 'pending' })],
      });

      await expect(
        service.cancelRequest(20, 1, 'req-001', 'Reason'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // -----------------------------------------------------------
  // editRequest
  // -----------------------------------------------------------

  describe('editRequest()', () => {
    it('should edit a pending request', async () => {
      // lockOwnRequest → pending
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow()],
      });
      // getUserTeamInfo
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            team_id: 1,
            team_name: 'Team A',
            team_lead_id: 10,
            deputy_lead_id: null,
            department_id: 1,
          },
        ],
      });
      // applyRequestUpdate → UPDATE RETURNING *
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ start_date: '2026-07-07' })],
      });
      // insertStatusLog
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.editRequest(5, 1, 'req-001', {
        startDate: '2026-07-07',
      });

      expect(result.startDate).toBe('2026-07-07');
      expect(mockValidation.mergeWithExisting).toHaveBeenCalledOnce();
      expect(mockValidation.validateEditedRequest).toHaveBeenCalledOnce();
    });

    it('should throw ConflictException when editing non-pending request', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ status: 'approved' })],
      });

      await expect(
        service.editRequest(5, 1, 'req-001', { startDate: '2026-08-01' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException when editing someone elses request', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockRequestRow({ requester_id: 99 })],
      });

      await expect(
        service.editRequest(5, 1, 'req-001', { startDate: '2026-08-01' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
