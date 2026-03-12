/**
 * Work Order Detail — Server-Side Data Loading
 * @module shared/work-orders/[uuid]/+page.server
 *
 * SSR: Loads single work order + comments + photos in parallel.
 */
import { error, redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  PaginatedComments,
  PaginatedResponse,
  SourcePhoto,
  WorkOrder,
  WorkOrderComment,
  WorkOrderPhoto,
} from '../_lib/types';

async function fetchSourcePhotos(
  workOrder: WorkOrder,
  uuid: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<SourcePhoto[]> {
  const hasSourcePhotos =
    workOrder.sourceUuid !== null &&
    (workOrder.sourceType === 'tpm_defect' ||
      workOrder.sourceType === 'kvp_proposal');
  if (!hasSourcePhotos) return [];
  const result = await apiFetch<SourcePhoto[]>(
    `/work-orders/${uuid}/source-photos`,
    token,
    fetchFn,
  );
  return Array.isArray(result) ? result : [];
}

function buildComments(
  data: PaginatedResponse<WorkOrderComment> | null,
): PaginatedComments {
  const raw = data ?? { items: [] as WorkOrderComment[], total: 0 };
  return {
    comments: raw.items,
    total: raw.total,
    hasMore: raw.items.length < raw.total,
  };
}

export const load: PageServerLoad = async ({
  cookies,
  fetch,
  params,
  parent,
}) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'work_orders');

  const { uuid } = params;

  const [workOrder, commentsData, photosData] = await Promise.all([
    apiFetch<WorkOrder>(`/work-orders/${uuid}`, token, fetch),
    apiFetch<PaginatedResponse<WorkOrderComment>>(
      `/work-orders/${uuid}/comments?page=1&limit=50`,
      token,
      fetch,
    ),
    apiFetch<WorkOrderPhoto[]>(`/work-orders/${uuid}/photos`, token, fetch),
  ]);

  if (workOrder === null) {
    error(404, 'Arbeitsauftrag nicht gefunden');
  }

  const sourcePhotos = await fetchSourcePhotos(workOrder, uuid, token, fetch);
  const user = parentData.user;

  return {
    workOrder,
    comments: buildComments(commentsData),
    photos: Array.isArray(photosData) ? photosData : [],
    sourcePhotos,
    userRole: user?.role ?? 'employee',
    userId: user?.id ?? 0,
  };
};
