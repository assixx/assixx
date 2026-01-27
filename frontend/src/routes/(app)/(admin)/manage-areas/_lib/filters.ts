// =============================================================================
// MANAGE AREAS - FILTER FUNCTIONS
// =============================================================================

import type { Area, StatusFilter } from './types';

/**
 * Filter areas by status
 * @param areas - All areas array
 * @param status - Status filter value
 * @returns Filtered areas array
 */
export function filterByStatus(areas: Area[], status: StatusFilter): Area[] {
  switch (status) {
    case 'active':
      return areas.filter((a) => a.isActive === 1);
    case 'inactive':
      return areas.filter((a) => a.isActive === 0);
    case 'archived':
      return areas.filter((a) => a.isActive === 3);
    case 'all':
    default:
      // Show all (including archived but not deleted)
      return areas.filter((a) => a.isActive !== 4);
  }
}

/**
 * Filter areas by search query
 * Searches in: name, description, address, areaLeadName
 * @param areas - Areas to filter
 * @param query - Search query string
 * @returns Filtered areas array
 */
export function filterBySearch(areas: Area[], query: string): Area[] {
  const term = query.toLowerCase().trim();
  if (!term) return areas;

  return areas.filter((a) => {
    const name = a.name.toLowerCase();
    const description = (a.description ?? '').toLowerCase();
    const address = (a.address ?? '').toLowerCase();
    const areaLeadName = (a.areaLeadName ?? '').toLowerCase();

    return (
      name.includes(term) ||
      description.includes(term) ||
      address.includes(term) ||
      areaLeadName.includes(term)
    );
  });
}

/**
 * Apply all filters to areas
 * @param areas - All areas array
 * @param status - Status filter
 * @param searchQuery - Search query string
 * @returns Filtered areas array
 */
export function applyAllFilters(
  areas: Area[],
  status: StatusFilter,
  searchQuery: string,
): Area[] {
  let result = filterByStatus(areas, status);
  result = filterBySearch(result, searchQuery);
  return result;
}
