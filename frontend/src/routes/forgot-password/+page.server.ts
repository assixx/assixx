/**
 * Forgot Password — Server Action
 *
 * Sends email to backend, always returns generic success message.
 * No auth required — public endpoint.
 */
import { fail } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { Actions } from './$types';

const log = createLogger('ForgotPassword');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

export const actions: Actions = {
  default: async ({ request, fetch }) => {
    const formData = await request.formData();
    const email = formData.get('email');

    if (typeof email !== 'string' || email === '') {
      return fail(400, { error: 'E-Mail-Adresse ist erforderlich', email: '' });
    }

    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.status === 429) {
        return fail(429, {
          error: 'Zu viele Anfragen. Bitte warten Sie einige Minuten.',
          email,
        });
      }

      // Always show success — backend returns generic response regardless
      return { success: true, email };
    } catch (err: unknown) {
      log.error({ err }, 'Forgot password server error');
      return fail(500, { error: 'Ein Serverfehler ist aufgetreten', email });
    }
  },
};
