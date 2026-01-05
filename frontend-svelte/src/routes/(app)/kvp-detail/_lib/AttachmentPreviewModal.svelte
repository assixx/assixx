<script lang="ts">
  import { kvpDetailState } from './state.svelte';
  import { getAttachmentPreviewUrl, downloadAttachment } from './api';
  import { getFileIconClass, formatFileSize } from './utils';

  function handleDownload(fileUuid: string) {
    downloadAttachment(fileUuid);
  }
</script>

{#if kvpDetailState.showPreviewModal && kvpDetailState.previewAttachment !== null}
  {@const attachment = kvpDetailState.previewAttachment}
  <div class="modal-overlay modal-overlay--active">
    <div class="ds-modal ds-modal--xl">
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas {getFileIconClass(attachment.fileType)} mr-2"></i>
          {attachment.fileName}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schliessen"
          onclick={() => kvpDetailState.closePreviewModal()}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body p-0">
        {#if attachment.fileType.includes('pdf')}
          <iframe
            src={getAttachmentPreviewUrl(attachment.fileUuid)}
            class="block w-full h-[70vh] min-h-[600px] border-none"
            title="Dokumentenvorschau"
          ></iframe>
        {:else if attachment.fileType.includes('image')}
          <div class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-surface-1">
            <img
              src={getAttachmentPreviewUrl(attachment.fileUuid)}
              class="max-w-full max-h-full object-contain"
              alt={attachment.fileName}
            />
          </div>
        {:else}
          <div class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-surface-1">
            <div class="text-center text-content-secondary">
              <i class="fas fa-file-alt text-6xl mb-4"></i>
              <p class="text-lg">Vorschau nicht verfuegbar</p>
              <p class="text-sm mt-2">Bitte laden Sie die Datei herunter, um sie anzuzeigen.</p>
            </div>
          </div>
        {/if}
        <div class="p-4 bg-surface-2 border-t border-border-subtle">
          <div class="flex items-center gap-6 text-sm text-content-secondary">
            <span class="flex items-center gap-2">
              <i class="fas fa-file-archive"></i>
              <span>{formatFileSize(attachment.fileSize)}</span>
            </span>
            {#if attachment.uploadedByName !== undefined}
              <span class="flex items-center gap-2">
                <i class="fas fa-user"></i>
                <span>{attachment.uploadedByName}</span>
              </span>
            {/if}
          </div>
        </div>
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => kvpDetailState.closePreviewModal()}
        >
          <i class="fas fa-times mr-2"></i>
          Schliessen
        </button>
        <button
          type="button"
          class="btn btn-modal"
          onclick={() => handleDownload(attachment.fileUuid)}
        >
          <i class="fas fa-download mr-2"></i>
          Herunterladen
        </button>
      </div>
    </div>
  </div>
{/if}
