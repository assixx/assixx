/**
 * Users API v2 Service
 * Contains business logic for user management
 */

import fs from "fs/promises";
import path from "path";

import bcrypt from "bcryptjs";

import { User } from "../../../models/user";
import { dbToApi, apiToDb } from "../../../utils/fieldMapping";

import {
  CreateUserBody,
  UpdateUserBody,
  UpdateProfileBody,
  UpdateAvailabilityBody,
  UserDbFields,
  ListUsersQuery,
} from "./users.types";

/**
 * Service Error class for consistent error handling
 */
export class ServiceError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/**
 * Helper to remove sensitive fields from user objects
 */
const sanitizeUser = <T extends Record<string, unknown>>(
  user: T,
): Omit<
  T,
  | "password"
  | "password_reset_token"
  | "password_reset_expires"
  | "two_factor_secret"
> => {
  const sanitized = { ...user };
  delete (sanitized as Record<string, unknown>).password;
  delete (sanitized as Record<string, unknown>).password_reset_token;
  delete (sanitized as Record<string, unknown>).password_reset_expires;
  delete (sanitized as Record<string, unknown>).two_factor_secret;
  return sanitized as Omit<
    T,
    | "password"
    | "password_reset_token"
    | "password_reset_expires"
    | "two_factor_secret"
  >;
};

/**
 * Users Service Class
 */
export class UsersService {
  /**
   * List users with pagination and filters
   */
  async listUsers(tenantId: number, query: ListUsersQuery) {
    const page = parseInt(query.page ?? "1");
    const limit = parseInt(query.limit ?? "20");
    const search = query.search;
    const role = query.role;
    const isActive =
      query.isActive === "true"
        ? true
        : query.isActive === "false"
          ? false
          : undefined;
    const isArchived =
      query.isArchived === "true"
        ? true
        : query.isArchived === "false"
          ? false
          : undefined;
    const sortBy = query.sortBy ?? "created_at";
    const sortOrder = query.sortOrder ?? "desc";

    // Build filters
    const filters: UserDbFields = {
      tenant_id: tenantId,
    };

    if (role) filters.role = role;
    if (isActive !== undefined) filters.is_active = isActive;
    if (isArchived !== undefined) filters.is_archived = isArchived;

    // Get total count
    const total = await User.countWithFilters(filters);

    // Get users
    const searchFilters = {
      ...filters,
      search,
      limit,
      page,
      sort_by: sortBy,
      sort_dir: sortOrder as "asc" | "desc",
    };
    const users = await User.search(searchFilters);

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
   */
  async getUserById(userId: number, tenantId: number) {
    const user = await User.findById(userId, tenantId);

    if (!user) {
      throw new ServiceError("NOT_FOUND", "User not found", 404);
    }

    return dbToApi(sanitizeUser(user));
  }

  /**
   * Create new user
   */
  async createUser(userData: CreateUserBody, tenantId: number) {
    // Check if email already exists within the same tenant
    const existingUser = await User.findByEmail(userData.email, tenantId);
    if (existingUser) {
      throw new ServiceError("CONFLICT", "Email already exists", 409);
    }

    // Generate employee number if not provided
    const employeeNumber = userData.employeeNumber ?? `EMP${Date.now()}`;

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
      const userId = await User.create(
        dbUserData as Parameters<typeof User.create>[0],
      );

      // Fetch complete user data
      const createdUser = await User.findById(userId, tenantId);

      if (!createdUser) {
        throw new ServiceError(
          "SERVER_ERROR",
          "Failed to retrieve created user",
          500,
        );
      }

      return dbToApi(sanitizeUser(createdUser));
    } catch (error) {
      // Handle database errors
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "ER_DUP_ENTRY"
      ) {
        const message = error.message ?? "";
        const field = message.includes("email")
          ? "Email"
          : message.includes("username")
            ? "Username"
            : message.includes("phone")
              ? "Phone number"
              : message.includes("employee_id")
                ? "Employee ID"
                : "Field";

        throw new ServiceError("CONFLICT", `${field} already exists`, 409);
      }
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(
    userId: number,
    updateData: UpdateUserBody,
    tenantId: number,
  ) {
    // Check if user exists
    const user = await User.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError("NOT_FOUND", "User not found", 404);
    }

    // Convert from camelCase to snake_case
    const dbUpdateData = apiToDb(
      updateData as Record<string, unknown>,
    ) as Record<string, unknown>;

    // Remove fields that shouldn't be updated this way
    delete dbUpdateData.password;
    delete dbUpdateData.tenant_id;
    delete dbUpdateData.created_at;

    try {
      // Update user
      await User.update(userId, dbUpdateData, tenantId);

      // Fetch updated user
      const updatedUser = await User.findById(userId, tenantId);

      if (!updatedUser) {
        throw new ServiceError(
          "SERVER_ERROR",
          "Failed to retrieve updated user",
          500,
        );
      }

      return dbToApi(sanitizeUser(updatedUser));
    } catch (error) {
      // Handle database errors
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "ER_DUP_ENTRY"
      ) {
        const message = error.message ?? "";
        const field = message.includes("email")
          ? "Email"
          : message.includes("phone")
            ? "Phone number"
            : "Field";

        throw new ServiceError("CONFLICT", `${field} already exists`, 409);
      }
      throw error;
    }
  }

  /**
   * Update user profile (limited fields)
   */
  async updateProfile(
    userId: number,
    profileData: UpdateProfileBody,
    tenantId: number,
  ) {
    // Convert from camelCase to snake_case
    const dbUpdateData = apiToDb(
      profileData as Record<string, unknown>,
    ) as Record<string, unknown>;

    // Only allow specific fields to be updated
    const allowedFields = [
      "first_name",
      "last_name",
      "phone",
      "address",
      "emergency_contact",
      "emergency_phone",
    ];
    const filteredData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (dbUpdateData[field] !== undefined) {
        filteredData[field] = dbUpdateData[field];
      }
    }

    try {
      // Update user
      await User.update(userId, filteredData, tenantId);

      // Fetch updated user
      const updatedUser = await User.findById(userId, tenantId);

      if (!updatedUser) {
        throw new ServiceError(
          "SERVER_ERROR",
          "Failed to retrieve updated user",
          500,
        );
      }

      return dbToApi(sanitizeUser(updatedUser));
    } catch (error) {
      // Handle database errors
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "ER_DUP_ENTRY"
      ) {
        throw new ServiceError("CONFLICT", "Phone number already exists", 409);
      }
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: number,
    tenantId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    // Verify current password and change it
    const result = await User.changePassword(
      userId,
      tenantId,
      currentPassword,
      newPassword,
    );

    if (!result.success) {
      throw new ServiceError(
        "UNAUTHORIZED",
        "Current password is incorrect",
        401,
      );
    }

    return true;
  }

  /**
   * Delete user
   */
  async deleteUser(userId: number, currentUserId: number, tenantId: number) {
    // Check if user exists
    const user = await User.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError("NOT_FOUND", "User not found", 404);
    }

    // Prevent deleting yourself
    if (userId === currentUserId) {
      throw new ServiceError(
        "BAD_REQUEST",
        "Cannot delete your own account",
        400,
      );
    }

    // Delete user
    await User.delete(userId);
    return true;
  }

  /**
   * Archive user
   */
  async archiveUser(userId: number, tenantId: number) {
    // Check if user exists
    const user = await User.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError("NOT_FOUND", "User not found", 404);
    }

    // Archive user
    await User.archiveUser(userId, tenantId);
    return true;
  }

  /**
   * Unarchive user
   */
  async unarchiveUser(userId: number, tenantId: number) {
    // Check if user exists (including archived)
    const user = await User.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError("NOT_FOUND", "User not found", 404);
    }

    // Unarchive user
    await User.unarchiveUser(userId, tenantId);
    return true;
  }

  /**
   * Get profile picture path
   */
  async getProfilePicturePath(userId: number, tenantId: number) {
    const user = await User.findById(userId, tenantId);

    if (!user?.profile_picture) {
      throw new ServiceError("NOT_FOUND", "Profile picture not found", 404);
    }

    const filePath = path.join(process.cwd(), user.profile_picture);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new ServiceError(
        "NOT_FOUND",
        "Profile picture file not found",
        404,
      );
    }

    return filePath;
  }

  /**
   * Update profile picture
   */
  async updateProfilePicture(
    userId: number,
    filePath: string,
    tenantId: number,
  ) {
    const relativePath = path.relative(process.cwd(), filePath);

    // Update user profile picture
    await User.updateProfilePicture(userId, relativePath, tenantId);

    // Fetch updated user
    const updatedUser = await User.findById(userId, tenantId);

    if (!updatedUser) {
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to retrieve updated user",
        500,
      );
    }

    return dbToApi(sanitizeUser(updatedUser));
  }

  /**
   * Delete profile picture
   */
  async deleteProfilePicture(userId: number, tenantId: number) {
    const user = await User.findById(userId, tenantId);

    if (!user?.profile_picture) {
      throw new ServiceError("NOT_FOUND", "No profile picture to delete", 404);
    }

    // Delete file
    const filePath = path.join(process.cwd(), user.profile_picture);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error("Failed to delete profile picture file:", error);
    }

    // Update database
    await User.updateProfilePicture(userId, "", tenantId);
    return true;
  }

  /**
   * Update user availability
   */
  async updateAvailability(
    userId: number,
    availabilityData: UpdateAvailabilityBody,
    tenantId: number,
  ) {
    // Check if user exists
    const user = await User.findById(userId, tenantId);
    if (!user) {
      throw new ServiceError("NOT_FOUND", "User not found", 404);
    }

    // Update availability
    await User.updateAvailability(userId, tenantId, {
      availability_status: availabilityData.availabilityStatus,
      availability_start: availabilityData.availabilityStart ?? undefined,
      availability_end: availabilityData.availabilityEnd ?? undefined,
      availability_notes: availabilityData.availabilityNotes ?? undefined,
    });

    // Fetch updated user
    const updatedUser = await User.findById(userId, tenantId);

    if (!updatedUser) {
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to retrieve updated user",
        500,
      );
    }

    return dbToApi(sanitizeUser(updatedUser));
  }
}

// Export singleton instance
export const usersService = new UsersService();
