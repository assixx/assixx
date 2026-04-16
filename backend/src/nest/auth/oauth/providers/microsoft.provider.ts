/**
 * Microsoft (Azure AD v2.0) OAuth provider.
 *
 * Implements the provider-agnostic `OAuthProvider` interface against the Microsoft
 * Identity Platform v2.0 endpoints, restricted to the `/organizations/` tenant
 * (work/school accounts only — personal `@outlook.com` etc. are rejected by Microsoft).
 *
 * Hardening:
 *   - PKCE (S256) sent on every authorization request and required on token exchange (R9).
 *   - id_token signature verified against Microsoft JWKS (24h cache via `jose.createRemoteJWKSet`).
 *   - Issuer matched against the v2.0 pattern `https://login.microsoftonline.com/{tid}/v2.0` (R-iss).
 *   - Audience pinned to our client_id (R-aud).
 *   - `email_verified` claim, when present, MUST be `true` (R1).
 *   - All sensitive substrings redacted from error logs (R7).
 *
 * Spec deviation D10: scope `offline_access` intentionally NOT requested. We do not
 *   persist refresh tokens in V1 (no Microsoft Graph integration — see plan §2.4).
 *   Requesting it would trigger an extra "stay signed-in offline" consent prompt — bad
 *   B2B UX. If a future feature needs Graph access, add it back via a separate ADR.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2, Step 2.3)
 * @see ADR-046 (to be written) for the V1 token-storage policy.
 * @see https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc
 */
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type JWTPayload, createRemoteJWKSet, jwtVerify } from 'jose';

import { getErrorMessage } from '../../../common/utils/error.utils.js';
import type { OAuthTokens, OAuthUserInfo } from '../oauth.types.js';
import type { BuildAuthUrlParams, OAuthProvider } from './oauth-provider.interface.js';

// === Microsoft Identity Platform v2.0 — /organizations/ endpoints ===========
const MS_AUTHORIZE_URL = 'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token';
const MS_JWKS_URL = 'https://login.microsoftonline.com/organizations/discovery/v2.0/keys';

/** v2.0 issuer format: https://login.microsoftonline.com/{tenant-guid}/v2.0 */
const MS_ISSUER_PATTERN = /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]+\/v2\.0$/i;

/** No `offline_access` — see header doc D10. */
const SCOPES = 'openid profile email';

const JWKS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const CALLBACK_PATH = '/api/v2/auth/oauth/microsoft/callback';

/** Header values + body keys that must never reach plaintext logs (R7). */
const SENSITIVE_KEYS = [
  'client_secret',
  'code',
  'code_verifier',
  'access_token',
  'refresh_token',
  'id_token',
  'authorization',
] as const;

/** Microsoft v2.0 ID-token claims we read. Other claims are ignored. */
interface MicrosoftIdTokenClaims extends JWTPayload {
  email?: string;
  email_verified?: boolean;
  name?: string;
  tid?: string;
}

@Injectable()
export class MicrosoftProvider implements OAuthProvider {
  readonly id = 'microsoft' as const;
  private readonly logger = new Logger(MicrosoftProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.clientId = this.requireConfig('MICROSOFT_OAUTH_CLIENT_ID');
    this.clientSecret = this.requireConfig('MICROSOFT_OAUTH_CLIENT_SECRET');
    this.redirectUri = `${this.requireConfig('PUBLIC_APP_URL')}${CALLBACK_PATH}`;
    this.jwks = createRemoteJWKSet(new URL(MS_JWKS_URL), {
      cacheMaxAge: JWKS_CACHE_MAX_AGE_MS,
      timeoutDuration: FETCH_TIMEOUT_MS,
    });
    // R4 mitigation: log the resolved redirect URI at boot for diagnosis.
    // client_id is logged but not the secret. URI is not sensitive.
    this.logger.log(`Microsoft OAuth initialised. redirect_uri=${this.redirectUri}`);
  }

  buildAuthorizationUrl(params: BuildAuthUrlParams): string {
    const url = new URL(MS_AUTHORIZE_URL);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('response_mode', 'query');
    if (params.mode === 'signup') {
      // Force consent so the admin actively approves app permissions on first sign-up.
      url.searchParams.set('prompt', 'consent');
    }
    return url.toString();
  }

  async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: this.redirectUri,
    });

    const response = await this.postForm(MS_TOKEN_URL, body);
    if (!response.ok) {
      const text = await response.text().catch((): string => '');
      this.logger.warn(`Token exchange HTTP ${response.status}: ${this.redact(text)}`);
      throw new UnauthorizedException('Token exchange failed (provider error)');
    }
    const json = (await response.json()) as Record<string, unknown>;
    return MicrosoftProvider.parseTokenResponse(json);
  }

  async verifyIdToken(idToken: string): Promise<OAuthUserInfo> {
    const payload = await this.jwtVerifyOrThrow(idToken);
    MicrosoftProvider.assertValidIssuer(payload.iss);
    MicrosoftProvider.assertEmailVerified(payload);
    return MicrosoftProvider.projectClaimsToUserInfo(payload);
  }

  // === private helpers =====================================================

  private requireConfig(key: string): string {
    const v = this.config.get<string>(key);
    if (v === undefined || v === '') {
      throw new Error(`Missing required config: ${key} (boot-time assertion failed)`);
    }
    return v;
  }

  /** POST application/x-www-form-urlencoded with timeout + safe error wrapping. */
  private async postForm(url: string, body: URLSearchParams): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout((): void => {
      controller.abort();
    }, FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
        signal: controller.signal,
      });
    } catch (error: unknown) {
      this.logger.error(`Token endpoint network error: ${getErrorMessage(error)}`);
      throw new UnauthorizedException('Token exchange failed (network)');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async jwtVerifyOrThrow(idToken: string): Promise<MicrosoftIdTokenClaims> {
    try {
      const result = await jwtVerify<MicrosoftIdTokenClaims>(idToken, this.jwks, {
        audience: this.clientId,
      });
      return result.payload;
    } catch (error: unknown) {
      this.logger.warn(`ID token verification failed: ${getErrorMessage(error)}`);
      throw new UnauthorizedException('Invalid ID token');
    }
  }

  /** Redact sensitive JSON / form values in a raw error body for safe logging (R7). */
  private redact(raw: string): string {
    let out = raw;
    for (const key of SENSITIVE_KEYS) {
      const jsonRe = new RegExp(`("${key}"\\s*:\\s*)"[^"]*"`, 'g');
      out = out.replace(jsonRe, `$1"[REDACTED]"`);
      const formRe = new RegExp(`(${key}=)[^&\\s"]+`, 'g');
      out = out.replace(formRe, `$1[REDACTED]`);
    }
    return out;
  }

  // === static helpers (no `this` capture — easier to unit-test in isolation) =

  private static parseTokenResponse(json: Record<string, unknown>): OAuthTokens {
    const accessToken = MicrosoftProvider.requireString(json, 'access_token');
    const idToken = MicrosoftProvider.requireString(json, 'id_token');
    const tokenType = MicrosoftProvider.requireString(json, 'token_type');
    const expiresIn = json['expires_in'];
    if (typeof expiresIn !== 'number') {
      throw new UnauthorizedException('Token response missing `expires_in`');
    }
    const refreshTokenRaw = json['refresh_token'];
    const refreshToken = typeof refreshTokenRaw === 'string' ? refreshTokenRaw : undefined;
    return {
      accessToken,
      idToken,
      tokenType,
      expiresIn,
      // exactOptionalPropertyTypes: only spread when defined (no explicit `undefined`).
      ...(refreshToken !== undefined && { refreshToken }),
    };
  }

  private static requireString(json: Record<string, unknown>, key: string): string {
    const v = json[key];
    if (typeof v !== 'string' || v === '') {
      throw new UnauthorizedException(`Token response missing \`${key}\``);
    }
    return v;
  }

  private static assertValidIssuer(iss: string | undefined): void {
    if (iss === undefined || !MS_ISSUER_PATTERN.test(iss)) {
      throw new UnauthorizedException('Invalid token issuer');
    }
  }

  /**
   * Microsoft v2.0 ID tokens for /organizations/ accounts often OMIT `email_verified`
   * (work/school accounts are AD-managed and inherently verified). When the claim IS
   * present, it MUST be true — defends R1 (Azure tenant spoofing where attacker creates
   * an account with an unverified email).
   */
  private static assertEmailVerified(payload: MicrosoftIdTokenClaims): void {
    // Explicit `=== false` (not `!== true`) — payload.email_verified narrows to boolean
    // after the first guard, ESLint @typescript-eslint/no-unnecessary-boolean-literal-compare
    // tolerates the strict-equality form and it reads more clearly: "claim present and false".
    if (payload.email_verified === false) {
      throw new UnauthorizedException('Email not verified by identity provider');
    }
  }

  private static projectClaimsToUserInfo(p: MicrosoftIdTokenClaims): OAuthUserInfo {
    if (p.sub === undefined || p.email === undefined) {
      throw new UnauthorizedException('ID token missing required claims (sub/email)');
    }
    return {
      providerUserId: p.sub,
      email: p.email,
      // See assertEmailVerified — absent claim treated as true for /organizations/ accounts.
      emailVerified: p.email_verified ?? true,
      displayName: p.name ?? null,
      microsoftTenantId: p.tid ?? null,
    };
  }
}
