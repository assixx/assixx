/**
 * Users Service
 *
 * Business logic for user management:
 * - List users with pagination and filters
 * - CRUD operations
 * - Profile management
 * - Password changes
 * - Availability tracking
 * - Profile pictures
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import { promises as fs } from 'fs';
import path from 'path';

import { fieldMapper } from '../../utils/fieldMapper.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import type { UpdateAvailabilityDto } from './dto/update-availability.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

/**
 * User row type from database
 */
export interface UserRow {
  id: number;
  tenant_id: number;
  email: string;
  password?: string;
  role: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  is_active: number;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date | null;
  phone: string | null;
  address: string | null;
  position: string | null;
  employee_number: string | null;
  profile_picture: string | null;
  emergency_contact: string | null;
  date_of_birth: string | null;
  availability_status: string | null;
  availability_start: Date | null;
  availability_end: Date | null;
  availability_notes: string | null;
  has_full_access: number | null;
}

/**
 * User department assignment row
 */
interface UserDepartmentRow {
  user_id: number;
  department_id: number;
  department_name: string;
  is_primary: boolean;
}

/**
 * Pagination result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
  };
}

/**
 * Tenant info for user response
 */
export interface TenantInfo {
  companyName: string;
  subdomain: string;
}

/**
 * Safe user response - API format (camelCase)
 * This is what gets returned to the frontend
 */
export interface SafeUserResponse {
  id: number;
  tenantId: number;
  email: string;
  role: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string | null;
  phone: string | null;
  address: string | null;
  position: string | null;
  employeeNumber: string | null;
  profilePicture: string | null;
  emergencyContact: string | null;
  dateOfBirth: string | null;
  availabilityStatus: string | null;
  availabilityStart: string | null;
  availabilityEnd: string | null;
  availabilityNotes: string | null;
  hasFullAccess: boolean | null;
  departmentIds?: number[];
  departmentNames?: string[];
  tenant?: TenantInfo;
}

/**
 * Error message constants to avoid duplication
 */
const ERROR_MESSAGES = {
  USER_NOT_FOUND: 'User not found',
  EMAIL_EXISTS: 'Email already exists',
  INVALID_PASSWORD: 'Invalid current password',
} as const;

/**
 * Valid sort fields for user queries
 */
const VALID_SORT_FIELDS = new Set(['firstName', 'lastName', 'email', 'createdAt', 'lastLogin']);

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ============================================
  // Public Methods
  // ============================================

  /**
   * List users with pagination and filters
   */
  async listUsers(
    tenantId: number,
    query: ListUsersQueryDto,
  ): Promise<PaginatedResult<SafeUserResponse>> {
    const page = query.page;
    const limit = query.limit;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (query.role !== undefined) {
      conditions.push(`role = $${paramIndex}`);
      params.push(query.role);
      paramIndex++;
    }

    if (query.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex}`);
      params.push(query.isActive);
      paramIndex++;
    }

    if (query.search !== undefined && query.search !== '') {
      conditions.push(
        `(first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`,
      );
      params.push(`%${query.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users WHERE ${whereClause}`,
      params,
    );
    const total = Number.parseInt(countResult[0]?.count ?? '0', 10);

    // Build ORDER BY clause
    const sortBy = this.mapSortField(query.sortBy ?? 'createdAt');
    const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Get users
    const users = await this.databaseService.query<UserRow>(
      `SELECT id, tenant_id, email, role, username, first_name, last_name,
              is_active, last_login, created_at, updated_at,
              phone, address, position, employee_number, profile_picture,
              emergency_contact, date_of_birth,
              availability_status, availability_start, availability_end, availability_notes,
              has_full_access
       FROM users
       WHERE ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      data: users.map((user: UserRow) => this.toSafeUserResponse(user)),
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
  async getUserById(userId: number, tenantId: number): Promise<SafeUserResponse> {
    const user = await this.findUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Get department assignments and tenant info
    const [departments, tenantInfo] = await Promise.all([
      this.getUserDepartments(userId, tenantId),
      this.getTenantInfo(tenantId),
    ]);

    const response = this.toSafeUserResponse(user);
    this.addDepartmentInfo(response, departments);

    // Add tenant info if available
    if (tenantInfo !== null) {
      response.tenant = tenantInfo;
    }

    return response;
  }

  /**
   * Create new user
   */
  async createUser(dto: CreateUserDto, tenantId: number): Promise<SafeUserResponse> {
    // Check if email already exists
    const existingUser = await this.findUserByEmail(dto.email, tenantId);
    if (existingUser !== null) {
      throw new ConflictException('Email already exists');
    }

    // Generate employee number if not provided
    const employeeNumber = dto.employeeNumber ?? `EMP${String(Date.now())}`;

    // Hash password
    const hashedPassword = await bcryptjs.hash(dto.password, 10);

    // Extract department/team arrays
    const { departmentIds, teamIds, hasFullAccess, ...userData } = dto;
    void teamIds; // Reserved for future use

    // Insert user
    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO users (
        tenant_id, email, password, username, first_name, last_name, role,
        position, phone, address, employee_number,
        is_active, has_full_access, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING id`,
      [
        tenantId,
        userData.email,
        hashedPassword,
        userData.email, // username = email
        userData.firstName,
        userData.lastName,
        userData.role,
        userData.position ?? null,
        userData.phone ?? null,
        userData.address ?? null,
        employeeNumber,
        1, // is_active = 1 (active)
        hasFullAccess === true ? 1 : 0,
      ],
    );

    const userId = result[0]?.id;
    if (userId === undefined) {
      throw new InternalServerErrorException('Failed to create user');
    }

    // Assign departments if provided
    if (Array.isArray(departmentIds) && departmentIds.length > 0) {
      await this.assignUserDepartments(userId, departmentIds, tenantId);
    }

    // Fetch and return created user
    const createdUser = await this.findUserById(userId, tenantId);
    if (createdUser === null) {
      throw new InternalServerErrorException('Failed to retrieve created user');
    }

    const departments = await this.getUserDepartments(userId, tenantId);
    const response = this.toSafeUserResponse(createdUser);
    this.addDepartmentInfo(response, departments);

    return response;
  }

  /**
   * Update user
   */
  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    tenantId: number,
  ): Promise<SafeUserResponse> {
    const existingUser = await this.findUserById(userId, tenantId);
    if (existingUser === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    await this.validateEmailUniqueness(dto.email, existingUser.email, tenantId);

    const { departmentIds, teamIds, hasFullAccess, password, ...updateData } = dto;
    void teamIds; // Reserved for future use

    await this.executeUserUpdate(userId, tenantId, updateData, hasFullAccess, password);
    await this.updateDepartmentAssignments(userId, tenantId, departmentIds);

    return await this.fetchUserWithDepartments(userId, tenantId);
  }

  /**
   * Validate email uniqueness when changing email
   */
  private async validateEmailUniqueness(
    newEmail: string | undefined,
    currentEmail: string,
    tenantId: number,
  ): Promise<void> {
    if (newEmail === undefined || newEmail === currentEmail) return;

    const emailExists = await this.findUserByEmail(newEmail, tenantId);
    if (emailExists !== null) {
      throw new ConflictException(ERROR_MESSAGES.EMAIL_EXISTS);
    }
  }

  /**
   * Execute user record update with dynamic fields
   */
  private async executeUserUpdate(
    userId: number,
    tenantId: number,
    updateData: Record<string, unknown>,
    hasFullAccess: boolean | undefined,
    password: string | undefined,
  ): Promise<void> {
    const { updates, params, paramIndex } = this.buildUpdateFields(updateData, hasFullAccess);

    let currentIndex = paramIndex;
    if (password !== undefined && password !== '') {
      const hashedPassword = await bcryptjs.hash(password, 10);
      updates.push(`password = $${currentIndex}`);
      params.push(hashedPassword);
      currentIndex++;
    }

    if (params.length === 0) return;

    params.push(userId, tenantId);
    await this.databaseService.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${currentIndex} AND tenant_id = $${currentIndex + 1}`,
      params,
    );
  }

  /**
   * Build update fields and params from DTO data
   */
  private buildUpdateFields(
    data: Record<string, unknown>,
    hasFullAccess: boolean | undefined,
  ): { updates: string[]; params: unknown[]; paramIndex: number } {
    const fieldMap: Record<string, string> = {
      email: 'email',
      firstName: 'first_name',
      lastName: 'last_name',
      role: 'role',
      position: 'position',
      phone: 'phone',
      address: 'address',
      employeeNumber: 'employee_number',
    };

    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const [dtoField, dbColumn] of Object.entries(fieldMap)) {
      // Safe: dtoField comes from hardcoded fieldMap keys, not user input
      // eslint-disable-next-line security/detect-object-injection -- keys from trusted fieldMap constant
      const value = data[dtoField];
      if (value !== undefined) {
        updates.push(`${dbColumn} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (data['isActive'] !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(data['isActive'] === true ? 1 : 0);
      paramIndex++;
    }

    if (hasFullAccess !== undefined) {
      updates.push(`has_full_access = $${paramIndex}`);
      params.push(hasFullAccess ? 1 : 0);
      paramIndex++;
    }

    return { updates, params, paramIndex };
  }

  /**
   * Update department assignments if provided
   */
  private async updateDepartmentAssignments(
    userId: number,
    tenantId: number,
    departmentIds: number[] | undefined,
  ): Promise<void> {
    if (!Array.isArray(departmentIds)) return;

    await this.removeUserDepartments(userId, tenantId);
    if (departmentIds.length > 0) {
      await this.assignUserDepartments(userId, departmentIds, tenantId);
    }
  }

  /**
   * Fetch user with department info
   */
  private async fetchUserWithDepartments(
    userId: number,
    tenantId: number,
  ): Promise<SafeUserResponse> {
    const updatedUser = await this.findUserById(userId, tenantId);
    if (updatedUser === null) {
      throw new InternalServerErrorException('Failed to retrieve updated user');
    }

    const departments = await this.getUserDepartments(userId, tenantId);
    const response = this.toSafeUserResponse(updatedUser);
    this.addDepartmentInfo(response, departments);

    return response;
  }

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

    return this.toSafeUserResponse(updatedUser);
  }

  /**
   * Change password
   */
  async changePassword(
    userId: number,
    tenantId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // Get user with password
    const rows = await this.databaseService.query<{ password: string }>(
      `SELECT password FROM users WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    const user = rows[0];
    if (user === undefined) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Verify current password
    const isValid = await bcryptjs.compare(currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash and update new password
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    await this.databaseService.query(
      `UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [hashedPassword, userId, tenantId],
    );

    return { message: 'Password changed successfully' };
  }

  /**
   * Delete user (soft delete - sets is_active = 4)
   */
  async deleteUser(
    userId: number,
    currentUserId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    if (userId === currentUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    const user = await this.findUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Soft delete (is_active = 4 = deleted)
    await this.databaseService.query(
      `UPDATE users SET is_active = 4, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    return { message: 'User deleted successfully' };
  }

  /**
   * Archive user (is_active = 3)
   */
  async archiveUser(userId: number, tenantId: number): Promise<{ message: string }> {
    const user = await this.findUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    await this.databaseService.query(
      `UPDATE users SET is_active = 3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    return { message: 'User archived successfully' };
  }

  /**
   * Unarchive user (is_active = 1)
   */
  async unarchiveUser(userId: number, tenantId: number): Promise<{ message: string }> {
    const user = await this.findUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    await this.databaseService.query(
      `UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    return { message: 'User unarchived successfully' };
  }

  /**
   * Update availability
   */
  async updateAvailability(
    userId: number,
    dto: UpdateAvailabilityDto,
    tenantId: number,
  ): Promise<{ message: string }> {
    const user = await this.findUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    await this.databaseService.query(
      `UPDATE users SET
        availability_status = $1,
        availability_start = $2,
        availability_end = $3,
        availability_notes = $4,
        updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6`,
      [
        dto.availabilityStatus,
        dto.availabilityStart ?? null,
        dto.availabilityEnd ?? null,
        dto.availabilityNotes ?? null,
        userId,
        tenantId,
      ],
    );

    return { message: 'Availability updated successfully' };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Find user by ID
   */
  private async findUserById(userId: number, tenantId: number): Promise<UserRow | null> {
    const rows = await this.databaseService.query<UserRow>(
      `SELECT id, tenant_id, email, role, username, first_name, last_name,
              is_active, last_login, created_at, updated_at,
              phone, address, position, employee_number, profile_picture,
              emergency_contact, date_of_birth,
              availability_status, availability_start, availability_end, availability_notes,
              has_full_access
       FROM users
       WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    return rows[0] ?? null;
  }

  /**
   * Find user by email
   */
  private async findUserByEmail(email: string, tenantId: number): Promise<UserRow | null> {
    const rows = await this.databaseService.query<UserRow>(
      `SELECT id, tenant_id, email FROM users WHERE email = $1 AND tenant_id = $2`,
      [email.toLowerCase(), tenantId],
    );

    return rows[0] ?? null;
  }

  /**
   * Get user department assignments
   */
  private async getUserDepartments(userId: number, tenantId: number): Promise<UserDepartmentRow[]> {
    return await this.databaseService.query<UserDepartmentRow>(
      `SELECT ud.user_id, ud.department_id, d.name as department_name, ud.is_primary
       FROM user_departments ud
       JOIN departments d ON ud.department_id = d.id
       WHERE ud.user_id = $1 AND d.tenant_id = $2`,
      [userId, tenantId],
    );
  }

  /**
   * Get tenant info by ID
   */
  private async getTenantInfo(tenantId: number): Promise<TenantInfo | null> {
    const rows = await this.databaseService.query<{ company_name: string; subdomain: string }>(
      `SELECT company_name, subdomain FROM tenants WHERE id = $1`,
      [tenantId],
    );

    const tenant = rows[0];
    if (tenant === undefined) {
      return null;
    }

    return {
      companyName: tenant.company_name,
      subdomain: tenant.subdomain,
    };
  }

  /**
   * Assign user to departments
   */
  private async assignUserDepartments(
    userId: number,
    departmentIds: number[],
    tenantId: number,
  ): Promise<void> {
    const primaryDeptId = departmentIds[0];
    for (const deptId of departmentIds) {
      const isPrimary = deptId === primaryDeptId;
      await this.databaseService.query(
        `INSERT INTO user_departments (user_id, department_id, tenant_id, is_primary)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, department_id) DO UPDATE SET is_primary = $4`,
        [userId, deptId, tenantId, isPrimary],
      );
    }
  }

  /**
   * Remove all user department assignments
   */
  private async removeUserDepartments(userId: number, tenantId: number): Promise<void> {
    await this.databaseService.query(
      `DELETE FROM user_departments WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
  }

  /**
   * Convert DB row to safe API response (camelCase, without password)
   * Uses fieldMapper.dbToApi() for snake_case → camelCase transformation
   */
  private toSafeUserResponse(user: UserRow): SafeUserResponse {
    const { password, ...safeUser } = user;
    void password;
    return fieldMapper.dbToApi(safeUser as unknown as Record<string, unknown>) as SafeUserResponse;
  }

  /**
   * Add department info to response
   */
  private addDepartmentInfo(response: SafeUserResponse, departments: UserDepartmentRow[]): void {
    response.departmentIds = departments.map((d: UserDepartmentRow) => d.department_id);
    response.departmentNames = departments.map((d: UserDepartmentRow) => d.department_name);
  }

  /**
   * Map API sort field to database column
   * Uses VALID_SORT_FIELDS for security validation
   */
  private mapSortField(sortBy: string): string {
    // Validate sortBy is in allowed list (prevents SQL injection)
    if (!VALID_SORT_FIELDS.has(sortBy)) {
      return 'created_at';
    }

    // Safe mapping after validation
    switch (sortBy) {
      case 'firstName':
        return 'first_name';
      case 'lastName':
        return 'last_name';
      case 'email':
        return 'email';
      case 'createdAt':
        return 'created_at';
      case 'lastLogin':
        return 'last_login';
      default:
        return 'created_at';
    }
  }

  // ============================================
  // Profile Picture Methods (Native NestJS)
  // ============================================

  /**
   * Get profile picture path
   */
  async getProfilePicturePath(userId: number, tenantId: number): Promise<string> {
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

    return this.toSafeUserResponse(updatedUser);
  }

  /**
   * Delete profile picture
   */
  async deleteProfilePicture(userId: number, tenantId: number): Promise<{ message: string }> {
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
      console.error('Failed to delete profile picture file:', error);
    }

    // Clear DB field
    await this.databaseService.query(
      `UPDATE users SET profile_picture = NULL, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    return { message: 'Profile picture deleted successfully' };
  }
}
