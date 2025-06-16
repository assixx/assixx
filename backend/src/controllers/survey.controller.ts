/**
 * Survey Controller
 * Handles survey-related operations including templates and statistics
 */

import { Request, Response } from "express";
import surveyService from "../services/survey.service";
import Survey from "../models/survey";
import { mapQuestionType } from "../types/survey.types";

// Extended Request interfaces for survey operations
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    tenant_id: number;
    username?: string;
    email?: string;
    role?: string;
  };
}

interface SurveyQueryRequest extends AuthenticatedRequest {
  user: {
    id: number;
    tenant_id: number;
    username?: string;
    email?: string;
    role?: string;
  };
  query: {
    search?: string;
    status?: "draft" | "active" | "closed" | "archived";
    created_by?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortDir?: "ASC" | "DESC";
  };
}

interface SurveyByIdRequest extends AuthenticatedRequest {
  user: {
    id: number;
    tenant_id: number;
    username?: string;
    email?: string;
    role?: string;
  };
  params: {
    id: string;
  };
}

interface SurveyCreateRequest extends AuthenticatedRequest {
  user: {
    id: number;
    tenant_id: number;
    username?: string;
    email?: string;
    role?: string;
  };
  body: {
    title: string;
    description?: string;
    questions: Array<{
      question_text: string;
      question_type: "multiple_choice" | "text" | "rating" | "yes_no";
      is_required?: boolean;
      options?: string[];
    }>;
    is_anonymous?: boolean;
    start_date?: Date | string;
    end_date?: Date | string;
    target_audience?: string;
    status?: "draft" | "active" | "closed" | "archived";
  };
}

interface SurveyUpdateRequest extends AuthenticatedRequest {
  user: {
    id: number;
    tenant_id: number;
    username?: string;
    email?: string;
    role?: string;
  };
  params: {
    id: string;
  };
  body: {
    title?: string;
    description?: string;
    questions?: Array<{
      id?: number;
      question_text: string;
      question_type: "multiple_choice" | "text" | "rating" | "yes_no";
      is_required?: boolean;
      options?: string[];
    }>;
    is_anonymous?: boolean;
    start_date?: Date | string;
    end_date?: Date | string;
    target_audience?: string;
    status?: "draft" | "active" | "closed" | "archived";
  };
}

interface SurveyTemplateRequest extends AuthenticatedRequest {
  user: {
    id: number;
    tenant_id: number;
    username?: string;
    email?: string;
    role?: string;
  };
  params: {
    templateId: string;
  };
}

class SurveyController {
  /**
   * Holt alle Survey Einträge für einen Tenant
   * GET /api/surveys
   */
  async getAll(req: SurveyQueryRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user.tenant_id;
      const filters = {
        ...req.query,
        // Remove 'archived' status if present, not supported by service
        status: req.query.status === "archived" ? "closed" : req.query.status,
        page: req.query.page ? parseInt(req.query.page, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
        created_by: req.query.created_by
          ? parseInt(req.query.created_by, 10)
          : undefined,
      };
      const result = await surveyService.getAllByTenant(tenantId, filters);
      res.json(result);
    } catch (error) {
      console.error("Error in SurveyController.getAll:", error);
      res.status(500).json({
        error: "Fehler beim Abrufen der Daten",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Holt einen Survey Eintrag per ID mit Fragen und Optionen
   * GET /api/surveys/:id
   */
  async getById(req: SurveyByIdRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user.tenant_id;
      // Using direct model import since the original controller does this
      const result = await Survey.getById(
        parseInt(req.params.id, 10),
        tenantId,
      );
      if (!result) {
        res.status(404).json({ error: "Nicht gefunden" });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error("Error in SurveyController.getById:", error);
      res.status(500).json({
        error: "Fehler beim Abrufen der Daten",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Erstellt einen neuen Survey
   * POST /api/surveys
   */
  async create(req: SurveyCreateRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user.tenant_id;
      const createdBy = req.user.id;

      // Map question types before creating
      const surveyData = {
        ...req.body,
        questions: req.body.questions?.map((q: any) => ({
          ...q,
          question_type: mapQuestionType(q.question_type),
        })),
        // Ensure status is compatible with model
        status: req.body.status === "archived" ? "closed" : req.body.status,
      };

      // Using direct model import since the original controller does this
      const surveyId = await Survey.create(surveyData, tenantId, createdBy);
      res
        .status(201)
        .json({ id: surveyId, message: "Umfrage erfolgreich erstellt" });
    } catch (error) {
      console.error("Error in SurveyController.create:", error);
      res.status(500).json({
        error: "Fehler beim Erstellen",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Aktualisiert einen Survey
   * PUT /api/surveys/:id
   */
  async update(req: SurveyUpdateRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user.tenant_id;

      // Map question types before updating
      const updateData: any = {
        ...req.body,
        questions: req.body.questions?.map((q: any) => ({
          ...q,
          question_type: mapQuestionType(q.question_type),
        })),
        // Ensure status is compatible with model
        status: req.body.status === "archived" ? "closed" : req.body.status,
      };

      // Using direct model import since the original controller does this
      const result = await Survey.update(
        parseInt(req.params.id, 10),
        updateData,
        tenantId,
      );
      res.json({
        success: result,
        message: "Umfrage erfolgreich aktualisiert",
      });
    } catch (error) {
      console.error("Error in SurveyController.update:", error);
      res.status(500).json({
        error: "Fehler beim Aktualisieren",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Löscht einen Survey
   * DELETE /api/surveys/:id
   */
  async delete(req: SurveyByIdRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user.tenant_id;
      // Using direct model import since the original controller does this
      const result = await Survey.delete(parseInt(req.params.id, 10), tenantId);
      if (!result) {
        res.status(404).json({ error: "Umfrage nicht gefunden" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error in SurveyController.delete:", error);
      res.status(500).json({
        error: "Fehler beim Löschen",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Holt Templates
   * GET /api/surveys/templates
   */
  async getTemplates(req: SurveyQueryRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user.tenant_id;
      const templates = await surveyService.getTemplates(tenantId);
      res.json(templates);
    } catch (error) {
      console.error("Error in SurveyController.getTemplates:", error);
      res.status(500).json({
        error: "Fehler beim Abrufen der Templates",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Erstellt Survey aus Template
   * POST /api/surveys/from-template/:templateId
   */
  async createFromTemplate(
    req: SurveyTemplateRequest,
    res: Response,
  ): Promise<void> {
    try {
      const tenantId = req.user.tenant_id;
      const createdBy = req.user.id;
      const surveyId = await surveyService.createFromTemplate(
        parseInt(req.params.templateId, 10),
        tenantId,
        createdBy,
      );
      res
        .status(201)
        .json({ id: surveyId, message: "Umfrage aus Template erstellt" });
    } catch (error) {
      console.error("Error in SurveyController.createFromTemplate:", error);
      res.status(500).json({
        error: "Fehler beim Erstellen aus Template",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Holt Survey Statistiken
   * GET /api/surveys/:id/statistics
   */
  async getStatistics(req: SurveyByIdRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user.tenant_id;
      const statistics = await surveyService.getStatistics(
        parseInt(req.params.id, 10),
        tenantId,
      );
      res.json(statistics);
    } catch (error) {
      console.error("Error in SurveyController.getStatistics:", error);
      res.status(500).json({
        error: "Fehler beim Abrufen der Statistiken",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

// Export singleton instance
const surveyController = new SurveyController();
export default surveyController;

// Named export for the class
export { SurveyController };

// CommonJS compatibility
