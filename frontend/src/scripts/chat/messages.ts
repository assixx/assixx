/* eslint-disable max-lines */
/**
 * Chat Module - Message Handling
 * Display and process messages
 */

import type { Message, Attachment, MessageWithExtra, ChatUser, ScheduledMessage } from './types';
import { getChatState } from './state';
import { $$, escapeHtml } from '../../utils/dom-utils';
import {
  linkify,
  formatFileSize,
  getValidMessageDate,
  isToday,
  isYesterday,
  playNotificationSound,
  showDesktopNotification,
} from './utils';
import { markMessageAsRead } from './websocket';
import { markAttachmentAsRead } from './api';
import { tokenManager } from '../../utils/token-manager';

// ============================================================================
// Message Display
// ============================================================================

/**
 * Display multiple messages in the container
 */
export function displayMessages(messages: Message[]): void {
  const messagesContainer = $$('#messagesContainer');
  if (!messagesContainer) return;

  // Hide container before updating
  messagesContainer.classList.remove('loaded');
  messagesContainer.innerHTML = '';

  let lastMessageDate: string | null = null;

  messages.forEach((message) => {
    const messageDate = getValidMessageDate(message);
    if (messageDate === null) {
      displayMessage(message);
      return;
    }

    if (lastMessageDate !== messageDate) {
      addDateSeparator(messageDate, messagesContainer);
      lastMessageDate = messageDate;
    }

    displayMessage(message);
  });

  // Scroll to bottom
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    setTimeout(() => {
      messagesContainer.classList.add('loaded');
    }, 50);
  });
}

/**
 * Display a single message
 */
export function displayMessage(message: Message): void {
  const messagesContainer = $$('#messagesContainer');
  if (!messagesContainer) return;

  const messageDate = getValidMessageDate(message);
  if (messageDate === null) return;

  handleDateSeparator(messageDate, messagesContainer);
  renderMessageElement(message, messageDate, messagesContainer);
}

/**
 * Render a message element
 */
function renderMessageElement(message: Message, messageDate: string, container: HTMLElement): void {
  const state = getChatState();
  const isOwnMessage = message.senderId === state.currentUserId;

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isOwnMessage ? 'own' : ''}`;
  messageDiv.dataset['messageId'] = message.id.toString();
  messageDiv.dataset['date'] = messageDate;

  const time = new Date(message.createdAt).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const messageContent = escapeHtml(message.content);

  // Create message content
  const messageContentDiv = document.createElement('div');
  messageContentDiv.className = 'message-content';

  const messageTextDiv = document.createElement('div');
  messageTextDiv.className = 'message-text';
  // Content is already sanitized via escapeHtml() on line 94 before linkify transforms URLs
  // eslint-disable-next-line no-unsanitized/property -- content sanitized via escapeHtml() before linkify()
  messageTextDiv.innerHTML = linkify(messageContent);
  messageContentDiv.append(messageTextDiv);

  // Add attachments
  if (message.attachments !== undefined && message.attachments.length > 0) {
    const attachmentFragment = renderAttachments(message.attachments);
    messageContentDiv.append(attachmentFragment);
  }

  // Create time element
  const messageTimeDiv = document.createElement('div');
  messageTimeDiv.className = 'message-time';
  messageTimeDiv.textContent = time;

  if (isOwnMessage) {
    const readIndicator = document.createElement('span');
    readIndicator.className = `read-indicator ${message.isRead ? 'read' : ''}`;
    readIndicator.textContent = '✓✓';
    messageTimeDiv.append(readIndicator);
  }

  messageContentDiv.append(messageTimeDiv);
  messageDiv.append(messageContentDiv);

  container.append(messageDiv);
  container.scrollTop = container.scrollHeight;
}

// ============================================================================
// Attachment Preview Modal
// ============================================================================

let previewModalInitialized = false;

/**
 * Get file icon based on mime type
 */
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'fas fa-image text-success-500';
  if (mimeType === 'application/pdf') return 'fas fa-file-pdf text-error-500';
  if (mimeType.includes('word')) return 'fas fa-file-word text-info-500';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel text-success-600';
  return 'fas fa-file text-content-secondary';
}

/**
 * Build download URL for attachment
 */
function buildAttachmentUrl(attachment: Attachment): string {
  if (attachment.downloadUrl !== undefined && attachment.downloadUrl !== '') {
    return attachment.downloadUrl;
  }
  return `/api/v2/chat/attachments/${attachment.fileUuid}/download`;
}

/**
 * Append auth token to URL for authenticated requests
 * Required because img.src and iframe.src can't send Authorization headers
 */
function appendAuthToken(url: string): string {
  const token = tokenManager.getAccessToken();
  // eslint-disable-next-line security/detect-possible-timing-attacks -- Checking for null/undefined is safe
  if (token === null) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

/**
 * Create or get preview modal element
 */
function getOrCreatePreviewModal(): HTMLElement {
  let modal = document.getElementById('chatAttachmentPreviewModal');

  if (modal === null) {
    modal = document.createElement('div');
    modal.id = 'chatAttachmentPreviewModal';
    modal.className = 'modal-overlay hidden';
    modal.innerHTML = `
      <div class="ds-modal ds-modal--xl">
        <div class="ds-modal__header">
          <h3 class="ds-modal__title">
            <i id="chatPreviewIcon" class="fas fa-file mr-2"></i>
            <span id="chatPreviewTitle">Vorschau</span>
          </h3>
          <button class="btn btn-icon" data-action="close-chat-preview" aria-label="Schließen">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ds-modal__body p-0" id="chatPreviewBody">
          <iframe id="chatPreviewIframe" class="block w-full h-[70vh] min-h-[600px] border-none hidden" title="Dokumentenvorschau"></iframe>
          <div id="chatPreviewImageContainer" class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-surface-1 hidden">
            <img id="chatPreviewImage" class="max-w-full max-h-full object-contain block" alt="Bildvorschau" />
          </div>
          <div id="chatPreviewNoPreview" class="hidden flex flex-col items-center justify-center h-[70vh] min-h-[600px]">
            <i class="fas fa-file-alt text-6xl text-content-tertiary mb-4"></i>
            <p class="text-content-secondary mb-4">Diese Datei kann nicht als Vorschau angezeigt werden.</p>
          </div>
        </div>
        <div class="bg-surface-2 border-border-subtle border-t p-4">
          <div class="flex gap-6 items-center text-content-secondary text-sm">
            <span id="chatPreviewSize" class="flex gap-2 items-center">
              <i class="fas fa-file-archive"></i>
              <span>-</span>
            </span>
          </div>
        </div>
        <div class="ds-modal__footer">
          <button class="btn btn-cancel" data-action="close-chat-preview">
            <i class="fas fa-times mr-2"></i>
            Schließen
          </button>
          <button class="btn btn-modal" id="chatPreviewDownloadBtn">
            <i class="fas fa-download mr-2"></i>
            Herunterladen
          </button>
        </div>
      </div>
    `;
    document.body.append(modal);
  }

  return modal;
}

/** Current attachment being previewed */
let currentChatPreviewAttachment: Attachment | null = null;

/**
 * Update preview modal header (title and icon)
 */
function updatePreviewHeader(attachment: Attachment): void {
  const titleEl = document.getElementById('chatPreviewTitle');
  const iconEl = document.getElementById('chatPreviewIcon');
  if (titleEl) titleEl.textContent = attachment.originalName ?? attachment.fileName;
  if (iconEl) iconEl.className = getFileIcon(attachment.mimeType) + ' mr-2';
}

/**
 * Update preview modal metadata (file size only)
 */
function updatePreviewMetadata(attachment: Attachment): void {
  const sizeEl = document.getElementById('chatPreviewSize');
  const sizeSpan = sizeEl?.querySelector('span');
  if (sizeSpan) sizeSpan.textContent = formatFileSize(attachment.fileSize);
}

/**
 * Show appropriate preview content based on file type
 */
function showPreviewContent(downloadUrl: string, attachment: Attachment): void {
  const iframe = document.getElementById('chatPreviewIframe') as HTMLIFrameElement | null;
  const imageContainer = document.getElementById('chatPreviewImageContainer');
  const image = document.getElementById('chatPreviewImage') as HTMLImageElement | null;
  const noPreview = document.getElementById('chatPreviewNoPreview');

  const isImage = attachment.mimeType.startsWith('image/');
  const isPDF = attachment.mimeType === 'application/pdf';

  // Hide all containers first
  iframe?.classList.add('hidden');
  imageContainer?.classList.add('hidden');
  noPreview?.classList.add('hidden');

  // Build preview URL - use /preview endpoint for PDFs (same as Documents Explorer)
  // attachment.id is the document ID from backend
  const previewUrl = isPDF ? `/api/v2/documents/${attachment.id}/preview` : downloadUrl;
  const authenticatedUrl = appendAuthToken(previewUrl);

  if (isPDF && iframe !== null) {
    iframe.classList.remove('hidden');
    iframe.src = authenticatedUrl;
  } else if (isImage && imageContainer !== null && image !== null) {
    imageContainer.classList.remove('hidden');
    image.src = authenticatedUrl;
    image.alt = attachment.fileName;
  } else {
    noPreview?.classList.remove('hidden');
  }
}

/**
 * Open chat attachment preview modal
 */
export function openChatPreviewModal(attachment: Attachment): void {
  const modal = getOrCreatePreviewModal();
  currentChatPreviewAttachment = attachment;

  updatePreviewHeader(attachment);
  updatePreviewMetadata(attachment);
  showPreviewContent(buildAttachmentUrl(attachment), attachment);

  // Mark attachment as read (fire and forget - non-critical)
  void markAttachmentAsRead(attachment.fileUuid);

  // Show modal using Design System pattern
  modal.classList.remove('hidden');
  modal.classList.add('modal-overlay--active');
  document.body.style.overflow = 'hidden';
}

/**
 * Close chat attachment preview modal
 */
export function closeChatPreviewModal(): void {
  const modal = document.getElementById('chatAttachmentPreviewModal');
  const iframe = document.getElementById('chatPreviewIframe') as HTMLIFrameElement | null;
  const image = document.getElementById('chatPreviewImage') as HTMLImageElement | null;
  const imageContainer = document.getElementById('chatPreviewImageContainer');
  const noPreview = document.getElementById('chatPreviewNoPreview');

  if (modal === null) return;

  // Hide modal using Design System pattern (deactivate and add hidden)
  modal.classList.remove('modal-overlay--active');
  modal.classList.add('hidden');

  // Clear preview content (remove error handlers first to prevent false positives)
  if (iframe) {
    iframe.onerror = null;
    iframe.src = '';
    iframe.classList.add('hidden');
  }

  if (image) {
    image.onerror = null;
    image.src = '';
  }

  if (imageContainer) {
    imageContainer.classList.add('hidden');
  }

  if (noPreview) {
    noPreview.classList.add('hidden');
  }

  currentChatPreviewAttachment = null;
  document.body.style.overflow = '';
}

/**
 * Download current preview attachment
 */
function downloadCurrentChatAttachment(): void {
  if (currentChatPreviewAttachment === null) return;

  const downloadUrl = appendAuthToken(buildAttachmentUrl(currentChatPreviewAttachment));
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = currentChatPreviewAttachment.originalName ?? currentChatPreviewAttachment.fileName;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Initialize preview modal event listeners
 */
function initPreviewModalListeners(): void {
  if (previewModalInitialized) return;
  previewModalInitialized = true;

  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Close preview modal
    const isCloseBtn = target.closest('[data-action="close-chat-preview"]') !== null;
    const isOverlay = target.id === 'chatAttachmentPreviewModal';
    if (isCloseBtn || isOverlay) {
      closeChatPreviewModal();
      return;
    }

    // Download button
    if (target.closest('#chatPreviewDownloadBtn') !== null) {
      downloadCurrentChatAttachment();
      return;
    }

    // Open preview from attachment click
    const attachmentEl = target.closest<HTMLElement>('[data-attachment-preview]');
    if (attachmentEl !== null) {
      const attachmentData = attachmentEl.dataset['attachmentData'];
      if (attachmentData !== undefined && attachmentData !== '') {
        try {
          const attachment = JSON.parse(attachmentData) as Attachment;
          openChatPreviewModal(attachment);
        } catch {
          console.error('Failed to parse attachment data');
        }
      }
    }
  });

  // Escape key to close
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeChatPreviewModal();
    }
  });
}

/**
 * Render image attachment with preview overlay
 */
function renderImageAttachmentContent(container: HTMLDivElement, downloadUrl: string, fileName: string): void {
  container.classList.add('image-attachment');
  const imgWrapper = document.createElement('div');
  imgWrapper.className = 'attachment-image-wrapper';
  const img = document.createElement('img');
  img.src = appendAuthToken(downloadUrl);
  img.alt = fileName;
  img.loading = 'lazy';
  imgWrapper.append(img);
  const overlay = document.createElement('div');
  overlay.className = 'attachment-overlay';
  overlay.innerHTML = '<i class="fas fa-search-plus"></i>';
  imgWrapper.append(overlay);
  container.append(imgWrapper);
}

/**
 * Render file attachment with info and action buttons
 */
function renderFileAttachmentContent(
  container: HTMLDivElement,
  attachment: Attachment,
  downloadUrl: string,
  fileSize: string,
  canPreview: boolean,
): void {
  container.classList.add('file-attachment');
  const fileIcon = document.createElement('i');
  fileIcon.className = getFileIcon(attachment.mimeType);
  container.append(fileIcon);

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-info';
  const fileName = document.createElement('div');
  fileName.className = 'file-name';
  fileName.textContent = attachment.originalName ?? attachment.fileName;
  fileInfo.append(fileName);
  const fileSizeDiv = document.createElement('div');
  fileSizeDiv.className = 'file-size';
  fileSizeDiv.textContent = fileSize;
  fileInfo.append(fileSizeDiv);
  container.append(fileInfo);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'attachment-actions';
  if (canPreview) {
    const previewBtn = document.createElement('button');
    previewBtn.className = 'btn btn-sm btn-icon';
    previewBtn.title = 'Vorschau';
    previewBtn.innerHTML = '<i class="fas fa-eye"></i>';
    actionsDiv.append(previewBtn);
  }
  const downloadLink = document.createElement('a');
  downloadLink.href = appendAuthToken(downloadUrl);
  downloadLink.className = 'btn btn-sm btn-icon';
  downloadLink.title = 'Herunterladen';
  downloadLink.download = attachment.originalName ?? attachment.fileName;
  downloadLink.innerHTML = '<i class="fas fa-download"></i>';
  downloadLink.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
  });
  actionsDiv.append(downloadLink);
  container.append(actionsDiv);
}

/**
 * Render file attachments with preview modal support
 */
export function renderAttachments(attachments: Attachment[]): DocumentFragment {
  initPreviewModalListeners();
  const fragment = document.createDocumentFragment();

  for (const attachment of attachments) {
    const isImage = attachment.mimeType.startsWith('image/');
    const canPreview = isImage || attachment.mimeType === 'application/pdf';
    const downloadUrl = buildAttachmentUrl(attachment);
    const attachmentDiv = document.createElement('div');
    attachmentDiv.className = 'attachment';

    if (canPreview) {
      attachmentDiv.dataset['attachmentPreview'] = 'true';
      attachmentDiv.dataset['attachmentData'] = JSON.stringify(attachment);
      attachmentDiv.style.cursor = 'pointer';
    }

    if (isImage) {
      renderImageAttachmentContent(attachmentDiv, downloadUrl, attachment.fileName);
    } else {
      renderFileAttachmentContent(
        attachmentDiv,
        attachment,
        downloadUrl,
        formatFileSize(attachment.fileSize),
        canPreview,
      );
    }
    fragment.append(attachmentDiv);
  }

  return fragment;
}

// ============================================================================
// Date Separators
// ============================================================================

/**
 * Handle date separator for message
 */
function handleDateSeparator(messageDate: string, messagesContainer: HTMLElement): void {
  const messages = messagesContainer.querySelectorAll('.message');
  const lastMessage = messages[messages.length - 1] as HTMLElement | undefined;

  const separatorExists = checkDateSeparatorExists(messageDate, messagesContainer);

  if (!separatorExists) {
    if (messages.length > 0 && lastMessage !== undefined) {
      const lastMessageDate = lastMessage.dataset['date'];
      if (lastMessageDate !== '' && lastMessageDate !== messageDate) {
        addDateSeparator(messageDate, messagesContainer);
      }
    } else {
      addDateSeparator(messageDate, messagesContainer);
    }
  }
}

/**
 * Check if date separator already exists
 */
function checkDateSeparatorExists(messageDate: string, messagesContainer: HTMLElement): boolean {
  const existingSeparators = messagesContainer.querySelectorAll('.date-separator');
  return [...existingSeparators].some((separator) => {
    const separatorText = separator.textContent !== '' ? separator.textContent.trim() : '';
    return (
      separatorText === messageDate ||
      (separatorText === 'Heute' && isToday(messageDate)) ||
      (separatorText === 'Gestern' && isYesterday(messageDate))
    );
  });
}

/**
 * Add date separator to container
 */
export function addDateSeparator(dateString: string, container: HTMLElement): void {
  // Check for existing separator
  const existingSeparators = container.querySelectorAll<HTMLElement>('.date-separator');
  const separatorExists = [...existingSeparators].some((separator) => {
    return separator.dataset['date'] === dateString;
  });

  if (separatorExists) return;

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Parse date
  let messageDate: Date;
  if (dateString.includes('.')) {
    const [day, month, year] = dateString.split('.');
    messageDate = new Date(
      Number.parseInt(year ?? '0', 10),
      Number.parseInt(month ?? '0', 10) - 1,
      Number.parseInt(day ?? '0', 10),
    );
  } else {
    messageDate = new Date(dateString);
  }

  if (Number.isNaN(messageDate.getTime())) {
    console.error('Invalid date for separator:', dateString);
    return;
  }

  let displayDate = dateString;

  if (messageDate.toDateString() === today.toDateString()) {
    displayDate = 'Heute';
  } else if (messageDate.toDateString() === yesterday.toDateString()) {
    displayDate = 'Gestern';
  } else {
    displayDate = messageDate.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  const separator = document.createElement('div');
  separator.className = 'date-separator';
  separator.dataset['date'] = dateString;

  const span = document.createElement('span');
  span.textContent = displayDate;
  separator.append(span);
  container.append(separator);
}

// ============================================================================
// Message Processing
// ============================================================================

/**
 * Ensure message has sender information
 */
export function ensureMessageHasSender(message: Message): void {
  const msgWithExtra = message as MessageWithExtra;
  if (message.sender === undefined && msgWithExtra.senderId !== 0) {
    message.sender = {
      id: msgWithExtra.senderId,
      username: msgWithExtra.username ?? msgWithExtra.senderName ?? 'Unknown',
      firstName: msgWithExtra.firstName,
      lastName: msgWithExtra.lastName,
      profilePicture: msgWithExtra.profileImageUrl ?? msgWithExtra.senderProfilePicture,
      role: 'employee',
      tenantId: 0,
      email: '',
      createdAt: '',
      updatedAt: '',
      isActive: 1,
    };
  }
}

/**
 * Replace temporary message with confirmed one
 */
export function replaceTemporaryMessage(message: Message): void {
  const messagesContainer = $$('#messagesContainer');
  if (!messagesContainer) {
    displayMessage(message);
    return;
  }

  const tempMessages = messagesContainer.querySelectorAll('.message.own');
  tempMessages.forEach((msg) => {
    const msgText = msg.querySelector('.message-text')?.textContent;
    if (msgText === message.content && ((msg as HTMLElement).dataset['messageId']?.length ?? 0) > 10) {
      msg.remove();
    }
  });
  displayMessage(message);
}

/**
 * Handle new message notifications
 */
export function handleNewMessageNotifications(message: Message): void {
  const state = getChatState();

  if (message.senderId === state.currentUserId) return;

  void playNotificationSound();

  if (window.unifiedNav !== undefined && typeof window.unifiedNav.updateUnreadMessages === 'function') {
    void window.unifiedNav.updateUnreadMessages();
  }
}

/**
 * Handle incoming new message
 */
export function handleNewMessage(data: { message: Message; conversationId: number }): void {
  const state = getChatState();
  const { message, conversationId } = data;

  ensureMessageHasSender(message);
  state.updateConversationWithMessage(conversationId, message);

  // Handle message in current conversation
  if (conversationId === state.currentConversationId) {
    if (message.senderId === state.currentUserId) {
      replaceTemporaryMessage(message);
    } else {
      displayMessage(message);
      markMessageAsRead(message.id);

      if (!document.hasFocus()) {
        showDesktopNotification(message);
      }
    }
  }

  handleNewMessageNotifications(message);
}

/**
 * Transform WebSocket message to proper Message type
 */
export function transformWebSocketMessage(data: {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  createdAt: string;
  isRead?: boolean;
  type?: string;
  attachments?: Attachment[];
  sender?: ChatUser;
  username?: string;
  senderName?: string;
  firstName?: string;
  lastName?: string;
}): Message {
  return {
    id: data.id,
    conversationId: data.conversationId,
    senderId: data.senderId,
    content: data.content,
    createdAt: data.createdAt,
    isRead: data.isRead ?? false,
    type: (data.type ?? 'text') as 'text' | 'file' | 'system',
    attachments: data.attachments ?? [],
    sender:
      data.sender ??
      ({
        id: data.senderId,
        username: data.username ?? data.senderName ?? 'Unknown',
        firstName: data.firstName,
        lastName: data.lastName,
        email: '',
        role: 'employee' as const,
        tenantId: 0,
        createdAt: '',
        updatedAt: '',
        isActive: 1,
      } as ChatUser),
  };
}

// ============================================================================
// Scheduled Message Display
// ============================================================================

/**
 * Format scheduled time for display
 */
function formatScheduledTime(scheduledFor: string): string {
  const date = new Date(scheduledFor);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isScheduledToday = date.toDateString() === today.toDateString();
  const isScheduledTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isScheduledToday) {
    return `Heute um ${timeStr}`;
  } else if (isScheduledTomorrow) {
    return `Morgen um ${timeStr}`;
  } else {
    const dateStr = date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
    });
    return `${dateStr} um ${timeStr}`;
  }
}

/**
 * Render a scheduled message element
 */
export function renderScheduledMessageElement(scheduledMsg: ScheduledMessage, container: HTMLElement): void {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message own message--scheduled';
  messageDiv.dataset['scheduledId'] = scheduledMsg.id;

  const messageContent = escapeHtml(scheduledMsg.content);
  const scheduledTimeText = formatScheduledTime(scheduledMsg.scheduledFor);

  // Create message content
  const messageContentDiv = document.createElement('div');
  messageContentDiv.className = 'message-content';

  const messageTextDiv = document.createElement('div');
  messageTextDiv.className = 'message-text';
  // Content is sanitized via escapeHtml() before linkify transforms URLs
  // eslint-disable-next-line no-unsanitized/property -- content sanitized via escapeHtml() before linkify()
  messageTextDiv.innerHTML = linkify(messageContent);
  messageContentDiv.append(messageTextDiv);

  // Create scheduled info element
  const scheduledInfoDiv = document.createElement('div');
  scheduledInfoDiv.className = 'message--scheduled-info';

  const clockIcon = document.createElement('i');
  clockIcon.className = 'far fa-clock';
  scheduledInfoDiv.append(clockIcon);

  const infoText = document.createElement('span');
  infoText.textContent = `Noch nicht gesendet • wird ${scheduledTimeText} gesendet`;
  scheduledInfoDiv.append(infoText);

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'message--scheduled-cancel';
  cancelBtn.title = 'Geplante Nachricht abbrechen';
  cancelBtn.dataset['action'] = 'cancel-scheduled';
  cancelBtn.dataset['scheduledId'] = scheduledMsg.id;

  const cancelIcon = document.createElement('i');
  cancelIcon.className = 'fas fa-times';
  cancelBtn.append(cancelIcon);
  scheduledInfoDiv.append(cancelBtn);

  messageContentDiv.append(scheduledInfoDiv);
  messageDiv.append(messageContentDiv);

  container.append(messageDiv);
}

/**
 * Display scheduled messages for the current conversation
 */
export function displayScheduledMessages(scheduledMessages: ScheduledMessage[]): void {
  const messagesContainer = $$('#messagesContainer');
  if (!messagesContainer) return;

  // Remove existing scheduled message previews
  const existingScheduled = messagesContainer.querySelectorAll('.message--scheduled');
  existingScheduled.forEach((el) => {
    el.remove();
  });

  // Add scheduled messages at the end
  scheduledMessages.forEach((msg) => {
    renderScheduledMessageElement(msg, messagesContainer);
  });

  // Scroll to bottom if there are scheduled messages
  if (scheduledMessages.length > 0) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}
