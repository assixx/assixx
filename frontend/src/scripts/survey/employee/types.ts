/**
 * Survey Employee - TypeScript Type Definitions
 */

export interface Survey {
  id: number;
  title: string | BufferData;
  description: string | BufferData | null;
  status: 'draft' | 'active' | 'closed' | 'archived';
  isMandatory: boolean | number | string;
  isAnonymous: boolean | number | string;
  startDate: string | null;
  endDate: string | null;
  questions: Question[];
}

export interface Question {
  id: number;
  questionText: string | BufferData;
  questionType: QuestionType;
  isRequired: boolean | number | string;
  options?: QuestionOption[];
}

export type QuestionType = 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'yes_no' | 'number' | 'date';

export interface QuestionOption {
  id: number; // Real database ID from survey_question_options table
  optionText: string;
}

export interface BufferData {
  type: 'Buffer';
  data: number[];
}

export interface Answer {
  questionId: number;
  answerText?: string;
  answerNumber?: number;
  answerDate?: string;
  answerOptions?: number[];
  selectedOptions?: number[];
}

export type AnswerMap = Record<number, Answer>;

export interface ResponseCheck {
  responded: boolean;
  response?: SurveyResponse;
}

export interface SurveyResponse {
  id: number;
  surveyId: number;
  userId: number;
  completedAt: string;
  answers: ResponseAnswer[];
}

export interface ResponseAnswer {
  questionId: number;
  questionText: string;
  questionType?: string;
  answerText?: string;
  answerNumber?: number;
  answerDate?: string;
  answerOptions?: string[];
}

export interface WindowWithExtensions extends Window {
  __surveyEmployeeManager?: unknown;
}
