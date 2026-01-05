/**
 * KVP Detail - Server-Side Data Loading
 * @module kvp-detail/+page.server
 *
 * SSR: Loads suggestion, comments, attachments, and org data in parallel.
 */
import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { KvpSuggestion, Comment, Attachment, Department, Team, Area } from './_lib/types';

const API_BASE = process.env['API_URL'] ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
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
      console.error(`[SSR] API error ${response.status} for ${endpoint}`);
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
    console.error(`[SSR] Fetch error for ${endpoint}:`, err);
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, url, parent }) => {
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Get UUID or ID from URL search params
  const uuid = url.searchParams.get('uuid');
  const legacyId = url.searchParams.get('id');
  const idOrUuid = uuid ?? legacyId;

  if (!idOrUuid) {
    error(400, 'Ungueltige Vorschlags-ID');
  }

  // Get user from parent layout
  const parentData = await parent();

  // First fetch the suggestion to check if it exists
  const suggestion = await apiFetch<KvpSuggestion>(`/kvp/${idOrUuid}`, token, fetch);

  if (!suggestion) {
    error(404, 'Vorschlag nicht gefunden');
  }

  // Parallel fetch: comments, attachments, and org data (for share modal)
  const [commentsData, attachmentsData, departmentsData, teamsData, areasData] = await Promise.all([
    apiFetch<Comment[]>(`/kvp/${idOrUuid}/comments`, token, fetch),
    apiFetch<Attachment[]>(`/kvp/${idOrUuid}/attachments`, token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
  ]);

  // Safe fallbacks
  const comments = Array.isArray(commentsData) ? commentsData : [];
  const attachments = Array.isArray(attachmentsData) ? attachmentsData : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const teams = Array.isArray(teamsData) ? teamsData : [];
  const areas = Array.isArray(areasData) ? areasData : [];

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] kvp-detail/${idOrUuid} loaded in ${duration}ms (6 API calls)`);

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
