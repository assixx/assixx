/**
 * TPM Locations — Server-Side Data Loading
 *
 * Loads locations for a plan + plan metadata.
 * Access: Root | Admin (scoped) | Employee Team-Lead
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { assertTeamLevelAccess } from '$lib/server/manage-page-access';
import { requireAddon } from '$lib/utils/addon-guard';
import { extractArray } from '$lib/utils/api-response';

import type { PageServerLoad } from './$types';
import type { TpmLocation, TpmPlan } from '../../_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent, params, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const parentData = await parent();
  assertTeamLevelAccess(parentData.orgScope, {
    role: parentData.user?.role,
    pathname: url.pathname,
  });
  requireAddon(parentData.activeAddons, 'tpm');

  const { uuid: planUuid } = params;

  const [planResult, locationsRaw] = await Promise.all([
    apiFetchWithPermission<TpmPlan>(`/tpm/plans/${planUuid}`, token, fetch),
    apiFetch<unknown>(`/tpm/locations?planUuid=${planUuid}`, token, fetch),
  ]);

  if (planResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      plan: null,
      planUuid,
      locations: [] as TpmLocation[],
      userRole: 'employee',
      error: null,
    };
  }

  const plan = planResult.data;
  const locations = extractArray<TpmLocation>(locationsRaw);

  const userRole = parentData.user?.role ?? 'employee';

  return {
    permissionDenied: false as const,
    plan,
    planUuid,
    locations,
    userRole,
    error: plan === null ? 'Wartungsplan nicht gefunden' : null,
  };
};
