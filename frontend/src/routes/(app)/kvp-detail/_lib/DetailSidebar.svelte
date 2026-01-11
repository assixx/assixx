<script lang="ts">
  import { kvpDetailState } from './state.svelte';
  import {
    getFileIconClass,
    formatFileSize,
    canShareSuggestion,
    canUnshareSuggestion,
    canArchiveSuggestion,
  } from './utils';

  import type { KvpSuggestion } from './types';

  interface Props {
    suggestion: KvpSuggestion;
    onopensharemodal: () => void;
    onunshare: () => void;
    onarchive: () => void;
  }

  const { suggestion, onopensharemodal, onunshare, onarchive }: Props = $props();
</script>

<div class="detail-sidebar">
  <!-- Other Attachments -->
  {#if kvpDetailState.otherAttachments.length > 0}
    <div class="sidebar-card">
      <h3 class="section-title">
        <i class="fas fa-paperclip"></i>
        Anhaenge
      </h3>
      <div class="attachment-list">
        {#each kvpDetailState.otherAttachments as attachment (attachment.fileUuid)}
          <div
            class="attachment-item"
            role="button"
            tabindex="0"
            onclick={() => {
              kvpDetailState.openPreviewModal(attachment);
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') kvpDetailState.openPreviewModal(attachment);
            }}
          >
            <i class="fas {getFileIconClass(attachment.fileType)}"></i>
            <div class="flex-1 truncate">
              <div class="truncate">{attachment.fileName}</div>
              <div class="text-xs text-gray-400">{formatFileSize(attachment.fileSize)}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Actions (Admin Only) -->
  {#if kvpDetailState.isAdmin}
    <div class="sidebar-card">
      <h3 class="section-title">
        <i class="fas fa-cog"></i>
        Aktionen
      </h3>
      <div class="action-buttons">
        {#if canShareSuggestion(suggestion, kvpDetailState.effectiveRole)}
          <button type="button" class="btn btn-edit" onclick={onopensharemodal}>
            <i class="fas fa-share-alt"></i>
            Teilen
          </button>
        {/if}
        {#if canUnshareSuggestion(suggestion, kvpDetailState.effectiveRole, kvpDetailState.currentUser?.id)}
          <button type="button" class="btn btn-secondary" onclick={onunshare}>
            <i class="fas fa-undo"></i>
            Teilen rueckgaengig
          </button>
        {/if}
        {#if canArchiveSuggestion(kvpDetailState.effectiveRole)}
          <button type="button" class="btn btn-light" onclick={onarchive}>
            <i class="fas fa-archive"></i>
            Archivieren
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>
