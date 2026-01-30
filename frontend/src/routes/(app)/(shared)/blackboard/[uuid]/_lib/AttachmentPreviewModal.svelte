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
  }

  const { show, attachment, onclose }: Props = $props();

  /** Open download URL in new tab */
  function downloadFile(): void {
    if (attachment === null) return;
    window.open(buildDownloadUrl(attachment.downloadUrl), '_blank');
  }

  function stopPropagation(e: Event): void {
    e.stopPropagation();
  }
</script>

{#if show && attachment !== null}
  <div
    class="modal-overlay modal-overlay--active"
    onclick={onclose}
    onkeydown={(e) => {
      if (e.key === 'Escape') onclose();
    }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal ds-modal--lg"
      style="max-height: 95vh;"
      onclick={stopPropagation}
      onkeydown={stopPropagation}
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
            src={buildDownloadUrl(
              attachment.previewUrl ?? attachment.downloadUrl,
            )}
            title="PDF Vorschau"
            class="block h-[80vh] min-h-[600px] w-full border-none"
          ></iframe>
        {:else if getPreviewFileType(attachment.mimeType) === 'image'}
          <div
            class="flex h-[80vh] min-h-[600px] w-full items-center justify-center bg-[var(--surface-1)]"
          >
            <img
              src={buildDownloadUrl(
                attachment.previewUrl ?? attachment.downloadUrl,
              )}
              alt={attachment.filename}
              class="max-h-full max-w-full object-contain"
            />
          </div>
        {:else}
          <div
            class="flex h-[80vh] min-h-[600px] w-full items-center justify-center bg-[var(--surface-1)]"
          >
            <div class="text-center text-[var(--color-text-secondary)]">
              <i class="fas fa-file-alt mb-4 text-6xl"></i>
              <p class="text-lg">Vorschau nicht verfügbar</p>
              <p class="mt-2 text-sm">Bitte laden Sie die Datei herunter.</p>
            </div>
          </div>
        {/if}
        <div
          class="border-t border-[var(--border-subtle)] bg-[var(--surface-2)] p-4"
        >
          <div
            class="flex items-center gap-6 text-sm text-[var(--color-text-secondary)]"
          >
            <span class="flex items-center gap-2"
              ><i class="fas fa-file-archive"></i>
              {formatFileSize(attachment.fileSize)}</span
            >
            <span class="flex items-center gap-2"
              ><i class="fas fa-user"></i>
              {attachment.uploadedByName}</span
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
          class="btn btn-modal"
          onclick={downloadFile}
          ><i class="fas fa-download mr-2"></i>Herunterladen</button
        >
      </div>
    </div>
  </div>
{/if}
