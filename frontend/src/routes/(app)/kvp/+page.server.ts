/**
 * KVP (Suggestions) - Server-Side Data Loading
 * @module kvp/+page.server
 *
 * SSR: Loads categories, departments, suggestions, and stats in parallel.
 */
import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';
import type {
  KvpCategory,
  Department,
  KvpSuggestion,
  KvpStats,
  SuggestionsResponse,
} from './_lib/types';

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

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

/**
 * Possible API response formats for suggestions endpoint
 */
type SuggestionsApiResponse = KvpSuggestion[] | { data: KvpSuggestion[] } | SuggestionsResponse;

/**
 * Parses suggestions from various API response formats
 */
function parseSuggestionsResponse(data: SuggestionsApiResponse | null): KvpSuggestion[] {
  if (data === null) {
    return [];
  }
  if (Array.isArray(data)) {
    return data;
  }
  if ('data' in data && Array.isArray(data.data)) {
    return data.data;
  }
  if ('suggestions' in data && Array.isArray(data.suggestions)) {
    return data.suggestions;
  }
  return [];
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get user from parent layout
  const parentData = await parent();
  const isAdmin = parentData.user?.role === 'admin' || parentData.user?.role === 'root';

  // Parallel fetch: categories + departments + suggestions + stats (if admin)
  // Type explicitly to allow mixed Promise types
  const fetchPromises: Promise<
    KvpCategory[] | Department[] | SuggestionsApiResponse | KvpStats | null
  >[] = [
    apiFetch<KvpCategory[]>('/kvp/categories', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<SuggestionsApiResponse>('/kvp', token, fetch),
  ];

  // Only fetch stats for admins
  if (isAdmin) {
    fetchPromises.push(apiFetch<KvpStats>('/kvp/dashboard/stats', token, fetch));
  }

  const results = await Promise.all(fetchPromises);

  // Extract results
  const categoriesData = results[0] as KvpCategory[] | null;
  const departmentsData = results[1] as Department[] | null;
  const suggestionsData = results[2] as SuggestionsApiResponse | null;
  const statsData = isAdmin ? (results[3] as KvpStats | null) : null;

  // Safe fallbacks
  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];

  // Parse suggestions from various response formats
  const suggestions = parseSuggestionsResponse(suggestionsData);

  return {
    categories,
    departments,
    suggestions,
    statistics: statsData,
    currentUser: parentData.user,
  };
};
