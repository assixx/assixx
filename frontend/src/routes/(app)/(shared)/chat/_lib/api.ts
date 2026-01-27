// =============================================================================
// CHAT PAGE - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';

import { API_ENDPOINTS } from './constants';

import type {
  Conversation,
  Message,
  ScheduledMessage,
  ChatUser,
  CreateConversationResponse,
  UploadResponse,
  ConversationParticipant,
} from './types';

const apiClient = getApiClient();

// =============================================================================
// CONVERSATIONS
// =============================================================================

/**
 * Load all conversations for the current user
 * @returns Promise with normalized conversations
 */
export async function loadConversations(): Promise<Conversation[]> {
  const response = await apiClient.get(API_ENDPOINTS.conversations);

  // Handle different API response formats
  let conversations: Conversation[];
  if (Array.isArray(response)) {
    conversations = response as Conversation[];
  } else if (response !== null && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      conversations = obj.data as Conversation[];
    } else if (Array.isArray(obj.conversations)) {
      conversations = obj.conversations as Conversation[];
    } else {
      conversations = [];
    }
  } else {
    conversations = [];
  }

  return conversations.map((conv) => ({
    ...conv,
    participants: Array.isArray(conv.participants) ? conv.participants : [],
  }));
}

/**
 * Create a new conversation with specified participants
 * @param participantIds - Array of user IDs to include
 * @param isGroup - Whether this is a group conversation
 * @returns Created conversation data
 */
export async function createConversation(
  participantIds: number[],
  isGroup: boolean = false,
): Promise<CreateConversationResponse['conversation']> {
  const response = await apiClient.post(API_ENDPOINTS.conversations, {
    participantIds,
    isGroup,
  });

  // Handle API response format
  if (response !== null && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (obj.conversation !== null && typeof obj.conversation === 'object') {
      return obj.conversation as CreateConversationResponse['conversation'];
    }
  }

  throw new Error('Invalid response format from create conversation API');
}

/**
 * Delete a conversation
 * @param conversationId - ID of conversation to delete
 */
export async function deleteConversation(
  conversationId: number,
): Promise<void> {
  await apiClient.delete(API_ENDPOINTS.deleteConversation(conversationId));
}

// =============================================================================
// MESSAGES
// =============================================================================

/**
 * Load messages for a specific conversation
 * @param conversationId - ID of the conversation
 * @returns Promise with messages array
 */
export async function loadMessages(conversationId: number): Promise<Message[]> {
  const response = await apiClient.get(API_ENDPOINTS.messages(conversationId));

  // Handle different API response formats
  if (Array.isArray(response)) {
    return response as Message[];
  } else if (response !== null && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      return obj.data as Message[];
    } else if (Array.isArray(obj.messages)) {
      return obj.messages as Message[];
    }
  }
  return [];
}

/**
 * Mark a conversation as read
 * @param conversationId - ID of the conversation
 */
export async function markConversationAsRead(
  conversationId: number,
): Promise<void> {
  await apiClient.post(API_ENDPOINTS.markRead(conversationId), {});
}

// =============================================================================
// SCHEDULED MESSAGES
// =============================================================================

/**
 * Load scheduled messages for a conversation
 * @param conversationId - ID of the conversation
 * @returns Promise with scheduled messages array
 */
export async function loadScheduledMessages(
  conversationId: number,
): Promise<ScheduledMessage[]> {
  const response = await apiClient.get(
    API_ENDPOINTS.scheduledMessages(conversationId),
  );

  // Handle different API response formats
  if (Array.isArray(response)) {
    return response as ScheduledMessage[];
  } else if (response !== null && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.scheduledMessages)) {
      return obj.scheduledMessages as ScheduledMessage[];
    } else if (Array.isArray(obj.data)) {
      return obj.data as ScheduledMessage[];
    }
  }
  return [];
}

/**
 * Attachment info for scheduled message
 */
interface ScheduledAttachmentInfo {
  path: string;
  name: string;
  type: string;
  size: number;
}

/**
 * Create a scheduled message
 * @param conversationId - ID of the conversation
 * @param content - Message content
 * @param scheduledFor - ISO date string for when to send
 * @param attachment - Optional attachment info (first upload only for now)
 */
export async function createScheduledMessage(
  conversationId: number,
  content: string,
  scheduledFor: string,
  attachment?: ScheduledAttachmentInfo,
): Promise<void> {
  await apiClient.post(API_ENDPOINTS.createScheduled, {
    conversationId,
    content,
    scheduledFor,
    attachmentPath: attachment?.path,
    attachmentName: attachment?.name,
    attachmentType: attachment?.type,
    attachmentSize: attachment?.size,
  });
}

/**
 * Cancel/delete a scheduled message
 * @param scheduledId - ID of the scheduled message
 */
export async function cancelScheduledMessage(
  scheduledId: string,
): Promise<void> {
  await apiClient.delete(API_ENDPOINTS.deleteScheduled(scheduledId));
}

// =============================================================================
// USERS
// =============================================================================

/**
 * Search for users (for starting new conversations)
 * @param query - Search query string
 * @returns Promise with filtered users
 */
export async function searchUsers(query: string): Promise<ChatUser[]> {
  const response = await apiClient.get(API_ENDPOINTS.users);

  // Handle API response format
  let users: ChatUser[] = [];
  if (Array.isArray(response)) {
    users = response as ChatUser[];
  } else if (response !== null && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.users)) {
      users = obj.users as ChatUser[];
    } else if (Array.isArray(obj.data)) {
      users = obj.data as ChatUser[];
    }
  }

  if (query.trim() === '') {
    return users;
  }

  const searchLower = query.toLowerCase();

  return users.filter((user: ChatUser) => {
    const fullName =
      `${user.firstName ?? ''} ${user.lastName ?? ''}`.toLowerCase();
    return (
      user.username.toLowerCase().includes(searchLower) ||
      fullName.includes(searchLower) ||
      (user.email ?? '').toLowerCase().includes(searchLower)
    );
  });
}

// =============================================================================
// ATTACHMENTS
// =============================================================================

/**
 * Upload a file attachment to a conversation
 * @param conversationId - ID of the conversation
 * @param file - File to upload
 * @returns Promise with upload result
 */
export async function uploadAttachment(
  conversationId: number,
  file: File,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return await apiClient.upload(
    API_ENDPOINTS.attachments(conversationId),
    formData,
  );
}

// =============================================================================
// HELPER: Find existing conversation with user
// =============================================================================

/**
 * Find existing conversation with a specific user
 * @param conversations - Current conversations list
 * @param userId - User ID to find
 * @returns Existing conversation or null
 */
export function findExistingConversation(
  conversations: Conversation[],
  userId: number,
): Conversation | null {
  return (
    conversations.find(
      (conv) => !conv.isGroup && conv.participants.some((p) => p.id === userId),
    ) ?? null
  );
}

/**
 * Build a new conversation object from API response
 * @param apiConversation - Response from create conversation API
 * @returns Fully typed Conversation object
 */
export function buildNewConversation(apiConversation: {
  id: number;
  uuid: string;
  participants: ConversationParticipant[];
}): Conversation {
  return {
    ...apiConversation,
    isGroup: false,
    lastMessage: undefined,
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
