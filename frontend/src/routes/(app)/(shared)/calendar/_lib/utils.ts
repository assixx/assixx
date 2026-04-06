// =============================================================================
// CALENDAR - UTILITY FUNCTIONS
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

import { EVENT_LEVEL_INFO } from './constants';

import type { CalendarEvent, OrgLevel, EventLevelInfo } from './types';

/**
 * Get event level info for UI display
 */
export function getEventLevelInfo(orgLevel: OrgLevel | undefined): EventLevelInfo {
  if (orgLevel === undefined) {
    return EVENT_LEVEL_INFO.personal;
  }
  return EVENT_LEVEL_INFO[orgLevel];
}

/**
 * Get event level text for display.
 * Uses dynamic hierarchy labels for department/team/area terms.
 */
export function getEventLevelText(
  event: CalendarEvent,
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): string {
  switch (event.orgLevel) {
    case 'company':
      return 'Firmentermin';
    case 'department':
      return `${labels.department}-Termin${event.departmentName !== undefined ? `: ${event.departmentName}` : ''}`;
    case 'team':
      return `${labels.team}-Termin${event.teamName !== undefined ? `: ${event.teamName}` : ''}`;
    case 'area':
      return `${labels.area}-Termin`;
    default:
      return 'Persönlicher Termin';
  }
}

/**
 * Format date for display
 */
function formatDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
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
function formatTime(dateStr: string): string {
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
function isAllDayEvent(event: CalendarEvent): boolean {
  return event.allDay;
}

/**
 * Get time string for upcoming events display
 */
export function getUpcomingEventTimeStr(event: CalendarEvent): string {
  if (isAllDayEvent(event)) return 'Ganztaegig';
  return `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`;
}
