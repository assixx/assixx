<script lang="ts">
  import { MESSAGES } from './constants';

  interface Props {
    showDeleteModal: boolean;
    showDeleteConfirmModal: boolean;
    onCloseDelete: () => void;
    onCloseDeleteConfirm: () => void;
    onProceedToConfirm: () => void;
    onConfirmDelete: () => void;
  }

  const {
    showDeleteModal,
    showDeleteConfirmModal,
    onCloseDelete,
    onCloseDeleteConfirm,
    onProceedToConfirm,
    onConfirmDelete,
  }: Props = $props();

  function handleDeleteOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      onCloseDelete();
    }
  }

  function handleDeleteConfirmOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      onCloseDeleteConfirm();
    }
  }
</script>

<!-- Delete Modal Step 1: Initial Confirmation -->
{#if showDeleteModal}
  <div
    id="delete-root-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-modal-title"
    tabindex="-1"
    onclick={handleDeleteOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onCloseDelete();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="ds-modal ds-modal--sm"
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="delete-modal-title"
        >
          <i class="fas fa-trash-alt text-red-500 mr-2"></i>
          {MESSAGES.DELETE_TITLE}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Modal schließen"
          onclick={onCloseDelete}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p class="text-[var(--color-text-secondary)]">
          {MESSAGES.DELETE_CONFIRM}
        </p>
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onCloseDelete}>Abbrechen</button
        >
        <button
          type="button"
          class="btn btn-danger"
          onclick={onProceedToConfirm}>Löschen</button
        >
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal Step 2: Final Dangerous Confirmation -->
{#if showDeleteConfirmModal}
  <div
    id="delete-root-confirm-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-confirm-title"
    tabindex="-1"
    onclick={handleDeleteConfirmOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onCloseDeleteConfirm();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="confirm-modal confirm-modal--danger"
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3
        class="confirm-modal__title"
        id="delete-confirm-title"
      >
        {MESSAGES.DELETE_FINAL_TITLE}
      </h3>
      <p class="confirm-modal__message">
        <strong>ACHTUNG:</strong>
        {MESSAGES.DELETE_FINAL_WARNING}
        <br /><br />
        {MESSAGES.DELETE_FINAL_MESSAGE}
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={onCloseDeleteConfirm}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={onConfirmDelete}
        >
          Endgültig löschen
        </button>
      </div>
    </div>
  </div>
{/if}
