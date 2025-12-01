/**
 * Survey Responses Service
 * Business logic for survey responses
 */
import {
  IdResult,
  SurveyAnswerWithQuestionResult,
  SurveyExportResult,
  SurveyFlagsResult,
  SurveyResponseWithUserResult,
  TotalCountResult,
} from '../../../types/query-results.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { PoolConnection, ResultSetHeader, query, transaction } from '../../../utils/db.js';
import { dbToApi } from '../../../utils/fieldMapping.js';

export interface SurveyAnswer {
  // Accept both camelCase (from frontend) and snake_case (database)
  question_id?: number;
  questionId?: number;
  question_text?: string;
  answer_text?: string;
  answerText?: string;
  answer_number?: number;
  answerNumber?: number;
  answer_date?: string;
  answerDate?: string;
  answer_options?: number[];
  answerOptions?: number[];
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

/** Normalized answer type for database insertion */
interface NormalizedAnswer {
  question_id: number | undefined;
  answer_text: string | undefined;
  answer_number: number | undefined;
  answer_date: string | undefined;
  answer_options: number[] | undefined;
}

/**
 * Normalize answer field names (convert camelCase to snake_case)
 */
function normalizeAnswers(answers: SurveyAnswer[]): NormalizedAnswer[] {
  return answers.map((answer: SurveyAnswer) => ({
    question_id: answer.questionId ?? answer.question_id,
    answer_text: answer.answerText ?? answer.answer_text,
    answer_number: answer.answerNumber ?? answer.answer_number,
    answer_date: answer.answerDate ?? answer.answer_date,
    answer_options: answer.answerOptions ?? answer.answer_options,
  }));
}

/**
 * Insert answers into database
 */
async function insertAnswers(
  connection: PoolConnection,
  responseId: number,
  answers: NormalizedAnswer[],
  tenantId: number,
): Promise<void> {
  for (const answer of answers) {
    if (answer.answer_text !== undefined && answer.answer_text !== '') {
      await connection.query(
        `INSERT INTO survey_answers (response_id, question_id, answer_text, tenant_id) VALUES ($1, $2, $3, $4)`,
        [responseId, answer.question_id, answer.answer_text, tenantId] as unknown[],
      );
    } else if (answer.answer_number !== undefined) {
      await connection.query(
        `INSERT INTO survey_answers (response_id, question_id, answer_number, tenant_id) VALUES ($1, $2, $3, $4)`,
        [responseId, answer.question_id, answer.answer_number, tenantId] as unknown[],
      );
    } else if (answer.answer_date !== undefined && answer.answer_date !== '') {
      await connection.query(
        `INSERT INTO survey_answers (response_id, question_id, answer_date, tenant_id) VALUES ($1, $2, $3, $4)`,
        [responseId, answer.question_id, answer.answer_date, tenantId] as unknown[],
      );
    } else if (answer.answer_options !== undefined && answer.answer_options.length > 0) {
      await connection.query(
        `INSERT INTO survey_answers (response_id, question_id, answer_options, tenant_id) VALUES ($1, $2, $3, $4)`,
        [
          responseId,
          answer.question_id,
          JSON.stringify(answer.answer_options),
          tenantId,
        ] as unknown[],
      );
    }
  }
}

/**
 * Transform answer from DB to API format
 */
function transformAnswer(a: SurveyAnswerWithQuestionResult): SurveyAnswer {
  const transformed = dbToApi(a as unknown as Record<string, unknown>) as unknown as SurveyAnswer;
  if (a.answer_date !== null && typeof a.answer_date !== 'string') {
    transformed.answerDate = a.answer_date.toISOString();
  }
  return transformed;
}

/**
 * Transform response from DB to API format with answers
 */
async function transformResponseWithAnswers(
  dbResponse: SurveyResponseWithUserResult,
  tenantId: number,
): Promise<SurveyResponse> {
  const [answers] = await query<SurveyAnswerWithQuestionResult[]>(
    `SELECT sa.*, sq.question_type, sq.question_text FROM survey_answers sa
     JOIN survey_questions sq ON sa.question_id = sq.id WHERE sa.response_id = $1 AND sa.tenant_id = $2`,
    [dbResponse.id, tenantId],
  );

  const baseResponse = dbToApi(
    dbResponse as unknown as Record<string, unknown>,
  ) as unknown as SurveyResponse;

  if (typeof dbResponse.started_at !== 'string') {
    baseResponse.startedAt = dbResponse.started_at.toISOString();
  }
  if (dbResponse.completed_at !== null && typeof dbResponse.completed_at !== 'string') {
    baseResponse.completedAt = dbResponse.completed_at.toISOString();
  }

  return { ...baseResponse, answers: answers.map(transformAnswer) };
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
    const [surveys] = await query<SurveyFlagsResult[]>(
      `SELECT id, status, allow_multiple_responses FROM surveys
       WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [surveyId, tenantId] as unknown[],
    );

    const survey = surveys[0];
    if (survey === undefined) {
      throw new ServiceError('NOT_FOUND', 'Umfrage nicht gefunden oder nicht aktiv');
    }

    // Check if user already responded (if multiple responses not allowed)
    if (survey.allow_multiple_responses !== 1) {
      const [existing] = await query<IdResult[]>(
        `SELECT id FROM survey_responses WHERE survey_id = $1 AND user_id = $2 AND tenant_id = $3`,
        [surveyId, userId, tenantId] as unknown[],
      );
      if (existing.length > 0) {
        throw new ServiceError('BAD_REQUEST', 'Sie haben bereits an dieser Umfrage teilgenommen');
      }
    }

    return await transaction(async (connection: PoolConnection) => {
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO survey_responses (survey_id, user_id, tenant_id, started_at, completed_at, status)
         VALUES ($1, $2, $3, NOW(), NOW(), 'completed')`,
        [surveyId, userId, tenantId] as unknown[],
      );
      await insertAnswers(connection, result.insertId, normalizeAnswers(answers), tenantId);
      return result.insertId;
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

    // Check if survey is anonymous
    const [surveyInfo] = await query<SurveyFlagsResult[]>(
      `SELECT is_anonymous FROM surveys WHERE id = $1 AND tenant_id = $2`,
      [surveyId, tenantId] as unknown[],
    );

    if (surveyInfo.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Umfrage nicht gefunden');
    }

    const surveyData = surveyInfo[0];
    if (surveyData === undefined) {
      throw new ServiceError('NOT_FOUND', 'Umfrage nicht gefunden');
    }

    const isAnonymous = Boolean(surveyData.is_anonymous);

    // Get total count
    const [countResult] = await query<TotalCountResult[]>(
      `SELECT COUNT(*) as total
       FROM survey_responses
       WHERE survey_id = $1 AND tenant_id = $2`,
      [surveyId, tenantId] as unknown[],
    );

    const countData = countResult[0];
    if (countData === undefined) {
      throw new ServiceError('INTERNAL_ERROR', 'Fehler beim Abrufen der Anzahl');
    }

    const total = countData.total;
    const offset = (options.page - 1) * options.limit;

    // Build query based on anonymity
    const userFields =
      isAnonymous ?
        'NULL as first_name, NULL as last_name, NULL as username'
      : 'u.first_name, u.last_name, u.username';
    const userJoin = isAnonymous ? '' : 'LEFT JOIN users u ON sr.user_id = u.id';

    const [responses] = await query<SurveyResponseWithUserResult[]>(
      `SELECT sr.*, ${userFields} FROM survey_responses sr ${userJoin}
       WHERE sr.survey_id = $1 AND sr.tenant_id = $2 ORDER BY sr.completed_at DESC LIMIT $3 OFFSET $4`,
      [surveyId, tenantId, options.limit, offset] as unknown[],
    );

    const responsesWithAnswers = await Promise.all(
      responses.map((r: SurveyResponseWithUserResult) => transformResponseWithAnswers(r, tenantId)),
    );

    return { responses: responsesWithAnswers, total };
  }

  /**
   * Get user's own response to a survey
   */
  async getUserResponse(
    surveyId: number,
    userId: number,
    tenantId: number,
  ): Promise<SurveyResponse | null> {
    const [responses] = await query<SurveyResponseWithUserResult[]>(
      `SELECT sr.*
       FROM survey_responses sr
       WHERE sr.survey_id = $1 AND sr.user_id = $2 AND sr.tenant_id = $3
       ORDER BY sr.started_at DESC
       LIMIT 1`,
      [surveyId, userId, tenantId] as unknown[],
    );

    if (responses.length === 0) {
      return null;
    }

    const dbResponse = responses[0];
    if (dbResponse === undefined) {
      return null;
    }

    // Get answers
    const [answers] = await query<SurveyAnswerWithQuestionResult[]>(
      `SELECT sa.*, sq.question_type, sq.question_text
       FROM survey_answers sa
       JOIN survey_questions sq ON sa.question_id = sq.id
       WHERE sa.response_id = $1 AND sa.tenant_id = $2`,
      [dbResponse.id, tenantId] as unknown[],
    );

    // Transform response from snake_case to camelCase (API v2 standard)
    const baseResponse = dbToApi(
      dbResponse as unknown as Record<string, unknown>,
    ) as unknown as SurveyResponse;

    // Handle Date objects conversion to ISO strings
    if (typeof dbResponse.started_at !== 'string') {
      baseResponse.startedAt = dbResponse.started_at.toISOString();
    }
    if (dbResponse.completed_at !== null && typeof dbResponse.completed_at !== 'string') {
      baseResponse.completedAt = dbResponse.completed_at.toISOString();
    }

    return {
      ...baseResponse,
      answers: answers.map((a: SurveyAnswerWithQuestionResult) => {
        // Transform snake_case to camelCase using dbToApi
        const transformed = dbToApi(a as unknown as Record<string, unknown>) as SurveyAnswer;
        // Handle Date object conversion to ISO string
        if (a.answer_date !== null && typeof a.answer_date !== 'string') {
          transformed.answerDate = a.answer_date.toISOString();
        }
        return transformed;
      }),
    };
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
    const [responses] = await query<SurveyResponseWithUserResult[]>(
      `SELECT sr.*, u.first_name, u.last_name, u.username
       FROM survey_responses sr
       LEFT JOIN users u ON sr.user_id = u.id
       WHERE sr.id = $1 AND sr.survey_id = $2 AND sr.tenant_id = $3`,
      [responseId, surveyId, tenantId] as unknown[],
    );

    if (responses.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Antwort nicht gefunden');
    }

    const dbResponse = responses[0];
    if (dbResponse === undefined) {
      throw new ServiceError('NOT_FOUND', 'Antwort nicht gefunden');
    }

    // Check permissions (user can only see their own response unless admin/root)
    if (userRole !== 'root' && userRole !== 'admin' && dbResponse.user_id !== userId) {
      throw new ServiceError('FORBIDDEN', 'Keine Berechtigung');
    }

    // Get answers (similar to getUserResponse)
    const [answers] = await query<SurveyAnswerWithQuestionResult[]>(
      `SELECT sa.*, sq.question_type, sq.question_text
       FROM survey_answers sa
       JOIN survey_questions sq ON sa.question_id = sq.id
       WHERE sa.response_id = $1 AND sa.tenant_id = $2`,
      [responseId, tenantId],
    );

    // Transform response from snake_case to camelCase (API v2 standard)
    const baseResponse = dbToApi(
      dbResponse as unknown as Record<string, unknown>,
    ) as unknown as SurveyResponse;

    // Handle Date objects conversion to ISO strings
    if (typeof dbResponse.started_at !== 'string') {
      baseResponse.startedAt = dbResponse.started_at.toISOString();
    }
    if (dbResponse.completed_at !== null && typeof dbResponse.completed_at !== 'string') {
      baseResponse.completedAt = dbResponse.completed_at.toISOString();
    }

    return {
      ...baseResponse,
      answers: answers.map((a: SurveyAnswerWithQuestionResult) => {
        // Transform snake_case to camelCase using dbToApi
        const transformed = dbToApi(a as unknown as Record<string, unknown>) as SurveyAnswer;
        // Handle Date object conversion to ISO string
        if (a.answer_date !== null && typeof a.answer_date !== 'string') {
          transformed.answerDate = a.answer_date.toISOString();
        }
        return transformed;
      }),
    };
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
    const [responses] = await query<SurveyFlagsResult[]>(
      `SELECT sr.*, s.allow_edit_responses
       FROM survey_responses sr
       JOIN surveys s ON sr.survey_id = s.id
       WHERE sr.id = $1 AND sr.survey_id = $2 AND sr.user_id = $3 AND sr.tenant_id = $4`,
      [responseId, surveyId, userId, tenantId] as unknown[],
    );

    if (responses.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Antwort nicht gefunden');
    }

    const responseData = responses[0];
    if (responseData === undefined) {
      throw new ServiceError('NOT_FOUND', 'Antwort nicht gefunden');
    }

    if (responseData.allow_edit_responses !== 1) {
      throw new ServiceError('FORBIDDEN', 'Bearbeitung von Antworten nicht erlaubt');
    }

    await transaction(async (connection: PoolConnection) => {
      await connection.query(
        `DELETE FROM survey_answers WHERE response_id = $1 AND tenant_id = $2`,
        [responseId, tenantId],
      );
      await insertAnswers(connection, responseId, normalizeAnswers(answers), tenantId);
      await connection.query(
        `UPDATE survey_responses SET completed_at = NOW() WHERE id = $1 AND tenant_id = $2`,
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
    const [surveys] = await query<IdResult[]>(
      `SELECT id FROM surveys WHERE id = $1 AND tenant_id = $2`,
      [surveyId, tenantId] as unknown[],
    );

    if (surveys.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Umfrage nicht gefunden');
    }

    // Get all responses with answers
    const [responses] = await query<SurveyExportResult[]>(
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
        sa.answer_options
       FROM survey_responses sr
       LEFT JOIN users u ON sr.user_id = u.id
       LEFT JOIN survey_questions sq ON sq.survey_id = sr.survey_id
       LEFT JOIN survey_answers sa ON sa.response_id = sr.id AND sa.question_id = sq.id
       WHERE sr.survey_id = $1 AND sr.tenant_id = $2
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

  private formatAsCSV(data: SurveyExportResult[]): Buffer {
    const headers = ['Response ID', 'User', 'Completed', 'Question', 'Answer'];
    const rows = data.map((row: SurveyExportResult) => {
      const fullName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
      const userName = fullName !== '' ? fullName : (row.username ?? '');
      const completed = row.completed_at !== null ? String(row.completed_at) : '';
      return [
        String(row.response_id),
        userName,
        completed,
        row.question_text,
        String(row.answer_text ?? row.answer_number ?? row.answer_date ?? row.answer_options ?? ''),
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map((row: unknown[]) =>
        row.map((cell: unknown) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');

    return Buffer.from(csv, 'utf-8');
  }

  private formatAsExcel(data: SurveyExportResult[]): Buffer {
    // For now, return CSV format with Excel mime type
    // In production, you would use a library like exceljs
    return this.formatAsCSV(data);
  }
}

export const responsesService = new ResponsesService();
