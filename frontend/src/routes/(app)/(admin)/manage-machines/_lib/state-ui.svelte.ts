// =============================================================================
// MANAGE MACHINES - UI STATE MODULE
// =============================================================================

import type { MachineStatusFilter } from './types';

/** Creates UI-related state (loading, error, modals, filters) */
// eslint-disable-next-line max-lines-per-function -- Svelte 5 state factory: all state vars must be in same function scope for reactivity
export function createUIState() {
  let loading = $state(true);
  let error = $state<string | null>(null);
  let currentStatusFilter = $state<MachineStatusFilter>('all');
  let currentSearchQuery = $state('');
  let searchOpen = $state(false);
  let submitting = $state(false);
  let showMachineModal = $state(false);
  let showDeleteModal = $state(false);
  let showDeleteConfirmModal = $state(false);
  let currentEditId = $state<number | null>(null);
  let deleteMachineId = $state<number | null>(null);

  return {
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get currentStatusFilter() {
      return currentStatusFilter;
    },
    get currentSearchQuery() {
      return currentSearchQuery;
    },
    get searchOpen() {
      return searchOpen;
    },
    get submitting() {
      return submitting;
    },
    get showMachineModal() {
      return showMachineModal;
    },
    get showDeleteModal() {
      return showDeleteModal;
    },
    get showDeleteConfirmModal() {
      return showDeleteConfirmModal;
    },
    get currentEditId() {
      return currentEditId;
    },
    get deleteMachineId() {
      return deleteMachineId;
    },
    setLoading: (v: boolean) => {
      loading = v;
    },
    setError: (v: string | null) => {
      error = v;
    },
    setCurrentStatusFilter: (v: MachineStatusFilter) => {
      currentStatusFilter = v;
    },
    setCurrentSearchQuery: (v: string) => {
      currentSearchQuery = v;
    },
    setSearchOpen: (v: boolean) => {
      searchOpen = v;
    },
    setSubmitting: (v: boolean) => {
      submitting = v;
    },
    setShowMachineModal: (v: boolean) => {
      showMachineModal = v;
    },
    setShowDeleteModal: (v: boolean) => {
      showDeleteModal = v;
    },
    setShowDeleteConfirmModal: (v: boolean) => {
      showDeleteConfirmModal = v;
    },
    setCurrentEditId: (v: number | null) => {
      currentEditId = v;
    },
    setDeleteMachineId: (v: number | null) => {
      deleteMachineId = v;
    },
  };
}

export type UIState = ReturnType<typeof createUIState>;
