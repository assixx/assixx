/**
 * Shift-Handover Templates — Server-Side Data Loading.
 *
 * SSR gate stack (3-layer permission per ADR-045):
 *   Layer 0 (Addon)        : `requireAddon(activeAddons, 'shift_planning')`
 *   Layer 1 (canManage)    : `canManageShiftHandoverTemplates(...)` — redirect /shifts on fail
 *   Layer 2 (Action perm)  : enforced by backend on PUT/DELETE; no client gate needed here
 *
 * Data: only loads `/teams` (already scope-filtered server-side per ADR-036).
 * Templates are loaded client-side per selected team — keeps SSR fast and avoids
 * predicting which team the user will pick.
 *
 * Route group: `(shared)` per masterplan §5.0 (locked Session 9). Coarse route
 * group lets Employee-Team-Leads + Admin + Root through; Layer-1 below is the
 * fine gate.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.2 + §5.0
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import { canManageShiftHandoverTemplates } from '../../_lib/navigation-config';

import type { PageServerLoad } from './$types';

/** Minimal Team shape — all we need for the team-filter dropdown. */
export interface TemplateTeam {
  id: number;
  name: string;
  departmentId?: number | null;
}

function toSafeArray<T>(data: T[] | null): T[] {
  return Array.isArray(data) ? data : [];
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const { user, activeAddons, orgScope } = await parent();
  // Layer 0 — Addon-Subscription gate (ADR-033)
  requireAddon(activeAddons, 'shift_planning');

  // Layer 1 — canManage gate (ADR-045): Root, Admin-with-hasFullAccess,
  // or any Lead (incl. Deputies merged via ADR-039 toggle).
  if (
    !canManageShiftHandoverTemplates(user?.role, user?.hasFullAccess === true, orgScope.isAnyLead)
  ) {
    redirect(302, '/shifts');
  }

  const teams = toSafeArray(await apiFetch<TemplateTeam[]>('/teams', token, fetch));

  // Layer 2 — ADR-020 §6: SSR-probe the per-user gated endpoint so 403 surfaces
  // as the canonical <PermissionDenied /> view instead of a client-side toast.
  // Reference implementation: `/shifts/+page.server.ts` (apiFetchWithPermission
  // on /shift-times → buildDeniedResponse → <PermissionDenied addonName="..." />).
  //
  // No probe possible without a teamId → when the user has zero teams in scope
  // the existing "Keine Teams" empty-state covers the UX. A user with no teams
  // has no permission-denied UX to show anyway (nothing to forbid).
  if (teams.length > 0) {
    const probe = await apiFetchWithPermission<unknown>(
      `/shift-handover/templates/${teams[0].id}`,
      token,
      fetch,
    );
    if (probe.permissionDenied) {
      return {
        permissionDenied: true as const,
        teams: [] as TemplateTeam[],
      };
    }
  }

  return {
    permissionDenied: false as const,
    teams,
  };
};
