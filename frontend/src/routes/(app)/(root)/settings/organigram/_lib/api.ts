/**
 * Organigramm — Client-Side API Calls
 * Uses apiClient (auto-unwraps ResponseInterceptor wrapper)
 */
import { getApiClient } from '$lib/utils/api-client.js';

import type {
  HallOverride,
  HierarchyLabels,
  OrgChartTree,
  OrgEntityType,
  OrgNodeDetail,
  OrgViewport,
  PerimeterAnchor,
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
  return await api.patch<HierarchyLabels>('/organigram/hierarchy-labels', payload);
}

export async function fetchNodeDetails(
  entityType: OrgEntityType,
  entityUuid: string,
): Promise<OrgNodeDetail> {
  const api = getApiClient();
  return await api.get<OrgNodeDetail>(`/organigram/node-details/${entityType}/${entityUuid}`);
}

export async function savePositions(
  positions: PositionPayload[],
  viewport: OrgViewport,
  hallOverrides: Record<string, HallOverride>,
  hallConnectionAnchors: Record<string, PerimeterAnchor>,
  canvasBg: string | null,
): Promise<void> {
  const api = getApiClient();
  await api.put('/organigram/positions', {
    positions,
    viewport,
    hallOverrides,
    hallConnectionAnchors,
    canvasBg,
  });
}
