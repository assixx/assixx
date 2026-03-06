// =============================================================================
// MANAGE MACHINES - UI STATE MODULE
// =============================================================================

import type { AssetStatusFilter } from './types';

/** Creates UI-related state (loading, error, modals, filters) */
// eslint-disable-next-line max-lines-per-function -- Svelte 5 state factory: all state vars must be in same function scope for reactivity
export function createUIState() {
  let loading = $state(true);
  let error = $state<string | null>(null);
  let currentStatusFilter = $state<AssetStatusFilter>('all');
  let currentSearchQuery = $state('');
  let searchOpen = $state(false);
  let submitting = $state(false);
  let showAssetModal = $state(false);
  let showDeleteModal = $state(false);
  let currentEditId = $state<number | null>(null);
  let deleteAssetId = $state<number | null>(null);

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
    get showAssetModal() {
      return showAssetModal;
    },
    get showDeleteModal() {
      return showDeleteModal;
    },
    get currentEditId() {
      return currentEditId;
    },
    get deleteAssetId() {
      return deleteAssetId;
    },
    setLoading: (v: boolean) => {
      loading = v;
    },
    setError: (v: string | null) => {
      error = v;
    },
    setCurrentStatusFilter: (v: AssetStatusFilter) => {
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
    setShowAssetModal: (v: boolean) => {
      showAssetModal = v;
    },
    setShowDeleteModal: (v: boolean) => {
      showDeleteModal = v;
    },
    setCurrentEditId: (v: number | null) => {
      currentEditId = v;
    },
    setDeleteAssetId: (v: number | null) => {
      deleteAssetId = v;
    },
  };
}

export type UIState = ReturnType<typeof createUIState>;
