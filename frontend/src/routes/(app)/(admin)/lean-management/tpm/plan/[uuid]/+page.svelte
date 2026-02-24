<script lang="ts">
  /**
   * TPM Plan Detail - Create/Edit Page
   * @module lean-management/tpm/plan/[uuid]/+page
   *
   * Handles both create (uuid='new') and edit mode.
   * Layout: SlotAssistant (full width top) + PlanForm (main) + EmployeeAssignment (sidebar). Edit only for assistant components.
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
  import type { CreatePlanPayload, UpdatePlanPayload } from '../../_lib/types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  const isCreateMode = $derived(data.isCreateMode);
  const pageTitle = $derived(
    isCreateMode ?
      MESSAGES.PLAN_CREATE_PAGE_TITLE
    : MESSAGES.PLAN_EDIT_PAGE_TITLE,
  );
  const heading = $derived(
    isCreateMode ? MESSAGES.PLAN_CREATE_TITLE : MESSAGES.PLAN_EDIT_TITLE,
  );

  // =============================================================================
  // STATE
  // =============================================================================

  let submitting = $state(false);

  // Create mode: track machine + shiftPlanRequired for SlotAssistant
  let createMachineUuid = $state('');
  let createShiftPlanRequired = $state(false);

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

<div class="container">
  <!-- Header -->
  <div class="mb-6">
    <div class="mb-4">
      <button
        type="button"
        class="btn btn-light"
        onclick={() => {
          void goto(resolvePath('/lean-management/tpm'));
        }}
      >
        <i class="fas fa-arrow-left mr-2"></i>{MESSAGES.BTN_BACK_TO_OVERVIEW}
      </button>
    </div>
    <h1
      class="flex items-center gap-2 text-2xl font-bold text-(--color-text-primary)"
    >
      <i class="fas fa-clipboard-list"></i>
      {heading}
    </h1>
    {#if !isCreateMode && data.plan !== null}
      <p class="mt-1 text-sm text-(--color-text-secondary)">
        {data.plan.machineName ?? '—'} — {data.plan.name}
      </p>
    {/if}
  </div>

  <!-- Slot Assistant: full width above form -->
  {#if !isCreateMode && data.plan !== null}
    <div class="mb-6">
      <SlotAssistant
        planUuid={data.plan.uuid}
        cardsHref={resolvePath(`/lean-management/tpm/cards/${data.plan.uuid}`)}
        intervalColors={data.intervalColors}
      />
    </div>
  {:else if isCreateMode && createMachineUuid.length > 0}
    <div class="mb-6">
      <SlotAssistant
        machineUuid={createMachineUuid}
        shiftPlanRequired={createShiftPlanRequired}
        intervalColors={data.intervalColors}
      />
    </div>
  {/if}

  <!-- Content grid -->
  <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_360px]">
    <!-- Main: Plan form -->
    <div class="min-w-0">
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
            areas={data.areas}
            departments={data.departments}
            machineUuidsWithPlans={data.machineUuidsWithPlans ?? []}
            {isCreateMode}
            {submitting}
            oncreate={handleCreate}
            onupdate={handleUpdate}
            oncancel={handleCancel}
            onmachinechange={(uuid: string) => {
              createMachineUuid = uuid;
            }}
            onshiftplanchange={(val: boolean) => {
              createShiftPlanRequired = val;
            }}
          />
        </div>
      </div>
    </div>

    <!-- Sidebar: Employee Assignment (edit mode only) -->
    {#if !isCreateMode && data.plan !== null}
      <EmployeeAssignment planUuid={data.plan.uuid} />
    {/if}
  </div>
</div>
