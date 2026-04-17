/**
 * OAuthService — unit tests.
 *
 * Scope (plan §3):
 *   - startAuthorization() → PKCE gen + state.create + provider URL
 *   - handleCallback() → state consume → token exchange → id_token verify →
 *     branch on login/signup + R3 duplicate-link defence
 *   - completeSignup() → consume ticket → delegate to SignupService
 *   - R2 replay (via stateService.consume throwing)
 *   - R3 duplicate MS-account on signup → 409 ConflictException
 *   - R8 concurrent-signup race → exactly one succeeds (simulated via
 *     SignupService mock that resolves once and throws Conflict the second time)
 *
 * Dependencies are all mocked (Redis, stateService, provider, accountRepo,
 * signupService). PKCE generation uses real crypto (assert format + consistency).
 */
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SignupResponseData } from '../../signup/dto/index.js';
import type { SignupService } from '../../signup/signup.service.js';
import type { CompleteSignupDto } from './dto/index.js';
import type { OAuthAccountRepository } from './oauth-account.repository.js';
import type { OAuthStateService } from './oauth-state.service.js';
import { OAuthService } from './oauth.service.js';
import type { CallbackResult, OAuthTokens, OAuthUserInfo, SignupTicket } from './oauth.types.js';
import type { ProfilePhotoService } from './profile-photo.service.js';
import type { MicrosoftProvider } from './providers/microsoft.provider.js';

// Mock uuidv7 for deterministic ticket IDs.
vi.mock('uuid', () => ({
  v7: vi.fn(() => 'ticket-uuid-fixed'),
}));

// ─── Fixtures ──────────────────────────────────────────────────────────────

const TENANT_ID = 42;
const USER_ID = 7;
const MS_SUB = 'ms-sub-abc';
const MS_EMAIL = 'admin@tenant.de';

function createMockRedis(): {
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  getdel: ReturnType<typeof vi.fn>;
} {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    // `get` is used by peekSignupTicket (non-consuming); `getdel` by consumeSignupTicket.
    get: vi.fn(),
    getdel: vi.fn(),
  };
}

function createMockStateService(): {
  create: ReturnType<typeof vi.fn>;
  consume: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn().mockResolvedValue('state-uuid'),
    consume: vi.fn(),
  };
}

function createMockProvider(): {
  id: 'microsoft';
  buildAuthorizationUrl: ReturnType<typeof vi.fn>;
  exchangeCodeForTokens: ReturnType<typeof vi.fn>;
  verifyIdToken: ReturnType<typeof vi.fn>;
} {
  return {
    id: 'microsoft',
    buildAuthorizationUrl: vi.fn().mockReturnValue('https://login.microsoftonline.com/…/authorize'),
    exchangeCodeForTokens: vi.fn(),
    verifyIdToken: vi.fn(),
  };
}

function createMockAccountRepo(): {
  findLinkedByProviderSub: ReturnType<typeof vi.fn>;
  updateLastLogin: ReturnType<typeof vi.fn>;
} {
  return {
    findLinkedByProviderSub: vi.fn(),
    updateLastLogin: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockSignupService(): {
  registerTenantWithOAuth: ReturnType<typeof vi.fn>;
} {
  return { registerTenantWithOAuth: vi.fn() };
}

/**
 * ProfilePhotoService is best-effort: default mock resolves to undefined so
 * it never blocks or throws. Individual tests that care about failure
 * behaviour can override `syncIfChanged` per-test.
 */
function createMockProfilePhotoService(): {
  syncIfChanged: ReturnType<typeof vi.fn>;
} {
  return { syncIfChanged: vi.fn().mockResolvedValue(undefined) };
}

function createOAuthTokens(overrides?: Partial<OAuthTokens>): OAuthTokens {
  return {
    accessToken: 'access-token',
    idToken: 'id-token-jwt',
    tokenType: 'Bearer',
    expiresIn: 3600,
    ...overrides,
  };
}

function createOAuthUserInfo(overrides?: Partial<OAuthUserInfo>): OAuthUserInfo {
  return {
    providerUserId: MS_SUB,
    email: MS_EMAIL,
    emailVerified: true,
    displayName: 'Admin Example',
    microsoftTenantId: 'tid-abc',
    ...overrides,
  };
}

function createSignupResponse(): SignupResponseData {
  return {
    tenantId: TENANT_ID,
    userId: USER_ID,
    subdomain: 'test',
    trialEndsAt: '2026-05-01T00:00:00Z',
    message: 'ok',
  };
}

function createCompleteSignupDto(): CompleteSignupDto {
  return {
    ticket: 'ticket-x',
    companyName: 'Test Co',
    subdomain: 'test',
    phone: '+49 30 123',
    adminFirstName: 'Ada',
    adminLastName: 'Admin',
  } as CompleteSignupDto;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('OAuthService', () => {
  let service: OAuthService;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockState: ReturnType<typeof createMockStateService>;
  let mockProvider: ReturnType<typeof createMockProvider>;
  let mockRepo: ReturnType<typeof createMockAccountRepo>;
  let mockSignup: ReturnType<typeof createMockSignupService>;
  let mockPhoto: ReturnType<typeof createMockProfilePhotoService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    mockState = createMockStateService();
    mockProvider = createMockProvider();
    mockRepo = createMockAccountRepo();
    mockSignup = createMockSignupService();
    mockPhoto = createMockProfilePhotoService();
    service = new OAuthService(
      mockRedis as unknown as Redis,
      mockState as unknown as OAuthStateService,
      mockProvider as unknown as MicrosoftProvider,
      mockRepo as unknown as OAuthAccountRepository,
      mockSignup as unknown as SignupService,
      mockPhoto as unknown as ProfilePhotoService,
    );
  });

  // ─── startAuthorization() ───────────────────────────────────────────────

  describe('startAuthorization()', () => {
    it('returns the provider authorize URL', async () => {
      const result = await service.startAuthorization('login');
      expect(result.url).toBe('https://login.microsoftonline.com/…/authorize');
    });

    it('generates a PKCE verifier that is base64url-encoded and ≥43 chars (RFC 7636)', async () => {
      await service.startAuthorization('login');
      const codeVerifier = mockState.create.mock.calls[0]?.[1] as string;
      expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('computes code_challenge = base64url(SHA256(verifier)) and sends it to the provider', async () => {
      await service.startAuthorization('login');
      const verifier = mockState.create.mock.calls[0]?.[1] as string;
      const buildCall = mockProvider.buildAuthorizationUrl.mock.calls[0]?.[0] as {
        codeChallenge: string;
      };
      const expectedChallenge = createHash('sha256').update(verifier).digest('base64url');
      expect(buildCall.codeChallenge).toBe(expectedChallenge);
    });

    it('stores mode in Redis state and propagates it to the provider URL builder', async () => {
      await service.startAuthorization('signup');
      expect(mockState.create).toHaveBeenCalledWith('signup', expect.any(String));
      const buildArgs = mockProvider.buildAuthorizationUrl.mock.calls[0]?.[0] as {
        mode: 'login' | 'signup';
      };
      expect(buildArgs.mode).toBe('signup');
    });
  });

  // ─── handleCallback() — login branch ────────────────────────────────────

  describe('handleCallback() — login', () => {
    beforeEach(() => {
      mockState.consume.mockResolvedValue({
        mode: 'login',
        codeVerifier: 'verifier-xyz',
        createdAt: Date.now(),
      });
      mockProvider.exchangeCodeForTokens.mockResolvedValue(createOAuthTokens());
      mockProvider.verifyIdToken.mockResolvedValue(createOAuthUserInfo());
    });

    it('returns login-success with userId+tenantId when a link exists', async () => {
      mockRepo.findLinkedByProviderSub.mockResolvedValueOnce({
        tenant_id: TENANT_ID,
        user_id: USER_ID,
      });

      const result = await service.handleCallback('auth-code', 'state-uuid');

      expect(result).toEqual({
        mode: 'login-success',
        userId: USER_ID,
        tenantId: TENANT_ID,
      });
    });

    it('triggers fire-and-forget updateLastLogin on login-success (does NOT block response)', async () => {
      mockRepo.findLinkedByProviderSub.mockResolvedValueOnce({
        tenant_id: TENANT_ID,
        user_id: USER_ID,
      });

      await service.handleCallback('auth-code', 'state-uuid');
      expect(mockRepo.updateLastLogin).toHaveBeenCalledWith(TENANT_ID, USER_ID, 'microsoft');
    });

    it('swallows updateLastLogin errors — last-login bump is bookkeeping, not a gate', async () => {
      mockRepo.findLinkedByProviderSub.mockResolvedValueOnce({
        tenant_id: TENANT_ID,
        user_id: USER_ID,
      });
      mockRepo.updateLastLogin.mockRejectedValueOnce(new Error('pg down'));

      await expect(service.handleCallback('auth-code', 'state-uuid')).resolves.toEqual({
        mode: 'login-success',
        userId: USER_ID,
        tenantId: TENANT_ID,
      });
    });

    it('returns login-not-linked when no link exists for the (provider, sub)', async () => {
      mockRepo.findLinkedByProviderSub.mockResolvedValueOnce(null);

      const result = await service.handleCallback('auth-code', 'state-uuid');

      expect(result).toEqual({
        mode: 'login-not-linked',
        email: MS_EMAIL,
      } satisfies CallbackResult);
      expect(mockRepo.updateLastLogin).not.toHaveBeenCalled();
    });

    it('invokes profile photo sync on login-success with (userId, tenantId, accessToken)', async () => {
      mockRepo.findLinkedByProviderSub.mockResolvedValueOnce({
        tenant_id: TENANT_ID,
        user_id: USER_ID,
      });

      await service.handleCallback('auth-code', 'state-uuid');

      expect(mockPhoto.syncIfChanged).toHaveBeenCalledTimes(1);
      expect(mockPhoto.syncIfChanged).toHaveBeenCalledWith(
        USER_ID,
        TENANT_ID,
        'access-token', // from createOAuthTokens()
      );
    });

    it('does NOT invoke photo sync when the provider-sub is not linked (nothing to sync to)', async () => {
      mockRepo.findLinkedByProviderSub.mockResolvedValueOnce(null);

      await service.handleCallback('auth-code', 'state-uuid');

      expect(mockPhoto.syncIfChanged).not.toHaveBeenCalled();
    });

    it('propagates state-replay errors from stateService.consume (R2 defence)', async () => {
      mockState.consume.mockRejectedValueOnce(new UnauthorizedException('Invalid state'));
      await expect(service.handleCallback('auth-code', 'replayed-state')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── handleCallback() — signup branch ───────────────────────────────────

  describe('handleCallback() — signup', () => {
    beforeEach(() => {
      mockState.consume.mockResolvedValue({
        mode: 'signup',
        codeVerifier: 'verifier-xyz',
        createdAt: Date.now(),
      });
      mockProvider.exchangeCodeForTokens.mockResolvedValue(createOAuthTokens());
      mockProvider.verifyIdToken.mockResolvedValue(createOAuthUserInfo());
    });

    it('stores a signup ticket in Redis and returns signup-continue', async () => {
      mockRepo.findLinkedByProviderSub.mockResolvedValueOnce(null);

      const result = await service.handleCallback('auth-code', 'state-uuid');

      expect(result).toEqual({ mode: 'signup-continue', ticket: 'ticket-uuid-fixed' });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'signup-ticket:ticket-uuid-fixed',
        expect.any(String),
        'EX',
        15 * 60,
      );
    });

    it('throws 409 ConflictException when the Microsoft account is already linked (R3)', async () => {
      mockRepo.findLinkedByProviderSub.mockResolvedValueOnce({
        tenant_id: 99,
        user_id: 5,
      });

      await expect(service.handleCallback('auth-code', 'state-uuid')).rejects.toThrow(
        ConflictException,
      );
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  // ─── peekSignupTicket() ─────────────────────────────────────────────────
  // Plan §5.4 — non-consuming ticket read for the /signup/oauth-complete
  // SSR load. The SvelteKit frontend calls this to pre-fill the form with
  // email + display name; the ticket must still be live for the final
  // POST /complete-signup to consume atomically (R8 + single-use invariant).

  describe('peekSignupTicket()', () => {
    const validTicketPayload: SignupTicket = {
      provider: 'microsoft',
      providerUserId: MS_SUB,
      email: MS_EMAIL,
      emailVerified: true,
      displayName: 'Admin Example',
      microsoftTenantId: 'tid-abc',
      accessToken: 'ms-access-token-stashed',
      createdAt: Date.now(),
    };

    it('returns only the user-facing fields (email + displayName) and NOT forensic ids', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(validTicketPayload));
      const preview = await service.peekSignupTicket('ticket-peek');
      expect(preview).toEqual({ email: MS_EMAIL, displayName: 'Admin Example' });
      // Explicit negative assertion — we MUST NOT leak these server-side ids.
      expect(preview).not.toHaveProperty('providerUserId');
      expect(preview).not.toHaveProperty('microsoftTenantId');
      expect(preview).not.toHaveProperty('emailVerified');
      // accessToken MUST never leak through the peek endpoint — it's the whole
      // reason `SignupTicketPreview` is a distinct type (Spec Deviation D7).
      expect(preview).not.toHaveProperty('accessToken');
    });

    it('reads from Redis via GET (non-consuming) — never calls GETDEL', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(validTicketPayload));
      await service.peekSignupTicket('ticket-peek');
      expect(mockRedis.get).toHaveBeenCalledWith('signup-ticket:ticket-peek');
      expect(mockRedis.getdel).not.toHaveBeenCalled();
    });

    it('returns null when the ticket is unknown or expired (get returns null)', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      const preview = await service.peekSignupTicket('missing');
      expect(preview).toBeNull();
    });

    it('throws UnauthorizedException on malformed JSON (tampered Redis payload)', async () => {
      mockRedis.get.mockResolvedValueOnce('{not json');
      await expect(service.peekSignupTicket('bad')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong-shape payload (type guard rejects)', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({ provider: 'not-microsoft', providerUserId: 1 }),
      );
      await expect(service.peekSignupTicket('wrong-shape')).rejects.toThrow(UnauthorizedException);
    });

    it('is idempotent — two peeks in a row both succeed (ticket not consumed)', async () => {
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(validTicketPayload))
        .mockResolvedValueOnce(JSON.stringify(validTicketPayload));
      const first = await service.peekSignupTicket('ticket-peek');
      const second = await service.peekSignupTicket('ticket-peek');
      expect(first).toEqual(second);
      expect(mockRedis.getdel).not.toHaveBeenCalled();
    });
  });

  // ─── completeSignup() ───────────────────────────────────────────────────

  describe('completeSignup()', () => {
    const validTicketPayload: SignupTicket = {
      provider: 'microsoft',
      providerUserId: MS_SUB,
      email: MS_EMAIL,
      emailVerified: true,
      displayName: 'Admin Example',
      microsoftTenantId: 'tid-abc',
      accessToken: 'ms-access-token-stashed',
      createdAt: Date.now(),
    };

    it('consumes the ticket and delegates to SignupService.registerTenantWithOAuth (happy path)', async () => {
      mockRedis.getdel.mockResolvedValueOnce(JSON.stringify(validTicketPayload));
      mockSignup.registerTenantWithOAuth.mockResolvedValueOnce(createSignupResponse());

      const dto = createCompleteSignupDto();
      const result = await service.completeSignup('ticket-x', dto, '127.0.0.1', 'UA');

      expect(mockRedis.getdel).toHaveBeenCalledWith('signup-ticket:ticket-x');
      expect(mockSignup.registerTenantWithOAuth).toHaveBeenCalledWith(
        dto,
        validTicketPayload,
        '127.0.0.1',
        'UA',
      );
      expect(result.tenantId).toBe(TENANT_ID);
    });

    it('invokes profile photo sync AFTER registerTenantWithOAuth — uses the ticket-stashed accessToken (D7)', async () => {
      mockRedis.getdel.mockResolvedValueOnce(JSON.stringify(validTicketPayload));
      mockSignup.registerTenantWithOAuth.mockResolvedValueOnce(createSignupResponse());

      await service.completeSignup('ticket-x', createCompleteSignupDto());

      expect(mockPhoto.syncIfChanged).toHaveBeenCalledTimes(1);
      expect(mockPhoto.syncIfChanged).toHaveBeenCalledWith(
        USER_ID,
        TENANT_ID,
        'ms-access-token-stashed', // from validTicketPayload.accessToken
      );
      // Order invariant: signup MUST succeed before the photo sync fires — a
      // photo sync on a failed signup would target a tenant row that doesn't exist.
      const photoCallOrder = mockPhoto.syncIfChanged.mock.invocationCallOrder[0] ?? 0;
      const signupCallOrder = mockSignup.registerTenantWithOAuth.mock.invocationCallOrder[0] ?? 0;
      expect(photoCallOrder).toBeGreaterThan(signupCallOrder);
    });

    it('throws UnauthorizedException when the ticket is unknown or expired (getdel null)', async () => {
      mockRedis.getdel.mockResolvedValueOnce(null);
      await expect(service.completeSignup('gone', createCompleteSignupDto())).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockSignup.registerTenantWithOAuth).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException on malformed ticket JSON (tampered Redis payload)', async () => {
      mockRedis.getdel.mockResolvedValueOnce('{not valid json');
      await expect(service.completeSignup('bad', createCompleteSignupDto())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException on ticket payload with wrong shape (tampered fields)', async () => {
      mockRedis.getdel.mockResolvedValueOnce(
        JSON.stringify({ provider: 'not-microsoft', providerUserId: 1 }),
      );
      await expect(
        service.completeSignup('wrong-shape', createCompleteSignupDto()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('R8 race: parallel completeSignups — exactly one resolves, the other gets 409', async () => {
      mockRedis.getdel
        .mockResolvedValueOnce(JSON.stringify(validTicketPayload))
        .mockResolvedValueOnce(JSON.stringify(validTicketPayload));
      mockSignup.registerTenantWithOAuth
        .mockResolvedValueOnce(createSignupResponse())
        .mockRejectedValueOnce(
          new ConflictException(
            'Dieses Microsoft-Konto ist bereits mit einem Assixx-Tenant verknüpft.',
          ),
        );

      const results = await Promise.allSettled([
        service.completeSignup('t1', createCompleteSignupDto()),
        service.completeSignup('t2', createCompleteSignupDto()),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    });
  });
});
