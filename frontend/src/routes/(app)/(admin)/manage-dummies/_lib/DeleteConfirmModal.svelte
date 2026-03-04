<script lang="ts">
  import { MESSAGES } from './constants';

  interface Props {
    showDeleteModal: boolean;
    showDeleteConfirmModal: boolean;
    displayName: string;
    submitting: boolean;
    oncloseDelete: () => void;
    oncloseDeleteConfirm: () => void;
    onproceedToConfirm: () => void;
    ondeleteConfirm: () => void;
  }

  const {
    showDeleteModal,
    showDeleteConfirmModal,
    displayName,
    submitting,
    oncloseDelete,
    oncloseDeleteConfirm,
    onproceedToConfirm,
    ondeleteConfirm,
  }: Props = $props();

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
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-dummy-title"
    tabindex="-1"
    onclick={handleDeleteOverlayClick}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') oncloseDelete();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="ds-modal ds-modal--sm"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="delete-dummy-title"
        >
          <i class="fas fa-trash-alt mr-2 text-red-500"></i>
          {MESSAGES.DELETE_CONFIRM_TITLE}
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
        <p class="text-(--color-text-secondary)">
          Möchten Sie den Dummy-Benutzer <strong>{displayName}</strong> wirklich löschen?
        </p>
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={oncloseDelete}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={onproceedToConfirm}
        >
          {MESSAGES.BTN_DELETE}
        </button>
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
    aria-labelledby="delete-dummy-confirm-title"
    tabindex="-1"
    onclick={handleDeleteConfirmOverlayClick}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') oncloseDeleteConfirm();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="confirm-modal confirm-modal--danger"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3
        class="confirm-modal__title"
        id="delete-dummy-confirm-title"
      >
        {MESSAGES.DELETE_CONFIRM_FINAL}
      </h3>
      <p class="confirm-modal__message">
        <strong>ACHTUNG:</strong>
        {MESSAGES.DELETE_CONFIRM_TEXT}
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={oncloseDeleteConfirm}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          disabled={submitting}
          onclick={ondeleteConfirm}
        >
          {#if submitting}
            <span class="spinner-ring spinner-ring--sm mr-2"></span>
          {/if}
          Endgültig löschen
        </button>
      </div>
    </div>
  </div>
{/if}
