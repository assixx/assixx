/**
 * Vacation Overview — Server-Side Data Loading
 * @module vacation/overview/+page.server
 *
 * SSR: Loads teams and blackouts.
 * Admin/root only (enforced by (admin) layout guard).
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { BlackoutPeriod, TeamListItem } from './_lib/types';

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

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'vacation');

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
