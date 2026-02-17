/**
 * Employee Dashboard - Utility Functions
 * @module employee-dashboard/_lib/utils
 */

import {
  ORG_LEVEL_TEXT,
  PLACEHOLDER_TEXT,
  PRIORITY_LABELS,
  BLACKBOARD_ORG_LABELS,
} from './constants';

import type { CalendarEvent, FormattedEventDate } from './types';

/** Get display name from user data */
export function getDisplayName(
  firstName?: string,
  lastName?: string,
  fallback = PLACEHOLDER_TEXT.employee,
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  return fullName !== '' ? fullName : fallback;
}

/** Get display value with fallback */
export function getDisplayValue(
  value?: string,
  fallback: string = PLACEHOLDER_TEXT.notAssigned,
): string {
  return value !== undefined && value !== '' ? value : fallback;
}

/** Format event date for display */
export function formatEventDate(event: CalendarEvent): FormattedEventDate {
  const startDate = new Date(event.startTime);
  const day = startDate.getDate().toString();
  const month = startDate.toLocaleDateString('de-DE', { month: 'short' });
  const isAllDay = event.allDay === true || event.allDay === 1;
  const time =
    isAllDay ? 'Ganztägig' : (
      startDate.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );

  return { day, month, time };
}

/** Get org level display text (German) */
export function getOrgLevelText(orgLevel?: string): string {
  if (orgLevel === undefined || orgLevel === '') return ORG_LEVEL_TEXT.personal;
  return ORG_LEVEL_TEXT[orgLevel] ?? ORG_LEVEL_TEXT.personal;
}

/** Get org level CSS class */
export function getOrgLevelClass(orgLevel?: string): string {
  return `event-level-${orgLevel ?? 'personal'}`;
}

/** Navigate to URL */
export function navigateTo(url: string): void {
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
}

/** Navigate to calendar */
export function goToCalendar(): void {
  navigateTo('/calendar');
}

/** Open blackboard entry by UUID */
export function openBlackboardEntry(uuid: string): void {
  navigateTo(`/blackboard/${uuid}`);
}

/** Get priority label (German) */
export function getPriorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] ?? PRIORITY_LABELS.medium;
}

/** Get blackboard org level label (German) */
export function getBlackboardOrgLabel(orgLevel: string): string {
  return BLACKBOARD_ORG_LABELS[orgLevel] ?? BLACKBOARD_ORG_LABELS.company;
}

/** Quill Delta ops type */
interface QuillDelta {
  ops?: { insert?: string }[];
}

/** Extract text from Quill Delta ops array */
function extractTextFromOps(delta: QuillDelta): string | null {
  if (delta.ops === undefined || !Array.isArray(delta.ops)) return null;
  return delta.ops
    .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
    .join('')
    .trim();
}

/** Try parsing content string as JSON Quill Delta, returns extracted text or original content */
function parseStringContent(content: string): string {
  try {
    const parsed = JSON.parse(content) as QuillDelta;
    return extractTextFromOps(parsed) ?? content;
  } catch {
    return content;
  }
}

/** Check if value is a stringifiable primitive */
function isStringifiablePrimitive(value: unknown): value is number | boolean {
  return typeof value === 'number' || typeof value === 'boolean';
}

/** Parse blackboard content from JSON or string */
export function parseContent(content: unknown): string {
  if (content === null || content === undefined) return '';

  if (typeof content === 'string') {
    return parseStringContent(content);
  }

  // Handle Quill Delta format directly (object with ops)
  if (typeof content === 'object' && 'ops' in content) {
    return extractTextFromOps(content as QuillDelta) ?? '';
  }

  // Handle primitives (number, boolean) - stringify safely
  if (isStringifiablePrimitive(content)) {
    return String(content);
  }

  // Unknown object type - return empty string (avoid '[object Object]')
  return '';
}

/** Truncate content for preview */
export function truncateContent(content: string, maxLength = 150): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + '...';
}

/** Format blackboard date for display */
export function formatBlackboardDate(
  dateStr: string | null | undefined,
): string {
  if (dateStr === null || dateStr === undefined || dateStr === '') return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Check if a date is expired (in the past) */
export function isExpired(dateStr: string | null | undefined): boolean {
  if (dateStr === null || dateStr === undefined || dateStr === '') return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

/** Check if event is all-day */
export function isAllDay(allDay: boolean | number): boolean {
  return allDay === true || allDay === 1;
}
