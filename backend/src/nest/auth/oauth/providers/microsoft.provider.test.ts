/**
 * MicrosoftProvider — unit tests.
 *
 * Scope (plan §3):
 *   - buildAuthorizationUrl() — /organizations/ endpoint, PKCE S256, scopes,
 *     prompt=consent only on signup mode
 *   - exchangeCodeForTokens() — code_verifier always sent (R9), body shape,
 *     error propagation
 *   - verifyIdToken() — issuer regex match, email_verified gating (R1),
 *     required-claim assertion
 *
 * Mocks:
 *   - `jose.jwtVerify` and `jose.createRemoteJWKSet` — never hit real Microsoft JWKS
 *   - Global `fetch` — deterministic token-endpoint responses
 *   - `ConfigService.get` — injects test secrets so constructor doesn't throw
 */
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { jwtVerify } from 'jose';
// Node URLSearchParams is a runtime global but not in the eslint test-globals list — import explicitly.
import { URLSearchParams } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MicrosoftProvider } from './microsoft.provider.js';

// ─── Module mocks ──────────────────────────────────────────────────────────

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(),
}));

const mockedJwtVerify = vi.mocked(jwtVerify);

// ─── Fixtures ──────────────────────────────────────────────────────────────

const CLIENT_ID = 'client-id-uuid';
const CLIENT_SECRET = 'client-secret-value';
const PUBLIC_APP_URL = 'http://localhost:3000';
const REDIRECT_URI = 'http://localhost:3000/api/v2/auth/oauth/microsoft/callback';
const CALLBACK_PATH = '/api/v2/auth/oauth/microsoft/callback';
const VALID_ISSUER = 'https://login.microsoftonline.com/00000000-0000-0000-0000-000000000001/v2.0';

function createMockConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  const values: Record<string, string | undefined> = {
    MICROSOFT_OAUTH_CLIENT_ID: CLIENT_ID,
    MICROSOFT_OAUTH_CLIENT_SECRET: CLIENT_SECRET,
    PUBLIC_APP_URL,
    ...overrides,
  };
  return {
    get: vi.fn((key: string): string | undefined => values[key]),
  } as unknown as ConfigService;
}

function createFetchResponse(init: {
  ok: boolean;
  status: number;
  jsonBody?: Record<string, unknown>;
  textBody?: string;
}): Response {
  return {
    ok: init.ok,
    status: init.status,
    json: vi.fn().mockResolvedValue(init.jsonBody ?? {}),
    text: vi.fn().mockResolvedValue(init.textBody ?? ''),
  } as unknown as Response;
}

function baseClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: VALID_ISSUER,
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: 'ms-sub-abc',
    email: 'admin@tenant.de',
    email_verified: true,
    name: 'Admin Example',
    tid: '00000000-0000-0000-0000-000000000001',
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('MicrosoftProvider', () => {
  let provider: MicrosoftProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new MicrosoftProvider(createMockConfig());
  });

  // ─── constructor boot-time assertions ───────────────────────────────────

  describe('constructor', () => {
    it('throws on missing MICROSOFT_OAUTH_CLIENT_ID (fail-fast boot)', () => {
      expect(
        () => new MicrosoftProvider(createMockConfig({ MICROSOFT_OAUTH_CLIENT_ID: undefined })),
      ).toThrow(/MICROSOFT_OAUTH_CLIENT_ID/);
    });

    it('throws on missing MICROSOFT_OAUTH_CLIENT_SECRET', () => {
      expect(
        () => new MicrosoftProvider(createMockConfig({ MICROSOFT_OAUTH_CLIENT_SECRET: undefined })),
      ).toThrow(/MICROSOFT_OAUTH_CLIENT_SECRET/);
    });

    it('throws on missing PUBLIC_APP_URL (R4 mitigation)', () => {
      expect(() => new MicrosoftProvider(createMockConfig({ PUBLIC_APP_URL: undefined }))).toThrow(
        /PUBLIC_APP_URL/,
      );
    });
  });

  // ─── buildAuthorizationUrl() ────────────────────────────────────────────

  describe('buildAuthorizationUrl()', () => {
    it('targets the /organizations/ authorize endpoint (rejects personal accounts)', () => {
      const url = provider.buildAuthorizationUrl({
        state: 'state-1',
        codeChallenge: 'challenge-abc',
        mode: 'login',
      });
      expect(url).toMatch(
        /^https:\/\/login\.microsoftonline\.com\/organizations\/oauth2\/v2\.0\/authorize\?/,
      );
    });

    it('includes all required OAuth2 + PKCE query params', () => {
      const raw = provider.buildAuthorizationUrl({
        state: 'state-xyz',
        codeChallenge: 'challenge-abc',
        mode: 'login',
      });
      const params = new URL(raw).searchParams;
      expect(params.get('client_id')).toBe(CLIENT_ID);
      expect(params.get('response_type')).toBe('code');
      expect(params.get('redirect_uri')).toBe(REDIRECT_URI);
      expect(params.get('state')).toBe('state-xyz');
      expect(params.get('code_challenge')).toBe('challenge-abc');
      expect(params.get('code_challenge_method')).toBe('S256');
      expect(params.get('response_mode')).toBe('query');
    });

    it('scope is `openid profile email` — NO offline_access (D10, no refresh-token storage in V1)', () => {
      const raw = provider.buildAuthorizationUrl({
        state: 'state-1',
        codeChallenge: 'challenge-1',
        mode: 'login',
      });
      const scope = new URL(raw).searchParams.get('scope');
      expect(scope).toBe('openid profile email');
      expect(scope).not.toContain('offline_access');
    });

    it('adds prompt=consent on signup mode (admin must actively approve)', () => {
      const raw = provider.buildAuthorizationUrl({
        state: 'state-1',
        codeChallenge: 'challenge-1',
        mode: 'signup',
      });
      expect(new URL(raw).searchParams.get('prompt')).toBe('consent');
    });

    it('omits prompt=consent on login mode', () => {
      const raw = provider.buildAuthorizationUrl({
        state: 'state-1',
        codeChallenge: 'challenge-1',
        mode: 'login',
      });
      expect(new URL(raw).searchParams.get('prompt')).toBeNull();
    });

    it('redirect_uri derives from PUBLIC_APP_URL + fixed callback path', () => {
      const alt = new MicrosoftProvider(
        createMockConfig({ PUBLIC_APP_URL: 'https://www.assixx.com' }),
      );
      const raw = alt.buildAuthorizationUrl({
        state: 'state-1',
        codeChallenge: 'challenge-1',
        mode: 'login',
      });
      expect(new URL(raw).searchParams.get('redirect_uri')).toBe(
        `https://www.assixx.com${CALLBACK_PATH}`,
      );
    });
  });

  // ─── exchangeCodeForTokens() ────────────────────────────────────────────

  describe('exchangeCodeForTokens()', () => {
    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    it('always sends code_verifier in the token request body (R9 PKCE-downgrade defence)', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createFetchResponse({
          ok: true,
          status: 200,
          jsonBody: {
            access_token: 'a',
            id_token: 'i',
            token_type: 'Bearer',
            expires_in: 3600,
          },
        }),
      );
      await provider.exchangeCodeForTokens('auth-code', 'verifier-xyz');

      const body = vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string;
      const params = new URLSearchParams(body);
      expect(params.get('code_verifier')).toBe('verifier-xyz');
    });

    it('sends the full OAuth2 authorization_code body', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createFetchResponse({
          ok: true,
          status: 200,
          jsonBody: {
            access_token: 'a',
            id_token: 'i',
            token_type: 'Bearer',
            expires_in: 3600,
          },
        }),
      );
      await provider.exchangeCodeForTokens('auth-code', 'verifier-xyz');

      const body = vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string;
      const params = new URLSearchParams(body);
      expect(params.get('grant_type')).toBe('authorization_code');
      expect(params.get('code')).toBe('auth-code');
      expect(params.get('client_id')).toBe(CLIENT_ID);
      expect(params.get('client_secret')).toBe(CLIENT_SECRET);
      expect(params.get('redirect_uri')).toBe(REDIRECT_URI);
    });

    it('throws UnauthorizedException on non-200 response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createFetchResponse({
          ok: false,
          status: 400,
          textBody: '{"error":"invalid_grant"}',
        }),
      );
      await expect(provider.exchangeCodeForTokens('bad-code', 'verifier')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when response is missing access_token or id_token', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createFetchResponse({
          ok: true,
          status: 200,
          jsonBody: { token_type: 'Bearer', expires_in: 3600 },
        }),
      );
      await expect(provider.exchangeCodeForTokens('auth-code', 'verifier')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── verifyIdToken() ────────────────────────────────────────────────────

  describe('verifyIdToken()', () => {
    it('returns OAuthUserInfo projected from verified claims — happy path', async () => {
      mockedJwtVerify.mockResolvedValueOnce({
        payload: baseClaims(),
        protectedHeader: { alg: 'RS256' },
        key: {},
      } as never);

      const info = await provider.verifyIdToken('id.token.jwt');

      expect(info).toEqual({
        providerUserId: 'ms-sub-abc',
        email: 'admin@tenant.de',
        emailVerified: true,
        displayName: 'Admin Example',
        microsoftTenantId: '00000000-0000-0000-0000-000000000001',
      });
    });

    it('rejects token whose issuer does not match the v2.0 /{tid}/v2.0 pattern', async () => {
      mockedJwtVerify.mockResolvedValueOnce({
        payload: baseClaims({ iss: 'https://evil.example.com/v2.0' }),
        protectedHeader: { alg: 'RS256' },
        key: {},
      } as never);

      await expect(provider.verifyIdToken('id.token.jwt')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects token with explicit email_verified=false (R1 Azure-tenant-spoofing defence)', async () => {
      mockedJwtVerify.mockResolvedValueOnce({
        payload: baseClaims({ email_verified: false }),
        protectedHeader: { alg: 'RS256' },
        key: {},
      } as never);

      await expect(provider.verifyIdToken('id.token.jwt')).rejects.toThrow(UnauthorizedException);
    });

    it('accepts /organizations/ token WITHOUT email_verified claim (treated as true)', async () => {
      const claims = baseClaims();
      delete (claims as Record<string, unknown>)['email_verified'];
      mockedJwtVerify.mockResolvedValueOnce({
        payload: claims,
        protectedHeader: { alg: 'RS256' },
        key: {},
      } as never);

      const info = await provider.verifyIdToken('id.token.jwt');
      expect(info.emailVerified).toBe(true);
    });

    it('rejects token missing required sub claim', async () => {
      const claims = baseClaims();
      delete (claims as Record<string, unknown>)['sub'];
      mockedJwtVerify.mockResolvedValueOnce({
        payload: claims,
        protectedHeader: { alg: 'RS256' },
        key: {},
      } as never);

      await expect(provider.verifyIdToken('id.token.jwt')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects token missing required email claim', async () => {
      const claims = baseClaims();
      delete (claims as Record<string, unknown>)['email'];
      mockedJwtVerify.mockResolvedValueOnce({
        payload: claims,
        protectedHeader: { alg: 'RS256' },
        key: {},
      } as never);

      await expect(provider.verifyIdToken('id.token.jwt')).rejects.toThrow(UnauthorizedException);
    });

    it('propagates signature-verification failure as UnauthorizedException', async () => {
      mockedJwtVerify.mockRejectedValueOnce(new Error('signature invalid'));
      await expect(provider.verifyIdToken('id.token.jwt')).rejects.toThrow(UnauthorizedException);
    });
  });
});
