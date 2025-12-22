/**
 * Admin Dashboard - Utility Functions
 * @module admin-dashboard/_lib/utils
 */

import type { User, Priority, OrgLevel, BlackboardOrgLevel, FormattedEventDate } from './types';
import { ORG_LEVEL_LABELS, BLACKBOARD_ORG_LABELS, PRIORITY_LABELS } from './constants';

/**
 * Get display name for employee
 * @param user - User object
 */
export function getEmployeeName(user: User): string {
  const firstName = user.firstName ?? '';
  const lastName = user.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName !== '' ? fullName : user.email;
}

/**
 * Get org level text in German
 * @param orgLevel - Organization level
 */
export function getOrgLevelText(orgLevel: string): string {
  return ORG_LEVEL_LABELS[orgLevel as OrgLevel] ?? 'Persönlich';
}

/**
 * Get org level CSS class
 * @param orgLevel - Organization level
 */
export function getOrgLevelClass(orgLevel: string): string {
  return `event-level-${orgLevel ?? 'personal'}`;
}

/**
 * Get priority label in German
 * @param priority - Priority level
 */
export function getPriorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority] ?? 'Normal';
}

/**
 * Get blackboard org level label
 * @param orgLevel - Blackboard organization level
 */
export function getBlackboardOrgLabel(orgLevel: BlackboardOrgLevel): string {
  return BLACKBOARD_ORG_LABELS[orgLevel] ?? 'Firma';
}

/**
 * Format blackboard date (German locale with time)
 * @param dateStr - ISO date string
 */
export function formatBlackboardDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Parse content text (handles Buffer objects from API)
 * @param contentText - Content which may be string or Buffer object
 */
export function parseContent(contentText: unknown): string {
  if (typeof contentText !== 'object' || contentText === null) {
    return String(contentText ?? '');
  }
  // Handle Buffer object from API
  if (
    typeof contentText === 'object' &&
    'type' in contentText &&
    (contentText as { type: string }).type === 'Buffer' &&
    'data' in contentText &&
    Array.isArray((contentText as { data: number[] }).data)
  ) {
    return String.fromCharCode(...(contentText as { data: number[] }).data);
  }
  return JSON.stringify(contentText);
}

/**
 * Truncate content text
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default 150)
 */
export function truncateContent(text: string, maxLength = 150): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Format event date for display
 * @param dateStr - ISO date string
 */
export function formatEventDate(dateStr: string): FormattedEventDate {
  const date = new Date(dateStr);
  return {
    day: date.getDate().toString(),
    month: date.toLocaleDateString('de-DE', { month: 'short' }),
    time: date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  };
}

/**
 * Check if event is all day
 * @param allDay - All day flag (boolean or number)
 */
export function isAllDay(allDay: boolean | number): boolean {
  return allDay === true || allDay === 1;
}

/**
 * Navigate to blackboard entry detail
 * @param uuid - Entry UUID
 */
export function openBlackboardEntry(uuid: string): void {
  window.location.href = `/blackboard/${uuid}`;
}

/**
 * Navigate to URL (for legacy routes not yet in SvelteKit)
 * @param url - Target URL
 */
export function navigateTo(url: string): void {
  window.location.href = url;
}

/**
 * Navigate to calendar page
 */
export function goToCalendar(): void {
  window.location.href = '/calendar';
}
