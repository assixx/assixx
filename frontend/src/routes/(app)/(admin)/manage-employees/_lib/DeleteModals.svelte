<script lang="ts">
  import { MESSAGES } from './constants';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    showDeleteModal: boolean;
    showDeleteConfirmModal: boolean;
    oncloseDelete: () => void;
    oncloseDeleteConfirm: () => void;
    onproceedToConfirm: () => void;
    ondeleteConfirm: () => void;
  }

  const {
    showDeleteModal,
    showDeleteConfirmModal,
    oncloseDelete,
    oncloseDeleteConfirm,
    onproceedToConfirm,
    ondeleteConfirm,
  }: Props = $props();

  // =============================================================================
  // OVERLAY CLICK HANDLERS
  // =============================================================================

  function handleDeleteOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) oncloseDelete();
  }

  function handleDeleteConfirmOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) oncloseDeleteConfirm();
  }
</script>

<!-- Delete Modal Step 1 -->
{#if showDeleteModal}
  <div
    id="delete-employee-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-modal-title"
    tabindex="-1"
    onclick={handleDeleteOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') oncloseDelete();
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
          <i class="fas fa-trash-alt mr-2 text-red-500"></i>
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
        <p class="text-[var(--color-text-secondary)]">
          Möchten Sie diesen Mitarbeiter wirklich löschen?
        </p>
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={oncloseDelete}>Abbrechen</button
        >
        <button
          type="button"
          class="btn btn-danger"
          onclick={onproceedToConfirm}>Löschen</button
        >
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal Step 2 -->
{#if showDeleteConfirmModal}
  <div
    id="delete-employee-confirm-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-confirm-title"
    tabindex="-1"
    onclick={handleDeleteConfirmOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') oncloseDeleteConfirm();
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
          onclick={oncloseDeleteConfirm}>Abbrechen</button
        >
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={ondeleteConfirm}
        >
          Endgültig löschen
        </button>
      </div>
    </div>
  </div>
{/if}
