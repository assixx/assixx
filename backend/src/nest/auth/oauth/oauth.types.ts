/**
 * OAuth shared types — provider-agnostic.
 *
 * V1 supports only Microsoft. The shape stays generic so V2 providers (Google, Apple,
 * GitHub) plug into the same orchestration layer without renames. Redis-stored payloads,
 * provider token responses, and resolved identity all live here.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2, Step 2.1)
 * @see ADR-046 (to be written in Phase 6) for the rationale on V1 scope.
 */

/** Sign-in vs sign-up flow — drives provider-redirect parameters and post-callback routing. */
export type OAuthMode = 'login' | 'signup';

/** Provider discriminator. V1: 'microsoft' only. Extend the union when a second provider lands. */
export type OAuthProviderId = 'microsoft';

/**
 * Redis-stored state for the in-flight authorization request.
 * Single-use (GETDEL on consume), 10-min TTL — TTL enforced by Redis, not application code.
 */
export interface OAuthState {
  mode: OAuthMode;
  /** RFC 7636 PKCE code_verifier (>=43 char URL-safe base64). */
  codeVerifier: string;
  /** Epoch ms at creation — diagnostics only; expiry is Redis-driven. */
  createdAt: number;
  /**
   * Subdomain the user started the OAuth flow on, if any (ADR-050 §OAuth,
   * masterplan §Step 2.5). Apex-initiated flows → undefined, same as today.
   * Subdomain-initiated flows → slug → callback mints a handoff-token and
   * redirects to `https://{slug}.assixx.com/signup/oauth-complete?token=…`.
   *
   * Server-stored (not a URL/cookie round-trip value) — URL-tampering at
   * `/initiate` is neutralised structurally by the handoff endpoint's
   * host cross-check (R15: `req.hostTenantId === payload.tenantId`).
   */
  returnToSlug?: string;
}

/**
 * Redis-stored single-use handoff payload minted by the OAuth callback
 * when a user completes login on a subdomain-initiated flow
 * (ADR-050 §OAuth, masterplan §Step 2.5). 60-s TTL, consumed by
 * `POST /api/v2/auth/oauth/handoff` which sets the auth cookies
 * scoped to the subdomain origin.
 *
 * Only `login-success` callbacks produce a handoff — signup flows
 * create the tenant inside the subsequent form submission, so there
 * is no pre-existing tenantId to anchor the R15 host-check against.
 */
export interface OAuthHandoffPayload {
  userId: number;
  tenantId: number;
  accessToken: string;
  refreshToken: string;
  /** Epoch ms at mint — diagnostics only; expiry is Redis-driven. */
  createdAt: number;
}

/**
 * Token response from the provider's /token endpoint.
 *
 * V1 does NOT persist access_token / refresh_token. They live only in transient memory
 * during one callback handling, then are discarded. Persisting them would require a
 * data-protection ADR (Microsoft Graph access scope).
 */
export interface OAuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Resolved identity from the provider after id_token signature + claims verification.
 *
 * `microsoftTenantId` is provider-specific (Microsoft `tid` claim) and intentionally
 * left here for V1 simplicity. V2 may move it under a discriminated `providerData`
 * field once a second provider exposes its own audit identifier.
 */
export interface OAuthUserInfo {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  microsoftTenantId: string | null;
}

/**
 * Microsoft Graph `/me/photo` metadata — used for ETag-cached profile-photo sync.
 *
 * Captured during the OAuth callback (requires the `User.Read` scope on the access
 * token) and compared against `user_oauth_accounts.photo_etag` on each login. When
 * the ETag matches the stored value the binary download is skipped — typical
 * re-login saves the ~50 KB photo fetch.
 *
 * `etag` is the normalized `@odata.mediaEtag` value: HTTP-ETag double quotes and
 * the optional `W/` weak-validator prefix stripped, leaving a bare token that fits
 * the `VARCHAR(64)` column.
 *
 * The provider translates Graph's "no photo" signals (HTTP 404, 1x1 GIF placeholder,
 * empty ETag) to `null` before reaching this type — every `PhotoMetadata` returned
 * represents a real photo the caller can act on.
 *
 * @see docs/FEAT_OAUTH_PROFILE_PHOTO_MASTERPLAN.md (Phase 2, Step 2.2)
 * @see https://learn.microsoft.com/en-us/graph/api/profilephoto-get?view=graph-rest-1.0
 */
export interface PhotoMetadata {
  /** Normalized ETag — surrounding quotes and `W/` prefix stripped. Fits VARCHAR(64). */
  etag: string;
  /** Photo width in pixels. The `width === 1 && height === 1` placeholder is filtered out. */
  width: number;
  /** Photo height in pixels. */
  height: number;
  /** MIME type from `@odata.mediaContentType` (e.g. `image/jpeg`, `image/png`). */
  contentType: string;
}

/**
 * Result of `OAuthService.handleCallback()` — discriminated union.
 *
 * Mapping to controller redirects:
 *   - `login-success`     -> set JWT cookies, 302 -> /dashboard (apex)
 *                            OR mint handoff-token + 302 -> https://{slug}.assixx.com/... (subdomain)
 *   - `login-not-linked`  -> 302 -> /login?oauth=not-linked (same origin)
 *   - `signup-continue`   -> 302 -> /signup/oauth-complete?ticket={uuid} (same origin)
 *   - `provider-error`    -> 302 -> /login?oauth=error&reason=... (same origin)
 *
 * `returnToSlug` (ADR-050 §OAuth) travels through every variant so the
 * controller can redirect back to the subdomain the user started on, not
 * the apex. Apex-initiated flows leave it undefined — existing behaviour.
 */
export type CallbackResult =
  | { mode: 'login-success'; userId: number; tenantId: number; returnToSlug?: string }
  | { mode: 'login-not-linked'; email: string; returnToSlug?: string }
  | { mode: 'signup-continue'; ticket: string; returnToSlug?: string }
  | { mode: 'provider-error'; reason: string; returnToSlug?: string };

/**
 * Redis-stored signup ticket — bridges the OAuth callback (provider-resolved identity)
 * to the company-details form submission. 15-min TTL, single-use on `completeSignup()`.
 *
 * `accessToken` is carried so `OAuthService.completeSignup` can trigger the
 * profile-photo sync (FEAT_OAUTH_PROFILE_PHOTO) right after tenant+user creation.
 * Security posture (Spec Deviation D7, 2026-04-17):
 *   - Stored in the same Redis instance that already holds the PKCE `codeVerifier`
 *     (`OAuthState`) — which is strictly MORE sensitive than a short-lived access
 *     token. So no new storage-tier risk surface.
 *   - Single-use (GETDEL on consume) + 15-min TTL + Redis password + `oauth:`
 *     keyPrefix isolation.
 *   - NEVER exposed through the peek endpoint (see `SignupTicketPreview` below).
 *   - ADR-046 §A4 "no token persistence" still holds at the DB layer — Redis is
 *     transient, scoped, and bounded.
 */
export interface SignupTicket {
  provider: OAuthProviderId;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  microsoftTenantId: string | null;
  /** Graph access token — consumed once by `ProfilePhotoService.syncIfChanged` and discarded. */
  accessToken: string;
  createdAt: number;
}

/**
 * Subset of SignupTicket returned by the peek endpoint (Phase 5, Step 5.4).
 *
 * Only the fields needed to pre-fill the /signup/oauth-complete form. Forensic
 * identifiers (`providerUserId`, `microsoftTenantId`) stay server-side — they
 * would leak information about the caller's Azure tenant structure to any code
 * able to reach the endpoint with a ticket id.
 */
export interface SignupTicketPreview {
  email: string;
  displayName: string | null;
}
