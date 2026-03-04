/**
 * Manage Dummies — Server-Side Data Loading
 * @module manage-dummies/+page.server
 *
 * SSR: Loads dummy users + teams in parallel for instant page render.
 * Protected by (admin) layout group — only admin/root can access.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { DummyUser, PaginatedDummies, Team } from './_lib/types';

const log = createLogger('ManageDummies');

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

function extractDummies(data: PaginatedDummies | null): {
  dummies: DummyUser[];
  totalPages: number;
  totalItems: number;
} {
  if (data === null || !Array.isArray(data.data)) {
    return { dummies: [], totalPages: 1, totalItems: 0 };
  }
  return {
    dummies: data.data,
    totalPages: data.pagination.totalPages,
    totalItems: data.pagination.totalItems,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const [dummiesData, teamsData] = await Promise.all([
    apiFetch<PaginatedDummies>('/dummy-users?page=1&limit=20', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
  ]);

  const { dummies, totalPages, totalItems } = extractDummies(dummiesData);
  const teams: Team[] = Array.isArray(teamsData) ? teamsData : [];

  return { dummies, teams, totalPages, totalItems };
};
