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

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import {
    createCard as apiCreateCard,
    updateCard as apiUpdateCard,
    deleteCard as apiDeleteCard,
    checkDuplicate as apiCheckDuplicate,
    logApiError,
  } from '../../_admin/api';
  import { createTpmMessages } from '../../_admin/constants';

  import CardForm from './_lib/CardForm.svelte';
  import CardList from './_lib/CardList.svelte';
  import DuplicateWarning from './_lib/DuplicateWarning.svelte';

  import type { PageData } from './$types';
  import type { TpmCard, CreateCardPayload, UpdateCardPayload } from '../../_admin/types';

  // ===========================================================================
  // SSR DATA
  // ===========================================================================

  const { data }: { data: PageData } = $props();
  const permissionDenied = $derived(data.permissionDenied);

  // Hierarchy labels from layout data inheritance (A6)
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createTpmMessages(labels));

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
    isCreateMode ? messages.CARD_CREATE_TITLE : messages.CARD_EDIT_TITLE,
  );

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

  async function handleCreate(payload: CreateCardPayload): Promise<void> {
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
    try {
      await apiCreateCard(payload);
      showSuccessAlert(messages.SUCCESS_CARD_CREATED);
      closeForm();
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('createCard', err);
      const msg = err instanceof Error ? err.message : messages.ERROR_CARD_CREATE;
      showErrorAlert(msg);
    } finally {
      submitting = false;
    }
  }

  async function handleUpdate(payload: UpdateCardPayload): Promise<void> {
    if (editingCard === null) return;
    submitting = true;
    try {
      await apiUpdateCard(editingCard.uuid, payload);
      showSuccessAlert(messages.SUCCESS_CARD_UPDATED);
      closeForm();
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('updateCard', err);
      const msg = err instanceof Error ? err.message : messages.ERROR_CARD_UPDATE;
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
      showSuccessAlert(messages.SUCCESS_CARD_DELETED);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('deleteCard', err);
      const msg = err instanceof Error ? err.message : messages.ERROR_CARD_DELETE;
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
    pendingPayload = null;
    duplicateCards = [];
  }
</script>

<svelte:head>
  <title>{messages.CARD_PAGE_TITLE}</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="das TPM-System" />
{:else if data.plan !== null}
  <div class="container">
    <!-- Header -->
    <div class="mb-6">
      <div class="mb-4">
        <button
          type="button"
          class="btn btn-light"
          onclick={() => {
            void goto(resolve(`/lean-management/tpm/board/${data.planUuid}`));
          }}
        >
          <i class="fas fa-arrow-left mr-2"></i>Zurück zum Board
        </button>
      </div>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="flex items-center gap-2 text-2xl font-bold text-(--color-text-primary)">
            <i class="fas fa-th"></i>
            {messages.CARD_PAGE_HEADING}
          </h1>
          <p class="mt-1 text-sm text-(--color-text-secondary)">
            {data.plan.assetName ?? '—'} — {data.plan.name}
          </p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn btn-primary"
            onclick={() => {
              void goto(resolve(`/lean-management/tpm/board/${data.planUuid}`));
            }}
          >
            <i class="fas fa-th-large mr-2"></i>{messages.BTN_VIEW_BOARD}
          </button>
          {#if !showForm}
            <button
              type="button"
              class="btn btn-primary"
              onclick={openCreateForm}
            >
              <i class="fas fa-plus"></i>
              {messages.BTN_NEW_CARD}
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
              locations={data.locations}
              {isCreateMode}
              {submitting}
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
  <ConfirmModal
    show={showDeleteModal && deleteTarget !== null}
    id="tpm-card-delete-modal"
    title={messages.CARD_DELETE_TITLE}
    confirmLabel={messages.BTN_DELETE}
    {submitting}
    onconfirm={confirmDelete}
    oncancel={cancelDelete}
  >
    {messages.CARD_DELETE_MESSAGE}
    {#if deleteTarget !== null}
      <br /><br />
      <strong>{deleteTarget.cardCode}</strong> — {deleteTarget.title}
    {/if}
  </ConfirmModal>

  <!-- Duplicate Warning Modal -->
  {#if showDuplicateWarning}
    <DuplicateWarning
      {messages}
      existingCards={duplicateCards}
      oncontinue={handleDuplicateContinue}
      oncancel={handleDuplicateCancel}
    />
  {/if}
{/if}
