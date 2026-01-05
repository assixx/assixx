<script lang="ts">
  import { MESSAGES } from './constants';

  interface Props {
    showDeleteModal: boolean;
    showDeleteConfirmModal: boolean;
    showForceDeleteModal: boolean;
    forceDeleteMemberCount: number;
    oncloseDelete: () => void;
    oncloseDeleteConfirm: () => void;
    oncloseForceDelete: () => void;
    onproceedToConfirm: () => void;
    onconfirmDelete: () => void;
    onforceDelete: () => void;
  }

  const {
    showDeleteModal,
    showDeleteConfirmModal,
    showForceDeleteModal,
    forceDeleteMemberCount,
    oncloseDelete,
    oncloseDeleteConfirm,
    oncloseForceDelete,
    onproceedToConfirm,
    onconfirmDelete,
    onforceDelete,
  }: Props = $props();

  function handleDeleteOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) oncloseDelete();
  }

  function handleDeleteConfirmOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) oncloseDeleteConfirm();
  }

  function handleForceDeleteOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) oncloseForceDelete();
  }
</script>

<!-- Delete Modal Step 1 -->
{#if showDeleteModal}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-modal-title"
    tabindex="-1"
    onclick={handleDeleteOverlayClick}
    onkeydown={(e) => e.key === 'Escape' && oncloseDelete()}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal ds-modal--sm"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="document"
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title" id="delete-modal-title">
          <i class="fas fa-trash-alt text-red-500 mr-2"></i>
          {MESSAGES.DELETE_TITLE}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={oncloseDelete}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p class="text-secondary">Möchten Sie dieses Team wirklich löschen?</p>
      </div>
      <div class="ds-modal__footer">
        <button type="button" class="btn btn-cancel" onclick={oncloseDelete}>Abbrechen</button>
        <button type="button" class="btn btn-danger" onclick={onproceedToConfirm}>Löschen</button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal Step 2 -->
{#if showDeleteConfirmModal}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-confirm-title"
    tabindex="-1"
    onclick={handleDeleteConfirmOverlayClick}
    onkeydown={(e) => e.key === 'Escape' && oncloseDeleteConfirm()}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="confirm-modal confirm-modal--danger"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="document"
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="confirm-modal__title" id="delete-confirm-title">
        {MESSAGES.DELETE_CONFIRM_TITLE}
      </h3>
      <p class="confirm-modal__message">
        <strong>ACHTUNG:</strong>
        {MESSAGES.DELETE_CONFIRM_MESSAGE}
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={oncloseDeleteConfirm}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={onconfirmDelete}
        >
          Endgültig löschen
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Force Delete Warning Modal -->
{#if showForceDeleteModal}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="force-delete-title"
    tabindex="-1"
    onclick={handleForceDeleteOverlayClick}
    onkeydown={(e) => e.key === 'Escape' && oncloseForceDelete()}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="confirm-modal confirm-modal--warning"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="document"
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="confirm-modal__title" id="force-delete-title">{MESSAGES.FORCE_DELETE_TITLE}</h3>
      <p class="confirm-modal__message">
        {MESSAGES.FORCE_DELETE_MESSAGE(forceDeleteMemberCount)}
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={oncloseForceDelete}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--confirm"
          onclick={onforceDelete}
        >
          Team löschen
        </button>
      </div>
    </div>
  </div>
{/if}
