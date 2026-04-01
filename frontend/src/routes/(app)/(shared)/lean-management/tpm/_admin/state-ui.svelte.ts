// =============================================================================
// TPM - UI STATE MODULE
// =============================================================================

import type { PlanStatusFilter } from './types';

/** Creates UI-related state (loading, filters, modals, search) */
// eslint-disable-next-line max-lines-per-function -- Svelte 5 state factory: all state vars must be in same function scope for reactivity
export function createUIState() {
  let loading = $state(true);
  let error = $state<string | null>(null);
  let statusFilter = $state<PlanStatusFilter>('active');
  let searchQuery = $state('');
  let searchOpen = $state(false);
  let showDeleteModal = $state(false);
  let deletePlanUuid = $state<string | null>(null);
  let deletePlanName = $state('');
  let submitting = $state(false);

  return {
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get statusFilter() {
      return statusFilter;
    },
    get searchQuery() {
      return searchQuery;
    },
    get searchOpen() {
      return searchOpen;
    },
    get showDeleteModal() {
      return showDeleteModal;
    },
    get deletePlanUuid() {
      return deletePlanUuid;
    },
    get deletePlanName() {
      return deletePlanName;
    },
    get submitting() {
      return submitting;
    },
    setLoading: (v: boolean) => {
      loading = v;
    },
    setError: (v: string | null) => {
      error = v;
    },
    setStatusFilter: (v: PlanStatusFilter) => {
      statusFilter = v;
    },
    setSearchQuery: (v: string) => {
      searchQuery = v;
    },
    setSearchOpen: (v: boolean) => {
      searchOpen = v;
    },
    setShowDeleteModal: (v: boolean) => {
      showDeleteModal = v;
    },
    setDeletePlanUuid: (v: string | null) => {
      deletePlanUuid = v;
    },
    setDeletePlanName: (v: string) => {
      deletePlanName = v;
    },
    setSubmitting: (v: boolean) => {
      submitting = v;
    },
  };
}

export type UIState = ReturnType<typeof createUIState>;
