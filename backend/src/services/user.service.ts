/**
 * User Service
 * Handles user-related business logic
 */
import bcrypt from 'bcryptjs';

import User from '../models/user';
import type { DbUser } from '../models/user';
import { logger } from '../utils/logger';

// Import types from User model

// Interfaces
interface UserData {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  tenant_id: number;
  department_id?: number | null;
  team_id?: number | null;
  profile_picture?: string | null;
  language?: string;
  timezone?: string;
  is_active?: boolean | number;
  archived?: boolean | number;
  last_login?: Date | null;
  created_at?: Date;
  updated_at?: Date;
  password?: string;
}

interface GetUsersOptions {
  page?: number;
  limit?: number;
  role?: string;
  tenantId?: number;
}

interface UsersResponse {
  data: UserData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UpdateUserData {
  email?: string;
  first_name?: string;
  last_name?: string;
  department_id?: number | null;
  team_id?: number | null;
  profile_picture?: string | null;
  language?: string;
  timezone?: string;
  is_active?: boolean;
  // Fields that should not be updated directly
  id?: never;
  password?: never;
  role?: never;
}

/**
 *
 */
class UserService {
  /**
   * Get user by ID
   * @param userId
   * @param tenantId
   */
  async getUserById(userId: number, tenantId: number): Promise<UserData | null> {
    try {
      const user = await User.findById(userId, tenantId);

      if (user) {
        // Remove sensitive data
        const userWithoutPassword =
          'password' in user ?
            (() => {
              const { password: _password, ...rest } = user;
              return rest;
            })()
          : user;

        // Ensure tenant_id is present (required field)
        if (userWithoutPassword.tenant_id == null || userWithoutPassword.tenant_id === 0) {
          logger.error(`User ${userId} has no tenant_id`);
          return null;
        }

        return userWithoutPassword as UserData;
      }

      return null;
    } catch (error: unknown) {
      logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Get user by username
   * @param username
   */
  async getUserByUsername(username: string): Promise<UserData | null> {
    try {
      const user = await User.findByUsername(username);

      if (user) {
        // Ensure tenant_id is present (required field)
        if (user.tenant_id == null || user.tenant_id === 0) {
          logger.error(`User ${username} has no tenant_id`);
          return null;
        }

        return user as UserData;
      }

      return null;
    } catch (error: unknown) {
      logger.error('Error getting user by username:', error);
      throw error;
    }
  }

  /**
   * Get all users with pagination
   * @param options
   */
  async getUsers(options: GetUsersOptions = {}): Promise<UsersResponse> {
    try {
      const { page = 1, limit = 10, role, tenantId } = options;
      // const offset = (page - 1) * limit; // Not used by User.findAll

      if (tenantId == null || tenantId === 0) {
        throw new Error('Tenant ID is required');
      }

      const users = await User.findAll({
        limit,
        // offset, // offset is not part of UserFilter
        role,
        tenant_id: tenantId,
      });

      // Map to response format
      const total = users.length; // Would need proper count from DB
      const totalPages = Math.ceil(total / limit);

      const data = users.map((user: DbUser) => {
        const userData =
          'password' in user ?
            (() => {
              const { password: _password, ...rest } = user;
              return rest;
            })()
          : user;
        return userData as UserData;
      });

      return {
        data,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error: unknown) {
      logger.error('Error getting users:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param userId
   * @param tenantId
   * @param updateData
   */
  async updateUser(
    userId: number,
    tenantId: number,
    updateData: UpdateUserData,
  ): Promise<UserData | null> {
    try {
      // Create a clean update object without forbidden fields
      const cleanUpdateData: Record<string, unknown> = { ...updateData };

      // These deletions are redundant due to TypeScript types, but kept for runtime safety
      delete cleanUpdateData.id;
      delete cleanUpdateData.password;
      delete cleanUpdateData.role;

      await User.update(userId, cleanUpdateData, tenantId);
      return await this.getUserById(userId, tenantId);
    } catch (error: unknown) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Update user password
   * @param userId
   * @param tenantId
   * @param newPassword
   */
  async updatePassword(userId: number, tenantId: number, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await User.update(userId, { password: hashedPassword }, tenantId);
      return true;
    } catch (error: unknown) {
      logger.error('Error updating password:', error);
      throw error;
    }
  }

  /**
   * Delete user (soft delete)
   * @param userId
   */
  async deleteUser(userId: number): Promise<boolean> {
    try {
      await User.delete(userId);
      return true;
    } catch (error: unknown) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Archive/Unarchive user
   * @param userId
   * @param tenantId
   * @param archived
   */
  async archiveUser(userId: number, tenantId: number, archived = true): Promise<boolean> {
    try {
      await User.update(userId, { is_archived: archived }, tenantId);
      return true;
    } catch (error: unknown) {
      logger.error('Error archiving user:', error);
      throw error;
    }
  }
}

// Export singleton instance
const userService = new UserService();
export default userService;

// Named export for the class
export { UserService };

// CommonJS compatibility
