/**
 * Unit tests for Chat Helpers
 *
 * Phase 6: Pure function tests — 1 test per function, no mocking needed.
 * validateScheduledTime uses vi.useFakeTimers for deterministic Date.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';

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

describe('chat.helpers', () => {
  it('mapRowToChatUser should map DB row to ChatUser with defaults', () => {
    const row: ChatUserRow = {
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
    };

    const result = mapRowToChatUser(row);

    expect(result.firstName).toBe('John');
    expect(result.status).toBe('offline');
    expect(result.lastSeen).toBeNull();
    expect(result.teamAreaId).toBe(2);
  });

  it('mapConversationToApiFormat should combine participants and unread counts', () => {
    const conv: ConversationRow = {
      id: 1,
      uuid: ' abc-123 ',
      name: 'General',
      is_group: true,
      created_at: new Date('2025-01-01'),
      updated_at: new Date('2025-01-02'),
      last_message_content: 'Hello!',
      last_message_time: new Date('2025-01-02T10:00:00Z'),
    };
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

    const result = mapConversationToApiFormat(conv, participants, unread);

    expect(result.uuid).toBe('abc-123');
    expect(result.unreadCount).toBe(3);
    expect(result.participants).toHaveLength(1);
    expect(result.lastMessage?.content).toBe('Hello!');
  });

  it('transformMessage should map message row with attachment', () => {
    const msg: MessageRow = {
      id: 1,
      conversation_id: 10,
      sender_id: 5,
      sender_username: 'jdoe',
      sender_first_name: 'John',
      sender_last_name: 'Doe',
      sender_profile_picture: null,
      content: 'Hello',
      attachment_path: 'files/doc.pdf',
      attachment_name: 'doc.pdf',
      attachment_type: 'application/pdf',
      attachment_size: 1024,
      created_at: new Date('2025-01-01'),
      is_read: 1,
      read_at: new Date('2025-01-01T12:00:00Z'),
    };

    const result = transformMessage(msg);

    expect(result.senderName).toBe('John Doe');
    expect(result.isRead).toBe(true);
    expect(result.attachment?.filename).toBe('doc.pdf');
    expect(result.attachment?.url).toContain('files/doc.pdf');
  });

  it('buildSentMessage should build Message response', () => {
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

  it('mapDocumentAttachments should create Map from rows', () => {
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

  it('mapScheduledMessage should set status from is_active constant', () => {
    const row: ScheduledMessageRow = {
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
      is_active: SCHEDULED_STATUS.SENT,
      created_at: new Date('2025-01-01'),
      sent_at: new Date('2025-06-01T10:00:00Z'),
    };

    const result = mapScheduledMessage(row, SCHEDULED_STATUS);

    expect(result.status).toBe('sent');
    expect(result.sentAt).toBe('2025-06-01T10:00:00.000Z');
  });

  it('buildPaginationMeta should calculate hasNext and hasPrev', () => {
    const result = buildPaginationMeta(2, 10, 25);

    expect(result.currentPage).toBe(2);
    expect(result.totalPages).toBe(3);
    expect(result.hasNext).toBe(true);
    expect(result.hasPrev).toBe(true);
  });

  it('validateScheduledTime should return error for too-soon time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const tooSoon = new Date('2025-06-01T12:02:00Z'); // only 2 min ahead
    const result = validateScheduledTime(tooSoon, 5, 30);

    expect(result).toContain('at least 5 minutes');
  });

  it('resolveMessageContent should return error when no content and no attachment', () => {
    const result = resolveMessageContent(undefined, false);

    expect('error' in result).toBe(true);
  });

  it('filterUsersBySearch should filter by name', () => {
    const users: ChatUserRow[] = [
      {
        id: 1, username: 'alice', email: 'a@test.de',
        first_name: 'Alice', last_name: 'Wonder',
        employee_number: null, profile_picture: null,
        department_id: null, department_name: null,
        area_id: null, area_name: null, role: 'employee',
      },
      {
        id: 2, username: 'bob', email: 'b@test.de',
        first_name: 'Bob', last_name: 'Builder',
        employee_number: null, profile_picture: null,
        department_id: null, department_name: null,
        area_id: null, area_name: null, role: 'employee',
      },
    ];

    const result = filterUsersBySearch(users, 'alice');

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(1);
  });
});
