// =============================================================================
// KVP - FILTER STATE (Svelte 5 Runes)
// =============================================================================

import type { KvpFilter, BadgeCounts, KvpSuggestion } from './types';

/**
 * Filter state: all filter values and badge counts
 */
function createFilterState() {
  let currentFilter = $state<KvpFilter>('all');
  let statusFilter = $state('');
  let categoryFilter = $state('');
  let departmentFilter = $state('');
  let teamFilter = $state('');
  let assetFilter = $state('');
  let searchQuery = $state('');

  return {
    get currentFilter() {
      return currentFilter;
    },
    get statusFilter() {
      return statusFilter;
    },
    get categoryFilter() {
      return categoryFilter;
    },
    get departmentFilter() {
      return departmentFilter;
    },
    get teamFilter() {
      return teamFilter;
    },
    get assetFilter() {
      return assetFilter;
    },
    get searchQuery() {
      return searchQuery;
    },
    setFilter: (f: KvpFilter) => void (currentFilter = f),
    setStatusFilter: (v: string) => void (statusFilter = v),
    setCategoryFilter: (v: string) => void (categoryFilter = v),
    setDepartmentFilter: (v: string) => void (departmentFilter = v),
    setTeamFilter: (v: string) => void (teamFilter = v),
    setAssetFilter: (v: string) => void (assetFilter = v),
    setSearchQuery: (v: string) => void (searchQuery = v),
    reset: () => {
      currentFilter = 'all';
      statusFilter = '';
      categoryFilter = '';
      departmentFilter = '';
      teamFilter = '';
      assetFilter = '';
      searchQuery = '';
    },
  };
}

export const filterState = createFilterState();

/**
 * Computes badge counts from suggestions and current user
 */
export function computeBadgeCounts(
  suggestions: KvpSuggestion[],
  userId: number | null,
): BadgeCounts {
  return {
    all: suggestions.length,
    mine: suggestions.filter((s) => s.submittedBy === userId).length,
    team: suggestions.filter((s) => s.orgLevel === 'team').length,
    asset: suggestions.filter((s) => s.orgLevel === 'asset').length,
    department: suggestions.filter((s) => s.orgLevel === 'department').length,
    company: suggestions.filter((s) => s.orgLevel === 'company').length,
    manage: 0,
    archived: suggestions.filter((s) => s.status === 'archived').length,
  };
}
