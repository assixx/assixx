/**
 * Unit tests for Chat Utility Functions
 *
 * Tests pure functions: formatting, filtering, validation, helpers.
 * Mocks: $lib/utils/sanitize-html (SSR/DOMPurify chain avoidance).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { MESSAGES } from './constants.js';
import {
  formatFileSize,
  getFileIcon,
  isImageFile,
  linkify,
  highlightSearchTerm,
  highlightSearchInMessage,
  formatMessageTime,
  formatConversationTime,
  formatScheduleTime,
  formatDateSeparator,
  shouldShowDateSeparator,
  getConversationDisplayName,
  getConversationAvatar,
  getChatPartner,
  getChatPartnerName,
  getStatusLabel,
  getRoleLabel,
  getRoleBadgeClass,
  filterMessagesByQuery,
  messageMatchesQuery,
  validateScheduleTime,
  getMinScheduleDateTime,
} from './utils.js';

import type { Conversation, ConversationParticipant, Message } from './types.js';

vi.mock('$lib/utils/sanitize-html', () => ({
  escapeHtml: (text: string | null | undefined): string => {
    if (text === null || text === undefined || text === '') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
  sanitizeHtml: (html: string | null | undefined): string => {
    if (html === null || html === undefined || html === '') return '';
    return html; // pass-through in tests — escapeHtml already called
  },
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockParticipant(
  overrides: Partial<ConversationParticipant> = {},
): ConversationParticipant {
  return {
    id: 1,
    username: 'user1',
    firstName: 'Max',
    lastName: 'Mustermann',
    ...overrides,
  };
}

function createMockConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 1,
    uuid: 'conv-uuid-1',
    isGroup: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    participants: [
      createMockParticipant({ id: 1, username: 'me' }),
      createMockParticipant({
        id: 2,
        username: 'partner',
        firstName: 'Anna',
        lastName: 'Schmidt',
        profileImageUrl: '/avatar.jpg',
      }),
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
    createdAt: '2026-01-15T12:30:00.000Z',
    isRead: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

describe('formatFileSize', () => {
  it('should return "0 Bytes" for 0', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });

  it('should format bytes correctly', () => {
    expect(formatFileSize(500)).toBe('500 Bytes');
  });

  it('should format KB correctly', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('should format MB correctly', () => {
    expect(formatFileSize(1048576)).toBe('1 MB');
    expect(formatFileSize(2621440)).toBe('2.5 MB');
  });

  it('should format GB correctly', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });
});

// ---------------------------------------------------------------------------
// getFileIcon
// ---------------------------------------------------------------------------

describe('getFileIcon', () => {
  it('should return image icon for image MIME types', () => {
    expect(getFileIcon('image/png')).toBe('fa-image');
    expect(getFileIcon('image/jpeg')).toBe('fa-image');
  });

  it('should return video icon for video MIME types', () => {
    expect(getFileIcon('video/mp4')).toBe('fa-video');
  });

  it('should return audio icon for audio MIME types', () => {
    expect(getFileIcon('audio/mpeg')).toBe('fa-music');
  });

  it('should return pdf icon for PDF MIME types', () => {
    expect(getFileIcon('application/pdf')).toBe('fa-file-pdf');
  });

  it('should return word icon for document MIME types', () => {
    expect(getFileIcon('application/msword')).toBe('fa-file-word');
    expect(
      getFileIcon('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe('fa-file-word');
  });

  it('should return excel icon for spreadsheet MIME types', () => {
    expect(getFileIcon('application/vnd.ms-excel')).toBe('fa-file-excel');
    // Note: openxml spreadsheet MIME contains "document" which matches word matcher first
    // (data-driven lookup is order-dependent — word check precedes excel check)
    expect(getFileIcon('application/spreadsheet')).toBe('fa-file-excel');
  });

  it('should return archive icon for zip/rar MIME types', () => {
    expect(getFileIcon('application/zip')).toBe('fa-file-archive');
    expect(getFileIcon('application/x-rar')).toBe('fa-file-archive');
  });

  it('should return default icon for unknown MIME types', () => {
    expect(getFileIcon('application/octet-stream')).toBe('fa-file');
    expect(getFileIcon('text/plain')).toBe('fa-file');
  });
});

// ---------------------------------------------------------------------------
// isImageFile
// ---------------------------------------------------------------------------

describe('isImageFile', () => {
  it('should return true for image files', () => {
    const file = new File([''], 'test.png', { type: 'image/png' });
    expect(isImageFile(file)).toBe(true);
  });

  it('should return false for non-image files', () => {
    const file = new File([''], 'test.pdf', { type: 'application/pdf' });
    expect(isImageFile(file)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// linkify
// ---------------------------------------------------------------------------

describe('linkify', () => {
  it('should convert URLs to anchor tags', () => {
    const result = linkify('Visit https://example.com today');
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('should escape HTML before processing', () => {
    const result = linkify('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should handle text without URLs', () => {
    const result = linkify('just plain text');
    expect(result).not.toContain('<a');
  });

  it('should return cached result on second call', () => {
    const text = 'https://cached.example.com';
    const first = linkify(text);
    const second = linkify(text);
    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// highlightSearchTerm
// ---------------------------------------------------------------------------

describe('highlightSearchTerm', () => {
  it('should wrap matches with <strong> tags', () => {
    const result = highlightSearchTerm('Hello World', 'World');
    expect(result).toContain('<strong>World</strong>');
  });

  it('should return escaped text for empty search', () => {
    const result = highlightSearchTerm('Hello', '');
    expect(result).toBe('Hello');
    expect(result).not.toContain('<strong>');
  });

  it('should return escaped text for whitespace-only search', () => {
    const result = highlightSearchTerm('Hello', '   ');
    expect(result).toBe('Hello');
  });

  it('should escape HTML in input text', () => {
    const result = highlightSearchTerm('<b>bold</b>', 'bold');
    expect(result).not.toContain('<b>');
    expect(result).toContain('&lt;b&gt;');
  });
});

// ---------------------------------------------------------------------------
// highlightSearchInMessage
// ---------------------------------------------------------------------------

describe('highlightSearchInMessage', () => {
  it('should wrap matches with <mark> tags', () => {
    const result = highlightSearchInMessage('Find me here', 'me');
    expect(result).toContain('<mark class="search-highlight">me</mark>');
  });

  it('should return escaped text for empty search', () => {
    const result = highlightSearchInMessage('Hello', '');
    expect(result).toBe('Hello');
  });
});

// ---------------------------------------------------------------------------
// Date/time formatting
// ---------------------------------------------------------------------------

describe('formatMessageTime', () => {
  it('should format time as HH:MM in de-DE locale', () => {
    const result = formatMessageTime('2026-01-15T14:30:00.000Z');
    // UTC 14:30 in de-DE → depends on timezone, but format should be HH:MM
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('formatConversationTime', () => {
  it('should format as DD.MM.YYYY HH:MM', () => {
    const result = formatConversationTime('2026-01-15T14:30:00.000Z');
    expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
  });

  it('should return empty string for empty input', () => {
    expect(formatConversationTime('')).toBe('');
  });
});

describe('formatScheduleTime', () => {
  it('should format Date to de-DE locale string', () => {
    const date = new Date('2026-03-15T10:30:00.000Z');
    const result = formatScheduleTime(date);
    // Should contain date and time parts
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/\d/);
  });
});

describe('formatDateSeparator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "Heute" for today', () => {
    const result = formatDateSeparator('2026-01-15T08:00:00.000Z');
    expect(result).toBe(MESSAGES.dateToday);
  });

  it('should return "Gestern" for yesterday', () => {
    const result = formatDateSeparator('2026-01-14T08:00:00.000Z');
    expect(result).toBe(MESSAGES.dateYesterday);
  });

  it('should return full date for older dates', () => {
    const result = formatDateSeparator('2025-12-25T08:00:00.000Z');
    // Should be a localized German date string, not "Heute" or "Gestern"
    expect(result).not.toBe(MESSAGES.dateToday);
    expect(result).not.toBe(MESSAGES.dateYesterday);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// shouldShowDateSeparator
// ---------------------------------------------------------------------------

describe('shouldShowDateSeparator', () => {
  it('should return true when prev is undefined', () => {
    const current = createMockMessage();
    expect(shouldShowDateSeparator(undefined, current)).toBe(true);
  });

  it('should return false when dates are same', () => {
    const prev = createMockMessage({ createdAt: '2026-01-15T08:00:00.000Z' });
    const current = createMockMessage({
      createdAt: '2026-01-15T20:00:00.000Z',
    });
    expect(shouldShowDateSeparator(prev, current)).toBe(false);
  });

  it('should return true when dates differ', () => {
    const prev = createMockMessage({ createdAt: '2026-01-14T20:00:00.000Z' });
    const current = createMockMessage({
      createdAt: '2026-01-15T08:00:00.000Z',
    });
    expect(shouldShowDateSeparator(prev, current)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Conversation helpers
// ---------------------------------------------------------------------------

describe('getConversationDisplayName', () => {
  it('should return conversation name if set', () => {
    const conv = createMockConversation({ name: 'My Chat' });
    expect(getConversationDisplayName(conv, 1)).toBe('My Chat');
  });

  it('should return group label for unnamed groups', () => {
    const conv = createMockConversation({ isGroup: true, name: undefined });
    expect(getConversationDisplayName(conv, 1)).toBe(MESSAGES.labelGroupConversation);
  });

  it('should return partner full name for 1:1', () => {
    const conv = createMockConversation();
    expect(getConversationDisplayName(conv, 1)).toBe('Anna Schmidt');
  });

  it('should return partner username when no name', () => {
    const conv = createMockConversation({
      participants: [
        createMockParticipant({ id: 1 }),
        createMockParticipant({
          id: 2,
          firstName: '',
          lastName: '',
          username: 'partner42',
        }),
      ],
    });
    expect(getConversationDisplayName(conv, 1)).toBe('partner42');
  });

  it('should return fallback label when no partner found', () => {
    const conv = createMockConversation({
      participants: [createMockParticipant({ id: 1 })],
    });
    expect(getConversationDisplayName(conv, 1)).toBe(MESSAGES.labelConversation);
  });
});

describe('getConversationAvatar', () => {
  it('should return partner profile image for 1:1', () => {
    const conv = createMockConversation();
    expect(getConversationAvatar(conv, 1)).toBe('/avatar.jpg');
  });

  it('should return null for groups', () => {
    const conv = createMockConversation({ isGroup: true });
    expect(getConversationAvatar(conv, 1)).toBeNull();
  });

  it('should return null when partner has no image', () => {
    const conv = createMockConversation({
      participants: [
        createMockParticipant({ id: 1 }),
        createMockParticipant({ id: 2, profileImageUrl: undefined }),
      ],
    });
    expect(getConversationAvatar(conv, 1)).toBeNull();
  });
});

describe('getChatPartner', () => {
  it('should return partner participant', () => {
    const conv = createMockConversation();
    const partner = getChatPartner(conv, 1);
    expect(partner?.id).toBe(2);
  });

  it('should return null for groups', () => {
    const conv = createMockConversation({ isGroup: true });
    expect(getChatPartner(conv, 1)).toBeNull();
  });

  it('should return null for null conversation', () => {
    expect(getChatPartner(null, 1)).toBeNull();
  });
});

describe('getChatPartnerName', () => {
  it('should return partner full name', () => {
    const partner = createMockParticipant({
      firstName: 'Anna',
      lastName: 'Schmidt',
    });
    expect(getChatPartnerName(partner)).toBe('Anna Schmidt');
  });

  it('should return username when no full name', () => {
    const partner = createMockParticipant({
      firstName: '',
      lastName: '',
      username: 'anna42',
    });
    expect(getChatPartnerName(partner)).toBe('anna42');
  });

  it('should return conversation name when no partner', () => {
    expect(getChatPartnerName(null, 'Team Chat')).toBe('Team Chat');
  });

  it('should return fallback label when no partner and no name', () => {
    expect(getChatPartnerName(null)).toBe(MESSAGES.labelConversation);
  });
});

// ---------------------------------------------------------------------------
// Status/Role labels
// ---------------------------------------------------------------------------

describe('getStatusLabel', () => {
  it('should return "Online" for online', () => {
    expect(getStatusLabel('online')).toBe(MESSAGES.statusOnline);
  });

  it('should return "Abwesend" for away', () => {
    expect(getStatusLabel('away')).toBe(MESSAGES.statusAway);
  });

  it('should return "Offline" for offline', () => {
    expect(getStatusLabel('offline')).toBe(MESSAGES.statusOffline);
  });
});

describe('getRoleLabel', () => {
  it('should return correct labels for each role', () => {
    expect(getRoleLabel('admin')).toBe(MESSAGES.roleAdmin);
    expect(getRoleLabel('root')).toBe(MESSAGES.roleRoot);
    expect(getRoleLabel('employee')).toBe(MESSAGES.roleEmployee);
  });

  it('should return employee label for unknown roles', () => {
    expect(getRoleLabel('unknown')).toBe(MESSAGES.roleEmployee);
  });
});

describe('getRoleBadgeClass', () => {
  it('should return correct classes for each role', () => {
    expect(getRoleBadgeClass('admin')).toBe('badge--warning');
    expect(getRoleBadgeClass('root')).toBe('badge--danger');
    expect(getRoleBadgeClass('employee')).toBe('badge--info');
  });

  it('should return info class for unknown roles', () => {
    expect(getRoleBadgeClass('unknown')).toBe('badge--info');
  });
});

// ---------------------------------------------------------------------------
// Message filtering
// ---------------------------------------------------------------------------

describe('filterMessagesByQuery', () => {
  const messages = [
    createMockMessage({ id: 1, content: 'Hello World' }),
    createMockMessage({ id: 2, content: 'Goodbye' }),
    createMockMessage({ id: 3, content: 'hello again' }),
  ];

  it('should return all messages for empty query', () => {
    expect(filterMessagesByQuery(messages, '')).toBe(messages);
  });

  it('should return all messages for whitespace query', () => {
    expect(filterMessagesByQuery(messages, '   ')).toBe(messages);
  });

  it('should filter case-insensitively', () => {
    const result = filterMessagesByQuery(messages, 'hello');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(3);
  });

  it('should return empty array when no matches', () => {
    const result = filterMessagesByQuery(messages, 'xyz');
    expect(result).toHaveLength(0);
  });
});

describe('messageMatchesQuery', () => {
  it('should return true for matching content', () => {
    expect(messageMatchesQuery('Hello World', 'hello')).toBe(true);
  });

  it('should return false for non-matching content', () => {
    expect(messageMatchesQuery('Hello World', 'xyz')).toBe(false);
  });

  it('should return false for empty query', () => {
    expect(messageMatchesQuery('Hello', '')).toBe(false);
  });

  it('should return false for whitespace query', () => {
    expect(messageMatchesQuery('Hello', '  ')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Schedule validation
// ---------------------------------------------------------------------------

describe('validateScheduleTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const MIN_FUTURE = 5 * 60 * 1000; // 5 min
  const MAX_FUTURE = 30 * 24 * 60 * 60 * 1000; // 30 days

  it('should accept valid future time', () => {
    const date = new Date('2026-01-15T13:00:00.000Z'); // 1 hour from now
    const result = validateScheduleTime(date, MIN_FUTURE, MAX_FUTURE);
    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should reject time too close to now', () => {
    const date = new Date('2026-01-15T12:02:00.000Z'); // 2 min from now
    const result = validateScheduleTime(date, MIN_FUTURE, MAX_FUTURE);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(MESSAGES.warningMinFutureTime);
  });

  it('should reject time too far in future', () => {
    const date = new Date('2026-03-15T12:00:00.000Z'); // ~59 days from now
    const result = validateScheduleTime(date, MIN_FUTURE, MAX_FUTURE);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(MESSAGES.warningMaxFutureTime);
  });
});

describe('getMinScheduleDateTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return date and time strings offset by minFutureMs', () => {
    const result = getMinScheduleDateTime(5 * 60 * 1000); // 5 min

    // Compute expected from fake time (toISOString = UTC, toTimeString = local)
    const expected = new Date(new Date('2026-01-15T12:00:00.000Z').getTime() + 5 * 60 * 1000);
    const expectedDate = expected.toISOString().split('T')[0];
    const expectedTime = expected.toTimeString().slice(0, 5);

    expect(result.date).toBe(expectedDate);
    expect(result.time).toBe(expectedTime);
  });
});
