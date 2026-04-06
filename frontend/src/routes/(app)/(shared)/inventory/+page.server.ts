/**
 * Inventory Lists Overview - Server-Side Data Loading
 * @module inventory/+page.server
 *
 * SSR: Loads inventory lists with status counts.
 * Access: All roles (Root, Admin, Employee) — controlled via addon permissions.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetchWithPermission } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { InventoryList } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const listsResult = await apiFetchWithPermission<InventoryList[]>(
    '/inventory/lists',
    token,
    fetch,
  );

  if (listsResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      lists: [] as InventoryList[],
    };
  }

  return {
    permissionDenied: false as const,
    lists: Array.isArray(listsResult.data) ? listsResult.data : [],
  };
};
