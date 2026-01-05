// =============================================================================
// SURVEY-EMPLOYEE - REACTIVE STATE (Svelte 5 Runes)
// Based on: frontend/src/scripts/survey/employee/index.ts
// =============================================================================

import type { Survey, SurveyWithStatus, SurveyResponse, AnswerMap } from './types';

/**
 * Survey Employee State using Svelte 5 Runes
 */
function createSurveyEmployeeState() {
  // Data
  let surveys = $state<SurveyWithStatus[]>([]);

  // Current survey being answered
  let currentSurvey = $state<Survey | null>(null);
  let answers = $state<AnswerMap>({});

  // Modal state
  let showSurveyModal = $state(false);
  let showResponseModal = $state(false);

  // Response viewing
  let viewingResponse = $state<SurveyResponse | null>(null);
  let viewingSurvey = $state<Survey | null>(null);

  // Loading state - PERFORMANCE: Start true to prevent FOUC (triple-render)
  let isLoading = $state(true);
  let isSubmitting = $state(false);

  // Derived: Pending surveys (not responded yet)
  const pendingSurveys = $derived(surveys.filter((s) => !s.hasResponded));

  // Derived: Completed surveys (already responded)
  const completedSurveys = $derived(surveys.filter((s) => s.hasResponded));

  // Derived: Total questions in current survey
  const totalQuestions = $derived(currentSurvey?.questions.length ?? 0);

  // Derived: Answered questions count
  const answeredCount = $derived(Object.keys(answers).length);

  // Derived: Progress percentage
  const progressPercentage = $derived(
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0,
  );

  // Methods
  function setSurveys(data: SurveyWithStatus[]) {
    surveys = data;
  }

  function setCurrentSurvey(survey: Survey | null) {
    currentSurvey = survey;
  }

  function clearAnswers() {
    answers = {};
  }

  function setAnswer(questionId: number, answer: AnswerMap[number]) {
    answers = { ...answers, [questionId]: answer };
  }

  function removeAnswer(questionId: number) {
    const newAnswers = { ...answers };
    delete newAnswers[questionId];
    answers = newAnswers;
  }

  function openSurveyModal(survey: Survey) {
    currentSurvey = survey;
    answers = {};
    showSurveyModal = true;
  }

  function closeSurveyModal() {
    showSurveyModal = false;
    currentSurvey = null;
    answers = {};
  }

  function openResponseModal(survey: Survey, response: SurveyResponse) {
    viewingSurvey = survey;
    viewingResponse = response;
    showResponseModal = true;
  }

  function closeResponseModal() {
    showResponseModal = false;
    viewingSurvey = null;
    viewingResponse = null;
  }

  function setLoading(val: boolean) {
    isLoading = val;
  }

  function setSubmitting(val: boolean) {
    isSubmitting = val;
  }

  function reset() {
    surveys = [];
    currentSurvey = null;
    answers = {};
    showSurveyModal = false;
    showResponseModal = false;
    viewingResponse = null;
    viewingSurvey = null;
    isLoading = false;
    isSubmitting = false;
  }

  return {
    // Getters (reactive)
    get surveys() {
      return surveys;
    },
    get currentSurvey() {
      return currentSurvey;
    },
    get answers() {
      return answers;
    },
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
    get pendingSurveys() {
      return pendingSurveys;
    },
    get completedSurveys() {
      return completedSurveys;
    },
    get totalQuestions() {
      return totalQuestions;
    },
    get answeredCount() {
      return answeredCount;
    },
    get progressPercentage() {
      return progressPercentage;
    },

    // Methods
    setSurveys,
    setCurrentSurvey,
    clearAnswers,
    setAnswer,
    removeAnswer,
    openSurveyModal,
    closeSurveyModal,
    openResponseModal,
    closeResponseModal,
    setLoading,
    setSubmitting,
    reset,
  };
}

// Singleton export
export const surveyEmployeeState = createSurveyEmployeeState();
