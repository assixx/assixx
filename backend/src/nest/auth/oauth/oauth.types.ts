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
 * Result of `OAuthService.handleCallback()` — discriminated union.
 *
 * Mapping to controller redirects:
 *   - `login-success`     -> set JWT cookies, 302 -> /dashboard
 *   - `login-not-linked`  -> 302 -> /login?oauth=not-linked
 *   - `signup-continue`   -> 302 -> /signup/oauth-complete?ticket={uuid}
 *   - `provider-error`    -> 302 -> /login?oauth=error&reason=...  (e.g. user denied consent)
 */
export type CallbackResult =
  | { mode: 'login-success'; userId: number; tenantId: number }
  | { mode: 'login-not-linked'; email: string }
  | { mode: 'signup-continue'; ticket: string }
  | { mode: 'provider-error'; reason: string };

/**
 * Redis-stored signup ticket — bridges the OAuth callback (provider-resolved identity)
 * to the company-details form submission. 15-min TTL, single-use on `completeSignup()`.
 */
export interface SignupTicket {
  provider: OAuthProviderId;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  microsoftTenantId: string | null;
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
