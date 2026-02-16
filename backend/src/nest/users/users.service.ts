/**
 * Users Service
 *
 * Business logic for admin user management:
 * - List users with pagination and filters
 * - CRUD operations (create, update, delete, archive)
 * - Role change authorization
 *
 * NOTE: Profile self-service extracted to UserProfileService
 * NOTE: Availability logic extracted to UserAvailabilityService
 * NOTE: Types extracted to users.types.ts, pure helpers to users.helpers.ts
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { UserRepository } from '../database/repositories/user.repository.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { UserAvailabilityService } from './user-availability.service.js';
import {
  addDepartmentInfo,
  addTeamInfo,
  buildUpdateFields,
  buildUserListWhereClause,
  isUniqueConstraintViolation,
  mapSortField,
  toSafeUserResponse,
} from './users.helpers.js';
import type {
  PaginatedResult,
  SafeUserResponse,
  TenantInfo,
  UserDepartmentRow,
  UserRow,
  UserTeamRow,
} from './users.types.js';

/**
 * Error message constants to avoid duplication
 */
const ERROR_MESSAGES = {
  USER_NOT_FOUND: 'User not found',
  EMAIL_EXISTS: 'Email already exists',
  EMPLOYEE_NUMBER_EXISTS: 'Personalnummer bereits vergeben',
  ROLE_CHANGE_FORBIDDEN:
    'Keine Berechtigung für Rollenänderung. Nur Root oder Admin mit Vollzugriff dürfen Rollen ändern.',
  EMPLOYEE_NO_FULL_ACCESS:
    'Mitarbeiter dürfen keinen Vollzugriff erhalten. Nur Admin- und Root-Benutzer können has_full_access=true haben.',
} as const;

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
    const { whereClause, params, paramIndex } = buildUserListWhereClause(
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
    const sortBy = mapSortField(query.sortBy ?? 'createdAt');
    const sortOrder = query.sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Get users (availability fields removed - now from user_availability table)
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
    const responses = users.map((user: UserRow) => toSafeUserResponse(user));

    // Fetch team assignments and availability in batch (single query each for all users)
    const userIds = users.map((u: UserRow) => u.id);
    const [teamsByUser, availabilityByUser] = await Promise.all([
      this.getUserTeamsBatch(userIds, tenantId),
      this.availabilityService.getUserAvailabilityBatch(userIds, tenantId),
    ]);

    // Add team and availability info to each response
    for (const response of responses) {
      const teams = teamsByUser.get(response.id) ?? [];
      addTeamInfo(response, teams);
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

    const response = toSafeUserResponse(user);
    addDepartmentInfo(response, departments);
    addTeamInfo(response, teams);
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

    // SECURITY: Employees MUST NOT have has_full_access=true
    const safeFullAccess = this.enforceEmployeeNoFullAccess(
      userData.role,
      hasFullAccess,
    );

    const userId = await this.insertUserRecord(
      userData,
      safeFullAccess,
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
        hasFullAccess: safeFullAccess ?? false,
      },
    );

    // Log full access grant separately for audit trail
    if (safeFullAccess === true) {
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
   * NOTE: Availability fields removed - now managed via user_availability table
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
      if (isUniqueConstraintViolation(error, 'employee_number')) {
        throw new ConflictException(ERROR_MESSAGES.EMPLOYEE_NUMBER_EXISTS);
      }
      if (isUniqueConstraintViolation(error, 'email')) {
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
    actingUserRole: string,
    tenantId: number,
  ): Promise<SafeUserResponse> {
    const existingUser = await this.findUserById(userId, tenantId);
    if (existingUser === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Guard: Role changes require root OR admin with has_full_access
    if (dto.role !== undefined && dto.role !== existingUser.role) {
      await this.assertCanChangeRole(actingUserId, actingUserRole, tenantId);
    }

    await this.validateEmailUniqueness(dto.email, existingUser.email, tenantId);

    const { departmentIds, teamIds, hasFullAccess, password, ...updateData } =
      dto;
    void teamIds; // Reserved for future use

    // SECURITY: Employees MUST NOT have has_full_access=true (defense-in-depth)
    this.enforceEmployeeNoFullAccess(
      dto.role ?? existingUser.role,
      hasFullAccess ?? existingUser.has_full_access === 1,
    );

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
    await this.logUserUpdate(tenantId, actingUserId, userId, existingUser, dto);
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
   * Log user update activity with old/new values
   */
  private async logUserUpdate(
    tenantId: number,
    actingUserId: number,
    userId: number,
    existingUser: UserRow,
    dto: UpdateUserDto,
  ): Promise<void> {
    await this.activityLogger.logUpdate(
      tenantId,
      actingUserId,
      'user',
      userId,
      `Benutzer aktualisiert: ${existingUser.email}`,
      {
        email: existingUser.email,
        role: existingUser.role,
        firstName: existingUser.first_name,
        lastName: existingUser.last_name,
      },
      {
        email: dto.email ?? existingUser.email,
        role: dto.role ?? existingUser.role,
        firstName: dto.firstName ?? existingUser.first_name,
        lastName: dto.lastName ?? existingUser.last_name,
      },
    );
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
    const { updates, params, paramIndex } = buildUpdateFields(
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
      if (isUniqueConstraintViolation(error, 'employee_number')) {
        throw new ConflictException(ERROR_MESSAGES.EMPLOYEE_NUMBER_EXISTS);
      }
      if (isUniqueConstraintViolation(error, 'email')) {
        throw new ConflictException(ERROR_MESSAGES.EMAIL_EXISTS);
      }
      throw error;
    }
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
    const response = toSafeUserResponse(updatedUser);
    addDepartmentInfo(response, departments);

    return response;
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
   * Assert the acting user is allowed to change another user's role.
   * Only root OR admin with has_full_access=true may promote users.
   */
  private async assertCanChangeRole(
    actingUserId: number,
    actingUserRole: string,
    tenantId: number,
  ): Promise<void> {
    if (actingUserRole === 'root') return;

    if (actingUserRole === 'admin') {
      const rows = await this.databaseService.query<{
        has_full_access: boolean;
      }>('SELECT has_full_access FROM users WHERE id = $1 AND tenant_id = $2', [
        actingUserId,
        tenantId,
      ]);
      if (rows[0]?.has_full_access === true) return;
    }

    throw new ForbiddenException(ERROR_MESSAGES.ROLE_CHANGE_FORBIDDEN);
  }

  /**
   * SECURITY: Enforce that employees cannot have has_full_access=true.
   * Defense-in-depth: DB constraint chk_employee_no_full_access also enforces this.
   * @throws BadRequestException if role is 'employee' and hasFullAccess is true
   */
  private enforceEmployeeNoFullAccess(
    role: string,
    hasFullAccess: boolean | undefined,
  ): boolean | undefined {
    if (role === 'employee' && hasFullAccess === true) {
      throw new BadRequestException(ERROR_MESSAGES.EMPLOYEE_NO_FULL_ACCESS);
    }
    return hasFullAccess;
  }

  /**
   * Find user by ID
   * SECURITY: Only returns ACTIVE users (is_active = 1)
   * NOTE: Availability fields removed - now from user_availability table
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
    actingUserRole: string,
    tenantId: number,
  ): Promise<SafeUserResponse> {
    const userId = await this.resolveUserIdByUuid(uuid, tenantId);
    return await this.updateUser(
      userId,
      dto,
      actingUserId,
      actingUserRole,
      tenantId,
    );
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
