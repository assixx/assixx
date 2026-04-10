/**
 * Inventory Lists Overview - Server-Side Data Loading
 * @module inventory/+page.server
 *
 * SSR: Loads inventory lists with status counts and the tenant tag
 * catalog (used for the filter dropdown and management modal).
 * Access: All roles (Root, Admin, Employee) — controlled via addon permissions.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetchWithPermission } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { InventoryList, InventoryTagWithUsage } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Parallel fetch — both endpoints share the same addon gate
  const [listsResult, tagsResult] = await Promise.all([
    apiFetchWithPermission<InventoryList[]>('/inventory/lists', token, fetch),
    apiFetchWithPermission<InventoryTagWithUsage[]>('/inventory/tags', token, fetch),
  ]);

  if (listsResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      lists: [] as InventoryList[],
      tags: [] as InventoryTagWithUsage[],
    };
  }

  return {
    permissionDenied: false as const,
    lists: Array.isArray(listsResult.data) ? listsResult.data : [],
    tags: Array.isArray(tagsResult.data) ? tagsResult.data : [],
  };
};
