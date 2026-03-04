/**
 * Work Order Detail — Server-Side Data Loading
 * @module shared/work-orders/[uuid]/+page.server
 *
 * SSR: Loads single work order + comments + photos in parallel.
 */
import { error, redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  PaginatedComments,
  PaginatedResponse,
  WorkOrder,
  WorkOrderComment,
  WorkOrderPhoto,
} from '../_lib/types';

const log = createLogger('WorkOrderDetail');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

function extractResponseData<T>(json: ApiResponse<T>): T | null {
  if ('success' in json && json.success === true) {
    return json.data ?? null;
  }
  if ('data' in json && json.data !== undefined) {
    return json.data;
  }
  return json as unknown as T;
}

async function apiFetch<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<T | null> {
  try {
    const response = await fetchFn(`${API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error({ status: response.status, endpoint }, 'API error');
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;
    return extractResponseData(json);
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
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
  requireFeature(parentData.activeFeatures, 'work_orders');

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

  const user = parentData.user;

  const rawComments = commentsData ?? {
    items: [] as WorkOrderComment[],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  const comments: PaginatedComments = {
    comments: rawComments.items,
    total: rawComments.total,
    hasMore: rawComments.items.length < rawComments.total,
  };

  return {
    workOrder,
    comments,
    photos: Array.isArray(photosData) ? photosData : [],
    userRole: user?.role ?? 'employee',
    userId: user?.id ?? 0,
  };
};
