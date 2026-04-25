/**
 * DEPRECATED — Spec Deviation #11 (supersedes #9).
 *
 * The previous implementation was a server-load trampoline that POSTed to
 * `/shift-handover/entries` (idempotent `getOrCreateDraft`) and redirected
 * either to the detail page or back to `/shifts` with a `?handover-error=…`
 * query param consumed by a toast bridge in `shifts/+page.svelte`.
 *
 * That pattern produced two real bugs surfaced during the manual smoke
 * test (2026-04-25):
 *   1. SvelteKit's `replaceState` from `$app/navigation` was called inside
 *      a bare `$effect` during first hydration → "Cannot call
 *      replaceState(...) before router is initialized".
 *   2. The `lastToastQuery` dedupe blocked toasts (and URL cleanup) on
 *      repeat clicks with the same denial reason.
 *
 * Beyond those bugs, the pattern itself diverged from the codebase's
 * canonical create-or-redirect flow (Blackboard / KVP / Surveys / TPM all
 * do client-side POST + toast in the click handler, no URL-param bridge,
 * no server-load trampoline).
 *
 * Migration: `shifts/+page.svelte#handleHandoverOpen` now POSTs directly
 * via `_lib/api-shift-handover.ts#getOrCreateDraft` and navigates to
 * `/shift-handover/${id}` on 200 / shows a German toast on 4xx.
 *
 * This stub keeps the route reachable so any stale link / bookmark /
 * browser-history entry resolves to a sensible destination instead of a
 * 404. The file should be deleted (`git rm`) when the user is ready to
 * remove the dead route entirely.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Spec Deviations #11
 */
import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  redirect(302, '/shifts');
};
