/**
 * Positionen-Verwaltung — Server-Side Data Loading
 * Root-only: RBAC enforced by (root) layout group
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger.js';

import type { PageServerLoad } from './$types';

const log = createLogger('Organigram:Positions');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface PositionOptions {
  employee: string[];
  admin: string[];
  root: string[];
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

const DEFAULT_OPTIONS: PositionOptions = {
  employee: [],
  admin: [],
  root: [],
};

function extractData(json: ApiResponse<PositionOptions>): PositionOptions {
  if ('success' in json && json.success === true) {
    return json.data ?? DEFAULT_OPTIONS;
  }
  if ('data' in json && json.data !== undefined) {
    return json.data;
  }
  return json as unknown as PositionOptions;
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  try {
    const response = await fetch(`${API_BASE}/organigram/position-options`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error({ status: response.status }, 'API error loading positions');
      return { positions: DEFAULT_OPTIONS, loadError: true };
    }

    const json = (await response.json()) as ApiResponse<PositionOptions>;
    return { positions: extractData(json), loadError: false };
  } catch (err: unknown) {
    log.error({ err }, 'Fetch error loading positions');
    return { positions: DEFAULT_OPTIONS, loadError: true };
  }
};
