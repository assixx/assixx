// =============================================================================
// SURVEY-ADMIN - REACTIVE STATE (Svelte 5 Runes - Class-based)
// Based on: frontend/src/scripts/survey/admin/data.ts
// =============================================================================

import type { Survey, SurveyTemplate, Department, Team, Area } from './types';

/**
 * Survey Admin State using Svelte 5 Runes (Class-based pattern)
 * Each method is naturally small, state is encapsulated.
 */
class SurveyAdminState {
  // ==========================================================================
  // STATE FIELDS
  // ==========================================================================
  surveys = $state<Survey[]>([]);
  templates = $state<SurveyTemplate[]>([]);
  departments = $state<Department[]>([]);
  teams = $state<Team[]>([]);
  areas = $state<Area[]>([]);
  currentSurveyId = $state<number | null>(null);
  questionCounter = $state(0);
  showModal = $state(false);
  modalTitle = $state('Neue Umfrage erstellen');
  isLoading = $state(true); // Start true to prevent FOUC
  isSaving = $state(false);

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================
  get activeSurveys(): Survey[] {
    return this.surveys.filter((s) => s.status === 'active');
  }

  get draftSurveys(): Survey[] {
    return this.surveys.filter((s) => s.status === 'draft');
  }

  // ==========================================================================
  // SETTERS
  // ==========================================================================
  setSurveys(data: Survey[]): void {
    this.surveys = data;
  }

  setTemplates(data: SurveyTemplate[]): void {
    this.templates = data;
  }

  setDepartments(data: Department[]): void {
    this.departments = data;
  }

  setTeams(data: Team[]): void {
    this.teams = data;
  }

  setAreas(data: Area[]): void {
    this.areas = data;
  }

  setCurrentSurveyId(id: number | null): void {
    this.currentSurveyId = id;
  }

  setLoading(val: boolean): void {
    this.isLoading = val;
  }

  setSaving(val: boolean): void {
    this.isSaving = val;
  }

  // ==========================================================================
  // QUESTION COUNTER
  // ==========================================================================
  resetQuestionCounter(): void {
    this.questionCounter = 0;
  }

  incrementQuestionCounter(): number {
    this.questionCounter += 1;
    return this.questionCounter;
  }

  // ==========================================================================
  // MODAL CONTROL
  // ==========================================================================
  openModal(surveyId: number | null = null): void {
    this.currentSurveyId = surveyId;
    this.modalTitle =
      surveyId !== null ? 'Umfrage bearbeiten' : 'Neue Umfrage erstellen';
    this.questionCounter = 0;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.currentSurveyId = null;
    this.questionCounter = 0;
  }

  // ==========================================================================
  // LOOKUP HELPERS
  // ==========================================================================
  getDepartmentById(id: number): Department | undefined {
    return this.departments.find((d) => d.id === id);
  }

  getTeamById(id: number): Team | undefined {
    return this.teams.find((t) => t.id === id);
  }

  getAreaById(id: number): Area | undefined {
    return this.areas.find((a) => a.id === id);
  }

  getTemplateById(id: number): SurveyTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  // ==========================================================================
  // RESET
  // ==========================================================================
  reset(): void {
    this.surveys = [];
    this.templates = [];
    this.departments = [];
    this.teams = [];
    this.areas = [];
    this.currentSurveyId = null;
    this.questionCounter = 0;
    this.showModal = false;
    this.modalTitle = 'Neue Umfrage erstellen';
    this.isLoading = false;
    this.isSaving = false;
  }
}

// Singleton export
export const surveyAdminState = new SurveyAdminState();
