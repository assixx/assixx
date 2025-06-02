/**
 * User Service
 * Handles user-related business logic
 */

import * as bcrypt from "bcrypt";
import User from "../models/user";
import { logger } from "../utils/logger";

// Type alias for User model return type
type DbUser = any;

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

class UserService {
  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<UserData | null> {
    try {
      const user = await User.findById(userId);

      if (user) {
        // Remove sensitive data
        delete (user as any).password;

        // Ensure tenant_id is present (required field)
        if (!user.tenant_id) {
          logger.error(`User ${userId} has no tenant_id`);
          return null;
        }

        return user as UserData;
      }

      return null;
    } catch (error) {
      logger.error("Error getting user by ID:", error);
      throw error;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<UserData | null> {
    try {
      const user = await User.findByUsername(username);

      if (user) {
        // Ensure tenant_id is present (required field)
        if (!user.tenant_id) {
          logger.error(`User ${username} has no tenant_id`);
          return null;
        }

        return user as UserData;
      }

      return null;
    } catch (error) {
      logger.error("Error getting user by username:", error);
      throw error;
    }
  }

  /**
   * Get all users with pagination
   */
  async getUsers(options: GetUsersOptions = {}): Promise<UsersResponse> {
    try {
      const { page = 1, limit = 10, role, tenantId } = options;
      // const offset = (page - 1) * limit; // Not used by User.findAll

      const users = (await User.findAll({
        limit,
        // offset, // offset is not part of UserFilter
        role,
        tenantId,
      })) as DbUser[];

      // Map to response format
      const total = users.length; // Would need proper count from DB
      const totalPages = Math.ceil(total / limit);

      const data = users.map((user: DbUser) => {
        const userData = user as any;
        delete userData.password;
        return userData as UserData;
      });

      return {
        data,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error("Error getting users:", error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUser(
    userId: number,
    updateData: UpdateUserData,
  ): Promise<UserData | null> {
    try {
      // Create a clean update object without forbidden fields
      const cleanUpdateData: any = { ...updateData };

      // These deletions are redundant due to TypeScript types, but kept for runtime safety
      delete cleanUpdateData.id;
      delete cleanUpdateData.password;
      delete cleanUpdateData.role;

      await User.update(userId, cleanUpdateData);
      return await this.getUserById(userId);
    } catch (error) {
      logger.error("Error updating user:", error);
      throw error;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(userId: number, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await User.update(userId, { password: hashedPassword });
      return true;
    } catch (error) {
      logger.error("Error updating password:", error);
      throw error;
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId: number): Promise<boolean> {
    try {
      await User.delete(userId);
      return true;
    } catch (error) {
      logger.error("Error deleting user:", error);
      throw error;
    }
  }

  /**
   * Archive/Unarchive user
   */
  async archiveUser(
    userId: number,
    archived: boolean = true,
  ): Promise<boolean> {
    try {
      await User.update(userId, { archived } as any);
      return true;
    } catch (error) {
      logger.error("Error archiving user:", error);
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
