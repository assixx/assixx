/**
 * Unit tests for RoleSwitchService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Role switching with security checks, JWT generation,
 *        ForbiddenException for unauthorized roles, getStatus (pure).
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { RoleSwitchService } from './role-switch.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const qf = vi.fn();
  const qof = vi.fn();
  return {
    query: qf,
    tenantQuery: qf,
    queryOne: qof,
    tenantQueryOne: qof,
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

// =============================================================
// Mock factories
// =============================================================

function createMockJwtService() {
  return {
    sign: vi.fn().mockReturnValue('mock-jwt-token'),
  };
}

function makeUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    username: 'admin@example.com',
    email: 'admin@example.com',
    role: 'admin',
    tenant_id: 10,
    position: null,
    ...overrides,
  };
}

// =============================================================
// RoleSwitchService
// =============================================================

/**
 * Helper: a valid future `exp` claim (Unix seconds) to pass as `preserveExp`.
 * Role-switch preserves the caller's session lifetime instead of minting a
 * fresh 30-min token (see RoleSwitchService.generateToken docstring). The
 * tests use a fixed 20-min-in-the-future value so the resulting `expiresIn`
 * is a finite positive number for the sign-options assertion.
 */
const validPreserveExp = (): number => Math.floor(Date.now() / 1000) + 1200;

describe('SECURITY: RoleSwitchService', () => {
  let service: RoleSwitchService;
  let mockJwtService: ReturnType<typeof createMockJwtService>;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwtService = createMockJwtService();
    mockDb = createMockDb();
    service = new RoleSwitchService(mockJwtService as never, mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // switchToEmployee
  // =============================================================

  describe('switchToEmployee', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.switchToEmployee(999, 10, validPreserveExp())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for employee user', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'employee' })]);

      await expect(service.switchToEmployee(1, 10, validPreserveExp())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should switch admin to employee view', async () => {
      // verifyUserTenant
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'admin' })]);
      // logRoleSwitch
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.switchToEmployee(1, 10, validPreserveExp());

      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.activeRole).toBe('employee');
      expect(result.user.isRoleSwitched).toBe(true);
      expect(result.message).toBe('Successfully switched to employee view');
      // Second arg carries the caller's remaining session time (preserveExp - now)
      // via `expiresIn`, overriding the JwtModule 30-min default so role-switch
      // does not extend the session. Any finite positive number is acceptable —
      // the exact value depends on clock drift between test setup and the call.
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          activeRole: 'employee',
          isRoleSwitched: true,
        }),
        expect.objectContaining({ expiresIn: expect.any(Number) as number }),
      );
    });

    it('should succeed even when audit logging fails', async () => {
      // verifyUserTenant
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'admin' })]);
      // logRoleSwitch — fails
      mockDb.query.mockRejectedValueOnce(new Error('Audit DB error'));

      const result = await service.switchToEmployee(1, 10, validPreserveExp());

      expect(result.token).toBe('mock-jwt-token');
    });
  });

  // =============================================================
  // switchToOriginal
  // =============================================================

  describe('switchToOriginal', () => {
    it('should switch back to original role', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'admin' })]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.switchToOriginal(1, 10, validPreserveExp());

      expect(result.user.activeRole).toBe('admin');
      expect(result.user.isRoleSwitched).toBe(false);
    });

    it('should throw ForbiddenException for employee', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'employee' })]);

      await expect(service.switchToOriginal(1, 10, validPreserveExp())).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // =============================================================
  // rootToAdmin
  // =============================================================

  describe('rootToAdmin', () => {
    it('should throw ForbiddenException for non-root user', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'admin' })]);

      await expect(service.rootToAdmin(1, 10, validPreserveExp())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should switch root to admin view', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'root' })]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.rootToAdmin(1, 10, validPreserveExp());

      expect(result.user.activeRole).toBe('admin');
      expect(result.user.role).toBe('root');
      expect(result.user.isRoleSwitched).toBe(true);
    });
  });

  // =============================================================
  // preserveExp — session-lifetime continuity across role-switch
  // (ADR-046 amendment, Bug E)
  // =============================================================

  describe('SECURITY: session-lifetime preservation (preserveExp)', () => {
    it('should sign new token with remainingSeconds derived from preserveExp', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'admin' })]);
      mockDb.query.mockResolvedValueOnce([]);

      // Caller's token still has exactly 900 seconds of life left.
      const preserveExp = Math.floor(Date.now() / 1000) + 900;
      await service.switchToEmployee(1, 10, preserveExp);

      // Delta of ±2s absorbs any clock drift between arrange and sign-call.
      const signCall = mockJwtService.sign.mock.calls[0];
      expect(signCall).toBeDefined();
      const options = signCall?.[1] as { expiresIn: number } | undefined;
      expect(options).toBeDefined();
      expect(options?.expiresIn).toBeGreaterThanOrEqual(898);
      expect(options?.expiresIn).toBeLessThanOrEqual(900);
    });

    it('should floor expiresIn at 1s when caller token is already expired', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'root' })]);
      mockDb.query.mockResolvedValueOnce([]);

      // Past exp — guard would normally reject such a token upstream, but a
      // sub-second race between guard acceptance and role-switch hitting the
      // service could leave us negative. The floor prevents jsonwebtoken from
      // throwing on a non-positive expiresIn; the new token dies immediately
      // and the client hits the standard expired-session flow.
      const expiredExp = Math.floor(Date.now() / 1000) - 10;
      await service.rootToAdmin(1, 10, expiredExp);

      const options = mockJwtService.sign.mock.calls[0]?.[1] as { expiresIn: number } | undefined;
      expect(options?.expiresIn).toBe(1);
    });

    it('should NOT extend session on repeated role-switches (anti-bypass)', async () => {
      // Each role-switch MUST inherit the ever-shrinking remaining time —
      // never reset to a fresh 30m — otherwise users can bypass inactivity
      // timeout by periodically clicking role-switch.
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'admin' })]);
      mockDb.query.mockResolvedValueOnce([]);

      const initialExp = Math.floor(Date.now() / 1000) + 500;
      await service.switchToEmployee(1, 10, initialExp);

      const firstOptions = mockJwtService.sign.mock.calls[0]?.[1] as
        | { expiresIn: number }
        | undefined;
      expect(firstOptions?.expiresIn).toBeLessThanOrEqual(500);

      // Emulate: the caller's token now has less life left than the initial
      // token (as it would in reality, post-countdown). Role-switch again.
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'admin' })]);
      mockDb.query.mockResolvedValueOnce([]);

      const shrinkingExp = Math.floor(Date.now() / 1000) + 200;
      await service.switchToEmployee(1, 10, shrinkingExp);

      const secondOptions = mockJwtService.sign.mock.calls[1]?.[1] as
        | { expiresIn: number }
        | undefined;
      expect(secondOptions?.expiresIn).toBeLessThanOrEqual(200);
      // The second switch must be <= the first — proof the session window
      // shrinks, never expands, across switches.
      expect(secondOptions?.expiresIn).toBeLessThan(firstOptions?.expiresIn ?? Number.MAX_VALUE);
    });
  });

  // =============================================================
  // getStatus (pure function)
  // =============================================================

  describe('getStatus', () => {
    it('should return status for non-switched user', () => {
      const result = service.getStatus(1, 10, 'admin', undefined, undefined);

      expect(result.originalRole).toBe('admin');
      expect(result.activeRole).toBe('admin');
      expect(result.isRoleSwitched).toBe(false);
      expect(result.canSwitch).toBe(true);
    });

    it('should return status for switched user', () => {
      const result = service.getStatus(1, 10, 'admin', 'employee', true);

      expect(result.activeRole).toBe('employee');
      expect(result.isRoleSwitched).toBe(true);
    });

    it('should report canSwitch=false for employee', () => {
      const result = service.getStatus(5, 10, 'employee', undefined, undefined);

      expect(result.canSwitch).toBe(false);
    });
  });
});
