/**
 * KVP Service
 * Handles KVP (Kontinuierlicher Verbesserungsprozess) business logic
 *
 * NOTE: This service wrapper only exposes generic CRUD methods,
 * but the KVP model has many more specific methods like getCategories,
 * createSuggestion, getSuggestions, etc. This should be refactored
 * to expose the full KVP functionality.
 */

import KVPModel from '../models/kvp';
import { Pool } from 'mysql2/promise';

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
// } = KVPModel;

// Interfaces - these would typically match the KVP model interfaces
interface KvpEntry {
  id: number;
  tenant_id: number;
  // Add other KVP-specific fields as needed
  [key: string]: any;
}

interface KvpFilters {
  status?: string;
  category_id?: number;
  priority?: string;
  org_level?: string;
  [key: string]: any;
}

interface KvpCreateData {
  tenant_id: number;
  // Add other required fields for KVP entries
  [key: string]: any;
}

interface KvpUpdateData {
  // Add updateable fields for KVP entries
  [key: string]: any;
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
  status: 'new' | 'in_progress' | 'implemented' | 'rejected';
  assigned_to?: number;
  actual_savings?: number;
  created_at: Date;
  updated_at: Date;
}

class KvpService {
  /**
   * Holt alle Kvp Einträge für einen Tenant
   * NOTE: This generic method doesn't match the actual KVP model functionality
   */
  async getAll(
    _tenantDb: Pool,
    _filters: KvpFilters = {}
  ): Promise<KvpEntry[]> {
    try {
      // The actual KVP model doesn't have a generic getAll method
      // This should probably call getSuggestions instead
      console.warn(
        'KvpService.getAll: This method should use getSuggestions from the KVP model'
      );
      throw new Error('Method needs refactoring - use getSuggestions instead');
    } catch (error) {
      console.error('Error in KvpService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Kvp Eintrag per ID
   * NOTE: This should use getSuggestionById
   */
  async getById(_tenantDb: Pool, _id: number): Promise<KvpEntry | null> {
    try {
      console.warn(
        'KvpService.getById: This method should use getSuggestionById from the KVP model'
      );
      throw new Error(
        'Method needs refactoring - use getSuggestionById instead'
      );
    } catch (error) {
      console.error('Error in KvpService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Kvp Eintrag
   * NOTE: This should use createSuggestion
   */
  async create(_tenantDb: Pool, _data: KvpCreateData): Promise<KvpEntry> {
    try {
      console.warn(
        'KvpService.create: This method should use createSuggestion from the KVP model'
      );
      throw new Error(
        'Method needs refactoring - use createSuggestion instead'
      );
    } catch (error) {
      console.error('Error in KvpService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Kvp Eintrag
   * NOTE: This should use updateSuggestionStatus or other specific update methods
   */
  async update(
    _tenantDb: Pool,
    _id: number,
    _data: KvpUpdateData
  ): Promise<KvpEntry | null> {
    try {
      console.warn(
        'KvpService.update: This method should use updateSuggestionStatus from the KVP model'
      );
      throw new Error(
        'Method needs refactoring - use updateSuggestionStatus instead'
      );
    } catch (error) {
      console.error('Error in KvpService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Kvp Eintrag
   * NOTE: This should use deleteSuggestion
   */
  async delete(_tenantDb: Pool, _id: number): Promise<boolean> {
    try {
      console.warn(
        'KvpService.delete: This method should use deleteSuggestion from the KVP model'
      );
      throw new Error(
        'Method needs refactoring - use deleteSuggestion instead'
      );
    } catch (error) {
      console.error('Error in KvpService.delete:', error);
      throw error;
    }
  }

  // Additional methods that expose the actual KVP functionality
  // These should be added in a refactoring step:

  /**
   * Get all categories for a tenant
   */
  async getCategories(tenantId: number): Promise<Category[]> {
    try {
      return await KVPModel.getCategories(tenantId);
    } catch (error) {
      console.error('Error in KvpService.getCategories:', error);
      throw error;
    }
  }

  /**
   * Get suggestions with filters
   */
  async getSuggestions(
    tenantId: number,
    userId: number,
    userRole: string,
    filters: KvpFilters = {}
  ): Promise<Suggestion[]> {
    try {
      return await KVPModel.getSuggestions(tenantId, userId, userRole, filters);
    } catch (error) {
      console.error('Error in KvpService.getSuggestions:', error);
      throw error;
    }
  }

  /**
   * Create a new suggestion
   */
  async createSuggestion(data: any): Promise<any> {
    try {
      return await KVPModel.createSuggestion(data);
    } catch (error) {
      console.error('Error in KvpService.createSuggestion:', error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(tenantId: number): Promise<any> {
    try {
      return await KVPModel.getDashboardStats(tenantId);
    } catch (error) {
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
