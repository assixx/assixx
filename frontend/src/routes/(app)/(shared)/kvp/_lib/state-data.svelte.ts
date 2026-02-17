// =============================================================================
// KVP - DATA STATE (Svelte 5 Runes)
// =============================================================================

import type { KvpSuggestion, KvpCategory, Department, KvpStats } from './types';

/** Format KVP statistics for display */
function formatKvpStats(stats: KvpStats | null) {
  return {
    total: stats?.totalSuggestions ?? 0,
    inReview: stats?.inReviewSuggestions ?? 0,
    implemented: stats?.implementedSuggestions ?? 0,
    approved: stats?.approvedSuggestions ?? 0,
  };
}

/**
 * Data state: suggestions, categories, departments, statistics
 */
function createDataState() {
  let suggestions = $state<KvpSuggestion[]>([]);
  let categories = $state<KvpCategory[]>([]);
  let departments = $state<Department[]>([]);
  let statistics = $state<KvpStats | null>(null);

  const formattedStats = $derived(formatKvpStats(statistics));

  function setSuggestions(data: KvpSuggestion[]): void {
    suggestions = data;
  }

  function setCategories(data: KvpCategory[]): void {
    categories = data;
  }

  function setDepartments(data: Department[]): void {
    departments = data;
  }

  function setStatistics(data: KvpStats | null): void {
    statistics = data;
  }

  function getCategoryById(id: number): KvpCategory | undefined {
    return categories.find((c) => c.id === id);
  }

  function getDepartmentById(id: number): Department | undefined {
    return departments.find((d) => d.id === id);
  }

  function reset(): void {
    suggestions = [];
    categories = [];
    departments = [];
    statistics = null;
  }

  return {
    get suggestions() {
      return suggestions;
    },
    get categories() {
      return categories;
    },
    get departments() {
      return departments;
    },
    get statistics() {
      return statistics;
    },
    get formattedStats() {
      return formattedStats;
    },
    setSuggestions,
    setCategories,
    setDepartments,
    setStatistics,
    getCategoryById,
    getDepartmentById,
    reset,
  };
}

export const dataState = createDataState();
