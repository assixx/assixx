<script lang="ts">
  /**
   * Work Orders (Admin) — Alle Aufträge
   * @module shared/work-orders/admin/+page
   *
   * Level 3 SSR: Stats cards, filter bar, data table, FAB, modals.
   * Role guard in +page.server.ts (admin/root only).
   */
  import {
    fetchWorkOrders,
    createWorkOrder,
    updateWorkOrder,
    deleteWorkOrder,
    assignUsers,
    fetchStats,
    logApiError,
  } from '../_lib/api';
  import {
    MESSAGES,
    STATUS_FILTER_OPTIONS,
    PRIORITY_FILTER_OPTIONS,
  } from '../_lib/constants';

  import AdminWorkOrderTable from './_lib/AdminWorkOrderTable.svelte';
  import AssignUserModal from './_lib/AssignUserModal.svelte';
  import EditWorkOrderModal from './_lib/EditWorkOrderModal.svelte';

  import type { PageData } from './$types';
  import type {
    CreateWorkOrderPayload,
    PaginatedResponse,
    UpdateWorkOrderPayload,
    WorkOrderListItem,
    WorkOrderStats,
  } from '../_lib/types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // =============================================================================
  // CLIENT STATE
  // =============================================================================

  let clientWorkOrders = $state<PaginatedResponse<WorkOrderListItem> | null>(
    null,
  );
  let clientStats = $state<WorkOrderStats | null>(null);
  let statusFilter = $state('');
  let priorityFilter = $state('');
  let currentPage = $state(1);
  let loading = $state(false);

  // Modal state
  let showEditModal = $state(false);
  let showAssignModal = $state(false);
  let showDeleteConfirm = $state(false);
  let editingItem = $state<WorkOrderListItem | null>(null);
  let assigningItem = $state<WorkOrderListItem | null>(null);
  let deletingItem = $state<WorkOrderListItem | null>(null);
  let submitting = $state(false);

  // =============================================================================
  // DERIVED
  // =============================================================================

  const workOrders = $derived(clientWorkOrders ?? data.workOrders);
  const stats = $derived(clientStats ?? data.stats);
  const eligibleUsers = $derived(data.eligibleUsers);
  const totalPages = $derived(
    Math.max(1, Math.ceil(workOrders.total / workOrders.pageSize)),
  );
  const hasWorkOrders = $derived(workOrders.items.length > 0);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  async function loadWorkOrders(): Promise<void> {
    loading = true;
    try {
      const filters: { status?: string; priority?: string } = {};
      if (statusFilter !== '') filters.status = statusFilter;
      if (priorityFilter !== '') filters.priority = priorityFilter;
      clientWorkOrders = await fetchWorkOrders(currentPage, 20, filters);
    } catch (err: unknown) {
      logApiError('loadWorkOrders', err);
    } finally {
      loading = false;
    }
  }

  async function refreshStats(): Promise<void> {
    try {
      clientStats = await fetchStats();
    } catch (err: unknown) {
      logApiError('fetchStats', err);
    }
  }

  async function refreshAll(): Promise<void> {
    await Promise.all([loadWorkOrders(), refreshStats()]);
  }

  function handleStatusFilterChange(value: string): void {
    statusFilter = value;
    currentPage = 1;
    void loadWorkOrders();
  }

  function handlePriorityFilterChange(value: string): void {
    priorityFilter = value;
    currentPage = 1;
    void loadWorkOrders();
  }

  function handlePageChange(page: number): void {
    currentPage = page;
    void loadWorkOrders();
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openCreateModal(): void {
    editingItem = null;
    showEditModal = true;
  }

  function openEditModal(item: WorkOrderListItem): void {
    editingItem = item;
    showEditModal = true;
  }

  function openAssignModal(item: WorkOrderListItem): void {
    assigningItem = item;
    showAssignModal = true;
  }

  function openDeleteConfirm(item: WorkOrderListItem): void {
    deletingItem = item;
    showDeleteConfirm = true;
  }

  function closeAllModals(): void {
    showEditModal = false;
    showAssignModal = false;
    showDeleteConfirm = false;
    editingItem = null;
    assigningItem = null;
    deletingItem = null;
  }

  async function handleSaveWorkOrder(
    payload: CreateWorkOrderPayload | UpdateWorkOrderPayload,
  ): Promise<void> {
    submitting = true;
    try {
      if (editingItem !== null) {
        await updateWorkOrder(
          editingItem.uuid,
          payload as UpdateWorkOrderPayload,
        );
      } else {
        await createWorkOrder(payload as CreateWorkOrderPayload);
      }
      closeAllModals();
      await refreshAll();
    } catch (err: unknown) {
      logApiError('saveWorkOrder', err);
    } finally {
      submitting = false;
    }
  }

  async function handleAssignUsers(userUuids: string[]): Promise<void> {
    if (assigningItem === null) return;
    submitting = true;
    try {
      await assignUsers(assigningItem.uuid, { userUuids });
      closeAllModals();
      await refreshAll();
    } catch (err: unknown) {
      logApiError('assignUsers', err);
    } finally {
      submitting = false;
    }
  }

  async function handleDelete(): Promise<void> {
    if (deletingItem === null) return;
    submitting = true;
    try {
      await deleteWorkOrder(deletingItem.uuid);
      closeAllModals();
      await refreshAll();
    } catch (err: unknown) {
      logApiError('deleteWorkOrder', err);
    } finally {
      submitting = false;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (showDeleteConfirm) {
      showDeleteConfirm = false;
      deletingItem = null;
    } else if (showAssignModal) {
      showAssignModal = false;
      assigningItem = null;
    } else if (showEditModal) {
      showEditModal = false;
      editingItem = null;
    }
  }
</script>

<svelte:head>
  <title>{MESSAGES.PAGE_TITLE_ADMIN}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <!-- Header -->
  <div class="card mb-6">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-clipboard-check mr-2"></i>
        {MESSAGES.HEADING_ADMIN}
      </h2>
    </div>
  </div>

  <!-- Stats Cards -->
  <div class="stats-grid mb-6">
    <div class="card-stat">
      <div class="card-stat__icon card-stat__icon--info">
        <i class="fas fa-circle"></i>
      </div>
      <div class="card-stat__content">
        <span class="card-stat__value">{stats.open}</span>
        <span class="card-stat__label">{MESSAGES.STAT_OPEN}</span>
      </div>
    </div>
    <div class="card-stat">
      <div class="card-stat__icon card-stat__icon--warning">
        <i class="fas fa-spinner"></i>
      </div>
      <div class="card-stat__content">
        <span class="card-stat__value">{stats.inProgress}</span>
        <span class="card-stat__label">{MESSAGES.STAT_IN_PROGRESS}</span>
      </div>
    </div>
    <div class="card-stat">
      <div class="card-stat__icon card-stat__icon--success">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="card-stat__content">
        <span class="card-stat__value">{stats.completed}</span>
        <span class="card-stat__label">{MESSAGES.STAT_COMPLETED}</span>
      </div>
    </div>
    <div class="card-stat">
      <div class="card-stat__icon card-stat__icon--primary">
        <i class="fas fa-shield-check"></i>
      </div>
      <div class="card-stat__content">
        <span class="card-stat__value">{stats.verified}</span>
        <span class="card-stat__label">{MESSAGES.STAT_VERIFIED}</span>
      </div>
    </div>
    <div class="card-stat">
      <div class="card-stat__icon card-stat__icon--danger">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <div class="card-stat__content">
        <span class="card-stat__value">{stats.overdue}</span>
        <span class="card-stat__label">{MESSAGES.STAT_OVERDUE}</span>
      </div>
    </div>
    <div class="card-stat">
      <div class="card-stat__icon">
        <i class="fas fa-list"></i>
      </div>
      <div class="card-stat__content">
        <span class="card-stat__value">{stats.total}</span>
        <span class="card-stat__label">{MESSAGES.STAT_TOTAL}</span>
      </div>
    </div>
  </div>

  <!-- Filter Bar + Table -->
  <div class="card">
    <div class="card__header">
      <div class="filter-bar">
        <!-- Status filter -->
        <div class="toggle-group">
          {#each STATUS_FILTER_OPTIONS as opt (opt.value)}
            <button
              type="button"
              class="toggle-group__btn"
              class:active={statusFilter === opt.value}
              onclick={() => {
                handleStatusFilterChange(opt.value);
              }}
            >
              {opt.label}
            </button>
          {/each}
        </div>

        <!-- Priority filter -->
        <div class="toggle-group">
          {#each PRIORITY_FILTER_OPTIONS as opt (opt.value)}
            <button
              type="button"
              class="toggle-group__btn"
              class:active={priorityFilter === opt.value}
              onclick={() => {
                handlePriorityFilterChange(opt.value);
              }}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if loading}
        <div class="empty-state empty-state--in-card">
          <div class="empty-state__icon">
            <i class="fas fa-spinner fa-spin"></i>
          </div>
          <p class="empty-state__description">{MESSAGES.LOADING}</p>
        </div>
      {:else if !hasWorkOrders}
        <div class="empty-state empty-state--in-card">
          <div class="empty-state__icon">
            <i class="fas fa-clipboard-check"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.EMPTY_TITLE}</h3>
          <p class="empty-state__description">
            {MESSAGES.EMPTY_DESCRIPTION_ADMIN}
          </p>
        </div>
      {:else}
        <AdminWorkOrderTable
          items={workOrders.items}
          onedit={openEditModal}
          ondelete={openDeleteConfirm}
          onassign={openAssignModal}
        />

        <!-- Pagination -->
        {#if totalPages > 1}
          <nav
            class="pagination mt-6"
            aria-label="Seitennavigation"
          >
            <button
              type="button"
              class="pagination__btn pagination__btn--prev"
              disabled={currentPage <= 1}
              onclick={() => {
                handlePageChange(currentPage - 1);
              }}
            >
              <i class="fas fa-chevron-left"></i>
              Zurück
            </button>
            <div class="pagination__pages">
              {#each Array.from({ length: totalPages }, (_: unknown, i: number) => i + 1) as page (page)}
                <button
                  type="button"
                  class="pagination__page"
                  class:pagination__page--active={page === currentPage}
                  onclick={() => {
                    handlePageChange(page);
                  }}
                >
                  {page}
                </button>
              {/each}
            </div>
            <button
              type="button"
              class="pagination__btn pagination__btn--next"
              disabled={currentPage >= totalPages}
              onclick={() => {
                handlePageChange(currentPage + 1);
              }}
            >
              Weiter
              <i class="fas fa-chevron-right"></i>
            </button>
          </nav>
          <span class="pagination__info mt-2">
            {MESSAGES.PAGINATION_SHOWING}
            {workOrders.items.length}
            {MESSAGES.PAGINATION_OF}
            {workOrders.total}
            {MESSAGES.PAGINATION_ENTRIES}
          </span>
        {/if}
      {/if}
    </div>
  </div>
</div>

<!-- FAB: Create Work Order -->
<button
  type="button"
  class="btn-float"
  aria-label={MESSAGES.BTN_CREATE}
  onclick={openCreateModal}
>
  <i class="fas fa-plus"></i>
</button>

<!-- Edit/Create Modal -->
<EditWorkOrderModal
  show={showEditModal}
  workOrder={editingItem}
  {eligibleUsers}
  {submitting}
  onclose={closeAllModals}
  onsave={handleSaveWorkOrder}
/>

<!-- Assign Users Modal -->
<AssignUserModal
  show={showAssignModal}
  workOrder={assigningItem}
  {eligibleUsers}
  {submitting}
  onclose={closeAllModals}
  onsave={handleAssignUsers}
/>

<!-- Delete Confirmation -->
{#if showDeleteConfirm && deletingItem !== null}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => {
      showDeleteConfirm = false;
      deletingItem = null;
    }}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        showDeleteConfirm = false;
        deletingItem = null;
      }
    }}
  >
    <div
      class="confirm-modal"
      role="presentation"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
    >
      <div class="confirm-modal__icon confirm-modal__icon--danger">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="confirm-modal__title">{MESSAGES.DELETE_CONFIRM_TITLE}</h3>
      <p class="confirm-modal__text">
        <strong>{deletingItem.title}</strong>
      </p>
      <p class="confirm-modal__text">{MESSAGES.DELETE_CONFIRM_TEXT}</p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            showDeleteConfirm = false;
            deletingItem = null;
          }}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          disabled={submitting}
          onclick={() => {
            void handleDelete();
          }}
        >
          {#if submitting}
            <span class="spinner-ring spinner-ring--sm mr-2"></span>
          {/if}
          {MESSAGES.BTN_DELETE}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
  }

  .filter-bar {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
</style>
