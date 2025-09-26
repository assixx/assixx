/* eslint-disable max-lines */
/**
 * Survey Employee Module
 * Handles employee survey functionality including display, submission, and viewing responses
 */

import { showAlert, showErrorAlert } from '/scripts/utils/alerts.js';
import { setHTML } from '/utils/dom-utils.js';

// Module state
let currentSurvey = null;
let answers = {};

// Public API functions that need to be available globally
export function startSurvey(surveyId) {
  return startSurveyInternal(surveyId);
}

export function updateAnswer(questionId, value, type) {
  return updateAnswerInternal(questionId, value, type);
}

export function updateMultipleChoice(questionId, optionId, checked) {
  return updateMultipleChoiceInternal(questionId, optionId, checked);
}

export function selectRating(questionId, value) {
  return selectRatingInternal(questionId, value);
}

export function viewResponse(surveyId) {
  return viewResponseInternal(surveyId);
}

export function closeModal() {
  return closeModalInternal();
}

export function closeResponseModal() {
  return closeResponseModalInternal();
}

// Internal implementation
async function startSurveyInternal(surveyId) {
  console.log('Starting survey with ID:', surveyId);
  try {
    const endpoint = `/api/v2/surveys/${surveyId}`;
    console.log('Using endpoint:', endpoint);

    // Load survey details
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    console.log('Response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('Survey data received:', result);

      // Handle v2 API response structure
      currentSurvey = result.success && result.data ? result.data : result;

      if (!currentSurvey || !currentSurvey.questions) {
        console.error('Invalid survey data:', currentSurvey);
        showErrorAlert('Fehler: Umfragedaten sind ungültig');
        return;
      }

      answers = {};
      displaySurveyForm();
    } else {
      console.error('Survey load failed:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({ message: 'Unbekannter Fehler' }));
      showErrorAlert(`Fehler beim Laden der Umfrage: ${errorData.message || response.statusText}`);
    }
  } catch (error) {
    console.error('Error loading survey:', error);
    showErrorAlert('Fehler beim Laden der Umfrage');
  }
}

// Handle survey action button click
function handleSurveyAction(e) {
  const surveyButton = e.target.closest('.survey-action');
  if (!surveyButton) return false;

  const card = surveyButton.closest('.survey-card');
  if (!card) return true;

  const surveyId = card.dataset.surveyId;
  if (!surveyId) return true;

  e.preventDefault();
  e.stopPropagation();

  const action = card.classList.contains('completed') ? 'view' : 'start';
  if (action === 'view') {
    viewResponseInternal(Number.parseInt(surveyId));
  } else {
    startSurveyInternal(Number.parseInt(surveyId));
  }
  return true;
}

// Handle modal close buttons
function handleModalClose(e) {
  if (e.target.id === 'modalCloseBtn' || e.target.id === 'modalCancelBtn') {
    closeModalInternal();
    return true;
  }
  return false;
}

// Handle response modal close
function handleResponseModalClose(e) {
  if (e.target.dataset.action === 'close-response-modal') {
    closeResponseModalInternal();
    return true;
  }
  return false;
}

// Handle rating button click
function handleRatingClick(e) {
  const ratingBtn = e.target.closest('.rating-option');
  if (!ratingBtn) return false;

  const questionId = ratingBtn.dataset.questionId;
  const ratingValue = ratingBtn.dataset.ratingValue;

  if (questionId && ratingValue) {
    selectRatingInternal(Number.parseInt(questionId), Number.parseInt(ratingValue));
    return true;
  }
  return false;
}

// Load available surveys
async function loadSurveys() {
  try {
    const endpoint = '/api/v2/surveys';

    // Get all surveys (not just active ones, so we can show completed ones too)
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (response.ok) {
      const result = await response.json();
      // Handle v2 API response structure
      const surveys = result.success && result.data ? result.data : result;
      // Ensure surveys is an array
      if (Array.isArray(surveys)) {
        // Filter only active and closed surveys (not draft or archived)
        const relevantSurveys = surveys.filter((s) => s.status === 'active' || s.status === 'closed');
        displaySurveys(relevantSurveys);
      } else {
        console.error('Invalid surveys data format:', surveys);
        displaySurveys([]);
      }
    }
  } catch (error) {
    console.error('Error loading surveys:', error);
  }
}

// Display surveys
async function displaySurveys(surveys) {
  const pendingContainer = document.querySelector('#pendingSurveys');
  const completedContainer = document.querySelector('#completedSurveys');

  pendingContainer.innerHTML = '';
  completedContainer.innerHTML = '';

  console.info('Displaying surveys:', surveys.length);

  for (const survey of surveys) {
    // Check if user has already responded
    const responseCheck = await checkUserResponse(survey.id);
    console.info(`Survey ${survey.id} - Response check:`, responseCheck);

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
        <div class="empty-state-icon">📋</div>
        <h3 class="empty-state-title">Keine offenen Umfragen</h3>
        <p>Aktuell gibt es keine Umfragen, an denen Sie teilnehmen können.</p>
      </div>
    `;
  }

  if (completedContainer.innerHTML === '') {
    completedContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <h3 class="empty-state-title">Keine abgeschlossenen Umfragen</h3>
        <p>Sie haben noch an keinen Umfragen teilgenommen.</p>
      </div>
    `;
  }
}

// Check if user has responded to survey
async function checkUserResponse(surveyId) {
  try {
    const endpoint = `/api/v2/surveys/${surveyId}/my-response`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.info(`Response check for survey ${surveyId}:`, data);
      // API v2 returns { success: true, data: { responded: bool, response: {} } }
      if (data.success && data.data) {
        return data.data;
      }
      return data;
    } else {
      console.error(`Failed to check response for survey ${surveyId}:`, response.status);
    }
  } catch (error) {
    console.error('Error checking response:', error);
  }
  return { responded: false };
}

function getMandatoryBadge(survey) {
  const isMandatory = survey.is_mandatory === '1' || survey.is_mandatory === 1 || survey.is_mandatory === true;
  return isMandatory
    ? '<span class="survey-badge mandatory">Pflicht</span>'
    : '<span class="survey-badge optional">Freiwillig</span>';
}

function getAnonymousBadge(survey) {
  const isAnonymous = survey.is_anonymous === '1' || survey.is_anonymous === 1 || survey.is_anonymous === true;
  return isAnonymous ? '<span class="survey-badge anonymous">Anonym</span>' : '';
}

function getDeadlineHtml(deadline, completed, daysLeft, isUrgent) {
  if (!deadline) return '<div></div>';

  return `
    <div class="survey-deadline ${isUrgent ? 'urgent' : ''}">
      <i class="fas fa-calendar-alt"></i>
      ${completed ? 'Frist war:' : 'Frist:'} ${deadline.toLocaleDateString('de-DE')}
      ${!completed && daysLeft ? ` (${daysLeft} Tage)` : ''}
    </div>
  `;
}

function getActionButton(completed) {
  const className = `survey-action ${completed ? 'completed' : ''}`;
  const content = completed
    ? '<i class="fas fa-check"></i> Abgeschlossen'
    : '<i class="fas fa-arrow-right"></i> Teilnehmen';
  return `<button class="${className}">${content}</button>`;
}

// Create survey card
function createSurveyCard(survey, completed) {
  const card = document.createElement('div');
  card.className = completed ? 'survey-card completed' : 'survey-card';
  card.dataset.surveyId = survey.id;

  if (completed) {
    card.style.cursor = 'pointer';
  }

  const deadline = survey.end_date ? new Date(survey.end_date) : null;
  const daysLeft = deadline ? Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const isUrgent = daysLeft && daysLeft <= 7;

  const cardHtml = `
    <div class="survey-card-header">
      <h3 class="survey-card-title">${getQuestionText(survey.title)}</h3>
      <div>
        ${getMandatoryBadge(survey)}
        ${getAnonymousBadge(survey)}
      </div>
    </div>
    <p class="survey-card-description">${getQuestionText(survey.description) || 'Keine Beschreibung verfügbar'}</p>
    <div class="survey-meta">
      ${getDeadlineHtml(deadline, completed, daysLeft, isUrgent)}
      ${getActionButton(completed)}
    </div>
  `;

  // Use dom-utils setHTML for safe sanitization
  setHTML(card, cardHtml);
  return card;
}

// Helper function to convert Buffer to text
function getQuestionText(questionText) {
  if (typeof questionText === 'string') {
    return questionText;
  }

  // Handle Buffer object
  if (questionText && questionText.type === 'Buffer' && Array.isArray(questionText.data)) {
    // Convert array of byte values to string
    return String.fromCharCode.apply(null, questionText.data);
  }

  // Handle other object types
  if (questionText && typeof questionText === 'object') {
    return JSON.stringify(questionText);
  }

  return 'Frage';
}

// Display survey form
function displaySurveyForm() {
  console.log('Displaying survey form for:', currentSurvey);

  const modal = document.querySelector('#surveyModal');
  if (!modal) {
    console.error('Survey modal not found!');
    alert('Fehler: Modal nicht gefunden!');
    return;
  }

  document.querySelector('#modalTitle').textContent = getQuestionText(currentSurvey.title);
  const container = document.querySelector('#questionsContainer');
  container.innerHTML = '';

  console.info('Current Survey:', currentSurvey); // Debug
  console.info('Questions:', currentSurvey.questions); // Debug

  currentSurvey.questions.forEach((question, index) => {
    console.info('Question:', question); // Debug
    const questionEl = createQuestionElement(question, index);
    container.append(questionEl);
  });

  updateProgress();
  modal.style.display = 'flex';
  console.log('Modal display set to flex');
}

// Create question element
function createQuestionElement(question, index) {
  const div = document.createElement('div');
  div.className = 'question-item';

  // Use dom-utils setHTML for safe sanitization
  setHTML(
    div,
    `
      <div class="question-header">
        <span class="question-number">${index + 1}</span>
        <div class="question-text">
          ${getQuestionText(question.questionText)}
          ${question.isRequired ? '<span class="required-indicator">*</span>' : ''}
        </div>
      </div>
      <div class="answer-container">
        ${createAnswerInput(question)}
      </div>
    `,
  );

  return div;
}

// Create text area input
function createTextInput(question) {
  return `<textarea class="form-control"
                    data-question-id="${question.id}"
                    ${question.is_required ? 'required' : ''}></textarea>`;
}

// Create choice option HTML
function createChoiceOption(question, option, index, type) {
  const optionText = typeof option === 'string' ? option : option.optionText;
  const optionId = typeof option === 'string' ? index : option.id;
  const inputType = type === 'single' ? 'radio' : 'checkbox';
  const nameAttr = type === 'single' ? `name="question_${question.id}"` : '';
  const dataAttr = type === 'multiple' ? `data-question-id="${question.id}"` : '';

  return `
    <div class="choice-option">
      <input type="${inputType}"
             id="q${question.id}_opt${optionId}"
             ${nameAttr}
             value="${optionId}"
             ${dataAttr}
             ${question.is_required && type === 'single' ? 'required' : ''}>
      <label for="q${question.id}_opt${optionId}">${optionText}</label>
    </div>
  `;
}

// Create rating input
function createRatingInput(question) {
  const ratingOptions = [1, 2, 3, 4, 5]
    .map(
      (value) => `
        <div class="rating-option"
             id="rating_${question.id}_${value}"
             data-question-id="${question.id}"
             data-rating-value="${value}">
          ${value}
        </div>
      `,
    )
    .join('');

  return `<div class="rating-container">${ratingOptions}</div>`;
}

// Create yes/no input
function createYesNoInput(question) {
  const required = question.is_required ? 'required' : '';
  return `
    <div class="choice-option">
      <input type="radio"
             id="q${question.id}_yes"
             name="question_${question.id}"
             value="yes"
             ${required}
             data-text-value="Ja">
      <label for="q${question.id}_yes">Ja</label>
    </div>
    <div class="choice-option">
      <input type="radio"
             id="q${question.id}_no"
             name="question_${question.id}"
             value="no"
             ${required}
             data-text-value="Nein">
      <label for="q${question.id}_no">Nein</label>
    </div>
  `;
}

// Create simple input
function createSimpleInput(type, question) {
  return `<input type="${type}"
                 class="form-control"
                 data-question-id="${question.id}"
                 ${question.is_required ? 'required' : ''}>`;
}

// Create answer input based on question type
function createAnswerInput(question) {
  const inputCreators = {
    text: () => createTextInput(question),
    single_choice: () => question.options.map((opt, idx) => createChoiceOption(question, opt, idx, 'single')).join(''),
    multiple_choice: () =>
      question.options.map((opt, idx) => createChoiceOption(question, opt, idx, 'multiple')).join(''),
    rating: () => createRatingInput(question),
    yes_no: () => createYesNoInput(question),
    number: () => createSimpleInput('number', question),
    date: () => createSimpleInput('date', question),
  };

  const creator = inputCreators[question.questionType];
  return creator ? creator() : '';
}

// Update answer
function updateAnswerInternal(questionId, value, type) {
  if (type === 'single') {
    // For single choice, store as array with one element
    // eslint-disable-next-line security/detect-object-injection -- questionId kommt aus Survey-Template (data-question-id), nicht von User-Input
    answers[questionId] = {
      questionId,
      answerOptions: [value],
    };
  } else {
    // eslint-disable-next-line security/detect-object-injection -- questionId kommt aus Survey-Template (data-question-id), nicht von User-Input
    answers[questionId] = {
      questionId,
      [`answer${type === 'text' ? 'Text' : type === 'number' ? 'Number' : 'Date'}`]: value,
    };
  }
  updateProgress();
}

// Update multiple choice answer
function updateMultipleChoiceInternal(questionId, optionId, checked) {
  // eslint-disable-next-line security/detect-object-injection -- questionId kommt aus Survey-Template (data-question-id), nicht von User-Input
  if (!answers[questionId]) {
    // eslint-disable-next-line security/detect-object-injection -- questionId kommt aus Survey-Template (data-question-id), nicht von User-Input
    answers[questionId] = {
      questionId,
      selectedOptions: [],
    };
  }

  if (checked) {
    // eslint-disable-next-line security/detect-object-injection -- questionId kommt aus Survey-Template (data-question-id), nicht von User-Input
    answers[questionId].selectedOptions.push(optionId);
  } else {
    // eslint-disable-next-line security/detect-object-injection -- questionId kommt aus Survey-Template (data-question-id), nicht von User-Input
    answers[questionId].selectedOptions = answers[questionId].selectedOptions.filter((id) => id !== optionId);
  }

  updateProgress();
}

// Select rating
function selectRatingInternal(questionId, value) {
  // Clear previous selection
  for (let i = 1; i <= 5; i++) {
    const element = document.querySelector(`#rating_${questionId}_${i}`);
    if (element) {
      element.classList.remove('selected');
    }
  }

  // Set new selection
  const selectedElement = document.querySelector(`#rating_${questionId}_${value}`);
  if (selectedElement) {
    selectedElement.classList.add('selected');
  }
  updateAnswerInternal(questionId, value, 'number');
}

// Update progress
function updateProgress() {
  const totalQuestions = currentSurvey.questions.length;
  const answeredQuestions = Object.keys(answers).length;
  const percentage = (answeredQuestions / totalQuestions) * 100;

  document.querySelector('#progressBar').style.width = `${percentage}%`;
  document.querySelector('#progressText').textContent = `${answeredQuestions} von ${totalQuestions} Fragen beantwortet`;
}

// Submit survey handler
async function handleSurveySubmit(e) {
  e.preventDefault();

  // Convert answers to array format
  const answersArray = [];
  for (const questionId in answers) {
    // eslint-disable-next-line security/detect-object-injection -- questionId comes from controlled survey data
    const answer = answers[questionId];

    if (answer.selectedOptions) {
      // Multiple choice - store as answer_options array
      answersArray.push({
        questionId: Number.parseInt(questionId),
        answerOptions: answer.selectedOptions,
      });
    } else if (answer.answerOptions) {
      // Single choice - already has answer_options array
      answersArray.push({
        questionId: Number.parseInt(questionId),
        answerOptions: answer.answerOptions,
      });
    } else {
      // Other answer types (text, number, date)
      answersArray.push({
        questionId: Number.parseInt(questionId),
        ...answer,
      });
    }
  }

  console.info('Submitting survey answers:', {
    surveyId: currentSurvey.id,
    answersCount: answersArray.length,
    answers: answersArray,
  });

  try {
    const endpoint = `/api/v2/surveys/${currentSurvey.id}/responses`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ answers: answersArray }),
    });

    if (response.ok) {
      // Success animation and message
      showSuccessMessage();

      // Wait a bit longer for database to update
      setTimeout(() => {
        closeModalInternal();
        // Force reload with a small delay to ensure database is updated
        setTimeout(() => {
          console.info('Reloading surveys after submission...');
          loadSurveys();
        }, 500);
      }, 2000);
    } else {
      const error = await response.json();
      showErrorAlert(`Fehler: ${error.error}`);
    }
  } catch (error) {
    console.error('Error submitting survey:', error);
    showErrorAlert('Fehler beim Absenden der Antworten');
  }
}

// Fetch survey details
async function fetchSurveyDetails(surveyId) {
  const endpoint = `/api/v2/surveys/${surveyId}`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch survey details');
  }

  const result = await response.json();
  return result.success ? result.data : result;
}

// Fetch user's survey response
async function fetchUserResponse(surveyId) {
  const endpoint = `/api/v2/surveys/${surveyId}/my-response`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.success && data.data ? data.data : data;
}

// Process and display response
function processResponse(survey, responseData) {
  if (!responseData || !responseData.responded || !responseData.response) {
    showAlert('Keine Antworten für diese Umfrage gefunden.');
    return;
  }
  showResponseModal(survey, responseData.response);
}

// View response (for completed surveys)
async function viewResponseInternal(surveyId) {
  try {
    const survey = await fetchSurveyDetails(surveyId);
    const responseData = await fetchUserResponse(surveyId);

    processResponse(survey, responseData);
  } catch (error) {
    console.error('Error viewing response:', error);
    showErrorAlert('Fehler beim Abrufen Ihrer Antworten');
  }
}

// Show response modal
function showResponseModal(survey, response) {
  console.info('Showing response modal with:', { survey, response });

  // Create modal HTML - use same class structure as survey modal
  const modalHtml = `
    <div id="responseModal" class="modal" style="display: block;">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Ihre Antworten - ${survey.title}</h2>
          <span class="close" data-action="close-response-modal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="response-info">
            <p><i class="fas fa-clock"></i> Abgeschlossen am: ${new Date(response.completed_at).toLocaleDateString(
              'de-DE',
              {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              },
            )}</p>
          </div>
          <div class="response-answers">
            ${survey.questions
              .map((question, index) => {
                const answer = response.answers.find((a) => a.question_id === question.id);
                console.info('Question:', question, 'Answer:', answer);
                return `
                  <div class="response-question">
                    <h4>${index + 1}. ${question.questionText}</h4>
                    <div class="response-answer">
                      ${formatAnswer(question, answer)}
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Add modal to body safely
  const tempDiv = document.createElement('div');
  setHTML(tempDiv, modalHtml);
  document.body.append(tempDiv.firstElementChild);
}

function parseAnswerOptions(answer_options) {
  if (typeof answer_options !== 'string') {
    return Array.isArray(answer_options) ? answer_options : [answer_options];
  }

  try {
    const parsed = JSON.parse(answer_options);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    console.error('Error parsing answer_options:', e);
    return null;
  }
}

function formatChoiceAnswer(question, selectedOptions) {
  return selectedOptions
    .map((optIndex) => {
      const option =
        typeof question.options[0] === 'string'
          ? // eslint-disable-next-line security/detect-object-injection -- optIndex comes from parsed answer data
            question.options[optIndex]
          : question.options.find((o) => o.id === optIndex)?.option_text;
      return `<p><i class="fas fa-check-square"></i> ${option || `Option ${optIndex}`}</p>`;
    })
    .join('');
}

// Format answer based on question type
function formatAnswer(question, answer) {
  const NO_ANSWER_TEXT = '<em>Keine Antwort</em>';

  if (!answer) return NO_ANSWER_TEXT;

  const formatters = {
    text: () => `<p>${answer.answer_text || NO_ANSWER_TEXT}</p>`,

    single_choice: () => {
      if (!answer.answer_options || !question.options) {
        return NO_ANSWER_TEXT;
      }
      const selectedOptions = parseAnswerOptions(answer.answer_options);
      if (!selectedOptions) {
        return '<em>Fehler beim Anzeigen der Antwort</em>';
      }
      return formatChoiceAnswer(question, selectedOptions);
    },

    multiple_choice: () => {
      if (!answer.answer_options || !question.options) {
        return NO_ANSWER_TEXT;
      }
      const selectedOptions = parseAnswerOptions(answer.answer_options);
      if (!selectedOptions) {
        return '<em>Fehler beim Anzeigen der Antwort</em>';
      }
      return formatChoiceAnswer(question, selectedOptions);
    },

    rating: () => `<p>${answer.answer_number || NO_ANSWER_TEXT}</p>`,
    number: () => `<p>${answer.answer_number || NO_ANSWER_TEXT}</p>`,

    date: () =>
      `<p>${answer.answer_date ? new Date(answer.answer_date).toLocaleDateString('de-DE') : '<em>Kein Datum</em>'}</p>`,
  };

  const formatter = formatters[question.questionType];
  return formatter ? formatter() : '<em>Unbekannter Antworttyp</em>';
}

// Close response modal
function closeResponseModalInternal() {
  const modal = document.querySelector('#responseModal');
  if (modal) {
    modal.remove();
  }
}

// Close modal
function closeModalInternal() {
  document.querySelector('#surveyModal').style.display = 'none';
  currentSurvey = null;
  answers = {};
}

// Show success message
function showSuccessMessage() {
  const overlay = document.createElement('div');
  overlay.className = 'success-overlay';
  overlay.innerHTML = `
    <div class="success-message">
      <div class="success-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="success-text">
        Vielen Dank für Ihre Teilnahme!
      </div>
    </div>
  `;
  document.body.append(overlay);

  // Remove after animation
  setTimeout(() => {
    overlay.remove();
  }, 2000);
}

// Handle text input changes
function handleTextInputChange(target) {
  const questionId = Number.parseInt(target.dataset.questionId);
  const typeMap = {
    number: 'number',
    date: 'date',
  };
  const type = typeMap[target.type] || 'text';
  updateAnswerInternal(questionId, target.value, type);
}

// Handle radio button changes
function handleRadioChange(target) {
  const name = target.name;
  if (!name || !name.startsWith('question_')) return;

  const questionId = Number.parseInt(name.replace('question_', ''));
  if (target.dataset.textValue) {
    // Yes/No questions
    updateAnswerInternal(questionId, target.dataset.textValue, 'text');
  } else {
    // Single choice questions
    updateAnswerInternal(questionId, Number.parseInt(target.value), 'single');
  }
}

// Handle checkbox changes
function handleCheckboxChange(target) {
  const questionId = Number.parseInt(target.dataset.questionId);
  const optionId = Number.parseInt(target.value);
  if (!questionId || Number.isNaN(optionId)) return;

  updateMultipleChoiceInternal(questionId, optionId, target.checked);
}

// Initialize the module
export function init() {
  // Load surveys on init
  loadSurveys();

  // Set up event delegation for all interactive elements
  document.body.addEventListener('click', (e) => {
    if (handleSurveyAction(e)) return;
    if (handleModalClose(e)) return;
    if (handleResponseModalClose(e)) return;
    if (handleRatingClick(e)) return;
  });

  // Handle change events for form inputs
  document.body.addEventListener('change', (e) => {
    const target = e.target;

    const textInputSelector =
      'textarea[data-question-id], input[type="text"][data-question-id], input[type="number"][data-question-id], input[type="date"][data-question-id]';

    if (target.matches(textInputSelector)) {
      handleTextInputChange(target);
    } else if (target.matches('input[type="radio"]')) {
      handleRadioChange(target);
    } else if (target.matches('input[type="checkbox"]')) {
      handleCheckboxChange(target);
    }
  });

  // Set up form submission handler
  const surveyForm = document.querySelector('#surveyForm');
  if (surveyForm) {
    surveyForm.addEventListener('submit', handleSurveySubmit);
  }

  // Make functions available globally for backward compatibility
  window.startSurvey = startSurvey;
  window.updateAnswer = updateAnswer;
  window.updateMultipleChoice = updateMultipleChoice;
  window.selectRating = selectRating;
  window.viewResponse = viewResponse;
  window.closeModal = closeModal;
  window.closeResponseModal = closeResponseModal;
}
