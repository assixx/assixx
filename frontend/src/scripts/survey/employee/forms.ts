/**
 * Survey Employee - Forms Layer
 * Handles survey form display, question rendering, and answer management
 */

import { setHTML } from '../../../utils/dom-utils.js';
import { showErrorAlert, showSuccessAlert } from '../../utils/alerts';
import type { Survey, Question, AnswerMap, QuestionOption } from './types';
import { getQuestionText, showModal, closeModal } from './ui';
import { submitResponse, fetchSurveyDetails } from './data';

// Module state
let currentSurvey: Survey | null = null;
let answers: AnswerMap = {};

/**
 * Helper: Check if a question is required
 * Handles multiple formats from API: 1, true, '1', 0, false, '0'
 */
function isQuestionRequired(required: boolean | number | string | undefined): boolean {
  if (required === undefined) return false;
  if (typeof required === 'boolean') return required;
  if (typeof required === 'number') return required !== 0;
  if (typeof required === 'string') return required !== '0' && required !== '';
  return false;
}

/**
 * Start survey (load details and display form)
 */
export async function startSurvey(surveyId: number): Promise<void> {
  console.log('[SurveyEmployee] Starting survey with ID:', surveyId);

  try {
    currentSurvey = await fetchSurveyDetails(surveyId);
    answers = {};
    displaySurveyForm();
  } catch (error) {
    console.error('[SurveyEmployee] Error loading survey:', error);
    showErrorAlert('Fehler beim Laden der Umfrage');
  }
}

/**
 * Display survey form in modal
 */
function displaySurveyForm(): void {
  if (currentSurvey === null) return;

  console.log('[SurveyEmployee] Displaying survey form for:', currentSurvey);

  const modalTitle = document.getElementById('modalTitle');
  const container = document.getElementById('questionsContainer');

  if (modalTitle === null || container === null) {
    console.error('[SurveyEmployee] Modal elements not found');
    return;
  }

  modalTitle.textContent = getQuestionText(currentSurvey.title);
  container.innerHTML = '';

  currentSurvey.questions.forEach((question, index) => {
    const questionEl = createQuestionElement(question, index);
    container.append(questionEl);
  });

  updateProgress();
  showModal();
}

/**
 * Create question element
 */
function createQuestionElement(question: Question, index: number): HTMLElement {
  const div = document.createElement('div');
  div.className = 'question-item';

  const isRequired = isQuestionRequired(question.is_required);

  const questionHtml = `
    <div class="question-header">
      <span class="question-number">${index + 1}</span>
      <div class="question-text">
        ${getQuestionText(question.questionText)}
        ${isRequired ? '<span class="required-indicator">*</span>' : ''}
      </div>
    </div>
    <div class="answer-container">
      ${createAnswerInput(question)}
    </div>
  `;

  setHTML(div, questionHtml);
  return div;
}

/**
 * Create answer input based on question type
 */
function createAnswerInput(question: Question): string {
  const questionType = question.questionType;

  if (questionType === 'text') {
    return createTextInput(question);
  } else if (questionType === 'single_choice') {
    const options = (question.options ?? [])
      .map((opt, idx) => createChoiceOption(question, opt, idx, 'single'))
      .join('');
    return `<div class="choice-group">${options}</div>`;
  } else if (questionType === 'multiple_choice') {
    const options = (question.options ?? [])
      .map((opt, idx) => createChoiceOption(question, opt, idx, 'multiple'))
      .join('');
    return `<div class="choice-group">${options}</div>`;
  } else if (questionType === 'rating') {
    return createRatingInput(question);
  } else if (questionType === 'yes_no') {
    return createYesNoInput(question);
  } else if (questionType === 'number') {
    return createSimpleInput('number', question);
  } else {
    // date type
    return createSimpleInput('date', question);
  }
}

/**
 * Create text area input with Design System classes
 */
function createTextInput(question: Question): string {
  const isRequired = isQuestionRequired(question.is_required);
  return `<div class="form-field">
            <textarea class="form-field__control form-field__control--textarea"
                      data-question-id="${question.id}"
                      data-type="text"
                      placeholder="Ihre Antwort..."
                      rows="4"
                      ${isRequired ? 'required' : ''}></textarea>
          </div>`;
}

/**
 * Create choice option HTML with Design System choice-card
 */
function createChoiceOption(
  question: Question,
  option: string | QuestionOption,
  index: number,
  type: 'single' | 'multiple',
): string {
  const optionText = typeof option === 'string' ? option : option.optionText;
  const optionId = typeof option === 'string' ? index : option.id;
  const inputType = type === 'single' ? 'radio' : 'checkbox';
  const nameAttr = type === 'single' ? `name="question_${question.id}"` : '';
  const dataAttr = type === 'multiple' ? `data-question-id="${question.id}"` : '';
  const isRequired = isQuestionRequired(question.is_required);

  return `
    <label class="choice-card">
      <input type="${inputType}"
             class="choice-card__input"
             id="q${question.id}_opt${optionId}"
             ${nameAttr}
             value="${optionId}"
             ${dataAttr}
             data-type="${type}"
             data-question-id="${question.id}"
             ${isRequired && type === 'single' ? 'required' : ''}>
      <span class="choice-card__text">${optionText}</span>
    </label>
  `;
}

/**
 * Create rating input with Tailwind Design System
 * Uses interactive buttons styled with glassmorphism
 * Note: Validation for required rating questions is handled in handleSubmit()
 */
function createRatingInput(question: Question): string {
  const ratingOptions = [1, 2, 3, 4, 5]
    .map(
      (value) => `
        <button type="button"
                class="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-base font-medium text-gray-300 transition-all duration-200 hover:scale-110 hover:border-blue-400/50 hover:bg-blue-500/10 hover:text-blue-400 hover:shadow-[0_0_20px_rgba(33,150,243,0.15)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                data-question-id="${question.id}"
                data-rating-value="${value}"
                data-type="rating"
                aria-label="Bewertung ${value} von 5">
          ${value}
        </button>
      `,
    )
    .join('');

  return `<div class="flex gap-3 flex-wrap">${ratingOptions}</div>`;
}

/**
 * Create yes/no input with Design System choice-card
 */
function createYesNoInput(question: Question): string {
  const isRequired = isQuestionRequired(question.is_required);
  return `
    <div class="choice-group">
      <label class="choice-card">
        <input type="radio"
               class="choice-card__input"
               id="q${question.id}_yes"
               name="question_${question.id}"
               value="yes"
               data-question-id="${question.id}"
               data-type="single"
               data-text-value="Ja"
               ${isRequired ? 'required' : ''}>
        <span class="choice-card__text">Ja</span>
      </label>
      <label class="choice-card">
        <input type="radio"
               class="choice-card__input"
               id="q${question.id}_no"
               name="question_${question.id}"
               value="no"
               data-question-id="${question.id}"
               data-type="single"
               data-text-value="Nein"
               ${isRequired ? 'required' : ''}>
        <span class="choice-card__text">Nein</span>
      </label>
    </div>
  `;
}

/**
 * Create simple input (number, date) with Design System form-field
 */
function createSimpleInput(type: string, question: Question): string {
  const isRequired = isQuestionRequired(question.is_required);
  const placeholder = type === 'number' ? 'Zahl eingeben...' : 'Datum wählen...';
  return `<div class="form-field">
            <input type="${type}"
                   class="form-field__control"
                   data-question-id="${question.id}"
                   data-type="${type}"
                   placeholder="${placeholder}"
                   ${isRequired ? 'required' : ''}>
          </div>`;
}

/**
 * Update answer for a question
 */
export function updateAnswer(questionId: number, value: string | number, type: string): void {
  if (type === 'single') {
    // eslint-disable-next-line security/detect-object-injection -- questionId comes from survey data
    answers[questionId] = {
      questionId,
      answerOptions: [Number(value)],
    };
  } else if (type === 'text') {
    // eslint-disable-next-line security/detect-object-injection -- questionId comes from survey data
    answers[questionId] = {
      questionId,
      answerText: String(value),
    };
  } else if (type === 'number') {
    // eslint-disable-next-line security/detect-object-injection -- questionId comes from survey data
    answers[questionId] = {
      questionId,
      answerNumber: Number(value),
    };
  } else if (type === 'date') {
    // eslint-disable-next-line security/detect-object-injection -- questionId comes from survey data
    answers[questionId] = {
      questionId,
      answerDate: String(value),
    };
  }

  updateProgress();
}

/**
 * Update multiple choice answer
 */
export function updateMultipleChoice(questionId: number, optionId: number, checked: boolean): void {
  // eslint-disable-next-line security/detect-object-injection -- questionId comes from survey data
  answers[questionId] ??= {
    questionId,
    selectedOptions: [],
  };

  if (checked) {
    // eslint-disable-next-line security/detect-object-injection -- questionId comes from survey data
    answers[questionId].selectedOptions?.push(optionId);
  } else {
    // eslint-disable-next-line security/detect-object-injection -- questionId comes from survey data
    const current = answers[questionId].selectedOptions ?? [];
    // eslint-disable-next-line security/detect-object-injection -- questionId comes from survey data
    answers[questionId].selectedOptions = current.filter((id) => id !== optionId);
  }

  updateProgress();
}

/**
 * Select rating value
 * Highlights the selected rating button with visual feedback
 */
export function selectRating(questionId: number, value: number): void {
  // Clear previous selections for this question
  const allRatingButtons = document.querySelectorAll<HTMLButtonElement>(
    `[data-question-id="${questionId}"][data-rating-value]`,
  );

  allRatingButtons.forEach((button) => {
    // Reset to default state
    button.classList.remove('!border-blue-500', '!bg-blue-500/20', '!text-blue-400', '!scale-110');
  });

  // Highlight the selected rating button
  const selectedButton = document.querySelector<HTMLButtonElement>(
    `[data-question-id="${questionId}"][data-rating-value="${value}"]`,
  );

  if (selectedButton !== null) {
    selectedButton.classList.add('!border-blue-500', '!bg-blue-500/20', '!text-blue-400', '!scale-110');
  }

  updateAnswer(questionId, value, 'number');
}

/**
 * Update progress bar
 */
function updateProgress(): void {
  if (currentSurvey === null) return;

  const totalQuestions = currentSurvey.questions.length;
  const answeredQuestions = Object.keys(answers).length;
  const percentage = (answeredQuestions / totalQuestions) * 100;

  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  if (progressBar !== null) {
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', String(percentage));
  }

  if (progressText !== null) {
    progressText.textContent = `${answeredQuestions} von ${totalQuestions} Fragen beantwortet`;
  }
}

/**
 * Submit survey response
 */
export async function handleSubmit(e: Event): Promise<void> {
  e.preventDefault();

  if (currentSurvey === null) return;

  // Validate all required questions are answered
  const unansweredRequired: string[] = [];
  currentSurvey.questions.forEach((question, index) => {
    if (isQuestionRequired(question.is_required) && !(question.id in answers)) {
      unansweredRequired.push(`Frage ${index + 1}`);
    }
  });

  if (unansweredRequired.length > 0) {
    showErrorAlert(`Bitte beantworten Sie alle Pflichtfragen: ${unansweredRequired.join(', ')}`);
    return;
  }

  // Convert answers to array format
  const answersArray: unknown[] = [];

  for (const questionId in answers) {
    // eslint-disable-next-line security/detect-object-injection -- questionId comes from controlled survey data
    const answer = answers[questionId];

    if (answer.selectedOptions !== undefined) {
      // Multiple choice
      answersArray.push({
        questionId: Number(questionId),
        answerOptions: answer.selectedOptions,
      });
    } else if (answer.answerOptions !== undefined) {
      // Single choice
      answersArray.push({
        questionId: Number(questionId),
        answerOptions: answer.answerOptions,
      });
    } else {
      // Other answer types (text, number, date)
      answersArray.push({
        questionId: Number(questionId),
        ...answer,
      });
    }
  }

  const success = await submitResponse(currentSurvey.id, answersArray);

  if (success) {
    // Show toast notification
    showSuccessAlert('Vielen Dank für Ihre Teilnahme!');

    // Close modal and reload
    closeModal();
    setTimeout(() => {
      window.location.reload();
    }, 500);
  } else {
    showErrorAlert('Fehler beim Absenden der Antworten');
  }
}
