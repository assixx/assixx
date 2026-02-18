// =============================================================================
// KVP - AGGREGATED STATE (Svelte 5 Runes)
// =============================================================================

import { dataState } from './state-data.svelte';
import { computeBadgeCounts, filterState } from './state-filters.svelte';
import { uiState } from './state-ui.svelte';
import { userState } from './state-user.svelte';

import type { BadgeCounts } from './types';

// Re-export sub-states for direct access
export { dataState, filterState, uiState, userState };

/** Badge counts derived from data and user state */
const badgeCounts = $derived<BadgeCounts>(
  computeBadgeCounts(dataState.suggestions, userState.currentUser?.id ?? null),
);

/** Reset all sub-states */
function resetAll(): void {
  userState.reset();
  dataState.reset();
  filterState.reset();
  uiState.reset();
}

/**
 * Aggregated KVP state - provides unified access to all sub-states
 * For granular access, import sub-states directly
 */
export const kvpState = {
  // User
  get currentUser() {
    return userState.currentUser;
  },
  get effectiveRole() {
    return userState.effectiveRole;
  },
  get isAdmin() {
    return userState.isAdmin;
  },
  get isEmployee() {
    return userState.isEmployee;
  },
  setUser: userState.setUser,
  updateEffectiveRole: userState.updateEffectiveRole,

  // Data
  get suggestions() {
    return dataState.suggestions;
  },
  get categories() {
    return dataState.categories;
  },
  get departments() {
    return dataState.departments;
  },
  get statistics() {
    return dataState.statistics;
  },
  get formattedStats() {
    return dataState.formattedStats;
  },
  setSuggestions: dataState.setSuggestions,
  setCategories: dataState.setCategories,
  setDepartments: dataState.setDepartments,
  setStatistics: dataState.setStatistics,
  getCategoryById: dataState.getCategoryById,
  getDepartmentById: dataState.getDepartmentById,

  // Filters
  get currentFilter() {
    return filterState.currentFilter;
  },
  get statusFilter() {
    return filterState.statusFilter;
  },
  get categoryFilter() {
    return filterState.categoryFilter;
  },
  get departmentFilter() {
    return filterState.departmentFilter;
  },
  get searchQuery() {
    return filterState.searchQuery;
  },
  get teamFilter() {
    return filterState.teamFilter;
  },
  get machineFilter() {
    return filterState.machineFilter;
  },
  get badgeCounts() {
    return badgeCounts;
  },
  setFilter: filterState.setFilter,
  setStatusFilter: filterState.setStatusFilter,
  setCategoryFilter: filterState.setCategoryFilter,
  setDepartmentFilter: filterState.setDepartmentFilter,
  setTeamFilter: filterState.setTeamFilter,
  setMachineFilter: filterState.setMachineFilter,
  setSearchQuery: filterState.setSearchQuery,

  // UI
  get showCreateModal() {
    return uiState.showCreateModal;
  },
  get selectedPhotos() {
    return uiState.selectedPhotos;
  },
  get isLoading() {
    return uiState.isLoading;
  },
  get isSubmitting() {
    return uiState.isSubmitting;
  },
  openCreateModal: uiState.openCreateModal,
  closeCreateModal: uiState.closeCreateModal,
  addPhoto: uiState.addPhoto,
  removePhoto: uiState.removePhoto,
  clearPhotos: uiState.clearPhotos,
  setLoading: uiState.setLoading,
  setSubmitting: uiState.setSubmitting,

  // Global
  reset: resetAll,
};
