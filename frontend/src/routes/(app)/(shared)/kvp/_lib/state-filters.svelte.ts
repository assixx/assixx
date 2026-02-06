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
  let searchQuery = $state('');

  function setFilter(filter: KvpFilter): void {
    currentFilter = filter;
  }

  function setStatusFilter(status: string): void {
    statusFilter = status;
  }

  function setCategoryFilter(category: string): void {
    categoryFilter = category;
  }

  function setDepartmentFilter(department: string): void {
    departmentFilter = department;
  }

  function setSearchQuery(query: string): void {
    searchQuery = query;
  }

  function reset(): void {
    currentFilter = 'all';
    statusFilter = '';
    categoryFilter = '';
    departmentFilter = '';
    searchQuery = '';
  }

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
    get searchQuery() {
      return searchQuery;
    },
    setFilter,
    setStatusFilter,
    setCategoryFilter,
    setDepartmentFilter,
    setSearchQuery,
    reset,
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
    department: suggestions.filter((s) => s.orgLevel === 'department').length,
    company: suggestions.filter((s) => s.orgLevel === 'company').length,
    manage: 0,
    archived: suggestions.filter((s) => s.status === 'archived').length,
  };
}
