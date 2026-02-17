// =============================================================================
// MANAGE ROOT - FILTER FUNCTIONS
// =============================================================================

import type { RootUser, StatusFilter } from './types';

/** Filter users by status */
export function filterByStatus(
  users: RootUser[],
  status: StatusFilter,
): RootUser[] {
  switch (status) {
    case 'active':
      return users.filter((u) => u.isActive === 1);
    case 'inactive':
      return users.filter((u) => u.isActive === 0);
    case 'archived':
      return users.filter((u) => u.isActive === 3);
    case 'all':
    default:
      // Show all except deleted (isActive === 4)
      return users.filter((u) => u.isActive !== 4);
  }
}

/** Filter users by search query (searches firstName, lastName, email, position, employeeNumber) */
export function filterBySearch(users: RootUser[], query: string): RootUser[] {
  const term = query.toLowerCase().trim();
  if (!term) return users;

  return users.filter((u) => {
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    const email = u.email.toLowerCase();
    const position = (u.position ?? '').toLowerCase();
    const employeeNumber = (u.employeeNumber ?? '').toLowerCase();

    return (
      fullName.includes(term) ||
      email.includes(term) ||
      position.includes(term) ||
      employeeNumber.includes(term)
    );
  });
}

/** Apply all filters to users */
export function applyAllFilters(
  users: RootUser[],
  status: StatusFilter,
  searchQuery: string,
): RootUser[] {
  let result = filterByStatus(users, status);
  result = filterBySearch(result, searchQuery);
  return result;
}
