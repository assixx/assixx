// =============================================================================
// MANAGE MACHINES - FILTER FUNCTIONS (Pure Functions)
// =============================================================================

import type { Machine, MachineStatusFilter } from './types';

/**
 * Filter machines by status
 * @param machines - All machines to filter
 * @param status - Status filter to apply
 * @returns Filtered machine list
 */
export function filterByStatus(machines: Machine[], status: MachineStatusFilter): Machine[] {
  if (status === 'all') {
    return machines;
  }
  return machines.filter((machine) => machine.status === status);
}

/**
 * Filter machines by search query
 * Searches in: name, model, manufacturer, department, serialNumber
 * @param machines - Machines to search through
 * @param query - Search query string
 * @returns Filtered machine list
 */
export function filterBySearch(machines: Machine[], query: string): Machine[] {
  const term = query.toLowerCase().trim();
  if (term === '') return machines;

  return machines.filter((machine) => {
    const name = machine.name.toLowerCase();
    const model = (machine.model ?? '').toLowerCase();
    const manufacturer = (machine.manufacturer ?? '').toLowerCase();
    const department = (machine.departmentName ?? '').toLowerCase();
    const serialNumber = (machine.serialNumber ?? '').toLowerCase();

    return (
      name.includes(term) ||
      model.includes(term) ||
      manufacturer.includes(term) ||
      department.includes(term) ||
      serialNumber.includes(term)
    );
  });
}

/**
 * Apply all filters in sequence
 * @param machines - All machines
 * @param status - Status filter
 * @param searchQuery - Search query
 * @returns Fully filtered machine list
 */
export function applyAllFilters(
  machines: Machine[],
  status: MachineStatusFilter,
  searchQuery: string,
): Machine[] {
  let result = filterByStatus(machines, status);
  result = filterBySearch(result, searchQuery);
  return result;
}
