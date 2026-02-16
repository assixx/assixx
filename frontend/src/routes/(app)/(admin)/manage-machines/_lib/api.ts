// =============================================================================
// MANAGE MACHINES - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import type {
  Machine,
  Department,
  Area,
  Team,
  MachineTeam,
  MachineFormData,
} from './types';

const log = createLogger('ManageMachinesApi');
const apiClient = getApiClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type-safe extraction of array data from various API response formats
 * Handles: T[], { data: T[] }
 */
function extractArrayFromResponse<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      return obj.data as T[];
    }
  }

  return [];
}

// =============================================================================
// LOAD FUNCTIONS
// =============================================================================

/**
 * Load all machines from API
 * Supports filtering by status and search term
 */
export async function loadMachines(
  statusFilter?: string,
  searchTerm?: string,
): Promise<Machine[]> {
  const params = new URLSearchParams();

  if (statusFilter !== undefined && statusFilter !== 'all') {
    params.set('status', statusFilter);
  }

  if (searchTerm !== undefined && searchTerm.length > 0) {
    params.set('search', searchTerm);
  }

  const queryString = params.toString();
  const endpoint =
    queryString.length > 0 ? `/machines?${queryString}` : '/machines';

  const result: unknown = await apiClient.get(endpoint);
  return extractArrayFromResponse<Machine>(result);
}

/**
 * Load single machine by ID
 */
export async function getMachineById(
  machineId: number,
): Promise<Machine | null> {
  try {
    return await apiClient.get(`/machines/${machineId}`);
  } catch (err) {
    log.error({ err, machineId }, 'Error loading machine');
    return null;
  }
}

/**
 * Load all departments from API
 */
export async function loadDepartments(): Promise<Department[]> {
  const result: unknown = await apiClient.get('/departments');
  return extractArrayFromResponse<Department>(result);
}

/**
 * Load all areas from API
 */
export async function loadAreas(): Promise<Area[]> {
  const result: unknown = await apiClient.get('/areas');
  return extractArrayFromResponse<Area>(result);
}

/**
 * Load all teams from API
 */
export async function loadTeams(): Promise<Team[]> {
  const result: unknown = await apiClient.get('/teams');
  return extractArrayFromResponse<Team>(result);
}

/**
 * Get teams assigned to a machine
 */
export async function getMachineTeams(
  machineId: number,
): Promise<MachineTeam[]> {
  try {
    const result: unknown = await apiClient.get(`/machines/${machineId}/teams`);
    return extractArrayFromResponse<MachineTeam>(result);
  } catch (err) {
    log.error({ err, machineId }, 'Error loading teams for machine');
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
  const result: unknown = await apiClient.put(`/machines/${machineId}/teams`, {
    teamIds,
  });
  return extractArrayFromResponse<MachineTeam>(result);
}

// =============================================================================
// SAVE FUNCTIONS
// =============================================================================

/**
 * Create a new machine
 */
export async function createMachine(
  machineData: MachineFormData,
): Promise<Machine> {
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
// MACHINE AVAILABILITY FUNCTIONS
// =============================================================================

/**
 * Payload for creating a machine availability entry
 */
interface MachineAvailabilityPayload {
  availabilityStatus: string;
  availabilityStart?: string;
  availabilityEnd?: string;
  availabilityReason?: string;
  availabilityNotes?: string;
}

/**
 * Update machine availability by UUID
 */
export async function updateMachineAvailability(
  uuid: string,
  payload: MachineAvailabilityPayload,
): Promise<{ message: string }> {
  return await apiClient.put(`/machines/uuid/${uuid}/availability`, payload);
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
