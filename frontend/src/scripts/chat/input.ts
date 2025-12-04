/**
 * Chat Module - Input Handling
 * Message input and file upload
 */

import { getChatState } from './state';
import { $$ } from '../../utils/dom-utils';
import { showNotification, formatFileSize } from './utils';
import { sendTypingStart, sendTypingStop, sendChatMessage } from './websocket';
import {
  uploadAttachments,
  createConversation,
  type AttachmentResponse,
  type ApiParticipant,
  type ApiConversation,
} from './api';
import { displayMessage } from './messages';
import { renderConversationList, renderChatHeader } from './ui';
import { getScheduledTime, sendScheduledMessage } from './schedule';
import type {
  CreateConversationRequest,
  Conversation,
  ConversationParticipant,
  ConversationLastMessage,
} from './types';

// ============================================================================
// Message Input
// ============================================================================

/**
 * Get validated message content from input
 * For pending conversations, we don't require currentConversationId
 */
function getMessageContent(content?: string, allowPending: boolean = false): string | null {
  const state = getChatState();
  const messageInput = $$('#messageInput') as HTMLTextAreaElement | null;
  const messageContent = content ?? messageInput?.value.trim();

  const hasValidContent = messageContent !== undefined && messageContent !== '';
  const hasValidConversation = state.currentConversationId !== null && state.currentConversationId !== 0;
  const hasPendingConversation = state.hasPendingConversation();

  // Allow message if we have content AND (valid conversation OR pending conversation when allowed)
  if (!hasValidContent) {
    console.warn('No message content');
    return null;
  }

  if (!hasValidConversation && !(allowPending && hasPendingConversation)) {
    console.warn('No conversation ID and no pending conversation');
    return null;
  }

  return messageContent;
}

/**
 * Clear input field and reset UI after sending
 */
function clearInputAfterSend(content?: string): void {
  const messageInput = $$('#messageInput') as HTMLTextAreaElement | null;
  if (messageInput !== null && (content === undefined || content === '')) {
    messageInput.value = '';
    resizeTextarea();
  }
  stopTyping();
}

/**
 * Send a message (immediate or scheduled)
 * Handles lazy conversation creation: if pending conversation exists,
 * creates conversation with initial message first
 */
export async function sendMessage(content?: string): Promise<void> {
  const state = getChatState();

  // Allow pending conversations for lazy creation
  const messageContent = getMessageContent(content, true);

  if (messageContent === null) return;

  clearInputAfterSend(content);

  // If scheduled, use schedule API instead of WebSocket
  if (getScheduledTime() !== null) {
    const success = await sendScheduledMessage(messageContent);
    if (success) {
      state.pendingFiles = [];
      clearFilePreview();
    }
    return;
  }

  // LAZY CREATION: If pending conversation, create it now with the first message
  if (state.hasPendingConversation()) {
    await createConversationWithMessage(messageContent);
    return;
  }

  // Send immediately via WebSocket or queue
  await sendImmediateMessage(state, messageContent);
}

/**
 * Transform API response to local Conversation type
 */
function transformApiConversation(apiConv: ApiConversation): Conversation {
  const participants: ConversationParticipant[] = apiConv.participants.map((p: ApiParticipant) => {
    const participant: ConversationParticipant = {
      id: p.id,
      username: p.username,
      firstName: p.firstName,
      lastName: p.lastName,
    };
    if (p.profilePictureUrl !== null) {
      participant.profileImageUrl = p.profilePictureUrl;
    }
    return participant;
  });

  const conversation: Conversation = {
    id: apiConv.id,
    uuid: apiConv.uuid,
    isGroup: apiConv.isGroup,
    createdAt: apiConv.createdAt,
    updatedAt: apiConv.updatedAt,
    participants,
    unreadCount: apiConv.unreadCount,
  };

  if (apiConv.name !== null) {
    conversation.name = apiConv.name;
  }

  if (apiConv.lastMessage !== null) {
    const lastMsg: ConversationLastMessage = {
      content: apiConv.lastMessage.content,
      createdAt: apiConv.lastMessage.createdAt,
    };
    conversation.lastMessage = lastMsg;
  }

  return conversation;
}

/**
 * Display the sent message in chat after conversation creation
 */
function displaySentMessage(conversationId: number, messageContent: string): void {
  const state = getChatState();
  const tempMessage = {
    id: Date.now(),
    conversationId,
    senderId: state.currentUserId ?? 0,
    content: messageContent,
    createdAt: new Date().toISOString(),
    isRead: false,
    type: 'text' as const,
    sender: state.currentUser,
  };
  displayMessage(tempMessage);
}

/**
 * Create conversation with initial message (lazy creation)
 * Called when user sends first message in a pending conversation
 */
async function createConversationWithMessage(messageContent: string): Promise<void> {
  const state = getChatState();
  const pendingConv = state.pendingConversation;

  if (pendingConv === null) {
    console.error('No pending conversation to create');
    return;
  }

  state.isCreatingConversation = true;

  try {
    const request: CreateConversationRequest = {
      participantIds: [pendingConv.targetUser.id],
      isGroup: pendingConv.isGroup,
      initialMessage: messageContent,
    };

    if (pendingConv.name !== undefined) {
      request.name = pendingConv.name;
    }

    const { conversation: apiConv } = await createConversation(request);
    const conversation = transformApiConversation(apiConv);

    state.conversations.unshift(conversation);
    state.clearPendingConversation();
    state.currentConversationId = conversation.id;

    renderConversationList();
    renderChatHeader();
    displaySentMessage(conversation.id, messageContent);
    showNotification('Unterhaltung gestartet', 'success');
  } catch (error) {
    console.error('Error creating conversation with message:', error);
    const errorMsg = error instanceof Error ? error.message : 'Fehler beim Erstellen';
    showNotification(errorMsg, 'error');
  } finally {
    state.isCreatingConversation = false;
  }
}

/** Temp attachment type for display */
interface TempAttachment {
  id: number;
  fileUuid: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
  createdAt: string;
}

/** Map uploaded attachments to temp format and show success notification */
function processUploadedAttachments(uploaded: AttachmentResponse[]): TempAttachment[] {
  const mapped = uploaded.map((a) => ({
    id: a.id,
    fileUuid: a.fileUuid,
    fileName: a.filename,
    originalName: a.originalName,
    fileSize: a.fileSize,
    mimeType: a.mimeType,
    downloadUrl: a.downloadUrl,
    createdAt: a.createdAt,
  }));
  const msg = uploaded.length === 1 ? 'Datei erfolgreich hochgeladen' : `${uploaded.length} Dateien hochgeladen`;
  showNotification(msg, 'success');
  return mapped;
}

/**
 * Send message immediately via WebSocket or queue for later
 */
async function sendImmediateMessage(state: ReturnType<typeof getChatState>, messageContent: string): Promise<void> {
  const conversationId = state.currentConversationId;
  if (conversationId === null) return;

  const tempMessage: {
    id: number;
    conversationId: number;
    senderId: number;
    content: string;
    createdAt: string;
    isRead: boolean;
    type: 'text';
    sender: typeof state.currentUser;
    attachments?: TempAttachment[];
  } = {
    id: Date.now(),
    conversationId,
    senderId: state.currentUserId ?? 0,
    content: messageContent,
    createdAt: new Date().toISOString(),
    isRead: false,
    type: 'text' as const,
    sender: state.currentUser,
  };

  const isConnected = state.isConnected && state.ws !== null && state.ws.readyState === WebSocket.OPEN;

  if (isConnected) {
    const filesToUpload = [...state.pendingFiles];
    state.pendingFiles = [];

    let uploadedAttachments: AttachmentResponse[] = [];
    if (filesToUpload.length > 0) {
      uploadedAttachments = await uploadAttachments(filesToUpload, conversationId, (i, p) => {
        updateUploadProgress(i, p);
      });
      tempMessage.attachments = processUploadedAttachments(uploadedAttachments);
    }

    sendChatMessage(
      conversationId,
      messageContent,
      uploadedAttachments.map((a) => a.id),
    );
    clearFilePreview();
  } else {
    state.messageQueue.push(tempMessage);
    showNotification('Nachricht wird gesendet, sobald die Verbindung wiederhergestellt ist', 'info');
  }

  displayMessage(tempMessage);
  state.updateConversationWithMessage(conversationId, tempMessage);
  renderConversationList();
}

/**
 * Update upload progress in file preview
 */
function updateUploadProgress(fileIndex: number, percent: number): void {
  const previewItems = document.querySelectorAll('.file-preview-item');
  // eslint-disable-next-line security/detect-object-injection -- fileIndex is from controlled for loop callback
  const item = previewItems[fileIndex];
  if (!item) return;

  let progressBar = item.querySelector('.upload-progress');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.className = 'upload-progress';
    progressBar.innerHTML = '<div class="progress-bar"></div>';
    item.append(progressBar);
  }

  const bar = progressBar.querySelector('.progress-bar');
  if (bar instanceof HTMLElement) {
    bar.style.width = `${percent}%`;
  }

  // Add uploading class
  if (percent < 100) {
    item.classList.add('uploading');
  } else {
    item.classList.remove('uploading');
    item.classList.add('uploaded');
  }
}

/**
 * Resize textarea based on content
 */
export function resizeTextarea(): void {
  const textarea = $$('#messageInput') as HTMLTextAreaElement | null;
  if (!textarea) return;

  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
}

// ============================================================================
// Typing Indicators
// ============================================================================

/**
 * Handle typing event
 */
export function handleTyping(): void {
  const state = getChatState();

  if (state.currentConversationId === null || !state.isConnected) return;

  sendTypingStart(state.currentConversationId);

  // Clear existing timer
  if (state.typingTimer !== null) {
    clearTimeout(state.typingTimer);
  }

  // Set timer to stop typing after 2 seconds
  state.typingTimer = setTimeout(() => {
    stopTyping();
  }, 2000);
}

/**
 * Stop typing indicator
 */
export function stopTyping(): void {
  const state = getChatState();

  if (state.typingTimer !== null) {
    clearTimeout(state.typingTimer);
    state.typingTimer = null;
  }

  if (state.isConnected && state.currentConversationId !== null) {
    sendTypingStop(state.currentConversationId);
  }
}

// ============================================================================
// File Upload
// ============================================================================

/**
 * Handle file upload
 */
export function handleFileUpload(files: FileList): void {
  const state = getChatState();
  const maxSize = 10 * 1024 * 1024; // 10MB
  const validFiles: File[] = [];

  for (const file of files) {
    if (file.size > maxSize) {
      showNotification(`Datei "${file.name}" ist zu groß (max. 10MB)`, 'warning');
    } else {
      validFiles.push(file);
    }
  }

  if (validFiles.length > 0) {
    state.pendingFiles = validFiles;
    showFilePreview();
  }
}

/**
 * Show file preview
 */
function showFilePreview(): void {
  const state = getChatState();
  const previewContainer = $$('#filePreview');
  if (previewContainer === null) return;

  previewContainer.innerHTML = '';
  previewContainer.classList.remove('hidden');

  state.pendingFiles.forEach((file, index) => {
    const preview = createFilePreviewItem(file, index);
    previewContainer.append(preview);
  });
}

/**
 * Create file preview item
 */
function createFilePreviewItem(file: File, index: number): HTMLDivElement {
  const preview = document.createElement('div');
  preview.className = 'file-preview-item';

  const isImage = file.type.startsWith('image/');

  // File icon/preview
  const fileIconDiv = document.createElement('div');
  fileIconDiv.className = 'file-icon';

  if (isImage) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    fileIconDiv.append(img);
  } else {
    const icon = document.createElement('i');
    icon.className = 'fas fa-file';
    fileIconDiv.append(icon);
  }

  // File info
  const fileInfoDiv = document.createElement('div');
  fileInfoDiv.className = 'file-info';

  const fileName = document.createElement('div');
  fileName.className = 'file-name';
  fileName.textContent = file.name;

  const fileSize = document.createElement('div');
  fileSize.className = 'file-size';
  fileSize.textContent = formatFileSize(file.size);

  fileInfoDiv.append(fileName, fileSize);

  // Remove button
  const removeButton = document.createElement('button');
  removeButton.className = 'remove-file';
  removeButton.type = 'button';

  const removeIcon = document.createElement('i');
  removeIcon.className = 'fas fa-times';
  removeButton.append(removeIcon);

  removeButton.addEventListener('click', () => {
    removeFile(index);
  });

  preview.append(fileIconDiv, fileInfoDiv, removeButton);
  return preview;
}

/**
 * Remove file from pending list
 */
function removeFile(index: number): void {
  const state = getChatState();
  state.pendingFiles.splice(index, 1);

  if (state.pendingFiles.length === 0) {
    clearFilePreview();
  } else {
    showFilePreview();
  }
}

/**
 * Clear file preview
 */
function clearFilePreview(): void {
  const previewContainer = $$('#filePreview');
  if (previewContainer !== null) {
    previewContainer.classList.add('hidden');
    previewContainer.innerHTML = '';
  }
}

// ============================================================================
// Event Setup
// ============================================================================

/**
 * Setup message input handlers
 */
export function setupMessageInput(onSend: () => Promise<void>): void {
  const messageInput = $$('#messageInput') as HTMLTextAreaElement | null;

  if (messageInput !== null) {
    messageInput.addEventListener('keypress', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void onSend();
      }
    });

    messageInput.addEventListener('input', () => {
      handleTyping();
      resizeTextarea();
    });
  }
}

/**
 * Setup send button
 */
export function setupSendButton(onSend: () => Promise<void>): void {
  const sendBtn = $$('#sendButton');

  if (sendBtn !== null) {
    sendBtn.addEventListener('click', () => {
      void onSend();
    });
  }
}

/**
 * Setup file upload handlers
 */
export function setupFileUpload(): void {
  const fileInput = $$('#fileInput') as HTMLInputElement | null;
  const attachmentBtn = $$('#attachmentBtn');

  if (attachmentBtn !== null && fileInput !== null) {
    attachmentBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.click();
    });
  }

  if (fileInput !== null) {
    fileInput.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement | null;
      const files = target?.files;
      if (files !== null && files !== undefined && files.length > 0) {
        handleFileUpload(files);
        fileInput.value = '';
      }
    });
  }
}
