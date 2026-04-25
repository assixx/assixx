/**
 * Extract the `exp` claim (Unix seconds) from a JWT without verifying the
 * signature. Caller is trusted — we decoded a token our own backend just
 * minted and returned to us via a same-origin server-side fetch.
 *
 * Must mirror `backend/src/nest/auth/auth.controller.ts::extractJwtExp` —
 * both halves write the `accessTokenExp` cookie, divergence breaks the
 * 3-cookie invariant (accessToken + refreshToken + accessTokenExp).
 *
 * @see ADR-046 OAuth Sign-In (2026-04-16 amendment — tokenExp-cookie pattern)
 */
import type { UserRole } from '@assixx/shared';

export function extractJwtExp(token: string): number {
  const payload = decodeJwtPayload(token);
  const exp = payload.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    throw new Error('JWT missing numeric exp claim');
  }
  return exp;
}

/**
 * Extract the `role` claim from a JWT without verifying the signature. Same
 * trust model as `extractJwtExp`: caller holds a token that our backend just
 * minted (e.g. fresh from a successful `/auth/oauth/handoff` swap). Used by
 * the OAuth handoff consumer page to populate the `userRole` cookie without
 * an extra `/users/me` round-trip (ADR-050 §OAuth, masterplan §Step 5.4).
 *
 * The backend always includes `role` in the JWT payload — see
 * `backend/src/nest/auth/auth.service.ts::JwtPayload`. A missing or
 * non-matching `role` claim is a drift/bug condition and throws.
 */
export function extractJwtRole(token: string): UserRole {
  const payload = decodeJwtPayload(token);
  const role = payload.role;
  if (!isUserRole(role)) {
    throw new Error('JWT missing valid role claim');
  }
  return role;
}

/**
 * Base64url-decode the JWT payload segment and parse it as JSON. Shared by
 * the claim extractors above — both need the same "decode-and-parse, no
 * signature check" prefix. Kept private; export the typed accessors instead.
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format (expected 3 dot-separated parts)');
  }
  // TS 6.0 narrows `parts[1]` to `string` after the `parts.length !== 3`
  // throw above (tuple-length narrowing), so no `=== undefined` needed.
  const payloadPart = parts[1];
  if (payloadPart === '') {
    throw new Error('Invalid JWT payload segment');
  }
  const payloadJson = Buffer.from(payloadPart, 'base64url').toString('utf-8');
  const parsed = JSON.parse(payloadJson) as unknown;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('JWT payload is not an object');
  }
  return parsed as Record<string, unknown>;
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'root' || value === 'admin' || value === 'employee' || value === 'dummy';
}
