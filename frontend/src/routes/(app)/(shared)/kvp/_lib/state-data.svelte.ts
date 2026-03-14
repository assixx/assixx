// =============================================================================
// KVP - DATA STATE (Svelte 5 Runes)
// =============================================================================

import type { KvpSuggestion, KvpCategory, Department, KvpStats } from './types';

const EMPTY_STATS: KvpStats = {
  totalSuggestions: 0,
  newSuggestions: 0,
  inReviewSuggestions: 0,
  approvedSuggestions: 0,
  implementedSuggestions: 0,
  rejectedSuggestions: 0,
  teamTotalSuggestions: 0,
  teamImplementedSuggestions: 0,
};

/** Compute implementation rate as integer percentage (0–100) */
function computeImplementationRate(total: number, implemented: number): number {
  return total > 0 ? Math.round((implemented / total) * 100) : 0;
}

/** Format KVP statistics for display */
function formatKvpStats(stats: KvpStats | null) {
  const s = stats ?? EMPTY_STATS;

  return {
    total: s.totalSuggestions,
    inReview: s.inReviewSuggestions,
    implemented: s.implementedSuggestions,
    approved: s.approvedSuggestions,
    teamTotal: s.teamTotalSuggestions,
    teamImplemented: s.teamImplementedSuggestions,
    implementationRate: computeImplementationRate(
      s.teamTotalSuggestions,
      s.teamImplementedSuggestions,
    ),
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
