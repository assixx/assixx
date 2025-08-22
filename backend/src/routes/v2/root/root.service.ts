/**
 * Root Service v2
 * Business logic for root user operations and tenant management
 */
import bcrypt from 'bcryptjs';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import rootLog from '../../../models/rootLog';
import tenantModel from '../../../models/tenant.js';
import userModel from '../../../models/user.js';
import { tenantDeletionService } from '../../../services/tenantDeletion.service.js';
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
  RootUser,
  StorageInfo,
  Tenant,
  TenantDeletionStatus,
  UpdateAdminRequest,
  UpdateRootUserRequest,
} from './types.js';

interface TenantRow extends RowDataPacket {
  id: number;
  company_name: string;
  subdomain: string;
  current_plan?: string;
  status: string;
  max_users?: number;
  max_admins?: number;
  industry?: string;
  country?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 *
 */
export class RootService {
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
        admins.map(async (admin) => {
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
            isActive: admin.is_active ?? false,
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

      if (!admin || admin.role !== 'admin') {
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
        isActive: admin.is_active ?? false,
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
      const adminData = {
        username: data.username,
        email: data.email,
        password: data.password,
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
      const dbError = error as { code?: string };
      if (dbError.code === 'ER_DUP_ENTRY') {
        throw new ServiceError('DUPLICATE_ENTRY', 'Username or email already exists', error);
      }
      throw new ServiceError('SERVER_ERROR', 'Failed to create admin', error);
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

      const updateData: Record<string, unknown> = {};

      if (data.username !== undefined) updateData.username = data.username;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.firstName !== undefined) updateData.first_name = data.firstName;
      if (data.lastName !== undefined) updateData.last_name = data.lastName;
      if (data.company !== undefined) updateData.company = data.company;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.isActive !== undefined) updateData.is_active = data.isActive;
      if (data.employeeNumber !== undefined) updateData.employee_number = data.employeeNumber;
      if (data.position !== undefined) updateData.position = data.position;

      // Hash password if provided
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
      }

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

      return logs.map((log) => ({
        id: log.id,
        userId: log.user_id,
        action: log.action,
        entityType: log.entity_type ?? '',
        entityId: log.entity_id,
        description: log.description as string | undefined,
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
        tenants.map(async (tenant) => {
          const [adminCount] = await execute<RowDataPacket[]>(
            "SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role = 'admin'",
            [tenant.id],
          );

          const [employeeCount] = await execute<RowDataPacket[]>(
            "SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role = 'employee'",
            [tenant.id],
          );

          const [storageUsed] = await execute<RowDataPacket[]>(
            'SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = ?',
            [tenant.id],
          );

          return {
            id: tenant.id,
            companyName: tenant.company_name,
            subdomain: tenant.subdomain,
            currentPlan: tenant.current_plan ?? undefined,
            status: tenant.status as Tenant['status'],
            maxUsers: (tenant as TenantRow).max_users,
            maxAdmins: (tenant as TenantRow).max_admins,
            industry: (tenant as TenantRow).industry,
            country: (tenant as TenantRow).country,
            createdAt: tenant.created_at,
            updatedAt: tenant.updated_at,
            adminCount: (adminCount[0] as { count: number }).count,
            employeeCount: (employeeCount[0] as { count: number }).count,
            storageUsed: (storageUsed[0] as { total: number }).total,
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
      const [users] = await execute<RowDataPacket[]>(
        `SELECT
          id, username, email, first_name, last_name,
          position, notes, is_active, employee_id, created_at, updated_at
        FROM users
        WHERE role = 'root' AND tenant_id = ?
        ORDER BY created_at DESC`,
        [tenantId],
      );

      return users.map((user: RowDataPacket) => ({
        id: user.id as number,
        username: user.username as string,
        email: user.email as string,
        firstName: user.first_name as string,
        lastName: user.last_name as string,
        position: (user.position as string | null) ?? undefined,
        notes: (user.notes as string | null) ?? undefined,
        isActive: user.is_active as boolean,
        employeeId: user.employee_id as string,
        createdAt: user.created_at as Date,
        updatedAt: user.updated_at as Date,
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
      const [users] = await execute<RowDataPacket[]>(
        `SELECT
          id, username, email, first_name, last_name,
          position, notes, is_active, employee_id, created_at, updated_at
        FROM users
        WHERE id = ? AND role = 'root' AND tenant_id = ?`,
        [id, tenantId],
      );

      if (users.length === 0) {
        return null;
      }

      const user = users[0];
      return {
        id: user.id as number,
        username: user.username as string,
        email: user.email as string,
        firstName: user.first_name as string,
        lastName: user.last_name as string,
        position: (user.position as string | null) ?? undefined,
        notes: (user.notes as string | null) ?? undefined,
        isActive: user.is_active as boolean,
        employeeId: user.employee_id as string,
        createdAt: user.created_at as Date,
        updatedAt: user.updated_at as Date,
      };
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve root user', error);
    }
  }

  /**
   * Create root user
   * @param data - The data object
   * @param tenantId - The tenant ID
   */
  async createRootUser(data: CreateRootUserRequest, tenantId: number): Promise<number> {
    try {
      // Check if email already exists
      const [existing] = await execute<RowDataPacket[]>(
        'SELECT id FROM users WHERE email = ? AND tenant_id = ?',
        [data.email, tenantId],
      );

      if (existing.length > 0) {
        throw new ServiceError('DUPLICATE_EMAIL', 'Email already in use', 400);
      }

      // Get tenant subdomain for employee_id
      const [tenantData] = await execute<TenantRow[]>(
        'SELECT subdomain FROM tenants WHERE id = ?',
        [tenantId],
      );

      const subdomain = tenantData[0]?.subdomain ?? 'DEFAULT';

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create root user
      const [result] = await execute<ResultSetHeader>(
        `INSERT INTO users (
          username, email, password, first_name, last_name,
          role, position, notes, is_active, tenant_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'root', ?, ?, ?, ?, NOW(), NOW())`,
        [
          data.username || data.email,
          data.email,
          hashedPassword,
          data.firstName,
          data.lastName,
          data.position,
          data.notes,
          data.isActive ?? true,
          tenantId,
        ],
      );

      // Generate and update employee_id
      const employeeId = generateEmployeeId(subdomain, 'root', result.insertId);

      await execute('UPDATE users SET employee_id = ? WHERE id = ?', [employeeId, result.insertId]);

      return result.insertId;
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('SERVER_ERROR', 'Failed to create root user', error);
    }
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

      const fields: string[] = [];
      const values: unknown[] = [];

      if (data.firstName !== undefined) {
        fields.push('first_name = ?');
        values.push(data.firstName);
      }
      if (data.lastName !== undefined) {
        fields.push('last_name = ?');
        values.push(data.lastName);
      }
      if (data.email !== undefined) {
        fields.push('email = ?');
        values.push(data.email);
      }
      if (data.position !== undefined) {
        fields.push('position = ?');
        values.push(data.position);
      }
      if (data.notes !== undefined) {
        fields.push('notes = ?');
        values.push(data.notes);
      }
      if (data.isActive !== undefined) {
        fields.push('is_active = ?');
        values.push(data.isActive);
      }

      if (fields.length === 0) {
        return; // Nothing to update
      }

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
      const [rootCount] = await execute<RowDataPacket[]>(
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
      const [tenantCount] = await execute<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM tenants WHERE status = 'active'",
      );

      // Get active features
      const [features] = await execute<RowDataPacket[]>(
        `SELECT f.code
         FROM tenant_features tf
         JOIN features f ON tf.feature_id = f.id
         WHERE tf.tenant_id = ? AND tf.is_active = 1`,
        [tenantId],
      );

      const activeFeatures = features.map((f: RowDataPacket) => f.code as string);

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
        tenantCount: (tenantCount[0] as { count: number }).count,
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
      const [documents] = await execute<RowDataPacket[]>(
        'SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = ?',
        [tenantId],
      );

      const [attachments] = await execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(ka.file_size), 0) as total
         FROM kvp_attachments ka
         JOIN kvp_suggestions ks ON ka.suggestion_id = ks.id
         WHERE ks.tenant_id = ?`,
        [tenantId],
      );

      const [logs] = await execute<RowDataPacket[]>(
        "SELECT COALESCE(SUM(LENGTH(action) + LENGTH(COALESCE(details, ''))), 0) as total FROM admin_logs WHERE tenant_id = ?",
        [tenantId],
      );

      const documentsSize = Number(documents[0].total);
      const attachmentsSize = Number(attachments[0].total);
      const logsSize = Number(logs[0].total);
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

      return await tenantDeletionService.requestTenantDeletion(
        tenantId,
        requestedBy,
        reason ?? 'No reason provided',
        ipAddress,
      );
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('SERVER_ERROR', 'Failed to request deletion', error);
    }
  }

  /**
   * Get tenant deletion status
   * @param tenantId - The tenant ID
   */
  async getDeletionStatus(tenantId: number): Promise<TenantDeletionStatus | null> {
    try {
      const [deletions] = await execute<RowDataPacket[]>(
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
      return {
        queueId: deletion.id as number,
        tenantId: deletion.tenant_id as number,
        status: deletion.status as
          | 'cancelled'
          | 'pending'
          | 'approved'
          | 'executing'
          | 'completed'
          | 'failed'
          | 'stopped',
        requestedBy: deletion.created_by as number,
        requestedByName: deletion.requested_by_name as string,
        requestedAt: deletion.created_at as Date,
        approvedBy: (deletion.approved_by as number | null) ?? undefined,
        approvedAt: (deletion.approved_at as Date | null) ?? undefined,
        scheduledFor: (deletion.scheduled_for as Date | null) ?? undefined,
        reason: deletion.reason as string,
        errorMessage: (deletion.error_message as string | null) ?? undefined,
        canCancel: ['pending', 'approved'].includes(deletion.status as string),
        canApprove: deletion.status === 'pending',
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
      const [deletions] = await execute<RowDataPacket[]>(
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

      return deletions.map((d: RowDataPacket) => ({
        queueId: d.id as number,
        tenantId: d.tenant_id as number,
        companyName: d.company_name as string,
        subdomain: d.subdomain as string,
        requesterId: d.created_by as number,
        requesterName: d.requester_name as string,
        requesterEmail: d.requester_email as string,
        requestedAt: d.created_at as Date,
        reason: d.reason as string,
        status: d.status as string,
      }));
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
      const [approvals] = await execute<RowDataPacket[]>(
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

      return approvals.map((a: RowDataPacket) => ({
        queueId: a.id as number,
        tenantId: a.tenant_id as number,
        companyName: a.company_name as string,
        subdomain: a.subdomain as string,
        requesterId: a.created_by as number,
        requesterName: a.requester_name as string,
        requesterEmail: a.requester_email as string,
        requestedAt: a.created_at as Date,
        reason: a.reason as string,
        status: a.status as string,
      }));
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
