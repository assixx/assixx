<script lang="ts">
  /**
   * ImageCropModal - Profile Picture Crop Component
   * @module root-profile/_lib/ImageCropModal
   *
   * Uses svelte-easy-crop for image cropping functionality.
   * Design system modal pattern applied.
   */
  import Cropper from 'svelte-easy-crop';

  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('ImageCropModal');

  interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  interface Props {
    /** Whether the modal is visible */
    show: boolean;
    /** Image source URL (from file or existing picture) */
    imageSrc: string | null;
    /** Callback when modal is closed */
    onclose: () => void;
    /** Callback when crop is applied - receives cropped image blob */
    onsave: (blob: Blob) => void;
  }

  const { show, imageSrc, onclose, onsave }: Props = $props();

  // Crop state
  let crop = $state({ x: 0, y: 0 });
  let zoom = $state(1);
  let croppedAreaPixels = $state<CropArea | null>(null);
  let saving = $state(false);

  // Reset state when modal opens
  $effect(() => {
    if (show) {
      crop = { x: 0, y: 0 };
      zoom = 1;
      croppedAreaPixels = null;
      saving = false;
    }
  });

  /**
   * Handle crop complete event from Cropper
   */
  function handleCropComplete(event: {
    pixels: CropArea;
    percent: CropArea;
  }): void {
    croppedAreaPixels = event.pixels;
  }

  /**
   * Create cropped image from source and crop area
   */
  async function createCroppedImage(
    src: string,
    pixelCrop: CropArea,
  ): Promise<Blob> {
    const image = new Image();
    image.crossOrigin = 'anonymous';

    return await new Promise((resolve, reject) => {
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (ctx === null) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set canvas size to crop size
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        // Draw cropped area
        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          pixelCrop.width,
          pixelCrop.height,
        );

        // Convert to blob (JPEG for smaller file size)
        canvas.toBlob(
          (blob) => {
            if (blob !== null) {
              resolve(blob);
            } else {
              reject(new Error('Could not create blob'));
            }
          },
          'image/jpeg',
          0.9,
        );
      };

      image.onerror = () => {
        reject(new Error('Could not load image'));
      };

      image.src = src;
    });
  }

  /**
   * Apply crop and save
   */
  async function handleSave(): Promise<void> {
    if (imageSrc === null || croppedAreaPixels === null) return;

    saving = true;

    try {
      const croppedBlob = await createCroppedImage(imageSrc, croppedAreaPixels);
      onsave(croppedBlob);
    } catch (err: unknown) {
      log.error({ err }, 'Error cropping image');
    } finally {
      saving = false;
    }
  }

  /**
   * Handle overlay click (close modal)
   */
  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      onclose();
    }
  }

  /**
   * Handle escape key
   */
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && show) {
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show && imageSrc !== null}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    id="image-crop-modal"
    class="modal-overlay modal-overlay--active"
    onclick={handleOverlayClick}
  >
    <div
      class="ds-modal ds-modal--md"
      onclick={(e) => {
        e.stopPropagation();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
      tabindex="-1"
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="crop-modal-title"
        >
          <i class="fas fa-crop-alt mr-2"></i>
          Bild zuschneiden
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={onclose}
          disabled={saving}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body crop-modal-body">
        <!-- Cropper Container -->
        <div class="crop-container">
          <Cropper
            image={imageSrc}
            bind:crop
            bind:zoom
            aspect={1}
            cropShape="round"
            showGrid={false}
            oncropcomplete={handleCropComplete}
          />
        </div>

        <!-- Zoom Control -->
        <div class="zoom-control">
          <label
            class="zoom-label"
            for="zoom-slider"
          >
            <i class="fas fa-search-minus"></i>
          </label>
          <input
            type="range"
            id="zoom-slider"
            class="zoom-slider"
            min="1"
            max="3"
            step="0.1"
            bind:value={zoom}
          />
          <label
            class="zoom-label"
            for="zoom-slider"
          >
            <i class="fas fa-search-plus"></i>
          </label>
        </div>

        <p class="crop-hint">
          <i class="fas fa-info-circle mr-1"></i>
          Ziehen Sie das Bild zum Positionieren. Nutzen Sie den Regler zum Zoomen.
        </p>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}
          disabled={saving}
        >
          <i class="fas fa-times mr-2"></i>
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-primary"
          onclick={handleSave}
          disabled={saving || croppedAreaPixels === null}
        >
          {#if saving}
            <span class="spinner-ring spinner-ring--sm mr-2"></span>
            Wird verarbeitet...
          {:else}
            <i class="fas fa-check mr-2"></i>
            Zuschneiden
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .crop-modal-body {
    padding: 0 !important;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .crop-container {
    position: relative;
    width: 100%;
    height: 350px;
    background: var(--background-secondary, #1a1a1a);
  }

  .zoom-control {
    display: flex;
    align-items: center;
    gap: var(--spacing-3, 12px);
    padding: var(--spacing-4, 16px) var(--spacing-6, 24px);
    background: color-mix(in oklch, var(--color-black) 20%, transparent);
    border-top: 1px solid
      color-mix(in oklch, var(--color-white) 8%, transparent);
  }

  .zoom-label {
    color: var(--color-text-secondary, #9ca3af);
    font-size: 0.875rem;
  }

  .zoom-slider {
    flex: 1;
    height: 6px;
    appearance: none;
    background: color-mix(in oklch, var(--color-white) 10%, transparent);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
  }

  .zoom-slider::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-primary, #3b82f6);
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .zoom-slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  .zoom-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 50%;
    background: var(--color-primary, #3b82f6);
    cursor: pointer;
  }

  .crop-hint {
    padding: var(--spacing-3, 12px) var(--spacing-6, 24px);
    margin: 0;
    color: var(--color-text-secondary, #9ca3af);
    font-size: 0.813rem;
    text-align: center;
    background: color-mix(in oklch, var(--color-black) 10%, transparent);
  }

  /* Responsive */
  @media (width <= 480px) {
    .crop-container {
      height: 280px;
    }

    .zoom-control {
      padding: var(--spacing-3, 12px) var(--spacing-4, 16px);
    }

    .crop-hint {
      padding: var(--spacing-2, 8px) var(--spacing-4, 16px);
      font-size: 0.75rem;
    }
  }
</style>
