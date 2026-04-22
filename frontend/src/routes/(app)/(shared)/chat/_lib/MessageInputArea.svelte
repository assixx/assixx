<script lang="ts">
  import { MESSAGES } from './constants';
  import { formatFileSize, getFileIcon, formatScheduleTime } from './utils';

  import type { FilePreviewItem } from './types';

  interface Props {
    messageInput?: string; // Optional for $bindable() - parent uses bind:messageInput
    selectedFiles: FilePreviewItem[];
    scheduledFor: Date | null;
    onsend: () => void;
    onkeydown: (event: KeyboardEvent) => void;
    oninput: () => void;
    onopenfilepicker: () => void;
    onremovefile: (index: number) => void;
    onopenschedule: () => void;
    onclearschedule: () => void;
  }

  /* eslint-disable prefer-const -- Svelte $bindable() requires let */
  let {
    messageInput = $bindable(''),
    selectedFiles,
    scheduledFor,
    onsend,
    onkeydown,
    oninput,
    onopenfilepicker,
    onremovefile,
    onopenschedule,
    onclearschedule,
  }: Props = $props();
  /* eslint-enable prefer-const */

  const hasSchedule = $derived(scheduledFor !== null);
  const canSend = $derived(messageInput.trim() !== '' || selectedFiles.length > 0);
</script>

<div class="message-input-container">
  <!-- File Preview -->
  {#if selectedFiles.length > 0}
    <div class="file-preview">
      {#each selectedFiles as item, i (i)}
        <div
          class="file-preview-item"
          class:uploading={item.status === 'uploading'}
        >
          <div class="file-icon">
            {#if item.isImage && item.previewUrl}
              <img
                src={item.previewUrl}
                alt=""
              />
            {:else}
              <i class="fas {getFileIcon(item.file.type)}"></i>
            {/if}
          </div>
          <div class="file-info">
            <span class="file-name">{item.file.name}</span>
            <span class="file-size">{formatFileSize(item.file.size)}</span>
          </div>
          <button
            type="button"
            class="remove-file"
            aria-label={MESSAGES.labelRemoveFile}
            onclick={() => {
              onremovefile(i);
            }}
            disabled={item.status === 'uploading'}
          >
            <i class="fas fa-times"></i>
          </button>
          {#if item.status === 'uploading'}
            <div class="upload-progress">
              <div
                class="progress-bar"
                style="width: {item.progress}%"
              ></div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="message-input-wrapper">
    <textarea
      class="message-input"
      placeholder={MESSAGES.labelMessagePlaceholder}
      rows="1"
      bind:value={messageInput}
      {onkeydown}
      {oninput}
    ></textarea>
    <div class="input-actions">
      <!-- Schedule Button / Badge -->
      {#if hasSchedule && scheduledFor}
        <div class="schedule-badge">
          <i class="far fa-clock"></i>
          <span class="schedule-badge__time">{formatScheduleTime(scheduledFor)}</span>
          <button
            type="button"
            class="schedule-badge__clear"
            title={MESSAGES.labelClearSchedule}
            aria-label={MESSAGES.labelClearSchedule}
            onclick={onclearschedule}
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      {:else}
        <button
          type="button"
          class="btn btn-icon btn-secondary"
          title={MESSAGES.labelScheduleMessage}
          aria-label={MESSAGES.labelScheduleMessage}
          onclick={onopenschedule}
        >
          <i class="far fa-clock"></i>
        </button>
      {/if}

      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title={MESSAGES.labelAttachFile}
        aria-label={MESSAGES.labelAttachFile}
        onclick={onopenfilepicker}
      >
        <i class="fas fa-paperclip"></i>
      </button>
      <button
        type="button"
        class="btn btn-icon btn-upload"
        aria-label={MESSAGES.labelSendMessage}
        onclick={onsend}
        disabled={!canSend}
      >
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  </div>
</div>

<style>
  .message-input-container {
    position: relative;
    z-index: 10;
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--color-glass-border);
    padding: 10px 16px;
  }

  .message-input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    border: 1px solid var(--color-glass-border-hover);
    border-radius: 20px;
    padding: 6px;
  }

  .message-input-wrapper:focus-within {
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-primary) 10%, transparent);
    border-color: var(--primary-color);
  }

  .message-input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 8px 12px;
    min-height: 18px;
    max-height: 100px;
    resize: none;
    color: var(--text-primary);
    font-size: 0.85rem;
    line-height: 1.4;
    font-family: inherit;
  }

  .message-input:focus {
    outline: none;
  }

  .message-input::placeholder {
    opacity: 100%;
    color: var(--color-text-placeholder);
  }

  .input-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
  }

  /* Schedule message badge */
  .schedule-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--color-primary) 15%, transparent);
    padding: 4px 10px;
    color: var(--color-primary);
    font-size: 0.75rem;
  }

  .schedule-badge i {
    font-size: 0.8rem;
  }

  .schedule-badge__time {
    font-weight: 500;
  }

  .schedule-badge__clear {
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all 0.15s ease;
    cursor: pointer;
    margin-left: 2px;
    border: none;
    border-radius: 50%;
    background: var(--glass-bg-active);
    padding: 0;
    width: 16px;
    height: 16px;
    color: var(--color-text-secondary);
    font-size: 0.6rem;
  }

  .schedule-badge__clear:hover {
    background: color-mix(in oklch, var(--color-danger) 20%, transparent);
    color: var(--color-danger);
  }

  /* File preview before sending */
  .file-preview {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    backdrop-filter: blur(10px);
    margin-bottom: var(--spacing-2);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    background: var(--glass-bg);
    padding: var(--spacing-3);
  }

  .file-preview-item {
    display: flex;
    position: relative;
    align-items: center;
    gap: var(--spacing-3);
    transition: opacity var(--duration-fast) var(--ease-standard);
    border-radius: var(--radius-md);
    background: var(--glass-bg-active);
    padding: var(--spacing-2) var(--spacing-3);
  }

  .file-icon {
    display: flex;
    flex-shrink: 0;
    justify-content: center;
    align-items: center;
    border-radius: var(--radius-md);
    background: var(--glass-bg-active);
    width: 48px;
    height: 48px;
    color: var(--text-secondary);
  }

  .file-icon img {
    border-radius: var(--radius-md);
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .file-icon i {
    font-size: 1.25rem;
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

  .remove-file {
    display: flex;
    flex-shrink: 0;
    justify-content: center;
    align-items: center;
    transition: all var(--duration-fast) var(--ease-standard);
    cursor: pointer;
    border: none;
    border-radius: 50%;
    background: transparent;
    padding: 0;
    width: 28px;
    height: 28px;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .remove-file:hover {
    background: color-mix(in oklch, var(--color-danger) 15%, transparent);
    color: var(--color-danger);
  }

  /* Upload progress states */
  .file-preview-item.uploading {
    opacity: 70%;
  }

  .upload-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    border-radius: 0 0 var(--radius-md) var(--radius-md);
    background: var(--glass-bg-active);
    width: 100%;
    height: 4px;
    overflow: hidden;
  }

  .progress-bar {
    transition: width 0.3s ease;
    background: var(--primary-500);
    width: 0;
    height: 100%;
  }

  /* Mobile: reduced padding */
  @media (width < 768px) {
    .message-input-container {
      padding: var(--spacing-3);
    }
  }
</style>
