/**
 * Survey Employee - TypeScript Type Definitions
 */

export interface Survey {
  id: number;
  title: string | BufferData;
  description: string | BufferData | null;
  status: 'draft' | 'active' | 'closed' | 'archived';
  is_mandatory: boolean | number | string;
  is_anonymous: boolean | number | string;
  start_date: string | null;
  end_date: string | null;
  questions: Question[];
}

export interface Question {
  id: number;
  questionText: string | BufferData;
  questionType: QuestionType;
  is_required: boolean | number | string;
  isRequired?: boolean; // Alternative property name
  options?: QuestionOption[];
}

export type QuestionType = 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'yes_no' | 'number' | 'date';

export interface QuestionOption {
  id: number;
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
  survey_id: number;
  user_id: number;
  completed_at: string;
  answers: ResponseAnswer[];
}

export interface ResponseAnswer {
  question_id: number;
  question_text: string;
  answer_text?: string;
  answer_number?: number;
  answer_options?: string[];
}

export interface WindowWithExtensions extends Window {
  __surveyEmployeeManager?: unknown;
}
