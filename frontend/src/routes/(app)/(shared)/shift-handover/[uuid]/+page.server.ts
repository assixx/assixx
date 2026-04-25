/**
 * Shift Handover Detail — Server-Side Data Loading
 * @module shift-handover/[uuid]/+page.server
 *
 * SSR: Loads the entry row + (for non-terminal drafts) the live template
 * + per-user permissions. Replaces the in-shifts-grid modal (Session 15,
 * smoke-test finding 2026-04-23 — the modal flashed + inlined alerts
 * instead of toasting, and state was not deep-linkable).
 *
 * Permission model (ADR-045 stack):
 *  - Layer 0 Addon gate via `requireAddon('shift_planning')` (parent
 *    layout already loaded activeAddons)
 *  - Layer 1 canManage is computed in the page body from already-loaded
 *    user + orgScope (no extra RTT)
 *  - Layer 2 Action-permission comes from /shift-handover/my-permissions
 *
 * Entries live in two identity spaces:
 *  - Drafts/reopened rows pull rendering fields from the **live** template
 *    (so the Team-Lead can still tweak copy before submit).
 *  - Submitted rows pull from `entry.schema_snapshot` — that's the R2
 *    drift-safety contract from Phase 1 §1.2 (tenant may delete template
 *    fields afterwards without corrupting the historical record).
 *
 * We skip the live-template fetch for submitted entries — it's unused
 * and costs a RTT. Reopened + draft entries need both.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.3 + Session 15
 * @see docs/infrastructure/adr/ADR-007-api-response-standardization.md
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md §6
 * @see docs/infrastructure/adr/ADR-045-permission-visibility-design.md
 * @see docs/infrastructure/adr/ADR-052-shift-handover-protocol.md
 */
import { error, redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  ShiftHandoverEntryWithAttachments,
  ShiftHandoverMyPermissions,
  ShiftHandoverTemplateResponse,
} from '../../shifts/_lib/api-shift-handover';

const log = createLogger('ShiftHandoverDetail');

/** Fail-closed default when /shift-handover/my-permissions fails (ADR-045 Layer 2). */
const DEFAULT_MY_PERMISSIONS: ShiftHandoverMyPermissions = {
  templates: { canRead: false, canWrite: false, canDelete: false },
  entries: { canRead: false, canWrite: false, canDelete: false },
};

export const load: PageServerLoad = async ({ cookies, fetch, params, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { uuid } = params;
  // Regex enforces 36-char UUID shape; SvelteKit's [uuid] slot never matches
  // an empty path segment, so a separate `=== ''` guard would be dead code.
  if (!/^[0-9a-f-]{36}$/iu.test(uuid)) {
    error(400, 'Ungültige Übergabe-ID');
  }

  const entryResult = await apiFetchWithPermission<ShiftHandoverEntryWithAttachments>(
    `/shift-handover/entries/${uuid}`,
    token,
    fetch,
  );

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'shift_planning');

  if (entryResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      entry: null,
      templateFields: [],
      myPermissions: DEFAULT_MY_PERMISSIONS,
    };
  }

  if (entryResult.data === null) {
    log.error({ uuid }, 'Failed to load shift-handover entry');
    error(404, 'Übergabe nicht gefunden');
  }

  const entry = entryResult.data;

  // Live template is only rendered for mutable states. For submitted
  // entries the `schema_snapshot` on the row is authoritative (R2).
  const needsLiveTemplate = entry.status !== 'submitted';
  const [templateResult, myPermissions] = await Promise.all([
    needsLiveTemplate ?
      apiFetch<ShiftHandoverTemplateResponse>(
        `/shift-handover/templates/${entry.team_id}`,
        token,
        fetch,
      )
    : Promise.resolve(null),
    apiFetch<ShiftHandoverMyPermissions>('/shift-handover/my-permissions', token, fetch),
  ]);

  return {
    permissionDenied: false as const,
    entry,
    templateFields: templateResult?.fields ?? [],
    myPermissions: myPermissions ?? DEFAULT_MY_PERMISSIONS,
  };
};
