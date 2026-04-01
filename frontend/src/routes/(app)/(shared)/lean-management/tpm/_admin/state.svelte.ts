// =============================================================================
// TPM - COMPOSED STATE (Svelte 5 Runes)
// =============================================================================

import { createDataState } from './state-data.svelte';
import { createUIState } from './state-ui.svelte';

import type { PlanStatusFilter, TpmPlan } from './types';

/**
 * TPM State Factory
 * Composes data and UI state modules into a unified API
 */
// eslint-disable-next-line max-lines-per-function -- Facade pattern: composing sub-modules into unified API. Actual reactive logic is in sub-modules.
function createTpmState() {
  const data = createDataState();
  const ui = createUIState();

  // Modal helpers
  const openDeleteModal = (plan: TpmPlan) => {
    ui.setDeletePlanUuid(plan.uuid);
    ui.setDeletePlanName(plan.name);
    ui.setShowDeleteModal(true);
  };
  const closeDeleteModal = () => {
    ui.setShowDeleteModal(false);
    ui.setDeletePlanUuid(null);
    ui.setDeletePlanName('');
  };

  return {
    // Data
    get plans() {
      return data.plans;
    },
    get cards() {
      return data.cards;
    },
    get colors() {
      return data.colors;
    },
    get totalPlans() {
      return data.totalPlans;
    },
    get currentPage() {
      return data.currentPage;
    },
    setPlans: data.setPlans,
    setCards: data.setCards,
    setColors: data.setColors,
    setTotalPlans: data.setTotalPlans,
    setCurrentPage: data.setCurrentPage,

    // UI
    get loading() {
      return ui.loading;
    },
    get error() {
      return ui.error;
    },
    get statusFilter() {
      return ui.statusFilter;
    },
    get searchQuery() {
      return ui.searchQuery;
    },
    get searchOpen() {
      return ui.searchOpen;
    },
    get showDeleteModal() {
      return ui.showDeleteModal;
    },
    get deletePlanUuid() {
      return ui.deletePlanUuid;
    },
    get deletePlanName() {
      return ui.deletePlanName;
    },
    get submitting() {
      return ui.submitting;
    },
    setLoading: ui.setLoading,
    setError: ui.setError,
    setStatusFilter: (v: PlanStatusFilter) => {
      ui.setStatusFilter(v);
    },
    setSearchQuery: ui.setSearchQuery,
    setSearchOpen: ui.setSearchOpen,
    setSubmitting: ui.setSubmitting,

    // Modal methods
    openDeleteModal,
    closeDeleteModal,
  };
}

/** Singleton export */
export const tpmState = createTpmState();
