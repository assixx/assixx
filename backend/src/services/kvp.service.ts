/**
 * KVP Service
 * Handles KVP (Kontinuierlicher Verbesserungsprozess) business logic
 *
 * NOTE: This service wrapper only exposes generic CRUD methods,
 * but the KVP model has many more specific methods like getCategories,
 * createSuggestion, getSuggestions, etc. This should be refactored
 * to expose the full KVP functionality.
 */
import { Pool } from 'mysql2/promise';

import kvpModel from '../models/kvp';

// Import the actual KVP model methods
// Destructured methods are unused - commented out to fix TypeScript errors
// const {
//   getCategories,
//   createSuggestion,
//   getSuggestions,
//   getSuggestionById,
//   updateSuggestionStatus,
//   addAttachment,
//   getAttachments,
//   addComment,
//   getComments,
//   getUserPoints,
//   awardPoints,
//   getDashboardStats,
//   deleteSuggestion,
//   getAttachment
// } = kvpModel;

// Interfaces - these would typically match the KVP model interfaces
interface KvpEntry {
  id: number;
  tenant_id: number;
  title: string;
  description: string;
  category_id: number;
  org_level: 'company' | 'department' | 'team';
  org_id: number;
  submitted_by: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  created_at: Date;
  updated_at: Date;
}

interface KvpFilters {
  status?: string;
  category_id?: number;
  priority?: string;
  org_level?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

interface KvpCreateData {
  tenant_id: number;
  title: string;
  description: string;
  category_id: number;
  org_level: 'company' | 'department' | 'team';
  org_id: number;
  submitted_by: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  expected_benefit?: string;
  estimated_cost?: number;
}

interface KvpUpdateData {
  title?: string;
  description?: string;
  category_id?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  status?: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  assigned_to?: number;
  actual_savings?: number;
}

// Additional interfaces for actual KVP functionality
interface Category {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface Suggestion {
  id: number;
  tenant_id: number;
  title: string;
  description: string;
  category_id: number;
  org_level: 'company' | 'department' | 'team';
  org_id: number;
  submitted_by: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expected_benefit?: string;
  estimated_cost?: number;
  status: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  assigned_to?: number;
  actual_savings?: number;
  created_at: Date;
  updated_at: Date;
}

/**
 *
 */
class KvpService {
  /**
   * Holt alle Kvp Einträge für einen Tenant
   * NOTE: This generic method doesn't match the actual KVP model functionality
   * @param _tenantDb - The _tenantDb parameter
   * @param _filters - The _filters parameter
   */
  getAll(_tenantDb: Pool, _filters: KvpFilters = {}): KvpEntry[] {
    try {
      // The actual KVP model doesn't have a generic getAll method
      // This should probably call getSuggestions instead
      console.warn('KvpService.getAll: This method should use getSuggestions from the KVP model');
      throw new Error('Method needs refactoring - use getSuggestions instead');
    } catch (error: unknown) {
      console.error('Error in KvpService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Kvp Eintrag per ID
   * NOTE: This should use getSuggestionById
   * @param _tenantDb - The _tenantDb parameter
   * @param _id - The _id parameter
   */
  getById(_tenantDb: Pool, _id: number): KvpEntry | null {
    try {
      console.warn(
        'KvpService.getById: This method should use getSuggestionById from the KVP model',
      );
      throw new Error('Method needs refactoring - use getSuggestionById instead');
    } catch (error: unknown) {
      console.error('Error in KvpService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Kvp Eintrag
   * NOTE: This should use createSuggestion
   * @param _tenantDb - The _tenantDb parameter
   * @param _data - The _data parameter
   */
  create(_tenantDb: Pool, _data: KvpCreateData): KvpEntry {
    try {
      console.warn('KvpService.create: This method should use createSuggestion from the KVP model');
      throw new Error('Method needs refactoring - use createSuggestion instead');
    } catch (error: unknown) {
      console.error('Error in KvpService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Kvp Eintrag
   * NOTE: This should use updateSuggestionStatus or other specific update methods
   * @param _tenantDb - The _tenantDb parameter
   * @param _id - The _id parameter
   * @param _data - The _data parameter
   */
  update(_tenantDb: Pool, _id: number, _data: KvpUpdateData): KvpEntry | null {
    try {
      console.warn(
        'KvpService.update: This method should use updateSuggestionStatus from the KVP model',
      );
      throw new Error('Method needs refactoring - use updateSuggestionStatus instead');
    } catch (error: unknown) {
      console.error('Error in KvpService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Kvp Eintrag
   * NOTE: This should use deleteSuggestion
   * @param _tenantDb - The _tenantDb parameter
   * @param _id - The _id parameter
   */
  delete(_tenantDb: Pool, _id: number): boolean {
    try {
      console.warn('KvpService.delete: This method should use deleteSuggestion from the KVP model');
      throw new Error('Method needs refactoring - use deleteSuggestion instead');
    } catch (error: unknown) {
      console.error('Error in KvpService.delete:', error);
      throw error;
    }
  }

  // Additional methods that expose the actual KVP functionality
  // These should be added in a refactoring step:

  /**
   * Get all categories for a tenant
   * @param tenantId - The tenant ID
   */
  async getCategories(tenantId: number): Promise<Category[]> {
    try {
      // Categories are global, no tenant filtering needed
      const categories = await kvpModel.getCategories();
      // Add tenant_id to match the Category interface expectation
      return categories.map((cat) => ({ ...cat, tenant_id: tenantId }));
    } catch (error: unknown) {
      console.error('Error in KvpService.getCategories:', error);
      throw error;
    }
  }

  /**
   * Get suggestions with filters
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   * @param filters - The filter criteria
   */
  async getSuggestions(
    tenantId: number,
    userId: number,
    userRole: string,
    filters: KvpFilters = {},
  ): Promise<Suggestion[]> {
    try {
      return await kvpModel.getSuggestions(tenantId, userId, userRole, filters);
    } catch (error: unknown) {
      console.error('Error in KvpService.getSuggestions:', error);
      throw error;
    }
  }

  /**
   * Create a new suggestion
   * @param data - The data object
   */
  async createSuggestion(data: KvpCreateData): Promise<Suggestion> {
    try {
      const created = await kvpModel.createSuggestion(data);
      // Get the full suggestion with all fields
      const suggestion = await kvpModel.getSuggestionById(
        created.id,
        data.tenant_id,
        data.submitted_by, // Using submitted_by as userId
        'employee', // Default role, should be passed from controller
      );
      if (!suggestion) {
        throw new Error('Failed to retrieve created suggestion');
      }
      return suggestion as Suggestion;
    } catch (error: unknown) {
      console.error('Error in KvpService.createSuggestion:', error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   * @param tenantId - The tenant ID
   */
  async getDashboardStats(tenantId: number): Promise<{
    totalSuggestions: number;
    implementedSuggestions: number;
    totalSavings: number;
    suggestionsByCategory: Record<string, number>;
    suggestionsByStatus: Record<string, number>;
    topContributors: {
      userId: number;
      userName: string;
      points: number;
    }[];
  }> {
    try {
      const stats = await kvpModel.getDashboardStats(tenantId);

      // Transform DbDashboardStats to expected format
      return {
        totalSuggestions: stats.total_suggestions,
        implementedSuggestions: stats.implemented,
        totalSavings: stats.avg_savings ?? 0,
        suggestionsByCategory: {}, // TODO: Implement category breakdown
        suggestionsByStatus: {
          new: stats.new_suggestions,
          in_review: stats.in_progress, // Map old field name to new status
          implemented: stats.implemented,
          rejected: stats.rejected,
        },
        topContributors: [], // TODO: Implement top contributors
      };
    } catch (error: unknown) {
      console.error('Error in KvpService.getDashboardStats:', error);
      throw error;
    }
  }
}

// Export singleton instance
const kvpService = new KvpService();
export default kvpService;

// Named export for the class
export { KvpService };

// CommonJS compatibility
