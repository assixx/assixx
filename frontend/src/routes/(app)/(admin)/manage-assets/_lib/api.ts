// =============================================================================
// MANAGE MACHINES - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { extractArray } from '$lib/utils/api-response';
import { createLogger } from '$lib/utils/logger';

import type { Asset, Department, Area, Team, AssetTeam, AssetFormData } from './types';

const log = createLogger('ManageAssetsApi');
const apiClient = getApiClient();

// =============================================================================
// LOAD FUNCTIONS
// =============================================================================

/**
 * Load all assets from API
 * Supports filtering by status and search term
 */
export async function loadAssets(statusFilter?: string, searchTerm?: string): Promise<Asset[]> {
  const params = new URLSearchParams();

  if (statusFilter !== undefined && statusFilter !== 'all') {
    params.set('status', statusFilter);
  }

  if (searchTerm !== undefined && searchTerm.length > 0) {
    params.set('search', searchTerm);
  }

  const queryString = params.toString();
  const endpoint = queryString.length > 0 ? `/assets?${queryString}` : '/assets';

  const result: unknown = await apiClient.get(endpoint);
  return extractArray<Asset>(result);
}

/**
 * Load single asset by ID
 */
export async function getAssetById(assetId: number): Promise<Asset | null> {
  try {
    return await apiClient.get(`/assets/${assetId}`);
  } catch (err: unknown) {
    log.error({ err, assetId }, 'Error loading asset');
    return null;
  }
}

/**
 * Load all departments from API
 */
export async function loadDepartments(): Promise<Department[]> {
  const result: unknown = await apiClient.get('/departments');
  return extractArray<Department>(result);
}

/**
 * Load all areas from API
 */
export async function loadAreas(): Promise<Area[]> {
  const result: unknown = await apiClient.get('/areas');
  return extractArray<Area>(result);
}

/**
 * Load all teams from API
 */
export async function loadTeams(): Promise<Team[]> {
  const result: unknown = await apiClient.get('/teams');
  return extractArray<Team>(result);
}

/**
 * Get teams assigned to a asset
 */
export async function getAssetTeams(assetId: number): Promise<AssetTeam[]> {
  try {
    const result: unknown = await apiClient.get(`/assets/${assetId}/teams`);
    return extractArray<AssetTeam>(result);
  } catch (err: unknown) {
    log.error({ err, assetId }, 'Error loading teams for asset');
    return [];
  }
}

/**
 * Set teams for a asset (bulk operation - replaces all existing)
 */
export async function setAssetTeams(assetId: number, teamIds: number[]): Promise<AssetTeam[]> {
  const result: unknown = await apiClient.put(`/assets/${assetId}/teams`, {
    teamIds,
  });
  return extractArray<AssetTeam>(result);
}

// =============================================================================
// SAVE FUNCTIONS
// =============================================================================

/**
 * Create a new asset
 */
export async function createAsset(assetData: AssetFormData): Promise<Asset> {
  return await apiClient.post('/assets', assetData);
}

/**
 * Update existing asset
 */
export async function updateAsset(assetId: number, assetData: AssetFormData): Promise<Asset> {
  return await apiClient.put(`/assets/${assetId}`, assetData);
}

/**
 * Save asset (create or update)
 * Returns the asset ID
 */
export async function saveAsset(formData: AssetFormData, editId: number | null): Promise<number> {
  if (editId !== null) {
    const result = await updateAsset(editId, formData);
    return result.id;
  } else {
    const result = await createAsset(formData);
    return result.id;
  }
}

// =============================================================================
// DELETE FUNCTIONS
// =============================================================================

/**
 * Delete asset by ID
 */
export async function deleteAsset(assetId: number): Promise<void> {
  await apiClient.delete(`/assets/${assetId}`);
}

// =============================================================================
// MACHINE AVAILABILITY FUNCTIONS
// =============================================================================

/**
 * Payload for creating a asset availability entry
 */
interface AssetAvailabilityPayload {
  availabilityStatus: string;
  availabilityStart?: string;
  availabilityEnd?: string;
  availabilityReason?: string;
  availabilityNotes?: string;
}

/**
 * Update asset availability by UUID
 */
export async function updateAssetAvailability(
  uuid: string,
  payload: AssetAvailabilityPayload,
): Promise<{ message: string }> {
  return await apiClient.put(`/assets/uuid/${uuid}/availability`, payload);
}
