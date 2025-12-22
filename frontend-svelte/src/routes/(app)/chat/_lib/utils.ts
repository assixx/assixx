// =============================================================================
// CHAT PAGE - UTILITY FUNCTIONS (Pure Functions)
// =============================================================================

import type { Conversation, Message, ConversationParticipant, UserStatus } from './types';
import { FILE_SIZE_UNITS, MIME_TYPE_ICONS, MESSAGES } from './constants';

// =============================================================================
// FILE HANDLING
// =============================================================================

/**
 * Format file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));

  return `${size} ${FILE_SIZE_UNITS[i]}`;
}

/**
 * Get Font Awesome icon class for a MIME type
 * @param mimeType - File MIME type
 * @returns Font Awesome icon class
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return MIME_TYPE_ICONS.image;
  if (mimeType.startsWith('video/')) return MIME_TYPE_ICONS.video;
  if (mimeType.startsWith('audio/')) return MIME_TYPE_ICONS.audio;
  if (mimeType.includes('pdf')) return MIME_TYPE_ICONS.pdf;
  if (mimeType.includes('word') || mimeType.includes('document')) return MIME_TYPE_ICONS.word;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return MIME_TYPE_ICONS.excel;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) {
    return MIME_TYPE_ICONS.archive;
  }
  return MIME_TYPE_ICONS.default;
}

/**
 * Check if a file is an image based on MIME type
 * @param file - File object
 * @returns true if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

// =============================================================================
// TEXT FORMATTING
// =============================================================================

/**
 * Convert URLs in text to clickable links
 * @param text - Text containing URLs
 * @returns HTML string with anchor tags
 */
export function linkify(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(
    urlRegex,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  );
}

/**
 * Highlight search term in text
 * @param text - Text to search in
 * @param searchTerm - Term to highlight
 * @returns HTML string with highlighted matches
 */
export function highlightSearchTerm(text: string, searchTerm: string): string {
  if (!searchTerm.trim()) return text;

  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');

  return text.replace(regex, '<strong>$1</strong>');
}

/**
 * Highlight search term with mark tag (for message search)
 * @param text - Text to search in
 * @param searchTerm - Term to highlight
 * @returns HTML string with <mark> tags
 */
export function highlightSearchInMessage(text: string, searchTerm: string): string {
  if (!searchTerm.trim()) return text;

  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');

  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// =============================================================================
// DATE/TIME FORMATTING
// =============================================================================

/**
 * Format message timestamp (HH:MM)
 * @param dateStr - ISO date string
 * @returns Formatted time string
 */
export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format conversation time (DD.MM.YYYY HH:MM)
 * @param dateStr - ISO date string
 * @returns Formatted date/time string
 */
export function formatConversationTime(dateStr: string): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Format schedule time for display
 * @param date - Date object
 * @returns Localized date/time string
 */
export function formatScheduleTime(date: Date): string {
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date separator (Heute, Gestern, or full date)
 * @param dateStr - ISO date string
 * @returns Localized date string
 */
export function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return MESSAGES.dateToday;
  } else if (date.toDateString() === yesterday.toDateString()) {
    return MESSAGES.dateYesterday;
  } else {
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}

/**
 * Check if date separator should be shown between messages
 * @param prev - Previous message (or undefined)
 * @param current - Current message
 * @returns true if dates differ
 */
export function shouldShowDateSeparator(prev: Message | undefined, current: Message): boolean {
  if (!prev) return true;

  const prevDate = new Date(prev.createdAt).toDateString();
  const currentDate = new Date(current.createdAt).toDateString();

  return prevDate !== currentDate;
}

// =============================================================================
// CONVERSATION HELPERS
// =============================================================================

/**
 * Get display name for a conversation
 * @param conv - Conversation object
 * @param currentUserId - Current user's ID
 * @returns Display name string
 */
export function getConversationDisplayName(conv: Conversation, currentUserId: number): string {
  if (conv.name) return conv.name;
  if (conv.isGroup) return MESSAGES.labelGroupConversation;

  const partner = conv.participants.find((p) => p.id !== currentUserId);
  if (!partner) return MESSAGES.labelConversation;

  const fullName = `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim();
  return fullName || partner.username;
}

/**
 * Get avatar URL for a conversation
 * @param conv - Conversation object
 * @param currentUserId - Current user's ID
 * @returns Avatar URL or null
 */
export function getConversationAvatar(conv: Conversation, currentUserId: number): string | null {
  if (conv.isGroup) return null;

  const partner = conv.participants.find((p) => p.id !== currentUserId);
  return partner?.profileImageUrl ?? null;
}

/**
 * Get chat partner from conversation
 * @param conv - Conversation object
 * @param currentUserId - Current user's ID
 * @returns Partner participant or null
 */
export function getChatPartner(
  conv: Conversation | null,
  currentUserId: number,
): ConversationParticipant | null {
  if (!conv || conv.isGroup) return null;
  return conv.participants.find((p) => p.id !== currentUserId) ?? null;
}

/**
 * Get chat partner name
 * @param partner - Partner participant
 * @param conversationName - Optional conversation name
 * @returns Display name
 */
export function getChatPartnerName(
  partner: ConversationParticipant | null,
  conversationName?: string,
): string {
  if (!partner) return conversationName ?? MESSAGES.labelConversation;

  const fullName = `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim();
  return fullName || partner.username;
}

/**
 * Get status label for display
 * @param status - User status
 * @returns Localized status string
 */
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

/**
 * Get role label for display
 * @param role - User role
 * @returns Localized role string
 */
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

/**
 * Get role badge class
 * @param role - User role
 * @returns CSS class for badge
 */
export function getRoleBadgeClass(role: string): string {
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

/**
 * Filter messages by search query
 * @param messages - Messages array
 * @param query - Search query
 * @returns Filtered messages
 */
export function filterMessagesByQuery(messages: Message[], query: string): Message[] {
  if (!query.trim()) return messages;

  const queryLower = query.toLowerCase();
  return messages.filter((m) => m.content.toLowerCase().includes(queryLower));
}

/**
 * Check if message content matches search query
 * @param content - Message content
 * @param query - Search query
 * @returns true if matches
 */
export function messageMatchesQuery(content: string, query: string): boolean {
  if (!query.trim()) return false;
  return content.toLowerCase().includes(query.toLowerCase());
}

// =============================================================================
// SCHEDULE VALIDATION
// =============================================================================

/**
 * Validate scheduled time
 * @param selectedDate - Selected Date object
 * @param minFutureMs - Minimum future time in ms
 * @param maxFutureMs - Maximum future time in ms
 * @returns Object with isValid and error message
 */
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

/**
 * Get minimum schedule date/time (5 min from now)
 * @param minFutureMs - Minimum future time in ms
 * @returns Object with date and time strings
 */
export function getMinScheduleDateTime(minFutureMs: number): { date: string; time: string } {
  const now = new Date();
  const minDate = new Date(now.getTime() + minFutureMs);

  return {
    date: minDate.toISOString().split('T')[0],
    time: minDate.toTimeString().slice(0, 5),
  };
}
