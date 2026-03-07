/**
 * KVP Detail - Server-Side Data Loading
 * @module kvp-detail/+page.server
 *
 * SSR: Loads suggestion, comments, attachments, and org data in parallel.
 */
import { redirect, error } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  KvpSuggestion,
  Attachment,
  Department,
  Team,
  Area,
  Asset,
  PaginatedComments,
} from './_lib/types';

const log = createLogger('KvpDetail');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

/**
 * Safely convert API response to array with empty fallback
 */
function ensureArray<T>(data: T[] | null): T[] {
  return Array.isArray(data) ? data : [];
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
      if (response.status === 404) return null;
      log.error({ status: response.status, endpoint }, 'API error');
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;
    if ('success' in json && json.success === true) {
      return json.data ?? null;
    }
    if ('data' in json && json.data !== undefined) {
      return json.data;
    }
    return json as unknown as T;
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
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
  requireFeature(parentData.activeFeatures, 'kvp');

  const suggestion = await apiFetch<KvpSuggestion>(
    `/kvp/${idOrUuid}`,
    token,
    fetch,
  );
  if (!suggestion) {
    error(404, 'Vorschlag nicht gefunden');
  }

  const pageData = await fetchPageData(idOrUuid, token, fetch);

  return { suggestion, ...pageData, currentUser: parentData.user };
};
