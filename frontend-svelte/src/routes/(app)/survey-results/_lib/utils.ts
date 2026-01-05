// =============================================================================
// SURVEY-RESULTS - UTILITY FUNCTIONS
// Based on: frontend/src/scripts/survey/results/ui.ts
// =============================================================================

import { QUESTION_TYPE_LABELS, STATUS_TEXT_MAP } from './constants';
import type { Survey, SurveyQuestion, SurveyResponse, ResponseAnswer } from './types';

/**
 * Format ISO date string to German format (DD.MM.YYYY HH:MM)
 */
export function formatGermanDate(isoDate: string | null | undefined): string {
  if (isoDate === '' || isoDate === null || isoDate === undefined) return 'N/A';

  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Format date for display (without time)
 */
export function formatDate(dateString: string | null | undefined): string {
  if (dateString === '' || dateString === null || dateString === undefined) return 'N/A';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Check if survey is anonymous
 */
export function isAnonymousSurvey(survey: Survey): boolean {
  const isAnon = survey.isAnonymous;
  return isAnon === '1' || isAnon === 1 || isAnon === true;
}

/**
 * Render star rating
 */
export function renderStars(rating: number, maxRating: number = 5): string {
  let stars = '';
  for (let i = 1; i <= maxRating; i++) {
    stars += i <= rating ? '\u2605' : '\u2606'; // filled star : empty star
  }
  return stars;
}

/**
 * Get question type label
 */
export function getQuestionTypeLabel(type: string): string {
  const validTypes = Object.keys(QUESTION_TYPE_LABELS);
  if (validTypes.includes(type)) {
    return QUESTION_TYPE_LABELS[type] ?? type;
  }
  return type;
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
 * Get respondent name
 */
export function getRespondentName(response: SurveyResponse, index: number): string {
  const firstName = response.firstName ?? '';
  const lastName = response.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName !== '') return fullName;
  if (response.username !== undefined && response.username !== '') return response.username;
  return `Teilnehmer #${index + 1}`;
}

/**
 * Get completed date from response
 */
export function getCompletedDate(response: SurveyResponse): string {
  const dateValue = response.completedAt;
  if (dateValue !== undefined && dateValue !== '') {
    return formatGermanDate(dateValue);
  }
  return 'In Bearbeitung';
}

/**
 * Get option texts from option IDs
 */
export function getOptionTexts(question: SurveyQuestion, optionIds: number[]): string {
  if (!question.options || question.options.length === 0) {
    return `Option-IDs: ${optionIds.join(', ')}`;
  }

  const texts = optionIds
    .map((id) => {
      const option = question.options?.find((opt) => opt.optionId === id);
      return option?.optionText ?? `ID ${id}`;
    })
    .filter((text) => text !== '');

  return texts.length > 0 ? texts.join(', ') : 'Keine Optionen';
}

/**
 * Get answer display text
 */
export function getAnswerDisplayText(
  question: SurveyQuestion,
  answer: ResponseAnswer | undefined,
): string {
  if (answer === undefined) {
    return 'Keine Antwort';
  }

  // Check answerOptions BEFORE answerDate to prevent option IDs being formatted as dates
  if (answer.answerText !== undefined && answer.answerText !== null) {
    return answer.answerText;
  }

  if (answer.answerNumber !== undefined && answer.answerNumber !== null) {
    return String(answer.answerNumber);
  }

  if (
    answer.answerOptions !== undefined &&
    answer.answerOptions !== null &&
    answer.answerOptions.length > 0
  ) {
    return getOptionTexts(question, answer.answerOptions);
  }

  if (answer.answerDate !== undefined && answer.answerDate !== null) {
    return formatGermanDate(answer.answerDate);
  }

  return 'Keine Antwort';
}

/**
 * Calculate total responses for choice questions
 */
export function calculateTotalResponses(question: SurveyQuestion): number {
  if (!question.options || question.options.length === 0) {
    return 0;
  }
  return question.options.reduce((sum, opt) => sum + (opt.count ?? 0), 0);
}

/**
 * Calculate percentage for choice option
 */
export function calculateOptionPercentage(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}
