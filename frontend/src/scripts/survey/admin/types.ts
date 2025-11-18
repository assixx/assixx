/**
 * Survey Administration Type Definitions
 * Contains all type definitions for survey administration module
 */

// ============================================
// Window Extensions
// ============================================

export interface SurveyAdminInstance {
  loadSurveys(): Promise<void>;
  showCreateModal(): void;
  closeModal(): void;
  addQuestion(): void;
  saveSurvey(status: 'draft' | 'active'): Promise<void>;
  toggleDropdown(dropdownId: string): void;
  removeQuestion(questionId: string): void;
  addOption(questionId: string): void;
  removeOption(button: HTMLElement): void;
  selectQuestionType(questionId: string, type: string, text: string): void;
  selectAssignmentOption(type: string, text: string): Promise<void>;
  editSurvey(surveyId: number): Promise<void>;
  deleteSurvey(surveyId: number): Promise<void>;
  viewResults(surveyId: number): void;
  createFromTemplate(templateId: number): void;
}

export interface WindowWithExtensions extends Window {
  surveyAdmin?: SurveyAdminInstance;
  __surveyAdminManager?: unknown;
}

// ============================================
// Survey Related Types
// ============================================

/**
 * Question option from API response (loaded from survey_question_options table)
 * Contains full database fields transformed to camelCase
 */
export interface QuestionOptionResponse {
  id: number;
  questionId: number;
  optionText: string;
  orderPosition: number;
  createdAt?: string;
}

export interface SurveyQuestion {
  id?: number;
  questionText: string;
  questionType: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'yes_no' | 'number' | 'date';
  isRequired: number | boolean;
  orderIndex?: number;
  options?: string[] | QuestionOptionResponse[];
}

export interface SurveyAssignment {
  type?: 'all_users' | 'area' | 'department' | 'team' | 'user';
  assignmentType?: 'all_users' | 'area' | 'department' | 'team' | 'user';
  areaId?: number;
  departmentId?: number;
  teamId?: number;
  userId?: number;
}

export interface Survey {
  id?: number;
  uuid?: string; // UUIDv7 for external API calls (security)
  title: string | Buffer;
  description: string | Buffer;
  type?: 'feedback' | 'satisfaction' | 'poll' | 'assessment' | 'other';
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  isAnonymous: boolean | string | number;
  isMandatory: boolean | string | number;
  allowMultipleResponses?: boolean;
  startDate?: string | Date;
  endDate?: string | Date;
  questions?: SurveyQuestion[];
  assignments?: SurveyAssignment[];
  responseCount?: number;
  completedCount?: number;
  creatorFirstName?: string;
  creatorLastName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Buffer {
  type: 'Buffer';
  data: number[];
}

export interface SurveyTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  questions: SurveyQuestion[];
}

// ============================================
// Organization Types
// ============================================

export interface Department {
  id: number;
  name: string;
  member_count?: number;
  memberCount?: number;
  employee_count?: number;
  employeeCount?: number;
  can_read?: boolean;
  can_write?: boolean;
}

export interface Team {
  id: number;
  name: string;
  member_count?: number;
  memberCount?: number;
}

export interface Area {
  id: number;
  name: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string | { message?: string };
}

export interface SurveyApiResponse {
  success?: boolean;
  id?: number;
  error?: { message?: string };
}

export interface TemplateResponse {
  success?: boolean;
  data?: SurveyTemplate[];
  templates?: SurveyTemplate[];
}
