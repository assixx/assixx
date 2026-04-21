/**
 * Forgot Password — Server Action
 *
 * Public endpoint. Parses the backend response and propagates the ADR-051
 * two-gate outcome to the UI: the root-happy-path and silent-drop both
 * render as a generic "E-Mail gesendet" (R1 enumeration-safe), while the
 * admin/employee block path renders a dedicated "Passwort-Reset nicht
 * erlaubt" panel (§5.2). The `blocked` branch is mutually exclusive with
 * `success` so the UI can `{#if form?.blocked} ... {:else if form?.success}`.
 *
 * @see docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md §5.1
 */
import { fail } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { Actions } from './$types';

const log = createLogger('ForgotPassword');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/**
 * Backend response envelope (unwrapping `ApiSuccessResponse<T>` from ADR-051 §2.2).
 * Additive shape — `blocked` / `reason` are present only on the role-block path.
 */
interface ForgotPasswordEnvelope {
  success: boolean;
  data?: {
    message: string;
    blocked?: true;
    reason?: 'ROLE_NOT_ALLOWED';
  };
}

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

      // Parse the backend JSON to surface the additive `blocked` / `reason`
      // fields (ADR-051 §2.2). Best-effort — if the body isn't the expected
      // shape (unexpected status, parser failure) we degrade to the generic
      // success path, preserving the old behaviour (no new error surface).
      const data = (await response.json().catch(() => null)) as ForgotPasswordEnvelope | null;

      if (data?.data?.blocked === true) {
        return {
          blocked: true as const,
          reason: data.data.reason ?? 'ROLE_NOT_ALLOWED',
          email,
        };
      }

      // Root happy-path OR silent-drop — byte-identical response shape
      // from the backend (R1), so the UI shows the same generic success.
      return { success: true as const, email };
    } catch (err: unknown) {
      log.error({ err }, 'Forgot password server error');
      return fail(500, { error: 'Ein Serverfehler ist aufgetreten', email });
    }
  },
};
