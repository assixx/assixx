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
interface AdminLogData extends Omit<DbAdminLog, 'tenant_id'> {
  tenant_id: number;
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

interface AdminLogCreateData
  extends Omit<ModelAdminLogCreateData, 'tenant_id'> {
  tenant_id: number;
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
    // Model doesn't have getById, return null for now
    return null;
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
        tenant_id: data.tenant_id,
        action: data.action,
        ip_address: data.ip_address,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        old_values: data.old_values,
        new_values: data.new_values,
        user_agent: data.user_agent,
      };
      const id = await AdminLog.create(modelData);
      // Return the data without trying to match RowDataPacket structure
      return {
        id,
        admin_id: modelData.user_id,
        tenant_id: data.tenant_id,
        action: modelData.action,
        entity_type: modelData.entity_type,
        entity_id: modelData.entity_id,
        old_values: modelData.old_values,
        new_values: modelData.new_values,
        ip_address: modelData.ip_address,
        user_agent: modelData.user_agent,
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
    // TODO: Implement update method in AdminLog model
    return null;
  }

  /**
   * Löscht einen AdminLog Eintrag
   */
  async delete(_tenantDb: Pool, _id: number): Promise<boolean> {
    // TODO: Implement delete method in AdminLog model
    return false;
  }
}

// Export singleton instance
const adminLogService = new AdminLogService();
export default adminLogService;

// Named export for the class
export { AdminLogService };
