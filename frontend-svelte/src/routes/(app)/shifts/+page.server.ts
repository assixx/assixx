/**
 * Shifts - Server-Side Data Loading
 * @module shifts/+page.server
 *
 * SSR Performance: Loads initial data server-side for instant render.
 * - Employee view: user with team info, team members, areas (for context display)
 * - Admin/Root view: user, areas, favorites
 *
 * Shift plan loading happens client-side on team selection (dynamic context).
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { User, Area, Team, TeamMember, ShiftFavorite, AvailabilityStatus } from './_lib/types';

const API_BASE = process.env['API_URL'] ?? 'http://localhost:3000/api/v2';

/** API response wrapper */
interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

/** Valid availability status values */
const VALID_AVAILABILITY_STATUSES: readonly AvailabilityStatus[] = [
  'available',
  'vacation',
  'sick',
  'unavailable',
  'training',
  'other',
] as const;

/**
 * Type guard: safely convert API string to AvailabilityStatus
 */
function toAvailabilityStatus(status: string | undefined): AvailabilityStatus | undefined {
  if (status === undefined || status === null || status === '') {
    return undefined;
  }
  if (VALID_AVAILABILITY_STATUSES.includes(status as AvailabilityStatus)) {
    return status as AvailabilityStatus;
  }
  return undefined;
}

/** Fetch helper with auth and error handling */
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
      console.error(`[SSR shifts] API error ${response.status} for ${endpoint}`);
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;

    // Handle wrapped response { success: true, data: X }
    if ('success' in json && json.success === true) {
      return json.data ?? null;
    }
    // Handle direct data in response
    if ('data' in json && json.data !== undefined) {
      return json.data;
    }
    // Raw response
    return json as unknown as T;
  } catch (error) {
    console.error(`[SSR shifts] Fetch error for ${endpoint}:`, error);
    return null;
  }
}

/** Team member API response type */
interface TeamMemberApiResponse {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  userRole?: string;
  availabilityStatus?: string;
  availabilityStart?: string;
  availabilityEnd?: string;
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const startTime = performance.now();

  // 1. Auth check
  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // 2. Get basic user from parent layout
  const parentData = await parent();
  if (!parentData.user) {
    redirect(302, '/login');
  }

  // 3. Fetch full user data (including team fields not in layout)
  const userData = await apiFetch<User>('/users/me', token, fetch);

  if (!userData) {
    console.error('[SSR shifts] Failed to fetch user data');
    redirect(302, '/login');
  }

  const isEmployee = userData.role === 'employee';
  // Use teamIds array (new API) - teamId is deprecated and always null
  const primaryTeamId = userData.teamIds?.[0] ?? userData.teamId ?? null;
  const hasTeam = isEmployee && primaryTeamId !== null;
  const isAdminOrRoot = userData.role === 'admin' || userData.role === 'root';

  console.info(
    '[SSR shifts] User:',
    userData.email,
    'Role:',
    userData.role,
    'TeamIds:',
    userData.teamIds,
    'PrimaryTeamId:',
    primaryTeamId,
  );

  // 4. Prepare parallel fetch based on user role
  const fetchPromises: Promise<unknown>[] = [];
  const fetchLabels: string[] = [];

  // Always load areas for hierarchy display
  fetchPromises.push(apiFetch<Area[]>('/areas', token, fetch));
  fetchLabels.push('areas');

  if (hasTeam && primaryTeamId !== null) {
    // Employee with team: load teams (for teamLeaderId) and team members
    const departmentId = userData.teamDepartmentId;
    if (departmentId !== undefined && departmentId !== null) {
      fetchPromises.push(apiFetch<Team[]>(`/teams?departmentId=${departmentId}`, token, fetch));
      fetchLabels.push('teams');
    }

    // Use primaryTeamId (from teamIds array)
    fetchPromises.push(
      apiFetch<TeamMemberApiResponse[]>(`/teams/${primaryTeamId}/members`, token, fetch),
    );
    fetchLabels.push('teamMembers');
  }

  if (isAdminOrRoot) {
    // Admin/Root: load favorites
    fetchPromises.push(apiFetch<ShiftFavorite[]>('/shifts/favorites', token, fetch));
    fetchLabels.push('favorites');
  }

  // 5. Execute parallel fetch
  const results = await Promise.all(fetchPromises);

  // 6. Process results
  let areas: Area[] = [];
  let teams: Team[] = [];
  let teamMembers: TeamMember[] = [];
  let favorites: ShiftFavorite[] = [];
  let teamLeaderId: number | null = null;

  for (let i = 0; i < fetchLabels.length; i++) {
    const label = fetchLabels[i];
    const result = results[i];

    switch (label) {
      case 'areas':
        areas = Array.isArray(result) ? (result as Area[]) : [];
        break;

      case 'teams': {
        const teamsData = Array.isArray(result) ? (result as Team[]) : [];
        teams = teamsData;

        // Extract teamLeaderId for employee's team (using primaryTeamId)
        if (hasTeam && primaryTeamId !== null) {
          const userTeam = teamsData.find((t) => t.id === primaryTeamId);
          teamLeaderId = userTeam?.leaderId ?? userTeam?.teamLeadId ?? null;
        }
        break;
      }

      case 'teamMembers': {
        const membersData = Array.isArray(result) ? (result as TeamMemberApiResponse[]) : [];
        // Convert to TeamMember type, filtering only employees
        teamMembers = membersData
          .filter((member) => member.userRole === 'employee')
          .map((member) => ({
            id: member.id,
            username: member.username,
            firstName: member.firstName ?? '',
            lastName: member.lastName ?? '',
            role: member.role === 'lead' ? ('lead' as const) : ('member' as const),
            userRole: member.userRole as TeamMember['userRole'],
            availabilityStatus: toAvailabilityStatus(member.availabilityStatus),
            availabilityStart: member.availabilityStart,
            availabilityEnd: member.availabilityEnd,
          }));
        break;
      }

      case 'favorites':
        favorites = Array.isArray(result) ? (result as ShiftFavorite[]) : [];
        break;
    }
  }

  // 7. Build employee team info if applicable (using primaryTeamId and teamNames array)
  const employeeTeamInfo =
    hasTeam && primaryTeamId !== null
      ? {
          teamId: primaryTeamId,
          teamName: userData.teamNames?.[0] ?? userData.teamName ?? 'Unbekanntes Team',
          departmentId: userData.teamDepartmentId ?? 0,
          departmentName: userData.teamDepartmentName ?? 'Unbekannte Abteilung',
          areaId: userData.teamAreaId ?? 0,
          areaName: userData.teamAreaName ?? 'Unbekannter Bereich',
          teamLeaderId,
        }
      : null;

  console.info('[SSR shifts] employeeTeamInfo:', employeeTeamInfo);

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(
    `[SSR shifts] loaded in ${duration}ms (${fetchLabels.length} parallel API calls): ` +
      `areas=${areas.length}, teams=${teams.length}, members=${teamMembers.length}, favorites=${favorites.length}`,
  );

  // 8. Return SSR data
  return {
    user: {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      tenantId: userData.tenantId,
      isActive: userData.isActive,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      hasFullAccess: userData.hasFullAccess,
      // Team fields - use primaryTeamId and teamNames array (teamId is deprecated)
      teamId: primaryTeamId,
      teamName: userData.teamNames?.[0] ?? userData.teamName,
      teamDepartmentId: userData.teamDepartmentId,
      teamDepartmentName: userData.teamDepartmentName,
      teamAreaId: userData.teamAreaId,
      teamAreaName: userData.teamAreaName,
    },
    areas,
    teams,
    teamMembers,
    favorites,
    employeeTeamInfo,
    isEmployee,
    isAdminOrRoot,
  };
};
