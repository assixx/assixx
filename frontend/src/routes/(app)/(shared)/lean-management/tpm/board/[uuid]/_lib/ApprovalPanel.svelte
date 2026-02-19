<script lang="ts">
  /**
   * ApprovalPanel — Approve or reject a pending execution.
   * Shown when card status is 'yellow' (pending approval).
   * Rejection requires a note (Zod validation on backend).
   */
  import {
    respondToExecution,
    fetchPendingApprovals,
    logApiError,
  } from '../../../_lib/api';
  import { MESSAGES } from '../../../_lib/constants';

  import type { TpmCard, TpmExecution } from '../../../_lib/types';

  interface Props {
    card: TpmCard;
    onApprovalDone: (execution: TpmExecution) => void;
  }

  const { card, onApprovalDone }: Props = $props();

  let pendingExecution = $state<TpmExecution | null>(null);
  let approvalNote = $state('');
  let submitting = $state(false);
  let error = $state<string | null>(null);
  let loading = $state(true);

  const canReject = $derived(approvalNote.trim().length > 0);

  /** Load the pending execution for this card */
  async function loadPendingExecution(): Promise<void> {
    loading = true;
    try {
      const result = await fetchPendingApprovals(1, 100);
      pendingExecution =
        result.items.find((e: TpmExecution) => e.cardUuid === card.uuid) ??
        null;
    } catch (err: unknown) {
      logApiError('fetchPendingApprovals', err);
    } finally {
      loading = false;
    }
  }

  /** Approve the execution */
  async function handleApprove(): Promise<void> {
    if (pendingExecution === null || submitting) return;
    submitting = true;
    error = null;
    try {
      const result = await respondToExecution(pendingExecution.uuid, {
        action: 'approved',
        approvalNote:
          approvalNote.trim().length > 0 ? approvalNote.trim() : null,
      });
      // eslint-disable-next-line require-atomic-updates -- Single-threaded UI; button disabled prevents concurrent calls
      submitting = false;
      onApprovalDone(result);
    } catch (err: unknown) {
      // eslint-disable-next-line require-atomic-updates -- Single-threaded UI; button disabled prevents concurrent calls
      submitting = false;
      logApiError('approveExecution', err);
      error = MESSAGES.APPROVAL_ERROR;
    }
  }

  /** Reject the execution */
  async function handleReject(): Promise<void> {
    if (pendingExecution === null || submitting || !canReject) return;
    submitting = true;
    error = null;
    try {
      const result = await respondToExecution(pendingExecution.uuid, {
        action: 'rejected',
        approvalNote: approvalNote.trim(),
      });
      // eslint-disable-next-line require-atomic-updates -- Single-threaded UI; button disabled prevents concurrent calls
      submitting = false;
      onApprovalDone(result);
    } catch (err: unknown) {
      // eslint-disable-next-line require-atomic-updates -- Single-threaded UI; button disabled prevents concurrent calls
      submitting = false;
      logApiError('rejectExecution', err);
      error = MESSAGES.APPROVAL_ERROR;
    }
  }

  function formatDate(dateStr: string | null): string {
    if (dateStr === null) return '—';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Load on mount
  $effect(() => {
    void loadPendingExecution();
  });
</script>

<div class="approval-panel">
  <h4 class="approval-panel__title">
    <i class="fas fa-user-check"></i>
    {MESSAGES.APPROVAL_HEADING}
  </h4>

  {#if loading}
    <div class="approval-panel__loading">
      <i class="fas fa-spinner fa-spin"></i>
      Wird geladen...
    </div>
  {:else if pendingExecution === null}
    <p class="approval-panel__empty">Keine ausstehende Freigabe gefunden.</p>
  {:else}
    <!-- Execution info -->
    <div class="approval-panel__info">
      <div class="approval-panel__row">
        <span class="approval-panel__label"
          >{MESSAGES.APPROVAL_EXECUTED_BY}</span
        >
        <span class="approval-panel__value">
          {pendingExecution.executedByName ?? '—'}
        </span>
      </div>
      <div class="approval-panel__row">
        <span class="approval-panel__label"
          >{MESSAGES.APPROVAL_EXECUTED_ON}</span
        >
        <span class="approval-panel__value">
          {formatDate(pendingExecution.executionDate)}
        </span>
      </div>
      {#if pendingExecution.documentation !== null}
        <div class="approval-panel__docs">
          <span class="approval-panel__label"
            >{MESSAGES.APPROVAL_DOCUMENTATION}</span
          >
          <p class="approval-panel__docs-text">
            {pendingExecution.documentation}
          </p>
        </div>
      {/if}
    </div>

    <!-- Note input -->
    <div class="approval-panel__field">
      <label
        for="approval-note"
        class="approval-panel__label"
      >
        {MESSAGES.APPROVAL_NOTE}
      </label>
      <textarea
        id="approval-note"
        class="approval-panel__textarea"
        placeholder={MESSAGES.APPROVAL_NOTE_PH}
        bind:value={approvalNote}
        rows="3"
        maxlength="2000"
        disabled={submitting}
      ></textarea>
    </div>

    {#if error !== null}
      <span class="approval-panel__error">
        <i class="fas fa-exclamation-circle"></i>
        {error}
      </span>
    {/if}

    <!-- Action buttons -->
    <div class="approval-panel__actions">
      <button
        type="button"
        class="btn btn--success btn--sm"
        onclick={handleApprove}
        disabled={submitting}
      >
        {#if submitting}
          <i class="fas fa-spinner fa-spin"></i>
        {:else}
          <i class="fas fa-check"></i>
        {/if}
        {MESSAGES.APPROVAL_APPROVE}
      </button>
      <button
        type="button"
        class="btn btn--danger btn--sm"
        onclick={handleReject}
        disabled={submitting || !canReject}
        title={!canReject ? MESSAGES.APPROVAL_NOTE_REQUIRED : ''}
      >
        <i class="fas fa-times"></i>
        {MESSAGES.APPROVAL_REJECT}
      </button>
    </div>
    {#if !canReject}
      <span class="approval-panel__hint">
        {MESSAGES.APPROVAL_NOTE_REQUIRED}
      </span>
    {/if}
  {/if}
</div>

<style>
  .approval-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .approval-panel__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-gray-800);
    margin: 0;
  }

  .approval-panel__loading {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.813rem;
    color: var(--color-gray-500);
  }

  .approval-panel__empty {
    font-size: 0.813rem;
    color: var(--color-gray-400);
    font-style: italic;
    margin: 0;
  }

  .approval-panel__info {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    background: var(--color-gray-50, #f9fafb);
    border-radius: var(--radius-md, 8px);
    padding: 0.625rem 0.75rem;
  }

  .approval-panel__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .approval-panel__label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-gray-500);
  }

  .approval-panel__value {
    font-size: 0.75rem;
    color: var(--color-gray-800);
    font-weight: 500;
  }

  .approval-panel__docs {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }

  .approval-panel__docs-text {
    font-size: 0.813rem;
    color: var(--color-gray-700);
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
  }

  .approval-panel__field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .approval-panel__textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md, 8px);
    font-size: 0.813rem;
    font-family: inherit;
    resize: vertical;
    min-height: 60px;
    transition: border-color 0.15s ease;
  }

  .approval-panel__textarea:focus {
    outline: none;
    border-color: var(--color-primary-400);
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--color-primary-400) 25%, transparent);
  }

  .approval-panel__textarea:disabled {
    opacity: 50%;
    cursor: not-allowed;
  }

  .approval-panel__actions {
    display: flex;
    gap: 0.5rem;
  }

  .approval-panel__error {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.813rem;
    color: var(--color-danger, #ef4444);
  }

  .approval-panel__hint {
    font-size: 0.688rem;
    color: var(--color-gray-400);
    font-style: italic;
  }
</style>
