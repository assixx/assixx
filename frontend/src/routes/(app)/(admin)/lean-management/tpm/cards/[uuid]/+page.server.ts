/**
 * TPM Card Management - Server-Side Data Loading
 * @module lean-management/tpm/cards/[uuid]/+page.server
 *
 * SSR: The [uuid] param is the plan UUID.
 * Loads plan context, cards for that plan, and available templates.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  TpmPlan,
  TpmCard,
  TpmCardTemplate,
  PaginatedResponse,
} from '../../_lib/types';

const log = createLogger('TpmCardManagement');

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
    if ('success' in json && json.success === true) {
      return json.data ?? null;
    }
    if ('data' in json && json.data !== undefined) {
      return json.data;
    }
    return json as unknown as T;
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const planUuid = params.uuid;

  // Load plan + cards + templates in parallel
  const [planData, cardsData, templatesData] = await Promise.all([
    apiFetch<TpmPlan>(`/tpm/plans/${planUuid}`, token, fetch),
    apiFetch<PaginatedResponse<TpmCard>>(
      `/tpm/cards?planUuid=${planUuid}&page=1&limit=50`,
      token,
      fetch,
    ),
    apiFetch<TpmCardTemplate[]>('/tpm/config/templates', token, fetch),
  ]);

  if (planData === null) {
    redirect(302, '/lean-management/tpm');
  }

  // Extract cards from paginated response
  const cardsResult = cardsData as unknown as Record<string, unknown> | null;
  let cards: TpmCard[] = [];
  let totalCards = 0;
  if (cardsResult !== null && typeof cardsResult === 'object') {
    const items = cardsResult.data ?? cardsResult.items;
    cards = Array.isArray(items) ? (items as TpmCard[]) : [];
    totalCards = typeof cardsResult.total === 'number' ? cardsResult.total : 0;
  }

  const templates = Array.isArray(templatesData) ? templatesData : [];

  return {
    plan: planData,
    cards,
    totalCards,
    templates,
    planUuid,
  };
};
