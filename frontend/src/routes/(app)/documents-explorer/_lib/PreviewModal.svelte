<script lang="ts">
  import { browser } from '$app/environment';
  import type { Document } from './types';
  import { MESSAGES } from './constants';
  import { formatFileSize, formatDateTime, getFileType } from './utils';

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

  const token = $derived(browser ? localStorage.getItem('accessToken') : null);
  const previewUrl = $derived.by(() => {
    if (!document) return '';
    const url = document.previewUrl ?? document.downloadUrl;
    return token !== null ? `${url}?token=${encodeURIComponent(token)}` : url;
  });
</script>

{#if show && document}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div id="preview-modal" class="modal-overlay modal-overlay--active" onclick={handleOverlayClick}>
    <div class="ds-modal ds-modal--xl" onclick={(e) => e.stopPropagation()}>
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-file-pdf mr-2 text-error-500"></i>
          <span id="preview-title">{document.filename}</span>
        </h3>
        <button class="ds-modal__close" id="preview-close" onclick={onclose} aria-label="Schließen">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body p-0">
        {#if getFileType(document) === 'pdf'}
          <iframe
            id="preview-iframe"
            src={previewUrl}
            class="block w-full h-[70vh] min-h-[600px] border-none"
            title="Dokumentenvorschau"
          ></iframe>
        {:else if getFileType(document) === 'image'}
          <div
            id="preview-image-container"
            class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-surface-1"
          >
            <img
              id="preview-image"
              src={previewUrl}
              alt={document.filename}
              class="max-w-full max-h-full object-contain block"
            />
          </div>
        {:else}
          <div
            id="preview-no-preview"
            class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-surface-1"
          >
            <div class="text-center text-content-secondary">
              <i class="fas fa-file-alt text-6xl mb-4"></i>
              <p class="text-lg">{MESSAGES.PREVIEW_NO_PREVIEW}</p>
              <p class="text-sm mt-2">{MESSAGES.PREVIEW_NO_PREVIEW_DESC}</p>
            </div>
          </div>
        {/if}

        <div class="p-4 bg-surface-2 border-t border-border-subtle">
          <div class="flex items-center gap-6 text-sm text-content-secondary">
            <span id="preview-size" class="flex items-center gap-2">
              <i class="fas fa-file-archive"></i>
              <span>{formatFileSize(document.size)}</span>
            </span>
            <span id="preview-date" class="flex items-center gap-2">
              <i class="fas fa-calendar-alt"></i>
              <span>{formatDateTime(document.uploadedAt)}</span>
            </span>
            <span id="preview-uploader" class="flex items-center gap-2">
              <i class="fas fa-user"></i>
              <span>{document.uploaderName}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="ds-modal__footer">
        <button class="btn btn-cancel" id="preview-cancel" onclick={onclose}>
          <i class="fas fa-times mr-2"></i>
          {MESSAGES.PREVIEW_CLOSE}
        </button>
        <button
          class="btn btn-modal"
          id="preview-download"
          onclick={() => document && ondownload(document)}
        >
          <i class="fas fa-download mr-2"></i>
          {MESSAGES.PREVIEW_DOWNLOAD}
        </button>
      </div>
    </div>
  </div>
{/if}
