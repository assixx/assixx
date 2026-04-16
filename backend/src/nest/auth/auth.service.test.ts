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
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { MailerService } from '../common/services/mailer.service.js';
import type { DatabaseService } from '../database/database.service.js';
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

function createMockMailer(): { sendPasswordReset: ReturnType<typeof vi.fn> } {
  return { sendPasswordReset: vi.fn().mockResolvedValue(undefined) };
}

type MockDb = ReturnType<typeof createMockDb>;
type MockJwt = ReturnType<typeof createMockJwtService>;
type MockMailer = ReturnType<typeof createMockMailer>;

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
}

// =============================================================
// Tests
// =============================================================

describe('SECURITY: AuthService', () => {
  let service: AuthService;
  let mockDb: MockDb;
  let mockJwt: MockJwt;
  let mockMailer: MockMailer;

  beforeEach(() => {
    mockBcryptCompare.mockReset();
    mockBcryptHash.mockReset();
    mockDb = createMockDb();
    mockJwt = createMockJwtService();
    mockMailer = createMockMailer();
    service = new AuthService(
      mockDb as unknown as DatabaseService,
      mockJwt as unknown as JwtService,
      mockMailer as unknown as MailerService,
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
    it('should silently return when user does not exist', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // findUserByEmail → none

      await expect(service.forgotPassword({ email: 'unknown@test.de' })).resolves.toBeUndefined();

      // Only the lookup query — no INSERT, no mailer call
      expect(mockDb.systemQuery).toHaveBeenCalledTimes(1);
      expect(mockMailer.sendPasswordReset).not.toHaveBeenCalled();
    });

    it.each([
      [0, 'inactive'],
      [3, 'archived'],
      [4, 'deleted'],
    ])('should silently return for is_active=%i (%s) user', async (isActive) => {
      mockDb.systemQuery.mockResolvedValueOnce([createMockUserRow({ is_active: isActive })]);

      await expect(service.forgotPassword({ email: 'admin@test.de' })).resolves.toBeUndefined();

      expect(mockDb.systemQuery).toHaveBeenCalledTimes(1);
      expect(mockMailer.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('should invalidate existing tokens, insert hashed token, and call mailer on happy path', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([createMockUserRow({ id: 7 })]) // findUserByEmail
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
        .mockResolvedValueOnce([createMockUserRow()])
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
        .mockResolvedValueOnce([createMockUserRow()])
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
        .mockResolvedValueOnce([createMockUserRow()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockMailer.sendPasswordReset.mockRejectedValueOnce(new Error('mailer crash'));

      // forgotPassword does NOT wrap mailer in try/catch — that's the mailer's job.
      // Test documents this contract: if mailer ever throws, AuthService bubbles it up.
      await expect(service.forgotPassword({ email: 'admin@test.de' })).rejects.toThrow(
        'mailer crash',
      );
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

    it('should hash new password with bcrypt rounds=12 on happy path', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 7 }]) // SELECT token row
        .mockResolvedValueOnce([]) // UPDATE users
        .mockResolvedValueOnce([]) // UPDATE password_reset_tokens used
        .mockResolvedValueOnce([createMockUserRow({ id: 7 })]) // findUserById
        .mockResolvedValueOnce([{ count: '3' }]); // revokeAllUserTokensByUserId
      mockBcryptHash.mockResolvedValueOnce('new-hashed-pw');

      await service.resetPassword(validResetDto);

      expect(mockBcryptHash).toHaveBeenCalledWith('NewStrongP@ss1', 12);
    });

    it('should mark token as used and revoke refresh tokens by user_id (no tenant scope)', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 7 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([createMockUserRow({ id: 7 })])
        .mockResolvedValueOnce([{ count: '2' }]);
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

    it('should NOT call revoke when findUserById returns null (defensive branch)', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 7 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // findUserById → null
      mockBcryptHash.mockResolvedValueOnce('new-hash');

      await service.resetPassword(validResetDto);

      // 4 calls: SELECT token, UPDATE users, UPDATE token used, SELECT findUserById
      // No 5th call for revoke
      expect(mockDb.systemQuery).toHaveBeenCalledTimes(4);
    });

    it('should default to 0 when revokeAllUserTokensByUserId returns empty result', async () => {
      mockDb.systemQuery
        .mockResolvedValueOnce([{ id: 99, user_id: 7 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([createMockUserRow({ id: 7 })])
        .mockResolvedValueOnce([]); // empty CTE result
      mockBcryptHash.mockResolvedValueOnce('new-hash');

      await expect(service.resetPassword(validResetDto)).resolves.toBeUndefined();
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
