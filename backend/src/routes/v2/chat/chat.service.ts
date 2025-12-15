/**
 * Chat Service v2 - Main Entry Point
 * Re-exports all chat functionality from specialized sub-services
 * Complete v2 implementation without v1 dependencies
 *
 * Architecture:
 * - chat.types.ts - All type definitions
 * - chat-users.service.ts - User listing and permissions
 * - chat-conversations.service.ts - Conversation CRUD operations
 * - chat-messages.service.ts - Messages, read receipts, unread counts
 *
 * Best Practice 2025: Feature-based service separation for maintainability
 */
import {
  createConversation,
  deleteConversation,
  getConversation,
  getConversations,
} from './chat-conversations.service.js';
import {
  getMessages,
  getUnreadCount,
  markConversationAsRead,
  sendMessage,
} from './chat-messages.service.js';
import { getChatUsers } from './chat-users.service.js';

// RE-EXPORT ALL TYPES
export type * from './chat.types.js';

// RE-EXPORT ALL OPERATIONS (for named imports)
export {
  getChatUsers,
  getConversations,
  getConversation,
  createConversation,
  deleteConversation,
  getMessages,
  sendMessage,
  getUnreadCount,
  markConversationAsRead,
};

// BACKWARDS COMPATIBILITY - DEFAULT EXPORT
// Legacy controllers may use: import chatService from './chat.service.js'
// This provides the same API as the old class-based singleton pattern

/**
 * Chat service object for backwards compatibility
 * @deprecated Use named imports instead
 */
const chatService = {
  getChatUsers,
  getConversations,
  getConversation,
  createConversation,
  deleteConversation,
  getMessages,
  sendMessage,
  getUnreadCount,
  markConversationAsRead,
};

// eslint-disable-next-line @typescript-eslint/no-deprecated -- Backwards compatibility for legacy controllers
export default chatService;
