/**
 * Root Self-Termination Notification Service — Unit Tests
 *
 * Mocked dependencies: DatabaseService, eventBus (module mock), uuid.
 * Each public method is async (returns Promise<void>) so tests `await`
 * directly — no flushPromises plumbing needed (matches the vacation
 * pattern except for the await/sync difference).
 *
 * Coverage matrix (Phase 3 §3 mandatory scenarios for this file):
 *   - notifyRequested:  emit + insert per peer; name fallback; no peers; lookup failure
 *   - notifyApproved:   emit + insert for requester + peers; null comment passthrough
 *   - notifyRejected:   emit + insert for requester only; cooldown ISO; insert failure swallowed
 *
 * @see backend/src/nest/vacation/vacation-notification.service.test.ts (sibling pattern)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { RootSelfTerminationNotificationService } from './root-self-termination-notification.service.js';

// =============================================================
// Module Mocks (vi.hoisted runs before vi.mock hoisting)
// =============================================================

const mockEventBus = vi.hoisted(() => ({
  emitRootSelfTerminationRequested: vi.fn(),
  emitRootSelfTerminationApproved: vi.fn(),
  emitRootSelfTerminationRejected: vi.fn(),
}));

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-notification-uuid'),
}));

vi.mock('../../utils/event-bus.js', () => ({
  eventBus: mockEventBus,
}));

// =============================================================
// Fixtures
// =============================================================

const ALICE_ROW = { id: 100, first_name: 'Alice', last_name: 'Root' };
const BOB_ROW = { id: 200, first_name: 'Bob', last_name: 'Root' };

function createMockDb() {
  return {
    tenantQuery: vi.fn(),
    tenantQueryOne: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

/** Count tenantQuery calls whose first arg contains the given SQL fragment. */
function countSqlMatches(mockDb: MockDb, fragment: string): number {
  return mockDb.tenantQuery.mock.calls.filter(
    (call) => typeof call[0] === 'string' && (call[0] as string).includes(fragment),
  ).length;
}

// =============================================================
// Test Suite
// =============================================================

describe('RootSelfTerminationNotificationService', () => {
  let service: RootSelfTerminationNotificationService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new RootSelfTerminationNotificationService(mockDb as unknown as DatabaseService);
  });

  // -----------------------------------------------------------
  // notifyRequested
  // -----------------------------------------------------------

  describe('notifyRequested()', () => {
    it('should emit event and INSERT one notification per peer root', async () => {
      mockDb.tenantQueryOne.mockResolvedValueOnce(ALICE_ROW);
      mockDb.tenantQuery
        .mockResolvedValueOnce([{ id: 200 }, { id: 300 }]) // findPeerRoots
        .mockResolvedValue(undefined); // INSERT no-op

      await service.notifyRequested({
        tenantId: 7,
        requesterId: 100,
        requestId: 'req-uuid-1',
        expiresAt: '2026-05-04T00:00:00.000Z',
      });

      expect(mockEventBus.emitRootSelfTerminationRequested).toHaveBeenCalledWith(
        7,
        { id: 'req-uuid-1', requesterId: 100, requesterName: 'Alice Root' },
        '2026-05-04T00:00:00.000Z',
      );
      expect(countSqlMatches(mockDb, 'INSERT INTO notifications')).toBe(2);
    });

    it('should fall back to "Benutzer #<id>" when user lookup returns null', async () => {
      mockDb.tenantQueryOne.mockResolvedValueOnce(null);
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 200 }]).mockResolvedValue(undefined);

      await service.notifyRequested({
        tenantId: 7,
        requesterId: 100,
        requestId: 'req-uuid-2',
        expiresAt: '2026-05-04T00:00:00.000Z',
      });

      expect(mockEventBus.emitRootSelfTerminationRequested).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ requesterName: 'Benutzer #100' }),
        expect.any(String),
      );
    });

    it('should skip persistent INSERT when no peer roots exist', async () => {
      mockDb.tenantQueryOne.mockResolvedValueOnce(ALICE_ROW);
      mockDb.tenantQuery.mockResolvedValueOnce([]); // empty peer set

      await service.notifyRequested({
        tenantId: 7,
        requesterId: 100,
        requestId: 'req-uuid-3',
        expiresAt: '2026-05-04T00:00:00.000Z',
      });

      expect(mockEventBus.emitRootSelfTerminationRequested).toHaveBeenCalledOnce();
      expect(countSqlMatches(mockDb, 'INSERT INTO notifications')).toBe(0);
    });

    it('should swallow user-lookup errors (top-level catch — emit is skipped)', async () => {
      mockDb.tenantQueryOne.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(
        service.notifyRequested({
          tenantId: 7,
          requesterId: 100,
          requestId: 'req-uuid-4',
          expiresAt: '2026-05-04T00:00:00.000Z',
        }),
      ).resolves.toBeUndefined();

      // Lookup failed before emit — event must NOT have fired.
      expect(mockEventBus.emitRootSelfTerminationRequested).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // notifyApproved
  // -----------------------------------------------------------

  describe('notifyApproved()', () => {
    it('should emit event and INSERT for requester + peers (approver excluded)', async () => {
      mockDb.tenantQueryOne
        .mockResolvedValueOnce(ALICE_ROW) // requester name (id=100)
        .mockResolvedValueOnce(BOB_ROW); // approver name (id=200)
      mockDb.tenantQuery
        .mockResolvedValueOnce([{ id: 300 }]) // 1 peer root
        .mockResolvedValue(undefined);

      await service.notifyApproved({
        tenantId: 7,
        requesterId: 100,
        requestId: 'req-uuid-5',
        approverId: 200,
        comment: 'Approved.',
      });

      expect(mockEventBus.emitRootSelfTerminationApproved).toHaveBeenCalledWith(
        7,
        { id: 'req-uuid-5', requesterId: 100, requesterName: 'Alice Root' },
        200,
        'Bob Root',
        'Approved.',
      );
      // 1 INSERT for requester + 1 INSERT for peer = 2
      expect(countSqlMatches(mockDb, 'INSERT INTO notifications')).toBe(2);
    });

    it('should pass null comment through unchanged', async () => {
      mockDb.tenantQueryOne.mockResolvedValueOnce(ALICE_ROW).mockResolvedValueOnce(BOB_ROW);
      mockDb.tenantQuery
        .mockResolvedValueOnce([]) // no peers
        .mockResolvedValue(undefined);

      await service.notifyApproved({
        tenantId: 7,
        requesterId: 100,
        requestId: 'req-uuid-6',
        approverId: 200,
        comment: null,
      });

      expect(mockEventBus.emitRootSelfTerminationApproved).toHaveBeenCalledWith(
        7,
        expect.any(Object),
        200,
        'Bob Root',
        null,
      );
      // Even with no peers, requester still gets a notification = 1 INSERT
      expect(countSqlMatches(mockDb, 'INSERT INTO notifications')).toBe(1);
    });

    it('should swallow user-lookup errors (top-level catch — emit is skipped)', async () => {
      // Symmetry with notifyRequested's identical test above. ADR-055 + §2.7
      // require notification fan-out to be NEVER-throws so a failed
      // recipient lookup cannot roll back the already-committed approve TX
      // (vacation pattern, masterplan v1.0.6 Spec Deviation D7). The catch
      // sits in the public method; verifying both notify* siblings closes
      // the symmetric coverage gap on this service (Codecov 84 % → ~95 %).
      mockDb.tenantQueryOne.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(
        service.notifyApproved({
          tenantId: 7,
          requesterId: 100,
          requestId: 'req-uuid-approved-err',
          approverId: 200,
          comment: 'irrelevant — lookup blew up first',
        }),
      ).resolves.toBeUndefined();

      // Lookup failed before emit — event must NOT have fired.
      expect(mockEventBus.emitRootSelfTerminationApproved).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // notifyRejected
  // -----------------------------------------------------------

  describe('notifyRejected()', () => {
    it('should emit + INSERT for requester only with computed cooldown', async () => {
      const rejectedAt = new Date('2026-04-27T10:00:00.000Z');
      mockDb.tenantQueryOne.mockResolvedValueOnce(ALICE_ROW).mockResolvedValueOnce(BOB_ROW);
      mockDb.tenantQuery.mockResolvedValue(undefined);

      await service.notifyRejected({
        tenantId: 7,
        requesterId: 100,
        requestId: 'req-uuid-7',
        approverId: 200,
        rejectionReason: 'Insufficient justification',
        rejectedAt,
      });

      const expectedCooldown = '2026-04-28T10:00:00.000Z'; // +24h
      expect(mockEventBus.emitRootSelfTerminationRejected).toHaveBeenCalledWith(
        7,
        { id: 'req-uuid-7', requesterId: 100, requesterName: 'Alice Root' },
        200,
        'Bob Root',
        'Insufficient justification',
        expectedCooldown,
      );
      // Only the requester gets a persistent row.
      expect(countSqlMatches(mockDb, 'INSERT INTO notifications')).toBe(1);
    });

    it('should not throw when persistent INSERT fails (inner catch)', async () => {
      mockDb.tenantQueryOne.mockResolvedValueOnce(ALICE_ROW).mockResolvedValueOnce(BOB_ROW);
      mockDb.tenantQuery.mockRejectedValue(new Error('insert failed'));

      await expect(
        service.notifyRejected({
          tenantId: 7,
          requesterId: 100,
          requestId: 'req-uuid-8',
          approverId: 200,
          rejectionReason: 'x',
          rejectedAt: new Date(),
        }),
      ).resolves.toBeUndefined();

      // Emit fired BEFORE the failing INSERT.
      expect(mockEventBus.emitRootSelfTerminationRejected).toHaveBeenCalledOnce();
    });
  });

  // -----------------------------------------------------------
  // UUID propagation
  // -----------------------------------------------------------

  describe('UUID propagation', () => {
    it('should pass mocked uuid v7 into the persistent INSERT params', async () => {
      mockDb.tenantQueryOne.mockResolvedValueOnce(ALICE_ROW);
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 200 }]).mockResolvedValue(undefined);

      await service.notifyRequested({
        tenantId: 7,
        requesterId: 100,
        requestId: 'req-uuid-9',
        expiresAt: '2026-05-04T00:00:00.000Z',
      });

      const insertCall = mockDb.tenantQuery.mock.calls.find(
        (call) =>
          typeof call[0] === 'string' && (call[0] as string).includes('INSERT INTO notifications'),
      );
      expect(insertCall).toBeDefined();
      expect(insertCall?.[1]).toEqual(expect.arrayContaining(['mock-notification-uuid']));
    });
  });
});
