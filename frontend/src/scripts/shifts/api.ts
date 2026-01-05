/* eslint-disable max-lines */
// TODO: Split this file into api-core.ts, api-rotation.ts, api-favorites.ts
/**
 * API Module for Shift Planning System
 * Centralized API calls using ApiClient
 */

import type { User } from '../../types/api.types';
import { ApiClient } from '../../utils/api-client';
import { getAuthToken } from '../auth/index';
import type {
  Team,
  TeamMember,
  Area,
  Department,
  Machine,
  ShiftFavorite,
  RotationPattern,
  Employee,
  ShiftPlanResponse,
} from './types';

// Get singleton ApiClient instance
function getApiClient(): ApiClient {
  return ApiClient.getInstance();
}

// Get auth header
function getAuthHeader(): Record<string, string> {
  const token = getAuthToken();
  return {
    Authorization: `Bearer ${token ?? ''}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Type guard: Check if filter ID is valid (not null, undefined, or 0)
 */
function isValidFilterId(id: number | null | undefined): id is number {
  return id !== null && id !== undefined && id !== 0;
}

// ============== USER API ==============

/**
 * Fetch current user data
 */
export async function fetchCurrentUser(): Promise<User | null> {
  const token = getAuthToken();
  if (token === null || token === '') return null;

  try {
    const response = await fetch('/api/v2/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      // API returns { success: true, data: User } - extract the data property
      const result = (await response.json()) as { success: boolean; data: User };
      return result.data;
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
  }

  return null;
}

// ============== HIERARCHY API (Areas, Departments, Machines) ==============

/**
 * Fetch all areas
 */
export async function fetchAreas(): Promise<Area[]> {
  try {
    const response = await getApiClient().request<Area[]>('/areas', { method: 'GET' });
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Error loading areas:', error);
    return [];
  }
}

/**
 * Fetch departments, optionally filtered by area
 */
export async function fetchDepartments(areaId?: number | null): Promise<Department[]> {
  try {
    const url = isValidFilterId(areaId) ? `/api/v2/departments?area_id=${String(areaId)}` : '/api/v2/departments';
    const response = await fetch(url, { headers: getAuthHeader() });

    if (!response.ok) return [];

    const json = (await response.json()) as { success?: boolean; data?: Department[] } | Department[];
    // API returns {success: true, data: [...]} wrapper
    if ('data' in json && Array.isArray(json.data)) return json.data;
    // Fallback for direct array response
    return Array.isArray(json) ? json : [];
  } catch (error) {
    console.error('Error loading departments:', error);
    return [];
  }
}

/**
 * Fetch machines, optionally filtered by department and area
 */
export async function fetchMachines(departmentId?: number | null, areaId?: number | null): Promise<Machine[]> {
  try {
    const params = new URLSearchParams();
    if (isValidFilterId(departmentId)) params.append('department_id', String(departmentId));
    if (isValidFilterId(areaId)) params.append('area_id', String(areaId));

    const queryString = params.toString();
    const url = queryString !== '' ? `/api/v2/machines?${queryString}` : '/api/v2/machines';
    const response = await fetch(url, { headers: getAuthHeader() });

    if (!response.ok) return [];

    const json = (await response.json()) as { success?: boolean; data?: Machine[] } | Machine[];
    // API returns {success: true, data: [...]} wrapper
    if ('data' in json && Array.isArray(json.data)) return json.data;
    // Fallback for direct array response
    return Array.isArray(json) ? json : [];
  } catch (error) {
    console.error('Error loading machines:', error);
    return [];
  }
}

// ============== TEAMS API ==============

/**
 * Fetch teams, optionally filtered by department
 */
export async function fetchTeams(departmentId?: number | null): Promise<Team[]> {
  try {
    let url = '/teams';
    if (departmentId !== null && departmentId !== undefined && departmentId !== 0) {
      url += `?departmentId=${String(departmentId)}`;
    }

    const response = await getApiClient().request<Team[]>(url, { method: 'GET' });

    return response.map((t) => ({
      id: t.id,
      name: t.name,
      departmentId: t.departmentId ?? 0,
      leaderId: t.leaderId ?? undefined,
      description: t.description,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  } catch (error) {
    console.error('Error loading teams:', error);
    return [];
  }
}

/**
 * Fetch single team by ID (includes leaderId for permission check)
 */
export async function fetchTeamById(teamId: number): Promise<Team | null> {
  try {
    const response = await getApiClient().request<Team>(`/teams/${String(teamId)}`, { method: 'GET' });
    return {
      id: response.id,
      name: response.name,
      departmentId: response.departmentId ?? 0,
      leaderId: response.leaderId ?? undefined,
      description: response.description,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  } catch (error) {
    console.error('Error loading team by ID:', error);
    return null;
  }
}

/**
 * Fetch teams for a specific machine
 */
export async function fetchTeamsForMachine(machineId: number): Promise<Team[]> {
  try {
    const response = await fetch(`/api/v2/teams?machine_id=${String(machineId)}`, {
      headers: getAuthHeader(),
    });

    if (response.ok) {
      const data = (await response.json()) as Team[];
      return Array.isArray(data) ? data : [];
    }
  } catch (error) {
    console.error('Error loading teams for machine:', error);
  }
  return [];
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

/**
 * Fetch team members with availability data
 */
export async function fetchTeamMembers(teamId: number): Promise<TeamMember[]> {
  try {
    const response = await getApiClient().request<TeamMemberApiResponse[]>(`/teams/${String(teamId)}/members`, {
      method: 'GET',
    });

    return response.map((user) => {
      // Build base member object with required fields
      const member: TeamMember = {
        id: user.id,
        username: user.username,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        role: user.role === 'lead' ? 'lead' : 'member',
      };

      // Only add userRole if it's a valid value (not undefined)
      // exactOptionalPropertyTypes requires omitting the property rather than setting undefined
      if (user.userRole === 'admin' || user.userRole === 'employee' || user.userRole === 'root') {
        member.userRole = user.userRole;
      }

      // Only add availability fields if they have values
      if (user.availabilityStatus !== undefined) {
        member.availabilityStatus = user.availabilityStatus;
      }
      if (user.availabilityStart !== undefined) {
        member.availabilityStart = user.availabilityStart;
      }
      if (user.availabilityEnd !== undefined) {
        member.availabilityEnd = user.availabilityEnd;
      }
      return member;
    });
  } catch (error) {
    console.error('Error loading team members:', error);
    return [];
  }
}

// ============== EMPLOYEES API ==============

/**
 * Fetch employees, optionally filtered by department and team
 */
export async function fetchEmployees(departmentId?: number | null, teamId?: number | null): Promise<Employee[]> {
  try {
    const params: string[] = [];
    if (departmentId !== null && departmentId !== undefined && departmentId !== 0) {
      params.push(`departmentId=${String(departmentId)}`);
    }
    if (teamId !== null && teamId !== undefined && teamId !== 0) {
      params.push(`teamId=${String(teamId)}`);
    }

    let url = '/users';
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    const response = await getApiClient().request<Employee[]>(url, { method: 'GET' });
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Error loading employees:', error);
    return [];
  }
}

// ============== SHIFTS API ==============

/**
 * Fetch shift plan for a date range
 */
export async function fetchShiftPlan(
  startDate: string,
  endDate: string,
  context: { departmentId?: number | null; teamId?: number | null; machineId?: number | null; areaId?: number | null },
): Promise<ShiftPlanResponse | null> {
  try {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });

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

    return await getApiClient().request<ShiftPlanResponse>(`/shifts/plan?${params.toString()}`, {
      method: 'GET',
    });
  } catch (error) {
    console.error('Error loading shift plan:', error);
    return null;
  }
}

/**
 * Create a new shift plan
 */
export async function createShiftPlan(planData: {
  startDate: string;
  endDate: string;
  areaId?: number;
  departmentId?: number;
  teamId?: number;
  machineId?: number;
  name: string;
  shiftNotes?: string;
  shifts: { userId: number; date: string; type: string; startTime: string; endTime: string }[];
  customRotationPattern?: string;
}): Promise<{ planId: number; shiftIds: number[] }> {
  return await getApiClient().request<{ planId: number; shiftIds: number[] }>('/shifts/plan', {
    method: 'POST',
    body: JSON.stringify(planData),
  });
}

/**
 * Update an existing shift plan
 */
export async function updateShiftPlan(
  planId: number,
  planData: {
    startDate: string;
    endDate: string;
    areaId?: number;
    departmentId?: number;
    teamId?: number;
    machineId?: number;
    name: string;
    shiftNotes?: string;
    shifts: { userId: number; date: string; type: string; startTime: string; endTime: string }[];
    customRotationPattern?: string;
  },
): Promise<{ planId: number; shiftIds: number[] }> {
  return await getApiClient().request<{ planId: number; shiftIds: number[] }>(`/shifts/plan/${String(planId)}`, {
    method: 'PUT',
    body: JSON.stringify(planData),
  });
}

/**
 * Delete a shift plan
 */
export async function deleteShiftPlan(planId: number): Promise<void> {
  await getApiClient().request(`/shifts/plan/${String(planId)}`, { method: 'DELETE' });
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
  await getApiClient().request('/shifts', {
    method: 'POST',
    body: JSON.stringify(shiftData),
  });
}

// ============== ROTATION API ==============

/**
 * Fetch rotation history for a date range
 */
export async function fetchRotationHistory(
  startDate: string,
  endDate: string,
  teamId?: number | null,
): Promise<
  {
    date: string;
    shiftType: string;
    employeeId: number;
    firstName: string;
    lastName: string;
  }[]
> {
  try {
    let url = `/api/v2/shifts/rotation/history?start_date=${startDate}&end_date=${endDate}`;
    if (teamId !== null && teamId !== undefined) {
      url += `&team_id=${String(teamId)}`;
    }

    const response = await fetch(url, { headers: getAuthHeader() });

    if (response.ok) {
      interface RotationHistoryItem {
        date: string;
        shiftType: string;
        employeeId: number;
        firstName: string;
        lastName: string;
      }
      const data = (await response.json()) as { history?: RotationHistoryItem[] };
      return data.history ?? [];
    }
  } catch (error) {
    console.error('Error loading rotation history:', error);
  }
  return [];
}

/**
 * Fetch active rotation patterns
 */
export async function fetchActiveRotationPatterns(): Promise<RotationPattern[]> {
  try {
    const response = await fetch('/api/v2/shifts/rotation/patterns?active=true', {
      headers: getAuthHeader(),
    });

    if (response.ok) {
      const data = (await response.json()) as { patterns?: RotationPattern[] };
      return data.patterns ?? [];
    }
  } catch (error) {
    console.error('Error loading rotation patterns:', error);
  }
  return [];
}

/** Error thrown when rotation pattern with same name already exists */
export class DuplicatePatternError extends Error {
  public readonly existingId: number;
  constructor(message: string, existingId: number) {
    super(message);
    this.name = 'DuplicatePatternError';
    this.existingId = existingId;
  }
}

/**
 * Create a rotation pattern
 * Throws DuplicatePatternError if pattern with same name exists
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
  const response = await fetch('/api/v2/shifts/rotation/patterns', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(patternData),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as {
      error?: { code?: string; message?: string; existingId?: number };
    };
    // Check for duplicate name error
    if (errorData.error?.code === 'DUPLICATE_NAME' && errorData.error.existingId !== undefined) {
      throw new DuplicatePatternError(
        errorData.error.message ?? 'Pattern existiert bereits',
        errorData.error.existingId,
      );
    }
    throw new Error(errorData.error?.message ?? 'Failed to create rotation pattern');
  }

  const data = (await response.json()) as { data?: { pattern?: { id: number } } };
  return { id: data.data?.pattern?.id ?? 0 };
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
  const response = await fetch(`/api/v2/shifts/rotation/patterns/${String(patternId)}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify(patternData),
  });

  if (!response.ok) {
    throw new Error('Failed to update rotation pattern');
  }
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
  const response = await fetch('/api/v2/shifts/rotation/assign', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(assignData),
  });

  if (!response.ok) {
    throw new Error('Failed to assign rotation');
  }
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
  const response = await fetch('/api/v2/shifts/rotation/generate', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(generateData),
  });

  if (!response.ok) {
    throw new Error('Failed to generate rotation shifts');
  }

  return (await response.json()) as { shiftsGenerated: number };
}

// ============== FAVORITES API ==============

/**
 * Fetch user's shift favorites
 */
export async function fetchFavorites(): Promise<ShiftFavorite[]> {
  try {
    const token = localStorage.getItem('token');
    if (token === null || token === '') {
      throw new Error('No authentication token');
    }

    const response = await fetch('/api/v2/shifts/favorites', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error('Failed to load favorites');
    }

    const data = (await response.json()) as { favorites?: ShiftFavorite[] };
    return data.favorites ?? [];
  } catch (error) {
    console.error('Error loading favorites:', error);
    return [];
  }
}

/**
 * Save a new favorite
 */
export async function saveFavorite(favoriteData: {
  areaId: number;
  areaName: string;
  departmentId: number;
  departmentName: string;
  machineId: number;
  machineName: string;
  teamId: number;
  teamName: string;
}): Promise<ShiftFavorite> {
  const response = await fetch('/api/v2/shifts/favorites', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(favoriteData),
  });

  if (!response.ok) {
    throw new Error('Failed to save favorite');
  }

  const data = (await response.json()) as { favorite: ShiftFavorite };
  return data.favorite;
}

/**
 * Delete a favorite
 */
export async function deleteFavorite(favoriteId: number | string): Promise<void> {
  const response = await fetch(`/api/v2/shifts/favorites/${String(favoriteId)}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete favorite');
  }
}

// ============== USER PREFERENCES API ==============

/**
 * Fetch user preferences
 */
export async function fetchUserPreferences(keys: string[]): Promise<Record<string, string>> {
  try {
    const queryParams = new URLSearchParams();
    keys.forEach((key) => {
      queryParams.append('key', key);
    });

    const response = await fetch(`/api/v2/settings/user?${queryParams.toString()}`, {
      headers: getAuthHeader(),
    });

    if (response.ok) {
      const data = (await response.json()) as { settings?: Record<string, string> };
      return data.settings ?? {};
    }
  } catch (error) {
    console.error('Error loading user preferences:', error);
  }
  return {};
}

/**
 * Save user preferences
 */
export async function saveUserPreferences(settings: Record<string, string | boolean>): Promise<void> {
  const response = await fetch('/api/v2/settings/user', {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify({ settings }),
  });

  if (!response.ok) {
    throw new Error('Failed to save user preferences');
  }
}

// ============== DELETION API ==============

/**
 * Delete rotation history for a specific week (date range)
 */
export async function deleteRotationHistoryByWeek(
  teamId: number,
  startDate: string,
  endDate: string,
): Promise<{ historyDeleted: number }> {
  const response = await fetch(
    `/api/v2/shifts/rotation/history/week?team_id=${teamId}&start_date=${startDate}&end_date=${endDate}`,
    {
      method: 'DELETE',
      headers: getAuthHeader(),
    },
  );

  if (!response.ok) {
    const error = (await response.json()) as { error?: { message?: string } };
    throw new Error(error.error?.message ?? 'Fehler beim Löschen der Wochendaten');
  }

  const result = (await response.json()) as { data: { deletedCounts: { historyDeleted: number } } };
  return result.data.deletedCounts;
}

/**
 * Delete all rotation data for a team (history, assignments, patterns)
 */
export async function deleteRotationHistoryByTeam(teamId: number): Promise<{
  historyDeleted: number;
  assignmentsDeleted: number;
  patternsDeleted: number;
}> {
  const response = await fetch(`/api/v2/shifts/rotation/history?team_id=${teamId}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: { message?: string } };
    throw new Error(error.error?.message ?? 'Fehler beim Löschen der Team-Daten');
  }

  const result = (await response.json()) as {
    data: {
      deletedCounts: {
        historyDeleted: number;
        assignmentsDeleted: number;
        patternsDeleted: number;
      };
    };
  };
  return result.data.deletedCounts;
}

/**
 * Delete a single rotation history entry by ID
 * Used when removing individual shift assignments
 */
export async function deleteRotationHistoryEntry(historyId: number): Promise<void> {
  const response = await fetch(`/api/v2/shifts/rotation/history/${historyId}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: { message?: string } };
    throw new Error(error.error?.message ?? 'Fehler beim Löschen des Eintrags');
  }
}
