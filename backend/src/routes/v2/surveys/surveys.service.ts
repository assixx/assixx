/**
 * Surveys API v2 Service Layer
 * Business logic for survey management
 */

import { RootLog } from "../../../models/rootLog.js";
import Survey from "../../../models/survey.js";
import { dbToApi } from "../../../utils/fieldMapping.js";
import { ServiceError } from "../../../utils/ServiceError.js";

export interface SurveyFilters {
  status?: "draft" | "active" | "closed";
  page?: number;
  limit?: number;
}

export interface QuestionCreateData {
  questionText: string;
  questionType:
    | "text"
    | "single_choice"
    | "multiple_choice"
    | "rating"
    | "number";
  isRequired?: boolean;
  orderPosition?: number;
  options?: string[];
}

export interface AssignmentCreateData {
  type: "all_users" | "department" | "team" | "user";
  departmentId?: number | null;
  teamId?: number | null;
  userId?: number | null;
}

export interface SurveyCreateData {
  title: string;
  description?: string;
  status?: "draft" | "active" | "closed";
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
  status?: "draft" | "active" | "closed";
  isAnonymous?: boolean;
  isMandatory?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  questions?: QuestionCreateData[];
}

export interface ResponseSubmitData {
  surveyId: number;
  answers: Array<{
    questionId: number;
    answerText?: string;
    answerNumber?: number;
    selectedOptions?: number[];
  }>;
}

export class SurveysService {
  /**
   * List surveys based on user role
   */
  async listSurveys(
    tenantId: number,
    userId: number,
    userRole: string,
    filters: SurveyFilters = {},
  ) {
    try {
      let surveys;

      if (userRole === "root") {
        // Root can see all surveys
        surveys = await Survey.getAllByTenant(tenantId, filters);
      } else if (userRole === "admin") {
        // Admin sees surveys based on department permissions
        surveys = await Survey.getAllByTenantForAdmin(
          tenantId,
          userId,
          filters,
        );
      } else {
        // Employee sees assigned surveys
        surveys = await Survey.getAllByTenantForEmployee(
          tenantId,
          userId,
          filters,
        );
      }

      // Transform to API format
      return surveys.map((survey) => {
        const apiSurvey = dbToApi<Record<string, unknown>>(survey);
        return {
          ...apiSurvey,
          responseCount: survey.response_count ?? 0,
          completedCount: survey.completed_count ?? 0,
          creatorFirstName: survey.creator_first_name,
          creatorLastName: survey.creator_last_name,
        };
      });
    } catch (error) {
      console.error("Error listing surveys:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to list surveys");
    }
  }

  /**
   * Get survey by ID
   */
  async getSurveyById(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ) {
    try {
      const survey = await Survey.getById(surveyId, tenantId);

      if (!survey) {
        throw new ServiceError("NOT_FOUND", "Survey not found");
      }

      // Check access permissions
      if (userRole === "employee") {
        // Employee can only see surveys assigned to them
        const assignedSurveys = await Survey.getAllByTenantForEmployee(
          tenantId,
          userId,
          {},
        );
        const hasAccess = assignedSurveys.some((s) => s.id === surveyId);

        if (!hasAccess) {
          throw new ServiceError(
            "FORBIDDEN",
            "You don't have access to this survey",
          );
        }
      } else if (userRole === "admin") {
        // Admin can see surveys in their departments
        const adminSurveys = await Survey.getAllByTenantForAdmin(
          tenantId,
          userId,
          {},
        );
        const hasAccess = adminSurveys.some((s) => s.id === surveyId);

        if (!hasAccess) {
          throw new ServiceError(
            "FORBIDDEN",
            "You don't have access to this survey",
          );
        }
      }

      // Transform to API format
      const apiSurvey = dbToApi<Record<string, unknown>>(survey);

      // Transform questions
      if (survey.questions) {
        apiSurvey.questions = survey.questions.map(
          (q: Record<string, unknown>) => {
            const apiQuestion = dbToApi<Record<string, unknown>>(q);
            return {
              ...apiQuestion,
              orderPosition: q.order_position ?? q.order_index,
            };
          },
        );
      }

      // Transform assignments
      if (survey.assignments) {
        apiSurvey.assignments = survey.assignments.map(
          (a: Record<string, unknown>) => dbToApi<Record<string, unknown>>(a),
        );
      }

      return apiSurvey;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      console.error("Error getting survey:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to get survey");
    }
  }

  /**
   * Create a new survey
   */
  async createSurvey(
    data: SurveyCreateData,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      // Transform API data to DB format
      const surveyData = {
        title: data.title,
        description: data.description,
        status: data.status ?? "draft",
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

      const surveyId = await Survey.create(surveyData, tenantId, userId);

      // Log the action
      await RootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "create_survey",
        entity_type: "survey",
        entity_id: surveyId,
        new_values: { title: data.title, status: data.status ?? "draft" },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      // Return the created survey
      return this.getSurveyById(surveyId, tenantId, userId, "admin");
    } catch (error) {
      console.error("Error creating survey:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to create survey");
    }
  }

  /**
   * Update a survey
   */
  async updateSurvey(
    surveyId: number,
    data: SurveyUpdateData,
    tenantId: number,
    userId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      // Check if survey exists and user has access
      const existingSurvey = await this.getSurveyById(
        surveyId,
        tenantId,
        userId,
        userRole,
      );

      // Type assertions for existingSurvey properties
      const existingTitle = existingSurvey.title as string;
      const existingStatus = existingSurvey.status as string;
      const responseCount = (existingSurvey.responseCount as number) ?? 0;

      if (userRole === "employee") {
        throw new ServiceError("FORBIDDEN", "Only admins can update surveys");
      }

      // Don't allow updating active surveys with responses
      if (existingStatus === "active" && responseCount > 0) {
        throw new ServiceError(
          "CONFLICT",
          "Cannot update survey with existing responses",
        );
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
      };

      await Survey.update(surveyId, updateData, tenantId);

      // Log the action
      await RootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "update_survey",
        entity_type: "survey",
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
      return this.getSurveyById(surveyId, tenantId, userId, userRole);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      console.error("Error updating survey:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to update survey");
    }
  }

  /**
   * Delete a survey
   */
  async deleteSurvey(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      // Check if survey exists and user has access
      const existingSurvey = await this.getSurveyById(
        surveyId,
        tenantId,
        userId,
        userRole,
      );

      // Type assertions for existingSurvey properties
      const existingTitle = existingSurvey.title as string;
      const existingStatus = existingSurvey.status as string;
      const responseCount = (existingSurvey.responseCount as number) ?? 0;

      if (userRole === "employee") {
        throw new ServiceError("FORBIDDEN", "Only admins can delete surveys");
      }

      // Don't allow deleting surveys with responses
      if (responseCount > 0) {
        throw new ServiceError(
          "CONFLICT",
          "Cannot delete survey with existing responses",
        );
      }

      const deleted = await Survey.delete(surveyId, tenantId);

      if (!deleted) {
        throw new ServiceError("NOT_FOUND", "Survey not found");
      }

      // Log the action
      await RootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "delete_survey",
        entity_type: "survey",
        entity_id: surveyId,
        old_values: {
          title: existingTitle,
          status: existingStatus,
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return { message: "Survey deleted successfully" };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      console.error("Error deleting survey:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to delete survey");
    }
  }

  /**
   * Get survey templates
   */
  async getSurveyTemplates(tenantId: number) {
    try {
      const templates = await Survey.getTemplates(tenantId);
      return templates.map((template) =>
        dbToApi<Record<string, unknown>>(template),
      );
    } catch (error) {
      console.error("Error getting templates:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to get survey templates");
    }
  }

  /**
   * Create survey from template
   */
  async createFromTemplate(
    templateId: number,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const surveyId = await Survey.createFromTemplate(
        templateId,
        tenantId,
        userId,
      );

      // Log the action
      await RootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "create_survey_from_template",
        entity_type: "survey",
        entity_id: surveyId,
        new_values: { templateId },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      // Return the created survey
      return this.getSurveyById(surveyId, tenantId, userId, "admin");
    } catch (error) {
      console.error("Error creating from template:", error);
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to create survey from template",
      );
    }
  }

  /**
   * Get survey statistics
   */
  async getSurveyStatistics(
    surveyId: number,
    tenantId: number,
    userId: number,
    userRole: string,
  ) {
    try {
      // Check if survey exists and user has access
      await this.getSurveyById(surveyId, tenantId, userId, userRole);

      if (userRole === "employee") {
        throw new ServiceError(
          "FORBIDDEN",
          "Only admins can view survey statistics",
        );
      }

      const statistics = await Survey.getStatistics(surveyId, tenantId);

      // Transform to API format
      return {
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
          responses: q.responses,
          options: q.options?.map((opt) => ({
            optionId: opt.option_id,
            optionText: opt.option_text,
            count: opt.count,
          })),
          statistics: q.statistics
            ? {
                average: q.statistics.average,
                min: q.statistics.min,
                max: q.statistics.max,
                totalResponses: q.statistics.total_responses,
              }
            : undefined,
        })),
      };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      console.error("Error getting statistics:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to get survey statistics");
    }
  }
}

export const surveysService = new SurveysService();
