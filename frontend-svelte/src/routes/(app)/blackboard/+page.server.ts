/**
 * Blackboard - Server-Side Data Loading
 * @module blackboard/+page.server
 *
 * SSR: Loads initial entries + organization data (for dropdowns) in parallel.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { BlackboardEntry, Department, Team, Area, PaginationMeta } from './_lib/types';

const API_BASE = process.env['API_URL'] ?? 'http://localhost:3000/api/v2';
const ENTRIES_PER_PAGE = 12;

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  entries?: T;
  meta?: { pagination?: PaginationMeta };
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
  } catch (error) {
    console.error(`[SSR] Fetch error for ${endpoint}:`, error);
    return null;
  }
}

interface EntriesResponse {
  entries?: BlackboardEntry[];
  data?: BlackboardEntry[];
  meta?: { pagination?: PaginationMeta };
}

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Read filter/sort/page from URL search params (Level 3: URL is source of truth)
  const page = url.searchParams.get('page') ?? '1';
  const sortBy = url.searchParams.get('sortBy') ?? 'created_at';
  const sortDir = url.searchParams.get('sortDir') ?? 'DESC';
  const filter = url.searchParams.get('filter') ?? '';
  const search = url.searchParams.get('search') ?? '';

  // Build API query string
  const apiParams = new URLSearchParams({
    status: 'active',
    page,
    limit: ENTRIES_PER_PAGE.toString(),
    sortBy,
    sortDir,
  });
  if (filter && filter !== 'all') apiParams.append('filter', filter);
  if (search.trim()) apiParams.append('search', search.trim());

  // Parallel fetch: entries with filters + organization data for dropdowns
  const [entriesResult, departmentsData, teamsData, areasData] = await Promise.all([
    apiFetch<EntriesResponse | BlackboardEntry[]>(
      `/blackboard/entries?${apiParams.toString()}`,
      token,
      fetch,
    ),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
  ]);

  // Process entries response (handles both array and object formats)
  let entries: BlackboardEntry[] = [];
  let totalPages = 1;

  if (Array.isArray(entriesResult)) {
    entries = entriesResult;
  } else if (entriesResult) {
    entries = entriesResult.entries ?? entriesResult.data ?? [];
    if (entriesResult.meta?.pagination) {
      totalPages = entriesResult.meta.pagination.totalPages;
    }
  }

  // Safe fallbacks for organization data
  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const teams = Array.isArray(teamsData) ? teamsData : [];
  const areas = Array.isArray(areasData) ? areasData : [];

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] blackboard loaded in ${duration}ms (4 parallel API calls)`);

  return {
    entries,
    totalPages,
    departments,
    teams,
    areas,
  };
};
