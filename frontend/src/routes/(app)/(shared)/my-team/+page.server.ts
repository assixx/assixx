/**
 * My-Team Page — Server-Side Data Loading
 *
 * Loads team members for the currently authenticated user's team(s).
 * Core feature — no addon gate, available for all users with a team assignment.
 * Uses query param ?team=<id> for team selection when user has multiple teams.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch.js';

import type { PageServerLoad } from './$types.js';
import type { TeamMember, TeamOption } from './_lib/types.js';

const EMPTY_RESULT = {
  teams: [] as TeamOption[],
  selectedTeamId: null as number | null,
  members: [] as TeamMember[],
  teamLeadName: null as string | null,
};

function buildTeamOptions(teamIds: number[], teamNames: string[]): TeamOption[] {
  return teamIds.map((id: number, idx: number) => ({
    id,
    name: teamNames[idx] ?? `Team ${id}`,
  }));
}

function resolveSelectedTeamId(teamParam: string | null, teamIds: number[]): number | null {
  if (teamParam !== null) {
    const parsed = Number(teamParam);
    if (teamIds.includes(parsed)) return parsed;
  }
  return teamIds[0] ?? null;
}

async function fetchTeamData(
  selectedTeamId: number,
  token: string,
  fetchFn: typeof fetch,
): Promise<{ members: TeamMember[]; teamLeadName: string | null }> {
  const [members, teamDetail] = await Promise.all([
    apiFetch<TeamMember[]>(`/teams/${selectedTeamId}/members`, token, fetchFn),
    apiFetch<{ teamLeadName?: string }>(`/teams/${selectedTeamId}`, token, fetchFn),
  ]);

  return {
    members: members ?? [],
    teamLeadName: teamDetail?.teamLeadName ?? null,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { user } = await parent();
  const teamIds: number[] = user?.teamIds ?? [];
  const teamNames: string[] = user?.teamNames ?? [];

  if (teamIds.length === 0) return EMPTY_RESULT;

  const teams = buildTeamOptions(teamIds, teamNames);
  const selectedTeamId = resolveSelectedTeamId(url.searchParams.get('team'), teamIds);

  if (selectedTeamId === null) {
    return { teams, selectedTeamId: null, members: [], teamLeadName: null };
  }

  const { members, teamLeadName } = await fetchTeamData(selectedTeamId, token, fetch);
  return { teams, selectedTeamId, members, teamLeadName };
};
