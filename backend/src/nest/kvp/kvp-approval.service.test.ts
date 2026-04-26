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
  const qf = vi.fn();
  // All DB entry points alias the same spy so tests can count total DB calls
  // regardless of whether the service uses tenantQuery (CLS-scoped),
  // queryAsTenant (explicit tenantId), or systemQuery (cross-tenant).
  return { query: qf, tenantQuery: qf, queryAsTenant: qf, systemQuery: qf };
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
        .mockResolvedValueOnce([]); // assertNoExistingApproval
      mockDb.tenantQuery.mockResolvedValueOnce([]); // updateSuggestionStatus

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
      // 2x query + 1x tenantQuery (shared fn)
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
        .mockResolvedValueOnce([]); // no existing approval
      mockDb.tenantQuery.mockResolvedValueOnce([]); // update status

      const result = await service.requestApproval(1, 23, 5);
      expect(result.addonCode).toBe('kvp');
    });

    it('should throw BadRequestException for in_review status', async () => {
      mockDb.query.mockResolvedValueOnce([createMockSuggestionRow({ status: 'in_review' })]);

      await expect(service.requestApproval(1, 23, 5)).rejects.toThrow(BadRequestException);
    });

    it('should create persistent notifications for approvers', async () => {
      mockDb.query.mockResolvedValueOnce([createMockSuggestionRow()]).mockResolvedValueOnce([]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

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
  // canRequesterFindApprovalMaster — backs the Hard-Gate in
  // KvpService.createSuggestion (ADR-037 Amendment 2026-04-26).
  // We check that the result tracks resolveApprovers().length > 0
  // so submission is blocked when the user's org scope has no
  // configured master.
  // -----------------------------------------------------------

  describe('canRequesterFindApprovalMaster()', () => {
    it('returns true when resolveApprovers yields at least one approver', async () => {
      mockConfig.resolveApprovers.mockResolvedValueOnce([42]);

      const result = await service.canRequesterFindApprovalMaster(7);

      expect(result).toBe(true);
      expect(mockConfig.resolveApprovers).toHaveBeenCalledWith('kvp', 7);
    });

    it('returns false when resolveApprovers returns an empty list', async () => {
      mockConfig.resolveApprovers.mockResolvedValueOnce([]);

      const result = await service.canRequesterFindApprovalMaster(7);

      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // getApprovalMastersForRequester — feeds the info-banner
  // ("Dein KVP-Master: …") on /kvp. Display-name fallback
  // covers nullable first_name/last_name + email last-resort
  // (ADR-037 Amendment 2026-04-26).
  // -----------------------------------------------------------

  describe('getApprovalMastersForRequester()', () => {
    it('returns empty array when no approver is reachable for the user', async () => {
      mockConfig.resolveApprovers.mockResolvedValueOnce([]);

      const result = await service.getApprovalMastersForRequester(7);

      expect(result).toEqual([]);
      // No DB lookup when the approver list is empty — saves an unnecessary query
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('joins first_name + last_name when both are present', async () => {
      mockConfig.resolveApprovers.mockResolvedValueOnce([42]);
      mockDb.query.mockResolvedValueOnce([
        { id: 42, first_name: 'Jürgen', last_name: 'Schmitz', email: 'j.s@x.de' },
      ]);

      const result = await service.getApprovalMastersForRequester(7);

      expect(result).toEqual([{ id: 42, displayName: 'Jürgen Schmitz' }]);
    });

    it('falls back to email when both names are null', async () => {
      mockConfig.resolveApprovers.mockResolvedValueOnce([42]);
      mockDb.query.mockResolvedValueOnce([
        { id: 42, first_name: null, last_name: null, email: 'fallback@x.de' },
      ]);

      const result = await service.getApprovalMastersForRequester(7);

      expect(result).toEqual([{ id: 42, displayName: 'fallback@x.de' }]);
    });

    it('returns multiple masters in the order returned by the DB', async () => {
      mockConfig.resolveApprovers.mockResolvedValueOnce([42, 7]);
      mockDb.query.mockResolvedValueOnce([
        { id: 7, first_name: 'Anna', last_name: 'Müller', email: 'a@x.de' },
        { id: 42, first_name: 'Jürgen', last_name: null, email: 'j@x.de' },
      ]);

      const result = await service.getApprovalMastersForRequester(7);

      expect(result).toEqual([
        { id: 7, displayName: 'Anna Müller' },
        { id: 42, displayName: 'Jürgen' },
      ]);
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
      // syncKvpStatus UPDATE (tenantQuery)
      mockDb.tenantQuery.mockResolvedValueOnce([]);
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
      mockDb.tenantQuery.mockResolvedValueOnce([]);
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

      // 2x query lookups, but no tenantQuery UPDATE (idempotent — status already matches)
      await vi.waitFor(() => {
        expect(mockDb.query).toHaveBeenCalledTimes(2);
      });
    });
  });
});
