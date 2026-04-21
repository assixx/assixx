/**
 * Unit tests for AuthService
 *
 * Phase 5: Initial tests (verifyToken, refresh reuse detection).
 * Phase 14 Batch A2: Deepened to ~45 tests.
 * Covers: login, register, logout, getCurrentUser, token rotation,
 * audit resilience, secret isolation, safe user response.
 *
 * IMPORTANT: process.env must have valid JWT secrets BEFORE auth.service.js
 * is imported, because getJwtSecrets() runs at module evaluation time.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { ClsService } from 'nestjs-cls';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { MailerService } from '../common/services/mailer.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { TenantVerificationService } from '../domains/tenant-verification.service.js';
import { AuthService } from './auth.service.js';

// =============================================================
// Module-level mocks
// =============================================================

// JWT secrets must be set BEFORE auth.service.js loads (getJwtSecrets validation)
const { mockBcryptCompare, mockBcryptHash } = vi.hoisted(() => {
  process.env['JWT_SECRET'] = 'test-access-secret-for-vitest-unit-tests-minimum-32-characters-long';
  process.env['JWT_REFRESH_SECRET'] =
    'test-refresh-secret-for-vitest-unit-tests-minimum-32-characters-long';

  return {
    mockBcryptCompare: vi.fn(),
    mockBcryptHash: vi.fn(),
  };
});

vi.mock('bcryptjs', () => ({
  default: {
    compare: mockBcryptCompare,
    hash: mockBcryptHash,
  },
}));

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

// =============================================================
// Factories
// =============================================================

function createMockDb(): { systemQuery: ReturnType<typeof vi.fn> } {
  return { systemQuery: vi.fn() };
}

function createMockJwtService(): {
  sign: ReturnType<typeof vi.fn>;
  verify: ReturnType<typeof vi.fn>;
} {
  return { sign: vi.fn(), verify: vi.fn() };
}

function createMockMailer(): {
  sendPasswordReset: ReturnType<typeof vi.fn>;
  sendPasswordResetBlocked: ReturnType<typeof vi.fn>;
  sendPasswordResetAdminInitiated: ReturnType<typeof vi.fn>;
} {
  return {
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
    // ADR-051: blocked-reset notification for non-root targets on the
    // forgot-password request-gate (§2.1 / §2.3). Resolves in the default
    // case — tests override with `.mockRejectedValueOnce(...)` when they
    // need to exercise the "mailer crash" propagation contract.
    sendPasswordResetBlocked: vi.fn().mockResolvedValue(undefined),
    // ADR-051 §2.9: Root-initiated reset mail. Carries initiator display
    // name so the template can render "{initiatorName} hat für Dich einen
    // Passwort-Reset-Link angefordert". Sole caller: sendAdminInitiatedResetLink.
    sendPasswordResetAdminInitiated: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Minimal ClsService stand-in. AuthService only reads `ip` + `userAgent`
 * via `cls.get<string | undefined>(...)` in the blocked-reset branch
 * (ADR-051 §2.1); everything else is unused. Keeping the surface tiny
 * keeps tests honest about which CLS keys the service touches.
 */
function createMockCls(): { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn((key: string) => {
      if (key === 'ip') return '127.0.0.1';
      if (key === 'userAgent') return 'vitest';
      return undefined;
    }),
    set: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;
type MockJwt = ReturnType<typeof createMockJwtService>;
type MockMailer = ReturnType<typeof createMockMailer>;
type MockCls = ReturnType<typeof createMockCls>;

function createAuthUser(overrides: Partial<NestAuthUser> = {}): NestAuthUser {
  return {
    id: 1,
    email: 'admin@test.de',
    role: 'admin',
    tenantId: 10,
    activeRole: 'admin',
    isRoleSwitched: false,
    hasFullAccess: false,
    ...overrides,
  };
}

function createMockUserRow(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 1,
    tenant_id: 10,
    email: 'admin@test.de',
    password: '$2a$12$hashedPasswordFromDB',
    role: 'admin',
    username: 'admin',
    first_name: 'Test',
    last_name: 'Admin',
    is_active: IS_ACTIVE.ACTIVE,
    last_login: null,
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

/** Set up mocks for a successful login flow */
function setupLoginMocks(db: MockDb, jwt: MockJwt, userOverrides?: Record<string, unknown>): void {
  db.systemQuery.mockResolvedValueOnce([createMockUserRow(userOverrides)]); // findUserByEmail
  mockBcryptCompare.mockResolvedValueOnce(true); // password match
  jwt.sign
    .mockReturnValueOnce('mock-access-token') // access
    .mockReturnValueOnce('mock-refresh-token'); // refresh
  db.systemQuery.mockResolvedValueOnce([]); // storeRefreshToken
  db.systemQuery.mockResolvedValueOnce([]); // updateLastLogin
  db.systemQuery.mockResolvedValueOnce([]); // logLoginAudit
  // Session 12c (ADR-050): login now calls getSubdomainForTenant before
  // building the user response — one extra systemQuery per login path.
  db.systemQuery.mockResolvedValueOnce([{ subdomain: 'test-tenant' }]); // getSubdomainForTenant
}

/**
 * Set up mocks for `loginWithVerifiedUser` — the password-less login path used
 * by OAuth (plan §2.5 / §2.6). Identical DB sequence to `setupLoginMocks`
 * MINUS the bcrypt.compare step (no password to verify).
 */
function setupLoginWithVerifiedUserMocks(
  db: MockDb,
  jwt: MockJwt,
  userOverrides?: Record<string, unknown>,
): void {
  db.systemQuery.mockResolvedValueOnce([createMockUserRow(userOverrides)]); // findUserById
  jwt.sign.mockReturnValueOnce('mock-access-token').mockReturnValueOnce('mock-refresh-token');
  db.systemQuery.mockResolvedValueOnce([]); // storeRefreshToken
  db.systemQuery.mockResolvedValueOnce([]); // updateLastLogin
  db.systemQuery.mockResolvedValueOnce([]); // logLoginAudit
  // Session 12c (ADR-050): same getSubdomainForTenant call as setupLoginMocks.
  db.systemQuery.mockResolvedValueOnce([{ subdomain: 'test-tenant' }]); // getSubdomainForTenant
}

// =============================================================
// Tests
// =============================================================

describe('SECURITY: AuthService', () => {
  let service: AuthService;
  let mockDb: MockDb;
  let mockJwt: MockJwt;
  let mockMailer: MockMailer;
  let mockCls: MockCls;

  beforeEach(() => {
    mockBcryptCompare.mockReset();
    mockBcryptHash.mockReset();
    mockDb = createMockDb();
    mockJwt = createMockJwtService();
    mockMailer = createMockMailer();
    mockCls = createMockCls();
    service = new AuthService(
      mockDb as unknown as DatabaseService,
      mockJwt as unknown as JwtService,
      mockMailer as unknown as MailerService,
      // Step 2.9 KISS gate — assertVerified no-op so register/createUser
      // tests see a verified tenant. Tests exercising 403-path would
      // `.mockRejectedValueOnce(...)` on this stub's assertVerified.
      {
        assertVerified: vi.fn().mockResolvedValue(undefined),
        isVerified: vi.fn().mockResolvedValue(true),
      } as unknown as TenantVerificationService,
      // ADR-051 §2.1: CLS supplies IP + User-Agent for the blocked-reset
      // notification meta-block. Only read in the non-root branch of
      // `forgotPassword()`; silent-drop and root-happy paths don't touch it.
      mockCls as unknown as ClsService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================================
  // verifyToken — public, pure method
  // =============================================================

  describe('verifyToken', () => {
    it('should return valid: true', () => {
      const result = service.verifyToken(createAuthUser());
      expect(result.valid).toBe(true);
    });

    it('should return only id, email, tenantId, and role', () => {
      const user = createAuthUser({
        firstName: 'John',
        lastName: 'Doe',
        departmentId: 5,
        teamId: 3,
      });

      const result = service.verifyToken(user);

      expect(result.user).toEqual({
        id: 1,
        email: 'admin@test.de',
        tenantId: 10,
        role: 'admin',
      });
    });

    it('should not include sensitive fields in response', () => {
      const result = service.verifyToken(createAuthUser());

      expect(result.user).not.toHaveProperty('activeRole');
      expect(result.user).not.toHaveProperty('isRoleSwitched');
      expect(result.user).not.toHaveProperty('departmentId');
      expect(result.user).not.toHaveProperty('teamId');
    });

    it.each([
      ['admin', 10],
      ['employee', 20],
      ['root', 1],
    ] as const)('should echo role "%s" and tenantId %d from user', (role, tenantId) => {
      const user = createAuthUser({ role, tenantId, activeRole: role });

      const result = service.verifyToken(user);

      expect(result.user.role).toBe(role);
      expect(result.user.tenantId).toBe(tenantId);
    });
  });

  // =============================================================
  // login
  // =============================================================

  describe('login', () => {
    const loginDto = { email: 'admin@test.de', password: 'StrongP@ss1' };

    it('should return tokens and safe user response on success', async () => {
      setupLoginMocks(mockDb, mockJwt);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.user.id).toBe(1);
      expect(result.user.email).toBe('admin@test.de');
      expect(result.user.role).toBe('admin');
      expect(result.user.tenantId).toBe(10);
    });

    it('should throw UnauthorizedException for unknown email', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // no user found

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it.each([
      [0, 'inactive'],
      [3, 'archived'],
      [4, 'deleted'],
    ])('should throw ForbiddenException for is_active=%i (%s) user', async (isActive) => {
      mockDb.systemQuery.mockResolvedValueOnce([createMockUserRow({ is_active: isActive })]);

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createMockUserRow()]);
      mockBcryptCompare.mockResolvedValueOnce(false); // password mismatch

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should lowercase email before lookup', async () => {
      setupLoginMocks(mockDb, mockJwt);

      await service.login({ email: 'ADMIN@TEST.DE', password: 'StrongP@ss1' });

      const emailParam = (mockDb.systemQuery.mock.calls[0]?.[1] as string[])?.[0];
      expect(emailParam).toBe('admin@test.de');
    });

    it('should call updateLastLogin after successful auth', async () => {
      setupLoginMocks(mockDb, mockJwt);

      await service.login(loginDto);

      // updateLastLogin is the 3rd db.systemQuery call (index 2)
      const updateCall = mockDb.systemQuery.mock.calls[2];
      expect(updateCall?.[0]).toContain('UPDATE users SET last_login');
    });

    it('should not fail login when audit log fails', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createMockUserRow()]); // findUser
      mockBcryptCompare.mockResolvedValueOnce(true);
      mockJwt.sign.mockReturnValueOnce('access-tok').mockReturnValueOnce('refresh-tok');
      mockDb.systemQuery.mockResolvedValueOnce([]); // storeRefreshToken
      mockDb.systemQuery.mockResolvedValueOnce([]); // updateLastLogin
      mockDb.systemQuery.mockRejectedValueOnce(new Error('Audit DB error')); // logLoginAudit fails
      mockDb.systemQuery.mockResolvedValueOnce([{ subdomain: 'test-tenant' }]); // getSubdomainForTenant

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('access-tok');
    });

    it('should map null first_name/last_name to undefined in response', async () => {
      setupLoginMocks(mockDb, mockJwt, {
        first_name: null,
        last_name: null,
      });

      const result = await service.login(loginDto);

      expect(result.user.firstName).toBeUndefined();
      expect(result.user.lastName).toBeUndefined();
    });

    it('should forward ipAddress and userAgent to storeRefreshToken', async () => {
      setupLoginMocks(mockDb, mockJwt);

      await service.login(loginDto, '192.168.1.1', 'Mozilla/5.0');

      // storeRefreshToken is the 2nd db.systemQuery call (index 1)
      const storeParams = mockDb.systemQuery.mock.calls[1]?.[1] as unknown[];
      expect(storeParams?.[5]).toBe('192.168.1.1'); // ip_address
      expect(storeParams?.[6]).toBe('Mozilla/5.0'); // user_agent
    });

    it('should sign access token with access secret', async () => {
      setupLoginMocks(mockDb, mockJwt);

      await service.login(loginDto);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'access' }),
        expect.objectContaining({
          secret: 'test-access-secret-for-vitest-unit-tests-minimum-32-characters-long',
        }),
      );
    });

    it('should sign refresh token with separate refresh secret', async () => {
      setupLoginMocks(mockDb, mockJwt);

      await service.login(loginDto);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refresh' }),
        expect.objectContaining({
          secret: 'test-refresh-secret-for-vitest-unit-tests-minimum-32-characters-long',
        }),
      );
    });
  });

  // =============================================================
  // loginWithVerifiedUser — OAuth-initiated session bootstrap.
  // Plan §2.5 / §2.6 (ADR-046). Password-less variant of login() —
  // caller already proved identity via an external provider (Microsoft).
  // =============================================================

  describe('loginWithVerifiedUser', () => {
    const OAUTH_USER_ID = 1;
    const OAUTH_TENANT_ID = 10;
    const OAUTH_METHOD = 'oauth-microsoft';

    it('returns tokens + safe user response for an OAuth-verified user', async () => {
      setupLoginWithVerifiedUserMocks(mockDb, mockJwt);

      const result = await service.loginWithVerifiedUser(
        OAUTH_USER_ID,
        OAUTH_TENANT_ID,
        OAUTH_METHOD,
      );

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.user.id).toBe(1);
      expect(result.user.email).toBe('admin@test.de');
      expect(result.user.role).toBe('admin');
      expect(result.user.tenantId).toBe(10);
    });

    it('never calls bcrypt.compare (password path skipped)', async () => {
      setupLoginWithVerifiedUserMocks(mockDb, mockJwt);

      await service.loginWithVerifiedUser(OAUTH_USER_ID, OAUTH_TENANT_ID, OAUTH_METHOD);

      expect(mockBcryptCompare).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the user lookup returns empty', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // findUserById → null

      await expect(
        service.loginWithVerifiedUser(999, OAUTH_TENANT_ID, OAUTH_METHOD),
      ).rejects.toThrow(UnauthorizedException);
    });

    it.each([
      [0, 'inactive'],
      [3, 'archived'],
      [4, 'deleted'],
    ])('throws ForbiddenException for is_active=%i (%s)', async (isActive) => {
      mockDb.systemQuery.mockResolvedValueOnce([createMockUserRow({ is_active: isActive })]);

      await expect(
        service.loginWithVerifiedUser(OAUTH_USER_ID, OAUTH_TENANT_ID, OAUTH_METHOD),
      ).rejects.toThrow(ForbiddenException);
    });

    it('records the OAuth loginMethod in the audit row (new_values.login_method)', async () => {
      setupLoginWithVerifiedUserMocks(mockDb, mockJwt);

      await service.loginWithVerifiedUser(OAUTH_USER_ID, OAUTH_TENANT_ID, OAUTH_METHOD);

      // logLoginAudit is the 4th db.systemQuery call (index 3):
      //   0=findUserById, 1=storeRefreshToken, 2=updateLastLogin, 3=logLoginAudit
      const auditCall = mockDb.systemQuery.mock.calls[3] as unknown[];
      const auditParams = auditCall[1] as unknown[];
      // `new_values` JSON is the 7th bound parameter ($7) in the root_logs INSERT
      const newValuesParam = auditParams.find(
        (p) => typeof p === 'string' && p.includes('login_method'),
      );
      expect(newValuesParam).toBeDefined();
      expect(newValuesParam).toContain('"login_method":"oauth-microsoft"');
    });

    it('forwards ipAddress + userAgent to storeRefreshToken', async () => {
      setupLoginWithVerifiedUserMocks(mockDb, mockJwt);

      await service.loginWithVerifiedUser(
        OAUTH_USER_ID,
        OAUTH_TENANT_ID,
        OAUTH_METHOD,
        '192.168.1.1',
        'Mozilla/5.0',
      );

      // storeRefreshToken is the 2nd db.systemQuery call (index 1)
      const storeParams = mockDb.systemQuery.mock.calls[1]?.[1] as unknown[];
      expect(storeParams?.[5]).toBe('192.168.1.1'); // ip_address
      expect(storeParams?.[6]).toBe('Mozilla/5.0'); // user_agent
    });

    it('does not fail when the audit-log write throws (audit is bookkeeping, not a gate)', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createMockUserRow()]); // findUserById
      mockJwt.sign.mockReturnValueOnce('access-tok').mockReturnValueOnce('refresh-tok');
      mockDb.systemQuery.mockResolvedValueOnce([]); // storeRefreshToken
      mockDb.systemQuery.mockResolvedValueOnce([]); // updateLastLogin
      mockDb.systemQuery.mockRejectedValueOnce(new Error('Audit DB error')); // logLoginAudit fails
      mockDb.systemQuery.mockResolvedValueOnce([{ subdomain: 'test-tenant' }]); // getSubdomainForTenant

      const result = await service.loginWithVerifiedUser(
        OAUTH_USER_ID,
        OAUTH_TENANT_ID,
        OAUTH_METHOD,
      );

      expect(result.accessToken).toBe('access-tok');
    });

    it('signs both access and refresh tokens (reuses existing rotation machinery)', async () => {
      setupLoginWithVerifiedUserMocks(mockDb, mockJwt);

      await service.loginWithVerifiedUser(OAUTH_USER_ID, OAUTH_TENANT_ID, OAUTH_METHOD);

      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'access' }),
        expect.objectContaining({ secret: expect.any(String) }),
      );
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refresh' }),
        expect.objectContaining({ secret: expect.any(String) }),
      );
    });
  });

  // =============================================================
  // register
  // =============================================================

  describe('register', () => {
    const registerDto = {
      email: 'new@test.de',
      password: 'StrongP@ss1',
      firstName: 'New',
      lastName: 'User',
      role: 'employee' as const,
    };

    function setupRegisterMocks(db: MockDb): void {
      db.systemQuery.mockResolvedValueOnce([]); // findUserByEmail → no existing
      mockBcryptHash.mockResolvedValueOnce('hashed-password');
      db.systemQuery.mockResolvedValueOnce([{ id: 42 }]); // createUser RETURNING id
      db.systemQuery.mockResolvedValueOnce([createMockUserRow({ id: 42 })]); // findUserById
    }

    it('should allow admin to create user', async () => {
      setupRegisterMocks(mockDb);

      const result = await service.register(registerDto, createAuthUser({ activeRole: 'admin' }));

      expect(result).toEqual(expect.objectContaining({ id: 42 }));
    });

    it('should allow root to create user', async () => {
      setupRegisterMocks(mockDb);

      const result = await service.register(registerDto, createAuthUser({ activeRole: 'root' }));

      expect(result).toEqual(expect.objectContaining({ id: 42 }));
    });

    it('should throw ForbiddenException for non-admin role', async () => {
      await expect(
        service.register(registerDto, createAuthUser({ activeRole: 'employee' })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when email already exists', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createMockUserRow()]); // email found

      await expect(service.register(registerDto, createAuthUser())).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw UnauthorizedException for email with empty prefix', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // no existing user

      await expect(
        service.register({ ...registerDto, email: '@test.de' }, createAuthUser()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should hash password with bcrypt salt rounds 12', async () => {
      setupRegisterMocks(mockDb);

      await service.register(registerDto, createAuthUser());

      expect(mockBcryptHash).toHaveBeenCalledWith('StrongP@ss1', 12);
    });

    it('should throw InternalServerErrorException when user retrieval fails', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // no existing
      mockBcryptHash.mockResolvedValueOnce('hashed');
      mockDb.systemQuery.mockResolvedValueOnce([{ id: 42 }]); // createUser
      mockDb.systemQuery.mockResolvedValueOnce([]); // findUserById returns empty

      await expect(service.register(registerDto, createAuthUser())).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when INSERT returns no id', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // no existing
      mockBcryptHash.mockResolvedValueOnce('hashed');
      mockDb.systemQuery.mockResolvedValueOnce([]); // INSERT returns empty!

      await expect(service.register(registerDto, createAuthUser())).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should extract username from email prefix', async () => {
      setupRegisterMocks(mockDb);

      await service.register({ ...registerDto, email: 'john.doe@company.com' }, createAuthUser());

      // createUser INSERT is the 2nd db.systemQuery call (index 1)
      const insertParams = mockDb.systemQuery.mock.calls[1]?.[1] as unknown[];
      expect(insertParams?.[1]).toBe('john.doe'); // username
    });
  });

  // =============================================================
  // logout
  // =============================================================

  describe('logout', () => {
    it('should revoke all tokens and return count', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '5' }]); // revokeAllUserTokens
      mockDb.systemQuery.mockResolvedValueOnce([]); // logLogoutAudit

      const result = await service.logout(createAuthUser());

      expect(result).toEqual({ tokensRevoked: 5 });
    });

    it('should not fail when audit log fails', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '2' }]); // revoke
      mockDb.systemQuery.mockRejectedValueOnce(new Error('Audit fail')); // audit

      const result = await service.logout(createAuthUser());

      expect(result).toEqual({ tokensRevoked: 2 });
    });

    it('should return 0 when no tokens to revoke', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '0' }]); // none to revoke
      mockDb.systemQuery.mockResolvedValueOnce([]); // audit

      const result = await service.logout(createAuthUser());

      expect(result).toEqual({ tokensRevoked: 0 });
    });

    it('should default to 0 when revokeAllUserTokens returns empty result', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // empty result from CTE
      mockDb.systemQuery.mockResolvedValueOnce([]); // audit

      const result = await service.logout(createAuthUser());

      expect(result).toEqual({ tokensRevoked: 0 });
    });

    it('should forward ipAddress and userAgent to logout audit', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '1' }]); // revoke
      mockDb.systemQuery.mockResolvedValueOnce([]); // logLogoutAudit

      await service.logout(createAuthUser(), '10.0.0.1', 'Chrome/120');

      const auditParams = mockDb.systemQuery.mock.calls[1]?.[1] as unknown[];
      expect(auditParams?.[7]).toBe('10.0.0.1');
      expect(auditParams?.[8]).toBe('Chrome/120');
    });
  });

  // =============================================================
  // getCurrentUser
  // =============================================================

  describe('getCurrentUser', () => {
    it('should return user when found', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createMockUserRow()]);

      const result = await service.getCurrentUser(createAuthUser());

      expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });

    it('should throw NotFoundException when user not found', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // no user

      await expect(service.getCurrentUser(createAuthUser())).rejects.toThrow(NotFoundException);
    });

    it('should query with correct userId and tenantId', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createMockUserRow()]);

      await service.getCurrentUser(createAuthUser({ id: 42, tenantId: 99 }));

      const queryParams = mockDb.systemQuery.mock.calls[0]?.[1] as number[];
      expect(queryParams?.[0]).toBe(42);
      expect(queryParams?.[1]).toBe(99);
    });
  });

  // =============================================================
  // refresh — token reuse detection & rotation (SECURITY)
  // =============================================================

  describe('refresh', () => {
    const fakeRefreshToken = 'fake-refresh-token-for-unit-test';
    const fakeTokenHash = crypto.createHash('sha256').update(fakeRefreshToken).digest('hex');

    const validDecodedPayload = {
      id: 1,
      email: 'admin@test.de',
      role: 'admin',
      tenantId: 10,
      type: 'refresh' as const,
      family: 'family-abc-123',
    };

    it('should throw UnauthorizedException when token was already used', async () => {
      mockJwt.verify.mockReturnValueOnce(validDecodedPayload);
      mockDb.systemQuery.mockResolvedValueOnce([{ used_at: new Date() }]); // already used
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '5' }]); // revoke family

      await expect(service.refresh({ refreshToken: fakeRefreshToken })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should include security alert message on reuse detection', async () => {
      mockJwt.verify.mockReturnValueOnce(validDecodedPayload);
      mockDb.systemQuery.mockResolvedValueOnce([{ used_at: new Date() }]);
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '3' }]);

      await expect(service.refresh({ refreshToken: fakeRefreshToken })).rejects.toThrow(
        'Token reuse detected',
      );
    });

    it('should revoke entire token family on reuse detection', async () => {
      mockJwt.verify.mockReturnValueOnce({
        ...validDecodedPayload,
        family: 'family-xyz-789',
      });
      mockDb.systemQuery.mockResolvedValueOnce([{ used_at: new Date() }]);
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '4' }]);

      await expect(service.refresh({ refreshToken: fakeRefreshToken })).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockDb.systemQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET is_revoked = true'),
        ['family-xyz-789'],
      );
    });

    it('should default to 0 when revokeTokenFamily returns empty result', async () => {
      mockJwt.verify.mockReturnValueOnce(validDecodedPayload);
      mockDb.systemQuery.mockResolvedValueOnce([{ used_at: new Date() }]); // token already used
      mockDb.systemQuery.mockResolvedValueOnce([]); // revokeTokenFamily returns empty

      await expect(service.refresh({ refreshToken: fakeRefreshToken })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should not treat unused token as reuse', async () => {
      mockJwt.verify.mockReturnValueOnce(validDecodedPayload);
      mockDb.systemQuery.mockResolvedValueOnce([{ used_at: null }]); // not used
      mockDb.systemQuery.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 1,
          tenant_id: 10,
          token_hash: fakeTokenHash,
          token_family: 'family-abc-123',
          expires_at: new Date(Date.now() + 86_400_000),
          is_revoked: false,
          used_at: null,
          replaced_by_hash: null,
        },
      ]); // findValidRefreshToken
      mockJwt.sign.mockReturnValueOnce('new-access-token').mockReturnValueOnce('new-refresh-token');
      mockDb.systemQuery.mockResolvedValueOnce([]); // storeRefreshToken
      mockDb.systemQuery.mockResolvedValueOnce([]); // markTokenAsUsed

      const result = await service.refresh({
        refreshToken: fakeRefreshToken,
      });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should not treat unknown token as reuse', async () => {
      mockJwt.verify.mockReturnValueOnce(validDecodedPayload);
      mockDb.systemQuery.mockResolvedValueOnce([]); // isTokenAlreadyUsed → not found
      mockDb.systemQuery.mockResolvedValueOnce([]); // findValidRefreshToken → not found
      mockJwt.sign.mockReturnValueOnce('new-access-token').mockReturnValueOnce('new-refresh-token');
      mockDb.systemQuery.mockResolvedValueOnce([]); // storeRefreshToken

      const result = await service.refresh({
        refreshToken: fakeRefreshToken,
      });

      expect(result.accessToken).toBe('new-access-token');
    });

    it('should throw when JWT verification fails', async () => {
      mockJwt.verify.mockImplementationOnce(() => {
        const error = new Error('invalid signature');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      await expect(service.refresh({ refreshToken: 'invalid-token' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw specific message for expired refresh token', async () => {
      mockJwt.verify.mockImplementationOnce(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await expect(service.refresh({ refreshToken: 'expired-token' })).rejects.toThrow(
        'Refresh token has expired',
      );
    });

    it('should reject non-refresh token type', async () => {
      mockJwt.verify.mockReturnValueOnce({
        ...validDecodedPayload,
        type: 'access', // Wrong type!
      });

      await expect(service.refresh({ refreshToken: fakeRefreshToken })).rejects.toThrow(
        'Not a refresh token',
      );
    });

    // ----- Phase 14 additions -----

    it('should mark old token as used when storedToken exists', async () => {
      mockJwt.verify.mockReturnValueOnce(validDecodedPayload);
      mockDb.systemQuery.mockResolvedValueOnce([{ used_at: null }]); // not used
      mockDb.systemQuery.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 1,
          tenant_id: 10,
          token_hash: fakeTokenHash,
          token_family: 'family-abc-123',
          expires_at: new Date(Date.now() + 86_400_000),
          is_revoked: false,
          used_at: null,
          replaced_by_hash: null,
        },
      ]); // token found in DB
      mockJwt.sign.mockReturnValueOnce('new-access').mockReturnValueOnce('new-refresh');
      mockDb.systemQuery.mockResolvedValueOnce([]); // storeRefreshToken
      mockDb.systemQuery.mockResolvedValueOnce([]); // markTokenAsUsed

      await service.refresh({ refreshToken: fakeRefreshToken });

      // markTokenAsUsed is the last db.systemQuery call
      const lastCall = mockDb.systemQuery.mock.calls[mockDb.systemQuery.mock.calls.length - 1];
      expect(lastCall?.[0]).toContain('UPDATE refresh_tokens');
      expect(lastCall?.[0]).toContain('used_at');
      expect((lastCall?.[1] as string[])?.[0]).toBe(fakeTokenHash);
    });

    it('should NOT mark old token when storedToken is null', async () => {
      mockJwt.verify.mockReturnValueOnce(validDecodedPayload);
      mockDb.systemQuery.mockResolvedValueOnce([]); // isTokenAlreadyUsed → not found
      mockDb.systemQuery.mockResolvedValueOnce([]); // findValidRefreshToken → null
      mockJwt.sign.mockReturnValueOnce('new-access').mockReturnValueOnce('new-refresh');
      mockDb.systemQuery.mockResolvedValueOnce([]); // storeRefreshToken

      await service.refresh({ refreshToken: fakeRefreshToken });

      // Only 3 db.systemQuery calls: isTokenAlreadyUsed, findValid, storeRefresh
      // No markTokenAsUsed call
      expect(mockDb.systemQuery).toHaveBeenCalledTimes(3);
    });

    it('should skip family revocation when decoded.family is undefined', async () => {
      mockJwt.verify.mockReturnValueOnce({
        ...validDecodedPayload,
        family: undefined, // no family
      });
      // Token found AND already used
      mockDb.systemQuery.mockResolvedValueOnce([{ used_at: new Date() }]);

      await expect(service.refresh({ refreshToken: fakeRefreshToken })).rejects.toThrow(
        UnauthorizedException,
      );

      // Only 1 db.systemQuery call (isTokenAlreadyUsed), no revokeTokenFamily call
      expect(mockDb.systemQuery).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // forgotPassword — generates token, delegates email to MailerService
  // =============================================================

  describe('forgotPassword', () => {
    // ADR-051 §2.1 contract: return type is `ForgotPasswordResult` —
    // `{ blocked: false, delivered: false }` for silent-drop paths
    // (non-existent OR inactive), `{ blocked: true, delivered: true }` for
    // the non-root role-block path, `{ blocked: false, delivered: true }`
    // for the root happy path. The controller maps this to the HTTP body.

    it('should silently return when user does not exist', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // findUserByEmail → none

      await expect(service.forgotPassword({ email: 'unknown@test.de' })).resolves.toEqual({
        blocked: false,
        delivered: false,
      });

      // Only the lookup query — no INSERT, no mailer call
      expect(mockDb.systemQuery).toHaveBeenCalledTimes(1);
      expect(mockMailer.sendPasswordReset).not.toHaveBeenCalled();
      expect(mockMailer.sendPasswordResetBlocked).not.toHaveBeenCalled();
    });

    it.each([
      [0, 'inactive'],
      [3, 'archived'],
      [4, 'deleted'],
    ])('should silently return for is_active=%i (%s) user', async (isActive) => {
      mockDb.systemQuery.mockResolvedValueOnce([createMockUserRow({ is_active: isActive })]);

      await expect(service.forgotPassword({ email: 'admin@test.de' })).resolves.toEqual({
        blocked: false,
        delivered: false,
      });

      expect(mockDb.systemQuery).toHaveBeenCalledTimes(1);
      expect(mockMailer.sendPasswordReset).not.toHaveBeenCalled();
      expect(mockMailer.sendPasswordResetBlocked).not.toHaveBeenCalled();
    });

    it('should invalidate existing tokens, insert hashed token, and call mailer on happy path', async () => {
      mockDb.systemQuery
        // role: 'root' is required — the default createMockUserRow role
        // is 'admin', which now hits the block-gate instead of the happy path.
        .mockResolvedValueOnce([createMockUserRow({ id: 7, role: 'root' })]) // findUserByEmail
        .mockResolvedValueOnce([]) // UPDATE invalidate previous
        .mockResolvedValueOnce([]); // INSERT new token

      await service.forgotPassword({ email: 'admin@test.de' });

      expect(mockDb.systemQuery).toHaveBeenCalledTimes(3);

      // Verify previous tokens were invalidated
      const invalidateCall = mockDb.systemQuery.mock.calls[1];
      expect(invalidateCall?.[0]).toContain(
        'UPDATE password_reset_tokens SET used = true WHERE user_id = $1',
      );
      expect((invalidateCall?.[1] as number[])[0]).toBe(7);

      // Verify token stored as SHA-256 hash, NOT raw
      const insertCall = mockDb.systemQuery.mock.calls[2];
      expect(insertCall?.[0]).toContain('INSERT INTO password_reset_tokens');
      const insertParams = insertCall?.[1] as unknown[];
      const storedHash = insertParams[1] as string;
      expect(storedHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex

      // Verify mailer called with safe recipient projection
      expect(mockMailer.sendPasswordReset).toHaveBeenCalledTimes(1);
      const [recipient, rawToken, expiresAt] = mockMailer.sendPasswordReset.mock.calls[0] ?? [];
      expect(recipient).toEqual({
        email: 'admin@test.de',
        firstName: 'Test',
        lastName: 'Admin',
      });
      expect(typeof rawToken).toBe('string');
      expect((rawToken as string).length).toBeGreaterThan(0);
      expect(expiresAt).toBeInstanceOf(Date);
    });

    it('should NOT pass raw token to DB (raw goes only to mailer)', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([createMockUserRow({ role: 'root' })])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.forgotPassword({ email: 'admin@test.de' });

      const insertParams = mockDb.systemQuery.mock.calls[2]?.[1] as unknown[];
      const storedToken = insertParams[1] as string;
      const rawToken =
        (mockMailer.sendPasswordReset.mock.calls[0]?.[1] as string | undefined) ?? '';

      expect(storedToken).not.toBe(rawToken);
      // Verify hash matches sha256(rawToken)
      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(storedToken).toBe(expectedHash);
    });

    it('should set token expiry approximately 60 minutes in the future', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([createMockUserRow({ role: 'root' })])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const before = Date.now();
      await service.forgotPassword({ email: 'admin@test.de' });
      const after = Date.now();

      const insertParams = mockDb.systemQuery.mock.calls[2]?.[1] as unknown[];
      const expiresAt = insertParams[2] as Date;
      const expiryMs = expiresAt.getTime();

      // 60 minutes = 3,600,000 ms — allow ±100ms drift
      expect(expiryMs).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 100);
      expect(expiryMs).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 100);
    });

    it('should propagate mailer rejection (mailer is responsible for swallowing failures)', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([createMockUserRow({ role: 'root' })])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockMailer.sendPasswordReset.mockRejectedValueOnce(new Error('mailer crash'));

      // forgotPassword does NOT wrap mailer in try/catch — that's the mailer's job.
      // Test documents this contract: if mailer ever throws, AuthService bubbles it up.
      await expect(service.forgotPassword({ email: 'admin@test.de' })).rejects.toThrow(
        'mailer crash',
      );
    });

    // ---------------------------------------------------------------
    // ADR-051 §2.1 — Role-Gate BLOCK PATH (request-gate):
    // Admin/Employee/null-role users never get a reset token. A blocked-
    // notification mail is sent (paper trail + R1 no-leak) and `logger.warn`
    // records IP + UA from CLS. has_full_access + lead-positions are
    // INTENTIONALLY ignored here (§0.2.5 #1/#2 — data-visibility ≠
    // auth-self-service). Secure-default: any role ≠ 'root' is blocked (R3).
    // ---------------------------------------------------------------

    it('should block admin user and call sendPasswordResetBlocked (no token row)', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([
        createMockUserRow({ id: 42, role: 'admin', email: 'admin@test.de' }),
      ]);

      await expect(service.forgotPassword({ email: 'admin@test.de' })).resolves.toEqual({
        blocked: true,
        delivered: true,
      });

      // Only 1 query: findUserByEmail. No UPDATE (token-invalidate),
      // no INSERT (new token). Block-path is side-effect-free on the DB.
      expect(mockDb.systemQuery).toHaveBeenCalledTimes(1);
      expect(mockMailer.sendPasswordReset).not.toHaveBeenCalled();
      expect(mockMailer.sendPasswordResetBlocked).toHaveBeenCalledTimes(1);

      const call = mockMailer.sendPasswordResetBlocked.mock.calls[0] ?? [];
      expect(call[0]).toEqual({
        email: 'admin@test.de',
        firstName: 'Test',
        lastName: 'Admin',
      });
      // Meta carries CLS-read IP + UA + fresh timestamp
      expect(call[1]).toMatchObject({ ip: '127.0.0.1', userAgent: 'vitest' });
      expect((call[1] as { timestamp: Date }).timestamp).toBeInstanceOf(Date);
    });

    it('should block employee user and call sendPasswordResetBlocked', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([
        createMockUserRow({ id: 55, role: 'employee', email: 'emp@test.de' }),
      ]);

      await expect(service.forgotPassword({ email: 'emp@test.de' })).resolves.toEqual({
        blocked: true,
        delivered: true,
      });

      expect(mockMailer.sendPasswordReset).not.toHaveBeenCalled();
      expect(mockMailer.sendPasswordResetBlocked).toHaveBeenCalledTimes(1);
    });

    it("should block user with null role (R3 secure-default: any value ≠ 'root' is blocked)", async () => {
      // R3 invariant: the role-check is `user.role !== 'root'`, so null /
      // undefined / unknown string values ALL fall through to the block
      // branch. Covers DB-drift and future-role scenarios where a new role
      // is added without updating the gate. Fail-closed.
      mockDb.systemQuery.mockResolvedValueOnce([
        createMockUserRow({ role: null as unknown as string }),
      ]);

      await expect(service.forgotPassword({ email: 'admin@test.de' })).resolves.toEqual({
        blocked: true,
        delivered: true,
      });

      expect(mockMailer.sendPasswordResetBlocked).toHaveBeenCalledTimes(1);
    });

    it('should read IP + User-Agent from CLS and forward to blocked-reset mail meta', async () => {
      // ADR-051 §2.1: blocked-notification meta-block renders IP + UA read
      // from CLS (populated in `app.module.ts` ClsModule setup). Trusts
      // `trustProxy: true` at `main.ts:284` so `req.ip` is the client IP,
      // not the Nginx egress. Test pins this read-path explicitly.
      mockCls.get.mockImplementation((key: string) => {
        if (key === 'ip') return '203.0.113.42';
        if (key === 'userAgent') return 'Mozilla/5.0 (vitest)';
        return undefined;
      });
      mockDb.systemQuery.mockResolvedValueOnce([createMockUserRow({ role: 'admin' })]);

      await service.forgotPassword({ email: 'admin@test.de' });

      const call = mockMailer.sendPasswordResetBlocked.mock.calls[0] ?? [];
      expect(call[1]).toMatchObject({
        ip: '203.0.113.42',
        userAgent: 'Mozilla/5.0 (vitest)',
      });
    });

    it('should fall back to "unknown" when CLS IP/UA are undefined (degraded middleware)', async () => {
      // Honest fallback contract (`?? 'unknown'`): if the ClsModule middleware
      // ever degrades, the blocked-reset email still renders — just with an
      // "unknown" IP/UA placeholder instead of a real value. Better than a
      // throw (which would fail-open by skipping the notification).
      mockCls.get.mockReturnValue(undefined);
      mockDb.systemQuery.mockResolvedValueOnce([createMockUserRow({ role: 'admin' })]);

      await service.forgotPassword({ email: 'admin@test.de' });

      const call = mockMailer.sendPasswordResetBlocked.mock.calls[0] ?? [];
      expect(call[1]).toMatchObject({ ip: 'unknown', userAgent: 'unknown' });
    });

    it("should block OAuth-only admin (password = 'OAUTH' placeholder, v0.4.0 G3)", async () => {
      // Known Limitation #8: OAuth-only admin/employee hits the generic
      // blocked template (V2 may branch wording). This test pins that the
      // role-gate does NOT special-case the `'OAUTH'` password placeholder
      // — same block-path as a password-only admin. Orthogonal to ADR-046.
      mockDb.systemQuery.mockResolvedValueOnce([
        createMockUserRow({ role: 'admin', password: 'OAUTH' }),
      ]);

      await expect(service.forgotPassword({ email: 'admin@test.de' })).resolves.toEqual({
        blocked: true,
        delivered: true,
      });

      expect(mockMailer.sendPasswordResetBlocked).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // resetPassword — validates token, updates password, revokes refresh
  // =============================================================

  describe('resetPassword', () => {
    const validResetDto = { token: 'raw-reset-token-xyz', password: 'NewStrongP@ss1' };

    it('should throw UnauthorizedException for unknown/expired token', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // SELECT returns nothing

      await expect(service.resetPassword(validResetDto)).rejects.toThrow(UnauthorizedException);
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it('should look up token by sha256 hash, not raw value', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // not found

      await expect(service.resetPassword(validResetDto)).rejects.toThrow(UnauthorizedException);

      const lookupParams = mockDb.systemQuery.mock.calls[0]?.[1] as string[];
      const expectedHash = crypto.createHash('sha256').update(validResetDto.token).digest('hex');
      expect(lookupParams[0]).toBe(expectedHash);
    });

    // ADR-051 §2.6: Redemption-Gate-Reihenfolge lautet
    // SELECT token → findUserById (redemption gate) → UPDATE users →
    // UPDATE password_reset_tokens used → revokeAllUserTokensByUserId.
    // findUserById MUSS einen `role: 'root'`-User liefern, sonst greift die
    // Role-Check-Branch und wirft ForbiddenException + burnt den Token.

    it('should hash new password with bcrypt rounds=12 on happy path', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 7, initiated_by_user_id: null }]) // SELECT token row
        .mockResolvedValueOnce([createMockUserRow({ id: 7, role: 'root' })]) // findUserById (redemption gate)
        .mockResolvedValueOnce([]) // UPDATE users
        .mockResolvedValueOnce([]) // UPDATE password_reset_tokens used
        .mockResolvedValueOnce([{ count: '3' }]); // revokeAllUserTokensByUserId
      mockBcryptHash.mockResolvedValueOnce('new-hashed-pw');

      await service.resetPassword(validResetDto);

      expect(mockBcryptHash).toHaveBeenCalledWith('NewStrongP@ss1', 12);
    });

    it('should mark token as used and revoke refresh tokens by user_id (no tenant scope)', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 7, initiated_by_user_id: null }]) // SELECT token
        .mockResolvedValueOnce([createMockUserRow({ id: 7, role: 'root' })]) // findUserById
        .mockResolvedValueOnce([]) // UPDATE users
        .mockResolvedValueOnce([]) // UPDATE token used
        .mockResolvedValueOnce([{ count: '2' }]); // revoke CTE
      mockBcryptHash.mockResolvedValueOnce('new-hash');

      await service.resetPassword(validResetDto);

      // Find the revoke call (last UPDATE refresh_tokens)
      const revokeCall = mockDb.systemQuery.mock.calls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('UPDATE refresh_tokens SET is_revoked = true') &&
          call[0].includes('WHERE user_id = $1') &&
          !call[0].includes('tenant_id'),
      );
      expect(revokeCall).toBeDefined();
      expect((revokeCall?.[1] as number[])[0]).toBe(7);
    });

    it('should burn token + throw UnauthorizedException when target user vanished between issuance and redemption (redemption-gate lifecycle)', async () => {
      // v0.5.1 behaviour change: under ADR-051 §2.6, a null `findUserById` is
      // a redemption-gate failure (deleted/deactivated target). The token is
      // burned and a generic UnauthorizedException is thrown — NO password
      // update, NO revoke, NO leak of whether the user was missing vs inactive.
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 7, initiated_by_user_id: null }]) // SELECT token
        .mockResolvedValueOnce([]) // findUserById → null
        .mockResolvedValueOnce([]); // burnToken UPDATE

      await expect(service.resetPassword(validResetDto)).rejects.toThrow(UnauthorizedException);

      // Exactly 3 systemQuery calls: SELECT, findUserById, burnToken.
      // No UPDATE users, no revoke.
      expect(mockDb.systemQuery).toHaveBeenCalledTimes(3);

      const burnCall = mockDb.systemQuery.mock.calls[2];
      expect(burnCall?.[0]).toContain('UPDATE password_reset_tokens SET used = true');
      expect((burnCall?.[1] as number[])[0]).toBe(99); // burn by token row id
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it('should default to 0 when revokeAllUserTokensByUserId returns empty result', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 7, initiated_by_user_id: null }]) // SELECT token
        .mockResolvedValueOnce([createMockUserRow({ id: 7, role: 'root' })]) // findUserById
        .mockResolvedValueOnce([]) // UPDATE users
        .mockResolvedValueOnce([]) // UPDATE token used
        .mockResolvedValueOnce([]); // empty CTE result
      mockBcryptHash.mockResolvedValueOnce('new-hash');

      await expect(service.resetPassword(validResetDto)).resolves.toBeUndefined();
    });

    // ---------------------------------------------------------------
    // ADR-051 §2.6 — Redemption Role-Gate (self-service tokens only):
    // Even a VALID token for admin/employee must NEVER redeem. Token is
    // burned (used=true) to prevent retry (R9 — stolen/leaked/pre-plan-era
    // tokens). 403 ForbiddenException (not 401): token was valid, this is
    // an AUTHORIZATION failure — machine-readable via response body
    // `code: 'ROLE_NOT_ALLOWED'` at the controller layer (§0.2.5 #4).
    // ---------------------------------------------------------------

    it('should burn token + throw ForbiddenException when self-service token targets an admin', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 7, initiated_by_user_id: null }]) // SELECT token
        .mockResolvedValueOnce([createMockUserRow({ id: 7, role: 'admin' })]) // findUserById (admin)
        .mockResolvedValueOnce([]); // burnToken UPDATE

      await expect(service.resetPassword(validResetDto)).rejects.toThrow(ForbiddenException);

      // Exactly 3 queries: SELECT, findUserById, burnToken. The burnToken
      // call IS the token-used write — no separate token-used UPDATE, no
      // bcrypt, no users UPDATE, no revoke. Everything short-circuits on
      // the role-gate throw.
      expect(mockDb.systemQuery).toHaveBeenCalledTimes(3);
      const burnCall = mockDb.systemQuery.mock.calls[2];
      expect(burnCall?.[0]).toContain('UPDATE password_reset_tokens SET used = true');
      expect((burnCall?.[1] as number[])[0]).toBe(99); // burn by token row id
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it('should burn token + throw ForbiddenException when self-service token targets an employee', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 8, initiated_by_user_id: null }])
        .mockResolvedValueOnce([createMockUserRow({ id: 8, role: 'employee' })])
        .mockResolvedValueOnce([]);

      await expect(service.resetPassword(validResetDto)).rejects.toThrow(ForbiddenException);
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });
  });

  // =============================================================
  // ADR-051 §2.7 — sendAdminInitiatedResetLink (Root-initiated reset).
  // Strict Root-only (narrower than ADR-045 Layer-1, §0.2.5 #13). Target
  // must be admin OR employee in same tenant AND active. Root-on-Root
  // REJECTED to prevent Root-takeover chains (§0.2.5 #12). Per-pair rate
  // limit (1 req / 15 min) via DB-check on MAX(created_at) — no Throttler
  // tier change, no Redis-infra change.
  // =============================================================

  describe('sendAdminInitiatedResetLink', () => {
    // Canonical Root-initiator: active root in tenant 10, full name for
    // initiator-display-name rendering in the mail template (§2.9).
    const initiator: NestAuthUser = createAuthUser({
      id: 1,
      email: 'root@test.de',
      role: 'root',
      activeRole: 'root',
      tenantId: 10,
      hasFullAccess: true,
      firstName: 'Max',
      lastName: 'Mustermann',
    });

    it('should issue token for active admin target (same tenant) and send admin-initiated mail', async () => {
      mockDb.systemQuery
        // 1. findUserById(targetId, initiator.tenantId) — tenant-scoped
        .mockResolvedValueOnce([createMockUserRow({ id: 42, role: 'admin', tenant_id: 10 })])
        // 2. assertAdminInitiatedRateLimit — no prior token issued for this pair
        .mockResolvedValueOnce([])
        // 3. INSERT token row
        .mockResolvedValueOnce([]);

      const result = await service.sendAdminInitiatedResetLink(42, initiator);

      expect(result.message).toBe('E-Mail gesendet an admin@test.de');
      expect(mockDb.systemQuery).toHaveBeenCalledTimes(3);

      // INSERT carries initiated_by_user_id = initiator.id (Phase 1 column).
      // This is THE invariant §2.8 origin-check relies on.
      const insertCall = mockDb.systemQuery.mock.calls[2];
      expect(insertCall?.[0]).toContain('INSERT INTO password_reset_tokens');
      expect(insertCall?.[0]).toContain('initiated_by_user_id');
      const insertParams = insertCall?.[1] as unknown[];
      expect(insertParams[0]).toBe(42); // target.id
      expect(insertParams[3]).toBe(1); // initiator.id

      // Mail dispatched with target recipient + initiator display name.
      // Self-service mailers MUST NOT be touched.
      expect(mockMailer.sendPasswordResetAdminInitiated).toHaveBeenCalledTimes(1);
      const call = mockMailer.sendPasswordResetAdminInitiated.mock.calls[0] ?? [];
      expect(call[0]).toEqual({
        email: 'admin@test.de',
        firstName: 'Test',
        lastName: 'Admin',
      });
      expect(call[1]).toBe('Max Mustermann'); // buildInitiatorName
      expect(typeof call[2]).toBe('string');
      expect((call[2] as string).length).toBeGreaterThan(0);
      expect(call[3]).toBeInstanceOf(Date);

      expect(mockMailer.sendPasswordReset).not.toHaveBeenCalled();
      expect(mockMailer.sendPasswordResetBlocked).not.toHaveBeenCalled();
    });

    it('should issue token for active employee target (same tenant)', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([createMockUserRow({ id: 99, role: 'employee', tenant_id: 10 })])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.sendAdminInitiatedResetLink(99, initiator);

      expect(result.message).toBe('E-Mail gesendet an admin@test.de');
      expect(mockMailer.sendPasswordResetAdminInitiated).toHaveBeenCalledTimes(1);
    });

    it('should reject root target with BadRequestException INVALID_TARGET_ROLE (prevents Root-takeover chains)', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([
        createMockUserRow({ id: 5, role: 'root', tenant_id: 10 }),
      ]);

      const promise = service.sendAdminInitiatedResetLink(5, initiator);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toMatchObject({
        response: { code: 'INVALID_TARGET_ROLE' },
      });

      // Only the lookup — rate-limit + INSERT + mail all skipped on throw.
      expect(mockDb.systemQuery).toHaveBeenCalledTimes(1);
      expect(mockMailer.sendPasswordResetAdminInitiated).not.toHaveBeenCalled();
    });

    it.each([
      [0, 'inactive'],
      [3, 'archived'],
      [4, 'deleted'],
    ])('should reject is_active=%i (%s) target with INACTIVE_TARGET', async (isActive) => {
      mockDb.systemQuery.mockResolvedValueOnce([
        createMockUserRow({ id: 42, role: 'admin', tenant_id: 10, is_active: isActive }),
      ]);

      const promise = service.sendAdminInitiatedResetLink(42, initiator);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toMatchObject({
        response: { code: 'INACTIVE_TARGET' },
      });
      expect(mockMailer.sendPasswordResetAdminInitiated).not.toHaveBeenCalled();
    });

    it('should return 404 NotFoundException for cross-tenant or non-existent target', async () => {
      // Tenant-scoped `findUserById(id, initiator.tenantId)` returns null for
      // both "never existed" AND "exists in another tenant". Generic 404
      // prevents tenant-enumeration via 400 vs 404 differentiation.
      mockDb.systemQuery.mockResolvedValueOnce([]); // findUserById → empty

      await expect(service.sendAdminInitiatedResetLink(999, initiator)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockMailer.sendPasswordResetAdminInitiated).not.toHaveBeenCalled();
    });

    it('should reject 2nd request within 15 min from same (initiator, target) with 429 RATE_LIMIT', async () => {
      // Per-pair rate-limit via DB-check on MAX(created_at). 10 min ago is
      // inside the 15 min window — must reject. DB-check scoping means
      // other (root, target) pairs are unaffected (see next test).
      const recent = { created_at: new Date(Date.now() - 10 * 60 * 1000) };
      mockDb.systemQuery
        .mockResolvedValueOnce([createMockUserRow({ id: 42, role: 'admin', tenant_id: 10 })])
        .mockResolvedValueOnce([recent]);

      const promise = service.sendAdminInitiatedResetLink(42, initiator);
      await expect(promise).rejects.toThrow(HttpException);
      await expect(promise).rejects.toMatchObject({
        status: 429,
        response: { code: 'RATE_LIMIT' },
      });

      // Stopped after rate-limit lookup — no INSERT, no mail.
      expect(mockDb.systemQuery).toHaveBeenCalledTimes(2);
      expect(mockMailer.sendPasswordResetAdminInitiated).not.toHaveBeenCalled();
    });

    it('should allow 2nd request after 15 min elapsed (pair-scoped window)', async () => {
      // 16 min ago → outside window → request goes through. Same (initiator,
      // target) pair is allowed to retry after the cool-down. Confirms the
      // rate-limit is a window, not a once-per-session lockout.
      const old = { created_at: new Date(Date.now() - 16 * 60 * 1000) };
      mockDb.systemQuery
        .mockResolvedValueOnce([createMockUserRow({ id: 42, role: 'admin', tenant_id: 10 })])
        .mockResolvedValueOnce([old])
        .mockResolvedValueOnce([]);

      const result = await service.sendAdminInitiatedResetLink(42, initiator);
      expect(result.message).toBe('E-Mail gesendet an admin@test.de');
      expect(mockMailer.sendPasswordResetAdminInitiated).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // ADR-051 §2.8 — resetPassword Origin-Check branch
  // Admin-initiated tokens (initiated_by_user_id NOT NULL) bypass the
  // §2.6 self-service role-gate but must pass an initiator-lifecycle
  // check. Any failure burns the token + generic 401 UnauthorizedException
  // — do NOT leak initiator state (deleted / inactive / demoted / tenant
  // drift) to the token-holder. From their POV, the token is just invalid.
  // =============================================================

  describe('resetPassword — admin-initiated token (§2.8 origin-check)', () => {
    const validResetDto = { token: 'raw-reset-token-xyz', password: 'NewStrongP@ss1' };

    it('should allow redemption when admin-initiated token targets admin and initiator is still valid Root (bypasses self-service role-gate)', async () => {
      // Happy path: initiator still active root in same tenant → origin-check
      // returns successfully → falls through to bcrypt + UPDATE users. The
      // fact that the target is admin (not root) does NOT block, because
      // the origin-check REPLACES the §2.6 role-gate for admin-initiated
      // tokens (the whole point of the feature).
      mockDb.systemQuery
        // SELECT token — admin-initiated (initiated_by_user_id = 1)
        .mockResolvedValueOnce([{ id: 99, user_id: 42, initiated_by_user_id: 1 }])
        // findUserById target (admin)
        .mockResolvedValueOnce([createMockUserRow({ id: 42, role: 'admin', tenant_id: 10 })])
        // findUserById initiator (root, active, same tenant)
        .mockResolvedValueOnce([
          createMockUserRow({ id: 1, role: 'root', tenant_id: 10, is_active: 1 }),
        ])
        .mockResolvedValueOnce([]) // UPDATE users password
        .mockResolvedValueOnce([]) // UPDATE token used
        .mockResolvedValueOnce([{ count: '2' }]); // revoke
      mockBcryptHash.mockResolvedValueOnce('new-hash');

      await expect(service.resetPassword(validResetDto)).resolves.toBeUndefined();

      expect(mockBcryptHash).toHaveBeenCalledWith('NewStrongP@ss1', 12);
      // Password was actually updated (not just burned)
      const updateUserCall = mockDb.systemQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('UPDATE users SET password'),
      );
      expect(updateUserCall).toBeDefined();
    });

    it('should fall through to §2.6 role-gate when initiated_by_user_id is NULL after initiator deletion (FK ON DELETE SET NULL)', async () => {
      // FK SET NULL: deleting the Root sets initiated_by_user_id → NULL. The
      // token now LOOKS like a self-service token → §2.6 role-gate kicks in
      // → admin target → 403 + burn. Phase 1 migration header documents this
      // as the defensive default: ghost-initiator degrades to STRICTER path.
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 42, initiated_by_user_id: null }])
        .mockResolvedValueOnce([createMockUserRow({ id: 42, role: 'admin', tenant_id: 10 })])
        .mockResolvedValueOnce([]); // burnToken

      await expect(service.resetPassword(validResetDto)).rejects.toThrow(ForbiddenException);
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it('should burn + 401 when initiator is_active = 0 (lifecycle failure)', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 42, initiated_by_user_id: 1 }])
        .mockResolvedValueOnce([createMockUserRow({ id: 42, role: 'admin', tenant_id: 10 })])
        .mockResolvedValueOnce([
          createMockUserRow({ id: 1, role: 'root', tenant_id: 10, is_active: 0 }),
        ])
        .mockResolvedValueOnce([]); // burnToken

      await expect(service.resetPassword(validResetDto)).rejects.toThrow(UnauthorizedException);

      // Generic 401 — NOT a role-specific error. Initiator state is never
      // leaked to the token-holder. Token is burned so retry is impossible.
      const burnCall = mockDb.systemQuery.mock.calls[3];
      expect(burnCall?.[0]).toContain('UPDATE password_reset_tokens SET used = true');
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it('should burn + 401 when initiator role was demoted to admin (no longer Root)', async () => {
      // Even a previously-valid Root who got demoted cannot be relied on
      // as the issuance authority. Demotion = credential-issuance privilege
      // revoked retroactively.
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 42, initiated_by_user_id: 1 }])
        .mockResolvedValueOnce([createMockUserRow({ id: 42, role: 'admin', tenant_id: 10 })])
        .mockResolvedValueOnce([
          createMockUserRow({ id: 1, role: 'admin', tenant_id: 10, is_active: 1 }),
        ])
        .mockResolvedValueOnce([]);

      await expect(service.resetPassword(validResetDto)).rejects.toThrow(UnauthorizedException);
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it('should burn + 401 when initiator tenant_id no longer matches target tenant_id (cross-tenant drift)', async () => {
      // Edge case — shouldn't happen under normal operations since users
      // don't move between tenants. Defence-in-depth: if the invariant
      // ever breaks, the origin-check catches it before the redemption.
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 42, initiated_by_user_id: 1 }])
        .mockResolvedValueOnce([createMockUserRow({ id: 42, role: 'admin', tenant_id: 10 })])
        .mockResolvedValueOnce([
          createMockUserRow({ id: 1, role: 'root', tenant_id: 99, is_active: 1 }),
        ])
        .mockResolvedValueOnce([]);

      await expect(service.resetPassword(validResetDto)).rejects.toThrow(UnauthorizedException);
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });
  });
});

// =============================================================
// getJwtSecrets — module-level validation (separate describe,
// uses vi.resetModules + dynamic import to trigger re-evaluation)
// =============================================================

describe('SECURITY: getJwtSecrets validation', () => {
  afterEach(() => {
    process.env['JWT_SECRET'] =
      'test-access-secret-for-vitest-unit-tests-minimum-32-characters-long';
    process.env['JWT_REFRESH_SECRET'] =
      'test-refresh-secret-for-vitest-unit-tests-minimum-32-characters-long';
    vi.resetModules();
  });

  it('should throw when JWT_SECRET is empty', async () => {
    vi.resetModules();
    process.env['JWT_SECRET'] = '';

    await expect(import('./auth.service.js')).rejects.toThrow(
      'SECURITY ERROR: JWT_SECRET must be set',
    );
  });

  it('should throw when JWT_REFRESH_SECRET is empty', async () => {
    vi.resetModules();
    process.env['JWT_REFRESH_SECRET'] = '';

    await expect(import('./auth.service.js')).rejects.toThrow(
      'SECURITY ERROR: JWT_REFRESH_SECRET must be set',
    );
  });

  it('should throw when both secrets are identical', async () => {
    vi.resetModules();
    const same = 'identical-secret-that-is-long-enough-for-the-32-char-minimum-requirement';
    process.env['JWT_SECRET'] = same;
    process.env['JWT_REFRESH_SECRET'] = same;

    await expect(import('./auth.service.js')).rejects.toThrow(
      'JWT_REFRESH_SECRET must be different from JWT_SECRET',
    );
  });
});
