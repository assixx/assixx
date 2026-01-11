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

  /* eslint-disable prefer-const */
  // $bindable() required for two-way binding in Svelte 5
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
        <div class="file-preview-item" class:uploading={item.status === 'uploading'}>
          <div class="file-icon">
            {#if item.isImage && item.previewUrl}
              <img src={item.previewUrl} alt="" />
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
              <div class="progress-bar" style="width: {item.progress}%"></div>
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
