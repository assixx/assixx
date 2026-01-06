// =============================================================================
// MANAGE MACHINES - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import type {
  Machine,
  Department,
  Area,
  Team,
  MachineTeam,
  MachineFormData,
  ApiResponse,
} from './types';

const apiClient = getApiClient();

// =============================================================================
// LOAD FUNCTIONS
// =============================================================================

/**
 * Load all machines from API
 * Supports filtering by status and search term
 */
export async function loadMachines(statusFilter?: string, searchTerm?: string): Promise<Machine[]> {
  const params = new URLSearchParams();

  if (statusFilter !== undefined && statusFilter !== 'all') {
    params.set('status', statusFilter);
  }

  if (searchTerm !== undefined && searchTerm.length > 0) {
    params.set('search', searchTerm);
  }

  const queryString = params.toString();
  const endpoint = queryString.length > 0 ? `/machines?${queryString}` : '/machines';

  const result = await apiClient.get(endpoint);

  if (Array.isArray(result)) {
    return result;
  }

  return result.data ?? [];
}

/**
 * Load single machine by ID
 */
export async function getMachineById(machineId: number): Promise<Machine | null> {
  try {
    return await apiClient.get(`/machines/${machineId}`);
  } catch (error) {
    console.error(`Error loading machine ${machineId}:`, error);
    return null;
  }
}

/**
 * Load all departments from API
 */
export async function loadDepartments(): Promise<Department[]> {
  const result = await apiClient.get('/departments');
  return Array.isArray(result) ? result : (result.data ?? []);
}

/**
 * Load all areas from API
 */
export async function loadAreas(): Promise<Area[]> {
  const result = await apiClient.get('/areas');
  return Array.isArray(result) ? result : (result.data ?? []);
}

/**
 * Load all teams from API
 */
export async function loadTeams(): Promise<Team[]> {
  const result = await apiClient.get('/teams');
  return Array.isArray(result) ? result : (result.data ?? []);
}

/**
 * Get teams assigned to a machine
 */
export async function getMachineTeams(machineId: number): Promise<MachineTeam[]> {
  try {
    const result = await apiClient.get(`/machines/${machineId}/teams`);
    return Array.isArray(result) ? result : (result.data ?? []);
  } catch (error) {
    console.error(`Error loading teams for machine ${machineId}:`, error);
    return [];
  }
}

/**
 * Set teams for a machine (bulk operation - replaces all existing)
 */
export async function setMachineTeams(
  machineId: number,
  teamIds: number[],
): Promise<MachineTeam[]> {
  const result = await apiClient.put(`/machines/${machineId}/teams`, { teamIds });
  return Array.isArray(result) ? result : (result.data ?? []);
}

// =============================================================================
// SAVE FUNCTIONS
// =============================================================================

/**
 * Create a new machine
 */
export async function createMachine(machineData: MachineFormData): Promise<Machine> {
  return await apiClient.post('/machines', machineData);
}

/**
 * Update existing machine
 */
export async function updateMachine(
  machineId: number,
  machineData: MachineFormData,
): Promise<Machine> {
  return await apiClient.put(`/machines/${machineId}`, machineData);
}

/**
 * Save machine (create or update)
 * Returns the machine ID
 */
export async function saveMachine(
  formData: MachineFormData,
  editId: number | null,
): Promise<number> {
  if (editId !== null) {
    const result = await updateMachine(editId, formData);
    return result.id;
  } else {
    const result = await createMachine(formData);
    return result.id;
  }
}

// =============================================================================
// DELETE FUNCTIONS
// =============================================================================

/**
 * Delete machine by ID
 */
export async function deleteMachine(machineId: number): Promise<void> {
  await apiClient.delete(`/machines/${machineId}`);
}

// =============================================================================
// HELPER TYPES FOR ERROR HANDLING
// =============================================================================

/**
 * Check if error has SESSION_EXPIRED code
 */
export function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}
