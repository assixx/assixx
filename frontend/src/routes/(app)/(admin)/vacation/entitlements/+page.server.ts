/**
 * Vacation Entitlements — Server-Side Data Loading
 * @module vacation/entitlements/+page.server
 *
 * SSR: Loads employee list for the entitlement management page.
 * Admin/root only (enforced by (admin) layout guard).
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { EmployeeListItem } from './_lib/types';

interface RawUser {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  position: string | null;
  employeeNumber?: string;
  teamNames?: string[];
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'vacation');

  const currentYear = new Date().getFullYear();

  // Fetch active employees
  // ResponseInterceptor flattens paginated responses: data = [...users] directly
  const usersData = await apiFetch<RawUser[]>(
    '/users?limit=100&isActive=1&sortBy=lastName&sortOrder=asc',
    token,
    fetch,
  );

  const rawUsers = Array.isArray(usersData) ? usersData : [];
  const employees: EmployeeListItem[] = rawUsers.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    position: u.position,
    employeeNumber: u.employeeNumber,
    teamNames: u.teamNames,
  }));

  return {
    employees,
    currentYear,
  };
};
