/**
 * TPM Card Defects (Mängelliste) — Server-Side Data Loading
 *
 * Loads card info + all defects for that card (paginated).
 * [uuid] = card UUID (linked from CardDetail page)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { DefectWithContext, TpmCard } from '../../../_lib/types';

interface PaginatedApiResponse<T> {
  success?: boolean;
  data?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

function extractDefects(raw: unknown): {
  defects: DefectWithContext[];
  total: number;
} {
  if (raw === null || typeof raw !== 'object') {
    return { defects: [], total: 0 };
  }
  const obj = raw as PaginatedApiResponse<DefectWithContext>;
  return {
    defects: Array.isArray(obj.data) ? obj.data : [],
    total: obj.total ?? 0,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent, params, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'tpm');

  const { uuid: cardUuid } = params;

  const [cardResult, defectsRaw] = await Promise.all([
    apiFetchWithPermission<TpmCard>(`/tpm/cards/${cardUuid}`, token, fetch),
    apiFetch<unknown>(`/tpm/cards/${cardUuid}/defects?page=1&limit=50`, token, fetch),
  ]);

  if (cardResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      card: null,
      defects: [] as DefectWithContext[],
      total: 0,
      error: null,
      userRole: 'employee',
      expandExecutionUuid: null,
    };
  }

  const card = cardResult.data;
  const { defects, total } = extractDefects(defectsRaw);

  const user = parentData.user;
  if (!user) redirect(302, '/login');

  return {
    permissionDenied: false as const,
    card,
    defects,
    total,
    error: card === null ? 'Karte nicht gefunden' : null,
    userRole: user.role as string,
    expandExecutionUuid: url.searchParams.get('execution'),
  };
};
