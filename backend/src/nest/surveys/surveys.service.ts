/**
 * Surveys Service (Facade)
 *
 * Orchestrates survey operations by delegating to sub-services.
 * The controller calls only this service.
 *
 * Sub-services:
 * - SurveyAccessService     — visibility, access control, assignment validation
 * - SurveyQuestionsService  — question/option/assignment CRUD
 * - SurveyResponsesService  — response submission, retrieval, export
 * - SurveyStatisticsService — analytics computation
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

import { eventBus } from '../../utils/event-bus.js';
import { dbToApi } from '../../utils/field-mapper.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateSurveyDto } from './dto/create-survey.dto.js';
import type { UpdateSurveyDto } from './dto/update-survey.dto.js';
import { SurveyAccessService } from './survey-access.service.js';
import { SurveyQuestionsService } from './survey-questions.service.js';
import { SurveyResponsesService } from './survey-responses.service.js';
import { SurveyStatisticsService } from './survey-statistics.service.js';
import { transformSurveyToApi, transformSurveyWithMetadata } from './surveys.helpers.js';
import type {
  DbSurvey,
  DbSurveyTemplate,
  PaginatedResponsesResult,
  QuestionInput,
  SurveyAnswer,
  SurveyResponse,
  SurveyStatisticsResponse,
} from './surveys.types.js';

const MSG_SURVEY_NOT_FOUND = 'Survey not found';

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly accessService: SurveyAccessService,
    private readonly questionsService: SurveyQuestionsService,
    private readonly responsesService: SurveyResponsesService,
    private readonly statisticsService: SurveyStatisticsService,
  ) {}

  /** Lists surveys with visibility filtering and canManage flags */
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

    const hasUnrestrictedAccess = await this.accessService.checkUnrestrictedAccess(
      userId,
      tenantId,
      userRole,
    );

    const surveys = await this.accessService.fetchSurveysByAccessLevel(
      tenantId,
      userId,
      query.status,
      limit,
      offset,
      hasUnrestrictedAccess,
      query.manage === true,
    );
    await this.accessService.attachAssignmentsToSurveys(surveys, tenantId);

    const surveyIds = surveys.map((s: DbSurvey) => s.id);
    const manageableIds =
      hasUnrestrictedAccess || query.manage === true ?
        new Set(surveyIds)
      : await this.accessService.getManageableSurveyIds(surveyIds, tenantId, userId);

    return surveys.map((s: DbSurvey) => ({
      ...transformSurveyWithMetadata(s),
      canManage: manageableIds.has(s.id),
    }));
  }

  /** Gets a single survey by numeric ID or UUID */
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
      await this.accessService.checkSurveyManagementAccess(survey.id, tenantId, userId, userRole);
    } else {
      await this.accessService.checkSurveyAccess(survey.id, tenantId, userId, userRole);
    }
    return transformSurveyToApi(survey as unknown as Record<string, unknown>);
  }

  /** Creates a new survey with questions and assignments */
  async createSurvey(
    dto: CreateSurveyDto,
    tenantId: number,
    userId: number,
    userRole: string,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<unknown> {
    this.logger.log(`Creating survey: ${dto.title}`);

    if (dto.assignments !== undefined && dto.assignments.length > 0) {
      await this.accessService.validateAssignmentPermissions(
        userId,
        tenantId,
        userRole,
        dto.assignments,
      );
    }

    const surveyId = await this.insertSurveyRecord(dto, tenantId, userId);

    if (dto.questions !== undefined && dto.questions.length > 0) {
      await this.questionsService.insertSurveyQuestions(tenantId, surveyId, dto.questions);
    }
    if (dto.assignments !== undefined && dto.assignments.length > 0) {
      await this.questionsService.insertSurveyAssignments(tenantId, surveyId, dto.assignments);
    }

    const createdSurvey = await this.getSurveyById(surveyId, tenantId, userId, 'admin');

    await this.emitSurveyCreatedNotifications(dto, surveyId, tenantId, userId);

    return createdSurvey;
  }

  /** Updates an existing survey */
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
    await this.accessService.checkSurveyManagementAccess(id, tenantId, userId, userRole);

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

    await this.updateSurveyRecord(id, dto, tenantId);
    await this.updateSurveyRelations(id, dto, tenantId, userId, userRole);

    const updatedSurvey = await this.getSurveyById(id, tenantId, userId, userRole);
    await this.emitSurveyUpdatedNotifications(id, dto, existingSurvey, tenantId, userId);

    return updatedSurvey;
  }

  /** Deletes a survey (only if no responses exist) */
  async deleteSurvey(
    id: number,
    tenantId: number,
    userId: number,
    userRole: string,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting survey ${id}`);
    await this.accessService.checkSurveyManagementAccess(id, tenantId, userId, userRole);
    const existingSurvey = (await this.getSurveyById(id, tenantId, userId, userRole)) as Record<
      string,
      unknown
    >;
    const rawCount = existingSurvey['responseCount'];
    const responseCount = typeof rawCount === 'number' ? rawCount : 0;
    if (responseCount > 0) {
      throw new ConflictException('Cannot delete survey with existing responses');
    }
    await this.db.tenantQuery('DELETE FROM surveys WHERE id = $1 AND tenant_id = $2', [
      id,
      tenantId,
    ]);

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

  /** Gets available survey templates */
  async getTemplates(tenantId: number): Promise<unknown[]> {
    this.logger.debug(`Getting templates for tenant ${tenantId}`);
    const templateRows = await this.db.tenantQuery<DbSurveyTemplate>(
      `SELECT * FROM survey_templates WHERE tenant_id = $1 OR is_public = true ORDER BY name`,
      [tenantId],
    );
    return templateRows.map((t: DbSurveyTemplate) =>
      dbToApi(t as unknown as Record<string, unknown>),
    );
  }

  /** Creates a survey from a template */
  async createFromTemplate(
    templateId: number,
    tenantId: number,
    userId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<unknown> {
    this.logger.log(`Creating survey from template ${templateId}`);
    const templateRows = await this.db.tenantQuery<DbSurveyTemplate>(
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
    return await this.createSurvey(dto, tenantId, userId, userRole, ipAddress, userAgent);
  }

  /** Gets survey statistics (facade: resolve + access check + delegate) */
  async getStatistics(
    surveyIdOrUuid: number | string,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<SurveyStatisticsResponse> {
    this.logger.debug(`Getting statistics for survey ${String(surveyIdOrUuid)}`);

    const { survey, surveyId } = await this.resolveSurveyOrThrow(surveyIdOrUuid, tenantId);

    await this.accessService.checkSurveyManagementAccess(surveyId, tenantId, userId, userRole);

    return await this.statisticsService.computeStatistics(
      surveyId,
      tenantId,
      survey.questions ?? [],
    );
  }

  /** Submits a response to a survey */
  async submitResponse(
    surveyId: number,
    userId: number,
    tenantId: number,
    answers: SurveyAnswer[],
  ): Promise<number> {
    return await this.responsesService.submitResponse(surveyId, userId, tenantId, answers);
  }

  /** Gets all responses for a survey (admin only) */
  async getAllResponses(
    surveyId: number,
    tenantId: number,
    userRole: string,
    userId: number,
    options: { page: number; limit: number },
  ): Promise<PaginatedResponsesResult> {
    await this.accessService.checkSurveyManagementAccess(surveyId, tenantId, userId, userRole);
    return await this.responsesService.getAllResponses(surveyId, tenantId, options);
  }

  /** Gets user's own response to a survey */
  async getMyResponse(
    surveyId: number,
    userId: number,
    tenantId: number,
  ): Promise<SurveyResponse | null> {
    return await this.responsesService.getMyResponse(surveyId, userId, tenantId);
  }

  /** Gets a specific response by ID */
  async getResponseById(
    surveyId: number,
    responseId: number,
    tenantId: number,
    userRole: string,
    userId: number,
  ): Promise<SurveyResponse> {
    return await this.responsesService.getResponseById(
      surveyId,
      responseId,
      tenantId,
      userRole,
      userId,
    );
  }

  /** Updates a response */
  async updateResponse(
    surveyId: number,
    responseId: number,
    userId: number,
    tenantId: number,
    answers: SurveyAnswer[],
  ): Promise<{ message: string }> {
    return await this.responsesService.updateResponse(
      surveyId,
      responseId,
      userId,
      tenantId,
      answers,
    );
  }

  /** Exports survey responses */
  async exportResponses(
    surveyId: number,
    tenantId: number,
    userRole: string,
    userId: number,
    format: 'csv' | 'excel',
  ): Promise<Buffer> {
    await this.accessService.checkSurveyManagementAccess(surveyId, tenantId, userId, userRole);
    return await this.responsesService.exportResponses(surveyId, tenantId, format);
  }

  /** Gets count of pending surveys for notification badge */
  async getPendingSurveyCount(userId: number, tenantId: number): Promise<{ count: number }> {
    return await this.accessService.getPendingSurveyCount(userId, tenantId);
  }

  /** Parses a string ID param as numeric or UUID */
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

  /** Resolves a UUID or numeric ID to a numeric survey ID */
  async resolveToNumericId(idOrUuid: number | string, tenantId: number): Promise<number> {
    if (typeof idOrUuid === 'number') {
      return idOrUuid;
    }
    const survey = await this.getSurveyByUUID(idOrUuid, tenantId);
    if (survey === null) {
      throw new NotFoundException(MSG_SURVEY_NOT_FOUND);
    }
    return survey.id;
  }

  /** Loads a survey by numeric ID with questions and assignments */
  private async getSurveyByNumericId(surveyId: number, tenantId: number): Promise<DbSurvey | null> {
    const surveyRows = await this.db.tenantQuery<DbSurvey>(
      `SELECT s.*, u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM surveys s LEFT JOIN users u ON s.created_by = u.id WHERE s.id = $1 AND s.tenant_id = $2`,
      [surveyId, tenantId],
    );
    if (surveyRows.length === 0) return null;
    const survey = surveyRows[0];
    if (survey === undefined) return null;
    const loaded = await this.questionsService.loadSurveyQuestionsAndAssignments(survey.id);
    survey.questions = loaded.questions;
    survey.assignments = loaded.assignments;
    return survey;
  }

  /** Loads a survey by UUID with questions and assignments */
  private async getSurveyByUUID(uuid: string, tenantId: number): Promise<DbSurvey | null> {
    const surveyRows = await this.db.tenantQuery<DbSurvey>(
      `SELECT s.*, u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM surveys s LEFT JOIN users u ON s.created_by = u.id WHERE s.uuid = $1 AND s.tenant_id = $2`,
      [uuid, tenantId],
    );
    if (surveyRows.length === 0) return null;
    const survey = surveyRows[0];
    if (survey === undefined) return null;
    const loaded = await this.questionsService.loadSurveyQuestionsAndAssignments(survey.id);
    survey.questions = loaded.questions;
    survey.assignments = loaded.assignments;
    return survey;
  }

  /**
   * Resolves a survey by UUID or numeric ID, throwing NotFoundException if not found.
   * Returns both the survey object and its numeric ID.
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

  /** Inserts the survey record and returns the new survey ID */
  private async insertSurveyRecord(
    dto: CreateSurveyDto,
    tenantId: number,
    userId: number,
  ): Promise<number> {
    const surveyUuid = uuidv7();
    const surveyRows = await this.db.tenantQuery<{ id: number }>(
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
    return surveyRows[0]?.id ?? 0;
  }

  /** Updates the survey record fields */
  private async updateSurveyRecord(
    id: number,
    dto: UpdateSurveyDto,
    tenantId: number,
  ): Promise<void> {
    await this.db.tenantQuery(
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
  }

  /** Updates survey questions and assignments if provided */
  private async updateSurveyRelations(
    id: number,
    dto: UpdateSurveyDto,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    if (dto.questions !== undefined) {
      await this.db.tenantQuery(
        'DELETE FROM survey_questions WHERE survey_id = $1 AND tenant_id = $2',
        [id, tenantId],
      );
      await this.questionsService.insertSurveyQuestions(tenantId, id, dto.questions);
    }
    if (dto.assignments !== undefined) {
      if (dto.assignments.length > 0) {
        await this.accessService.validateAssignmentPermissions(
          userId,
          tenantId,
          userRole,
          dto.assignments,
        );
      }
      await this.db.tenantQuery(
        'DELETE FROM survey_assignments WHERE survey_id = $1 AND tenant_id = $2',
        [id, tenantId],
      );
      await this.questionsService.insertSurveyAssignments(tenantId, id, dto.assignments);
    }
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

  /** Emits SSE event, creates notification, and logs activity for survey creation */
  private async emitSurveyCreatedNotifications(
    dto: CreateSurveyDto,
    surveyId: number,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    eventBus.emitSurveyCreated(tenantId, {
      id: surveyId,
      title: dto.title,
      ...(dto.endDate !== undefined && dto.endDate !== null ? { deadline: dto.endDate } : {}),
    });

    void this.notificationsService.createAddonNotification(
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
  }

  /** Emits SSE event and logs activity for survey update */
  private async emitSurveyUpdatedNotifications(
    id: number,
    dto: UpdateSurveyDto,
    existingSurvey: Record<string, unknown>,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    const deadline = dto.endDate ?? (existingSurvey['endDate'] as string | undefined);
    eventBus.emitSurveyUpdated(tenantId, {
      id,
      title: dto.title ?? (existingSurvey['title'] as string),
      ...(deadline !== undefined ? { deadline } : {}),
    });

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
  }
}
