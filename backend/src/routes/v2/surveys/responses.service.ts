/**
 * Survey Responses Service
 * Business logic for survey responses
 */
import { ServiceError } from '../../../utils/ServiceError';
import {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
  query,
  transaction,
} from '../../../utils/db';

export interface SurveyAnswer {
  question_id: number;
  answer_text?: string;
  answer_number?: number;
  answer_date?: string;
  answer_options?: number[];
}

export interface SurveyResponse {
  id: number;
  survey_id: number;
  user_id: number;
  started_at: string;
  completed_at: string | null;
  is_complete: boolean;
  answers?: SurveyAnswer[];
}

class ResponsesService {
  /**
   * Submit a response to a survey
   */
  async submitResponse(
    surveyId: number,
    userId: number,
    tenantId: number,
    answers: SurveyAnswer[],
  ): Promise<number> {
    // Check if survey exists and is active
    const [surveys] = await query<RowDataPacket[]>(
      `SELECT id, status, allow_multiple_responses
       FROM surveys
       WHERE id = ? AND tenant_id = ? AND status = 'active'`,
      [surveyId, tenantId] as unknown[],
    );

    if (surveys.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Umfrage nicht gefunden oder nicht aktiv');
    }

    const survey = surveys[0];

    // Check if user already responded (if multiple responses not allowed)
    if (!survey.allow_multiple_responses) {
      const [existingResponses] = await query<RowDataPacket[]>(
        `SELECT id FROM survey_responses
         WHERE survey_id = ? AND user_id = ? AND tenant_id = ?`,
        [surveyId, userId, tenantId] as unknown[],
      );

      if (existingResponses.length > 0) {
        throw new ServiceError('BAD_REQUEST', 'Sie haben bereits an dieser Umfrage teilgenommen');
      }
    }

    // Use transaction helper
    return await transaction(async (connection: PoolConnection) => {
      // Create response record
      const [responseResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO survey_responses (survey_id, user_id, tenant_id, started_at, completed_at, is_complete)
         VALUES (?, ?, ?, NOW(), NOW(), 1)`,
        [surveyId, userId, tenantId] as unknown[],
      );

      const responseId = responseResult.insertId;

      // Insert answers
      for (const answer of answers) {
        if (answer.answer_text !== undefined && answer.answer_text !== '') {
          await connection.query(
            `INSERT INTO survey_answers (response_id, question_id, answer_text, tenant_id)
             VALUES (?, ?, ?, ?)`,
            [responseId, answer.question_id, answer.answer_text, tenantId] as unknown[],
          );
        } else if (answer.answer_number !== undefined) {
          await connection.query(
            `INSERT INTO survey_answers (response_id, question_id, answer_number, tenant_id)
             VALUES (?, ?, ?, ?)`,
            [responseId, answer.question_id, answer.answer_number, tenantId] as unknown[],
          );
        } else if (answer.answer_date !== undefined && answer.answer_date !== '') {
          await connection.query(
            `INSERT INTO survey_answers (response_id, question_id, answer_date, tenant_id)
             VALUES (?, ?, ?, ?)`,
            [responseId, answer.question_id, answer.answer_date, tenantId] as unknown[],
          );
        } else if (answer.answer_options && answer.answer_options.length > 0) {
          // For multiple choice questions
          for (const optionId of answer.answer_options) {
            await connection.query(
              `INSERT INTO survey_answer_options (response_id, question_id, option_id, tenant_id)
               VALUES (?, ?, ?, ?)`,
              [responseId, answer.question_id, optionId, tenantId] as unknown[],
            );
          }
        }
      }

      return responseId;
    });
  }

  /**
   * Get all responses for a survey (admin only)
   */
  async getAllResponses(
    surveyId: number,
    tenantId: number,
    userRole: string,
    _userId: number,
    options: { page: number; limit: number },
  ): Promise<{ responses: SurveyResponse[]; total: number }> {
    // Check permissions
    if (userRole !== 'root' && userRole !== 'admin') {
      throw new ServiceError('FORBIDDEN', 'Keine Berechtigung');
    }

    // Get total count
    const [countResult] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM survey_responses
       WHERE survey_id = ? AND tenant_id = ?`,
      [surveyId, tenantId] as unknown[],
    );

    const total = countResult[0].total as number;
    const offset = (options.page - 1) * options.limit;

    // Get responses
    const [responses] = await query<RowDataPacket[]>(
      `SELECT sr.*, u.first_name, u.last_name, u.username
       FROM survey_responses sr
       LEFT JOIN users u ON sr.user_id = u.id
       WHERE sr.survey_id = ? AND sr.tenant_id = ?
       ORDER BY sr.completed_at DESC
       LIMIT ? OFFSET ?`,
      [surveyId, tenantId, options.limit, offset] as unknown[],
    );

    return {
      responses: responses as SurveyResponse[],
      total,
    };
  }

  /**
   * Get user's own response to a survey
   */
  async getUserResponse(
    surveyId: number,
    userId: number,
    tenantId: number,
  ): Promise<SurveyResponse | null> {
    const [responses] = await query<RowDataPacket[]>(
      `SELECT sr.*
       FROM survey_responses sr
       WHERE sr.survey_id = ? AND sr.user_id = ? AND sr.tenant_id = ?
       ORDER BY sr.created_at DESC
       LIMIT 1`,
      [surveyId, userId, tenantId] as unknown[],
    );

    if (responses.length === 0) {
      return null;
    }

    const response = responses[0] as SurveyResponse;

    // Get answers
    const [answers] = await query<RowDataPacket[]>(
      `SELECT sa.*, sq.question_type
       FROM survey_answers sa
       JOIN survey_questions sq ON sa.question_id = sq.id
       WHERE sa.response_id = ? AND sa.tenant_id = ?`,
      [response.id, tenantId] as unknown[],
    );

    // Get selected options for choice questions
    const [options] = await query<RowDataPacket[]>(
      `SELECT sao.question_id, sao.option_id
       FROM survey_answer_options sao
       WHERE sao.response_id = ? AND sao.tenant_id = ?`,
      [response.id, tenantId] as unknown[],
    );

    // Group options by question
    const optionsByQuestion: Record<number, number[]> = {};
    for (const opt of options) {
      const questionId = opt.question_id as number;
      // Initialize array if not exists
      optionsByQuestion[questionId] = optionsByQuestion[questionId] ?? [];
      optionsByQuestion[questionId].push(opt.option_id as number);
    }

    // Combine answers with options
    response.answers = answers.map((a) => ({
      question_id: a.question_id as number,
      answer_text: a.answer_text as string | undefined,
      answer_number: a.answer_number as number | undefined,
      answer_date: a.answer_date as string | undefined,
      answer_options: optionsByQuestion[a.question_id as number],
    }));

    return response;
  }

  /**
   * Get a specific response by ID
   */
  async getResponseById(
    surveyId: number,
    responseId: number,
    tenantId: number,
    userRole: string,
    userId: number,
  ): Promise<SurveyResponse> {
    const [responses] = await query<RowDataPacket[]>(
      `SELECT sr.*, u.first_name, u.last_name, u.username
       FROM survey_responses sr
       LEFT JOIN users u ON sr.user_id = u.id
       WHERE sr.id = ? AND sr.survey_id = ? AND sr.tenant_id = ?`,
      [responseId, surveyId, tenantId] as unknown[],
    );

    if (responses.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Antwort nicht gefunden');
    }

    const response = responses[0] as SurveyResponse;

    // Check permissions (user can only see their own response unless admin/root)
    if (userRole !== 'root' && userRole !== 'admin' && response.user_id !== userId) {
      throw new ServiceError('FORBIDDEN', 'Keine Berechtigung');
    }

    // Get answers (similar to getUserResponse)
    const [answers] = await query<RowDataPacket[]>(
      `SELECT sa.*, sq.question_type
       FROM survey_answers sa
       JOIN survey_questions sq ON sa.question_id = sq.id
       WHERE sa.response_id = ? AND sa.tenant_id = ?`,
      [responseId, tenantId],
    );

    response.answers = answers as SurveyAnswer[];

    return response;
  }

  /**
   * Update a response (if allowed)
   */
  async updateResponse(
    surveyId: number,
    responseId: number,
    userId: number,
    tenantId: number,
    answers: SurveyAnswer[],
  ): Promise<void> {
    // Check if response exists and belongs to user
    const [responses] = await query<RowDataPacket[]>(
      `SELECT sr.*, s.allow_edit_responses
       FROM survey_responses sr
       JOIN surveys s ON sr.survey_id = s.id
       WHERE sr.id = ? AND sr.survey_id = ? AND sr.user_id = ? AND sr.tenant_id = ?`,
      [responseId, surveyId, userId, tenantId] as unknown[],
    );

    if (responses.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Antwort nicht gefunden');
    }

    if (!responses[0].allow_edit_responses) {
      throw new ServiceError('FORBIDDEN', 'Bearbeitung von Antworten nicht erlaubt');
    }

    // Use transaction helper
    await transaction(async (connection: PoolConnection) => {
      // Delete existing answers
      await connection.query(`DELETE FROM survey_answers WHERE response_id = ? AND tenant_id = ?`, [
        responseId,
        tenantId,
      ]);

      await connection.query(
        `DELETE FROM survey_answer_options WHERE response_id = ? AND tenant_id = ?`,
        [responseId, tenantId] as unknown[],
      );

      // Insert new answers (similar to submitResponse)
      for (const answer of answers) {
        if (answer.answer_text !== undefined && answer.answer_text !== '') {
          await connection.query(
            `INSERT INTO survey_answers (response_id, question_id, answer_text, tenant_id)
             VALUES (?, ?, ?, ?)`,
            [responseId, answer.question_id, answer.answer_text, tenantId] as unknown[],
          );
        } else if (answer.answer_options && answer.answer_options.length > 0) {
          for (const optionId of answer.answer_options) {
            await connection.query(
              `INSERT INTO survey_answer_options (response_id, question_id, option_id, tenant_id)
               VALUES (?, ?, ?, ?)`,
              [responseId, answer.question_id, optionId, tenantId] as unknown[],
            );
          }
        }
      }

      // Update completion time
      await connection.query(
        `UPDATE survey_responses SET completed_at = NOW() WHERE id = ? AND tenant_id = ?`,
        [responseId, tenantId] as unknown[],
      );
    });
  }

  /**
   * Export survey responses
   */
  async exportResponses(
    surveyId: number,
    tenantId: number,
    userRole: string,
    _userId: number,
    format: 'csv' | 'excel',
  ): Promise<Buffer> {
    // Check permissions
    if (userRole !== 'root' && userRole !== 'admin') {
      throw new ServiceError('FORBIDDEN', 'Keine Berechtigung');
    }

    // Get survey with questions
    const [surveys] = await query<RowDataPacket[]>(
      `SELECT * FROM surveys WHERE id = ? AND tenant_id = ?`,
      [surveyId, tenantId] as unknown[],
    );

    if (surveys.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Umfrage nicht gefunden');
    }

    // Get all responses with answers
    const [responses] = await query<RowDataPacket[]>(
      `SELECT
        sr.id as response_id,
        sr.user_id,
        sr.completed_at,
        u.username,
        u.first_name,
        u.last_name,
        sq.question_text,
        sq.question_type,
        sa.answer_text,
        sa.answer_number,
        sa.answer_date,
        GROUP_CONCAT(sqo.option_text) as selected_options
       FROM survey_responses sr
       LEFT JOIN users u ON sr.user_id = u.id
       LEFT JOIN survey_questions sq ON sq.survey_id = sr.survey_id
       LEFT JOIN survey_answers sa ON sa.response_id = sr.id AND sa.question_id = sq.id
       LEFT JOIN survey_answer_options sao ON sao.response_id = sr.id AND sao.question_id = sq.id
       LEFT JOIN survey_question_options sqo ON sao.option_id = sqo.id
       WHERE sr.survey_id = ? AND sr.tenant_id = ?
       GROUP BY sr.id, sq.id, sa.id
       ORDER BY sr.id, sq.order_position`,
      [surveyId, tenantId] as unknown[],
    );

    // Format based on requested type
    if (format === 'csv') {
      return this.formatAsCSV(responses);
    } else {
      return this.formatAsExcel(responses);
    }
  }

  private formatAsCSV(data: RowDataPacket[]): Buffer {
    // Simple CSV formatting
    const headers = ['Response ID', 'User', 'Completed', 'Question', 'Answer'];
    const rows = data.map((row) => [
      row.response_id as string,
      `${String(row.first_name ?? '')} ${String(row.last_name ?? '')}`.trim() ||
        String(row.username ?? ''),
      row.completed_at as string,
      row.question_text as string,
      String(row.answer_text ?? row.answer_number ?? row.answer_date ?? row.selected_options ?? ''),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return Buffer.from(csv, 'utf-8');
  }

  private formatAsExcel(data: RowDataPacket[]): Buffer {
    // For now, return CSV format with Excel mime type
    // In production, you would use a library like exceljs
    return this.formatAsCSV(data);
  }
}

export const responsesService = new ResponsesService();
