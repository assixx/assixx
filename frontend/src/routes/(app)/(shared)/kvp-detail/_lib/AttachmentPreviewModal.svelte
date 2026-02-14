<script lang="ts">
  import { getAttachmentPreviewUrl, downloadAttachment } from './api';
  import { kvpDetailState } from './state.svelte';
  import { getFileIconClass, formatFileSize } from './utils';

  function handleDownload(fileUuid: string) {
    downloadAttachment(fileUuid);
  }
</script>

{#if kvpDetailState.showPreviewModal && kvpDetailState.previewAttachment !== null}
  {@const attachment = kvpDetailState.previewAttachment}
  <div class="modal-overlay modal-overlay--active">
    <div
      class="ds-modal ds-modal--lg"
      style="max-height: 95vh;"
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas {getFileIconClass(attachment.fileType)} mr-2"></i>
          {attachment.fileName}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={() => {
            kvpDetailState.closePreviewModal();
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body p-0">
        {#if attachment.fileType.includes('pdf')}
          <iframe
            src={getAttachmentPreviewUrl(attachment.fileUuid)}
            class="block h-[80vh] min-h-[600px] w-full border-none"
            title="Dokumentenvorschau"
          ></iframe>
        {:else if attachment.fileType.includes('image')}
          <div
            class="bg-surface-1 flex h-[80vh] min-h-[600px] w-full items-center justify-center"
          >
            <img
              src={getAttachmentPreviewUrl(attachment.fileUuid)}
              class="max-h-full max-w-full object-contain"
              alt={attachment.fileName}
            />
          </div>
        {:else}
          <div
            class="bg-surface-1 flex h-[80vh] min-h-[600px] w-full items-center justify-center"
          >
            <div class="text-content-secondary text-center">
              <i class="fas fa-file-alt mb-4 text-6xl"></i>
              <p class="text-lg">Vorschau nicht verfügbar</p>
              <p class="mt-2 text-sm">
                Bitte laden Sie die Datei herunter, um sie anzuzeigen.
              </p>
            </div>
          </div>
        {/if}
        <div class="bg-surface-2 border-border-subtle border-t p-4">
          <div class="text-content-secondary flex items-center gap-6 text-sm">
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
          onclick={() => {
            kvpDetailState.closePreviewModal();
          }}
        >
          <i class="fas fa-times mr-2"></i>
          Schließen
        </button>
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => {
            handleDownload(attachment.fileUuid);
          }}
        >
          <i class="fas fa-download mr-2"></i>
          Herunterladen
        </button>
      </div>
    </div>
  </div>
{/if}
