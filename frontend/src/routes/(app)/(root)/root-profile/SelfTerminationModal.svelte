<script lang="ts">
  /**
   * SelfTerminationModal — Confirm self-termination with reason textarea.
   *
   * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §5.1 (modal UI state).
   */
  import { SELF_TERMINATION_MESSAGES, SELF_TERMINATION_REASON_MAX } from './_lib/constants';

  interface Props {
    open: boolean;
    submitting: boolean;
    onsubmit: (reason: string | null) => void | Promise<void>;
    onclose: () => void;
  }

  const { open, submitting, onsubmit, onclose }: Props = $props();

  let reason = $state('');

  // Reset textarea when the modal closes (open transitions true → false).
  // Avoids stale text bleeding between consecutive opens.
  $effect(() => {
    if (!open) reason = '';
  });

  function handleSubmit(): void {
    const trimmed = reason.trim();
    void onsubmit(trimmed.length > 0 ? trimmed : null);
  }

  function handleBackdropClick(e: MouseEvent): void {
    // Close only on backdrop clicks (not when the dialog itself is clicked).
    if (e.target === e.currentTarget && !submitting) onclose();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && !submitting) onclose();
  }
</script>

{#if open}
  <div
    class="modal-overlay"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="presentation"
  >
    <div
      class="modal modal--md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="self-term-title"
    >
      <div class="modal-header">
        <h2
          id="self-term-title"
          class="modal-title"
        >
          <i
            class="fas fa-exclamation-triangle"
            style="color: var(--color-danger); margin-right: var(--spacing-2);"
          ></i>
          {SELF_TERMINATION_MESSAGES.modalTitle}
        </h2>
      </div>

      <div class="modal-body">
        <div class="warning-banner">
          <i class="fas fa-shield-halved"></i>
          <p>{SELF_TERMINATION_MESSAGES.modalWarning}</p>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="self-term-reason"
          >
            {SELF_TERMINATION_MESSAGES.modalReasonLabel}
          </label>
          <textarea
            id="self-term-reason"
            class="form-field__control"
            rows="4"
            maxlength={SELF_TERMINATION_REASON_MAX}
            placeholder={SELF_TERMINATION_MESSAGES.modalReasonPlaceholder}
            bind:value={reason}
            disabled={submitting}
          ></textarea>
          <span class="form-field__message">
            {reason.length} / {SELF_TERMINATION_REASON_MAX}
          </span>
        </div>
      </div>

      <div class="modal-footer modal-footer--spaced">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}
          disabled={submitting}
        >
          {SELF_TERMINATION_MESSAGES.modalCancel}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={handleSubmit}
          disabled={submitting}
        >
          {#if submitting}
            <span class="spinner-ring spinner-ring--sm"></span>
          {:else}
            <i class="fas fa-trash"></i>
          {/if}
          {SELF_TERMINATION_MESSAGES.modalSubmit}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .warning-banner {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-5);
    border: 1px solid color-mix(in oklch, var(--color-danger) 30%, transparent);
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--color-danger) 8%, transparent);
    padding: var(--spacing-4);
  }

  .warning-banner i {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--color-danger);
    font-size: 18px;
  }

  .warning-banner p {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 14px;
    line-height: 1.5;
  }
</style>
