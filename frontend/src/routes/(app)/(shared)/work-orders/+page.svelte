<script lang="ts">
  /**
   * Work Orders — Employee View (Meine Aufträge)
   * @module shared/work-orders/+page
   *
   * Level 3 SSR: Stats cards + filter bar + data table + pagination.
   * Same layout as admin view but without admin actions (create/edit/delete/assign).
   */
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';

  import { fetchMyWorkOrders, fetchMyStats, logApiError } from './_lib/api';
  import {
    MESSAGES,
    STATUS_FILTER_OPTIONS,
    PRIORITY_FILTER_OPTIONS,
  } from './_lib/constants';
  import WorkOrderTable from './_lib/WorkOrderTable.svelte';

  import type { PageData } from './$types';
  import type {
    PaginatedResponse,
    WorkOrderListItem,
    WorkOrderStats,
  } from './_lib/types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  const permissionDenied = $derived<boolean>(data.permissionDenied);

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

  // =============================================================================
  // DERIVED
  // =============================================================================

  const workOrders = $derived(clientWorkOrders ?? data.workOrders);
  const stats = $derived(clientStats ?? data.stats);
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
      clientWorkOrders = await fetchMyWorkOrders(currentPage, 20, filters);
    } catch (err: unknown) {
      logApiError('loadWorkOrders', err);
    } finally {
      loading = false;
    }
  }

  async function refreshStats(): Promise<void> {
    try {
      clientStats = await fetchMyStats();
    } catch (err: unknown) {
      logApiError('fetchMyStats', err);
    }
  }

  function handleStatusFilterChange(value: string): void {
    statusFilter = value;
    currentPage = 1;
    void loadWorkOrders();
    void refreshStats();
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
</script>

<svelte:head>
  <title>{MESSAGES.PAGE_TITLE_EMPLOYEE}</title>
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
          {MESSAGES.HEADING_EMPLOYEE}
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
              {MESSAGES.EMPTY_DESCRIPTION_EMPLOYEE}
            </p>
          </div>
        {:else}
          <WorkOrderTable items={workOrders.items} />

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
