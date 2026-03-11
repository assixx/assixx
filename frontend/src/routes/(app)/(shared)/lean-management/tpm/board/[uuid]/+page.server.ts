/**
 * TPM Kamishibai Board — Server-Side Data Loading
 * Loads plan + all cards + colors in parallel.
 * [uuid] = plan UUID (linked from employee asset overview)
 */
import { redirect } from '@sveltejs/kit';

import { requireAddon } from '$lib/utils/addon-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  TpmPlan,
  TpmCard,
  TpmColorConfigEntry,
  IntervalColorConfigEntry,
  CategoryColorConfigEntry,
} from '../../_lib/types';

const log = createLogger('TpmBoard');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
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
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

function extractCards(raw: unknown): TpmCard[] {
  if (raw === null || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.data)) return obj.data as TpmCard[];
  if (Array.isArray(obj.items)) return obj.items as TpmCard[];
  return [];
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
  requireAddon(parentData.activeAddons, 'tpm');

  const { uuid: planUuid } = params;

  const [plan, boardRaw, colorsData, intervalColorsData, categoryColorsData] =
    await Promise.all([
      apiFetch<TpmPlan>(`/tpm/plans/${planUuid}`, token, fetch),
      apiFetch<unknown>(
        `/tpm/plans/${planUuid}/board?page=1&limit=200`,
        token,
        fetch,
      ),
      apiFetch<TpmColorConfigEntry[]>('/tpm/config/colors', token, fetch),
      apiFetch<IntervalColorConfigEntry[]>(
        '/tpm/config/interval-colors',
        token,
        fetch,
      ),
      apiFetch<CategoryColorConfigEntry[]>(
        '/tpm/config/category-colors',
        token,
        fetch,
      ),
    ]);

  const cards = extractCards(boardRaw);
  const colors = Array.isArray(colorsData) ? colorsData : [];
  const intervalColors =
    Array.isArray(intervalColorsData) ? intervalColorsData : [];
  const categoryColors =
    Array.isArray(categoryColorsData) ? categoryColorsData : [];

  const userRole = parentData.user?.role ?? 'employee';

  return {
    planUuid,
    plan,
    cards,
    colors,
    intervalColors,
    categoryColors,
    userRole,
  };
};
