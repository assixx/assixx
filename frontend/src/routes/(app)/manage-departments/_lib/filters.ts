// =============================================================================
// MANAGE DEPARTMENTS - FILTER FUNCTIONS
// =============================================================================

import type { Department, StatusFilter } from './types';

/**
 * Filter departments by status
 * @param departments - All departments array
 * @param status - Status filter value
 * @returns Filtered departments array
 */
export function filterByStatus(departments: Department[], status: StatusFilter): Department[] {
  switch (status) {
    case 'active':
      return departments.filter((d) => d.isActive === 1);
    case 'inactive':
      return departments.filter((d) => d.isActive === 0);
    case 'archived':
      return departments.filter((d) => d.isActive === 3);
    case 'all':
    default:
      // Show all except deleted (isActive === 4)
      return departments.filter((d) => d.isActive !== 4);
  }
}

/**
 * Filter departments by search query
 * Searches in: name, description, areaName
 * @param departments - Departments to filter
 * @param query - Search query string
 * @returns Filtered departments array
 */
export function filterBySearch(departments: Department[], query: string): Department[] {
  const term = query.toLowerCase().trim();
  if (!term) return departments;

  return departments.filter((d) => {
    const name = d.name.toLowerCase();
    const description = (d.description ?? '').toLowerCase();
    const areaName = (d.areaName ?? '').toLowerCase();

    return name.includes(term) || description.includes(term) || areaName.includes(term);
  });
}

/**
 * Apply all filters to departments
 * @param departments - All departments array
 * @param status - Status filter
 * @param searchQuery - Search query string
 * @returns Filtered departments array
 */
export function applyAllFilters(
  departments: Department[],
  status: StatusFilter,
  searchQuery: string,
): Department[] {
  let result = filterByStatus(departments, status);
  result = filterBySearch(result, searchQuery);
  return result;
}
