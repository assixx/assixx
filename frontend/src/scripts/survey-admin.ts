/**
 * Survey Administration Module
 * Manages survey CRUD operations, questions, and assignments
 */

import { ApiClient } from '../utils/api-client';
import { showSuccessAlert, showErrorAlert, showConfirm, showAlert } from './utils/alerts';
import { $, setHTML, escapeHtml } from '../utils/dom-utils';
import { modalManager } from './utils/modal-manager';
import { featureFlags } from '../utils/feature-flags';

// ============================================
// Type Definitions
// ============================================

// Window extensions
interface WindowWithExtensions {
  surveyAdmin?: SurveyAdminManager;
}

interface SurveyQuestion {
  id?: number;
  questionText: string;
  questionType: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'yes_no' | 'number' | 'date';
  isRequired: boolean;
  orderPosition: number;
  options?: string[] | QuestionOption[];
  // Legacy field names
  is_required?: boolean;
}

interface QuestionOption {
  option_text: string;
}

interface SurveyAssignment {
  type: 'all_users' | 'department' | 'team' | 'user';
  departmentId?: number;
  teamId?: number;
  userId?: number;
  // Legacy field names
  assignmentType?: string;
  assignment_type?: string;
  department_id?: number;
  team_id?: number;
}

interface Survey {
  id?: number;
  title: string | Buffer;
  description: string | Buffer;
  type?: 'feedback' | 'satisfaction' | 'poll' | 'assessment' | 'other';
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  isAnonymous: boolean | string | number;
  isMandatory: boolean | string | number;
  allowMultipleResponses?: boolean;
  startDate?: string | Date;
  endDate?: string | Date;
  questions?: SurveyQuestion[];
  assignments?: SurveyAssignment[];
  responseCount?: number;
  completedCount?: number;
  creatorFirstName?: string;
  creatorLastName?: string;
  createdAt?: string;
  updatedAt?: string;
  // Legacy field names from API
  assignment_type?: string;
  assignmentType?: string;
}

interface Buffer {
  type: 'Buffer';
  data: number[];
}

interface SurveyTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  questions: SurveyQuestion[];
}

interface Department {
  id: number;
  name: string;
  member_count?: number;
  memberCount?: number;
  employee_count?: number;
  employeeCount?: number;
  can_read?: boolean;
  can_write?: boolean;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

interface Team {
  id: number;
  name: string;
  member_count?: number;
  memberCount?: number;
}

// ============================================
// Survey Admin Manager Class
// ============================================

export class SurveyAdminManager {
  private apiClient: ApiClient;
  private currentSurveyId: number | null = null;
  private questionCounter = 0;
  private departments: Department[] = [];
  private teams: Team[] = [];
  private templates: SurveyTemplate[] = [];

  constructor() {
    this.apiClient = ApiClient.getInstance();
    this.initializeEventListeners();
    this.registerModalTemplate();
  }

  // ============================================
  // Initialization
  // ============================================

  private initializeEventListeners(): void {
    // Document ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        void this.init();
      });
    } else {
      void this.init();
    }

    // Event delegation for all survey admin actions
    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Handle all data-action clicks
      const actionElement = target.closest<HTMLElement>('[data-action]');
      if (actionElement !== null) {
        const action = actionElement.dataset.action ?? '';
        const surveyId = actionElement.dataset.surveyId ?? '';
        const params = actionElement.dataset.params ?? '';

        // Stop propagation for buttons within cards
        if (actionElement.tagName === 'BUTTON' && actionElement.closest('.survey-card') !== null) {
          e.stopPropagation();
        }

        switch (action) {
          case 'edit-survey':
            if (surveyId !== '') void this.editSurvey(Number.parseInt(surveyId, 10));
            break;
          case 'view-results':
            if (surveyId !== '') this.viewResults(Number.parseInt(surveyId, 10));
            break;
          case 'delete-survey':
            if (surveyId !== '') void this.deleteSurvey(Number.parseInt(surveyId, 10));
            break;
          case 'create-from-template':
            if (surveyId !== '') this.createFromTemplate(Number.parseInt(surveyId, 10));
            break;
          case 'remove-question':
            if (params !== '') this.removeQuestion(params);
            break;
          case 'toggle-dropdown':
            if (params !== '') this.toggleDropdown(params);
            break;
          case 'select-question-type':
            if (params !== '') {
              const parts = params.split('|');
              if (parts.length === 3) {
                const [questionId, type, label] = parts;
                this.selectQuestionType(questionId, type, label);
              }
            }
            break;
          case 'add-option':
            if (params !== '') this.addOption(params);
            break;
          case 'remove-option':
            this.removeOption(target);
            break;
          case 'add-question':
            this.addQuestion();
            break;
          case 'save-survey-draft':
            void this.saveSurvey('draft');
            break;
          case 'save-survey-active':
            void this.saveSurvey('active');
            break;
          case 'select-assignment':
            if (params !== '') {
              const parts = params.split('|');
              if (parts.length === 2) {
                const [type, label] = parts;
                void this.selectAssignmentOption(type, label);
              }
            }
            break;
        }
      }

      // Close dropdowns when clicking outside
      if (!target.closest('.custom-dropdown')) {
        document.querySelectorAll('.dropdown-options.active').forEach((dropdown) => {
          dropdown.classList.remove('active');
        });
        document.querySelectorAll('.dropdown-display.active').forEach((display) => {
          display.classList.remove('active');
        });
      }
    });
  }

  private async init(): Promise<void> {
    await this.loadSurveys();
    await this.loadTemplates();
    await this.loadUserDepartments();
    await this.loadUserTeams();
  }

  private registerModalTemplate(): void {
    const surveyModal = document.querySelector('#surveyModal');
    if (surveyModal !== null) {
      const modalClone = surveyModal.cloneNode(true) as HTMLElement;
      modalClone.classList.add('modal-overlay');
      modalManager.registerTemplate('surveyModal', modalClone.outerHTML);
      surveyModal.remove();
    }
  }

  // ============================================
  // Data Loading
  // ============================================

  public async loadSurveys(): Promise<void> {
    try {
      const useV2 = featureFlags.isEnabled('USE_API_V2_SURVEYS');
      const endpoint = useV2 ? '/surveys' : '/api/surveys';

      const token = localStorage.getItem('token') ?? '';

      let surveys: Survey[] = [];

      if (useV2) {
        surveys = await this.apiClient.get<Survey[]>(endpoint);
      } else {
        const v1Response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).then((r) => r.json() as Promise<Survey[]>);
        surveys = Array.isArray(v1Response) ? v1Response : [];
      }
      console.log('[SurveyAdmin] Loaded surveys:', surveys);
      this.displaySurveys(surveys);
    } catch (error) {
      console.error('Error loading surveys:', error);
      showErrorAlert('Fehler beim Laden der Umfragen');
    }
  }

  public async loadTemplates(): Promise<void> {
    try {
      const useV2 = featureFlags.isEnabled('USE_API_V2_SURVEYS');
      const endpoint = useV2 ? '/surveys/templates' : '/api/surveys/templates';

      interface TemplateResponse {
        success?: boolean;
        data?: SurveyTemplate[];
        templates?: SurveyTemplate[];
      }

      let templates: SurveyTemplate[] = [];

      if (useV2) {
        const v2Response = await this.apiClient.get<TemplateResponse>(endpoint);
        templates = v2Response.data ?? [];
      } else {
        const v1Response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
          },
        }).then((r) => r.json() as Promise<TemplateResponse>);
        templates = v1Response.templates ?? [];
      }

      this.templates = templates;
      this.displayTemplates(this.templates);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  public async loadUserDepartments(): Promise<void> {
    try {
      // For survey admin, we just load all departments directly
      // Admin users should have access to all departments for survey assignment
      const deptResponse = await this.apiClient.get<Department[] | ApiResponse<Department[]>>('/departments');
      this.departments = Array.isArray(deptResponse) ? deptResponse : (deptResponse.data ?? []);

      console.log('[SurveyAdmin] Loaded departments:', this.departments);
      this.displayDepartmentOptions(this.departments);
    } catch (error) {
      console.error('Error loading departments:', error);
      this.departments = [];
      this.displayDepartmentOptions([]);
    }
  }

  public async loadUserTeams(): Promise<void> {
    try {
      // Get teams using API client
      const response = await this.apiClient.get<Team[] | ApiResponse<Team[]>>('/teams');
      this.teams = Array.isArray(response) ? response : (response.data ?? []);

      console.log('[SurveyAdmin] Loaded teams:', this.teams);
      this.displayTeamOptions(this.teams);
    } catch (error) {
      console.error('Error loading teams:', error);
      this.teams = [];
      this.displayTeamOptions([]);
    }
  }

  // ============================================
  // Display Functions
  // ============================================

  private displaySurveys(surveys: Survey[]): void {
    console.log('[SurveyAdmin] Displaying surveys:', surveys);
    console.log(
      '[SurveyAdmin] Survey statuses:',
      surveys.map((s) => ({ id: s.id, status: s.status })),
    );

    const activeSurveys = surveys.filter((s) => s.status === 'active');
    const draftSurveys = surveys.filter((s) => s.status === 'draft');

    console.log('[SurveyAdmin] Active surveys:', activeSurveys.length);
    console.log('[SurveyAdmin] Draft surveys:', draftSurveys.length);
    // Note: archived surveys could be added later if needed

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
        setHTML(activeList as HTMLElement, activeSurveys.map((s) => this.createSurveyCard(s)).join(''));
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
        setHTML(draftList as HTMLElement, draftSurveys.map((s) => this.createSurveyCard(s)).join(''));
      }
    }
  }

  private createSurveyCard(survey: Survey): string {
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
          <h3 class="survey-card-title">${this.getTextFromBuffer(survey.title)}</h3>
          <span class="survey-status ${status}">${this.getStatusText(status)}</span>
        </div>
        <p class="survey-card-description">${this.getTextFromBuffer(survey.description) !== '' ? this.getTextFromBuffer(survey.description) : 'Keine Beschreibung'}</p>
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

  private displayTemplates(templates: SurveyTemplate[]): void {
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

  private displayDepartmentOptions(departments: Department[]): void {
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

  private displayTeamOptions(teams: Team[]): void {
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
  // UI Functions
  // ============================================

  public toggleDropdown(dropdownId: string): void {
    const dropdown = document.querySelector(`#${dropdownId}Dropdown`);
    const display = document.querySelector(`#${dropdownId}Display`);

    if (!dropdown || !display) return;

    // Close all other dropdowns
    document.querySelectorAll('.dropdown-options').forEach((d) => {
      if (d !== dropdown) {
        d.classList.remove('active');
      }
    });
    document.querySelectorAll('.dropdown-display').forEach((d) => {
      if (d !== display) {
        d.classList.remove('active');
      }
    });

    dropdown.classList.toggle('active');
    display.classList.toggle('active');
  }

  public async selectAssignmentOption(type: string, text: string): Promise<void> {
    const assignmentType = document.querySelector<HTMLInputElement>('#assignmentType');
    const displaySpan = document.querySelector('#assignmentDropdownDisplay span');
    const dropdown = document.querySelector('#assignmentDropdownDropdown');
    const display = document.querySelector('#assignmentDropdownDisplay');

    if (assignmentType !== null) assignmentType.value = type;
    if (displaySpan !== null) displaySpan.textContent = text;
    if (dropdown !== null) dropdown.classList.remove('active');
    if (display !== null) display.classList.remove('active');

    // Show/hide department selection
    const departmentSelection = document.querySelector<HTMLElement>('#departmentSelection');
    const teamSelection = document.querySelector<HTMLElement>('#teamSelection');

    if (type === 'department') {
      if (departmentSelection) departmentSelection.classList.remove('u-hidden');
      if (teamSelection) teamSelection.classList.add('u-hidden');
      await this.loadUserDepartments();
    } else if (type === 'team') {
      if (departmentSelection) departmentSelection.classList.add('u-hidden');
      if (teamSelection) teamSelection.classList.remove('u-hidden');
      await this.loadUserTeams();
    } else {
      if (departmentSelection) departmentSelection.classList.add('u-hidden');
      if (teamSelection) teamSelection.classList.add('u-hidden');
    }
  }

  public selectQuestionType(questionId: string, type: string, text: string): void {
    const typeValue = document.querySelector<HTMLInputElement>(`#${questionId}_typeValue`);
    const displaySpan = document.querySelector(`#${questionId}_typeDisplay span`);
    const dropdown = document.querySelector(`#${questionId}_typeDropdown`);
    const display = document.querySelector(`#${questionId}_typeDisplay`);

    if (typeValue !== null) typeValue.value = type;
    if (displaySpan !== null) displaySpan.textContent = text;
    if (dropdown !== null) dropdown.classList.remove('active');
    if (display !== null) display.classList.remove('active');

    this.handleQuestionTypeChange(questionId, type);
  }

  public showCreateModal(): void {
    this.currentSurveyId = null;
    this.questionCounter = 0;

    // Reset form
    const form = document.querySelector<HTMLFormElement>('#surveyForm');
    if (form) form.reset();

    // Reset assignment type to "Ganze Firma"
    const assignmentType = document.querySelector<HTMLInputElement>('#assignmentType');
    const displaySpan = document.querySelector('#assignmentDropdownDisplay span');
    const departmentSelection = document.querySelector<HTMLElement>('#departmentSelection');
    const teamSelection = document.querySelector<HTMLElement>('#teamSelection');

    if (assignmentType !== null) assignmentType.value = 'all_users';
    if (displaySpan !== null) displaySpan.textContent = 'Ganze Firma';
    if (departmentSelection) departmentSelection.style.display = 'none';
    if (teamSelection) teamSelection.style.display = 'none';

    // Set default dates
    const today = new Date();
    const in14Days = new Date(today);
    in14Days.setDate(today.getDate() + 14);

    const startDate = document.querySelector<HTMLInputElement>('#startDate');
    const endDate = document.querySelector<HTMLInputElement>('#endDate');

    if (startDate) startDate.value = this.formatDateForInput(today);
    if (endDate) endDate.value = this.formatDateForInput(in14Days);

    // Clear questions
    const questionsList = document.querySelector('#questionsList');
    if (questionsList) setHTML(questionsList as HTMLElement, '');

    // Show modal
    const modalTitle = document.querySelector('#modalTitle');
    if (modalTitle) modalTitle.textContent = 'Neue Umfrage erstellen';

    modalManager.show('surveyModal');
  }

  public closeModal(): void {
    modalManager.hide('surveyModal');
  }

  // ============================================
  // Question Management
  // ============================================

  public addQuestion(): void {
    this.questionCounter++;
    const questionId = `question_${this.questionCounter}`;

    const questionHtml = `
      <div class="question-item" id="${questionId}">
        <div class="question-header">
          <span class="question-number">${this.questionCounter}</span>
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

    const questionsList = document.querySelector('#questionsList');
    if (questionsList) {
      // eslint-disable-next-line no-unsanitized/method
      questionsList.insertAdjacentHTML('beforeend', questionHtml);
    }
  }

  private handleQuestionTypeChange(questionId: string, type: string): void {
    const optionsContainer = document.querySelector<HTMLElement>(`#${questionId}_options`);
    if (!optionsContainer) return;

    if (type === 'single_choice' || type === 'multiple_choice') {
      optionsContainer.style.display = 'block';
      const optionList = document.querySelector(`#${questionId}_option_list`);
      if (optionList && optionList.children.length === 0) {
        // Add default options
        this.addOption(questionId);
        this.addOption(questionId);
      }
    } else {
      optionsContainer.style.display = 'none';
    }
  }

  public addOption(questionId: string): void {
    const optionList = document.querySelector(`#${questionId}_option_list`);
    if (optionList === null) return;

    const optionHtml = `
      <div class="option-item">
        <input type="text" class="option-input" placeholder="Option eingeben...">
        <button type="button" class="remove-option" data-action="remove-option">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    // Use setHTML from dom-utils instead of insertAdjacentHTML
    const tempDiv = document.createElement('div');
    setHTML(tempDiv, optionHtml);
    const optionElement = tempDiv.firstElementChild;
    if (optionElement !== null) {
      optionList.append(optionElement);
    }
  }

  public removeOption(button: HTMLElement): void {
    button.closest('.option-item')?.remove();
  }

  public removeQuestion(questionId: string): void {
    document.querySelector(`#${questionId}`)?.remove();
    this.updateQuestionNumbers();
  }

  private updateQuestionNumbers(): void {
    document.querySelectorAll('.question-item').forEach((item, index) => {
      const numberSpan = item.querySelector('.question-number');
      if (numberSpan) {
        numberSpan.textContent = `${index + 1}`;
      }
    });
  }

  private getQuestionsData(): SurveyQuestion[] {
    const questions: SurveyQuestion[] = [];

    document.querySelectorAll('.question-item').forEach((item, index) => {
      const questionId = item.id;
      const textInput = document.querySelector<HTMLInputElement>(`#${questionId}_text`);
      const typeInput = document.querySelector<HTMLInputElement>(`#${questionId}_typeValue`);
      const requiredInput = document.querySelector<HTMLInputElement>(`#${questionId}_required`);

      if (!textInput || !typeInput) return;

      const question: SurveyQuestion = {
        questionText: textInput.value,
        questionType: typeInput.value as SurveyQuestion['questionType'],
        isRequired: requiredInput?.checked ?? true,
        orderPosition: index + 1,
      };

      // Get options if applicable
      if (typeInput.value === 'single_choice' || typeInput.value === 'multiple_choice') {
        const options: string[] = [];
        const optionInputs = item.querySelectorAll('.option-input');
        optionInputs.forEach((input) => {
          const optionInput = input as HTMLInputElement;
          if (optionInput.value.trim() !== '') {
            options.push(optionInput.value.trim());
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

  // ============================================
  // CRUD Operations
  // ============================================

  public async saveSurvey(status: 'draft' | 'active'): Promise<void> {
    const assignmentType = document.querySelector<HTMLInputElement>('#assignmentType')?.value;
    const assignments: SurveyAssignment[] = [];

    // Handle different assignment types
    if (assignmentType === 'all_users') {
      assignments.push({ type: 'all_users' });
    } else if (assignmentType === 'department') {
      const select = document.querySelector<HTMLSelectElement>('#departmentSelect');
      if (select) {
        const selectedDepts = Array.from(select.selectedOptions).map((opt) => opt.value);
        if (selectedDepts.length === 0) {
          showErrorAlert('Bitte wählen Sie mindestens eine Abteilung aus');
          return;
        }
        selectedDepts.forEach((deptId) => {
          assignments.push({
            type: 'department',
            departmentId: Number.parseInt(deptId),
          });
        });
      }
    } else if (assignmentType === 'team') {
      const select = document.querySelector<HTMLSelectElement>('#teamSelect');
      if (select) {
        const selectedTeams = Array.from(select.selectedOptions).map((opt) => opt.value);
        if (selectedTeams.length === 0) {
          showErrorAlert('Bitte wählen Sie mindestens ein Team aus');
          return;
        }
        selectedTeams.forEach((teamId) => {
          assignments.push({
            type: 'team',
            teamId: Number.parseInt(teamId),
          });
        });
      }
    }

    const titleInput = document.querySelector<HTMLInputElement>('#surveyTitle');
    const descInput = document.querySelector<HTMLTextAreaElement>('#surveyDescription');
    const anonInput = document.querySelector<HTMLInputElement>('#isAnonymous');
    const mandInput = document.querySelector<HTMLInputElement>('#isMandatory');
    const startInput = document.querySelector<HTMLInputElement>('#startDate');
    const endInput = document.querySelector<HTMLInputElement>('#endDate');

    if (!titleInput || !descInput || !anonInput || !mandInput || !startInput || !endInput) {
      showErrorAlert('Formularfelder konnten nicht gefunden werden');
      return;
    }

    const surveyData: Survey = {
      title: titleInput.value,
      description: descInput.value,
      isAnonymous: anonInput.checked,
      isMandatory: mandInput.checked,
      startDate: startInput.value,
      endDate: endInput.value,
      status: status,
      questions: this.getQuestionsData(),
      assignments: assignments,
    };

    // Validation
    // FIX: Explizite Längen-Prüfung statt impliziter falsy-Check (0 ist falsy!)
    const titleString = typeof surveyData.title === 'string' ? surveyData.title : '';
    if (titleString === '' || !surveyData.questions || surveyData.questions.length === 0) {
      showErrorAlert('Bitte geben Sie einen Titel ein und fügen Sie mindestens eine Frage hinzu');
      return;
    }

    try {
      const useV2 = featureFlags.isEnabled('USE_API_V2_SURVEYS');
      const endpoint =
        this.currentSurveyId !== null
          ? useV2
            ? `/surveys/${this.currentSurveyId}`
            : `/api/surveys/${this.currentSurveyId}`
          : useV2
            ? '/surveys'
            : '/api/surveys';

      const method = this.currentSurveyId !== null ? 'PUT' : 'POST'; // FIX: Explizite null-Prüfung statt truthy-Check

      interface SurveyApiResponse {
        success?: boolean;
        id?: number;
        error?: { message?: string };
      }

      const response: SurveyApiResponse = await (useV2 && method === 'POST'
        ? this.apiClient.post<SurveyApiResponse>(endpoint, surveyData)
        : useV2 && method === 'PUT'
          ? this.apiClient.put<SurveyApiResponse>(endpoint, surveyData)
          : fetch(endpoint, {
              method: method,
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(surveyData),
            }).then((r) => r.json() as Promise<SurveyApiResponse>));

      if (response.success === true || response.id !== undefined) {
        showSuccessAlert(
          this.currentSurveyId !== null ? 'Umfrage erfolgreich aktualisiert' : 'Umfrage erfolgreich erstellt',
        ); // FIX: Explizite null-Prüfung
        this.closeModal();
        await this.loadSurveys();
      } else {
        showErrorAlert(response.error?.message ?? 'Fehler beim Speichern der Umfrage');
      }
    } catch (error) {
      console.error('Error saving survey:', error);
      showErrorAlert('Fehler beim Speichern der Umfrage');
    }
  }

  public async editSurvey(surveyId: number): Promise<void> {
    try {
      const useV2 = featureFlags.isEnabled('USE_API_V2_SURVEYS');
      const endpoint = useV2 ? `/surveys/${surveyId}` : `/api/surveys/${surveyId}`;

      let survey: Survey | null = null;

      try {
        survey = useV2
          ? await this.apiClient.get<Survey>(endpoint)
          : await fetch(endpoint, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
              },
            })
              .then((r) => r.json() as Promise<unknown>)
              .then((data) => data as Survey);
      } catch (apiError) {
        console.error('Failed to fetch survey:', apiError);
        survey = null;
      }

      if (survey !== null) {
        // Check if survey has responses
        const responseCount = survey.responseCount ?? 0;
        if (responseCount > 0) {
          showAlert('Diese Umfrage kann nicht bearbeitet werden, da bereits Antworten vorliegen.');
          return;
        }

        this.currentSurveyId = surveyId;

        // Show modal
        modalManager.show('surveyModal');
        const modalTitle = document.querySelector('#modalTitle');
        if (modalTitle) modalTitle.textContent = 'Umfrage bearbeiten';
        await this.populateSurveyForm(survey);
      }
    } catch (error) {
      console.error('Error loading survey:', error);
      showErrorAlert('Fehler beim Laden der Umfrage');
    }
  }

  public async deleteSurvey(surveyId: number): Promise<void> {
    if (await showConfirm('Möchten Sie diese Umfrage wirklich löschen?')) {
      try {
        const useV2 = featureFlags.isEnabled('USE_API_V2_SURVEYS');
        const endpoint = useV2 ? `/surveys/${surveyId}` : `/api/surveys/${surveyId}`;

        if (useV2) {
          // API v2 wirft einen Fehler bei nicht-200 Status
          await this.apiClient.delete(endpoint);
          showSuccessAlert('Umfrage erfolgreich gelöscht');
          await this.loadSurveys();
        } else {
          // Legacy API v1
          const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`, // FIX: Verhindert 'Bearer null' im Header
            },
          });

          if (response.ok) {
            showSuccessAlert('Umfrage erfolgreich gelöscht');
            await this.loadSurveys();
          }
        }
      } catch (error) {
        console.error('Error deleting survey:', error);
        showErrorAlert('Fehler beim Löschen der Umfrage');
      }
    }
  }

  public createFromTemplate(templateId: number): void {
    const template = this.templates.find((t) => t.id === templateId);
    if (!template) return;

    this.showCreateModal();

    // Populate with template data
    const titleInput = document.querySelector<HTMLInputElement>('#surveyTitle');
    const descInput = document.querySelector<HTMLTextAreaElement>('#surveyDescription');

    if (titleInput) titleInput.value = template.name;
    if (descInput) descInput.value = template.description;

    // Add template questions
    if (template.questions.length > 0) {
      template.questions.forEach(() => {
        this.addQuestion();
      });

      // Populate question data
      template.questions.forEach((q, index) => {
        const questionId = `question_${index + 1}`;
        const textInput = document.querySelector<HTMLInputElement>(`#${questionId}_text`);
        const typeInput = document.querySelector<HTMLInputElement>(`#${questionId}_typeValue`);
        const requiredInput = document.querySelector<HTMLInputElement>(`#${questionId}_required`);

        if (textInput != null) textInput.value = q.questionText;
        if (typeInput != null) typeInput.value = q.questionType;
        if (requiredInput != null) requiredInput.checked = q.isRequired;

        // Handle options
        if (q.options && q.options.length > 0) {
          this.handleQuestionTypeChange(questionId, q.questionType);
          const optionsList = document.querySelector(`#${questionId}_option_list`);
          if (optionsList !== null) {
            optionsList.innerHTML = '';
            q.options.forEach((option) => {
              const optionText = typeof option === 'string' ? option : option.option_text;
              const optionHtml = `
                <div class="option-item">
                  <input type="text" class="option-input" value="${escapeHtml(optionText)}">
                  <button type="button" class="remove-option" data-action="remove-option">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              `;
              // Use setHTML from dom-utils to sanitize and append
              const tempDiv = document.createElement('div');
              setHTML(tempDiv, optionHtml);
              const optionElement = tempDiv.firstElementChild;
              if (optionElement !== null) {
                optionsList.append(optionElement);
              }
            });
          }
        }
      });
    }
  }

  private async populateSurveyForm(survey: Survey): Promise<void> {
    // Basic fields
    const titleInput = document.querySelector<HTMLInputElement>('#surveyTitle');
    const descInput = document.querySelector<HTMLTextAreaElement>('#surveyDescription');
    const anonInput = document.querySelector<HTMLInputElement>('#isAnonymous');
    const mandInput = document.querySelector<HTMLInputElement>('#isMandatory');
    const startInput = document.querySelector<HTMLInputElement>('#startDate');
    const endInput = document.querySelector<HTMLInputElement>('#endDate');

    if (titleInput) titleInput.value = this.getTextFromBuffer(survey.title);
    if (descInput) descInput.value = this.getTextFromBuffer(survey.description);
    if (anonInput) anonInput.checked = this.toBool(survey.isAnonymous);
    if (mandInput) mandInput.checked = this.toBool(survey.isMandatory);
    if (startInput !== null && survey.startDate !== undefined) {
      startInput.value = new Date(survey.startDate).toISOString().slice(0, 16);
    }
    if (endInput !== null && survey.endDate !== undefined) {
      endInput.value = new Date(survey.endDate).toISOString().slice(0, 16);
    }

    // Handle assignments
    if (survey.assignments !== undefined && survey.assignments.length > 0) {
      const assignment = survey.assignments[0];
      const assignType = assignment.assignmentType ?? assignment.assignment_type ?? assignment.type;

      if (assignType === 'all_users') {
        await this.selectAssignmentOption('all_users', 'Ganze Firma');
      } else if (assignType === 'department') {
        await this.selectAssignmentOption('department', 'Abteilung');
        // Set selected departments
        const departmentSelect = document.querySelector<HTMLSelectElement>('#departmentSelect');
        if (departmentSelect !== null) {
          Array.from(departmentSelect.options).forEach((option) => (option.selected = false));
          survey.assignments.forEach((assign) => {
            const deptId = assign.departmentId ?? assign.department_id;
            if (deptId !== undefined) {
              const option = departmentSelect.querySelector<HTMLOptionElement>(`option[value="${deptId}"]`);
              if (option !== null) option.selected = true;
            }
          });
        }
      } else if (assignType === 'team') {
        await this.selectAssignmentOption('team', 'Team');
        // Set selected teams
        const teamSelect = document.querySelector<HTMLSelectElement>('#teamSelect');
        if (teamSelect !== null) {
          Array.from(teamSelect.options).forEach((option) => (option.selected = false));
          survey.assignments.forEach((assign) => {
            const teamId = assign.teamId ?? assign.team_id;
            if (teamId !== undefined) {
              const option = teamSelect.querySelector<HTMLOptionElement>(`option[value="${teamId}"]`);
              if (option !== null) option.selected = true;
            }
          });
        }
      }
    } else {
      await this.selectAssignmentOption('all_users', 'Ganze Firma');
    }

    // Clear and add questions
    const questionsList = $('#questionsList');
    setHTML(questionsList, '');
    this.questionCounter = 0;

    if (survey.questions) {
      survey.questions.forEach((question) => {
        this.addQuestion();
        const questionElement = document.querySelector('.question-item:last-child');
        if (questionElement === null) return;

        // Set question text
        const textInput = questionElement.querySelector<HTMLInputElement>('input[type="text"]');
        if (textInput !== null) {
          textInput.value = this.getTextFromBuffer(question.questionText);
        }

        // Set question type
        const typeInput = questionElement.querySelector<HTMLInputElement>('input[type="hidden"][id$="_typeValue"]');
        if (typeInput !== null) {
          const qType = question.questionType;
          typeInput.value = qType;
          // Update dropdown display
          const typeDisplay = questionElement.querySelector('[id$="_typeDisplay"] span');
          if (typeDisplay) {
            const typeLabels: Record<string, string> = {
              text: 'Textantwort',
              single_choice: 'Einzelauswahl',
              multiple_choice: 'Mehrfachauswahl',
              rating: 'Bewertung (1-5)',
              yes_no: 'Ja/Nein',
              number: 'Zahl',
              date: 'Datum',
            };
            // Validate qType is one of the known keys to prevent object injection
            const validTypes = ['text', 'single_choice', 'multiple_choice', 'rating', 'yes_no', 'number', 'date'];
            // Safe: qType is validated to be in validTypes before accessing typeLabels
            // eslint-disable-next-line security/detect-object-injection
            const labelText = validTypes.includes(qType) ? typeLabels[qType] : 'Textantwort';
            typeDisplay.textContent = labelText;
          }
        }

        // Set required checkbox
        const requiredCheckbox = questionElement.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (requiredCheckbox !== null) {
          requiredCheckbox.checked = this.toBool(question.isRequired);
        }

        // Handle options
        if (question.options && question.options.length > 0) {
          const qType = question.questionType;
          this.handleQuestionTypeChange(`question_${this.questionCounter}`, qType);
          const optionsList = questionElement.querySelector(`#question_${this.questionCounter}_option_list`);
          if (optionsList !== null) {
            optionsList.innerHTML = '';
            question.options.forEach((option) => {
              const optionText = typeof option === 'string' ? option : option.option_text;
              const optionHtml = `
                <div class="option-item">
                  <input type="text" class="option-input" value="${escapeHtml(optionText)}">
                  <button type="button" class="remove-option" data-action="remove-option">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              `;
              // Use setHTML from dom-utils to sanitize and append
              const tempDiv = document.createElement('div');
              setHTML(tempDiv, optionHtml);
              const optionElement = tempDiv.firstElementChild;
              if (optionElement !== null) {
                optionsList.append(optionElement);
              }
            });
          }
        }
      });
    }
  }

  public viewResults(surveyId: number): void {
    window.location.href = `/survey-results?id=${surveyId}`;
  }

  // ============================================
  // Utility Functions
  // ============================================

  private getTextFromBuffer(value: unknown): string {
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

  private getStatusText(status: string): string {
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

  private toBool(value: unknown): boolean {
    return value === '1' || value === 1 || value === true;
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00`;
  }
}

// ============================================
// Initialize and Export
// ============================================

// Create global instance
const surveyAdmin = new SurveyAdminManager();

// Export for module usage
export default surveyAdmin;

// Make available globally for onclick handlers
(window as unknown as WindowWithExtensions).surveyAdmin = surveyAdmin;
