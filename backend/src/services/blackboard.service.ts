/**
 * Blackboard Service
 * Handles blackboard business logic
 */

import {
  getAllEntries,
  getEntryById,
  createEntry,
  updateEntry,
  deleteEntry,
  type DbBlackboardEntry,
  type EntryQueryOptions,
  type EntryCreateData as ModelEntryCreateData,
} from '../models/blackboard';
import { Pool } from 'mysql2/promise';

// Service-specific interfaces
type BlackboardEntry = DbBlackboardEntry;

interface BlackboardFilters extends EntryQueryOptions {
  category?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  is_pinned?: boolean;
}

interface BlackboardCreateData extends ModelEntryCreateData {
  // Service layer specific fields
  is_pinned?: boolean;
  category?: string | null;
  created_by?: number; // Alternative to author_id for backward compatibility
}

interface BlackboardUpdateData {
  title?: string;
  content?: string;
  org_level?: 'company' | 'department' | 'team';
  org_id?: number;
  expires_at?: Date | string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  color?: string;
  status?: 'active' | 'archived';
  requires_confirmation?: boolean;
  tags?: string[];
  author_id?: number;
  is_pinned?: boolean;
  category?: string | null;
}

class BlackboardService {
  /**
   * Holt alle Blackboard Einträge für einen Tenant
   */
  async getAll(
    _tenantDb: Pool,
    filters: BlackboardFilters = {},
    tenantId: number,
    userId: number
  ): Promise<BlackboardEntry[]> {
    try {
      const result = await getAllEntries(tenantId, userId, filters);
      return result.entries;
    } catch (error) {
      console.error('Error in BlackboardService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Blackboard Eintrag per ID
   */
  async getById(
    _tenantDb: Pool,
    id: number,
    tenantId: number,
    userId: number
  ): Promise<BlackboardEntry | null> {
    try {
      const entry = await getEntryById(id, tenantId, userId);
      return entry;
    } catch (error) {
      console.error('Error in BlackboardService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Blackboard Eintrag
   */
  async create(
    _tenantDb: Pool,
    data: BlackboardCreateData
  ): Promise<BlackboardEntry> {
    try {
      // Map service data to model data
      const modelData: ModelEntryCreateData = {
        tenant_id: data.tenant_id,
        title: data.title,
        content: data.content,
        org_level: data.org_level,
        org_id: data.org_id,
        author_id: data.author_id || data.created_by || 0,
        expires_at:
          data.expires_at instanceof Date
            ? data.expires_at
            : data.expires_at
              ? new Date(data.expires_at)
              : undefined,
        priority: data.priority,
        color: data.color,
        tags: data.tags,
        requires_confirmation: data.requires_confirmation,
      };

      const entry = await createEntry(modelData);
      if (!entry) {
        throw new Error('Failed to create blackboard entry');
      }
      return entry;
    } catch (error) {
      console.error('Error in BlackboardService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Blackboard Eintrag
   */
  async update(
    _tenantDb: Pool,
    id: number,
    data: BlackboardUpdateData,
    tenantId: number
  ): Promise<BlackboardEntry | null> {
    try {
      // Remove service-specific fields before passing to model
      const { is_pinned: _is_pinned, category: _category, ...modelData } = data;

      // Convert expires_at to Date if it's a string
      const updateData = {
        ...modelData,
        expires_at: modelData.expires_at
          ? typeof modelData.expires_at === 'string'
            ? new Date(modelData.expires_at)
            : modelData.expires_at
          : undefined,
      };

      const entry = await updateEntry(id, updateData, tenantId);
      return entry;
    } catch (error) {
      console.error('Error in BlackboardService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Blackboard Eintrag
   */
  async delete(
    _tenantDb: Pool,
    id: number,
    tenantId: number
  ): Promise<boolean> {
    try {
      return await deleteEntry(id, tenantId);
    } catch (error) {
      console.error('Error in BlackboardService.delete:', error);
      throw error;
    }
  }
}

// Export singleton instance
const blackboardService = new BlackboardService();
export default blackboardService;

// Named export for the class
export { BlackboardService };

// CommonJS compatibility
