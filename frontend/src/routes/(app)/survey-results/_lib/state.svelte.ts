// =============================================================================
// SURVEY-RESULTS - REACTIVE STATE (Svelte 5 Runes)
// Composed from modular state files
// =============================================================================

import { dataState } from './state-data.svelte';
import { uiState } from './state-ui.svelte';

/**
 * Survey Results State - Facade combining data and UI state
 */
export const surveyResultsState = {
  // Data state
  get survey() {
    return dataState.survey;
  },
  get statistics() {
    return dataState.statistics;
  },
  get responsesData() {
    return dataState.responsesData;
  },
  get surveyId() {
    return dataState.surveyId;
  },
  get hasData() {
    return dataState.hasData;
  },
  get isAnonymous() {
    return dataState.isAnonymous;
  },
  get totalResponses() {
    return dataState.totalResponses;
  },
  get completedResponses() {
    return dataState.completedResponses;
  },
  get completionRate() {
    return dataState.completionRate;
  },
  get hasResponses() {
    return dataState.hasResponses;
  },
  setSurveyId: dataState.setSurveyId,
  setSurvey: dataState.setSurvey,
  setStatistics: dataState.setStatistics,
  setResponsesData: dataState.setResponsesData,

  // UI state
  get isLoading() {
    return uiState.isLoading;
  },
  get isExporting() {
    return uiState.isExporting;
  },
  get errorMessage() {
    return uiState.errorMessage;
  },
  setLoading: uiState.setLoading,
  setExporting: uiState.setExporting,
  setError: uiState.setError,
  toggleResponseExpanded: uiState.toggleResponseExpanded,
  isResponseExpanded: uiState.isResponseExpanded,

  // Combined reset
  reset: () => {
    dataState.reset();
    uiState.reset();
  },
};
