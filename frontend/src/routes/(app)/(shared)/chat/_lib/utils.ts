// =============================================================================
// CHAT PAGE - UTILITY FUNCTIONS (Pure Functions)
// Performance optimized with caching and memoization
// =============================================================================

import { escapeHtml, sanitizeHtml } from '$lib/utils/sanitize-html';

import { FILE_SIZE_UNITS, MIME_TYPE_ICONS, MESSAGES } from './constants';

import type { Conversation, Message, ConversationParticipant, UserStatus } from './types';

// =============================================================================
// PERFORMANCE: CACHED REGEX & MEMOIZATION
// =============================================================================

/** Pre-compiled URL regex - avoids recompilation on every call */
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/** Pre-compiled search escape regex */
const SEARCH_ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

/**
 * Simple LRU-like cache for expensive computations
 * Max 500 entries to prevent memory bloat
 */
class SimpleCache<T> {
  private cache = new Map<string, T>();
  private readonly maxSize: number;

  constructor(maxSize: number = 500) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      // Delete oldest entry (first key)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Caches for expensive operations
const linkifyCache = new SimpleCache<string>(200);
const dateStringCache = new SimpleCache<string>(100);
const timeSeparatorCache = new SimpleCache<string>(50);

// =============================================================================
// FILE HANDLING
// =============================================================================

/** Format file size in human-readable format (e.g., "1.5 MB") */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2));

  return `${size} ${FILE_SIZE_UNITS[i]}`;
}

/** MIME type pattern matchers - data-driven lookup for icon resolution */
const MIME_TYPE_MATCHERS: readonly {
  test: (mimeType: string) => boolean;
  icon: string;
}[] = [
  { test: (m) => m.startsWith('image/'), icon: MIME_TYPE_ICONS.image },
  { test: (m) => m.startsWith('video/'), icon: MIME_TYPE_ICONS.video },
  { test: (m) => m.startsWith('audio/'), icon: MIME_TYPE_ICONS.audio },
  { test: (m) => m.includes('pdf'), icon: MIME_TYPE_ICONS.pdf },
  {
    test: (m) => m.includes('word') || m.includes('document'),
    icon: MIME_TYPE_ICONS.word,
  },
  {
    test: (m) => m.includes('excel') || m.includes('spreadsheet'),
    icon: MIME_TYPE_ICONS.excel,
  },
  {
    test: (m) => m.includes('zip') || m.includes('rar') || m.includes('archive'),
    icon: MIME_TYPE_ICONS.archive,
  },
];

/** Get Font Awesome icon class for a MIME type */
export function getFileIcon(mimeType: string): string {
  const match = MIME_TYPE_MATCHERS.find((matcher) => matcher.test(mimeType));
  return match?.icon ?? MIME_TYPE_ICONS.default;
}

/** Check if a file is an image based on MIME type */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

// =============================================================================
// TEXT FORMATTING
// =============================================================================

/**
 * Convert URLs in text to clickable links (CACHED)
 * SECURITY: Escapes HTML BEFORE processing to prevent XSS attacks
 */
export function linkify(text: string): string {
  // Check cache first
  const cached = linkifyCache.get(text);
  if (cached !== undefined) return cached;

  // SECURITY FIX: Escape HTML entities FIRST to prevent XSS
  // This converts <script> to &lt;script&gt; before URL processing
  const escaped = escapeHtml(text);

  // Reset lastIndex for global regex reuse
  URL_REGEX.lastIndex = 0;

  // Now safely replace URLs with anchor tags
  // The escaped text cannot contain malicious HTML
  const linked = escaped.replace(URL_REGEX, (url: string): string => {
    // Additional URL validation: block javascript: protocol
    if (/^javascript:/i.test(url)) {
      return url; // Return as plain text, not a link
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // Defense-in-depth: Final sanitization pass
  const result = sanitizeHtml(linked);

  linkifyCache.set(text, result);
  return result;
}

/** Cache for compiled search regexes - avoids recompilation */
const searchRegexCache = new SimpleCache<RegExp>(20);

/** Get or create cached regex for search term */
function getSearchRegex(searchTerm: string): RegExp {
  const cached = searchRegexCache.get(searchTerm);
  if (cached !== undefined) {
    cached.lastIndex = 0; // Reset for reuse
    return cached;
  }

  SEARCH_ESCAPE_REGEX.lastIndex = 0;
  const escaped = searchTerm.replace(SEARCH_ESCAPE_REGEX, '\\$&');

  const regex = new RegExp(`(${escaped})`, 'gi');
  searchRegexCache.set(searchTerm, regex);
  return regex;
}

/**
 * Highlight search term in text (OPTIMIZED)
 * SECURITY: Escapes HTML BEFORE highlighting to prevent XSS
 */
export function highlightSearchTerm(text: string, searchTerm: string): string {
  // SECURITY FIX: Escape HTML first
  const escaped = escapeHtml(text);
  if (searchTerm.trim() === '') return escaped;

  // Escape the search term too (for display consistency)
  const escapedSearchTerm = escapeHtml(searchTerm);
  const regex = getSearchRegex(escapedSearchTerm);

  return escaped.replace(regex, '<strong>$1</strong>');
}

/**
 * Highlight search term with mark tag (for message search) (OPTIMIZED)
 * SECURITY: Escapes HTML BEFORE highlighting to prevent XSS
 */
export function highlightSearchInMessage(text: string, searchTerm: string): string {
  // SECURITY FIX: Escape HTML first
  const escaped = escapeHtml(text);
  if (searchTerm.trim() === '') return escaped;

  // Escape the search term too (for display consistency)
  const escapedSearchTerm = escapeHtml(searchTerm);
  const regex = getSearchRegex(escapedSearchTerm);

  return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// =============================================================================
// DATE/TIME FORMATTING (CACHED)
// =============================================================================

/** Cache for formatted message times */
const messageTimeCache = new SimpleCache<string>(300);

/** Cache for conversation times */
const conversationTimeCache = new SimpleCache<string>(100);

/** Cached today/yesterday date strings - regenerated when day changes */
let cachedToday = '';
let cachedYesterday = '';
let lastDateCheck = 0;

/** Update cached date strings if day has changed */
function updateCachedDates(): void {
  const now = Date.now();
  // Check every 60 seconds max
  if (now - lastDateCheck < 60000) return;

  const today = new Date();
  const todayStr = today.toDateString();

  if (cachedToday !== todayStr) {
    cachedToday = todayStr;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    cachedYesterday = yesterday.toDateString();
    // Clear date separator cache when day changes
    timeSeparatorCache.clear();
  }
  lastDateCheck = now;
}

/** Get date string for a date (CACHED) */
function getDateString(dateStr: string): string {
  const cached = dateStringCache.get(dateStr);
  if (cached !== undefined) return cached;

  const result = new Date(dateStr).toDateString();
  dateStringCache.set(dateStr, result);
  return result;
}

/** Format message timestamp (HH:MM) (CACHED) */
export function formatMessageTime(dateStr: string): string {
  const cached = messageTimeCache.get(dateStr);
  if (cached !== undefined) return cached;

  const date = new Date(dateStr);
  const result = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  messageTimeCache.set(dateStr, result);
  return result;
}

/** Format conversation time (DD.MM.YYYY HH:MM) (CACHED) */
export function formatConversationTime(dateStr: string): string {
  if (dateStr === '') return '';

  const cached = conversationTimeCache.get(dateStr);
  if (cached !== undefined) return cached;

  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  const result = `${day}.${month}.${year} ${hours}:${minutes}`;
  conversationTimeCache.set(dateStr, result);
  return result;
}

/** Format schedule time for display */
export function formatScheduleTime(date: Date): string {
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format date separator (Heute, Gestern, or full date) (CACHED) */
export function formatDateSeparator(dateStr: string): string {
  const cached = timeSeparatorCache.get(dateStr);
  if (cached !== undefined) return cached;

  updateCachedDates();

  const dateString = getDateString(dateStr);
  let result: string;

  if (dateString === cachedToday) {
    result = MESSAGES.dateToday;
  } else if (dateString === cachedYesterday) {
    result = MESSAGES.dateYesterday;
  } else {
    const date = new Date(dateStr);
    result = date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  timeSeparatorCache.set(dateStr, result);
  return result;
}

/**
 * Check if date separator should be shown between messages (OPTIMIZED)
 * Uses cached date strings instead of creating new Date objects
 */
export function shouldShowDateSeparator(prev: Message | undefined, current: Message): boolean {
  if (!prev) return true;

  const prevDate = getDateString(prev.createdAt);
  const currentDate = getDateString(current.createdAt);

  return prevDate !== currentDate;
}

// =============================================================================
// CONVERSATION HELPERS
// =============================================================================

/** Get display name for a conversation */
export function getConversationDisplayName(conv: Conversation, currentUserId: number): string {
  if (conv.name !== undefined && conv.name !== '') return conv.name;
  if (conv.isGroup) return MESSAGES.labelGroupConversation;

  const partner = conv.participants.find((p) => p.id !== currentUserId);
  if (!partner) return MESSAGES.labelConversation;

  const fullName = `${partner.firstName} ${partner.lastName}`.trim();
  return fullName !== '' ? fullName : partner.username;
}

/** Get avatar URL for a conversation */
export function getConversationAvatar(conv: Conversation, currentUserId: number): string | null {
  if (conv.isGroup) return null;

  const partner = conv.participants.find((p) => p.id !== currentUserId);
  return partner?.profileImageUrl ?? null;
}

/** Get chat partner from conversation */
export function getChatPartner(
  conv: Conversation | null,
  currentUserId: number,
): ConversationParticipant | null {
  if (!conv || conv.isGroup) return null;
  return conv.participants.find((p) => p.id !== currentUserId) ?? null;
}

/** Get chat partner name */
export function getChatPartnerName(
  partner: ConversationParticipant | null,
  conversationName?: string,
): string {
  if (!partner) return conversationName ?? MESSAGES.labelConversation;

  const fullName = `${partner.firstName} ${partner.lastName}`.trim();
  return fullName !== '' ? fullName : partner.username;
}

/** Get status label for display */
export function getStatusLabel(status: UserStatus): string {
  switch (status) {
    case 'online':
      return MESSAGES.statusOnline;
    case 'away':
      return MESSAGES.statusAway;
    default:
      return MESSAGES.statusOffline;
  }
}

/** Get role label for display */
export function getRoleLabel(role: string): string {
  switch (role) {
    case 'admin':
      return MESSAGES.roleAdmin;
    case 'root':
      return MESSAGES.roleRoot;
    default:
      return MESSAGES.roleEmployee;
  }
}

/** Get role badge class */
export function getRoleBadgeClass(role: string | null | undefined): string {
  switch (role) {
    case 'admin':
      return 'badge--warning';
    case 'root':
      return 'badge--danger';
    default:
      return 'badge--info';
  }
}

// =============================================================================
// MESSAGE HELPERS
// =============================================================================

/** Filter messages by search query */
export function filterMessagesByQuery(messages: Message[], query: string): Message[] {
  if (query.trim() === '') return messages;

  const queryLower = query.toLowerCase();
  return messages.filter((m) => {
    // E2E messages: search decryptedContent (not ciphertext)
    const searchable = m.isE2e === true ? (m.decryptedContent ?? null) : (m.content ?? null);
    return searchable?.toLowerCase().includes(queryLower) === true;
  });
}

/** Check if message content matches search query */
export function messageMatchesQuery(content: string, query: string): boolean {
  if (query.trim() === '') return false;
  return content.toLowerCase().includes(query.toLowerCase());
}

// =============================================================================
// SCHEDULE VALIDATION
// =============================================================================

/** Validate scheduled time against min/max future constraints */
export function validateScheduleTime(
  selectedDate: Date,
  minFutureMs: number,
  maxFutureMs: number,
): { isValid: boolean; error: string | null } {
  const now = new Date();
  const minTime = new Date(now.getTime() + minFutureMs);
  const maxTime = new Date(now.getTime() + maxFutureMs);

  if (selectedDate < minTime) {
    return { isValid: false, error: MESSAGES.warningMinFutureTime };
  }

  if (selectedDate > maxTime) {
    return { isValid: false, error: MESSAGES.warningMaxFutureTime };
  }

  return { isValid: true, error: null };
}

/** Get minimum schedule date/time (5 min from now) */
export function getMinScheduleDateTime(minFutureMs: number): {
  date: string;
  time: string;
} {
  const now = new Date();
  const minDate = new Date(now.getTime() + minFutureMs);

  return {
    date: minDate.toISOString().split('T')[0],
    time: minDate.toTimeString().slice(0, 5),
  };
}
