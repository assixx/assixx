/**
 * Turnstile Token Verification API Endpoint
 *
 * POST /api/turnstile — verifies a Cloudflare Turnstile token server-side.
 * Used by the signup page (client-side form submission).
 * Login uses its own +page.server.ts action instead.
 */
import { json } from '@sveltejs/kit';

import { verifyTurnstile } from '$lib/server/turnstile';

import type { RequestHandler } from './$types';

interface VerifyRequestBody {
  token?: string;
  action?: string;
}

export const POST: RequestHandler = async ({ request }) => {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '';

  let body: VerifyRequestBody;
  try {
    body = (await request.json()) as VerifyRequestBody;
  } catch {
    return json({ success: false, error: 'Ungültiger Request' }, { status: 400 });
  }

  const { token, action } = body;

  if (typeof token !== 'string' || token === '') {
    return json({ success: false, error: 'Token fehlt' }, { status: 400 });
  }

  const valid = await verifyTurnstile(token, ip, action ?? 'signup');

  if (!valid) {
    return json({ success: false, error: 'Sicherheitsprüfung fehlgeschlagen' }, { status: 403 });
  }

  return json({ success: true });
};
