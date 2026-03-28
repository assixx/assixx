/**
 * Unit tests for Chat Helpers
 *
 * Phase 6: Pure function tests — 1 test per function, no mocking needed.
 * Phase 13 Batch D: Deepened — edge cases, null handling, more branches.
 * validateScheduledTime uses vi.useFakeTimers for deterministic Date.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildPaginationMeta,
  buildSentMessage,
  filterUsersBySearch,
  mapConversationToApiFormat,
  mapDocumentAttachments,
  mapRowToChatUser,
  mapScheduledMessage,
  resolveMessageContent,
  transformMessage,
  validateScheduledTime,
} from './chat.helpers.js';
import { SCHEDULED_STATUS } from './chat.types.js';
import type {
  ChatUserRow,
  ConversationRow,
  MessageRow,
  ParticipantRow,
  ScheduledMessageRow,
  SenderInfo,
} from './chat.types.js';

afterEach(() => {
  vi.useRealTimers();
});

// ============================================
// Mock Factories
// ============================================

function createMockUserRow(overrides?: Partial<ChatUserRow>): ChatUserRow {
  return {
    id: 1,
    username: 'jdoe',
    email: 'j@test.de',
    first_name: 'John',
    last_name: 'Doe',
    employee_number: 'E001',
    profile_picture: null,
    department_id: 5,
    department_name: 'IT',
    area_id: 2,
    area_name: 'Tech',
    role: 'employee',
    ...overrides,
  };
}

function createMockMessageRow(overrides?: Partial<MessageRow>): MessageRow {
  return {
    id: 1,
    conversation_id: 10,
    sender_id: 5,
    sender_username: 'jdoe',
    sender_first_name: 'John',
    sender_last_name: 'Doe',
    sender_profile_picture: null,
    content: 'Hello',
    attachment_path: null,
    attachment_name: null,
    attachment_type: null,
    attachment_size: null,
    created_at: new Date('2025-01-01'),
    is_read: 0,
    read_at: null,
    ...overrides,
  };
}

// ============================================
// mapRowToChatUser
// ============================================

describe('mapRowToChatUser', () => {
  it('should map DB row to ChatUser with defaults', () => {
    const row = createMockUserRow();
    const result = mapRowToChatUser(row);

    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Doe');
    expect(result.status).toBe('offline');
    expect(result.lastSeen).toBeNull();
    expect(result.teamAreaId).toBe(2);
  });

  it('should default null first_name and last_name to empty strings', () => {
    const row = createMockUserRow({ first_name: null, last_name: null });
    const result = mapRowToChatUser(row);

    expect(result.firstName).toBe('');
    expect(result.lastName).toBe('');
  });
});

// ============================================
// mapConversationToApiFormat
// ============================================

describe('mapConversationToApiFormat', () => {
  const baseConv: ConversationRow = {
    id: 1,
    uuid: ' abc-123 ',
    name: 'General',
    is_group: true,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-02'),
    last_message_content: 'Hello!',
    last_message_time: new Date('2025-01-02T10:00:00Z'),
    last_message_is_e2e: false,
  };

  it('should combine participants and unread counts', () => {
    const participants: ParticipantRow[] = [
      {
        conversation_id: 1,
        user_id: 5,
        joined_at: new Date('2025-01-01'),
        is_admin: false,
        username: 'user5',
        first_name: 'Alice',
        last_name: null,
        profile_picture: null,
      },
    ];
    const unread = new Map([[1, 3]]);

    const result = mapConversationToApiFormat(baseConv, participants, unread);

    expect(result.uuid).toBe('abc-123');
    expect(result.unreadCount).toBe(3);
    expect(result.participants).toHaveLength(1);
    expect(result.lastMessage?.content).toBe('Hello!');
  });

  it('should return null lastMessage when content/time are null', () => {
    const conv: ConversationRow = {
      ...baseConv,
      last_message_content: null,
      last_message_time: null,
    };

    const result = mapConversationToApiFormat(conv, [], new Map());

    expect(result.lastMessage).toBeNull();
  });

  it('should default unreadCount to 0 for unknown conversation', () => {
    const result = mapConversationToApiFormat(baseConv, [], new Map());

    expect(result.unreadCount).toBe(0);
  });

  it('should set isE2e on lastMessage when last message is E2E encrypted', () => {
    const conv: ConversationRow = {
      ...baseConv,
      last_message_content: null,
      last_message_is_e2e: true,
    };

    const result = mapConversationToApiFormat(conv, [], new Map());

    expect(result.lastMessage).not.toBeNull();
    expect(result.lastMessage!.content).toBe('');
    expect(result.lastMessage!.isE2e).toBe(true);
  });

  it('should not set isE2e on lastMessage for plaintext messages', () => {
    const result = mapConversationToApiFormat(baseConv, [], new Map());

    expect(result.lastMessage?.isE2e).toBeUndefined();
  });

  it('should default participant firstName to empty string when null', () => {
    const participants: ParticipantRow[] = [
      {
        conversation_id: 1,
        user_id: 5,
        joined_at: new Date('2025-01-01'),
        is_admin: false,
        username: 'user5',
        first_name: null,
        last_name: null,
        profile_picture: 'pic.jpg',
      },
    ];

    const result = mapConversationToApiFormat(baseConv, participants, new Map());

    expect(result.participants[0]!.firstName).toBe('');
    expect(result.participants[0]!.lastName).toBe('');
  });
});

// ============================================
// transformMessage
// ============================================

describe('transformMessage', () => {
  it('should map message row with attachment', () => {
    const msg = createMockMessageRow({
      attachment_path: 'files/doc.pdf',
      attachment_name: 'doc.pdf',
      attachment_type: 'application/pdf',
      attachment_size: 1024,
      is_read: 1,
      read_at: new Date('2025-01-01T12:00:00Z'),
    });

    const result = transformMessage(msg);

    expect(result.senderName).toBe('John Doe');
    expect(result.isRead).toBe(true);
    expect(result.attachment?.filename).toBe('doc.pdf');
    expect(result.attachment?.url).toContain('files/doc.pdf');
    expect(result.readAt).not.toBeNull();
  });

  it('should return null attachment when path is null', () => {
    const msg = createMockMessageRow();
    const result = transformMessage(msg);

    expect(result.attachment).toBeNull();
    expect(result.isRead).toBe(false);
    expect(result.readAt).toBeNull();
  });

  it('should default attachment size to 0 when not a number', () => {
    const msg = createMockMessageRow({
      attachment_path: 'files/doc.pdf',
      attachment_name: 'doc.pdf',
      attachment_type: 'application/pdf',
      attachment_size: null,
    });

    const result = transformMessage(msg);

    expect(result.attachment?.size).toBe(0);
  });

  it('should default senderName to Unknown when names are empty', () => {
    const msg = createMockMessageRow({
      sender_first_name: null,
      sender_last_name: null,
    });

    const result = transformMessage(msg);

    expect(result.senderName).toBe('Unknown');
  });

  it('should default senderUsername to unknown when empty', () => {
    const msg = createMockMessageRow({ sender_username: '' });
    const result = transformMessage(msg);

    expect(result.senderUsername).toBe('unknown');
  });
});

// ============================================
// buildSentMessage
// ============================================

describe('buildSentMessage', () => {
  it('should build Message response without attachment', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const sender: SenderInfo = {
      username: 'jdoe',
      first_name: 'John',
      last_name: 'Doe',
      profile_picture: null,
    };

    const result = buildSentMessage(42, 10, 5, 'Hi there', sender);

    expect(result.id).toBe(42);
    expect(result.senderName).toBe('John Doe');
    expect(result.attachment).toBeNull();
    expect(result.isRead).toBe(false);
  });

  it('should include attachment when provided', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const sender: SenderInfo = {
      username: 'jdoe',
      first_name: 'John',
      last_name: 'Doe',
      profile_picture: null,
    };
    const attachment = {
      path: '/uploads/file.pdf',
      filename: 'file.pdf',
      mimeType: 'application/pdf',
      size: 2048,
    };

    const result = buildSentMessage(42, 10, 5, 'See attached', sender, attachment);

    expect(result.attachment).not.toBeNull();
    expect(result.attachment?.url).toBe('/uploads/file.pdf');
    expect(result.attachment?.filename).toBe('file.pdf');
  });

  it('should default senderName to Unknown when names are null', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const sender: SenderInfo = {
      username: 'bot',
      first_name: null,
      last_name: null,
      profile_picture: null,
    };

    const result = buildSentMessage(1, 1, 1, 'msg', sender);

    expect(result.senderName).toBe('Unknown');
  });
});

// ============================================
// mapDocumentAttachments
// ============================================

describe('mapDocumentAttachments', () => {
  it('should create Map from rows', () => {
    const rows = [
      {
        id: 1,
        message_id: 10,
        file_uuid: 'uuid-1',
        filename: 'doc.pdf',
        original_name: 'original.pdf',
        file_size: 2048,
        mime_type: 'application/pdf',
        uploaded_at: new Date('2025-01-01'),
      },
    ];

    const result = mapDocumentAttachments([10, 20], rows);

    expect(result.get(10)).toHaveLength(1);
    expect(result.get(20)).toHaveLength(0);
    expect(result.get(10)![0]!.fileUuid).toBe('uuid-1');
  });

  it('should handle empty rows', () => {
    const result = mapDocumentAttachments([1, 2], []);

    expect(result.get(1)).toEqual([]);
    expect(result.get(2)).toEqual([]);
  });

  it('should omit createdAt when uploaded_at is null', () => {
    const rows = [
      {
        id: 1,
        message_id: 10,
        file_uuid: 'uuid-1',
        filename: 'doc.pdf',
        original_name: 'original.pdf',
        file_size: 1024,
        mime_type: 'application/pdf',
        uploaded_at: null,
      },
    ];

    const result = mapDocumentAttachments([10], rows);
    const attachment = result.get(10)![0]!;

    expect('createdAt' in attachment).toBe(false);
  });
});

// ============================================
// mapScheduledMessage
// ============================================

describe('mapScheduledMessage', () => {
  function createMockScheduledRow(overrides?: Partial<ScheduledMessageRow>): ScheduledMessageRow {
    return {
      id: '1',
      tenant_id: 10,
      conversation_id: 5,
      sender_id: 3,
      content: 'Later!',
      attachment_path: null,
      attachment_name: null,
      attachment_type: null,
      attachment_size: null,
      scheduled_for: new Date('2025-06-01T10:00:00Z'),
      is_active: SCHEDULED_STATUS.ACTIVE,
      created_at: new Date('2025-01-01'),
      sent_at: null,
      ...overrides,
    };
  }

  it('should map SENT status', () => {
    const row = createMockScheduledRow({
      is_active: SCHEDULED_STATUS.SENT,
      sent_at: new Date('2025-06-01T10:00:00Z'),
    });

    const result = mapScheduledMessage(row, SCHEDULED_STATUS);

    expect(result.status).toBe('sent');
    expect(result.sentAt).toBe('2025-06-01T10:00:00.000Z');
  });

  it('should map CANCELLED status', () => {
    const row = createMockScheduledRow({
      is_active: SCHEDULED_STATUS.CANCELLED,
    });

    const result = mapScheduledMessage(row, SCHEDULED_STATUS);

    expect(result.status).toBe('cancelled');
  });

  it('should default to pending for ACTIVE status', () => {
    const row = createMockScheduledRow();

    const result = mapScheduledMessage(row, SCHEDULED_STATUS);

    expect(result.status).toBe('pending');
    expect(result.sentAt).toBeNull();
  });

  it('should include attachment when all fields present', () => {
    const row = createMockScheduledRow({
      attachment_path: '/uploads/file.pdf',
      attachment_name: 'file.pdf',
      attachment_type: 'application/pdf',
      attachment_size: 2048,
    });

    const result = mapScheduledMessage(row, SCHEDULED_STATUS);

    expect(result.attachment).not.toBeNull();
    expect(result.attachment?.name).toBe('file.pdf');
  });

  it('should return null attachment when any field is null', () => {
    const row = createMockScheduledRow({
      attachment_path: '/uploads/file.pdf',
      attachment_name: null,
      attachment_type: null,
      attachment_size: null,
    });

    const result = mapScheduledMessage(row, SCHEDULED_STATUS);

    expect(result.attachment).toBeNull();
  });
});

// ============================================
// buildPaginationMeta
// ============================================

describe('buildPaginationMeta', () => {
  it('should calculate hasNext and hasPrev', () => {
    const result = buildPaginationMeta(2, 10, 25);

    expect(result.currentPage).toBe(2);
    expect(result.totalPages).toBe(3);
    expect(result.hasNext).toBe(true);
    expect(result.hasPrev).toBe(true);
  });

  it('should return hasPrev=false for page 1', () => {
    const result = buildPaginationMeta(1, 10, 25);

    expect(result.hasPrev).toBe(false);
    expect(result.hasNext).toBe(true);
  });

  it('should return hasNext=false on last page', () => {
    const result = buildPaginationMeta(3, 10, 25);

    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(true);
  });

  it('should handle 0 items', () => {
    const result = buildPaginationMeta(1, 10, 0);

    expect(result.totalPages).toBe(0);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(false);
  });
});

// ============================================
// validateScheduledTime
// ============================================

describe('validateScheduledTime', () => {
  it('should return error for too-soon time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const tooSoon = new Date('2025-06-01T12:02:00Z');
    const result = validateScheduledTime(tooSoon, 5, 30);

    expect(result).toContain('at least 5 minutes');
  });

  it('should return error for too-far-future time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const tooFar = new Date('2025-08-01T12:00:00Z');
    const result = validateScheduledTime(tooFar, 5, 30);

    expect(result).toContain('more than 30 days');
  });

  it('should return null for valid time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const valid = new Date('2025-06-01T13:00:00Z');
    const result = validateScheduledTime(valid, 5, 30);

    expect(result).toBeNull();
  });
});

// ============================================
// resolveMessageContent
// ============================================

describe('resolveMessageContent', () => {
  it('should return error when no content and no attachment', () => {
    const result = resolveMessageContent(undefined, false);

    expect('error' in result).toBe(true);
  });

  it('should return content when message provided', () => {
    const result = resolveMessageContent('Hello!', false);

    expect('content' in result).toBe(true);
    const data = result as { content: string };
    expect(data.content).toBe('Hello!');
  });

  it('should return placeholder for attachment-only message', () => {
    const result = resolveMessageContent(undefined, true);

    expect('content' in result).toBe(true);
  });

  it('should keep message content even with attachment', () => {
    const result = resolveMessageContent('See file', true);

    expect('content' in result).toBe(true);
    const data = result as { content: string };
    expect(data.content).toBe('See file');
  });
});

// ============================================
// filterUsersBySearch
// ============================================

describe('filterUsersBySearch', () => {
  const users: ChatUserRow[] = [
    createMockUserRow({
      id: 1,
      username: 'alice',
      email: 'a@test.de',
      first_name: 'Alice',
      last_name: 'Wonder',
    }),
    createMockUserRow({
      id: 2,
      username: 'bob',
      email: 'b@test.de',
      first_name: 'Bob',
      last_name: 'Builder',
    }),
  ];

  it('should filter by name', () => {
    const result = filterUsersBySearch(users, 'alice');

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(1);
  });

  it('should return all when search is undefined', () => {
    expect(filterUsersBySearch(users, undefined)).toHaveLength(2);
  });

  it('should return all when search is empty', () => {
    expect(filterUsersBySearch(users, '')).toHaveLength(2);
  });

  it('should search by email', () => {
    const result = filterUsersBySearch(users, 'b@test');

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(2);
  });

  it('should search by username', () => {
    const result = filterUsersBySearch(users, 'bob');

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(2);
  });

  it('should be case-insensitive', () => {
    const result = filterUsersBySearch(users, 'ALICE');

    expect(result).toHaveLength(1);
  });
});
