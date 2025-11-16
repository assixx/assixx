/**
 * Survey Administration UI Module
 * Handles all UI rendering, display functions, and DOM manipulation
 */

import { setHTML, escapeHtml } from '../../../utils/dom-utils';
import type { Survey, SurveyTemplate, Department, Team, Area, SurveyQuestion, QuestionOption, Buffer } from './types';

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
          <div class="empty-state__icon">
            <i class="fas fa-clipboard-list"></i>
          </div>
          <h3 class="empty-state__title">Keine aktiven Umfragen</h3>
          <p class="empty-state__description">Es gibt derzeit keine aktiven Umfragen. Erstellen Sie eine neue Umfrage oder aktivieren Sie einen Entwurf.</p>
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
          <div class="empty-state__icon">
            <i class="fas fa-file-alt"></i>
          </div>
          <h3 class="empty-state__title">Keine Entwürfe</h3>
          <p class="empty-state__description">Sie haben keine Umfrage-Entwürfe. Erstellen Sie eine neue Umfrage und speichern Sie sie als Entwurf.</p>
        </div>
      `,
      );
    } else {
      setHTML(draftList as HTMLElement, draftSurveys.map((s) => createSurveyCard(s)).join(''));
    }
  }
}

/**
 * Format date for display in survey card
 */
function formatSurveyDate(dateStr: string | Date | undefined): string {
  if (dateStr === undefined || dateStr === '') return '';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`;
}

export function createSurveyCard(survey: Survey): string {
  const responseCount = survey.responseCount ?? 0;
  const completedCount = survey.completedCount ?? 0;
  const responseRate = responseCount > 0 ? Math.round((completedCount / responseCount) * 100) : 0;
  const isDraft = survey.status === 'draft';
  const onClickAction = isDraft ? 'edit-survey' : 'view-results';
  const surveyId = survey.id ?? 0;
  const status = survey.status ?? 'draft';
  const badgeClass = getStatusBadgeClass(status);

  // Format date range
  const startDate = formatSurveyDate(survey.startDate);
  const endDate = formatSurveyDate(survey.endDate);
  const dateRange = startDate !== '' && endDate !== '' ? `${startDate} - ${endDate}` : '';

  return `
    <div class="card card--clickable" data-action="${onClickAction}" data-survey-id="${surveyId}">
      <div class="flex justify-between items-start mb-4">
        <h3 class="text-xl font-semibold text-primary m-0">${getTextFromBuffer(survey.title)}</h3>
        <span class="badge ${badgeClass} badge--uppercase">${getStatusText(status)}</span>
      </div>
      <p class="mb-4 text-sm leading-relaxed text-secondary">${getTextFromBuffer(survey.description) !== '' ? getTextFromBuffer(survey.description) : 'Keine Beschreibung'}</p>
      ${
        dateRange !== ''
          ? `
      <div class="mb-4 text-sm text-secondary flex items-center gap-2">
        <i class="fas fa-calendar-alt"></i>
        <span>${dateRange}</span>
      </div>
      `
          : ''
      }
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
          <button class="btn btn-secondary" data-action="edit-survey" data-survey-id="${surveyId}">
            <i class="fas fa-edit"></i>
            Bearbeiten
          </button>
        `
            : ''
        }
        ${
          !isDraft
            ? `
          <button class="btn btn-secondary" data-action="view-results" data-survey-id="${surveyId}">
            <i class="fas fa-chart-bar"></i>
            Ergebnisse
          </button>
        `
            : ''
        }
        <button class="btn btn-secondary" data-action="delete-survey" data-survey-id="${surveyId}">
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
        <div class="empty-state__icon">
          <i class="fas fa-folder-open"></i>
        </div>
        <h3 class="empty-state__title">Keine Vorlagen verfügbar</h3>
        <p class="empty-state__description">Es sind noch keine Umfragevorlagen vorhanden. Vorlagen werden automatisch erstellt, wenn Sie eine Umfrage als Vorlage speichern.</p>
      </div>
    `,
    );
    return;
  }

  const html = templates
    .map(
      (template) => `
    <div class="card card--clickable" data-action="create-from-template" data-survey-id="${template.id}">
      <h4 class="mb-2 font-semibold text-primary">${escapeHtml(template.name)}</h4>
      <p class="text-sm leading-normal text-secondary">${escapeHtml(template.description)}</p>
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

export function displayAreaOptions(areas: Area[]): void {
  const select = document.querySelector<HTMLSelectElement>('#areaSelect');
  if (select === null) return;

  const optionsHtml = areas
    .map((area) => {
      return `<option value="${area.id}">${escapeHtml(area.name)}</option>`;
    })
    .join('');
  setHTML(select, optionsHtml);
}

// ============================================
// Question UI Functions
// ============================================

export function createQuestionTypeDropdown(questionId: string): string {
  return `
    <div class="dropdown" data-dropdown="${questionId}_type">
      <div class="dropdown__trigger" id="${questionId}_typeDisplay" data-action="toggle-dropdown" data-params="${questionId}_type">
        <span>Textantwort</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="dropdown__menu" id="${questionId}_typeDropdown">
        <div class="dropdown__option" data-action="select-question-type" data-params="${questionId}|text|Textantwort">
          Textantwort
        </div>
        <div class="dropdown__option" data-action="select-question-type" data-params="${questionId}|single_choice|Einzelauswahl">
          Einzelauswahl
        </div>
        <div class="dropdown__option" data-action="select-question-type" data-params="${questionId}|multiple_choice|Mehrfachauswahl">
          Mehrfachauswahl
        </div>
        <div class="dropdown__option" data-action="select-question-type" data-params="${questionId}|rating|Bewertung (1-5)">
          Bewertung (1-5)
        </div>
        <div class="dropdown__option" data-action="select-question-type" data-params="${questionId}|yes_no|Ja/Nein">
          Ja/Nein
        </div>
        <div class="dropdown__option" data-action="select-question-type" data-params="${questionId}|number|Zahl">
          Zahl
        </div>
        <div class="dropdown__option" data-action="select-question-type" data-params="${questionId}|date|Datum">
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

      <div class="form-field">
        <input type="text" class="form-field__control" id="${questionId}_text"
               placeholder="Fragetext eingeben..." required>
      </div>

      <div class="question-controls mb-4">
        ${createQuestionTypeDropdown(questionId)}

        <div class="flex items-center gap-3 mt-2">
          <input type="checkbox" id="${questionId}_required" checked class="w-5 h-5 cursor-pointer">
          <label for="${questionId}_required" class="cursor-pointer">Pflichtfrage</label>
        </div>
      </div>

      <div id="${questionId}_options" class="hidden">
        <div class="options-header">
          <label class="form-field__label">Antwortoptionen</label>
          <button type="button" class="add-option-btn" data-action="add-option" data-params="${questionId}">
            <i class="fas fa-plus"></i> Option hinzufügen
          </button>
        </div>
        <div id="${questionId}_option_list" class="option-list"></div>
      </div>
    </div>
  `;
}

export function createOptionHtml(optionText: string = ''): string {
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
    closed: 'Geschlossen',
  };
  // Validate status is one of the known keys to prevent object injection
  const validStatuses = ['draft', 'active', 'paused', 'completed', 'archived', 'closed'];
  // Safe: status is validated to be in validStatuses before accessing statusMap
  // eslint-disable-next-line security/detect-object-injection
  return validStatuses.includes(status) ? statusMap[status] : status;
}

/**
 * Maps survey status to Design System badge class
 * @param status - Survey status (draft, active, closed, archived)
 * @returns Design System badge variant class
 */
export function getStatusBadgeClass(status: string): string {
  const badgeMap: Record<string, string> = {
    draft: 'badge--warning', // Orange
    active: 'badge--success', // Green
    closed: 'badge--danger', // Red
    archived: 'badge--secondary', // Gray
    paused: 'badge--warning', // Orange
    completed: 'badge--success', // Green
  };
  const validStatuses = ['draft', 'active', 'closed', 'archived', 'paused', 'completed'];
  // Safe: status is validated to be in validStatuses before accessing statusMap
  // eslint-disable-next-line security/detect-object-injection
  return validStatuses.includes(status) ? badgeMap[status] : 'badge--secondary';
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
    // Design System: Use Tailwind 'hidden' class instead of custom 'u-hidden'
    element.classList.remove('hidden');
  } else {
    element.classList.add('hidden');
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
