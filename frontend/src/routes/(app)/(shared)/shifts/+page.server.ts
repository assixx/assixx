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

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  User,
  Area,
  Team,
  TeamMember,
  ShiftFavorite,
  AvailabilityStatus,
} from './_lib/types';

const log = createLogger('Shifts');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

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

/** Processed fetch results */
interface FetchResults {
  areas: Area[];
  teams: Team[];
  teamMembers: TeamMember[];
  favorites: ShiftFavorite[];
  teamLeaderId: number | null;
}

/**
 * Type guard: safely convert API string to AvailabilityStatus
 */
function toAvailabilityStatus(
  status: string | undefined,
): AvailabilityStatus | undefined {
  if (status === undefined || status === '') {
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
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

/**
 * Convert API team member response to TeamMember type
 */
function convertTeamMember(member: TeamMemberApiResponse): TeamMember {
  return {
    id: member.id,
    username: member.username,
    firstName: member.firstName ?? '',
    lastName: member.lastName ?? '',
    role: member.role === 'lead' ? ('lead' as const) : ('member' as const),
    userRole: member.userRole as TeamMember['userRole'],
    availabilityStatus: toAvailabilityStatus(member.availabilityStatus),
    availabilityStart: member.availabilityStart,
    availabilityEnd: member.availabilityEnd,
  };
}

/**
 * Safely cast unknown value to typed array
 */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Extract team leader ID from teams array
 */
function extractTeamLeaderId(
  teams: Team[],
  hasTeam: boolean,
  primaryTeamId: number | null,
): number | null {
  if (!hasTeam || primaryTeamId === null) {
    return null;
  }
  const userTeam = teams.find((t) => t.id === primaryTeamId);
  return userTeam?.leaderId ?? userTeam?.teamLeadId ?? null;
}

/**
 * Process raw team members into typed array (employees only)
 */
function processRawTeamMembers(raw: unknown): TeamMember[] {
  const members = asArray<TeamMemberApiResponse>(raw);
  return members
    .filter((m) => m.userRole === 'employee')
    .map(convertTeamMember);
}

/**
 * Process parallel fetch results into typed data structures
 */
function processFetchResults(
  results: unknown[],
  labels: string[],
  hasTeam: boolean,
  primaryTeamId: number | null,
): FetchResults {
  // Create index map for O(1) lookup
  const resultByLabel = new Map<string, unknown>();
  labels.forEach((label, i) => {
    resultByLabel.set(label, results[i]);
  });

  // Process each result type declaratively
  const areas = asArray<Area>(resultByLabel.get('areas'));
  const teams = asArray<Team>(resultByLabel.get('teams'));
  const teamMembers = processRawTeamMembers(resultByLabel.get('teamMembers'));
  const favorites = asArray<ShiftFavorite>(resultByLabel.get('favorites'));
  const teamLeaderId = extractTeamLeaderId(teams, hasTeam, primaryTeamId);

  return { areas, teams, teamMembers, favorites, teamLeaderId };
}

/**
 * Build employee team info object if applicable
 */
function buildEmployeeTeamInfo(
  userData: User,
  hasTeam: boolean,
  primaryTeamId: number | null,
  teamLeaderId: number | null,
): {
  teamId: number;
  teamName: string;
  departmentId: number;
  departmentName: string;
  areaId: number;
  areaName: string;
  teamLeaderId: number | null;
} | null {
  if (!hasTeam || primaryTeamId === null) {
    return null;
  }

  return {
    teamId: primaryTeamId,
    teamName:
      userData.teamNames?.[0] ?? userData.teamName ?? 'Unbekanntes Team',
    departmentId: userData.teamDepartmentId ?? 0,
    departmentName: userData.teamDepartmentName ?? 'Unbekannte Abteilung',
    areaId: userData.teamAreaId ?? 0,
    areaName: userData.teamAreaName ?? 'Unbekannter Bereich',
    teamLeaderId,
  };
}

/**
 * Build user response object from userData
 */
function buildUserResponse(userData: User, primaryTeamId: number | null) {
  return {
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
    teamId: primaryTeamId,
    teamName: userData.teamNames?.[0] ?? userData.teamName,
    teamDepartmentId: userData.teamDepartmentId,
    teamDepartmentName: userData.teamDepartmentName,
    teamAreaId: userData.teamAreaId,
    teamAreaName: userData.teamAreaName,
  };
}

/**
 * Prepare fetch promises based on user role and team membership
 */
function prepareFetchPromises(
  token: string,
  fetchFn: typeof fetch,
  userData: User,
  hasTeam: boolean,
  primaryTeamId: number | null,
  isAdminOrRoot: boolean,
): { promises: Promise<unknown>[]; labels: string[] } {
  const promises: Promise<unknown>[] = [];
  const labels: string[] = [];

  // Always load areas
  promises.push(apiFetch<Area[]>('/areas', token, fetchFn));
  labels.push('areas');

  if (hasTeam && primaryTeamId !== null) {
    const departmentId = userData.teamDepartmentId;
    if (departmentId !== undefined && departmentId !== null) {
      promises.push(
        apiFetch<Team[]>(`/teams?departmentId=${departmentId}`, token, fetchFn),
      );
      labels.push('teams');
    }
    promises.push(
      apiFetch<TeamMemberApiResponse[]>(
        `/teams/${primaryTeamId}/members`,
        token,
        fetchFn,
      ),
    );
    labels.push('teamMembers');
  }

  if (isAdminOrRoot) {
    promises.push(
      apiFetch<ShiftFavorite[]>('/shifts/favorites', token, fetchFn),
    );
    labels.push('favorites');
  }

  return { promises, labels };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  // Auth check
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const parentData = await parent();
  if (!parentData.user) {
    redirect(302, '/login');
  }

  // Fetch full user data
  const userData = await apiFetch<User>('/users/me', token, fetch);
  if (!userData) {
    log.error('Failed to fetch user data');
    redirect(302, '/login');
  }

  // Determine user context
  const isEmployee = userData.role === 'employee';
  const primaryTeamId = userData.teamIds?.[0] ?? userData.teamId ?? null;
  const hasTeam = isEmployee && primaryTeamId !== null;
  const isAdminOrRoot = userData.role === 'admin' || userData.role === 'root';

  // Prepare and execute parallel fetches
  const { promises, labels } = prepareFetchPromises(
    token,
    fetch,
    userData,
    hasTeam,
    primaryTeamId,
    isAdminOrRoot,
  );
  const results = await Promise.all(promises);

  // Process results
  const { areas, teams, teamMembers, favorites, teamLeaderId } =
    processFetchResults(results, labels, hasTeam, primaryTeamId);

  const employeeTeamInfo = buildEmployeeTeamInfo(
    userData,
    hasTeam,
    primaryTeamId,
    teamLeaderId,
  );

  return {
    user: buildUserResponse(userData, primaryTeamId),
    areas,
    teams,
    teamMembers,
    favorites,
    employeeTeamInfo,
    isEmployee,
    isAdminOrRoot,
  };
};
