// =============================================================================
// SURVEY-EMPLOYEE - COMBINED STATE (Svelte 5 Runes)
// Re-exports sub-states and provides combined convenience methods
// =============================================================================

import { surveyDataState } from './state-data.svelte';
import { surveyUiState } from './state-ui.svelte';

import type { Survey, SurveyResponse } from './types';

// Re-export sub-states for direct access
export { surveyDataState, surveyUiState };

/**
 * Combined convenience methods that coordinate multiple state modules
 */
export const surveyActions = {
  openSurveyModal: (survey: Survey): void => {
    surveyDataState.setCurrentSurvey(survey);
    surveyDataState.clearAnswers();
    surveyUiState.setShowSurveyModal(true);
  },

  closeSurveyModal: (): void => {
    surveyUiState.setShowSurveyModal(false);
    surveyDataState.setCurrentSurvey(null);
    surveyDataState.clearAnswers();
  },

  openResponseModal: (survey: Survey, response: SurveyResponse): void => {
    surveyUiState.setViewingSurvey(survey);
    surveyUiState.setViewingResponse(response);
    surveyUiState.setShowResponseModal(true);
  },

  closeResponseModal: (): void => {
    surveyUiState.setShowResponseModal(false);
    surveyUiState.setViewingSurvey(null);
    surveyUiState.setViewingResponse(null);
  },

  reset: (): void => {
    surveyDataState.setSurveys([]);
    surveyDataState.setCurrentSurvey(null);
    surveyDataState.clearAnswers();
    surveyUiState.resetUi();
  },
};

/**
 * Legacy facade for backward compatibility
 * Provides unified access to all state through a single object
 */
export const surveyEmployeeState = {
  // Data state
  get surveys() {
    return surveyDataState.surveys;
  },
  get currentSurvey() {
    return surveyDataState.currentSurvey;
  },
  get answers() {
    return surveyDataState.answers;
  },
  get pendingSurveys() {
    return surveyDataState.pendingSurveys;
  },
  get completedSurveys() {
    return surveyDataState.completedSurveys;
  },
  get totalQuestions() {
    return surveyDataState.totalQuestions;
  },
  get answeredCount() {
    return surveyDataState.answeredCount;
  },
  get progressPercentage() {
    return surveyDataState.progressPercentage;
  },

  // UI state
  get showSurveyModal() {
    return surveyUiState.showSurveyModal;
  },
  get showResponseModal() {
    return surveyUiState.showResponseModal;
  },
  get viewingResponse() {
    return surveyUiState.viewingResponse;
  },
  get viewingSurvey() {
    return surveyUiState.viewingSurvey;
  },
  get isLoading() {
    return surveyUiState.isLoading;
  },
  get isSubmitting() {
    return surveyUiState.isSubmitting;
  },

  // Data methods
  setSurveys: surveyDataState.setSurveys.bind(surveyDataState),
  setCurrentSurvey: surveyDataState.setCurrentSurvey.bind(surveyDataState),
  clearAnswers: surveyDataState.clearAnswers.bind(surveyDataState),
  setAnswer: surveyDataState.setAnswer.bind(surveyDataState),
  removeAnswer: surveyDataState.removeAnswer.bind(surveyDataState),

  // UI methods
  setLoading: surveyUiState.setLoading.bind(surveyUiState),
  setSubmitting: surveyUiState.setSubmitting.bind(surveyUiState),

  // Combined methods
  openSurveyModal: surveyActions.openSurveyModal,
  closeSurveyModal: surveyActions.closeSurveyModal,
  openResponseModal: surveyActions.openResponseModal,
  closeResponseModal: surveyActions.closeResponseModal,
  reset: surveyActions.reset,
};
