/**
 * Positionen-Verwaltung — Server-Side Data Loading
 * Root-only: RBAC enforced by (root) layout group
 *
 * Loads positions from position_catalog API (ADR-038).
 */
import { redirect } from '@sveltejs/kit';

import { buildLoginUrl } from '$lib/utils/build-apex-url';
import { createLogger } from '$lib/utils/logger.js';

import type { PageServerLoad } from './$types';

const log = createLogger('Organigram:Positions');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface PositionCatalogEntry {
  id: string;
  name: string;
  roleCategory: 'employee' | 'admin' | 'root';
  sortOrder: number;
  isSystem: boolean;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

function extractData(json: ApiResponse<PositionCatalogEntry[]>): PositionCatalogEntry[] {
  if (json.success === true && json.data !== undefined) {
    return json.data;
  }
  return [];
}

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    const [positionsRes, deputyScopeRes] = await Promise.all([
      fetch(`${API_BASE}/organigram/positions`, { headers }),
      fetch(`${API_BASE}/organigram/deputy-scope`, { headers }).catch(() => null),
    ]);

    if (!positionsRes.ok) {
      log.error({ status: positionsRes.status }, 'API error loading positions');
      return {
        positions: [] as PositionCatalogEntry[],
        loadError: true,
        deputyHasLeadScope: false,
      };
    }

    const json = (await positionsRes.json()) as ApiResponse<PositionCatalogEntry[]>;
    let deputyScope = false;
    if (deputyScopeRes?.ok === true) {
      const body = (await deputyScopeRes.json()) as { data?: { deputyHasLeadScope: boolean } };
      deputyScope = body.data?.deputyHasLeadScope ?? false;
    }

    return { positions: extractData(json), loadError: false, deputyHasLeadScope: deputyScope };
  } catch (err: unknown) {
    log.error({ err }, 'Fetch error loading positions');
    return { positions: [] as PositionCatalogEntry[], loadError: true, deputyHasLeadScope: false };
  }
};
