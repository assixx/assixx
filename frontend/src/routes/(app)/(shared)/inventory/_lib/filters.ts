// =============================================================================
// INVENTORY - FILTER FUNCTIONS
// =============================================================================

import type { InventoryList, StatusFilter } from './types';

/** Filter lists by is_active status */
export function filterByStatus(lists: InventoryList[], status: StatusFilter): InventoryList[] {
  switch (status) {
    case 'active':
      return lists.filter((l) => l.isActive === 1);
    case 'inactive':
      return lists.filter((l) => l.isActive === 0);
    case 'archived':
      return lists.filter((l) => l.isActive === 3);
    case 'all':
    default:
      return lists.filter((l) => l.isActive !== 4);
  }
}

/** Filter lists by search query (searches in: title, category, codePrefix) */
export function filterBySearch(lists: InventoryList[], query: string): InventoryList[] {
  const term = query.toLowerCase().trim();
  if (!term) return lists;

  return lists.filter((l) => {
    const title = l.title.toLowerCase();
    const category = (l.category ?? '').toLowerCase();
    const prefix = l.codePrefix.toLowerCase();

    return title.includes(term) || category.includes(term) || prefix.includes(term);
  });
}

/** Apply all filters to lists */
export function applyAllFilters(
  lists: InventoryList[],
  status: StatusFilter,
  searchQuery: string,
): InventoryList[] {
  let result = filterByStatus(lists, status);
  result = filterBySearch(result, searchQuery);
  return result;
}
