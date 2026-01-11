// =============================================================================
// SURVEY-ADMIN - UTILITY FUNCTIONS
// Based on: frontend/src/scripts/survey/admin/ui.ts
// =============================================================================

import { STATUS_TEXT_MAP, STATUS_BADGE_CLASS_MAP } from './constants';

import type { BufferData, QuestionType } from './types';

/**
 * Convert Buffer to string
 */
export function getTextFromBuffer(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  const bufferValue = value as BufferData | null | undefined;
  if (bufferValue?.type === 'Buffer' && Array.isArray(bufferValue.data)) {
    return new TextDecoder().decode(new Uint8Array(bufferValue.data));
  }
  const dataValue = value as { data?: string } | null | undefined;
  if (dataValue?.data !== undefined && typeof dataValue.data === 'string') {
    return dataValue.data;
  }
  return '';
}

/**
 * Get status display text
 */
export function getStatusText(status: string): string {
  const validStatuses = Object.keys(STATUS_TEXT_MAP);
  if (validStatuses.includes(status)) {
    return STATUS_TEXT_MAP[status] ?? status;
  }
  return status;
}

/**
 * Get status badge class
 */
export function getStatusBadgeClass(status: string): string {
  const validStatuses = Object.keys(STATUS_BADGE_CLASS_MAP);
  if (validStatuses.includes(status)) {
    return STATUS_BADGE_CLASS_MAP[status] ?? 'badge--secondary';
  }
  return 'badge--secondary';
}

/**
 * Convert value to boolean
 */
export function toBool(value: unknown): boolean {
  return value === '1' || value === 1 || value === true;
}

/**
 * Format date for display
 */
export function formatSurveyDate(dateStr: string | Date | undefined): string {
  if (dateStr === undefined || dateStr === '') return '';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`;
}

/**
 * Format date for input field (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format time for input field (HH:MM)
 */
export function formatTimeForInput(date: Date): string {
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get question type label
 */
export function getQuestionTypeLabel(type: QuestionType): string {
  const typeLabels: Record<QuestionType, string> = {
    text: 'Textantwort',
    single_choice: 'Einzelauswahl',
    multiple_choice: 'Mehrfachauswahl',
    rating: 'Bewertung (1-5)',
    yes_no: 'Ja/Nein',
    number: 'Zahl',
    date: 'Datum',
  };

  return typeLabels[type];
}

/**
 * Check if question type needs options
 */
export function questionTypeNeedsOptions(type: QuestionType): boolean {
  return type === 'single_choice' || type === 'multiple_choice';
}

/**
 * Calculate response rate
 */
export function calculateResponseRate(responseCount: number, completedCount: number): number {
  if (responseCount === 0) return 0;
  return Math.round((completedCount / responseCount) * 100);
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get department member count
 */
export function getDepartmentMemberCount(dept: {
  memberCount?: number;
  employeeCount?: number;
}): number {
  return dept.employeeCount ?? dept.memberCount ?? 0;
}

/**
 * Get team member count
 */
export function getTeamMemberCount(team: { memberCount?: number }): number {
  return team.memberCount ?? 0;
}

/**
 * Validate date range (end must be after start)
 */
export function validateDateRange(startDate: string, endDate: string): boolean {
  if (startDate === '' || endDate === '') return true;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return end > start;
}

/**
 * Validate end date is in future
 */
export function validateEndDateInFuture(endDate: string): boolean {
  if (endDate === '') return true;
  const end = new Date(endDate);
  return end > new Date();
}
