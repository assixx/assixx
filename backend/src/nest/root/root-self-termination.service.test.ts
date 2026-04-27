/**
 * Unit tests for RootSelfTerminationService — Layer 3 of Root Account
 * Protection (masterplan §3 / Phase 3 / Session 7b, 2026-04-27).
 *
 * Mocked deps: DatabaseService (tenantTransaction + tenantQueryOne +
 * tenantQuery + systemQuery), RootProtectionService (assertNotLastRoot),
 * ActivityLoggerService (log), RootSelfTerminationNotificationService
 * (notifyRequested/Approved/Rejected), eventBus (module mock — for the
 * cron's plain-string `root.self-termination.expired` emit per Session 6).
 *
 * Mock pattern: `tenantTransaction(cb)` invokes the callback with a queued
 * mockClient (`{ query: vi.fn() }`). Per-test mockClient.query queues drive
 * the in-TX SQL sequence in order. For the race test, two clients are
 * pre-queued to model FOR UPDATE serialization.
 *
 * Coverage matrix (1:1 with §3 mandatory list):
 *
 *   Self-Termination Lifecycle (18 items):
 *     1. requestSelfTermination — happy-path, INSERT row, expires NOW+7d, audit + notifyRequested
 *     2. ALREADY_PENDING — pending exists → ConflictException
 *     3. COOLDOWN_ACTIVE — rejection within 24h → ConflictException + cooldownEndsAt
 *     4. Cooldown 24h+1min after rejection → succeeds
 *     5. Last-root protection in request flow → PreconditionFailedException
 *     6. ROLE_FORBIDDEN — non-root actor → ForbiddenException, no DB call
 *     7. cancelOwnRequest — happy-path, status='cancelled', audit
 *     8. cancelOwnRequest — no pending row → NotFoundException
 *     9. approveSelfTermination — SELF_DECISION_FORBIDDEN
 *    10. approveSelfTermination — NOT_FOUND (lock returns no row)
 *    11. approveSelfTermination — NOT_PENDING (already approved/rejected/expired/cancelled)
 *    12. approveSelfTermination — EXPIRED (expires_at past)
 *    13. approveSelfTermination — happy-path, TX call ordering, GUC + UPDATE users, audit + notifyApproved
 *    14. rejectSelfTermination — happy-path, rejected_at parametrised (Session 6 fix), audit + notifyRejected
 *    15. rejectSelfTermination — REJECTION_REASON_REQUIRED (whitespace-only)
 *    16. rejectSelfTermination — NOT_FOUND
 *    17. rejectSelfTermination — SELF_DECISION_FORBIDDEN
 *    18. expireOldRequests — sweeps pending past expires_at; non-pending untouched (verified via SQL inspection)
 *
 *   Race / Concurrency (2 items):
 *    19. Parallel approve — first wins, second sees 'approved' and throws NOT_PENDING
 *    20. Approve TX rollback — UPDATE users throws → notifyApproved NOT called
 *
 *   Read-only contract verification (3 items, DoD coverage of remaining methods):
 *    21. getMyPendingRequest — returns null when no pending
 *    22. getMostRecentRejection — returns domain row when found
 *    23. getPendingRequestsForApproval — excludes self via SQL `requester_id <> $1`
 *
 *   approveSelfTermination — extra:
 *    24. Last-root in approve TX → PreconditionFailedException, UPDATE users NOT called
 *
 * @see backend/src/nest/root/root-self-termination.service.ts (target)
 * @see backend/src/nest/root/root-protection.service.test.ts (sibling — Session 7a)
 * @see backend/src/nest/root/root-self-termination-notification.service.test.ts (sibling — Session 6)
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §3 (mandatory list)
 */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import type { QueryResult } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { RootProtectionService } from './root-protection.service.js';
import type { RootSelfTerminationNotificationService } from './root-self-termination-notification.service.js';
import {
  ROOT_SELF_TERMINATION_CODES,
  RootSelfTerminationService,
  type SelfTerminationActor,
} from './root-self-termination.service.js';

// =============================================================
// Module mocks — eventBus is used only by the cron path
// (`root.self-termination.expired`, Session 6 spec strict-adherence).
// =============================================================

const mockEventBus = vi.hoisted(() => ({
  emit: vi.fn(),
  emitRootSelfTerminationRequested: vi.fn(),
  emitRootSelfTerminationApproved: vi.fn(),
  emitRootSelfTerminationRejected: vi.fn(),
}));

vi.mock('../../utils/event-bus.js', () => ({
  eventBus: mockEventBus,
}));

// =============================================================
// Constants + fixtures
// =============================================================

const TENANT = 7;
const ACTOR_ID = 100;
const PEER_ACTOR_ID = 200;
const REQUESTER_ID = 100;
const REQUEST_ID = 'req-uuid-abc';

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function rootActor(id: number = ACTOR_ID): SelfTerminationActor {
  return { id, tenantId: TENANT, role: 'root' };
}

function adminActor(id: number = 99): SelfTerminationActor {
  return { id, tenantId: TENANT, role: 'admin' };
}

interface RequestRowShape {
  id: string;
  tenant_id: number;
  requester_id: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  expires_at: Date;
  approved_by: number | null;
  approved_at: Date | null;
  rejected_by: number | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

function makeRow(overrides: Partial<RequestRowShape> = {}): RequestRowShape {
  const now = new Date();
  return {
    id: REQUEST_ID,
    tenant_id: TENANT,
    requester_id: REQUESTER_ID,
    reason: null,
    status: 'pending',
    expires_at: new Date(Date.now() + SEVEN_DAYS_MS),
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    is_active: 1,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function qResult<T>(rows: T[]): QueryResult<T> {
  // Minimal QueryResult shape — only `rows` is consumed by the service.
  return { rows, command: '', rowCount: rows.length, oid: 0, fields: [] } as QueryResult<T>;
}

// =============================================================
// Mock factories
// =============================================================

interface MockClient {
  query: ReturnType<typeof vi.fn>;
}

function createMockClient(): MockClient {
  return { query: vi.fn() };
}

interface MockDb {
  tenantTransaction: ReturnType<typeof vi.fn>;
  tenantQueryOne: ReturnType<typeof vi.fn>;
  tenantQuery: ReturnType<typeof vi.fn>;
  systemQuery: ReturnType<typeof vi.fn>;
}

function createMockDb(): MockDb {
  return {
    tenantTransaction: vi.fn(),
    tenantQueryOne: vi.fn(),
    tenantQuery: vi.fn(),
    systemQuery: vi.fn(),
  };
}

interface MockRootProtection {
  assertNotLastRoot: ReturnType<typeof vi.fn>;
}

function createMockRootProtection(): MockRootProtection {
  return { assertNotLastRoot: vi.fn().mockResolvedValue(undefined) };
}

interface MockActivityLogger {
  log: ReturnType<typeof vi.fn>;
}

function createMockActivityLogger(): MockActivityLogger {
  return { log: vi.fn().mockResolvedValue(undefined) };
}

interface MockNotification {
  notifyRequested: ReturnType<typeof vi.fn>;
  notifyApproved: ReturnType<typeof vi.fn>;
  notifyRejected: ReturnType<typeof vi.fn>;
}

function createMockNotification(): MockNotification {
  return {
    notifyRequested: vi.fn().mockResolvedValue(undefined),
    notifyApproved: vi.fn().mockResolvedValue(undefined),
    notifyRejected: vi.fn().mockResolvedValue(undefined),
  };
}

// =============================================================
// Test Suite
// =============================================================

describe('RootSelfTerminationService', () => {
  let service: RootSelfTerminationService;
  let mockDb: MockDb;
  let mockRootProtection: MockRootProtection;
  let mockActivityLogger: MockActivityLogger;
  let mockNotification: MockNotification;
  let mockClient: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockRootProtection = createMockRootProtection();
    mockActivityLogger = createMockActivityLogger();
    mockNotification = createMockNotification();
    mockClient = createMockClient();

    // Default: tenantTransaction passes our shared mockClient into the
    // callback. Race test (test 19) overrides with a multi-client variant.
    mockDb.tenantTransaction.mockImplementation(async (cb: (c: MockClient) => Promise<unknown>) =>
      cb(mockClient),
    );

    service = new RootSelfTerminationService(
      mockDb as unknown as DatabaseService,
      mockRootProtection as unknown as RootProtectionService,
      mockActivityLogger as unknown as ActivityLoggerService,
      mockNotification as unknown as RootSelfTerminationNotificationService,
    );
  });

  // -----------------------------------------------------------
  // requestSelfTermination — §3 list 1-6
  // -----------------------------------------------------------

  describe('requestSelfTermination', () => {
    it('happy-path: cooldown empty + no-pending + not-last → INSERT, audit, notifyRequested fan-out', async () => {
      const insertedRow = makeRow({ status: 'pending' });
      mockClient.query
        .mockResolvedValueOnce(qResult<RequestRowShape>([])) // assertCooldownPassed: no rejection
        .mockResolvedValueOnce(qResult<RequestRowShape>([])) // assertNoPendingRequest: empty
        .mockResolvedValueOnce(qResult<RequestRowShape>([insertedRow])); // INSERT RETURNING *

      const result = await service.requestSelfTermination(rootActor(), 'Quitting role.');

      expect(result.id).toBe(REQUEST_ID);
      expect(result.status).toBe('pending');
      expect(result.requesterId).toBe(REQUESTER_ID);
      expect(result.tenantId).toBe(TENANT);

      // assertNotLastRoot called inside TX, before INSERT
      expect(mockRootProtection.assertNotLastRoot).toHaveBeenCalledExactlyOnceWith(
        TENANT,
        ACTOR_ID,
        mockClient,
      );

      // 3 client.query calls: cooldown, no-pending, INSERT
      expect(mockClient.query).toHaveBeenCalledTimes(3);
      const insertCall = mockClient.query.mock.calls[2] as [string, unknown[]];
      expect(insertCall[0]).toContain('INSERT INTO root_self_termination_requests');
      // expires_at param is now + 7d (~within 1s tolerance)
      const expiresParam = insertCall[1][3] as Date;
      const sevenDaysLater = Date.now() + SEVEN_DAYS_MS;
      expect(expiresParam.getTime()).toBeGreaterThan(sevenDaysLater - 1000);
      expect(expiresParam.getTime()).toBeLessThan(sevenDaysLater + 1000);

      // audit + notification fan-out
      expect(mockActivityLogger.log).toHaveBeenCalledOnce();
      expect(mockNotification.notifyRequested).toHaveBeenCalledExactlyOnceWith({
        tenantId: TENANT,
        requesterId: REQUESTER_ID,
        requestId: REQUEST_ID,
        expiresAt: insertedRow.expires_at.toISOString(),
      });
    });

    it('blocks ALREADY_PENDING when a pending row already exists', async () => {
      mockClient.query
        .mockResolvedValueOnce(qResult<RequestRowShape>([])) // cooldown empty
        .mockResolvedValueOnce(qResult<{ id: string }>([{ id: REQUEST_ID }])); // pending exists

      await expect(service.requestSelfTermination(rootActor(), null)).rejects.toMatchObject({
        constructor: ConflictException,
        response: {
          code: ROOT_SELF_TERMINATION_CODES.ALREADY_PENDING,
        },
      });

      // Must NOT proceed to INSERT or notifyRequested
      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockNotification.notifyRequested).not.toHaveBeenCalled();
    });

    it('blocks COOLDOWN_ACTIVE when last rejection is within 24h, exposing cooldownEndsAt', async () => {
      const rejectedAt = new Date(Date.now() - 23 * 60 * 60 * 1000); // 23h ago
      mockClient.query.mockResolvedValueOnce(
        qResult<RequestRowShape>([
          makeRow({ status: 'rejected', rejected_at: rejectedAt, rejected_by: PEER_ACTOR_ID }),
        ]),
      );

      const expectedCooldownEnd = new Date(rejectedAt.getTime() + COOLDOWN_MS).toISOString();

      await expect(service.requestSelfTermination(rootActor(), null)).rejects.toMatchObject({
        constructor: ConflictException,
        response: {
          code: ROOT_SELF_TERMINATION_CODES.COOLDOWN_ACTIVE,
          cooldownEndsAt: expectedCooldownEnd,
        },
      });

      // No further DB work after the cooldown fail-fast
      expect(mockClient.query).toHaveBeenCalledOnce();
      expect(mockNotification.notifyRequested).not.toHaveBeenCalled();
    });

    it('proceeds when last rejection is older than 24h (cooldown expired)', async () => {
      const rejectedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago
      const insertedRow = makeRow({ status: 'pending' });
      mockClient.query
        .mockResolvedValueOnce(
          qResult<RequestRowShape>([
            makeRow({ status: 'rejected', rejected_at: rejectedAt, rejected_by: PEER_ACTOR_ID }),
          ]),
        ) // cooldown — found, but expired
        .mockResolvedValueOnce(qResult<RequestRowShape>([])) // no pending
        .mockResolvedValueOnce(qResult<RequestRowShape>([insertedRow])); // INSERT

      const result = await service.requestSelfTermination(rootActor(), null);

      expect(result.status).toBe('pending');
      expect(mockNotification.notifyRequested).toHaveBeenCalledOnce();
    });

    it('propagates PreconditionFailedException from assertNotLastRoot (last root in tenant)', async () => {
      mockClient.query
        .mockResolvedValueOnce(qResult<RequestRowShape>([])) // cooldown empty
        .mockResolvedValueOnce(qResult<RequestRowShape>([])); // no pending
      mockRootProtection.assertNotLastRoot.mockRejectedValueOnce(
        new PreconditionFailedException({
          code: 'ROOT_LAST_ROOT_PROTECTION',
          message: 'last root',
        }),
      );

      await expect(service.requestSelfTermination(rootActor(), null)).rejects.toBeInstanceOf(
        PreconditionFailedException,
      );

      // INSERT must NOT have run
      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockNotification.notifyRequested).not.toHaveBeenCalled();
    });

    it('blocks ROLE_FORBIDDEN when non-root actor calls — guard fires before any DB work', async () => {
      await expect(service.requestSelfTermination(adminActor(), null)).rejects.toMatchObject({
        constructor: ForbiddenException,
        response: { code: ROOT_SELF_TERMINATION_CODES.ROLE_FORBIDDEN },
      });

      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
      expect(mockClient.query).not.toHaveBeenCalled();
      expect(mockNotification.notifyRequested).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // cancelOwnRequest — §3 list 7-8
  // -----------------------------------------------------------

  describe('cancelOwnRequest', () => {
    it('happy-path: UPDATE returns row → status flipped to cancelled + audit', async () => {
      const cancelledRow = makeRow({ status: 'cancelled' });
      mockClient.query.mockResolvedValueOnce(qResult<RequestRowShape>([cancelledRow]));

      await service.cancelOwnRequest(rootActor());

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain(`SET status = 'cancelled'`);
      expect(sql).toContain(`WHERE requester_id = $1 AND status = 'pending'`);
      expect(mockActivityLogger.log).toHaveBeenCalledOnce();
    });

    it('throws NOT_FOUND when no pending row exists', async () => {
      mockClient.query.mockResolvedValueOnce(qResult<RequestRowShape>([]));

      await expect(service.cancelOwnRequest(rootActor())).rejects.toMatchObject({
        constructor: NotFoundException,
        response: { code: ROOT_SELF_TERMINATION_CODES.NOT_FOUND },
      });

      expect(mockActivityLogger.log).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // approveSelfTermination — §3 list 9-13 + extra last-root
  // -----------------------------------------------------------

  describe('approveSelfTermination', () => {
    it('blocks SELF_DECISION_FORBIDDEN when actor.id === request.requester_id', async () => {
      const ownRequest = makeRow({ requester_id: PEER_ACTOR_ID });
      mockClient.query.mockResolvedValueOnce(qResult<RequestRowShape>([ownRequest]));

      const peer = rootActor(PEER_ACTOR_ID);
      await expect(service.approveSelfTermination(peer, REQUEST_ID)).rejects.toMatchObject({
        constructor: ForbiddenException,
        response: { code: ROOT_SELF_TERMINATION_CODES.SELF_DECISION_FORBIDDEN },
      });

      expect(mockNotification.notifyApproved).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND when lockRequestForDecision finds no row (RLS or wrong id)', async () => {
      mockClient.query.mockResolvedValueOnce(qResult<RequestRowShape>([]));

      await expect(
        service.approveSelfTermination(rootActor(PEER_ACTOR_ID), 'missing-id'),
      ).rejects.toMatchObject({
        constructor: NotFoundException,
        response: { code: ROOT_SELF_TERMINATION_CODES.NOT_FOUND },
      });
    });

    it('throws NOT_PENDING when request was already decided (approved/rejected/expired/cancelled)', async () => {
      const alreadyApproved = makeRow({ status: 'approved' });
      mockClient.query.mockResolvedValueOnce(qResult<RequestRowShape>([alreadyApproved]));

      await expect(
        service.approveSelfTermination(rootActor(PEER_ACTOR_ID), REQUEST_ID),
      ).rejects.toMatchObject({
        constructor: ConflictException,
        response: { code: ROOT_SELF_TERMINATION_CODES.NOT_PENDING },
      });

      expect(mockNotification.notifyApproved).not.toHaveBeenCalled();
    });

    it('throws EXPIRED when expires_at is in the past (cron lag window)', async () => {
      const expired = makeRow({
        status: 'pending',
        expires_at: new Date(Date.now() - 60_000), // 1 min in past
      });
      mockClient.query.mockResolvedValueOnce(qResult<RequestRowShape>([expired]));

      await expect(
        service.approveSelfTermination(rootActor(PEER_ACTOR_ID), REQUEST_ID),
      ).rejects.toMatchObject({
        constructor: ConflictException,
        response: { code: ROOT_SELF_TERMINATION_CODES.EXPIRED },
      });
    });

    it('happy-path: TX ordering = lock → users-lock → recount → flip → set_config → UPDATE users; then notifyApproved', async () => {
      const pendingRow = makeRow({ status: 'pending' });
      mockClient.query
        .mockResolvedValueOnce(qResult<RequestRowShape>([pendingRow])) // (1) lockRequestForDecision
        .mockResolvedValueOnce(qResult<{ id: number }>([])) // (2) lock root rows FOR UPDATE
        .mockResolvedValueOnce(qResult<RequestRowShape>([])) // (3) UPDATE status='approved'
        .mockResolvedValueOnce(qResult<RequestRowShape>([])) // (4) SELECT set_config(...)
        .mockResolvedValueOnce(qResult<RequestRowShape>([])); // (5) UPDATE users SET is_active = 4

      const peer = rootActor(PEER_ACTOR_ID);
      await service.approveSelfTermination(peer, REQUEST_ID, 'LGTM');

      // Verify ordering — explicit assertion that the TX sequence matches §2.4 spec.
      // Full SQL kept (no slice) so trailing FOR UPDATE / set_config substrings remain matchable.
      const calls = mockClient.query.mock.calls.map((c) => (c[0] as string).trim());
      expect(calls[0]).toContain('SELECT * FROM root_self_termination_requests');
      expect(calls[0]).toContain('FOR UPDATE');
      expect(calls[1]).toContain('SELECT id FROM users');
      expect(calls[1]).toContain('FOR UPDATE');
      expect(calls[2]).toContain(`status = 'approved'`);
      expect(calls[3]).toContain(`set_config('app.root_self_termination_approved'`);
      expect(calls[4]).toContain('UPDATE users SET is_active');

      // Recount called between users-lock and status flip
      expect(mockRootProtection.assertNotLastRoot).toHaveBeenCalledExactlyOnceWith(
        TENANT,
        REQUESTER_ID,
        mockClient,
      );

      // Audit + notification fan-out (post-commit)
      expect(mockActivityLogger.log).toHaveBeenCalledOnce();
      expect(mockNotification.notifyApproved).toHaveBeenCalledExactlyOnceWith({
        tenantId: TENANT,
        requesterId: REQUESTER_ID,
        requestId: REQUEST_ID,
        approverId: PEER_ACTOR_ID,
        comment: 'LGTM',
      });
    });

    it('propagates last-root protection from inside approve TX → users UPDATE never fires', async () => {
      const pendingRow = makeRow({ status: 'pending' });
      mockClient.query
        .mockResolvedValueOnce(qResult<RequestRowShape>([pendingRow])) // lock request
        .mockResolvedValueOnce(qResult<{ id: number }>([])); // lock root rows
      mockRootProtection.assertNotLastRoot.mockRejectedValueOnce(
        new PreconditionFailedException({
          code: 'ROOT_LAST_ROOT_PROTECTION',
          message: 'last root',
        }),
      );

      await expect(
        service.approveSelfTermination(rootActor(PEER_ACTOR_ID), REQUEST_ID),
      ).rejects.toBeInstanceOf(PreconditionFailedException);

      // Status flip + UPDATE users + notifyApproved must NOT have run.
      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockNotification.notifyApproved).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // rejectSelfTermination — §3 list 14-17
  // -----------------------------------------------------------

  describe('rejectSelfTermination', () => {
    it('happy-path: UPDATE with parametrised rejected_at (Session 6 fix); notifyRejected receives same Date', async () => {
      const pendingRow = makeRow({ status: 'pending' });
      mockClient.query
        .mockResolvedValueOnce(qResult<RequestRowShape>([pendingRow])) // lock
        .mockResolvedValueOnce(qResult<RequestRowShape>([])); // UPDATE rejected

      const peer = rootActor(PEER_ACTOR_ID);
      await service.rejectSelfTermination(peer, REQUEST_ID, '   Insufficient justification   ');

      // The UPDATE call must use $2-parametrised rejected_at, not NOW().
      const updateCall = mockClient.query.mock.calls[1] as [string, unknown[]];
      expect(updateCall[0]).toContain('rejected_at = $2');
      expect(updateCall[0]).not.toContain('rejected_at = NOW()');
      const sqlRejectedAt = updateCall[1][1];
      expect(sqlRejectedAt).toBeInstanceOf(Date);

      // notifyRejected must receive the EXACT same Date object reference —
      // proves the Session 6 invariant "zero clock drift between DB row and
      // notification payload".
      expect(mockNotification.notifyRejected).toHaveBeenCalledOnce();
      const notifyArg = mockNotification.notifyRejected.mock.calls[0]?.[0] as {
        rejectedAt: Date;
        rejectionReason: string;
      };
      expect(notifyArg.rejectedAt).toBe(sqlRejectedAt);
      expect(notifyArg.rejectionReason).toBe('   Insufficient justification   ');

      expect(mockActivityLogger.log).toHaveBeenCalledOnce();
    });

    it('blocks REJECTION_REASON_REQUIRED on whitespace-only reason — no DB call, no notification', async () => {
      const peer = rootActor(PEER_ACTOR_ID);
      await expect(service.rejectSelfTermination(peer, REQUEST_ID, '   ')).rejects.toMatchObject({
        constructor: ConflictException,
        response: { code: ROOT_SELF_TERMINATION_CODES.REJECTION_REASON_REQUIRED },
      });

      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
      expect(mockNotification.notifyRejected).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND when lockRequestForDecision finds no row', async () => {
      mockClient.query.mockResolvedValueOnce(qResult<RequestRowShape>([]));

      await expect(
        service.rejectSelfTermination(rootActor(PEER_ACTOR_ID), 'missing-id', 'reason'),
      ).rejects.toMatchObject({
        constructor: NotFoundException,
        response: { code: ROOT_SELF_TERMINATION_CODES.NOT_FOUND },
      });
    });

    it('blocks SELF_DECISION_FORBIDDEN when rejector is the requester', async () => {
      const ownRequest = makeRow({ requester_id: ACTOR_ID });
      mockClient.query.mockResolvedValueOnce(qResult<RequestRowShape>([ownRequest]));

      await expect(
        service.rejectSelfTermination(rootActor(ACTOR_ID), REQUEST_ID, 'reason'),
      ).rejects.toMatchObject({
        constructor: ForbiddenException,
        response: { code: ROOT_SELF_TERMINATION_CODES.SELF_DECISION_FORBIDDEN },
      });

      expect(mockNotification.notifyRejected).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // expireOldRequests — §3 list 18
  // -----------------------------------------------------------

  describe('expireOldRequests', () => {
    it('sweeps pending rows past expires_at via systemQuery; emits event + audit per row; non-pending untouched (verified via SQL filter)', async () => {
      const expiredRows: RequestRowShape[] = [
        makeRow({ id: 'req-1', status: 'expired', expires_at: new Date(Date.now() - 1000) }),
        makeRow({
          id: 'req-2',
          requester_id: 999,
          status: 'expired',
          expires_at: new Date(Date.now() - 2000),
        }),
      ];
      mockDb.systemQuery.mockResolvedValueOnce(expiredRows);

      const count = await service.expireOldRequests();

      expect(count).toBe(2);

      // SQL filter regression-protects "non-pending untouched" — without
      // `status = 'pending'` predicate, already-decided requests would be
      // re-flipped on every cron run.
      const sql = mockDb.systemQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain(`SET status = 'expired'`);
      expect(sql).toContain(`WHERE status = 'pending'`);
      expect(sql).toContain('expires_at < NOW()');

      // 1 emit + 1 audit per row → 2 + 2 = 4 cross-table writes total
      expect(mockEventBus.emit).toHaveBeenCalledTimes(2);
      expect(mockEventBus.emit).toHaveBeenNthCalledWith(1, 'root.self-termination.expired', {
        tenantId: TENANT,
        requestId: 'req-1',
        requesterId: REQUESTER_ID,
      });
      expect(mockEventBus.emit).toHaveBeenNthCalledWith(2, 'root.self-termination.expired', {
        tenantId: TENANT,
        requestId: 'req-2',
        requesterId: 999,
      });
      expect(mockActivityLogger.log).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------
  // Race / Concurrency — §3 list 19-20
  // -----------------------------------------------------------

  describe('Race / Concurrency', () => {
    it('parallel approve: first wins, second sees status=approved → NOT_PENDING (FOR UPDATE serialization)', async () => {
      // Two clients model the post-FOR-UPDATE state as seen by two
      // concurrent approvers. Real PG would block client B on the FOR
      // UPDATE lock until client A commits; the unit-test models the
      // post-lock visible state directly.
      const clientA = createMockClient();
      const clientB = createMockClient();
      let txCount = 0;
      mockDb.tenantTransaction.mockImplementation(
        async (cb: (c: MockClient) => Promise<unknown>) => {
          const c = txCount++ === 0 ? clientA : clientB;
          return cb(c);
        },
      );

      // A: lock returns pending → all subsequent steps succeed
      const pendingA = makeRow({ status: 'pending' });
      clientA.query
        .mockResolvedValueOnce(qResult<RequestRowShape>([pendingA])) // lock
        .mockResolvedValueOnce(qResult<{ id: number }>([])) // users lock
        .mockResolvedValueOnce(qResult<RequestRowShape>([])) // UPDATE approved
        .mockResolvedValueOnce(qResult<RequestRowShape>([])) // set_config
        .mockResolvedValueOnce(qResult<RequestRowShape>([])); // UPDATE users

      // B: lock returns the now-approved row → assertCanDecide throws NOT_PENDING
      const approvedB = makeRow({ status: 'approved', approved_by: PEER_ACTOR_ID });
      clientB.query.mockResolvedValueOnce(qResult<RequestRowShape>([approvedB]));

      const peerA = rootActor(PEER_ACTOR_ID);
      const peerB = rootActor(300);

      const results = await Promise.allSettled([
        service.approveSelfTermination(peerA, REQUEST_ID),
        service.approveSelfTermination(peerB, REQUEST_ID),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const failure = rejected[0] as PromiseRejectedResult;
      expect(failure.reason).toMatchObject({
        constructor: ConflictException,
        response: { code: ROOT_SELF_TERMINATION_CODES.NOT_PENDING },
      });

      // Exactly one notification fan-out (winner only)
      expect(mockNotification.notifyApproved).toHaveBeenCalledOnce();
    });

    it('approve TX rollback: mid-TX UPDATE failure → outer reject + notifyApproved NOT called (out-of-TX placement R9 mitigation)', async () => {
      const pendingRow = makeRow({ status: 'pending' });
      mockClient.query
        .mockResolvedValueOnce(qResult<RequestRowShape>([pendingRow])) // lock
        .mockResolvedValueOnce(qResult<{ id: number }>([])) // users lock
        .mockResolvedValueOnce(qResult<RequestRowShape>([])) // UPDATE approved
        .mockResolvedValueOnce(qResult<RequestRowShape>([])) // set_config
        .mockRejectedValueOnce(new Error('users-table write failure')); // UPDATE users throws

      // Real PG rolls back the whole TX on this throw — the request row
      // flip is undone and the GUC clears (is_local=true). Our mock can't
      // simulate that; what we CAN verify is that the outer service
      // rejects and the post-commit notification fan-out never fires.
      await expect(
        service.approveSelfTermination(rootActor(PEER_ACTOR_ID), REQUEST_ID),
      ).rejects.toThrow('users-table write failure');

      expect(mockNotification.notifyApproved).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // Read-only contract verification — §3 DoD coverage
  // -----------------------------------------------------------

  describe('getMyPendingRequest', () => {
    it('returns null when no pending row exists for the actor', async () => {
      mockDb.tenantQueryOne.mockResolvedValueOnce(null);

      const result = await service.getMyPendingRequest(rootActor());

      expect(result).toBeNull();
      const sqlCall = mockDb.tenantQueryOne.mock.calls[0] as [string, unknown[]];
      expect(sqlCall[0]).toContain(`status = 'pending'`);
      expect(sqlCall[1]).toEqual([ACTOR_ID]);
    });
  });

  describe('getMostRecentRejection', () => {
    it('returns the most recent rejected request mapped to domain shape', async () => {
      const rejectedAt = new Date('2026-04-20T10:00:00.000Z');
      const row = makeRow({
        status: 'rejected',
        rejected_at: rejectedAt,
        rejected_by: PEER_ACTOR_ID,
        rejection_reason: 'No good reason',
      });
      mockDb.tenantQueryOne.mockResolvedValueOnce(row);

      const result = await service.getMostRecentRejection(ACTOR_ID);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('rejected');
      expect(result?.rejectedAt).toBe(rejectedAt);
      expect(result?.rejectionReason).toBe('No good reason');

      const sql = mockDb.tenantQueryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain(`status = 'rejected'`);
      expect(sql).toContain('ORDER BY rejected_at DESC');
    });
  });

  describe('getPendingRequestsForApproval', () => {
    it('SQL excludes self via `requester_id <> $1` and filters expired rows out', async () => {
      const peerRow = makeRow({ id: 'peer-req', requester_id: 999 });
      mockDb.tenantQuery.mockResolvedValueOnce([peerRow]);

      const result = await service.getPendingRequestsForApproval(rootActor());

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('peer-req');

      const sqlCall = mockDb.tenantQuery.mock.calls[0] as [string, unknown[]];
      expect(sqlCall[0]).toContain(`status = 'pending'`);
      expect(sqlCall[0]).toContain('requester_id <> $1');
      expect(sqlCall[0]).toContain('expires_at > NOW()');
      expect(sqlCall[1]).toEqual([ACTOR_ID]);
    });
  });
});
