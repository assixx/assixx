// =============================================================================
// SURVEY-RESULTS - TYPE DEFINITIONS
// Based on: frontend/src/scripts/survey/results/types.ts
// =============================================================================

/**
 * Question option from API response
 * API v2 returns camelCase
 */
export interface QuestionOptionResponse {
  optionId?: number;
  optionText: string;
  count?: number; // For statistics
}

/**
 * Question statistics
 */
export interface QuestionStatistics {
  average?: number;
  min?: number;
  max?: number;
  count?: number;
}

/**
 * Text response entry
 */
export interface TextResponse {
  answerText: string;
  userId?: number;
  firstName?: string;
  lastName?: string;
}

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
 * Survey question
 */
export interface SurveyQuestion {
  id: number;
  questionText: string;
  questionType: QuestionType;
  isRequired?: number | boolean;
  orderIndex?: number;
  options?: QuestionOptionResponse[];
  statistics?: QuestionStatistics;
  responses?: TextResponse[];
}

/**
 * Survey status
 */
export type SurveyStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived'
  | 'closed';

/**
 * Survey
 */
export interface Survey {
  id: number;
  uuid?: string; // UUIDv7 for external API calls (security)
  title: string;
  description?: string;
  status: SurveyStatus;
  isAnonymous: boolean | number | string;
  isMandatory?: boolean | number | string;
  allowMultipleResponses?: boolean;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  questions?: SurveyQuestion[];
  responseCount?: number;
  completedCount?: number;
  creatorFirstName?: string;
  creatorLastName?: string;
}

/**
 * Survey statistics
 */
export interface SurveyStatistics {
  totalResponses?: number;
  completedResponses?: number;
  completionRate?: number;
  questions?: SurveyQuestion[];
  firstResponse?: string;
  lastResponse?: string;
}

/**
 * Response answer
 */
export interface ResponseAnswer {
  questionId: number;
  questionText?: string;
  answerText?: string | null;
  answerNumber?: number | null;
  answerDate?: string | null;
  answerOptions?: number[] | null;
}

/**
 * Survey response
 */
export interface SurveyResponse {
  id: number;
  surveyId?: number;
  userId?: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  status: 'in_progress' | 'completed';
  completedAt?: string;
  startedAt?: string;
  answers?: ResponseAnswer[];
}

/**
 * Responses data wrapper
 */
export interface ResponsesData {
  responses: SurveyResponse[];
  total: number;
}

/**
 * Survey response with user data (for individual responses view)
 * Alias for SurveyResponse - kept for backwards compatibility
 */
export type SurveyResponseWithUser = SurveyResponse;
