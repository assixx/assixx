/**
 * TPM Plan Defects (Gesamtmängelliste) — Server-Side Data Loading
 *
 * Loads plan info + all defects across all cards for that plan (paginated).
 * Access: Root | Admin (scoped) | Employee Team-Lead
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { assertTeamLevelAccess } from '$lib/server/manage-page-access';
import { requireAddon } from '$lib/utils/addon-guard';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import type { PageServerLoad } from './$types';
import type { PlanDefectWithContext, TpmPlan } from '../../../_lib/types';

interface PaginatedApiResponse<T> {
  success?: boolean;
  data?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

function extractDefects(raw: unknown): {
  defects: PlanDefectWithContext[];
  total: number;
} {
  if (raw === null || typeof raw !== 'object') {
    return { defects: [], total: 0 };
  }
  const obj = raw as PaginatedApiResponse<PlanDefectWithContext>;
  return {
    defects: Array.isArray(obj.data) ? obj.data : [],
    total: obj.total ?? 0,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent, params, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '')
    redirect(302, buildLoginUrl('session-expired', undefined, url));

  const parentData = await parent();
  assertTeamLevelAccess(parentData.orgScope, {
    role: parentData.user?.role,
    pathname: url.pathname,
  });
  requireAddon(parentData.activeAddons, 'tpm');

  const { uuid: planUuid } = params;

  const [planResult, defectsRaw] = await Promise.all([
    apiFetchWithPermission<TpmPlan>(`/tpm/plans/${planUuid}`, token, fetch),
    apiFetch<unknown>(`/tpm/plans/${planUuid}/defects?page=1&limit=50`, token, fetch),
  ]);

  if (planResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      plan: null,
      defects: [] as PlanDefectWithContext[],
      total: 0,
      error: null,
      userRole: 'employee',
    };
  }

  const plan = planResult.data;
  const { defects, total } = extractDefects(defectsRaw);

  const user = parentData.user;
  if (!user) redirect(302, buildLoginUrl('session-expired', undefined, url));

  return {
    permissionDenied: false as const,
    plan,
    defects,
    total,
    error: plan === null ? 'Wartungsplan nicht gefunden' : null,
    userRole: user.role,
  };
};
