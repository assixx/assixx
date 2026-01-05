// =============================================================================
// KVP - REACTIVE STATE (Svelte 5 Runes)
// =============================================================================

import type {
  User,
  KvpSuggestion,
  KvpCategory,
  Department,
  KvpFilter,
  KvpStats,
  BadgeCounts,
} from './types';

/**
 * KVP State using Svelte 5 Runes
 */
function createKvpState() {
  // Current user
  let currentUser = $state<User | null>(null);
  let effectiveRole = $state<string>('employee');

  // Data
  let suggestions = $state<KvpSuggestion[]>([]);
  let categories = $state<KvpCategory[]>([]);
  let departments = $state<Department[]>([]);
  let statistics = $state<KvpStats | null>(null);

  // Filters
  let currentFilter = $state<KvpFilter>('all');
  let statusFilter = $state('');
  let categoryFilter = $state('');
  let departmentFilter = $state('');
  let searchQuery = $state('');

  // Modal state
  let showCreateModal = $state(false);
  let selectedPhotos = $state<File[]>([]);

  // Loading state - PERFORMANCE: Start true to prevent FOUC (triple-render)
  let isLoading = $state(true);
  let isSubmitting = $state(false);

  // Derived: Is admin or root
  const isAdmin = $derived(effectiveRole === 'admin' || effectiveRole === 'root');

  // Derived: Is employee (can create suggestions)
  const isEmployee = $derived(effectiveRole === 'employee');

  // Derived: Badge counts for filters
  const badgeCounts = $derived<BadgeCounts>({
    all: suggestions.length,
    mine: suggestions.filter((s) => s.submittedBy === currentUser?.id).length,
    team: suggestions.filter((s) => s.orgLevel === 'team').length,
    department: suggestions.filter((s) => s.orgLevel === 'department').length,
    company: suggestions.filter((s) => s.orgLevel === 'company').length,
    manage: 0, // Manage filter has no count badge
    archived: suggestions.filter((s) => s.status === 'archived').length,
  });

  // Derived: Formatted statistics
  const formattedStats = $derived({
    total: statistics?.company?.total ?? 0,
    open:
      (statistics?.company?.byStatus?.new ?? 0) + (statistics?.company?.byStatus?.inReview ?? 0),
    implemented: statistics?.company?.byStatus?.implemented ?? 0,
    savings: new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(statistics?.company?.totalSavings ?? 0),
  });

  // Methods
  function setUser(user: User | null) {
    currentUser = user;
    updateEffectiveRole();
  }

  function updateEffectiveRole() {
    if (currentUser === null) {
      effectiveRole = 'employee';
      return;
    }

    // Check sessionStorage for role switch
    if (typeof sessionStorage !== 'undefined') {
      const roleSwitch = sessionStorage.getItem('roleSwitch');
      if (
        (currentUser.role === 'admin' || currentUser.role === 'root') &&
        roleSwitch === 'employee'
      ) {
        effectiveRole = 'employee';
        return;
      }
    }

    // Check localStorage for activeRole
    if (typeof localStorage !== 'undefined') {
      const activeRole = localStorage.getItem('activeRole');
      if (activeRole !== null && activeRole !== '' && activeRole !== currentUser.role) {
        effectiveRole = activeRole;
        return;
      }
    }

    effectiveRole = currentUser.role;
  }

  function setSuggestions(data: KvpSuggestion[]) {
    suggestions = data;
  }

  function setCategories(data: KvpCategory[]) {
    categories = data;
  }

  function setDepartments(data: Department[]) {
    departments = data;
  }

  function setStatistics(data: KvpStats | null) {
    statistics = data;
  }

  function setFilter(filter: KvpFilter) {
    currentFilter = filter;
  }

  function setStatusFilter(status: string) {
    statusFilter = status;
  }

  function setCategoryFilter(category: string) {
    categoryFilter = category;
  }

  function setDepartmentFilter(department: string) {
    departmentFilter = department;
  }

  function setSearchQuery(query: string) {
    searchQuery = query;
  }

  function openCreateModal() {
    selectedPhotos = [];
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
    selectedPhotos = [];
  }

  function addPhoto(file: File) {
    if (selectedPhotos.length < 5) {
      selectedPhotos = [...selectedPhotos, file];
    }
  }

  function removePhoto(index: number) {
    selectedPhotos = selectedPhotos.filter((_, i) => i !== index);
  }

  function clearPhotos() {
    selectedPhotos = [];
  }

  function getCategoryById(id: number): KvpCategory | undefined {
    return categories.find((c) => c.id === id);
  }

  function getDepartmentById(id: number): Department | undefined {
    return departments.find((d) => d.id === id);
  }

  function reset() {
    currentUser = null;
    effectiveRole = 'employee';
    suggestions = [];
    categories = [];
    departments = [];
    statistics = null;
    currentFilter = 'all';
    statusFilter = '';
    categoryFilter = '';
    departmentFilter = '';
    searchQuery = '';
    showCreateModal = false;
    selectedPhotos = [];
    isLoading = false;
    isSubmitting = false;
  }

  return {
    // Getters (reactive)
    get currentUser() {
      return currentUser;
    },
    get effectiveRole() {
      return effectiveRole;
    },
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
    get showCreateModal() {
      return showCreateModal;
    },
    get selectedPhotos() {
      return selectedPhotos;
    },
    get isLoading() {
      return isLoading;
    },
    get isSubmitting() {
      return isSubmitting;
    },
    get isAdmin() {
      return isAdmin;
    },
    get isEmployee() {
      return isEmployee;
    },
    get badgeCounts() {
      return badgeCounts;
    },
    get formattedStats() {
      return formattedStats;
    },

    // Methods
    setUser,
    updateEffectiveRole,
    setSuggestions,
    setCategories,
    setDepartments,
    setStatistics,
    setFilter,
    setStatusFilter,
    setCategoryFilter,
    setDepartmentFilter,
    setSearchQuery,
    openCreateModal,
    closeCreateModal,
    addPhoto,
    removePhoto,
    clearPhotos,
    getCategoryById,
    getDepartmentById,
    reset,
    setLoading: (val: boolean) => {
      isLoading = val;
    },
    setSubmitting: (val: boolean) => {
      isSubmitting = val;
    },
  };
}

// Singleton export
export const kvpState = createKvpState();
