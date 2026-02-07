/**
 * Surveys Controller
 *
 * HTTP endpoints for survey management:
 * - GET    /surveys                    - List surveys
 * - GET    /surveys/templates          - Get survey templates
 * - POST   /surveys/templates/:templateId - Create from template
 * - GET    /surveys/:id                - Get survey by ID
 * - POST   /surveys                    - Create survey
 * - PUT    /surveys/:id                - Update survey
 * - DELETE /surveys/:id                - Delete survey
 * - GET    /surveys/:id/statistics     - Get survey statistics
 * - POST   /surveys/:id/responses      - Submit response
 * - GET    /surveys/:id/responses      - Get all responses
 * - GET    /surveys/:id/my-response    - Get user's own response
 * - GET    /surveys/:id/export         - Export responses
 * - GET    /surveys/:id/responses/:responseId - Get response by ID
 * - PUT    /surveys/:id/responses/:responseId - Update response
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import {
  CreateSurveyDto,
  ExportResponsesQueryDto,
  GetAllResponsesQueryDto,
  ListSurveysQueryDto,
  SubmitResponseDto,
  UpdateResponseDto,
  UpdateSurveyDto,
} from './dto/index.js';
import { SurveysService } from './surveys.service.js';
import type {
  PaginatedResponsesResult,
  SurveyResponse,
  SurveyStatisticsResponse,
} from './surveys.types.js';

/**
 * Response type for message-only responses
 */
interface MessageResponse {
  message: string;
}

/** Permission constants for RequirePermission decorator */
const SURVEY_FEATURE = 'surveys';
const SURVEY_MANAGE = 'surveys-manage';
const SURVEY_PARTICIPATE = 'surveys-participate';
const SURVEY_RESULTS = 'surveys-results';

@Controller('surveys')
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  /**
   * GET /surveys
   * List surveys based on user role
   */
  @Get()
  @RequirePermission(SURVEY_FEATURE, SURVEY_MANAGE, 'canRead')
  async listSurveys(
    @Query() query: ListSurveysQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<unknown[]> {
    return await this.surveysService.listSurveys(tenantId, user.id, user.role, {
      status: query.status,
      page: query.page,
      limit: query.limit,
      manage: query.manage,
    });
  }

  /**
   * GET /surveys/templates
   * Get available survey templates
   */
  @Get('templates')
  @RequirePermission(SURVEY_FEATURE, SURVEY_MANAGE, 'canRead')
  async getTemplates(@TenantId() tenantId: number): Promise<unknown[]> {
    return await this.surveysService.getTemplates(tenantId);
  }

  /**
   * POST /surveys/templates/:templateId
   * Create survey from template
   */
  @Post('templates/:templateId')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(SURVEY_FEATURE, SURVEY_MANAGE, 'canWrite')
  async createFromTemplate(
    @Param('templateId') templateId: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<unknown> {
    const numericTemplateId = Number.parseInt(templateId, 10);
    return await this.surveysService.createFromTemplate(
      numericTemplateId,
      tenantId,
      user.id,
      user.role,
      ipAddress,
      userAgent,
    );
  }

  /**
   * GET /surveys/:id
   * Get survey by ID (numeric or UUID).
   * Pass ?manage=true from admin panel to enforce management-level access.
   */
  @Get(':id')
  @RequirePermission(SURVEY_FEATURE, SURVEY_PARTICIPATE, 'canRead')
  async getSurveyById(
    @Param('id') id: string,
    @Query('manage') manage: string | undefined,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<unknown> {
    const surveyId = this.surveysService.parseIdParam(id);
    const isManageMode = manage === 'true';
    return await this.surveysService.getSurveyById(
      surveyId,
      tenantId,
      user.id,
      user.role,
      isManageMode,
    );
  }

  /**
   * POST /surveys
   * Create a new survey
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(SURVEY_FEATURE, SURVEY_MANAGE, 'canWrite')
  async createSurvey(
    @Body() dto: CreateSurveyDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<unknown> {
    return await this.surveysService.createSurvey(
      dto,
      tenantId,
      user.id,
      user.role,
      ipAddress,
      userAgent,
    );
  }

  /**
   * PUT /surveys/:id
   * Update a survey (supports both numeric ID and UUID)
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(SURVEY_FEATURE, SURVEY_MANAGE, 'canWrite')
  async updateSurvey(
    @Param('id') id: string,
    @Body() dto: UpdateSurveyDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<unknown> {
    const parsedId = this.surveysService.parseIdParam(id);
    const surveyId = await this.surveysService.resolveToNumericId(
      parsedId,
      tenantId,
    );
    return await this.surveysService.updateSurvey(
      surveyId,
      dto,
      tenantId,
      user.id,
      user.role,
      ipAddress,
      userAgent,
    );
  }

  /**
   * DELETE /surveys/:id
   * Delete a survey (supports both numeric ID and UUID)
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(SURVEY_FEATURE, SURVEY_MANAGE, 'canDelete')
  async deleteSurvey(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<MessageResponse> {
    const parsedId = this.surveysService.parseIdParam(id);
    const surveyId = await this.surveysService.resolveToNumericId(
      parsedId,
      tenantId,
    );
    return await this.surveysService.deleteSurvey(
      surveyId,
      tenantId,
      user.id,
      user.role,
      ipAddress,
      userAgent,
    );
  }

  /**
   * GET /surveys/:id/statistics
   * Get survey statistics (supports both numeric ID and UUID)
   */
  @Get(':id/statistics')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(SURVEY_FEATURE, SURVEY_RESULTS, 'canRead')
  async getStatistics(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<SurveyStatisticsResponse> {
    const surveyId = this.surveysService.parseIdParam(id);
    return await this.surveysService.getStatistics(
      surveyId,
      tenantId,
      user.id,
      user.role,
    );
  }

  /**
   * POST /surveys/:id/responses
   * Submit a response to a survey (supports both numeric ID and UUID)
   */
  @Post(':id/responses')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(SURVEY_FEATURE, SURVEY_PARTICIPATE, 'canWrite')
  async submitResponse(
    @Param('id') id: string,
    @Body() dto: SubmitResponseDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ responseId: number }> {
    const parsedId = this.surveysService.parseIdParam(id);
    const surveyId = await this.surveysService.resolveToNumericId(
      parsedId,
      tenantId,
    );
    const responseId = await this.surveysService.submitResponse(
      surveyId,
      user.id,
      tenantId,
      dto.answers,
    );
    return { responseId };
  }

  /**
   * GET /surveys/:id/responses
   * Get all responses for a survey (admin only, supports both numeric ID and UUID)
   */
  @Get(':id/responses')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(SURVEY_FEATURE, SURVEY_RESULTS, 'canRead')
  async getAllResponses(
    @Param('id') id: string,
    @Query() query: GetAllResponsesQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<PaginatedResponsesResult> {
    const parsedId = this.surveysService.parseIdParam(id);
    const surveyId = await this.surveysService.resolveToNumericId(
      parsedId,
      tenantId,
    );
    return await this.surveysService.getAllResponses(
      surveyId,
      tenantId,
      user.role,
      user.id,
      {
        page: query.page,
        limit: query.limit,
      },
    );
  }

  /**
   * GET /surveys/:id/my-response
   * Get user's own response to a survey (supports both numeric ID and UUID)
   */
  @Get(':id/my-response')
  @RequirePermission(SURVEY_FEATURE, SURVEY_PARTICIPATE, 'canRead')
  async getMyResponse(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<SurveyResponse | null> {
    const parsedId = this.surveysService.parseIdParam(id);
    const surveyId = await this.surveysService.resolveToNumericId(
      parsedId,
      tenantId,
    );
    return await this.surveysService.getMyResponse(surveyId, user.id, tenantId);
  }

  /**
   * GET /surveys/:id/export
   * Export survey responses (supports both numeric ID and UUID)
   */
  @Get(':id/export')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(SURVEY_FEATURE, SURVEY_RESULTS, 'canRead')
  async exportResponses(
    @Param('id') id: string,
    @Query() query: ExportResponsesQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const parsedId = this.surveysService.parseIdParam(id);
    const surveyId = await this.surveysService.resolveToNumericId(
      parsedId,
      tenantId,
    );

    const format = query.format ?? 'csv';
    const buffer = await this.surveysService.exportResponses(
      surveyId,
      tenantId,
      user.role,
      user.id,
      format,
    );

    const mimeType =
      format === 'csv' ? 'text/csv' : (
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    const extension = format === 'csv' ? 'csv' : 'xlsx';

    await reply
      .header('Content-Type', mimeType)
      .header(
        'Content-Disposition',
        `attachment; filename="survey-${surveyId}-responses.${extension}"`,
      )
      .send(buffer);
  }

  /**
   * GET /surveys/:id/responses/:responseId
   * Get a specific response by ID (supports both numeric ID and UUID)
   */
  @Get(':id/responses/:responseId')
  @RequirePermission(SURVEY_FEATURE, SURVEY_RESULTS, 'canRead')
  async getResponseById(
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<SurveyResponse> {
    const parsedId = this.surveysService.parseIdParam(id);
    const surveyId = await this.surveysService.resolveToNumericId(
      parsedId,
      tenantId,
    );
    const numericResponseId = Number.parseInt(responseId, 10);
    return await this.surveysService.getResponseById(
      surveyId,
      numericResponseId,
      tenantId,
      user.role,
      user.id,
    );
  }

  /**
   * PUT /surveys/:id/responses/:responseId
   * Update a response (if allowed, supports both numeric ID and UUID)
   */
  @Put(':id/responses/:responseId')
  @RequirePermission(SURVEY_FEATURE, SURVEY_PARTICIPATE, 'canWrite')
  async updateResponse(
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @Body() dto: UpdateResponseDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    const parsedId = this.surveysService.parseIdParam(id);
    const surveyId = await this.surveysService.resolveToNumericId(
      parsedId,
      tenantId,
    );
    const numericResponseId = Number.parseInt(responseId, 10);
    return await this.surveysService.updateResponse(
      surveyId,
      numericResponseId,
      user.id,
      tenantId,
      dto.answers,
    );
  }
}
