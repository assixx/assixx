// =============================================================================
// MANAGE HALLS - FILTER FUNCTIONS
// =============================================================================

import type { Hall, StatusFilter } from './types';

export function filterByStatus(halls: Hall[], status: StatusFilter): Hall[] {
  switch (status) {
    case 'active':
      return halls.filter((h) => h.isActive === 1);
    case 'inactive':
      return halls.filter((h) => h.isActive === 0);
    case 'archived':
      return halls.filter((h) => h.isActive === 3);
    case 'all':
    default:
      return halls.filter((h) => h.isActive !== 4);
  }
}

export function filterBySearch(halls: Hall[], query: string): Hall[] {
  const term = query.toLowerCase().trim();
  if (term === '') return halls;

  return halls.filter((h) => {
    const name = h.name.toLowerCase();
    const description = (h.description ?? '').toLowerCase();
    const areaName = (h.areaName ?? '').toLowerCase();

    return (
      name.includes(term) ||
      description.includes(term) ||
      areaName.includes(term)
    );
  });
}

export function applyAllFilters(
  halls: Hall[],
  status: StatusFilter,
  searchQuery: string,
): Hall[] {
  let result = filterByStatus(halls, status);
  result = filterBySearch(result, searchQuery);
  return result;
}
