/**
 * Survey Type Definitions
 * Unified type definitions for survey module
 */

// Question types supported by the survey system
export type QuestionType =
  | "text"
  | "single_choice"
  | "multiple_choice"
  | "rating"
  | "number"
  | "yes_no"; // Alias for single_choice with Yes/No options

// Map yes_no to single_choice for database
export function mapQuestionType(type: string): string {
  if (type === "yes_no") {
    return "single_choice";
  }
  return type;
}

// Survey status
export type SurveyStatus = "draft" | "active" | "closed" | "archived";

// Survey assignment types
export type AssignmentType = "company" | "department" | "team" | "individual";

// Database survey record
export interface DbSurvey {
  id: number;
  tenant_id: number;
  title: string;
  description?: string | null;
  created_by: number;
  status: SurveyStatus;
  is_anonymous: boolean | number;
  is_mandatory: boolean | number;
  start_date?: Date | null;
  end_date?: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Survey question
export interface SurveyQuestion {
  id?: number;
  survey_id?: number;
  question_text: string;
  question_type: QuestionType;
  is_required?: boolean;
  order_position?: number;
  options?: string[];
  created_at?: Date;
}

// Survey assignment
export interface SurveyAssignment {
  id?: number;
  survey_id?: number;
  type: AssignmentType;
  department_id?: number | null;
  team_id?: number | null;
  user_id?: number | null;
  created_at?: Date;
}

// Survey response
export interface SurveyResponse {
  id?: number;
  survey_id: number;
  user_id?: number | null;
  question_id: number;
  answer_text?: string | null;
  answer_number?: number | null;
  answer_option_id?: number | null;
  created_at?: Date;
}

// Create survey data
export interface SurveyCreateData {
  title: string;
  description?: string;
  status?: SurveyStatus;
  is_anonymous?: boolean;
  is_mandatory?: boolean;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  questions?: SurveyQuestion[];
  assignments?: SurveyAssignment[];
}

// Update survey data
export interface SurveyUpdateData {
  title?: string;
  description?: string;
  status?: SurveyStatus;
  is_anonymous?: boolean;
  is_mandatory?: boolean;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  questions?: SurveyQuestion[];
}

// Survey filters
export interface SurveyFilters {
  status?: SurveyStatus;
  created_by?: number;
  page?: number;
  limit?: number;
}

// Survey statistics
export interface SurveyStatistics {
  totalResponses: number;
  completedResponses: number;
  responseRate: number;
  averageCompletionTime?: number;
  questionStats?: {
    questionId: number;
    questionText: string;
    responseCount: number;
    answers?: Record<string, unknown>;
  }[];
}
