<script lang="ts">
  /**
   * ExecutionForm — Form for marking a card as done.
   * Includes documentation text area and photo upload.
   * Only shown when card status is 'red' or 'overdue'.
   */
  import { createExecution, logApiError } from '../../../_lib/api';
  import { MESSAGES } from '../../../_lib/constants';

  import PhotoUpload from './PhotoUpload.svelte';

  import type {
    TpmCard,
    TpmExecution,
    TpmExecutionPhoto,
  } from '../../../_lib/types';

  interface Props {
    card: TpmCard;
    onExecutionCreated: (execution: TpmExecution) => void;
  }

  const { card, onExecutionCreated }: Props = $props();

  let documentation = $state('');
  let submitting = $state(false);
  let error = $state<string | null>(null);
  let createdExecution = $state<TpmExecution | null>(null);
  let photos = $state<TpmExecutionPhoto[]>([]);

  const canExecute = $derived(
    card.status === 'red' || card.status === 'overdue',
  );
  const requiresDocs = $derived(card.requiresApproval);
  const isValid = $derived(!requiresDocs || documentation.trim().length > 0);

  async function handleSubmit(): Promise<void> {
    if (!canExecute || !isValid || submitting) return;

    submitting = true;
    error = null;
    try {
      const execution = await createExecution({
        cardUuid: card.uuid,
        documentation:
          documentation.trim().length > 0 ? documentation.trim() : null,
      });
      // eslint-disable-next-line require-atomic-updates -- Single-threaded UI; button disabled prevents concurrent calls
      submitting = false;
      createdExecution = execution;
      onExecutionCreated(execution);
    } catch (err: unknown) {
      // eslint-disable-next-line require-atomic-updates -- Single-threaded UI; button disabled prevents concurrent calls
      submitting = false;
      logApiError('createExecution', err);
      error = MESSAGES.EXEC_ERROR;
    }
  }

  function handlePhotoAdded(photo: TpmExecutionPhoto): void {
    photos = [...photos, photo];
  }
</script>

<div class="execution-form">
  <h4 class="execution-form__title">
    <i class="fas fa-check-double"></i>
    {MESSAGES.EXEC_HEADING}
  </h4>

  {#if !canExecute}
    <p class="execution-form__not-due">{MESSAGES.EXEC_CARD_NOT_DUE}</p>
  {:else if createdExecution !== null}
    <!-- Post-submit: show success and photo upload -->
    <div class="execution-form__success">
      <i class="fas fa-check-circle"></i>
      {MESSAGES.EXEC_SUCCESS}
    </div>
    <PhotoUpload
      executionUuid={createdExecution.uuid}
      {photos}
      onPhotoAdded={handlePhotoAdded}
    />
  {:else}
    <!-- Pre-submit: documentation form -->
    <div class="execution-form__field">
      <label
        for="exec-docs"
        class="execution-form__label"
      >
        {MESSAGES.EXEC_DOCUMENTATION}
        {#if requiresDocs}
          <span class="execution-form__required">*</span>
        {/if}
      </label>
      <textarea
        id="exec-docs"
        class="execution-form__textarea"
        placeholder={MESSAGES.EXEC_DOCUMENTATION_PH}
        bind:value={documentation}
        rows="4"
        maxlength="10000"
        disabled={submitting}
      ></textarea>
      {#if requiresDocs}
        <span class="execution-form__hint">
          {MESSAGES.EXEC_DOCUMENTATION_HINT}
        </span>
      {/if}
    </div>

    {#if error !== null}
      <span class="execution-form__error">
        <i class="fas fa-exclamation-circle"></i>
        {error}
      </span>
    {/if}

    <button
      type="button"
      class="btn btn--primary btn--sm"
      onclick={handleSubmit}
      disabled={submitting || !isValid}
    >
      {#if submitting}
        <i class="fas fa-spinner fa-spin"></i>
        {MESSAGES.EXEC_SUBMITTING}
      {:else}
        <i class="fas fa-check"></i>
        {MESSAGES.EXEC_SUBMIT}
      {/if}
    </button>
  {/if}
</div>

<style>
  .execution-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .execution-form__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-gray-800);
    margin: 0;
  }

  .execution-form__not-due {
    font-size: 0.813rem;
    color: var(--color-gray-400);
    font-style: italic;
    margin: 0;
  }

  .execution-form__field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .execution-form__label {
    font-size: 0.813rem;
    font-weight: 500;
    color: var(--color-gray-600);
  }

  .execution-form__required {
    color: var(--color-danger, #ef4444);
  }

  .execution-form__textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md, 8px);
    font-size: 0.813rem;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
    transition: border-color 0.15s ease;
  }

  .execution-form__textarea:focus {
    outline: none;
    border-color: var(--color-primary-400);
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--color-primary-400) 25%, transparent);
  }

  .execution-form__textarea:disabled {
    opacity: 50%;
    cursor: not-allowed;
  }

  .execution-form__hint {
    font-size: 0.688rem;
    color: var(--color-gray-400);
  }

  .execution-form__error {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.813rem;
    color: var(--color-danger, #ef4444);
  }

  .execution-form__success {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-success, #10b981);
    padding: 0.5rem 0.75rem;
    background: color-mix(
      in srgb,
      var(--color-success, #10b981) 8%,
      transparent
    );
    border-radius: var(--radius-md, 8px);
  }
</style>
