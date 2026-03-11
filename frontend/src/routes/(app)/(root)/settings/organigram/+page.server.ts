/**
 * Organigramm — Server-Side Data Loading
 * Root-only: RBAC enforced by (root) layout group
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger.js';

import type { PageServerLoad } from './$types';
import type { OrgChartTree } from './_lib/types.js';

const log = createLogger('Organigram');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

const EMPTY_TREE: OrgChartTree = {
  companyName: '',
  address: null,
  hierarchyLabels: {
    hall: 'Hallen',
    area: 'Bereiche',
    department: 'Abteilungen',
    team: 'Teams',
    asset: 'Anlagen',
  },
  nodes: [],
};

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

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const tree = await apiFetch<OrgChartTree>('/organigram/tree', token, fetch);

  return {
    tree: tree ?? EMPTY_TREE,
    loadError: tree === null,
  };
};
