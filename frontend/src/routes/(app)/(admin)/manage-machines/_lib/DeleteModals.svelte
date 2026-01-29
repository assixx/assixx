<script lang="ts">
  import { MESSAGES } from './constants';
  import { machineState } from './state.svelte';

  interface Props {
    ondelete: () => void;
  }

  const { ondelete }: Props = $props();

  function handleDeleteOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) machineState.closeDeleteModal();
  }

  function handleDeleteConfirmOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) machineState.closeDeleteConfirmModal();
  }

  function proceedToDeleteConfirm() {
    machineState.openDeleteConfirmModal();
  }
</script>

<!-- Delete Modal Step 1 -->
{#if machineState.showDeleteModal}
  <div
    id="delete-machine-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-modal-title"
    tabindex="-1"
    onclick={handleDeleteOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') machineState.closeDeleteModal();
    }}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="ds-modal ds-modal--sm"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="delete-modal-title"
        >
          <i class="fas fa-trash-alt mr-2 text-red-500"></i>
          {MESSAGES.MODAL_DELETE_TITLE}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={() => {
            machineState.closeDeleteModal();
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p class="text-[var(--color-text-secondary)]">
          {MESSAGES.DELETE_CONFIRM_MESSAGE}
        </p>
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            machineState.closeDeleteModal();
          }}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={proceedToDeleteConfirm}
        >
          {MESSAGES.BTN_DELETE}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal Step 2 -->
{#if machineState.showDeleteConfirmModal}
  <div
    id="delete-machine-confirm-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-confirm-title"
    tabindex="-1"
    onclick={handleDeleteConfirmOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') machineState.closeDeleteConfirmModal();
    }}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="confirm-modal confirm-modal--danger"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
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
        {MESSAGES.MODAL_DELETE_CONFIRM_TITLE}
      </h3>
      <p class="confirm-modal__message">
        <strong>{MESSAGES.DELETE_FINAL_WARNING}</strong>
        <br /><br />
        {MESSAGES.DELETE_FINAL_INFO}
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={() => {
            machineState.closeDeleteConfirmModal();
          }}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={ondelete}
        >
          {MESSAGES.BTN_DELETE_FINAL}
        </button>
      </div>
    </div>
  </div>
{/if}
