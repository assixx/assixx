<script lang="ts">
  /**
   * TPM Plan Detail - Create/Edit Page
   * @module lean-management/tpm/plan/[uuid]/+page
   *
   * Handles both create (uuid='new') and edit mode.
   * Main content: PlanForm. Sidebar: SlotAssistant + EmployeeAssignment (edit only).
   */
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import {
    createPlan as apiCreatePlan,
    updatePlan as apiUpdatePlan,
    logApiError,
  } from '../../_lib/api';
  import { MESSAGES } from '../../_lib/constants';

  import EmployeeAssignment from './_lib/EmployeeAssignment.svelte';
  import PlanForm from './_lib/PlanForm.svelte';
  import SlotAssistant from './_lib/SlotAssistant.svelte';

  import type { PageData } from './$types';
  import type {
    CreatePlanPayload,
    UpdatePlanPayload,
  } from '../../_lib/types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  const isCreateMode = $derived(data.isCreateMode);
  const pageTitle = $derived(
    isCreateMode ? MESSAGES.PLAN_CREATE_PAGE_TITLE : MESSAGES.PLAN_EDIT_PAGE_TITLE,
  );
  const heading = $derived(
    isCreateMode ? MESSAGES.PLAN_CREATE_TITLE : MESSAGES.PLAN_EDIT_TITLE,
  );

  // =============================================================================
  // STATE
  // =============================================================================

  let submitting = $state(false);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  async function handleCreate(payload: CreatePlanPayload): Promise<void> {
    submitting = true;
    try {
      const plan = await apiCreatePlan(payload);
      showSuccessAlert(MESSAGES.SUCCESS_PLAN_CREATED);
      await goto(resolvePath(`/lean-management/tpm/plan/${plan.uuid}`));
    } catch (err: unknown) {
      logApiError('handleCreate', err);
      const msg =
        err instanceof Error ? err.message : MESSAGES.ERROR_PLAN_CREATE;
      showErrorAlert(msg);
    } finally {
      submitting = false;
    }
  }

  async function handleUpdate(payload: UpdatePlanPayload): Promise<void> {
    if (data.plan === null) return;
    submitting = true;
    try {
      await apiUpdatePlan(data.plan.uuid, payload);
      showSuccessAlert(MESSAGES.SUCCESS_PLAN_UPDATED);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('handleUpdate', err);
      const msg =
        err instanceof Error ? err.message : MESSAGES.ERROR_PLAN_UPDATE;
      showErrorAlert(msg);
    } finally {
      submitting = false;
    }
  }

  function handleCancel(): void {
    void goto(resolvePath('/lean-management/tpm'));
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<div class="plan-detail">
  <!-- Header -->
  <div class="plan-detail__header">
    <a
      href={resolvePath('/lean-management/tpm')}
      class="plan-detail__back"
    >
      <i class="fas fa-arrow-left"></i>
      {MESSAGES.BTN_BACK_TO_OVERVIEW}
    </a>
    <h1 class="plan-detail__heading">
      <i class="fas fa-clipboard-list"></i>
      {heading}
    </h1>
    {#if !isCreateMode && data.plan !== null}
      <p class="plan-detail__subtitle">
        {data.plan.machineName ?? '—'} — {data.plan.name}
      </p>
    {/if}
  </div>

  <!-- Content grid -->
  <div class="plan-detail__grid">
    <!-- Main: Plan form -->
    <div class="plan-detail__main">
      <div class="card">
        <div class="card__header">
          <h2 class="card__title">
            {isCreateMode ? 'Plandetails' : 'Plan bearbeiten'}
          </h2>
        </div>
        <div class="card__body">
          <PlanForm
            plan={data.plan}
            machines={data.machines}
            {isCreateMode}
            {submitting}
            oncreate={handleCreate}
            onupdate={handleUpdate}
            oncancel={handleCancel}
          />
        </div>
      </div>
    </div>

    <!-- Sidebar: Slot Assistant + Employee Assignment (edit mode only) -->
    {#if !isCreateMode && data.plan !== null}
      <div class="plan-detail__sidebar">
        <SlotAssistant planUuid={data.plan.uuid} />
        <EmployeeAssignment planUuid={data.plan.uuid} />
      </div>
    {/if}
  </div>
</div>

<style>
  .plan-detail {
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .plan-detail__header {
    margin-bottom: 1.5rem;
  }

  .plan-detail__back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-gray-500);
    text-decoration: none;
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
    transition: color 0.15s;
  }

  .plan-detail__back:hover {
    color: var(--color-blue-600);
  }

  .plan-detail__heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-gray-900);
  }

  .plan-detail__subtitle {
    color: var(--color-gray-500);
    margin-top: 0.25rem;
    font-size: 0.875rem;
  }

  .plan-detail__grid {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: 1.5rem;
    align-items: start;
  }

  .plan-detail__main {
    min-width: 0;
  }

  .plan-detail__sidebar {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Card (reusable) */
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

  /* Responsive: stack on narrow screens */
  @media (width <= 1024px) {
    .plan-detail__grid {
      grid-template-columns: 1fr;
    }
  }

  @media (width <= 640px) {
    .plan-detail {
      padding: 1rem;
    }
  }
</style>
