/**
 * Manage Root Users - Server-Side Data Loading
 * @module manage-root/+page.server
 *
 * SSR: Loads root users for management.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { RootUser } from './_lib/types';

const log = createLogger('ManageRoot');

export const load: PageServerLoad = async ({ cookies, fetch, locals }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get current user ID from locals (set by RBAC hook)
  const currentUserId = locals.user?.id ?? null;

  // Parallel fetch: root users + positions
  const [rootUsersData, positionsData] = await Promise.all([
    apiFetch<RootUser[]>('/users?role=root', token, fetch),
    apiFetch<{ name: string; roleCategory: string }[]>('/organigram/positions', token, fetch),
  ]);
  const allRootUsers = Array.isArray(rootUsersData) ? rootUsersData : [];

  // Exclude current user - they edit themselves on /root-profile
  const rootUsers = allRootUsers.filter((u: RootUser): boolean => u.id !== currentUserId);

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
    positionOptions:
      Array.isArray(positionsData) ? positionsData.map((p: { name: string }) => p.name) : [],
  };
};
