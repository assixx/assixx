<script lang="ts">
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

    <!-- Regular Messages -->
    {#each messages as message, i (message.id)}
      {@const prevMessage = messages[i - 1]}
      {@const isOwn = message.senderId === currentUserId}

      {#if shouldShowDateSeparator(prevMessage, message)}
        <div class="date-separator">
          <span>{formatDateSeparator(message.createdAt)}</span>
        </div>
      {/if}

      <div class="message" class:own={isOwn} data-message-id={message.id}>
        <div class="message-bubble">
          <div class="message-content">
            <!-- eslint-disable svelte/no-at-html-tags -- Content from API is trusted -->
            <p class="message-text">
              {#if messageMatchesQuery(message.content, searchQuery)}
                {@html highlightSearchInMessage(message.content, searchQuery)}
              {:else}
                {@html linkify(message.content)}
              {/if}
            </p>
            <!-- eslint-enable svelte/no-at-html-tags -->

            <!-- Attachments -->
            {#if message.attachments && message.attachments.length > 0}
              {#each message.attachments as att (att.id)}
                {#if att.mimeType.startsWith('image/')}
                  <div class="attachment image-attachment">
                    <div class="attachment-image-wrapper">
                      <img
                        src={att.downloadUrl ??
                          `/api/v2/chat/attachments/${att.fileUuid}/download?inline=true`}
                        alt={att.fileName}
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

            <!-- Time + Read Indicator -->
            <div class="message-time">
              {formatMessageTime(message.createdAt)}
              {#if isOwn}
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
