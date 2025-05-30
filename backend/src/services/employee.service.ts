/**
 * Employee Service
 * Handles employee-related business logic
 *
 * NOTE: This service currently imports '../models/employee' which doesn't exist.
 * It should probably use '../models/user' instead.
 * This needs to be fixed in a separate refactoring step.
 */

// TODO: Fix import - employee model doesn't exist, using user model instead
import User from '../models/user';
import { Pool } from 'mysql2/promise';

// Interfaces
// Re-export types from User model for consistency
import type {
  DbUser as EmployeeData,
  UserCreateData,
  UserFilter,
} from '../models/user';

// Map employee-specific types to User model types
type EmployeeCreateData = UserCreateData;
type EmployeeUpdateData = Partial<UserCreateData>;
type EmployeeFilters = UserFilter;

// NOTE: Class is named UserService but exported as employee service
// This naming inconsistency should be fixed
class UserService {
  /**
   * Holt alle User Einträge für einen Tenant
   */
  async getAll(
    _tenantDb: Pool,
    filters: EmployeeFilters = {}
  ): Promise<EmployeeData[]> {
    try {
      // Use the search method which supports filtering
      return await User.search(filters);
    } catch (error) {
      console.error('Error in UserService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen User Eintrag per ID
   */
  async getById(_tenantDb: Pool, id: number): Promise<EmployeeData | null> {
    try {
      const user = await User.findById(id);
      return user || null;
    } catch (error) {
      console.error('Error in UserService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen User Eintrag
   */
  async create(
    _tenantDb: Pool,
    data: EmployeeCreateData
  ): Promise<EmployeeData> {
    try {
      const id = await User.create(data);
      const created = await User.findById(id);
      if (!created) {
        throw new Error('Failed to retrieve created user');
      }
      return created;
    } catch (error) {
      console.error('Error in UserService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen User Eintrag
   */
  async update(
    _tenantDb: Pool,
    id: number,
    data: EmployeeUpdateData
  ): Promise<EmployeeData | null> {
    try {
      const success = await User.update(id, data);
      if (success) {
        const updated = await User.findById(id);
        return updated || null;
      }
      return null;
    } catch (error) {
      console.error('Error in UserService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen User Eintrag
   */
  async delete(_tenantDb: Pool, id: number): Promise<boolean> {
    try {
      return await User.delete(id);
    } catch (error) {
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
