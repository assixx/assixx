// =============================================================================
// VACATION STATE - UI MODULE
// Modals, filters, tabs, loading, selections
// =============================================================================

import type { ViewTab } from './constants';
import type { VacationRequest, VacationRequestStatus } from './types';

// Loading
let isLoading = $state(false);

// Tab & filters
let activeTab = $state<ViewTab>('my-requests');
let statusFilter = $state<VacationRequestStatus | 'all'>('all');
let currentYear = $state(new Date().getFullYear());
let currentPage = $state(1);

// Selection
let selectedRequest = $state<VacationRequest | null>(null);

// Modals
let showCreateModal = $state(false);
let showDetailModal = $state(false);
let showEditModal = $state(false);
let showWithdrawModal = $state(false);
let showCancelModal = $state(false);
let showStatusLogModal = $state(false);

// ─── Tab & Filter methods ─────────────────────────────────────────────

function setActiveTab(tab: ViewTab) {
  activeTab = tab;
  currentPage = 1;
}

function setStatusFilter(status: VacationRequestStatus | 'all') {
  statusFilter = status;
  currentPage = 1;
}

function setYear(year: number) {
  currentYear = year;
  currentPage = 1;
}

function setPage(page: number) {
  currentPage = page;
}

// ─── Modal methods ────────────────────────────────────────────────────

function openCreateModal() {
  selectedRequest = null;
  showCreateModal = true;
}

function closeCreateModal() {
  showCreateModal = false;
}

function openDetailModal(request: VacationRequest) {
  selectedRequest = request;
  showDetailModal = true;
}

function closeDetailModal() {
  showDetailModal = false;
  selectedRequest = null;
}

function openEditModal(request: VacationRequest) {
  selectedRequest = request;
  showEditModal = true;
}

function closeEditModal() {
  showEditModal = false;
  selectedRequest = null;
}

function openWithdrawModal(request: VacationRequest) {
  selectedRequest = request;
  showWithdrawModal = true;
}

function closeWithdrawModal() {
  showWithdrawModal = false;
  selectedRequest = null;
}

function openCancelModal(request: VacationRequest) {
  selectedRequest = request;
  showCancelModal = true;
}

function closeCancelModal() {
  showCancelModal = false;
  selectedRequest = null;
}

function openStatusLogModal(request: VacationRequest) {
  selectedRequest = request;
  showStatusLogModal = true;
}

function closeStatusLogModal() {
  showStatusLogModal = false;
}

function reset() {
  isLoading = false;
  activeTab = 'my-requests';
  statusFilter = 'all';
  currentYear = new Date().getFullYear();
  currentPage = 1;
  selectedRequest = null;
  showCreateModal = false;
  showDetailModal = false;
  showEditModal = false;
  showWithdrawModal = false;
  showCancelModal = false;
  showStatusLogModal = false;
}

export const uiState = {
  // Getters
  get isLoading() {
    return isLoading;
  },
  get activeTab() {
    return activeTab;
  },
  get statusFilter() {
    return statusFilter;
  },
  get currentYear() {
    return currentYear;
  },
  get currentPage() {
    return currentPage;
  },
  get selectedRequest() {
    return selectedRequest;
  },
  get showCreateModal() {
    return showCreateModal;
  },
  get showDetailModal() {
    return showDetailModal;
  },
  get showEditModal() {
    return showEditModal;
  },
  get showWithdrawModal() {
    return showWithdrawModal;
  },
  get showCancelModal() {
    return showCancelModal;
  },
  get showStatusLogModal() {
    return showStatusLogModal;
  },
  // Methods
  setLoading: (val: boolean) => {
    isLoading = val;
  },
  setActiveTab,
  setStatusFilter,
  setYear,
  setPage,
  openCreateModal,
  closeCreateModal,
  openDetailModal,
  closeDetailModal,
  openEditModal,
  closeEditModal,
  openWithdrawModal,
  closeWithdrawModal,
  openCancelModal,
  closeCancelModal,
  openStatusLogModal,
  closeStatusLogModal,
  reset,
};
