/**
 * Survey Model
 * Handles database operations for surveys
 */

import pool from '../database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';

// Type-safe pool query wrapper
const typedQuery = (sql: string, params?: any[]): Promise<[any, any]> => {
  return (pool as any).query(sql, params);
};

// Database interfaces
interface DbSurvey extends RowDataPacket {
  id: number;
  tenant_id: number;
  title: string;
  description?: string | null;
  created_by: number;
  status: 'draft' | 'active' | 'closed';
  is_anonymous: boolean | number;
  start_date?: Date | null;
  end_date?: Date | null;
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  creator_first_name?: string;
  creator_last_name?: string;
  response_count?: number;
  completed_count?: number;
  questions?: DbSurveyQuestion[];
  assignments?: DbSurveyAssignment[];
}

interface DbSurveyQuestion extends RowDataPacket {
  id: number;
  survey_id: number;
  question_text: string;
  question_type:
    | 'text'
    | 'single_choice'
    | 'multiple_choice'
    | 'rating'
    | 'number';
  is_required: boolean | number;
  order_position: number;
  created_at: Date;
  options?: DbSurveyQuestionOption[];
}

interface DbSurveyQuestionOption extends RowDataPacket {
  id: number;
  question_id: number;
  option_text: string;
  order_position: number;
}

interface DbSurveyAssignment extends RowDataPacket {
  id: number;
  survey_id: number;
  assignment_type: 'company' | 'department' | 'team' | 'individual';
  department_id?: number | null;
  team_id?: number | null;
  user_id?: number | null;
}

interface DbSurveyTemplate extends RowDataPacket {
  id: number;
  tenant_id?: number | null;
  name: string;
  description?: string | null;
  template_data: string;
  is_public: boolean | number;
  created_at: Date;
}

interface SurveyCreateData {
  title: string;
  description?: string;
  status?: 'draft' | 'active' | 'closed';
  is_anonymous?: boolean;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  questions?: Array<{
    question_text: string;
    question_type:
      | 'text'
      | 'single_choice'
      | 'multiple_choice'
      | 'rating'
      | 'number';
    is_required?: boolean;
    order_position?: number;
    options?: string[];
  }>;
  assignments?: Array<{
    type: 'company' | 'department' | 'team' | 'individual';
    department_id?: number | null;
    team_id?: number | null;
    user_id?: number | null;
  }>;
}

interface SurveyFilters {
  status?: 'draft' | 'active' | 'closed';
  page?: number;
  limit?: number;
}

interface SurveyStatistics {
  survey_id: number;
  total_responses: number;
  completed_responses: number;
  completion_rate: number;
  first_response?: Date | null;
  last_response?: Date | null;
  questions: Array<{
    id: number;
    question_text: string;
    question_type: string;
    responses?: any[];
    options?: Array<{
      option_id: number;
      option_text: string;
      count: number;
    }>;
    statistics?: {
      average: number | null;
      min: number | null;
      max: number | null;
      count: number;
    };
  }>;
}

export class Survey {
  /**
   * Create a new survey
   */
  static async create(
    surveyData: SurveyCreateData,
    tenantId: number,
    createdBy: number
  ): Promise<number> {
    // Check if we're using mock database
    if (!('getConnection' in pool)) {
      // Mock implementation - just return a fake ID
      return 1;
    }

    const connection = (await pool.getConnection()) as PoolConnection;
    try {
      await connection.beginTransaction();

      // Create survey
      const [surveyResult] = await connection.query<ResultSetHeader>(
        `
        INSERT INTO surveys (
          tenant_id, title, description, created_by, status,
          is_anonymous, start_date, end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          tenantId,
          surveyData.title,
          surveyData.description || null,
          createdBy,
          surveyData.status || 'draft',
          surveyData.is_anonymous || false,
          surveyData.start_date || null,
          surveyData.end_date || null,
        ]
      );

      const surveyId = surveyResult.insertId;

      // Add questions
      if (surveyData.questions && surveyData.questions.length > 0) {
        for (const [index, question] of surveyData.questions.entries()) {
          const [questionResult] = await connection.query<ResultSetHeader>(
            `
            INSERT INTO survey_questions (
              survey_id, question_text, question_type, is_required, order_position
            ) VALUES (?, ?, ?, ?, ?)
          `,
            [
              surveyId,
              question.question_text,
              question.question_type,
              question.is_required !== false,
              question.order_position || index + 1,
            ]
          );

          const questionId = questionResult.insertId;

          // Add options for multiple choice questions
          if (question.options && question.options.length > 0) {
            for (const [optIndex, option] of question.options.entries()) {
              await connection.query(
                `
                INSERT INTO survey_question_options (
                  question_id, option_text, order_position
                ) VALUES (?, ?, ?)
              `,
                [questionId, option, optIndex + 1]
              );
            }
          }
        }
      }

      // Add assignments
      if (surveyData.assignments && surveyData.assignments.length > 0) {
        for (const assignment of surveyData.assignments) {
          await connection.query(
            `
            INSERT INTO survey_assignments (
              survey_id, assignment_type, department_id, team_id, user_id
            ) VALUES (?, ?, ?, ?, ?)
          `,
            [
              surveyId,
              assignment.type,
              assignment.department_id || null,
              assignment.team_id || null,
              assignment.user_id || null,
            ]
          );
        }
      }

      await connection.commit();
      return surveyId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get all surveys for a tenant
   */
  static async getAllByTenant(
    tenantId: number,
    filters: SurveyFilters = {}
  ): Promise<DbSurvey[]> {
    const { status, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        s.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        COUNT(DISTINCT sr.id) as response_count,
        COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
      FROM surveys s
      LEFT JOIN users u ON s.created_by = u.id
      LEFT JOIN survey_responses sr ON s.id = sr.survey_id
      WHERE s.tenant_id = ?
    `;

    const params: any[] = [tenantId];

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    query += ' GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [surveys] = (await typedQuery(query, params)) as [DbSurvey[], any];
    return surveys;
  }

  /**
   * Get survey by ID with questions and options
   */
  static async getById(
    surveyId: number,
    tenantId: number
  ): Promise<DbSurvey | null> {
    const [surveys] = (await typedQuery(
      `
      SELECT s.*, 
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM surveys s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ? AND s.tenant_id = ?
    `,
      [surveyId, tenantId]
    )) as [DbSurvey[], any];

    if (surveys.length === 0) {
      return null;
    }

    const survey = surveys[0];

    // Get questions
    const [questions] = await typedQuery(
      `
      SELECT * FROM survey_questions
      WHERE survey_id = ?
      ORDER BY order_position
    `,
      [surveyId]
    );

    // Get options for each question
    for (const question of questions) {
      if (
        ['multiple_choice', 'single_choice'].includes(question.question_type)
      ) {
        const [options] = await typedQuery(
          `
          SELECT * FROM survey_question_options
          WHERE question_id = ?
          ORDER BY order_position
        `,
          [question.id]
        );
        question.options = options;
      }
    }

    survey.questions = questions;

    // Get assignments
    const [assignments] = await typedQuery(
      `
      SELECT * FROM survey_assignments
      WHERE survey_id = ?
    `,
      [surveyId]
    );

    survey.assignments = assignments;

    return survey;
  }

  /**
   * Update survey
   */
  static async update(
    surveyId: number,
    surveyData: SurveyCreateData,
    tenantId: number
  ): Promise<boolean> {
    // Check if we're using mock database
    if (!('getConnection' in pool)) {
      // Mock implementation
      return true;
    }

    const connection = (await pool.getConnection()) as PoolConnection;
    try {
      await connection.beginTransaction();

      // Update survey
      await connection.query(
        `
        UPDATE surveys SET
          title = ?,
          description = ?,
          status = ?,
          is_anonymous = ?,
          start_date = ?,
          end_date = ?
        WHERE id = ? AND tenant_id = ?
      `,
        [
          surveyData.title,
          surveyData.description || null,
          surveyData.status || 'draft',
          surveyData.is_anonymous || false,
          surveyData.start_date || null,
          surveyData.end_date || null,
          surveyId,
          tenantId,
        ]
      );

      // Update questions if provided
      if (surveyData.questions) {
        // Delete existing questions and options (cascade will handle options)
        await connection.query(
          'DELETE FROM survey_questions WHERE survey_id = ?',
          [surveyId]
        );

        // Add new questions
        for (const [index, question] of surveyData.questions.entries()) {
          const [questionResult] = await connection.query<ResultSetHeader>(
            `
            INSERT INTO survey_questions (
              survey_id, question_text, question_type, is_required, order_position
            ) VALUES (?, ?, ?, ?, ?)
          `,
            [
              surveyId,
              question.question_text,
              question.question_type,
              question.is_required !== false,
              question.order_position || index + 1,
            ]
          );

          const questionId = questionResult.insertId;

          // Add options
          if (question.options && question.options.length > 0) {
            for (const [optIndex, option] of question.options.entries()) {
              await connection.query(
                `
                INSERT INTO survey_question_options (
                  question_id, option_text, order_position
                ) VALUES (?, ?, ?)
              `,
                [questionId, option, optIndex + 1]
              );
            }
          }
        }
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete survey
   */
  static async delete(surveyId: number, tenantId: number): Promise<boolean> {
    const [result] = await typedQuery(
      'DELETE FROM surveys WHERE id = ? AND tenant_id = ?',
      [surveyId, tenantId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Get survey templates
   */
  static async getTemplates(tenantId: number): Promise<DbSurveyTemplate[]> {
    const [templates] = await typedQuery(
      `
      SELECT * FROM survey_templates
      WHERE tenant_id = ? OR is_public = 1
      ORDER BY name
    `,
      [tenantId]
    );
    return templates;
  }

  /**
   * Create survey from template
   */
  static async createFromTemplate(
    templateId: number,
    tenantId: number,
    createdBy: number
  ): Promise<number> {
    const [templates] = await typedQuery(
      `
      SELECT * FROM survey_templates
      WHERE id = ? AND (tenant_id = ? OR is_public = 1)
    `,
      [templateId, tenantId]
    );

    if (templates.length === 0) {
      throw new Error('Template not found');
    }

    const template = templates[0];
    const templateData = JSON.parse(template.template_data);

    const surveyData: SurveyCreateData = {
      title: templateData.title,
      description: templateData.description,
      questions: templateData.questions,
      status: 'draft',
    };

    return this.create(surveyData, tenantId, createdBy);
  }

  /**
   * Get survey statistics
   */
  static async getStatistics(
    surveyId: number,
    tenantId: number
  ): Promise<SurveyStatistics> {
    try {
      // Get basic statistics
      const [stats] = await typedQuery(
        `
        SELECT 
          COUNT(DISTINCT sr.id) as total_responses,
          COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_responses,
          MIN(sr.started_at) as first_response,
          MAX(sr.completed_at) as last_response
        FROM surveys s
        LEFT JOIN survey_responses sr ON s.id = sr.survey_id
        WHERE s.id = ? AND s.tenant_id = ?
      `,
        [surveyId, tenantId]
      );

      // Get survey details with questions
      const survey = await this.getById(surveyId, tenantId);
      if (!survey) {
        throw new Error('Survey not found');
      }

      // Get question statistics
      const questionStats = [];

      for (const question of survey.questions || []) {
        const questionStat: any = {
          id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          responses: [],
        };

        if (
          question.question_type === 'single_choice' ||
          question.question_type === 'multiple_choice'
        ) {
          // Get option statistics
          const [optionStats] = await typedQuery(
            `
            SELECT 
              sqo.id as option_id,
              sqo.option_text,
              COUNT(DISTINCT sa.response_id) as count
            FROM survey_question_options sqo
            LEFT JOIN survey_answers sa ON sa.option_id = sqo.id
            WHERE sqo.question_id = ?
            GROUP BY sqo.id, sqo.option_text
            ORDER BY sqo.order_position
          `,
            [question.id]
          );
          questionStat.options = optionStats;
        } else if (question.question_type === 'text') {
          // Get text responses
          const [textResponses] = await typedQuery(
            `
            SELECT 
              sa.answer_text,
              sr.user_id,
              u.first_name,
              u.last_name
            FROM survey_answers sa
            JOIN survey_responses sr ON sa.response_id = sr.id
            LEFT JOIN users u ON sr.user_id = u.id
            WHERE sa.question_id = ? AND sa.answer_text IS NOT NULL
          `,
            [question.id]
          );
          questionStat.responses = textResponses;
        } else if (
          question.question_type === 'rating' ||
          question.question_type === 'number'
        ) {
          // Get numeric statistics
          const [numericStats] = await typedQuery(
            `
            SELECT 
              AVG(sa.answer_number) as average,
              MIN(sa.answer_number) as min,
              MAX(sa.answer_number) as max,
              COUNT(sa.answer_number) as count
            FROM survey_answers sa
            WHERE sa.question_id = ? AND sa.answer_number IS NOT NULL
          `,
            [question.id]
          );
          questionStat.statistics = numericStats[0];
        }

        questionStats.push(questionStat);
      }

      return {
        survey_id: surveyId,
        total_responses: parseInt(stats[0].total_responses.toString()) || 0,
        completed_responses:
          parseInt(stats[0].completed_responses.toString()) || 0,
        completion_rate:
          stats[0].total_responses > 0
            ? Math.round(
                (stats[0].completed_responses / stats[0].total_responses) * 100
              )
            : 0,
        first_response: stats[0].first_response,
        last_response: stats[0].last_response,
        questions: questionStats,
      };
    } catch (error) {
      console.error('Error in getStatistics:', error);
      throw error;
    }
  }
}

// Default export
export default Survey;

// CommonJS compatibility
