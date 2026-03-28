/**
 * Vacation Overview — API Layer (browser-side)
 * apiClient.get<T>() returns T directly (auto-unwrapped).
 */
import { getApiClient } from '$lib/utils/api-client';

import type { TeamCalendarData, VacationBalance } from './types';

const apiClient = getApiClient();

// ─── Team Calendar ───────────────────────────────────────────────

/** Fetch team calendar for a given month. */
export async function getTeamCalendar(
  teamId: number,
  month: number,
  year: number,
): Promise<TeamCalendarData> {
  return await apiClient.get<TeamCalendarData>(
    `/vacation/team-calendar?teamId=${teamId}&month=${month}&year=${year}`,
  );
}

// ─── Year Overview (all 12 months) ───────────────────────────────

/** Fetch all 12 months of team calendar data for a given year. */
export async function getTeamCalendarYear(
  teamId: number,
  year: number,
): Promise<TeamCalendarData[]> {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return await Promise.all(months.map((month) => getTeamCalendar(teamId, month, year)));
}

// ─── Own Balance (overview) ──────────────────────────────────────

/** Fetch own vacation balance for a given year. */
export async function getOverviewBalance(year?: number): Promise<VacationBalance> {
  const params = year !== undefined ? `?year=${year}` : '';
  return await apiClient.get<VacationBalance>(`/vacation/overview${params}`);
}
