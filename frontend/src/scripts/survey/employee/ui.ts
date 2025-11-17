/**
 * Survey Employee - UI Layer
 * Handles all DOM manipulation and display logic
 */

import { setHTML } from '../../../utils/dom-utils.js';
import type { Survey, BufferData, SurveyResponse } from './types';
import { checkUserResponse } from './data';

/**
 * Convert Buffer or string to readable text
 */
export function getQuestionText(questionText: string | BufferData | null | undefined): string {
  if (typeof questionText === 'string') {
    return questionText;
  }

  // Handle Buffer object
  if (
    questionText != null &&
    typeof questionText === 'object' &&
    'type' in questionText &&
    'data' in questionText &&
    Array.isArray(questionText.data)
  ) {
    // Convert array of byte values to string
    return String.fromCharCode(...questionText.data);
  }

  // Handle other object types
  if (questionText != null && typeof questionText === 'object') {
    return JSON.stringify(questionText);
  }

  return 'Frage';
}

/**
 * Helper: Get status badge class
 */
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'badge--success';
    case 'closed':
      return 'badge--secondary';
    default:
      return 'badge--secondary';
  }
}

/**
 * Helper: Get status text
 */
function getStatusText(status: string): string {
  switch (status) {
    case 'active':
      return 'Aktiv';
    case 'closed':
      return 'Geschlossen';
    default:
      return status;
  }
}

/**
 * Helper: Format survey date
 */
function formatSurveyDate(date: string | Date | null | undefined): string {
  if (date == null) return '';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Helper: Create survey properties badges (anonymous, mandatory)
 * Always shows both badges with different colors based on state
 */
function createSurveyPropertiesBadges(survey: Survey): string {
  const badges: string[] = [];

  // Anonymous badge - ALWAYS show
  const isAnon = survey.is_anonymous === true || survey.is_anonymous === 1 || survey.is_anonymous === '1';
  badges.push(`
    <span class="badge badge--sm ${isAnon ? 'badge--info' : 'badge--secondary'}">
      <i class="fas ${isAnon ? 'fa-user-secret' : 'fa-user'}"></i>
      ${isAnon ? 'Anonym' : 'Nicht anonym'}
    </span>
  `);

  // Mandatory badge - ALWAYS show
  const isMand = survey.is_mandatory === true || survey.is_mandatory === 1 || survey.is_mandatory === '1';
  badges.push(`
    <span class="badge badge--sm ${isMand ? 'badge--warning' : 'badge--success'}">
      <i class="fas ${isMand ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
      ${isMand ? 'Verpflichtend' : 'Freiwillig'}
    </span>
  `);

  return `<div class="mb-4 flex items-center gap-2 flex-wrap">${badges.join('')}</div>`;
}

/**
 * Helper: Get assignment info as readable string
 * Note: Employee surveys typically don't have detailed assignment info in the response
 * This returns "Alle Mitarbeiter" as default since employees only see surveys assigned to them
 */
function getAssignmentInfo(): string {
  return 'Alle Mitarbeiter';
}

/**
 * Helper: Create date range HTML
 */
function createDateRangeHtml(survey: Survey): string {
  const startDate = formatSurveyDate(survey.start_date);
  const endDate = formatSurveyDate(survey.end_date);
  const dateRange = startDate !== '' && endDate !== '' ? `${startDate} - ${endDate}` : '';

  return dateRange !== ''
    ? `
      <div class="mb-4 text-sm text-secondary flex items-center gap-2">
        <i class="fas fa-calendar-alt"></i>
        <span>${dateRange}</span>
      </div>
      `
    : '';
}

/**
 * Helper: Create assignment info HTML
 */
function createAssignmentInfoHtml(): string {
  const assignmentInfo = getAssignmentInfo();
  return assignmentInfo !== ''
    ? `
      <div class="mb-4 text-sm text-secondary flex items-center gap-2">
        <i class="fas fa-users-cog"></i>
        <span>${assignmentInfo}</span>
      </div>
      `
    : '';
}

/**
 * Helper: Create action button HTML
 */
function createActionButtonHtml(completed: boolean): string {
  return `
    <div class="survey-actions">
      <button class="btn btn-upload" ${completed ? 'disabled' : ''}>
        <i class="fas ${completed ? 'fa-check' : 'fa-arrow-right'}"></i>
        ${completed ? 'Abgeschlossen' : 'Teilnehmen'}
      </button>
    </div>
  `;
}

/**
 * Create survey card element
 * Uses same structure as survey-admin for consistency
 */
export function createSurveyCard(survey: Survey, completed: boolean): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card card--clickable';
  card.dataset.surveyId = String(survey.id);
  card.dataset.action = completed ? 'view-response' : 'start-survey';

  const badgeClass = getStatusBadgeClass(survey.status);

  const cardHtml = `
    <div class="flex justify-between items-start mb-4">
      <h3 class="text-xl font-semibold text-primary m-0">${getQuestionText(survey.title)}</h3>
      <span class="badge ${badgeClass} badge--uppercase">${getStatusText(survey.status)}</span>
    </div>
    ${createSurveyPropertiesBadges(survey)}
    <p class="mb-4 text-sm leading-relaxed text-secondary">${getQuestionText(survey.description) !== '' ? getQuestionText(survey.description) : 'Keine Beschreibung'}</p>
    ${createDateRangeHtml(survey)}
    ${createAssignmentInfoHtml()}
    ${createActionButtonHtml(completed)}
  `;

  setHTML(card, cardHtml);
  return card;
}

/**
 * Display surveys in pending/completed containers
 */
export async function displaySurveys(surveys: Survey[]): Promise<void> {
  const pendingContainer = document.getElementById('pendingSurveys');
  const completedContainer = document.getElementById('completedSurveys');

  if (pendingContainer === null || completedContainer === null) {
    console.error('[SurveyEmployee] Survey containers not found');
    return;
  }

  pendingContainer.innerHTML = '';
  completedContainer.innerHTML = '';

  console.info('[SurveyEmployee] Displaying surveys:', surveys.length);

  for (const survey of surveys) {
    const responseCheck = await checkUserResponse(survey.id);
    console.info(`[SurveyEmployee] Survey ${survey.id} - Response check:`, responseCheck);

    if (responseCheck.responded) {
      completedContainer.append(createSurveyCard(survey, true));
    } else {
      pendingContainer.append(createSurveyCard(survey, false));
    }
  }

  // Show empty states if needed
  if (pendingContainer.innerHTML === '') {
    pendingContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">
          <i class="fas fa-clipboard-list"></i>
        </div>
        <h3 class="empty-state__title">Keine offenen Umfragen</h3>
        <p class="empty-state__description">Aktuell gibt es keine Umfragen, an denen Sie teilnehmen können.</p>
      </div>
    `;
  }

  if (completedContainer.innerHTML === '') {
    completedContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <h3 class="empty-state__title">Keine abgeschlossenen Umfragen</h3>
        <p class="empty-state__description">Sie haben noch an keinen Umfragen teilgenommen.</p>
      </div>
    `;
  }
}

/**
 * Show survey modal
 */
export function showModal(): void {
  const modal = document.getElementById('surveyModal');
  if (modal !== null) {
    modal.classList.add('modal-overlay--active');
  }
}

/**
 * Close survey modal
 */
export function closeModal(): void {
  const modal = document.getElementById('surveyModal');
  if (modal !== null) {
    modal.classList.remove('modal-overlay--active');
  }
}

/**
 * Helper: Format answer value for display
 */
function formatAnswerValue(answer: {
  answer_text?: string | null;
  answer_number?: number | null;
  answer_options?: string[] | null;
}): string {
  if (answer.answer_text != null) {
    return `<p>${answer.answer_text}</p>`;
  }
  if (answer.answer_number != null) {
    return `<p>Bewertung: ${answer.answer_number}</p>`;
  }
  if (answer.answer_options != null) {
    return answer.answer_options.map((option) => `<p><i class="fas fa-check-square"></i> ${option}</p>`).join('');
  }
  return '<p><em>Keine Antwort</em></p>';
}

/**
 * Helper: Create answers HTML
 */
function createAnswersHtml(answers: SurveyResponse['answers']): string {
  return answers
    .map(
      (answer) => `
    <div class="response-question">
      <h4>${answer.question_text}</h4>
      <div class="response-answer">
        ${formatAnswerValue(answer)}
      </div>
    </div>
  `,
    )
    .join('');
}

/**
 * Show response modal for completed surveys
 */
export function showResponseModal(survey: Survey, response: SurveyResponse): void {
  console.info('[SurveyEmployee] Showing response modal with:', { survey, response });

  const answersHtml = createAnswersHtml(response.answers);
  const completedDate = new Date(response.completed_at).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const modalHtml = `
    <div id="responseModal" class="modal-overlay modal-overlay--active">
      <div class="ds-modal ds-modal--lg">
        <div class="ds-modal__header">
          <h3 class="ds-modal__title">Ihre Antworten - ${getQuestionText(survey.title)}</h3>
          <button class="ds-modal__close" data-action="close-response" type="button" aria-label="Schließen">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ds-modal__body">
          <div class="response-info">
            <p><i class="fas fa-clock"></i> Abgeschlossen am: ${completedDate}</p>
          </div>
          <div class="response-answers">
            ${answersHtml}
          </div>
        </div>
        <div class="ds-modal__footer ds-modal__footer--right">
          <button type="button" class="btn btn-cancel" data-action="close-response">Schließen</button>
        </div>
      </div>
    </div>
  `;

  const tempDiv = document.createElement('div');
  setHTML(tempDiv, modalHtml);
  const responseModal = tempDiv.firstElementChild;

  if (responseModal !== null) {
    document.body.append(responseModal);
  }
}

/**
 * Close response modal
 */
export function closeResponseModal(): void {
  const modal = document.getElementById('responseModal');
  if (modal !== null) {
    modal.remove();
  }
}
