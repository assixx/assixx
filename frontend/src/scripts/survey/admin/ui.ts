/**
 * Survey Administration UI Module
 * Handles all UI rendering, display functions, and DOM manipulation
 */

import { setHTML, escapeHtml } from '../../../utils/dom-utils';
import type { Survey, SurveyTemplate, Department, Team, SurveyQuestion, QuestionOption, Buffer } from './types';

// ============================================
// Display Functions
// ============================================

export function displaySurveys(surveys: Survey[]): void {
  console.log('[SurveyAdmin] Displaying surveys:', surveys);
  console.log(
    '[SurveyAdmin] Survey statuses:',
    surveys.map((s) => ({ id: s.id, status: s.status })),
  );

  const activeSurveys = surveys.filter((s) => s.status === 'active');
  const draftSurveys = surveys.filter((s) => s.status === 'draft');

  console.log('[SurveyAdmin] Active surveys:', activeSurveys.length);
  console.log('[SurveyAdmin] Draft surveys:', draftSurveys.length);

  const activeList = document.querySelector('#activeSurveys');
  const draftList = document.querySelector('#draftSurveys');

  if (activeList !== null) {
    if (activeSurveys.length === 0) {
      setHTML(
        activeList as HTMLElement,
        `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-clipboard-list"></i>
          </div>
          <h3 class="empty-state-title">Keine aktiven Umfragen</h3>
          <p class="empty-state-description">Es gibt derzeit keine aktiven Umfragen. Erstellen Sie eine neue Umfrage oder aktivieren Sie einen Entwurf.</p>
        </div>
      `,
      );
    } else {
      setHTML(activeList as HTMLElement, activeSurveys.map((s) => createSurveyCard(s)).join(''));
    }
  }

  if (draftList !== null) {
    if (draftSurveys.length === 0) {
      setHTML(
        draftList as HTMLElement,
        `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-file-alt"></i>
          </div>
          <h3 class="empty-state-title">Keine Entwürfe</h3>
          <p class="empty-state-description">Sie haben keine Umfrage-Entwürfe. Erstellen Sie eine neue Umfrage und speichern Sie sie als Entwurf.</p>
        </div>
      `,
      );
    } else {
      setHTML(draftList as HTMLElement, draftSurveys.map((s) => createSurveyCard(s)).join(''));
    }
  }
}

export function createSurveyCard(survey: Survey): string {
  const responseCount = survey.responseCount ?? 0;
  const completedCount = survey.completedCount ?? 0;
  const responseRate = responseCount > 0 ? Math.round((completedCount / responseCount) * 100) : 0;
  const isDraft = survey.status === 'draft';
  const onClickAction = isDraft ? 'edit-survey' : 'view-results';
  const surveyId = survey.id ?? 0;
  const status = survey.status ?? 'draft';

  return `
    <div class="survey-card" data-action="${onClickAction}" data-survey-id="${surveyId}">
      <div class="survey-card-header">
        <h3 class="survey-card-title">${getTextFromBuffer(survey.title)}</h3>
        <span class="survey-status ${status}">${getStatusText(status)}</span>
      </div>
      <p class="survey-card-description">${getTextFromBuffer(survey.description) !== '' ? getTextFromBuffer(survey.description) : 'Keine Beschreibung'}</p>
      <div class="survey-stats">
        <div class="survey-stat">
          <i class="fas fa-users"></i>
          <span>${responseCount} Teilnehmer</span>
        </div>
        <div class="survey-stat">
          <i class="fas fa-chart-pie"></i>
          <span>${responseRate}% Abgeschlossen</span>
        </div>
      </div>
      <div class="survey-actions">
        ${
          responseCount === 0
            ? `
          <button class="survey-action-btn" data-action="edit-survey" data-survey-id="${surveyId}">
            <i class="fas fa-edit"></i>
            Bearbeiten
          </button>
        `
            : ''
        }
        ${
          !isDraft
            ? `
          <button class="survey-action-btn" data-action="view-results" data-survey-id="${surveyId}">
            <i class="fas fa-chart-bar"></i>
            Ergebnisse
          </button>
        `
            : ''
        }
        <button class="survey-action-btn" data-action="delete-survey" data-survey-id="${surveyId}">
          <i class="fas fa-trash"></i>
          Löschen
        </button>
      </div>
    </div>
  `;
}

export function displayTemplates(templates: SurveyTemplate[]): void {
  const container = document.querySelector('#surveyTemplates');
  if (container === null) return;

  if (templates.length === 0) {
    setHTML(
      container as HTMLElement,
      `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-folder-open"></i>
        </div>
        <h3 class="empty-state-title">Keine Vorlagen verfügbar</h3>
        <p class="empty-state-description">Es sind noch keine Umfragevorlagen vorhanden. Vorlagen werden automatisch erstellt, wenn Sie eine Umfrage als Vorlage speichern.</p>
      </div>
    `,
    );
    return;
  }

  const html = templates
    .map(
      (template) => `
    <div class="template-card" data-action="create-from-template" data-survey-id="${template.id}">
      <h4>${escapeHtml(template.name)}</h4>
      <p>${escapeHtml(template.description)}</p>
      <span class="template-category">${escapeHtml(template.category)}</span>
    </div>
  `,
    )
    .join('');

  setHTML(container as HTMLElement, html);
}

export function displayDepartmentOptions(departments: Department[]): void {
  const select = document.querySelector<HTMLSelectElement>('#departmentSelect');
  if (select === null) return;

  console.log('[SurveyAdmin] displayDepartmentOptions called with:', departments);

  const optionsHtml = departments
    .map((dept) => {
      // Debug: Log each department object
      console.log('[SurveyAdmin] Department object:', dept);
      console.log('[SurveyAdmin] employeeCount:', dept.employeeCount);
      console.log('[SurveyAdmin] employee_count:', dept.employee_count);
      console.log('[SurveyAdmin] member_count:', dept.member_count);
      console.log('[SurveyAdmin] memberCount:', dept.memberCount);

      // Try different possible field names for member count
      const memberCount = dept.employeeCount ?? dept.employee_count ?? dept.member_count ?? dept.memberCount ?? 0;
      console.log('[SurveyAdmin] Final memberCount for', dept.name, ':', memberCount);

      return `<option value="${dept.id}">${escapeHtml(dept.name)} (${memberCount} Mitglieder)</option>`;
    })
    .join('');
  setHTML(select, optionsHtml);
}

export function displayTeamOptions(teams: Team[]): void {
  const select = document.querySelector<HTMLSelectElement>('#teamSelect');
  if (select === null) return;

  const optionsHtml = teams
    .map((team) => {
      // Try different possible field names for member count
      const memberCount = team.member_count ?? team.memberCount ?? 0;
      return `<option value="${team.id}">${escapeHtml(team.name)} (${memberCount} Mitglieder)</option>`;
    })
    .join('');
  setHTML(select, optionsHtml);
}

// ============================================
// Question UI Functions
// ============================================

export function createQuestionTypeDropdown(questionId: string): string {
  return `
    <div class="custom-dropdown">
      <div class="dropdown-display" id="${questionId}_typeDisplay"
           data-action="toggle-dropdown" data-params="${questionId}_type">
        <span>Textantwort</span>
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="dropdown-options" id="${questionId}_typeDropdown">
        <div class="dropdown-option" data-action="select-question-type" data-params="${questionId}|text|Textantwort">
          Textantwort
        </div>
        <div class="dropdown-option" data-action="select-question-type" data-params="${questionId}|single_choice|Einzelauswahl">
          Einzelauswahl
        </div>
        <div class="dropdown-option" data-action="select-question-type" data-params="${questionId}|multiple_choice|Mehrfachauswahl">
          Mehrfachauswahl
        </div>
        <div class="dropdown-option" data-action="select-question-type" data-params="${questionId}|rating|Bewertung (1-5)">
          Bewertung (1-5)
        </div>
        <div class="dropdown-option" data-action="select-question-type" data-params="${questionId}|yes_no|Ja/Nein">
          Ja/Nein
        </div>
        <div class="dropdown-option" data-action="select-question-type" data-params="${questionId}|number|Zahl">
          Zahl
        </div>
        <div class="dropdown-option" data-action="select-question-type" data-params="${questionId}|date|Datum">
          Datum
        </div>
      </div>
      <input type="hidden" id="${questionId}_typeValue" value="text">
    </div>
  `;
}

export function createQuestionHtml(questionId: string, questionNumber: number): string {
  return `
    <div class="question-item" id="${questionId}">
      <div class="question-header">
        <span class="question-number">${questionNumber}</span>
        <button type="button" class="remove-question" data-action="remove-question" data-params="${questionId}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="form-group">
        <input type="text" class="form-control" id="${questionId}_text"
               placeholder="Fragetext eingeben..." required>
      </div>

      <div class="question-controls">
        ${createQuestionTypeDropdown(questionId)}

        <label class="checkbox-label">
          <input type="checkbox" id="${questionId}_required" checked>
          <span class="checkbox-custom"></span>
          <span class="checkbox-text">Pflichtfrage</span>
        </label>
      </div>

      <div id="${questionId}_options" style="display: none;">
        <div class="options-header">
          <label class="form-label">Antwortoptionen</label>
          <button type="button" class="add-option-btn" data-action="add-option" data-params="${questionId}">
            <i class="fas fa-plus"></i> Option hinzufügen
          </button>
        </div>
        <div id="${questionId}_option_list" class="option-list"></div>
      </div>
    </div>
  `;
}

export function createOptionHtml(optionText = ''): string {
  return `
    <div class="option-item">
      <input type="text" class="option-input" placeholder="Option eingeben..." value="${escapeHtml(optionText)}">
      <button type="button" class="remove-option" data-action="remove-option">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
}

export function updateQuestionTypeDisplay(questionElement: Element, qType: string): void {
  const typeDisplay = questionElement.querySelector('[id$="_typeDisplay"] span');
  if (!typeDisplay) return;

  const typeLabels: Record<string, string> = {
    text: 'Textantwort',
    single_choice: 'Einzelauswahl',
    multiple_choice: 'Mehrfachauswahl',
    rating: 'Bewertung (1-5)',
    yes_no: 'Ja/Nein',
    number: 'Zahl',
    date: 'Datum',
  };

  const validTypes = ['text', 'single_choice', 'multiple_choice', 'rating', 'yes_no', 'number', 'date'];
  // eslint-disable-next-line security/detect-object-injection
  const labelText = validTypes.includes(qType) ? typeLabels[qType] : 'Textantwort';
  typeDisplay.textContent = labelText;
}

export function populateQuestionFields(questionElement: Element, question: SurveyQuestion): void {
  // Set question text
  const textInput = questionElement.querySelector<HTMLInputElement>('input[type="text"]');
  if (textInput !== null) {
    textInput.value = getTextFromBuffer(question.questionText);
  }

  // Set question type
  const typeInput = questionElement.querySelector<HTMLInputElement>('input[type="hidden"][id$="_typeValue"]');
  if (typeInput !== null) {
    const qType = question.questionType;
    typeInput.value = qType;
    updateQuestionTypeDisplay(questionElement, qType);
  }

  // Set required checkbox
  const requiredCheckbox = questionElement.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (requiredCheckbox !== null) {
    requiredCheckbox.checked = toBool(question.isRequired);
  }
}

export function populateQuestionOptions(
  questionElement: Element,
  question: SurveyQuestion,
  questionCounter: number,
): void {
  if (!question.options || question.options.length === 0) return;

  const optionsList = questionElement.querySelector(`#question_${questionCounter}_option_list`);
  if (optionsList === null) return;

  optionsList.innerHTML = '';
  question.options.forEach((option: string | QuestionOption) => {
    const optionText = typeof option === 'string' ? option : option.option_text;
    const optionHtml = createOptionHtml(optionText);
    const tempDiv = document.createElement('div');
    setHTML(tempDiv, optionHtml);
    const optionElement = tempDiv.firstElementChild;
    if (optionElement !== null) {
      optionsList.append(optionElement);
    }
  });
}

// ============================================
// Utility Functions for UI
// ============================================

export function getTextFromBuffer(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  const bufferValue = value as Buffer | null | undefined;
  if (bufferValue?.type === 'Buffer' && Array.isArray(bufferValue.data)) {
    return new TextDecoder().decode(new Uint8Array(bufferValue.data));
  }
  const dataValue = value as { data?: string } | null | undefined;
  if (dataValue?.data !== undefined && typeof dataValue.data === 'string') {
    return dataValue.data;
  }
  return '';
}

export function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    draft: 'Entwurf',
    active: 'Aktiv',
    paused: 'Pausiert',
    completed: 'Abgeschlossen',
    archived: 'Archiviert',
  };
  // Validate status is one of the known keys to prevent object injection
  const validStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];
  // Safe: status is validated to be in validStatuses before accessing statusMap
  // eslint-disable-next-line security/detect-object-injection
  return validStatuses.includes(status) ? statusMap[status] : status;
}

export function toBool(value: unknown): boolean {
  return value === '1' || value === 1 || value === true;
}

export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00`;
}

export function setElementVisibility(element: HTMLElement | null, show: boolean): void {
  if (element === null) return;

  if (show) {
    element.classList.remove('u-hidden');
  } else {
    element.classList.add('u-hidden');
  }
}

export function updateQuestionNumbers(): void {
  document.querySelectorAll('.question-item').forEach((item, index) => {
    const numberSpan = item.querySelector('.question-number');
    if (numberSpan) {
      numberSpan.textContent = `${index + 1}`;
    }
  });
}
