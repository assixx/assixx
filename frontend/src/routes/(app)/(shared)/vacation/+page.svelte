<script lang="ts">
  /**
   * Vacation — Main Page Component
   * SSR: Data loaded in +page.server.ts
   * Svelte 5 Runes: $derived for SSR, $state for local UI
   * Handlers: extracted to _lib/actions.svelte.ts
   */
  import { onDestroy, onMount } from 'svelte';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { notificationStore } from '$lib/stores/notification.store.svelte';

  import { createVacationActions } from './_lib/actions.svelte';
  import { STATUS_FILTER_OPTIONS, VIEW_TABS } from './_lib/constants';
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
  import type { VacationRequest, VacationRequestStatus } from './_lib/types';

  // ==========================================================================
  // SSR DATA (single source of truth via $derived)
  // ==========================================================================

  const { data }: { data: PageData } = $props();

  const permissionDenied = $derived(data.permissionDenied);
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

  // Sync initial year from SSR data (one-shot)
  let hasInitYear = $state(false);
  $effect(() => {
    if (!hasInitYear) {
      hasInitYear = true;
      yearFilter = data.currentYear;
      yearDisplayText = String(data.currentYear);
    }
  });

  // ==========================================================================
  // ACTIONS MODULE
  // ==========================================================================

  const actions = createVacationActions({
    getActiveTab: () => activeTab,
    getStatusFilter: () => statusFilter,
    getYearFilter: () => yearFilter,
  });

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
  // DROPDOWN STATE (same pattern as KVP page)
  // ==========================================================================

  let activeDropdown = $state<string | null>(null);
  let statusDisplayText = $state('Alle');
  let yearDisplayText = $state(String(new Date().getFullYear()));

  const currentCalendarYear = new Date().getFullYear();
  const yearOptions = $derived(Array.from({ length: 3 }, (_, i) => currentCalendarYear - 1 + i));

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

  function handleStatusSelect(value: VacationRequestStatus | 'all', label: string): void {
    statusFilter = value;
    statusDisplayText = label;
    closeAllDropdowns();
    void actions.reloadCurrentTab();
  }

  function handleYearSelect(year: number): void {
    yearFilter = year;
    yearDisplayText = String(year);
    closeAllDropdowns();
    void actions.reloadCurrentTab();
  }
</script>

<svelte:head>
  <title>Urlaubsverwaltung - Assixx</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="die Urlaubsverwaltung" />
{:else}
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
            onclick={actions.openCreateModal}
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
                <span style="font-size: 0.875rem; font-weight: 600; color: {balanceColor};">
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
            <span class="text-muted ml-2">({vacationState.myRequests.total})</span>
          {:else}
            <i class="fas fa-inbox mr-2"></i>
            Eingehende Anträge
            <span class="text-muted ml-2">({vacationState.incomingRequests.total})</span>
          {/if}
        </h3>
      </div>
      <div class="card__body">
        {#if actions.isLoadingMore}
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
              <p class="empty-state__description">Erstellen Sie Ihren ersten Urlaubsantrag.</p>
              <div class="empty-state__actions">
                <button
                  type="button"
                  class="btn btn-primary"
                  onclick={actions.openCreateModal}
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
                  onDetail={actions.handleDetail}
                  onEdit={actions.handleEdit}
                  onWithdraw={actions.handleWithdraw}
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
                  actions.openRespondModal(r, 'approve');
                }}
                onDeny={(r: VacationRequest) => {
                  actions.openRespondModal(r, 'deny');
                }}
                onDetail={actions.handleDetail}
                onRevoke={actions.openRevokeModal}
              />
            {/each}
          </div>
        {/if}

        <!-- Pagination -->
        {#if actions.hasMorePages}
          <div class="vacation-load-more">
            <button
              type="button"
              class="btn btn-cancel btn"
              onclick={() => {
                void actions.loadNextPage();
              }}
              disabled={actions.isLoadingMore}
            >
              Weitere laden ({actions.currentList.page}/{actions.currentList.totalPages})
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if actions.showCreateModal}
    <CreateModal
      onclose={actions.closeCreateModal}
      onsubmit={actions.handleCreateSubmit}
      onCapacityCheck={actions.handleCapacityCheck}
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
      initialCapacity={actions.editCapacity}
      onclose={() => {
        vacationState.closeEditModal();
      }}
      onsubmit={actions.handleEditSubmit}
      onCapacityCheck={actions.handleCapacityCheck}
    />
  {/if}

  {#if actions.showRespondModal && actions.respondingRequest !== null}
    <RespondModal
      request={actions.respondingRequest}
      action={actions.respondAction}
      onclose={actions.closeRespondModal}
      onsubmit={actions.handleRespondSubmit}
    />
  {/if}

  {#if actions.showRevokeModal && actions.revokingRequest !== null}
    <RevokeModal
      request={actions.revokingRequest}
      onclose={actions.closeRevokeModal}
      onsubmit={actions.handleRevokeSubmit}
    />
  {/if}
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
