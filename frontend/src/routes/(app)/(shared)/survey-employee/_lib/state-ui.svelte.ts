// =============================================================================
// SURVEY-EMPLOYEE - UI STATE (Svelte 5 Runes)
// Handles: modals, loading states, response viewing
// =============================================================================

import type { Survey, SurveyResponse } from './types';

/**
 * Survey UI state
 */
function createSurveyUiState() {
  // Modal visibility
  let showSurveyModal = $state(false);
  let showResponseModal = $state(false);

  // Response viewing
  let viewingResponse = $state<SurveyResponse | null>(null);
  let viewingSurvey = $state<Survey | null>(null);

  // Loading state - Start true to prevent FOUC
  let isLoading = $state(true);
  let isSubmitting = $state(false);

  return {
    get showSurveyModal() {
      return showSurveyModal;
    },
    get showResponseModal() {
      return showResponseModal;
    },
    get viewingResponse() {
      return viewingResponse;
    },
    get viewingSurvey() {
      return viewingSurvey;
    },
    get isLoading() {
      return isLoading;
    },
    get isSubmitting() {
      return isSubmitting;
    },

    setShowSurveyModal(val: boolean) {
      showSurveyModal = val;
    },
    setShowResponseModal(val: boolean) {
      showResponseModal = val;
    },
    setViewingResponse(response: SurveyResponse | null) {
      viewingResponse = response;
    },
    setViewingSurvey(survey: Survey | null) {
      viewingSurvey = survey;
    },
    setLoading(val: boolean) {
      isLoading = val;
    },
    setSubmitting(val: boolean) {
      isSubmitting = val;
    },
    resetUi() {
      showSurveyModal = false;
      showResponseModal = false;
      viewingResponse = null;
      viewingSurvey = null;
      isLoading = false;
      isSubmitting = false;
    },
  };
}

export const surveyUiState = createSurveyUiState();
