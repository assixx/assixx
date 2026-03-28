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
  const isImage = $derived(image?.mimeType === undefined || image.mimeType.startsWith('image/'));

  function handleDownload(): void {
    if (image === null) return;

    const link = document.createElement('a');
    link.href = image.src;
    link.download = image.alt;
    link.click();
  }
</script>

{#if show && image !== null}
  <div
    id="chat-image-preview-modal"
    class="modal-overlay modal-overlay--active"
  >
    <div class="ds-modal ds-modal--lg">
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          {#if isPdf}
            <i class="fas fa-file-pdf text-error-500 mr-2"></i>
          {:else}
            <i class="fas fa-image mr-2"></i>
          {/if}
          {image.alt}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={onclose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body p-0">
        {#if isPdf}
          <iframe
            src={image.src}
            class="block h-[70vh] min-h-[600px] w-full border-none"
            title="Dokumentenvorschau"
          ></iframe>
        {:else if isImage}
          <div class="bg-surface-1 flex h-[70vh] min-h-[600px] w-full items-center justify-center">
            <img
              src={image.src}
              class="max-h-full max-w-full object-contain"
              alt={image.alt}
            />
          </div>
        {:else}
          <div class="bg-surface-1 flex h-[70vh] min-h-[600px] w-full items-center justify-center">
            <div class="text-content-secondary text-center">
              <i class="fas fa-file-alt mb-4 text-6xl"></i>
              <p class="text-lg">Keine Vorschau verfügbar</p>
              <p class="mt-2 text-sm">Bitte laden Sie die Datei herunter, um sie anzuzeigen.</p>
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
          Schließen
        </button>
        <button
          type="button"
          class="btn btn-primary"
          onclick={handleDownload}
        >
          <i class="fas fa-download mr-2"></i>
          Herunterladen
        </button>
      </div>
    </div>
  </div>
{/if}
