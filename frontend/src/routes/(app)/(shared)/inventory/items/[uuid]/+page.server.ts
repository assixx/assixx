/**
 * Inventory Item Detail - Server-Side Data Loading
 * @module inventory/items/[uuid]/+page.server
 *
 * SSR: Loads item detail with photos, custom values.
 * This is the QR code target page — must work on mobile.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetchWithPermission } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { InventoryItemDetail } from '../../_lib/types';

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const result = await apiFetchWithPermission<InventoryItemDetail>(
    `/inventory/items/${params.uuid}`,
    token,
    fetch,
  );

  if (result.permissionDenied) {
    return { permissionDenied: true as const, detail: null };
  }

  return {
    permissionDenied: false as const,
    detail: result.data ?? null,
  };
};
