<script lang="ts">
  /**
   * PhotoGallery — Photo grid + upload + delete + ds-modal preview.
   * Uses invalidateAll() after upload/delete to refresh SSR data.
   * Preview pattern: ds-modal (matches TPM card, KVP detail, blackboard)
   *
   * Delete permissions:
   *   - admin/root: can delete ANY photo
   *   - employee: can only delete own uploads (uploadedBy === userId)
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import { deletePhoto, uploadPhoto, logApiError } from '../../_lib/api';
  import { MESSAGES } from '../../_lib/constants';

  import type { WorkOrderPhoto } from '../../_lib/types';

  const MAX_PHOTOS = 10;
  const MAX_FILE_SIZE = 5_242_880;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  interface Props {
    photos: WorkOrderPhoto[];
    uuid: string;
    userRole: string;
    userId: number;
  }

  const { photos, uuid, userRole, userId }: Props = $props();

  let uploading = $state(false);
  let deleting = $state(false);
  let showPreview = $state(false);
  let previewIndex = $state(0);
  let fileInput: HTMLInputElement | undefined = $state();

  const canUpload = $derived(photos.length < MAX_PHOTOS);
  const currentPhoto = $derived(
    showPreview && photos.length > 0 ? photos[previewIndex] : null,
  );
  const hasNavigation = $derived(photos.length > 1);
  const isPrivileged = $derived(userRole === 'root' || userRole === 'admin');

  function canDeletePhoto(photo: WorkOrderPhoto): boolean {
    return isPrivileged || photo.uploadedBy === userId;
  }

  /** Build authenticated photo URL via API endpoint (like KVP pattern) */
  function buildPhotoUrl(photoUuid: string): string {
    return `/api/v2/work-orders/${uuid}/photos/${photoUuid}/file`;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }

  function openPreview(index: number): void {
    previewIndex = index;
    showPreview = true;
  }

  function closePreview(): void {
    showPreview = false;
  }

  function prevPhoto(): void {
    if (!hasNavigation) return;
    previewIndex = previewIndex === 0 ? photos.length - 1 : previewIndex - 1;
  }

  function nextPhoto(): void {
    if (!hasNavigation) return;
    previewIndex = previewIndex === photos.length - 1 ? 0 : previewIndex + 1;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!showPreview) return;
    if (event.key === 'Escape') closePreview();
    if (event.key === 'ArrowLeft') prevPhoto();
    if (event.key === 'ArrowRight') nextPhoto();
  }

  function stopPropagation(e: Event): void {
    e.stopPropagation();
  }

  function downloadPhoto(): void {
    if (currentPhoto === null) return;
    window.open(buildPhotoUrl(currentPhoto.uuid), '_blank');
  }

  function triggerUpload(): void {
    fileInput?.click();
  }

  async function handleFileSelect(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file === undefined) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      showErrorAlert(MESSAGES.PHOTOS_INVALID_TYPE);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showErrorAlert(MESSAGES.PHOTOS_TOO_LARGE);
      return;
    }

    uploading = true;
    try {
      await uploadPhoto(uuid, file);
      showSuccessAlert(MESSAGES.PHOTOS_SUCCESS);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('uploadPhoto', err);
      showErrorAlert(MESSAGES.PHOTOS_ERROR);
    } finally {
      uploading = false;
      target.value = '';
    }
  }

  async function handleDeletePhoto(photo: WorkOrderPhoto): Promise<void> {
    if (!confirm(MESSAGES.PHOTOS_DELETE_CONFIRM)) return;

    deleting = true;
    try {
      await deletePhoto(uuid, photo.uuid);
      showSuccessAlert(MESSAGES.PHOTOS_DELETE_SUCCESS);
      closePreview();
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('deletePhoto', err);
      showErrorAlert(MESSAGES.PHOTOS_DELETE_ERROR);
    } finally {
      deleting = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="photo-section">
  <h4 class="section-title">
    <i class="fas fa-camera mr-2"></i>
    {MESSAGES.PHOTOS_HEADING}
    {#if photos.length > 0}
      <span class="badge badge--count ml-2">{photos.length}</span>
    {/if}
  </h4>

  <!-- Upload button -->
  {#if canUpload}
    <button
      type="button"
      class="btn btn-light btn--sm mb-4"
      disabled={uploading}
      onclick={triggerUpload}
    >
      {#if uploading}
        <i class="fas fa-spinner fa-spin"></i>
        {MESSAGES.PHOTOS_UPLOADING}
      {:else}
        <i class="fas fa-plus"></i>
        {MESSAGES.PHOTOS_ADD}
      {/if}
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      onchange={handleFileSelect}
    />
  {:else}
    <p class="photo-max-hint">{MESSAGES.PHOTOS_MAX_REACHED}</p>
  {/if}

  <!-- Photo grid -->
  {#if photos.length === 0}
    <p class="photo-empty">{MESSAGES.PHOTOS_EMPTY}</p>
  {:else}
    <div class="photo-grid">
      {#each photos as photo, index (photo.uuid)}
        <div class="photo-thumbnail-wrapper">
          <div
            class="photo-thumbnail"
            role="button"
            tabindex="0"
            onclick={() => {
              openPreview(index);
            }}
            onkeydown={(e: KeyboardEvent) => {
              if (e.key === 'Enter') openPreview(index);
            }}
          >
            <img
              src={buildPhotoUrl(photo.uuid)}
              alt={photo.fileName}
              loading="lazy"
            />
          </div>
          {#if canDeletePhoto(photo)}
            <button
              type="button"
              class="photo-delete-btn"
              onclick={() => {
                void handleDeletePhoto(photo);
              }}
              disabled={deleting}
              aria-label="Foto löschen"
            >
              <i class="fas fa-trash-alt"></i>
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Preview Modal (ds-modal pattern — matches TPM, KVP, blackboard) -->
{#if showPreview && currentPhoto !== null}
  <div
    class="modal-overlay modal-overlay--active"
    onclick={closePreview}
    onkeydown={(e) => {
      if (e.key === 'Escape') closePreview();
    }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal ds-modal--lg"
      style="max-height: 95vh;"
      onclick={stopPropagation}
      onkeydown={stopPropagation}
      role="document"
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-image text-success-500 mr-2"></i>
          {currentPhoto.fileName}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          onclick={closePreview}
          aria-label="Schließen"><i class="fas fa-times"></i></button
        >
      </div>
      <div class="ds-modal__body p-0">
        <div
          class="flex h-[80vh] min-h-[600px] w-full items-center justify-center bg-(--surface-1)"
        >
          <img
            src={buildPhotoUrl(currentPhoto.uuid)}
            alt={currentPhoto.fileName}
            class="max-h-full max-w-full object-contain"
          />
        </div>
        <div class="border-t border-(--border-subtle) bg-(--surface-2) p-4">
          <div
            class="flex items-center gap-6 text-sm text-(--color-text-secondary)"
          >
            <span class="flex items-center gap-2">
              <i class="fas fa-file-archive"></i>
              {formatFileSize(currentPhoto.fileSize)}
            </span>
            <span class="flex items-center gap-2">
              <i class="fas fa-file-image"></i>
              {currentPhoto.fileName}
            </span>
          </div>
        </div>
      </div>
      <div class="ds-modal__footer">
        {#if canDeletePhoto(currentPhoto)}
          <button
            type="button"
            class="btn btn-danger btn--sm"
            disabled={deleting}
            onclick={() => {
              void handleDeletePhoto(currentPhoto);
            }}
          >
            {#if deleting}
              <i class="fas fa-spinner fa-spin mr-2"></i>
              {MESSAGES.PHOTOS_DELETING}
            {:else}
              <i class="fas fa-trash-alt mr-2"></i>Löschen
            {/if}
          </button>
        {/if}
        <div class="ml-auto flex gap-2">
          <button
            type="button"
            class="btn btn-cancel"
            onclick={closePreview}
            ><i class="fas fa-times mr-2"></i>Schließen</button
          >
          <button
            type="button"
            class="btn btn-primary"
            onclick={downloadPhoto}
            ><i class="fas fa-download mr-2"></i>Herunterladen</button
          >
        </div>
      </div>
    </div>
    {#if hasNavigation}
      <button
        type="button"
        class="absolute top-1/2 left-6 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-xl text-white transition-colors hover:bg-white/30"
        onclick={(e) => {
          e.stopPropagation();
          prevPhoto();
        }}
        aria-label="Vorheriges Foto"
      >
        <i class="fas fa-chevron-left"></i>
      </button>
      <button
        type="button"
        class="absolute top-1/2 right-6 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-xl text-white transition-colors hover:bg-white/30"
        onclick={(e) => {
          e.stopPropagation();
          nextPhoto();
        }}
        aria-label="Nächstes Foto"
      >
        <i class="fas fa-chevron-right"></i>
      </button>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-black/50 px-3 py-1 text-sm text-white"
        onclick={(e) => {
          e.stopPropagation();
        }}
      >
        {previewIndex + 1} / {photos.length}
      </div>
    {/if}
  </div>
{/if}

<style>
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.75rem;
  }

  .photo-thumbnail-wrapper {
    position: relative;
  }

  .photo-thumbnail {
    cursor: pointer;
    position: relative;
    overflow: hidden;
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: var(--radius-xl, 0.75rem);
    background: var(--glass-bg-active, #f8f9fa);
    transition:
      transform 0.2s ease,
      border-color 0.2s ease;
  }

  .photo-thumbnail:hover {
    transform: scale(1.02);
    border-color: var(--color-primary);
  }

  .photo-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .photo-delete-btn {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgb(239 68 68 / 85%);
    color: #fff;
    font-size: 0.7rem;
    cursor: pointer;
    opacity: 0;
    transition:
      opacity 0.15s ease,
      background 0.15s ease;
  }

  .photo-thumbnail-wrapper:hover .photo-delete-btn {
    opacity: 1;
  }

  .photo-delete-btn:hover {
    background: rgb(220 38 38);
  }

  .photo-delete-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .photo-empty,
  .photo-max-hint {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .hidden {
    display: none;
  }
</style>
