<script lang="ts">
  import { MESSAGES } from './constants';
  import { formatFileSize, formatDateTime, getFileType } from './utils';

  import type { Document } from './types';

  interface Props {
    show: boolean;
    document: Document | null;
    onclose: () => void;
    ondownload: (doc: Document) => void;
  }

  const { show, document, onclose, ondownload }: Props = $props();

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  // Cookie-based auth: accessToken cookie sent automatically on same-origin request
  // No token in URL = no token in logs/history
  const previewUrl = $derived.by(() => {
    if (!document) return '';
    return document.previewUrl ?? document.downloadUrl;
  });
</script>

{#if show && document}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    id="preview-modal"
    class="modal-overlay modal-overlay--active"
    onclick={handleOverlayClick}
  >
    <div
      class="ds-modal ds-modal--lg"
      style="max-height: 95vh"
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-file-pdf text-error-500 mr-2"></i>
          <span id="preview-title">{document.filename}</span>
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          id="preview-close"
          onclick={onclose}
          aria-label="Schließen"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body p-0">
        {#if getFileType(document) === 'pdf'}
          <iframe
            id="preview-iframe"
            src={previewUrl}
            class="block h-[80vh] min-h-[600px] w-full border-none"
            title="Dokumentenvorschau"
          ></iframe>
        {:else if getFileType(document) === 'image'}
          <div
            id="preview-image-container"
            class="bg-surface-1 flex h-[80vh] min-h-[600px] w-full items-center justify-center"
          >
            <img
              id="preview-image"
              src={previewUrl}
              alt={document.filename}
              class="block max-h-full max-w-full object-contain"
            />
          </div>
        {:else}
          <div
            id="preview-no-preview"
            class="bg-surface-1 flex h-[80vh] min-h-[600px] w-full items-center justify-center"
          >
            <div class="text-content-secondary text-center">
              <i class="fas fa-file-alt mb-4 text-6xl"></i>
              <p class="text-lg">{MESSAGES.PREVIEW_NO_PREVIEW}</p>
              <p class="mt-2 text-sm">{MESSAGES.PREVIEW_NO_PREVIEW_DESC}</p>
            </div>
          </div>
        {/if}

        <div class="bg-surface-2 border-border-subtle border-t p-4">
          <div class="text-content-secondary flex items-center gap-6 text-sm">
            <span
              id="preview-size"
              class="flex items-center gap-2"
            >
              <i class="fas fa-file-archive"></i>
              <span>{formatFileSize(document.size)}</span>
            </span>
            <span
              id="preview-date"
              class="flex items-center gap-2"
            >
              <i class="fas fa-calendar-alt"></i>
              <span>{formatDateTime(document.uploadedAt)}</span>
            </span>
            <span
              id="preview-uploader"
              class="flex items-center gap-2"
            >
              <i class="fas fa-user"></i>
              <span>{document.uploaderName}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          id="preview-cancel"
          onclick={onclose}
        >
          <i class="fas fa-times mr-2"></i>
          {MESSAGES.PREVIEW_CLOSE}
        </button>
        <button
          type="button"
          class="btn btn-modal"
          id="preview-download"
          onclick={() => {
            ondownload(document);
          }}
        >
          <i class="fas fa-download mr-2"></i>
          {MESSAGES.PREVIEW_DOWNLOAD}
        </button>
      </div>
    </div>
  </div>
{/if}
