<script lang="ts">
  interface PreviewFile {
    src: string;
    alt: string;
    /** MIME type for determining preview method (image vs pdf) */
    mimeType?: string;
  }

  interface Props {
    show: boolean;
    image: PreviewFile | null;
    onclose: () => void;
  }

  const { show, image, onclose }: Props = $props();

  /** Determine if the file is a PDF based on mimeType */
  const isPdf = $derived(image?.mimeType === 'application/pdf');
  /** Determine if the file is an image based on mimeType or default behavior */
  const isImage = $derived(
    image?.mimeType === undefined || image.mimeType.startsWith('image/'),
  );

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      onclose();
    }
  }

  function handleDownload(): void {
    if (image === null) return;

    const link = document.createElement('a');
    link.href = image.src;
    link.download = image.alt;
    link.click();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show && image !== null}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay modal-overlay--active"
    onclick={handleOverlayClick}
  >
    <div
      class="ds-modal ds-modal--xl"
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          {#if isPdf}
            <i class="fas fa-file-pdf mr-2 text-error-500"></i>
          {:else}
            <i class="fas fa-image mr-2"></i>
          {/if}
          {image.alt}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schliessen"
          onclick={onclose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body p-0">
        {#if isPdf}
          <iframe
            src={image.src}
            class="block w-full h-[70vh] min-h-[600px] border-none"
            title="Dokumentenvorschau"
          ></iframe>
        {:else if isImage}
          <div
            class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-surface-1"
          >
            <img
              src={image.src}
              class="max-w-full max-h-full object-contain"
              alt={image.alt}
            />
          </div>
        {:else}
          <div
            class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-surface-1"
          >
            <div class="text-center text-content-secondary">
              <i class="fas fa-file-alt text-6xl mb-4"></i>
              <p class="text-lg">Keine Vorschau verfügbar</p>
              <p class="text-sm mt-2">
                Bitte laden Sie die Datei herunter, um sie anzuzeigen.
              </p>
            </div>
          </div>
        {/if}
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}
        >
          <i class="fas fa-times mr-2"></i>
          Schliessen
        </button>
        <button
          type="button"
          class="btn btn-modal"
          onclick={handleDownload}
        >
          <i class="fas fa-download mr-2"></i>
          Herunterladen
        </button>
      </div>
    </div>
  </div>
{/if}
