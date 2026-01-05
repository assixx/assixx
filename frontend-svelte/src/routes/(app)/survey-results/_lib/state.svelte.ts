// =============================================================================
// SURVEY-RESULTS - REACTIVE STATE (Svelte 5 Runes)
// Based on: frontend/src/scripts/survey/results/index.ts
// =============================================================================

import { SvelteSet } from 'svelte/reactivity';
import type { Survey, SurveyStatistics, ResponsesData } from './types';

/**
 * Survey Results State using Svelte 5 Runes
 */
function createSurveyResultsState() {
  // Survey data
  let survey = $state<Survey | null>(null);
  let statistics = $state<SurveyStatistics | null>(null);
  let responsesData = $state<ResponsesData | null>(null);

  // Current survey ID (from URL)
  let surveyId = $state<string | null>(null);

  // Loading states - PERFORMANCE: Start true to prevent FOUC (triple-render)
  let isLoading = $state(true);
  let isExporting = $state(false);

  // Error state
  let errorMessage = $state<string | null>(null);

  // Accordion state for individual responses
  const expandedResponses = new SvelteSet<number>();

  // Derived: Has data
  const hasData = $derived(survey !== null && statistics !== null);

  // Derived: Is anonymous survey (using $derived.by for multi-line logic)
  const isAnonymous = $derived.by(() => {
    if (survey === null) return false;
    const isAnon = survey.isAnonymous;
    return isAnon === '1' || isAnon === 1 || isAnon === true;
  });

  // Derived: Total responses
  const totalResponses = $derived(statistics?.totalResponses ?? 0);

  // Derived: Completed responses
  const completedResponses = $derived(statistics?.completedResponses ?? 0);

  // Derived: Completion rate
  const completionRate = $derived(statistics?.completionRate ?? 0);

  // Derived: Has individual responses
  const hasResponses = $derived(
    responsesData !== null &&
      responsesData.responses !== undefined &&
      responsesData.responses.length > 0,
  );

  // Methods
  function setSurveyId(id: string | null) {
    surveyId = id;
  }

  function setSurvey(data: Survey | null) {
    survey = data;
  }

  function setStatistics(data: SurveyStatistics | null) {
    statistics = data;
  }

  function setResponsesData(data: ResponsesData | null) {
    responsesData = data;
  }

  function setLoading(val: boolean) {
    isLoading = val;
  }

  function setExporting(val: boolean) {
    isExporting = val;
  }

  function setError(message: string | null) {
    errorMessage = message;
  }

  function toggleResponseExpanded(index: number) {
    if (expandedResponses.has(index)) {
      expandedResponses.delete(index);
    } else {
      expandedResponses.add(index);
    }
  }

  function isResponseExpanded(index: number): boolean {
    return expandedResponses.has(index);
  }

  function reset() {
    survey = null;
    statistics = null;
    responsesData = null;
    surveyId = null;
    isLoading = false;
    isExporting = false;
    errorMessage = null;
    expandedResponses.clear();
  }

  return {
    // Getters (reactive)
    get survey() {
      return survey;
    },
    get statistics() {
      return statistics;
    },
    get responsesData() {
      return responsesData;
    },
    get surveyId() {
      return surveyId;
    },
    get isLoading() {
      return isLoading;
    },
    get isExporting() {
      return isExporting;
    },
    get errorMessage() {
      return errorMessage;
    },
    get hasData() {
      return hasData;
    },
    get isAnonymous() {
      return isAnonymous;
    },
    get totalResponses() {
      return totalResponses;
    },
    get completedResponses() {
      return completedResponses;
    },
    get completionRate() {
      return completionRate;
    },
    get hasResponses() {
      return hasResponses;
    },

    // Methods
    setSurveyId,
    setSurvey,
    setStatistics,
    setResponsesData,
    setLoading,
    setExporting,
    setError,
    toggleResponseExpanded,
    isResponseExpanded,
    reset,
  };
}

// Singleton export
export const surveyResultsState = createSurveyResultsState();
