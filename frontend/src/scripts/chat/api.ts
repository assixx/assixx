/**
 * Chat Module - API Layer
 * All HTTP API calls for the chat system
 * Uses API v2 exclusively
 */

import type {
  ChatUser,
  Conversation,
  Message,
  CreateConversationRequest,
  DepartmentOption,
  ScheduledMessage,
} from './types';
import { ApiClient } from '../../utils/api-client';

const apiClient = ApiClient.getInstance();

// ============================================================================
// Conversation API
// ============================================================================

/**
 * Load all conversations for current user
 */
export async function loadConversations(): Promise<Conversation[]> {
  const response = await apiClient.request<{
    data: Conversation[];
    pagination?: unknown;
  }>('/chat/conversations', {
    method: 'GET',
  });

  return response.data.map((conv: Conversation) => ({
    ...conv,
    participants: Array.isArray(conv.participants) ? conv.participants : [],
  }));
}

/**
 * API response types for conversation creation
 */
export interface ApiParticipant {
  id: number;
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
}

export interface ApiConversation {
  id: number;
  uuid: string;
  name: string | null;
  isGroup: boolean;
  createdAt: string;
  updatedAt: string;
  participants: ApiParticipant[];
  lastMessage: { content: string; createdAt: string } | null;
  unreadCount: number;
}

/**
 * Create a new conversation
 * Supports lazy creation: if initialMessage is provided, conversation is created with first message
 * @returns Full conversation object (not just ID) for immediate use without reload
 */
export async function createConversation(
  request: CreateConversationRequest,
): Promise<{ id: number; conversation: ApiConversation }> {
  const response = await apiClient.request<{ conversation: ApiConversation }>('/chat/conversations', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  if (response.conversation.id !== 0) {
    return { id: response.conversation.id, conversation: response.conversation };
  }
  throw new Error('Failed to create conversation');
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: number): Promise<void> {
  await apiClient.request<{ message: string }>(`/chat/conversations/${conversationId}`, {
    method: 'DELETE',
  });
}

/**
 * Mark conversation as read
 */
export async function markConversationAsRead(conversationId: number): Promise<void> {
  await apiClient.request<{ markedCount: number }>(`/chat/conversations/${conversationId}/read`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ============================================================================
// Message API
// ============================================================================

/**
 * Load messages for a conversation
 */
export async function loadMessages(conversationId: number): Promise<Message[]> {
  const response = await apiClient.request<{
    data: Message[];
    pagination?: unknown;
  }>(`/chat/conversations/${conversationId}/messages`, {
    method: 'GET',
  });

  return response.data;
}

// ============================================================================
// User API
// ============================================================================

/**
 * Load available users for chat
 */
export async function loadAvailableUsers(): Promise<ChatUser[]> {
  const response = await apiClient.request<{
    users: ChatUser[];
    total: number;
  }>('/chat/users', {
    method: 'GET',
  });

  return response.users;
}

/**
 * Load departments
 */
export async function loadDepartments(): Promise<DepartmentOption[]> {
  return await apiClient.request<DepartmentOption[]>('/departments', {
    method: 'GET',
  });
}

// ============================================================================
// Attachment API (Document-based system)
// ============================================================================

/**
 * Attachment response from document-based system
 */
export interface AttachmentResponse {
  id: number;
  fileUuid: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  category: string;
  downloadUrl: string;
  previewUrl: string;
  createdAt: string;
}

/**
 * Upload a single file attachment to a conversation
 * Uses the new document-based attachment system
 */
export async function uploadAttachment(
  file: File,
  conversationId: number,
  onProgress?: (percent: number) => void,
): Promise<AttachmentResponse | null> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    // Use XMLHttpRequest for progress tracking
    if (onProgress) {
      return await uploadWithProgress(`/api/v2/chat/conversations/${conversationId}/attachments`, formData, onProgress);
    }

    // Standard fetch for simple uploads
    return await apiClient.request<AttachmentResponse>(`/chat/conversations/${conversationId}/attachments`, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return null;
  }
}

/**
 * Upload with progress tracking using XMLHttpRequest
 */
async function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void,
): Promise<AttachmentResponse | null> {
  return await new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText) as { data: AttachmentResponse };
          resolve(response.data);
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });

    xhr.addEventListener('error', () => {
      resolve(null);
    });

    xhr.open('POST', url);
    // Include auth token
    const token = localStorage.getItem('token');
    if (token !== null && token !== '') {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  });
}

/**
 * Upload multiple files to a conversation
 */
export async function uploadAttachments(
  files: File[],
  conversationId: number,
  onProgress?: (fileIndex: number, percent: number) => void,
): Promise<AttachmentResponse[]> {
  const attachments: AttachmentResponse[] = [];

  for (let i = 0; i < files.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i is from controlled for loop, not user input
    const file = files[i];
    if (file === undefined) continue;

    const progressCallback = onProgress
      ? (percent: number) => {
          onProgress(i, percent);
        }
      : undefined;

    const attachment = await uploadAttachment(file, conversationId, progressCallback);
    if (attachment) {
      attachments.push(attachment);
    }
  }

  return attachments;
}

/**
 * Get all attachments for a conversation
 */
export async function getConversationAttachments(conversationId: number): Promise<AttachmentResponse[]> {
  try {
    const response = await apiClient.request<{
      attachments: AttachmentResponse[];
      total: number;
    }>(`/chat/conversations/${conversationId}/attachments`, {
      method: 'GET',
    });
    return response.attachments;
  } catch (error) {
    console.error('Error getting attachments:', error);
    return [];
  }
}

/**
 * Get download URL for an attachment
 */
export function getAttachmentDownloadUrl(fileUuid: string, inline: boolean = false): string {
  const query = inline ? '?inline=true' : '';
  return `/api/v2/chat/attachments/${fileUuid}/download${query}`;
}

/**
 * Delete an attachment by document ID
 */
export async function deleteAttachment(documentId: number): Promise<boolean> {
  try {
    await apiClient.request<{ message: string }>(`/chat/attachments/${documentId}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return false;
  }
}

/**
 * Mark attachment as read (uses documents API)
 * This updates the read status in document_read_status table
 */
export async function markAttachmentAsRead(fileUuid: string): Promise<void> {
  try {
    await apiClient.request<{ success: boolean }>(`/documents/${fileUuid}/read`, {
      method: 'POST',
      body: JSON.stringify({}), // Empty body required for Content-Type header
    });
  } catch (error) {
    console.error('Failed to mark attachment as read:', error);
    // Non-critical - don't throw
  }
}

// ============================================================================
// Legacy Attachment API (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use uploadAttachment instead
 */
export async function uploadFile(file: File, conversationId: number | null): Promise<number | null> {
  if (conversationId === null || conversationId === 0) {
    console.warn('uploadFile requires a valid conversationId in the new system');
    return null;
  }
  const result = await uploadAttachment(file, conversationId);
  return result?.id ?? null;
}

/**
 * @deprecated Use uploadAttachments instead
 */
export async function uploadFiles(files: File[], conversationId: number | null): Promise<number[]> {
  if (conversationId === null || conversationId === 0) {
    console.warn('uploadFiles requires a valid conversationId in the new system');
    return [];
  }
  const attachments = await uploadAttachments(files, conversationId);
  return attachments.map((a) => a.id);
}

// ============================================================================
// Scheduled Messages API
// ============================================================================

/**
 * Response type for scheduled message
 */
interface ScheduledMessageResponse {
  id: string;
  conversationId: number;
  senderId: number;
  content: string;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: string;
}

/**
 * Attachment data for scheduled messages
 */
export interface ScheduledAttachmentData {
  path: string;
  name: string;
  type: string;
  size: number;
}

/**
 * Schedule a message to be sent at a future time
 * Optionally includes attachment metadata (file must be uploaded first)
 */
export async function scheduleMessage(
  conversationId: number,
  content: string,
  scheduledFor: string,
  attachment?: ScheduledAttachmentData,
): Promise<ScheduledMessageResponse> {
  const body: {
    conversationId: number;
    content: string;
    scheduledFor: string;
    attachmentPath?: string;
    attachmentName?: string;
    attachmentType?: string;
    attachmentSize?: number;
  } = {
    conversationId,
    content,
    scheduledFor,
  };

  if (attachment !== undefined) {
    body.attachmentPath = attachment.path;
    body.attachmentName = attachment.name;
    body.attachmentType = attachment.type;
    body.attachmentSize = attachment.size;
  }

  return await apiClient.request<ScheduledMessageResponse>('/chat/scheduled-messages', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Get all pending scheduled messages for current user
 */
export async function getScheduledMessages(): Promise<ScheduledMessageResponse[]> {
  const response = await apiClient.request<{
    messages: ScheduledMessageResponse[];
    total: number;
  }>('/chat/scheduled-messages', {
    method: 'GET',
  });

  return response.messages;
}

/**
 * Cancel a scheduled message
 */
export async function cancelScheduledMessage(id: string): Promise<void> {
  await apiClient.request<{ message: string }>(`/chat/scheduled-messages/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Get scheduled messages for a specific conversation
 */
export async function getConversationScheduledMessages(conversationId: number): Promise<ScheduledMessage[]> {
  const response = await apiClient.request<{
    scheduledMessages: ScheduledMessage[];
    total: number;
  }>(`/chat/conversations/${conversationId}/scheduled-messages`, {
    method: 'GET',
  });

  return response.scheduledMessages;
}
