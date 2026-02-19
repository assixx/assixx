<script lang="ts">
  /**
   * TPM Card Management Page
   * @module lean-management/tpm/cards/[uuid]/+page
   *
   * The [uuid] param is the plan UUID.
   * Shows card list for the plan with inline create/edit form.
   * Handles: CRUD, duplicate check, delete confirmation.
   */
  import { invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import {
    createCard as apiCreateCard,
    updateCard as apiUpdateCard,
    deleteCard as apiDeleteCard,
    checkDuplicate as apiCheckDuplicate,
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

  async function handleUpdate(payload: UpdateCardPayload): Promise<void> {
    if (editingCard === null) return;
    submitting = true;
    try {
      await apiUpdateCard(editingCard.uuid, payload);
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
    pendingPayload = null;
    duplicateCards = [];
  }
</script>

<svelte:head>
  <title>{MESSAGES.CARD_PAGE_TITLE}</title>
</svelte:head>

<div class="card-mgmt">
  <!-- Header -->
  <div class="card-mgmt__header">
    <a
      href={resolvePath('/lean-management/tpm')}
      class="card-mgmt__back"
    >
      <i class="fas fa-arrow-left"></i>
      {MESSAGES.BTN_BACK_TO_OVERVIEW}
    </a>
    <div class="card-mgmt__title-row">
      <div>
        <h1 class="card-mgmt__heading">
          <i class="fas fa-th"></i>
          {MESSAGES.CARD_PAGE_HEADING}
        </h1>
        <p class="card-mgmt__subtitle">
          {data.plan.machineName ?? '—'} — {data.plan.name}
        </p>
      </div>
      {#if !showForm}
        <button
          type="button"
          class="btn btn--primary"
          onclick={openCreateForm}
        >
          <i class="fas fa-plus"></i>
          {MESSAGES.BTN_NEW_CARD}
        </button>
      {/if}
    </div>
  </div>

  <!-- Content -->
  <div class="card-mgmt__content">
    <!-- Card Form (inline panel) -->
    {#if showForm}
      <div class="card-mgmt__form-panel">
        <div class="card">
          <div class="card__header">
            <h2 class="card__title">{formHeading}</h2>
          </div>
          <div class="card__body">
            <CardForm
              card={editingCard}
              planUuid={data.planUuid}
              {isCreateMode}
              {submitting}
              oncreate={handleCreate}
              onupdate={handleUpdate}
              oncancel={closeForm}
            />
          </div>
        </div>
      </div>
    {/if}

    <!-- Card List -->
    <div class="card-mgmt__list-panel">
      <div class="card">
        <div class="card__header">
          <h2 class="card__title">
            Karten ({data.totalCards})
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
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && deleteTarget !== null}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={cancelDelete}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDelete();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal"
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
    >
      <div class="modal__header">
        <i class="fas fa-exclamation-triangle modal__icon modal__icon--danger"
        ></i>
        <h3 class="modal__title">{MESSAGES.CARD_DELETE_TITLE}</h3>
      </div>
      <div class="modal__body">
        <p>{MESSAGES.CARD_DELETE_MESSAGE}</p>
        <p class="modal__detail">
          <strong>{deleteTarget.cardCode}</strong> — {deleteTarget.title}
        </p>
      </div>
      <div class="modal__actions">
        <button
          type="button"
          class="btn btn--ghost"
          onclick={cancelDelete}
          disabled={submitting}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="btn btn--danger"
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

<style>
  .card-mgmt {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .card-mgmt__header {
    margin-bottom: 1.5rem;
  }

  .card-mgmt__back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-gray-500);
    text-decoration: none;
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
    transition: color 0.15s;
  }

  .card-mgmt__back:hover {
    color: var(--color-blue-600);
  }

  .card-mgmt__title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .card-mgmt__heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-gray-900);
  }

  .card-mgmt__subtitle {
    color: var(--color-gray-500);
    margin-top: 0.25rem;
    font-size: 0.875rem;
  }

  .card-mgmt__content {
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

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 50%);
    padding: 1rem;
  }

  .modal {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 10%));
    max-width: 480px;
    width: 100%;
    overflow: hidden;
  }

  .modal__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-gray-200);
  }

  .modal__icon {
    font-size: 1.25rem;
  }

  .modal__icon--danger {
    color: var(--color-red-500, #ef4444);
  }

  .modal__title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-gray-900);
  }

  .modal__body {
    padding: 1.25rem 1.5rem;
    font-size: 0.875rem;
    color: var(--color-gray-600);
  }

  .modal__detail {
    margin-top: 0.75rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-gray-50);
    border-radius: var(--radius-md, 8px);
    color: var(--color-gray-800);
  }

  .modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-gray-200);
    background: var(--color-gray-50);
  }

  /* Responsive */
  @media (width <= 640px) {
    .card-mgmt {
      padding: 1rem;
    }

    .card-mgmt__title-row {
      flex-direction: column;
    }
  }
</style>
