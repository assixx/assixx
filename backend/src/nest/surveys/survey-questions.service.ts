/**
 * Survey Questions Service
 *
 * Manages survey questions, options, and assignments.
 * Injected into the SurveysService facade.
 */
import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { buildAssignmentData, buildQuestionData } from './surveys.helpers.js';
import type {
  AssignmentInput,
  DbSurveyAssignment,
  DbSurveyQuestion,
  DbSurveyQuestionOption,
  QuestionInput,
} from './surveys.types.js';

@Injectable()
export class SurveyQuestionsService {
  constructor(private readonly db: DatabaseService) {}

  /** Loads questions (with options) and assignments for a survey */
  async loadSurveyQuestionsAndAssignments(surveyId: number): Promise<{
    questions: DbSurveyQuestion[];
    assignments: DbSurveyAssignment[];
  }> {
    const questions = await this.db.query<DbSurveyQuestion>(
      `SELECT * FROM survey_questions WHERE survey_id = $1 ORDER BY order_index`,
      [surveyId],
    );
    if (questions.length > 0) {
      const questionIds = questions.map((q: DbSurveyQuestion) => q.id);
      const placeholders = questionIds
        .map((_: number, idx: number) => `$${idx + 1}`)
        .join(',');
      const optionRows = await this.db.query<DbSurveyQuestionOption>(
        `SELECT id, question_id, option_text, order_position FROM survey_question_options
         WHERE question_id IN (${placeholders}) ORDER BY question_id, order_position`,
        questionIds,
      );
      const optionsMap = this.buildOptionsMap(optionRows);
      this.attachOptionsToQuestions(questions, optionsMap);
    }
    const assignments = await this.db.query<DbSurveyAssignment>(
      `SELECT * FROM survey_assignments WHERE survey_id = $1`,
      [surveyId],
    );
    return { questions, assignments };
  }

  /** Inserts questions and their options for a survey */
  async insertSurveyQuestions(
    tenantId: number,
    surveyId: number,
    questions: unknown[],
  ): Promise<void> {
    for (const [index, q] of questions.entries()) {
      const questionData = buildQuestionData(q as QuestionInput, index);
      const questionRows = await this.db.query<{ id: number }>(
        `INSERT INTO survey_questions (tenant_id, survey_id, question_text, question_type, is_required, order_index)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          tenantId,
          surveyId,
          questionData.question_text,
          questionData.question_type,
          questionData.is_required ? 1 : 0,
          questionData.order_position,
        ],
      );
      const questionId = questionRows[0]?.id ?? 0;
      await this.insertQuestionOptions(tenantId, questionId, questionData);
    }
  }

  /** Inserts options for choice-type questions */
  async insertQuestionOptions(
    tenantId: number,
    questionId: number,
    questionData: { question_type: string; options?: string[] },
  ): Promise<void> {
    if (questionData.options === undefined || questionData.options.length === 0)
      return;
    const qType = questionData.question_type;
    if (qType !== 'single_choice' && qType !== 'multiple_choice') return;
    for (const [optIndex, optionText] of questionData.options.entries()) {
      await this.db.query(
        `INSERT INTO survey_question_options (tenant_id, question_id, option_text, order_position) VALUES ($1, $2, $3, $4)`,
        [tenantId, questionId, optionText, optIndex],
      );
    }
  }

  /** Inserts assignments for a survey */
  async insertSurveyAssignments(
    tenantId: number,
    surveyId: number,
    assignments: unknown[],
  ): Promise<void> {
    for (const a of assignments) {
      const data = buildAssignmentData(a as AssignmentInput);
      await this.db.query(
        `INSERT INTO survey_assignments (tenant_id, survey_id, assignment_type, area_id, department_id, team_id, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          surveyId,
          data.type,
          data.area_id,
          data.department_id,
          data.team_id,
          data.user_id,
        ],
      );
    }
  }

  /** Groups options by question_id into a Map */
  private buildOptionsMap(
    optionRows: DbSurveyQuestionOption[],
  ): Map<number, DbSurveyQuestionOption[]> {
    const optionsMap = new Map<number, DbSurveyQuestionOption[]>();
    for (const option of optionRows) {
      const existing = optionsMap.get(option.question_id) ?? [];
      existing.push(option);
      optionsMap.set(option.question_id, existing);
    }
    return optionsMap;
  }

  /** Attaches options to choice-type questions */
  private attachOptionsToQuestions(
    questions: DbSurveyQuestion[],
    optionsMap: Map<number, DbSurveyQuestionOption[]>,
  ): void {
    const choiceTypes = ['single_choice', 'multiple_choice'];
    for (const question of questions) {
      if (choiceTypes.includes(question.question_type)) {
        question.options = optionsMap.get(question.id) ?? [];
      }
    }
  }
}
