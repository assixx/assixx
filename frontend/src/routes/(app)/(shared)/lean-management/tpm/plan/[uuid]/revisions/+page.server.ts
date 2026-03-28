/**
 * TPM Plan Revision History — Server-Side Data Loading
 *
 * Loads plan info + all revisions for that plan (paginated, newest first).
 * ISO 9001 Chapter 7.5.3: every plan change is traceable.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { TpmPlanRevisionList } from './_lib/types';
import type { TpmPlan } from '../../../_admin/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent, params }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'tpm');

  const { uuid: planUuid } = params;

  const [planResult, revisionsRaw] = await Promise.all([
    apiFetchWithPermission<TpmPlan>(`/tpm/plans/${planUuid}`, token, fetch),
    apiFetch<TpmPlanRevisionList>(`/tpm/plans/${planUuid}/revisions?page=1&limit=50`, token, fetch),
  ]);

  if (planResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      plan: null,
      revisions: null,
      error: null,
    };
  }

  const plan = planResult.data;
  const revisions = revisionsRaw;

  return {
    permissionDenied: false as const,
    plan,
    revisions,
    error: plan === null ? 'Wartungsplan nicht gefunden' : null,
  };
};
