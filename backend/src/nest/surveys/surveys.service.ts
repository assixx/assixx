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

import { eventBus } from '../../utils/eventBus.js';
import { dbToApi } from '../../utils/fieldMapping.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateSurveyDto } from './dto/create-survey.dto.js';
import type { UpdateSurveyDto } from './dto/update-survey.dto.js';

// ============================================
// CONSTANTS
// ============================================

const MSG_SURVEY_NOT_FOUND = 'Survey not found';

/** SQL queries to verify leadership permissions per assignment entity type */
const LEADERSHIP_QUERIES: Record<string, string> = {
  area: `SELECT id FROM areas WHERE id = $1 AND area_lead_id = $2 AND tenant_id = $3`,
  department: `SELECT d.id FROM departments d
    LEFT JOIN areas a ON d.area_id = a.id
    WHERE d.id = $1 AND d.tenant_id = $3
      AND (d.department_lead_id = $2 OR a.area_lead_id = $2)`,
  team: `SELECT t.id FROM teams t
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN areas a ON d.area_id = a.id
    WHERE t.id = $1 AND t.tenant_id = $3
      AND (d.department_lead_id = $2 OR a.area_lead_id = $2)`,
};

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
  area_name?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  team_id?: number | null;
  team_name?: string | null;
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
  constructor(
    private readonly db: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ==========================================================================
  // SURVEY LISTING - Visibility mirrors calendar (ADR-010)
  // ==========================================================================

  async listSurveys(
    tenantId: number,
    userId: number,
    userRole: string,
    query: {
      status?: string | undefined;
      page?: number | undefined;
      limit?: number | undefined;
      manage?: boolean | undefined;
    },
  ): Promise<unknown[]> {
    this.logger.debug(`Listing surveys for tenant ${tenantId}, user ${userId}`);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    // Step 1: Check unrestricted access (mirrors calendar.service.ts:277)
    const hasUnrestrictedAccess = await this.checkUnrestrictedAccess(
      userId,
      tenantId,
      userRole,
    );

    let surveys: DbSurvey[];
    if (hasUnrestrictedAccess) {
      surveys = await this.getAllSurveysUnrestricted(
        tenantId,
        query.status,
        limit,
        offset,
      );
    } else if (query.manage === true) {
      // Management mode: only surveys user can manage (creator/lead)
      surveys = await this.getAllSurveysManageable(
        tenantId,
        userId,
        query.status,
        limit,
        offset,
      );
    } else {
      surveys = await this.getAllSurveysWithVisibility(
        tenantId,
        userId,
        query.status,
        limit,
        offset,
      );
    }
    await this.attachAssignmentsToSurveys(surveys, tenantId);

    // Compute canManage flag for each survey
    let manageableIds: Set<number>;
    if (hasUnrestrictedAccess || query.manage === true) {
      // Unrestricted users can manage all; manage=true already filtered to manageable only
      manageableIds = new Set(surveys.map((s: DbSurvey) => s.id));
    } else {
      manageableIds = await this.getManageableSurveyIds(
        surveys.map((s: DbSurvey) => s.id),
        tenantId,
        userId,
      );
    }

    return surveys.map((s: DbSurvey) => ({
      ...this.transformSurveyWithMetadata(s),
      canManage: manageableIds.has(s.id),
    }));
  }

  /**
   * Check if user has unrestricted access (root OR has_full_access=true).
   * Mirrors calendar.service.ts: `userRole.has_full_access || userRole.role === 'root'`
   */
  private async checkUnrestrictedAccess(
    userId: number,
    tenantId: number,
    userRole: string,
  ): Promise<boolean> {
    if (userRole === 'root') return true;
    const rows = await this.db.query<{ has_full_access: boolean }>(
      `SELECT has_full_access FROM users WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    return rows[0]?.has_full_access === true;
  }

  /**
   * Build the visibility WHERE clause for surveys.
   * Mirrors calendar's buildVisibilityClause().
   * Returns SQL fragment: (s.created_by = $X OR EXISTS(...))
   * Expects `s` as the survey table alias.
   */
  private buildVisibilityClause(
    tenantParam: string,
    userParam: string,
  ): string {
    return `(
      s.created_by = ${userParam}
      OR EXISTS (
        SELECT 1 FROM survey_assignments sa WHERE sa.survey_id = s.id AND (
          sa.assignment_type = 'all_users'
          OR (sa.assignment_type = 'area' AND (
            EXISTS (SELECT 1 FROM admin_area_permissions aap
                    WHERE aap.admin_user_id = ${userParam} AND aap.area_id = sa.area_id AND aap.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM areas a
                       WHERE a.id = sa.area_id AND a.area_lead_id = ${userParam} AND a.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM user_departments ud
                       JOIN departments d ON ud.department_id = d.id
                       WHERE ud.user_id = ${userParam} AND ud.tenant_id = ${tenantParam} AND d.area_id = sa.area_id)
          ))
          OR (sa.assignment_type = 'department' AND (
            EXISTS (SELECT 1 FROM admin_department_permissions adp
                    WHERE adp.admin_user_id = ${userParam} AND adp.department_id = sa.department_id AND adp.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM departments d
                       WHERE d.id = sa.department_id AND d.department_lead_id = ${userParam} AND d.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM user_departments ud
                       WHERE ud.user_id = ${userParam} AND ud.department_id = sa.department_id AND ud.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM departments d
                       JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                       WHERE d.id = sa.department_id AND aap.admin_user_id = ${userParam} AND aap.tenant_id = ${tenantParam})
          ))
          OR (sa.assignment_type = 'team' AND (
            EXISTS (SELECT 1 FROM user_teams ut
                    WHERE ut.user_id = ${userParam} AND ut.team_id = sa.team_id AND ut.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM teams t
                       WHERE t.id = sa.team_id AND t.team_lead_id = ${userParam} AND t.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM teams t
                       JOIN admin_department_permissions adp ON adp.department_id = t.department_id
                       WHERE t.id = sa.team_id AND adp.admin_user_id = ${userParam} AND adp.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM teams t
                       JOIN departments d ON t.department_id = d.id
                       JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                       WHERE t.id = sa.team_id AND aap.admin_user_id = ${userParam} AND aap.tenant_id = ${tenantParam})
          ))
          OR (sa.assignment_type = 'user' AND sa.user_id = ${userParam})
        )
      )
    )`;
  }

  /**
   * Build the management visibility WHERE clause for surveys.
   * Stricter than buildVisibilityClause(): only creator OR lead of assigned org unit.
   * Used for admin management operations (list/view/edit/delete in survey-admin).
   *
   * Hierarchy inheritance: area lead → dept/team in area, dept lead → team in dept.
   */
  private buildManagementVisibilityClause(
    tenantParam: string,
    userParam: string,
  ): string {
    return `(
      s.created_by = ${userParam}
      OR EXISTS (
        SELECT 1 FROM survey_assignments sa WHERE sa.survey_id = s.id AND (
          (sa.assignment_type = 'area' AND EXISTS (
            SELECT 1 FROM areas a
            WHERE a.id = sa.area_id AND a.area_lead_id = ${userParam} AND a.tenant_id = ${tenantParam}
          ))
          OR (sa.assignment_type = 'department' AND (
            EXISTS (SELECT 1 FROM departments d
                    WHERE d.id = sa.department_id AND d.department_lead_id = ${userParam} AND d.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM departments d
                       JOIN areas a ON d.area_id = a.id
                       WHERE d.id = sa.department_id AND a.area_lead_id = ${userParam} AND a.tenant_id = ${tenantParam})
          ))
          OR (sa.assignment_type = 'team' AND (
            EXISTS (SELECT 1 FROM teams t
                    WHERE t.id = sa.team_id AND t.team_lead_id = ${userParam} AND t.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM teams t
                       JOIN departments d ON t.department_id = d.id
                       WHERE t.id = sa.team_id AND d.department_lead_id = ${userParam} AND d.tenant_id = ${tenantParam})
            OR EXISTS (SELECT 1 FROM teams t
                       JOIN departments d ON t.department_id = d.id
                       JOIN areas a ON d.area_id = a.id
                       WHERE t.id = sa.team_id AND a.area_lead_id = ${userParam} AND a.tenant_id = ${tenantParam})
          ))
        )
      )
    )`;
  }

  /**
   * Unrestricted: root or has_full_access=true sees ALL surveys in tenant.
   */
  private async getAllSurveysUnrestricted(
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
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(limit, offset);

    return await this.db.query<DbSurvey>(
      `SELECT s.*, MAX(u.first_name) as creator_first_name, MAX(u.last_name) as creator_last_name,
       COUNT(DISTINCT sr.id) as response_count,
       COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
       FROM surveys s LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN survey_responses sr ON s.id = sr.survey_id
       WHERE s.tenant_id = $1${statusClause}
       GROUP BY s.id
       ORDER BY s.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
  }

  /**
   * Permission-based visibility for admins (without full access) AND employees.
   * Unified query using EXISTS subqueries — mirrors calendar buildVisibilityClause().
   *
   * Access paths per assignment_type:
   *  all_users  → everyone
   *  area       → admin_area_permissions | area_lead | user_departments membership
   *  department → admin_dept_perms | dept_lead | user_departments | area perm inheritance
   *  team       → user_teams | team_lead | dept perm inheritance | area perm inheritance
   *  user       → direct user assignment
   *  creator    → always sees own surveys
   */
  private async getAllSurveysWithVisibility(
    tenantId: number,
    userId: number,
    status: string | undefined,
    limit: number,
    offset: number,
  ): Promise<DbSurvey[]> {
    const params: unknown[] = [tenantId, userId];
    let statusClause = '';
    if (status !== undefined) {
      statusClause = ` AND s.status = $${params.length + 1}`;
      params.push(status);
    }
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(limit, offset);

    // $1 = tenantId, $2 = userId
    const visibilityClause = this.buildVisibilityClause('$1', '$2');
    return await this.db.query<DbSurvey>(
      `SELECT s.*, MAX(u.first_name) as creator_first_name, MAX(u.last_name) as creator_last_name,
       COUNT(DISTINCT sr.id) as response_count,
       COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
       FROM surveys s
       LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN survey_responses sr ON s.id = sr.survey_id
       WHERE s.tenant_id = $1
       AND ${visibilityClause}${statusClause}
       GROUP BY s.id
       ORDER BY s.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
  }

  /**
   * Management-level visibility: only surveys the admin can manage.
   * Creator OR lead of assigned org unit (with hierarchy inheritance).
   */
  private async getAllSurveysManageable(
    tenantId: number,
    userId: number,
    status: string | undefined,
    limit: number,
    offset: number,
  ): Promise<DbSurvey[]> {
    const params: unknown[] = [tenantId, userId];
    let statusClause = '';
    if (status !== undefined) {
      statusClause = ` AND s.status = $${params.length + 1}`;
      params.push(status);
    }
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(limit, offset);

    const managementClause = this.buildManagementVisibilityClause('$1', '$2');
    return await this.db.query<DbSurvey>(
      `SELECT s.*, MAX(u.first_name) as creator_first_name, MAX(u.last_name) as creator_last_name,
       COUNT(DISTINCT sr.id) as response_count,
       COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_count
       FROM surveys s
       LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN survey_responses sr ON s.id = sr.survey_id
       WHERE s.tenant_id = $1
       AND ${managementClause}${statusClause}
       GROUP BY s.id
       ORDER BY s.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
  }

  /**
   * Get the set of survey IDs the user can manage within a given set.
   * Used to compute the canManage flag for list responses.
   */
  private async getManageableSurveyIds(
    surveyIds: number[],
    tenantId: number,
    userId: number,
  ): Promise<Set<number>> {
    if (surveyIds.length === 0) return new Set();

    const placeholders = surveyIds
      .map((_: number, idx: number) => `$${idx + 1}`)
      .join(',');
    const tenantIdx = surveyIds.length + 1;
    const userIdx = surveyIds.length + 2;
    const managementClause = this.buildManagementVisibilityClause(
      `$${tenantIdx}`,
      `$${userIdx}`,
    );

    const rows = await this.db.query<{ id: number }>(
      `SELECT s.id FROM surveys s
       WHERE s.id IN (${placeholders}) AND s.tenant_id = $${tenantIdx}
       AND ${managementClause}`,
      [...surveyIds, tenantId, userId],
    );
    return new Set(rows.map((r: { id: number }) => r.id));
  }

  private async attachAssignmentsToSurveys(
    surveys: DbSurvey[],
    tenantId: number,
  ): Promise<void> {
    if (surveys.length === 0) return;
    const surveyIds = surveys.map((s: DbSurvey) => s.id);
    const placeholders = surveyIds
      .map((_: number, idx: number) => `$${idx + 1}`)
      .join(',');
    const tenantParamIndex = surveyIds.length + 1;

    const assignmentRows = await this.db.query<
      DbSurveyAssignment & { survey_id: number }
    >(
      `SELECT sa.*,
         a.name AS area_name,
         d.name AS department_name,
         t.name AS team_name
       FROM survey_assignments sa
       LEFT JOIN areas a ON sa.area_id = a.id
       LEFT JOIN departments d ON sa.department_id = d.id
       LEFT JOIN teams t ON sa.team_id = t.id
       WHERE sa.survey_id IN (${placeholders}) AND sa.tenant_id = $${tenantParamIndex}
       ORDER BY sa.survey_id, sa.id`,
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

  private transformSurveyWithMetadata(
    survey: DbSurvey,
  ): Record<string, unknown> {
    const transformed = this.transformSurveyToApi(
      survey as unknown as Record<string, unknown>,
    );
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

  private transformSurveyToApi(
    survey: Record<string, unknown>,
  ): Record<string, unknown> {
    const apiSurvey = dbToApi(survey);
    const questions = survey['questions'];
    if (
      questions !== undefined &&
      questions !== null &&
      Array.isArray(questions)
    ) {
      apiSurvey['questions'] = (questions as Record<string, unknown>[]).map(
        (q: Record<string, unknown>) => {
          const transformedQuestion = dbToApi(q);
          const options = q['options'];
          if (
            options !== null &&
            options !== undefined &&
            Array.isArray(options)
          ) {
            transformedQuestion['options'] = (options as unknown[]).map(
              (opt: unknown) => {
                if (typeof opt === 'string') return opt;
                if (typeof opt === 'object' && opt !== null) {
                  return dbToApi(opt as Record<string, unknown>);
                }
                return opt;
              },
            );
          }
          return {
            ...transformedQuestion,
            orderPosition: q['order_position'] ?? q['order_index'],
          };
        },
      );
    }
    const assignments = survey['assignments'];
    if (
      assignments !== undefined &&
      assignments !== null &&
      Array.isArray(assignments)
    ) {
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
    manage?: boolean,
  ): Promise<unknown> {
    this.logger.debug(`Getting survey ${String(id)} for tenant ${tenantId}`);
    let survey: DbSurvey | null;
    if (typeof id === 'string') {
      survey = await this.getSurveyByUUID(id, tenantId);
    } else {
      survey = await this.getSurveyByNumericId(id, tenantId);
    }
    if (survey === null) {
      throw new NotFoundException(MSG_SURVEY_NOT_FOUND);
    }
    if (manage === true) {
      await this.checkSurveyManagementAccess(
        survey.id,
        tenantId,
        userId,
        userRole,
      );
    } else {
      await this.checkSurveyAccess(survey.id, tenantId, userId, userRole);
    }
    return this.transformSurveyToApi(
      survey as unknown as Record<string, unknown>,
    );
  }

  private async getSurveyByNumericId(
    surveyId: number,
    tenantId: number,
  ): Promise<DbSurvey | null> {
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

  private async getSurveyByUUID(
    uuid: string,
    tenantId: number,
  ): Promise<DbSurvey | null> {
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

  /**
   * Resolves a survey by UUID or numeric ID, throwing NotFoundException if not found.
   * Consolidates resolution logic to reduce cognitive complexity in calling methods.
   */
  private async resolveSurveyOrThrow(
    surveyIdOrUuid: number | string,
    tenantId: number,
  ): Promise<{ survey: DbSurvey; surveyId: number }> {
    const survey =
      typeof surveyIdOrUuid === 'string' ?
        await this.getSurveyByUUID(surveyIdOrUuid, tenantId)
      : await this.getSurveyByNumericId(surveyIdOrUuid, tenantId);

    if (survey === null) {
      throw new NotFoundException(MSG_SURVEY_NOT_FOUND);
    }

    return { survey, surveyId: survey.id };
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

  private async loadSurveyQuestionsAndAssignments(surveyId: number): Promise<{
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

  private async checkSurveyAccess(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    const hasUnrestrictedAccess = await this.checkUnrestrictedAccess(
      userId,
      tenantId,
      userRole,
    );
    if (hasUnrestrictedAccess) return;

    // Single targeted query using the same visibility clause
    const visibilityClause = this.buildVisibilityClause('$2', '$3');
    const rows = await this.db.query<{ id: number }>(
      `SELECT s.id FROM surveys s
       WHERE s.id = $1 AND s.tenant_id = $2
       AND ${visibilityClause}`,
      [surveyId, tenantId, userId],
    );
    if (rows.length === 0) {
      throw new ForbiddenException("You don't have access to this survey");
    }
  }

  /**
   * Management-level access check: creator OR lead of assigned org unit.
   * Used for admin operations (edit, delete, view in admin panel).
   */
  private async checkSurveyManagementAccess(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    const hasUnrestrictedAccess = await this.checkUnrestrictedAccess(
      userId,
      tenantId,
      userRole,
    );
    if (hasUnrestrictedAccess) return;

    const managementClause = this.buildManagementVisibilityClause('$2', '$3');
    const rows = await this.db.query<{ id: number }>(
      `SELECT s.id FROM surveys s
       WHERE s.id = $1 AND s.tenant_id = $2
       AND ${managementClause}`,
      [surveyId, tenantId, userId],
    );
    if (rows.length === 0) {
      throw new ForbiddenException('No management permission for this survey');
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

  /**
   * Validates that the user has leadership permissions for all requested assignments.
   * Frontend filtering is UX only — this enforces server-side.
   *
   * Rules:
   * - root / has_full_access → skip
   * - all_users → forbidden (only unrestricted users can assign company-wide)
   * - area → user must be area_lead_id
   * - department → user must be department_lead_id OR lead of the parent area
   * - team → team's department must be manageable (dept lead or area lead inheritance)
   */
  private async validateAssignmentPermissions(
    userId: number,
    tenantId: number,
    userRole: string,
    assignments: unknown[],
  ): Promise<void> {
    if (assignments.length === 0) return;

    const hasUnrestrictedAccess = await this.checkUnrestrictedAccess(
      userId,
      tenantId,
      userRole,
    );
    if (hasUnrestrictedAccess) return;

    for (const raw of assignments) {
      await this.validateSingleAssignment(
        raw as AssignmentInput,
        userId,
        tenantId,
      );
    }
  }

  /** Validates a single assignment against the user's leadership permissions */
  private async validateSingleAssignment(
    assignment: AssignmentInput,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    switch (assignment.type) {
      case 'all_users':
        throw new ForbiddenException(
          'Only users with full access can assign to the entire company',
        );
      case 'area':
        await this.validateLeadershipPermission(
          'area',
          assignment.areaId,
          userId,
          tenantId,
        );
        break;
      case 'department':
        await this.validateLeadershipPermission(
          'department',
          assignment.departmentId,
          userId,
          tenantId,
        );
        break;
      case 'team':
        await this.validateLeadershipPermission(
          'team',
          assignment.teamId,
          userId,
          tenantId,
        );
        break;
      default:
        break;
    }
  }

  /** Verifies user is a lead of the given organizational entity via DB lookup */
  private async validateLeadershipPermission(
    entityType: string,
    entityId: number | undefined,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    if (entityId === undefined) return;

    const query = LEADERSHIP_QUERIES[entityType];
    if (query === undefined) return;

    const rows = await this.db.query<{ id: number }>(query, [
      entityId,
      userId,
      tenantId,
    ]);
    if (rows.length === 0) {
      throw new ForbiddenException(
        `No leadership permission for ${entityType} ${entityId}`,
      );
    }
  }

  async createSurvey(
    dto: CreateSurveyDto,
    tenantId: number,
    userId: number,
    userRole: string,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<unknown> {
    this.logger.log(`Creating survey: ${dto.title}`);

    // Validate assignment permissions before creating
    if (dto.assignments !== undefined && dto.assignments.length > 0) {
      await this.validateAssignmentPermissions(
        userId,
        tenantId,
        userRole,
        dto.assignments,
      );
    }

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

    const createdSurvey = await this.getSurveyById(
      surveyId,
      tenantId,
      userId,
      'admin',
    );

    // Emit SSE event for real-time notifications
    eventBus.emitSurveyCreated(tenantId, {
      id: surveyId,
      title: dto.title,
      ...(dto.endDate !== undefined && dto.endDate !== null ?
        { deadline: dto.endDate }
      : {}),
    });

    // Create persistent notification for badge counts (ADR-004)
    void this.notificationsService.createFeatureNotification(
      'survey',
      surveyId,
      `Neue Umfrage: ${dto.title}`,
      dto.endDate !== undefined && dto.endDate !== null ?
        `Eine neue Umfrage ist verfügbar. Deadline: ${dto.endDate}`
      : 'Eine neue Umfrage ist verfügbar.',
      'all',
      null,
      tenantId,
      userId,
    );

    // Log activity
    await this.activityLogger.logCreate(
      tenantId,
      userId,
      'survey',
      surveyId,
      `Umfrage erstellt: ${dto.title}`,
      {
        title: dto.title,
        status: dto.status ?? 'draft',
        isAnonymous: dto.isAnonymous ?? false,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    );

    return createdSurvey;
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
    await this.checkSurveyManagementAccess(id, tenantId, userId, userRole);
    const existingSurvey = (await this.getSurveyById(
      id,
      tenantId,
      userId,
      userRole,
    )) as Record<string, unknown>;
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
      await this.db.query('DELETE FROM survey_questions WHERE survey_id = $1', [
        id,
      ]);
      await this.insertSurveyQuestions(tenantId, id, dto.questions);
    }
    if (dto.assignments !== undefined) {
      // Validate assignment permissions before replacing
      if (dto.assignments.length > 0) {
        await this.validateAssignmentPermissions(
          userId,
          tenantId,
          userRole,
          dto.assignments,
        );
      }
      await this.db.query(
        'DELETE FROM survey_assignments WHERE survey_id = $1',
        [id],
      );
      await this.insertSurveyAssignments(tenantId, id, dto.assignments);
    }

    const updatedSurvey = await this.getSurveyById(
      id,
      tenantId,
      userId,
      userRole,
    );

    // Emit SSE event for real-time notifications
    const deadline =
      dto.endDate ?? (existingSurvey['endDate'] as string | undefined);
    eventBus.emitSurveyUpdated(tenantId, {
      id,
      title: dto.title ?? (existingSurvey['title'] as string),
      ...(deadline !== undefined ? { deadline } : {}),
    });

    // Log activity
    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'survey',
      id,
      `Umfrage aktualisiert: ${existingSurvey['title'] as string}`,
      {
        title: existingSurvey['title'],
        status: existingSurvey['status'],
        isAnonymous: existingSurvey['isAnonymous'],
      },
      {
        title: dto.title ?? existingSurvey['title'],
        status: dto.status ?? existingSurvey['status'],
        isAnonymous: dto.isAnonymous ?? existingSurvey['isAnonymous'],
      },
    );

    return updatedSurvey;
  }

  /** Validates update permissions and state */
  private validateSurveyUpdate(
    userRole: string,
    status: string,
    responseCount: number,
  ): void {
    if (userRole === 'employee') {
      throw new ForbiddenException('Only admins can update surveys');
    }
    if (status === 'active' && responseCount > 0) {
      throw new ConflictException(
        'Cannot update survey with existing responses',
      );
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
    await this.checkSurveyManagementAccess(id, tenantId, userId, userRole);
    const existingSurvey = (await this.getSurveyById(
      id,
      tenantId,
      userId,
      userRole,
    )) as Record<string, unknown>;
    const rawCount = existingSurvey['responseCount'];
    const responseCount = typeof rawCount === 'number' ? rawCount : 0;
    if (responseCount > 0) {
      throw new ConflictException(
        'Cannot delete survey with existing responses',
      );
    }
    await this.db.query(
      'DELETE FROM surveys WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    // Log activity
    await this.activityLogger.logDelete(
      tenantId,
      userId,
      'survey',
      id,
      `Umfrage gelöscht: ${existingSurvey['title'] as string}`,
      {
        title: existingSurvey['title'],
        status: existingSurvey['status'],
        isAnonymous: existingSurvey['isAnonymous'],
      },
    );

    return { message: 'Survey deleted successfully' };
  }

  async getTemplates(tenantId: number): Promise<unknown[]> {
    this.logger.debug(`Getting templates for tenant ${tenantId}`);
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
    userRole: string,
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
    return await this.createSurvey(
      dto,
      tenantId,
      userId,
      userRole,
      ipAddress,
      userAgent,
    );
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
    if (
      qType === 'single_choice' ||
      qType === 'multiple_choice' ||
      qType === 'yes_no'
    ) {
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
    surveyIdOrUuid: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<SurveyStatisticsResponse> {
    this.logger.debug(
      `Getting statistics for survey ${String(surveyIdOrUuid)}`,
    );

    const { survey, surveyId } = await this.resolveSurveyOrThrow(
      surveyIdOrUuid,
      tenantId,
    );

    await this.checkSurveyManagementAccess(
      surveyId,
      tenantId,
      userId,
      userRole,
    );

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

    const response: SurveyStatisticsResponse = {
      surveyId,
      totalResponses,
      completedResponses,
      completionRate:
        totalResponses > 0 ?
          Math.round((completedResponses / totalResponses) * 100)
        : 0,
      questions: await this.buildQuestionStats(survey.questions ?? []),
    };
    if (
      statsRow?.first_response !== null &&
      statsRow?.first_response !== undefined
    ) {
      response.firstResponse = statsRow.first_response;
    }
    if (
      statsRow?.last_response !== null &&
      statsRow?.last_response !== undefined
    ) {
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
    const answerRows = await this.db.query<{
      answer_options: string | number[];
    }>(
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
    const dateRows = await this.db.query<{
      answer_date: Date | string;
      count: number | string;
    }>(
      `SELECT sa.answer_date, COUNT(*) as count FROM survey_answers sa
       WHERE sa.question_id = $1 AND sa.answer_date IS NOT NULL
       GROUP BY sa.answer_date ORDER BY count DESC, sa.answer_date DESC`,
      [questionId],
    );
    return dateRows.map(
      (
        row: { answer_date: Date | string; count: number | string },
        index: number,
      ) => {
        const dateText =
          row.answer_date instanceof Date ?
            row.answer_date.toISOString().split('T')[0]
          : row.answer_date.split('T')[0];
        return {
          optionId: index + 1,
          optionText: dateText ?? '',
          count:
            typeof row.count === 'string' ?
              Number.parseInt(row.count, 10)
            : row.count,
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
    } else if (
      answer.answer_options !== undefined &&
      answer.answer_options.length > 0
    ) {
      await this.db.query(
        `INSERT INTO survey_answers (response_id, question_id, answer_options, tenant_id) VALUES ($1, $2, $3, $4)`,
        [
          responseId,
          questionId,
          JSON.stringify(answer.answer_options),
          tenantId,
        ],
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
      throw new BadRequestException(
        'You have already participated in this survey',
      );
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
    if (survey === undefined)
      throw new NotFoundException('Survey not found or not active');

    await this.checkDuplicateResponse(
      surveyId,
      userId,
      tenantId,
      survey.allow_multiple_responses,
    );

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
      await this.insertSingleAnswer(
        responseId,
        answer.question_id,
        tenantId,
        answer,
      );
    }
    return responseId;
  }

  async getAllResponses(
    surveyId: number,
    tenantId: number,
    userRole: string,
    userId: number,
    options: { page: number; limit: number },
  ): Promise<PaginatedResponsesResult> {
    this.logger.debug(`Getting all responses for survey ${surveyId}`);
    await this.checkSurveyManagementAccess(
      surveyId,
      tenantId,
      userId,
      userRole,
    );
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
    const userJoin =
      isAnonymous ? '' : 'LEFT JOIN users u ON sr.user_id = u.id';
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

    const optionTextMap = await this.buildOptionTextMap(answerRows);

    const baseResponse = dbToApi(
      dbResponse as unknown as Record<string, unknown>,
    ) as unknown as SurveyResponse;
    if (typeof dbResponse.started_at !== 'string') {
      baseResponse.startedAt = dbResponse.started_at.toISOString();
    }
    if (
      dbResponse.completed_at !== null &&
      typeof dbResponse.completed_at !== 'string'
    ) {
      baseResponse.completedAt = dbResponse.completed_at.toISOString();
    }
    return {
      ...baseResponse,
      answers: answerRows.map((a: DbSurveyAnswer) =>
        this.transformSingleAnswer(a, optionTextMap),
      ),
    };
  }

  /** Parses answer_options from JSON string or returns the array as-is */
  private parseOptionIds(answerOptions: string | number[]): number[] {
    return typeof answerOptions === 'string' ?
        (JSON.parse(answerOptions) as number[])
      : answerOptions;
  }

  /** Batch-collects choice option IDs from answers and resolves them to display text via DB */
  private async buildOptionTextMap(
    answerRows: DbSurveyAnswer[],
  ): Promise<Map<number, string>> {
    const allOptionIds: number[] = [];
    for (const a of answerRows) {
      if (
        (a.question_type === 'single_choice' ||
          a.question_type === 'multiple_choice') &&
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
    const transformed = dbToApi(
      answer as unknown as Record<string, unknown>,
    ) as SurveyAnswer;
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
      return ids.map((id: number) =>
        id === 1 ? 'Ja' : 'Nein',
      ) as unknown as number[];
    }
    return ids.map(
      (id: number) => optionTextMap.get(id) ?? String(id),
    ) as unknown as number[];
  }

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
    if (
      userRole !== 'root' &&
      userRole !== 'admin' &&
      dbResponse.user_id !== userId
    ) {
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
    await this.db.query(
      `DELETE FROM survey_answers WHERE response_id = $1 AND tenant_id = $2`,
      [responseId, tenantId],
    );
    const normalizedAnswers = normalizeAnswers(answers);
    for (const answer of normalizedAnswers) {
      if (answer.question_id === undefined) continue;
      await this.insertSingleAnswer(
        responseId,
        answer.question_id,
        tenantId,
        answer,
      );
    }
    await this.db.query(
      `UPDATE survey_responses SET completed_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [responseId, tenantId],
    );

    // Log activity to root_logs
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

  async exportResponses(
    surveyId: number,
    tenantId: number,
    userRole: string,
    userId: number,
    format: 'csv' | 'excel',
  ): Promise<Buffer> {
    this.logger.log(`Exporting responses for survey ${surveyId} as ${format}`);
    await this.checkSurveyManagementAccess(
      surveyId,
      tenantId,
      userId,
      userRole,
    );
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
        const fullName =
          `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
        const userName = fullName !== '' ? fullName : (row.username ?? '');
        const completed =
          row.completed_at !== null ? String(row.completed_at) : '';
        return [
          String(row.response_id),
          userName,
          completed,
          row.question_text,
          String(
            row.answer_text ??
              row.answer_number ??
              row.answer_date ??
              row.answer_options ??
              '',
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
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(id)) {
      return id;
    }
    const numericId = Number.parseInt(id, 10);
    if (Number.isNaN(numericId) || numericId <= 0) {
      throw new BadRequestException(
        'ID must be a positive integer or valid UUID',
      );
    }
    return numericId;
  }

  /**
   * Resolves a UUID or numeric ID to a numeric survey ID.
   * If UUID is provided, looks up the survey and returns its numeric ID.
   */
  async resolveToNumericId(
    idOrUuid: number | string,
    tenantId: number,
  ): Promise<number> {
    if (typeof idOrUuid === 'number') {
      return idOrUuid;
    }
    // UUID provided - fetch survey to get numeric ID
    const survey = await this.getSurveyByUUID(idOrUuid, tenantId);
    if (survey === null) {
      throw new NotFoundException(MSG_SURVEY_NOT_FOUND);
    }
    return survey.id;
  }

  // ==========================================================================
  // NOTIFICATION COUNT METHODS
  // ==========================================================================

  /**
   * Get count of pending (unanswered) surveys for a user.
   * Used for notification badge in sidebar.
   * Counts active surveys assigned to the user where no completed response exists.
   */
  async getPendingSurveyCount(
    userId: number,
    tenantId: number,
  ): Promise<{ count: number }> {
    this.logger.debug(
      `Getting pending survey count for user ${userId}, tenant ${tenantId}`,
    );

    // Uses the same EXISTS-based visibility clause as listSurveys
    // $1 = tenantId, $2 = userId
    const visibilityClause = this.buildVisibilityClause('$1', '$2');
    const rows = await this.db.query<{ count: number }>(
      `SELECT COUNT(DISTINCT s.id)::integer as count
       FROM surveys s
       LEFT JOIN survey_responses sr
         ON s.id = sr.survey_id AND sr.user_id = $2 AND sr.tenant_id = s.tenant_id AND sr.status = 'completed'
       WHERE s.tenant_id = $1
         AND s.status = 'active'
         AND sr.id IS NULL
         AND ${visibilityClause}`,
      [tenantId, userId],
    );

    return { count: rows[0]?.count ?? 0 };
  }
}
