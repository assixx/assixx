/**
 * Employee Profile - Server-Side Data Loading
 * @module employee-profile/+page.server
 *
 * SSR: Loads employee user profile data.
 * Note: Employee profile is readonly except for password.
 * Access: employee role (or admin/root viewing as employee)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { EmployeeProfile } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get user from parent layout
  // Allow: employee, admin, root (admin/root can view as employee via role switch)
  const parentData = await parent();
  const allowedRoles = ['employee', 'admin', 'root'];
  if (!parentData.user || !allowedRoles.includes(parentData.user.role)) {
    redirect(302, '/login');
  }

  // Fetch employee profile data
  const profileData = await apiFetch<EmployeeProfile>(
    '/users/me',
    token,
    fetch,
  );

  return {
    profile: profileData,
  };
};
