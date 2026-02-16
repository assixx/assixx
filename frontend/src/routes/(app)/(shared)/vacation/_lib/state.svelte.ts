// =============================================================================
// VACATION - REACTIVE STATE (Svelte 5 Runes)
// Main entry point — composes data + ui state modules
// =============================================================================

import { dataState } from './state-data.svelte';
import { uiState } from './state-ui.svelte';

/**
 * Reset all vacation state to initial values
 */
function reset() {
  dataState.reset();
  uiState.reset();
}

/**
 * Unified vacation state — re-exports all modules
 */
export const vacationState = {
  // ─── Data state ───────────────────────────────────────────────────────
  get myRequests() {
    return dataState.myRequests;
  },
  get incomingRequests() {
    return dataState.incomingRequests;
  },
  get balance() {
    return dataState.balance;
  },
  get capacityAnalysis() {
    return dataState.capacityAnalysis;
  },
  get statusLog() {
    return dataState.statusLog;
  },
  setMyRequests: dataState.setMyRequests,
  setIncomingRequests: dataState.setIncomingRequests,
  setBalance: dataState.setBalance,
  setCapacityAnalysis: dataState.setCapacityAnalysis,
  setStatusLog: dataState.setStatusLog,

  // ─── UI state ─────────────────────────────────────────────────────────
  get isLoading() {
    return uiState.isLoading;
  },
  get activeTab() {
    return uiState.activeTab;
  },
  get statusFilter() {
    return uiState.statusFilter;
  },
  get currentYear() {
    return uiState.currentYear;
  },
  get currentPage() {
    return uiState.currentPage;
  },
  get selectedRequest() {
    return uiState.selectedRequest;
  },
  get showCreateModal() {
    return uiState.showCreateModal;
  },
  get showDetailModal() {
    return uiState.showDetailModal;
  },
  get showEditModal() {
    return uiState.showEditModal;
  },
  get showWithdrawModal() {
    return uiState.showWithdrawModal;
  },
  get showCancelModal() {
    return uiState.showCancelModal;
  },
  get showStatusLogModal() {
    return uiState.showStatusLogModal;
  },
  setLoading: uiState.setLoading,
  setActiveTab: uiState.setActiveTab,
  setStatusFilter: uiState.setStatusFilter,
  setYear: uiState.setYear,
  setPage: uiState.setPage,
  openCreateModal: uiState.openCreateModal,
  closeCreateModal: uiState.closeCreateModal,
  openDetailModal: uiState.openDetailModal,
  closeDetailModal: uiState.closeDetailModal,
  openEditModal: uiState.openEditModal,
  closeEditModal: uiState.closeEditModal,
  openWithdrawModal: uiState.openWithdrawModal,
  closeWithdrawModal: uiState.closeWithdrawModal,
  openCancelModal: uiState.openCancelModal,
  closeCancelModal: uiState.closeCancelModal,
  openStatusLogModal: uiState.openStatusLogModal,
  closeStatusLogModal: uiState.closeStatusLogModal,

  // ─── Global reset ─────────────────────────────────────────────────────
  reset,
};
