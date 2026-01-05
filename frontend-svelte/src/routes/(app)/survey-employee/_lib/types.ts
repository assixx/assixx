// =============================================================================
// SURVEY-EMPLOYEE - TYPE DEFINITIONS
// Based on: frontend/src/scripts/survey/employee/types.ts
// =============================================================================

/**
 * Survey status
 */
export type SurveyStatus = 'draft' | 'active' | 'closed' | 'archived';

/**
 * Question type
 */
export type QuestionType =
  | 'text'
  | 'single_choice'
  | 'multiple_choice'
  | 'rating'
  | 'yes_no'
  | 'number'
  | 'date';

/**
 * Buffer type (from legacy API - MySQL BLOB data)
 */
export interface BufferData {
  type: 'Buffer';
  data: number[];
}

/**
 * Question option from API response
 */
export interface QuestionOption {
  id: number;
  optionText: string;
}

/**
 * Survey question
 */
export interface Question {
  id: number;
  questionText: string | BufferData;
  questionType: QuestionType;
  isRequired: boolean | number | string;
  options?: QuestionOption[];
}

/**
 * Survey
 */
export interface Survey {
  id: number;
  title: string | BufferData;
  description: string | BufferData | null;
  status: SurveyStatus;
  isMandatory: boolean | number | string;
  isAnonymous: boolean | number | string;
  startDate: string | null;
  endDate: string | null;
  questions: Question[];
}

/**
 * Answer (used when submitting)
 */
export interface Answer {
  questionId: number;
  answerText?: string;
  answerNumber?: number;
  answerDate?: string;
  answerOptions?: number[];
  selectedOptions?: number[];
}

/**
 * Answer map (questionId -> Answer)
 */
export type AnswerMap = Record<number, Answer>;

/**
 * Response answer (from API)
 */
export interface ResponseAnswer {
  questionId: number;
  questionText: string;
  questionType?: string;
  answerText?: string;
  answerNumber?: number;
  answerDate?: string;
  answerOptions?: string[];
}

/**
 * Survey response (user's completed response)
 */
export interface SurveyResponse {
  id: number;
  surveyId: number;
  userId: number;
  completedAt: string;
  answers: ResponseAnswer[];
}

/**
 * Response check result
 */
export interface ResponseCheck {
  responded: boolean;
  response?: SurveyResponse;
}

/**
 * Survey with response status (for display)
 */
export interface SurveyWithStatus extends Survey {
  hasResponded: boolean;
  responseData?: SurveyResponse;
}
