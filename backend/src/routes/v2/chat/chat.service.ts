/**
 * Chat Service Layer v2
 * Business logic for real-time messaging, conversations, and file attachments
 * Uses existing chat.service.ts as base with v2 improvements
 */

import chatServiceV1 from "../../../services/chat.service.js";
import { ServiceError } from "../users/users.service.js";

// Re-export types
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Interfaces for Chat v2
export interface ChatUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  departmentId: number | null;
  departmentName: string | null;
  isOnline: boolean;
  lastSeen: Date | null;
}

export interface Conversation {
  id: number;
  name: string | null;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessage: Message | null;
  unreadCount: number;
  participants: ConversationParticipant[];
}

export interface ConversationParticipant {
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  joinedAt: Date;
  isActive: boolean;
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderUsername: string;
  senderProfilePicture: string | null;
  content: string;
  attachment: MessageAttachment | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ConversationFilters {
  search?: string;
  isGroup?: boolean;
  hasUnread?: boolean;
  page?: number;
  limit?: number;
}

export interface MessageFilters {
  search?: string;
  startDate?: Date;
  endDate?: Date;
  hasAttachment?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateConversationData {
  participantIds: number[];
  name?: string;
  isGroup?: boolean;
}

export interface SendMessageData {
  content: string;
  attachment?: {
    path: string;
    filename: string;
    mimeType: string;
    size: number;
  };
}

export interface UnreadCountSummary {
  totalUnread: number;
  conversations: Array<{
    conversationId: number;
    conversationName: string | null;
    unreadCount: number;
    lastMessageTime: Date;
  }>;
}

export class ChatService {
  /**
   * Get list of users available for chat
   */
  async getChatUsers(
    tenantId: number,
    currentUserId: number,
    search?: string,
  ): Promise<ChatUser[]> {
    try {
      // Use v1 service - returns array directly
      let users = await chatServiceV1.getUsers(tenantId, currentUserId);

      if (!users || !Array.isArray(users)) {
        return [];
      }

      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        users = users.filter(
          (user: {
            username: string;
            email: string;
            first_name?: string;
            last_name?: string;
          }) => {
            const fullName =
              `${user.first_name ?? ""} ${user.last_name ?? ""}`.toLowerCase();
            return (
              user.username.toLowerCase().includes(searchLower) ||
              user.email.toLowerCase().includes(searchLower) ||
              fullName.includes(searchLower)
            );
          },
        );
      }

      // Transform to v2 format
      return users.map(
        (user: {
          id: number;
          username: string;
          email: string;
          first_name?: string;
          last_name?: string;
          profile_image_url?: string | null;
          department_id?: number | null;
          department?: string | null;
          is_online?: number;
          last_seen?: string | null;
        }) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name ?? "",
          lastName: user.last_name ?? "",
          profilePicture: user.profile_image_url ?? null,
          departmentId: user.department_id ?? null,
          departmentName: user.department ?? null,
          isOnline: user.is_online === 1,
          lastSeen: user.last_seen ? new Date(user.last_seen) : null,
        }),
      );
    } catch {
      throw new ServiceError(
        "CHAT_USERS_ERROR",
        "Failed to fetch chat users",
        500,
      );
    }
  }

  /**
   * Get user's conversations with pagination
   */
  async getConversations(
    tenantId: number,
    userId: number,
    filters: ConversationFilters = {},
  ): Promise<{ data: Conversation[]; pagination: PaginationMeta }> {
    try {
      const page = Math.max(1, filters.page ?? 1);
      const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

      // Get conversations from v1 service - returns array directly
      let conversations: unknown[] = (await chatServiceV1.getConversations(
        tenantId,
        userId,
      )) as unknown[];

      if (!conversations || !Array.isArray(conversations)) {
        return {
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            pageSize: limit,
            totalItems: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }

      // Apply filters
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        conversations = conversations.filter((conv: unknown) => {
          const conversation = conv as {
            name?: string | null;
            last_message?: string | null;
          };
          const name = conversation.name?.toLowerCase() ?? "";
          const lastMessage = conversation.last_message?.toLowerCase() ?? "";
          return (
            name.includes(searchLower) || lastMessage.includes(searchLower)
          );
        });
      }

      if (filters.isGroup !== undefined) {
        conversations = conversations.filter(
          (conv: unknown) =>
            ((conv as { is_group?: number }).is_group === 1) ===
            filters.isGroup,
        );
      }

      if (filters.hasUnread) {
        conversations = conversations.filter(
          (conv: unknown) =>
            ((conv as { unread_count?: number }).unread_count ?? 0) > 0,
        );
      }

      // Calculate pagination
      const totalItems = conversations.length;
      const totalPages = Math.ceil(totalItems / limit);
      const offset = (page - 1) * limit;
      const paginatedConversations = conversations.slice(
        offset,
        offset + limit,
      );

      // Transform to v2 format
      const transformedConversations: Conversation[] =
        paginatedConversations.map((conv: unknown) => {
          const conversation = conv as {
            id: number;
            name?: string | null;
            is_group?: number;
            created_at: string;
            updated_at?: string;
            last_message?: string | null;
            last_message_id?: number;
            last_sender_id?: number;
            last_sender_name?: string;
            last_sender_username?: string;
            last_message_time?: string;
            unread_count?: number;
            participants?: unknown[];
          };
          return {
            id: conversation.id,
            name: conversation.name ?? null,
            isGroup: conversation.is_group === 1,
            createdAt: new Date(conversation.created_at),
            updatedAt: new Date(
              conversation.updated_at ?? conversation.created_at,
            ),
            lastMessage: conversation.last_message
              ? {
                  id: conversation.last_message_id ?? 0,
                  conversationId: conversation.id,
                  senderId: conversation.last_sender_id ?? 0,
                  senderName: conversation.last_sender_name ?? "Unknown",
                  senderUsername:
                    conversation.last_sender_username ?? "unknown",
                  senderProfilePicture: null,
                  content: conversation.last_message,
                  attachment: null,
                  isRead: conversation.unread_count === 0,
                  readAt: null,
                  createdAt: new Date(
                    conversation.last_message_time ?? conversation.created_at,
                  ),
                  updatedAt: new Date(
                    conversation.last_message_time ?? conversation.created_at,
                  ),
                }
              : null,
            unreadCount: conversation.unread_count ?? 0,
            participants: (conversation.participants ??
              []) as ConversationParticipant[],
          };
        });

      return {
        data: transformedConversations,
        pagination: {
          currentPage: page,
          totalPages,
          pageSize: limit,
          totalItems,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch {
      throw new ServiceError(
        "CONVERSATIONS_ERROR",
        "Failed to fetch conversations",
        500,
      );
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    tenantId: number,
    creatorId: number,
    data: CreateConversationData,
  ): Promise<{ conversation: Conversation }> {
    try {
      // Use v1 service
      const result = await chatServiceV1.createConversation(
        tenantId,
        creatorId,
        data.participantIds,
        data.isGroup ?? data.participantIds.length > 1,
        data.name,
      );

      if (!result || typeof result.id !== "number") {
        throw new ServiceError(
          "CREATE_CONVERSATION_ERROR",
          "Failed to create conversation",
          500,
        );
      }

      // Get the created conversation details
      const conversations = await this.getConversations(tenantId, creatorId, {
        limit: 100,
      });
      const conversation = conversations.data.find((c) => c.id === result.id);

      if (!conversation) {
        throw new ServiceError(
          "CREATE_CONVERSATION_ERROR",
          "Failed to retrieve created conversation",
          500,
        );
      }

      return { conversation };
    } catch {
      throw new ServiceError(
        "CREATE_CONVERSATION_ERROR",
        "Failed to create conversation",
        500,
      );
    }
  }

  /**
   * Get messages from a conversation with pagination
   */
  async getMessages(
    tenantId: number,
    conversationId: number,
    userId: number,
    filters: MessageFilters = {},
  ): Promise<{ data: Message[]; pagination: PaginationMeta }> {
    try {
      const page = Math.max(1, filters.page ?? 1);
      const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
      const offset = (page - 1) * limit;

      // Use v1 service
      const result = (await chatServiceV1.getMessages(
        tenantId,
        conversationId,
        userId,
        limit,
        offset,
      )) as { messages: unknown[] };

      if (!result?.messages || !Array.isArray(result.messages)) {
        return {
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            pageSize: limit,
            totalItems: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }

      // Calculate total count from messages length (v1 doesn't provide totalCount)
      const totalItems = result.messages.length;
      const totalPages = Math.ceil(totalItems / limit);

      // Transform messages to v2 format
      const messages: Message[] = result.messages.map((msg: unknown) => {
        const message = msg as {
          id: number;
          conversation_id: number;
          sender_id: number;
          first_name?: string;
          last_name?: string;
          username?: string;
          profile_image_url?: string | null;
          content: string;
          attachment_path?: string | null;
          attachment_name?: string;
          attachment_type?: string;
          is_read?: number;
          read_at?: string | null;
          created_at: string;
          updated_at?: string;
        };
        return {
          id: message.id,
          conversationId: message.conversation_id,
          senderId: message.sender_id,
          senderName:
            `${message.first_name ?? ""} ${message.last_name ?? ""}`.trim() ??
            "Unknown",
          senderUsername: message.username ?? "unknown",
          senderProfilePicture: message.profile_image_url ?? null,
          content: message.content,
          attachment: message.attachment_path
            ? {
                url: message.attachment_path,
                filename: message.attachment_name ?? "attachment",
                mimeType: message.attachment_type ?? "application/octet-stream",
                size: 0, // Not available in v1
              }
            : null,
          isRead: message.is_read === 1,
          readAt: message.read_at ? new Date(message.read_at) : null,
          createdAt: new Date(message.created_at),
          updatedAt: new Date(message.updated_at ?? message.created_at),
        };
      });

      return {
        data: messages,
        pagination: {
          currentPage: page,
          totalPages,
          pageSize: limit,
          totalItems,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch {
      throw new ServiceError(
        "GET_MESSAGES_ERROR",
        "Failed to fetch messages",
        500,
      );
    }
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(
    tenantId: number,
    conversationId: number,
    senderId: number,
    data: SendMessageData,
  ): Promise<{ message: Message }> {
    try {
      // Use v1 service - returns message directly
      const msg = await chatServiceV1.sendMessage(
        tenantId,
        conversationId,
        senderId,
        data.content,
        data.attachment
          ? {
              path: data.attachment.path,
              name: data.attachment.filename,
              type: data.attachment.mimeType,
            }
          : null,
      );

      if (!msg?.id) {
        throw new ServiceError(
          "SEND_MESSAGE_ERROR",
          "Failed to send message",
          500,
        );
      }

      // Transform to v2 format
      const message: Message = {
        id: msg.id,
        conversationId: msg.conversation_id,
        senderId: msg.sender_id,
        senderName:
          `${msg.first_name ?? ""} ${msg.last_name ?? ""}`.trim() ?? "Unknown",
        senderUsername: msg.username ?? "unknown",
        senderProfilePicture: msg.profile_image_url ?? null,
        content: msg.content,
        attachment: msg.attachment_path
          ? {
              url: msg.attachment_path,
              filename: msg.attachment_name ?? "attachment",
              mimeType: msg.attachment_type ?? "application/octet-stream",
              size: 0,
            }
          : null,
        isRead: false,
        readAt: null,
        createdAt: new Date(msg.created_at),
        updatedAt: new Date(msg.created_at),
      };

      return { message };
    } catch {
      throw new ServiceError(
        "SEND_MESSAGE_ERROR",
        "Failed to send message",
        500,
      );
    }
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(
    tenantId: number,
    userId: number,
  ): Promise<UnreadCountSummary> {
    try {
      // Use getConversations to calculate unread
      const result = await this.getConversations(tenantId, userId, {
        limit: 100,
      });

      const unreadConversations = result.data
        .filter((conv) => conv.unreadCount > 0)
        .map((conv) => ({
          conversationId: conv.id,
          conversationName: conv.name,
          unreadCount: conv.unreadCount,
          lastMessageTime: conv.lastMessage?.createdAt ?? conv.updatedAt,
        }))
        .sort(
          (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime(),
        );

      const totalUnread = unreadConversations.reduce(
        (sum, conv) => sum + conv.unreadCount,
        0,
      );

      return {
        totalUnread,
        conversations: unreadConversations,
      };
    } catch {
      throw new ServiceError(
        "UNREAD_COUNT_ERROR",
        "Failed to get unread count",
        500,
      );
    }
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markConversationAsRead(
    conversationId: number,
    userId: number,
  ): Promise<{ markedCount: number }> {
    try {
      // Use v1 service
      await chatServiceV1.markConversationAsRead(conversationId, userId);

      // v1 doesn't return count, so return 0 for now
      return { markedCount: 0 };
    } catch {
      throw new ServiceError(
        "MARK_READ_ERROR",
        "Failed to mark messages as read",
        500,
      );
    }
  }

  /**
   * Delete a conversation (admin only or single participant)
   */
  async deleteConversation(
    conversationId: number,
    userId: number,
    _userRole: string,
  ): Promise<void> {
    try {
      // v1 service handles permission checking
      await chatServiceV1.deleteConversation(conversationId, userId);
    } catch {
      throw new ServiceError(
        "DELETE_CONVERSATION_ERROR",
        "Failed to delete conversation",
        500,
      );
    }
  }
}

// Export singleton instance
export default new ChatService();
