/**
 * KVP (Suggestions) - Server-Side Data Loading
 * @module kvp/+page.server
 *
 * SSR: Loads categories, departments, suggestions, and stats in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  KvpCategory,
  Department,
  KvpSuggestion,
  KvpStats,
  SuggestionsResponse,
  UserTeamWithAssets,
} from './_lib/types';

/**
 * Possible API response formats for suggestions endpoint
 */
type SuggestionsApiResponse =
  | KvpSuggestion[]
  | { data: KvpSuggestion[] }
  | SuggestionsResponse;

/**
 * Parses suggestions from various API response formats
 */
function parseSuggestionsResponse(
  data: SuggestionsApiResponse | null,
): KvpSuggestion[] {
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  if ('data' in data && Array.isArray(data.data)) return data.data;
  if ('suggestions' in data && Array.isArray(data.suggestions))
    return data.suggestions;
  return [];
}

/**
 * Parent user type from layout
 */
interface ParentUser {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
  teamIds?: number[];
  teamDepartmentId?: number | null;
}

/**
 * Maps parent layout user to KVP CurrentUser format
 * Parent layout returns teamIds[] array, KVP expects teamId (first team)
 */
function mapParentUserToCurrentUser(parentUser: ParentUser | null) {
  if (parentUser === null) return null;
  return {
    id: parentUser.id,
    role: parentUser.role,
    tenantId: parentUser.tenantId,
    departmentId: parentUser.teamDepartmentId ?? null,
    teamId: parentUser.teamIds?.[0],
  };
}

/**
 * Fetches all KVP data in parallel
 */
async function fetchKvpData(
  token: string,
  fetchFn: typeof fetch,
  isAdmin: boolean,
) {
  const fetchPromises: Promise<
    | KvpCategory[]
    | Department[]
    | SuggestionsApiResponse
    | KvpStats
    | UserTeamWithAssets[]
    | null
  >[] = [
    apiFetch<KvpCategory[]>('/kvp/categories', token, fetchFn),
    apiFetch<Department[]>('/departments', token, fetchFn),
    apiFetch<SuggestionsApiResponse>('/kvp', token, fetchFn),
    apiFetch<UserTeamWithAssets[]>('/kvp/my-organizations', token, fetchFn),
  ];

  if (isAdmin) {
    fetchPromises.push(
      apiFetch<KvpStats>('/kvp/dashboard/stats', token, fetchFn),
    );
  }

  const results = await Promise.all(fetchPromises);

  const categoriesData = results[0] as KvpCategory[] | null;
  const departmentsData = results[1] as Department[] | null;
  const suggestionsData = results[2] as SuggestionsApiResponse | null;
  const orgsData = results[3] as UserTeamWithAssets[] | null;
  const statsData = isAdmin ? (results[4] as KvpStats | null) : null;

  return {
    categories: Array.isArray(categoriesData) ? categoriesData : [],
    departments: Array.isArray(departmentsData) ? departmentsData : [],
    suggestions: parseSuggestionsResponse(suggestionsData),
    userOrganizations: Array.isArray(orgsData) ? orgsData : [],
    statistics: statsData,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'kvp');
  const isAdmin =
    parentData.user?.role === 'admin' || parentData.user?.role === 'root';

  const kvpData = await fetchKvpData(token, fetch, isAdmin);

  return {
    ...kvpData,
    currentUser: mapParentUserToCurrentUser(
      parentData.user as ParentUser | null,
    ),
  };
};
