/**
 * Provider abstraction — V1 ships only Microsoft, but the interface keeps
 * `oauth.service.ts` provider-agnostic so V2 (Google, Apple, GitHub) plugs in
 * without orchestrator rewrites.
 *
 * Concrete implementation: providers/microsoft.provider.ts (Step 2.3).
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2)
 */
import type { OAuthProviderId, OAuthTokens, OAuthUserInfo } from '../oauth.types.js';

export interface BuildAuthUrlParams {
  state: string;
  /** PKCE S256 code_challenge — base64url(SHA256(code_verifier)). */
  codeChallenge: string;
  mode: 'login' | 'signup';
}

export interface OAuthProvider {
  /** Stable identifier used in DB rows + log lines. */
  readonly id: OAuthProviderId;

  /**
   * Build the provider's authorization URL (302 target). The browser is redirected
   * to this URL; the user authenticates there; the provider redirects back to our
   * callback with `?code=...&state=...`.
   */
  buildAuthorizationUrl(params: BuildAuthUrlParams): string;

  /**
   * Exchange the authorization code for tokens. POST to the provider's /token endpoint
   * with `grant_type=authorization_code`, the code, the PKCE code_verifier, our
   * client_id + client_secret, and the redirect_uri.
   */
  exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokens>;

  /**
   * Verify the id_token signature against the provider's JWKS, validate claims
   * (`iss`, `aud`, `exp`, `email_verified`), and project the resolved identity into
   * our generic `OAuthUserInfo` shape.
   *
   * @throws UnauthorizedException on bad signature, wrong issuer, expired token,
   *         or `email_verified !== true`.
   */
  verifyIdToken(idToken: string): Promise<OAuthUserInfo>;
}
