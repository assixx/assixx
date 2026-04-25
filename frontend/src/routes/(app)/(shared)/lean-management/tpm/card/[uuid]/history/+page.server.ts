/**
 * TPM Card Execution History — Server-Side Data Loading
 *
 * Loads card info + all executions for that card (paginated).
 * [uuid] = card UUID (linked from CardDetail panel on Kamishibai board)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import type { PageServerLoad } from './$types';
import type { TpmCard, TpmExecution } from '../../../_lib/types';

interface PaginatedApiResponse<T> {
  success?: boolean;
  data?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

function extractExecutions(raw: unknown): {
  executions: TpmExecution[];
  total: number;
} {
  if (raw === null || typeof raw !== 'object') {
    return { executions: [], total: 0 };
  }
  const obj = raw as PaginatedApiResponse<TpmExecution>;
  return {
    executions: Array.isArray(obj.data) ? obj.data : [],
    total: obj.total ?? 0,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent, params, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '')
    redirect(302, buildLoginUrl('session-expired', undefined, url));

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'tpm');

  const { uuid: cardUuid } = params;

  const [cardResult, executionsRaw] = await Promise.all([
    apiFetchWithPermission<TpmCard>(`/tpm/cards/${cardUuid}`, token, fetch),
    apiFetch<unknown>(`/tpm/cards/${cardUuid}/executions?page=1&limit=50`, token, fetch),
  ]);

  if (cardResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      card: null,
      executions: [] as TpmExecution[],
      total: 0,
      error: null,
    };
  }

  const card = cardResult.data;
  const { executions, total } = extractExecutions(executionsRaw);

  return {
    permissionDenied: false as const,
    card,
    executions,
    total,
    error: card === null ? 'Karte nicht gefunden' : null,
  };
};
