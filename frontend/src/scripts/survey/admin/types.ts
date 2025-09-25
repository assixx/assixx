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

export interface WindowWithExtensions {
  surveyAdmin?: SurveyAdminInstance;
}

// ============================================
// Survey Related Types
// ============================================

export interface SurveyQuestion {
  id?: number;
  questionText: string;
  questionType: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'yes_no' | 'number' | 'date';
  isRequired: boolean;
  orderPosition: number;
  options?: string[] | QuestionOption[];
  // Legacy field names
  is_required?: boolean;
}

export interface QuestionOption {
  option_text: string;
}

export interface SurveyAssignment {
  type: 'all_users' | 'department' | 'team' | 'user';
  departmentId?: number;
  teamId?: number;
  userId?: number;
  // Legacy field names
  assignmentType?: string;
  assignment_type?: string;
  department_id?: number;
  team_id?: number;
}

export interface Survey {
  id?: number;
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
  // Legacy field names from API
  assignment_type?: string;
  assignmentType?: string;
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

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
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
