/**
 * KVP (Suggestions) - Server-Side Data Loading
 * @module kvp/+page.server
 *
 * SSR: Loads categories, departments, suggestions, and stats in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
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
type SuggestionsApiResponse = KvpSuggestion[] | { data: KvpSuggestion[] } | SuggestionsResponse;

/**
 * Parses suggestions from various API response formats
 */
function parseSuggestionsResponse(data: SuggestionsApiResponse | null): KvpSuggestion[] {
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  if ('data' in data && Array.isArray(data.data)) return data.data;
  if ('suggestions' in data && Array.isArray(data.suggestions)) return data.suggestions;
  return [];
}

/**
 * Parent user type from layout
 */
interface ParentUser {
  id: number;
  role: 'root' | 'admin' | 'employee';
  position?: string;
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
async function fetchKvpData(token: string, fetchFn: typeof fetch, isAdmin: boolean) {
  // apiFetchWithPermission for /kvp to detect 403 (permission denied vs empty data)
  const [kvpResult, categoriesData, departmentsData, orgsData, statsData] = await Promise.all([
    apiFetchWithPermission<SuggestionsApiResponse>('/kvp', token, fetchFn),
    apiFetch<KvpCategory[]>('/kvp/categories', token, fetchFn),
    apiFetch<Department[]>('/departments', token, fetchFn),
    apiFetch<UserTeamWithAssets[]>('/kvp/my-organizations', token, fetchFn),
    isAdmin ? apiFetch<KvpStats>('/kvp/dashboard/stats', token, fetchFn) : Promise.resolve(null),
  ]);

  if (kvpResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      categories: [] as KvpCategory[],
      departments: Array.isArray(departmentsData) ? departmentsData : [],
      suggestions: [] as KvpSuggestion[],
      userOrganizations: [] as UserTeamWithAssets[],
      statistics: null,
    };
  }

  return {
    permissionDenied: false as const,
    categories: Array.isArray(categoriesData) ? categoriesData : [],
    departments: Array.isArray(departmentsData) ? departmentsData : [],
    suggestions: parseSuggestionsResponse(kvpResult.data),
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
  const isAdmin = parentData.user?.role === 'admin' || parentData.user?.role === 'root';
  const isTeamLead = (parentData.user as ParentUser | null)?.position === 'team_lead';
  const showStats = isAdmin || isTeamLead;

  const kvpData = await fetchKvpData(token, fetch, showStats);

  return {
    ...kvpData,
    showStats,
    currentUser: mapParentUserToCurrentUser(parentData.user),
  };
};
