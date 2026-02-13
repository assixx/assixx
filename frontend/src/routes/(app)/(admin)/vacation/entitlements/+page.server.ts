/**
 * Vacation Entitlements — Server-Side Data Loading
 * @module vacation/entitlements/+page.server
 *
 * SSR: Loads employee list for the entitlement management page.
 * Admin/root only (enforced by (admin) layout guard).
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { EmployeeListItem } from './_lib/types';

const log = createLogger('VacationEntitlements');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

interface PaginatedUsersResponse {
  data: RawUser[];
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
  };
}

interface RawUser {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  position: string | null;
  teamNames?: string[];
}

/** Extract data from API response envelope. */
function extractResponseData<T>(json: ApiResponse<T>): T | null {
  if ('success' in json && json.success === true) {
    return json.data ?? null;
  }
  if ('data' in json && json.data !== undefined) {
    return json.data;
  }
  return json as unknown as T;
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
    return extractResponseData(json);
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const currentYear = new Date().getFullYear();

  // Fetch active employees (role=employee + active admins for completeness)
  const usersData = await apiFetch<PaginatedUsersResponse>(
    '/users?limit=500&isActive=1&sortBy=lastName&sortOrder=asc',
    token,
    fetch,
  );

  const employees: EmployeeListItem[] =
    usersData?.data.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      position: u.position,
      teamNames: u.teamNames,
    })) ?? [];

  return {
    employees,
    currentYear,
  };
};
