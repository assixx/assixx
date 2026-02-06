// =============================================================================
// KVP - DATA STATE (Svelte 5 Runes)
// =============================================================================

import type {
  KvpSuggestion,
  KvpCategory,
  Department,
  KvpStats,
  StatusCounts,
} from './types';

/** Currency formatter for EUR */
const eurFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

/** Extract company stats with safe defaults */
function getCompanyStats(stats: KvpStats | null) {
  const company = stats?.company;
  return {
    total: company?.total ?? 0,
    totalSavings: company?.totalSavings ?? 0,
    byStatus: company?.byStatus,
  };
}

/** Calculate open suggestions count (new + in review) */
function getOpenCount(byStatus: StatusCounts | undefined): number {
  return (byStatus?.new ?? 0) + (byStatus?.inReview ?? 0);
}

/** Format KVP statistics for display */
function formatKvpStats(stats: KvpStats | null) {
  const { total, totalSavings, byStatus } = getCompanyStats(stats);
  return {
    total,
    open: getOpenCount(byStatus),
    implemented: byStatus?.implemented ?? 0,
    savings: eurFormatter.format(totalSavings),
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
