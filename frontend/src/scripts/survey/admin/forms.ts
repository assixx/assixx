/* eslint-disable max-lines */
/**
 * Survey Administration - Forms Layer
 * Form handling, validation, and modal management
 */

import { $, setHTML } from '../../../utils/dom-utils';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import type { Survey, SurveyQuestion, SurveyAssignment, SurveyId } from './types';
import {
  createQuestionHtml,
  createOptionHtml,
  getTextFromBuffer,
  toBool,
  setElementVisibility,
  updateQuestionNumbers,
  populateQuestionFields,
  populateQuestionOptions,
  displaySurveys,
} from './ui';
import { setCurrentSurveyId, saveSurvey as saveSurveyAPI, loadSurveyById, loadTemplateById, loadSurveys } from './data';

// ===== CONSTANTS =====
const MODAL_TEMPLATE_ID = '#surveyModal';
const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

// ===== DOM ELEMENT SELECTORS =====
const SELECTORS = {
  SURVEY_FORM: '#surveyForm',
  SURVEY_TITLE: '#surveyTitle',
  SURVEY_DESCRIPTION: '#surveyDescription',
  IS_ANONYMOUS: '#isAnonymous',
  IS_MANDATORY: '#isMandatory',
  START_DATE: '#startDate',
  START_TIME: '#startTime',
  END_DATE: '#endDate',
  END_TIME: '#endTime',
  ASSIGNMENT_TYPE: '#assignmentType',
  AREA_SELECT: '#areaSelect',
  DEPARTMENT_SELECT: '#departmentSelect',
  TEAM_SELECT: '#teamSelect',
  QUESTIONS_LIST: '#questionsList',
  MODAL_TITLE: '#modalTitle',
  AREA_SELECTION: '#areaSelection',
  DEPARTMENT_SELECTION: '#departmentSelection',
  TEAM_SELECTION: '#teamSelection',
  ASSIGNMENT_DROPDOWN_DISPLAY: '#assignmentDisplay span',
} as const;

// ===== FORM STATE =====
let questionCounter = 0;

function resetQuestionCounter(): void {
  questionCounter = 0;
}

function incrementQuestionCounter(): number {
  return ++questionCounter;
}

// ===== MODAL MANAGEMENT =====

/**
 * Show create/edit modal
 * Supports both numeric IDs and UUIDs
 */
export function showCreateModal(surveyId: SurveyId | null = null): void {
  const modalElement = $(MODAL_TEMPLATE_ID);

  // Reset form
  const form = $(SELECTORS.SURVEY_FORM) as HTMLFormElement;
  form.reset();

  // Clear any existing error states
  clearFormErrors();

  // Clear questions
  const questionsList = $(SELECTORS.QUESTIONS_LIST);
  setHTML(questionsList, '');

  // Reset state
  setCurrentSurveyId(surveyId);
  resetQuestionCounter();

  // Update modal title
  const modalTitle = $(SELECTORS.MODAL_TITLE);
  modalTitle.textContent = surveyId !== null ? 'Umfrage bearbeiten' : 'Neue Umfrage erstellen';

  // Setup real-time date/time validation
  setupDateTimeValidation();

  // Setup optional question controls visibility
  setupOptionalQuestionControls();

  // If editing, load survey data
  if (surveyId !== null) {
    void loadAndPopulateSurvey(surveyId);
  } else {
    // Add default question for new surveys
    addQuestion();
  }

  // Show modal
  modalElement.classList.add(MODAL_ACTIVE_CLASS);
}

/**
 * Setup real-time validation for date/time inputs
 */
function setupDateTimeValidation(): void {
  const startDateInput = $(SELECTORS.START_DATE) as HTMLInputElement | null;
  const startTimeInput = $(SELECTORS.START_TIME) as HTMLInputElement | null;
  const endDateInput = $(SELECTORS.END_DATE) as HTMLInputElement | null;
  const endTimeInput = $(SELECTORS.END_TIME) as HTMLInputElement | null;

  // Remove old listeners first to prevent duplicates
  [startDateInput, startTimeInput, endDateInput, endTimeInput].forEach((input) => {
    if (input !== null) {
      input.removeEventListener('change', validateDateTimeInputs);
      input.removeEventListener('blur', validateDateTimeInputs);
    }
  });

  // Add new change listeners to all date/time inputs
  [startDateInput, startTimeInput, endDateInput, endTimeInput].forEach((input) => {
    if (input !== null) {
      input.addEventListener('change', validateDateTimeInputs);
      input.addEventListener('blur', validateDateTimeInputs);
    }
  });
}

/**
 * Setup optional question controls visibility based on is_mandatory checkbox
 * Logic: Optional question checkboxes only visible when survey is mandatory
 */
function setupOptionalQuestionControls(): void {
  const isMandatoryCheckbox = $(SELECTORS.IS_MANDATORY) as HTMLInputElement | null;

  if (isMandatoryCheckbox === null) return;

  // Remove old listener first to prevent duplicates
  isMandatoryCheckbox.removeEventListener('change', toggleOptionalQuestionControls);

  // Add new change listener
  isMandatoryCheckbox.addEventListener('change', toggleOptionalQuestionControls);

  // Set initial state
  toggleOptionalQuestionControls();
}

/**
 * Toggle visibility of optional question controls
 */
function toggleOptionalQuestionControls(): void {
  const isMandatoryCheckbox = $(SELECTORS.IS_MANDATORY) as HTMLInputElement | null;
  const optionalControls = document.querySelectorAll('.optional-question-control');

  if (isMandatoryCheckbox === null) return;

  // Show optional question controls ONLY when survey is mandatory
  if (isMandatoryCheckbox.checked) {
    optionalControls.forEach((control) => {
      control.classList.remove('hidden');
    });
  } else {
    optionalControls.forEach((control) => {
      control.classList.add('hidden');
    });
  }
}

/**
 * Close modal
 */
export function closeModal(): void {
  const modalElement = $(MODAL_TEMPLATE_ID);
  modalElement.classList.remove(MODAL_ACTIVE_CLASS);

  // Clean up validation listeners
  const startDateInput = $(SELECTORS.START_DATE) as HTMLInputElement | null;
  const startTimeInput = $(SELECTORS.START_TIME) as HTMLInputElement | null;
  const endDateInput = $(SELECTORS.END_DATE) as HTMLInputElement | null;
  const endTimeInput = $(SELECTORS.END_TIME) as HTMLInputElement | null;

  [startDateInput, startTimeInput, endDateInput, endTimeInput].forEach((input) => {
    if (input !== null) {
      input.removeEventListener('change', validateDateTimeInputs);
      input.removeEventListener('blur', validateDateTimeInputs);
    }
  });
}

/**
 * Load and populate survey for editing
 * Supports both numeric IDs and UUIDs
 */
async function loadAndPopulateSurvey(surveyId: SurveyId): Promise<void> {
  const survey = await loadSurveyById(surveyId);
  if (survey === null) {
    showErrorAlert('Umfrage konnte nicht geladen werden');
    closeModal();
    return;
  }

  populateSurveyForm(survey);
}

/**
 * Populate form with survey data
 */
function populateSurveyForm(survey: Survey): void {
  // Basic fields
  populateBasicFields(survey);

  // Questions
  if (survey.questions !== undefined && survey.questions.length > 0) {
    populateQuestions(survey);
  }

  // Update visibility of optional question controls after loading
  toggleOptionalQuestionControls();
}

/**
 * Populate basic survey fields
 */
function populateBasicFields(survey: Survey): void {
  populateTextFields(survey);
  populateCheckboxFields(survey);
  populateDateFields(survey);
  populateAssignmentFields(survey);
}

/**
 * Populate text input fields (title, description)
 */
function populateTextFields(survey: Survey): void {
  const titleInput = $(SELECTORS.SURVEY_TITLE) as HTMLInputElement | null;
  if (titleInput !== null) {
    titleInput.value = getTextFromBuffer(survey.title);
  }

  const descriptionTextarea = $(SELECTORS.SURVEY_DESCRIPTION) as HTMLTextAreaElement | null;
  if (descriptionTextarea !== null) {
    descriptionTextarea.value = getTextFromBuffer(survey.description);
  }
}

/**
 * Populate checkbox fields (anonymous, mandatory)
 */
function populateCheckboxFields(survey: Survey): void {
  const isAnonymousCheckbox = $(SELECTORS.IS_ANONYMOUS) as HTMLInputElement | null;
  if (isAnonymousCheckbox !== null) {
    isAnonymousCheckbox.checked = toBool(survey.isAnonymous);
  }

  const isMandatoryCheckbox = $(SELECTORS.IS_MANDATORY) as HTMLInputElement | null;
  if (isMandatoryCheckbox !== null) {
    isMandatoryCheckbox.checked = toBool(survey.isMandatory);
  }
}

/**
 * Populate date fields (start date, end date)
 */
function populateDateFields(survey: Survey): void {
  const startDateInput = $(SELECTORS.START_DATE) as HTMLInputElement | null;
  const startTimeInput = $(SELECTORS.START_TIME) as HTMLInputElement | null;
  if (startDateInput !== null && startTimeInput !== null && survey.startDate !== undefined) {
    const date = new Date(survey.startDate);
    startDateInput.value = date.toISOString().split('T')[0] ?? '';
    // Use UTC time to avoid timezone conversion
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    startTimeInput.value = `${hours}:${minutes}`;
  }

  const endDateInput = $(SELECTORS.END_DATE) as HTMLInputElement | null;
  const endTimeInput = $(SELECTORS.END_TIME) as HTMLInputElement | null;
  if (endDateInput !== null && endTimeInput !== null && survey.endDate !== undefined) {
    const date = new Date(survey.endDate);
    endDateInput.value = date.toISOString().split('T')[0] ?? '';
    // Use UTC time to avoid timezone conversion
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    endTimeInput.value = `${hours}:${minutes}`;
  }
}

/**
 * Populate assignment fields
 */
function populateAssignmentFields(survey: Survey): void {
  if (survey.assignments === undefined || survey.assignments.length === 0) {
    return;
  }

  const assignment = survey.assignments[0];
  if (assignment === undefined) {
    return;
  }

  // Use assignmentType to determine which fields to populate
  switch (assignment.assignmentType ?? assignment.type) {
    case 'all_users':
      populateAllUsersAssignment();
      break;
    case 'area':
      populateAreaAssignment(survey);
      break;
    case 'department':
      populateDepartmentAssignment(survey);
      break;
    case 'team':
      populateTeamAssignment(survey);
      break;
    default:
      console.warn('Unknown assignment type:', assignment);
  }
}

/**
 * Populate all users assignment
 */
function populateAllUsersAssignment(): void {
  const assignmentTypeInput = $(SELECTORS.ASSIGNMENT_TYPE) as HTMLInputElement | null;
  if (assignmentTypeInput !== null) {
    assignmentTypeInput.value = 'all_users';
  }
  updateAssignmentDropdown('all_users', 'Alle Mitarbeiter');
}

/**
 * Populate area assignment
 */
function populateAreaAssignment(survey: Survey): void {
  const assignmentTypeInput = $(SELECTORS.ASSIGNMENT_TYPE) as HTMLInputElement | null;
  if (assignmentTypeInput !== null) {
    assignmentTypeInput.value = 'area';
  }
  updateAssignmentDropdown('area', 'Bereich');

  const areaSelect = $(SELECTORS.AREA_SELECT) as HTMLSelectElement | null;
  if (areaSelect !== null) {
    const areaIds =
      survey.assignments
        ?.filter((a): a is typeof a & { areaId: number } => a.areaId != null)
        .map((a) => String(a.areaId)) ?? [];

    Array.from(areaSelect.options).forEach((option) => {
      option.selected = areaIds.includes(option.value);
    });
  }
}

/**
 * Populate department assignment
 */
function populateDepartmentAssignment(survey: Survey): void {
  const assignmentTypeInput = $(SELECTORS.ASSIGNMENT_TYPE) as HTMLInputElement | null;
  if (assignmentTypeInput !== null) {
    assignmentTypeInput.value = 'department';
  }
  updateAssignmentDropdown('department', 'Abteilung');

  const departmentSelect = $(SELECTORS.DEPARTMENT_SELECT) as HTMLSelectElement | null;
  if (departmentSelect !== null) {
    const departmentIds =
      survey.assignments?.filter((a) => a.departmentId !== undefined).map((a) => String(a.departmentId)) ?? [];

    Array.from(departmentSelect.options).forEach((option) => {
      option.selected = departmentIds.includes(option.value);
    });
  }
}

/**
 * Populate team assignment
 */
function populateTeamAssignment(survey: Survey): void {
  const assignmentTypeInput = $(SELECTORS.ASSIGNMENT_TYPE) as HTMLInputElement | null;
  if (assignmentTypeInput !== null) {
    assignmentTypeInput.value = 'team';
  }
  updateAssignmentDropdown('team', 'Team');

  const teamSelect = $(SELECTORS.TEAM_SELECT) as HTMLSelectElement | null;
  if (teamSelect !== null) {
    const teamIds = survey.assignments?.filter((a) => a.teamId !== undefined).map((a) => String(a.teamId)) ?? [];

    Array.from(teamSelect.options).forEach((option) => {
      option.selected = teamIds.includes(option.value);
    });
  }
}

/**
 * Populate questions
 */
function populateQuestions(survey: Survey): void {
  const questionsList = $(SELECTORS.QUESTIONS_LIST);
  setHTML(questionsList, '');
  resetQuestionCounter();

  if (survey.questions === undefined) return;

  survey.questions.forEach((question) => {
    const questionId = `question_${incrementQuestionCounter()}`;
    const questionHtml = createQuestionHtml(questionId, questionCounter);

    const tempDiv = document.createElement('div');
    setHTML(tempDiv, questionHtml);
    const questionElement = tempDiv.firstElementChild;

    if (questionElement !== null) {
      questionsList.append(questionElement);
      populateQuestionFields(questionElement, question);

      if ((question.options?.length ?? 0) > 0) {
        const optionsContainer = questionElement.querySelector(`#${questionId}_options`);
        if (optionsContainer !== null) {
          optionsContainer.classList.remove('hidden');
        }
        populateQuestionOptions(questionElement, question, questionCounter);
      }
    }
  });
}

/**
 * Update assignment dropdown display
 */
function updateAssignmentDropdown(type: string, text: string): void {
  const dropdownDisplay = $(SELECTORS.ASSIGNMENT_DROPDOWN_DISPLAY);
  dropdownDisplay.textContent = text;

  const areaSelection = $(SELECTORS.AREA_SELECTION);
  const departmentSelection = $(SELECTORS.DEPARTMENT_SELECTION);
  const teamSelection = $(SELECTORS.TEAM_SELECTION);

  setElementVisibility(areaSelection, type === 'area');
  setElementVisibility(departmentSelection, type === 'department');
  setElementVisibility(teamSelection, type === 'team');

  const assignmentTypeInput = $(SELECTORS.ASSIGNMENT_TYPE) as HTMLInputElement;
  assignmentTypeInput.value = type;
}

// ===== QUESTION MANAGEMENT =====

/**
 * Add new question
 */
export function addQuestion(): void {
  const questionsList = $(SELECTORS.QUESTIONS_LIST);
  const questionId = `question_${incrementQuestionCounter()}`;
  const questionHtml = createQuestionHtml(questionId, questionCounter);

  const tempDiv = document.createElement('div');
  setHTML(tempDiv, questionHtml);
  const questionElement = tempDiv.firstElementChild;

  if (questionElement !== null) {
    questionsList.append(questionElement);
    // Update visibility of optional question controls
    toggleOptionalQuestionControls();
  }
}

/**
 * Remove question
 */
export function removeQuestion(questionId: string): void {
  const questionElement = $(`#${questionId}`);
  questionElement.remove();
  updateQuestionNumbers();
}

/**
 * Add option to question
 */
export function addOption(questionId: string): void {
  const optionList = $(`#${questionId}_option_list`);

  const optionHtml = createOptionHtml();
  const tempDiv = document.createElement('div');
  setHTML(tempDiv, optionHtml);
  const optionElement = tempDiv.firstElementChild;
  if (optionElement !== null) {
    optionList.append(optionElement);
  }
}

/**
 * Remove option
 */
export function removeOption(button: HTMLElement): void {
  button.closest('.option-item')?.remove();
}

/**
 * Handle question type change
 */
export function handleQuestionTypeChange(questionId: string, type: string): void {
  const optionsContainer = $(`#${questionId}_options`);

  if (type === 'single_choice' || type === 'multiple_choice') {
    optionsContainer.classList.remove('hidden');

    // Add default options if empty
    const optionList = $(`#${questionId}_option_list`);
    if (optionList.children.length === 0) {
      addOption(questionId);
      addOption(questionId);
    }
  } else {
    optionsContainer.classList.add('hidden');
  }
}

// ===== FORM COLLECTION & VALIDATION =====

/**
 * Get questions data from form
 */
function getQuestionsData(): SurveyQuestion[] {
  const questions: SurveyQuestion[] = [];
  const questionElements = document.querySelectorAll('.question-item');

  questionElements.forEach((element, index) => {
    const questionId = element.id;
    const textInput = element.querySelector<HTMLInputElement>(`#${questionId}_text`);
    const typeInput = element.querySelector<HTMLInputElement>(`#${questionId}_typeValue`);
    const requiredCheckbox = element.querySelector<HTMLInputElement>(`#${questionId}_required`);

    if (textInput === null || typeInput === null) return;

    const questionType = typeInput.value as
      | 'text'
      | 'single_choice'
      | 'multiple_choice'
      | 'rating'
      | 'yes_no'
      | 'number'
      | 'date';

    const question: SurveyQuestion = {
      questionText: textInput.value,
      questionType,
      // INVERTED LOGIC: checked = optional (0), unchecked = required (1)
      isRequired: requiredCheckbox?.checked === true ? 0 : 1,
      orderIndex: index + 1,
    };

    // Collect options for choice questions
    if (typeInput.value === 'single_choice' || typeInput.value === 'multiple_choice') {
      const optionInputs = element.querySelectorAll<HTMLInputElement>(`#${questionId}_option_list .option-input`);
      const options: string[] = [];

      optionInputs.forEach((input) => {
        if (input.value.trim() !== '') {
          options.push(input.value.trim());
        }
      });

      if (options.length > 0) {
        question.options = options;
      }
    }

    questions.push(question);
  });

  return questions;
}

/**
 * Collect assignments based on type
 */
function collectAssignments(): SurveyAssignment[] | null {
  const assignmentType = ($(SELECTORS.ASSIGNMENT_TYPE) as HTMLInputElement | null)?.value;

  switch (assignmentType) {
    case 'all_users':
      return collectAllUsersAssignment();
    case 'area':
      return collectAreaAssignments();
    case 'department':
      return collectDepartmentAssignments();
    case 'team':
      return collectTeamAssignments();
    default:
      showErrorAlert('Bitte wählen Sie eine Zielgruppe aus');
      return null;
  }
}

function collectAllUsersAssignment(): SurveyAssignment[] {
  return [{ type: 'all_users' }];
}

function collectAreaAssignments(): SurveyAssignment[] | null {
  const areaSelect = $(SELECTORS.AREA_SELECT) as HTMLSelectElement | null;
  if (areaSelect === null) return null;

  const selectedOptions = Array.from(areaSelect.selectedOptions);
  if (selectedOptions.length === 0) {
    showErrorAlert('Bitte wählen Sie mindestens einen Bereich aus');
    return null;
  }

  return selectedOptions.map((option) => ({
    type: 'area' as const,
    areaId: Number(option.value),
  }));
}

function collectDepartmentAssignments(): SurveyAssignment[] | null {
  const departmentSelect = $(SELECTORS.DEPARTMENT_SELECT) as HTMLSelectElement | null;
  if (departmentSelect === null) return null;

  const selectedOptions = Array.from(departmentSelect.selectedOptions);
  if (selectedOptions.length === 0) {
    showErrorAlert('Bitte wählen Sie mindestens eine Abteilung aus');
    return null;
  }

  return selectedOptions.map((option) => ({
    type: 'department' as const,
    departmentId: Number(option.value),
  }));
}

function collectTeamAssignments(): SurveyAssignment[] | null {
  const teamSelect = $(SELECTORS.TEAM_SELECT) as HTMLSelectElement | null;
  if (teamSelect === null) return null;

  const selectedOptions = Array.from(teamSelect.selectedOptions);
  if (selectedOptions.length === 0) {
    showErrorAlert('Bitte wählen Sie mindestens ein Team aus');
    return null;
  }

  return selectedOptions.map((option) => ({
    type: 'team' as const,
    teamId: Number(option.value),
  }));
}

/**
 * Collect survey data from form
 */
function collectSurveyData(status: 'draft' | 'active', assignments: SurveyAssignment[]): Survey | null {
  const titleInput = $(SELECTORS.SURVEY_TITLE) as HTMLInputElement | null;
  const descriptionInput = $(SELECTORS.SURVEY_DESCRIPTION) as HTMLTextAreaElement | null;

  if (titleInput === null || descriptionInput === null) {
    showErrorAlert('Formular konnte nicht gelesen werden');
    return null;
  }

  const isAnonymousInput = $(SELECTORS.IS_ANONYMOUS) as HTMLInputElement | null;
  const isMandatoryInput = $(SELECTORS.IS_MANDATORY) as HTMLInputElement | null;
  const startDateInput = $(SELECTORS.START_DATE) as HTMLInputElement | null;
  const startTimeInput = $(SELECTORS.START_TIME) as HTMLInputElement | null;
  const endDateInput = $(SELECTORS.END_DATE) as HTMLInputElement | null;
  const endTimeInput = $(SELECTORS.END_TIME) as HTMLInputElement | null;

  // Combine date and time values (add Z for UTC to match backend expectations)
  let startDateTime = '';
  if (
    startDateInput?.value !== undefined &&
    startDateInput.value !== '' &&
    startTimeInput?.value !== undefined &&
    startTimeInput.value !== ''
  ) {
    startDateTime = `${startDateInput.value}T${startTimeInput.value}:00Z`;
  }

  let endDateTime = '';
  if (
    endDateInput?.value !== undefined &&
    endDateInput.value !== '' &&
    endTimeInput?.value !== undefined &&
    endTimeInput.value !== ''
  ) {
    endDateTime = `${endDateInput.value}T${endTimeInput.value}:00Z`;
  }

  const surveyData: Survey = {
    title: titleInput.value,
    description: descriptionInput.value,
    status,
    isAnonymous: isAnonymousInput?.checked === true,
    isMandatory: isMandatoryInput?.checked === true,
    startDate: startDateTime,
    endDate: endDateTime,
    questions: getQuestionsData(),
    assignments,
  };

  return surveyData;
}

/**
 * Validate survey data
 */
function validateSurveyData(surveyData: Survey): boolean {
  // Clear any previous error states before validating
  clearFormErrors();

  return validateTitle(surveyData) && validateQuestions(surveyData) && validateDates(surveyData);
}

/**
 * Validate survey title
 */
function validateTitle(surveyData: Survey): boolean {
  const title = typeof surveyData.title === 'string' ? surveyData.title : getTextFromBuffer(surveyData.title);
  if (title.trim() === '') {
    addFieldError('surveyTitle');
    showErrorAlert('Bitte geben Sie einen Titel für die Umfrage ein');
    return false;
  }
  return true;
}

/**
 * Validate survey questions
 */
function validateQuestions(surveyData: Survey): boolean {
  if (surveyData.questions === undefined || surveyData.questions.length === 0) {
    showErrorAlert('Bitte fügen Sie mindestens eine Frage hinzu');
    return false;
  }

  for (const [index, question] of surveyData.questions.entries()) {
    if (!validateQuestion(question, index)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate single question
 */
function validateQuestion(question: SurveyQuestion, index: number): boolean {
  const questionText =
    typeof question.questionText === 'string' ? question.questionText : getTextFromBuffer(question.questionText);

  if (questionText.trim() === '') {
    showErrorAlert(`Frage ${index + 1} hat keinen Text`);
    return false;
  }

  if (
    (question.questionType === 'single_choice' || question.questionType === 'multiple_choice') &&
    (question.options?.length ?? 0) < 2
  ) {
    showErrorAlert(`Frage ${index + 1} benötigt mindestens 2 Antwortoptionen`);
    return false;
  }

  return true;
}

/**
 * Clear all form field error states
 */
function clearFormErrors(): void {
  // Clear all date-picker error states
  document.querySelectorAll('.date-picker--error').forEach((element) => {
    element.classList.remove('date-picker--error');
  });

  // Clear all time-picker error states
  document.querySelectorAll('.time-picker--error').forEach((element) => {
    element.classList.remove('time-picker--error');
  });

  // Clear all form field error states
  document.querySelectorAll('.form-field--error').forEach((element) => {
    element.classList.remove('form-field--error');
  });

  // Remove all error messages
  document.querySelectorAll('.picker-error-message').forEach((element) => {
    element.remove();
  });
}

/**
 * Validate date/time inputs in real-time
 */
function validateDateTimeInputs(): void {
  // Clear previous errors
  clearFormErrors();

  const startDateInput = $(SELECTORS.START_DATE) as HTMLInputElement | null;
  const startTimeInput = $(SELECTORS.START_TIME) as HTMLInputElement | null;
  const endDateInput = $(SELECTORS.END_DATE) as HTMLInputElement | null;
  const endTimeInput = $(SELECTORS.END_TIME) as HTMLInputElement | null;

  if (
    startDateInput === null ||
    startTimeInput === null ||
    endDateInput === null ||
    endTimeInput === null ||
    startDateInput.value === '' ||
    endDateInput.value === ''
  ) {
    return; // Not enough data to validate
  }

  // Combine date and time (add Z for UTC to match how we save)
  const startDateTime = new Date(`${startDateInput.value}T${startTimeInput.value}:00Z`);
  const endDateTime = new Date(`${endDateInput.value}T${endTimeInput.value}:00Z`);
  const now = new Date();

  // Check if end is before start
  if (startDateTime >= endDateTime) {
    const errorMsg = 'Das Enddatum muss nach dem Startdatum liegen';
    addFieldError('startDate'); // Error class only, no duplicate message
    addFieldError('endDate', errorMsg); // Show message once at end date
    return;
  }

  // Check if end is in the past
  if (endDateTime <= now) {
    const errorMsg = 'Das Enddatum muss in der Zukunft liegen';
    addFieldError('endDate', errorMsg);
  }
}

/**
 * Add error class to element's parent container (no message)
 */
function addErrorToContainer(element: Element | null, containerClass: string, errorClass: string): void {
  if (element === null) return;
  const container = element.closest(`.${containerClass}`);
  if (container === null) return;

  // Add error class
  container.classList.add(errorClass);
}

/**
 * Add error message to a field's container
 */
function addErrorMessage(fieldId: string, errorMessage: string): void {
  const field = document.getElementById(fieldId);
  if (field === null) return;

  // Find the primary container (date-picker or time-picker)
  const datePicker = field.closest('.date-picker');
  const timePicker = field.closest('.time-picker');
  const primaryContainer = datePicker ?? timePicker;

  if (primaryContainer === null) return;

  // Check if error message already exists in the parent
  const existingError = primaryContainer.parentElement?.querySelector('.picker-error-message');
  if (existingError !== null && existingError !== undefined) {
    return; // Message already exists, don't add duplicate
  }

  // Create error message element
  const errorSpan = document.createElement('span');
  errorSpan.className = 'picker-error-message';
  errorSpan.style.cssText = 'display: block; margin-top: 6px; font-size: 13px; color: #f44336;';
  setHTML(errorSpan, `<i class="fas fa-times-circle"></i> ${errorMessage}`);

  // Insert after the picker container
  primaryContainer.parentElement?.insertBefore(errorSpan, primaryContainer.nextSibling);
}

/**
 * Add error state to related time field
 */
function addErrorToRelatedTimeField(timeFieldId: string): void {
  const timeField = document.getElementById(timeFieldId);
  addErrorToContainer(timeField, 'time-picker', 'time-picker--error');
}

/**
 * Add error state to a form field with optional error message
 */
function addFieldError(fieldId: string, errorMessage?: string): void {
  const field = document.getElementById(fieldId);
  if (field === null) return;

  // Add error states to parent containers (classes only)
  addErrorToContainer(field, 'date-picker', 'date-picker--error');
  addErrorToContainer(field, 'time-picker', 'time-picker--error');
  addErrorToContainer(field, 'form-field', 'form-field--error');

  // Add error message once
  if (errorMessage !== undefined && errorMessage !== '') {
    addErrorMessage(fieldId, errorMessage);
  }

  // For date fields, also add error to the related time field
  if (fieldId === 'startDate') {
    addErrorToRelatedTimeField('startTime');
  } else if (fieldId === 'endDate') {
    addErrorToRelatedTimeField('endTime');
  }
}

/**
 * Validate survey dates for active surveys
 */
function validateDates(surveyData: Survey): boolean {
  if (surveyData.status !== 'active') {
    return true;
  }

  const now = new Date();
  const startDate =
    surveyData.startDate !== undefined && surveyData.startDate !== '' ? new Date(surveyData.startDate) : null;
  const endDate = surveyData.endDate !== undefined && surveyData.endDate !== '' ? new Date(surveyData.endDate) : null;

  if (startDate !== null && endDate !== null && startDate >= endDate) {
    const errorMsg = 'Das Enddatum muss nach dem Startdatum liegen';
    // Add error states to both date fields with error message
    addFieldError('startDate', errorMsg);
    addFieldError('endDate', errorMsg);
    showErrorAlert(errorMsg);
    return false;
  }

  if (endDate !== null && endDate <= now) {
    const errorMsg = 'Das Enddatum muss in der Zukunft liegen';
    // Add error state to end date field with error message
    addFieldError('endDate', errorMsg);
    showErrorAlert(errorMsg);
    return false;
  }

  return true;
}

/**
 * Save survey (handles both save as draft and activate)
 */
export async function saveSurvey(status: 'draft' | 'active'): Promise<void> {
  const assignments = collectAssignments();
  if (assignments === null) return;

  const surveyData = collectSurveyData(status, assignments);
  if (surveyData === null) return;

  if (!validateSurveyData(surveyData)) return;

  try {
    const surveyId = await saveSurveyAPI(surveyData);

    if (surveyId !== null) {
      await handleSurveySaveSuccess(status);
    } else {
      showErrorAlert('Umfrage konnte nicht gespeichert werden');
    }
  } catch (error) {
    console.error('Error saving survey:', error);
    showErrorAlert('Fehler beim Speichern der Umfrage');
  }
}

/**
 * Handle successful survey save
 */
async function handleSurveySaveSuccess(status: 'draft' | 'active'): Promise<void> {
  // Assignments are already saved as part of the survey update/create request
  // No separate API call needed

  const message = getSaveSuccessMessage(status);
  showSuccessAlert(message);
  closeModal();

  await reloadSurveys();
}

/**
 * Get success message based on survey status
 */
function getSaveSuccessMessage(status: 'draft' | 'active'): string {
  return status === 'active' ? 'Umfrage wurde erfolgreich gestartet' : 'Umfrage wurde als Entwurf gespeichert';
}

/**
 * Reload and display surveys
 */
async function reloadSurveys(): Promise<void> {
  const surveys = await loadSurveys();
  displaySurveys(surveys);
}

/**
 * Create survey from template
 */
export async function createFromTemplate(templateId: number): Promise<void> {
  const template = await loadTemplateById(templateId);
  if (template === null) {
    showErrorAlert('Vorlage konnte nicht geladen werden');
    return;
  }

  // Convert template to survey
  const survey: Survey = {
    title: template.name,
    description: template.description,
    status: 'draft',
    isAnonymous: 0,
    isMandatory: 0,
    questions: template.questions,
    assignments: [],
  };

  // Show modal with template data
  showCreateModal(null);
  populateSurveyForm(survey);
}
