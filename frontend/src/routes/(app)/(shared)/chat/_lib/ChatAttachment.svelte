<script lang="ts">
  /**
   * ChatAttachment — renders a single chat message attachment.
   * Handles image preview, PDF preview, and generic file download.
   * Normalized props: caller computes URLs from modern/legacy/scheduled data shapes.
   */

  import { MESSAGES } from './constants';
  import { formatFileSize, getFileIcon } from './utils';

  interface PreviewTarget {
    src: string;
    alt: string;
    mimeType?: string;
  }

  interface Props {
    /** Whether the attachment is an image */
    isImage: boolean;
    /** Whether the attachment can be previewed (image or PDF) */
    canPreview: boolean;
    /** URL for inline display (images) */
    inlineSrc: string;
    /** URL for preview modal (images/PDFs) */
    previewSrc: string;
    /** URL for direct download */
    downloadUrl: string;
    /** Display name of the file */
    fileName: string;
    /** File size in bytes */
    fileSize: number;
    /** MIME type string */
    mimeType: string;
    /** Whether this attachment belongs to the current user's message */
    isOwn?: boolean;
    /** Whether this is a scheduled (not yet sent) attachment */
    isScheduled?: boolean;
    /** Callback when user clicks to preview */
    onpreview: (target: PreviewTarget) => void;
  }

  const {
    isImage,
    canPreview,
    inlineSrc,
    previewSrc,
    downloadUrl,
    fileName,
    fileSize,
    mimeType,
    isOwn = false,
    isScheduled = false,
    onpreview,
  }: Props = $props();
</script>

{#if canPreview}
  <button
    type="button"
    class="attachment"
    class:image-attachment={isImage}
    class:file-attachment={!isImage}
    class:own={isOwn && !isImage}
    class:scheduled-attachment={isScheduled}
    onclick={() => {
      onpreview({ src: previewSrc, alt: fileName, mimeType });
    }}
  >
    {#if isImage}
      <div class="attachment-image-wrapper">
        <img
          src={inlineSrc}
          alt={fileName}
          loading="lazy"
        />
        <div
          class="attachment-overlay"
          class:scheduled-overlay={isScheduled}
        >
          <i class={isScheduled ? 'far fa-clock' : 'fas fa-search-plus'}></i>
        </div>
      </div>
    {:else}
      <i class="fas fa-file-pdf"></i>
      <div class="file-info">
        <span class="file-name">{fileName}</span>
        <span class="file-size">{formatFileSize(fileSize)}</span>
      </div>
      <div class="attachment-actions">
        <span
          class="btn btn-icon btn-sm"
          aria-label="Vorschau"
        >
          <i class="fas fa-eye"></i>
        </span>
      </div>
    {/if}
  </button>
{:else}
  <a
    class="attachment file-attachment"
    class:scheduled-attachment={isScheduled}
    href={downloadUrl}
    target="_blank"
    rel="noopener noreferrer"
  >
    <i class="fas {getFileIcon(mimeType)}"></i>
    <div class="file-info">
      <span class="file-name">{fileName}</span>
      <span class="file-size">{formatFileSize(fileSize)}</span>
    </div>
    <div class="attachment-actions">
      <button
        type="button"
        class="btn btn-icon btn-sm"
        aria-label={MESSAGES.labelDownloadFile}
      >
        <i class="fas fa-download"></i>
      </button>
    </div>
  </a>
{/if}

<style>
  /* Base attachment */
  .attachment {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    transition: all 0.2s ease;
    cursor: pointer;
    margin-top: var(--spacing-2);
    border: 1px solid var(--color-glass-border-hover);
    border-radius: var(--radius-xl);
    background: var(--glass-bg-active);
    padding: var(--spacing-3);
  }

  .attachment:hover {
    background: var(--glass-bg-active);
  }

  /* Image attachment: transparent background */
  .attachment.image-attachment {
    border: none;
    background: transparent;
    padding: 0;
  }

  .attachment-image-wrapper {
    position: relative;
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  .attachment-image-wrapper img {
    display: block;
    border-radius: var(--radius-xl);
    max-width: 300px;
    max-height: 200px;
    object-fit: cover;
  }

  .attachment-overlay {
    display: flex;
    position: absolute;
    justify-content: center;
    align-items: center;
    opacity: 0%;
    transition: opacity 0.2s ease;
    inset: 0;
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--color-black) 50%, transparent);
  }

  .attachment-overlay i {
    color: var(--color-white);
    font-size: 2rem;
  }

  .attachment-image-wrapper:hover .attachment-overlay {
    opacity: 100%;
  }

  /* File attachment */
  .attachment.file-attachment {
    gap: var(--spacing-3);
  }

  .attachment.file-attachment > i {
    font-size: 1.5rem;
  }

  .attachment-actions {
    display: flex;
    gap: var(--spacing-2);
    margin-left: auto;
  }

  .attachment-actions .btn {
    padding: var(--spacing-1) var(--spacing-2);
  }

  .file-info {
    flex: 1;
    min-width: 0;
  }

  .file-name {
    margin-bottom: 2px;
    overflow: hidden;
    color: var(--text-primary);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    color: var(--text-secondary);
    font-size: 0.8rem;
  }

  /* Button resets for image attachment */
  button.image-attachment {
    display: block;
    cursor: pointer;
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    text-align: inherit;
  }

  /* Button resets for file attachment (PDF preview) */
  button.file-attachment {
    display: flex;
    align-items: center;
    gap: var(--spacing-2, 0.5rem);
    padding: var(--spacing-2, 0.5rem) var(--spacing-3, 0.75rem);
    background: color-mix(in oklch, var(--color-black) 5%, transparent);
    border-radius: var(--radius-md, 8px);
    cursor: pointer;
    font: inherit;
    color: inherit;
    text-align: left;
    transition: background-color 0.2s ease;
  }

  button.file-attachment:hover {
    background: color-mix(in oklch, var(--color-black) 10%, transparent);
  }

  /* Own message file attachment variant */
  button.file-attachment.own {
    background: color-mix(in oklch, var(--color-white) 10%, transparent);
    border-color: color-mix(in oklch, var(--color-white) 15%, transparent);
  }

  button.file-attachment.own:hover {
    background: color-mix(in oklch, var(--color-white) 20%, transparent);
  }

  /* Scheduled attachment styles */
  .scheduled-attachment {
    opacity: 85%;
    position: relative;
  }

  .scheduled-attachment .attachment-image-wrapper img {
    max-width: 200px;
    max-height: 150px;
    border-radius: var(--radius-md, 8px);
    object-fit: cover;
  }

  .scheduled-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in oklch, var(--color-black) 30%, transparent);
    border-radius: var(--radius-md, 8px);
    color: var(--color-white);
    font-size: 1.5rem;
    opacity: 100%;
  }

  .scheduled-attachment.file-attachment {
    display: flex;
    align-items: center;
    gap: var(--spacing-2, 0.5rem);
    padding: var(--spacing-2, 0.5rem) var(--spacing-3, 0.75rem);
    background: color-mix(in oklch, var(--color-white) 10%, transparent);
    border-radius: var(--radius-md, 8px);
    border: 1px dashed color-mix(in oklch, var(--color-white) 30%, transparent);
  }

  .scheduled-attachment.file-attachment .file-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .scheduled-attachment.file-attachment .file-name {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .scheduled-attachment.file-attachment .file-size {
    font-size: 0.75rem;
    opacity: 70%;
  }
</style>
