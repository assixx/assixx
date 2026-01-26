// =============================================================================
// MANAGE ADMINS - FILTER FUNCTIONS (Pure Functions)
// =============================================================================

import { getPositionDisplay } from './utils';

import type { Admin, StatusFilter, Department } from './types';

/**
 * Filter admins by status
 * @param admins - All admins to filter
 * @param status - Status filter to apply
 * @returns Filtered admin list
 */
export function filterByStatus(admins: Admin[], status: StatusFilter): Admin[] {
  switch (status) {
    case 'active':
      return admins.filter((a) => a.isActive === 1);
    case 'inactive':
      return admins.filter((a) => a.isActive === 0);
    case 'archived':
      return admins.filter((a) => a.isActive === 3);
    case 'all':
    default:
      // Show all except deleted (4)
      return admins.filter((a) => a.isActive !== 4);
  }
}

/**
 * Filter admins by search query
 * Searches in: full name, email, position, employee number
 * @param admins - Admins to search through
 * @param query - Search query string
 * @returns Filtered admin list
 */
export function filterBySearch(admins: Admin[], query: string): Admin[] {
  const term = query.toLowerCase().trim();
  if (!term) return admins;

  return admins.filter((a) => {
    const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
    const email = a.email.toLowerCase();
    const position = getPositionDisplay(a.position ?? '').toLowerCase();
    const employeeNumber = (a.employeeNumber ?? '').toLowerCase();

    return (
      fullName.includes(term) ||
      email.includes(term) ||
      position.includes(term) ||
      employeeNumber.includes(term)
    );
  });
}

/**
 * Apply all filters in sequence
 * @param admins - All admins
 * @param status - Status filter
 * @param searchQuery - Search query
 * @returns Fully filtered admin list
 */
export function applyAllFilters(
  admins: Admin[],
  status: StatusFilter,
  searchQuery: string,
): Admin[] {
  let result = filterByStatus(admins, status);
  result = filterBySearch(result, searchQuery);
  return result;
}

/**
 * Filter available departments based on selected areas
 * Hides departments that are already covered by selected areas
 * @param allDepartments - All departments
 * @param selectedAreaIds - Currently selected area IDs
 * @param hasFullAccess - Whether full access is enabled
 * @returns Departments not covered by selected areas
 */
export function filterAvailableDepartments(
  allDepartments: Department[],
  selectedAreaIds: number[],
  hasFullAccess: boolean,
): Department[] {
  if (hasFullAccess) return [];

  return allDepartments.filter((dept) => {
    // If department's area is in selected areas, hide it (already covered)
    return !selectedAreaIds.includes(dept.areaId ?? -1);
  });
}

/**
 * Filter department IDs to remove those covered by selected areas
 * @param departmentIds - Currently selected department IDs
 * @param allDepartments - All departments
 * @param selectedAreaIds - Currently selected area IDs
 * @returns Department IDs not covered by areas
 */
export function filterDepartmentIdsByAreas(
  departmentIds: number[],
  allDepartments: Department[],
  selectedAreaIds: number[],
): number[] {
  return departmentIds.filter((deptId) => {
    const dept = allDepartments.find((d) => d.id === deptId);
    return !selectedAreaIds.includes(dept?.areaId ?? -1);
  });
}
