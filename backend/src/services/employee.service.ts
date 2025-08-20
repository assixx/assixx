/**
 * Employee Service
 * Handles employee-related business logic
 *
 * NOTE: This service currently imports '../models/employee' which doesn't exist.
 * It should probably use '../models/user' instead.
 * This needs to be fixed in a separate refactoring step.
 */
// TODO: Fix import - employee model doesn't exist, using user model instead
import { Pool } from 'mysql2/promise';

import User, { DbUser, UserCreateData, UserFilter } from '../models/user';

/**
 * Employee Service
 * Handles employee-related business logic
 *
 * NOTE: This service currently imports '../models/employee' which doesn't exist.
 * It should probably use '../models/user' instead.
 * This needs to be fixed in a separate refactoring step.
 */

// TODO: Fix import - employee model doesn't exist, using user model instead

// Interfaces
// Re-export types from User model for consistency
// Map employee-specific types to User model types
type EmployeeData = DbUser;
type EmployeeCreateData = UserCreateData;
type EmployeeUpdateData = Partial<UserCreateData>;
type EmployeeFilters = UserFilter;

// NOTE: Class is named UserService but exported as employee service
// This naming inconsistency should be fixed
/**
 *
 */
class UserService {
  /**
   * Holt alle User Einträge für einen Tenant
   * @param _tenantDb
   * @param filters
   */
  async getAll(_tenantDb: Pool, filters: EmployeeFilters): Promise<EmployeeData[]> {
    try {
      // Use the search method which supports filtering
      return await User.search(filters);
    } catch (error: unknown) {
      console.error('Error in UserService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen User Eintrag per ID
   * @param _tenantDb
   * @param id
   * @param tenantId
   */
  async getById(_tenantDb: Pool, id: number, tenantId: number): Promise<EmployeeData | null> {
    try {
      const user = await User.findById(id, tenantId);
      return user ?? null;
    } catch (error: unknown) {
      console.error('Error in UserService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen User Eintrag
   * @param _tenantDb
   * @param data
   */
  async create(_tenantDb: Pool, data: EmployeeCreateData): Promise<EmployeeData> {
    try {
      if (data.tenant_id == null || data.tenant_id === 0) {
        throw new Error('Tenant ID is required for user creation');
      }
      const id = await User.create(data);
      const created = await User.findById(id, data.tenant_id);
      if (!created) {
        throw new Error('Failed to retrieve created user');
      }
      return created;
    } catch (error: unknown) {
      console.error('Error in UserService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen User Eintrag
   * @param _tenantDb
   * @param id
   * @param tenantId
   * @param data
   */
  async update(
    _tenantDb: Pool,
    id: number,
    tenantId: number,
    data: EmployeeUpdateData,
  ): Promise<EmployeeData | null> {
    try {
      const success = await User.update(id, data, tenantId);
      if (success) {
        const updated = await User.findById(id, tenantId);
        return updated ?? null;
      }
      return null;
    } catch (error: unknown) {
      console.error('Error in UserService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen User Eintrag
   * @param _tenantDb
   * @param id
   */
  async delete(_tenantDb: Pool, id: number): Promise<boolean> {
    try {
      return await User.delete(id);
    } catch (error: unknown) {
      console.error('Error in UserService.delete:', error);
      throw error;
    }
  }
}

// Export singleton instance - keeping the naming inconsistency for backward compatibility
const employeeService = new UserService();
export default employeeService;

// Named export for the class
export { UserService as EmployeeService };

// CommonJS compatibility
