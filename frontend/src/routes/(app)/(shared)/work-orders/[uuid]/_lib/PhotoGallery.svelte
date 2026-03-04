<script lang="ts">
  /**
   * PhotoGallery — Photo grid + upload + lightbox preview.
   * Uses invalidateAll() after upload to refresh SSR data.
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import { uploadPhoto, logApiError } from '../../_lib/api';
  import { MESSAGES } from '../../_lib/constants';

  import type { WorkOrderPhoto } from '../../_lib/types';

  const MAX_PHOTOS = 10;
  const MAX_FILE_SIZE = 5_242_880;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const API_BASE = '/api/v2';

  interface Props {
    photos: WorkOrderPhoto[];
    uuid: string;
  }

  const { photos, uuid }: Props = $props();

  let uploading = $state(false);
  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);
  let fileInput: HTMLInputElement | undefined = $state();

  const canUpload = $derived(photos.length < MAX_PHOTOS);
  const currentPhoto = $derived(
    lightboxOpen && photos.length > 0 ? photos[lightboxIndex] : null,
  );

  function buildPhotoUrl(filePath: string): string {
    return `${API_BASE}/${filePath}`;
  }

  function openLightbox(index: number): void {
    lightboxIndex = index;
    lightboxOpen = true;
  }

  function closeLightbox(): void {
    lightboxOpen = false;
  }

  function prevPhoto(): void {
    if (photos.length <= 1) return;
    lightboxIndex = lightboxIndex === 0 ? photos.length - 1 : lightboxIndex - 1;
  }

  function nextPhoto(): void {
    if (photos.length <= 1) return;
    lightboxIndex = lightboxIndex === photos.length - 1 ? 0 : lightboxIndex + 1;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!lightboxOpen) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') prevPhoto();
    if (event.key === 'ArrowRight') nextPhoto();
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
        <div
          class="photo-thumbnail"
          role="button"
          tabindex="0"
          onclick={() => {
            openLightbox(index);
          }}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') openLightbox(index);
          }}
        >
          <img
            src={buildPhotoUrl(photo.filePath)}
            alt={photo.fileName}
            loading="lazy"
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Lightbox -->
{#if lightboxOpen && currentPhoto !== null}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={closeLightbox}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
    }}
  >
    <div
      class="lightbox"
      role="presentation"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        class="lightbox__close"
        onclick={closeLightbox}
        aria-label="Schließen"
      >
        <i class="fas fa-times"></i>
      </button>

      <img
        src={buildPhotoUrl(currentPhoto.filePath)}
        alt={currentPhoto.fileName}
        class="lightbox__image"
      />

      {#if photos.length > 1}
        <button
          type="button"
          class="lightbox__nav lightbox__nav--prev"
          onclick={prevPhoto}
          aria-label="Vorheriges Foto"
        >
          <i class="fas fa-chevron-left"></i>
        </button>
        <button
          type="button"
          class="lightbox__nav lightbox__nav--next"
          onclick={nextPhoto}
          aria-label="Nächstes Foto"
        >
          <i class="fas fa-chevron-right"></i>
        </button>
        <span class="lightbox__counter">
          {lightboxIndex + 1} / {photos.length}
        </span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.75rem;
  }

  .photo-thumbnail {
    cursor: pointer;
    position: relative;
    overflow: hidden;
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: var(--radius-md, 0.5rem);
    background: var(--color-bg-secondary, #f8f9fa);
    transition:
      transform 0.15s ease,
      border-color 0.15s ease;
  }

  .photo-thumbnail:hover {
    transform: scale(1.05);
    border-color: var(--color-primary);
  }

  .photo-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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

  /* Lightbox */
  .lightbox {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 90vw;
    max-height: 90vh;
  }

  .lightbox__image {
    max-width: 100%;
    max-height: 85vh;
    object-fit: contain;
    border-radius: var(--radius-md, 0.5rem);
  }

  .lightbox__close {
    position: absolute;
    top: -2.5rem;
    right: 0;
    background: none;
    border: none;
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
  }

  .lightbox__nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgb(0 0 0 / 50%);
    border: none;
    color: #fff;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.75rem;
    border-radius: 50%;
    transition: background 0.15s ease;
  }

  .lightbox__nav:hover {
    background: rgb(0 0 0 / 75%);
  }

  .lightbox__nav--prev {
    left: -3rem;
  }

  .lightbox__nav--next {
    right: -3rem;
  }

  .lightbox__counter {
    position: absolute;
    bottom: -2rem;
    left: 50%;
    transform: translateX(-50%);
    background: rgb(0 0 0 / 60%);
    color: #fff;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.813rem;
    font-weight: 600;
    white-space: nowrap;
  }

  @media (width <= 640px) {
    .lightbox__nav--prev {
      left: 0.5rem;
    }

    .lightbox__nav--next {
      right: 0.5rem;
    }
  }
</style>
