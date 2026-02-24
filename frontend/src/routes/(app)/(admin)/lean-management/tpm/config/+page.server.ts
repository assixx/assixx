/**
 * TPM Config Page - Server-Side Data Loading
 * @module lean-management/tpm/config/+page.server
 *
 * SSR: Loads escalation config, color config, and templates in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  TpmColorConfigEntry,
  IntervalColorConfigEntry,
  TpmEscalationConfig,
  TpmCardTemplate,
} from '../_lib/types';

const log = createLogger('TpmConfig');

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

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeFeatures } = await parent();
  requireFeature(activeFeatures, 'tpm');

  const [escalationData, colorsData, intervalColorsData, templatesData] =
    await Promise.all([
      apiFetch<TpmEscalationConfig>('/tpm/config/escalation', token, fetch),
      apiFetch<TpmColorConfigEntry[]>('/tpm/config/colors', token, fetch),
      apiFetch<IntervalColorConfigEntry[]>(
        '/tpm/config/interval-colors',
        token,
        fetch,
      ),
      apiFetch<TpmCardTemplate[]>('/tpm/config/templates', token, fetch),
    ]);

  return {
    escalation: escalationData ?? {
      escalationAfterHours: 48,
      notifyTeamLead: true,
      notifyDepartmentLead: false,
      createdAt: '',
      updatedAt: '',
    },
    colors: Array.isArray(colorsData) ? colorsData : [],
    intervalColors: Array.isArray(intervalColorsData) ? intervalColorsData : [],
    templates: Array.isArray(templatesData) ? templatesData : [],
  };
};
