// =============================================================================
// SURVEY-ADMIN - TYPE DEFINITIONS
// Based on: frontend/src/scripts/survey/admin/types.ts
// =============================================================================

/**
 * User roles
 */
export type UserRole = 'root' | 'admin' | 'employee' | 'dummy';

/**
 * Survey status
 */
export type SurveyStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

/**
 * Survey type
 */
export type SurveyType = 'feedback' | 'satisfaction' | 'poll' | 'assessment' | 'other';

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
 * Assignment type
 */
export type AssignmentType = 'all_users' | 'area' | 'department' | 'team' | 'user';

/**
 * Current user
 */
export interface User {
  id: number;
  role: UserRole;
  tenantId: number;
  departmentId: number | null;
  teamId?: number;
  hasFullAccess?: boolean;
}

/**
 * Buffer type (from legacy)
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
  questionId: number;
  optionText: string;
  orderPosition: number;
  createdAt?: string;
}

/**
 * Survey question
 */
export interface SurveyQuestion {
  id?: number;
  questionText: string | BufferData;
  questionType: QuestionType;
  isRequired: number | boolean;
  orderIndex?: number;
  options?: string[] | QuestionOption[];
}

/**
 * Survey assignment
 */
export interface SurveyAssignment {
  type?: AssignmentType;
  assignmentType?: AssignmentType;
  areaId?: number;
  areaName?: string;
  departmentId?: number;
  departmentName?: string;
  teamId?: number;
  teamName?: string;
  userId?: number;
}

/**
 * Survey
 */
export interface Survey {
  id?: number;
  uuid?: string;
  title: string | BufferData;
  description: string | BufferData;
  type?: SurveyType;
  status?: SurveyStatus;
  isAnonymous: boolean | string | number;
  isMandatory: boolean | string | number;
  allowMultipleResponses?: boolean;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  questions?: SurveyQuestion[];
  assignments?: SurveyAssignment[];
  responseCount?: number;
  completedCount?: number;
  creatorFirstName?: string;
  creatorLastName?: string;
  canManage?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Survey template
 */
export interface SurveyTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  questions: SurveyQuestion[];
}

/**
 * Department
 */
export interface Department {
  id: number;
  name: string;
  areaId?: number;
  areaName?: string;
  memberCount?: number;
  employeeCount?: number;
  departmentLeadId?: number | null;
}

/**
 * Team
 */
export interface Team {
  id: number;
  name: string;
  memberCount?: number;
  departmentId?: number | null;
  leaderId?: number | null;
}

/**
 * Area
 */
export interface Area {
  id: number;
  name: string;
  departmentCount?: number;
  areaLeadId?: number | null;
}

/**
 * Create/Update survey form data
 */
export interface SurveyFormData {
  title: string;
  description: string;
  status: SurveyStatus;
  isAnonymous: boolean;
  isMandatory: boolean;
  startDate?: string;
  endDate?: string;
  questions: SurveyQuestion[];
  assignments: SurveyAssignment[];
}

/**
 * API response with survey ID
 */
export interface SurveyApiResponse {
  surveyId?: number;
  id?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
