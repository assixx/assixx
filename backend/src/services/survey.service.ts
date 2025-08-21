/**
 * Survey Service
 * Handles survey business logic
 */
import { Pool } from 'mysql2/promise';

import Survey from '../models/survey';

// Interfaces
interface SurveyData {
  id: number;
  tenant_id: number;
  title: string;
  description?: string | null;
  created_by: number;
  status: 'draft' | 'active' | 'closed';
  is_anonymous: boolean | number;
  start_date?: Date | null;
  end_date?: Date | null;
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  creator_first_name?: string;
  creator_last_name?: string;
  response_count?: number;
  completed_count?: number;
  questions?: SurveyQuestion[];
  assignments?: SurveyAssignment[];
}

interface SurveyQuestion {
  id: number;
  survey_id: number;
  question_text: string;
  question_type: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'number';
  is_required: boolean | number;
  order_position: number;
  created_at: Date;
  options?: SurveyQuestionOption[];
}

interface SurveyQuestionOption {
  id: number;
  question_id: number;
  option_text: string;
  order_position: number;
}

interface SurveyAssignment {
  id: number;
  survey_id: number;
  assignment_type: 'company' | 'department' | 'team' | 'individual';
  department_id?: number | null;
  team_id?: number | null;
  user_id?: number | null;
}

interface SurveyTemplate {
  id: number;
  tenant_id?: number | null;
  name: string;
  description?: string | null;
  template_data: string;
  is_public: boolean | number;
  created_at: Date;
}

interface SurveyFilters {
  status?: 'draft' | 'active' | 'closed';
  page?: number;
  limit?: number;
}

interface SurveyCreateData {
  title: string;
  description?: string;
  status?: 'draft' | 'active' | 'closed';
  is_anonymous?: boolean;
  is_mandatory?: boolean;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  questions?: {
    question_text: string;
    question_type: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'number';
    is_required?: boolean;
    order_position?: number;
    options?: string[];
  }[];
  assignments?: {
    type: 'all_users' | 'department' | 'team' | 'user';
    department_id?: number | null;
    team_id?: number | null;
    user_id?: number | null;
  }[];
}

interface SurveyUpdateData {
  title?: string;
  description?: string;
  status?: 'draft' | 'active' | 'closed';
  is_anonymous?: boolean;
  is_mandatory?: boolean;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  questions?: {
    question_text: string;
    question_type: 'text' | 'single_choice' | 'multiple_choice' | 'rating' | 'number';
    is_required?: boolean;
    order_position?: number;
    options?: string[];
  }[];
}

interface SurveyStatistics {
  survey_id: number;
  total_responses: number;
  completed_responses: number;
  completion_rate: number;
  first_response?: Date | null;
  last_response?: Date | null;
  questions: {
    id: number;
    question_text: string;
    question_type: string;
    responses?: {
      answer_text?: string;
      selected_option_id?: number;
      rating?: number;
    }[];
    options?: {
      option_id: number;
      option_text: string;
      count: number;
    }[];
    statistics?: {
      average: number | null;
      min: number | null;
      max: number | null;
      total_responses: number;
    };
  }[];
}

/**
 *
 */
class SurveyService {
  /**
   * Holt alle Survey Einträge für einen Tenant
   * NOTE: This generic method doesn't match the actual Survey model methods
   * @param _tenantDb - The _tenantDb parameter
   * @param _filters - The _filters parameter
   */
  getAll(_tenantDb: Pool, _filters: SurveyFilters = {}): SurveyData[] {
    try {
      // The actual Survey model doesn't have a generic getAll method
      console.warn(
        'SurveyService.getAll: This method should use getAllByTenant from the Survey model',
      );
      // Redirect to getAllByTenant but we need tenantId
      throw new Error('Method needs refactoring - use getAllByTenant instead with proper tenantId');
    } catch (error: unknown) {
      console.error('Error in SurveyService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Survey Eintrag per ID
   * NOTE: This should pass tenantId as well
   * @param _tenantDb - The _tenantDb parameter
   * @param _id - The _id parameter
   */
  getById(_tenantDb: Pool, _id: number): SurveyData | null {
    try {
      console.warn('SurveyService.getById: This method needs tenantId parameter');
      // Survey.getById expects (surveyId, tenantId)
      throw new Error('Method needs refactoring - getById requires tenantId parameter');
    } catch (error: unknown) {
      console.error('Error in SurveyService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Survey Eintrag
   * NOTE: Survey.create expects (surveyData, tenantId, createdBy)
   * @param _tenantDb - The _tenantDb parameter
   * @param _data - The _data parameter
   */
  create(_tenantDb: Pool, _data: SurveyCreateData): number {
    try {
      console.warn('SurveyService.create: This method needs tenantId and createdBy parameters');
      throw new Error(
        'Method needs refactoring - create requires tenantId and createdBy parameters',
      );
    } catch (error: unknown) {
      console.error('Error in SurveyService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Survey Eintrag
   * NOTE: Survey.update expects (surveyId, surveyData, tenantId)
   * @param _tenantDb - The _tenantDb parameter
   * @param _id - The _id parameter
   * @param _data - The _data parameter
   */
  update(_tenantDb: Pool, _id: number, _data: SurveyUpdateData): boolean {
    try {
      console.warn('SurveyService.update: This method needs tenantId parameter');
      throw new Error('Method needs refactoring - update requires tenantId parameter');
    } catch (error: unknown) {
      console.error('Error in SurveyService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Survey Eintrag
   * NOTE: Survey.delete expects (surveyId, tenantId)
   * @param _tenantDb - The _tenantDb parameter
   * @param _id - The _id parameter
   */
  delete(_tenantDb: Pool, _id: number): boolean {
    try {
      console.warn('SurveyService.delete: This method needs tenantId parameter');
      throw new Error('Method needs refactoring - delete requires tenantId parameter');
    } catch (error: unknown) {
      console.error('Error in SurveyService.delete:', error);
      throw error;
    }
  }

  /**
   * Holt alle Surveys für einen Tenant
   * @param tenantId - The tenant ID
   * @param filters - The filter criteria
   */
  async getAllByTenant(tenantId: number, filters: SurveyFilters = {}): Promise<SurveyData[]> {
    try {
      return await Survey.getAllByTenant(tenantId, filters);
    } catch (error: unknown) {
      console.error('Error in SurveyService.getAllByTenant:', error);
      throw error;
    }
  }

  /**
   * Get survey by ID
   * @param surveyId - The surveyId parameter
   * @param tenantId - The tenant ID
   */
  async getSurveyById(surveyId: number, tenantId: number): Promise<SurveyData | null> {
    try {
      return await Survey.getById(surveyId, tenantId);
    } catch (error: unknown) {
      console.error('Error in SurveyService.getSurveyById:', error);
      throw error;
    }
  }

  /**
   * Create a new survey
   * @param surveyData - The surveyData parameter
   * @param tenantId - The tenant ID
   * @param createdBy - The createdBy parameter
   */
  async createSurvey(
    surveyData: SurveyCreateData,
    tenantId: number,
    createdBy: number,
  ): Promise<number> {
    try {
      return await Survey.create(surveyData, tenantId, createdBy);
    } catch (error: unknown) {
      console.error('Error in SurveyService.createSurvey:', error);
      throw error;
    }
  }

  /**
   * Update a survey
   * @param surveyId - The surveyId parameter
   * @param surveyData - The surveyData parameter
   * @param tenantId - The tenant ID
   */
  async updateSurvey(
    surveyId: number,
    surveyData: SurveyUpdateData,
    tenantId: number,
  ): Promise<boolean> {
    try {
      return await Survey.update(surveyId, surveyData as SurveyCreateData, tenantId);
    } catch (error: unknown) {
      console.error('Error in SurveyService.updateSurvey:', error);
      throw error;
    }
  }

  /**
   * Delete a survey
   * @param surveyId - The surveyId parameter
   * @param tenantId - The tenant ID
   */
  async deleteSurvey(surveyId: number, tenantId: number): Promise<boolean> {
    try {
      return await Survey.delete(surveyId, tenantId);
    } catch (error: unknown) {
      console.error('Error in SurveyService.deleteSurvey:', error);
      throw error;
    }
  }

  /**
   * Holt Survey Templates
   * @param tenantId - The tenant ID
   */
  async getTemplates(tenantId: number): Promise<SurveyTemplate[]> {
    try {
      return await Survey.getTemplates(tenantId);
    } catch (error: unknown) {
      console.error('Error in SurveyService.getTemplates:', error);
      throw error;
    }
  }

  /**
   * Erstellt Survey aus Template
   * @param templateId - The templateId parameter
   * @param tenantId - The tenant ID
   * @param createdBy - The createdBy parameter
   */
  async createFromTemplate(
    templateId: number,
    tenantId: number,
    createdBy: number,
  ): Promise<number> {
    try {
      return await Survey.createFromTemplate(templateId, tenantId, createdBy);
    } catch (error: unknown) {
      console.error('Error in SurveyService.createFromTemplate:', error);
      throw error;
    }
  }

  /**
   * Holt Survey Statistiken
   * @param surveyId - The surveyId parameter
   * @param tenantId - The tenant ID
   */
  async getStatistics(surveyId: number, tenantId: number): Promise<SurveyStatistics> {
    try {
      return await Survey.getStatistics(surveyId, tenantId);
    } catch (error: unknown) {
      console.error('Error in SurveyService.getStatistics:', error);
      throw error;
    }
  }
}

// Export singleton instance
const surveyService = new SurveyService();
export default surveyService;

// Named export for the class
export { SurveyService };

// CommonJS compatibility
