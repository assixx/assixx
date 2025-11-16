/**
 * Survey Administration - Main Module
 * Orchestration and event handling for survey admin functionality
 */

import { showSuccessAlert, showErrorAlert, showConfirm } from '../../utils/alerts';
import type { WindowWithExtensions } from './types';
import {
  loadSurveys,
  loadTemplates,
  loadUserDepartments,
  loadUserTeams,
  loadUserAreas,
  deleteSurvey as deleteSurveyAPI,
  setCurrentSurveyId,
} from './data';
import {
  showCreateModal,
  closeModal,
  addQuestion,
  removeQuestion,
  addOption,
  removeOption,
  handleQuestionTypeChange,
  saveSurvey,
  createFromTemplate,
} from './forms';
import {
  displaySurveys,
  displayTemplates,
  displayDepartmentOptions,
  displayTeamOptions,
  displayAreaOptions,
  updateQuestionTypeDisplay,
} from './ui';

// ============================================
// Survey Admin Manager Class
// ============================================

export class SurveyAdminManager {
  constructor() {
    this.initializeEventListeners();
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
    try {
      // Load all data in parallel
      const [surveys, templates, departments, teams, areas] = await Promise.all([
        loadSurveys(),
        loadTemplates(),
        loadUserDepartments(),
        loadUserTeams(),
        loadUserAreas(),
      ]);

      // Display loaded data
      displaySurveys(surveys);
      displayTemplates(templates);
      displayDepartmentOptions(departments);
      displayTeamOptions(teams);
      displayAreaOptions(areas);
    } catch (error) {
      console.error('[SurveyAdmin] Initialization error:', error);
      showErrorAlert('Fehler beim Laden der Daten');
    }
  }

  // ============================================
  // Event Handling
  // ============================================

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
    if (actionElement.tagName === 'BUTTON' && actionElement.closest('.card') !== null) {
      e.stopPropagation();
    }

    // Prevent default for buttons to avoid form submission
    if (actionElement.tagName === 'BUTTON') {
      e.preventDefault();
    }

    this.executeAction(action, surveyId, params, actionElement);
  }

  private executeAction(action: string, surveyId: string, params: string, target: HTMLElement): void {
    console.log('[SurveyAdmin] Executing action:', { action, surveyId, params });

    switch (action) {
      case 'show-create-modal':
        showCreateModal(null);
        break;

      case 'save-survey':
        this.handleSaveSurvey(target);
        break;

      case 'close':
        closeModal();
        break;

      case 'edit-survey':
        this.handleEditSurvey(surveyId);
        break;

      case 'view-results':
        this.handleViewResults(surveyId);
        break;

      case 'delete-survey':
        void this.handleDeleteSurvey(surveyId);
        break;

      case 'create-from-template':
        void this.handleCreateFromTemplate(surveyId);
        break;

      case 'add-question':
        addQuestion();
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
        removeOption(target);
        break;

      case 'select-assignment':
        this.handleSelectAssignment(params, target);
        break;

      default:
        console.warn('[SurveyAdmin] Unknown action:', action);
    }
  }

  // ============================================
  // Action Handlers
  // ============================================

  private handleSaveSurvey(target: HTMLElement): void {
    const status =
      target.dataset.status === 'draft' || target.dataset.status === 'active' ? target.dataset.status : 'draft';
    void saveSurvey(status);
  }

  private handleEditSurvey(surveyId: string): void {
    const id = Number(surveyId);
    if (!Number.isNaN(id)) {
      setCurrentSurveyId(id);
      showCreateModal(id);
    }
  }

  private handleViewResults(surveyId: string): void {
    console.log('[SurveyAdmin] View results for survey:', surveyId);
    // Navigate to results page
    window.location.href = `/survey-results.html?surveyId=${surveyId}`;
  }

  private async handleDeleteSurvey(surveyId: string): Promise<void> {
    const confirmed = await showConfirm('Möchten Sie diese Umfrage wirklich löschen?');
    if (!confirmed) return;

    const id = Number(surveyId);
    if (Number.isNaN(id)) return;

    const success = await deleteSurveyAPI(id);
    if (success) {
      showSuccessAlert('Umfrage erfolgreich gelöscht');
      const surveys = await loadSurveys();
      displaySurveys(surveys);
    } else {
      showErrorAlert('Fehler beim Löschen der Umfrage');
    }
  }

  private async handleCreateFromTemplate(surveyId: string): Promise<void> {
    const id = Number(surveyId);
    if (!Number.isNaN(id)) {
      await createFromTemplate(id);
    }
  }

  private handleRemoveQuestion(params: string): void {
    if (params !== '') {
      removeQuestion(params);
    }
  }

  private handleAddOption(params: string): void {
    if (params !== '') {
      addOption(params);
    }
  }

  // ============================================
  // Dropdown Handling
  // ============================================

  private handleToggleDropdown(params: string): void {
    if (params === '') return;

    const dropdownMenu = document.getElementById(`${params}Dropdown`);
    const dropdownTrigger = document.getElementById(`${params}Display`);

    if (dropdownMenu !== null && dropdownTrigger !== null) {
      const isActive = dropdownMenu.classList.contains('active');

      // Close all other dropdowns
      document.querySelectorAll('.dropdown__menu.active').forEach((menu) => {
        menu.classList.remove('active');
      });
      document.querySelectorAll('.dropdown__trigger.active').forEach((trigger) => {
        trigger.classList.remove('active');
      });

      // Toggle this dropdown
      if (!isActive) {
        dropdownMenu.classList.add('active');
        dropdownTrigger.classList.add('active');
      }
    }
  }

  private handleSelectQuestionType(params: string): void {
    const [questionId, type, text] = params.split('|');
    this.selectQuestionType(questionId, type, text);
  }

  private selectQuestionType(questionId: string, type: string, text: string): void {
    // Update hidden input value
    const typeInput = document.querySelector<HTMLInputElement>(`#${questionId}_typeValue`);
    if (typeInput !== null) {
      typeInput.value = type;
    }

    // Update dropdown display text
    const displayElement = document.querySelector(`#${questionId}_typeDisplay span`);
    if (displayElement !== null) {
      displayElement.textContent = text;
    }

    // Close dropdown
    const dropdownMenu = document.getElementById(`${questionId}_typeDropdown`);
    const dropdownTrigger = document.getElementById(`${questionId}_typeDisplay`);
    if (dropdownMenu) dropdownMenu.classList.remove('active');
    if (dropdownTrigger) dropdownTrigger.classList.remove('active');

    // Handle question type change (show/hide options)
    handleQuestionTypeChange(questionId, type);

    // Update display
    const questionElement = document.querySelector(`#${questionId}`);
    if (questionElement) {
      updateQuestionTypeDisplay(questionElement, type);
    }
  }

  private handleSelectAssignment(params: string, target: HTMLElement): void {
    const value = target.dataset.value ?? params;
    // dataset.text can be undefined at runtime even though TypeScript types suggest otherwise
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const text = target.dataset.text ?? target.textContent ?? '';

    this.updateAssignmentDropdown(value, text);

    // Close dropdown
    const dropdownMenu = document.getElementById('assignmentDropdown');
    const dropdownTrigger = document.getElementById('assignmentDisplay');
    if (dropdownMenu !== null) dropdownMenu.classList.remove('active');
    if (dropdownTrigger !== null) dropdownTrigger.classList.remove('active');
  }

  private updateAssignmentDropdown(type: string, text: string): void {
    // Update dropdown display
    const dropdownDisplay = document.querySelector('#assignmentDisplay span');
    if (dropdownDisplay !== null) {
      dropdownDisplay.textContent = text;
    }

    // Show/hide relevant selections
    const areaSelection = document.getElementById('areaSelection');
    const departmentSelection = document.getElementById('departmentSelection');
    const teamSelection = document.getElementById('teamSelection');

    if (areaSelection !== null) {
      areaSelection.classList.toggle('hidden', type !== 'area');
    }
    if (departmentSelection !== null) {
      departmentSelection.classList.toggle('hidden', type !== 'department');
    }
    if (teamSelection !== null) {
      teamSelection.classList.toggle('hidden', type !== 'team');
    }

    // Update hidden input
    const assignmentTypeInput = document.querySelector<HTMLInputElement>('#assignmentType');
    if (assignmentTypeInput !== null) {
      assignmentTypeInput.value = type;
    }
  }

  private handleDropdownClose(target: HTMLElement): void {
    // Close dropdowns when clicking outside
    if (!target.closest('.dropdown')) {
      document.querySelectorAll('.dropdown__menu.active').forEach((dropdown) => {
        dropdown.classList.remove('active');
      });
      document.querySelectorAll('.dropdown__trigger.active').forEach((display) => {
        display.classList.remove('active');
      });
    }
  }
}

// ============================================
// Initialize
// ============================================

// Initialize on module load
const extWindow = window as unknown as WindowWithExtensions;
if (extWindow.__surveyAdminManager === undefined) {
  console.log('[SurveyAdmin] Initializing SurveyAdminManager');
  extWindow.__surveyAdminManager = new SurveyAdminManager();
}
