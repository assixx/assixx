<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';

  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('MessagesArea');

  import ChatAttachment from './ChatAttachment.svelte';
  import { MESSAGES } from './constants';
  import {
    linkify,
    highlightSearchInMessage,
    formatMessageTime,
    formatScheduleTime,
    formatDateSeparator,
    shouldShowDateSeparator,
    messageMatchesQuery,
  } from './utils';

  import type { Message, ScheduledMessage } from './types';

  interface PreviewAttachment {
    src: string;
    alt: string;
    /** MIME type for determining preview method (image vs pdf) */
    mimeType?: string;
  }

  interface Props {
    messages: Message[];
    scheduledMessages: ScheduledMessage[];
    currentUserId: number;
    searchQuery: string;
    isLoading: boolean;
    oncancelscheduled: (scheduled: ScheduledMessage) => void;
    onimageclick: (file: PreviewAttachment) => void;
  }

  const {
    messages,
    scheduledMessages,
    currentUserId,
    searchQuery,
    isLoading,
    oncancelscheduled,
    onimageclick,
  }: Props = $props();

  let containerRef: HTMLDivElement | null = $state(null);

  // ==========================================================================
  // PERFORMANCE: Pre-processed message data
  // Computed once when messages change, not on every render
  // ==========================================================================

  interface ProcessedMessage extends Message {
    /** Pre-formatted time string */
    formattedTime: string;
    /** Pre-computed linkified content (HTML) */
    linkifiedContent: string;
    /** Whether this message is from current user */
    isOwn: boolean;
    /** Whether to show date separator before this message */
    showDateSeparator: boolean;
    /** Pre-formatted date separator text */
    dateSeparatorText: string;
    /** Whether this message has attachments */
    hasAttachments: boolean;
  }

  /**
   * Pre-process messages for optimal rendering
   * This runs once when messages array changes, not on every render cycle
   */
  const processedMessages = $derived.by<ProcessedMessage[]>(() => {
    if (messages.length === 0) return [];

    const startTime = performance.now();

    const result = messages.map((message, index) => {
      const prevMessage = messages[index - 1];
      const showDateSeparator = shouldShowDateSeparator(prevMessage, message);

      // E2E messages: use decryptedContent; fallback to empty string on null
      let displayContent: string;
      if (message.isE2e === true) {
        displayContent =
          message.decryptionFailed === true ?
            ''
          : (message.decryptedContent ?? '');
      } else {
        displayContent = message.content ?? '';
      }

      return {
        ...message,
        formattedTime: formatMessageTime(message.createdAt),
        linkifiedContent: displayContent !== '' ? linkify(displayContent) : '',
        isOwn: message.senderId === currentUserId,
        showDateSeparator,
        dateSeparatorText:
          showDateSeparator ? formatDateSeparator(message.createdAt) : '',
        hasAttachments: Boolean(
          message.attachments && message.attachments.length > 0,
        ),
      };
    });

    const duration = performance.now() - startTime;
    if (duration > 10) {
      log.warn(
        { messageCount: messages.length, durationMs: duration.toFixed(2) },
        'Slow message processing',
      );
    }

    return result;
  });

  /**
   * Messages with search highlighting applied
   * Only recomputes when searchQuery changes
   */
  const searchHighlightedMessages = $derived.by<SvelteMap<number, string>>(
    () => {
      if (!searchQuery.trim()) return new SvelteMap();

      const startTime = performance.now();
      const highlights = new SvelteMap<number, string>();

      for (const msg of processedMessages) {
        // Use decryptedContent for E2E messages, content for plaintext
        const searchContent =
          msg.isE2e === true ?
            (msg.decryptedContent ?? null)
          : (msg.content ?? null);
        if (
          searchContent !== null &&
          messageMatchesQuery(searchContent, searchQuery)
        ) {
          highlights.set(
            msg.id,
            highlightSearchInMessage(searchContent, searchQuery),
          );
        }
      }

      const duration = performance.now() - startTime;
      if (duration > 5) {
        log.warn(
          { matchCount: highlights.size, durationMs: duration.toFixed(2) },
          'Slow search highlighting',
        );
      }

      return highlights;
    },
  );

  export function scrollToBottom(): void {
    if (containerRef) {
      containerRef.scrollTop = containerRef.scrollHeight;
    }
  }

  export function getContainer(): HTMLDivElement | null {
    return containerRef;
  }
</script>

<div
  class="messages-container"
  class:loaded={!isLoading}
  bind:this={containerRef}
>
  {#if isLoading}
    <div class="loading-spinner">
      <span class="spinner-ring spinner-ring--sm"></span>
    </div>
  {:else if messages.length === 0 && scheduledMessages.length === 0}
    <div class="empty-chat">
      <div class="empty-chat-icon">
        <i class="fas fa-comments"></i>
      </div>
      <h3>{MESSAGES.emptyNewConversation}</h3>
      <p>{MESSAGES.emptyFirstMessage}</p>
    </div>
  {:else}
    <!-- Regular Messages (using pre-processed data for performance) -->
    {#each processedMessages as message (message.id)}
      {#if message.showDateSeparator}
        <div class="date-separator">
          <span>{message.dateSeparatorText}</span>
        </div>
      {/if}

      <div
        class="message"
        class:own={message.isOwn}
        data-message-id={message.id}
      >
        <div class="message-bubble">
          <div class="message-content">
            <!-- eslint-disable svelte/no-at-html-tags -- Content from API is trusted -->
            {#if message.isE2e === true && message.decryptionFailed === true}
              <p
                class="message-text e2e-decrypt-failed"
                title="Entschlüsselung fehlgeschlagen"
              >
                <i class="fas fa-lock"></i>
                Verschlüsselte Nachricht konnte nicht entschlüsselt werden
              </p>
            {:else}
              <p class="message-text">
                {#if searchHighlightedMessages.has(message.id)}
                  {@html searchHighlightedMessages.get(message.id)}
                {:else}
                  {@html message.linkifiedContent}
                {/if}
              </p>
            {/if}
            <!-- eslint-enable svelte/no-at-html-tags -->

            <!-- Modern attachments -->
            {#if message.hasAttachments}
              {#each message.attachments as att (att.id)}
                {@const isImage = att.mimeType.startsWith('image/')}
                {@const isPdf = att.mimeType === 'application/pdf'}
                {@const inlineSrc =
                  att.downloadUrl ??
                  `/api/v2/documents/uuid/${att.fileUuid}/download?inline=true`}
                {@const previewSrc =
                  isPdf ?
                    `/api/v2/documents/uuid/${att.fileUuid}/preview`
                  : inlineSrc}
                <ChatAttachment
                  {isImage}
                  canPreview={isImage || isPdf}
                  {inlineSrc}
                  {previewSrc}
                  downloadUrl={att.downloadUrl ??
                    `/api/v2/chat/attachments/${att.fileUuid}/download`}
                  fileName={att.fileName}
                  fileSize={att.fileSize}
                  mimeType={att.mimeType}
                  isOwn={message.isOwn}
                  onpreview={onimageclick}
                />
              {/each}
            {/if}

            <!-- Legacy attachment support -->
            {#if message.attachment}
              {@const isLegacyImage =
                message.attachment.mimeType.startsWith('image/')}
              {@const isLegacyPdf =
                message.attachment.mimeType === 'application/pdf'}
              {@const legacyInlineSrc = `${message.attachment.url}?inline=true`}
              {@const legacyUuidMatch = /attachments\/([^/]+)\/download/.exec(
                message.attachment.url,
              )}
              {@const legacyUuid =
                legacyUuidMatch !== null ? legacyUuidMatch[1] : null}
              {@const legacyPreviewSrc =
                isLegacyPdf && legacyUuid !== null ?
                  `/api/v2/documents/uuid/${legacyUuid}/preview`
                : legacyInlineSrc}
              <ChatAttachment
                isImage={isLegacyImage}
                canPreview={isLegacyImage || isLegacyPdf}
                inlineSrc={legacyInlineSrc}
                previewSrc={legacyPreviewSrc}
                downloadUrl={message.attachment.url}
                fileName={message.attachment.filename}
                fileSize={message.attachment.size}
                mimeType={message.attachment.mimeType}
                isOwn={message.isOwn}
                onpreview={onimageclick}
              />
            {/if}

            <!-- Time + Read Indicator (using pre-formatted time) -->
            <div class="message-time">
              {#if message.isE2e === true}
                <span
                  class="e2e-indicator"
                  title="Ende-zu-Ende verschlüsselt"
                >
                  <i class="fas fa-lock"></i>
                </span>
              {/if}
              {message.formattedTime}
              {#if message.isOwn}
                <span
                  class="read-indicator"
                  class:read={message.isRead}
                >
                  {#if message.isRead}✓✓{:else}✓{/if}
                </span>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/each}

    <!-- Scheduled Messages (after regular messages - future timestamps at bottom) -->
    {#each scheduledMessages as scheduled (scheduled.id)}
      <div
        class="message own message--scheduled"
        data-scheduled-id={scheduled.id}
      >
        <div class="message-bubble">
          <div class="message-content">
            {#if scheduled.decryptedContent ?? scheduled.content}
              <p class="message-text">
                {scheduled.decryptedContent ?? scheduled.content}
              </p>
            {/if}
            {#if scheduled.attachment !== null}
              {@const att = scheduled.attachment}
              {@const isImage = att.type.startsWith('image/')}
              <ChatAttachment
                {isImage}
                canPreview={isImage}
                inlineSrc={`/api/v2/documents/uuid/${att.path}/download?inline=true`}
                previewSrc={`/api/v2/documents/uuid/${att.path}/download?inline=true`}
                downloadUrl={`/api/v2/documents/uuid/${att.path}/download`}
                fileName={att.name}
                fileSize={att.size}
                mimeType={att.type}
                isOwn={true}
                isScheduled={true}
                onpreview={onimageclick}
              />
            {/if}
            <div class="message--scheduled-info">
              <i class="far fa-clock"></i>
              <span>
                {MESSAGES.labelScheduledFor}
                {formatScheduleTime(new Date(scheduled.scheduledFor))}
              </span>
              <button
                type="button"
                class="message--scheduled-cancel"
                title={MESSAGES.labelCancelScheduled}
                aria-label={MESSAGES.labelCancelScheduled}
                onclick={() => {
                  oncancelscheduled(scheduled);
                }}
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  /* ==========================================================================
   * PERFORMANCE OPTIMIZATIONS
   * - content-visibility: auto -> skips rendering of off-screen messages
   * - contain-intrinsic-size -> provides estimated height for layout stability
   * - contain: layout style paint -> isolates repaints to individual messages
   * ========================================================================== */

  .messages-container {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    opacity: 0%;
    padding: 16px 16px 40px;
    min-height: 0;
    max-height: 100%;
    overflow-y: auto;
    scroll-behavior: auto;
    will-change: scroll-position;
    contain: strict;
  }

  .messages-container.loaded {
    opacity: 100%;
  }

  /* Message layout with native browser virtualization */
  .message {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    width: 100%;
    content-visibility: auto;
    contain-intrinsic-size: auto 60px;
    contain: layout style paint;
  }

  .message.own {
    justify-content: flex-end;
  }

  .message:not(.own) {
    justify-content: flex-start;
  }

  .message.own .message-bubble {
    align-items: flex-end;
    max-width: 65%;
  }

  .message:not(.own) .message-bubble {
    align-items: flex-start;
    max-width: 65%;
  }

  .message-bubble {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  .message-content {
    position: relative;
    backdrop-filter: blur(10px);
    border: 1px solid var(--color-glass-border-hover);
    border-radius: var(--radius-xl);
    background: var(--glass-bg-active);
    padding: 10px 14px;
    color: var(--text-primary);
    font-size: 0.85rem;
    line-height: 1.4;
    overflow-wrap: break-word;
  }

  .message.own .message-content {
    border-color: oklch(46.93% 0.0827 214.34 / 50%);
    background: oklch(46.93% 0.0827 214.34 / 36%);
  }

  /* Links injected via {@html linkify()} — no Svelte scoping hash on child elements */
  .message-content :global(a) {
    color: var(--primary-light);
    text-decoration: underline;
  }

  .message-content :global(a:hover) {
    color: var(--primary-color);
  }

  .message-text {
    margin: 0;
    color: var(--text-primary);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: normal;
  }

  /* Search highlights injected via {@html} — no Svelte scoping hash */
  .message-text :global(mark),
  .message-text :global(.search-highlight) {
    border-radius: 2px;
    background: oklch(91.45% 0.1679 133.87 / 40%);
    padding: 1px 2px;
    color: var(--text-primary);
  }

  .message-text :global(.search-highlight.current) {
    box-shadow: 0 0 0 2px var(--warning, #facc15);
    background: var(--warning, #facc15);
  }

  .message-time {
    opacity: 70%;
    margin-left: auto;
    font-size: 0.7rem;
  }

  /* Date Separator with content-visibility optimization */
  .date-separator {
    display: flex;
    position: relative;
    justify-content: center;
    align-items: center;
    margin: 20px 0;
    content-visibility: auto;
    contain-intrinsic-size: auto 32px;
  }

  .date-separator span {
    backdrop-filter: blur(10px);
    border: var(--glass-border);
    border-radius: 20px;
    background: var(--accent-color);
    padding: 6px 16px;
    color: var(--color-text-secondary);
    font-weight: 500;
    font-size: 0.85rem;
  }

  .date-separator::before,
  .date-separator::after {
    flex: 1;
    background: var(--color-glass-border);
    height: 1px;
    content: '';
  }

  .date-separator::before {
    margin-right: 16px;
  }

  .date-separator::after {
    margin-left: 16px;
  }

  /* Empty state */
  .empty-chat {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: var(--text-secondary);
    text-align: center;
  }

  .empty-chat-icon {
    opacity: 50%;
    margin-bottom: var(--spacing-6);
    font-size: 4rem;
  }

  .empty-chat h3 {
    margin: 0 0 var(--spacing-4) 0;
    color: var(--text-primary);
    font-size: 1.5rem;
  }

  .empty-chat p {
    max-width: 400px;
    line-height: 1.6;
  }

  .loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-8, 2rem);
    font-size: 2rem;
    color: var(--primary-color, var(--color-primary));
  }

  /* Scheduled message styling */
  .message--scheduled .message-content {
    border-color: oklch(67.92% 0.144 73.83 / 50%);
    background: oklch(55.1% 0.1163 74.75 / 25%);
  }

  .message--scheduled-info {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    border-top: 1px solid var(--color-glass-border);
    padding-top: 8px;
    color: oklch(87.07% 0.1325 82.74);
    font-size: 0.7rem;
  }

  .message--scheduled-info i {
    font-size: 0.75rem;
  }

  .message--scheduled-info span {
    flex: 1;
  }

  .message--scheduled-cancel {
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all 0.15s ease;
    cursor: pointer;
    margin-left: auto;
    border: none;
    border-radius: 50%;
    background: var(--glass-bg-active);
    padding: 0;
    width: 20px;
    height: 20px;
    color: var(--color-text-secondary);
    font-size: 0.65rem;
  }

  .message--scheduled-cancel:hover {
    background: color-mix(in oklch, var(--color-danger) 20%, transparent);
    color: var(--color-danger);
  }

  /* E2E encryption indicators */
  .e2e-indicator {
    color: var(--success-color, var(--color-success));
    font-size: 0.65em;
    margin-right: 2px;
  }

  .e2e-decrypt-failed {
    color: var(--error-color, var(--color-danger));
    font-style: italic;
    opacity: 80%;
  }

  .e2e-decrypt-failed i {
    margin-right: 4px;
  }

  /* Mobile responsive */
  @media (width < 768px) {
    .message {
      max-width: 85%;
    }

    .messages-container {
      padding: var(--spacing-3);
    }
  }
</style>
