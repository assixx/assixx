<script lang="ts">
  /**
   * DefectSection — Defect entries within the execution form.
   *
   * Extracted from ExecutionForm to stay within max-lines.
   * Uses $bindable() so the parent retains access to defects for payload + upload.
   */
  import { MESSAGES } from '../../../_lib/constants';

  import type { DefectEntry, StagedPhoto } from './execution-types';

  const MAX_PHOTOS = 5;
  const MAX_DEFECTS = 20;
  const MAX_FILE_SIZE = 5_242_880;
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  interface Props {
    defects: DefectEntry[];
    submitting: boolean;
  }

  // eslint-disable-next-line @typescript-eslint/no-useless-default-assignment, prefer-const -- Svelte 5: $bindable() required for two-way binding, let required for $props()
  let { defects = $bindable(), submitting }: Props = $props();

  let photoError = $state<string | null>(null);
  let defectIdCounter =
    Math.max(0, ...defects.map((d: DefectEntry) => d.id)) + 1;

  const canAddDefect = $derived(defects.length < MAX_DEFECTS && !submitting);

  function createEmptyDefect(): DefectEntry {
    return {
      id: defectIdCounter++,
      title: '',
      description: '',
      stagedPhotos: [],
    };
  }

  function addDefect(): void {
    defects = [...defects, createEmptyDefect()];
  }

  function removeDefect(index: number): void {
    defects = defects.filter((_: DefectEntry, i: number) => i !== index);
    if (defects.length === 0) {
      defects = [createEmptyDefect()];
    }
  }

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) return MESSAGES.PHOTO_INVALID_TYPE;
    if (file.size > MAX_FILE_SIZE) return MESSAGES.PHOTO_TOO_LARGE;
    return null;
  }

  function handleDefectFileSelect(defectIndex: number, e: Event): void {
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
    const defect = defects[defectIndex];
    defect.stagedPhotos = [
      ...defect.stagedPhotos,
      { file, previewUrl: URL.createObjectURL(file) },
    ];
    input.value = '';
  }

  function removeDefectPhoto(defectIndex: number, photoIndex: number): void {
    const defect = defects[defectIndex];
    URL.revokeObjectURL(defect.stagedPhotos[photoIndex].previewUrl);
    defect.stagedPhotos = defect.stagedPhotos.filter(
      (_: StagedPhoto, i: number) => i !== photoIndex,
    );
  }
</script>

<div class="flex flex-col gap-3">
  <h5
    class="m-0 flex items-center gap-2 text-sm font-semibold text-(--color-warning)"
  >
    <i class="fas fa-exclamation-triangle"></i>
    {MESSAGES.DEFECT_SECTION_TITLE}
  </h5>

  {#each defects as defect, index (defect.id)}
    <div class="card card--compact card--no-margin">
      <div class="card__body flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="badge badge--warning">
            {MESSAGES.DEFECT_NUMBER}
            {index + 1}
          </span>
          {#if defects.length > 1}
            <button
              type="button"
              class="btn btn-danger btn-icon btn-sm"
              onclick={() => {
                removeDefect(index);
              }}
              disabled={submitting}
              aria-label={MESSAGES.DEFECT_REMOVE}
            >
              <i class="fas fa-times"></i>
            </button>
          {/if}
        </div>

        <div class="form-field">
          <label
            for="defect-title-{index}"
            class="form-field__label"
          >
            {MESSAGES.DEFECT_TITLE_LABEL}
          </label>
          <input
            id="defect-title-{index}"
            type="text"
            class="form-field__control"
            placeholder={MESSAGES.DEFECT_TITLE_PH}
            bind:value={defect.title}
            maxlength="500"
            disabled={submitting}
          />
        </div>

        <div class="form-field">
          <label
            for="defect-desc-{index}"
            class="form-field__label"
          >
            {MESSAGES.DEFECT_DESC_LABEL}
          </label>
          <textarea
            id="defect-desc-{index}"
            class="form-field__control form-field__control--textarea"
            placeholder={MESSAGES.DEFECT_DESC_PH}
            bind:value={defect.description}
            rows="2"
            maxlength="5000"
            disabled={submitting}
          ></textarea>
        </div>

        <!-- Defect Photos -->
        {#if defect.stagedPhotos.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each defect.stagedPhotos as staged, pi (staged.previewUrl)}
              <div class="photo-thumb">
                <img
                  src={staged.previewUrl}
                  alt={staged.file.name}
                  class="h-full w-full object-cover"
                />
                <button
                  type="button"
                  class="photo-thumb__remove"
                  onclick={() => {
                    removeDefectPhoto(index, pi);
                  }}
                  disabled={submitting}
                  aria-label="Mängelfoto entfernen"
                >
                  <i class="fas fa-times"></i>
                </button>
              </div>
            {/each}
          </div>
        {/if}

        {#if defect.stagedPhotos.length < MAX_PHOTOS && !submitting}
          <div class="file-upload-zone file-upload-zone--compact">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onchange={(e: Event) => {
                handleDefectFileSelect(index, e);
              }}
              class="file-upload-zone__input"
              id="defect-photo-{index}"
              disabled={submitting}
            />
            <label
              for="defect-photo-{index}"
              class="file-upload-zone__label"
            >
              <div class="file-upload-zone__icon">
                <i class="fas fa-camera"></i>
              </div>
              <div class="file-upload-zone__text">
                <p class="file-upload-zone__title">
                  {MESSAGES.DEFECT_PHOTO_ADD}
                </p>
                <p class="file-upload-zone__subtitle">
                  {MESSAGES.DEFECT_PHOTO_MAX_SIZE} · {defect.stagedPhotos
                    .length} / {MAX_PHOTOS}
                </p>
              </div>
            </label>
          </div>
        {:else if defect.stagedPhotos.length >= MAX_PHOTOS}
          <span class="text-xs text-(--color-text-muted) italic">
            {MESSAGES.DEFECT_PHOTO_MAX_REACHED}
          </span>
        {/if}
      </div>
    </div>
  {/each}

  {#if canAddDefect}
    <button
      type="button"
      class="btn btn-light btn-sm self-start"
      onclick={addDefect}
      disabled={submitting}
    >
      <i class="fas fa-plus mr-1"></i>
      {MESSAGES.DEFECT_ADD}
    </button>
  {/if}

  {#if photoError !== null}
    <span class="flex items-center gap-1.5 text-sm text-(--color-danger)">
      <i class="fas fa-exclamation-circle"></i>
      {photoError}
    </span>
  {/if}
</div>

<style>
  .photo-thumb {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-glass-border);
  }

  .photo-thumb__remove {
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

  .photo-thumb__remove:hover {
    background: var(--color-danger);
  }
</style>
