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

  import { deletePlan as apiDeletePlan, logApiError } from './_lib/api';
  import { MESSAGES } from './_lib/constants';
  import NextMaintenanceInfo from './_lib/NextMaintenanceInfo.svelte';
  import PlanOverview from './_lib/PlanOverview.svelte';
  import PlanTable from './_lib/PlanTable.svelte';
  import { tpmState } from './_lib/state.svelte';

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  import type { PageData } from './$types';
  import type { TpmPlan, PlanStatusFilter } from './_lib/types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

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
      showSuccessAlert(MESSAGES.SUCCESS_DELETED);
      tpmState.closeDeleteModal();
      await invalidateAll();
    } catch (err) {
      logApiError('confirmDelete', err);
      showErrorAlert(
        err instanceof Error ? err.message : MESSAGES.ERROR_DELETE_FAILED,
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
  <title>{MESSAGES.PAGE_TITLE}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <!-- Header Card -->
  <div class="card">
    <div class="card__header">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="card__title">
            <i class="fas fa-tools mr-2"></i>
            {MESSAGES.PAGE_HEADING}
          </h2>
          <p class="mt-2 text-(--color-text-secondary)">
            {MESSAGES.PAGE_DESCRIPTION}
          </p>
        </div>
        <a
          href={resolvePath('/lean-management/tpm/plan/new')}
          class="btn btn-primary"
        >
          <i class="fas fa-plus"></i>
          {MESSAGES.BTN_NEW_PLAN}
        </a>
      </div>
    </div>
  </div>

  <!-- Stats Cards -->
  <div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
    <div class="card-stat">
      <div class="card-stat__icon">
        <i class="fas fa-clipboard-list"></i>
      </div>
      <div class="card-stat__content">
        <div class="card-stat__value">{totalPlans}</div>
        <div class="card-stat__label">{MESSAGES.STAT_TOTAL_PLANS}</div>
      </div>
    </div>

    <div class="card-stat card-stat--success">
      <div class="card-stat__icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="card-stat__content">
        <div class="card-stat__value">{activePlanCount}</div>
        <div class="card-stat__label">{MESSAGES.STAT_ACTIVE_PLANS}</div>
      </div>
    </div>
  </div>

  <!-- Main content grid -->
  <div class="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
    <!-- Plan table (main area) -->
    <div class="min-w-0">
      <div class="card">
        <div class="card__header">
          <h2 class="card__title">{MESSAGES.STAT_TOTAL_PLANS}</h2>
        </div>
        <div class="card__body">
          <PlanOverview
            plans={allPlans}
            {totalPlans}
            currentPage={tpmState.currentPage}
            statusFilter={tpmState.statusFilter}
            searchQuery={tpmState.searchQuery}
            loading={tpmState.loading}
            ondelete={handleDeleteRequest}
            onpagechange={handlePageChange}
            onfilterchange={handleFilterChange}
            onsearch={handleSearch}
          />
        </div>
      </div>
    </div>

    <!-- Sidebar -->
    <div>
      <NextMaintenanceInfo
        plans={allPlans}
        colors={data.colors}
      />
    </div>
  </div>

  <!-- Plan Table (Machine x Interval Matrix) -->
  {#if allPlans.length > 0}
    <div class="mt-6">
      <PlanTable plans={allPlans} />
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
{#if tpmState.showDeleteModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay modal-overlay--active"
    onclick={() => {
      tpmState.closeDeleteModal();
    }}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') tpmState.closeDeleteModal();
    }}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="confirm-modal confirm-modal--danger"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
      onkeydown={(e: KeyboardEvent) => {
        e.stopPropagation();
      }}
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="confirm-modal__title">
        {MESSAGES.DELETE_CONFIRM_TITLE}
      </h3>
      <p class="confirm-modal__message">
        {MESSAGES.DELETE_CONFIRM_MESSAGE}
      </p>
      {#if tpmState.deletePlanName.length > 0}
        <p class="confirm-modal__message">
          <strong>{tpmState.deletePlanName}</strong>
        </p>
      {/if}
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={() => {
            tpmState.closeDeleteModal();
          }}
          disabled={tpmState.submitting}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={confirmDelete}
          disabled={tpmState.submitting}
        >
          {#if tpmState.submitting}
            <i class="fas fa-spinner fa-spin"></i>
          {/if}
          {MESSAGES.BTN_DELETE}
        </button>
      </div>
    </div>
  </div>
{/if}
