/**
 * Admin Log Service
 * Handles admin log business logic
 */
import { Pool } from 'mysql2/promise';

import RootLog, {
  type DbRootLog,
  type RootLogCreateData as ModelRootLogCreateData,
} from '../models/rootLog';

/**
 * Admin Log Service
 * Handles admin log business logic
 */

// Import types from AdminLog model
// Service-specific interfaces
interface AdminLogData extends Omit<DbRootLog, 'tenant_id'> {
  tenant_id: number;
  user_name?: string;
  user_role?: string;
  was_role_switched?: boolean;
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

interface AdminLogCreateData extends Omit<ModelRootLogCreateData, 'tenant_id'> {
  tenant_id: number;
  was_role_switched?: boolean;
}

interface AdminLogUpdateData {
  action?: string;
  entity_type?: string | null;
  entity_id?: number | null;
  details?: string | null;
}

/**
 *
 */
class AdminLogService {
  /**
   * Holt alle AdminLog Einträge für einen Tenant
   * @param _tenantDb
   * @param filters
   */
  async getAll(_tenantDb: Pool, filters: AdminLogFilters = {}): Promise<AdminLogData[]> {
    try {
      // Use getByUserId if user_id is provided, otherwise return empty array
      if (filters.user_id != null && filters.user_id !== 0) {
        const logs = await RootLog.getByUserId(filters.user_id);
        return logs.map((log: DbRootLog) => ({
          ...log,
          created_at: log.timestamp as Date,
        }));
      }
      return [];
    } catch (error: unknown) {
      console.error('Error in AdminLogService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen AdminLog Eintrag per ID
   * @param _tenantDb
   * @param _id
   */
  async getById(_tenantDb: Pool, _id: number): Promise<AdminLogData | null> {
    // Model doesn't have getById, return null for now
    return await Promise.resolve(null);
  }

  /**
   * Erstellt einen neuen AdminLog Eintrag
   * @param _tenantDb
   * @param data
   */
  async create(_tenantDb: Pool, data: AdminLogCreateData): Promise<AdminLogData> {
    try {
      const modelData: ModelRootLogCreateData = {
        user_id: data.user_id,
        tenant_id: data.tenant_id,
        action: data.action,
        ip_address: data.ip_address,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        old_values: data.old_values,
        new_values: data.new_values,
        user_agent: data.user_agent,
        was_role_switched: data.was_role_switched,
      };
      const id = await RootLog.create(modelData);
      // Return the data without trying to match RowDataPacket structure
      return {
        id: id,
        admin_id: modelData.user_id,
        tenant_id: data.tenant_id,
        action: modelData.action,
        entity_type: modelData.entity_type,
        entity_id: modelData.entity_id,
        old_values: modelData.old_values,
        new_values: modelData.new_values,
        ip_address: modelData.ip_address,
        user_agent: modelData.user_agent,
        was_role_switched: modelData.was_role_switched,
        created_at: new Date(),
      } as AdminLogData;
    } catch (error: unknown) {
      console.error('Error in AdminLogService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen AdminLog Eintrag
   * @param _tenantDb
   * @param _id
   * @param _data
   */
  async update(
    _tenantDb: Pool,
    _id: number,
    _data: AdminLogUpdateData,
  ): Promise<AdminLogData | null> {
    // TODO: Implement update method in AdminLog model
    return await Promise.resolve(null);
  }

  /**
   * Löscht einen AdminLog Eintrag
   * @param _tenantDb
   * @param _id
   */
  async delete(_tenantDb: Pool, _id: number): Promise<boolean> {
    // TODO: Implement delete method in AdminLog model
    return await Promise.resolve(false);
  }
}

// Export singleton instance
const adminLogService = new AdminLogService();
export default adminLogService;

// Named export for the class
export { AdminLogService };
