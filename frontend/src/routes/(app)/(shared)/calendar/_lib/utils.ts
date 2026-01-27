// =============================================================================
// CALENDAR - UTILITY FUNCTIONS
// =============================================================================

import { EVENT_LEVEL_INFO } from './constants';

import type { CalendarEvent, OrgLevel, User, EventLevelInfo } from './types';

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string | null | undefined): string {
  if (text === null || text === undefined || text === '') return '';
  return text.replace(/["&'<>]/g, (m) => {
    switch (m) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#039;';
      default:
        return m;
    }
  });
}

/**
 * Get event level info for UI display
 */
export function getEventLevelInfo(
  orgLevel: OrgLevel | undefined,
): EventLevelInfo {
  if (orgLevel === undefined) {
    return EVENT_LEVEL_INFO.personal;
  }
  return EVENT_LEVEL_INFO[orgLevel];
}

/**
 * Get event level text for display
 */
export function getEventLevelText(event: CalendarEvent): string {
  switch (event.orgLevel) {
    case 'company':
      return 'Firmentermin';
    case 'department':
      return `Abteilungstermin${event.departmentName !== undefined ? `: ${event.departmentName}` : ''}`;
    case 'team':
      return `Teamtermin${event.teamName !== undefined ? `: ${event.teamName}` : ''}`;
    case 'area':
      return 'Bereichstermin';
    default:
      return 'Persoenlicher Termin';
  }
}

/**
 * Get user display name
 */
export function getUserDisplayName(user: User | undefined): string {
  if (user === undefined) return 'Unbekannt';

  const firstName = user.firstName ?? '';
  const lastName = user.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName !== '') return fullName;
  if (user.username !== '') return user.username;
  return user.email;
}

/**
 * Format date for display
 */
export function formatDate(
  dateStr: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(dateStr);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return date.toLocaleDateString('de-DE', options ?? defaultOptions);
}

/**
 * Format time for display
 */
export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format datetime for display
 */
export function formatDateTime(dateStr: string, allDay: boolean): string {
  const dateFormatted = formatDate(dateStr);
  if (allDay) return dateFormatted;
  const timeFormatted = formatTime(dateStr);
  return `${dateFormatted} um ${timeFormatted}`;
}

/**
 * Format Date to datetime-local input format (YYYY-MM-DDTHH:MM)
 */
export function formatDatetimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get response status text in German
 */
export function getResponseText(response: string): string {
  switch (response) {
    case 'accepted':
      return 'Zugesagt';
    case 'declined':
      return 'Abgesagt';
    case 'tentative':
      return 'Vielleicht';
    default:
      return 'Ausstehend';
  }
}

/**
 * Get response status icon class
 */
export function getResponseIconClass(response: string): string {
  switch (response) {
    case 'accepted':
      return 'fa-check-circle text-green-500';
    case 'declined':
      return 'fa-times-circle text-red-500';
    case 'tentative':
      return 'fa-question-circle text-yellow-500';
    default:
      return 'fa-clock text-gray-500';
  }
}

/**
 * Check if event is all day
 */
export function isAllDayEvent(event: CalendarEvent): boolean {
  return event.allDay;
}

/**
 * Get time string for upcoming events display
 */
export function getUpcomingEventTimeStr(event: CalendarEvent): string {
  if (isAllDayEvent(event)) return 'Ganztaegig';
  return `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`;
}

/**
 * Format relative time (e.g., "vor 2 Stunden", "vor 3 Tagen")
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `vor ${diffMins} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  if (diffDays < 30) return `vor ${Math.floor(diffDays / 7)} Wochen`;

  // Fallback to date
  return formatDate(dateStr, { day: 'numeric', month: 'short' });
}
