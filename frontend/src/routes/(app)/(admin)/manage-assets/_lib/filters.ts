// =============================================================================
// MANAGE MACHINES - FILTER FUNCTIONS (Pure Functions)
// =============================================================================

import type { Asset, AssetStatusFilter } from './types';

/** Filter assets by status */
function filterByStatus(assets: Asset[], status: AssetStatusFilter): Asset[] {
  if (status === 'all') {
    return assets;
  }
  return assets.filter((asset) => asset.status === status);
}

/**
 * Filter assets by search query.
 * Searches in: name, model, manufacturer, department, serialNumber
 */
export function filterBySearch(assets: Asset[], query: string): Asset[] {
  const term = query.toLowerCase().trim();
  if (term === '') return assets;

  return assets.filter((asset) => {
    const name = asset.name.toLowerCase();
    const model = (asset.model ?? '').toLowerCase();
    const manufacturer = (asset.manufacturer ?? '').toLowerCase();
    const department = (asset.departmentName ?? '').toLowerCase();
    const serialNumber = (asset.serialNumber ?? '').toLowerCase();

    return (
      name.includes(term) ||
      model.includes(term) ||
      manufacturer.includes(term) ||
      department.includes(term) ||
      serialNumber.includes(term)
    );
  });
}

/** Apply all filters in sequence */
export function applyAllFilters(
  assets: Asset[],
  status: AssetStatusFilter,
  searchQuery: string,
): Asset[] {
  let result = filterByStatus(assets, status);
  result = filterBySearch(result, searchQuery);
  return result;
}
