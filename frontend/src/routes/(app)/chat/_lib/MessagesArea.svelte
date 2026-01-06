<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import type { Message, ScheduledMessage } from './types';
  import { MESSAGES } from './constants';
  import {
    formatFileSize,
    getFileIcon,
    linkify,
    highlightSearchInMessage,
    formatMessageTime,
    formatScheduleTime,
    formatDateSeparator,
    shouldShowDateSeparator,
    messageMatchesQuery,
  } from './utils';

  interface Props {
    messages: Message[];
    scheduledMessages: ScheduledMessage[];
    currentUserId: number;
    searchQuery: string;
    typingUsers: number[];
    isLoading: boolean;
    oncancelscheduled: (scheduled: ScheduledMessage) => void;
  }

  /* eslint-disable prefer-const */
  let {
    messages,
    scheduledMessages,
    currentUserId,
    searchQuery,
    typingUsers,
    isLoading,
    oncancelscheduled,
  }: Props = $props();
  /* eslint-enable prefer-const */

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

      return {
        ...message,
        formattedTime: formatMessageTime(message.createdAt),
        linkifiedContent: linkify(message.content),
        isOwn: message.senderId === currentUserId,
        showDateSeparator,
        dateSeparatorText: showDateSeparator ? formatDateSeparator(message.createdAt) : '',
        hasAttachments: Boolean(message.attachments && message.attachments.length > 0),
      };
    });

    const duration = performance.now() - startTime;
    if (duration > 10) {
      console.log(
        `[MessagesArea] Processed ${messages.length} messages in ${duration.toFixed(2)}ms`,
      );
    }

    return result;
  });

  /**
   * Messages with search highlighting applied
   * Only recomputes when searchQuery changes
   */
  const searchHighlightedMessages = $derived.by<SvelteMap<number, string>>(() => {
    if (!searchQuery.trim()) return new SvelteMap();

    const startTime = performance.now();
    const highlights = new SvelteMap<number, string>();

    for (const msg of processedMessages) {
      if (messageMatchesQuery(msg.content, searchQuery)) {
        highlights.set(msg.id, highlightSearchInMessage(msg.content, searchQuery));
      }
    }

    const duration = performance.now() - startTime;
    if (duration > 5) {
      console.log(
        `[MessagesArea] Search highlighting took ${duration.toFixed(2)}ms for ${highlights.size} matches`,
      );
    }

    return highlights;
  });

  export function scrollToBottom(): void {
    if (containerRef) {
      containerRef.scrollTop = containerRef.scrollHeight;
    }
  }

  export function getContainer(): HTMLDivElement | null {
    return containerRef;
  }
</script>

<div class="messages-container" class:loaded={!isLoading} bind:this={containerRef}>
  {#if isLoading}
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i>
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
    <!-- Scheduled Messages First -->
    {#each scheduledMessages as scheduled (scheduled.id)}
      <div class="message own message--scheduled" data-scheduled-id={scheduled.id}>
        <div class="message-bubble">
          <div class="message-content">
            <p class="message-text">{scheduled.content}</p>
            <div class="message--scheduled-info">
              <i class="far fa-clock"></i>
              <span>
                {MESSAGES.labelScheduledFor}
                {formatScheduleTime(new Date(scheduled.scheduledFor))}
              </span>
              <button
                class="message--scheduled-cancel"
                title={MESSAGES.labelCancelScheduled}
                aria-label={MESSAGES.labelCancelScheduled}
                onclick={() => oncancelscheduled(scheduled)}
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    {/each}

    <!-- Regular Messages (using pre-processed data for performance) -->
    {#each processedMessages as message (message.id)}
      {#if message.showDateSeparator}
        <div class="date-separator">
          <span>{message.dateSeparatorText}</span>
        </div>
      {/if}

      <div class="message" class:own={message.isOwn} data-message-id={message.id}>
        <div class="message-bubble">
          <div class="message-content">
            <!-- eslint-disable svelte/no-at-html-tags -- Content from API is trusted -->
            <p class="message-text">
              {#if searchHighlightedMessages.has(message.id)}
                {@html searchHighlightedMessages.get(message.id)}
              {:else}
                {@html message.linkifiedContent}
              {/if}
            </p>
            <!-- eslint-enable svelte/no-at-html-tags -->

            <!-- Attachments (only render block if hasAttachments) -->
            {#if message.hasAttachments}
              {#each message.attachments as att (att.id)}
                {#if att.mimeType.startsWith('image/')}
                  <div class="attachment image-attachment">
                    <div class="attachment-image-wrapper">
                      <img
                        src={att.downloadUrl ??
                          `/api/v2/chat/attachments/${att.fileUuid}/download?inline=true`}
                        alt={att.fileName}
                        loading="lazy"
                      />
                      <div class="attachment-overlay">
                        <i class="fas fa-search-plus"></i>
                      </div>
                    </div>
                  </div>
                {:else}
                  <a
                    class="attachment file-attachment"
                    href={att.downloadUrl ?? `/api/v2/chat/attachments/${att.fileUuid}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i class="fas {getFileIcon(att.mimeType)}"></i>
                    <div class="file-info">
                      <span class="file-name">{att.fileName}</span>
                      <span class="file-size">{formatFileSize(att.fileSize)}</span>
                    </div>
                    <div class="attachment-actions">
                      <button class="btn btn-icon btn-sm" aria-label={MESSAGES.labelDownloadFile}>
                        <i class="fas fa-download"></i>
                      </button>
                    </div>
                  </a>
                {/if}
              {/each}
            {/if}

            <!-- Legacy attachment support -->
            {#if message.attachment}
              <a
                class="attachment file-attachment"
                href={message.attachment.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i class="fas {getFileIcon(message.attachment.mimeType)}"></i>
                <div class="file-info">
                  <span class="file-name">{message.attachment.filename}</span>
                  <span class="file-size">{formatFileSize(message.attachment.size)}</span>
                </div>
              </a>
            {/if}

            <!-- Time + Read Indicator (using pre-formatted time) -->
            <div class="message-time">
              {message.formattedTime}
              {#if message.isOwn}
                <span class="read-indicator" class:read={message.isRead}>
                  {#if message.isRead}✓✓{:else}✓{/if}
                </span>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/each}

    <!-- Typing Indicator -->
    {#if typingUsers.length > 0}
      <div class="typing-indicator">
        <span class="typing-dots">
          <span></span><span></span><span></span>
        </span>
        <span class="typing-text">{MESSAGES.labelTyping}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* ==========================================================================
   * PERFORMANCE OPTIMIZATIONS
   * - content-visibility: auto → skips rendering of off-screen messages
   * - contain-intrinsic-size → provides estimated height for layout stability
   * - contain: layout style paint → isolates repaints to individual messages
   * ========================================================================== */

  .messages-container {
    /* Enable smooth scrolling with GPU acceleration */
    will-change: scroll-position;
    /* Contain layout calculations to this element */
    contain: strict;
  }

  /* Individual message optimization */
  .message {
    /* Skip rendering of off-screen messages (native browser virtualization) */
    content-visibility: auto;
    /* Estimated height for messages - prevents layout shift */
    contain-intrinsic-size: auto 60px;
    /* Isolate repaints */
    contain: layout style paint;
  }

  /* Date separators also need content-visibility */
  .date-separator {
    content-visibility: auto;
    contain-intrinsic-size: auto 32px;
  }

  .loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-8, 2rem);
    font-size: 2rem;
    color: var(--primary-color, #2196f3);
  }

  .typing-indicator {
    display: flex;
    align-items: center;
    gap: var(--spacing-2, 0.5rem);
    padding: var(--spacing-2, 0.5rem) var(--spacing-4, 1rem);
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .typing-dots {
    display: flex;
    gap: 4px;
  }

  .typing-dots span {
    width: 6px;
    height: 6px;
    background: var(--text-secondary);
    border-radius: 50%;
    animation: typingBounce 1.4s infinite ease-in-out;
  }

  .typing-dots span:nth-child(1) {
    animation-delay: 0s;
  }
  .typing-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .typing-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typingBounce {
    0%,
    80%,
    100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
