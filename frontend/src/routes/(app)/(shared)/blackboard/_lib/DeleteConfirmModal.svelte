<script lang="ts">
  /**
   * DeleteConfirmModal - Two-Step Delete Confirmation
   *
   * Implements a two-step delete process:
   * - Step 1: Simple confirmation (are you sure?)
   * - Step 2: Final warning with danger styling
   *
   * Pattern: Controlled component (parent manages state)
   */
  import { MESSAGES } from './constants';

  interface Props {
    showStep1: boolean;
    showStep2: boolean;
    loading?: boolean;
    oncancel: () => void;
    onproceed: () => void; // Step 1 → Step 2
    onconfirm: () => void; // Step 2 → Delete
  }

  const {
    showStep1,
    showStep2,
    loading = false,
    oncancel,
    onproceed,
    onconfirm,
  }: Props = $props();

  function handleOverlayClick(step: 1 | 2): void {
    if (step === 1 && showStep1) oncancel();
    if (step === 2 && showStep2) oncancel();
  }

  function handleKeyDown(e: KeyboardEvent, step: 1 | 2): void {
    if (e.key === 'Escape') {
      if (step === 1 && showStep1) oncancel();
      if (step === 2 && showStep2) oncancel();
    }
  }

  function stopPropagation(e: Event): void {
    e.stopPropagation();
  }
</script>

<!-- Delete Modal Step 1: Initial Confirmation -->
{#if showStep1}
  <div
    id="blackboard-delete-modal"
    class="modal-overlay modal-overlay--active"
    onclick={() => {
      handleOverlayClick(1);
    }}
    onkeydown={(e) => {
      handleKeyDown(e, 1);
    }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal ds-modal--sm"
      onclick={stopPropagation}
      onkeydown={stopPropagation}
      role="document"
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-trash-alt mr-2 text-red-500"></i>
          {MESSAGES.DELETE_CONFIRM_TITLE}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          onclick={oncancel}
          aria-label="Schließen"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p class="text-(--color-text-secondary)">
          {MESSAGES.DELETE_CONFIRM_MESSAGE}
        </p>
      </div>
      <div class="ds-modal__footer ds-modal__footer--right">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={oncancel}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={onproceed}
        >
          <i class="fas fa-trash-alt mr-2"></i>
          Löschen
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal Step 2: Final Warning -->
{#if showStep2}
  <div
    id="blackboard-delete-confirm-modal"
    class="modal-overlay modal-overlay--active"
    onclick={() => {
      handleOverlayClick(2);
    }}
    onkeydown={(e) => {
      handleKeyDown(e, 2);
    }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="confirm-modal confirm-modal--danger"
      onclick={stopPropagation}
      onkeydown={stopPropagation}
      role="document"
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="confirm-modal__title">{MESSAGES.DELETE_FINAL_TITLE}</h3>
      <p class="confirm-modal__message">
        <strong>ACHTUNG:</strong>
        {MESSAGES.DELETE_FINAL_MESSAGE}
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={oncancel}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={onconfirm}
          disabled={loading}
        >
          Endgültig löschen
        </button>
      </div>
    </div>
  </div>
{/if}
