<script lang="ts">
  /**
   * PhotoGallery — photo thumbnail grid with lightbox overlay.
   * Handles authReady hydration state and prev/next navigation.
   */

  import { onMount } from 'svelte';

  import { getAttachmentPreviewUrl } from './api';

  import type { Attachment } from './types';

  interface Props {
    /** Pre-filtered photo attachments (image/jpeg, image/jpg, image/png) */
    photos: Attachment[];
  }

  const { photos }: Props = $props();

  // Auth token ready state — triggers re-render after hydration
  // getAttachmentPreviewUrl() returns "" during SSR (no cookie yet)
  let authReady = $state(false);
  onMount(() => {
    authReady = true;
  });

  // Lightbox state (index-based for prev/next navigation)
  let lightboxIndex = $state<number | null>(null);
  const lightboxUrl = $derived(
    lightboxIndex !== null && lightboxIndex < photos.length ?
      getAttachmentPreviewUrl(photos[lightboxIndex].fileUuid)
    : null,
  );

  function openLightbox(fileUuid: string) {
    const idx = photos.findIndex((p) => p.fileUuid === fileUuid);
    lightboxIndex = idx >= 0 ? idx : null;
  }

  function closeLightbox() {
    lightboxIndex = null;
  }

  function prevImage() {
    if (lightboxIndex === null || photos.length <= 1) return;
    lightboxIndex = lightboxIndex === 0 ? photos.length - 1 : lightboxIndex - 1;
  }

  function nextImage() {
    if (lightboxIndex === null || photos.length <= 1) return;
    lightboxIndex = lightboxIndex === photos.length - 1 ? 0 : lightboxIndex + 1;
  }
</script>

<!-- Thumbnail Grid -->
<div class="photo-gallery">
  {#each photos as photo (photo.fileUuid)}
    <div
      class="photo-thumbnail"
      role="button"
      tabindex="0"
      onclick={() => {
        openLightbox(photo.fileUuid);
      }}
      onkeydown={(e) => {
        if (e.key === 'Enter') openLightbox(photo.fileUuid);
      }}
    >
      {#if authReady}
        <img
          src={getAttachmentPreviewUrl(photo.fileUuid)}
          alt={photo.fileName}
        />
      {:else}
        <div class="photo-placeholder">
          <i class="fas fa-image"></i>
        </div>
      {/if}
    </div>
  {/each}
</div>

<!-- Lightbox Overlay -->
{#if lightboxUrl !== null}
  <div
    class="lightbox active"
    role="dialog"
    aria-label="Bildvorschau"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeLightbox();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    }}
  >
    {#if photos.length > 1}
      <button
        type="button"
        class="lightbox-nav lightbox-nav--prev"
        aria-label="Vorheriges Bild"
        onclick={prevImage}
      >
        <i class="fas fa-chevron-left"></i>
      </button>
    {/if}

    <img
      src={lightboxUrl}
      alt="Vorschau"
    />

    {#if photos.length > 1}
      <button
        type="button"
        class="lightbox-nav lightbox-nav--next"
        aria-label="Nächstes Bild"
        onclick={nextImage}
      >
        <i class="fas fa-chevron-right"></i>
      </button>
    {/if}

    {#if photos.length > 1}
      <span class="lightbox-counter">
        {(lightboxIndex ?? 0) + 1} / {photos.length}
      </span>
    {/if}

    <button
      type="button"
      class="lightbox-close"
      aria-label="Schließen"
      onclick={closeLightbox}
    >
      <i class="fas fa-times"></i>
    </button>
  </div>
{/if}

<style>
  /* Photo Gallery Grid */
  .photo-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--spacing-4);
    margin-top: var(--spacing-4);
  }

  .photo-thumbnail {
    cursor: pointer;
    position: relative;
    overflow: hidden;
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: var(--radius-xl);
    background: var(--glass-bg-active);
  }

  .photo-thumbnail:hover {
    transform: scale(1.05);
    border-color: var(--primary-color);
  }

  .photo-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .photo-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 1.5rem;
    color: var(--color-text-disabled);
    background: var(--glass-bg-active);
  }

  /* Lightbox Overlay */
  .lightbox {
    cursor: pointer;
    position: fixed;
    z-index: 2000;
    top: 0;
    left: 0;
    display: none;
    width: 100%;
    height: 100%;
    background: rgb(0 0 0 / 90%);
  }

  .lightbox.active {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lightbox img {
    max-width: 90%;
    max-height: 90%;
    object-fit: contain;
  }

  .lightbox-close {
    cursor: pointer;
    position: absolute;
    top: 20px;
    right: 40px;
    font-size: 2rem;
    color: #fff;
  }

  .lightbox-close:hover {
    transform: scale(1.2);
  }

  .lightbox-nav {
    cursor: pointer;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    padding: 0;
    font-size: 1.5rem;
    color: #fff;
    background: rgb(255 255 255 / 15%);
    border: none;
    border-radius: 50%;
    transition:
      background 0.2s,
      transform 0.2s;
  }

  .lightbox-nav:hover {
    background: rgb(255 255 255 / 30%);
    transform: translateY(-50%) scale(1.1);
  }

  .lightbox-nav--prev {
    left: 24px;
  }

  .lightbox-nav--next {
    right: 24px;
  }

  .lightbox-counter {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 12px;
    font-size: 0.875rem;
    color: #fff;
    background: rgb(0 0 0 / 50%);
    border-radius: 12px;
  }
</style>
