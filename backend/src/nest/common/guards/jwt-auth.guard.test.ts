/**
 * Unit tests for JwtAuthGuard
 *
 * Tests the first layer of the guard chain: JWT validation, user lookup,
 * CLS context setting, @Public() bypass, token extraction (header/cookie/query),
 * inactive user rejection, invalid role rejection, and role-switch support.
 *
 * @see docs/USER-PERMISSIONS-UNIT-TEST-PLAN.md
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockJwtService() {
  return {
    verifyAsync: vi.fn(),
  };
}

function createMockReflector() {
  return {
    getAllAndOverride: vi.fn(),
  };
}

function createMockClsService() {
  return {
    set: vi.fn(),
  };
}

function createMockDatabaseService() {
  const queryFn = vi.fn();
  return { query: queryFn, queryAsTenant: queryFn };
}

interface MockRequestOptions {
  authorization?: string;
  cookies?: Record<string, string>;
  query?: Record<string, string | undefined>;
  /**
   * ADR-050 cross-tenant host check — `TenantHostResolverMiddleware` sets this
   * on the request BEFORE the guard runs. Three-state semantics:
   *   undefined → middleware did not run (existing tests rely on this)
   *   null      → apex / localhost / unknown slug
   *   number    → subdomain resolved
   */
  hostTenantId?: number | null;
}

function createMockExecutionContext(options: MockRequestOptions = {}): ExecutionContext {
  // `hostTenantId` is read via `request.raw` — see ADR-050 + Session 10 D17.
  // The middleware runs under `@fastify/middie` and writes to the raw
  // IncomingMessage; the guard reads via FastifyRequest.raw. The mock
  // mirrors that shape so unit tests catch regressions to the production
  // read-path, not an easier-to-pass flat-object shape.
  const mockRaw: Record<string, unknown> = {};
  if ('hostTenantId' in options) {
    mockRaw['hostTenantId'] = options.hostTenantId;
  }
  const mockRequest: Record<string, unknown> = {
    headers: {
      ...(options.authorization !== undefined ? { authorization: options.authorization } : {}),
    },
    cookies: options.cookies,
    query: options.query ?? {},
    raw: mockRaw,
  };

  const handler = vi.fn();
  const clazz = vi.fn();

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
    getHandler: () => handler,
    getClass: () => clazz,
  } as unknown as ExecutionContext;
}

/** Standard valid JWT payload */
function validJwtPayload(overrides?: Record<string, unknown>) {
  return {
    sub: 1,
    id: 1,
    email: 'test@example.com',
    role: 'admin',
    tenantId: 42,
    type: 'access',
    iat: 1000,
    exp: 9999,
    ...overrides,
  };
}

/** Standard valid user row from DB */
function validUserRow(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    email: 'test@example.com',
    role: 'admin',
    tenant_id: 42,
    first_name: 'Test',
    last_name: 'User',
    is_active: IS_ACTIVE.ACTIVE,
    has_full_access: false,
    ...overrides,
  };
}

// =============================================================
// Tests
// =============================================================

describe('SECURITY: JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockJwtService: ReturnType<typeof createMockJwtService>;
  let mockReflector: ReturnType<typeof createMockReflector>;
  let mockCls: ReturnType<typeof createMockClsService>;
  let mockDb: ReturnType<typeof createMockDatabaseService>;

  beforeEach(() => {
    mockJwtService = createMockJwtService();
    mockReflector = createMockReflector();
    mockCls = createMockClsService();
    mockDb = createMockDatabaseService();

    guard = new JwtAuthGuard(
      mockJwtService as unknown as import('@nestjs/jwt').JwtService,
      mockReflector as unknown as import('@nestjs/core').Reflector,
      mockCls as unknown as import('nestjs-cls').ClsService,
      mockDb as unknown as import('../../database/database.service.js').DatabaseService,
    );

    // Silence logger output during tests
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  // -----------------------------------------------------------
  // @Public() bypass
  // -----------------------------------------------------------

  describe('@Public() bypass', () => {
    it('should pass when @Public() decorator present', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockExecutionContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should not call jwtService when @Public()', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockExecutionContext();

      await guard.canActivate(context);

      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('should check IS_PUBLIC_KEY from handler first, class second', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockExecutionContext();

      await guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });

  // -----------------------------------------------------------
  // Token Extraction
  // -----------------------------------------------------------

  describe('Token Extraction', () => {
    it('should extract from Authorization: Bearer header', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue(validJwtPayload());
      mockDb.query.mockResolvedValue([validUserRow()]);

      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token-123',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token-123');
    });

    it('should extract from cookie accessToken', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue(validJwtPayload());
      mockDb.query.mockResolvedValue([validUserRow()]);

      const context = createMockExecutionContext({
        cookies: { accessToken: 'cookie-token-456' },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('cookie-token-456');
    });

    it('should extract from query parameter token', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue(validJwtPayload());
      mockDb.query.mockResolvedValue([validUserRow()]);

      const context = createMockExecutionContext({
        query: { token: 'query-token-789' },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('query-token-789');
    });

    it('should throw UnauthorizedException when no token anywhere', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  // -----------------------------------------------------------
  // Token Validation
  // -----------------------------------------------------------

  describe('Token Validation', () => {
    it('should throw UnauthorizedException on invalid/expired token', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      const context = createMockExecutionContext({
        authorization: 'Bearer expired-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on non-access token type', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue(validJwtPayload({ type: 'refresh' }));

      const context = createMockExecutionContext({
        authorization: 'Bearer refresh-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  // -----------------------------------------------------------
  // User Lookup
  // -----------------------------------------------------------

  describe('User Lookup', () => {
    it('should throw UnauthorizedException when user not found in DB', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue(validJwtPayload());
      mockDb.query.mockResolvedValue([]);

      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue(validJwtPayload());
      mockDb.query.mockResolvedValue([validUserRow({ is_active: IS_ACTIVE.INACTIVE })]);

      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid role in DB', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue(validJwtPayload());
      mockDb.query.mockResolvedValue([validUserRow({ role: 'hacker' })]);

      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  // -----------------------------------------------------------
  // Context Setting
  // -----------------------------------------------------------

  describe('Context Setting', () => {
    it('should set CLS context (tenantId, userId, userRole, email)', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue(validJwtPayload());
      mockDb.query.mockResolvedValue([validUserRow()]);

      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
      });

      await guard.canActivate(context);

      expect(mockCls.set).toHaveBeenCalledWith('tenantId', 42);
      expect(mockCls.set).toHaveBeenCalledWith('userId', 1);
      expect(mockCls.set).toHaveBeenCalledWith('userRole', 'admin');
      expect(mockCls.set).toHaveBeenCalledWith('userEmail', 'test@example.com');
    });

    it('should attach user to request with NestAuthUser shape', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue(validJwtPayload());
      mockDb.query.mockResolvedValue([validUserRow()]);

      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
      });

      await guard.canActivate(context);

      const request = context.switchToHttp().getRequest() as {
        user: Record<string, unknown>;
      };
      expect(request.user).toEqual(
        expect.objectContaining({
          id: 1,
          email: 'test@example.com',
          role: 'admin',
          activeRole: 'admin',
          isRoleSwitched: false,
          hasFullAccess: false,
          tenantId: 42,
          firstName: 'Test',
          lastName: 'User',
        }),
      );
    });
  });

  // -----------------------------------------------------------
  // Role-Switch Support
  // -----------------------------------------------------------

  describe('Role-Switch Support', () => {
    it('should use activeRole from JWT when isRoleSwitched=true', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue(
        validJwtPayload({
          role: 'admin',
          activeRole: 'employee',
          isRoleSwitched: true,
        }),
      );
      mockDb.query.mockResolvedValue([validUserRow({ role: 'admin' })]);

      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
      });

      await guard.canActivate(context);

      const request = context.switchToHttp().getRequest() as {
        user: Record<string, unknown>;
      };
      expect(request.user).toEqual(
        expect.objectContaining({
          role: 'admin',
          activeRole: 'employee',
          isRoleSwitched: true,
        }),
      );

      // CLS should use activeRole, not original role
      expect(mockCls.set).toHaveBeenCalledWith('userRole', 'employee');
    });
  });

  // -----------------------------------------------------------
  // ADR-050 Cross-Tenant Host Check (three-state hostTenantId)
  // -----------------------------------------------------------
  //
  // The single load-bearing security line of ADR-050. Three branches to cover:
  //   undefined → middleware didn't run (test/legacy) → skip cross-check.
  //   null      → apex/localhost/IP/unknown slug      → skip cross-check.
  //   number    → subdomain resolved → MUST match user.tenantId, else 403.
  //
  // Error-code surface (`CROSS_TENANT_HOST_MISMATCH`) is Loki-alertable and
  // distinct from `HANDOFF_HOST_MISMATCH` (OAuth-flow specific per §R15) —
  // asserted explicitly so a future refactor that collapses the codes would
  // fail loudly.

  describe('ADR-050 Cross-Tenant Host Check', () => {
    beforeEach(() => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue(validJwtPayload({ tenantId: 42 }));
      mockDb.query.mockResolvedValue([validUserRow({ tenant_id: 42 })]);
    });

    it('passes when req.hostTenantId is undefined (middleware did not run)', async () => {
      // Pre-ADR-050 tests above rely on this branch — no hostTenantId
      // means no cross-check, as if we were running on localhost.
      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
        // hostTenantId deliberately omitted
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('passes when req.hostTenantId is null (apex / localhost / IP / unknown)', async () => {
      // TenantHostResolverMiddleware sets null for the apex, dev-localhost,
      // internal calls, and unknown slugs. All of these legitimately have
      // no host-based tenant context and must fall through.
      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
        hostTenantId: null,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('passes when req.hostTenantId matches the JWT tenantId (normal subdomain flow)', async () => {
      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
        hostTenantId: 42,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('throws ForbiddenException CROSS_TENANT_HOST_MISMATCH on tenant mismatch', async () => {
      // JWT was minted for tenant 42 but the request arrived on tenant 999's
      // subdomain. Classic cross-tenant token replay — 403 is mandatory.
      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
        hostTenantId: 999,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('surfaces the discriminable CROSS_TENANT_HOST_MISMATCH error code', async () => {
      // The code is Loki-alertable. Distinct from HANDOFF_HOST_MISMATCH (R15)
      // so OAuth-flow anomalies and general cross-tenant attempts can be
      // told apart in monitoring.
      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
        hostTenantId: 999,
      });

      const err = await guard.canActivate(context).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ForbiddenException);
      const response = (err as ForbiddenException).getResponse() as { code: string };
      expect(response.code).toBe('CROSS_TENANT_HOST_MISMATCH');
    });
  });
});
