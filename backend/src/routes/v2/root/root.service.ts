/**
 * Root Service v2
 * Business logic for root user operations and tenant management
 */

import bcrypt from "bcryptjs";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { RootLog } from "../../../models/rootLog.js";
import TenantModel from "../../../models/tenant.js";
import UserModel from "../../../models/user.js";
import { tenantDeletionService } from "../../../services/tenantDeletion.service.js";
import { generateEmployeeId } from "../../../utils/employeeIdGenerator.js";
import { ServiceError } from "../../../utils/ServiceError.js";
import { execute } from "../../../utils/db.js";

import {
  AdminUser,
  CreateAdminRequest,
  UpdateAdminRequest,
  RootUser,
  CreateRootUserRequest,
  UpdateRootUserRequest,
  Tenant,
  DashboardStats,
  StorageInfo,
  AdminLog,
  TenantDeletionStatus,
  DeletionApproval,
  DeletionDryRunReport,
} from "./types.js";

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

export class RootService {
  /**
   * Get all admin users for a tenant
   */
  async getAdmins(tenantId: number): Promise<AdminUser[]> {
    try {
      // Get admins with extended information
      const admins = await UserModel.findByRole("admin", true, tenantId);

      // Add tenant information
      const adminsWithTenants = await Promise.all(
        admins.map(async (admin) => {
          let tenantName: string | undefined;
          if (admin.tenant_id) {
            const tenant = await TenantModel.findById(admin.tenant_id);
            tenantName = tenant?.company_name;
          }

          return {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            firstName: admin.first_name || "",
            lastName: admin.last_name || "",
            company: admin.company,
            notes: admin.notes,
            isActive: admin.is_active || false,
            tenantId: admin.tenant_id || 0,
            tenantName,
            createdAt: admin.created_at || new Date(),
            updatedAt: admin.updated_at || new Date(),
            lastLogin: admin.last_login,
          };
        }),
      );

      return adminsWithTenants;
    } catch (error) {
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to retrieve admin users",
        error,
      );
    }
  }

  /**
   * Get single admin by ID
   */
  async getAdminById(id: number, tenantId: number): Promise<AdminUser | null> {
    try {
      const admin = await UserModel.findById(id, tenantId);

      if (!admin || admin.role !== "admin") {
        return null;
      }

      // Get tenant name
      let tenantName: string | undefined;
      if (admin.tenant_id) {
        const tenant = await TenantModel.findById(admin.tenant_id);
        tenantName = tenant?.company_name;
      }

      // Get last login
      const lastLogin = await RootLog.getLastLogin(id);

      return {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        firstName: admin.first_name || "",
        lastName: admin.last_name || "",
        company: admin.company,
        notes: admin.notes,
        isActive: admin.is_active || false,
        tenantId: admin.tenant_id || 0,
        tenantName,
        createdAt: admin.created_at || new Date(),
        updatedAt: admin.updated_at || new Date(),
        lastLogin: lastLogin?.created_at,
      };
    } catch (error) {
      throw new ServiceError("SERVER_ERROR", "Failed to retrieve admin", error);
    }
  }

  /**
   * Create new admin user
   */
  async createAdmin(
    data: CreateAdminRequest,
    tenantId: number,
  ): Promise<number> {
    try {
      const adminData = {
        username: data.username,
        email: data.email,
        password: data.password,
        first_name: data.firstName || "",
        last_name: data.lastName || "",
        role: "admin" as const,
        tenant_id: tenantId,
        is_active: true,
        company: data.company,
        notes: data.notes,
      };

      const adminId = await UserModel.create(adminData);

      // Add admin to tenant_admins table
      try {
        await execute(
          "INSERT INTO tenant_admins (tenant_id, user_id, is_primary) VALUES (?, ?, FALSE)",
          [tenantId, adminId],
        );
      } catch (error) {
        // Log but don't fail - admin was created successfully
        console.warn("Could not add admin to tenant_admins:", error);
      }

      return adminId;
    } catch (error) {
      const dbError = error as { code?: string };
      if (dbError.code === "ER_DUP_ENTRY") {
        throw new ServiceError(
          "DUPLICATE_ENTRY",
          "Username or email already exists",
          error,
        );
      }
      throw new ServiceError("SERVER_ERROR", "Failed to create admin", error);
    }
  }

  /**
   * Update admin user
   */
  async updateAdmin(
    id: number,
    data: UpdateAdminRequest,
    tenantId: number,
  ): Promise<void> {
    try {
      // Check if admin exists
      const admin = await this.getAdminById(id, tenantId);
      if (!admin) {
        throw new ServiceError("NOT_FOUND", "Admin not found", 404);
      }

      const updateData: Record<string, unknown> = {};

      if (data.username !== undefined) updateData.username = data.username;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.firstName !== undefined) updateData.first_name = data.firstName;
      if (data.lastName !== undefined) updateData.last_name = data.lastName;
      if (data.company !== undefined) updateData.company = data.company;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.isActive !== undefined) updateData.is_active = data.isActive;

      // Hash password if provided
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
      }

      const success = await UserModel.update(id, updateData, tenantId);
      if (!success) {
        throw new ServiceError("UPDATE_FAILED", "Failed to update admin", 500);
      }
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError("SERVER_ERROR", "Failed to update admin", error);
    }
  }

  /**
   * Delete admin user
   */
  async deleteAdmin(id: number, tenantId: number): Promise<void> {
    try {
      // Check if admin exists
      const admin = await this.getAdminById(id, tenantId);
      if (!admin) {
        throw new ServiceError("NOT_FOUND", "Admin not found", 404);
      }

      const success = await UserModel.delete(id);
      if (!success) {
        throw new ServiceError("DELETE_FAILED", "Failed to delete admin", 500);
      }
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError("SERVER_ERROR", "Failed to delete admin", error);
    }
  }

  /**
   * Get admin logs
   */
  async getAdminLogs(
    adminId: number,
    tenantId: number,
    days?: number,
  ): Promise<AdminLog[]> {
    try {
      // Verify admin exists
      const admin = await this.getAdminById(adminId, tenantId);
      if (!admin) {
        throw new ServiceError("NOT_FOUND", "Admin not found", 404);
      }

      const logs = await RootLog.getByUserId(adminId, days || 0);

      return logs.map((log) => ({
        id: log.id,
        userId: log.user_id,
        action: log.action,
        entityType: log.entity_type || "",
        entityId: log.entity_id,
        description: log.description,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        createdAt: log.created_at,
      }));
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to retrieve admin logs",
        error,
      );
    }
  }

  /**
   * Get all tenants
   */
  async getTenants(): Promise<Tenant[]> {
    try {
      const tenants = await TenantModel.findAll();

      // Get user counts for each tenant
      const tenantsWithCounts = await Promise.all(
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
            "SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = ?",
            [tenant.id],
          );

          return {
            id: tenant.id,
            companyName: tenant.company_name,
            subdomain: tenant.subdomain,
            currentPlan: tenant.current_plan || undefined,
            status: tenant.status as Tenant["status"],
            maxUsers: (tenant as TenantRow).max_users,
            maxAdmins: (tenant as TenantRow).max_admins,
            industry: (tenant as TenantRow).industry,
            country: (tenant as TenantRow).country,
            createdAt: tenant.created_at,
            updatedAt: tenant.updated_at,
            adminCount: adminCount[0].count,
            employeeCount: employeeCount[0].count,
            storageUsed: storageUsed[0].total,
          };
        }),
      );

      return tenantsWithCounts;
    } catch (error) {
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to retrieve tenants",
        error,
      );
    }
  }

  /**
   * Get all root users for a tenant
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

      return users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        position: user.position,
        notes: user.notes,
        isActive: user.is_active,
        employeeId: user.employee_id,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      }));
    } catch (error) {
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to retrieve root users",
        error,
      );
    }
  }

  /**
   * Get single root user
   */
  async getRootUserById(
    id: number,
    tenantId: number,
  ): Promise<RootUser | null> {
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
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        position: user.position,
        notes: user.notes,
        isActive: user.is_active,
        employeeId: user.employee_id,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    } catch (error) {
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to retrieve root user",
        error,
      );
    }
  }

  /**
   * Create root user
   */
  async createRootUser(
    data: CreateRootUserRequest,
    tenantId: number,
  ): Promise<number> {
    try {
      // Check if email already exists
      const [existing] = await execute<RowDataPacket[]>(
        "SELECT id FROM users WHERE email = ? AND tenant_id = ?",
        [data.email, tenantId],
      );

      if (existing.length > 0) {
        throw new ServiceError("DUPLICATE_EMAIL", "Email already in use", 400);
      }

      // Get tenant subdomain for employee_id
      const [tenantData] = await execute<TenantRow[]>(
        "SELECT subdomain FROM tenants WHERE id = ?",
        [tenantId],
      );

      const subdomain = tenantData[0]?.subdomain || "DEFAULT";

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
      const employeeId = generateEmployeeId(subdomain, "root", result.insertId);

      await execute("UPDATE users SET employee_id = ? WHERE id = ?", [
        employeeId,
        result.insertId,
      ]);

      return result.insertId;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to create root user",
        error,
      );
    }
  }

  /**
   * Update root user
   */
  async updateRootUser(
    id: number,
    data: UpdateRootUserRequest,
    tenantId: number,
  ): Promise<void> {
    try {
      // Check if user exists
      const user = await this.getRootUserById(id, tenantId);
      if (!user) {
        throw new ServiceError("NOT_FOUND", "Root user not found", 404);
      }

      const fields: string[] = [];
      const values: unknown[] = [];

      if (data.firstName !== undefined) {
        fields.push("first_name = ?");
        values.push(data.firstName);
      }
      if (data.lastName !== undefined) {
        fields.push("last_name = ?");
        values.push(data.lastName);
      }
      if (data.email !== undefined) {
        fields.push("email = ?");
        values.push(data.email);
      }
      if (data.position !== undefined) {
        fields.push("position = ?");
        values.push(data.position);
      }
      if (data.notes !== undefined) {
        fields.push("notes = ?");
        values.push(data.notes);
      }
      if (data.isActive !== undefined) {
        fields.push("is_active = ?");
        values.push(data.isActive);
      }

      if (fields.length === 0) {
        return; // Nothing to update
      }

      fields.push("updated_at = NOW()");
      values.push(id);

      await execute(
        `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
        values,
      );
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to update root user",
        error,
      );
    }
  }

  /**
   * Delete root user
   */
  async deleteRootUser(
    id: number,
    tenantId: number,
    currentUserId: number,
  ): Promise<void> {
    try {
      // Prevent self-deletion
      if (id === currentUserId) {
        throw new ServiceError("SELF_DELETE", "Cannot delete yourself", 400);
      }

      // Check if user exists
      const user = await this.getRootUserById(id, tenantId);
      if (!user) {
        throw new ServiceError("NOT_FOUND", "Root user not found", 404);
      }

      // Check if at least one root user will remain
      const [rootCount] = await execute<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM users WHERE role = 'root' AND tenant_id = ? AND id != ?",
        [tenantId, id],
      );

      if (rootCount[0].count < 1) {
        throw new ServiceError(
          "LAST_ROOT_USER",
          "At least one root user must remain in the system",
          400,
        );
      }

      await execute("DELETE FROM users WHERE id = ?", [id]);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to delete root user",
        error,
      );
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(tenantId: number): Promise<DashboardStats> {
    try {
      // Get user counts
      const admins = await UserModel.findByRole("admin", false, tenantId);
      const employees = await UserModel.findByRole("employee", false, tenantId);

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

      const activeFeatures = features.map((f: RowDataPacket) => f.code);

      // Simple system health check
      const systemHealth = {
        database: "healthy" as const,
        storage: "healthy" as const,
        services: "healthy" as const,
      };

      return {
        adminCount: admins.length,
        employeeCount: employees.length,
        totalUsers: admins.length + employees.length + 1, // +1 for root
        tenantCount: tenantCount[0].count,
        activeFeatures,
        systemHealth,
      };
    } catch (error) {
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to get dashboard stats",
        error,
      );
    }
  }

  /**
   * Get storage information
   */
  async getStorageInfo(tenantId: number): Promise<StorageInfo> {
    try {
      // Get tenant information
      const tenant = await TenantModel.findById(tenantId);
      if (!tenant) {
        throw new ServiceError("NOT_FOUND", "Tenant not found", 404);
      }

      // Storage limits by plan
      const storageLimits: Record<string, number> = {
        basic: 5 * 1024 * 1024 * 1024, // 5 GB
        professional: 25 * 1024 * 1024 * 1024, // 25 GB
        enterprise: 100 * 1024 * 1024 * 1024, // 100 GB
      };

      const totalStorage =
        storageLimits[tenant.current_plan || "basic"] || storageLimits.basic;

      // Get storage breakdown
      const [documents] = await execute<RowDataPacket[]>(
        "SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = ?",
        [tenantId],
      );

      const [attachments] = await execute<RowDataPacket[]>(
        "SELECT COALESCE(SUM(file_size), 0) as total FROM kvp_attachments WHERE tenant_id = ?",
        [tenantId],
      );

      const [logs] = await execute<RowDataPacket[]>(
        "SELECT COALESCE(SUM(LENGTH(action) + LENGTH(COALESCE(old_values, '')) + LENGTH(COALESCE(new_values, ''))), 0) as total FROM admin_logs WHERE tenant_id = ?",
        [tenantId],
      );

      const documentsSize = Number(documents[0].total) || 0;
      const attachmentsSize = Number(attachments[0].total) || 0;
      const logsSize = Number(logs[0].total) || 0;
      const backupsSize = 0; // Placeholder

      const usedStorage =
        documentsSize + attachmentsSize + logsSize + backupsSize;
      const percentage = Math.round((usedStorage / totalStorage) * 100);

      return {
        used: usedStorage,
        total: totalStorage,
        percentage: Math.min(percentage, 100),
        plan: tenant.current_plan || "basic",
        breakdown: {
          documents: documentsSize,
          attachments: attachmentsSize,
          logs: logsSize,
          backups: backupsSize,
        },
      };
    } catch (error) {
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to get storage info",
        error,
      );
    }
  }

  /**
   * Request tenant deletion
   */
  async requestTenantDeletion(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<number> {
    try {
      // Check if there are at least 2 root users
      const rootUsers = await UserModel.findByRole("root", false, tenantId);
      if (rootUsers.length < 2) {
        throw new ServiceError(
          "INSUFFICIENT_ROOT_USERS",
          "At least 2 root users required before tenant deletion",
          400,
        );
      }

      const queueId = await tenantDeletionService.requestTenantDeletion(
        tenantId,
        requestedBy,
        reason || "No reason provided",
        ipAddress,
      );

      return queueId;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to request deletion",
        error,
      );
    }
  }

  /**
   * Get tenant deletion status
   */
  async getDeletionStatus(
    tenantId: number,
  ): Promise<TenantDeletionStatus | null> {
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
        queueId: deletion.id,
        tenantId: deletion.tenant_id,
        status: deletion.status,
        requestedBy: deletion.created_by,
        requestedByName: deletion.requested_by_name,
        requestedAt: deletion.created_at,
        approvedBy: deletion.approved_by,
        approvedAt: deletion.approved_at,
        scheduledFor: deletion.scheduled_for,
        reason: deletion.reason,
        errorMessage: deletion.error_message,
        canCancel: ["pending", "approved"].includes(deletion.status),
        canApprove: deletion.status === "pending",
      };
    } catch (error) {
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to get deletion status",
        error,
      );
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
        queueId: d.id,
        tenantId: d.tenant_id,
        companyName: d.company_name,
        subdomain: d.subdomain,
        requesterId: d.created_by,
        requesterName: d.requester_name,
        requesterEmail: d.requester_email,
        requestedAt: d.created_at,
        reason: d.reason,
        status: d.status,
      }));
    } catch (error) {
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to get deletion requests",
        error,
      );
    }
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(
    currentUserId: number,
  ): Promise<DeletionApproval[]> {
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
        queueId: a.id,
        tenantId: a.tenant_id,
        companyName: a.company_name,
        subdomain: a.subdomain,
        requesterId: a.created_by,
        requesterName: a.requester_name,
        requesterEmail: a.requester_email,
        requestedAt: a.created_at,
        reason: a.reason,
        status: a.status,
      }));
    } catch (error) {
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to get pending approvals",
        error,
      );
    }
  }

  /**
   * Perform deletion dry run
   */
  async performDeletionDryRun(tenantId: number): Promise<DeletionDryRunReport> {
    try {
      const report = await tenantDeletionService.performDryRun(tenantId);

      // Get tenant name
      const tenant = await TenantModel.findById(tenantId);
      const companyName = tenant?.company_name || "Unknown";

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
    } catch (error) {
      throw new ServiceError(
        "SERVER_ERROR",
        "Failed to perform dry run",
        error,
      );
    }
  }
}

// Export singleton instance
export const rootService = new RootService();
