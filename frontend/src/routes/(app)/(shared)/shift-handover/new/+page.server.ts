/**
 * Shift Handover — idempotent draft-creation trampoline.
 *
 * Entry point from the shift-grid button when no entry exists yet. The
 * loader POSTs to `/shift-handover/entries` (the backend's race-safe
 * `getOrCreateDraft`) and redirects the browser to the resulting entry's
 * detail page.
 *
 * Why a dedicated route instead of client-side POST + goto?
 *  - Refresh-safe: the URL `/shift-handover/new?team=…&date=…&slot=…`
 *    deterministically reaches the same draft on every visit (POST is
 *    idempotent thanks to the composite UNIQUE on
 *    `(tenant_id, team_id, shift_date, shift_key)`).
 *  - No modal flash: the browser only ever paints the detail page —
 *    during the POST-plus-redirect round-trip, SvelteKit shows the prior
 *    page or the navigation indicator, never a half-constructed modal.
 *  - Error path stays server-side: 403 from the backend's write-window
 *    check is turned into a redirect back to `/shifts?handover-error=…`
 *    so the global toast component (not an inline modal alert) renders
 *    the German reason (see entries.service §WRITE_DENIED_MESSAGES).
 *
 * This is one of the rare cases where a `+page.server.ts` load issues a
 * POST — load functions are GET-only by convention (see api-fetch.ts),
 * but SvelteKit explicitly allows it when the load is effectively a
 * server-side trampoline (no form-action, no user-input). We use raw
 * `fetch` instead of `apiFetch` for that reason.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.3 + Session 15
 * @see backend/src/nest/shift-handover/shift-handover-entries.service.ts §WRITE_DENIED_MESSAGES
 */
import { error, redirect } from '@sveltejs/kit';

import { API_BASE } from '$lib/server/api-fetch';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';

const log = createLogger('ShiftHandoverNew');

const ALLOWED_SLOTS = new Set(['early', 'late', 'night']);

interface CreateDraftResponse {
  success?: boolean;
  data?: { id: string };
  error?: { message?: string; code?: string };
  message?: string;
}

/**
 * Parses + validates the `?team=&date=&slot=` trio. Throws 400 on any
 * malformed input so the trampoline never POSTs garbage to the backend.
 * Extracted to keep `load` under the 10-complexity cap.
 */
function parseParams(url: URL): { teamId: number; shiftDate: string; slot: string } {
  const teamIdRaw = url.searchParams.get('team');
  const shiftDate = url.searchParams.get('date') ?? '';
  const slot = url.searchParams.get('slot') ?? '';
  const teamId = Number(teamIdRaw);
  if (
    teamIdRaw === null ||
    !Number.isInteger(teamId) ||
    teamId <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(shiftDate) ||
    !ALLOWED_SLOTS.has(slot)
  ) {
    log.warn({ teamIdRaw, shiftDate, slot }, 'Invalid /shift-handover/new query');
    error(400, 'Ungültige Parameter für Übergabe-Erstellung');
  }
  return { teamId, shiftDate, slot };
}

/**
 * Pulls the German reason string out of a 4xx body
 * (WRITE_DENIED_MESSAGES in `shift-handover-entries.service.ts`) or
 * falls back to a generic message. Extracted to keep `load` under the
 * 10-complexity cap.
 */
async function extractDeniedMessage(response: Response): Promise<string> {
  const fallback = 'Übergabe konnte nicht angelegt werden.';
  try {
    const body = (await response.json()) as CreateDraftResponse;
    return body.error?.message ?? body.message ?? fallback;
  } catch {
    // Body was not valid JSON — keep the generic fallback.
    return fallback;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { teamId, shiftDate, slot } = parseParams(url);

  const response = await fetch(`${API_BASE}/shift-handover/entries`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ teamId, shiftDate, shiftKey: slot }),
  });

  if (response.status === 403 || response.status === 400) {
    // Backend returned a German reason via the entries.service
    // WRITE_DENIED_MESSAGES table (not_assignee / outside_window /
    // shift_times_missing) or a validation error. Forward the text to
    // the shifts grid via the `handover-error` query param; the toast
    // bridge there picks it up + clears the URL.
    const message = await extractDeniedMessage(response);
    log.info({ status: response.status, message }, 'Draft creation denied — redirecting');
    redirect(303, `/shifts?handover-error=${encodeURIComponent(message)}`);
  }

  if (!response.ok) {
    log.error({ status: response.status }, 'Draft creation failed (unexpected)');
    error(response.status, 'Übergabe konnte nicht angelegt werden.');
  }

  const body = (await response.json()) as CreateDraftResponse;
  const createdId = body.data?.id;
  if (createdId === undefined || createdId === '') {
    log.error({ body }, 'Draft response missing id');
    error(500, 'Backend lieferte keine Übergabe-ID.');
  }

  redirect(303, `/shift-handover/${createdId}`);
};
