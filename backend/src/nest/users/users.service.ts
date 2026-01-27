/**
 * Users Service
 *
 * Business logic for user management:
 * - List users with pagination and filters
 * - CRUD operations
 * - Profile management
 * - Password changes
 * - Profile pictures
 *
 * NOTE: Availability logic extracted to UserAvailabilityService
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
import { v7 as uuidv7 } from 'uuid';

import { fieldMapper } from '../../utils/fieldMapper.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { UserRepository } from '../database/repositories/user.repository.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { UserAvailabilityService } from './user-availability.service.js';

/**
 * User row type from database
 * NOTE: Availability fields removed - now in employee_availability table
 */
export interface UserRow {
  id: number;
  uuid: string;
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
 * User team assignment row
 * INHERITANCE-FIX: Includes department and area info from team chain
 */
interface UserTeamRow {
  user_id: number;
  team_id: number;
  team_name: string;
  // Inheritance chain: Team → Department → Area
  team_department_id: number | null;
  team_department_name: string | null;
  team_area_id: number | null;
  team_area_name: string | null;
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
 * isActive status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
export interface SafeUserResponse {
  id: number;
  uuid: string;
  tenantId: number;
  email: string;
  role: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  isActive: number;
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
  teamIds?: number[];
  teamNames?: string[];
  // INHERITANCE-FIX: Team → Department → Area chain (first team's chain)
  teamDepartmentId?: number | null;
  teamDepartmentName?: string | null;
  teamAreaId?: number | null;
  teamAreaName?: string | null;
  tenant?: TenantInfo;
}

/**
 * Error message constants to avoid duplication
 */
const ERROR_MESSAGES = {
  USER_NOT_FOUND: 'User not found',
  EMAIL_EXISTS: 'Email already exists',
  EMPLOYEE_NUMBER_EXISTS: 'Personalnummer bereits vergeben',
  INVALID_PASSWORD: 'Invalid current password',
} as const;

/**
 * Valid sort fields for user queries
 */
const VALID_SORT_FIELDS = new Set([
  'firstName',
  'lastName',
  'email',
  'createdAt',
  'lastLogin',
]);

@Injectable()
export class UsersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly userRepository: UserRepository,
    private readonly availabilityService: UserAvailabilityService,
  ) {}

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

    // Build WHERE clause using helper
    const { whereClause, params, paramIndex } = this.buildUserListWhereClause(
      tenantId,
      query,
    );

    // Get total count
    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users WHERE ${whereClause}`,
      params,
    );
    const total = Number.parseInt(countResult[0]?.count ?? '0', 10);

    // Build ORDER BY clause
    const sortBy = this.mapSortField(query.sortBy ?? 'createdAt');
    const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Get users (availability fields removed - now from employee_availability table)
    const users = await this.databaseService.query<UserRow>(
      `SELECT id, uuid, tenant_id, email, role, username, first_name, last_name,
              is_active, last_login, created_at, updated_at,
              phone, address, position, employee_number, profile_picture,
              emergency_contact, date_of_birth,
              has_full_access
       FROM users
       WHERE ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    // Convert to responses
    const responses = users.map((user: UserRow) =>
      this.toSafeUserResponse(user),
    );

    // Fetch team assignments and availability in batch (single query each for all users)
    const userIds = users.map((u: UserRow) => u.id);
    const [teamsByUser, availabilityByUser] = await Promise.all([
      this.getUserTeamsBatch(userIds, tenantId),
      this.availabilityService.getUserAvailabilityBatch(userIds, tenantId),
    ]);

    // Add team and availability info to each response
    for (const response of responses) {
      const teams = teamsByUser.get(response.id) ?? [];
      this.addTeamInfo(response, teams);
      this.availabilityService.addAvailabilityInfo(
        response,
        availabilityByUser.get(response.id),
      );
    }

    return {
      data: responses,
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
  async getUserById(
    userId: number,
    tenantId: number,
  ): Promise<SafeUserResponse> {
    const user = await this.findUserById(userId, tenantId);
    if (user === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Get department, team assignments, availability and tenant info
    const [departments, teams, availability, tenantInfo] = await Promise.all([
      this.getUserDepartments(userId, tenantId),
      this.getUserTeams(userId, tenantId),
      this.availabilityService.getUserAvailability(userId, tenantId),
      this.getTenantInfo(tenantId),
    ]);

    const response = this.toSafeUserResponse(user);
    this.addDepartmentInfo(response, departments);
    this.addTeamInfo(response, teams);
    this.availabilityService.addAvailabilityInfo(
      response,
      availability ?? undefined,
    );

    // Add tenant info if available
    if (tenantInfo !== null) {
      response.tenant = tenantInfo;
    }

    return response;
  }

  /**
   * Create new user
   */
  async createUser(
    dto: CreateUserDto,
    actingUserId: number,
    tenantId: number,
  ): Promise<SafeUserResponse> {
    const existingUser = await this.findUserByEmail(dto.email, tenantId);
    if (existingUser !== null) {
      throw new ConflictException('Email already exists');
    }

    const { departmentIds, teamIds, hasFullAccess, ...userData } = dto;
    void teamIds;

    const userId = await this.insertUserRecord(
      userData,
      hasFullAccess,
      tenantId,
    );
    if (Array.isArray(departmentIds) && departmentIds.length > 0) {
      await this.assignUserDepartments(userId, departmentIds, tenantId);
    }

    const response = await this.fetchUserWithDepartments(userId, tenantId);

    await this.activityLogger.logCreate(
      tenantId,
      actingUserId,
      'user',
      userId,
      `Benutzer erstellt: ${dto.email} (Rolle: ${dto.role})`,
      {
        email: dto.email,
        role: dto.role,
        firstName: dto.firstName,
        lastName: dto.lastName,
        hasFullAccess: hasFullAccess ?? false,
      },
    );

    // Log full access grant separately for audit trail
    if (hasFullAccess === true) {
      await this.activityLogger.log({
        tenantId,
        userId: actingUserId,
        action: 'assign',
        entityType: 'user',
        entityId: userId,
        details: `Vollzugriff gewährt für: ${dto.email}`,
        newValues: { hasFullAccess: true },
      });
    }

    return response;
  }

  /**
   * Insert user record into database
   * NOTE: Availability fields removed - now managed via employee_availability table
   */
  private async insertUserRecord(
    userData: Omit<
      CreateUserDto,
      'departmentIds' | 'teamIds' | 'hasFullAccess'
    >,
    hasFullAccess: boolean | undefined,
    tenantId: number,
  ): Promise<number> {
    const employeeNumber =
      userData.employeeNumber ?? `EMP${String(Date.now())}`;
    const hashedPassword = await bcryptjs.hash(userData.password, 12);
    const userUuid = uuidv7();

    try {
      const result = await this.databaseService.query<{ id: number }>(
        `INSERT INTO users (
          tenant_id, email, password, username, first_name, last_name, role,
          position, phone, address, employee_number, date_of_birth,
          is_active, has_full_access, uuid, uuid_created_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW(), NOW())
        RETURNING id`,
        [
          tenantId,
          userData.email,
          hashedPassword,
          userData.email,
          userData.firstName,
          userData.lastName,
          userData.role,
          userData.position ?? null,
          userData.phone ?? null,
          userData.address ?? null,
          employeeNumber,
          userData.dateOfBirth ?? null,
          1,
          hasFullAccess === true ? 1 : 0,
          userUuid,
        ],
      );

      const userId = result[0]?.id;
      if (userId === undefined) {
        throw new InternalServerErrorException('Failed to create user');
      }
      return userId;
    } catch (error: unknown) {
      // Handle PostgreSQL unique constraint violations (code 23505)
      if (this.isUniqueConstraintViolation(error, 'employee_number')) {
        throw new ConflictException(ERROR_MESSAGES.EMPLOYEE_NUMBER_EXISTS);
      }
      if (this.isUniqueConstraintViolation(error, 'email')) {
        throw new ConflictException(ERROR_MESSAGES.EMAIL_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    actingUserId: number,
    tenantId: number,
  ): Promise<SafeUserResponse> {
    const existingUser = await this.findUserById(userId, tenantId);
    if (existingUser === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Store old values for logging
    const oldValues = {
      email: existingUser.email,
      role: existingUser.role,
      firstName: existingUser.first_name,
      lastName: existingUser.last_name,
    };

    await this.validateEmailUniqueness(dto.email, existingUser.email, tenantId);

    const { departmentIds, teamIds, hasFullAccess, password, ...updateData } =
      dto;
    void teamIds; // Reserved for future use

    await this.executeUserUpdate(
      userId,
      tenantId,
      updateData,
      hasFullAccess,
      password,
    );
    await this.updateDepartmentAssignments(userId, tenantId, departmentIds);

    // Insert into availability history if availability fields were updated
    await this.availabilityService.insertAvailabilityHistoryIfNeeded(
      userId,
      tenantId,
      dto.availabilityStatus,
      dto.availabilityStart,
      dto.availabilityEnd,
      dto.availabilityReason,
      dto.availabilityNotes,
      actingUserId,
    );

    const result = await this.fetchUserWithDepartments(userId, tenantId);

    // Log activity
    await this.activityLogger.logUpdate(
      tenantId,
      actingUserId,
      'user',
      userId,
      `Benutzer aktualisiert: ${existingUser.email}`,
      oldValues,
      {
        email: dto.email ?? existingUser.email,
        role: dto.role ?? existingUser.role,
        firstName: dto.firstName ?? existingUser.first_name,
        lastName: dto.lastName ?? existingUser.last_name,
      },
    );

    return result;
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
    const { updates, params, paramIndex } = this.buildUpdateFields(
      updateData,
      hasFullAccess,
    );

    let currentIndex = paramIndex;
    if (password !== undefined && password !== '') {
      const hashedPassword = await bcryptjs.hash(password, 12);
      updates.push(`password = $${currentIndex}`);
      params.push(hashedPassword);
      currentIndex++;
    }

    if (params.length === 0) return;

    params.push(userId, tenantId);
    try {
      await this.databaseService.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${currentIndex} AND tenant_id = $${currentIndex + 1}`,
        params,
      );
    } catch (error: unknown) {
      // Handle PostgreSQL unique constraint violations (code 23505)
      if (this.isUniqueConstraintViolation(error, 'employee_number')) {
        throw new ConflictException(ERROR_MESSAGES.EMPLOYEE_NUMBER_EXISTS);
      }
      if (this.isUniqueConstraintViolation(error, 'email')) {
        throw new ConflictException(ERROR_MESSAGES.EMAIL_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Check if error is a PostgreSQL unique constraint violation for a specific field
   */
  private isUniqueConstraintViolation(
    error: unknown,
    fieldName: string,
  ): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const pgError = error as { code?: string; constraint?: string };
    // PostgreSQL unique violation code is 23505
    if (pgError.code !== '23505') return false;
    // Check if constraint name contains the field name
    return (
      pgError.constraint?.toLowerCase().includes(fieldName.toLowerCase()) ??
      false
    );
  }

  /**
   * Build update fields and params from DTO data
   * NOTE: Availability fields removed - now managed via employee_availability table
   */
  private buildUpdateFields(
    data: Record<string, unknown>,
    hasFullAccess: boolean | undefined,
  ): { updates: string[]; params: unknown[]; paramIndex: number } {
    // Availability fields removed - now in employee_availability table
    const fieldMap: Record<string, string> = {
      email: 'email',
      firstName: 'first_name',
      lastName: 'last_name',
      role: 'role',
      position: 'position',
      phone: 'phone',
      address: 'address',
      employeeNumber: 'employee_number',
      dateOfBirth: 'date_of_birth',
    };

    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const [dtoField, dbColumn] of Object.entries(fieldMap)) {
      // Safe: dtoField comes from hardcoded fieldMap keys, not user input

      const value = data[dtoField];
      if (value !== undefined) {
        updates.push(`${dbColumn} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (data['isActive'] !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      // isActive is now a number (0, 1, 3) - pass through directly
      params.push(data['isActive']);
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
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash and update new password
    const hashedPassword = await bcryptjs.hash(newPassword, 12);
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

    // Log activity
    await this.activityLogger.logDelete(
      tenantId,
      currentUserId,
      'user',
      userId,
      `Benutzer gelöscht: ${user.email}`,
      {
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    );

    return { message: 'User deleted successfully' };
  }

  /**
   * Archive user (is_active = 3)
   */
  async archiveUser(
    userId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
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
  async unarchiveUser(
    userId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
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

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Build WHERE clause and params for user list query
   * Always excludes soft-deleted users (is_active = 4) unless specific isActive filter is provided
   */
  private buildUserListWhereClause(
    tenantId: number,
    query: ListUsersQueryDto,
  ): { whereClause: string; params: unknown[]; paramIndex: number } {
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (query.role !== undefined) {
      conditions.push(`role = $${paramIndex}`);
      params.push(query.role);
      paramIndex++;
    }

    if (query.isActive !== undefined) {
      // Explicit isActive filter - use exactly what was requested
      conditions.push(`is_active = $${paramIndex}`);
      params.push(query.isActive);
      paramIndex++;
    } else {
      // Default: exclude soft-deleted users (is_active = 4)
      conditions.push('is_active != 4');
    }

    if (query.search !== undefined && query.search !== '') {
      conditions.push(
        `(first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`,
      );
      params.push(`%${query.search}%`);
      paramIndex++;
    }

    return { whereClause: conditions.join(' AND '), params, paramIndex };
  }

  /**
   * Find user by ID
   * SECURITY: Only returns ACTIVE users (is_active = 1)
   * NOTE: Availability fields removed - now from employee_availability table
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

  /**
   * Find user by email
   * SECURITY: Only returns ACTIVE users (is_active = 1)
   */
  private async findUserByEmail(
    email: string,
    tenantId: number,
  ): Promise<UserRow | null> {
    const rows = await this.databaseService.query<UserRow>(
      `SELECT id, tenant_id, email FROM users WHERE email = $1 AND tenant_id = $2 AND is_active = 1`,
      [email.toLowerCase(), tenantId],
    );

    return rows[0] ?? null;
  }

  /**
   * Get user department assignments
   */
  private async getUserDepartments(
    userId: number,
    tenantId: number,
  ): Promise<UserDepartmentRow[]> {
    return await this.databaseService.query<UserDepartmentRow>(
      `SELECT ud.user_id, ud.department_id, d.name as department_name, ud.is_primary
       FROM user_departments ud
       JOIN departments d ON ud.department_id = d.id
       WHERE ud.user_id = $1 AND d.tenant_id = $2`,
      [userId, tenantId],
    );
  }

  /**
   * Get user team assignments
   * INHERITANCE-FIX: Includes department and area info from team chain
   */
  private async getUserTeams(
    userId: number,
    tenantId: number,
  ): Promise<UserTeamRow[]> {
    return await this.databaseService.query<UserTeamRow>(
      `SELECT
         ut.user_id,
         ut.team_id,
         t.name as team_name,
         t.department_id as team_department_id,
         d.name as team_department_name,
         d.area_id as team_area_id,
         a.name as team_area_name
       FROM user_teams ut
       JOIN teams t ON ut.team_id = t.id
       LEFT JOIN departments d ON t.department_id = d.id
       LEFT JOIN areas a ON d.area_id = a.id
       WHERE ut.user_id = $1 AND ut.tenant_id = $2`,
      [userId, tenantId],
    );
  }

  /**
   * Get team assignments for multiple users (batch query for efficiency)
   * INHERITANCE-FIX: Includes department and area info from team chain
   */
  private async getUserTeamsBatch(
    userIds: number[],
    tenantId: number,
  ): Promise<Map<number, UserTeamRow[]>> {
    if (userIds.length === 0) {
      return new Map();
    }

    // Build parameterized query for user IDs
    // INHERITANCE-FIX: JOIN departments and areas for inheritance chain
    const placeholders = userIds
      .map((_: number, i: number) => `$${i + 2}`)
      .join(', ');
    const rows = await this.databaseService.query<UserTeamRow>(
      `SELECT
         ut.user_id,
         ut.team_id,
         t.name as team_name,
         t.department_id as team_department_id,
         d.name as team_department_name,
         d.area_id as team_area_id,
         a.name as team_area_name
       FROM user_teams ut
       JOIN teams t ON ut.team_id = t.id
       LEFT JOIN departments d ON t.department_id = d.id
       LEFT JOIN areas a ON d.area_id = a.id
       WHERE ut.user_id IN (${placeholders}) AND ut.tenant_id = $1`,
      [tenantId, ...userIds],
    );

    // Group by user_id
    const teamsByUser = new Map<number, UserTeamRow[]>();
    for (const row of rows) {
      const existing = teamsByUser.get(row.user_id) ?? [];
      existing.push(row);
      teamsByUser.set(row.user_id, existing);
    }

    return teamsByUser;
  }

  /**
   * Get tenant info by ID
   */
  private async getTenantInfo(tenantId: number): Promise<TenantInfo | null> {
    const rows = await this.databaseService.query<{
      company_name: string;
      subdomain: string;
    }>(`SELECT company_name, subdomain FROM tenants WHERE id = $1`, [tenantId]);

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
  private async removeUserDepartments(
    userId: number,
    tenantId: number,
  ): Promise<void> {
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
    return fieldMapper.dbToApi(
      safeUser as unknown as Record<string, unknown>,
    ) as SafeUserResponse;
  }

  /**
   * Add department info to response
   */
  private addDepartmentInfo(
    response: SafeUserResponse,
    departments: UserDepartmentRow[],
  ): void {
    response.departmentIds = departments.map(
      (d: UserDepartmentRow) => d.department_id,
    );
    response.departmentNames = departments.map(
      (d: UserDepartmentRow) => d.department_name,
    );
  }

  /**
   * Add team info to response
   * INHERITANCE-FIX: Includes department and area info from team chain
   */
  private addTeamInfo(response: SafeUserResponse, teams: UserTeamRow[]): void {
    response.teamIds = teams.map((t: UserTeamRow) => t.team_id);
    response.teamNames = teams.map((t: UserTeamRow) => t.team_name);

    // INHERITANCE-FIX: Add inherited department/area from first (primary) team
    const primaryTeam = teams[0];
    if (primaryTeam !== undefined) {
      response.teamDepartmentId = primaryTeam.team_department_id;
      response.teamDepartmentName = primaryTeam.team_department_name;
      response.teamAreaId = primaryTeam.team_area_id;
      response.teamAreaName = primaryTeam.team_area_name;
    }
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

    return this.toSafeUserResponse(updatedUser);
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
      console.error('Failed to delete profile picture file:', error);
    }

    // Clear DB field
    await this.databaseService.query(
      `UPDATE users SET profile_picture = NULL, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    return { message: 'Profile picture deleted successfully' };
  }

  // ============================================
  // UUID-based Methods (for API consistency)
  // ============================================

  /**
   * Resolve user ID from UUID
   * SECURITY: Only resolves ACTIVE users (is_active = 1)
   * @throws NotFoundException if user not found or deleted
   */
  private async resolveUserIdByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<number> {
    const userId = await this.userRepository.resolveUuidToId(uuid, tenantId);
    if (userId === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    return userId;
  }

  /**
   * Get user by UUID (wrapper for UUID-based API)
   */
  async getUserByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<SafeUserResponse> {
    const userId = await this.resolveUserIdByUuid(uuid, tenantId);
    return await this.getUserById(userId, tenantId);
  }

  /**
   * Update user by UUID (wrapper for UUID-based API)
   */
  async updateUserByUuid(
    uuid: string,
    dto: UpdateUserDto,
    actingUserId: number,
    tenantId: number,
  ): Promise<SafeUserResponse> {
    const userId = await this.resolveUserIdByUuid(uuid, tenantId);
    return await this.updateUser(userId, dto, actingUserId, tenantId);
  }

  /**
   * Delete user by UUID (wrapper for UUID-based API)
   */
  async deleteUserByUuid(
    uuid: string,
    currentUserId: number,
    tenantId: number,
  ): Promise<{ message: string }> {
    const userId = await this.resolveUserIdByUuid(uuid, tenantId);
    return await this.deleteUser(userId, currentUserId, tenantId);
  }

  /**
   * Archive user by UUID (wrapper for UUID-based API)
   */
  async archiveUserByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<{ message: string }> {
    const userId = await this.resolveUserIdByUuid(uuid, tenantId);
    return await this.archiveUser(userId, tenantId);
  }

  /**
   * Unarchive user by UUID (wrapper for UUID-based API)
   */
  async unarchiveUserByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<{ message: string }> {
    const userId = await this.resolveUserIdByUuid(uuid, tenantId);
    return await this.unarchiveUser(userId, tenantId);
  }
}
