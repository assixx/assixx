/**
 * Organigramm — Client-Side API Calls
 * Uses apiClient (auto-unwraps ResponseInterceptor wrapper)
 */
import { getApiClient } from '$lib/utils/api-client.js';

import type {
  HierarchyLabels,
  OrgChartTree,
  PositionPayload,
  UpdateHierarchyLabelsPayload,
} from './types.js';

export async function fetchOrgTree(): Promise<OrgChartTree> {
  const api = getApiClient();
  return await api.get<OrgChartTree>('/organigram/tree');
}

export async function fetchHierarchyLabels(): Promise<HierarchyLabels> {
  const api = getApiClient();
  return await api.get<HierarchyLabels>('/organigram/hierarchy-labels');
}

export async function updateHierarchyLabels(
  payload: UpdateHierarchyLabelsPayload,
): Promise<HierarchyLabels> {
  const api = getApiClient();
  return await api.patch<HierarchyLabels>(
    '/organigram/hierarchy-labels',
    payload,
  );
}

export async function savePositions(
  positions: PositionPayload[],
): Promise<void> {
  const api = getApiClient();
  await api.put('/organigram/positions', { positions });
}
