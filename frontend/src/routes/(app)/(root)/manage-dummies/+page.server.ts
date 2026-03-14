/**
 * Manage Dummies — Server-Side Data Loading
 * @module manage-dummies/+page.server
 *
 * SSR: Loads dummy users + teams in parallel for instant page render.
 * Protected by (admin) layout group — only admin/root can access.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { DummyUser, PaginatedDummies, Team } from './_lib/types';

function extractDummies(data: PaginatedDummies | null): {
  dummies: DummyUser[];
  totalPages: number;
  totalItems: number;
} {
  if (data === null || !Array.isArray(data.items)) {
    return { dummies: [], totalPages: 1, totalItems: 0 };
  }
  const pageSize = data.pageSize > 0 ? data.pageSize : 20;
  return {
    dummies: data.items,
    totalPages: Math.ceil(data.total / pageSize),
    totalItems: data.total,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const [dummiesData, teamsData] = await Promise.all([
    apiFetch<PaginatedDummies>('/dummy-users?page=1&limit=20', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
  ]);

  const { dummies, totalPages, totalItems } = extractDummies(dummiesData);
  const teams: Team[] = Array.isArray(teamsData) ? teamsData : [];

  return { dummies, teams, totalPages, totalItems };
};
