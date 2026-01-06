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

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Get user from parent layout
  const parentData = await parent();
  const isAdmin = parentData.user?.role === 'admin' || parentData.user?.role === 'root';

  // Parallel fetch: categories + departments + suggestions + stats (if admin)
  // Type explicitly to allow mixed Promise types
  const fetchPromises: Promise<
    KvpCategory[] | Department[] | SuggestionsResponse | KvpStats | null
  >[] = [
    apiFetch<KvpCategory[]>('/kvp/categories', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<SuggestionsResponse>('/kvp', token, fetch),
  ];

  // Only fetch stats for admins
  if (isAdmin) {
    fetchPromises.push(apiFetch<KvpStats>('/kvp/dashboard/stats', token, fetch));
  }

  const results = await Promise.all(fetchPromises);

  // Extract results
  const categoriesData = results[0] as KvpCategory[] | null;
  const departmentsData = results[1] as Department[] | null;
  const suggestionsData = results[2] as SuggestionsResponse | null;
  const statsData = isAdmin ? (results[3] as KvpStats | null) : null;

  // Safe fallbacks
  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];

  // Handle suggestions response (can be array or paginated response)
  let suggestions: KvpSuggestion[] = [];
  if (Array.isArray(suggestionsData)) {
    suggestions = suggestionsData;
  } else if (
    suggestionsData !== null &&
    'data' in suggestionsData &&
    Array.isArray(suggestionsData.data)
  ) {
    suggestions = suggestionsData.data;
  } else if (suggestionsData !== null && 'suggestions' in suggestionsData) {
    const withSuggestions = suggestionsData as unknown as { suggestions?: KvpSuggestion[] };
    suggestions = Array.isArray(withSuggestions.suggestions) ? withSuggestions.suggestions : [];
  }

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] kvp loaded in ${duration}ms (${isAdmin ? '4' : '3'} parallel API calls)`);

  return {
    categories,
    departments,
    suggestions,
    statistics: statsData,
    currentUser: parentData.user,
  };
};
