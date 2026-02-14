/**
 * Vacation Overview — API Layer (browser-side)
 * apiClient.get<T>() returns T directly (auto-unwrapped).
 */
import { getApiClient } from '$lib/utils/api-client';

import type { TeamCalendarData, TeamListItem, VacationBalance } from './types';

const apiClient = getApiClient();

// ─── Machine → Teams (cascade) ──────────────────────────────────

/** Raw response from GET /machines/:id/teams */
interface MachineTeamRaw {
  teamId: number;
  teamName: string;
}

/** Fetch teams assigned to a machine. */
export async function getTeamsForMachine(
  machineId: number,
): Promise<TeamListItem[]> {
  const raw = await apiClient.get<MachineTeamRaw[]>(
    `/machines/${machineId}/teams`,
  );
  return raw
    .map((t) => ({ id: t.teamId, name: t.teamName }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

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

// ─── Own Balance (overview) ──────────────────────────────────────

/** Fetch own vacation balance for a given year. */
export async function getOverviewBalance(
  year?: number,
): Promise<VacationBalance> {
  const params = year !== undefined ? `?year=${year}` : '';
  return await apiClient.get<VacationBalance>(`/vacation/overview${params}`);
}
