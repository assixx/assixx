// =============================================================================
// MANAGE EMPLOYEES - FILTER FUNCTIONS
// =============================================================================

import type { Employee, StatusFilter } from './types';

/** Filter employees by status */
export function filterByStatus(
  employees: Employee[],
  status: StatusFilter,
): Employee[] {
  switch (status) {
    case 'active':
      return employees.filter((e) => e.isActive === 1);
    case 'inactive':
      return employees.filter((e) => e.isActive === 0);
    case 'archived':
      return employees.filter((e) => e.isActive === 3);
    case 'all':
    default:
      // Show all except deleted (isActive === 4)
      return employees.filter((e) => e.isActive !== 4);
  }
}

/** Filter employees by search query (searches in: firstName, lastName, email, position, employeeNumber) */
export function filterBySearch(
  employees: Employee[],
  query: string,
): Employee[] {
  const term = query.toLowerCase().trim();
  if (term === '') return employees;

  return employees.filter((e) => {
    const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
    const email = e.email.toLowerCase();
    const position = (e.position ?? '').toLowerCase();
    const employeeNumber = (e.employeeNumber ?? '').toLowerCase();

    return (
      fullName.includes(term) ||
      email.includes(term) ||
      position.includes(term) ||
      employeeNumber.includes(term)
    );
  });
}

/** Apply all filters to employees */
export function applyAllFilters(
  employees: Employee[],
  status: StatusFilter,
  searchQuery: string,
): Employee[] {
  let result = filterByStatus(employees, status);
  result = filterBySearch(result, searchQuery);
  return result;
}
