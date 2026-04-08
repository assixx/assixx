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

/** Filter lists by search query (searches in: title, tag names, codePrefix) */
export function filterBySearch(lists: InventoryList[], query: string): InventoryList[] {
  const term = query.toLowerCase().trim();
  if (!term) return lists;

  return lists.filter((l) => {
    const title = l.title.toLowerCase();
    const prefix = l.codePrefix.toLowerCase();
    const tagMatch = l.tags.some((t) => t.name.toLowerCase().includes(term));

    return title.includes(term) || prefix.includes(term) || tagMatch;
  });
}

/**
 * Filter lists by selected tag IDs (OR semantics — list matches if it has
 * at least one of the supplied tags). Empty selection = no filter.
 */
export function filterByTags(lists: InventoryList[], tagIds: string[]): InventoryList[] {
  if (tagIds.length === 0) return lists;
  const set = new Set(tagIds);
  return lists.filter((l) => l.tags.some((t) => set.has(t.id)));
}

/** Apply all filters to lists */
export function applyAllFilters(
  lists: InventoryList[],
  status: StatusFilter,
  searchQuery: string,
  tagIds: string[],
): InventoryList[] {
  let result = filterByStatus(lists, status);
  result = filterBySearch(result, searchQuery);
  result = filterByTags(result, tagIds);
  return result;
}
