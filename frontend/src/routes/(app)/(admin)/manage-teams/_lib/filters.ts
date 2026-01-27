// =============================================================================
// MANAGE TEAMS - FILTER FUNCTIONS
// =============================================================================

import type { Team, StatusFilter } from './types';

/**
 * Filter teams by status
 * @param teams - All teams array
 * @param status - Status filter value
 * @returns Filtered teams array
 */
export function filterByStatus(teams: Team[], status: StatusFilter): Team[] {
  switch (status) {
    case 'active':
      return teams.filter((t) => t.isActive === 1);
    case 'inactive':
      return teams.filter((t) => t.isActive === 0);
    case 'archived':
      return teams.filter((t) => t.isActive === 3);
    case 'all':
    default:
      // Show all except deleted (isActive === 4)
      return teams.filter((t) => t.isActive !== 4);
  }
}

/**
 * Filter teams by search query
 * Searches in: name, departmentName, leaderName
 * @param teams - Teams to filter
 * @param query - Search query string
 * @returns Filtered teams array
 */
export function filterBySearch(teams: Team[], query: string): Team[] {
  const term = query.toLowerCase().trim();
  if (!term) return teams;

  return teams.filter((t) => {
    const name = t.name.toLowerCase();
    const department = (t.departmentName ?? '').toLowerCase();
    const leader = (t.leaderName ?? '').toLowerCase();

    return (
      name.includes(term) || department.includes(term) || leader.includes(term)
    );
  });
}

/**
 * Apply all filters to teams
 * @param teams - All teams array
 * @param status - Status filter
 * @param searchQuery - Search query string
 * @returns Filtered teams array
 */
export function applyAllFilters(
  teams: Team[],
  status: StatusFilter,
  searchQuery: string,
): Team[] {
  let result = filterByStatus(teams, status);
  result = filterBySearch(result, searchQuery);
  return result;
}
