// =============================================================================
// SURVEY-ADMIN - REACTIVE STATE (Svelte 5 Runes)
// Based on: frontend/src/scripts/survey/admin/data.ts
// =============================================================================

import type { Survey, SurveyTemplate, Department, Team, Area } from './types';

/**
 * Survey Admin State using Svelte 5 Runes
 */
function createSurveyAdminState() {
  // Data
  let surveys = $state<Survey[]>([]);
  let templates = $state<SurveyTemplate[]>([]);
  let departments = $state<Department[]>([]);
  let teams = $state<Team[]>([]);
  let areas = $state<Area[]>([]);

  // Current survey being edited
  let currentSurveyId = $state<number | null>(null);
  let questionCounter = $state(0);

  // Modal state
  let showModal = $state(false);
  let modalTitle = $state('Neue Umfrage erstellen');

  // Loading state - PERFORMANCE: Start true to prevent FOUC (triple-render)
  let isLoading = $state(true);
  let isSaving = $state(false);

  // Derived: Active surveys (status === 'active')
  const activeSurveys = $derived(surveys.filter((s) => s.status === 'active'));

  // Derived: Draft surveys (status === 'draft')
  const draftSurveys = $derived(surveys.filter((s) => s.status === 'draft'));

  // Methods
  function setSurveys(data: Survey[]) {
    surveys = data;
  }

  function setTemplates(data: SurveyTemplate[]) {
    templates = data;
  }

  function setDepartments(data: Department[]) {
    departments = data;
  }

  function setTeams(data: Team[]) {
    teams = data;
  }

  function setAreas(data: Area[]) {
    areas = data;
  }

  function setCurrentSurveyId(id: number | null) {
    currentSurveyId = id;
  }

  function resetQuestionCounter() {
    questionCounter = 0;
  }

  function incrementQuestionCounter(): number {
    questionCounter += 1;
    return questionCounter;
  }

  function openModal(surveyId: number | null = null) {
    currentSurveyId = surveyId;
    modalTitle = surveyId !== null ? 'Umfrage bearbeiten' : 'Neue Umfrage erstellen';
    questionCounter = 0;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    currentSurveyId = null;
    questionCounter = 0;
  }

  function setLoading(val: boolean) {
    isLoading = val;
  }

  function setSaving(val: boolean) {
    isSaving = val;
  }

  function getDepartmentById(id: number): Department | undefined {
    return departments.find((d) => d.id === id);
  }

  function getTeamById(id: number): Team | undefined {
    return teams.find((t) => t.id === id);
  }

  function getAreaById(id: number): Area | undefined {
    return areas.find((a) => a.id === id);
  }

  function getTemplateById(id: number): SurveyTemplate | undefined {
    return templates.find((t) => t.id === id);
  }

  function reset() {
    surveys = [];
    templates = [];
    departments = [];
    teams = [];
    areas = [];
    currentSurveyId = null;
    questionCounter = 0;
    showModal = false;
    modalTitle = 'Neue Umfrage erstellen';
    isLoading = false;
    isSaving = false;
  }

  return {
    // Getters (reactive)
    get surveys() {
      return surveys;
    },
    get templates() {
      return templates;
    },
    get departments() {
      return departments;
    },
    get teams() {
      return teams;
    },
    get areas() {
      return areas;
    },
    get currentSurveyId() {
      return currentSurveyId;
    },
    get questionCounter() {
      return questionCounter;
    },
    get showModal() {
      return showModal;
    },
    get modalTitle() {
      return modalTitle;
    },
    get isLoading() {
      return isLoading;
    },
    get isSaving() {
      return isSaving;
    },
    get activeSurveys() {
      return activeSurveys;
    },
    get draftSurveys() {
      return draftSurveys;
    },

    // Methods
    setSurveys,
    setTemplates,
    setDepartments,
    setTeams,
    setAreas,
    setCurrentSurveyId,
    resetQuestionCounter,
    incrementQuestionCounter,
    openModal,
    closeModal,
    setLoading,
    setSaving,
    getDepartmentById,
    getTeamById,
    getAreaById,
    getTemplateById,
    reset,
  };
}

// Singleton export
export const surveyAdminState = createSurveyAdminState();
