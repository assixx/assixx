/**
 * Blackboard - Server-Side Data Loading
 * @module blackboard/+page.server
 *
 * SSR: Loads initial entries + organization data (for dropdowns) in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  BlackboardEntry,
  Department,
  Team,
  Area,
  PaginationMeta,
} from './_lib/types';

const log = createLogger('Blackboard');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';
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

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const apiParams = buildApiParams(url);

  // Parallel fetch: entries with filters + organization data for dropdowns
  const [entriesResult, departmentsData, teamsData, areasData] =
    await Promise.all([
      apiFetch<EntriesResponse | BlackboardEntry[]>(
        `/blackboard/entries?${apiParams.toString()}`,
        token,
        fetch,
      ),
      apiFetch<Department[]>('/departments', token, fetch),
      apiFetch<Team[]>('/teams', token, fetch),
      apiFetch<Area[]>('/areas', token, fetch),
    ]);

  const { entries, totalPages } = processEntriesResponse(entriesResult);

  return {
    entries,
    totalPages,
    departments: safeArray(departmentsData),
    teams: safeArray(teamsData),
    areas: safeArray(areasData),
  };
};
