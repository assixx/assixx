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
import type { DatabaseService } from '../database/database.service.js';
import { AuthService } from './auth.service.js';

// =============================================================
// Module-level mocks
// =============================================================

// JWT secrets must be set BEFORE auth.service.js loads (getJwtSecrets validation)
const { mockBcryptCompare, mockBcryptHash } = vi.hoisted(() => {
  process.env['JWT_SECRET'] =
    'test-access-secret-for-vitest-unit-tests-minimum-32-characters-long';
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

function createMockDb(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn() };
}

function createMockJwtService(): {
  sign: ReturnType<typeof vi.fn>;
  verify: ReturnType<typeof vi.fn>;
} {
  return { sign: vi.fn(), verify: vi.fn() };
}

type MockDb = ReturnType<typeof createMockDb>;
type MockJwt = ReturnType<typeof createMockJwtService>;

function createAuthUser(overrides: Partial<NestAuthUser> = {}): NestAuthUser {
  return {
    id: 1,
    email: 'admin@test.de',
    role: 'admin',
    tenantId: 10,
    activeRole: 'admin',
    isRoleSwitched: false,
    ...overrides,
  };
}

function createMockUserRow(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
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
function setupLoginMocks(
  db: MockDb,
  jwt: MockJwt,
  userOverrides?: Record<string, unknown>,
): void {
  db.query.mockResolvedValueOnce([createMockUserRow(userOverrides)]); // findUserByEmail
  mockBcryptCompare.mockResolvedValueOnce(true); // password match
  jwt.sign
    .mockReturnValueOnce('mock-access-token') // access
    .mockReturnValueOnce('mock-refresh-token'); // refresh
  db.query.mockResolvedValueOnce([]); // storeRefreshToken
  db.query.mockResolvedValueOnce([]); // updateLastLogin
  db.query.mockResolvedValueOnce([]); // logLoginAudit
}

// =============================================================
// Tests
// =============================================================

describe('SECURITY: AuthService', () => {
  let service: AuthService;
  let mockDb: MockDb;
  let mockJwt: MockJwt;

  beforeEach(() => {
    mockBcryptCompare.mockReset();
    mockBcryptHash.mockReset();
    mockDb = createMockDb();
    mockJwt = createMockJwtService();
    service = new AuthService(
      mockDb as unknown as DatabaseService,
      mockJwt as unknown as JwtService,
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
    ] as const)(
      'should echo role "%s" and tenantId %d from user',
      (role, tenantId) => {
        const user = createAuthUser({ role, tenantId, activeRole: role });

        const result = service.verifyToken(user);

        expect(result.user.role).toBe(role);
        expect(result.user.tenantId).toBe(tenantId);
      },
    );
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
      mockDb.query.mockResolvedValueOnce([]); // no user found

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it.each([
      [0, 'inactive'],
      [3, 'archived'],
      [4, 'deleted'],
    ])(
      'should throw ForbiddenException for is_active=%i (%s) user',
      async (isActive) => {
        mockDb.query.mockResolvedValueOnce([
          createMockUserRow({ is_active: isActive }),
        ]);

        await expect(service.login(loginDto)).rejects.toThrow(
          ForbiddenException,
        );
      },
    );

    it('should throw UnauthorizedException for wrong password', async () => {
      mockDb.query.mockResolvedValueOnce([createMockUserRow()]);
      mockBcryptCompare.mockResolvedValueOnce(false); // password mismatch

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should lowercase email before lookup', async () => {
      setupLoginMocks(mockDb, mockJwt);

      await service.login({ email: 'ADMIN@TEST.DE', password: 'StrongP@ss1' });

      const emailParam = (mockDb.query.mock.calls[0]?.[1] as string[])?.[0];
      expect(emailParam).toBe('admin@test.de');
    });

    it('should call updateLastLogin after successful auth', async () => {
      setupLoginMocks(mockDb, mockJwt);

      await service.login(loginDto);

      // updateLastLogin is the 3rd db.query call (index 2)
      const updateCall = mockDb.query.mock.calls[2];
      expect(updateCall?.[0]).toContain('UPDATE users SET last_login');
    });

    it('should not fail login when audit log fails', async () => {
      mockDb.query.mockResolvedValueOnce([createMockUserRow()]); // findUser
      mockBcryptCompare.mockResolvedValueOnce(true);
      mockJwt.sign
        .mockReturnValueOnce('access-tok')
        .mockReturnValueOnce('refresh-tok');
      mockDb.query.mockResolvedValueOnce([]); // storeRefreshToken
      mockDb.query.mockResolvedValueOnce([]); // updateLastLogin
      mockDb.query.mockRejectedValueOnce(new Error('Audit DB error')); // logLoginAudit fails

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

      // storeRefreshToken is the 2nd db.query call (index 1)
      const storeParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(storeParams?.[5]).toBe('192.168.1.1'); // ip_address
      expect(storeParams?.[6]).toBe('Mozilla/5.0'); // user_agent
    });

    it('should sign access token with access secret', async () => {
      setupLoginMocks(mockDb, mockJwt);

      await service.login(loginDto);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'access' }),
        expect.objectContaining({
          secret:
            'test-access-secret-for-vitest-unit-tests-minimum-32-characters-long',
        }),
      );
    });

    it('should sign refresh token with separate refresh secret', async () => {
      setupLoginMocks(mockDb, mockJwt);

      await service.login(loginDto);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refresh' }),
        expect.objectContaining({
          secret:
            'test-refresh-secret-for-vitest-unit-tests-minimum-32-characters-long',
        }),
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
      db.query.mockResolvedValueOnce([]); // findUserByEmail → no existing
      mockBcryptHash.mockResolvedValueOnce('hashed-password');
      db.query.mockResolvedValueOnce([{ id: 42 }]); // createUser RETURNING id
      db.query.mockResolvedValueOnce([createMockUserRow({ id: 42 })]); // findUserById
    }

    it('should allow admin to create user', async () => {
      setupRegisterMocks(mockDb);

      const result = await service.register(
        registerDto,
        createAuthUser({ activeRole: 'admin' }),
      );

      expect(result).toEqual(expect.objectContaining({ id: 42 }));
    });

    it('should allow root to create user', async () => {
      setupRegisterMocks(mockDb);

      const result = await service.register(
        registerDto,
        createAuthUser({ activeRole: 'root' }),
      );

      expect(result).toEqual(expect.objectContaining({ id: 42 }));
    });

    it('should throw ForbiddenException for non-admin role', async () => {
      await expect(
        service.register(
          registerDto,
          createAuthUser({ activeRole: 'employee' }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when email already exists', async () => {
      mockDb.query.mockResolvedValueOnce([createMockUserRow()]); // email found

      await expect(
        service.register(registerDto, createAuthUser()),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw UnauthorizedException for email with empty prefix', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no existing user

      await expect(
        service.register(
          { ...registerDto, email: '@test.de' },
          createAuthUser(),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should hash password with bcrypt salt rounds 12', async () => {
      setupRegisterMocks(mockDb);

      await service.register(registerDto, createAuthUser());

      expect(mockBcryptHash).toHaveBeenCalledWith('StrongP@ss1', 12);
    });

    it('should throw InternalServerErrorException when user retrieval fails', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no existing
      mockBcryptHash.mockResolvedValueOnce('hashed');
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]); // createUser
      mockDb.query.mockResolvedValueOnce([]); // findUserById returns empty

      await expect(
        service.register(registerDto, createAuthUser()),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when INSERT returns no id', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no existing
      mockBcryptHash.mockResolvedValueOnce('hashed');
      mockDb.query.mockResolvedValueOnce([]); // INSERT returns empty!

      await expect(
        service.register(registerDto, createAuthUser()),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should extract username from email prefix', async () => {
      setupRegisterMocks(mockDb);

      await service.register(
        { ...registerDto, email: 'john.doe@company.com' },
        createAuthUser(),
      );

      // createUser INSERT is the 2nd db.query call (index 1)
      const insertParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(insertParams?.[1]).toBe('john.doe'); // username
    });
  });

  // =============================================================
  // logout
  // =============================================================

  describe('logout', () => {
    it('should revoke all tokens and return count', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '5' }]); // revokeAllUserTokens
      mockDb.query.mockResolvedValueOnce([]); // logLogoutAudit

      const result = await service.logout(createAuthUser());

      expect(result).toEqual({ tokensRevoked: 5 });
    });

    it('should not fail when audit log fails', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '2' }]); // revoke
      mockDb.query.mockRejectedValueOnce(new Error('Audit fail')); // audit

      const result = await service.logout(createAuthUser());

      expect(result).toEqual({ tokensRevoked: 2 });
    });

    it('should return 0 when no tokens to revoke', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]); // none to revoke
      mockDb.query.mockResolvedValueOnce([]); // audit

      const result = await service.logout(createAuthUser());

      expect(result).toEqual({ tokensRevoked: 0 });
    });
  });

  // =============================================================
  // getCurrentUser
  // =============================================================

  describe('getCurrentUser', () => {
    it('should return user when found', async () => {
      mockDb.query.mockResolvedValueOnce([createMockUserRow()]);

      const result = await service.getCurrentUser(createAuthUser());

      expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });

    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no user

      await expect(service.getCurrentUser(createAuthUser())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should query with correct userId and tenantId', async () => {
      mockDb.query.mockResolvedValueOnce([createMockUserRow()]);

      await service.getCurrentUser(createAuthUser({ id: 42, tenantId: 99 }));

      const queryParams = mockDb.query.mock.calls[0]?.[1] as number[];
      expect(queryParams?.[0]).toBe(42);
      expect(queryParams?.[1]).toBe(99);
    });
  });

  // =============================================================
  // refresh — token reuse detection & rotation (SECURITY)
  // =============================================================

  describe('refresh', () => {
    const fakeRefreshToken = 'fake-refresh-token-for-unit-test';
    const fakeTokenHash = crypto
      .createHash('sha256')
      .update(fakeRefreshToken)
      .digest('hex');

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
      mockDb.query.mockResolvedValueOnce([{ used_at: new Date() }]); // already used
      mockDb.query.mockResolvedValueOnce([{ count: '5' }]); // revoke family

      await expect(
        service.refresh({ refreshToken: fakeRefreshToken }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should include security alert message on reuse detection', async () => {
      mockJwt.verify.mockReturnValueOnce(validDecodedPayload);
      mockDb.query.mockResolvedValueOnce([{ used_at: new Date() }]);
      mockDb.query.mockResolvedValueOnce([{ count: '3' }]);

      await expect(
        service.refresh({ refreshToken: fakeRefreshToken }),
      ).rejects.toThrow('Token reuse detected');
    });

    it('should revoke entire token family on reuse detection', async () => {
      mockJwt.verify.mockReturnValueOnce({
        ...validDecodedPayload,
        family: 'family-xyz-789',
      });
      mockDb.query.mockResolvedValueOnce([{ used_at: new Date() }]);
      mockDb.query.mockResolvedValueOnce([{ count: '4' }]);

      await expect(
        service.refresh({ refreshToken: fakeRefreshToken }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET is_revoked = true'),
        ['family-xyz-789'],
      );
    });

    it('should not treat unused token as reuse', async () => {
      mockJwt.verify.mockReturnValueOnce(validDecodedPayload);
      mockDb.query.mockResolvedValueOnce([{ used_at: null }]); // not used
      mockDb.query.mockResolvedValueOnce([
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
      mockJwt.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      mockDb.query.mockResolvedValueOnce([]); // storeRefreshToken
      mockDb.query.mockResolvedValueOnce([]); // markTokenAsUsed

      const result = await service.refresh({
        refreshToken: fakeRefreshToken,
      });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should not treat unknown token as reuse', async () => {
      mockJwt.verify.mockReturnValueOnce(validDecodedPayload);
      mockDb.query.mockResolvedValueOnce([]); // isTokenAlreadyUsed → not found
      mockDb.query.mockResolvedValueOnce([]); // findValidRefreshToken → not found
      mockJwt.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      mockDb.query.mockResolvedValueOnce([]); // storeRefreshToken

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

      await expect(
        service.refresh({ refreshToken: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw specific message for expired refresh token', async () => {
      mockJwt.verify.mockImplementationOnce(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await expect(
        service.refresh({ refreshToken: 'expired-token' }),
      ).rejects.toThrow('Refresh token has expired');
    });

    it('should reject non-refresh token type', async () => {
      mockJwt.verify.mockReturnValueOnce({
        ...validDecodedPayload,
        type: 'access', // Wrong type!
      });

      await expect(
        service.refresh({ refreshToken: fakeRefreshToken }),
      ).rejects.toThrow('Not a refresh token');
    });

    // ----- Phase 14 additions -----

    it('should mark old token as used when storedToken exists', async () => {
      mockJwt.verify.mockReturnValueOnce(validDecodedPayload);
      mockDb.query.mockResolvedValueOnce([{ used_at: null }]); // not used
      mockDb.query.mockResolvedValueOnce([
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
      mockJwt.sign
        .mockReturnValueOnce('new-access')
        .mockReturnValueOnce('new-refresh');
      mockDb.query.mockResolvedValueOnce([]); // storeRefreshToken
      mockDb.query.mockResolvedValueOnce([]); // markTokenAsUsed

      await service.refresh({ refreshToken: fakeRefreshToken });

      // markTokenAsUsed is the last db.query call
      const lastCall =
        mockDb.query.mock.calls[mockDb.query.mock.calls.length - 1];
      expect(lastCall?.[0]).toContain('UPDATE refresh_tokens');
      expect(lastCall?.[0]).toContain('used_at');
      expect((lastCall?.[1] as string[])?.[0]).toBe(fakeTokenHash);
    });

    it('should NOT mark old token when storedToken is null', async () => {
      mockJwt.verify.mockReturnValueOnce(validDecodedPayload);
      mockDb.query.mockResolvedValueOnce([]); // isTokenAlreadyUsed → not found
      mockDb.query.mockResolvedValueOnce([]); // findValidRefreshToken → null
      mockJwt.sign
        .mockReturnValueOnce('new-access')
        .mockReturnValueOnce('new-refresh');
      mockDb.query.mockResolvedValueOnce([]); // storeRefreshToken

      await service.refresh({ refreshToken: fakeRefreshToken });

      // Only 3 db.query calls: isTokenAlreadyUsed, findValid, storeRefresh
      // No markTokenAsUsed call
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should skip family revocation when decoded.family is undefined', async () => {
      mockJwt.verify.mockReturnValueOnce({
        ...validDecodedPayload,
        family: undefined, // no family
      });
      // Token found AND already used
      mockDb.query.mockResolvedValueOnce([{ used_at: new Date() }]);

      await expect(
        service.refresh({ refreshToken: fakeRefreshToken }),
      ).rejects.toThrow(UnauthorizedException);

      // Only 1 db.query call (isTokenAlreadyUsed), no revokeTokenFamily call
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });
});
