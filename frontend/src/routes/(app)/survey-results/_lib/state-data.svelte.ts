// =============================================================================
// SURVEY-RESULTS STATE - DATA MODULE
// Survey, statistics, responses data
// =============================================================================

import type { ResponsesData, Survey, SurveyStatistics } from './types';

/** Check if survey is marked as anonymous (handles multiple formats) */
function checkIsAnonymous(survey: Survey | null): boolean {
  if (survey === null) return false;
  const isAnon = survey.isAnonymous;
  return isAnon === '1' || isAnon === 1 || isAnon === true;
}

// =============================================================================
// Module-level reactive state (Svelte 5 best practice)
// =============================================================================
let survey = $state<Survey | null>(null);
let statistics = $state<SurveyStatistics | null>(null);
let responsesData = $state<ResponsesData | null>(null);
let surveyId = $state<string | null>(null);

// Derived computations
const hasData = $derived(survey !== null && statistics !== null);
const isAnonymous = $derived(checkIsAnonymous(survey));
const totalResponses = $derived(statistics?.totalResponses ?? 0);
const completedResponses = $derived(statistics?.completedResponses ?? 0);
const completionRate = $derived(statistics?.completionRate ?? 0);
const hasResponses = $derived(
  responsesData?.responses !== undefined && responsesData.responses.length > 0,
);

// =============================================================================
// Exported state object with getters and setters
// =============================================================================
export const dataState = {
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
  setSurveyId: (id: string | null) => {
    surveyId = id;
  },
  setSurvey: (data: Survey | null) => {
    survey = data;
  },
  setStatistics: (data: SurveyStatistics | null) => {
    statistics = data;
  },
  setResponsesData: (data: ResponsesData | null) => {
    responsesData = data;
  },
  reset: () => {
    survey = null;
    statistics = null;
    responsesData = null;
    surveyId = null;
  },
};
