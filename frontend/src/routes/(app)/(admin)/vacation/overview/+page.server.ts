/**
 * Vacation Overview — Server-Side Data Loading
 * @module vacation/overview/+page.server
 *
 * SSR: Loads teams and blackouts.
 * Admin/root only (enforced by (admin) layout guard).
 */
import { redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { BlackoutPeriod, TeamListItem } from './_lib/types';

const log = createLogger('VacationOverview');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

interface RawTeam {
  id: number;
  name: string;
  isActive?: boolean | number;
}

interface RawBlackout {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isGlobal: boolean;
}

/** Extract data from API response envelope. */
function extractResponseData<T>(json: ApiResponse<T>): T | null {
  if ('success' in json && json.success === true) {
    return json.data ?? null;
  }
  if ('data' in json && json.data !== undefined) {
    return json.data;
  }
  return json as unknown as T;
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
    return extractResponseData(json);
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
  requireFeature(activeFeatures, 'vacation');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [teamsData, blackoutsData] = await Promise.all([
    apiFetch<RawTeam[]>('/teams', token, fetch),
    apiFetch<RawBlackout[]>('/vacation/blackouts', token, fetch),
  ]);

  const teams: TeamListItem[] =
    teamsData
      ?.map((t: RawTeam) => ({ id: t.id, name: t.name }))
      .sort((a: TeamListItem, b: TeamListItem) =>
        a.name.localeCompare(b.name, 'de'),
      ) ?? [];

  const blackouts: BlackoutPeriod[] =
    blackoutsData?.map((b: RawBlackout) => ({
      id: b.id,
      name: b.name,
      startDate: b.startDate,
      endDate: b.endDate,
      isGlobal: b.isGlobal,
    })) ?? [];

  return {
    teams,
    blackouts,
    currentYear,
    currentMonth,
  };
};
