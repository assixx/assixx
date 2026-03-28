<script lang="ts">
  /**
   * AttachmentPreviewModal - File Preview with Download
   *
   * Displays image, PDF, or generic file preview in a modal overlay.
   * Handles download internally via window.open().
   *
   * Pattern: Controlled component (parent manages show/attachment state)
   */
  import { buildDownloadUrl } from './api';
  import { formatFileSize, getPreviewFileType } from './utils';

  import type { PreviewAttachment } from './types';

  interface Props {
    show: boolean;
    attachment: PreviewAttachment | null;
    onclose: () => void;
    onprev?: () => void;
    onnext?: () => void;
    currentIndex?: number;
    totalCount?: number;
  }

  const { show, attachment, onclose, onprev, onnext, currentIndex, totalCount }: Props = $props();

  const hasNavigation = $derived(
    onprev !== undefined && onnext !== undefined && totalCount !== undefined && totalCount > 1,
  );

  /** Open download URL in new tab */
  function downloadFile(): void {
    if (attachment === null) return;
    window.open(buildDownloadUrl(attachment.downloadUrl), '_blank');
  }
</script>

{#if show && attachment !== null}
  <div
    id="blackboard-attachment-preview-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
  >
    <div
      class="ds-modal ds-modal--lg"
      style="max-height: 95vh;"
      role="document"
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          {#if getPreviewFileType(attachment.mimeType) === 'pdf'}<i
              class="fas fa-file-pdf text-error-500 mr-2"
            ></i>
          {:else if getPreviewFileType(attachment.mimeType) === 'image'}<i
              class="fas fa-image text-success-500 mr-2"
            ></i>
          {:else}<i class="fas fa-file mr-2"></i>{/if}
          {attachment.filename}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          onclick={onclose}
          aria-label="Schließen"><i class="fas fa-times"></i></button
        >
      </div>
      <div class="ds-modal__body p-0">
        {#if getPreviewFileType(attachment.mimeType) === 'pdf'}
          <iframe
            src={buildDownloadUrl(attachment.previewUrl ?? attachment.downloadUrl)}
            title="PDF Vorschau"
            class="block h-[80vh] min-h-[600px] w-full border-none"
          ></iframe>
        {:else if getPreviewFileType(attachment.mimeType) === 'image'}
          <div
            class="flex h-[80vh] min-h-[600px] w-full items-center justify-center bg-(--surface-1)"
          >
            <img
              src={buildDownloadUrl(attachment.previewUrl ?? attachment.downloadUrl)}
              alt={attachment.filename}
              class="max-h-full max-w-full object-contain"
            />
          </div>
        {:else}
          <div
            class="flex h-[80vh] min-h-[600px] w-full items-center justify-center bg-(--surface-1)"
          >
            <div class="text-center text-(--color-text-secondary)">
              <i class="fas fa-file-alt mb-4 text-6xl"></i>
              <p class="text-lg">Vorschau nicht verfügbar</p>
              <p class="mt-2 text-sm">Bitte laden Sie die Datei herunter.</p>
            </div>
          </div>
        {/if}
        <div class="border-t border-(--border-subtle) bg-(--surface-2) p-4">
          <div class="flex items-center gap-6 text-sm text-(--color-text-secondary)">
            <span class="flex items-center gap-2"
              ><i class="fas fa-file-archive"></i>
              {formatFileSize(attachment.fileSize)}</span
            >
            <span class="flex items-center gap-2"
              ><i class="fas fa-user"></i>
              {attachment.uploaderName}</span
            >
          </div>
        </div>
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}><i class="fas fa-times mr-2"></i>Schließen</button
        >
        <button
          type="button"
          class="btn btn-primary"
          onclick={downloadFile}><i class="fas fa-download mr-2"></i>Herunterladen</button
        >
      </div>
    </div>
    {#if hasNavigation}
      <button
        type="button"
        class="absolute top-1/2 left-6 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-xl text-white transition-colors hover:bg-white/30"
        onclick={() => {
          onprev?.();
        }}
        aria-label="Vorheriges"
      >
        <i class="fas fa-chevron-left"></i>
      </button>
      <button
        type="button"
        class="absolute top-1/2 right-6 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-xl text-white transition-colors hover:bg-white/30"
        onclick={() => {
          onnext?.();
        }}
        aria-label="Nächstes"
      >
        <i class="fas fa-chevron-right"></i>
      </button>
      {#if currentIndex !== undefined}
        <div
          class="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-black/50 px-3 py-1 text-sm text-white"
        >
          {currentIndex + 1} / {totalCount}
        </div>
      {/if}
    {/if}
  </div>
{/if}
