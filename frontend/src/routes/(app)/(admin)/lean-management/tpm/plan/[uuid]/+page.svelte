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

  import { showSuccessAlert, showErrorAlert, showConfirm } from '$lib/utils';

  import {
    createPlan as apiCreatePlan,
    updatePlan as apiUpdatePlan,
    setTimeEstimate as apiSetTimeEstimate,
    archivePlan as apiArchivePlan,
    unarchivePlan as apiUnarchivePlan,
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
    CreateTimeEstimatePayload,
    ProjectedSlot,
    TpmPlanAssignment,
  } from '../../_lib/types';

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

  const isArchived = $derived(data.plan !== null && data.plan.isActive === 3);
  let submitting = $state(false);

  // Create mode: track asset + shiftPlanRequired for SlotAssistant
  let createAssetUuid = $state('');
  let createShiftPlanRequired = $state(false);

  // Schedule preview: track weekday + repeat for SlotAssistant grid preview
  let previewWeekday = $state<number | undefined>(undefined);
  let previewRepeatEvery = $state<number | undefined>(undefined);

  // SlotAssistant data for EmployeeAssignment counts
  let projectionSlots = $state<ProjectedSlot[]>([]);
  let planAssignments = $state<TpmPlanAssignment[]>([]);

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

  async function handleUpdate(
    payload: UpdatePlanPayload,
    estimates: CreateTimeEstimatePayload[],
  ): Promise<void> {
    if (data.plan === null) return;
    submitting = true;
    try {
      await apiUpdatePlan(data.plan.uuid, payload);

      // Save time estimates (non-blocking per estimate)
      for (const est of estimates) {
        try {
          await apiSetTimeEstimate(data.plan.uuid, est);
        } catch (err: unknown) {
          logApiError('setTimeEstimate', err);
        }
      }

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

  async function handleArchive(): Promise<void> {
    if (data.plan === null) return;
    const confirmed = await showConfirm(MESSAGES.ARCHIVE_CONFIRM);
    if (!confirmed) return;
    const success = await apiArchivePlan(data.plan.uuid);
    if (success) {
      showSuccessAlert(MESSAGES.SUCCESS_ARCHIVED);
      await goto(resolvePath('/lean-management/tpm'));
    } else {
      showErrorAlert(MESSAGES.ERROR_ARCHIVE);
    }
  }

  async function handleRestore(): Promise<void> {
    if (data.plan === null) return;
    const confirmed = await showConfirm(MESSAGES.RESTORE_CONFIRM);
    if (!confirmed) return;
    const success = await apiUnarchivePlan(data.plan.uuid);
    if (success) {
      showSuccessAlert(MESSAGES.SUCCESS_RESTORED);
      await invalidateAll();
    } else {
      showErrorAlert(MESSAGES.ERROR_RESTORE);
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
        {data.plan.assetName ?? '—'} — {data.plan.name}
      </p>
    {/if}
  </div>

  <!-- Slot Assistant: full width above form (hidden for archived plans) -->
  {#if !isCreateMode && data.plan !== null && !isArchived}
    <div class="mb-6">
      <SlotAssistant
        planUuid={data.plan.uuid}
        cardsHref={resolvePath(`/lean-management/tpm/cards/${data.plan.uuid}`)}
        intervalColors={data.intervalColors}
        {previewWeekday}
        {previewRepeatEvery}
        ondataload={(slots: ProjectedSlot[], assigns: TpmPlanAssignment[]) => {
          projectionSlots = slots;
          planAssignments = assigns;
        }}
      />
    </div>
  {:else if isCreateMode && createAssetUuid.length > 0}
    <div class="mb-6">
      <SlotAssistant
        assetUuid={createAssetUuid}
        shiftPlanRequired={createShiftPlanRequired}
        intervalColors={data.intervalColors}
        {previewWeekday}
        {previewRepeatEvery}
      />
    </div>
  {/if}

  <!-- Team-Verfügbarkeit: full width directly below SlotAssistant (edit mode, not archived) -->
  {#if !isCreateMode && data.plan !== null && !isArchived}
    <div class="mb-6">
      <EmployeeAssignment
        planUuid={data.plan.uuid}
        {projectionSlots}
        {planAssignments}
      />
    </div>
  {/if}

  <!-- Content grid: Plan form + Actions -->
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
            assets={data.assets}
            areas={data.areas}
            departments={data.departments}
            assetUuidsWithPlans={data.assetUuidsWithPlans ?? []}
            timeEstimates={data.timeEstimates}
            {isCreateMode}
            submitting={submitting || isArchived}
            oncreate={handleCreate}
            onupdate={handleUpdate}
            oncancel={handleCancel}
            onassetchange={(uuid: string) => {
              createAssetUuid = uuid;
            }}
            onshiftplanchange={(val: boolean) => {
              createShiftPlanRequired = val;
            }}
            onschedulepreview={(
              weekday: number | undefined,
              repeatEvery: number | undefined,
            ) => {
              previewWeekday = weekday;
              previewRepeatEvery = repeatEvery;
            }}
          />
        </div>
      </div>
    </div>

    <!-- Sidebar: Actions (edit mode only) -->
    {#if !isCreateMode && data.plan !== null}
      <div class="flex flex-col gap-6">
        <!-- Archive / Restore Actions -->
        {#if isArchived}
          <div class="card">
            <div class="card__body p-4 text-center">
              <i class="fas fa-archive mb-2 text-3xl text-(--color-warning)"
              ></i>
              <p class="mb-4 text-(--color-text-secondary)">
                {MESSAGES.ARCHIVED_NOTICE}
              </p>
              <button
                type="button"
                class="btn btn-light"
                onclick={handleRestore}
              >
                <i class="fas fa-undo mr-2"></i>{MESSAGES.BTN_RESTORE}
              </button>
            </div>
          </div>
        {:else}
          <div class="card">
            <div class="card__header">
              <h2 class="card__title">
                <i class="fas fa-cog"></i> Aktionen
              </h2>
            </div>
            <div class="card__body">
              <button
                type="button"
                class="btn btn-light w-full"
                onclick={handleArchive}
              >
                <i class="fas fa-archive mr-2"></i>{MESSAGES.BTN_ARCHIVE}
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
