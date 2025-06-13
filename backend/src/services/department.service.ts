/**
 * Department Service
 * Handles department-related business logic
 */

import Department from '../models/department';
import { Pool } from 'mysql2/promise';

// Import types from Department model
import type {
  DbDepartment as DepartmentData,
  DepartmentCreateData,
  DepartmentUpdateData,
} from '../models/department';

// Service-specific interfaces
interface DepartmentFilters {
  search?: string;
  manager_id?: number;
  parent_id?: number;
  include_counts?: boolean;
  limit?: number;
  offset?: number;
}

class DepartmentService {
  /**
   * Holt alle Department Einträge für einen Tenant
   */
  async getAll(
    _tenantDb: Pool,
    tenantId: number,
    _filters: DepartmentFilters = {}
  ): Promise<DepartmentData[]> {
    try {
      // Note: Department.findAll doesn't support limit/offset yet
      // TODO: Add pagination support to Department model
      return await Department.findAll(tenantId);
    } catch (error) {
      console.error('Error in DepartmentService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Department Eintrag per ID
   */
  async getById(
    _tenantDb: Pool,
    id: number,
    tenantId: number
  ): Promise<DepartmentData | null> {
    try {
      return await Department.findById(id, tenantId);
    } catch (error) {
      console.error('Error in DepartmentService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Department Eintrag
   */
  async create(
    _tenantDb: Pool,
    data: DepartmentCreateData
  ): Promise<DepartmentData> {
    try {
      const id = await Department.create(data);
      const created = await Department.findById(id, data.tenant_id);
      if (!created) {
        throw new Error('Failed to retrieve created department');
      }
      return created;
    } catch (error) {
      console.error('Error in DepartmentService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Department Eintrag
   */
  async update(
    _tenantDb: Pool,
    id: number,
    tenantId: number,
    data: DepartmentUpdateData
  ): Promise<DepartmentData | null> {
    try {
      const success = await Department.update(id, data);
      if (success) {
        return await Department.findById(id, tenantId);
      }
      return null;
    } catch (error) {
      console.error('Error in DepartmentService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Department Eintrag
   */
  async delete(_tenantDb: Pool, id: number): Promise<boolean> {
    try {
      return await Department.delete(id);
    } catch (error) {
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
