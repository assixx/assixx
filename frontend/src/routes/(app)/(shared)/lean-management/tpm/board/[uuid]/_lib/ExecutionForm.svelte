<script lang="ts">
  /**
   * ExecutionForm — Form for marking a card as done.
   * Flow: documentation (optional) → photo staging (optional) → submit.
   * Photos are collected client-side first, then uploaded after execution creation.
   * Only shown when card status is 'red' or 'overdue'.
   */
  import { onDestroy } from 'svelte';

  import { createExecution, uploadPhoto, logApiError } from '../../../_lib/api';
  import { MESSAGES } from '../../../_lib/constants';

  import type { TpmCard, TpmExecution } from '../../../_lib/types';

  const MAX_PHOTOS = 5;
  const MAX_FILE_SIZE = 5_242_880;
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  interface StagedPhoto {
    file: File;
    previewUrl: string;
  }

  interface Props {
    card: TpmCard;
    onExecutionCreated: (execution: TpmExecution) => void;
  }

  const { card, onExecutionCreated }: Props = $props();

  let documentation = $state('');
  let submitting = $state(false);
  let error = $state<string | null>(null);
  let completed = $state(false);
  let stagedPhotos = $state<StagedPhoto[]>([]);
  let photoError = $state<string | null>(null);
  let photoUploadWarning = $state<string | null>(null);

  const canExecute = $derived(
    card.status === 'red' || card.status === 'overdue',
  );
  const requiresDocs = $derived(card.requiresApproval);
  const isValid = $derived(!requiresDocs || documentation.trim().length > 0);
  const canAddPhoto = $derived(stagedPhotos.length < MAX_PHOTOS && !submitting);

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) return MESSAGES.PHOTO_INVALID_TYPE;
    if (file.size > MAX_FILE_SIZE) return MESSAGES.PHOTO_TOO_LARGE;
    return null;
  }

  function handleFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file === undefined) return;

    const validationError = validateFile(file);
    if (validationError !== null) {
      photoError = validationError;
      input.value = '';
      return;
    }

    photoError = null;
    stagedPhotos = [
      ...stagedPhotos,
      { file, previewUrl: URL.createObjectURL(file) },
    ];
    input.value = '';
  }

  function removePhoto(index: number): void {
    URL.revokeObjectURL(stagedPhotos[index].previewUrl);
    stagedPhotos = stagedPhotos.filter(
      (_: StagedPhoto, i: number) => i !== index,
    );
  }

  function cleanupPreviews(): void {
    for (const staged of stagedPhotos) {
      URL.revokeObjectURL(staged.previewUrl);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!canExecute || !isValid || submitting) return;

    submitting = true;
    error = null;
    photoUploadWarning = null;

    try {
      // Step 1: Create execution
      const execution = await createExecution({
        cardUuid: card.uuid,
        documentation:
          documentation.trim().length > 0 ? documentation.trim() : null,
      });

      // Step 2: Upload staged photos (sequential to avoid server overload)
      let failedUploads = 0;
      for (const staged of stagedPhotos) {
        try {
          await uploadPhoto(execution.uuid, staged.file);
        } catch (uploadErr: unknown) {
          failedUploads++;
          logApiError('uploadPhoto', uploadErr);
        }
      }

      // Step 3: Clean up blob URLs
      cleanupPreviews();

      // eslint-disable-next-line require-atomic-updates -- Single-threaded UI; button disabled prevents concurrent calls
      submitting = false;
      completed = true;

      if (failedUploads > 0) {
        photoUploadWarning = `${String(failedUploads)} Foto(s) konnten nicht hochgeladen werden.`;
      }

      onExecutionCreated(execution);
    } catch (err: unknown) {
      // eslint-disable-next-line require-atomic-updates -- Single-threaded UI; button disabled prevents concurrent calls
      submitting = false;
      logApiError('createExecution', err);
      error = MESSAGES.EXEC_ERROR;
    }
  }

  onDestroy(cleanupPreviews);
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
  {:else if completed}
    <div class="execution-form__success">
      <i class="fas fa-check-circle"></i>
      {MESSAGES.EXEC_SUCCESS}
    </div>
    {#if photoUploadWarning !== null}
      <span class="flex items-center gap-1.5 text-sm text-(--color-warning)">
        <i class="fas fa-exclamation-triangle"></i>
        {photoUploadWarning}
      </span>
    {/if}
  {:else}
    <!-- Step 1: Documentation -->
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

    <!-- Step 2: Photo staging -->
    <div class="execution-form__photos">
      {#if stagedPhotos.length > 0}
        <div class="execution-form__photo-grid">
          {#each stagedPhotos as staged, index (staged.previewUrl)}
            <div class="execution-form__photo-thumb">
              <img
                src={staged.previewUrl}
                alt={staged.file.name}
                class="execution-form__photo-img"
              />
              <button
                type="button"
                class="execution-form__photo-remove"
                onclick={() => {
                  removePhoto(index);
                }}
                disabled={submitting}
                aria-label="Foto entfernen"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          {/each}
        </div>
      {/if}

      {#if canAddPhoto}
        <div class="file-upload-zone file-upload-zone--compact execution-form__upload-zone">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onchange={handleFileSelect}
            class="file-upload-zone__input"
            id="photo-upload"
            disabled={submitting}
          />
          <label for="photo-upload" class="file-upload-zone__label">
            <div class="file-upload-zone__icon">
              <i class="fas fa-camera"></i>
            </div>
            <div class="file-upload-zone__text">
              <p class="file-upload-zone__title">{MESSAGES.PHOTO_ADD}</p>
              <p class="file-upload-zone__subtitle">
                {MESSAGES.PHOTO_MAX_SIZE} · {stagedPhotos.length} / {MAX_PHOTOS}
              </p>
            </div>
          </label>
        </div>
      {:else if stagedPhotos.length >= MAX_PHOTOS}
        <span class="text-xs text-(--color-text-muted) italic">
          {MESSAGES.PHOTO_MAX_REACHED}
        </span>
      {/if}

      {#if photoError !== null}
        <span class="flex items-center gap-1.5 text-sm text-(--color-danger)">
          <i class="fas fa-exclamation-circle"></i>
          {photoError}
        </span>
      {/if}
    </div>

    <!-- Error -->
    {#if error !== null}
      <span class="flex items-center gap-1.5 text-sm text-(--color-danger)">
        <i class="fas fa-exclamation-circle"></i>
        {error}
      </span>
    {/if}

    <!-- Step 3: Submit -->
    <button
      type="button"
      class="btn btn-primary execution-form__submit"
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

  /* Photo staging */
  .execution-form__photos {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .execution-form__upload-zone {
    max-width: 600px;
    width: 100%;
    align-self: center;
    margin-bottom: 0.75rem;
  }

  .execution-form__photo-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .execution-form__photo-thumb {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-glass-border);
  }

  .execution-form__photo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .execution-form__photo-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full, 9999px);
    background: rgb(0 0 0 / 60%);
    color: #fff;
    font-size: 0.625rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .execution-form__photo-remove:hover {
    background: var(--color-danger);
  }

  .execution-form__submit {
    align-self: center;
  }
</style>
