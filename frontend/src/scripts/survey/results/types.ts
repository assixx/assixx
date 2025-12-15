/**
 * Survey Results Type Definitions
 * Contains all type definitions for survey results module
 */

// ============================================
// Survey Related Types
// ============================================

/**
 * Question option from API response
 * API v2 returns camelCase
 */
export interface QuestionOptionResponse {
  optionId?: number;
  optionText: string;
  count?: number; // For statistics
}

export interface SurveyQuestion {
  id: number;
  questionText: string;
  questionType: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'yes_no' | 'number' | 'date';
  isRequired?: number | boolean;
  orderIndex?: number;
  options?: QuestionOptionResponse[];
  statistics?: QuestionStatistics;
  responses?: TextResponse[];
}

export interface QuestionStatistics {
  average?: number;
  min?: number;
  max?: number;
  count?: number;
}

export interface TextResponse {
  answerText: string;
  userId?: number;
  firstName?: string;
  lastName?: string;
}

export interface Survey {
  id: number;
  uuid?: string; // UUIDv7 for external API calls (security)
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived' | 'closed';
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

// ============================================
// Statistics Types
// ============================================

export interface SurveyStatistics {
  totalResponses?: number;
  completedResponses?: number;
  completionRate?: number;
  questions?: SurveyQuestion[];
  firstResponse?: string;
  lastResponse?: string;
}

// ============================================
// Response Types
// ============================================

export interface ResponseAnswer {
  questionId: number;
  questionText?: string;
  answerText?: string | null;
  answerNumber?: number | null;
  answerDate?: string | null;
  answerOptions?: number[] | null;
}

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

export interface ResponsesData {
  responses: SurveyResponse[];
  total: number;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string | { message?: string };
}
