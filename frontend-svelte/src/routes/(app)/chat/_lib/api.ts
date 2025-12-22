// =============================================================================
// CHAT PAGE - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import type {
  Conversation,
  Message,
  ScheduledMessage,
  ChatUser,
  UsersResponse,
  CreateConversationResponse,
  UploadResponse,
  ConversationParticipant,
} from './types';
import { API_ENDPOINTS } from './constants';

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
    conversations = response;
  } else if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      conversations = obj.data;
    } else if (Array.isArray(obj.conversations)) {
      conversations = obj.conversations;
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
  const response = (await apiClient.post(API_ENDPOINTS.conversations, {
    participantIds,
    isGroup,
  })) as CreateConversationResponse;

  return response.conversation;
}

/**
 * Delete a conversation
 * @param conversationId - ID of conversation to delete
 */
export async function deleteConversation(conversationId: number): Promise<void> {
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
    return response;
  } else if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      return obj.data;
    } else if (Array.isArray(obj.messages)) {
      return obj.messages;
    }
  }
  return [];
}

/**
 * Mark a conversation as read
 * @param conversationId - ID of the conversation
 */
export async function markConversationAsRead(conversationId: number): Promise<void> {
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
export async function loadScheduledMessages(conversationId: number): Promise<ScheduledMessage[]> {
  const response = await apiClient.get(API_ENDPOINTS.scheduledMessages(conversationId));

  // Handle different API response formats
  if (Array.isArray(response)) {
    return response;
  } else if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.scheduledMessages)) {
      return obj.scheduledMessages;
    } else if (Array.isArray(obj.data)) {
      return obj.data;
    }
  }
  return [];
}

/**
 * Create a scheduled message
 * @param conversationId - ID of the conversation
 * @param content - Message content
 * @param scheduledFor - ISO date string for when to send
 * @param attachments - Optional attachment IDs
 */
export async function createScheduledMessage(
  conversationId: number,
  content: string,
  scheduledFor: string,
  attachments: number[] = [],
): Promise<void> {
  await apiClient.post(API_ENDPOINTS.createScheduled, {
    conversationId,
    content,
    scheduledFor,
    attachments,
  });
}

/**
 * Cancel/delete a scheduled message
 * @param scheduledId - ID of the scheduled message
 */
export async function cancelScheduledMessage(scheduledId: string): Promise<void> {
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
  const response = (await apiClient.get(API_ENDPOINTS.users)) as UsersResponse;

  if (!query.trim()) {
    return response.users;
  }

  const searchLower = query.toLowerCase();

  return response.users.filter((user) => {
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.toLowerCase();
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

  return apiClient.upload(
    API_ENDPOINTS.attachments(conversationId),
    formData,
  ) as Promise<UploadResponse>;
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
    conversations.find((conv) => !conv.isGroup && conv.participants.some((p) => p.id === userId)) ??
    null
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
