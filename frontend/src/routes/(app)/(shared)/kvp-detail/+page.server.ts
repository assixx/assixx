/**
 * KVP Detail - Server-Side Data Loading
 * @module kvp-detail/+page.server
 *
 * SSR: Loads suggestion, comments, attachments, and org data in parallel.
 */
import { redirect, error } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  KvpSuggestion,
  Attachment,
  Department,
  Team,
  Area,
  Asset,
  LinkedWorkOrder,
  PaginatedComments,
} from './_lib/types';

/**
 * Safely convert API response to array with empty fallback
 */
function ensureArray<T>(data: T[] | null): T[] {
  return Array.isArray(data) ? data : [];
}

const EMPTY_COMMENTS: PaginatedComments = {
  comments: [],
  total: 0,
  hasMore: false,
};

/** Parallel fetch: comments, attachments, and org data for share modal */
async function fetchPageData(
  idOrUuid: string,
  token: string,
  fetchFn: typeof fetch,
) {
  const [commentsData, attachmentsData, depts, teams, areas, assets] =
    await Promise.all([
      apiFetch<PaginatedComments>(
        `/kvp/${idOrUuid}/comments?limit=20&offset=0`,
        token,
        fetchFn,
      ),
      apiFetch<Attachment[]>(`/kvp/${idOrUuid}/attachments`, token, fetchFn),
      apiFetch<Department[]>('/departments', token, fetchFn),
      apiFetch<Team[]>('/teams', token, fetchFn),
      apiFetch<Area[]>('/areas', token, fetchFn),
      apiFetch<Asset[]>('/assets', token, fetchFn),
    ]);

  return {
    comments: commentsData ?? EMPTY_COMMENTS,
    attachments: ensureArray(attachmentsData),
    departments: ensureArray(depts),
    teams: ensureArray(teams),
    areas: ensureArray(areas),
    assets: ensureArray(assets),
  };
}

interface WorkOrderListItem {
  uuid: string;
  title: string;
  status: string;
  createdByName: string;
  createdAt: string;
}

interface PaginatedWorkOrders {
  items: WorkOrderListItem[];
  total: number;
}

async function fetchLinkedWorkOrders(
  kvpUuid: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<LinkedWorkOrder[]> {
  const data = await apiFetch<PaginatedWorkOrders>(
    `/work-orders?sourceType=kvp_proposal&sourceUuid=${kvpUuid}&limit=10`,
    token,
    fetchFn,
  );
  if (data === null || !Array.isArray(data.items)) return [];
  return data.items.map((wo: WorkOrderListItem) => ({
    uuid: wo.uuid,
    title: wo.title,
    status: wo.status,
    createdByName: wo.createdByName,
    createdAt: wo.createdAt,
  }));
}

export const load: PageServerLoad = async ({ cookies, fetch, url, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const idOrUuid = url.searchParams.get('uuid') ?? url.searchParams.get('id');
  if (idOrUuid === null || idOrUuid === '') {
    error(400, 'Ungueltige Vorschlags-ID');
  }

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'kvp');

  const kvpResult = await apiFetchWithPermission<KvpSuggestion>(
    `/kvp/${idOrUuid}`,
    token,
    fetch,
  );

  if (kvpResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      suggestion: null,
      comments: EMPTY_COMMENTS,
      attachments: [] as Attachment[],
      departments: [] as Department[],
      teams: [] as Team[],
      areas: [] as Area[],
      assets: [] as Asset[],
      linkedWorkOrders: [] as LinkedWorkOrder[],
      currentUser: parentData.user,
    };
  }

  const suggestion = kvpResult.data;
  if (!suggestion) {
    error(404, 'Vorschlag nicht gefunden');
  }

  const [pageData, linkedWorkOrders] = await Promise.all([
    fetchPageData(idOrUuid, token, fetch),
    fetchLinkedWorkOrders(suggestion.uuid, token, fetch),
  ]);

  return {
    permissionDenied: false as const,
    suggestion,
    ...pageData,
    linkedWorkOrders,
    currentUser: parentData.user,
  };
};
