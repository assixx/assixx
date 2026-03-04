<script lang="ts">
  /**
   * Work Orders — Employee View (Meine Aufträge)
   * @module shared/work-orders/+page
   *
   * Level 3 SSR: Shows employee's assigned work orders with filtering
   * and pagination. Filter bar + work order cards + pagination.
   */
  import { fetchMyWorkOrders, logApiError } from './_lib/api';
  import { MESSAGES } from './_lib/constants';
  import WorkOrderCard from './_lib/WorkOrderCard.svelte';
  import WorkOrderFilters from './_lib/WorkOrderFilters.svelte';

  import type { PageData } from './$types';
  import type { PaginatedResponse, WorkOrderListItem } from './_lib/types';

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
  let statusFilter = $state('');
  let priorityFilter = $state('');
  let currentPage = $state(1);
  let loading = $state(false);

  // =============================================================================
  // DERIVED
  // =============================================================================

  /** SSR data as fallback, client-fetched data takes priority */
  const workOrders = $derived(clientWorkOrders ?? data.workOrders);
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

  function handleStatusChange(value: string): void {
    statusFilter = value;
    currentPage = 1;
    void loadWorkOrders();
  }

  function handlePriorityChange(value: string): void {
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

<div class="container">
  <!-- Header -->
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-clipboard-check mr-2"></i>
        {MESSAGES.HEADING_EMPLOYEE}
      </h2>
    </div>
  </div>

  <!-- Filter Bar + Work Orders List -->
  <div class="mt-6">
    <div class="card">
      <div class="card__header">
        <WorkOrderFilters
          {statusFilter}
          {priorityFilter}
          onstatuschange={handleStatusChange}
          onprioritychange={handlePriorityChange}
        />
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
          <div class="work-order-list">
            {#each workOrders.items as item (item.uuid)}
              <WorkOrderCard workOrder={item} />
            {/each}
          </div>

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
</div>

<style>
  .work-order-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
