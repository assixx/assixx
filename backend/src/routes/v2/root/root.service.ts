/* eslint-disable max-lines */
/**
 * Root Service v2
 * Business logic for root user operations and tenant management
 */
import bcrypt from 'bcryptjs';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import rootLog, { type DbRootLog } from '../../../models/rootLog.js';
import tenantModel from '../../../models/tenant.js';
import userModel, { type DbUser } from '../../../models/user/index.js';
import { tenantDeletionService } from '../../../services/tenantDeletion.service.js';
import { UsersRow } from '../../../types/database-rows.types.js';
import type { DatabaseTenant } from '../../../types/models.js';
import { CountResult, IdResult } from '../../../types/query-results.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { execute } from '../../../utils/db.js';
import { generateEmployeeId } from '../../../utils/employeeIdGenerator.js';
import { logger } from '../../../utils/logger.js';
import {
  AdminLog,
  AdminUser,
  CreateAdminRequest,
  CreateRootUserRequest,
  DashboardStats,
  DeletionApproval,
  DeletionDryRunReport,
  MySQLError,
  RootUser,
  StorageInfo,
  Tenant,
  TenantDeletionStatus,
  UpdateAdminRequest,
  UpdateRootUserRequest,
} from './types.js';

// Type guard for MySQL errors
function isMySQLError(error: unknown): error is MySQLError {
  return (
    error !== null &&
    error !== undefined &&
    typeof error === 'object' &&
    'message' in error &&
    (('code' in error && typeof (error as MySQLError).code === 'string') ||
      ('sqlMessage' in error && typeof (error as MySQLError).sqlMessage === 'string') ||
      ('sql' in error && typeof (error as MySQLError).sql === 'string'))
  );
}

// ============================================================================
// CUSTOM QUERY RESULT INTERFACES (for JOINs and complex queries)
// ============================================================================

/**
 * Result for feature code query (JOIN between tenant_features and features)
 */
interface FeatureCodeResult extends RowDataPacket {
  code: string;
}

/**
 * Result for deletion queue query with JOINed tenant and user info
 */
interface DeletionQueueWithDetails extends RowDataPacket {
  id: number;
  tenant_id: number;
  status: string;
  created_by: number;
  created_at: Date | string;
  approved_by: number | null;
  approved_at: Date | string | null;
  scheduled_for: Date | string | null;
  reason: string;
  error_message: string | null;
  cooling_off_hours: number;
  company_name: string;
  requested_by_name: string;
}

/**
 * Result for deletion requests query with JOINed details
 */
interface DeletionRequestWithDetails extends RowDataPacket {
  id: number;
  tenant_id: number;
  company_name: string;
  subdomain: string;
  created_by: number;
  requester_name: string;
  requester_email: string;
  created_at: Date | string;
  reason: string;
  status: string;
}

/**
 * Helper: Convert MySQL Date|string to Date
 */
function toDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  return typeof value === 'string' ? new Date(value) : value;
}

/**
 * Root Service - Manages root-level operations
 * All database queries now use typed Row interfaces from database-rows.types.ts
 */
class RootService {
  /**
   * Get all admin users for a tenant
   * @param tenantId - The tenant ID
   */
  async getAdmins(tenantId: number): Promise<AdminUser[]> {
    try {
      // Get admins with extended information
      // If no tenantId provided, get ALL admins from ALL tenants
      logger.info(`[RootService.getAdmins] Fetching admins for tenant ${tenantId}`);
      const admins = await userModel.findByRole('admin', true, tenantId);
      logger.info(`[RootService.getAdmins] Found ${admins.length} admins for tenant ${tenantId}`);

      // Add tenant information
      return await Promise.all(
        admins.map(async (admin: DbUser) => {
          let tenantName: string | undefined;
          if (admin.tenant_id) {
            const tenant = await tenantModel.findById(admin.tenant_id);
            tenantName = tenant?.company_name;
          }

          return {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            firstName: admin.first_name || '',
            lastName: admin.last_name || '',
            company: admin.company,
            notes: admin.notes,
            position: admin.position,
            employeeNumber: admin.employee_number,
            isActive: Boolean(admin.is_active),
            isArchived: admin.is_archived,
            tenantId: admin.tenant_id ?? 0,
            tenantName,
            createdAt: admin.created_at ?? new Date(),
            updatedAt: admin.updated_at ?? new Date(),
            lastLogin: admin.last_login,
          };
        }),
      );
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve admin users', error);
    }
  }

  /**
   * Get single admin by ID
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   */
  async getAdminById(id: number, tenantId: number): Promise<AdminUser | null> {
    try {
      const admin = await userModel.findById(id, tenantId);

      if (admin?.role !== 'admin') {
        return null;
      }

      // Get tenant name
      let tenantName: string | undefined;
      if (admin.tenant_id) {
        const tenant = await tenantModel.findById(admin.tenant_id);
        tenantName = tenant?.company_name;
      }

      // Get last login
      const lastLogin = await rootLog.getLastLogin(id);

      return {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        firstName: admin.first_name || '',
        lastName: admin.last_name || '',
        company: admin.company,
        notes: admin.notes,
        position: admin.position,
        employeeNumber: admin.employee_number,
        isActive: Boolean(admin.is_active),
        isArchived: admin.is_archived,
        tenantId: admin.tenant_id ?? 0,
        tenantName,
        createdAt: admin.created_at ?? new Date(),
        updatedAt: admin.updated_at ?? new Date(),
        lastLogin: lastLogin?.created_at,
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve admin', error);
    }
  }

  /**
   * Create new admin user
   * @param data - The data object
   * @param tenantId - The tenant ID
   */
  async createAdmin(data: CreateAdminRequest, tenantId: number): Promise<number> {
    try {
      // Hash password before passing to model
      const hashedPassword = await bcrypt.hash(data.password, 10);

      const adminData = {
        username: data.username,
        email: data.email,
        password: hashedPassword,
        first_name: data.firstName ?? '',
        last_name: data.lastName ?? '',
        role: 'admin' as const,
        tenant_id: tenantId,
        is_active: true,
        company: data.company,
        notes: data.notes,
        employee_number: data.employeeNumber ?? '',
        position: data.position ?? '',
      };

      const adminId = await userModel.create(adminData);

      // Add admin to tenant_admins table
      try {
        await execute(
          'INSERT INTO tenant_admins (tenant_id, user_id, is_primary) VALUES (?, ?, FALSE)',
          [tenantId, adminId],
        );
      } catch (error: unknown) {
        // Log but don't fail - admin was created successfully
        console.warn('Could not add admin to tenant_admins:', error);
      }

      return adminId;
    } catch (error: unknown) {
      const dbError = error as { code?: string; message?: string };
      if (dbError.code === 'ER_DUP_ENTRY') {
        // Parse MySQL error message to determine which field is duplicate
        const errorMessage = dbError.message ?? '';

        if (errorMessage.includes('employee_number')) {
          throw new ServiceError(
            'DUPLICATE_EMPLOYEE_NUMBER',
            'Employee number already exists',
            error,
          );
        } else if (errorMessage.includes('email')) {
          throw new ServiceError('DUPLICATE_EMAIL', 'Email already exists', error);
        } else if (errorMessage.includes('username')) {
          throw new ServiceError('DUPLICATE_USERNAME', 'Username already exists', error);
        }

        // Fallback for unknown duplicate
        throw new ServiceError('DUPLICATE_ENTRY', 'Username or email already exists', error);
      }
      throw new ServiceError('SERVER_ERROR', 'Failed to create admin', error);
    }
  }

  /**
   * Helper: Build update data from request
   */
  private buildUpdateData(data: UpdateAdminRequest): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};

    // Explicit property assignments to avoid object injection warnings
    if (data.username !== undefined) {
      updateData.username = data.username;
    }
    if (data.email !== undefined) {
      updateData.email = data.email;
    }
    if (data.firstName !== undefined) {
      updateData.first_name = data.firstName;
    }
    if (data.lastName !== undefined) {
      updateData.last_name = data.lastName;
    }
    if (data.company !== undefined) {
      updateData.company = data.company;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }
    if (data.isActive !== undefined) {
      updateData.is_active = data.isActive;
    }
    if (data.isArchived !== undefined) {
      updateData.is_archived = data.isArchived;
    }
    if (data.employeeNumber !== undefined) {
      updateData.employee_number = data.employeeNumber;
    }
    if (data.position !== undefined) {
      updateData.position = data.position;
    }

    return updateData;
  }

  /**
   * Helper: Hash password if provided
   */
  private async hashPasswordIfProvided(
    password: string | undefined,
    updateData: Record<string, unknown>,
  ): Promise<void> {
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
  }

  /**
   * Update admin user
   * @param id - The resource ID
   * @param data - The data object
   * @param tenantId - The tenant ID
   */
  async updateAdmin(id: number, data: UpdateAdminRequest, tenantId: number): Promise<void> {
    try {
      // Check if admin exists
      const admin = await this.getAdminById(id, tenantId);
      if (!admin) {
        throw new ServiceError('NOT_FOUND', 'Admin not found', 404);
      }

      const updateData = this.buildUpdateData(data);
      await this.hashPasswordIfProvided(data.password, updateData);

      const success = await userModel.update(id, updateData, tenantId);
      if (!success) {
        throw new ServiceError('UPDATE_FAILED', 'Failed to update admin', 500);
      }
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('SERVER_ERROR', 'Failed to update admin', error);
    }
  }

  /**
   * Delete admin user
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   */
  async deleteAdmin(id: number, tenantId: number): Promise<void> {
    try {
      // Check if admin exists
      const admin = await this.getAdminById(id, tenantId);
      if (!admin) {
        throw new ServiceError('NOT_FOUND', 'Admin not found', 404);
      }

      const success = await userModel.delete(id);
      if (!success) {
        throw new ServiceError('DELETE_FAILED', 'Failed to delete admin', 500);
      }
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('SERVER_ERROR', 'Failed to delete admin', error);
    }
  }

  /**
   * Get admin logs
   * @param adminId - The adminId parameter
   * @param tenantId - The tenant ID
   * @param days - The days parameter
   */
  async getAdminLogs(adminId: number, tenantId: number, days?: number): Promise<AdminLog[]> {
    try {
      // Verify admin exists
      const admin = await this.getAdminById(adminId, tenantId);
      if (!admin) {
        throw new ServiceError('NOT_FOUND', 'Admin not found', 404);
      }

      const logs = await rootLog.getByUserId(adminId, days ?? 0);

      return logs.map((log: DbRootLog) => ({
        id: log.id,
        userId: log.user_id,
        action: log.action,
        entityType: log.entity_type ?? '',
        entityId: log.entity_id,
        description: log.details ?? undefined,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        createdAt: log.created_at,
      }));
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve admin logs', error);
    }
  }

  /**
   * Get tenants - ONLY the root user's own tenant for security
   * @param tenantId - The tenant ID of the requesting user
   */
  async getTenants(tenantId: number): Promise<Tenant[]> {
    try {
      // CRITICAL: Multi-tenant isolation - only return user's own tenant
      const tenant = await tenantModel.findById(tenantId);

      if (!tenant) {
        return [];
      }

      const tenants = [tenant]; // Only return the user's own tenant

      // Get user counts for each tenant
      return await Promise.all(
        tenants.map(async (tenant: DatabaseTenant) => {
          const [adminCount] = await execute<CountResult[]>(
            "SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role = 'admin'",
            [tenant.id],
          );

          const [employeeCount] = await execute<CountResult[]>(
            "SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role = 'employee'",
            [tenant.id],
          );

          interface StorageTotalResult extends RowDataPacket {
            total: number;
          }
          const [storageUsed] = await execute<StorageTotalResult[]>(
            'SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = ?',
            [tenant.id],
          );

          return {
            id: tenant.id,
            companyName: tenant.company_name,
            subdomain: tenant.subdomain,
            currentPlan: tenant.current_plan ?? undefined,
            status: tenant.status as Tenant['status'],
            maxUsers: 0, // TODO: Get from plan limits
            maxAdmins: 0, // TODO: Get from plan limits
            industry: undefined, // Removed from schema
            country: undefined, // Removed from schema
            createdAt: tenant.created_at,
            updatedAt: tenant.updated_at,
            adminCount: adminCount[0].count,
            employeeCount: employeeCount[0].count,
            storageUsed: storageUsed[0].total,
          };
        }),
      );
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve tenants', error);
    }
  }

  /**
   * Get all root users for a tenant
   * @param tenantId - The tenant ID
   */
  async getRootUsers(tenantId: number): Promise<RootUser[]> {
    try {
      const [users] = await execute<UsersRow[]>(
        `SELECT
          id, username, email, first_name, last_name,
          position, notes, employee_number, department_id, is_active, employee_id, created_at, updated_at
        FROM users
        WHERE role = 'root' AND tenant_id = ?
        ORDER BY created_at DESC`,
        [tenantId],
      );

      return users.map((user: UsersRow) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name ?? '',
        lastName: user.last_name ?? '',
        position: user.position ?? undefined,
        notes: user.notes ?? undefined,
        employeeNumber: user.employee_number,
        departmentId: user.department_id ?? undefined,
        isActive: Boolean(user.is_active),
        employeeId: user.employee_id ?? '',
        createdAt:
          typeof user.created_at === 'string' ? new Date(user.created_at) : user.created_at,
        updatedAt:
          typeof user.updated_at === 'string' ? new Date(user.updated_at) : user.updated_at,
      }));
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve root users', error);
    }
  }

  /**
   * Get single root user
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   */
  async getRootUserById(id: number, tenantId: number): Promise<RootUser | null> {
    try {
      const [users] = await execute<UsersRow[]>(
        `SELECT
          id, username, email, first_name, last_name,
          position, notes, employee_number, department_id, is_active, employee_id, created_at, updated_at
        FROM users
        WHERE id = ? AND role = 'root' AND tenant_id = ?`,
        [id, tenantId],
      );

      if (users.length === 0) {
        return null;
      }

      const user = users[0];
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name ?? '',
        lastName: user.last_name ?? '',
        position: user.position ?? undefined,
        notes: user.notes ?? undefined,
        employeeNumber: user.employee_number,
        departmentId: user.department_id ?? undefined,
        isActive: Boolean(user.is_active),
        employeeId: user.employee_id ?? '',
        createdAt:
          typeof user.created_at === 'string' ? new Date(user.created_at) : user.created_at,
        updatedAt:
          typeof user.updated_at === 'string' ? new Date(user.updated_at) : user.updated_at,
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve root user', error);
    }
  }

  /**
   * Validate email doesn't exist
   */
  private async checkEmailExists(email: string, tenantId: number): Promise<void> {
    const [existing] = await execute<IdResult[]>(
      'SELECT id FROM users WHERE email = ? AND tenant_id = ?',
      [email, tenantId],
    );

    if (existing.length > 0) {
      throw new ServiceError('DUPLICATE_EMAIL', 'Email already in use', 400);
    }
  }

  /**
   * Get tenant subdomain
   */
  private async getTenantSubdomain(tenantId: number): Promise<string> {
    interface SubdomainResult extends RowDataPacket {
      subdomain: string;
    }
    const [tenantData] = await execute<SubdomainResult[]>(
      'SELECT subdomain FROM tenants WHERE id = ?',
      [tenantId],
    );
    return tenantData[0]?.subdomain ?? 'DEFAULT';
  }

  /**
   * Log creation errors
   */
  private logCreationError(error: unknown): void {
    logger.error('[RootService] Error creating root user:', error);

    if (isMySQLError(error)) {
      logger.error('[RootService] MySQL Error:', {
        code: error.code,
        message: error.sqlMessage,
        sql: error.sql,
      });
    } else if (error instanceof Error) {
      logger.error('[RootService] Error details:', {
        name: error.name,
        message: error.message,
      });
    }
  }

  /**
   * Create root user
   */
  async createRootUser(data: CreateRootUserRequest, tenantId: number): Promise<number> {
    try {
      logger.info('[RootService.createRootUser] Starting', { email: data.email, tenantId });

      // Validate email
      await this.checkEmailExists(data.email, tenantId);

      // Get tenant info
      const subdomain = await this.getTenantSubdomain(tenantId);

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create root user
      const [result] = await execute<ResultSetHeader>(
        `INSERT INTO users (
          username, email, password, first_name, last_name,
          role, position, notes, employee_number, department_id, is_active, tenant_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'root', ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          data.username || data.email,
          data.email,
          hashedPassword,
          data.firstName,
          data.lastName,
          data.position,
          data.notes,
          data.employeeNumber ?? null,
          data.departmentId ?? null,
          data.isActive ?? true,
          tenantId,
        ],
      );

      // Generate and update employee_id
      const employeeId = generateEmployeeId(subdomain, 'root', result.insertId);
      await execute('UPDATE users SET employee_id = ? WHERE id = ?', [employeeId, result.insertId]);

      logger.info('[RootService.createRootUser] Created with ID:', result.insertId);
      return result.insertId;
    } catch (error: unknown) {
      this.logCreationError(error);
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('SERVER_ERROR', 'Failed to create root user', error);
    }
  }

  /**
   * Helper: Build SQL update fields and values
   */
  private buildRootUserUpdateFields(data: UpdateRootUserRequest): {
    fields: string[];
    values: unknown[];
  } {
    const fields: string[] = [];
    const values: unknown[] = [];

    // Map of request properties to database columns
    const fieldMappings: { field: keyof UpdateRootUserRequest; column: string }[] = [
      { field: 'firstName', column: 'first_name' },
      { field: 'lastName', column: 'last_name' },
      { field: 'email', column: 'email' },
      { field: 'position', column: 'position' },
      { field: 'notes', column: 'notes' },
      { field: 'employeeNumber', column: 'employee_number' },
      { field: 'departmentId', column: 'department_id' },
      { field: 'isActive', column: 'is_active' },
    ];

    // Build fields and values arrays
    for (const mapping of fieldMappings) {
      const value = data[mapping.field];
      if (value !== undefined) {
        fields.push(`${mapping.column} = ?`);
        values.push(value);
      }
    }

    return { fields, values };
  }

  /**
   * Update root user
   * @param id - The resource ID
   * @param data - The data object
   * @param tenantId - The tenant ID
   */
  async updateRootUser(id: number, data: UpdateRootUserRequest, tenantId: number): Promise<void> {
    try {
      // Check if user exists
      const user = await this.getRootUserById(id, tenantId);
      if (!user) {
        throw new ServiceError('NOT_FOUND', 'Root user not found', 404);
      }

      const { fields, values } = this.buildRootUserUpdateFields(data);

      // Hash password if provided
      if (data.password !== undefined && data.password !== '') {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        fields.push('password = ?');
        values.push(hashedPassword);
      }

      if (fields.length === 0) {
        return; // Nothing to update
      }

      // Add timestamp and ID for WHERE clause
      fields.push('updated_at = NOW()');
      values.push(id);

      await execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('SERVER_ERROR', 'Failed to update root user', error);
    }
  }

  /**
   * Delete root user
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   * @param currentUserId - The currentUserId parameter
   */
  async deleteRootUser(id: number, tenantId: number, currentUserId: number): Promise<void> {
    try {
      // Prevent self-deletion
      if (id === currentUserId) {
        throw new ServiceError('SELF_DELETE', 'Cannot delete yourself', 400);
      }

      // Check if user exists
      const user = await this.getRootUserById(id, tenantId);
      if (!user) {
        throw new ServiceError('NOT_FOUND', 'Root user not found', 404);
      }

      // Check if at least one root user will remain
      const [rootCount] = await execute<CountResult[]>(
        "SELECT COUNT(*) as count FROM users WHERE role = 'root' AND tenant_id = ? AND id != ?",
        [tenantId, id],
      );

      if (rootCount[0].count < 1) {
        throw new ServiceError(
          'LAST_ROOT_USER',
          'At least one root user must remain in the system',
          400,
        );
      }

      // Delete user's related data first (to avoid foreign key constraints)
      await execute('DELETE FROM oauth_tokens WHERE user_id = ?', [id]);
      await execute('DELETE FROM user_teams WHERE user_id = ?', [id]);
      await execute('DELETE FROM user_departments WHERE user_id = ?', [id]);

      // Now delete the user
      await execute('DELETE FROM users WHERE id = ?', [id]);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('SERVER_ERROR', 'Failed to delete root user', error);
    }
  }

  /**
   * Get dashboard statistics
   * @param tenantId - The tenant ID
   */
  async getDashboardStats(tenantId: number): Promise<DashboardStats> {
    try {
      // Get user counts
      const admins = await userModel.findByRole('admin', false, tenantId);
      const employees = await userModel.findByRole('employee', false, tenantId);

      // Get tenant count (for multi-tenant overview)
      const [tenantCount] = await execute<CountResult[]>(
        "SELECT COUNT(*) as count FROM tenants WHERE status = 'active'",
      );

      // Get active features
      const [features] = await execute<FeatureCodeResult[]>(
        `SELECT f.code
         FROM tenant_features tf
         JOIN features f ON tf.feature_id = f.id
         WHERE tf.tenant_id = ? AND tf.is_active = 1`,
        [tenantId],
      );

      const activeFeatures = features.map((f: FeatureCodeResult) => f.code);

      // Simple system health check
      const systemHealth = {
        database: 'healthy' as const,
        storage: 'healthy' as const,
        services: 'healthy' as const,
      };

      return {
        adminCount: admins.length,
        employeeCount: employees.length,
        totalUsers: admins.length + employees.length + 1, // +1 for root
        tenantCount: tenantCount[0].count,
        activeFeatures,
        systemHealth,
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get dashboard stats', error);
    }
  }

  /**
   * Get storage information
   * @param tenantId - The tenant ID
   */
  async getStorageInfo(tenantId: number): Promise<StorageInfo> {
    try {
      // Get tenant information
      const tenant = await tenantModel.findById(tenantId);
      if (!tenant) {
        throw new ServiceError('NOT_FOUND', 'Tenant not found', 404);
      }

      // Storage limits by plan
      const storageLimits: Record<string, number> = {
        basic: 5 * 1024 * 1024 * 1024, // 5 GB
        professional: 25 * 1024 * 1024 * 1024, // 25 GB
        enterprise: 100 * 1024 * 1024 * 1024, // 100 GB
      };

      const totalStorage = storageLimits[tenant.current_plan ?? 'basic'] ?? storageLimits.basic;

      // Get storage breakdown
      interface StorageTotalResult extends RowDataPacket {
        total: number;
      }
      const [documents] = await execute<StorageTotalResult[]>(
        'SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = ?',
        [tenantId],
      );

      const [attachments] = await execute<StorageTotalResult[]>(
        `SELECT COALESCE(SUM(ka.file_size), 0) as total
         FROM kvp_attachments ka
         JOIN kvp_suggestions ks ON ka.suggestion_id = ks.id
         WHERE ks.tenant_id = ?`,
        [tenantId],
      );

      const [logs] = await execute<StorageTotalResult[]>(
        "SELECT COALESCE(SUM(LENGTH(action) + LENGTH(COALESCE(details, ''))), 0) as total FROM admin_logs WHERE tenant_id = ?",
        [tenantId],
      );

      const documentsSize = documents[0].total;
      const attachmentsSize = attachments[0].total;
      const logsSize = logs[0].total;
      const backupsSize = 0; // Placeholder

      const usedStorage = documentsSize + attachmentsSize + logsSize + backupsSize;
      const percentage = Math.round((usedStorage / totalStorage) * 100);

      return {
        used: usedStorage,
        total: totalStorage,
        percentage: Math.min(percentage, 100),
        plan: tenant.current_plan ?? 'basic',
        breakdown: {
          documents: documentsSize,
          attachments: attachmentsSize,
          logs: logsSize,
          backups: backupsSize,
        },
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get storage info', error);
    }
  }

  /**
   * Request tenant deletion
   * @param tenantId - The tenant ID
   * @param requestedBy - The requestedBy parameter
   * @param reason - The reason parameter
   * @param ipAddress - The ipAddress parameter
   */
  async requestTenantDeletion(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<number> {
    try {
      // Check if there are at least 2 root users
      const rootUsers = await userModel.findByRole('root', false, tenantId);
      if (rootUsers.length < 2) {
        throw new ServiceError(
          'INSUFFICIENT_ROOT_USERS',
          'At least 2 root users required before tenant deletion',
          400,
        );
      }

      const result = await tenantDeletionService.requestTenantDeletion(
        tenantId,
        requestedBy,
        reason ?? 'No reason provided',
        ipAddress,
      );
      return result.queueId;
    } catch (error: unknown) {
      logger.error('Error in requestTenantDeletion:', error);
      if (error instanceof ServiceError) throw error;

      // Check for specific error messages
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('already marked_for_deletion')) {
        throw new ServiceError('ALREADY_SCHEDULED', 'Tenant is already marked for deletion', 409);
      }

      throw new ServiceError('SERVER_ERROR', 'Failed to request deletion', error);
    }
  }

  /**
   * Get tenant deletion status
   * @param tenantId - The tenant ID
   */
  async getDeletionStatus(
    tenantId: number,
    currentUserId?: number,
  ): Promise<TenantDeletionStatus | null> {
    try {
      const [deletions] = await execute<DeletionQueueWithDetails[]>(
        `SELECT
          dq.*,
          t.company_name,
          u.username as requested_by_name
        FROM tenant_deletion_queue dq
        JOIN tenants t ON t.id = dq.tenant_id
        JOIN users u ON u.id = dq.created_by
        WHERE dq.tenant_id = ?
        AND dq.status NOT IN ('cancelled', 'completed')
        ORDER BY dq.created_at DESC
        LIMIT 1`,
        [tenantId],
      );

      if (deletions.length === 0) {
        return null;
      }

      const deletion = deletions[0];
      // CRITICAL: Two-person principle - creator cannot approve their own deletion request
      const isCreator = currentUserId ? deletion.created_by === currentUserId : false;
      const canApprove = deletion.status === 'pending_approval' && !isCreator;
      const canCancel = ['pending_approval', 'approved'].includes(deletion.status) && isCreator;

      return {
        queueId: deletion.id,
        tenantId: deletion.tenant_id,
        status: deletion.status as
          | 'cancelled'
          | 'pending'
          | 'approved'
          | 'executing'
          | 'completed'
          | 'failed'
          | 'stopped',
        requestedBy: deletion.created_by,
        requestedByName: deletion.requested_by_name,
        requestedAt:
          typeof deletion.created_at === 'string' ?
            new Date(deletion.created_at)
          : deletion.created_at,
        approvedBy: deletion.approved_by ?? undefined,
        approvedAt: toDate(deletion.approved_at),
        scheduledFor: toDate(deletion.scheduled_for),
        reason: deletion.reason,
        errorMessage: deletion.error_message ?? undefined,
        coolingOffHours: deletion.cooling_off_hours,
        canCancel,
        canApprove,
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get deletion status', error);
    }
  }

  /**
   * Get all deletion requests
   */
  async getAllDeletionRequests(): Promise<DeletionApproval[]> {
    try {
      const [deletions] = await execute<DeletionRequestWithDetails[]>(
        `SELECT
          q.*,
          t.company_name,
          t.subdomain,
          u.username as requester_name,
          u.email as requester_email
        FROM tenant_deletion_queue q
        JOIN tenants t ON t.id = q.tenant_id
        JOIN users u ON u.id = q.created_by
        ORDER BY q.created_at DESC`,
      );

      return deletions.map(
        (d: DeletionRequestWithDetails): DeletionApproval => ({
          queueId: d.id,
          tenantId: d.tenant_id,
          companyName: d.company_name,
          subdomain: d.subdomain,
          requesterId: d.created_by,
          requesterName: d.requester_name,
          requesterEmail: d.requester_email,
          requestedAt: typeof d.created_at === 'string' ? new Date(d.created_at) : d.created_at,
          reason: d.reason,
          status: d.status,
        }),
      );
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get deletion requests', error);
    }
  }

  /**
   * Get pending approvals
   * @param currentUserId - The currentUserId parameter
   */
  async getPendingApprovals(currentUserId: number): Promise<DeletionApproval[]> {
    try {
      const [approvals] = await execute<DeletionRequestWithDetails[]>(
        `SELECT
          q.*,
          t.company_name,
          t.subdomain,
          u.username as requester_name,
          u.email as requester_email
        FROM tenant_deletion_queue q
        JOIN tenants t ON t.id = q.tenant_id
        JOIN users u ON u.id = q.created_by
        WHERE q.status = 'pending'
        AND q.created_by != ?
        ORDER BY q.created_at DESC`,
        [currentUserId],
      );

      return approvals.map(
        (a: DeletionRequestWithDetails): DeletionApproval => ({
          queueId: a.id,
          tenantId: a.tenant_id,
          companyName: a.company_name,
          subdomain: a.subdomain,
          requesterId: a.created_by,
          requesterName: a.requester_name,
          requesterEmail: a.requester_email,
          requestedAt: typeof a.created_at === 'string' ? new Date(a.created_at) : a.created_at,
          reason: a.reason,
          status: a.status,
        }),
      );
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to get pending approvals', error);
    }
  }

  /**
   * Perform deletion dry run
   * @param tenantId - The tenant ID
   */
  async performDeletionDryRun(tenantId: number): Promise<DeletionDryRunReport> {
    try {
      const report = await tenantDeletionService.performDryRun(tenantId);

      // Get tenant name
      const tenant = await tenantModel.findById(tenantId);
      const companyName = tenant?.company_name ?? 'Unknown';

      // Transform to our API format
      return {
        tenantId: report.tenantId,
        companyName,
        estimatedDuration: `${report.estimatedDuration} minutes`,
        affectedRecords: {
          users: report.affectedRecords.users || 0,
          documents: report.affectedRecords.documents || 0,
          departments: report.affectedRecords.departments || 0,
          teams: report.affectedRecords.teams || 0,
          shifts: report.affectedRecords.shifts || 0,
          kvpSuggestions: report.affectedRecords.kvp_suggestions || 0,
          surveys: report.affectedRecords.surveys || 0,
          logs: report.affectedRecords.logs || 0,
          total: report.totalRecords || 0,
        },
        storageToFree: 0, // Not provided by service
        warnings: report.warnings,
        canProceed: report.blockers.length === 0,
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to perform dry run', error);
    }
  }
}

// Export singleton instance
export const rootService = new RootService();
