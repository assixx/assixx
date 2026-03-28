import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from './nest/database/database.service.js';
import {
  type E2eFields,
  type SendMessageData,
  WebSocketMessageHandler,
} from './websocket-message-handler.js';

vi.mock('uuid', () => ({
  v7: (): string => '019539a0-0000-7000-8000-000000000001',
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createHandlerWithMock(): {
  handler: WebSocketMessageHandler;
  mockDb: { query: ReturnType<typeof vi.fn> };
} {
  const mockDb = { query: vi.fn() };
  const handler = new WebSocketMessageHandler(mockDb as unknown as DatabaseService);
  return { handler, mockDb };
}

const TENANT_ID = 42;
const USER_ID = 5;

function createSenderRow(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: USER_ID,
    username: 'jdoe',
    first_name: 'John',
    last_name: 'Doe',
    profile_picture_url: '/uploads/pic.jpg',
    ...overrides,
  };
}

function createE2eFields(overrides?: Partial<E2eFields>): E2eFields {
  return {
    encryptedContent: 'base64cipher',
    e2eNonce: 'base64nonce',
    e2eKeyVersion: 2,
    e2eKeyEpoch: 1,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('WebSocketMessageHandler – conversation queries', () => {
  let handler: WebSocketMessageHandler;
  let mockDb: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const result = createHandlerWithMock();
    handler = result.handler;
    mockDb = result.mockDb;
  });

  describe('verifyConversationAccess', () => {
    it('should return participant user IDs', async () => {
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }, { user_id: 10 }, { user_id: 15 }]);

      const result = await handler.verifyConversationAccess(1, TENANT_ID);

      expect(result).toEqual([5, 10, 15]);
      expect(mockDb.query).toHaveBeenCalledOnce();
      const [, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual([1, TENANT_ID, TENANT_ID]);
    });

    it('should return empty array when no participants found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await handler.verifyConversationAccess(999, TENANT_ID);

      expect(result).toEqual([]);
    });
  });

  describe('getOtherParticipantIds', () => {
    it('should exclude the given user', async () => {
      mockDb.query.mockResolvedValueOnce([{ user_id: 10 }, { user_id: 15 }]);

      const result = await handler.getOtherParticipantIds(1, TENANT_ID, USER_ID);

      expect(result).toEqual([10, 15]);
      const [, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual([1, TENANT_ID, TENANT_ID, USER_ID]);
    });

    it('should return empty when user is only participant', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await handler.getOtherParticipantIds(1, TENANT_ID, USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe('getConversationPartnerIds', () => {
    it('should return distinct partner IDs', async () => {
      mockDb.query.mockResolvedValueOnce([{ user_id: 10 }, { user_id: 20 }]);

      const result = await handler.getConversationPartnerIds(USER_ID, TENANT_ID);

      expect(result).toEqual([10, 20]);
      const [query, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(query).toContain('DISTINCT');
      expect(params).toEqual([USER_ID, TENANT_ID, USER_ID]);
    });
  });
});

describe('WebSocketMessageHandler – resolveE2eFields', () => {
  let handler: WebSocketMessageHandler;
  let mockDb: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const result = createHandlerWithMock();
    handler = result.handler;
    mockDb = result.mockDb;
  });

  it('should return isE2e:false when no encrypted fields', async () => {
    const data: SendMessageData = { conversationId: 1, content: 'hello' };

    const result = await handler.resolveE2eFields(data, TENANT_ID, USER_ID);

    expect(result).toEqual({
      isE2e: false,
      fields: undefined,
      error: undefined,
    });
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('should return isE2e:false when only encryptedContent but no nonce', async () => {
    const data: SendMessageData = {
      conversationId: 1,
      encryptedContent: 'cipher',
    };

    const result = await handler.resolveE2eFields(data, TENANT_ID, USER_ID);

    expect(result.isE2e).toBe(false);
  });

  it('should return isE2e:false when only nonce but no encryptedContent', async () => {
    const data: SendMessageData = {
      conversationId: 1,
      e2eNonce: 'nonce',
    };

    const result = await handler.resolveE2eFields(data, TENANT_ID, USER_ID);

    expect(result.isE2e).toBe(false);
  });

  it('should return E2E fields with defaults when no key version given', async () => {
    const data: SendMessageData = {
      conversationId: 1,
      encryptedContent: 'cipher',
      e2eNonce: 'nonce',
    };

    const result = await handler.resolveE2eFields(data, TENANT_ID, USER_ID);

    expect(result).toEqual({
      isE2e: true,
      error: undefined,
      fields: {
        encryptedContent: 'cipher',
        e2eNonce: 'nonce',
        e2eKeyVersion: 1,
        e2eKeyEpoch: 0,
      },
    });
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('should validate key version and return fields when valid', async () => {
    mockDb.query.mockResolvedValueOnce([{ key_version: 3 }]);

    const data: SendMessageData = {
      conversationId: 1,
      encryptedContent: 'cipher',
      e2eNonce: 'nonce',
      e2eKeyVersion: 3,
      e2eKeyEpoch: 2,
    };

    const result = await handler.resolveE2eFields(data, TENANT_ID, USER_ID);

    expect(result).toEqual({
      isE2e: true,
      error: undefined,
      fields: {
        encryptedContent: 'cipher',
        e2eNonce: 'nonce',
        e2eKeyVersion: 3,
        e2eKeyEpoch: 2,
      },
    });
    expect(mockDb.query).toHaveBeenCalledOnce();
  });

  it('should return error when key version mismatches', async () => {
    mockDb.query.mockResolvedValueOnce([{ key_version: 1 }]);

    const data: SendMessageData = {
      conversationId: 1,
      encryptedContent: 'cipher',
      e2eNonce: 'nonce',
      e2eKeyVersion: 99,
    };

    const result = await handler.resolveE2eFields(data, TENANT_ID, USER_ID);

    expect(result).toEqual({
      isE2e: true,
      fields: undefined,
      error: 'E2E key version mismatch. Re-fetch key data.',
    });
  });

  it('should return error when no key row found in DB', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    const data: SendMessageData = {
      conversationId: 1,
      encryptedContent: 'cipher',
      e2eNonce: 'nonce',
      e2eKeyVersion: 1,
    };

    const result = await handler.resolveE2eFields(data, TENANT_ID, USER_ID);

    expect(result.isE2e).toBe(true);
    expect(result.fields).toBeUndefined();
    expect(result.error).toBe('E2E key version mismatch. Re-fetch key data.');
  });
});

describe('WebSocketMessageHandler – processMessage', () => {
  let handler: WebSocketMessageHandler;
  let mockDb: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const result = createHandlerWithMock();
    handler = result.handler;
    mockDb = result.mockDb;
  });

  it('should save plaintext message without attachments', async () => {
    // Q1: saveMessage INSERT
    mockDb.query.mockResolvedValueOnce([{ id: 100 }]);
    // Q2: getMessageAttachments (empty)
    // skipped because attachmentIds.length === 0, returns [] inline
    // Q3: getSenderInfo
    mockDb.query.mockResolvedValueOnce([createSenderRow()]);

    const result = await handler.processMessage(USER_ID, TENANT_ID, 1, 'Hello World', []);

    expect(result.messageId).toBe(100);
    expect(result.messageUuid).toBe('019539a0-0000-7000-8000-000000000001');
    expect(result.preview).toBe('Hello World');

    const messageData = result.messageData as Record<string, unknown>;
    expect(messageData['content']).toBe('Hello World');
    expect(messageData['senderId']).toBe(USER_ID);
    expect(messageData['senderName']).toBe('John Doe');
    expect(messageData['isE2e']).toBe(false);
    expect(messageData['encryptedContent']).toBeNull();

    expect(mockDb.query).toHaveBeenCalledTimes(2);
  });

  it('should save E2E message with lock-icon preview', async () => {
    const e2e = createE2eFields();

    // Q1: saveMessage INSERT
    mockDb.query.mockResolvedValueOnce([{ id: 200 }]);
    // Q2: getSenderInfo
    mockDb.query.mockResolvedValueOnce([createSenderRow()]);

    const result = await handler.processMessage(USER_ID, TENANT_ID, 1, null, [], e2e);

    expect(result.messageId).toBe(200);
    expect(result.preview).toBe('');

    const messageData = result.messageData as Record<string, unknown>;
    expect(messageData['isE2e']).toBe(true);
    expect(messageData['encryptedContent']).toBe('base64cipher');
    expect(messageData['e2eNonce']).toBe('base64nonce');
    expect(messageData['e2eKeyVersion']).toBe(2);
    expect(messageData['e2eKeyEpoch']).toBe(1);
    expect(messageData['content']).toBeNull();
  });

  it('should link attachments and include them in response', async () => {
    // Q1: saveMessage INSERT
    mockDb.query.mockResolvedValueOnce([{ id: 300 }]);
    // Q2: linkAttachmentsToMessage UPDATE
    mockDb.query.mockResolvedValueOnce([]);
    // Q3: getMessageAttachments SELECT
    mockDb.query.mockResolvedValueOnce([
      {
        id: 50,
        file_uuid: 'uuid-50',
        filename: 'report.pdf',
        original_name: 'Report.pdf',
        file_size: 1024,
        mime_type: 'application/pdf',
      },
    ]);
    // Q4: getSenderInfo
    mockDb.query.mockResolvedValueOnce([createSenderRow()]);

    const result = await handler.processMessage(USER_ID, TENANT_ID, 1, 'See attached', [50]);

    expect(result.messageId).toBe(300);
    expect(result.preview).toBe('See attached');

    const messageData = result.messageData as Record<string, unknown>;
    const attachments = messageData['attachments'] as Record<string, unknown>[];
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.['id']).toBe(50);
    expect(attachments[0]?.['downloadUrl']).toBe('/api/v2/documents/50/download');

    expect(mockDb.query).toHaveBeenCalledTimes(4);
  });

  it('should truncate preview to 50 chars', async () => {
    const longContent = 'A'.repeat(100);
    mockDb.query.mockResolvedValueOnce([{ id: 400 }]);
    mockDb.query.mockResolvedValueOnce([createSenderRow()]);

    const result = await handler.processMessage(USER_ID, TENANT_ID, 1, longContent, []);

    expect(result.preview).toHaveLength(50);
  });

  it('should handle null content with empty preview', async () => {
    mockDb.query.mockResolvedValueOnce([{ id: 500 }]);
    mockDb.query.mockResolvedValueOnce([createSenderRow()]);

    const result = await handler.processMessage(USER_ID, TENANT_ID, 1, null, []);

    expect(result.preview).toBe('');
  });

  it('should throw when INSERT returns no row', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    await expect(handler.processMessage(USER_ID, TENANT_ID, 1, 'text', [])).rejects.toThrow(
      'Failed to insert message - no row returned',
    );
  });

  it('should use fallback name when sender not found', async () => {
    mockDb.query.mockResolvedValueOnce([{ id: 600 }]);
    mockDb.query.mockResolvedValueOnce([]); // no sender

    const result = await handler.processMessage(USER_ID, TENANT_ID, 1, 'hello', []);

    const messageData = result.messageData as Record<string, unknown>;
    expect(messageData['senderName']).toBe('Unbekannter Benutzer');
    expect(messageData['senderUsername']).toBe('');
  });

  it('should use username when first/last name are empty', async () => {
    mockDb.query.mockResolvedValueOnce([{ id: 700 }]);
    mockDb.query.mockResolvedValueOnce([createSenderRow({ first_name: null, last_name: null })]);

    const result = await handler.processMessage(USER_ID, TENANT_ID, 1, 'hi', []);

    const messageData = result.messageData as Record<string, unknown>;
    expect(messageData['senderName']).toBe('jdoe');
  });

  it('should use first name only when last name is null', async () => {
    mockDb.query.mockResolvedValueOnce([{ id: 800 }]);
    mockDb.query.mockResolvedValueOnce([createSenderRow({ first_name: 'Alice', last_name: null })]);

    const result = await handler.processMessage(USER_ID, TENANT_ID, 1, 'hi', []);

    const messageData = result.messageData as Record<string, unknown>;
    expect(messageData['senderName']).toBe('Alice');
  });

  it('should use fallback when username is also empty', async () => {
    mockDb.query.mockResolvedValueOnce([{ id: 900 }]);
    mockDb.query.mockResolvedValueOnce([
      createSenderRow({
        first_name: null,
        last_name: null,
        username: '',
      }),
    ]);

    const result = await handler.processMessage(USER_ID, TENANT_ID, 1, 'hi', []);

    const messageData = result.messageData as Record<string, unknown>;
    expect(messageData['senderName']).toBe('Unbekannter Benutzer');
  });
});

describe('WebSocketMessageHandler – markAsRead', () => {
  let handler: WebSocketMessageHandler;
  let mockDb: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const result = createHandlerWithMock();
    handler = result.handler;
    mockDb = result.mockDb;
  });

  it('should mark message and return sender info', async () => {
    // Q1: UPDATE
    mockDb.query.mockResolvedValueOnce([]);
    // Q2: SELECT message info
    mockDb.query.mockResolvedValueOnce([{ sender_id: 10, conversation_id: 1 }]);

    const result = await handler.markAsRead(100, TENANT_ID, USER_ID);

    expect(result).toEqual({ senderId: 10, conversationId: 1 });
    expect(mockDb.query).toHaveBeenCalledTimes(2);

    const [updateQuery] = mockDb.query.mock.calls[0] as [string, unknown[]];
    expect(updateQuery).toContain('UPDATE chat_messages');
    expect(updateQuery).toContain('is_read = true');
  });

  it('should return null when message not found', async () => {
    mockDb.query.mockResolvedValueOnce([]);
    mockDb.query.mockResolvedValueOnce([]);

    const result = await handler.markAsRead(999, TENANT_ID, USER_ID);

    expect(result).toBeNull();
  });
});
