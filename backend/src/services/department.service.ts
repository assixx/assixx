/**
 * Department Service
 * Handles department-related business logic
 */
import { Pool } from 'mysql2/promise';

import Department, {
  DepartmentCreateData,
  DbDepartment as DepartmentData,
  DepartmentUpdateData,
} from '../models/department';

/**
 * Department Service
 * Handles department-related business logic
 */

// Import types from Department model
// Service-specific interfaces
interface DepartmentFilters {
  search?: string;
  manager_id?: number;
  parent_id?: number;
  include_counts?: boolean;
  limit?: number;
  offset?: number;
}

/**
 *
 */
class DepartmentService {
  /**
   * Holt alle Department Einträge für einen Tenant
   * @param _tenantDb - The _tenantDb parameter
   * @param tenantId - The tenant ID
   * @param _filters - The _filters parameter
   */
  async getAll(
    _tenantDb: Pool,
    tenantId: number,
    _filters: DepartmentFilters = {},
  ): Promise<DepartmentData[]> {
    try {
      // Note: Department.findAll doesn't support limit/offset yet
      // TODO: Add pagination support to Department model
      return await Department.findAll(tenantId);
    } catch (error: unknown) {
      console.error('Error in DepartmentService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Department Eintrag per ID
   * @param _tenantDb - The _tenantDb parameter
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   */
  async getById(_tenantDb: Pool, id: number, tenantId: number): Promise<DepartmentData | null> {
    try {
      return await Department.findById(id, tenantId);
    } catch (error: unknown) {
      console.error('Error in DepartmentService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Department Eintrag
   * @param _tenantDb - The _tenantDb parameter
   * @param data - The data object
   */
  async create(_tenantDb: Pool, data: DepartmentCreateData): Promise<DepartmentData> {
    try {
      const id = await Department.create(data);
      const created = await Department.findById(id, data.tenant_id);
      if (!created) {
        throw new Error('Failed to retrieve created department');
      }
      return created;
    } catch (error: unknown) {
      console.error('Error in DepartmentService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Department Eintrag
   * @param _tenantDb - The _tenantDb parameter
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param data - The data object
   */
  async update(
    _tenantDb: Pool,
    id: number,
    tenantId: number,
    data: DepartmentUpdateData,
  ): Promise<DepartmentData | null> {
    try {
      const success = await Department.update(id, data);
      if (success) {
        return await Department.findById(id, tenantId);
      }
      return null;
    } catch (error: unknown) {
      console.error('Error in DepartmentService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Department Eintrag
   * @param _tenantDb - The _tenantDb parameter
   * @param id - The resource ID
   */
  async delete(_tenantDb: Pool, id: number): Promise<boolean> {
    try {
      return await Department.delete(id);
    } catch (error: unknown) {
      console.error('Error in DepartmentService.delete:', error);
      throw error;
    }
  }
}

// Export singleton instance
const departmentService = new DepartmentService();
export default departmentService;

// Named export for the class
export { DepartmentService };

// CommonJS compatibility
