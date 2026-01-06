/**
 * Manage Employees - Server-Side Data Loading
 * @module manage-employees/+page.server
 *
 * SSR: Loads employees + teams in parallel for instant page render.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Employee, Team } from './_lib/types';

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

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Parallel fetch: employees + teams
  const [employeesData, teamsData] = await Promise.all([
    apiFetch<Employee[]>('/users?role=employee', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
  ]);

  const employees = Array.isArray(employeesData)
    ? employeesData.filter((u) => u.role === 'employee')
    : [];
  const teams = Array.isArray(teamsData) ? teamsData : [];

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] manage-employees loaded in ${duration}ms (2 parallel API calls)`);

  return {
    employees,
    teams,
  };
};
