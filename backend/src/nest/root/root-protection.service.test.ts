/**
 * Unit tests for RootProtectionService — Layer 2 of Root Account Protection
 * (masterplan §3 / Phase 3 / Session 7a, 2026-04-27).
 *
 * Mocked dependencies: DatabaseService, ActivityLoggerService.
 * No CLS context needed — the service receives actor + target by parameter
 * (matches §2.2 doc-comment "Why no ClsService injection").
 *
 * Coverage matrix (mapped 1:1 to §3 Phase 3 mandatory scenarios):
 *
 *   Cross-Root Guard (§3 list 1-8):
 *     - Root A → terminate Root B for each of 4 termination ops → Forbidden + audit
 *     - Root A → terminate Admin / Employee → allowed (no throw, no audit)
 *     - Admin / Employee → terminate Root → Forbidden (target.role drives the guard)
 *
 *   Last-Root Guard (§3 list 9-11):
 *     - 1 active root → fail
 *     - 2 active roots → ok
 *     - 1 active + 1 archived (is_active=3) → SQL filters to count=0 → fail
 *
 *   isTerminationOp (DoD §3 "every public method ≥1 happy + ≥1 failure"):
 *     - 4 termination ops (soft-delete / deactivate / demote / hard-delete) → true
 *     - non-root target → short-circuits to false
 *
 * Why this file exists separately from root.service.test.ts: the guard's
 * internal contract (audit-then-throw, action mapping, SQL filter exactness)
 * is its own concern — root.service.test.ts mocks the guard at the
 * boundary and only verifies the wiring (Session 4 pattern).
 *
 * @see backend/src/nest/root/root-protection.service.ts (target)
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §3 (mandatory list)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ForbiddenException, PreconditionFailedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import {
  type ProtectionActor,
  type ProtectionTargetUser,
  ROOT_PROTECTION_CODES,
  RootProtectionService,
} from './root-protection.service.js';

// =============================================================
// Fixtures — minimal shapes per ProtectionActor / ProtectionTargetUser.
// `as UserRole` not needed: 'root' | 'admin' | 'employee' are members
// of the union, so string literals satisfy the type directly.
// =============================================================

const TENANT = 7;

function rootTarget(
  id: number,
  overrides: Partial<ProtectionTargetUser> = {},
): ProtectionTargetUser {
  const base: ProtectionTargetUser = {
    id,
    tenantId: TENANT,
    role: 'root',
    isActive: IS_ACTIVE.ACTIVE,
  };
  return { ...base, ...overrides };
}

function adminTarget(id: number): ProtectionTargetUser {
  return { id, tenantId: TENANT, role: 'admin', isActive: IS_ACTIVE.ACTIVE };
}

function employeeTarget(id: number): ProtectionTargetUser {
  return { id, tenantId: TENANT, role: 'employee', isActive: IS_ACTIVE.ACTIVE };
}

function actor(id: number): ProtectionActor {
  return { id, tenantId: TENANT };
}

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    // assertNotLastRoot's no-client branch routes through systemQuery
    // (sys_user, BYPASSRLS — see service §2.2 doc-comment).
    systemQuery: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return {
    // auditDeniedAttempt invokes the generic .log() (NOT logCreate/logDelete)
    // because the action enum lacks 'denied' — see Phase 0 §0.5 finding.
    log: vi.fn().mockResolvedValue(undefined),
  };
}
type MockActivityLogger = ReturnType<typeof createMockActivityLogger>;

// =============================================================
// Test Suite
// =============================================================

describe('RootProtectionService', () => {
  let service: RootProtectionService;
  let mockDb: MockDb;
  let mockActivityLogger: MockActivityLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockActivityLogger = createMockActivityLogger();
    service = new RootProtectionService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // -----------------------------------------------------------
  // assertCrossRootTerminationForbidden — Cross-Root Guard
  // -----------------------------------------------------------

  describe('assertCrossRootTerminationForbidden', () => {
    it('blocks Root A → soft-delete Root B with full audit-entry shape', async () => {
      const a = actor(1);
      const b = rootTarget(2, { isActive: IS_ACTIVE.DELETED });

      await expect(
        service.assertCrossRootTerminationForbidden(a, b, 'soft-delete'),
      ).rejects.toMatchObject({
        constructor: ForbiddenException,
        response: {
          code: ROOT_PROTECTION_CODES.CROSS_ROOT_FORBIDDEN,
          message: expect.stringContaining('Root-Konten'),
        },
      });

      // Audit must be written exactly once with the canonical shape.
      // soft-delete → action='delete' (per service mapping: hard/soft → 'delete').
      expect(mockActivityLogger.log).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          tenantId: TENANT,
          userId: 1,
          action: 'delete',
          entityType: 'user',
          entityId: 2,
          details: expect.stringContaining('Root-Konto-Termination ABGELEHNT'),
          oldValues: expect.objectContaining({
            target_role: 'root',
            target_is_active: IS_ACTIVE.DELETED,
            termination_op: 'soft-delete',
          }),
        }),
      );
    });

    it('blocks Root A → deactivate Root B (action mapping: deactivate → update)', async () => {
      const a = actor(1);
      const b = rootTarget(2, { isActive: IS_ACTIVE.INACTIVE });

      await expect(
        service.assertCrossRootTerminationForbidden(a, b, 'deactivate'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          oldValues: expect.objectContaining({ termination_op: 'deactivate' }),
        }),
      );
    });

    it('blocks Root A → demote Root B (action mapping: demote → update)', async () => {
      const a = actor(1);
      const b = rootTarget(2);

      await expect(
        service.assertCrossRootTerminationForbidden(a, b, 'demote'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          oldValues: expect.objectContaining({ termination_op: 'demote' }),
        }),
      );
    });

    it('blocks Root A → hard-delete Root B (action mapping: hard-delete → delete)', async () => {
      const a = actor(1);
      const b = rootTarget(2);

      await expect(
        service.assertCrossRootTerminationForbidden(a, b, 'hard-delete'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          oldValues: expect.objectContaining({ termination_op: 'hard-delete' }),
        }),
      );
    });

    it('allows Root A → terminate Admin (no throw, no audit)', async () => {
      const a = actor(1);
      const adm = adminTarget(2);

      await expect(
        service.assertCrossRootTerminationForbidden(a, adm, 'soft-delete'),
      ).resolves.toBeUndefined();
      expect(mockActivityLogger.log).not.toHaveBeenCalled();
    });

    it('allows Root A → terminate Employee (no throw, no audit)', async () => {
      const a = actor(1);
      const emp = employeeTarget(2);

      await expect(
        service.assertCrossRootTerminationForbidden(a, emp, 'demote'),
      ).resolves.toBeUndefined();
      expect(mockActivityLogger.log).not.toHaveBeenCalled();
    });

    it('blocks Admin → terminate Root (target.role drives the guard, not actor.role)', async () => {
      // The service has no actor.role parameter — the guard fires whenever
      // actor.id !== target.id AND target.role === 'root'. Defense-in-depth:
      // even if @Roles('root') is bypassed at the controller layer, this guard
      // still protects the row.
      const adminActor = actor(99);
      const r = rootTarget(2);

      await expect(
        service.assertCrossRootTerminationForbidden(adminActor, r, 'demote'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockActivityLogger.log).toHaveBeenCalledOnce();
    });

    it('blocks Employee → terminate Root (defense-in-depth, see admin test)', async () => {
      const employeeActor = actor(50);
      const r = rootTarget(2);

      await expect(
        service.assertCrossRootTerminationForbidden(employeeActor, r, 'soft-delete'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockActivityLogger.log).toHaveBeenCalledOnce();
    });
  });

  // -----------------------------------------------------------
  // assertNotLastRoot — Last-Root Guard
  // -----------------------------------------------------------

  describe('assertNotLastRoot', () => {
    it('throws PreconditionFailed when terminating leaves zero active roots (1 active → 0)', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '0' }]);

      await expect(service.assertNotLastRoot(TENANT, 1)).rejects.toMatchObject({
        constructor: PreconditionFailedException,
        response: {
          code: ROOT_PROTECTION_CODES.LAST_ROOT,
        },
      });
    });

    it('passes when ≥1 other active root remains after exclusion (2 active → 1)', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '1' }]);

      await expect(service.assertNotLastRoot(TENANT, 1)).resolves.toBeUndefined();
    });

    it('SQL filters via is_active = ACTIVE — archived roots (is_active=3) do NOT count', async () => {
      // The DB-side filter is `is_active = IS_ACTIVE.ACTIVE` (= 1). For a
      // tenant with 1 active + 1 archived root, excluding the active one
      // leaves 0 matches. Mocked accordingly. We additionally inspect the
      // emitted SQL to regression-protect the filter (this is the only
      // line that prevents archived roots from masking the last-root).
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '0' }]);

      await expect(service.assertNotLastRoot(TENANT, 1)).rejects.toBeInstanceOf(
        PreconditionFailedException,
      );

      const [sql, params] = mockDb.systemQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
      expect(sql).toContain(`role = 'root'`);
      expect(sql).toContain('id <> $2');
      expect(params).toEqual([TENANT, 1]);
    });
  });

  // -----------------------------------------------------------
  // isTerminationOp — pure helper
  // -----------------------------------------------------------

  describe('isTerminationOp', () => {
    it('soft-delete: root with is_active 1 → 4 → true', () => {
      const before = rootTarget(1, { isActive: IS_ACTIVE.ACTIVE });
      const after = rootTarget(1, { isActive: IS_ACTIVE.DELETED });
      expect(service.isTerminationOp(before, after, 'soft-delete')).toBe(true);
    });

    it('deactivate: root with is_active 1 → 0 → true', () => {
      const before = rootTarget(1, { isActive: IS_ACTIVE.ACTIVE });
      const after = rootTarget(1, { isActive: IS_ACTIVE.INACTIVE });
      expect(service.isTerminationOp(before, after, 'deactivate')).toBe(true);
    });

    it('demote: root → admin role flip → true', () => {
      const before = rootTarget(1);
      const after: ProtectionTargetUser = { ...before, role: 'admin' };
      expect(service.isTerminationOp(before, after, 'demote')).toBe(true);
    });

    it('hard-delete: after === null on root → true', () => {
      const before = rootTarget(1);
      expect(service.isTerminationOp(before, null, 'hard-delete')).toBe(true);
    });

    it('non-root target short-circuits to false regardless of op', () => {
      // Per service contract: "Returns false when before.role !== 'root'
      // regardless of op — non-root targets are never under root protection."
      const adminBefore = adminTarget(1);
      expect(service.isTerminationOp(adminBefore, null, 'hard-delete')).toBe(false);
      expect(
        service.isTerminationOp(
          adminBefore,
          { ...adminBefore, isActive: IS_ACTIVE.DELETED },
          'soft-delete',
        ),
      ).toBe(false);

      const employeeBefore = employeeTarget(1);
      expect(
        service.isTerminationOp(employeeBefore, { ...employeeBefore, role: 'root' }, 'demote'),
      ).toBe(false);
    });
  });
});
