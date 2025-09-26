/* eslint-disable max-lines */
/**
 * Survey Administration Module
 * Manages survey CRUD operations, questions, and assignments
 */

import { ApiClient } from '../../../utils/api-client';
import { showSuccessAlert, showErrorAlert, showConfirm, showAlert } from '../../utils/alerts';
import { $, setHTML } from '../../../utils/dom-utils';
import { modalManager } from '../../utils/modal-manager';
import type {
  WindowWithExtensions,
  Survey,
  SurveyQuestion,
  SurveyAssignment,
  SurveyTemplate,
  Department,
  Team,
  ApiResponse,
} from './types';
import {
  displaySurveys,
  displayTemplates,
  displayDepartmentOptions,
  displayTeamOptions,
  createQuestionHtml,
  createOptionHtml,
  getTextFromBuffer,
  toBool,
  formatDateForInput,
  setElementVisibility,
  updateQuestionNumbers,
  populateQuestionFields,
  populateQuestionOptions,
} from './ui';

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
      this.handleDocumentClick(e, target);
    });
  }

  private async init(): Promise<void> {
    await this.loadSurveys();
    await this.loadTemplates();
    await this.loadUserDepartments();
    await this.loadUserTeams();
  }

  private handleDocumentClick(e: MouseEvent, target: HTMLElement): void {
    const actionElement = target.closest<HTMLElement>('[data-action]');
    if (actionElement !== null) {
      this.handleActionClick(e, actionElement);
    }

    this.handleDropdownClose(target);
  }

  private handleActionClick(e: MouseEvent, actionElement: HTMLElement): void {
    const action = actionElement.dataset.action ?? '';
    const surveyId = actionElement.dataset.surveyId ?? '';
    const params = actionElement.dataset.params ?? '';

    // Stop propagation for buttons within cards
    if (actionElement.tagName === 'BUTTON' && actionElement.closest('.survey-card') !== null) {
      e.stopPropagation();
    }

    this.executeAction(action, surveyId, params, e.target as HTMLElement);
  }

  private executeAction(action: string, surveyId: string, params: string, target: HTMLElement): void {
    switch (action) {
      case 'edit-survey':
        this.handleEditSurvey(surveyId);
        break;
      case 'view-results':
        this.handleViewResults(surveyId);
        break;
      case 'delete-survey':
        this.handleDeleteSurvey(surveyId);
        break;
      case 'create-from-template':
        this.handleCreateFromTemplate(surveyId);
        break;
      case 'remove-question':
        this.handleRemoveQuestion(params);
        break;
      case 'toggle-dropdown':
        this.handleToggleDropdown(params);
        break;
      case 'select-question-type':
        this.handleSelectQuestionType(params);
        break;
      case 'add-option':
        this.handleAddOption(params);
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
        this.handleSelectAssignment(params);
        break;
      default:
        // Unknown action, do nothing
        break;
    }
  }

  private handleEditSurvey(surveyId: string): void {
    if (surveyId !== '') {
      void this.editSurvey(Number.parseInt(surveyId, 10));
    }
  }

  private handleViewResults(surveyId: string): void {
    if (surveyId !== '') {
      this.viewResults(Number.parseInt(surveyId, 10));
    }
  }

  private handleDeleteSurvey(surveyId: string): void {
    if (surveyId !== '') {
      void this.deleteSurvey(Number.parseInt(surveyId, 10));
    }
  }

  private handleCreateFromTemplate(surveyId: string): void {
    if (surveyId !== '') {
      this.createFromTemplate(Number.parseInt(surveyId, 10));
    }
  }

  private handleRemoveQuestion(params: string): void {
    if (params !== '') {
      this.removeQuestion(params);
    }
  }

  private handleToggleDropdown(params: string): void {
    if (params !== '') {
      this.toggleDropdown(params);
    }
  }

  private handleSelectQuestionType(params: string): void {
    if (params !== '') {
      const parts = params.split('|');
      if (parts.length === 3) {
        const [questionId, type, label] = parts;
        this.selectQuestionType(questionId, type, label);
      }
    }
  }

  private handleAddOption(params: string): void {
    if (params !== '') {
      this.addOption(params);
    }
  }

  private handleSelectAssignment(params: string): void {
    if (params !== '') {
      const parts = params.split('|');
      if (parts.length === 2) {
        const [type, label] = parts;
        void this.selectAssignmentOption(type, label);
      }
    }
  }

  private handleDropdownClose(target: HTMLElement): void {
    if (!target.closest('.custom-dropdown')) {
      document.querySelectorAll('.dropdown-options.active').forEach((dropdown) => {
        dropdown.classList.remove('active');
      });
      document.querySelectorAll('.dropdown-display.active').forEach((display) => {
        display.classList.remove('active');
      });
    }
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
      let surveys: Survey[] = [];

      // Try v2 API first, fallback to v1 if needed
      try {
        surveys = await this.apiClient.get<Survey[]>('/surveys');
      } catch (v2Error) {
        console.error('Error loading surveys with v2:', v2Error);
        // Fallback to v1 API
        const token = localStorage.getItem('token') ?? '';
        const v1Response = await fetch('/api/surveys', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).then((r) => r.json() as Promise<Survey[]>);
        surveys = Array.isArray(v1Response) ? v1Response : [];
      }
      console.log('[SurveyAdmin] Loaded surveys:', surveys);
      displaySurveys(surveys);
    } catch (error) {
      console.error('Error loading surveys:', error);
      showErrorAlert('Fehler beim Laden der Umfragen');
    }
  }

  public async loadTemplates(): Promise<void> {
    try {
      interface TemplateResponse {
        success?: boolean;
        data?: SurveyTemplate[];
        templates?: SurveyTemplate[];
      }

      let templates: SurveyTemplate[] = [];

      // Try v2 API first, fallback to v1 if needed
      try {
        const v2Response = await this.apiClient.get<TemplateResponse>('/surveys/templates');
        templates = v2Response.data ?? [];
      } catch (v2Error) {
        console.error('Error loading templates with v2:', v2Error);
        // Fallback to v1 API
        const v1Response = await fetch('/api/surveys/templates', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
          },
        }).then((r) => r.json() as Promise<TemplateResponse>);
        templates = v1Response.templates ?? [];
      }

      this.templates = templates;
      displayTemplates(this.templates);
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
      displayDepartmentOptions(this.departments);
    } catch (error) {
      console.error('Error loading departments:', error);
      this.departments = [];
      displayDepartmentOptions([]);
    }
  }

  public async loadUserTeams(): Promise<void> {
    try {
      // Get teams using API client
      const response = await this.apiClient.get<Team[] | ApiResponse<Team[]>>('/teams');
      this.teams = Array.isArray(response) ? response : (response.data ?? []);

      console.log('[SurveyAdmin] Loaded teams:', this.teams);
      displayTeamOptions(this.teams);
    } catch (error) {
      console.error('Error loading teams:', error);
      this.teams = [];
      displayTeamOptions([]);
    }
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
    this.updateAssignmentDropdown(type, text);
    await this.updateAssignmentSelections(type);
  }

  private updateAssignmentDropdown(type: string, text: string): void {
    const assignmentType = document.querySelector<HTMLInputElement>('#assignmentType');
    const displaySpan = document.querySelector('#assignmentDropdownDisplay span');
    const dropdown = document.querySelector('#assignmentDropdownDropdown');
    const display = document.querySelector('#assignmentDropdownDisplay');

    if (assignmentType !== null) assignmentType.value = type;
    if (displaySpan !== null) displaySpan.textContent = text;
    if (dropdown !== null) dropdown.classList.remove('active');
    if (display !== null) display.classList.remove('active');
  }

  private async updateAssignmentSelections(type: string): Promise<void> {
    const departmentSelection = document.querySelector<HTMLElement>('#departmentSelection');
    const teamSelection = document.querySelector<HTMLElement>('#teamSelection');

    const showDepartment = type === 'department';
    const showTeam = type === 'team';

    setElementVisibility(departmentSelection, showDepartment);
    setElementVisibility(teamSelection, showTeam);

    if (showDepartment) {
      await this.loadUserDepartments();
    } else if (showTeam) {
      await this.loadUserTeams();
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

    if (startDate) startDate.value = formatDateForInput(today);
    if (endDate) endDate.value = formatDateForInput(in14Days);

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
    const questionHtml = createQuestionHtml(questionId, this.questionCounter);

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

    const optionHtml = createOptionHtml();

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
    updateQuestionNumbers();
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
    const assignments = this.collectAssignments();
    if (assignments === null) return;

    const surveyData = this.collectSurveyData(status, assignments);
    if (surveyData === null) return;

    if (!this.validateSurveyData(surveyData)) return;

    await this.submitSurvey(surveyData);
  }

  private collectAllUsersAssignment(): SurveyAssignment[] {
    return [{ type: 'all_users' }];
  }

  private collectDepartmentAssignments(): SurveyAssignment[] | null {
    const select = document.querySelector<HTMLSelectElement>('#departmentSelect');
    if (!select) return [];

    const selectedDepts = Array.from(select.selectedOptions).map((opt) => opt.value);
    if (selectedDepts.length === 0) {
      showErrorAlert('Bitte wählen Sie mindestens eine Abteilung aus');
      return null;
    }

    return selectedDepts.map((deptId) => ({
      type: 'department' as const,
      departmentId: Number.parseInt(deptId),
    }));
  }

  private collectTeamAssignments(): SurveyAssignment[] | null {
    const select = document.querySelector<HTMLSelectElement>('#teamSelect');
    if (!select) return [];

    const selectedTeams = Array.from(select.selectedOptions).map((opt) => opt.value);
    if (selectedTeams.length === 0) {
      showErrorAlert('Bitte wählen Sie mindestens ein Team aus');
      return null;
    }

    return selectedTeams.map((teamId) => ({
      type: 'team' as const,
      teamId: Number.parseInt(teamId),
    }));
  }

  private collectAssignments(): SurveyAssignment[] | null {
    const assignmentType = document.querySelector<HTMLInputElement>('#assignmentType')?.value;

    if (assignmentType === undefined || assignmentType === '') {
      return [];
    }

    switch (assignmentType) {
      case 'all_users':
        return this.collectAllUsersAssignment();
      case 'department':
        return this.collectDepartmentAssignments();
      case 'team':
        return this.collectTeamAssignments();
      default:
        return [];
    }
  }

  private collectSurveyData(status: 'draft' | 'active', assignments: SurveyAssignment[]): Survey | null {
    const titleInput = document.querySelector<HTMLInputElement>('#surveyTitle');
    const descInput = document.querySelector<HTMLTextAreaElement>('#surveyDescription');
    const anonInput = document.querySelector<HTMLInputElement>('#isAnonymous');
    const mandInput = document.querySelector<HTMLInputElement>('#isMandatory');
    const startInput = document.querySelector<HTMLInputElement>('#startDate');
    const endInput = document.querySelector<HTMLInputElement>('#endDate');

    if (!titleInput || !descInput || !anonInput || !mandInput || !startInput || !endInput) {
      showErrorAlert('Formularfelder konnten nicht gefunden werden');
      return null;
    }

    return {
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
  }

  private validateSurveyData(surveyData: Survey): boolean {
    const titleString = typeof surveyData.title === 'string' ? surveyData.title : '';
    if (titleString === '' || !surveyData.questions || surveyData.questions.length === 0) {
      showErrorAlert('Bitte geben Sie einen Titel ein und fügen Sie mindestens eine Frage hinzu');
      return false;
    }
    return true;
  }

  private async submitSurvey(surveyData: Survey): Promise<void> {
    try {
      const method = this.currentSurveyId !== null ? 'PUT' : 'POST';

      interface SurveyApiResponse {
        success?: boolean;
        id?: number;
        error?: { message?: string };
      }

      const response: SurveyApiResponse = await this.executeSurveyRequest<SurveyApiResponse>(method, surveyData);

      if (response.success === true || response.id !== undefined) {
        showSuccessAlert(
          this.currentSurveyId !== null ? 'Umfrage erfolgreich aktualisiert' : 'Umfrage erfolgreich erstellt',
        );
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

  private getSurveyEndpointV2(): string {
    if (this.currentSurveyId !== null) {
      return `/surveys/${this.currentSurveyId}`;
    }
    return '/surveys';
  }

  private getSurveyEndpointV1(): string {
    if (this.currentSurveyId !== null) {
      return `/api/surveys/${this.currentSurveyId}`;
    }
    return '/api/surveys';
  }

  private async executeSurveyRequest<T>(method: string, surveyData: Survey): Promise<T> {
    // Try v2 API first
    try {
      const endpointV2 = this.getSurveyEndpointV2();
      if (method === 'POST') {
        return await this.apiClient.post<T>(endpointV2, surveyData);
      }
      if (method === 'PUT') {
        return await this.apiClient.put<T>(endpointV2, surveyData);
      }
    } catch (v2Error) {
      console.error('Error with v2 API:', v2Error);
    }

    // Fallback to v1 API
    const endpointV1 = this.getSurveyEndpointV1();
    const response = await fetch(endpointV1, {
      method: method,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(surveyData),
    });
    return await (response.json() as Promise<T>);
  }

  public async editSurvey(surveyId: number): Promise<void> {
    try {
      let survey: Survey | null = null;

      // Try v2 API first, fallback to v1 if needed
      try {
        survey = await this.apiClient.get<Survey>(`/surveys/${surveyId}`);
      } catch (v2Error) {
        console.error('Failed to fetch survey with v2:', v2Error);
        // Fallback to v1 API
        try {
          survey = await fetch(`/api/surveys/${surveyId}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
            },
          })
            .then((r) => r.json() as Promise<unknown>)
            .then((data) => data as Survey);
        } catch (v1Error) {
          console.error('Failed to fetch survey with v1:', v1Error);
          survey = null;
        }
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

  private async deleteSurveyV2(surveyId: number): Promise<void> {
    const endpoint = `/surveys/${surveyId}`;
    await this.apiClient.delete(endpoint);
    showSuccessAlert('Umfrage erfolgreich gelöscht');
    await this.loadSurveys();
  }

  private async deleteSurveyV1(surveyId: number): Promise<void> {
    const endpoint = `/api/surveys/${surveyId}`;
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
      },
    });

    if (response.ok) {
      showSuccessAlert('Umfrage erfolgreich gelöscht');
      await this.loadSurveys();
    }
  }

  public async deleteSurvey(surveyId: number): Promise<void> {
    const confirmed = await showConfirm('Möchten Sie diese Umfrage wirklich löschen?');
    if (!confirmed) return;

    try {
      // Try v2 API first, fallback to v1 if needed
      try {
        await this.deleteSurveyV2(surveyId);
      } catch (v2Error) {
        console.error('Error deleting survey with v2:', v2Error);
        // Fallback to v1 API
        await this.deleteSurveyV1(surveyId);
      }
    } catch (error) {
      console.error('Error deleting survey:', error);
      showErrorAlert('Fehler beim Löschen der Umfrage');
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
              const optionHtml = createOptionHtml(optionText);
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
    this.populateBasicFields(survey);
    await this.populateAssignments(survey);
    this.populateQuestions(survey);
  }

  private populateBasicFields(survey: Survey): void {
    const titleInput = document.querySelector<HTMLInputElement>('#surveyTitle');
    const descInput = document.querySelector<HTMLTextAreaElement>('#surveyDescription');
    const anonInput = document.querySelector<HTMLInputElement>('#isAnonymous');
    const mandInput = document.querySelector<HTMLInputElement>('#isMandatory');
    const startInput = document.querySelector<HTMLInputElement>('#startDate');
    const endInput = document.querySelector<HTMLInputElement>('#endDate');

    if (titleInput) titleInput.value = getTextFromBuffer(survey.title);
    if (descInput) descInput.value = getTextFromBuffer(survey.description);
    if (anonInput) anonInput.checked = toBool(survey.isAnonymous);
    if (mandInput) mandInput.checked = toBool(survey.isMandatory);
    if (startInput !== null && survey.startDate !== undefined) {
      startInput.value = new Date(survey.startDate).toISOString().slice(0, 16);
    }
    if (endInput !== null && survey.endDate !== undefined) {
      endInput.value = new Date(survey.endDate).toISOString().slice(0, 16);
    }
  }

  private async populateAssignments(survey: Survey): Promise<void> {
    if (survey.assignments === undefined || survey.assignments.length === 0) {
      await this.selectAssignmentOption('all_users', 'Ganze Firma');
      return;
    }

    const assignment = survey.assignments[0];
    const assignType = assignment.assignmentType ?? assignment.assignment_type ?? assignment.type;

    if (assignType === 'all_users') {
      await this.selectAssignmentOption('all_users', 'Ganze Firma');
    } else if (assignType === 'department') {
      await this.populateDepartmentAssignments(survey.assignments);
    } else if (assignType === 'team') {
      await this.populateTeamAssignments(survey.assignments);
    }
  }

  private async populateDepartmentAssignments(assignments: SurveyAssignment[]): Promise<void> {
    await this.selectAssignmentOption('department', 'Abteilung');
    const departmentSelect = document.querySelector<HTMLSelectElement>('#departmentSelect');
    if (departmentSelect === null) return;

    Array.from(departmentSelect.options).forEach((option) => (option.selected = false));
    assignments.forEach((assign) => {
      const deptId = assign.departmentId ?? assign.department_id;
      if (deptId !== undefined) {
        const option = departmentSelect.querySelector<HTMLOptionElement>(`option[value="${deptId}"]`);
        if (option !== null) option.selected = true;
      }
    });
  }

  private async populateTeamAssignments(assignments: SurveyAssignment[]): Promise<void> {
    await this.selectAssignmentOption('team', 'Team');
    const teamSelect = document.querySelector<HTMLSelectElement>('#teamSelect');
    if (teamSelect === null) return;

    Array.from(teamSelect.options).forEach((option) => (option.selected = false));
    assignments.forEach((assign) => {
      const teamId = assign.teamId ?? assign.team_id;
      if (teamId !== undefined) {
        const option = teamSelect.querySelector<HTMLOptionElement>(`option[value="${teamId}"]`);
        if (option !== null) option.selected = true;
      }
    });
  }

  private populateQuestions(survey: Survey): void {
    const questionsList = $('#questionsList');
    setHTML(questionsList, '');
    this.questionCounter = 0;

    if (!survey.questions) return;

    survey.questions.forEach((question) => {
      this.addQuestion();
      const questionElement = document.querySelector('.question-item:last-child');
      if (questionElement === null) return;

      populateQuestionFields(questionElement, question);
      this.handleQuestionTypeChange(`question_${this.questionCounter}`, question.questionType);
      populateQuestionOptions(questionElement, question, this.questionCounter);
    });
  }

  public viewResults(surveyId: number): void {
    window.location.href = `/survey-results?id=${surveyId}`;
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
