/**
 * surveys API v2 Service Layer
 * Business logic for survey management
 */
import rootLog from '../../../models/rootLog';
import survey, { SurveyStatistics } from '../../../models/survey.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { eventBus } from '../../../utils/eventBus.js';
import { dbToApi } from '../../../utils/fieldMapping.js';

export interface SurveyFilters {
  status?: 'draft' | 'active' | 'closed';
  page?: number;
  limit?: number;
}

export interface QuestionCreateData {
  questionText: string;
  questionType: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'number';
  isRequired?: boolean;
  orderPosition?: number;
  options?: string[];
}

export interface AssignmentCreateData {
  type: 'all_users' | 'department' | 'team' | 'user';
  departmentId?: number | null;
  teamId?: number | null;
  userId?: number | null;
}

interface SurveyStatisticsResponse {
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
    options?: {
      optionId: number;
      optionText: string;
      count: number;
    }[];
    statistics?: {
      average: number | null;
      min: number | null;
      max: number | null;
      totalResponses: number;
    };
  }[];
}

export interface SurveyCreateData {
  title: string;
  description?: string;
  status?: 'draft' | 'active' | 'closed';
  isAnonymous?: boolean;
  isMandatory?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  questions?: QuestionCreateData[];
  assignments?: AssignmentCreateData[];
}

export interface SurveyUpdateData {
  title?: string;
  description?: string;
  status?: 'draft' | 'active' | 'closed';
  isAnonymous?: boolean;
  isMandatory?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  questions?: QuestionCreateData[];
  assignments?: AssignmentCreateData[];
}

export interface ResponseSubmitData {
  surveyId: number;
  answers: {
    questionId: number;
    answerText?: string;
    answerNumber?: number;
    selectedOptions?: number[];
  }[];
}

/**
 *
 */
export class SurveysService {
  /**
   * List surveys based on user role
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   * @param filters - The filter criteria
   */
  async listSurveys(
    tenantId: number,
    userId: number,
    userRole: string,
    filters: SurveyFilters = {},
  ): Promise<unknown[]> {
    try {
      let surveys;

      if (userRole === 'root') {
        // Root can see all surveys
        surveys = await survey.getAllByTenant(tenantId, filters);
      } else if (userRole === 'admin') {
        // Admin sees surveys based on department permissions
        surveys = await survey.getAllByTenantForAdmin(tenantId, userId, filters);
      } else {
        // Employee sees assigned surveys
        surveys = await survey.getAllByTenantForEmployee(tenantId, userId, filters);
      }

      // Transform to API format
      return surveys.map((survey) => {
        const apisurvey = dbToApi(survey);
        return {
          ...apisurvey,
          responseCount: survey.response_count ?? 0,
          completedCount: survey.completed_count ?? 0,
          creatorFirstName: survey.creator_first_name,
          creatorLastName: survey.creator_last_name,
        };
      });
    } catch (error: unknown) {
      console.error('Error listing surveys:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to list surveys');
    }
  }

  /**
   * Check survey access for user
   */
  private async checkSurveyAccess(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    if (userRole === 'employee') {
      const surveys = await survey.getAllByTenantForEmployee(tenantId, userId, {});
      const hasAccess = surveys.some((s) => s.id === surveyId);
      if (!hasAccess) {
        throw new ServiceError('FORBIDDEN', "You don't have access to this survey");
      }
      return;
    }

    if (userRole === 'admin') {
      const surveys = await survey.getAllByTenantForAdmin(tenantId, userId, {});
      const hasAccess = surveys.some((s) => s.id === surveyId);
      if (!hasAccess) {
        throw new ServiceError('FORBIDDEN', "You don't have access to this survey");
      }
    }
  }

  /**
   * Transform survey data to API format
   */
  private transformSurveyToApi(surveyData: Record<string, unknown>): unknown {
    const apisurvey = dbToApi(surveyData);

    if (surveyData.questions) {
      apisurvey.questions = (surveyData.questions as Record<string, unknown>[]).map((q) => ({
        ...dbToApi(q),
        orderPosition: q.order_position ?? q.order_index,
      }));
    }

    if (surveyData.assignments) {
      apisurvey.assignments = (surveyData.assignments as Record<string, unknown>[]).map((a) =>
        dbToApi(a),
      );
    }

    return apisurvey;
  }

  /**
   * Get survey by ID
   * @param surveyId - The surveyId parameter
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async getSurveyById(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<unknown> {
    try {
      const surveyData = await survey.getById(surveyId, tenantId);

      if (!surveyData) {
        throw new ServiceError('NOT_FOUND', 'survey not found');
      }

      await this.checkSurveyAccess(surveyId, tenantId, userId, userRole);

      return this.transformSurveyToApi(surveyData);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      console.error('Error getting survey:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to get survey');
    }
  }

  /**
   * Create a new survey
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param ipAddress - The ipAddress parameter
   * @param userAgent - The userAgent parameter
   */
  async createSurvey(
    data: SurveyCreateData,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<unknown> {
    try {
      // Transform API data to DB format
      const surveyData = {
        title: data.title,
        description: data.description,
        status: data.status ?? 'draft',
        is_anonymous: data.isAnonymous ?? false,
        is_mandatory: data.isMandatory ?? false,
        start_date: data.startDate,
        end_date: data.endDate,
        questions: data.questions?.map((q, index) => ({
          question_text: q.questionText,
          question_type: q.questionType,
          is_required: q.isRequired ?? true,
          order_position: q.orderPosition ?? index + 1,
          options: q.options,
        })),
        assignments: data.assignments?.map((a) => ({
          type: a.type,
          department_id: a.departmentId,
          team_id: a.teamId,
          user_id: a.userId,
        })),
      };

      const surveyId = await survey.create(surveyData, tenantId, userId);

      // Log the action
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'create_survey',
        entity_type: 'survey',
        entity_id: surveyId,
        new_values: { title: data.title, status: data.status ?? 'draft' },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      // Emit event for SSE notifications
      eventBus.emitSurveyCreated(tenantId, {
        id: surveyId,
        title: data.title,
        deadline: data.endDate ?? undefined,
        created_at: new Date().toISOString(),
      });

      // Return the created survey
      return await this.getSurveyById(surveyId, tenantId, userId, 'admin');
    } catch (error: unknown) {
      console.error('Error creating survey:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to create survey');
    }
  }

  /**
   * Update a survey
   * @param surveyId - The surveyId parameter
   * @param data - The data object
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   * @param ipAddress - The ipAddress parameter
   * @param userAgent - The userAgent parameter
   */
  async updateSurvey(
    surveyId: number,
    data: SurveyUpdateData,
    tenantId: number,
    userId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<unknown> {
    try {
      // Check if survey exists and user has access
      const existingsurvey = await this.getSurveyById(surveyId, tenantId, userId, userRole);

      // Type assertions for existingsurvey properties
      const surveyData = existingsurvey as Record<string, unknown>;
      const existingTitle = surveyData.title as string;
      const existingStatus = surveyData.status as string;
      const responseCount = (surveyData.responseCount as number | undefined) ?? 0;

      if (userRole === 'employee') {
        throw new ServiceError('FORBIDDEN', 'Only admins can update surveys');
      }

      // Don't allow updating active surveys with responses
      if (existingStatus === 'active' && responseCount > 0) {
        throw new ServiceError('CONFLICT', 'Cannot update survey with existing responses');
      }

      // Transform API data to DB format
      const updateData = {
        title: data.title,
        description: data.description,
        status: data.status,
        is_anonymous: data.isAnonymous,
        is_mandatory: data.isMandatory,
        start_date: data.startDate,
        end_date: data.endDate,
        questions: data.questions?.map((q, index) => ({
          question_text: q.questionText,
          question_type: q.questionType,
          is_required: q.isRequired ?? true,
          order_position: q.orderPosition ?? index + 1,
          options: q.options,
        })),
        assignments: data.assignments?.map((a) => ({
          type: a.type,
          department_id: a.departmentId,
          team_id: a.teamId,
          user_id: a.userId,
        })),
      };

      await survey.update(surveyId, updateData, tenantId);

      // Log the action
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'update_survey',
        entity_type: 'survey',
        entity_id: surveyId,
        old_values: {
          title: existingTitle,
          status: existingStatus,
        },
        new_values: {
          title: data.title ?? existingTitle,
          status: data.status ?? existingStatus,
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      // Return the updated survey
      return await this.getSurveyById(surveyId, tenantId, userId, userRole);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      console.error('Error updating survey:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to update survey');
    }
  }

  /**
   * Delete a survey
   * @param surveyId - The surveyId parameter
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   * @param ipAddress - The ipAddress parameter
   * @param userAgent - The userAgent parameter
   */
  async deleteSurvey(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    try {
      // Check if survey exists and user has access
      const existingsurvey = await this.getSurveyById(surveyId, tenantId, userId, userRole);

      // Type assertions for existingsurvey properties
      const surveyData = existingsurvey as Record<string, unknown>;
      const existingTitle = surveyData.title as string;
      const existingStatus = surveyData.status as string;
      const responseCount = (surveyData.responseCount as number | undefined) ?? 0;

      if (userRole === 'employee') {
        throw new ServiceError('FORBIDDEN', 'Only admins can delete surveys');
      }

      // Don't allow deleting surveys with responses
      if (responseCount > 0) {
        throw new ServiceError('CONFLICT', 'Cannot delete survey with existing responses');
      }

      const deleted = await survey.delete(surveyId, tenantId);

      if (!deleted) {
        throw new ServiceError('NOT_FOUND', 'survey not found');
      }

      // Log the action
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'delete_survey',
        entity_type: 'survey',
        entity_id: surveyId,
        old_values: {
          title: existingTitle,
          status: existingStatus,
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return { message: 'survey deleted successfully' };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      console.error('Error deleting survey:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to delete survey');
    }
  }

  /**
   * Get survey templates
   * @param tenantId - The tenant ID
   */
  async getSurveyTemplates(tenantId: number): Promise<unknown[]> {
    try {
      const templates = await survey.getTemplates(tenantId);
      return templates.map((template) => dbToApi(template));
    } catch (error: unknown) {
      console.error('Error getting templates:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to get survey templates');
    }
  }

  /**
   * Create survey from template
   * @param templateId - The templateId parameter
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param ipAddress - The ipAddress parameter
   * @param userAgent - The userAgent parameter
   */
  async createFromTemplate(
    templateId: number,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<unknown> {
    try {
      const surveyId = await survey.createFromTemplate(templateId, tenantId, userId);

      // Log the action
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'create_survey_from_template',
        entity_type: 'survey',
        entity_id: surveyId,
        new_values: { templateId },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      // Return the created survey
      return await this.getSurveyById(surveyId, tenantId, userId, 'admin');
    } catch (error: unknown) {
      console.error('Error creating from template:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to create survey from template');
    }
  }

  /**
   * Get survey statistics
   * @param surveyId - The surveyId parameter
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async getSurveyStatistics(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<SurveyStatisticsResponse> {
    try {
      // Check if survey exists and user has access
      await this.getSurveyById(surveyId, tenantId, userId, userRole);

      if (userRole === 'employee') {
        throw new ServiceError('FORBIDDEN', 'Only admins can view survey statistics');
      }

      const statistics: SurveyStatistics = await survey.getStatistics(surveyId, tenantId);

      // Transform to API format
      const response: SurveyStatisticsResponse = {
        surveyId: statistics.survey_id,
        totalResponses: statistics.total_responses,
        completedResponses: statistics.completed_responses,
        completionRate: statistics.completion_rate,
        firstResponse: statistics.first_response,
        lastResponse: statistics.last_response,
        questions: statistics.questions.map((q) => ({
          id: q.id,
          questionText: q.question_text,
          questionType: q.question_type,
          responses: q.responses?.map((r) => ({
            answerText: r.answer_text,
            userId: r.user_id,
            firstName: r.first_name,
            lastName: r.last_name,
          })),
          options: q.options?.map((opt) => ({
            optionId: opt.option_id,
            optionText: opt.option_text,
            count: opt.count,
          })),
          statistics:
            q.statistics ?
              {
                average: q.statistics.average,
                min: q.statistics.min,
                max: q.statistics.max,
                totalResponses: q.statistics.total_responses,
              }
            : undefined,
        })),
      };

      return response;
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      console.error('Error getting statistics:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to get survey statistics');
    }
  }
}

export const surveysService = new SurveysService();
