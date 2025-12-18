/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
/**
 * Surveys Service
 *
 * Native NestJS implementation for survey management.
 * Directly uses DatabaseService for all SQL operations.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { dbToApi } from '../../utils/fieldMapping.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateSurveyDto } from './dto/create-survey.dto.js';
import type { UpdateSurveyDto } from './dto/update-survey.dto.js';

// ============================================
// CONSTANTS
// ============================================

const MSG_SURVEY_NOT_FOUND = 'Survey not found';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface DbSurvey {
  id: number;
  uuid: string;
  tenant_id: number;
  title: string;
  description?: string | null;
  created_by: number;
  status: 'draft' | 'active' | 'closed';
  is_anonymous: boolean | number;
  is_mandatory?: boolean | number;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  creator_first_name?: string;
  creator_last_name?: string;
  response_count?: number | string;
  completed_count?: number | string;
  questions?: DbSurveyQuestion[];
  assignments?: DbSurveyAssignment[];
}

interface DbSurveyQuestion {
  id: number;
  survey_id: number;
  question_text: string;
  question_type:
    | 'text'
    | 'single_choice'
    | 'multiple_choice'
    | 'rating'
    | 'number'
    | 'yes_no'
    | 'date';
  is_required: boolean | number;
  order_index: number;
  order_position?: number;
  options?: DbSurveyQuestionOption[];
}

interface DbSurveyQuestionOption {
  id: number;
  question_id: number;
  option_text: string;
  order_position: number;
}

interface DbSurveyAssignment {
  id: number;
  survey_id: number;
  assignment_type: 'all_users' | 'area' | 'department' | 'team' | 'user';
  area_id?: number | null;
  department_id?: number | null;
  team_id?: number | null;
  user_id?: number | null;
}

interface DbSurveyTemplate {
  id: number;
  tenant_id?: number | null;
  name: string;
  description?: string | null;
  template_data: string;
  is_public: boolean | number;
  created_at: Date | string;
}

interface DbSurveyResponse {
  id: number;
  survey_id: number;
  user_id: number;
  tenant_id: number;
  started_at: Date | string;
  completed_at: Date | string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}

interface DbSurveyAnswer {
  id: number;
  response_id: number;
  question_id: number;
  tenant_id: number;
  answer_text?: string | null;
  answer_number?: number | null;
  answer_date?: Date | string | null;
  answer_options?: string | number[] | null;
  question_type?: string;
  question_text?: string;
}

export interface SurveyAnswer {
  questionId?: number | undefined;
  question_id?: number | undefined;
  answerText?: string | undefined;
  answerNumber?: number | undefined;
  answerDate?: string | undefined;
  answerOptions?: number[] | undefined;
  answer_text?: string | undefined;
  answer_number?: number | undefined;
  answer_date?: string | undefined;
  answer_options?: number[] | undefined;
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

export interface PaginatedResponsesResult {
  responses: SurveyResponse[];
  total: number;
}

export interface SurveyStatisticsResponse {
  surveyId: number;
  totalResponses: number;
  completedResponses: number;
  completionRate: number;
  firstResponse?: Date | null;
  lastResponse?: Date | null;
  questions: {
    id: number;
    questionText: string;
    questionType: string;
    responses?: {
      answerText?: string;
      userId?: number | null;
      firstName?: string | null;
      lastName?: string | null;
    }[];
    options?: { optionId: number; optionText: string; count: number }[];
    statistics?: {
      average: number | null;
      min: number | null;
      max: number | null;
      totalResponses: number;
    };
  }[];
}

interface NormalizedAnswer {
  question_id: number | undefined;
  answer_text: string | undefined;
  answer_number: number | undefined;
  answer_date: string | undefined;
  answer_options: number[] | undefined;
}

interface QuestionInput {
  questionText: string;
  questionType: string;
  isRequired?: number | boolean | undefined;
  orderPosition?: number | undefined;
  options?: (string | { optionText: string })[] | undefined;
}

interface QuestionDbPayload {
  question_text: string;
  question_type: string;
  is_required: boolean;
  order_position: number;
  options?: string[];
}

function buildQuestionData(q: QuestionInput, index: number): QuestionDbPayload {
  const question: QuestionDbPayload = {
    question_text: q.questionText,
    question_type: q.questionType,
    is_required: q.isRequired !== 0 && q.isRequired !== false,
    order_position: q.orderPosition ?? index + 1,
  };
  if (q.options !== undefined) {
    question.options = q.options.map((opt: string | { optionText: string }) =>
      typeof opt === 'string' ? opt : opt.optionText,
    );
  }
  return question;
}

interface AssignmentInput {
  type: string;
  areaId?: number | undefined;
  departmentId?: number | undefined;
  teamId?: number | undefined;
  userId?: number | undefined;
}

interface AssignmentDbPayload {
  type: string;
  area_id: number | null;
  department_id: number | null;
  team_id: number | null;
  user_id: number | null;
}

function buildAssignmentData(a: AssignmentInput): AssignmentDbPayload {
  return {
    type: a.type,
    area_id: a.areaId ?? null,
    department_id: a.departmentId ?? null,
    team_id: a.teamId ?? null,
    user_id: a.userId ?? null,
  };
}

function normalizeAnswers(answers: SurveyAnswer[]): NormalizedAnswer[] {
  return answers.map((answer: SurveyAnswer) => ({
    question_id: answer.questionId ?? answer.question_id,
    answer_text: answer.answerText ?? answer.answer_text,
    answer_number: answer.answerNumber ?? answer.answer_number,
    answer_date: answer.answerDate ?? answer.answer_date,
    answer_options: answer.answerOptions ?? answer.answer_options,
  }));
}

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);
  constructor(private readonly db: DatabaseService) {}

  async listSurveys(
    tenantId: number,
    userId: number,
    userRole: string,
    query: {
      status?: string | undefined;
      page?: number | undefined;
      limit?: number | undefined;
    },
  ): Promise<unknown[]> {
    this.logger.log(`Listing surveys for tenant ${tenantId}, user ${userId}`);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    let surveys: DbSurvey[];
    if (userRole === 'root') {
      surveys = await this.getAllByTenant(tenantId, query.status, limit, offset);
    } else if (userRole === 'admin') {
      surveys = await this.getAllByTenantForAdmin(tenantId, userId, query.status, limit, offset);
    } else {
      surveys = await this.getAllByTenantForEmployee(tenantId, userId, query.status, limit, offset);
    }
    await this.attachAssignmentsToSurveys(surveys, tenantId);
    return surveys.map((s: DbSurvey) => this.transformSurveyWithMetadata(s));
  }

  private async getAllByTenant(
    tenantId: number,
    status: string | undefined,
    limit: number,
    offset: number,
  ): Promise<DbSurvey[]> {
    const params: unknown[] = [tenantId];
    let statusClause = '';
    if (status !== undefined) {
      statusClause = ' AND s.status = $2';
      params.push(status);
    }
    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;
    params.push(limit, offset);

    return await this.db.query<DbSurvey>(
      `SELECT s.*, MAX(u.first_name) as creator_first_name, MAX(u.last_name) as creator_last_name,
       COUNT(DISTINCT sr.id) as response_count,
       COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
       FROM surveys s LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN survey_responses sr ON s.id = sr.survey_id
       WHERE s.tenant_id = $1${statusClause} GROUP BY s.id
       ORDER BY s.created_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      params,
    );
  }

  private async getAllByTenantForAdmin(
    tenantId: number,
    adminUserId: number,
    status: string | undefined,
    limit: number,
    offset: number,
  ): Promise<DbSurvey[]> {
    const params: unknown[] = [adminUserId, tenantId, adminUserId];
    let statusClause = '';
    if (status !== undefined) {
      statusClause = ` AND s.status = $${params.length + 1}`;
      params.push(status);
    }
    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;
    params.push(limit, offset);

    return await this.db.query<DbSurvey>(
      `SELECT s.*, MAX(u.first_name) as creator_first_name, MAX(u.last_name) as creator_last_name,
       COUNT(DISTINCT sr.id) as response_count,
       COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
       FROM surveys s LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN survey_responses sr ON s.id = sr.survey_id
       LEFT JOIN survey_assignments sa ON s.id = sa.survey_id
       LEFT JOIN admin_department_permissions adp ON adp.admin_user_id = $1 AND adp.tenant_id = s.tenant_id
       WHERE s.tenant_id = $2 AND (sa.assignment_type = 'all_users' OR sa.assignment_type = 'area'
       OR (sa.assignment_type = 'department' AND sa.department_id = adp.department_id AND adp.can_read = true)
       OR s.created_by = $3)${statusClause} GROUP BY s.id
       ORDER BY s.created_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      params,
    );
  }

  /** Builds team SQL condition and returns teamIds to append to params */
  private buildTeamCondition(
    teamIds: number[],
    startIndex: number,
  ): { condition: string; ids: number[] } {
    if (teamIds.length === 0)
      return { condition: `(sa.assignment_type = 'team' AND 1=0)`, ids: [] };
    const placeholders = teamIds.map((_: number, idx: number) => `$${startIndex + idx}`).join(',');
    return {
      condition: `(sa.assignment_type = 'team' AND sa.team_id IN (${placeholders}))`,
      ids: teamIds,
    };
  }

  private async getAllByTenantForEmployee(
    tenantId: number,
    employeeUserId: number,
    status: string | undefined,
    limit: number,
    offset: number,
  ): Promise<DbSurvey[]> {
    const userInfoRows = await this.db.query<{
      department_id: number | null;
      area_id: number | null;
    }>(
      `SELECT ud.department_id, d.area_id FROM users u
       LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
       LEFT JOIN departments d ON ud.department_id = d.id WHERE u.id = $1 AND u.tenant_id = $2`,
      [employeeUserId, tenantId],
    );
    const userInfo = userInfoRows[0];
    if (userInfo === undefined) return [];
    const { department_id: departmentId, area_id: areaId } = userInfo;

    const teamsRows = await this.db.query<{ team_id: number }>(
      `SELECT team_id FROM user_teams WHERE user_id = $1 AND tenant_id = $2`,
      [employeeUserId, tenantId],
    );
    const teamIds = teamsRows.map((t: { team_id: number }) => t.team_id);

    const params: unknown[] = [tenantId, areaId, departmentId];
    const { condition: teamCondition, ids } = this.buildTeamCondition(teamIds, 4);
    params.push(...ids);
    const userIdParamIndex = params.length + 1;
    params.push(employeeUserId);

    let statusClause = '';
    if (status !== undefined) {
      statusClause = ` AND s.status = $${params.length + 1}`;
      params.push(status);
    }
    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;
    params.push(limit, offset);

    return await this.db.query<DbSurvey>(
      `SELECT s.*, MAX(u.first_name) as creator_first_name, MAX(u.last_name) as creator_last_name,
       COUNT(DISTINCT sr.id) as response_count,
       COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
       FROM surveys s LEFT JOIN users u ON s.created_by = u.id LEFT JOIN survey_responses sr ON s.id = sr.survey_id
       INNER JOIN survey_assignments sa ON s.id = sa.survey_id WHERE s.tenant_id = $1 AND (sa.assignment_type = 'all_users'
       OR (sa.assignment_type = 'area' AND sa.area_id = $2) OR (sa.assignment_type = 'department' AND sa.department_id = $3)
       OR ${teamCondition} OR (sa.assignment_type = 'user' AND sa.user_id = $${userIdParamIndex}))${statusClause}
       GROUP BY s.id ORDER BY s.created_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      params,
    );
  }

  private async attachAssignmentsToSurveys(surveys: DbSurvey[], tenantId: number): Promise<void> {
    if (surveys.length === 0) return;
    const surveyIds = surveys.map((s: DbSurvey) => s.id);
    const placeholders = surveyIds.map((_: number, idx: number) => `$${idx + 1}`).join(',');
    const tenantParamIndex = surveyIds.length + 1;

    const assignmentRows = await this.db.query<DbSurveyAssignment & { survey_id: number }>(
      `SELECT * FROM survey_assignments WHERE survey_id IN (${placeholders}) AND tenant_id = $${tenantParamIndex}
       ORDER BY survey_id, id`,
      [...surveyIds, tenantId],
    );
    const assignmentsBySurveyId = new Map<number, DbSurveyAssignment[]>();
    for (const assignment of assignmentRows) {
      if (!assignmentsBySurveyId.has(assignment.survey_id)) {
        assignmentsBySurveyId.set(assignment.survey_id, []);
      }
      assignmentsBySurveyId.get(assignment.survey_id)?.push(assignment);
    }
    for (const survey of surveys) {
      survey.assignments = assignmentsBySurveyId.get(survey.id) ?? [];
    }
  }

  private transformSurveyWithMetadata(survey: DbSurvey): unknown {
    const transformed = this.transformSurveyToApi(survey as unknown as Record<string, unknown>);
    return {
      ...transformed,
      responseCount:
        typeof survey.response_count === 'string' ?
          Number.parseInt(survey.response_count, 10)
        : (survey.response_count ?? 0),
      completedCount:
        typeof survey.completed_count === 'string' ?
          Number.parseInt(survey.completed_count, 10)
        : (survey.completed_count ?? 0),
      creatorFirstName: survey.creator_first_name,
      creatorLastName: survey.creator_last_name,
    };
  }

  private transformSurveyToApi(survey: Record<string, unknown>): Record<string, unknown> {
    const apiSurvey = dbToApi(survey);
    const questions = survey['questions'];
    if (questions !== undefined && questions !== null && Array.isArray(questions)) {
      apiSurvey['questions'] = (questions as Record<string, unknown>[]).map(
        (q: Record<string, unknown>) => {
          const transformedQuestion = dbToApi(q);
          const options = q['options'];
          if (options !== null && options !== undefined && Array.isArray(options)) {
            transformedQuestion['options'] = (options as unknown[]).map((opt: unknown) => {
              if (typeof opt === 'string') return opt;
              if (typeof opt === 'object' && opt !== null) {
                return dbToApi(opt as Record<string, unknown>);
              }
              return opt;
            });
          }
          return {
            ...transformedQuestion,
            orderPosition: q['order_position'] ?? q['order_index'],
          };
        },
      );
    }
    const assignments = survey['assignments'];
    if (assignments !== undefined && assignments !== null && Array.isArray(assignments)) {
      apiSurvey['assignments'] = (assignments as Record<string, unknown>[]).map(
        (a: Record<string, unknown>) => dbToApi(a),
      );
    }
    return apiSurvey;
  }

  async getSurveyById(
    id: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<unknown> {
    this.logger.log(`Getting survey ${String(id)} for tenant ${tenantId}`);
    let survey: DbSurvey | null;
    if (typeof id === 'string') {
      survey = await this.getSurveyByUUID(id, tenantId);
    } else {
      survey = await this.getSurveyByNumericId(id, tenantId);
    }
    if (survey === null) {
      throw new NotFoundException(MSG_SURVEY_NOT_FOUND);
    }
    await this.checkSurveyAccess(survey.id, tenantId, userId, userRole);
    return this.transformSurveyToApi(survey as unknown as Record<string, unknown>);
  }

  private async getSurveyByNumericId(surveyId: number, tenantId: number): Promise<DbSurvey | null> {
    const surveyRows = await this.db.query<DbSurvey>(
      `SELECT s.*, u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM surveys s LEFT JOIN users u ON s.created_by = u.id WHERE s.id = $1 AND s.tenant_id = $2`,
      [surveyId, tenantId],
    );
    if (surveyRows.length === 0) return null;
    const survey = surveyRows[0];
    if (survey === undefined) return null;
    const loaded = await this.loadSurveyQuestionsAndAssignments(survey.id);
    survey.questions = loaded.questions;
    survey.assignments = loaded.assignments;
    return survey;
  }

  private async getSurveyByUUID(uuid: string, tenantId: number): Promise<DbSurvey | null> {
    const surveyRows = await this.db.query<DbSurvey>(
      `SELECT s.*, u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM surveys s LEFT JOIN users u ON s.created_by = u.id WHERE s.uuid = $1 AND s.tenant_id = $2`,
      [uuid, tenantId],
    );
    if (surveyRows.length === 0) return null;
    const survey = surveyRows[0];
    if (survey === undefined) return null;
    const loaded = await this.loadSurveyQuestionsAndAssignments(survey.id);
    survey.questions = loaded.questions;
    survey.assignments = loaded.assignments;
    return survey;
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

  private async loadSurveyQuestionsAndAssignments(
    surveyId: number,
  ): Promise<{ questions: DbSurveyQuestion[]; assignments: DbSurveyAssignment[] }> {
    const questions = await this.db.query<DbSurveyQuestion>(
      `SELECT * FROM survey_questions WHERE survey_id = $1 ORDER BY order_index`,
      [surveyId],
    );
    if (questions.length > 0) {
      const questionIds = questions.map((q: DbSurveyQuestion) => q.id);
      const placeholders = questionIds.map((_: number, idx: number) => `$${idx + 1}`).join(',');
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

  private async checkSurveyAccess(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    if (userRole === 'root') return;
    if (userRole === 'employee') {
      const surveys = await this.getAllByTenantForEmployee(tenantId, userId, undefined, 1000, 0);
      const hasAccess = surveys.some((s: DbSurvey) => s.id === surveyId);
      if (!hasAccess) {
        throw new ForbiddenException("You don't have access to this survey");
      }
      return;
    }
    if (userRole === 'admin') {
      const surveys = await this.getAllByTenantForAdmin(tenantId, userId, undefined, 1000, 0);
      const hasAccess = surveys.some((s: DbSurvey) => s.id === surveyId);
      if (!hasAccess) {
        throw new ForbiddenException("You don't have access to this survey");
      }
    }
  }

  /** Inserts questions and their options for a survey */
  private async insertSurveyQuestions(
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
  private async insertQuestionOptions(
    tenantId: number,
    questionId: number,
    questionData: { question_type: string; options?: string[] },
  ): Promise<void> {
    if (questionData.options === undefined || questionData.options.length === 0) return;
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
  private async insertSurveyAssignments(
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

  async createSurvey(
    dto: CreateSurveyDto,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<unknown> {
    this.logger.log(`Creating survey: ${dto.title}`);
    const surveyUuid = uuidv7();
    const surveyRows = await this.db.query<{ id: number }>(
      `INSERT INTO surveys (tenant_id, title, description, created_by, status, is_anonymous, is_mandatory, start_date, end_date, uuid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        tenantId,
        dto.title,
        dto.description ?? null,
        userId,
        dto.status ?? 'draft',
        dto.isAnonymous ?? false,
        dto.isMandatory ?? false,
        dto.startDate ?? null,
        dto.endDate ?? null,
        surveyUuid,
      ],
    );
    const surveyId = surveyRows[0]?.id ?? 0;

    if (dto.questions !== undefined && dto.questions.length > 0) {
      await this.insertSurveyQuestions(tenantId, surveyId, dto.questions);
    }
    if (dto.assignments !== undefined && dto.assignments.length > 0) {
      await this.insertSurveyAssignments(tenantId, surveyId, dto.assignments);
    }
    return await this.getSurveyById(surveyId, tenantId, userId, 'admin');
  }

  async updateSurvey(
    id: number,
    dto: UpdateSurveyDto,
    tenantId: number,
    userId: number,
    userRole: string,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<unknown> {
    this.logger.log(`Updating survey ${id}`);
    const existingSurvey = (await this.getSurveyById(id, tenantId, userId, userRole)) as Record<
      string,
      unknown
    >;
    const responseCount = existingSurvey['responseCount'];
    this.validateSurveyUpdate(
      userRole,
      existingSurvey['status'] as string,
      typeof responseCount === 'number' ? responseCount : 0,
    );

    await this.db.query(
      `UPDATE surveys SET title = COALESCE($1, title), description = COALESCE($2, description),
       status = COALESCE($3, status), is_anonymous = COALESCE($4, is_anonymous), is_mandatory = COALESCE($5, is_mandatory),
       start_date = COALESCE($6, start_date), end_date = COALESCE($7, end_date), updated_at = NOW()
       WHERE id = $8 AND tenant_id = $9`,
      [
        dto.title ?? null,
        dto.description ?? null,
        dto.status ?? null,
        dto.isAnonymous ?? null,
        dto.isMandatory ?? null,
        dto.startDate ?? null,
        dto.endDate ?? null,
        id,
        tenantId,
      ],
    );

    if (dto.questions !== undefined) {
      await this.db.query('DELETE FROM survey_questions WHERE survey_id = $1', [id]);
      await this.insertSurveyQuestions(tenantId, id, dto.questions);
    }
    if (dto.assignments !== undefined) {
      await this.db.query('DELETE FROM survey_assignments WHERE survey_id = $1', [id]);
      await this.insertSurveyAssignments(tenantId, id, dto.assignments);
    }
    return await this.getSurveyById(id, tenantId, userId, userRole);
  }

  /** Validates update permissions and state */
  private validateSurveyUpdate(userRole: string, status: string, responseCount: number): void {
    if (userRole === 'employee') {
      throw new ForbiddenException('Only admins can update surveys');
    }
    if (status === 'active' && responseCount > 0) {
      throw new ConflictException('Cannot update survey with existing responses');
    }
  }

  async deleteSurvey(
    id: number,
    tenantId: number,
    userId: number,
    userRole: string,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting survey ${id}`);
    const existingSurvey = (await this.getSurveyById(id, tenantId, userId, userRole)) as Record<
      string,
      unknown
    >;
    const rawCount = existingSurvey['responseCount'];
    const responseCount = typeof rawCount === 'number' ? rawCount : 0;
    if (userRole === 'employee') {
      throw new ForbiddenException('Only admins can delete surveys');
    }
    if (responseCount > 0) {
      throw new ConflictException('Cannot delete survey with existing responses');
    }
    await this.db.query('DELETE FROM surveys WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return { message: 'Survey deleted successfully' };
  }

  async getTemplates(tenantId: number): Promise<unknown[]> {
    this.logger.log(`Getting templates for tenant ${tenantId}`);
    const templateRows = await this.db.query<DbSurveyTemplate>(
      `SELECT * FROM survey_templates WHERE tenant_id = $1 OR is_public = true ORDER BY name`,
      [tenantId],
    );
    return templateRows.map((t: DbSurveyTemplate) =>
      dbToApi(t as unknown as Record<string, unknown>),
    );
  }

  async createFromTemplate(
    templateId: number,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<unknown> {
    this.logger.log(`Creating survey from template ${templateId}`);
    const templateRows = await this.db.query<DbSurveyTemplate>(
      `SELECT * FROM survey_templates WHERE id = $1 AND (tenant_id = $2 OR is_public = true)`,
      [templateId, tenantId],
    );
    if (templateRows.length === 0) {
      throw new NotFoundException('Template not found');
    }
    const template = templateRows[0];
    if (template === undefined) {
      throw new NotFoundException('Template not found');
    }
    const templateData = JSON.parse(template.template_data) as {
      title: string;
      description?: string;
      questions?: QuestionInput[];
    };
    const dto: CreateSurveyDto = { title: templateData.title, status: 'draft' };
    if (templateData.description !== undefined) {
      dto.description = templateData.description;
    }
    if (templateData.questions !== undefined) {
      dto.questions = templateData.questions as CreateSurveyDto['questions'];
    }
    return await this.createSurvey(dto, tenantId, userId, ipAddress, userAgent);
  }

  /** Parses count value from DB (handles string or number) */
  private parseDbCount(value: number | string | undefined): number {
    if (typeof value === 'string') return Number.parseInt(value, 10);
    return value ?? 0;
  }

  /** Builds statistics for all questions in a survey */
  private async buildQuestionStats(
    questions: DbSurveyQuestion[],
  ): Promise<SurveyStatisticsResponse['questions']> {
    const stats: SurveyStatisticsResponse['questions'] = [];
    for (const question of questions) {
      const stat = await this.buildSingleQuestionStat(question);
      stats.push(stat);
    }
    return stats;
  }

  /** Builds statistics for a single question based on its type */
  private async buildSingleQuestionStat(
    question: DbSurveyQuestion,
  ): Promise<SurveyStatisticsResponse['questions'][number]> {
    const stat: SurveyStatisticsResponse['questions'][number] = {
      id: question.id,
      questionText: question.question_text,
      questionType: question.question_type,
    };
    const qType = question.question_type as string;
    if (qType === 'single_choice' || qType === 'multiple_choice' || qType === 'yes_no') {
      stat.options = await this.getChoiceQuestionStats(question);
    } else if (qType === 'text') {
      stat.responses = await this.getTextQuestionResponses(question.id);
    } else if (qType === 'rating' || qType === 'number') {
      stat.statistics = await this.getRatingQuestionStats(question.id);
    } else if (qType === 'date') {
      stat.options = await this.getDateQuestionStats(question.id);
    }
    return stat;
  }

  async getStatistics(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<SurveyStatisticsResponse> {
    this.logger.log(`Getting statistics for survey ${surveyId}`);
    await this.getSurveyById(surveyId, tenantId, userId, userRole);
    if (userRole === 'employee') {
      throw new ForbiddenException('Only admins can view survey statistics');
    }

    const statsRows = await this.db.query<{
      total_responses: number | string;
      completed_responses: number | string;
      first_response: Date | null;
      last_response: Date | null;
    }>(
      `SELECT COUNT(DISTINCT sr.id) as total_responses,
       COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_responses,
       MIN(sr.started_at) as first_response, MAX(sr.completed_at) as last_response
       FROM surveys s LEFT JOIN survey_responses sr ON s.id = sr.survey_id WHERE s.id = $1 AND s.tenant_id = $2`,
      [surveyId, tenantId],
    );

    const statsRow = statsRows[0];
    const totalResponses = this.parseDbCount(statsRow?.total_responses);
    const completedResponses = this.parseDbCount(statsRow?.completed_responses);

    const survey = await this.getSurveyByNumericId(surveyId, tenantId);
    if (survey === null) throw new NotFoundException(MSG_SURVEY_NOT_FOUND);

    const response: SurveyStatisticsResponse = {
      surveyId,
      totalResponses,
      completedResponses,
      completionRate:
        totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0,
      questions: await this.buildQuestionStats(survey.questions ?? []),
    };
    if (statsRow?.first_response !== null && statsRow?.first_response !== undefined) {
      response.firstResponse = statsRow.first_response;
    }
    if (statsRow?.last_response !== null && statsRow?.last_response !== undefined) {
      response.lastResponse = statsRow.last_response;
    }
    return response;
  }

  private async getChoiceQuestionStats(
    question: DbSurveyQuestion,
  ): Promise<{ optionId: number; optionText: string; count: number }[]> {
    let options: { id: number; option_text: string }[];
    if ((question.question_type as string) === 'yes_no') {
      options = [
        { id: 1, option_text: 'Ja' },
        { id: 2, option_text: 'Nein' },
      ];
    } else {
      options = question.options ?? [];
    }
    const answerRows = await this.db.query<{ answer_options: string | number[] }>(
      `SELECT sa.answer_options FROM survey_answers sa WHERE sa.question_id = $1 AND sa.answer_options IS NOT NULL`,
      [question.id],
    );
    const optionCounts = new Map<number, number>();
    for (const answer of answerRows) {
      const selectedOptions =
        typeof answer.answer_options === 'string' ?
          (JSON.parse(answer.answer_options) as number[])
        : answer.answer_options;
      if (Array.isArray(selectedOptions)) {
        for (const optionId of selectedOptions) {
          optionCounts.set(optionId, (optionCounts.get(optionId) ?? 0) + 1);
        }
      }
    }
    return options.map((option: { id: number; option_text: string }) => ({
      optionId: option.id,
      optionText: option.option_text,
      count: optionCounts.get(option.id) ?? 0,
    }));
  }

  private async getTextQuestionResponses(questionId: number): Promise<
    {
      answerText?: string;
      userId?: number | null;
      firstName?: string | null;
      lastName?: string | null;
    }[]
  > {
    const rows = await this.db.query<{
      answer_text: string | null;
      user_id: number | null;
      first_name: string | null;
      last_name: string | null;
    }>(
      `SELECT sa.answer_text, sr.user_id, u.first_name, u.last_name
       FROM survey_answers sa JOIN survey_responses sr ON sa.response_id = sr.id
       LEFT JOIN users u ON sr.user_id = u.id WHERE sa.question_id = $1 AND sa.answer_text IS NOT NULL`,
      [questionId],
    );
    return rows.map(
      (row: {
        answer_text: string | null;
        user_id: number | null;
        first_name: string | null;
        last_name: string | null;
      }) => ({
        answerText: row.answer_text ?? '',
        userId: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
      }),
    );
  }

  private async getRatingQuestionStats(questionId: number): Promise<{
    average: number | null;
    min: number | null;
    max: number | null;
    totalResponses: number;
  }> {
    const statsRows = await this.db.query<{
      average: number | null;
      min: number | null;
      max: number | null;
      total_responses: number | string;
    }>(
      `SELECT AVG(sa.answer_number) as average, MIN(sa.answer_number) as min, MAX(sa.answer_number) as max,
       COUNT(sa.answer_number) as total_responses FROM survey_answers sa
       WHERE sa.question_id = $1 AND sa.answer_number IS NOT NULL`,
      [questionId],
    );
    const stats = statsRows[0];
    return {
      average: stats?.average ?? null,
      min: stats?.min ?? null,
      max: stats?.max ?? null,
      totalResponses:
        typeof stats?.total_responses === 'string' ?
          Number.parseInt(stats.total_responses, 10)
        : (stats?.total_responses ?? 0),
    };
  }

  private async getDateQuestionStats(
    questionId: number,
  ): Promise<{ optionId: number; optionText: string; count: number }[]> {
    const dateRows = await this.db.query<{ answer_date: Date | string; count: number | string }>(
      `SELECT sa.answer_date, COUNT(*) as count FROM survey_answers sa
       WHERE sa.question_id = $1 AND sa.answer_date IS NOT NULL
       GROUP BY sa.answer_date ORDER BY count DESC, sa.answer_date DESC`,
      [questionId],
    );
    return dateRows.map(
      (row: { answer_date: Date | string; count: number | string }, index: number) => {
        const dateText =
          row.answer_date instanceof Date ?
            row.answer_date.toISOString().split('T')[0]
          : row.answer_date.split('T')[0];
        return {
          optionId: index + 1,
          optionText: dateText ?? '',
          count: typeof row.count === 'string' ? Number.parseInt(row.count, 10) : row.count,
        };
      },
    );
  }

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

    const responseRows = await this.db.query<{ id: number }>(
      `INSERT INTO survey_responses (survey_id, user_id, tenant_id, started_at, completed_at, status)
       VALUES ($1, $2, $3, NOW(), NOW(), 'completed') RETURNING id`,
      [surveyId, userId, tenantId],
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

  async getAllResponses(
    surveyId: number,
    tenantId: number,
    userRole: string,
    _userId: number,
    options: { page: number; limit: number },
  ): Promise<PaginatedResponsesResult> {
    this.logger.log(`Getting all responses for survey ${surveyId}`);
    if (userRole !== 'root' && userRole !== 'admin') {
      throw new ForbiddenException('No permission');
    }
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

  private async transformResponseWithAnswers(
    dbResponse: DbSurveyResponse,
    tenantId: number,
  ): Promise<SurveyResponse> {
    const answerRows = await this.db.query<DbSurveyAnswer>(
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
    return {
      ...baseResponse,
      answers: answerRows.map((a: DbSurveyAnswer) => {
        const transformed = dbToApi(a as unknown as Record<string, unknown>) as SurveyAnswer;
        if (a.answer_date !== null && typeof a.answer_date !== 'string') {
          transformed.answerDate = (a.answer_date as Date).toISOString();
        }
        return transformed;
      }),
    };
  }

  async getMyResponse(
    surveyId: number,
    userId: number,
    tenantId: number,
  ): Promise<SurveyResponse | null> {
    this.logger.log(`Getting user ${userId} response to survey ${surveyId}`);
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

  async getResponseById(
    surveyId: number,
    responseId: number,
    tenantId: number,
    userRole: string,
    userId: number,
  ): Promise<SurveyResponse> {
    this.logger.log(`Getting response ${responseId} for survey ${surveyId}`);
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

  async updateResponse(
    surveyId: number,
    responseId: number,
    userId: number,
    tenantId: number,
    answers: SurveyAnswer[],
  ): Promise<{ message: string }> {
    this.logger.log(`Updating response ${responseId} for survey ${surveyId}`);
    const resultRows = await this.db.query<{ id: number; allow_edit_responses: number }>(
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
    return { message: 'Response updated successfully' };
  }

  async exportResponses(
    surveyId: number,
    tenantId: number,
    userRole: string,
    _userId: number,
    format: 'csv' | 'excel',
  ): Promise<Buffer> {
    this.logger.log(`Exporting responses for survey ${surveyId} as ${format}`);
    if (userRole !== 'root' && userRole !== 'admin') {
      throw new ForbiddenException('No permission');
    }
    const surveyCheckRows = await this.db.query<{ id: number }>(
      `SELECT id FROM surveys WHERE id = $1 AND tenant_id = $2`,
      [surveyId, tenantId],
    );
    if (surveyCheckRows.length === 0) {
      throw new NotFoundException(MSG_SURVEY_NOT_FOUND);
    }
    const exportRows = await this.db.query<{
      response_id: number;
      user_id: number;
      completed_at: Date | string | null;
      username: string | null;
      first_name: string | null;
      last_name: string | null;
      question_text: string;
      question_type: string;
      answer_text: string | null;
      answer_number: number | null;
      answer_date: Date | string | null;
      answer_options: string | null;
    }>(
      `SELECT sr.id as response_id, sr.user_id, sr.completed_at, u.username, u.first_name, u.last_name,
       sq.question_text, sq.question_type, sa.answer_text, sa.answer_number, sa.answer_date, sa.answer_options
       FROM survey_responses sr LEFT JOIN users u ON sr.user_id = u.id
       LEFT JOIN survey_questions sq ON sq.survey_id = sr.survey_id
       LEFT JOIN survey_answers sa ON sa.response_id = sr.id AND sa.question_id = sq.id
       WHERE sr.survey_id = $1 AND sr.tenant_id = $2 ORDER BY sr.id, sq.order_index`,
      [surveyId, tenantId],
    );
    const headers = ['Response ID', 'User', 'Completed', 'Question', 'Answer'];
    const rows = exportRows.map(
      (row: {
        response_id: number;
        user_id: number;
        completed_at: Date | string | null;
        username: string | null;
        first_name: string | null;
        last_name: string | null;
        question_text: string;
        answer_text: string | null;
        answer_number: number | null;
        answer_date: Date | string | null;
        answer_options: string | null;
      }) => {
        const fullName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
        const userName = fullName !== '' ? fullName : (row.username ?? '');
        const completed = row.completed_at !== null ? String(row.completed_at) : '';
        return [
          String(row.response_id),
          userName,
          completed,
          row.question_text,
          String(
            row.answer_text ?? row.answer_number ?? row.answer_date ?? row.answer_options ?? '',
          ),
        ];
      },
    );
    const csv = [
      headers.join(','),
      ...rows.map((row: string[]) =>
        row.map((cell: string) => `"${cell.replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');
    return Buffer.from(csv, 'utf-8');
  }

  parseIdParam(id: string): number | string {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(id)) {
      return id;
    }
    const numericId = Number.parseInt(id, 10);
    if (Number.isNaN(numericId) || numericId <= 0) {
      throw new BadRequestException('ID must be a positive integer or valid UUID');
    }
    return numericId;
  }
}
