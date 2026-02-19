<script lang="ts">
  /**
   * TPM Admin Dashboard - Page Component
   * @module lean-management/tpm/+page
   *
   * Level 3 SSR: $derived from props, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import { deletePlan as apiDeletePlan, logApiError } from './_lib/api';
  import { MESSAGES } from './_lib/constants';
  import NextMaintenanceInfo from './_lib/NextMaintenanceInfo.svelte';
  import PlanOverview from './_lib/PlanOverview.svelte';
  import { tpmState } from './_lib/state.svelte';

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

<div class="tpm-dashboard">
  <!-- Header -->
  <div class="tpm-dashboard__header">
    <div class="tpm-dashboard__title-section">
      <h1 class="tpm-dashboard__heading">
        <i class="fas fa-tools"></i>
        {MESSAGES.PAGE_HEADING}
      </h1>
      <p class="tpm-dashboard__description">{MESSAGES.PAGE_DESCRIPTION}</p>
    </div>
  </div>

  <!-- Stats Cards -->
  <div class="tpm-dashboard__stats">
    <div class="stat-card">
      <div class="stat-card__icon stat-card__icon--blue">
        <i class="fas fa-clipboard-list"></i>
      </div>
      <div class="stat-card__content">
        <span class="stat-card__value">{totalPlans}</span>
        <span class="stat-card__label">{MESSAGES.STAT_TOTAL_PLANS}</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-card__icon stat-card__icon--green">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="stat-card__content">
        <span class="stat-card__value">{activePlanCount}</span>
        <span class="stat-card__label">{MESSAGES.STAT_ACTIVE_PLANS}</span>
      </div>
    </div>
  </div>

  <!-- Main content grid -->
  <div class="tpm-dashboard__grid">
    <!-- Plan table (main area) -->
    <div class="tpm-dashboard__main">
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
    <div class="tpm-dashboard__sidebar">
      <NextMaintenanceInfo
        plans={allPlans}
        colors={data.colors}
      />
    </div>
  </div>
</div>

<!-- Delete Confirmation Modal -->
{#if tpmState.showDeleteModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={() => {
      tpmState.closeDeleteModal();
    }}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') tpmState.closeDeleteModal();
    }}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="modal"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
      onkeydown={(e: KeyboardEvent) => {
        e.stopPropagation();
      }}
    >
      <div class="modal__header">
        <h3 class="modal__title">
          <i class="fas fa-exclamation-triangle"></i>
          {MESSAGES.DELETE_CONFIRM_TITLE}
        </h3>
      </div>
      <div class="modal__body">
        <p>{MESSAGES.DELETE_CONFIRM_MESSAGE}</p>
        {#if tpmState.deletePlanName.length > 0}
          <p class="modal__plan-name">
            <strong>{tpmState.deletePlanName}</strong>
          </p>
        {/if}
      </div>
      <div class="modal__footer">
        <button
          type="button"
          class="btn btn--ghost"
          onclick={() => {
            tpmState.closeDeleteModal();
          }}
          disabled={tpmState.submitting}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn--danger"
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

<style>
  .tpm-dashboard {
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .tpm-dashboard__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .tpm-dashboard__heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-gray-900);
  }

  .tpm-dashboard__description {
    color: var(--color-gray-500);
    margin-top: 0.25rem;
    font-size: 0.875rem;
  }

  /* Stats grid */
  .tpm-dashboard__stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    padding: 1.25rem;
    box-shadow: var(--shadow-sm);
  }

  .stat-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md, 8px);
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .stat-card__icon--blue {
    background: var(--color-blue-100, #dbeafe);
    color: var(--color-blue-600, #2563eb);
  }

  .stat-card__icon--green {
    background: var(--color-green-100, #d1fae5);
    color: var(--color-green-600, #059669);
  }

  .stat-card__content {
    display: flex;
    flex-direction: column;
  }

  .stat-card__value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-gray-900);
    line-height: 1;
  }

  .stat-card__label {
    font-size: 0.75rem;
    color: var(--color-gray-500);
    margin-top: 0.25rem;
  }

  /* Main content grid */
  .tpm-dashboard__grid {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 1.5rem;
    align-items: start;
  }

  .tpm-dashboard__main {
    min-width: 0;
  }

  /* Card styles */
  .card {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .card__header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-gray-200);
  }

  .card__title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-gray-800);
  }

  .card__body {
    padding: 1.5rem;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 50%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .modal {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    width: 100%;
    max-width: 480px;
    box-shadow: var(--shadow-xl);
  }

  .modal__header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-gray-200);
  }

  .modal__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-red-600, #dc2626);
  }

  .modal__body {
    padding: 1.5rem;
  }

  .modal__plan-name {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--color-gray-50, #f9fafb);
    border-radius: var(--radius-md, 8px);
  }

  .modal__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-gray-200);
  }

  /* Responsive */
  @media (width <= 1024px) {
    .tpm-dashboard__grid {
      grid-template-columns: 1fr;
    }
  }

  @media (width <= 640px) {
    .tpm-dashboard {
      padding: 1rem;
    }

    .tpm-dashboard__stats {
      grid-template-columns: 1fr;
    }
  }
</style>
