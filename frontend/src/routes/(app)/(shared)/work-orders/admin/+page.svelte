<script lang="ts">
  /**
   * Work Orders (Admin) — Alle Aufträge
   * @module shared/work-orders/admin/+page
   *
   * Level 3 SSR: Stats cards, filter bar, data table, FAB, modals.
   * Role guard in +page.server.ts (admin/root only).
   */
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import {
    fetchWorkOrders,
    createWorkOrder,
    updateWorkOrder,
    archiveWorkOrder,
    restoreWorkOrder,
    assignUsers,
    fetchStats,
    uploadPhoto,
    logApiError,
  } from '../_lib/api';
  import { MESSAGES, STATUS_FILTER_OPTIONS, PRIORITY_FILTER_OPTIONS } from '../_lib/constants';

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

  const permissionDenied = $derived(data.permissionDenied);

  // =============================================================================
  // CLIENT STATE
  // =============================================================================

  let clientWorkOrders = $state<PaginatedResponse<WorkOrderListItem> | null>(null);
  let clientStats = $state<WorkOrderStats | null>(null);
  let statusFilter = $state('');
  let priorityFilter = $state('');
  let isActiveFilter = $state('active');
  let overdueFilter = $state(false);
  let currentPage = $state(1);
  let loading = $state(false);

  // Modal state
  let showEditModal = $state(false);
  let showAssignModal = $state(false);
  let showArchiveConfirm = $state(false);
  let editingItem = $state<WorkOrderListItem | null>(null);
  let assigningItem = $state<WorkOrderListItem | null>(null);
  let archivingItem = $state<WorkOrderListItem | null>(null);
  let submitting = $state(false);
  let pendingFiles = $state<File[] | null>(null);

  // =============================================================================
  // DERIVED
  // =============================================================================

  const workOrders = $derived(clientWorkOrders ?? data.workOrders);
  const stats = $derived(clientStats ?? data.stats);
  const eligibleUsers = $derived(data.eligibleUsers);
  const totalPages = $derived(Math.max(1, Math.ceil(workOrders.total / workOrders.pageSize)));
  const hasWorkOrders = $derived(workOrders.items.length > 0);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  async function loadWorkOrders(): Promise<void> {
    loading = true;
    try {
      const filters: {
        status?: string;
        priority?: string;
        isActive?: string;
        overdue?: string;
      } = {};
      if (statusFilter !== '') filters.status = statusFilter;
      if (priorityFilter !== '') filters.priority = priorityFilter;
      if (isActiveFilter !== 'active') filters.isActive = isActiveFilter;
      if (overdueFilter) filters.overdue = 'true';
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

  function handleOverdueFilterToggle(): void {
    overdueFilter = !overdueFilter;
    currentPage = 1;
    void loadWorkOrders();
  }

  function handleIsActiveFilterChange(value: string): void {
    isActiveFilter = value;
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

  function openArchiveConfirm(item: WorkOrderListItem): void {
    archivingItem = item;
    showArchiveConfirm = true;
  }

  function closeAllModals(): void {
    showEditModal = false;
    showAssignModal = false;
    showArchiveConfirm = false;
    editingItem = null;
    assigningItem = null;
    archivingItem = null;
    pendingFiles = null;
  }

  async function uploadPendingFiles(woUuid: string): Promise<void> {
    if (pendingFiles === null || pendingFiles.length === 0) return;

    for (const file of pendingFiles) {
      try {
        await uploadPhoto(woUuid, file);
      } catch (err: unknown) {
        logApiError('uploadPhoto', err);
        showErrorAlert(`Fehler beim Hochladen von ${file.name}`);
      }
    }
  }

  async function handleSaveWorkOrder(
    payload: CreateWorkOrderPayload | UpdateWorkOrderPayload,
  ): Promise<void> {
    submitting = true;
    try {
      let woUuid: string;

      if (editingItem !== null) {
        await updateWorkOrder(editingItem.uuid, payload as UpdateWorkOrderPayload);
        woUuid = editingItem.uuid;
        showSuccessAlert(MESSAGES.SUCCESS_UPDATED);
      } else {
        const created = await createWorkOrder(payload as CreateWorkOrderPayload);
        woUuid = created.uuid;
        showSuccessAlert(MESSAGES.SUCCESS_CREATED);
      }

      await uploadPendingFiles(woUuid);
      closeAllModals();
      await refreshAll();
    } catch (err: unknown) {
      logApiError('saveWorkOrder', err);
      showErrorAlert(editingItem !== null ? MESSAGES.ERROR_UPDATE : MESSAGES.ERROR_CREATE);
    } finally {
      submitting = false;
    }
  }

  async function handleAssignUsers(userUuids: string[]): Promise<void> {
    if (assigningItem === null) return;
    submitting = true;
    try {
      await assignUsers(assigningItem.uuid, { userUuids });
      showSuccessAlert(MESSAGES.ASSIGNEES_SUCCESS_ADD);
      closeAllModals();
      await refreshAll();
    } catch (err: unknown) {
      logApiError('assignUsers', err);
      showErrorAlert(MESSAGES.ASSIGNEES_ERROR_ADD);
    } finally {
      submitting = false;
    }
  }

  async function handleArchive(): Promise<void> {
    if (archivingItem === null) return;
    submitting = true;
    try {
      await archiveWorkOrder(archivingItem.uuid);
      showSuccessAlert(MESSAGES.ARCHIVE_SUCCESS);
      closeAllModals();
      await refreshAll();
    } catch (err: unknown) {
      logApiError('archiveWorkOrder', err);
      showErrorAlert(MESSAGES.ARCHIVE_ERROR);
    } finally {
      submitting = false;
    }
  }

  async function handleRestore(item: WorkOrderListItem): Promise<void> {
    submitting = true;
    try {
      await restoreWorkOrder(item.uuid);
      showSuccessAlert(MESSAGES.RESTORE_SUCCESS);
      await refreshAll();
    } catch (err: unknown) {
      logApiError('restoreWorkOrder', err);
      showErrorAlert(MESSAGES.RESTORE_ERROR);
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>{MESSAGES.PAGE_TITLE_ADMIN}</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="die Arbeitsaufträge" />
{:else}
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
      <div class="card-stat card-stat--sm">
        <div class="card-stat__icon"><i class="fas fa-circle"></i></div>
        <span class="card-stat__value">{stats.open}</span>
        <span class="card-stat__label">{MESSAGES.STAT_OPEN}</span>
      </div>
      <div class="card-stat card-stat--sm">
        <div class="card-stat__icon"><i class="fas fa-spinner"></i></div>
        <span class="card-stat__value">{stats.inProgress}</span>
        <span class="card-stat__label">{MESSAGES.STAT_IN_PROGRESS}</span>
      </div>
      <div class="card-stat card-stat--sm">
        <div class="card-stat__icon"><i class="fas fa-check-circle"></i></div>
        <span class="card-stat__value">{stats.completed}</span>
        <span class="card-stat__label">{MESSAGES.STAT_COMPLETED}</span>
      </div>
      <div class="card-stat card-stat--sm">
        <div class="card-stat__icon"><i class="fas fa-check-double"></i></div>
        <span class="card-stat__value">{stats.verified}</span>
        <span class="card-stat__label">{MESSAGES.STAT_VERIFIED}</span>
      </div>
      <div class="card-stat card-stat--sm">
        <div class="card-stat__icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <span class="card-stat__value">{stats.overdue}</span>
        <span class="card-stat__label">{MESSAGES.STAT_OVERDUE}</span>
      </div>
      <div class="card-stat card-stat--sm">
        <div class="card-stat__icon"><i class="fas fa-list"></i></div>
        <span class="card-stat__value">{stats.total}</span>
        <span class="card-stat__label">{MESSAGES.STAT_TOTAL}</span>
      </div>
    </div>

    <!-- Filter Bar + Table -->
    <div class="card">
      <div class="card__header">
        <div class="filter-bar">
          <!-- Is-Active toggle (Aktive / Archiviert / Alle) -->
          <div class="toggle-group">
            <button
              type="button"
              class="toggle-group__btn"
              class:active={isActiveFilter === 'active'}
              onclick={() => {
                handleIsActiveFilterChange('active');
              }}
            >
              <i class="fas fa-clipboard-check"></i>
              {MESSAGES.FILTER_ACTIVE}
            </button>
            <button
              type="button"
              class="toggle-group__btn"
              class:active={isActiveFilter === 'archived'}
              onclick={() => {
                handleIsActiveFilterChange('archived');
              }}
            >
              <i class="fas fa-archive"></i>
              {MESSAGES.FILTER_ARCHIVED}
            </button>
            <button
              type="button"
              class="toggle-group__btn"
              class:active={isActiveFilter === 'all'}
              onclick={() => {
                handleIsActiveFilterChange('all');
              }}
            >
              <i class="fas fa-list"></i>
              {MESSAGES.FILTER_ALL}
            </button>
          </div>

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

          <!-- Overdue toggle (cross-cutting filter) -->
          <div class="toggle-group">
            <button
              type="button"
              class="toggle-group__btn"
              class:active={overdueFilter}
              onclick={handleOverdueFilterToggle}
              aria-pressed={overdueFilter}
            >
              <i class="fas fa-exclamation-triangle"></i>
              {MESSAGES.STAT_OVERDUE}
            </button>
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
            onarchive={openArchiveConfirm}
            onrestore={handleRestore}
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
    attachmentFiles={pendingFiles}
    onclose={closeAllModals}
    onsave={handleSaveWorkOrder}
    onfileschange={(files: File[] | null) => {
      pendingFiles = files;
    }}
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

  <!-- Archive Confirmation -->
  <ConfirmModal
    show={showArchiveConfirm && archivingItem !== null}
    id="work-order-archive-confirm-modal"
    title={MESSAGES.ARCHIVE_CONFIRM_TITLE}
    variant="warning"
    icon="fa-archive"
    confirmLabel={MESSAGES.BTN_ARCHIVE}
    {submitting}
    onconfirm={() => void handleArchive()}
    oncancel={() => {
      showArchiveConfirm = false;
      archivingItem = null;
    }}
  >
    {#if archivingItem !== null}
      <strong>{archivingItem.title}</strong><br />
    {/if}
    {MESSAGES.ARCHIVE_CONFIRM_TEXT}
  </ConfirmModal>
{/if}

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.75rem;
  }

  @media (width <= 768px) {
    .stats-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (width <= 480px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .filter-bar {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
</style>
