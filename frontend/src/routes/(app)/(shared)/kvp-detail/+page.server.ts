/**
 * KVP Detail - Server-Side Data Loading
 * @module kvp-detail/+page.server
 *
 * SSR: Loads suggestion, comments, attachments, and org data in parallel.
 */
import { redirect, error } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  KvpSuggestion,
  Attachment,
  Department,
  Team,
  Area,
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

export const load: PageServerLoad = async ({ cookies, fetch, url, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get UUID or ID from URL search params
  const uuid = url.searchParams.get('uuid');
  const legacyId = url.searchParams.get('id');
  const idOrUuid = uuid ?? legacyId;

  if (idOrUuid === null || idOrUuid === '') {
    error(400, 'Ungueltige Vorschlags-ID');
  }

  // Get user from parent layout
  const parentData = await parent();

  // First fetch the suggestion to check if it exists
  const suggestion = await apiFetch<KvpSuggestion>(
    `/kvp/${idOrUuid}`,
    token,
    fetch,
  );

  if (!suggestion) {
    error(404, 'Vorschlag nicht gefunden');
  }

  const defaultComments: PaginatedComments = {
    comments: [],
    total: 0,
    hasMore: false,
  };

  // Parallel fetch: comments (paginated), attachments, and org data (for share modal)
  const [commentsData, attachmentsData, departmentsData, teamsData, areasData] =
    await Promise.all([
      apiFetch<PaginatedComments>(
        `/kvp/${idOrUuid}/comments?limit=20&offset=0`,
        token,
        fetch,
      ),
      apiFetch<Attachment[]>(`/kvp/${idOrUuid}/attachments`, token, fetch),
      apiFetch<Department[]>('/departments', token, fetch),
      apiFetch<Team[]>('/teams', token, fetch),
      apiFetch<Area[]>('/areas', token, fetch),
    ]);

  const comments = commentsData ?? defaultComments;
  const attachments = ensureArray(attachmentsData);
  const departments = ensureArray(departmentsData);
  const teams = ensureArray(teamsData);
  const areas = ensureArray(areasData);

  return {
    suggestion,
    comments,
    attachments,
    departments,
    teams,
    areas,
    currentUser: parentData.user,
  };
};
