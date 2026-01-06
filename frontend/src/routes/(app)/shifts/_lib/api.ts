// =============================================================================
// SHIFTS - API FUNCTIONS
// Based on: frontend/src/scripts/shifts/api.ts
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';
import type {
  User,
  Area,
  Department,
  Machine,
  Team,
  TeamMember,
  Employee,
  ShiftPlanResponse,
  CreateShiftPlanRequest,
  ShiftFavorite,
  RotationPattern,
  RotationHistoryEntryAPI,
  AvailabilityStatus,
} from './types';
import { base } from '$app/paths';
import { goto } from '$app/navigation';

const apiClient = getApiClient();

// =============================================================================
// API ENDPOINTS
// =============================================================================

const API_ENDPOINTS = {
  // User
  USER_ME: '/users/me',

  // Hierarchy
  AREAS: '/areas',
  DEPARTMENTS: '/departments',
  MACHINES: '/machines',
  TEAMS: '/teams',

  // Shifts
  SHIFTS_PLAN: '/shifts/plan',
  SHIFTS: '/shifts',

  // Favorites
  FAVORITES: '/shifts/favorites',

  // Rotation
  ROTATION_PATTERNS: '/shifts/rotation/patterns',
  ROTATION_HISTORY: '/shifts/rotation/history',
  ROTATION_ASSIGN: '/shifts/rotation/assign',
  ROTATION_GENERATE: '/shifts/rotation/generate',
} as const;

// =============================================================================
// SESSION HANDLING
// =============================================================================

/**
 * Check if error is a session expired error
 */
function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}

/**
 * Handle session expired error
 */
export function handleSessionExpired(): void {
  goto(`${base}/login?session=expired`);
}

/**
 * Check for session expired and redirect
 */
export function checkSessionExpired(err: unknown): boolean {
  if (isSessionExpiredError(err)) {
    handleSessionExpired();
    return true;
  }
  return false;
}

// =============================================================================
// USER DATA (delegates to shared user service - prevents duplicate /users/me calls)
// =============================================================================

/**
 * Fetch current user data
 * DELEGATES to shared user service which handles caching + promise deduplication
 * This ensures BOTH Layout and Shifts page use the SAME cache
 */
export async function fetchCurrentUser(): Promise<User | null> {
  const result = await fetchSharedUser();
  // Map CurrentUser to local User type (they're compatible)
  return result.user as User | null;
}

// =============================================================================
// HIERARCHY DATA (Areas, Departments, Machines, Teams)
// =============================================================================

/**
 * Fetch all areas
 */
export async function fetchAreas(): Promise<Area[]> {
  try {
    const areas = await apiClient.get<Area[]>(API_ENDPOINTS.AREAS);
    console.info('[SHIFTS API] Areas loaded:', areas.length);
    return Array.isArray(areas) ? areas : [];
  } catch (err) {
    console.error('[SHIFTS API] Error loading areas:', err);
    return [];
  }
}

/**
 * Fetch departments, optionally filtered by area
 */
export async function fetchDepartments(areaId?: number | null): Promise<Department[]> {
  try {
    let url = API_ENDPOINTS.DEPARTMENTS;
    if (areaId !== null && areaId !== undefined && areaId !== 0) {
      url += `?areaId=${areaId}`;
    }

    const response = await apiClient.get<Department[] | { data: Department[] }>(url);
    const departments = Array.isArray(response) ? response : (response.data ?? []);
    console.info('[SHIFTS API] Departments loaded:', departments.length);
    return departments;
  } catch (err) {
    console.error('[SHIFTS API] Error loading departments:', err);
    return [];
  }
}

/**
 * Fetch machines, optionally filtered by department and area
 */
export async function fetchMachines(
  departmentId?: number | null,
  areaId?: number | null,
): Promise<Machine[]> {
  try {
    const params = new URLSearchParams();
    if (departmentId !== null && departmentId !== undefined && departmentId !== 0) {
      params.append('departmentId', String(departmentId));
    }
    if (areaId !== null && areaId !== undefined && areaId !== 0) {
      params.append('areaId', String(areaId));
    }

    const queryString = params.toString();
    const url =
      queryString !== '' ? `${API_ENDPOINTS.MACHINES}?${queryString}` : API_ENDPOINTS.MACHINES;

    const response = await apiClient.get<Machine[] | { data: Machine[] }>(url);
    const machines = Array.isArray(response) ? response : (response.data ?? []);
    console.info('[SHIFTS API] Machines loaded:', machines.length);
    return machines;
  } catch (err) {
    console.error('[SHIFTS API] Error loading machines:', err);
    return [];
  }
}

/**
 * Fetch teams, optionally filtered by department
 */
export async function fetchTeams(departmentId?: number | null): Promise<Team[]> {
  try {
    let url = API_ENDPOINTS.TEAMS;
    if (departmentId !== null && departmentId !== undefined && departmentId !== 0) {
      url += `?departmentId=${departmentId}`;
    }

    const response = await apiClient.get<Team[] | { data: Team[] }>(url);
    const teams = Array.isArray(response) ? response : (response.data ?? []);
    console.info('[SHIFTS API] Teams loaded:', teams.length);
    return teams;
  } catch (err) {
    console.error('[SHIFTS API] Error loading teams:', err);
    return [];
  }
}

/** API response type for team members */
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
 * Returns undefined for invalid/missing values
 */
function toAvailabilityStatus(status: string | undefined): AvailabilityStatus | undefined {
  if (status === undefined || status === null || status === '') {
    return undefined;
  }
  if (VALID_AVAILABILITY_STATUSES.includes(status as AvailabilityStatus)) {
    return status as AvailabilityStatus;
  }
  // Log unexpected values for debugging (non-breaking)
  console.warn(`[SHIFTS API] Unknown availabilityStatus: "${status}"`);
  return undefined;
}

/**
 * Fetch team members with availability data
 */
export async function fetchTeamMembers(teamId: number): Promise<TeamMember[]> {
  try {
    const response = await apiClient.get<TeamMemberApiResponse[]>(
      `${API_ENDPOINTS.TEAMS}/${teamId}/members`,
    );

    const members: TeamMember[] = response.map((user) => ({
      id: user.id,
      username: user.username,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      role: user.role === 'lead' ? 'lead' : 'member',
      userRole: user.userRole as TeamMember['userRole'],
      availabilityStatus: toAvailabilityStatus(user.availabilityStatus),
      availabilityStart: user.availabilityStart,
      availabilityEnd: user.availabilityEnd,
    }));

    console.info('[SHIFTS API] Team members loaded:', members.length);
    return members;
  } catch (err) {
    console.error('[SHIFTS API] Error loading team members:', err);
    return [];
  }
}

// =============================================================================
// EMPLOYEES
// =============================================================================

/**
 * Fetch employees, optionally filtered by department and team
 */
export async function fetchEmployees(
  departmentId?: number | null,
  teamId?: number | null,
): Promise<Employee[]> {
  try {
    const params: string[] = [];
    if (departmentId !== null && departmentId !== undefined && departmentId !== 0) {
      params.push(`departmentId=${departmentId}`);
    }
    if (teamId !== null && teamId !== undefined && teamId !== 0) {
      params.push(`teamId=${teamId}`);
    }

    let url = '/users';
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    const response = await apiClient.get<Employee[]>(url);
    console.info('[SHIFTS API] Employees loaded:', response.length);
    return Array.isArray(response) ? response : [];
  } catch (err) {
    console.error('[SHIFTS API] Error loading employees:', err);
    return [];
  }
}

// =============================================================================
// SHIFT PLAN
// =============================================================================

/**
 * Fetch shift plan for a date range
 */
export async function fetchShiftPlan(
  startDate: string,
  endDate: string,
  context: {
    departmentId?: number | null;
    teamId?: number | null;
    machineId?: number | null;
    areaId?: number | null;
  },
): Promise<ShiftPlanResponse | null> {
  try {
    const params = new URLSearchParams({ startDate, endDate });

    if (context.departmentId !== null && context.departmentId !== undefined) {
      params.append('departmentId', String(context.departmentId));
    }
    if (context.teamId !== null && context.teamId !== undefined) {
      params.append('teamId', String(context.teamId));
    }
    if (context.machineId !== null && context.machineId !== undefined) {
      params.append('machineId', String(context.machineId));
    }
    if (context.areaId !== null && context.areaId !== undefined) {
      params.append('areaId', String(context.areaId));
    }

    const response = await apiClient.get<ShiftPlanResponse>(
      `${API_ENDPOINTS.SHIFTS_PLAN}?${params.toString()}`,
    );
    console.info('[SHIFTS API] Shift plan loaded');
    return response;
  } catch (err) {
    console.error('[SHIFTS API] Error loading shift plan:', err);
    return null;
  }
}

/**
 * Create a new shift plan
 */
export async function createShiftPlan(
  planData: CreateShiftPlanRequest,
): Promise<{ planId: number; shiftIds: number[] }> {
  const response = await apiClient.post<{ planId: number; shiftIds: number[] }>(
    API_ENDPOINTS.SHIFTS_PLAN,
    planData,
  );
  console.info('[SHIFTS API] Shift plan created:', response.planId);
  return response;
}

/**
 * Update an existing shift plan
 */
export async function updateShiftPlan(
  planId: number,
  planData: CreateShiftPlanRequest,
): Promise<{ planId: number; shiftIds: number[] }> {
  const response = await apiClient.put<{ planId: number; shiftIds: number[] }>(
    `${API_ENDPOINTS.SHIFTS_PLAN}/${planId}`,
    planData,
  );
  console.info('[SHIFTS API] Shift plan updated:', planId);
  return response;
}

/**
 * Delete a shift plan
 */
export async function deleteShiftPlan(planId: number): Promise<void> {
  await apiClient.delete(`${API_ENDPOINTS.SHIFTS_PLAN}/${planId}`);
  console.info('[SHIFTS API] Shift plan deleted:', planId);
}

/**
 * Assign a single shift
 */
export async function assignShift(shiftData: {
  userId: number;
  date: string;
  type: string;
  departmentId?: number | null;
  teamId?: number | null;
  machineId?: number | null;
  startTime: string;
  endTime: string;
}): Promise<void> {
  await apiClient.post(API_ENDPOINTS.SHIFTS, shiftData);
  console.info('[SHIFTS API] Shift assigned');
}

// =============================================================================
// FAVORITES
// =============================================================================

/**
 * Fetch user's shift favorites
 */
export async function fetchFavorites(): Promise<ShiftFavorite[]> {
  try {
    // apiClient.get extracts response.data automatically via handleV2Response
    const favorites = await apiClient.get<ShiftFavorite[]>(API_ENDPOINTS.FAVORITES);
    console.info('[SHIFTS API] Favorites loaded:', favorites?.length ?? 0);
    return favorites ?? [];
  } catch (err) {
    console.error('[SHIFTS API] Error loading favorites:', err);
    return [];
  }
}

/**
 * Save a new favorite
 */
export async function saveFavorite(favoriteData: {
  name: string; // Required by API - usually teamName
  areaId: number;
  areaName: string;
  departmentId: number;
  departmentName: string;
  machineId: number;
  machineName: string;
  teamId: number;
  teamName: string;
}): Promise<ShiftFavorite | null> {
  try {
    // apiClient.post extracts response.data automatically via handleV2Response
    const favorite = await apiClient.post<ShiftFavorite>(API_ENDPOINTS.FAVORITES, favoriteData);
    console.info('[SHIFTS API] Favorite saved');
    return favorite;
  } catch (err) {
    console.error('[SHIFTS API] Error saving favorite:', err);
    throw err;
  }
}

/**
 * Delete a favorite
 */
export async function deleteFavorite(favoriteId: number | string): Promise<void> {
  await apiClient.delete(`${API_ENDPOINTS.FAVORITES}/${favoriteId}`);
  console.info('[SHIFTS API] Favorite deleted:', favoriteId);
}

// =============================================================================
// ROTATION
// =============================================================================

/**
 * Fetch rotation history for a date range
 */
export async function fetchRotationHistory(
  startDate: string,
  endDate: string,
  teamId?: number | null,
): Promise<RotationHistoryEntryAPI[]> {
  try {
    let url = `${API_ENDPOINTS.ROTATION_HISTORY}?startDate=${startDate}&endDate=${endDate}`;
    if (teamId !== null && teamId !== undefined) {
      url += `&teamId=${teamId}`;
    }

    const response = await apiClient.get<{ history?: RotationHistoryEntryAPI[] }>(url);
    console.info('[SHIFTS API] Rotation history loaded:', response.history?.length ?? 0);
    return response.history ?? [];
  } catch (err) {
    console.error('[SHIFTS API] Error loading rotation history:', err);
    return [];
  }
}

/**
 * Fetch active rotation patterns
 */
export async function fetchActiveRotationPatterns(): Promise<RotationPattern[]> {
  try {
    const response = await apiClient.get<{ patterns?: RotationPattern[] }>(
      `${API_ENDPOINTS.ROTATION_PATTERNS}?active=true`,
    );
    console.info('[SHIFTS API] Rotation patterns loaded:', response.patterns?.length ?? 0);
    return response.patterns ?? [];
  } catch (err) {
    console.error('[SHIFTS API] Error loading rotation patterns:', err);
    return [];
  }
}

/**
 * Fetch a single rotation pattern by ID
 * Used to get patternType after loading rotation history
 */
export async function fetchRotationPatternById(patternId: number): Promise<RotationPattern | null> {
  try {
    const response = await apiClient.get<{ pattern?: RotationPattern }>(
      `${API_ENDPOINTS.ROTATION_PATTERNS}/${patternId}`,
    );
    console.info(
      '[SHIFTS API] Rotation pattern loaded:',
      patternId,
      '→',
      response.pattern?.patternType,
    );
    return response.pattern ?? null;
  } catch (err) {
    console.error('[SHIFTS API] Error loading rotation pattern:', patternId, err);
    return null;
  }
}

/**
 * Create a rotation pattern
 */
export async function createRotationPattern(patternData: {
  name: string;
  patternType: string;
  patternConfig: Record<string, unknown>;
  cycleLengthWeeks: number;
  startsAt: string;
  endsAt?: string;
  teamId?: number;
}): Promise<{ id: number }> {
  // apiClient unwraps { success: true, data: X } → returns X directly
  const response = await apiClient.post<{ pattern: { id: number } }>(
    API_ENDPOINTS.ROTATION_PATTERNS,
    patternData,
  );
  console.info('[SHIFTS API] Rotation pattern created:', response.pattern?.id);
  return { id: response.pattern?.id ?? 0 };
}

/**
 * Update a rotation pattern
 */
export async function updateRotationPattern(
  patternId: number,
  patternData: Partial<{
    name: string;
    patternType: string;
    patternConfig: Record<string, unknown>;
    cycleLengthWeeks: number;
    startsAt: string;
    endsAt?: string;
    teamId?: number;
    isActive: boolean;
  }>,
): Promise<void> {
  await apiClient.put(`${API_ENDPOINTS.ROTATION_PATTERNS}/${patternId}`, patternData);
  console.info('[SHIFTS API] Rotation pattern updated:', patternId);
}

/**
 * Assign employees to rotation
 */
export async function assignRotation(assignData: {
  patternId: number;
  assignments: { userId: number; group: string }[];
  startsAt: string;
  endsAt?: string;
  teamId?: number | null;
}): Promise<void> {
  await apiClient.post(API_ENDPOINTS.ROTATION_ASSIGN, assignData);
  console.info('[SHIFTS API] Rotation assigned');
}

/**
 * Generate rotation shifts
 */
export async function generateRotationShifts(generateData: {
  patternId: number;
  startDate: string;
  endDate: string;
  preview?: boolean;
}): Promise<{ shiftsGenerated: number }> {
  const response = await apiClient.post<{ shiftsGenerated: number }>(
    API_ENDPOINTS.ROTATION_GENERATE,
    generateData,
  );
  console.info('[SHIFTS API] Rotation shifts generated:', response.shiftsGenerated);
  return response;
}

/**
 * Delete rotation history for a specific week
 */
export async function deleteRotationHistoryByWeek(
  teamId: number,
  startDate: string,
  endDate: string,
): Promise<{ historyDeleted: number }> {
  // apiClient.delete unwraps { success, data } → returns data directly
  const response = await apiClient.delete<{ deletedCounts: { historyDeleted: number } }>(
    `${API_ENDPOINTS.ROTATION_HISTORY}/week?teamId=${teamId}&startDate=${startDate}&endDate=${endDate}`,
  );
  console.info('[SHIFTS API] Rotation history deleted for week:', response.deletedCounts);
  return response.deletedCounts;
}

/** Response from deleteRotationHistoryByTeam - includes all deleted counts */
interface DeleteRotationHistoryResponse {
  historyDeleted: number;
  assignmentsDeleted: number;
  patternsDeleted: number;
  shiftsDeleted?: number; // Shifts that were in rotation_history
  plansDeleted?: number; // All shift_plans for the team
}

/**
 * Delete rotation data for a team
 * @param teamId - Required: the team to delete from
 * @param patternId - Optional: if provided, only delete this specific pattern
 *
 * Without patternId: deletes ALL patterns, assignments, history, shifts, and plans
 * With patternId: deletes ONLY that pattern and its related data (not plans)
 */
export async function deleteRotationHistoryByTeam(
  teamId: number,
  patternId?: number,
): Promise<DeleteRotationHistoryResponse> {
  // Build URL with optional patternId
  const url = patternId
    ? `${API_ENDPOINTS.ROTATION_HISTORY}?teamId=${teamId}&patternId=${patternId}`
    : `${API_ENDPOINTS.ROTATION_HISTORY}?teamId=${teamId}`;

  // apiClient.delete unwraps { success, data } → returns data directly
  const response = await apiClient.delete<{
    deletedCounts: {
      patterns: number;
      assignments: number;
      history: number;
      shifts?: number;
      plans?: number;
    };
  }>(url);

  const scope = patternId ? `pattern ${patternId}` : 'all patterns';
  console.info(`[SHIFTS API] Deleted ${scope} for team:`, teamId, response.deletedCounts);

  // Map backend field names to frontend field names
  return {
    historyDeleted: response.deletedCounts.history,
    assignmentsDeleted: response.deletedCounts.assignments,
    patternsDeleted: response.deletedCounts.patterns,
    shiftsDeleted: response.deletedCounts.shifts,
    plansDeleted: response.deletedCounts.plans,
  };
}

/**
 * Delete shifts for a specific week and team
 */
export async function deleteShiftsByWeek(
  teamId: number,
  startDate: string,
  endDate: string,
): Promise<{ shiftsDeleted: number }> {
  const response = await apiClient.delete<{ shiftsDeleted: number }>(
    `${API_ENDPOINTS.SHIFTS}/week?teamId=${teamId}&startDate=${startDate}&endDate=${endDate}`,
  );
  console.info('[SHIFTS API] Shifts deleted for week:', response.shiftsDeleted);
  return response;
}

/**
 * Delete ALL shifts for a team (no date range)
 */
export async function deleteShiftsByTeam(teamId: number): Promise<{ shiftsDeleted: number }> {
  const response = await apiClient.delete<{ shiftsDeleted: number }>(
    `${API_ENDPOINTS.SHIFTS}/team?teamId=${teamId}`,
  );
  console.info(
    '[SHIFTS API] All shifts deleted for team:',
    teamId,
    'count:',
    response.shiftsDeleted,
  );
  return response;
}

// =============================================================================
// CUSTOM ROTATION - SINGLE ENDPOINT (matches legacy custom-rotation.ts)
// =============================================================================

/** Employee assignment for custom rotation - includes startGroup for algorithm */
export interface CustomRotationAssignment {
  userId: number;
  userName: string;
  startGroup: 'F' | 'S' | 'N'; // F=Früh, S=Spät, N=Nacht - determines rotation start position
}

/** Algorithm config for custom rotation */
export interface CustomRotationAlgorithmConfig {
  shiftBlockLength: number; // Days in same shift before rotating
  freeDays: number; // Free days between shift blocks
  startShift: 'early' | 'late' | 'night'; // First shift type
  shiftSequence: ('early' | 'late' | 'night')[]; // Rotation order
  specialRules?: {
    type: 'nth_weekday_free';
    name: string;
    weekday: number;
    n: number;
  }[];
}

/** Request format for generate-from-config endpoint */
export interface GenerateRotationFromConfigRequest {
  config: CustomRotationAlgorithmConfig;
  assignments: CustomRotationAssignment[];
  startDate: string;
  endDate: string;
  teamId: number;
  departmentId?: number;
}

/**
 * Generate custom rotation shifts from config (SINGLE ENDPOINT)
 * This is the correct endpoint that handles the full algorithm
 * Legacy: custom-rotation.ts → callGenerateRotationAPI()
 */
export async function generateRotationFromConfig(
  request: GenerateRotationFromConfigRequest,
): Promise<{ success: boolean; shiftsCreated: number }> {
  const response = await apiClient.post<{ success: boolean; shiftsCreated: number }>(
    '/shifts/rotation/generate-from-config',
    request,
  );
  console.info('[SHIFTS API] Custom rotation generated:', response.shiftsCreated, 'shifts');
  return response;
}
