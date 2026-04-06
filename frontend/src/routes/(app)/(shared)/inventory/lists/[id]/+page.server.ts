/**
 * Inventory Items Page - Server-Side Data Loading
 * @module inventory/lists/[id]/+page.server
 *
 * SSR: Loads list details, items (paginated), and custom field definitions.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type {
  CustomValueWithField,
  InventoryCustomField,
  InventoryItem,
  InventoryList,
  ItemsPage,
} from '../../_lib/types';

interface ListDetailResponse {
  list: InventoryList;
  fields: InventoryCustomField[];
}

const EMPTY_RESULT = {
  permissionDenied: true as const,
  list: null,
  fields: [] as InventoryCustomField[],
  items: [] as InventoryItem[],
  total: 0,
  currentPage: 1,
  customValuesByItem: {} as Record<string, CustomValueWithField[]>,
};

function buildItemsUrl(listId: string, pg: string, status?: string, search?: string): string {
  let url = `/inventory/items?listId=${listId}&page=${pg}&limit=50`;
  if (status !== undefined) url += `&status=${status}`;
  if (search !== undefined) url += `&search=${encodeURIComponent(search)}`;
  return url;
}

async function fetchListAndItems(
  token: string,
  fetchFn: typeof fetch,
  listId: string,
  pg: string,
  status?: string,
  search?: string,
): Promise<{ listData: ListDetailResponse | null; itemsData: ItemsPage | null; denied: boolean }> {
  const [listResult, itemsData] = await Promise.all([
    apiFetchWithPermission<ListDetailResponse>(`/inventory/lists/${listId}`, token, fetchFn),
    apiFetch<ItemsPage>(buildItemsUrl(listId, pg, status, search), token, fetchFn),
  ]);

  return {
    listData: listResult.data ?? null,
    itemsData,
    denied: listResult.permissionDenied,
  };
}

function buildSuccessResult(
  listData: ListDetailResponse | null,
  itemsData: ItemsPage | null,
  pg: string,
) {
  const emptyItems = { items: [], total: 0, customValuesByItem: {} };
  const resolved = itemsData ?? emptyItems;
  return {
    permissionDenied: false as const,
    list: listData?.list ?? null,
    fields: listData?.fields ?? [],
    items: resolved.items,
    total: resolved.total,
    currentPage: Number(pg),
    customValuesByItem: resolved.customValuesByItem,
  };
}

export const load: PageServerLoad = async ({ params, cookies, fetch, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const pg = url.searchParams.get('page') ?? '1';
  const { listData, itemsData, denied } = await fetchListAndItems(
    token,
    fetch,
    params.id,
    pg,
    url.searchParams.get('status') ?? undefined,
    url.searchParams.get('search') ?? undefined,
  );

  if (denied) return EMPTY_RESULT;
  return buildSuccessResult(listData, itemsData, pg);
};
