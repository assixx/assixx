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
export function extractJwtExp(token: string): number {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format (expected 3 dot-separated parts)');
  }
  const payloadPart = parts[1];
  if (payloadPart === '') {
    throw new Error('Invalid JWT payload segment');
  }
  const payloadJson = Buffer.from(payloadPart, 'base64url').toString('utf-8');
  const payload = JSON.parse(payloadJson) as { exp?: unknown };
  const exp = payload.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    throw new Error('JWT missing numeric exp claim');
  }
  return exp;
}
