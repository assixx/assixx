/**
 * Survey Module Type Definitions
 *
 * Shared interfaces used across all survey sub-services.
 * Per splitting Rule 7: shared types remain in a single module-level file.
 */

// ============================================
// DATABASE ROW TYPES
// ============================================

export interface DbSurvey {
  id: number;
  uuid: string;
  tenant_id: number;
  title: string;
  description?: string | null;
  created_by: number;
  status: 'draft' | 'active' | 'closed';
  is_anonymous: boolean | number;
  is_mandatory?: boolean | number;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  creator_first_name?: string;
  creator_last_name?: string;
  response_count?: number | string;
  completed_count?: number | string;
  questions?: DbSurveyQuestion[];
  assignments?: DbSurveyAssignment[];
}

export interface DbSurveyQuestion {
  id: number;
  survey_id: number;
  question_text: string;
  question_type:
    | 'text'
    | 'single_choice'
    | 'multiple_choice'
    | 'rating'
    | 'number'
    | 'yes_no'
    | 'date';
  is_required: boolean | number;
  order_index: number;
  order_position?: number;
  options?: DbSurveyQuestionOption[];
}

export interface DbSurveyQuestionOption {
  id: number;
  question_id: number;
  option_text: string;
  order_position: number;
}

export interface DbSurveyAssignment {
  id: number;
  survey_id: number;
  assignment_type: 'all_users' | 'area' | 'department' | 'team' | 'user';
  area_id?: number | null;
  area_name?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  team_id?: number | null;
  team_name?: string | null;
  user_id?: number | null;
}

export interface DbSurveyTemplate {
  id: number;
  tenant_id?: number | null;
  name: string;
  description?: string | null;
  template_data: string;
  is_public: boolean | number;
  created_at: Date | string;
}

export interface DbSurveyResponse {
  id: number;
  survey_id: number;
  user_id: number;
  tenant_id: number;
  started_at: Date | string;
  completed_at: Date | string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}

export interface DbSurveyAnswer {
  id: number;
  response_id: number;
  question_id: number;
  tenant_id: number;
  answer_text?: string | null;
  answer_number?: number | null;
  answer_date?: Date | string | null;
  answer_options?: string | number[] | null;
  question_type?: string;
  question_text?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface SurveyAnswer {
  questionId?: number | undefined;
  question_id?: number | undefined;
  answerText?: string | undefined;
  answerNumber?: number | undefined;
  answerDate?: string | undefined;
  answerOptions?: number[] | undefined;
  answer_text?: string | undefined;
  answer_number?: number | undefined;
  answer_date?: string | undefined;
  answer_options?: number[] | undefined;
}

export interface SurveyResponse {
  id: number;
  surveyId: number;
  userId: number;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  startedAt: string;
  completedAt: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  answers?: SurveyAnswer[];
}

export interface PaginatedResponsesResult {
  responses: SurveyResponse[];
  total: number;
}

export interface SurveyStatisticsResponse {
  surveyId: number;
  totalResponses: number;
  completedResponses: number;
  completionRate: number;
  firstResponse?: Date | null;
  lastResponse?: Date | null;
  questions: {
    id: number;
    questionText: string;
    questionType: string;
    responses?: {
      answerText?: string;
      userId?: number | null;
      firstName?: string | null;
      lastName?: string | null;
    }[];
    options?: { optionId: number; optionText: string; count: number }[];
    statistics?: {
      average: number | null;
      min: number | null;
      max: number | null;
      totalResponses: number;
    };
  }[];
}

// ============================================
// INTERNAL TYPES
// ============================================

export interface NormalizedAnswer {
  question_id: number | undefined;
  answer_text: string | undefined;
  answer_number: number | undefined;
  answer_date: string | undefined;
  answer_options: number[] | undefined;
}

export interface ExportRow {
  response_id: number;
  user_id: number;
  completed_at: Date | string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  question_text: string;
  question_type: string;
  answer_text: string | null;
  answer_number: number | null;
  answer_date: Date | string | null;
  answer_options: string | null;
}

export interface QuestionInput {
  questionText: string;
  questionType: string;
  isRequired?: number | boolean | undefined;
  orderPosition?: number | undefined;
  options?: (string | { optionText: string })[] | undefined;
}

export interface QuestionDbPayload {
  question_text: string;
  question_type: string;
  is_required: boolean;
  order_position: number;
  options?: string[];
}

export interface AssignmentInput {
  type: string;
  areaId?: number | undefined;
  departmentId?: number | undefined;
  teamId?: number | undefined;
  userId?: number | undefined;
}

export interface AssignmentDbPayload {
  type: string;
  area_id: number | null;
  department_id: number | null;
  team_id: number | null;
  user_id: number | null;
}
