<script lang="ts">
  /**
   * Vacation — Main Page Component
   * SSR: Data loaded in +page.server.ts
   * Svelte 5 Runes: $derived for SSR, $state for local UI
   */
  import { onDestroy, onMount } from 'svelte';

  import { invalidateAll } from '$app/navigation';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './_lib/api';
  import {
    DEFAULT_PAGE_SIZE,
    STATUS_FILTER_OPTIONS,
    VIEW_TABS,
  } from './_lib/constants';
  import CreateModal from './_lib/CreateModal.svelte';
  import DetailModal from './_lib/DetailModal.svelte';
  import EditModal from './_lib/EditModal.svelte';
  import IncomingRequestCard from './_lib/IncomingRequestCard.svelte';
  import RequestCard from './_lib/RequestCard.svelte';
  import RespondModal from './_lib/RespondModal.svelte';
  import RevokeModal from './_lib/RevokeModal.svelte';
  import { vacationState } from './_lib/state.svelte';

  import type { PageData } from './$types';
  import type { ViewTab } from './_lib/constants';
  import type {
    CreateVacationRequestPayload,
    RespondPayload,
    VacationCapacityAnalysis,
    VacationRequest,
    VacationRequestStatus,
  } from './_lib/types';

  const log = createLogger('VacationPage');

  // ==========================================================================
  // SSR DATA (single source of truth via $derived)
  // ==========================================================================

  const { data }: { data: PageData } = $props();

  const myRequests = $derived(data.myRequests);
  const incomingRequests = $derived(data.incomingRequests);
  const balance = $derived(data.balance);
  const canApprove = $derived(data.canApprove);
  const unreadRequestIds = $derived(new Set(data.unreadRequestIds));

  // ==========================================================================
  // BALANCE HELPERS
  // ==========================================================================

  const balancePercent = $derived(
    balance !== null && balance.availableDays > 0 ?
      Math.round((balance.remainingDays / balance.availableDays) * 100)
    : 0,
  );

  const balanceColor = $derived(
    balance !== null ?
      balance.remainingDays <= 2 ? 'var(--color-danger)'
      : balance.remainingDays <= 5 ? 'var(--color-warning)'
      : 'var(--color-success)'
    : 'var(--color-muted)',
  );

  // ==========================================================================
  // LOCAL UI STATE
  // ==========================================================================

  let activeTab = $state<ViewTab>('my-requests');
  let statusFilter = $state<VacationRequestStatus | 'all'>('all');
  let yearFilter = $state(new Date().getFullYear());
  let isLoadingMore = $state(false);

  // Sync initial year from SSR data (one-shot)
  let hasInitYear = $state(false);
  $effect(() => {
    if (!hasInitYear) {
      hasInitYear = true;
      yearFilter = data.currentYear;
      yearDisplayText = String(data.currentYear);
    }
  });

  // Modal state
  let showCreateModal = $state(false);
  let showRespondModal = $state(false);
  let respondingRequest = $state<VacationRequest | null>(null);
  let respondAction = $state<'approve' | 'deny'>('approve');

  // Pre-fetched capacity for edit modal
  let editCapacity = $state<VacationCapacityAnalysis | null>(null);

  // ==========================================================================
  // SYNC SSR → STATE STORE
  // ==========================================================================

  $effect(() => {
    vacationState.setMyRequests(myRequests);
    vacationState.setIncomingRequests(incomingRequests);
    vacationState.setBalance(balance);
    vacationState.setLoading(false);
  });

  onMount(() => {
    void notificationStore.markTypeAsRead('vacation');
  });

  onDestroy(() => {
    vacationState.reset();
  });

  // ==========================================================================
  // GLOBAL KEYBOARD HANDLER
  // ==========================================================================

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showRevokeModal) {
        closeRevokeModal();
      } else if (showRespondModal) {
        closeRespondModal();
      } else if (vacationState.showEditModal) {
        vacationState.closeEditModal();
      } else if (vacationState.showDetailModal) {
        vacationState.closeDetailModal();
      } else if (showCreateModal) {
        showCreateModal = false;
      }
    }
  }

  // ==========================================================================
  // DROPDOWN STATE (same pattern as KVP page)
  // ==========================================================================

  let activeDropdown = $state<string | null>(null);
  let statusDisplayText = $state('Alle');
  let yearDisplayText = $state(String(new Date().getFullYear()));

  const currentCalendarYear = new Date().getFullYear();
  const yearOptions = $derived(
    Array.from({ length: 3 }, (_, i) => currentCalendarYear - 1 + i),
  );

  function toggleDropdown(dropdownId: string): void {
    activeDropdown = activeDropdown === dropdownId ? null : dropdownId;
  }

  function closeAllDropdowns(): void {
    activeDropdown = null;
  }

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(closeAllDropdowns);
  });

  // ==========================================================================
  // FILTER / TAB HANDLERS
  // ==========================================================================

  function handleTabChange(tab: ViewTab): void {
    activeTab = tab;
  }

  function handleStatusSelect(
    value: VacationRequestStatus | 'all',
    label: string,
  ): void {
    statusFilter = value;
    statusDisplayText = label;
    closeAllDropdowns();
    void reloadCurrentTab();
  }

  function handleYearSelect(year: number): void {
    yearFilter = year;
    yearDisplayText = String(year);
    closeAllDropdowns();
    void reloadCurrentTab();
  }

  async function reloadCurrentTab() {
    isLoadingMore = true;
    try {
      const yearParam = yearFilter;
      const statusParam = statusFilter === 'all' ? undefined : statusFilter;

      if (activeTab === 'my-requests') {
        const result = await api.getMyRequests(
          1,
          DEFAULT_PAGE_SIZE,
          yearParam,
          statusParam,
        );
        vacationState.setMyRequests(result);
      } else {
        const result = await api.getIncomingRequests(
          1,
          DEFAULT_PAGE_SIZE,
          yearParam,
          statusParam,
        );
        vacationState.setIncomingRequests(result);
      }
    } catch (err: unknown) {
      log.error({ err }, 'Error reloading data');
      showErrorAlert('Fehler beim Laden der Daten');
    } finally {
      isLoadingMore = false;
    }
  }

  // ==========================================================================
  // CREATE REQUEST
  // ==========================================================================

  async function handleCreateSubmit(payload: CreateVacationRequestPayload) {
    try {
      await api.createRequest(payload);
      showCreateModal = false;
      showSuccessAlert('Urlaubsantrag eingereicht');
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Create request failed');
      const message = err instanceof Error ? err.message : '';
      if (message.includes('blackout')) {
        showErrorAlert(
          'Antrag nicht möglich: Dieser Zeitraum liegt in einer Urlaubssperre. Bitte sprechen Sie Ihren Vorgesetzten an.',
        );
      } else if (
        message.includes('entitlement') ||
        message.includes('insufficient')
      ) {
        showErrorAlert(
          'Antrag nicht möglich: Ihr Urlaubskontingent reicht nicht aus. Bitte sprechen Sie Ihren Vorgesetzten an.',
        );
      } else {
        showErrorAlert('Fehler beim Einreichen des Antrags');
      }
    }
  }

  async function handleCapacityCheck(
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

  // ==========================================================================
  // EDIT REQUEST
  // ==========================================================================

  async function handleEditSubmit(payload: CreateVacationRequestPayload) {
    const request = vacationState.selectedRequest;
    if (request === null) return;

    try {
      await api.editRequest(request.id, payload);
      vacationState.closeEditModal();
      showSuccessAlert('Antrag aktualisiert');
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Edit request failed');
      showErrorAlert('Fehler beim Aktualisieren des Antrags');
    }
  }

  // ==========================================================================
  // REQUEST ACTIONS (own requests)
  // ==========================================================================

  function handleDetail(request: VacationRequest) {
    vacationState.openDetailModal(request);
  }

  async function handleEdit(request: VacationRequest) {
    // Start capacity fetch immediately, open modal in parallel
    const targetId = request.id;
    const capacityPromise = api.analyzeCapacity(
      request.startDate,
      request.endDate,
    );
    editCapacity = null;
    vacationState.openEditModal(request);

    try {
      const result = await capacityPromise;
      // Guard: only update if still editing the same request
      if (vacationState.selectedRequest?.id === targetId) {
        editCapacity = result;
      }
    } catch (err: unknown) {
      log.error({ err }, 'Edit capacity pre-fetch failed');
    }
  }

  async function handleWithdraw(request: VacationRequest) {
    try {
      await api.withdrawRequest(request.id);
      showSuccessAlert('Antrag zurueckgezogen');
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Withdraw failed');
      showErrorAlert('Fehler beim Zurückziehen');
    }
  }

  // ==========================================================================
  // INCOMING REQUEST ACTIONS (approve/deny)
  // ==========================================================================

  function openRespondModal(
    request: VacationRequest,
    action: 'approve' | 'deny',
  ) {
    respondingRequest = request;
    respondAction = action;
    showRespondModal = true;
  }

  async function handleRespondSubmit(payload: RespondPayload) {
    if (respondingRequest === null) return;

    try {
      await api.respondToRequest(respondingRequest.id, payload);
      closeRespondModal();
      showSuccessAlert(
        payload.action === 'approve' ? 'Antrag genehmigt' : 'Antrag abgelehnt',
      );
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Respond failed');
      showErrorAlert('Fehler bei der Bearbeitung');
    }
  }

  function closeRespondModal() {
    showRespondModal = false;
    respondingRequest = null;
  }

  // ==========================================================================
  // REVOKE (cancel approved request — approver/admin/root)
  // ==========================================================================

  let showRevokeModal = $state(false);
  let revokingRequest = $state<VacationRequest | null>(null);

  function openRevokeModal(request: VacationRequest) {
    revokingRequest = request;
    showRevokeModal = true;
  }

  function closeRevokeModal() {
    showRevokeModal = false;
    revokingRequest = null;
  }

  async function handleRevokeSubmit(reason: string) {
    if (revokingRequest === null) return;

    try {
      await api.cancelRequest(revokingRequest.id, reason);
      closeRevokeModal();
      showSuccessAlert('Antrag widerrufen — Urlaubstage wurden zurückgebucht');
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Revoke failed');
      showErrorAlert('Fehler beim Widerrufen des Antrags');
    }
  }

  // ==========================================================================
  // PAGINATION
  // ==========================================================================

  const currentList = $derived(
    activeTab === 'my-requests' ?
      vacationState.myRequests
    : vacationState.incomingRequests,
  );

  const hasMorePages = $derived(currentList.page < currentList.totalPages);

  async function loadNextPage() {
    if (!hasMorePages || isLoadingMore) return;

    const setLoading = (val: boolean) => {
      isLoadingMore = val;
    };
    setLoading(true);
    try {
      const nextPage = currentList.page + 1;
      const statusParam = statusFilter === 'all' ? undefined : statusFilter;

      if (activeTab === 'my-requests') {
        const result = await api.getMyRequests(
          nextPage,
          DEFAULT_PAGE_SIZE,
          yearFilter,
          statusParam,
        );
        vacationState.setMyRequests(result);
      } else {
        const result = await api.getIncomingRequests(
          nextPage,
          DEFAULT_PAGE_SIZE,
          yearFilter,
          statusParam,
        );
        vacationState.setIncomingRequests(result);
      }
    } catch (err: unknown) {
      log.error({ err }, 'Pagination error');
      showErrorAlert('Fehler beim Laden weiterer Eintraege');
    } finally {
      setLoading(false);
    }
  }
</script>

<svelte:head>
  <title>Urlaubsverwaltung - Assixx</title>
</svelte:head>

<svelte:window onkeydown={handleKeyDown} />

<div class="container">
  <!-- Header -->
  <div class="card mb-6">
    <div class="card__header">
      <div class="flex items-center justify-between">
        <h2 class="card__title">
          <i class="fas fa-umbrella-beach mr-2"></i>
          Urlaubsverwaltung
        </h2>
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => {
            showCreateModal = true;
          }}
        >
          <i class="fas fa-plus mr-1"></i>
          Neuer Antrag
        </button>
      </div>
    </div>
  </div>

  <!-- Balance -->
  {#if balance !== null}
    <div class="card mb-6">
      <div class="card__header">
        <h3 class="card__title">
          <i class="fas fa-chart-pie mr-2"></i>
          Mein Urlaubskonto ({balance.year})
        </h3>
      </div>
      <div class="card__body">
        <div class="balance-summary">
          <div class="balance-summary__bar">
            <div class="mb-2 flex items-center justify-between">
              <span
                class="text-muted"
                style="font-size: 0.875rem;"
              >
                {balance.remainingDays} von {balance.availableDays} Tagen verbleibend
              </span>
              <span
                style="font-size: 0.875rem; font-weight: 600; color: {balanceColor};"
              >
                {balancePercent}%
              </span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-bar__fill"
                style="width: {balancePercent}%; background: {balanceColor};"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="card mb-6">
      <div class="card__body">
        <span class="text-muted">Kein Urlaubskonto vorhanden</span>
      </div>
    </div>
  {/if}

  <!-- Filter Card (same pattern as KVP) -->
  <div class="card mb-6">
    <div class="card__header">
      <h3 class="card__title">
        <i class="fas fa-filter mr-2"></i>
        Filter & Anzeige
      </h3>
      <div class="vacation-filter-row mt-6">
        <!-- Tab Toggle -->
        <div class="form-field">
          <span class="form-field__label">Ansicht</span>
          <div class="toggle-group mt-2">
            {#each VIEW_TABS as tab (tab.value)}
              {#if tab.value !== 'incoming' || canApprove}
                <button
                  type="button"
                  class="toggle-group__btn"
                  class:active={activeTab === tab.value}
                  onclick={() => {
                    handleTabChange(tab.value);
                  }}
                >
                  {tab.label}
                </button>
              {/if}
            {/each}
          </div>
        </div>

        <!-- Status Dropdown -->
        <div class="form-field">
          <span class="form-field__label">Status</span>
          <div
            class="dropdown mt-2"
            data-dropdown="status"
          >
            <button
              type="button"
              class="dropdown__trigger"
              class:active={activeDropdown === 'status'}
              onclick={() => {
                toggleDropdown('status');
              }}
            >
              <span>{statusDisplayText}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={activeDropdown === 'status'}
            >
              {#each STATUS_FILTER_OPTIONS as option (option.value)}
                <button
                  type="button"
                  class="dropdown__option"
                  data-action="select-status"
                  data-value={option.value}
                  onclick={() => {
                    handleStatusSelect(option.value, option.label);
                  }}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>
        </div>

        <!-- Year Dropdown -->
        <div class="form-field">
          <span class="form-field__label">Jahr</span>
          <div
            class="dropdown mt-2"
            data-dropdown="year"
          >
            <button
              type="button"
              class="dropdown__trigger"
              class:active={activeDropdown === 'year'}
              onclick={() => {
                toggleDropdown('year');
              }}
            >
              <span>{yearDisplayText}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={activeDropdown === 'year'}
            >
              {#each yearOptions as year (year)}
                <button
                  type="button"
                  class="dropdown__option"
                  data-action="select-year"
                  data-value={String(year)}
                  onclick={() => {
                    handleYearSelect(year);
                  }}
                >
                  {year}
                </button>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Request List -->
  <div class="card mb-6">
    <div class="card__header">
      <h3 class="card__title">
        {#if activeTab === 'my-requests'}
          <i class="fas fa-list mr-2"></i>
          Meine Anträge
          <span class="text-muted ml-2">({vacationState.myRequests.total})</span
          >
        {:else}
          <i class="fas fa-inbox mr-2"></i>
          Eingehende Anträge
          <span class="text-muted ml-2"
            >({vacationState.incomingRequests.total})</span
          >
        {/if}
      </h3>
    </div>
    <div class="card__body">
      {#if isLoadingMore}
        <div class="spinner-container spinner-container--sm">
          <div class="spinner-ring spinner-ring--sm"></div>
        </div>
      {:else if activeTab === 'my-requests'}
        {#if vacationState.myRequests.data.length === 0}
          <div class="empty-state empty-state--in-card">
            <div class="empty-state__icon">
              <i class="fas fa-umbrella-beach"></i>
            </div>
            <h3 class="empty-state__title">Keine Urlaubsanträge vorhanden</h3>
            <p class="empty-state__description">
              Erstellen Sie Ihren ersten Urlaubsantrag.
            </p>
            <div class="empty-state__actions">
              <button
                type="button"
                class="btn btn-primary"
                onclick={() => {
                  showCreateModal = true;
                }}
              >
                <i class="fas fa-plus mr-1"></i>
                Ersten Antrag erstellen
              </button>
            </div>
          </div>
        {:else}
          <div class="request-list">
            {#each vacationState.myRequests.data as request (request.id)}
              <RequestCard
                {request}
                isNew={unreadRequestIds.has(request.id)}
                onDetail={handleDetail}
                onEdit={handleEdit}
                onWithdraw={handleWithdraw}
              />
            {/each}
          </div>
        {/if}
      {:else if vacationState.incomingRequests.data.length === 0}
        <div class="empty-state empty-state--in-card">
          <div class="empty-state__icon">
            <i class="fas fa-inbox"></i>
          </div>
          <h3 class="empty-state__title">Keine eingehenden Anträge</h3>
          <p class="empty-state__description">
            Derzeit liegen keine Urlaubsanträge zur Bearbeitung vor.
          </p>
        </div>
      {:else}
        <div class="request-list">
          {#each vacationState.incomingRequests.data as request (request.id)}
            <IncomingRequestCard
              {request}
              isNew={unreadRequestIds.has(request.id)}
              onApprove={(r: VacationRequest) => {
                openRespondModal(r, 'approve');
              }}
              onDeny={(r: VacationRequest) => {
                openRespondModal(r, 'deny');
              }}
              onDetail={handleDetail}
              onRevoke={openRevokeModal}
            />
          {/each}
        </div>
      {/if}

      <!-- Pagination -->
      {#if hasMorePages}
        <div class="vacation-load-more">
          <button
            type="button"
            class="btn btn-cancel btn"
            onclick={loadNextPage}
            disabled={isLoadingMore}
          >
            Weitere laden ({currentList.page}/{currentList.totalPages})
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showCreateModal}
  <CreateModal
    onclose={() => {
      showCreateModal = false;
    }}
    onsubmit={handleCreateSubmit}
    onCapacityCheck={handleCapacityCheck}
  />
{/if}

{#if vacationState.showDetailModal && vacationState.selectedRequest !== null}
  <DetailModal
    request={vacationState.selectedRequest}
    {canApprove}
    onclose={() => {
      vacationState.closeDetailModal();
    }}
  />
{/if}

{#if vacationState.showEditModal && vacationState.selectedRequest !== null}
  <EditModal
    request={vacationState.selectedRequest}
    initialCapacity={editCapacity}
    onclose={() => {
      vacationState.closeEditModal();
    }}
    onsubmit={handleEditSubmit}
    onCapacityCheck={handleCapacityCheck}
  />
{/if}

{#if showRespondModal && respondingRequest !== null}
  <RespondModal
    request={respondingRequest}
    action={respondAction}
    onclose={closeRespondModal}
    onsubmit={handleRespondSubmit}
  />
{/if}

{#if showRevokeModal && revokingRequest !== null}
  <RevokeModal
    request={revokingRequest}
    onclose={closeRevokeModal}
    onsubmit={handleRevokeSubmit}
  />
{/if}

<style>
  /* ─── Filter Layout ──────── */

  .vacation-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-4);
    align-items: flex-end;
  }

  .vacation-filter-row :global([data-dropdown] .dropdown__trigger) {
    width: auto;
    min-width: 200px;
  }

  .vacation-filter-row :global([data-dropdown] .dropdown__menu) {
    min-width: 180px;
    left: auto;
    right: auto;
  }

  /* ─── Request List ──────── */

  .request-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  /* ─── Load More ──────── */

  .vacation-load-more {
    display: flex;
    justify-content: center;
    padding-top: var(--spacing-4);
    border-top: 1px solid var(--color-glass-border);
    margin-top: var(--spacing-4);
  }

  /* ─── Balance Summary Card ──────── */

  .balance-summary {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .progress-bar {
    height: 8px;
    background: var(--glass-bg);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar__fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
</style>
