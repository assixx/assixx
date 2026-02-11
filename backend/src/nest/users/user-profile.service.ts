/**
 * User Profile Service
 *
 * Self-service operations for authenticated users:
 * - Update own profile (limited fields)
 * - Change own password
 * - Profile picture management (get, upload, delete)
 *
 * Extracted from UsersService for separation of concerns:
 * - UsersService: Admin CRUD operations (list, create, update, delete, archive)
 * - UserProfileService: Self-service operations (profile, password, pictures)
 */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import { promises as fs } from 'fs';
import path from 'path';

import { DatabaseService } from '../database/database.service.js';
import { UserRepository } from '../database/repositories/user.repository.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import { toSafeUserResponse } from './users.helpers.js';
import type { SafeUserResponse, UserRow } from './users.types.js';

/**
 * Error message constants
 */
const ERROR_MESSAGES = {
  USER_NOT_FOUND: 'User not found',
  INVALID_PASSWORD: 'Invalid current password',
} as const;

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly userRepository: UserRepository,
  ) {}

  // ============================================
  // Profile Update
  // ============================================

  /**
   * Update user profile (limited fields for self-update)
   */
  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
    tenantId: number,
  ): Promise<SafeUserResponse> {
    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (dto.firstName !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      params.push(dto.firstName);
      paramIndex++;
    }
    if (dto.lastName !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      params.push(dto.lastName);
      paramIndex++;
    }
    if (dto.phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      params.push(dto.phone);
      paramIndex++;
    }
    if (dto.address !== undefined) {
      updates.push(`address = $${paramIndex}`);
      params.push(dto.address);
      paramIndex++;
    }
    if (dto.emergencyContact !== undefined) {
      updates.push(`emergency_contact = $${paramIndex}`);
      params.push(dto.emergencyContact);
      paramIndex++;
    }
    if (dto.employeeNumber !== undefined) {
      updates.push(`employee_number = $${paramIndex}`);
      params.push(dto.employeeNumber);
      paramIndex++;
    }

    if (params.length > 0) {
      params.push(userId, tenantId);
      await this.databaseService.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}`,
        params,
      );
    }

    const updatedUser = await this.findUserById(userId, tenantId);
    if (updatedUser === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return toSafeUserResponse(updatedUser);
  }

  // ============================================
  // Password Change
  // ============================================

  /**
   * Change password (self-service)
   */
  async changePassword(
    userId: number,
    tenantId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // SECURITY: Get password hash for ACTIVE users only (is_active = 1)
    const passwordHash = await this.userRepository.getPasswordHash(
      userId,
      tenantId,
    );

    if (passwordHash === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Verify current password
    const isValid = await bcryptjs.compare(currentPassword, passwordHash);
    if (!isValid) {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_PASSWORD);
    }

    // Hash and update new password
    const hashedPassword = await bcryptjs.hash(newPassword, 12);
    await this.databaseService.query(
      `UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [hashedPassword, userId, tenantId],
    );

    // SECURITY: Revoke all refresh tokens to force re-login on all sessions
    const result = await this.databaseService.query<{ count: string }>(
      `WITH updated AS (
         UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND tenant_id = $2 RETURNING 1
       )
       SELECT COUNT(*) as count FROM updated`,
      [userId, tenantId],
    );
    const revokedCount = Number.parseInt(result[0]?.count ?? '0', 10);
    this.logger.log(
      `Password changed for user ${userId}: revoked ${revokedCount} refresh tokens`,
    );

    return { message: 'Password changed successfully' };
  }

  // ============================================
  // Profile Picture Methods
  // ============================================

  /**
   * Get profile picture path
   */
  async getProfilePicturePath(
    userId: number,
    tenantId: number,
  ): Promise<string> {
    const user = await this.findUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (user.profile_picture === null || user.profile_picture === '') {
      throw new NotFoundException('Profile picture not found');
    }

    const filePath = path.join(process.cwd(), user.profile_picture);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('Profile picture file not found');
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
  ): Promise<SafeUserResponse> {
    const user = await this.findUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Store relative path in DB
    const relativePath = path.relative(process.cwd(), filePath);

    await this.databaseService.query(
      `UPDATE users SET profile_picture = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [relativePath, userId, tenantId],
    );

    // Fetch and return updated user
    const updatedUser = await this.findUserById(userId, tenantId);
    if (updatedUser === null) {
      throw new InternalServerErrorException('Failed to retrieve updated user');
    }

    return toSafeUserResponse(updatedUser);
  }

  /**
   * Delete profile picture
   */
  async deleteProfilePicture(
    userId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    const user = await this.findUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (user.profile_picture === null || user.profile_picture === '') {
      throw new NotFoundException('No profile picture to delete');
    }

    // Validate path to prevent directory traversal
    const profilePicture = user.profile_picture;
    const normalizedPath = path.normalize(profilePicture);
    if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
      throw new BadRequestException('Invalid profile picture path');
    }

    // Delete file from disk
    const filePath = path.join(process.cwd(), normalizedPath);
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated above
      await fs.unlink(filePath);
    } catch (error: unknown) {
      // Log but don't fail if file doesn't exist
      this.logger.warn('Failed to delete profile picture file', {
        filePath,
        error,
      });
    }

    // Clear DB field
    await this.databaseService.query(
      `UPDATE users SET profile_picture = NULL, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    return { message: 'Profile picture deleted successfully' };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Find user by ID
   * SECURITY: Only returns ACTIVE users (is_active = 1)
   */
  private async findUserById(
    userId: number,
    tenantId: number,
  ): Promise<UserRow | null> {
    const rows = await this.databaseService.query<UserRow>(
      `SELECT id, uuid, tenant_id, email, role, username, first_name, last_name,
              is_active, last_login, created_at, updated_at,
              phone, address, position, employee_number, profile_picture,
              emergency_contact, date_of_birth,
              has_full_access
       FROM users
       WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [userId, tenantId],
    );

    return rows[0] ?? null;
  }
}
