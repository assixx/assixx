/**
 * Addon Management Page — Client-Side API Functions
 * @module features/_lib/api
 *
 * Mutations only — SSR load happens in +page.server.ts.
 */
import { getApiClient } from '$lib/utils/api-client';

import type { AddonStatus } from './types';

const apiClient = getApiClient();

/** Activate an addon (starts trial or reactivates) */
export async function activateAddon(
  tenantId: number,
  addonCode: string,
): Promise<AddonStatus> {
  return await apiClient.post<AddonStatus>('/addons/activate', {
    tenantId,
    addonCode,
  });
}

/** Deactivate an addon (preserves user permissions per ADR-033) */
export async function deactivateAddon(
  tenantId: number,
  addonCode: string,
): Promise<{ message: string }> {
  return await apiClient.post<{ message: string }>('/addons/deactivate', {
    tenantId,
    addonCode,
  });
}
