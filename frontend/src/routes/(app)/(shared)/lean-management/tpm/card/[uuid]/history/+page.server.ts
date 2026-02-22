/**
 * TPM Card Execution History — Server-Side Data Loading
 *
 * Loads card info + all executions for that card (paginated).
 * [uuid] = card UUID (linked from CardDetail panel on Kamishibai board)
 */
import { redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { TpmCard, TpmExecution } from '../../../_lib/types';

const log = createLogger('TpmCardHistory');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

interface PaginatedApiResponse<T> {
  success?: boolean;
  data?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

async function apiFetch<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<T | null> {
  try {
    const response = await fetchFn(`${API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      log.error({ status: response.status, endpoint }, 'API error');
      return null;
    }
    const json = (await response.json()) as ApiResponse<T>;
    if ('success' in json && json.success === true) return json.data ?? null;
    if ('data' in json && json.data !== undefined) return json.data;
    return json as unknown as T;
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
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

export const load: PageServerLoad = async ({
  cookies,
  fetch,
  parent,
  params,
}) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const parentData = await parent();
  requireFeature(parentData.activeFeatures, 'tpm');

  const { uuid: cardUuid } = params;

  const [card, executionsRaw] = await Promise.all([
    apiFetch<TpmCard>(`/tpm/cards/${cardUuid}`, token, fetch),
    apiFetch<unknown>(
      `/tpm/cards/${cardUuid}/executions?page=1&limit=50`,
      token,
      fetch,
    ),
  ]);

  const { executions, total } = extractExecutions(executionsRaw);

  return {
    card,
    executions,
    total,
    error: card === null ? 'Karte nicht gefunden' : null,
  };
};
