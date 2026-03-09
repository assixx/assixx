<script lang="ts">
  /**
   * LocationCard — Displays a single TPM location
   *
   * Photo thumbnail follows blackboard photo-thumbnail pattern:
   * clickable preview with role="button" + tabindex="0".
   */
  import { MESSAGES } from '../../../_lib/constants';

  import type { TpmLocation } from '../../../_lib/types';

  interface Props {
    location: TpmLocation;
    canWrite: boolean;
    onEdit: (location: TpmLocation) => void;
    onDelete: (location: TpmLocation) => void;
    onUploadPhoto: (location: TpmLocation) => void;
    onRemovePhoto: (location: TpmLocation) => void;
    onPreviewPhoto: (location: TpmLocation) => void;
  }

  const {
    location,
    canWrite,
    onEdit,
    onDelete,
    onUploadPhoto,
    onRemovePhoto,
    onPreviewPhoto,
  }: Props = $props();

  const hasPhoto = $derived(location.photoPath !== null);

  function getPhotoUrl(loc: TpmLocation): string {
    if (loc.photoPath === null) return '';
    return `/${loc.photoPath}`;
  }
</script>

<div class="card">
  <div class="card__body">
    <!-- Header row: position badge + title + actions -->
    <div class="loc-card__header">
      <span
        class="badge--count badge--count-xl badge--count-soft loc-card__position"
      >
        {location.positionNumber}
      </span>
      <div class="loc-card__info">
        <h4 class="loc-card__title">{location.title}</h4>
        {#if location.description !== null}
          <p class="loc-card__desc">{location.description}</p>
        {/if}
      </div>
      {#if canWrite}
        <div class="flex gap-2">
          <button
            type="button"
            class="action-icon action-icon--edit"
            title={MESSAGES.LOCATIONS_EDIT}
            aria-label={MESSAGES.LOCATIONS_EDIT}
            onclick={() => {
              onEdit(location);
            }}
          >
            <i class="fas fa-pen"></i>
          </button>
          <button
            type="button"
            class="action-icon action-icon--delete"
            title={MESSAGES.LOCATIONS_DELETE}
            aria-label={MESSAGES.LOCATIONS_DELETE}
            onclick={() => {
              onDelete(location);
            }}
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      {/if}
    </div>

    <!-- Photo -->
    <div class="loc-card__photo">
      {#if hasPhoto}
        <div
          class="photo-thumbnail"
          onclick={() => {
            onPreviewPhoto(location);
          }}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') onPreviewPhoto(location);
          }}
          role="button"
          tabindex="0"
        >
          <img
            src={getPhotoUrl(location)}
            alt="Standort {location.title}"
            loading="lazy"
          />
        </div>
        {#if canWrite}
          <button
            type="button"
            class="loc-card__photo-remove-btn"
            onclick={() => {
              onRemovePhoto(location);
            }}
          >
            <i class="fas fa-times mr-1"></i>
            {MESSAGES.LOCATIONS_PHOTO_REMOVE}
          </button>
        {/if}
      {:else if canWrite}
        <button
          type="button"
          class="loc-card__upload-btn"
          onclick={() => {
            onUploadPhoto(location);
          }}
        >
          <i class="fas fa-camera"></i>
          <span>{MESSAGES.LOCATIONS_PHOTO_UPLOAD}</span>
          <span class="loc-card__upload-hint"
            >{MESSAGES.LOCATIONS_PHOTO_HINT}</span
          >
        </button>
      {/if}
    </div>

    <!-- Meta -->
    {#if location.createdByName !== undefined}
      <div class="loc-card__meta">
        <i class="fas fa-user"></i>
        Erstellt von {location.createdByName}
      </div>
    {/if}
  </div>
</div>

<style>
  .loc-card__header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .loc-card__position {
    flex-shrink: 0;
  }

  .loc-card__info {
    flex: 1;
    min-width: 0;
  }

  .loc-card__title {
    font-size: 0.938rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .loc-card__desc {
    font-size: 0.813rem;
    color: var(--color-text-muted);
    margin: 0.25rem 0 0;
    white-space: pre-wrap;
    line-height: 1.5;
  }

  .loc-card__photo {
    margin-top: 0.75rem;
  }

  /* Blackboard photo-thumbnail pattern (square, fixed size) */
  .photo-thumbnail {
    cursor: pointer;
    position: relative;
    overflow: hidden;
    aspect-ratio: 1;
    width: 120px;
    border: 2px solid transparent;
    border-radius: var(--radius-xl);
    background: var(--glass-bg-active);
    transition: transform 0.2s ease;
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

  .loc-card__photo-remove-btn {
    display: flex;
    align-items: center;
    margin-top: 0.375rem;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .loc-card__photo-remove-btn:hover {
    color: var(--color-danger);
  }

  .loc-card__upload-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    padding: 1rem;
    background: none;
    border: 2px dashed var(--color-glass-border);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-size: 0.813rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .loc-card__upload-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .loc-card__upload-hint {
    font-size: 0.688rem;
    opacity: 70%;
  }

  .loc-card__meta {
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-glass-border);
    font-size: 0.75rem;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
</style>
