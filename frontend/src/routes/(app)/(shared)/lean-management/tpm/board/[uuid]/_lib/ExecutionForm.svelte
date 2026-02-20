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
    <p class="m-0 text-sm text-(--color-text-muted) italic">
      {MESSAGES.EXEC_CARD_NOT_DUE}
    </p>
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
    <div class="form-field">
      <label
        for="exec-docs"
        class="form-field__label"
      >
        {MESSAGES.EXEC_DOCUMENTATION}
        {#if requiresDocs}
          <span class="text-(--color-danger)">*</span>
        {/if}
      </label>
      <textarea
        id="exec-docs"
        class="form-field__control form-field__control--textarea"
        placeholder={MESSAGES.EXEC_DOCUMENTATION_PH}
        bind:value={documentation}
        rows="4"
        maxlength="10000"
        disabled={submitting}
      ></textarea>
      {#if requiresDocs}
        <span class="form-field__message">
          {MESSAGES.EXEC_DOCUMENTATION_HINT}
        </span>
      {/if}
    </div>

    {#if error !== null}
      <span class="flex items-center gap-1.5 text-sm text-(--color-danger)">
        <i class="fas fa-exclamation-circle"></i>
        {error}
      </span>
    {/if}

    <button
      type="button"
      class="btn btn-primary btn-sm"
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
    color: var(--color-text-primary);
    margin: 0;
  }

  .execution-form__success {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-success);
    padding: 0.5rem 0.75rem;
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
    border-radius: var(--radius-md);
  }
</style>
