// =============================================================================
// VACATION PAGE — ACTIONS (Svelte 5 Runes)
// Module-level async helpers + thin reactive factory
// =============================================================================

import { invalidateAll } from '$app/navigation';

import { showSuccessAlert, showErrorAlert } from '$lib/utils';
import { createLogger } from '$lib/utils/logger';

import * as api from './api';
import { DEFAULT_PAGE_SIZE } from './constants';
import { vacationState } from './state.svelte';

import type { ViewTab } from './constants';
import type {
  CreateVacationRequestPayload,
  RespondPayload,
  VacationCapacityAnalysis,
  VacationRequest,
  VacationRequestStatus,
} from './types';

const log = createLogger('VacationPage');

interface ActionDeps {
  getActiveTab: () => ViewTab;
  getStatusFilter: () => VacationRequestStatus | 'all';
  getYearFilter: () => number;
}

// ─── Module-level async helpers ──────────────────────────────────────
// Each handles one API operation with error reporting.
// Extracted from factory to stay under max-lines-per-function.

async function submitCreate(
  payload: CreateVacationRequestPayload,
  onSuccess: () => void,
): Promise<void> {
  try {
    await api.createRequest(payload);
    onSuccess();
    showSuccessAlert('Urlaubsantrag eingereicht');
    await invalidateAll();
  } catch (err: unknown) {
    log.error({ err }, 'Create request failed');
    const message = err instanceof Error ? err.message : '';
    if (message.includes('blackout')) {
      showErrorAlert(
        'Antrag nicht möglich: Dieser Zeitraum liegt in einer Urlaubssperre. Bitte sprechen Sie Ihren Vorgesetzten an.',
      );
    } else if (message.includes('entitlement') || message.includes('insufficient')) {
      showErrorAlert(
        'Antrag nicht möglich: Ihr Urlaubskontingent reicht nicht aus. Bitte sprechen Sie Ihren Vorgesetzten an.',
      );
    } else {
      showErrorAlert('Fehler beim Einreichen des Antrags');
    }
  }
}

async function submitEdit(requestId: string, payload: CreateVacationRequestPayload): Promise<void> {
  try {
    await api.editRequest(requestId, payload);
    vacationState.closeEditModal();
    showSuccessAlert('Antrag aktualisiert');
    await invalidateAll();
  } catch (err: unknown) {
    log.error({ err }, 'Edit request failed');
    showErrorAlert('Fehler beim Aktualisieren des Antrags');
  }
}

async function submitWithdraw(requestId: string): Promise<void> {
  try {
    await api.withdrawRequest(requestId);
    showSuccessAlert('Antrag zurückgezogen');
    await invalidateAll();
  } catch (err: unknown) {
    log.error({ err }, 'Withdraw failed');
    showErrorAlert('Fehler beim Zurückziehen');
  }
}

async function submitRespond(
  requestId: string,
  payload: RespondPayload,
  onSuccess: () => void,
): Promise<void> {
  try {
    await api.respondToRequest(requestId, payload);
    onSuccess();
    showSuccessAlert(payload.action === 'approve' ? 'Antrag genehmigt' : 'Antrag abgelehnt');
    await invalidateAll();
  } catch (err: unknown) {
    log.error({ err }, 'Respond failed');
    showErrorAlert('Fehler bei der Bearbeitung');
  }
}

async function submitRevoke(
  requestId: string,
  reason: string,
  onSuccess: () => void,
): Promise<void> {
  try {
    await api.cancelRequest(requestId, reason);
    onSuccess();
    showSuccessAlert('Antrag widerrufen — Urlaubstage wurden zurückgebucht');
    await invalidateAll();
  } catch (err: unknown) {
    log.error({ err }, 'Revoke failed');
    showErrorAlert('Fehler beim Widerrufen des Antrags');
  }
}

async function fetchCapacity(
  startDate: string,
  endDate: string,
): Promise<VacationCapacityAnalysis | null> {
  try {
    return await api.analyzeCapacity(startDate, endDate);
  } catch (err: unknown) {
    log.error({ err }, 'Capacity check failed');
    return null;
  }
}

async function reloadTabData(deps: ActionDeps): Promise<void> {
  const yearParam = deps.getYearFilter();
  const filter = deps.getStatusFilter();
  const statusParam = filter === 'all' ? undefined : filter;

  if (deps.getActiveTab() === 'my-requests') {
    const result = await api.getMyRequests(1, DEFAULT_PAGE_SIZE, yearParam, statusParam);
    vacationState.setMyRequests(result);
  } else {
    const result = await api.getIncomingRequests(1, DEFAULT_PAGE_SIZE, yearParam, statusParam);
    vacationState.setIncomingRequests(result);
  }
}

async function loadPageData(deps: ActionDeps, nextPage: number): Promise<void> {
  const filter = deps.getStatusFilter();
  const statusParam = filter === 'all' ? undefined : filter;

  if (deps.getActiveTab() === 'my-requests') {
    const result = await api.getMyRequests(
      nextPage,
      DEFAULT_PAGE_SIZE,
      deps.getYearFilter(),
      statusParam,
    );
    vacationState.setMyRequests(result);
  } else {
    const result = await api.getIncomingRequests(
      nextPage,
      DEFAULT_PAGE_SIZE,
      deps.getYearFilter(),
      statusParam,
    );
    vacationState.setIncomingRequests(result);
  }
}

async function prefetchEditCapacity(
  request: VacationRequest,
  setCapacity: (c: VacationCapacityAnalysis | null) => void,
): Promise<void> {
  const targetId = request.id;
  const capacityPromise = api.analyzeCapacity(request.startDate, request.endDate);
  setCapacity(null);
  vacationState.openEditModal(request);

  try {
    const result = await capacityPromise;
    if (vacationState.selectedRequest?.id === targetId) {
      setCapacity(result);
    }
  } catch (err: unknown) {
    log.error({ err }, 'Edit capacity pre-fetch failed');
  }
}

// ─── Reactive factory ────────────────────────────────────────────────
// Creates state ($state/$derived) and thin wrappers over module-level helpers.
// 8 $state + 10 getters + 14 methods = cohesive reactive unit.

// eslint-disable-next-line max-lines-per-function -- reactive factory: state + getters + method wrappers form one cohesive unit; handler logic is in module-level helpers above
export function createVacationActions(deps: ActionDeps) {
  let isLoadingMore = $state(false);
  let showCreateModal = $state(false);
  let showRespondModal = $state(false);
  let respondingRequest = $state<VacationRequest | null>(null);
  let respondAction = $state<'approve' | 'deny'>('approve');
  let showRevokeModal = $state(false);
  let revokingRequest = $state<VacationRequest | null>(null);
  let editCapacity = $state<VacationCapacityAnalysis | null>(null);

  const currentList = $derived(
    deps.getActiveTab() === 'my-requests' ?
      vacationState.myRequests
    : vacationState.incomingRequests,
  );
  const hasMorePages = $derived(currentList.page < currentList.totalPages);

  // Indirect setter — avoids require-atomic-updates false positive
  const setLoading = (v: boolean): void => {
    isLoadingMore = v;
  };

  return {
    get isLoadingMore() {
      return isLoadingMore;
    },
    get showCreateModal() {
      return showCreateModal;
    },
    get showRespondModal() {
      return showRespondModal;
    },
    get respondingRequest() {
      return respondingRequest;
    },
    get respondAction() {
      return respondAction;
    },
    get showRevokeModal() {
      return showRevokeModal;
    },
    get revokingRequest() {
      return revokingRequest;
    },
    get editCapacity() {
      return editCapacity;
    },
    get currentList() {
      return currentList;
    },
    get hasMorePages() {
      return hasMorePages;
    },

    openCreateModal: () => {
      showCreateModal = true;
    },
    closeCreateModal: () => {
      showCreateModal = false;
    },
    handleCreateSubmit: (p: CreateVacationRequestPayload) =>
      submitCreate(p, () => {
        showCreateModal = false;
      }),
    handleCapacityCheck: fetchCapacity,

    handleEditSubmit: async (p: CreateVacationRequestPayload) => {
      const req = vacationState.selectedRequest;
      if (req !== null) await submitEdit(req.id, p);
    },
    handleDetail: (r: VacationRequest) => {
      vacationState.openDetailModal(r);
    },
    handleEdit: (r: VacationRequest) =>
      prefetchEditCapacity(r, (c) => {
        editCapacity = c;
      }),
    handleWithdraw: (r: VacationRequest) => submitWithdraw(r.id),

    openRespondModal: (r: VacationRequest, a: 'approve' | 'deny') => {
      respondingRequest = r;
      respondAction = a;
      showRespondModal = true;
    },
    closeRespondModal: () => {
      showRespondModal = false;
      respondingRequest = null;
    },
    handleRespondSubmit: async (p: RespondPayload) => {
      if (respondingRequest !== null) {
        await submitRespond(respondingRequest.id, p, () => {
          showRespondModal = false;
          respondingRequest = null;
        });
      }
    },

    openRevokeModal: (r: VacationRequest) => {
      revokingRequest = r;
      showRevokeModal = true;
    },
    closeRevokeModal: () => {
      showRevokeModal = false;
      revokingRequest = null;
    },
    handleRevokeSubmit: async (reason: string) => {
      if (revokingRequest !== null) {
        await submitRevoke(revokingRequest.id, reason, () => {
          showRevokeModal = false;
          revokingRequest = null;
        });
      }
    },

    async reloadCurrentTab() {
      setLoading(true);
      try {
        await reloadTabData(deps);
      } catch (err: unknown) {
        log.error({ err }, 'Error reloading data');
        showErrorAlert('Fehler beim Laden der Daten');
      } finally {
        setLoading(false);
      }
    },

    async loadNextPage() {
      if (!hasMorePages || isLoadingMore) return;
      setLoading(true);
      try {
        await loadPageData(deps, currentList.page + 1);
      } catch (err: unknown) {
        log.error({ err }, 'Pagination error');
        showErrorAlert('Fehler beim Laden weiterer Einträge');
      } finally {
        setLoading(false);
      }
    },
  };
}
