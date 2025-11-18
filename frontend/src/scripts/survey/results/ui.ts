/**
 * Survey Results UI Layer
 * Handles all DOM manipulation and rendering for survey results
 */

import { setHTML } from '../../../utils/dom-utils';
import type { Survey, SurveyQuestion, SurveyStatistics, SurveyResponse, ResponseAnswer, ResponsesData } from './types';

// ============================================
// Helper Functions
// ============================================

/**
 * Escapes HTML to prevent XSS attacks
 * @param unsafe - Potentially unsafe string or value
 * @returns HTML-escaped string
 */
function escapeHtml(unsafe: string | number | boolean | null | undefined): string {
  if (unsafe === null || unsafe === undefined) {
    return '';
  }

  const stringValue = String(unsafe);

  return stringValue
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format ISO date string to German format (DD.MM.YYYY HH:MM)
 * @param isoDate - ISO 8601 date string
 * @returns German formatted date
 */
export function formatGermanDate(isoDate: string): string {
  if (isoDate === '') return 'N/A';

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
 * Formats date to German locale
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
function formatDate(dateString: string | null | undefined): string {
  if (dateString === '' || dateString === null || dateString === undefined) return 'N/A';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Checks if survey is anonymous
 * @param survey - Survey data
 * @returns True if anonymous
 */
export function isAnonymousSurvey(survey: Survey): boolean {
  const isAnon = survey.isAnonymous;
  return isAnon === '1' || isAnon === 1 || isAnon === true;
}

/**
 * Renders star rating
 * @param rating - Rating value
 * @param maxRating - Maximum rating
 * @returns HTML string with stars
 */
function renderStars(rating: number, maxRating: number): string {
  let stars = '';
  for (let i = 1; i <= maxRating; i++) {
    stars += i <= rating ? '★' : '☆';
  }
  return stars;
}

/**
 * Maps question type to German label
 * @param type - Question type
 * @returns Localized label
 */
function getQuestionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text: 'Textantwort',
    single_choice: 'Einzelauswahl',
    multiple_choice: 'Mehrfachauswahl',
    rating: 'Bewertung',
    yes_no: 'Ja/Nein',
    number: 'Zahl',
    date: 'Datum',
  };
  // eslint-disable-next-line security/detect-object-injection -- type comes from validated DB question types (text, single_choice, etc.), not user input, 100% safe
  return labels[type] ?? type;
}

// ============================================
// Main Rendering Functions
// ============================================

/**
 * Renders the complete results view
 * @param contentArea - DOM element to render into
 * @param survey - Survey data
 * @param statistics - Survey statistics
 * @param responsesData - Individual responses (optional)
 */
export function renderResults(
  contentArea: HTMLElement,
  survey: Survey,
  statistics: SurveyStatistics,
  responsesData: ResponsesData | null,
): void {
  const isAnonymous = isAnonymousSurvey(survey);
  const totalResponses = statistics.totalResponses ?? 0;
  const completedResponses = statistics.completedResponses ?? 0;
  const completionRate = statistics.completionRate ?? 0;

  const htmlContent = `
    <div class="card results-header">
      <h2 class="survey-title">${escapeHtml(survey.title)}</h2>
      <div class="survey-meta">
        <span><i class="fas fa-calendar"></i> Erstellt: ${escapeHtml(formatDate(survey.createdAt))}</span>
        <span><i class="fas fa-calendar-check"></i> Endet: ${escapeHtml(formatDate(survey.endDate))}</span>
        <span><i class="fas fa-user-shield"></i> ${escapeHtml(isAnonymous ? 'Anonym' : 'Nicht anonym')}</span>
      </div>
    </div>

    <div class="export-actions">
      <button class="btn btn-upload" id="export-excel">
        <i class="fas fa-file-excel"></i> Excel Export
      </button>
      <button class="btn btn-upload" id="export-pdf">
        <i class="fas fa-file-pdf"></i> PDF Export
      </button>
      <button class="btn btn-upload" data-action="print">
        <i class="fas fa-print"></i> Drucken
      </button>
    </div>

    <div class="stats-grid">
      <div class="card-stat">
        <h3 class="stat-value">${escapeHtml(totalResponses.toString())}</h3>
        <p class="stat-label">Antworten</p>
      </div>
      <div class="card-stat">
        <h3 class="stat-value">${escapeHtml(completedResponses.toString())}</h3>
        <p class="stat-label">Abgeschlossen</p>
      </div>
      <div class="card-stat">
        <h3 class="stat-value">${escapeHtml(completionRate.toString())}%</h3>
        <p class="stat-label">Abschlussrate</p>
      </div>
      <div class="card-stat">
        <h3 class="stat-value">${escapeHtml(survey.status === 'active' ? 'Aktiv' : 'Beendet')}</h3>
        <p class="stat-label">Status</p>
      </div>
    </div>

    <div id="questions-results">
      ${renderQuestionResults(statistics)}
    </div>

    <div id="individual-responses">
      ${renderIndividualResponses(statistics, responsesData)}
    </div>
  `;

  setHTML(contentArea, htmlContent);
}

/**
 * Renders all question results
 * @param statistics - Survey statistics with questions
 * @returns HTML string
 */
export function renderQuestionResults(statistics: SurveyStatistics): string {
  if (!statistics.questions || statistics.questions.length === 0) {
    return '<div class="empty-state"><div class="empty-icon">📊</div><p>Noch keine Antworten vorhanden</p></div>';
  }

  return statistics.questions
    .map((question) => {
      const questionText = question.questionText;
      const questionType = question.questionType;
      let resultContent = '';

      switch (questionType) {
        case 'single_choice':
        case 'multiple_choice':
        case 'yes_no':
        case 'date':
          resultContent = renderChoiceResults(question);
          break;
        case 'rating':
          resultContent = renderRatingResults(question);
          break;
        case 'text':
          resultContent = renderTextResults(question);
          break;
        case 'number':
          resultContent = renderNumberResults(question);
          break;
        default:
          resultContent = '<p>Unbekannter Fragetyp</p>';
      }

      return `
        <div class="card">
          <div class="question-header">
            <h3 class="question-text">${escapeHtml(questionText)}</h3>
            <p class="question-type">Typ: ${escapeHtml(getQuestionTypeLabel(questionType))}</p>
          </div>
          <div class="question-body">
            ${resultContent}
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Renders choice question results (single/multiple choice)
 * @param question - Survey question
 * @returns HTML string
 */
export function renderChoiceResults(question: SurveyQuestion): string {
  if (!question.options || question.options.length === 0) {
    return '<p>Keine Optionen verfügbar</p>';
  }

  const totalResponses = question.options.reduce((sum, opt) => sum + (opt.count ?? 0), 0);

  return question.options
    .map((option) => {
      const count = option.count ?? 0;
      const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
      const optionText = (option as { optionText?: string }).optionText ?? 'Unbekannte Option';

      return `
        <div class="option-result">
          <div class="option-header">
            <span class="option-text">${escapeHtml(optionText)}</span>
            <span class="option-count">${escapeHtml(count.toString())} Stimmen</span>
          </div>
          <div class="progress progress--lg">
            <div class="progress__bar ${percentage === 0 ? 'progress__bar--empty' : ''}" style="width: ${escapeHtml(percentage.toString())}%">
              ${escapeHtml(percentage.toString())}%
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Renders rating question results
 * @param question - Survey question
 * @returns HTML string
 */
export function renderRatingResults(question: SurveyQuestion): string {
  const stats = question.statistics ?? {};
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- Runtime type mismatch: API returns numbers as strings from MySQL
  const average = Number(stats.average ?? 0);
  const maxRating = 5;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- Runtime type mismatch: API returns numbers as strings from MySQL
  const count = Number(stats.count ?? 0);

  return `
    <div class="u-text-center">
      <h4 class="rating-average">
        ${escapeHtml(average.toFixed(1))}
      </h4>
      <p class="rating-meta">von ${escapeHtml(maxRating.toString())} Sternen (${escapeHtml(count.toString())} Bewertungen)</p>
      <div class="rating-stars">
        ${renderStars(average, maxRating)}
      </div>
      <div class="rating-range">
        Min: ${escapeHtml((stats.min ?? 0).toString())} | Max: ${escapeHtml((stats.max ?? 0).toString())}
      </div>
    </div>
  `;
}

/**
 * Renders text question results
 * @param question - Survey question
 * @returns HTML string
 */
export function renderTextResults(question: SurveyQuestion): string {
  const responseCount = question.responses?.filter((r) => r.answerText.trim() !== '').length ?? 0;

  return `
    <div class="text-info">
      <p class="text-info-message">
        <i class="fas fa-info-circle"></i>
        ${escapeHtml(
          responseCount > 0
            ? `${responseCount} Textantwort${responseCount > 1 ? 'en' : ''} - siehe unten bei "Individuelle Antworten"`
            : 'Keine Textantworten vorhanden',
        )}
      </p>
    </div>
  `;
}

/**
 * Renders date question results
 * @param question - Survey question
 * @returns HTML string
 */
export function renderDateResults(question: SurveyQuestion): string {
  const responseCount = question.responses?.filter((r) => r.answerText !== '').length ?? 0;

  return `
    <div class="text-info">
      <p class="text-info-message">
        <i class="fas fa-calendar-alt"></i>
        ${escapeHtml(
          responseCount > 0
            ? `${responseCount} Datumsantwort${responseCount > 1 ? 'en' : ''} - siehe unten bei "Individuelle Antworten"`
            : 'Keine Datumsantworten vorhanden',
        )}
      </p>
    </div>
  `;
}

/**
 * Renders number question results
 * @param question - Survey question
 * @returns HTML string
 */
export function renderNumberResults(question: SurveyQuestion): string {
  const stats = question.statistics ?? {};
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- Runtime type mismatch: API returns numbers as strings from MySQL
  const average = Number(stats.average ?? 0);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- Runtime type mismatch: API returns numbers as strings from MySQL
  const count = Number(stats.count ?? 0);

  return `
    <div class="u-text-center">
      <h4 class="number-average">
        ${escapeHtml(average.toFixed(2))}
      </h4>
      <p class="number-meta">Durchschnittswert (${escapeHtml(count.toString())} Antworten)</p>
      <div class="number-range">
        <strong>Min:</strong> ${escapeHtml((stats.min ?? 0).toString())} | <strong>Max:</strong> ${escapeHtml((stats.max ?? 0).toString())}
      </div>
    </div>
  `;
}

/**
 * Renders individual responses section
 * @param statistics - Survey statistics (contains questions with options)
 * @param responsesData - Individual responses
 * @returns HTML string
 */
export function renderIndividualResponses(statistics: SurveyStatistics, responsesData: ResponsesData | null): string {
  if (!responsesData?.responses || responsesData.responses.length === 0) {
    console.info('[Survey Results] No individual responses to display');
    return '';
  }

  // Note: Cannot determine anonymity from statistics alone, but questions are needed for options
  console.info('[Survey Results] Total responses:', responsesData.responses.length);

  let html = `
    <div class="card responses-section">
      <h3><i class="fas fa-users"></i> Individuelle Antworten (${escapeHtml(responsesData.responses.length.toString())})</h3>
      <div class="accordion accordion--compact">
  `;

  responsesData.responses.forEach((response, index) => {
    html += renderResponseCard(statistics, response, index);
  });

  html += `
      </div>
    </div>
  `;

  return html;
}

/**
 * Renders a single response card
 * @param statistics - Survey statistics (contains questions with options)
 * @param response - Survey response
 * @param index - Response index
 * @returns HTML string
 */
export function renderResponseCard(statistics: SurveyStatistics, response: SurveyResponse, index: number): string {
  console.info(`[Survey Results] Processing response ${index + 1}:`, response);

  const respondentName = getRespondentName(response, index);
  const completedDate = getCompletedDate(response);
  const statusBadge =
    response.status === 'completed'
      ? '<span class="badge badge--success">Abgeschlossen</span>'
      : '<span class="badge badge--warning">In Bearbeitung</span>';

  return `
    <div class="accordion__item">
      <button class="accordion__header">
        <span class="accordion__title">
          ${escapeHtml(respondentName)} • <i class="fas fa-clock"></i> ${escapeHtml(completedDate)} ${statusBadge}
        </span>
        <i class="fas fa-chevron-down accordion__icon"></i>
      </button>
      <div class="accordion__content">
        <div class="accordion__body">
          ${renderAnswerItems(statistics, response)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Gets respondent name
 * @param response - Survey response
 * @param index - Response index
 * @returns Respondent name
 */
function getRespondentName(response: SurveyResponse, index: number): string {
  const firstName = response.firstName ?? '';
  const lastName = response.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName !== '') return fullName;
  if (response.username !== undefined && response.username !== '') return response.username;
  return `Teilnehmer #${index + 1}`;
}

/**
 * Gets completed date from response
 * @param response - Survey response
 * @returns Formatted date string
 */
function getCompletedDate(response: SurveyResponse): string {
  const dateValue = response.completedAt;
  if (dateValue !== undefined && dateValue !== '') {
    return formatDate(dateValue);
  }
  return 'In Bearbeitung';
}

/**
 * Renders answer items for a response
 * @param statistics - Survey statistics (contains questions with options)
 * @param response - Survey response
 * @returns HTML string
 */
function renderAnswerItems(statistics: SurveyStatistics, response: SurveyResponse): string {
  if (!statistics.questions || !response.answers) {
    return '';
  }

  let html = '';
  statistics.questions.forEach((question) => {
    const answer = response.answers?.find((a: ResponseAnswer) => a.questionId === question.id);

    const questionText = question.questionText;
    // Check answerOptions BEFORE answerDate to prevent option IDs being formatted as dates (01.01.1970)

    const answerText = answer
      ? (answer.answerText ??
        answer.answerNumber ??
        (answer.answerOptions !== null && answer.answerOptions !== undefined && answer.answerOptions.length > 0
          ? getOptionTexts(question, answer.answerOptions)
          : undefined) ??
        (answer.answerDate !== undefined && answer.answerDate !== null
          ? formatGermanDate(answer.answerDate)
          : undefined) ??
        'Keine Antwort')
      : 'Keine Antwort';

    html += `
      <div class="answer-item">
        <strong>${escapeHtml(questionText)}:</strong>
        <span>${escapeHtml(String(answerText))}</span>
      </div>
    `;
  });

  return html;
}

/**
 * Gets option texts from option IDs
 * @param question - Survey question with options
 * @param optionIds - Array of selected option IDs
 * @returns Comma-separated option texts
 */
function getOptionTexts(question: SurveyQuestion, optionIds: number[]): string {
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
 * Displays an error message
 * @param contentArea - DOM element to render into
 * @param message - Error message
 */
export function showError(contentArea: HTMLElement, message: string): void {
  const errorHtml = `
    <div class="empty-state">
      <div class="empty-icon">❌</div>
      <p>${escapeHtml(message)}</p>
      <button class="btn btn-cancel" data-action="navigate-back">
        Zurück zur Übersicht
      </button>
    </div>
  `;

  setHTML(contentArea, errorHtml);
}

/**
 * Shows loading state
 * @param contentArea - DOM element to render into
 */
export function showLoading(contentArea: HTMLElement): void {
  const html = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Lade Umfrage-Ergebnisse...</p>
    </div>
  `;

  setHTML(contentArea, html);
}
