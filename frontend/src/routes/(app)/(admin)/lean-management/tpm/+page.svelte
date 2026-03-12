<script lang="ts">
  /**
   * TPM Admin Dashboard - Page Component
   * @module lean-management/tpm/+page
   *
   * Level 3 SSR: $derived from props, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { deletePlan as apiDeletePlan, logApiError } from './_lib/api';
  import { createTpmMessages } from './_lib/constants';
  import PlanOverview from './_lib/PlanOverview.svelte';
  import { tpmState } from './_lib/state.svelte';

  import type { PageData } from './$types';
  import type { TpmPlan, PlanStatusFilter } from './_lib/types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // Hierarchy labels from layout data inheritance (A6)
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createTpmMessages(labels));

  const allPlans = $derived(data.plans);
  const totalPlans = $derived(data.totalPlans);

  // Sync SSR data to state
  $effect(() => {
    tpmState.setPlans(allPlans);
    tpmState.setTotalPlans(totalPlans);
    tpmState.setLoading(false);
  });

  $effect(() => {
    tpmState.setColors(data.colors);
  });

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const activePlanCount = $derived(
    allPlans.filter((p: TpmPlan) => p.isActive === 1).length,
  );

  // =============================================================================
  // HANDLERS
  // =============================================================================

  function handleFilterChange(filter: PlanStatusFilter): void {
    tpmState.setStatusFilter(filter);
  }

  function handleSearch(query: string): void {
    tpmState.setSearchQuery(query);
    tpmState.setSearchOpen(query.trim().length > 0);
  }

  function handlePageChange(page: number): void {
    tpmState.setCurrentPage(page);
  }

  function handleDeleteRequest(plan: TpmPlan): void {
    tpmState.openDeleteModal(plan);
  }

  async function confirmDelete(): Promise<void> {
    const uuid = tpmState.deletePlanUuid;
    if (uuid === null) return;

    tpmState.setSubmitting(true);
    try {
      await apiDeletePlan(uuid);
      showSuccessAlert(messages.SUCCESS_DELETED);
      tpmState.closeDeleteModal();
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('confirmDelete', err);
      showErrorAlert(
        err instanceof Error ? err.message : messages.ERROR_DELETE_FAILED,
      );
    } finally {
      tpmState.setSubmitting(false);
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && tpmState.showDeleteModal) {
      tpmState.closeDeleteModal();
    }
  }
</script>

<svelte:head>
  <title>{messages.PAGE_TITLE}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <!-- Stats (2 cards side by side) -->
  <div class="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
    <div class="card-stat card-stat--sm">
      <div class="card-stat__icon">
        <i class="fas fa-clipboard-list"></i>
      </div>
      <div class="card-stat__content">
        <div class="card-stat__value">{totalPlans}</div>
        <div class="card-stat__label">{messages.STAT_TOTAL_PLANS}</div>
      </div>
    </div>

    <div class="card-stat card-stat--success card-stat--sm">
      <div class="card-stat__icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="card-stat__content">
        <div class="card-stat__value">{activePlanCount}</div>
        <div class="card-stat__label">{messages.STAT_ACTIVE_PLANS}</div>
      </div>
    </div>
  </div>

  <!-- Plan table (full width) -->
  <div class="mt-6">
    <div class="card">
      <div class="card__header">
        <div class="flex items-center justify-between gap-4">
          <h2 class="card__title">{messages.STAT_TOTAL_PLANS}</h2>
          <div class="flex gap-2">
            <a
              href={resolve('/lean-management/tpm/gesamtansicht')}
              class="btn btn-info"
            >
              <i class="fas fa-table"></i>
              {messages.BTN_GESAMTANSICHT}
            </a>
            <a
              href={resolve('/lean-management/tpm/plan/new')}
              class="btn btn-primary"
            >
              <i class="fas fa-plus"></i>
              {messages.BTN_NEW_PLAN}
            </a>
          </div>
        </div>
      </div>
      <div class="card__body">
        <PlanOverview
          {messages}
          plans={allPlans}
          {totalPlans}
          currentPage={tpmState.currentPage}
          statusFilter={tpmState.statusFilter}
          searchQuery={tpmState.searchQuery}
          loading={tpmState.loading}
          intervalMatrix={data.intervalMatrix}
          ondelete={handleDeleteRequest}
          onpagechange={handlePageChange}
          onfilterchange={handleFilterChange}
          onsearch={handleSearch}
        />
      </div>
    </div>
  </div>
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
  show={tpmState.showDeleteModal}
  id="tpm-plan-delete-modal"
  title={messages.DELETE_CONFIRM_TITLE}
  confirmLabel={messages.BTN_DELETE}
  submitting={tpmState.submitting}
  onconfirm={confirmDelete}
  oncancel={() => {
    tpmState.closeDeleteModal();
  }}
>
  {messages.DELETE_CONFIRM_MESSAGE}
  {#if tpmState.deletePlanName.length > 0}
    <br /><br />
    <strong>{tpmState.deletePlanName}</strong>
  {/if}
</ConfirmModal>
