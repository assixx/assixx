/**
 * Unit tests for TpmApprovalService
 *
 * Mocked dependencies: DatabaseService (queryOne, tenantTransaction),
 * TpmCardStatusService (approveCard, rejectCard), ActivityLoggerService.
 * Tests: approveExecution (full flow, ForbiddenException, ConflictException,
 * NotFoundException, activity logger), rejectExecution (full flow, same guards),
 * canUserApprove (team lead, admin, unauthorized).
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 * Call order per approve/reject: lock → validateApprover → resolveCardAssetId
 *   → UPDATE → cardStatusService → fetchExecution.
 */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { TpmApprovalService } from './tpm-approval.service.js';
import type { TpmCardStatusService } from './tpm-card-status.service.js';
import type { TpmExecutionJoinRow } from './tpm-executions.helpers.js';
import type { TpmNotificationService } from './tpm-notification.service.js';
import type { TpmSchedulingService } from './tpm-scheduling.service.js';
import type { TpmCardExecutionRow } from './tpm.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    queryOne: vi.fn(),
    query: vi.fn().mockResolvedValue(undefined),
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockNotificationService() {
  return {
    notifyApprovalResult: vi.fn(),
  };
}

function createMockCardStatusService() {
  return {
    approveCard: vi.fn().mockResolvedValue(undefined),
    rejectCard: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockActivityLogger() {
  return {
    logUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

function createExecutionRow(
  overrides?: Partial<TpmCardExecutionRow>,
): TpmCardExecutionRow {
  return {
    id: 1,
    uuid: 'exec-uuid-001                            ',
    tenant_id: 10,
    card_id: 5,
    executed_by: 7,
    execution_date: '2026-03-01',
    documentation: 'Alles geprüft',
    approval_status: 'pending',
    approved_by: null,
    approved_at: null,
    approval_note: null,
    custom_data: {},
    created_at: '2026-03-01T08:30:00.000Z',
    updated_at: '2026-03-01T08:30:00.000Z',
    ...overrides,
  };
}

function createExecutionJoinRow(
  overrides?: Partial<TpmExecutionJoinRow>,
): TpmExecutionJoinRow {
  return {
    id: 1,
    uuid: 'exec-uuid-001                            ',
    tenant_id: 10,
    card_id: 5,
    executed_by: 7,
    execution_date: '2026-03-01',
    documentation: 'Alles geprüft',
    approval_status: 'approved',
    approved_by: 9,
    approved_at: '2026-03-01T10:00:00.000Z',
    approval_note: 'Freigegeben',
    custom_data: {},
    created_at: '2026-03-01T08:30:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
    card_uuid: 'card-uuid-001                            ',
    executed_by_name: 'employee',
    approved_by_name: 'teamlead',
    ...overrides,
  };
}

// =============================================================
// TpmApprovalService
// =============================================================

describe('TpmApprovalService', () => {
  let service: TpmApprovalService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let mockCardStatusService: ReturnType<typeof createMockCardStatusService>;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  const mockSchedulingService = {
    advanceSchedule: vi.fn().mockResolvedValue('2026-04-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    mockCardStatusService = createMockCardStatusService();
    mockActivityLogger = createMockActivityLogger();
    mockNotificationService = createMockNotificationService();

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new TpmApprovalService(
      mockDb as unknown as DatabaseService,
      mockCardStatusService as unknown as TpmCardStatusService,
      mockActivityLogger as unknown as ActivityLoggerService,
      mockNotificationService as unknown as TpmNotificationService,
      mockSchedulingService as unknown as TpmSchedulingService,
    );
  });

  // =============================================================
  // approveExecution
  // =============================================================

  describe('approveExecution()', () => {
    function setupApproveHappyPath(): void {
      // 1. lockPendingExecution
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'pending' })],
      });
      // 2. validateApprover
      mockClient.query.mockResolvedValueOnce({
        rows: [{ can_approve: true }],
      });
      // 3. resolveCardInfo (replaces resolveCardAssetId)
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            uuid: 'card-uuid-001',
            card_code: 'TPM-C-001',
            title: 'Ölstand prüfen',
            asset_id: 42,
            interval_type: 'weekly',
            status: 'yellow',
          },
        ],
      });
      // 4. updateApprovalStatus
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 5. cardStatusService.approveCard → already mocked
      // 6. fetchExecution
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionJoinRow({ approval_status: 'approved' })],
      });
    }

    it('should approve execution and return mapped result', async () => {
      setupApproveHappyPath();

      const result = await service.approveExecution(10, 'exec-uuid-001', 9, {
        action: 'approved',
        approvalNote: 'Freigegeben',
      });

      expect(result.uuid).toBe('exec-uuid-001');
      expect(result.approvalStatus).toBe('approved');
      expect(result.approvedByName).toBe('teamlead');
    });

    it('should call cardStatusService.approveCard with correct params', async () => {
      setupApproveHappyPath();

      await service.approveExecution(10, 'exec-uuid-001', 9, {
        action: 'approved',
        approvalNote: null,
      });

      expect(mockCardStatusService.approveCard).toHaveBeenCalledWith(
        mockClient,
        10,
        5,
        7,
      );
    });

    it('should use FOR UPDATE lock on execution', async () => {
      setupApproveHappyPath();

      await service.approveExecution(10, 'exec-uuid-001', 9, {
        action: 'approved',
        approvalNote: null,
      });

      const lockSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(lockSql).toContain('FOR UPDATE');
    });

    it('should pass approvalNote to UPDATE query', async () => {
      setupApproveHappyPath();

      await service.approveExecution(10, 'exec-uuid-001', 9, {
        action: 'approved',
        approvalNote: 'Sieht gut aus',
      });

      const updateParams = mockClient.query.mock.calls[3]?.[1] as unknown[];
      expect(updateParams?.[0]).toBe('approved');
      expect(updateParams?.[1]).toBe(9);
      expect(updateParams?.[2]).toBe('Sieht gut aus');
    });

    it('should throw NotFoundException when execution not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.approveExecution(10, 'nonexistent', 9, {
          action: 'approved',
          approvalNote: null,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when already processed', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'approved' })],
      });

      await expect(
        service.approveExecution(10, 'exec-uuid-001', 9, {
          action: 'approved',
          approvalNote: null,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException when user cannot approve', async () => {
      // lockPendingExecution → pending
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'pending' })],
      });
      // validateApprover → not authorized
      mockClient.query.mockResolvedValueOnce({
        rows: [{ can_approve: false }],
      });

      await expect(
        service.approveExecution(10, 'exec-uuid-001', 99, {
          action: 'approved',
          approvalNote: null,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should call activity logger after successful approval', async () => {
      setupApproveHappyPath();

      await service.approveExecution(10, 'exec-uuid-001', 9, {
        action: 'approved',
        approvalNote: 'OK',
      });

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        10,
        9,
        'tpm_execution',
        42,
        expect.stringContaining('exec-uuid-001'),
        expect.objectContaining({ approvalStatus: 'pending' }),
        expect.objectContaining({ approvalStatus: 'approved' }),
      );
    });

    it('should pass null approvalNote when undefined', async () => {
      setupApproveHappyPath();

      await service.approveExecution(10, 'exec-uuid-001', 9, {
        action: 'approved',
      });

      const updateParams = mockClient.query.mock.calls[3]?.[1] as unknown[];
      expect(updateParams?.[2]).toBeNull();
    });
  });

  // =============================================================
  // rejectExecution
  // =============================================================

  describe('rejectExecution()', () => {
    function setupRejectHappyPath(): void {
      // 1. lockPendingExecution
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'pending' })],
      });
      // 2. validateApprover
      mockClient.query.mockResolvedValueOnce({
        rows: [{ can_approve: true }],
      });
      // 3. resolveCardInfo (replaces resolveCardAssetId)
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            uuid: 'card-uuid-001',
            card_code: 'TPM-C-001',
            title: 'Ölstand prüfen',
            asset_id: 42,
            interval_type: 'weekly',
            status: 'yellow',
          },
        ],
      });
      // 4. updateApprovalStatus
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 5. cardStatusService.rejectCard → already mocked
      // 6. fetchExecution
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createExecutionJoinRow({
            approval_status: 'rejected',
            approval_note: 'Nicht korrekt',
          }),
        ],
      });
    }

    it('should reject execution and return mapped result', async () => {
      setupRejectHappyPath();

      const result = await service.rejectExecution(10, 'exec-uuid-001', 9, {
        action: 'rejected',
        approvalNote: 'Nicht korrekt',
      });

      expect(result.uuid).toBe('exec-uuid-001');
      expect(result.approvalStatus).toBe('rejected');
    });

    it('should call cardStatusService.rejectCard with correct params', async () => {
      setupRejectHappyPath();

      await service.rejectExecution(10, 'exec-uuid-001', 9, {
        action: 'rejected',
        approvalNote: 'Mangelhaft',
      });

      expect(mockCardStatusService.rejectCard).toHaveBeenCalledWith(
        mockClient,
        10,
        5,
      );
    });

    it('should throw NotFoundException when execution not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.rejectExecution(10, 'nonexistent', 9, {
          action: 'rejected',
          approvalNote: 'Fehler',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when already rejected', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'rejected' })],
      });

      await expect(
        service.rejectExecution(10, 'exec-uuid-001', 9, {
          action: 'rejected',
          approvalNote: 'Doppelt',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException when user unauthorized', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'pending' })],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ can_approve: false }],
      });

      await expect(
        service.rejectExecution(10, 'exec-uuid-001', 99, {
          action: 'rejected',
          approvalNote: 'Versuch',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should call activity logger with rejection details', async () => {
      setupRejectHappyPath();

      await service.rejectExecution(10, 'exec-uuid-001', 9, {
        action: 'rejected',
        approvalNote: 'Dokumentation fehlt',
      });

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        10,
        9,
        'tpm_execution',
        42,
        expect.stringContaining('exec-uuid-001'),
        expect.objectContaining({ approvalStatus: 'pending' }),
        expect.objectContaining({ approvalStatus: 'rejected' }),
      );
    });

    it('should include approval note in activity log description', async () => {
      setupRejectHappyPath();

      await service.rejectExecution(10, 'exec-uuid-001', 9, {
        action: 'rejected',
        approvalNote: 'Dokumentation fehlt',
      });

      const description = mockActivityLogger.logUpdate.mock
        .calls[0]?.[4] as string;
      expect(description).toContain('Dokumentation fehlt');
    });
  });

  // =============================================================
  // canUserApprove
  // =============================================================

  describe('canUserApprove()', () => {
    it('should return true when user is team lead', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ can_approve: true });

      const result = await service.canUserApprove(10, 9, 5);

      expect(result).toBe(true);
    });

    it('should return false when user has no approval rights', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ can_approve: false });

      const result = await service.canUserApprove(10, 99, 5);

      expect(result).toBe(false);
    });

    it('should return false when queryOne returns null', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.canUserApprove(10, 99, 5);

      expect(result).toBe(false);
    });

    it('should pass correct params to query', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ can_approve: true });

      await service.canUserApprove(10, 9, 5);

      const sql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain('team_lead_id');
      expect(sql).toContain('has_full_access');

      const params = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
      expect(params?.[0]).toBe(5);
      expect(params?.[1]).toBe(10);
      expect(params?.[2]).toBe(9);
    });

    it('should check both team lead and admin paths', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ can_approve: true });

      await service.canUserApprove(10, 9, 5);

      const sql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain('teams');
      expect(sql).toContain('asset_teams');
      expect(sql).toContain('users');
    });
  });

  // =============================================================
  // Edge cases
  // =============================================================

  describe('Edge cases', () => {
    it('should throw ConflictException for approve on already-approved execution', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'approved' })],
      });

      await expect(
        service.approveExecution(10, 'exec-uuid-001', 9, {
          action: 'approved',
          approvalNote: null,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should use UPDATE with correct WHERE clause', async () => {
      // Full approve flow
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'pending' })],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ can_approve: true }],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            uuid: 'card-uuid-001',
            card_code: 'TPM-C-001',
            title: 'Test',
            asset_id: 42,
            interval_type: 'weekly',
            status: 'yellow',
          },
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionJoinRow()],
      });

      await service.approveExecution(10, 'exec-uuid-001', 9, {
        action: 'approved',
        approvalNote: null,
      });

      const updateSql = mockClient.query.mock.calls[3]?.[0] as string;
      expect(updateSql).toContain('approval_status');
      expect(updateSql).toContain('approved_by');
      expect(updateSql).toContain('approved_at');
      expect(updateSql).toContain('approval_note');
    });

    it('should set approval_status to rejected in UPDATE for reject flow', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'pending' })],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ can_approve: true }],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            uuid: 'card-uuid-001',
            card_code: 'TPM-C-001',
            title: 'Test',
            asset_id: 42,
            interval_type: 'weekly',
            status: 'yellow',
          },
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createExecutionJoinRow({
            approval_status: 'rejected',
            approval_note: 'Nein',
          }),
        ],
      });

      await service.rejectExecution(10, 'exec-uuid-001', 9, {
        action: 'rejected',
        approvalNote: 'Nein',
      });

      const updateSql = mockClient.query.mock.calls[3]?.[0] as string;
      expect(updateSql).toContain('approval_status = $1');
      const updateParams = mockClient.query.mock.calls[3]?.[1] as unknown[];
      expect(updateParams?.[0]).toBe('rejected');
    });
  });
});
