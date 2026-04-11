/**
 * Reset Password — Server Load + Action
 *
 * Load: Extracts token from URL query params
 * Action: Sends new password + token to backend
 */
import { fail } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { Actions, PageServerLoad } from './$types';

const log = createLogger('ResetPassword');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

export const load: PageServerLoad = ({ url }) => {
  const token = url.searchParams.get('token') ?? '';
  return { token };
};

interface ApiErrorResponse {
  success: false;
  error?: { message: string };
}

function validateFormFields(
  token: FormDataEntryValue | null,
  password: FormDataEntryValue | null,
): { error: string } | null {
  if (typeof token !== 'string' || token === '') {
    return { error: 'Ungültiger Reset-Link. Bitte fordern Sie einen neuen an.' };
  }
  if (typeof password !== 'string' || password === '') {
    return { error: 'Passwort ist erforderlich' };
  }
  if (password.length < 12) {
    return { error: 'Passwort muss mindestens 12 Zeichen lang sein' };
  }
  return null;
}

function getApiErrorMessage(body: ApiErrorResponse): string {
  return body.error?.message ?? 'Link ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.';
}

export const actions: Actions = {
  default: async ({ request, fetch }) => {
    const formData = await request.formData();
    const token = formData.get('token');
    const password = formData.get('password');

    const validationError = validateFormFields(token, password);
    if (validationError !== null) {
      return fail(400, validationError);
    }

    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (response.status === 429) {
        return fail(429, { error: 'Zu viele Versuche. Bitte warten Sie.' });
      }

      if (!response.ok) {
        const body = (await response.json()) as ApiErrorResponse;
        return fail(response.status, { error: getApiErrorMessage(body) });
      }

      return { success: true };
    } catch (err: unknown) {
      log.error({ err }, 'Reset password server error');
      return fail(500, { error: 'Ein Serverfehler ist aufgetreten' });
    }
  },
};
