/**
 * Unit tests for Chat WebSocket Utilities
 *
 * Tests pure functions only — no actual WebSocket connections.
 * All functions are stateless transformers, builders, or type guards.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { WS_MESSAGE_TYPES, WEBSOCKET_CONFIG } from './constants.js';
import {
  buildWebSocketUrl,
  transformRawMessage,
  extractTypingData,
  extractStatusData,
  extractReadData,
  addTypingUser,
  removeTypingUser,
  updateConversationsUserStatus,
  markMessageAsRead,
  updateConversationWithMessage,
  buildSendMessage,
  buildTypingStartMessage,
  buildTypingStopMessage,
  buildPingMessage,
  calculateReconnectDelay,
  shouldReconnect,
  isTypingMessage,
  isTypingStartMessage,
  isStatusMessage,
  isIgnorableMessage,
} from './websocket.js';

import type {
  Conversation,
  ConversationParticipant,
  Message,
  RawWebSocketMessage,
} from './types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockParticipant(
  overrides: Partial<ConversationParticipant> = {},
): ConversationParticipant {
  return {
    id: 1,
    username: 'user1',
    firstName: 'Test',
    lastName: 'User',
    ...overrides,
  };
}

function createMockConversation(
  overrides: Partial<Conversation> = {},
): Conversation {
  return {
    id: 1,
    uuid: 'conv-uuid-1',
    isGroup: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    participants: [
      createMockParticipant({ id: 1 }),
      createMockParticipant({ id: 2, username: 'user2' }),
    ],
    ...overrides,
  };
}

function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    conversationId: 1,
    senderId: 2,
    content: 'Hello',
    createdAt: '2026-01-01T12:00:00.000Z',
    isRead: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildWebSocketUrl
// ---------------------------------------------------------------------------

describe('buildWebSocketUrl', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          protocol: 'https:',
          host: 'example.com',
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it('should build wss URL for https protocol', () => {
    const url = buildWebSocketUrl('my-ticket');
    expect(url).toBe('wss://example.com/chat-ws?ticket=my-ticket');
  });

  it('should build ws URL for http protocol', () => {
    (
      globalThis.window as { location: { protocol: string; host: string } }
    ).location.protocol = 'http:';
    const url = buildWebSocketUrl('my-ticket');
    expect(url).toBe('ws://example.com/chat-ws?ticket=my-ticket');
  });

  it('should encode ticket parameter', () => {
    const url = buildWebSocketUrl('ticket with spaces&special=chars');
    expect(url).toContain(
      encodeURIComponent('ticket with spaces&special=chars'),
    );
  });
});

// ---------------------------------------------------------------------------
// transformRawMessage
// ---------------------------------------------------------------------------

describe('transformRawMessage', () => {
  it('should transform raw message with all fields', () => {
    const raw: RawWebSocketMessage = {
      id: 42,
      conversationId: 7,
      senderId: 3,
      content: 'Hello world',
      createdAt: '2026-01-01T12:00:00Z',
      isRead: true,
      type: 'text',
      attachments: [],
      senderName: 'Test User',
      senderUsername: 'testuser',
      senderProfilePicture: '/avatar.jpg',
      firstName: 'Test',
      lastName: 'User',
    };

    const result = transformRawMessage(raw);

    expect(result.id).toBe(42);
    expect(result.conversationId).toBe(7);
    expect(result.senderId).toBe(3);
    expect(result.content).toBe('Hello world');
    expect(result.createdAt).toBe('2026-01-01T12:00:00Z');
    expect(result.isRead).toBe(true);
    expect(result.type).toBe('text');
    expect(result.attachments).toEqual([]);
    expect(result.senderName).toBe('Test User');
    expect(result.senderUsername).toBe('testuser');
    expect(result.senderProfilePicture).toBe('/avatar.jpg');
    expect(result.sender).toEqual({
      id: 3,
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
    });
  });

  it('should apply defaults for missing fields', () => {
    const raw: RawWebSocketMessage = {};
    const result = transformRawMessage(raw);

    expect(result.id).toBe(0);
    expect(result.conversationId).toBe(0);
    expect(result.senderId).toBe(0);
    expect(result.content).toBeNull();
    expect(result.isRead).toBe(false);
    expect(result.type).toBe('text');
    expect(result.attachments).toEqual([]);
    expect(result.sender).toEqual({
      id: 0,
      firstName: '',
      lastName: '',
      username: '',
    });
  });
});

describe('transformRawMessage — date default', () => {
  it('should use current ISO date when createdAt missing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T10:30:00.000Z'));

    const result = transformRawMessage({});
    expect(result.createdAt).toBe('2026-06-15T10:30:00.000Z');

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// extractTypingData / extractStatusData / extractReadData
// ---------------------------------------------------------------------------

describe('extractTypingData', () => {
  it('should extract userId and conversationId', () => {
    const data = extractTypingData({ userId: 5, conversationId: 10 });
    expect(data).toEqual({ userId: 5, conversationId: 10 });
  });

  it('should default to 0 for missing fields', () => {
    const data = extractTypingData({});
    expect(data).toEqual({ userId: 0, conversationId: 0 });
  });
});

describe('extractStatusData', () => {
  it('should extract userId and status', () => {
    const data = extractStatusData({ userId: 3, status: 'online' });
    expect(data).toEqual({ userId: 3, status: 'online' });
  });

  it('should default to 0 and offline', () => {
    const data = extractStatusData({});
    expect(data).toEqual({ userId: 0, status: 'offline' });
  });
});

describe('extractReadData', () => {
  it('should extract messageId and userId', () => {
    const data = extractReadData({ messageId: 99, userId: 7 });
    expect(data).toEqual({ messageId: 99, userId: 7 });
  });

  it('should default to 0', () => {
    const data = extractReadData({});
    expect(data).toEqual({ messageId: 0, userId: 0 });
  });
});

// ---------------------------------------------------------------------------
// addTypingUser / removeTypingUser
// ---------------------------------------------------------------------------

describe('addTypingUser', () => {
  it('should add user to empty list', () => {
    expect(addTypingUser([], 5)).toEqual([5]);
  });

  it('should add user to existing list', () => {
    expect(addTypingUser([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it('should not add duplicate user', () => {
    const original = [1, 2, 3];
    const result = addTypingUser(original, 2);
    expect(result).toBe(original); // same reference — no mutation
  });

  it('should return new array (immutable)', () => {
    const original = [1];
    const result = addTypingUser(original, 2);
    expect(result).not.toBe(original);
    expect(original).toEqual([1]); // original unchanged
  });
});

describe('removeTypingUser', () => {
  it('should remove user from list', () => {
    expect(removeTypingUser([1, 2, 3], 2)).toEqual([1, 3]);
  });

  it('should return new array when user not present', () => {
    const result = removeTypingUser([1, 2], 99);
    expect(result).toEqual([1, 2]);
  });

  it('should handle empty array', () => {
    expect(removeTypingUser([], 1)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// updateConversationsUserStatus
// ---------------------------------------------------------------------------

describe('updateConversationsUserStatus', () => {
  it('should update matching participant status', () => {
    const convs = [
      createMockConversation({
        participants: [
          createMockParticipant({ id: 1, status: 'offline' }),
          createMockParticipant({ id: 2, status: 'offline' }),
        ],
      }),
    ];

    const result = updateConversationsUserStatus(convs, 2, 'online');

    expect(result[0].participants[0].status).toBe('offline');
    expect(result[0].participants[1].status).toBe('online');
  });

  it('should not mutate original conversations', () => {
    const convs = [createMockConversation()];
    const result = updateConversationsUserStatus(convs, 1, 'away');
    expect(result).not.toBe(convs);
    expect(result[0]).not.toBe(convs[0]);
  });

  it('should handle multiple conversations', () => {
    const convs = [
      createMockConversation({
        id: 1,
        participants: [createMockParticipant({ id: 5, status: 'offline' })],
      }),
      createMockConversation({
        id: 2,
        participants: [createMockParticipant({ id: 5, status: 'offline' })],
      }),
    ];

    const result = updateConversationsUserStatus(convs, 5, 'online');
    expect(result[0].participants[0].status).toBe('online');
    expect(result[1].participants[0].status).toBe('online');
  });
});

// ---------------------------------------------------------------------------
// markMessageAsRead
// ---------------------------------------------------------------------------

describe('markMessageAsRead', () => {
  it('should mark matching message as read', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));

    const messages = [
      createMockMessage({ id: 1, isRead: false }),
      createMockMessage({ id: 2, isRead: false }),
    ];

    const result = markMessageAsRead(messages, 1);

    expect(result[0].isRead).toBe(true);
    expect(result[0].readAt).toBe('2026-01-15T10:00:00.000Z');
    expect(result[1].isRead).toBe(false);

    vi.useRealTimers();
  });

  it('should not mutate original messages', () => {
    const messages = [createMockMessage({ id: 1 })];
    const result = markMessageAsRead(messages, 1);
    expect(result).not.toBe(messages);
    expect(result[0]).not.toBe(messages[0]);
  });

  it('should not change messages when ID not found', () => {
    const messages = [createMockMessage({ id: 1 })];
    const result = markMessageAsRead(messages, 999);
    expect(result[0].isRead).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateConversationWithMessage
// ---------------------------------------------------------------------------

describe('updateConversationWithMessage', () => {
  it('should update lastMessage and move conversation to top', () => {
    const convs = [
      createMockConversation({ id: 1 }),
      createMockConversation({ id: 2 }),
      createMockConversation({ id: 3 }),
    ];
    const msg = createMockMessage({
      conversationId: 3,
      content: 'New!',
      createdAt: '2026-01-02T00:00:00Z',
    });

    const result = updateConversationWithMessage(convs, 3, msg, false, 1);

    // conv 3 should be first now
    expect(result[0].id).toBe(3);
    expect(result[0].lastMessage).toEqual({
      content: 'New!',
      createdAt: '2026-01-02T00:00:00Z',
    });
    expect(result[1].id).toBe(1);
    expect(result[2].id).toBe(2);
  });

  it('should return unchanged array if conversation not found', () => {
    const convs = [createMockConversation({ id: 1 })];
    const msg = createMockMessage();

    const result = updateConversationWithMessage(convs, 999, msg, false, 1);
    expect(result).toBe(convs);
  });
});

describe('updateConversationWithMessage - unreadCount', () => {
  it('should increment unreadCount for non-active, non-self messages', () => {
    const convs = [createMockConversation({ id: 1, unreadCount: 2 })];
    const msg = createMockMessage({ senderId: 99 }); // not currentUserId

    const result = updateConversationWithMessage(convs, 1, msg, false, 1);
    expect(result[0].unreadCount).toBe(3);
  });

  it('should NOT increment unreadCount for active conversation', () => {
    const convs = [createMockConversation({ id: 1, unreadCount: 0 })];
    const msg = createMockMessage({ senderId: 99 });

    const result = updateConversationWithMessage(convs, 1, msg, true, 1);
    expect(result[0].unreadCount).toBe(0);
  });

  it('should NOT increment unreadCount for own messages', () => {
    const convs = [createMockConversation({ id: 1, unreadCount: 0 })];
    const msg = createMockMessage({ senderId: 1 }); // currentUserId = 1

    const result = updateConversationWithMessage(convs, 1, msg, false, 1);
    expect(result[0].unreadCount).toBe(0);
  });

  it('should default unreadCount to 0 when undefined', () => {
    const convs = [createMockConversation({ id: 1 })]; // unreadCount undefined
    const msg = createMockMessage({ senderId: 99 });

    const result = updateConversationWithMessage(convs, 1, msg, false, 1);
    expect(result[0].unreadCount).toBe(1);
  });
});

describe('updateConversationWithMessage - E2E preview', () => {
  it('should show decrypted content in preview for E2E messages', () => {
    const convs = [createMockConversation({ id: 1 })];
    const msg = createMockMessage({
      isE2e: true,
      content: null,
      decryptedContent: 'Secret text',
    });

    const result = updateConversationWithMessage(convs, 1, msg, false, 1);
    expect(result[0].lastMessage?.content).toBe('Secret text');
  });

  it('should set isE2e flag on lastMessage for E2E messages', () => {
    const convs = [createMockConversation({ id: 1 })];
    const msg = createMockMessage({
      isE2e: true,
      content: null,
      decryptedContent: 'Secret text',
    });

    const result = updateConversationWithMessage(convs, 1, msg, false, 1);
    expect(result[0].lastMessage?.isE2e).toBe(true);
  });

  it('should NOT set isE2e flag on lastMessage for plaintext messages', () => {
    const convs = [createMockConversation({ id: 1 })];
    const msg = createMockMessage({ content: 'Plain' });

    const result = updateConversationWithMessage(convs, 1, msg, false, 1);
    expect(result[0].lastMessage?.isE2e).toBeUndefined();
  });

  it('should show lock icon fallback for undecrypted E2E messages', () => {
    const convs = [createMockConversation({ id: 1 })];
    const msg = createMockMessage({
      isE2e: true,
      content: null,
    });

    const result = updateConversationWithMessage(convs, 1, msg, false, 1);
    expect(result[0].lastMessage?.content).toContain(
      'Verschlüsselte Nachricht',
    );
  });
});

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

describe('buildSendMessage', () => {
  it('should build send_message with content and attachments', () => {
    const msg = buildSendMessage(7, 'Hello!', [1, 2, 3]);
    expect(msg).toEqual({
      type: WS_MESSAGE_TYPES.SEND_MESSAGE,
      data: { conversationId: 7, content: 'Hello!', attachments: [1, 2, 3] },
    });
  });

  it('should handle empty attachments', () => {
    const msg = buildSendMessage(1, 'Test', []);
    expect(msg.data).toEqual({
      conversationId: 1,
      content: 'Test',
      attachments: [],
    });
  });
});

describe('buildTypingStartMessage', () => {
  it('should build typing_start message', () => {
    const msg = buildTypingStartMessage(5);
    expect(msg).toEqual({
      type: WS_MESSAGE_TYPES.TYPING_START,
      data: { conversationId: 5 },
    });
  });
});

describe('buildTypingStopMessage', () => {
  it('should build typing_stop message', () => {
    const msg = buildTypingStopMessage(5);
    expect(msg).toEqual({
      type: WS_MESSAGE_TYPES.TYPING_STOP,
      data: { conversationId: 5 },
    });
  });
});

describe('buildPingMessage', () => {
  it('should build ping message with timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T08:00:00.000Z'));

    const msg = buildPingMessage();
    expect(msg.type).toBe(WS_MESSAGE_TYPES.PING);
    expect((msg.data as { timestamp: string }).timestamp).toBe(
      '2026-03-01T08:00:00.000Z',
    );

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Reconnection logic
// ---------------------------------------------------------------------------

describe('calculateReconnectDelay', () => {
  it('should return base delay * attempt', () => {
    expect(calculateReconnectDelay(1)).toBe(WEBSOCKET_CONFIG.reconnectDelay);
    expect(calculateReconnectDelay(2)).toBe(
      WEBSOCKET_CONFIG.reconnectDelay * 2,
    );
    expect(calculateReconnectDelay(5)).toBe(
      WEBSOCKET_CONFIG.reconnectDelay * 5,
    );
  });
});

describe('shouldReconnect', () => {
  it('should return true when attempts below max', () => {
    expect(shouldReconnect(0)).toBe(true);
    expect(shouldReconnect(1)).toBe(true);
    expect(shouldReconnect(4)).toBe(true);
  });

  it('should return false when attempts at or above max', () => {
    expect(shouldReconnect(WEBSOCKET_CONFIG.maxReconnectAttempts)).toBe(false);
    expect(shouldReconnect(WEBSOCKET_CONFIG.maxReconnectAttempts + 1)).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Message type checks
// ---------------------------------------------------------------------------

describe('isTypingMessage', () => {
  it('should return true for all typing-related types', () => {
    expect(isTypingMessage(WS_MESSAGE_TYPES.TYPING_START)).toBe(true);
    expect(isTypingMessage(WS_MESSAGE_TYPES.USER_TYPING)).toBe(true);
    expect(isTypingMessage(WS_MESSAGE_TYPES.TYPING_STOP)).toBe(true);
    expect(isTypingMessage(WS_MESSAGE_TYPES.USER_STOPPED_TYPING)).toBe(true);
  });

  it('should return false for non-typing types', () => {
    expect(isTypingMessage(WS_MESSAGE_TYPES.NEW_MESSAGE)).toBe(false);
    expect(isTypingMessage(WS_MESSAGE_TYPES.PING)).toBe(false);
    expect(isTypingMessage('unknown_type')).toBe(false);
  });
});

describe('isTypingStartMessage', () => {
  it('should return true for typing start types', () => {
    expect(isTypingStartMessage(WS_MESSAGE_TYPES.TYPING_START)).toBe(true);
    expect(isTypingStartMessage(WS_MESSAGE_TYPES.USER_TYPING)).toBe(true);
  });

  it('should return false for typing stop types', () => {
    expect(isTypingStartMessage(WS_MESSAGE_TYPES.TYPING_STOP)).toBe(false);
    expect(isTypingStartMessage(WS_MESSAGE_TYPES.USER_STOPPED_TYPING)).toBe(
      false,
    );
  });
});

describe('isStatusMessage', () => {
  it('should return true for status types', () => {
    expect(isStatusMessage(WS_MESSAGE_TYPES.USER_STATUS)).toBe(true);
    expect(isStatusMessage(WS_MESSAGE_TYPES.USER_STATUS_CHANGED)).toBe(true);
  });

  it('should return false for non-status types', () => {
    expect(isStatusMessage(WS_MESSAGE_TYPES.NEW_MESSAGE)).toBe(false);
    expect(isStatusMessage('random')).toBe(false);
  });
});

describe('isIgnorableMessage', () => {
  it('should return true for pong and message_sent', () => {
    expect(isIgnorableMessage(WS_MESSAGE_TYPES.PONG)).toBe(true);
    expect(isIgnorableMessage(WS_MESSAGE_TYPES.MESSAGE_SENT)).toBe(true);
  });

  it('should return false for non-ignorable types', () => {
    expect(isIgnorableMessage(WS_MESSAGE_TYPES.NEW_MESSAGE)).toBe(false);
    expect(isIgnorableMessage(WS_MESSAGE_TYPES.TYPING_START)).toBe(false);
  });
});
