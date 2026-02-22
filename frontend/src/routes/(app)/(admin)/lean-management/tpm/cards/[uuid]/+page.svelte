<script lang="ts">
  /**
   * TPM Card Management Page
   * @module lean-management/tpm/cards/[uuid]/+page
   *
   * The [uuid] param is the plan UUID.
   * Shows card list for the plan with inline create/edit form.
   * Handles: CRUD, duplicate check, delete confirmation.
   */
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import {
    createCard as apiCreateCard,
    updateCard as apiUpdateCard,
    deleteCard as apiDeleteCard,
    checkDuplicate as apiCheckDuplicate,
    setTimeEstimate as apiSetTimeEstimate,
    logApiError,
  } from '../../_lib/api';
  import { MESSAGES } from '../../_lib/constants';

  import CardForm from './_lib/CardForm.svelte';
  import CardList from './_lib/CardList.svelte';
  import DuplicateWarning from './_lib/DuplicateWarning.svelte';

  import type { PageData } from './$types';
  import type {
    TpmCard,
    CreateCardPayload,
    UpdateCardPayload,
    TimeEstimateInput,
  } from '../../_lib/types';

  // ===========================================================================
  // SSR DATA
  // ===========================================================================

  const { data }: { data: PageData } = $props();

  // ===========================================================================
  // STATE
  // ===========================================================================

  let showForm = $state(false);
  let editingCard = $state<TpmCard | null>(null);
  let submitting = $state(false);

  // Delete confirmation
  let showDeleteModal = $state(false);
  let deleteTarget = $state<TpmCard | null>(null);

  // Duplicate warning
  let showDuplicateWarning = $state(false);
  let duplicateCards = $state<TpmCard[]>([]);
  let pendingPayload = $state<CreateCardPayload | null>(null);

  // ===========================================================================
  // DERIVED
  // ===========================================================================

  const isCreateMode = $derived(editingCard === null);
  const formHeading = $derived(
    isCreateMode ? MESSAGES.CARD_CREATE_TITLE : MESSAGES.CARD_EDIT_TITLE,
  );

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  function openCreateForm(): void {
    editingCard = null;
    showForm = true;
  }

  function openEditForm(card: TpmCard): void {
    editingCard = card;
    showForm = true;
  }

  function closeForm(): void {
    showForm = false;
    editingCard = null;
  }

  // ===========================================================================
  // CARD CRUD
  // ===========================================================================

  /** Pending time estimate to save after card creation (survives duplicate check) */
  let pendingTimeEstimate = $state<TimeEstimateInput | undefined>(undefined);

  async function handleCreate(
    payload: CreateCardPayload,
    timeEstimate?: TimeEstimateInput,
  ): Promise<void> {
    pendingTimeEstimate = timeEstimate;

    // Run duplicate check first
    try {
      const result = await apiCheckDuplicate({
        planUuid: payload.planUuid,
        title: payload.title,
        intervalType: payload.intervalType,
      });

      if (result.hasDuplicate) {
        duplicateCards = result.existingCards;
        pendingPayload = payload;
        showDuplicateWarning = true;
        return;
      }
    } catch (err: unknown) {
      // Duplicate check failure is non-blocking — proceed with create
      logApiError('checkDuplicate', err);
    }

    await executeCreate(payload);
  }

  async function executeCreate(payload: CreateCardPayload): Promise<void> {
    submitting = true;
    // Capture before await to avoid race condition (ESLint require-atomic-updates)
    const timeEstimate = pendingTimeEstimate;
    pendingTimeEstimate = undefined;

    try {
      await apiCreateCard(payload);

      // Set time estimate if provided (non-blocking — card already created)
      if (timeEstimate !== undefined) {
        try {
          await apiSetTimeEstimate(payload.planUuid, {
            planUuid: payload.planUuid,
            intervalType: payload.intervalType,
            ...timeEstimate,
          });
        } catch (err: unknown) {
          logApiError('setTimeEstimate', err);
        }
      }

      showSuccessAlert(MESSAGES.SUCCESS_CARD_CREATED);
      closeForm();
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('createCard', err);
      const msg =
        err instanceof Error ? err.message : MESSAGES.ERROR_CARD_CREATE;
      showErrorAlert(msg);
    } finally {
      submitting = false;
    }
  }

  async function handleUpdate(
    payload: UpdateCardPayload,
    timeEstimate?: TimeEstimateInput,
  ): Promise<void> {
    if (editingCard === null) return;
    submitting = true;
    try {
      await apiUpdateCard(editingCard.uuid, payload);

      // Set time estimate if provided (non-blocking)
      if (timeEstimate !== undefined) {
        const itv = payload.intervalType ?? editingCard.intervalType;
        try {
          await apiSetTimeEstimate(data.planUuid, {
            planUuid: data.planUuid,
            intervalType: itv,
            ...timeEstimate,
          });
        } catch (err: unknown) {
          logApiError('setTimeEstimate', err);
        }
      }

      showSuccessAlert(MESSAGES.SUCCESS_CARD_UPDATED);
      closeForm();
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('updateCard', err);
      const msg =
        err instanceof Error ? err.message : MESSAGES.ERROR_CARD_UPDATE;
      showErrorAlert(msg);
    } finally {
      submitting = false;
    }
  }

  // ===========================================================================
  // DELETE
  // ===========================================================================

  function handleDeleteRequest(card: TpmCard): void {
    deleteTarget = card;
    showDeleteModal = true;
  }

  async function confirmDelete(): Promise<void> {
    if (deleteTarget === null) return;
    const targetUuid = deleteTarget.uuid;
    deleteTarget = null;
    showDeleteModal = false;
    submitting = true;
    try {
      await apiDeleteCard(targetUuid);
      showSuccessAlert(MESSAGES.SUCCESS_CARD_DELETED);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('deleteCard', err);
      const msg =
        err instanceof Error ? err.message : MESSAGES.ERROR_CARD_DELETE;
      showErrorAlert(msg);
    } finally {
      submitting = false;
    }
  }

  function cancelDelete(): void {
    showDeleteModal = false;
    deleteTarget = null;
  }

  // ===========================================================================
  // DUPLICATE WARNING
  // ===========================================================================

  async function handleDuplicateContinue(): Promise<void> {
    showDuplicateWarning = false;
    const payload = pendingPayload;
    pendingPayload = null;
    duplicateCards = [];
    if (payload !== null) {
      await executeCreate(payload);
    }
  }

  function handleDuplicateCancel(): void {
    showDuplicateWarning = false;
    pendingTimeEstimate = undefined;
    pendingPayload = null;
    duplicateCards = [];
  }
</script>

<svelte:head>
  <title>{MESSAGES.CARD_PAGE_TITLE}</title>
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
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1
          class="flex items-center gap-2 text-2xl font-bold text-(--color-text-primary)"
        >
          <i class="fas fa-th"></i>
          {MESSAGES.CARD_PAGE_HEADING}
        </h1>
        <p class="mt-1 text-sm text-(--color-text-secondary)">
          {data.plan.machineName ?? '—'} — {data.plan.name}
        </p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => {
            void goto(
              resolvePath(`/lean-management/tpm/board/${data.planUuid}`),
            );
          }}
        >
          <i class="fas fa-th-large mr-2"></i>{MESSAGES.BTN_VIEW_BOARD}
        </button>
        {#if !showForm}
          <button
            type="button"
            class="btn btn-primary"
            onclick={openCreateForm}
          >
            <i class="fas fa-plus"></i>
            {MESSAGES.BTN_NEW_CARD}
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="flex flex-col gap-6">
    <!-- Card Form (inline panel) -->
    {#if showForm}
      <div class="card">
        <div class="card__header">
          <h2 class="card__title">{formHeading}</h2>
        </div>
        <div class="card__body">
          <CardForm
            card={editingCard}
            planUuid={data.planUuid}
            planBaseWeekday={data.plan.baseWeekday}
            {isCreateMode}
            {submitting}
            existingEstimates={data.timeEstimates}
            oncreate={handleCreate}
            onupdate={handleUpdate}
            oncancel={closeForm}
          />
        </div>
      </div>
    {/if}

    <!-- Card List -->
    <div class="card">
      <div class="card__header">
        <h2
          class="card__title"
          style="display: flex; align-items: center; gap: 0.625rem;"
        >
          Karten ({data.totalCards})
          <svg
            width="22"
            height="30"
            viewBox="0 0 32 42"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style="flex-shrink: 0; align-self: center; margin-top: 2px; color: #22c55e;"
          >
            <rect
              x="1"
              y="1"
              width="30"
              height="40"
              rx="5"
              fill="currentColor"
              opacity="0.15"
              stroke="currentColor"
              stroke-width="2"
            />
            <rect
              x="3"
              y="3"
              width="26"
              height="13"
              rx="4"
              fill="currentColor"
              opacity="0.7"
            />
            <rect
              x="6"
              y="22"
              width="18"
              height="2.5"
              rx="1.25"
              fill="currentColor"
              opacity="0.45"
            />
            <rect
              x="6"
              y="28"
              width="13"
              height="2.5"
              rx="1.25"
              fill="currentColor"
              opacity="0.3"
            />
          </svg>
        </h2>
      </div>
      <div class="card__body">
        <CardList
          cards={data.cards}
          totalCards={data.totalCards}
          loading={false}
          onedit={openEditForm}
          ondelete={handleDeleteRequest}
        />
      </div>
    </div>
  </div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && deleteTarget !== null}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay modal-overlay--active"
    onclick={cancelDelete}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDelete();
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
      <h3 class="confirm-modal__title">{MESSAGES.CARD_DELETE_TITLE}</h3>
      <p class="confirm-modal__message">
        {MESSAGES.CARD_DELETE_MESSAGE}
      </p>
      <p class="confirm-modal__message">
        <strong>{deleteTarget.cardCode}</strong> — {deleteTarget.title}
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={cancelDelete}
          disabled={submitting}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={confirmDelete}
          disabled={submitting}
        >
          {#if submitting}
            <i class="fas fa-spinner fa-spin"></i>
          {/if}
          {MESSAGES.BTN_DELETE}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Duplicate Warning Modal -->
{#if showDuplicateWarning}
  <DuplicateWarning
    existingCards={duplicateCards}
    oncontinue={handleDuplicateContinue}
    oncancel={handleDuplicateCancel}
  />
{/if}
