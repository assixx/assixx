/**
 * Survey Responses Service
 *
 * Handles response submission, retrieval, updates, and export.
 * Injected into the SurveysService facade.
 *
 * Access control (checkSurveyManagementAccess) is handled by the facade
 * before delegating to this service.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { buildFullName } from '../../utils/db-helpers.js';
import { dbToApi } from '../../utils/field-mapper.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { normalizeAnswers } from './surveys.helpers.js';
import type {
  DbSurveyAnswer,
  DbSurveyResponse,
  ExportRow,
  NormalizedAnswer,
  PaginatedResponsesResult,
  SurveyAnswer,
  SurveyResponse,
} from './surveys.types.js';

const MSG_SURVEY_NOT_FOUND = 'Survey not found';

@Injectable()
export class SurveyResponsesService {
  private readonly logger = new Logger(SurveyResponsesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ==========================================================================
  // SUBMIT
  // ==========================================================================

  /** Submits a response to an active survey */
  async submitResponse(
    surveyId: number,
    userId: number,
    tenantId: number,
    answers: SurveyAnswer[],
  ): Promise<number> {
    this.logger.log(`Submitting response to survey ${surveyId}`);
    const surveyRows = await this.db.query<{
      id: number;
      status: string;
      allow_multiple_responses: number;
    }>(
      `SELECT id, status, allow_multiple_responses FROM surveys WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [surveyId, tenantId],
    );
    const survey = surveyRows[0];
    if (survey === undefined) throw new NotFoundException('Survey not found or not active');

    await this.checkDuplicateResponse(surveyId, userId, tenantId, survey.allow_multiple_responses);

    const responseUuid = uuidv7();
    const responseRows = await this.db.query<{ id: number }>(
      `INSERT INTO survey_responses (survey_id, user_id, tenant_id, started_at, completed_at, status, uuid, uuid_created_at)
       VALUES ($1, $2, $3, NOW(), NOW(), 'completed', $4, NOW()) RETURNING id`,
      [surveyId, userId, tenantId, responseUuid],
    );
    const responseId = responseRows[0]?.id ?? 0;
    const normalizedAnswers = normalizeAnswers(answers);
    for (const answer of normalizedAnswers) {
      if (answer.question_id === undefined) {
        continue;
      }
      await this.insertSingleAnswer(responseId, answer.question_id, tenantId, answer);
    }
    return responseId;
  }

  // ==========================================================================
  // RETRIEVAL
  // ==========================================================================

  /**
   * Get all responses for a survey (paginated).
   * Access control is handled by the facade before calling this method.
   */
  async getAllResponses(
    surveyId: number,
    tenantId: number,
    options: { page: number; limit: number },
  ): Promise<PaginatedResponsesResult> {
    this.logger.debug(`Getting all responses for survey ${surveyId}`);
    const surveyRows = await this.db.query<{ is_anonymous: boolean | number }>(
      `SELECT is_anonymous FROM surveys WHERE id = $1 AND tenant_id = $2`,
      [surveyId, tenantId],
    );
    if (surveyRows.length === 0) {
      throw new NotFoundException(MSG_SURVEY_NOT_FOUND);
    }
    const surveyData = surveyRows[0];
    if (surveyData === undefined) {
      throw new NotFoundException(MSG_SURVEY_NOT_FOUND);
    }
    const isAnonymous = Boolean(surveyData.is_anonymous);
    const countRows = await this.db.query<{ total: number | string }>(
      `SELECT COUNT(*) as total FROM survey_responses WHERE survey_id = $1 AND tenant_id = $2`,
      [surveyId, tenantId],
    );
    const total =
      typeof countRows[0]?.total === 'string' ?
        Number.parseInt(countRows[0].total, 10)
      : (countRows[0]?.total ?? 0);
    const offset = (options.page - 1) * options.limit;
    const userFields =
      isAnonymous ?
        'NULL as first_name, NULL as last_name, NULL as username'
      : 'u.first_name, u.last_name, u.username';
    const userJoin = isAnonymous ? '' : 'LEFT JOIN users u ON sr.user_id = u.id';
    const responseRows = await this.db.query<DbSurveyResponse>(
      `SELECT sr.*, ${userFields} FROM survey_responses sr ${userJoin}
       WHERE sr.survey_id = $1 AND sr.tenant_id = $2 ORDER BY sr.completed_at DESC LIMIT $3 OFFSET $4`,
      [surveyId, tenantId, options.limit, offset],
    );
    const responses: SurveyResponse[] = [];
    for (const r of responseRows) {
      responses.push(await this.transformResponseWithAnswers(r, tenantId));
    }
    return { responses, total };
  }

  /** Get user's own response to a survey */
  async getMyResponse(
    surveyId: number,
    userId: number,
    tenantId: number,
  ): Promise<SurveyResponse | null> {
    this.logger.debug(`Getting user ${userId} response to survey ${surveyId}`);
    const responseRows = await this.db.query<DbSurveyResponse>(
      `SELECT sr.* FROM survey_responses sr WHERE sr.survey_id = $1 AND sr.user_id = $2 AND sr.tenant_id = $3
       ORDER BY sr.started_at DESC LIMIT 1`,
      [surveyId, userId, tenantId],
    );
    if (responseRows.length === 0) {
      return null;
    }
    const dbResponse = responseRows[0];
    if (dbResponse === undefined) {
      return null;
    }
    return await this.transformResponseWithAnswers(dbResponse, tenantId);
  }

  /** Get a specific response by ID */
  async getResponseById(
    surveyId: number,
    responseId: number,
    tenantId: number,
    userRole: string,
    userId: number,
  ): Promise<SurveyResponse> {
    this.logger.debug(`Getting response ${responseId} for survey ${surveyId}`);
    const responseRows = await this.db.query<DbSurveyResponse>(
      `SELECT sr.*, u.first_name, u.last_name, u.username FROM survey_responses sr
       LEFT JOIN users u ON sr.user_id = u.id WHERE sr.id = $1 AND sr.survey_id = $2 AND sr.tenant_id = $3`,
      [responseId, surveyId, tenantId],
    );
    if (responseRows.length === 0) {
      throw new NotFoundException('Response not found');
    }
    const dbResponse = responseRows[0];
    if (dbResponse === undefined) {
      throw new NotFoundException('Response not found');
    }
    if (userRole !== 'root' && userRole !== 'admin' && dbResponse.user_id !== userId) {
      throw new ForbiddenException('No permission');
    }
    return await this.transformResponseWithAnswers(dbResponse, tenantId);
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  /** Update an existing response (if editing is allowed) */
  async updateResponse(
    surveyId: number,
    responseId: number,
    userId: number,
    tenantId: number,
    answers: SurveyAnswer[],
  ): Promise<{ message: string }> {
    this.logger.log(`Updating response ${responseId} for survey ${surveyId}`);
    const resultRows = await this.db.query<{
      id: number;
      allow_edit_responses: number;
    }>(
      `SELECT sr.id, s.allow_edit_responses FROM survey_responses sr
       JOIN surveys s ON sr.survey_id = s.id WHERE sr.id = $1 AND sr.survey_id = $2 AND sr.user_id = $3 AND sr.tenant_id = $4`,
      [responseId, surveyId, userId, tenantId],
    );
    if (resultRows.length === 0) {
      throw new NotFoundException('Response not found');
    }
    const responseData = resultRows[0];
    if (responseData === undefined) {
      throw new NotFoundException('Response not found');
    }
    if (responseData.allow_edit_responses !== 1) {
      throw new ForbiddenException('Editing responses is not allowed');
    }
    await this.db.query(`DELETE FROM survey_answers WHERE response_id = $1 AND tenant_id = $2`, [
      responseId,
      tenantId,
    ]);
    const normalizedAnswers = normalizeAnswers(answers);
    for (const answer of normalizedAnswers) {
      if (answer.question_id === undefined) continue;
      await this.insertSingleAnswer(responseId, answer.question_id, tenantId, answer);
    }
    await this.db.query(
      `UPDATE survey_responses SET completed_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [responseId, tenantId],
    );

    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'survey',
      responseId,
      `Umfrage-Antwort aktualisiert: Survey #${surveyId}`,
      {
        surveyId,
        responseId,
      },
    );

    return { message: 'Response updated successfully' };
  }

  // ==========================================================================
  // EXPORT
  // ==========================================================================

  /**
   * Export survey responses as CSV buffer.
   * Access control is handled by the facade before calling this method.
   */
  async exportResponses(
    surveyId: number,
    tenantId: number,
    format: 'csv' | 'excel',
  ): Promise<Buffer> {
    this.logger.log(`Exporting responses for survey ${surveyId} as ${format}`);
    await this.verifySurveyExists(surveyId, tenantId);

    const exportRows = await this.fetchExportData(surveyId, tenantId);
    return this.buildCsvBuffer(exportRows);
  }

  // ==========================================================================
  // PRIVATE: ANSWER INSERTION
  // ==========================================================================

  /** Inserts a single answer based on its type */
  private async insertSingleAnswer(
    responseId: number,
    questionId: number,
    tenantId: number,
    answer: NormalizedAnswer,
  ): Promise<void> {
    if (answer.answer_text !== undefined && answer.answer_text !== '') {
      await this.db.query(
        `INSERT INTO survey_answers (response_id, question_id, answer_text, tenant_id) VALUES ($1, $2, $3, $4)`,
        [responseId, questionId, answer.answer_text, tenantId],
      );
    } else if (answer.answer_number !== undefined) {
      await this.db.query(
        `INSERT INTO survey_answers (response_id, question_id, answer_number, tenant_id) VALUES ($1, $2, $3, $4)`,
        [responseId, questionId, answer.answer_number, tenantId],
      );
    } else if (answer.answer_date !== undefined && answer.answer_date !== '') {
      await this.db.query(
        `INSERT INTO survey_answers (response_id, question_id, answer_date, tenant_id) VALUES ($1, $2, $3, $4)`,
        [responseId, questionId, answer.answer_date, tenantId],
      );
    } else if (answer.answer_options !== undefined && answer.answer_options.length > 0) {
      await this.db.query(
        `INSERT INTO survey_answers (response_id, question_id, answer_options, tenant_id) VALUES ($1, $2, $3, $4)`,
        [responseId, questionId, JSON.stringify(answer.answer_options), tenantId],
      );
    }
  }

  /** Checks if user can submit response (no duplicate if not allowed) */
  private async checkDuplicateResponse(
    surveyId: number,
    userId: number,
    tenantId: number,
    allowMultiple: number,
  ): Promise<void> {
    if (allowMultiple === 1) return;
    const existingRows = await this.db.query<{ id: number }>(
      `SELECT id FROM survey_responses WHERE survey_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [surveyId, userId, tenantId],
    );
    if (existingRows.length > 0) {
      throw new BadRequestException('You have already participated in this survey');
    }
  }

  // ==========================================================================
  // PRIVATE: RESPONSE TRANSFORMATION
  // ==========================================================================

  /** Transforms a DB response row to API format with resolved answers */
  private async transformResponseWithAnswers(
    dbResponse: DbSurveyResponse,
    tenantId: number,
  ): Promise<SurveyResponse> {
    const answerRows = await this.db.query<DbSurveyAnswer>(
      `SELECT sa.*, sq.question_type, sq.question_text FROM survey_answers sa
       JOIN survey_questions sq ON sa.question_id = sq.id WHERE sa.response_id = $1 AND sa.tenant_id = $2`,
      [dbResponse.id, tenantId],
    );

    const optionTextMap = await this.buildOptionTextMap(answerRows);

    const baseResponse = dbToApi(
      dbResponse as unknown as Record<string, unknown>,
    ) as unknown as SurveyResponse;
    if (typeof dbResponse.started_at !== 'string') {
      baseResponse.startedAt = dbResponse.started_at.toISOString();
    }
    if (dbResponse.completed_at !== null && typeof dbResponse.completed_at !== 'string') {
      baseResponse.completedAt = dbResponse.completed_at.toISOString();
    }
    return {
      ...baseResponse,
      answers: answerRows.map((a: DbSurveyAnswer) => this.transformSingleAnswer(a, optionTextMap)),
    };
  }

  /** Parses answer_options from JSON string or returns the array as-is */
  private parseOptionIds(answerOptions: string | number[]): number[] {
    return typeof answerOptions === 'string' ?
        (JSON.parse(answerOptions) as number[])
      : answerOptions;
  }

  /** Batch-collects choice option IDs from answers and resolves them to display text via DB */
  private async buildOptionTextMap(answerRows: DbSurveyAnswer[]): Promise<Map<number, string>> {
    const allOptionIds: number[] = [];
    for (const a of answerRows) {
      if (
        (a.question_type === 'single_choice' || a.question_type === 'multiple_choice') &&
        a.answer_options !== null &&
        a.answer_options !== undefined
      ) {
        allOptionIds.push(...this.parseOptionIds(a.answer_options));
      }
    }

    const optionTextMap = new Map<number, string>();
    if (allOptionIds.length === 0) {
      return optionTextMap;
    }

    const uniqueIds = [...new Set(allOptionIds)];
    const optionRows = await this.db.query<{ id: number; option_text: string }>(
      `SELECT id, option_text FROM survey_question_options WHERE id = ANY($1)`,
      [uniqueIds],
    );
    for (const row of optionRows) {
      optionTextMap.set(row.id, row.option_text);
    }
    return optionTextMap;
  }

  /** Transforms a single DB answer row to API format with resolved option display text */
  private transformSingleAnswer(
    answer: DbSurveyAnswer,
    optionTextMap: Map<number, string>,
  ): SurveyAnswer {
    const transformed = dbToApi(answer as unknown as Record<string, unknown>) as SurveyAnswer;
    if (answer.answer_date !== null && typeof answer.answer_date !== 'string') {
      transformed.answerDate = (answer.answer_date as Date).toISOString();
    }
    if (answer.answer_number !== null && answer.answer_number !== undefined) {
      transformed.answerNumber = answer.answer_number;
    }
    if (answer.answer_options !== null && answer.answer_options !== undefined) {
      const ids = this.parseOptionIds(answer.answer_options);
      transformed.answerOptions = this.resolveOptionDisplay(
        ids,
        answer.question_type,
        optionTextMap,
      );
    }
    return transformed;
  }

  /** Maps option IDs to human-readable display strings based on question type */
  private resolveOptionDisplay(
    ids: number[],
    questionType: string | undefined,
    optionTextMap: Map<number, string>,
  ): number[] {
    if (questionType === 'yes_no') {
      return ids.map((id: number) => (id === 1 ? 'Ja' : 'Nein')) as unknown as number[];
    }
    return ids.map((id: number) => optionTextMap.get(id) ?? String(id)) as unknown as number[];
  }

  // ==========================================================================
  // PRIVATE: EXPORT HELPERS
  // ==========================================================================

  /** Verifies survey exists for the tenant */
  private async verifySurveyExists(surveyId: number, tenantId: number): Promise<void> {
    const rows = await this.db.query<{ id: number }>(
      `SELECT id FROM surveys WHERE id = $1 AND tenant_id = $2`,
      [surveyId, tenantId],
    );
    if (rows.length === 0) {
      throw new NotFoundException(MSG_SURVEY_NOT_FOUND);
    }
  }

  /** Fetches export data for survey responses */
  private async fetchExportData(surveyId: number, tenantId: number): Promise<ExportRow[]> {
    return await this.db.query<ExportRow>(
      `SELECT sr.id as response_id, sr.user_id, sr.completed_at, u.username, u.first_name, u.last_name,
       sq.question_text, sq.question_type, sa.answer_text, sa.answer_number, sa.answer_date, sa.answer_options
       FROM survey_responses sr LEFT JOIN users u ON sr.user_id = u.id
       LEFT JOIN survey_questions sq ON sq.survey_id = sr.survey_id
       LEFT JOIN survey_answers sa ON sa.response_id = sr.id AND sa.question_id = sq.id
       WHERE sr.survey_id = $1 AND sr.tenant_id = $2 ORDER BY sr.id, sq.order_index`,
      [surveyId, tenantId],
    );
  }

  /** Transforms export rows to CSV string array format */
  private transformExportRow(row: ExportRow): string[] {
    const userName = buildFullName(row.first_name, row.last_name, row.username ?? '');
    const completed = row.completed_at !== null ? String(row.completed_at) : '';
    const answer = String(
      row.answer_text ?? row.answer_number ?? row.answer_date ?? row.answer_options ?? '',
    );
    return [String(row.response_id), userName, completed, row.question_text, answer];
  }

  /** Builds CSV buffer from export rows */
  private buildCsvBuffer(exportRows: ExportRow[]): Buffer {
    const headers = ['Response ID', 'User', 'Completed', 'Question', 'Answer'];
    const rows = exportRows.map((row: ExportRow) => this.transformExportRow(row));
    const csv = [
      headers.join(','),
      ...rows.map((row: string[]) =>
        row.map((cell: string) => `"${cell.replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');
    return Buffer.from(csv, 'utf-8');
  }
}
