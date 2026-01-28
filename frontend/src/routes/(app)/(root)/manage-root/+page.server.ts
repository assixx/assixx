/**
 * Manage Root Users - Server-Side Data Loading
 * @module manage-root/+page.server
 *
 * SSR: Loads root users for management.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { RootUser } from './_lib/types';

const log = createLogger('ManageRoot');

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

export const load: PageServerLoad = async ({ cookies, fetch, locals }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get current user ID from locals (set by RBAC hook)
  const currentUserId = locals.user?.id ?? null;

  // Fetch root users
  const rootUsersData = await apiFetch<RootUser[]>(
    '/users?role=root',
    token,
    fetch,
  );
  const allRootUsers = Array.isArray(rootUsersData) ? rootUsersData : [];

  // Exclude current user - they edit themselves on /root-profile
  const rootUsers = allRootUsers.filter(
    (u: RootUser): boolean => u.id !== currentUserId,
  );

  log.debug(
    {
      totalFromApi: allRootUsers.length,
      afterFilter: rootUsers.length,
      excludedCurrentUserId: currentUserId,
      userIds: rootUsers.map((u: RootUser) => u.id),
      userEmails: rootUsers.map((u: RootUser) => u.email),
    },
    'Root users loaded (SSR)',
  );

  return {
    rootUsers,
  };
};
