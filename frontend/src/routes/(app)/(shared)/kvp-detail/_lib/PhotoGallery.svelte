<script lang="ts">
  /**
   * PhotoGallery — photo thumbnail grid (no lightbox).
   * Delegates click to parent via callback for unified preview modal.
   */

  import { onMount } from 'svelte';

  import { getAttachmentPreviewUrl } from './api';

  import type { Attachment } from './types';

  interface Props {
    /** Pre-filtered photo attachments */
    photos: Attachment[];
    /** Called when a photo thumbnail is clicked */
    onphotoclick: (photo: Attachment) => void;
  }

  const { photos, onphotoclick }: Props = $props();

  /** Auth cookie ready — prevents broken img src during SSR */
  let authReady = $state(false);
  onMount(() => {
    authReady = true;
  });
</script>

<div class="photo-gallery">
  {#each photos as photo, index (photo.fileUuid)}
    <div
      class="photo-thumbnail"
      role="button"
      tabindex="0"
      onclick={() => {
        onphotoclick(photo);
      }}
      onkeydown={(e) => {
        if (e.key === 'Enter') onphotoclick(photo);
      }}
    >
      {#if authReady}
        <img
          src={getAttachmentPreviewUrl(photo.fileUuid)}
          alt={photo.fileName}
          loading="lazy"
        />
      {:else}
        <div class="photo-placeholder">
          <i class="fas fa-image"></i>
        </div>
      {/if}
      {#if index === 0 && photos.length > 1}
        <span class="photo-count">{photos.length} Fotos</span>
      {/if}
    </div>
  {/each}
</div>

<style>
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

  .photo-count {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #fff;
    background: rgb(0 0 0 / 70%);
  }
</style>
