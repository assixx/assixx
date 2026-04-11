/**
 * Cloudflare Turnstile — Server-side Token Verification
 *
 * Verifies Turnstile tokens against Cloudflare's siteverify API.
 * Used by login (+page.server.ts) and signup (/api/turnstile) routes.
 *
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
import { createLogger } from '$lib/utils/logger';

import { env } from '$env/dynamic/private';

const log = createLogger('Turnstile');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerifyResponse {
  success: boolean;
  action?: string;
  'error-codes'?: string[];
}

/**
 * Verify a Turnstile token server-side.
 *
 * Returns true if:
 * - Secret key not configured (graceful dev fallback)
 * - Token + action verified successfully by Cloudflare
 */
export async function verifyTurnstile(
  token: string,
  remoteIp: string,
  expectedAction: string,
): Promise<boolean> {
  const secretKey = env.TURNSTILE_SECRET_KEY;

  if (secretKey === '') {
    log.warn('TURNSTILE_SECRET_KEY not configured — skipping verification');
    return true;
  }

  try {
    const body: Record<string, string> = {
      secret: secretKey,
      response: token,
    };

    if (remoteIp !== '' && remoteIp !== 'unknown') {
      body.remoteip = remoteIp;
    }

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as TurnstileVerifyResponse;

    if (!data.success) {
      log.warn({ errorCodes: data['error-codes'] }, 'Turnstile verification failed');
      return false;
    }

    // Only enforce action check if Cloudflare returned one. Cloudflare's dummy
    // test secret keys (1x00…AA / 2x00…AB) omit the `action` field entirely —
    // enforcing strict equality would break E2E tests. A wrong action is still
    // rejected; only the "field missing" case is tolerated.
    if (data.action !== undefined && data.action !== expectedAction) {
      log.warn({ expected: expectedAction, got: data.action }, 'Turnstile action mismatch');
      return false;
    }

    return true;
  } catch (err: unknown) {
    log.error({ err }, 'Turnstile verification error');
    return false;
  }
}
