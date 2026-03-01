/**
 * TPM Card Defects (Mängelliste) — Server-Side Data Loading
 *
 * Loads card info + all defects for that card (paginated).
 * [uuid] = card UUID (linked from CardDetail page)
 */
import { redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { DefectWithContext, TpmCard } from '../../../_lib/types';

const log = createLogger('TpmCardDefects');

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

  const [card, defectsRaw] = await Promise.all([
    apiFetch<TpmCard>(`/tpm/cards/${cardUuid}`, token, fetch),
    apiFetch<unknown>(
      `/tpm/cards/${cardUuid}/defects?page=1&limit=50`,
      token,
      fetch,
    ),
  ]);

  const { defects, total } = extractDefects(defectsRaw);

  return {
    card,
    defects,
    total,
    error: card === null ? 'Karte nicht gefunden' : null,
  };
};
