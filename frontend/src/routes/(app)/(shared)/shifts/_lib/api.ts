// =============================================================================
// SHIFTS - API FUNCTIONS
// Based on: frontend/src/scripts/shifts/api.ts
// =============================================================================

import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';

import type {
  User,
  Area,
  Department,
  Machine,
  MachineAvailabilityEntry,
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

const log = createLogger('ShiftsApi');

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

  // Vacation / Staffing

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
  void goto(`${resolve('/login', {})}?session=expired`);
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
    return Array.isArray(areas) ? areas : [];
  } catch (err) {
    log.error({ err }, 'Error loading areas');
    return [];
  }
}

/**
 * Fetch departments, optionally filtered by area
 */
export async function fetchDepartments(
  areaId?: number | null,
): Promise<Department[]> {
  try {
    let url = API_ENDPOINTS.DEPARTMENTS;
    if (areaId !== null && areaId !== undefined && areaId !== 0) {
      url += `?areaId=${areaId}`;
    }

    const response = await apiClient.get<Department[] | { data: Department[] }>(
      url,
    );
    return Array.isArray(response) ? response : response.data;
  } catch (err) {
    log.error({ err }, 'Error loading departments');
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
    if (
      departmentId !== null &&
      departmentId !== undefined &&
      departmentId !== 0
    ) {
      params.append('departmentId', String(departmentId));
    }
    if (areaId !== null && areaId !== undefined && areaId !== 0) {
      params.append('areaId', String(areaId));
    }

    const queryString = params.toString();
    const url =
      queryString !== '' ?
        `${API_ENDPOINTS.MACHINES}?${queryString}`
      : API_ENDPOINTS.MACHINES;

    const response = await apiClient.get<Machine[] | { data: Machine[] }>(url);
    return Array.isArray(response) ? response : response.data;
  } catch (err) {
    log.error({ err }, 'Error loading machines');
    return [];
  }
}

/**
 * Fetch teams, optionally filtered by department
 */
export async function fetchTeams(
  departmentId?: number | null,
): Promise<Team[]> {
  try {
    let url = API_ENDPOINTS.TEAMS;
    if (
      departmentId !== null &&
      departmentId !== undefined &&
      departmentId !== 0
    ) {
      url += `?departmentId=${departmentId}`;
    }

    const response = await apiClient.get<Team[] | { data: Team[] }>(url);
    return Array.isArray(response) ? response : response.data;
  } catch (err) {
    log.error({ err }, 'Error loading teams');
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
function toAvailabilityStatus(
  status: string | undefined,
): AvailabilityStatus | undefined {
  if (status === undefined || status === '') {
    return undefined;
  }
  if (VALID_AVAILABILITY_STATUSES.includes(status as AvailabilityStatus)) {
    return status as AvailabilityStatus;
  }
  // Log unexpected values for debugging (non-breaking)
  log.warn({ status }, `Unknown availabilityStatus`);
  return undefined;
}

/**
 * Fetch team members with availability data
 * @param teamId - Team ID
 * @param startDate - Optional start date for availability range (YYYY-MM-DD)
 * @param endDate - Optional end date for availability range (YYYY-MM-DD)
 */
export async function fetchTeamMembers(
  teamId: number,
  startDate?: string,
  endDate?: string,
): Promise<TeamMember[]> {
  try {
    // Build URL with optional date range query params
    const params: string[] = [];
    if (startDate !== undefined && startDate !== '') {
      params.push(`startDate=${startDate}`);
    }
    if (endDate !== undefined && endDate !== '') {
      params.push(`endDate=${endDate}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';

    const response = await apiClient.get<TeamMemberApiResponse[]>(
      `${API_ENDPOINTS.TEAMS}/${teamId}/members${queryString}`,
    );

    const members: TeamMember[] = response.map(
      (user: TeamMemberApiResponse): TeamMember => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        role: user.role === 'lead' ? 'lead' : 'member',
        userRole: user.userRole as TeamMember['userRole'],
        availabilityStatus: toAvailabilityStatus(user.availabilityStatus),
        availabilityStart: user.availabilityStart,
        availabilityEnd: user.availabilityEnd,
      }),
    );

    return members;
  } catch (err) {
    log.error({ err }, 'Error loading team members');
    return [];
  }
}

// =============================================================================
// MACHINE AVAILABILITY (for shift cell visual marking)
// =============================================================================

/**
 * Fetch machine availability entries that overlap with a date range.
 * Used to visually mark shift cells when a machine is unavailable.
 */
export async function fetchMachineAvailability(
  machineId: number,
  startDate: string,
  endDate: string,
): Promise<MachineAvailabilityEntry[]> {
  try {
    const response = await apiClient.get<MachineAvailabilityEntry[]>(
      `${API_ENDPOINTS.MACHINES}/${machineId}/availability?startDate=${startDate}&endDate=${endDate}`,
    );
    return Array.isArray(response) ? response : [];
  } catch (err) {
    log.error({ err }, 'Error loading machine availability');
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
    if (
      departmentId !== null &&
      departmentId !== undefined &&
      departmentId !== 0
    ) {
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
    return Array.isArray(response) ? response : [];
  } catch (err) {
    log.error({ err }, 'Error loading employees');
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

    return await apiClient.get<ShiftPlanResponse>(
      `${API_ENDPOINTS.SHIFTS_PLAN}?${params.toString()}`,
    );
  } catch (err) {
    log.error({ err }, 'Error loading shift plan');
    return null;
  }
}

/**
 * Create a new shift plan
 */
export async function createShiftPlan(
  planData: CreateShiftPlanRequest,
): Promise<{ planId: number; shiftIds: number[] }> {
  return await apiClient.post<{ planId: number; shiftIds: number[] }>(
    API_ENDPOINTS.SHIFTS_PLAN,
    planData,
  );
}

/**
 * Update an existing shift plan
 */
export async function updateShiftPlan(
  planId: number,
  planData: CreateShiftPlanRequest,
): Promise<{ planId: number; shiftIds: number[] }> {
  return await apiClient.put<{ planId: number; shiftIds: number[] }>(
    `${API_ENDPOINTS.SHIFTS_PLAN}/${planId}`,
    planData,
  );
}

/**
 * Delete a shift plan
 */
export async function deleteShiftPlan(planId: number): Promise<void> {
  await apiClient.delete(`${API_ENDPOINTS.SHIFTS_PLAN}/${planId}`);
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
    return await apiClient.get<ShiftFavorite[]>(API_ENDPOINTS.FAVORITES);
  } catch (err) {
    log.error({ err }, 'Error loading favorites');
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
    return await apiClient.post<ShiftFavorite>(
      API_ENDPOINTS.FAVORITES,
      favoriteData,
    );
  } catch (err) {
    log.error({ err }, 'Error saving favorite');
    throw err;
  }
}

/**
 * Delete a favorite
 */
export async function deleteFavorite(
  favoriteId: number | string,
): Promise<void> {
  await apiClient.delete(`${API_ENDPOINTS.FAVORITES}/${favoriteId}`);
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

    const response = await apiClient.get<{
      history?: RotationHistoryEntryAPI[];
    }>(url);
    return response.history ?? [];
  } catch (err) {
    log.error({ err }, 'Error loading rotation history');
    return [];
  }
}

/**
 * Fetch active rotation patterns
 */
export async function fetchActiveRotationPatterns(): Promise<
  RotationPattern[]
> {
  try {
    const response = await apiClient.get<{ patterns?: RotationPattern[] }>(
      `${API_ENDPOINTS.ROTATION_PATTERNS}?active=true`,
    );
    return response.patterns ?? [];
  } catch (err) {
    log.error({ err }, 'Error loading rotation patterns');
    return [];
  }
}

/**
 * Fetch a single rotation pattern by ID
 * Used to get patternType after loading rotation history
 */
export async function fetchRotationPatternById(
  patternId: number,
): Promise<RotationPattern | null> {
  try {
    const response = await apiClient.get<{ pattern?: RotationPattern }>(
      `${API_ENDPOINTS.ROTATION_PATTERNS}/${patternId}`,
    );
    return response.pattern ?? null;
  } catch (err) {
    log.error({ err, patternId }, 'Error loading rotation pattern');
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
  return { id: response.pattern.id };
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
  await apiClient.put(
    `${API_ENDPOINTS.ROTATION_PATTERNS}/${patternId}`,
    patternData,
  );
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
  return await apiClient.post<{ shiftsGenerated: number }>(
    API_ENDPOINTS.ROTATION_GENERATE,
    generateData,
  );
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
  const response = await apiClient.delete<{
    deletedCounts: { historyDeleted: number };
  }>(
    `${API_ENDPOINTS.ROTATION_HISTORY}/week?teamId=${teamId}&startDate=${startDate}&endDate=${endDate}`,
  );
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
  const url =
    patternId !== undefined ?
      `${API_ENDPOINTS.ROTATION_HISTORY}?teamId=${teamId}&patternId=${patternId}`
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
  return await apiClient.delete<{ shiftsDeleted: number }>(
    `${API_ENDPOINTS.SHIFTS}/week?teamId=${teamId}&startDate=${startDate}&endDate=${endDate}`,
  );
}

/**
 * Delete ALL shifts for a team (no date range)
 */
export async function deleteShiftsByTeam(
  teamId: number,
): Promise<{ shiftsDeleted: number }> {
  return await apiClient.delete<{ shiftsDeleted: number }>(
    `${API_ENDPOINTS.SHIFTS}/team?teamId=${teamId}`,
  );
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
  return await apiClient.post<{ success: boolean; shiftsCreated: number }>(
    '/shifts/rotation/generate-from-config',
    request,
  );
}
