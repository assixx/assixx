/**
 * KVP Approval Service – Unit Tests
 *
 * Tests: requestApproval, getApprovalForSuggestion, hasApprovalConfig,
 * handleApprovalDecision (via EventBus callback — including decidedByUserId
 * fallback, non-kvp filtering, idempotent status sync).
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApprovalsConfigService } from '../approvals/approvals-config.service.js';
import type { ApprovalsService } from '../approvals/approvals.service.js';
import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { KvpApprovalService } from './kvp-approval.service.js';

// =============================================================
// Module Mocks
// =============================================================

const mockIsUuid = vi.hoisted(() => vi.fn().mockReturnValue(false));

vi.mock('./kvp.helpers.js', () => ({
  isUuid: mockIsUuid,
}));

const mockEventBusOn = vi.hoisted(() => vi.fn());

vi.mock('../../utils/event-bus.js', () => ({
  eventBus: { on: mockEventBusOn },
}));

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockApprovalsService() {
  return {
    create: vi.fn().mockResolvedValue(createMockApproval()),
    findById: vi.fn().mockResolvedValue(createMockApproval()),
  };
}

function createMockConfigService() {
  return {
    resolveApprovers: vi.fn().mockResolvedValue([30]),
  };
}

function createMockActivityLogger() {
  return { logUpdate: vi.fn().mockResolvedValue(undefined) };
}

function createMockNotifications() {
  return { createAddonNotification: vi.fn().mockResolvedValue(undefined) };
}

function createMockApproval() {
  return {
    uuid: '019d0001-aaaa-7bbb-cccc-dddddddddddd',
    addonCode: 'kvp',
    sourceEntityType: 'kvp_suggestion',
    sourceUuid: '019ceec8-3992-731b-9b79-9e292307b3ea',
    title: 'Lichtschranke',
    description: null,
    requestedBy: 5,
    requestedByName: 'Corc Öztürk',
    assignedTo: null,
    assignedToName: null,
    status: 'pending' as const,
    priority: 'medium' as const,
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: '2026-03-22T10:00:00.000Z',
  };
}

function createMockSuggestionRow(overrides?: Record<string, unknown>) {
  return {
    id: 23,
    uuid: '019ceec8-3992-731b-9b79-9e292307b3ea',
    title: 'Lichtschranke',
    status: 'new',
    submitted_by: 1,
    ...overrides,
  };
}

// =============================================================
// Test Suite
// =============================================================

describe('KvpApprovalService', () => {
  let service: KvpApprovalService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockApprovals: ReturnType<typeof createMockApprovalsService>;
  let mockConfig: ReturnType<typeof createMockConfigService>;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let mockNotifications: ReturnType<typeof createMockNotifications>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockApprovals = createMockApprovalsService();
    mockConfig = createMockConfigService();
    mockActivityLogger = createMockActivityLogger();
    mockNotifications = createMockNotifications();
    mockIsUuid.mockReturnValue(false);

    service = new KvpApprovalService(
      mockDb as unknown as DatabaseService,
      mockApprovals as unknown as ApprovalsService,
      mockConfig as unknown as ApprovalsConfigService,
      mockActivityLogger as unknown as ActivityLoggerService,
      mockNotifications as unknown as NotificationsService,
    );
  });

  // -----------------------------------------------------------
  // requestApproval
  // -----------------------------------------------------------

  describe('requestApproval()', () => {
    it('should create approval and set KVP to in_review', async () => {
      mockDb.query
        .mockResolvedValueOnce([createMockSuggestionRow()]) // findSuggestion
        .mockResolvedValueOnce([]) // assertNoExistingApproval
        .mockResolvedValueOnce([]); // updateSuggestionStatus

      const result = await service.requestApproval(1, 23, 5);

      expect(result.addonCode).toBe('kvp');
      expect(mockApprovals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          addonCode: 'kvp',
          sourceEntityType: 'kvp_suggestion',
        }),
        1,
        5,
      );
      // updateSuggestionStatus called (3rd query)
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should throw NotFoundException when KVP not found', async () => {
      mockDb.query.mockResolvedValueOnce([]); // findSuggestion → empty

      await expect(service.requestApproval(1, 999, 5)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when approval already exists', async () => {
      mockDb.query
        .mockResolvedValueOnce([createMockSuggestionRow()]) // findSuggestion
        .mockResolvedValueOnce([{ uuid: 'existing-approval' }]); // assertNoExistingApproval → found

      await expect(service.requestApproval(1, 23, 5)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for non-new status', async () => {
      mockDb.query.mockResolvedValueOnce([createMockSuggestionRow({ status: 'approved' })]);

      await expect(service.requestApproval(1, 23, 5)).rejects.toThrow(BadRequestException);
    });

    it('should allow request for restored status', async () => {
      mockDb.query
        .mockResolvedValueOnce([createMockSuggestionRow({ status: 'restored' })])
        .mockResolvedValueOnce([]) // no existing approval
        .mockResolvedValueOnce([]); // update status

      const result = await service.requestApproval(1, 23, 5);
      expect(result.addonCode).toBe('kvp');
    });

    it('should throw BadRequestException for in_review status', async () => {
      mockDb.query.mockResolvedValueOnce([createMockSuggestionRow({ status: 'in_review' })]);

      await expect(service.requestApproval(1, 23, 5)).rejects.toThrow(BadRequestException);
    });

    it('should create persistent notifications for approvers', async () => {
      mockDb.query
        .mockResolvedValueOnce([createMockSuggestionRow()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.requestApproval(1, 23, 5);

      expect(mockNotifications.createAddonNotification).toHaveBeenCalledWith(
        'kvp',
        23,
        'Neue Freigabe-Anfrage',
        expect.stringContaining('Lichtschranke'),
        'user',
        30,
        1,
        5,
      );
    });
  });

  // -----------------------------------------------------------
  // getApprovalForSuggestion
  // -----------------------------------------------------------

  describe('getApprovalForSuggestion()', () => {
    it('should return approval when one exists', async () => {
      mockDb.query
        .mockResolvedValueOnce([createMockSuggestionRow()]) // findSuggestion
        .mockResolvedValueOnce([
          {
            uuid: '019d0001-aaaa-7bbb-cccc-dddddddddddd',
            source_uuid: '019ceec8-3992-731b-9b79-9e292307b3ea',
            status: 'pending',
            decision_note: null,
          },
        ]);

      const result = await service.getApprovalForSuggestion(1, 23);

      expect(result).not.toBeNull();
      expect(mockApprovals.findById).toHaveBeenCalled();
    });

    it('should return null when no approval exists', async () => {
      mockDb.query.mockResolvedValueOnce([createMockSuggestionRow()]).mockResolvedValueOnce([]);

      const result = await service.getApprovalForSuggestion(1, 23);

      expect(result).toBeNull();
      expect(mockApprovals.findById).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // hasApprovalConfig
  // -----------------------------------------------------------

  describe('hasApprovalConfig()', () => {
    it('should return true when config exists', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '2' }]);

      const result = await service.hasApprovalConfig(1);

      expect(result).toBe(true);
    });

    it('should return false when no config exists', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.hasApprovalConfig(1);

      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // handleApprovalDecision (via EventBus)
  // -----------------------------------------------------------

  describe('handleApprovalDecision (via EventBus)', () => {
    function getDecisionCallback(): (data: {
      tenantId: number;
      approval: {
        uuid: string;
        title: string;
        addonCode: string;
        status: string;
        requestedByName: string;
        decidedByName?: string;
        decisionNote?: string | null;
      };
      requestedByUserId: number;
      decidedByUserId?: number;
    }) => void {
      // Constructor registers callback via eventBus.on('approval.decided', cb)
      const call = mockEventBusOn.mock.calls.find((c: unknown[]) => c[0] === 'approval.decided');
      return call[1] as ReturnType<typeof getDecisionCallback>;
    }

    it('should sync KVP status on approved decision', async () => {
      const callback = getDecisionCallback();

      // getSourceUuidFromApproval
      mockDb.query.mockResolvedValueOnce([{ source_uuid: '019ceec8-3992-731b-9b79-9e292307b3ea' }]);
      // findSuggestionByUuid
      mockDb.query.mockResolvedValueOnce([createMockSuggestionRow({ status: 'in_review' })]);
      // syncKvpStatus UPDATE
      mockDb.query.mockResolvedValueOnce([]);
      // createDecisionNotification
      mockNotifications.createAddonNotification.mockResolvedValueOnce(undefined);

      callback({
        tenantId: 1,
        approval: {
          uuid: 'approval-uuid-1',
          title: 'Lichtschranke',
          addonCode: 'kvp',
          status: 'approved',
          requestedByName: 'Test User',
        },
        requestedByUserId: 5,
        decidedByUserId: 10,
      });

      // Wait for async void handler
      await vi.waitFor(() => {
        expect(mockDb.query).toHaveBeenCalledTimes(3);
      });
    });

    it('should handle missing decidedByUserId with fallback to 0', async () => {
      const callback = getDecisionCallback();

      mockDb.query.mockResolvedValueOnce([{ source_uuid: '019ceec8-3992-731b-9b79-9e292307b3ea' }]);
      mockDb.query.mockResolvedValueOnce([createMockSuggestionRow({ status: 'in_review' })]);
      mockDb.query.mockResolvedValueOnce([]);
      mockNotifications.createAddonNotification.mockResolvedValueOnce(undefined);

      callback({
        tenantId: 1,
        approval: {
          uuid: 'approval-uuid-1',
          title: 'Lichtschranke',
          addonCode: 'kvp',
          status: 'rejected',
          requestedByName: 'Test User',
          decisionNote: 'Abgelehnt',
        },
        requestedByUserId: 5,
        // decidedByUserId omitted — should fall back to 0
      });

      await vi.waitFor(() => {
        expect(mockDb.query).toHaveBeenCalledTimes(3);
      });
    });

    it('should ignore events with non-kvp addonCode', async () => {
      const callback = getDecisionCallback();

      callback({
        tenantId: 1,
        approval: {
          uuid: 'approval-uuid-1',
          title: 'Something',
          addonCode: 'shift_planning',
          status: 'approved',
          requestedByName: 'Test User',
        },
        requestedByUserId: 5,
      });

      // No DB calls — event ignored
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should not create duplicate sync when status already matches', async () => {
      const callback = getDecisionCallback();

      mockDb.query.mockResolvedValueOnce([{ source_uuid: '019ceec8-3992-731b-9b79-9e292307b3ea' }]);
      // Suggestion already has status 'approved'
      mockDb.query.mockResolvedValueOnce([createMockSuggestionRow({ status: 'approved' })]);
      mockNotifications.createAddonNotification.mockResolvedValueOnce(undefined);

      callback({
        tenantId: 1,
        approval: {
          uuid: 'approval-uuid-1',
          title: 'Lichtschranke',
          addonCode: 'kvp',
          status: 'approved',
          requestedByName: 'Test User',
        },
        requestedByUserId: 5,
        decidedByUserId: 10,
      });

      await vi.waitFor(() => {
        expect(mockDb.query).toHaveBeenCalledTimes(2);
      });

      // syncKvpStatus should have returned early (idempotent) — no UPDATE query
      const updateCalls = mockDb.query.mock.calls.filter((c: unknown[]) => {
        const sql = c[0] as string;
        return sql.includes('UPDATE kvp_suggestions');
      });
      expect(updateCalls).toHaveLength(0);
    });
  });
});
