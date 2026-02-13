<script lang="ts">
  /* eslint-disable max-lines -- Page includes inline modals (create + respond), splitting would add complexity without benefit */
  /**
   * Vacation — Main Page Component
   * SSR: Data loaded in +page.server.ts
   * Svelte 5 Runes: $derived for SSR, $state for local UI
   */
  import { onDestroy } from 'svelte';

  import { invalidateAll } from '$app/navigation';

  // Vacation-specific styles (same pattern as KVP — external file, no scoping)
  import '../../../../styles/vacation.css';
  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './_lib/api';
  import CapacityIndicator from './_lib/CapacityIndicator.svelte';
  import {
    DEFAULT_PAGE_SIZE,
    HALF_DAY_LABELS,
    STATUS_BADGE_CLASS,
    STATUS_FILTER_OPTIONS,
    STATUS_LABELS,
    TYPE_LABELS,
    VIEW_TABS,
  } from './_lib/constants';
  import EntitlementBadge from './_lib/EntitlementBadge.svelte';
  import IncomingRequestCard from './_lib/IncomingRequestCard.svelte';
  import RequestCard from './_lib/RequestCard.svelte';
  import RequestForm from './_lib/RequestForm.svelte';
  import SpecialLeaveCheckbox from './_lib/SpecialLeaveCheckbox.svelte';
  import { vacationState } from './_lib/state.svelte';

  import type { PageData } from './$types';
  import type { ViewTab } from './_lib/constants';
  import type {
    CreateVacationRequestPayload,
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
  let responseNote = $state('');
  let isSpecialLeave = $state(false);

  // Form refs
  interface RequestFormRef {
    submitForm(): void;
    getCanSubmit(): boolean;
  }
  let createFormRef = $state<RequestFormRef | null>(null);
  let editFormRef = $state<RequestFormRef | null>(null);

  // Capacity for respond modal
  let respondCapacity = $state<VacationCapacityAnalysis | null>(null);
  let isLoadingCapacity = $state(false);

  // ==========================================================================
  // SYNC SSR → STATE STORE
  // ==========================================================================

  $effect(() => {
    vacationState.setMyRequests(myRequests);
    vacationState.setIncomingRequests(incomingRequests);
    vacationState.setBalance(balance);
    vacationState.setLoading(false);
  });

  onDestroy(() => {
    vacationState.reset();
  });

  // ==========================================================================
  // GLOBAL KEYBOARD HANDLER
  // ==========================================================================

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showRespondModal) {
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

  function handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      closeAllDropdowns();
    }
  }

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
    } catch (err) {
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
    } catch (err) {
      log.error({ err }, 'Create request failed');
      showErrorAlert('Fehler beim Einreichen des Antrags');
    }
  }

  async function handleCapacityCheck(
    startDate: string,
    endDate: string,
  ): Promise<VacationCapacityAnalysis | null> {
    try {
      return await api.analyzeCapacity(startDate, endDate);
    } catch (err) {
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
    } catch (err) {
      log.error({ err }, 'Edit request failed');
      showErrorAlert('Fehler beim Aktualisieren des Antrags');
    }
  }

  // ==========================================================================
  // DETAIL VIEW HELPERS
  // ==========================================================================

  /** Format ISO date to German locale display */
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** Build half-day info string for detail view */
  function getHalfDayInfo(request: VacationRequest): string {
    const parts: string[] = [];
    if (request.halfDayStart !== 'none') {
      parts.push(`Start: ${HALF_DAY_LABELS[request.halfDayStart]}`);
    }
    if (request.halfDayEnd !== 'none') {
      parts.push(`Ende: ${HALF_DAY_LABELS[request.halfDayEnd]}`);
    }
    return parts.join(' | ');
  }

  // ==========================================================================
  // REQUEST ACTIONS (own requests)
  // ==========================================================================

  function handleDetail(request: VacationRequest) {
    vacationState.openDetailModal(request);
  }

  function handleEdit(request: VacationRequest) {
    vacationState.openEditModal(request);
  }

  async function handleWithdraw(request: VacationRequest) {
    try {
      await api.withdrawRequest(request.id);
      showSuccessAlert('Antrag zurueckgezogen');
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Withdraw failed');
      showErrorAlert('Fehler beim Zurückziehen');
    }
  }

  // ==========================================================================
  // INCOMING REQUEST ACTIONS (approve/deny)
  // ==========================================================================

  async function handleApproveClick(request: VacationRequest) {
    respondingRequest = request;
    respondAction = 'approve';
    responseNote = '';
    isSpecialLeave = false;
    showRespondModal = true;

    // Load capacity for this request
    isLoadingCapacity = true;
    try {
      respondCapacity = await api.analyzeCapacity(
        request.startDate,
        request.endDate,
        request.requesterId,
      );
    } finally {
      isLoadingCapacity = false;
    }
  }

  function handleDenyClick(request: VacationRequest) {
    respondingRequest = request;
    respondAction = 'deny';
    responseNote = '';
    isSpecialLeave = false;
    respondCapacity = null;
    showRespondModal = true;
  }

  async function handleRespondSubmit() {
    const currentRequest = respondingRequest;
    if (currentRequest === null) return;

    const currentAction = respondAction;

    // Deny requires a reason
    if (currentAction === 'deny' && responseNote.trim() === '') {
      showErrorAlert('Bitte geben Sie einen Grund fuer die Ablehnung an');
      return;
    }

    const clearRespondState = () => {
      showRespondModal = false;
      respondingRequest = null;
    };

    try {
      await api.respondToRequest(currentRequest.id, {
        action: currentAction,
        responseNote:
          responseNote.trim() !== '' ? responseNote.trim() : undefined,
        isSpecialLeave:
          currentAction === 'approve' ? isSpecialLeave : undefined,
      });
      clearRespondState();
      showSuccessAlert(
        currentAction === 'approve' ? 'Antrag genehmigt' : 'Antrag abgelehnt',
      );
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Respond failed');
      showErrorAlert('Fehler bei der Bearbeitung');
    }
  }

  function closeRespondModal() {
    showRespondModal = false;
    respondingRequest = null;
    respondCapacity = null;
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
    } catch (err) {
      log.error({ err }, 'Pagination error');
      showErrorAlert('Fehler beim Laden weiterer Eintraege');
    } finally {
      setLoading(false);
    }
  }
</script>

<!-- ========================================================================
     HEAD + GLOBAL HANDLERS
     ======================================================================== -->

<svelte:head>
  <title>Urlaubsverwaltung - Assixx</title>
</svelte:head>

<svelte:window onkeydown={handleKeyDown} />
<svelte:document onclick={handleDocumentClick} />

<!-- ========================================================================
     MAIN CONTENT
     ======================================================================== -->

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
  <div class="mb-6">
    <EntitlementBadge {balance} />
  </div>

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
              onApprove={handleApproveClick}
              onDeny={handleDenyClick}
              onDetail={handleDetail}
            />
          {/each}
        </div>
      {/if}

      <!-- Pagination -->
      {#if hasMorePages}
        <div class="vacation-load-more">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
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

<!-- ========================================================================
     CREATE MODAL
     ======================================================================== -->

{#if showCreateModal}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => {
      showCreateModal = false;
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') showCreateModal = false;
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
      onsubmit={(e) => {
        e.preventDefault();
        createFormRef?.submitForm();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-umbrella-beach mr-2"></i>
          Neuer Urlaubsantrag
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={() => {
            showCreateModal = false;
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <RequestForm
          bind:this={createFormRef}
          onsubmit={handleCreateSubmit}
          onCapacityCheck={handleCapacityCheck}
        />
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            showCreateModal = false;
          }}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          class="btn btn-modal"
          disabled={!createFormRef}
        >
          <i class="fas fa-paper-plane mr-1"></i>
          Antrag einreichen
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- ========================================================================
     DETAIL MODAL (read-only view)
     ======================================================================== -->

{#if vacationState.showDetailModal && vacationState.selectedRequest !== null}
  {@const req = vacationState.selectedRequest}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => {
      vacationState.closeDetailModal();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') vacationState.closeDetailModal();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal"
      role="document"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-eye mr-2"></i>
          Antragsdetails
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={() => {
            vacationState.closeDetailModal();
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <div class="detail-grid">
          <div class="detail-grid__row">
            <span class="detail-grid__label">Status</span>
            <span class="badge {STATUS_BADGE_CLASS[req.status]}">
              {STATUS_LABELS[req.status]}
            </span>
          </div>

          <div class="detail-grid__row">
            <span class="detail-grid__label">Urlaubsart</span>
            <span>{TYPE_LABELS[req.vacationType]}</span>
          </div>

          <div class="detail-grid__row">
            <span class="detail-grid__label">Zeitraum</span>
            <span>
              {formatDate(req.startDate)} — {formatDate(req.endDate)}
            </span>
          </div>

          <div class="detail-grid__row">
            <span class="detail-grid__label">Tage</span>
            <span>
              {req.computedDays}
              {req.computedDays === 1 ? 'Tag' : 'Tage'}
            </span>
          </div>

          {#if getHalfDayInfo(req) !== ''}
            <div class="detail-grid__row">
              <span class="detail-grid__label">Halbe Tage</span>
              <span>{getHalfDayInfo(req)}</span>
            </div>
          {/if}

          {#if req.requesterName}
            <div class="detail-grid__row">
              <span class="detail-grid__label">Antragsteller</span>
              <span>{req.requesterName}</span>
            </div>
          {/if}

          {#if req.requestNote !== null}
            <div class="detail-grid__row">
              <span class="detail-grid__label">Bemerkung</span>
              <span>{req.requestNote}</span>
            </div>
          {/if}

          {#if req.responseNote !== null}
            <div class="detail-grid__row">
              <span class="detail-grid__label">Antwort</span>
              <span>{req.responseNote}</span>
            </div>
          {/if}

          {#if req.approverName}
            <div class="detail-grid__row">
              <span class="detail-grid__label">Bearbeitet von</span>
              <span>{req.approverName}</span>
            </div>
          {/if}

          {#if req.respondedAt !== null}
            <div class="detail-grid__row">
              <span class="detail-grid__label">Bearbeitet am</span>
              <span>{formatDate(req.respondedAt)}</span>
            </div>
          {/if}

          <div class="detail-grid__row">
            <span class="detail-grid__label">Erstellt am</span>
            <span>{formatDate(req.createdAt)}</span>
          </div>
        </div>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            vacationState.closeDetailModal();
          }}
        >
          Schließen
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ========================================================================
     EDIT MODAL
     ======================================================================== -->

{#if vacationState.showEditModal && vacationState.selectedRequest !== null}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => {
      vacationState.closeEditModal();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') vacationState.closeEditModal();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
      onsubmit={(e) => {
        e.preventDefault();
        editFormRef?.submitForm();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-edit mr-2"></i>
          Antrag bearbeiten
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={() => {
            vacationState.closeEditModal();
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <RequestForm
          bind:this={editFormRef}
          editingRequest={vacationState.selectedRequest}
          onsubmit={handleEditSubmit}
          onCapacityCheck={handleCapacityCheck}
        />
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            vacationState.closeEditModal();
          }}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          class="btn btn-modal"
          disabled={!editFormRef}
        >
          <i class="fas fa-save mr-1"></i>
          Änderungen speichern
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- ========================================================================
     RESPOND MODAL (Approve / Deny)
     ======================================================================== -->

{#if showRespondModal && respondingRequest !== null}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={closeRespondModal}
    onkeydown={(e) => {
      if (e.key === 'Escape') closeRespondModal();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
      onsubmit={(e) => {
        e.preventDefault();
        void handleRespondSubmit();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          {#if respondAction === 'approve'}
            <i class="fas fa-check-circle text-success mr-2"></i>
            Antrag genehmigen
          {:else}
            <i class="fas fa-times-circle text-danger mr-2"></i>
            Antrag ablehnen
          {/if}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          onclick={closeRespondModal}
          aria-label="Schließen"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <div class="respond-modal__info">
          <p>
            <strong>{respondingRequest.requesterName ?? 'Mitarbeiter'}</strong>
            — {respondingRequest.computedDays}
            {respondingRequest.computedDays === 1 ? 'Tag' : 'Tage'}
          </p>
        </div>

        <!-- Capacity (only for approve) -->
        {#if respondAction === 'approve'}
          <CapacityIndicator
            analysis={respondCapacity}
            isLoading={isLoadingCapacity}
          />

          <!-- Special leave checkbox (for special vacation types) -->
          {#if respondingRequest.vacationType.startsWith('special_')}
            <SpecialLeaveCheckbox
              checked={isSpecialLeave}
              onchange={(val: boolean) => {
                isSpecialLeave = val;
              }}
            />
          {/if}
        {/if}

        <!-- Response note -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="response-note"
          >
            {respondAction === 'deny' ?
              'Grund (Pflichtfeld)'
            : 'Bemerkung (optional)'}
          </label>
          <textarea
            id="response-note"
            class="form-field__textarea"
            rows="3"
            bind:value={responseNote}
            placeholder={respondAction === 'deny' ?
              'Bitte geben Sie den Grund fuer die Ablehnung an...'
            : 'Optionale Bemerkung...'}
          ></textarea>
        </div>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={closeRespondModal}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          class={respondAction === 'approve' ? 'btn btn-modal' : (
            'btn btn-danger'
          )}
        >
          {respondAction === 'approve' ? 'Genehmigen' : 'Ablehnen'}
        </button>
      </div>
    </form>
  </div>
{/if}
