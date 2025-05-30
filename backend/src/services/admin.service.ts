/**
 * Admin Log Service
 * Handles admin log business logic
 */

import AdminLog from '../models/adminLog';
import { Pool } from 'mysql2/promise';

// Import types from AdminLog model
import type {
  DbAdminLog,
  AdminLogCreateData as ModelAdminLogCreateData,
} from '../models/adminLog';

// Service-specific interfaces
interface AdminLogData extends DbAdminLog {
  tenant_id?: number;
  entity_type?: string | null;
  entity_id?: number | null;
  user_agent?: string | null;
  created_at?: Date;
  user_name?: string;
  user_role?: string;
}

interface AdminLogFilters {
  user_id?: number;
  action?: string;
  entity_type?: string;
  start_date?: Date | string;
  end_date?: Date | string;
  limit?: number;
  offset?: number;
}

interface AdminLogCreateData extends ModelAdminLogCreateData {
  tenant_id?: number;
  entity_type?: string | null;
  entity_id?: number | null;
  user_agent?: string | null;
}

interface AdminLogUpdateData {
  action?: string;
  entity_type?: string | null;
  entity_id?: number | null;
  details?: string | null;
}

class AdminLogService {
  /**
   * Holt alle AdminLog Einträge für einen Tenant
   */
  async getAll(
    _tenantDb: Pool,
    filters: AdminLogFilters = {}
  ): Promise<AdminLogData[]> {
    try {
      // Use getByUserId if user_id is provided, otherwise return empty array
      if (filters.user_id) {
        const logs = await AdminLog.getByUserId(filters.user_id);
        return logs.map((log) => ({
          ...log,
          created_at: log.timestamp,
        }));
      }
      return [];
    } catch (error) {
      console.error('Error in AdminLogService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen AdminLog Eintrag per ID
   */
  async getById(_tenantDb: Pool, _id: number): Promise<AdminLogData | null> {
    try {
      // Model doesn't have getById, return null for now
      return null;
    } catch (error) {
      console.error('Error in AdminLogService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen AdminLog Eintrag
   */
  async create(
    _tenantDb: Pool,
    data: AdminLogCreateData
  ): Promise<AdminLogData> {
    try {
      const modelData: ModelAdminLogCreateData = {
        user_id: data.user_id,
        action: data.action,
        ip_address: data.ip_address,
        status: 'success',
        details: data.details,
      };
      const id = await AdminLog.create(modelData);
      // Return the data without trying to match RowDataPacket structure
      return {
        id,
        user_id: modelData.user_id,
        action: modelData.action,
        ip_address: modelData.ip_address,
        status: modelData.status,
        details: modelData.details,
        timestamp: new Date(),
        tenant_id: data.tenant_id,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        user_agent: data.user_agent,
        created_at: new Date(),
      } as AdminLogData;
    } catch (error) {
      console.error('Error in AdminLogService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen AdminLog Eintrag
   */
  async update(
    _tenantDb: Pool,
    _id: number,
    _data: AdminLogUpdateData
  ): Promise<AdminLogData | null> {
    try {
      // TODO: Implement update method in AdminLog model
      return null;
    } catch (error) {
      console.error('Error in AdminLogService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen AdminLog Eintrag
   */
  async delete(_tenantDb: Pool, _id: number): Promise<boolean> {
    try {
      // TODO: Implement delete method in AdminLog model
      return false;
    } catch (error) {
      console.error('Error in AdminLogService.delete:', error);
      throw error;
    }
  }
}

// Export singleton instance
const adminLogService = new AdminLogService();
export default adminLogService;

// Named export for the class
export { AdminLogService };
