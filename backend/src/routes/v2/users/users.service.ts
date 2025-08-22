/**
 * Users API v2 Service
 * Contains business logic for user management
 */
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';

import userModel from '../../../models/user';
import { apiToDb, dbToApi } from '../../../utils/fieldMapping';
import {
  CreateUserBody,
  ListUsersQuery,
  UpdateAvailabilityBody,
  UpdateProfileBody,
  UpdateUserBody,
  UserDbFields,
} from './users.types';

/**
 * Service Error class for consistent error handling
 */
export class ServiceError extends Error {
  /**
   *
   * @param code - The code parameter
   * @param message - The message parameter
   * @param statusCode - The statusCode parameter
   * @param details - The details parameter
   */
  constructor(
    public code: string,
    public message: string,
    public statusCode = 500,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Helper to remove sensitive fields from user objects
 * @param user - The user parameter
 */
const sanitizeUser = <T extends Record<string, unknown>>(
  user: T,
): Omit<
  T,
  'password' | 'password_reset_token' | 'password_reset_expires' | 'two_factor_secret'
> => {
  const sanitized = { ...user };
  delete (sanitized as Record<string, unknown>).password;
  delete (sanitized as Record<string, unknown>).password_reset_token;
  delete (sanitized as Record<string, unknown>).password_reset_expires;
  delete (sanitized as Record<string, unknown>).two_factor_secret;
  return sanitized as Omit<
    T,
    'password' | 'password_reset_token' | 'password_reset_expires' | 'two_factor_secret'
  >;
};

/**
 * Users Service Class
 */
export class UsersService {
  /**
   * List users with pagination and filters
   * @param tenantId - The tenant ID
   * @param query - The query parameters
   */
  async listUsers(tenantId: number, query: ListUsersQuery): Promise<unknown> {
    const page = Number.parseInt(query.page ?? '1', 10);
    const limit = Number.parseInt(query.limit ?? '20', 10);
    const search = query.search;
    const role = query.role;
    const isActive =
      query.isActive === 'true' ? true
      : query.isActive === 'false' ? false
      : undefined;
    const isArchived =
      query.isArchived === 'true' ? true
      : query.isArchived === 'false' ? false
      : undefined;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    // Build filters
    const filters: UserDbFields = {
      tenant_id: tenantId,
    };

    if (role !== undefined && role !== '') filters.role = role;
    if (isActive !== undefined) filters.is_active = isActive;
    if (isArchived !== undefined) filters.is_archived = isArchived;

    // Get total count
    const total = await userModel.countWithFilters(filters);

    // Get users
    const searchFilters = {
      ...filters,
      search,
      limit,
      page,
      sort_by: sortBy,
      sort_dir: sortOrder,
    };
    const users = await userModel.search(searchFilters);

    // Sanitize and convert to camelCase
    const sanitizedUsers = users.map((user) => dbToApi(sanitizeUser(user)));

    return {
      data: sanitizedUsers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit,
        totalItems: total,
      },
    };
  }

  /**
   * Get user by ID
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async getUserById(userId: number, tenantId: number): Promise<unknown> {
    const user = await userModel.findById(userId, tenantId);

    if (!user) {
      throw new ServiceError('NOT_FOUND', 'User not found', 404);
    }

    return dbToApi(sanitizeUser(user));
  }

  /**
   * Create new user
   * @param userData - The userData parameter
   * @param tenantId - The tenant ID
   */
  async createUser(userData: CreateUserBody, tenantId: number): Promise<unknown> {
    // Check if email already exists within the same tenant
    const existingUser = await userModel.findByEmail(userData.email, tenantId);
    if (existingUser) {
      throw new ServiceError('CONFLICT', 'Email already exists', 409);
    }

    // Generate employee number if not provided
    const employeeNumber = userData.employeeNumber ?? `EMP${String(Date.now())}`;

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Convert from camelCase to snake_case
    const dbUserData = apiToDb({
      ...userData,
      tenantId,
      password: hashedPassword,
      employeeNumber,
      username: userData.email, // Email is used as username
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      // Create user - returns the new user ID
      const userId = await userModel.create(
        dbUserData as unknown as Parameters<typeof userModel.create>[0],
      );

      // Fetch complete user data
      const createdUser = await userModel.findById(userId, tenantId);

      if (!createdUser) {
        throw new ServiceError('SERVER_ERROR', 'Failed to retrieve created user', 500);
      }

      return dbToApi(sanitizeUser(createdUser));
    } catch (error: unknown) {
      // Handle database errors
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'ER_DUP_ENTRY'
      ) {
        const message = error.message;
        const field =
          message.includes('email') ? 'Email'
          : message.includes('username') ? 'Username'
          : message.includes('employee_number') ? 'Employee number'
          : message.includes('employee_id') ? 'Employee ID'
          : 'Field';

        throw new ServiceError('CONFLICT', `${field} already exists`, 409);
      }
      throw error;
    }
  }

  /**
   * Update user
   * @param userId - The user ID
   * @param updateData - The updateData parameter
   * @param tenantId - The tenant ID
   */
  async updateUser(userId: number, updateData: UpdateUserBody, tenantId: number): Promise<unknown> {
    // Check if user exists
    const user = await userModel.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError('NOT_FOUND', 'User not found', 404);
    }

    // Convert from camelCase to snake_case
    const dbUpdateData = apiToDb(updateData as Record<string, unknown>);

    // Remove fields that shouldn't be updated this way
    delete dbUpdateData.password;
    delete dbUpdateData.tenant_id;
    delete dbUpdateData.created_at;

    try {
      // Update user
      await userModel.update(userId, dbUpdateData, tenantId);

      // Fetch updated user
      const updatedUser = await userModel.findById(userId, tenantId);

      if (!updatedUser) {
        throw new ServiceError('SERVER_ERROR', 'Failed to retrieve updated user', 500);
      }

      return dbToApi(sanitizeUser(updatedUser));
    } catch (error: unknown) {
      // Handle database errors
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'ER_DUP_ENTRY'
      ) {
        const message = error.message;
        const field =
          message.includes('email') ? 'Email'
          : message.includes('employee_number') ? 'Employee number'
          : 'Field';

        throw new ServiceError('CONFLICT', `${field} already exists`, 409);
      }
      throw error;
    }
  }

  /**
   * Update user profile (limited fields)
   * @param userId - The user ID
   * @param profileData - The profileData parameter
   * @param tenantId - The tenant ID
   */
  async updateProfile(
    userId: number,
    profileData: UpdateProfileBody,
    tenantId: number,
  ): Promise<unknown> {
    // Convert from camelCase to snake_case
    const dbUpdateData = apiToDb(profileData as Record<string, unknown>);

    // Only allow specific fields to be updated
    const filteredData: Record<string, unknown> = {};

    // Use explicit property assignment to avoid object injection
    if (dbUpdateData.first_name !== undefined) {
      filteredData.first_name = dbUpdateData.first_name;
    }
    if (dbUpdateData.last_name !== undefined) {
      filteredData.last_name = dbUpdateData.last_name;
    }
    if (dbUpdateData.phone !== undefined) {
      filteredData.phone = dbUpdateData.phone;
    }
    if (dbUpdateData.address !== undefined) {
      filteredData.address = dbUpdateData.address;
    }
    if (dbUpdateData.emergency_contact !== undefined) {
      filteredData.emergency_contact = dbUpdateData.emergency_contact;
    }
    if (dbUpdateData.emergency_phone !== undefined) {
      filteredData.emergency_phone = dbUpdateData.emergency_phone;
    }
    if (dbUpdateData.employee_number !== undefined) {
      filteredData.employee_number = dbUpdateData.employee_number;
    }

    try {
      // Update user
      await userModel.update(userId, filteredData, tenantId);

      // Fetch updated user
      const updatedUser = await userModel.findById(userId, tenantId);

      if (!updatedUser) {
        throw new ServiceError('SERVER_ERROR', 'Failed to retrieve updated user', 500);
      }

      return dbToApi(sanitizeUser(updatedUser));
    } catch (error: unknown) {
      // Handle database errors
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'ER_DUP_ENTRY'
      ) {
        // Parse the error message to determine which field is duplicate
        const errorMessage = (error as { message?: string }).message ?? '';
        if (errorMessage.includes('email')) {
          throw new ServiceError('CONFLICT', 'Email already exists', 409);
        } else if (errorMessage.includes('employee_number')) {
          throw new ServiceError('CONFLICT', 'Employee number already exists', 409);
        } else {
          throw new ServiceError('CONFLICT', 'Duplicate field value', 409);
        }
      }
      throw error;
    }
  }

  /**
   * Change user password
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   * @param currentPassword - The currentPassword parameter
   * @param newPassword - The newPassword parameter
   */
  async changePassword(
    userId: number,
    tenantId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // Verify current password and change it
    const result = await userModel.changePassword(userId, tenantId, currentPassword, newPassword);

    if (!result.success) {
      throw new ServiceError('UNAUTHORIZED', 'Current password is incorrect', 401);
    }

    return { message: 'Password changed successfully' };
  }

  /**
   * Delete user
   * @param userId - The user ID
   * @param currentUserId - The currentUserId parameter
   * @param tenantId - The tenant ID
   */
  async deleteUser(
    userId: number,
    currentUserId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    // Check if user exists
    const user = await userModel.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError('NOT_FOUND', 'User not found', 404);
    }

    // Prevent deleting yourself
    if (userId === currentUserId) {
      throw new ServiceError('BAD_REQUEST', 'Cannot delete your own account', 400);
    }

    // Delete user
    await userModel.delete(userId);
    return { message: 'User deleted successfully' };
  }

  /**
   * Archive user
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async archiveUser(userId: number, tenantId: number): Promise<{ message: string }> {
    // Check if user exists
    const user = await userModel.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError('NOT_FOUND', 'User not found', 404);
    }

    // Archive user
    await userModel.archiveUser(userId, tenantId);
    return { message: 'User archived successfully' };
  }

  /**
   * Unarchive user
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async unarchiveUser(userId: number, tenantId: number): Promise<{ message: string }> {
    // Check if user exists (including archived)
    const user = await userModel.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError('NOT_FOUND', 'User not found', 404);
    }

    // Unarchive user
    await userModel.unarchiveUser(userId, tenantId);
    return { message: 'User unarchived successfully' };
  }

  /**
   * Get profile picture path
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async getProfilePicturePath(userId: number, tenantId: number): Promise<string | null> {
    const user = await userModel.findById(userId, tenantId);

    if (!user) {
      throw new ServiceError('NOT_FOUND', 'User not found', 404);
    }

    if (user.profile_picture === undefined || user.profile_picture === '') {
      throw new ServiceError('NOT_FOUND', 'Profile picture not found', 404);
    }

    const filePath = path.join(process.cwd(), user.profile_picture);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new ServiceError('NOT_FOUND', 'Profile picture file not found', 404);
    }

    return filePath;
  }

  /**
   * Update profile picture
   * @param userId - The user ID
   * @param filePath - The filePath parameter
   * @param tenantId - The tenant ID
   */
  async updateProfilePicture(
    userId: number,
    filePath: string,
    tenantId: number,
  ): Promise<{ picturePath: string }> {
    const relativePath = path.relative(process.cwd(), filePath);

    // Update user profile picture
    await userModel.updateProfilePicture(userId, relativePath, tenantId);

    // Fetch updated user
    const updatedUser = await userModel.findById(userId, tenantId);

    if (!updatedUser) {
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve updated user', 500);
    }

    return { picturePath: relativePath };
  }

  /**
   * Delete profile picture
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  async deleteProfilePicture(userId: number, tenantId: number): Promise<{ message: string }> {
    const user = await userModel.findById(userId, tenantId);

    if (!user) {
      throw new ServiceError('NOT_FOUND', 'User not found', 404);
    }

    if (user.profile_picture === undefined || user.profile_picture === '') {
      throw new ServiceError('NOT_FOUND', 'No profile picture to delete', 404);
    }

    // Delete file - validate path to prevent directory traversal
    const profilePicture = user.profile_picture;
    const normalizedPath = path.normalize(profilePicture);
    if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
      throw new ServiceError('BAD_REQUEST', 'Invalid profile picture path', 400);
    }
    const filePath = path.join(process.cwd(), normalizedPath);
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.unlink(filePath);
    } catch (error: unknown) {
      console.error('Failed to delete profile picture file:', error);
    }

    // Update database
    await userModel.updateProfilePicture(userId, '', tenantId);
    return { message: 'Profile picture deleted successfully' };
  }

  /**
   * Update user availability
   * @param userId - The user ID
   * @param availabilityData - The availabilityData parameter
   * @param tenantId - The tenant ID
   */
  async updateAvailability(
    userId: number,
    availabilityData: UpdateAvailabilityBody,
    tenantId: number,
  ): Promise<{ message: string }> {
    // Check if user exists
    const user = await userModel.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError('NOT_FOUND', 'User not found', 404);
    }

    // Update availability
    await userModel.updateAvailability(userId, tenantId, {
      availability_status: availabilityData.availabilityStatus,
      availability_start: availabilityData.availabilityStart ?? undefined,
      availability_end: availabilityData.availabilityEnd ?? undefined,
      availability_notes: availabilityData.availabilityNotes ?? undefined,
    });

    // Fetch updated user
    const updatedUser = await userModel.findById(userId, tenantId);

    if (!updatedUser) {
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve updated user', 500);
    }

    return { message: 'Availability updated successfully' };
  }
}

// Export singleton instance
export const usersService = new UsersService();
