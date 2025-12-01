/**
 * Admin Log Service
 * Handles admin log business logic
 */
import rootLog from '../routes/v2/logs/logs.service.js';
import type {
  DbRootLog,
  RootLogCreateData as ModelRootLogCreateData,
} from '../routes/v2/logs/types.js';
import { Pool } from '../utils/db.js';

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

/**
 *
 */
class AdminLogService {
  /**
   * Holt alle AdminLog Einträge für einen Tenant
   * @param _tenantDb - The _tenantDb parameter
   * @param filters - The filter criteria
   */
  async getAll(_tenantDb: Pool, filters: AdminLogFilters = {}): Promise<AdminLogData[]> {
    try {
      // Use getByUserId if user_id is provided, otherwise return empty array
      if (filters.user_id != null && filters.user_id !== 0) {
        const logs = await rootLog.getByUserId(filters.user_id);
        // DbRootLog already has created_at, no transformation needed
        return logs as AdminLogData[];
      }
      return [];
    } catch (error: unknown) {
      console.error('Error in AdminLogService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen AdminLog Eintrag per ID
   * @param _tenantDb - The _tenantDb parameter
   * @param _id - The _id parameter
   */
  async getById(_tenantDb: Pool, _id: number): Promise<AdminLogData | null> {
    // Model doesn't have getById, return null for now
    return await Promise.resolve(null);
  }

  /**
   * Erstellt einen neuen AdminLog Eintrag
   * @param _tenantDb - The _tenantDb parameter
   * @param data - The data object
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
      const id = await rootLog.create(modelData);
      // Return the data without trying to match RowDataPacket structure
      return {
        id: id,
        user_id: modelData.user_id,
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
   * NOTE: No update() or delete() methods
   *
   * Audit logs are immutable by design for security and compliance:
   * - Security: Prevents attackers from covering their tracks
   * - Forensics: Maintains tamper-proof audit trail
   * - Compliance: GDPR Art. 17(3), SOX, ISO 27001 require immutable logs
   * - Legal: Audit logs are exempt from "right to erasure"
   *
   * If you need to "delete" a log entry (e.g., for GDPR), use pseudonymization
   * or mark as redacted - never actually delete the record.
   */
}

// Export singleton instance
const adminLogService = new AdminLogService();
export default adminLogService;

// Named export for the class
export { AdminLogService };
