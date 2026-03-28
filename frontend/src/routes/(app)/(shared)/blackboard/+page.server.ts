/**
 * Blackboard - Server-Side Data Loading
 * @module blackboard/+page.server
 *
 * SSR: Loads initial entries + organization data (for dropdowns) in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { BlackboardEntry, Department, Team, Area, PaginationMeta } from './_lib/types';

const ENTRIES_PER_PAGE = 12;

interface EntriesResponse {
  entries?: BlackboardEntry[];
  data?: BlackboardEntry[];
  meta?: { pagination?: PaginationMeta };
}

interface ProcessedEntries {
  entries: BlackboardEntry[];
  totalPages: number;
}

/** Process entries response (handles both array and object formats) */
function processEntriesResponse(
  result: EntriesResponse | BlackboardEntry[] | null,
): ProcessedEntries {
  if (result === null) {
    return { entries: [], totalPages: 1 };
  }
  if (Array.isArray(result)) {
    return { entries: result, totalPages: 1 };
  }
  return {
    entries: result.entries ?? result.data ?? [],
    totalPages: result.meta?.pagination?.totalPages ?? 1,
  };
}

/** Safely extract array from API response */
function safeArray<T>(data: T[] | null): T[] {
  return Array.isArray(data) ? data : [];
}

/** Build API query params from URL search params */
function buildApiParams(url: URL): URLSearchParams {
  const page = url.searchParams.get('page') ?? '1';
  const sortBy = url.searchParams.get('sortBy') ?? 'created_at';
  const sortDir = url.searchParams.get('sortDir') ?? 'DESC';
  const filter = url.searchParams.get('filter') ?? '';
  const search = url.searchParams.get('search') ?? '';

  const params = new URLSearchParams({
    status: 'active',
    page,
    limit: ENTRIES_PER_PAGE.toString(),
    sortBy,
    sortDir,
  });

  if (filter !== '' && filter !== 'all') params.append('filter', filter);
  if (search.trim() !== '') params.append('search', search.trim());

  return params;
}

export const load: PageServerLoad = async ({ cookies, fetch, url, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'blackboard');

  const apiParams = buildApiParams(url);

  // Parallel fetch: entries with filters + organization data for dropdowns
  const [entriesCheck, departmentsData, teamsData, areasData] = await Promise.all([
    apiFetchWithPermission<EntriesResponse | BlackboardEntry[]>(
      `/blackboard/entries?${apiParams.toString()}`,
      token,
      fetch,
    ),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
  ]);

  if (entriesCheck.permissionDenied) {
    return {
      permissionDenied: true as const,
      entries: [],
      totalPages: 1,
      departments: [],
      teams: [],
      areas: [],
    };
  }

  const { entries, totalPages } = processEntriesResponse(entriesCheck.data);

  return {
    permissionDenied: false as const,
    entries,
    totalPages,
    departments: safeArray(departmentsData),
    teams: safeArray(teamsData),
    areas: safeArray(areasData),
  };
};
