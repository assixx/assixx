/**
 * Unit tests for AuthService
 *
 * Phase 5: Tests verifyToken (public pure method), token reuse detection,
 * and safe user response building.
 *
 * DatabaseService and JwtService are mocked — no real DB calls or JWT signing.
 *
 * IMPORTANT: process.env must have valid JWT secrets BEFORE auth.service.js
 * is imported, because getJwtSecrets() runs at module evaluation time.
 */
import crypto from 'node:crypto';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

// Override JWT secrets before auth.service.js is imported (getJwtSecrets validation)
vi.hoisted(() => {
  process.env['JWT_SECRET'] =
    'test-access-secret-for-vitest-unit-tests-minimum-32-characters-long';
  process.env['JWT_REFRESH_SECRET'] =
    'test-refresh-secret-for-vitest-unit-tests-minimum-32-characters-long';
});

import type { JwtService } from '@nestjs/jwt';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { DatabaseService } from '../database/database.service.js';
import { AuthService } from './auth.service.js';

// Factory for mock dependencies
function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
  };
}

function createMockJwtService() {
  return {
    sign: vi.fn(),
    verify: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;
type MockJwt = ReturnType<typeof createMockJwtService>;

// Factory for NestAuthUser test data
function createAuthUser(
  overrides: Partial<NestAuthUser> = {},
): NestAuthUser {
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

// =============================================================
// AuthService
// =============================================================

describe('AuthService', () => {
  let service: AuthService;
  let mockDb: MockDb;
  let mockJwt: MockJwt;

  beforeEach(() => {
    mockDb = createMockDb();
    mockJwt = createMockJwtService();
    service = new AuthService(
      mockDb as unknown as DatabaseService,
      mockJwt as unknown as JwtService,
    );
  });

  // =============================================================
  // verifyToken — public, pure method
  // =============================================================

  describe('verifyToken', () => {
    it('should return valid: true', () => {
      const user = createAuthUser();

      const result = service.verifyToken(user);

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
      const user = createAuthUser();

      const result = service.verifyToken(user);

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
  // refresh — token reuse detection (SECURITY)
  // =============================================================

  describe('refresh', () => {
    const fakeRefreshToken = 'eyJhbGciOiJIUzI1NiJ9.fake-refresh-token';
    const fakeTokenHash = crypto
      .createHash('sha256')
      .update(fakeRefreshToken)
      .digest('hex');

    it('should throw UnauthorizedException when token was already used', async () => {
      // 1. verifyRefreshJwt: jwtService.verify returns valid decoded payload
      mockJwt.verify.mockReturnValueOnce({
        id: 1,
        email: 'admin@test.de',
        role: 'admin',
        tenantId: 10,
        type: 'refresh',
        family: 'family-abc-123',
      });

      // 2. isTokenAlreadyUsed: token exists AND has been used (used_at is not null)
      mockDb.query.mockResolvedValueOnce([{ used_at: new Date() }]);

      // 3. revokeTokenFamily: CTE returns affected count
      mockDb.query.mockResolvedValueOnce([{ count: '5' }]);

      await expect(
        service.refresh({ refreshToken: fakeRefreshToken }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should include security alert message on reuse detection', async () => {
      mockJwt.verify.mockReturnValueOnce({
        id: 1,
        email: 'admin@test.de',
        role: 'admin',
        tenantId: 10,
        type: 'refresh',
        family: 'family-abc-123',
      });

      // Token found and already used
      mockDb.query.mockResolvedValueOnce([{ used_at: new Date() }]);
      // Revoke family
      mockDb.query.mockResolvedValueOnce([{ count: '3' }]);

      await expect(
        service.refresh({ refreshToken: fakeRefreshToken }),
      ).rejects.toThrow('Token reuse detected');
    });

    it('should revoke entire token family on reuse detection', async () => {
      mockJwt.verify.mockReturnValueOnce({
        id: 1,
        email: 'admin@test.de',
        role: 'admin',
        tenantId: 10,
        type: 'refresh',
        family: 'family-xyz-789',
      });

      mockDb.query.mockResolvedValueOnce([{ used_at: new Date() }]);
      mockDb.query.mockResolvedValueOnce([{ count: '4' }]);

      await expect(
        service.refresh({ refreshToken: fakeRefreshToken }),
      ).rejects.toThrow(UnauthorizedException);

      // Verify revokeTokenFamily was called with the family ID
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET is_revoked = true'),
        ['family-xyz-789'],
      );
    });

    it('should not treat unused token as reuse', async () => {
      mockJwt.verify.mockReturnValueOnce({
        id: 1,
        email: 'admin@test.de',
        role: 'admin',
        tenantId: 10,
        type: 'refresh',
        family: 'family-abc-123',
      });

      // Token found but NOT used yet (used_at is null)
      mockDb.query.mockResolvedValueOnce([{ used_at: null }]);

      // findValidRefreshToken — token exists in DB
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
      ]);

      // generateTokensWithRotation: jwtService.sign for access + refresh tokens
      mockJwt.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      // Store new refresh token in DB
      mockDb.query.mockResolvedValueOnce([]);

      // Mark old token as used
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.refresh({
        refreshToken: fakeRefreshToken,
      });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should not treat unknown token as reuse', async () => {
      mockJwt.verify.mockReturnValueOnce({
        id: 1,
        email: 'admin@test.de',
        role: 'admin',
        tenantId: 10,
        type: 'refresh',
        family: 'family-abc-123',
      });

      // isTokenAlreadyUsed: no token found in DB → not reuse
      mockDb.query.mockResolvedValueOnce([]);

      // findValidRefreshToken: also not found (pre-rotation token)
      mockDb.query.mockResolvedValueOnce([]);

      // generateTokensWithRotation: sign access + refresh
      mockJwt.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      // Store new refresh token
      mockDb.query.mockResolvedValueOnce([]);

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
        id: 1,
        email: 'admin@test.de',
        role: 'admin',
        tenantId: 10,
        type: 'access', // Wrong type!
      });

      await expect(
        service.refresh({ refreshToken: fakeRefreshToken }),
      ).rejects.toThrow('Not a refresh token');
    });
  });
});
