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
 * Spec deviation D10 (from ADR-046): scope `offline_access` intentionally NOT requested.
 *   We do not persist refresh tokens. Requesting `offline_access` would trigger an
 *   extra "stay signed-in offline" consent prompt — bad B2B UX. If a future feature
 *   needs a long-lived token, add it back via a separate ADR.
 *
 * Scope `User.Read` (added 2026-04-17 with FEAT_OAUTH_PROFILE_PHOTO — partial reversal
 *   of ADR-046 §A4): required so the initial `access_token` can call Microsoft Graph
 *   `/me/photo/$value` during the OAuth callback to cache the user's profile picture.
 *   The token is used in-flight ONLY and never persisted — the "no token storage"
 *   invariant from ADR-046 §A4 still holds.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2, Step 2.3)
 * @see docs/FEAT_OAUTH_PROFILE_PHOTO_MASTERPLAN.md (Phase 2, Step 2.1–2.2)
 * @see docs/infrastructure/adr/ADR-046-oauth-sign-in.md (Amendment §A4 — Phase 6)
 * @see https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc
 * @see https://learn.microsoft.com/en-us/graph/api/profilephoto-get?view=graph-rest-1.0
 */
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type JWTPayload, createRemoteJWKSet, jwtVerify } from 'jose';

import { getErrorMessage } from '../../../common/utils/error.utils.js';
import type { OAuthTokens, OAuthUserInfo, PhotoMetadata } from '../oauth.types.js';
import type { BuildAuthUrlParams, OAuthProvider } from './oauth-provider.interface.js';

// === Microsoft Identity Platform v2.0 — /organizations/ endpoints ===========
const MS_AUTHORIZE_URL = 'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token';
const MS_JWKS_URL = 'https://login.microsoftonline.com/organizations/discovery/v2.0/keys';

/** v2.0 issuer format: https://login.microsoftonline.com/{tenant-guid}/v2.0 */
const MS_ISSUER_PATTERN = /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]+\/v2\.0$/i;

/**
 * Requested OAuth scopes:
 * - `openid profile email` — OIDC core for id_token + UserInfo (ADR-046).
 * - `User.Read` — Graph delegated permission to read the authenticated user's profile
 *   (incl. `/me/photo/$value`). Used for profile-photo sync (FEAT_OAUTH_PROFILE_PHOTO).
 *   Rejected alternative: `ProfilePhoto.Read.All` — tenant-wide, requires admin consent,
 *   over-privileged for our per-user read. `User.Read` is auto-consented per-user.
 * - `offline_access` — NOT requested, see header doc D10.
 */
const SCOPES = 'openid profile email User.Read';

const JWKS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const CALLBACK_PATH = '/api/v2/auth/oauth/microsoft/callback';

// === Microsoft Graph — profile-photo endpoints (FEAT_OAUTH_PROFILE_PHOTO) ====
/** Metadata (~200 B) — used for ETag compare before binary download. */
const MS_GRAPH_PHOTO_METADATA_URL = 'https://graph.microsoft.com/v1.0/me/photo';
/** Primary binary endpoint — fixed 240x240 keeps payloads small + consistent across users. */
const MS_GRAPH_PHOTO_BINARY_FIXED_URL = 'https://graph.microsoft.com/v1.0/me/photos/240x240/$value';
/** Fallback — returns the largest size the user uploaded (used when 240x240 variant is absent). */
const MS_GRAPH_PHOTO_BINARY_DEFAULT_URL = 'https://graph.microsoft.com/v1.0/me/photo/$value';

/** Metadata call is tiny — tight timeout avoids dragging login latency on Graph issues. */
const GRAPH_METADATA_TIMEOUT_MS = 5_000;
/** Binary download can be up to ~50 KB — a little more headroom. */
const GRAPH_BINARY_TIMEOUT_MS = 10_000;

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

  /**
   * Fetch the signed-in user's profile-photo metadata from Microsoft Graph.
   *
   * Intended for the ETag-cache path in `ProfilePhotoService`: if the returned ETag
   * equals the stored `user_oauth_accounts.photo_etag`, the caller skips the binary
   * fetch entirely (typical re-login saves ~50 KB).
   *
   * Failure mode: NEVER throws. Returns `null` on HTTP 404, 1x1-placeholder response,
   * non-OK HTTP, network error, abort (timeout), or JSON parse error. The caller
   * treats `null` as "no photo to sync" and continues the login/signup flow.
   *
   * @param accessToken — Short-lived Graph access token from the OAuth callback.
   *                      Used in-flight only, never persisted (ADR-046 §A4 invariant).
   */
  async fetchPhotoMetadata(accessToken: string): Promise<PhotoMetadata | null> {
    const response = await this.graphFetch(
      MS_GRAPH_PHOTO_METADATA_URL,
      accessToken,
      GRAPH_METADATA_TIMEOUT_MS,
    );
    if (response === null) return null;
    if (!response.ok) {
      // 404 is the common "no photo" signal; still log higher-severity codes for ops.
      if (response.status !== 404) {
        this.logger.warn(`Graph metadata HTTP ${response.status}`);
      }
      return null;
    }
    try {
      const json = (await response.json()) as Record<string, unknown>;
      return MicrosoftProvider.projectPhotoMetadata(json);
    } catch (error: unknown) {
      this.logger.warn(`Graph metadata parse error: ${getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * Fetch the signed-in user's profile-photo binary from Microsoft Graph.
   *
   * Tries the fixed 240x240 variant first (consistent avatar size, smaller payload).
   * Falls back to the default `/me/photo/$value` (largest available) on 404 —
   * covers the edge case where the user's original upload is smaller than 240x240
   * so the fixed-size variant was never generated.
   *
   * Failure mode: same contract as `fetchPhotoMetadata` — never throws, returns
   * `null` on any terminal error.
   *
   * @returns JPEG/PNG/GIF bytes, or `null` when no photo is available.
   */
  async fetchPhotoBinary(accessToken: string): Promise<Buffer | null> {
    for (const url of [MS_GRAPH_PHOTO_BINARY_FIXED_URL, MS_GRAPH_PHOTO_BINARY_DEFAULT_URL]) {
      const response = await this.graphFetch(url, accessToken, GRAPH_BINARY_TIMEOUT_MS);
      if (response === null) continue;
      if (response.status === 404) continue;
      if (!response.ok) {
        this.logger.warn(`Graph binary HTTP ${response.status}`);
        return null;
      }
      try {
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error: unknown) {
        this.logger.warn(`Graph binary read error: ${getErrorMessage(error)}`);
        return null;
      }
    }
    return null;
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

  /**
   * GET a Microsoft Graph URL with bearer auth + abort-controller timeout.
   *
   * Returns `null` only on network / abort errors. HTTP-level errors come back as a
   * non-ok `Response` so the caller can distinguish semantic 404s (= "no photo",
   * expected) from 5xx (= log-and-skip). No body is read here — that's the caller's
   * concern because the two photo endpoints read different formats (JSON vs binary).
   *
   * The bearer token is passed via `Authorization` header only — never embedded in
   * the URL, never logged. Error messages include only the URL (safe: hardcoded Graph
   * endpoint, no user data) and the normalized error message.
   */
  private async graphFetch(
    url: string,
    accessToken: string,
    timeoutMs: number,
  ): Promise<Response | null> {
    const controller = new AbortController();
    const timeout = setTimeout((): void => {
      controller.abort();
    }, timeoutMs);
    try {
      return await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
    } catch (error: unknown) {
      this.logger.warn(`Graph fetch network error (${url}): ${getErrorMessage(error)}`);
      return null;
    } finally {
      clearTimeout(timeout);
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

  /**
   * Project the raw Graph `/me/photo` JSON into `PhotoMetadata` or filter to `null`.
   *
   * Filters out the "no photo" signals Graph returns in lieu of a 404:
   *   - `width === 1 && height === 1` — 1x1 GIF placeholder
   *   - empty `@odata.mediaEtag` — same signal, double-checked for robustness
   *
   * Missing / malformed fields get safe defaults (empty string, 0). The caller only
   * distinguishes `null` vs non-null, so a partial-but-usable metadata beats a throw
   * on a minor schema drift from Microsoft.
   */
  private static projectPhotoMetadata(json: Record<string, unknown>): PhotoMetadata | null {
    const width = typeof json['width'] === 'number' ? json['width'] : 0;
    const height = typeof json['height'] === 'number' ? json['height'] : 0;
    const rawEtag = typeof json['@odata.mediaEtag'] === 'string' ? json['@odata.mediaEtag'] : '';
    const contentType =
      typeof json['@odata.mediaContentType'] === 'string' ?
        json['@odata.mediaContentType']
      : 'application/octet-stream';

    // Graph returns a 1x1 GIF placeholder (+ empty ETag) when the user has no photo.
    if ((width === 1 && height === 1) || rawEtag === '') {
      return null;
    }
    return {
      etag: MicrosoftProvider.normalizeEtag(rawEtag),
      width,
      height,
      contentType,
    };
  }

  /**
   * Strip HTTP ETag syntax to a bare token suitable for a VARCHAR(64) column.
   *
   * Removes the optional `W/` weak-validator prefix and surrounding double quotes.
   * Example: `W/"BA09D118"` → `BA09D118`. Idempotent — running it twice is a no-op.
   */
  private static normalizeEtag(raw: string): string {
    const withoutWeak = raw.startsWith('W/') ? raw.slice(2) : raw;
    return withoutWeak.replace(/^"|"$/g, '');
  }
}
