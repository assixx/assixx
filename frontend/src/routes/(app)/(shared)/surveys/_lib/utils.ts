// =============================================================================
// SURVEY-EMPLOYEE - UTILITY FUNCTIONS
// Based on: frontend/src/scripts/survey/employee/ui.ts
// =============================================================================

import { STATUS_TEXT_MAP, STATUS_BADGE_CLASS_MAP, ASSIGNMENT_BADGE_MAP } from './constants';

import type {
  AssignmentType,
  BufferData,
  Question,
  AnswerMap,
  Answer,
  ResponseAnswer,
  SurveyAssignment,
} from './types';

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
 * Handles multiple formats: 1, true, '1', 0, false, '0'
 */
export function toBool(value: unknown): boolean {
  return value === '1' || value === 1 || value === true;
}

/**
 * Check if a question is required
 */
export function isQuestionRequired(required: boolean | number | string | undefined): boolean {
  if (required === undefined) return false;
  if (typeof required === 'boolean') return required;
  if (typeof required === 'number') return required !== 0;
  if (typeof required === 'string') return required !== '0' && required !== '';
  return false;
}

/**
 * Format date for display (German format DD.MM.YYYY)
 */
export function formatSurveyDate(dateStr: string | Date | null | undefined): string {
  if (dateStr === null || dateStr === undefined || dateStr === '') return '';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`;
}

/**
 * Format date with time for display (German format DD.MM.YYYY HH:mm)
 */
export function formatDateTimeGerman(dateStr: string | Date): string {
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
 * Convert date string from HTML5 input (YYYY-MM-DD) to ISO 8601 format
 * Backend Zod schema requires full ISO 8601 timestamp
 */
export function convertDateToISO(dateString: string): string {
  // If already in ISO format with time, return as-is
  if (dateString.includes('T')) {
    return dateString;
  }

  // HTML5 date input returns YYYY-MM-DD, append time
  return `${dateString}T00:00:00`;
}

/**
 * Convert answers map to array format for API submission
 */
export function convertAnswersToArray(answerMap: AnswerMap): Answer[] {
  const result: Answer[] = [];

  for (const questionId in answerMap) {
    const answer = answerMap[Number(questionId)];
    if (answer === undefined) continue;

    if (answer.selectedOptions !== undefined) {
      // Multiple choice
      result.push({
        questionId: Number(questionId),
        answerOptions: answer.selectedOptions,
      });
    } else if (answer.answerOptions !== undefined) {
      // Single choice
      result.push({
        questionId: Number(questionId),
        answerOptions: answer.answerOptions,
      });
    } else {
      // Other answer types (text, number, date)
      result.push({
        ...answer,
        questionId: Number(questionId),
      });
    }
  }

  return result;
}

/**
 * Validate all required questions are answered
 */
export function validateRequiredQuestions(
  questions: Question[],
  answers: AnswerMap,
): { valid: boolean; missing: string[] } {
  const unansweredRequired: string[] = [];

  questions.forEach((question, index) => {
    if (isQuestionRequired(question.isRequired) && !(question.id in answers)) {
      unansweredRequired.push(`Frage ${index + 1}`);
    }
  });

  return {
    valid: unansweredRequired.length === 0,
    missing: unansweredRequired,
  };
}

/**
 * Structured assignment badge info (mirrors KVP visibility badges)
 */
export interface AssignmentBadgeInfo {
  badgeClass: string;
  icon: string;
  text: string;
}

/**
 * Resolve the display name for an assignment badge.
 * Uses inline names (teamName, departmentName, areaName) when available.
 */
function resolveAssignmentText(
  assignmentType: AssignmentType,
  assignment: SurveyAssignment,
  defaultLabel: string,
): string {
  if (assignmentType === 'team' && assignment.teamName !== undefined) {
    return assignment.teamName;
  }
  if (assignmentType === 'department' && assignment.departmentName !== undefined) {
    return assignment.departmentName;
  }
  if (assignmentType === 'area' && assignment.areaName !== undefined) {
    return assignment.areaName;
  }
  return defaultLabel;
}

/**
 * Build assignment badges from survey assignments.
 * Uses inline names from backend (areaName, departmentName, teamName).
 */
export function getAssignmentBadges(
  assignments: SurveyAssignment[] | undefined,
): AssignmentBadgeInfo[] {
  if (assignments === undefined || assignments.length === 0) return [];

  const badges: AssignmentBadgeInfo[] = [];
  for (const assignment of assignments) {
    const assignmentType: AssignmentType | undefined = assignment.assignmentType ?? assignment.type;
    if (assignmentType === undefined) continue;

    const badgeMeta = ASSIGNMENT_BADGE_MAP[assignmentType];
    if (badgeMeta === undefined) continue;

    const text: string = resolveAssignmentText(assignmentType, assignment, badgeMeta.label);
    badges.push({
      badgeClass: badgeMeta.badgeClass,
      icon: badgeMeta.icon,
      text,
    });
  }
  return badges;
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
 * Discriminated result of {@link classifyAnswerDisplay}.
 * Each variant carries only the fields the template needs, so the Svelte
 * markup never has to re-check for null/undefined.
 */
export type AnswerDisplay =
  | { kind: 'text'; text: string }
  | { kind: 'rating'; value: number }
  | { kind: 'number'; value: number }
  | { kind: 'date'; date: string }
  | { kind: 'options'; options: string[] }
  | { kind: 'empty' };

/**
 * Decide how a completed survey answer should render.
 *
 * WHY: the API returns JSON `null` (not `undefined`) for empty answer_*
 * columns — the DB columns are nullable. The previous inline template check
 * `answer.answerText !== undefined` matched `null` and produced an empty <p>
 * for yes_no / choice answers. `typeof` narrowing excludes null AND
 * undefined in one step, and the discriminated return keeps the template
 * null-safe without extra guards.
 */
export function classifyAnswerDisplay(answer: ResponseAnswer): AnswerDisplay {
  if (typeof answer.answerText === 'string' && answer.answerText !== '') {
    return { kind: 'text', text: answer.answerText };
  }
  if (typeof answer.answerNumber === 'number') {
    return answer.questionType === 'rating' ?
        { kind: 'rating', value: answer.answerNumber }
      : { kind: 'number', value: answer.answerNumber };
  }
  if (typeof answer.answerDate === 'string' && answer.answerDate !== '') {
    return { kind: 'date', date: answer.answerDate };
  }
  if (Array.isArray(answer.answerOptions) && answer.answerOptions.length > 0) {
    return { kind: 'options', options: answer.answerOptions };
  }
  return { kind: 'empty' };
}
