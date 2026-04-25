// =============================================================================
// SURVEY-EMPLOYEE - DATA STATE (Svelte 5 Runes)
// Handles: surveys, answers, current survey
// =============================================================================

import type { Answer, Survey, SurveyWithStatus, AnswerMap } from './types';

/**
 * Survey data state
 */
function createSurveyDataState() {
  let surveys = $state<SurveyWithStatus[]>([]);
  let currentSurvey = $state<Survey | null>(null);
  let answers = $state<AnswerMap>({});

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

  return {
    get surveys() {
      return surveys;
    },
    get currentSurvey() {
      return currentSurvey;
    },
    get answers() {
      return answers;
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

    setSurveys(data: SurveyWithStatus[]) {
      surveys = data;
    },
    setCurrentSurvey(survey: Survey | null) {
      currentSurvey = survey;
    },
    setAnswers(data: AnswerMap) {
      answers = data;
    },
    clearAnswers() {
      answers = {};
    },
    setAnswer(questionId: number, answer: Answer) {
      answers = { ...answers, [questionId]: answer };
    },
    removeAnswer(questionId: number) {
      // Use Object.fromEntries to avoid dynamic delete
      answers = Object.fromEntries(
        Object.entries(answers).filter(([key]) => Number(key) !== questionId),
      );
    },
  };
}

export const surveyDataState = createSurveyDataState();
