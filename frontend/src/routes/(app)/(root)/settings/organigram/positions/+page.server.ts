/**
 * Positionen-Verwaltung — Server-Side Data Loading
 * Root-only: RBAC enforced by (root) layout group
 *
 * Loads positions from position_catalog API (ADR-038).
 */
import { redirect } from '@sveltejs/kit';

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

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  try {
    const response = await fetch(`${API_BASE}/organigram/positions`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error({ status: response.status }, 'API error loading positions');
      return { positions: [] as PositionCatalogEntry[], loadError: true };
    }

    const json = (await response.json()) as ApiResponse<PositionCatalogEntry[]>;
    return { positions: extractData(json), loadError: false };
  } catch (err: unknown) {
    log.error({ err }, 'Fetch error loading positions');
    return { positions: [] as PositionCatalogEntry[], loadError: true };
  }
};
