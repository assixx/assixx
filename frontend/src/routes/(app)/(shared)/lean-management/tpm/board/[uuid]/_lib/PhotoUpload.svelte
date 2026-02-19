<script lang="ts">
  /**
   * PhotoUpload — File upload for execution photos.
   * Max 5 photos, each max 5 MB. Only images (JPG, PNG, WebP).
   * Shows preview thumbnails after upload.
   */
  import { uploadPhoto, logApiError } from '../../../_lib/api';
  import { MESSAGES } from '../../../_lib/constants';

  import type { TpmExecutionPhoto } from '../../../_lib/types';

  const MAX_PHOTOS = 5;
  const MAX_FILE_SIZE = 5_242_880;
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  interface Props {
    executionUuid: string;
    photos: TpmExecutionPhoto[];
    onPhotoAdded: (photo: TpmExecutionPhoto) => void;
  }

  const { executionUuid, photos, onPhotoAdded }: Props = $props();

  let uploading = $state(false);
  let error = $state<string | null>(null);

  const canUpload = $derived(photos.length < MAX_PHOTOS && !uploading);

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) return MESSAGES.PHOTO_INVALID_TYPE;
    if (file.size > MAX_FILE_SIZE) return MESSAGES.PHOTO_TOO_LARGE;
    return null;
  }

  async function handleFileSelect(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file === undefined) return;

    const validationError = validateFile(file);
    if (validationError !== null) {
      error = validationError;
      input.value = '';
      return;
    }

    error = null;
    uploading = true;
    try {
      const photo = await uploadPhoto(executionUuid, file);
      onPhotoAdded(photo);
    } catch (err: unknown) {
      logApiError('uploadPhoto', err);
      error = MESSAGES.PHOTO_ERROR;
    } finally {
      uploading = false;
      input.value = '';
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${String(bytes)} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }
</script>

<div class="photo-upload">
  <div class="photo-upload__header">
    <h4 class="photo-upload__title">
      <i class="fas fa-camera"></i>
      {MESSAGES.PHOTO_HEADING}
      <span class="photo-upload__count">{photos.length} / {MAX_PHOTOS}</span>
    </h4>
  </div>

  <!-- Thumbnails -->
  {#if photos.length > 0}
    <div class="photo-upload__grid">
      {#each photos as photo (photo.uuid)}
        <div class="photo-upload__thumb">
          <img
            src="/api/v2/{photo.filePath}"
            alt={photo.fileName}
            class="photo-upload__img"
            loading="lazy"
          />
          <span class="photo-upload__size">
            {formatFileSize(photo.fileSize)}
          </span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Upload button -->
  {#if canUpload}
    <label class="photo-upload__add">
      <i class="fas fa-plus"></i>
      {MESSAGES.PHOTO_ADD}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onchange={handleFileSelect}
        class="photo-upload__input"
        disabled={uploading}
      />
    </label>
    <span class="photo-upload__hint">{MESSAGES.PHOTO_MAX_SIZE}</span>
  {:else if photos.length >= MAX_PHOTOS}
    <span class="photo-upload__limit">{MESSAGES.PHOTO_MAX_REACHED}</span>
  {/if}

  {#if uploading}
    <span class="photo-upload__uploading">
      <i class="fas fa-spinner fa-spin"></i>
      {MESSAGES.PHOTO_UPLOADING}
    </span>
  {/if}

  {#if error !== null}
    <span class="photo-upload__error">
      <i class="fas fa-exclamation-circle"></i>
      {error}
    </span>
  {/if}
</div>

<style>
  .photo-upload {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .photo-upload__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .photo-upload__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.813rem;
    font-weight: 600;
    color: var(--color-gray-700);
    margin: 0;
  }

  .photo-upload__count {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--color-gray-400);
  }

  /* Thumbnail grid */
  .photo-upload__grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .photo-upload__thumb {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: var(--radius-md, 8px);
    overflow: hidden;
    border: 1px solid var(--color-gray-200);
  }

  .photo-upload__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .photo-upload__size {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    font-size: 0.563rem;
    text-align: center;
    padding: 0.125rem;
    background: rgb(0 0 0 / 60%);
    color: #fff;
  }

  /* Add button (styled label) */
  .photo-upload__add {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border: 1px dashed var(--color-gray-300);
    border-radius: var(--radius-md, 8px);
    font-size: 0.813rem;
    color: var(--color-gray-500);
    cursor: pointer;
    transition: border-color 0.15s ease;
    align-self: flex-start;
  }

  .photo-upload__add:hover {
    border-color: var(--color-primary-400);
    color: var(--color-primary-600);
  }

  .photo-upload__input {
    display: none;
  }

  .photo-upload__hint {
    font-size: 0.688rem;
    color: var(--color-gray-400);
  }

  .photo-upload__limit {
    font-size: 0.75rem;
    color: var(--color-gray-400);
    font-style: italic;
  }

  .photo-upload__uploading {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.813rem;
    color: var(--color-primary-600);
  }

  .photo-upload__error {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.813rem;
    color: var(--color-danger, #ef4444);
  }
</style>
