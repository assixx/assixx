/**
 * Root Service — Facade
 *
 * Orchestrates root user operations and delegates to sub-services.
 * Owns: Root user CRUD, dashboard stats.
 * Delegates: Admin management, tenant management, tenant deletion.
 *
 * IMPORTANT: Uses PostgreSQL $1, $2, $3 placeholders (NOT MySQL's ?)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';

import { generateEmployeeId } from '../../utils/employee-id-generator.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { UserRepository } from '../database/repositories/user.repository.js';
import { RootAdminService } from './root-admin.service.js';
import { RootDeletionService } from './root-deletion.service.js';
import { RootTenantService } from './root-tenant.service.js';
import {
  ERROR_CODES,
  buildUserUpdateFields,
  handleDuplicateEntryError,
  mapDbUserToRootUser,
} from './root.helpers.js';
import type {
  AdminLog,
  AdminUser,
  CreateAdminRequest,
  CreateRootUserRequest,
  DashboardStats,
  DbCountRow,
  DbFeatureCodeRow,
  DbIdRow,
  DbSubdomainRow,
  DbUserRow,
  DeletionApproval,
  DeletionDryRunReport,
  RootUser,
  StorageInfo,
  Tenant,
  TenantDeletionStatus,
  UpdateUserRequest,
} from './root.types.js';

// Re-export all types for controller and external consumers
export type {
  AdminLog,
  AdminUser,
  DashboardStats,
  DeletionApproval,
  DeletionDryRunReport,
  RootUser,
  StorageInfo,
  Tenant,
  TenantDeletionStatus,
} from './root.types.js';

@Injectable()
export class RootService {
  private readonly logger = new Logger(RootService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly userRepository: UserRepository,
    private readonly adminService: RootAdminService,
    private readonly tenantService: RootTenantService,
    private readonly deletionService: RootDeletionService,
  ) {}

  // ==========================================================================
  // ADMIN MANAGEMENT (delegates to RootAdminService)
  // ==========================================================================

  /** Get all admin users for a tenant */
  async getAdmins(tenantId: number): Promise<AdminUser[]> {
    return await this.adminService.getAdmins(tenantId);
  }

  /** Get single admin by ID */
  async getAdminById(id: number, tenantId: number): Promise<AdminUser | null> {
    return await this.adminService.getAdminById(id, tenantId);
  }

  /** Create new admin user */
  async createAdmin(
    data: CreateAdminRequest,
    tenantId: number,
    actingUserId: number,
  ): Promise<number> {
    return await this.adminService.createAdmin(data, tenantId, actingUserId);
  }

  /** Update admin user */
  async updateAdmin(
    id: number,
    data: UpdateUserRequest,
    tenantId: number,
  ): Promise<void> {
    await this.adminService.updateAdmin(id, data, tenantId);
  }

  /** Delete admin user */
  async deleteAdmin(
    id: number,
    tenantId: number,
    actingUserId: number,
  ): Promise<void> {
    await this.adminService.deleteAdmin(id, tenantId, actingUserId);
  }

  /** Get admin logs */
  async getAdminLogs(
    adminId: number,
    tenantId: number,
    days?: number,
  ): Promise<AdminLog[]> {
    return await this.adminService.getAdminLogs(adminId, tenantId, days);
  }

  // ==========================================================================
  // TENANT MANAGEMENT (delegates to RootTenantService)
  // ==========================================================================

  /** Get tenants - ONLY the root user's own tenant for security */
  async getTenants(tenantId: number): Promise<Tenant[]> {
    return await this.tenantService.getTenants(tenantId);
  }

  /** Get storage information */
  async getStorageInfo(tenantId: number): Promise<StorageInfo> {
    return await this.tenantService.getStorageInfo(tenantId);
  }

  // ==========================================================================
  // ROOT USER MANAGEMENT
  // ==========================================================================

  /**
   * Get all root users for a tenant
   */
  async getRootUsers(tenantId: number): Promise<RootUser[]> {
    this.logger.debug(`Getting root users for tenant ${tenantId}`);

    // SECURITY: Only return active root users (is_active = 1)
    const users = await this.db.query<DbUserRow>(
      `SELECT u.*, ud.department_id
       FROM users u
       LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
       WHERE u.role = 'root' AND u.tenant_id = $1 AND u.is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY u.created_at DESC`,
      [tenantId],
    );

    return users.map((user: DbUserRow) => mapDbUserToRootUser(user));
  }

  /**
   * Get single root user
   */
  async getRootUserById(
    id: number,
    tenantId: number,
  ): Promise<RootUser | null> {
    this.logger.debug(`Getting root user ${id} for tenant ${tenantId}`);

    // SECURITY: Only return active root users (is_active = 1)
    const rows = await this.db.query<DbUserRow>(
      `SELECT u.*, ud.department_id
       FROM users u
       LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
       WHERE u.id = $1 AND u.role = 'root' AND u.tenant_id = $2 AND u.is_active = ${IS_ACTIVE.ACTIVE}`,
      [id, tenantId],
    );

    const user = rows[0];
    if (user === undefined) {
      return null;
    }

    return mapDbUserToRootUser(user);
  }

  /**
   * Create root user
   */
  async createRootUser(
    data: CreateRootUserRequest,
    tenantId: number,
    actingUserId: number,
  ): Promise<number> {
    this.logger.log(`Creating root user for tenant ${tenantId}`);

    const normalizedEmail = data.email.toLowerCase().trim();

    // Check for duplicate email
    await this.checkDuplicateEmail(normalizedEmail, tenantId);

    // Get tenant subdomain
    const subdomain = await this.getTenantSubdomain(tenantId);

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    try {
      const userUuid = uuidv7();
      const rows = await this.db.query<DbIdRow>(
        `INSERT INTO users (username, email, password, first_name, last_name, role, position, notes, employee_number, is_active, has_full_access, tenant_id, uuid, uuid_created_at)
         VALUES ($1, $2, $3, $4, $5, 'root', $6, $7, $8, $9, TRUE, $10, $11, NOW())
         RETURNING id`,
        [
          normalizedEmail,
          normalizedEmail,
          hashedPassword,
          data.firstName,
          data.lastName,
          data.position ?? null,
          data.notes ?? null,
          data.employeeNumber ?? null,
          data.isActive ?? 1,
          tenantId,
          userUuid,
        ],
      );

      const userId = rows[0]?.id;
      if (userId === undefined) {
        throw new BadRequestException('Failed to create root user');
      }

      // Generate and update employee_id
      const employeeId = generateEmployeeId(subdomain, 'root', userId);
      await this.db.query('UPDATE users SET employee_id = $1 WHERE id = $2', [
        employeeId,
        userId,
      ]);

      // Log activity
      await this.activityLogger.logCreate(
        tenantId,
        actingUserId,
        'user',
        userId,
        `Root-User erstellt: ${normalizedEmail} (Rolle: root)`,
        {
          email: normalizedEmail,
          role: 'root',
          firstName: data.firstName,
          lastName: data.lastName,
          hasFullAccess: true,
        },
      );

      return userId;
    } catch (error: unknown) {
      handleDuplicateEntryError(error);
      throw error;
    }
  }

  /**
   * Update root user
   */
  async updateRootUser(
    id: number,
    data: UpdateUserRequest,
    tenantId: number,
  ): Promise<void> {
    this.logger.log(`Updating root user ${id} for tenant ${tenantId}`);

    // Check if user exists
    const user = await this.getRootUserById(id, tenantId);
    if (user === null) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Root user not found',
      });
    }

    const { fields, values, nextIndex } = buildUserUpdateFields(data);
    let paramIndex = nextIndex;

    // Hash password if provided
    if (data.password !== undefined && data.password !== '') {
      const hashedPassword = await bcrypt.hash(data.password, 12);
      fields.push(`password = $${paramIndex++}`);
      values.push(hashedPassword);
    }

    if (fields.length === 0) {
      return; // Nothing to update
    }

    fields.push('updated_at = NOW()');
    const idParam = paramIndex++;
    const tenantParam = paramIndex;
    values.push(id, tenantId);

    await this.db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idParam} AND tenant_id = $${tenantParam}`,
      values,
    );
  }

  /**
   * Delete root user
   */
  async deleteRootUser(
    id: number,
    tenantId: number,
    currentUserId: number,
  ): Promise<void> {
    this.logger.log(`Deleting root user ${id} for tenant ${tenantId}`);

    // Prevent self-deletion
    if (id === currentUserId) {
      throw new BadRequestException({
        code: ERROR_CODES.SELF_DELETE,
        message: 'Cannot delete yourself',
      });
    }

    // Check if user exists
    const user = await this.getRootUserById(id, tenantId);
    if (user === null) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Root user not found',
      });
    }

    // SECURITY: Check if at least one ACTIVE root user will remain (is_active = 1)
    const rootCount = await this.db.query<DbCountRow>(
      `SELECT COUNT(*) as count FROM users WHERE role = 'root' AND tenant_id = $1 AND id != $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [tenantId, id],
    );

    if (Number(rootCount[0]?.count ?? 0) < 1) {
      throw new BadRequestException({
        code: ERROR_CODES.LAST_ROOT_USER,
        message: 'At least one root user must remain',
      });
    }

    // Log activity BEFORE deleting
    await this.activityLogger.logDelete(
      tenantId,
      currentUserId,
      'user',
      id,
      `Root-User gelöscht: ${user.email}`,
      {
        email: user.email,
        role: 'root',
        firstName: user.firstName,
        lastName: user.lastName,
      },
    );

    // Delete related data first (foreign key constraints)
    await this.db.query(
      'DELETE FROM oauth_tokens WHERE user_id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    await this.db.query(
      'DELETE FROM user_teams WHERE user_id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    await this.db.query(
      'DELETE FROM user_departments WHERE user_id = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    // Delete the user
    await this.db.query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [
      id,
      tenantId,
    ]);
  }

  // ==========================================================================
  // DASHBOARD & SYSTEM INFO
  // ==========================================================================

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(tenantId: number): Promise<DashboardStats> {
    this.logger.debug(`Getting dashboard stats for tenant ${tenantId}`);

    // SECURITY: Use UserRepository for accurate active user counts (is_active = 1)
    const [adminCount, employeeCount, totalUserCount, tenantCount, features] =
      await Promise.all([
        this.userRepository.countByRole('admin', tenantId),
        this.userRepository.countByRole('employee', tenantId),
        this.userRepository.countAll(tenantId),
        this.db.query<DbCountRow>(
          "SELECT COUNT(*) as count FROM tenants WHERE status = 'active'",
        ),
        this.db.query<DbFeatureCodeRow>(
          `SELECT f.code FROM tenant_features tf
         JOIN features f ON tf.feature_id = f.id
         WHERE tf.tenant_id = $1 AND tf.is_active = ${IS_ACTIVE.ACTIVE}`,
          [tenantId],
        ),
      ]);

    const tenantCountNum = Number(tenantCount[0]?.count ?? 0);

    return {
      adminCount,
      employeeCount,
      totalUsers: totalUserCount,
      tenantCount: tenantCountNum,
      activeFeatures: features.map((f: DbFeatureCodeRow) => f.code),
      systemHealth: {
        database: 'healthy',
        storage: 'healthy',
        services: 'healthy',
      },
    };
  }

  // ==========================================================================
  // TENANT DELETION (delegates to RootDeletionService)
  // ==========================================================================

  /** Request tenant deletion */
  async requestTenantDeletion(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<number> {
    return await this.deletionService.requestTenantDeletion(
      tenantId,
      requestedBy,
      reason,
      ipAddress,
    );
  }

  /** Get tenant deletion status */
  async getDeletionStatus(
    tenantId: number,
    currentUserId?: number,
  ): Promise<TenantDeletionStatus | null> {
    return await this.deletionService.getDeletionStatus(
      tenantId,
      currentUserId,
    );
  }

  /** Cancel deletion */
  async cancelDeletion(tenantId: number, userId: number): Promise<void> {
    await this.deletionService.cancelDeletion(tenantId, userId);
  }

  /** Perform deletion dry run */
  async performDeletionDryRun(tenantId: number): Promise<DeletionDryRunReport> {
    return await this.deletionService.performDeletionDryRun(tenantId);
  }

  /** Get all deletion requests */
  async getAllDeletionRequests(): Promise<DeletionApproval[]> {
    return await this.deletionService.getAllDeletionRequests();
  }

  /** Get pending approvals */
  async getPendingApprovals(
    currentUserId: number,
  ): Promise<DeletionApproval[]> {
    return await this.deletionService.getPendingApprovals(currentUserId);
  }

  /** Approve deletion with password verification (Two-Person-Principle) */
  async approveDeletion(
    queueId: number,
    userId: number,
    tenantId: number,
    password: string,
    comment?: string,
  ): Promise<void> {
    await this.deletionService.approveDeletion(
      queueId,
      userId,
      tenantId,
      password,
      comment,
    );
  }

  /** Reject deletion */
  async rejectDeletion(
    queueId: number,
    userId: number,
    reason: string,
  ): Promise<void> {
    await this.deletionService.rejectDeletion(queueId, userId, reason);
  }

  /** Emergency stop */
  async emergencyStop(tenantId: number, userId: number): Promise<void> {
    await this.deletionService.emergencyStop(tenantId, userId);
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Check for duplicate email among ACTIVE users
   * SECURITY: Uses UserRepository which filters by is_active = 1
   */
  private async checkDuplicateEmail(
    email: string,
    tenantId: number,
  ): Promise<void> {
    const isTaken = await this.userRepository.isEmailTaken(email, tenantId);

    if (isTaken) {
      throw new ConflictException({
        code: ERROR_CODES.DUPLICATE_EMAIL,
        message: 'Email already in use',
      });
    }
  }

  /**
   * Get tenant subdomain
   */
  private async getTenantSubdomain(tenantId: number): Promise<string> {
    const rows = await this.db.query<DbSubdomainRow>(
      'SELECT subdomain FROM tenants WHERE id = $1',
      [tenantId],
    );
    return rows[0]?.subdomain ?? 'DEFAULT';
  }
}
