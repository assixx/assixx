/* eslint-disable max-lines */
/**
 * Root Service v2
 * Business logic for root user operations and tenant management
 */
import bcrypt from 'bcryptjs';

import { tenantDeletionService } from '../../../services/tenantDeletion.service.js';
import { UsersRow } from '../../../types/database-rows.types.js';
import type { DatabaseTenant } from '../../../types/models.js';
import { CountResult, IdResult } from '../../../types/query-results.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { ResultSetHeader, RowDataPacket, execute } from '../../../utils/db.js';
import { generateEmployeeId } from '../../../utils/employeeIdGenerator.js';
import { logger } from '../../../utils/logger.js';
import rootLog from '../logs/logs.service.js';
import type { DbRootLog } from '../logs/types.js';
import tenantModel from '../tenants/tenant.model.js';
import userModel, { type DbUser, type UserCreateData } from '../users/model/index.js';
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
  if (value === null || value === undefined) return undefined;
  return typeof value === 'string' ? new Date(value) : value;
}

/**
 * Map DbUser to AdminUser with optional tenant name and last login
 * @param admin - Database user record
 * @param tenantName - Optional tenant name from join
 * @param lastLogin - Optional last login date
 */
// Storage limits by plan (in bytes)
const STORAGE_LIMITS = {
  basic: 5 * 1024 * 1024 * 1024, // 5 GB
  professional: 25 * 1024 * 1024 * 1024, // 25 GB
  enterprise: 100 * 1024 * 1024 * 1024, // 100 GB
} as const;

type StoragePlan = keyof typeof STORAGE_LIMITS;

/**
 * Safely get storage limit for a plan, avoiding object injection
 */
function getStorageLimit(plan: string): number | undefined {
  const validPlans: StoragePlan[] = ['basic', 'professional', 'enterprise'];
  if (validPlans.includes(plan as StoragePlan)) {
    return STORAGE_LIMITS[plan as StoragePlan];
  }
  return undefined;
}

/** Storage total query result */
interface StorageTotalResult extends RowDataPacket {
  total: number;
}

/**
 * Execute storage query and return total, throwing on undefined result
 */
async function getStorageTotal(query: string, params: unknown[]): Promise<number> {
  const [rows] = await execute<StorageTotalResult[]>(query, params);
  const row = rows[0];
  if (row === undefined) {
    throw new ServiceError('SERVER_ERROR', 'Failed to get storage total', 500);
  }
  return row.total;
}

/**
 * Map deletion queue record to TenantDeletionStatus
 */
function mapDeletionToStatus(
  deletion: DeletionQueueWithDetails,
  canCancel: boolean,
  canApprove: boolean,
): TenantDeletionStatus {
  const result: TenantDeletionStatus = {
    queueId: deletion.id,
    tenantId: deletion.tenant_id,
    status: deletion.status as TenantDeletionStatus['status'],
    requestedBy: deletion.created_by,
    requestedAt:
      typeof deletion.created_at === 'string' ? new Date(deletion.created_at) : deletion.created_at,
    coolingOffHours: deletion.cooling_off_hours,
    canCancel,
    canApprove,
    requestedByName: deletion.requested_by_name,
    reason: deletion.reason,
  };

  // Add nullable properties only if not null
  if (deletion.approved_by !== null) result.approvedBy = deletion.approved_by;
  if (deletion.error_message !== null) result.errorMessage = deletion.error_message;

  const approvedAtDate = toDate(deletion.approved_at);
  if (approvedAtDate !== undefined) result.approvedAt = approvedAtDate;

  const scheduledForDate = toDate(deletion.scheduled_for);
  if (scheduledForDate !== undefined) result.scheduledFor = scheduledForDate;

  return result;
}

/**
 * Handle MySQL duplicate entry errors
 * @throws ServiceError with appropriate code based on duplicate field
 */
function handleDuplicateEntryError(error: unknown): never {
  const dbError = error as { code?: string; message?: string };
  const errorMessage = dbError.message ?? '';

  if (errorMessage.includes('employee_number')) {
    throw new ServiceError('DUPLICATE_EMPLOYEE_NUMBER', 'Employee number already exists', error);
  }
  if (errorMessage.includes('email')) {
    throw new ServiceError('DUPLICATE_EMAIL', 'Email already exists', error);
  }
  if (errorMessage.includes('username')) {
    throw new ServiceError('DUPLICATE_USERNAME', 'Username already exists', error);
  }
  throw new ServiceError('DUPLICATE_ENTRY', 'Username or email already exists', error);
}

/**
 * Map DbUser to AdminUser
 * REMOVED: company column dropped (2025-11-27)
 * UPDATED: isArchived removed, using is_active status (2025-12-02)
 */
function mapDbUserToAdminUser(admin: DbUser, tenantName?: string, lastLogin?: Date): AdminUser {
  const result: AdminUser = {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    firstName: admin.first_name,
    lastName: admin.last_name,
    isActive: admin.is_active, // Status: 0=inactive, 1=active, 3=archived, 4=deleted
    tenantId: admin.tenant_id ?? 0,
    createdAt: admin.created_at ?? new Date(),
    updatedAt: admin.updated_at ?? new Date(),
  };

  // Add optional properties only if defined
  // REMOVED: company column dropped (2025-11-27)
  if (admin.notes !== undefined) result.notes = admin.notes;
  if (admin.position !== undefined) result.position = admin.position;
  if (admin.employee_number !== undefined) result.employeeNumber = admin.employee_number;
  if (tenantName !== undefined) result.tenantName = tenantName;
  if (lastLogin !== undefined) result.lastLogin = lastLogin;

  return result;
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
          if (admin.tenant_id !== undefined) {
            const tenant = await tenantModel.findById(admin.tenant_id);
            tenantName = tenant?.company_name;
          }
          return mapDbUserToAdminUser(admin, tenantName, admin.last_login);
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
      if (admin.tenant_id !== undefined) {
        const tenant = await tenantModel.findById(admin.tenant_id);
        tenantName = tenant?.company_name;
      }

      // Get last login
      const lastLoginRecord = await rootLog.getLastLogin(id);
      const lastLogin = lastLoginRecord?.created_at;

      return mapDbUserToAdminUser(admin, tenantName, lastLogin);
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve admin', error);
    }
  }

  /**
   * Create new admin user
   * IMPORTANT: username is ALWAYS set to email (lowercase) for consistency
   * @param data - The data object
   * @param tenantId - The tenant ID
   */
  async createAdmin(data: CreateAdminRequest, tenantId: number): Promise<number> {
    try {
      // CRITICAL: username = email (lowercase, trimmed) - same pattern as createRootUser
      const normalizedEmail = data.email.toLowerCase().trim();

      // Hash password before passing to model
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Build base data (exactOptionalPropertyTypes compliant) using UserCreateData interface
      // REMOVED: company column dropped (2025-11-27)
      // CRITICAL: username = email (always lowercase) for login consistency
      const adminData: UserCreateData = {
        username: normalizedEmail, // username = email (lowercase)
        email: normalizedEmail, // email (lowercase)
        password: hashedPassword,
        first_name: data.firstName ?? '',
        last_name: data.lastName ?? '',
        role: 'admin',
        tenant_id: tenantId,
        is_active: 1, // Status: 0=inactive, 1=active, 3=archived, 4=deleted
        employee_number: data.employeeNumber ?? '',
      };

      // Add optional properties only if defined
      // REMOVED: company column dropped (2025-11-27)
      if (data.notes !== undefined) {
        adminData.notes = data.notes;
      }
      if (data.position !== undefined) {
        adminData.position = data.position;
      }

      // NOTE: tenant_admins table removed (redundant) - users.tenant_id + users.role is the source of truth

      return await userModel.create(adminData);
    } catch (error: unknown) {
      const dbError = error as { code?: string };
      if (dbError.code === 'ER_DUP_ENTRY') {
        handleDuplicateEntryError(error);
      }
      throw new ServiceError('SERVER_ERROR', 'Failed to create admin', error);
    }
  }

  /**
   * Helper: Build update data from request
   * REMOVED: company column dropped (2025-11-27)
   * CRITICAL: When email changes, username must also change (username = email, lowercase)
   */
  private buildUpdateData(data: UpdateAdminRequest): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};

    // CRITICAL: When email changes, also update username (username = email, lowercase)
    // This ensures login consistency (users log in with email)
    if (data.email !== undefined) {
      const normalizedEmail = data.email.toLowerCase().trim();
      updateData['email'] = normalizedEmail;
      updateData['username'] = normalizedEmail; // username = email
    }
    // NOTE: Separate username update is ignored - username is always synced with email
    // if (data.username !== undefined) { ... } - REMOVED for consistency

    if (data.firstName !== undefined) {
      updateData['first_name'] = data.firstName;
    }
    if (data.lastName !== undefined) {
      updateData['last_name'] = data.lastName;
    }
    // REMOVED: company column dropped (2025-11-27)
    if (data.notes !== undefined) {
      updateData['notes'] = data.notes;
    }
    if (data.isActive !== undefined) {
      updateData['is_active'] = data.isActive; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
    }
    if (data.employeeNumber !== undefined) {
      updateData['employee_number'] = data.employeeNumber;
    }
    if (data.position !== undefined) {
      updateData['position'] = data.position;
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
    if (password !== undefined && password !== '') {
      updateData['password'] = await bcrypt.hash(password, 10);
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

      // SECURITY: tenant_id required for multi-tenant isolation
      const success = await userModel.delete(id, tenantId);
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

      return logs.map((log: DbRootLog) => {
        // Build base object (exactOptionalPropertyTypes compliant)
        const result: AdminLog = {
          id: log.id,
          userId: log.user_id,
          action: log.action,
          entityType: log.entity_type ?? '',
          createdAt: log.created_at,
        };

        // Add optional properties only if defined
        if (log.entity_id !== undefined) result.entityId = log.entity_id;
        if (log.details !== undefined) result.description = log.details;
        if (log.ip_address !== undefined) result.ipAddress = log.ip_address;
        if (log.user_agent !== undefined) result.userAgent = log.user_agent;

        return result;
      });
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
            "SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND role = 'admin'",
            [tenant.id],
          );

          const [employeeCount] = await execute<CountResult[]>(
            "SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND role = 'employee'",
            [tenant.id],
          );

          interface StorageTotalResult extends RowDataPacket {
            total: number;
          }
          const [storageUsed] = await execute<StorageTotalResult[]>(
            'SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = $1',
            [tenant.id],
          );

          // Validate query results
          const adminCountRow = adminCount[0];
          if (adminCountRow === undefined) {
            throw new ServiceError('SERVER_ERROR', 'Failed to get admin count', 500);
          }

          const employeeCountRow = employeeCount[0];
          if (employeeCountRow === undefined) {
            throw new ServiceError('SERVER_ERROR', 'Failed to get employee count', 500);
          }

          const storageUsedRow = storageUsed[0];
          if (storageUsedRow === undefined) {
            throw new ServiceError('SERVER_ERROR', 'Failed to get storage usage', 500);
          }

          // Build base object (exactOptionalPropertyTypes compliant)
          const result: Tenant = {
            id: tenant.id,
            companyName: tenant.company_name,
            subdomain: tenant.subdomain,
            status: tenant.status as Tenant['status'],
            createdAt: tenant.created_at,
            updatedAt: tenant.updated_at,
          };

          // Add optional properties only if defined
          if (tenant.current_plan !== null) {
            result.currentPlan = tenant.current_plan;
          }
          result.adminCount = adminCountRow.count;
          result.employeeCount = employeeCountRow.count;
          result.storageUsed = storageUsedRow.total;

          return result;
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
      // N:M REFACTORING: department_id from user_departments table
      const [users] = await execute<UsersRow[]>(
        `SELECT
          u.id, u.username, u.email, u.first_name, u.last_name,
          u.position, u.notes, u.employee_number, ud.department_id, u.is_active, u.employee_id, u.created_at, u.updated_at
        FROM users u
        LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
        WHERE u.role = 'root' AND u.tenant_id = $1
        ORDER BY u.created_at DESC`,
        [tenantId],
      );

      return users.map((user: UsersRow) => {
        // Build base object (exactOptionalPropertyTypes compliant)
        const result: RootUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name ?? '',
          lastName: user.last_name ?? '',
          isActive: Boolean(user.is_active),
          createdAt:
            typeof user.created_at === 'string' ? new Date(user.created_at) : user.created_at,
          updatedAt:
            typeof user.updated_at === 'string' ? new Date(user.updated_at) : user.updated_at,
        };

        // Add optional properties only if defined (UsersRow uses | null not | undefined)
        if (user.position !== null) result.position = user.position;
        if (user.notes !== null) result.notes = user.notes;
        // employee_number is non-nullable in UsersRow
        result.employeeNumber = user.employee_number;
        // N:M REFACTORING: department_id comes from JOIN, access via bracket notation
        const deptId = user['department_id'] as number | null;
        if (deptId !== null) result.departmentId = deptId;
        if (user.employee_id !== null) result.employeeId = user.employee_id;

        return result;
      });
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
      // N:M REFACTORING: department_id from user_departments table
      const [users] = await execute<UsersRow[]>(
        `SELECT
          u.id, u.username, u.email, u.first_name, u.last_name,
          u.position, u.notes, u.employee_number, ud.department_id, u.is_active, u.employee_id, u.created_at, u.updated_at
        FROM users u
        LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
        WHERE u.id = $1 AND u.role = 'root' AND u.tenant_id = $2`,
        [id, tenantId],
      );

      const user = users[0];
      if (user === undefined) {
        return null;
      }

      // Build base object (exactOptionalPropertyTypes compliant)
      const result: RootUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name ?? '',
        lastName: user.last_name ?? '',
        employeeNumber: user.employee_number,
        isActive: Boolean(user.is_active),
        employeeId: user.employee_id ?? '',
        createdAt:
          typeof user.created_at === 'string' ? new Date(user.created_at) : user.created_at,
        updatedAt:
          typeof user.updated_at === 'string' ? new Date(user.updated_at) : user.updated_at,
      };

      // Add optional properties only if defined
      if (user.position !== null) {
        result.position = user.position;
      }
      if (user.notes !== null) {
        result.notes = user.notes;
      }
      // N:M REFACTORING: department_id comes from JOIN, access via bracket notation
      const deptId = user['department_id'] as number | null;
      if (deptId !== null) {
        result.departmentId = deptId;
      }

      return result;
    } catch (error: unknown) {
      throw new ServiceError('SERVER_ERROR', 'Failed to retrieve root user', error);
    }
  }

  /**
   * Validate email doesn't exist
   */
  private async checkEmailExists(email: string, tenantId: number): Promise<void> {
    const [existing] = await execute<IdResult[]>(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
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
      'SELECT subdomain FROM tenants WHERE id = $1',
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
   * IMPORTANT: username is ALWAYS set to email (lowercase)
   */
  async createRootUser(data: CreateRootUserRequest, tenantId: number): Promise<number> {
    try {
      // CRITICAL: username = email (lowercase) - Zod already transforms email to lowercase
      const normalizedEmail = data.email.toLowerCase().trim();
      logger.info('[RootService.createRootUser] Starting', { email: normalizedEmail, tenantId });

      // Validate email
      await this.checkEmailExists(normalizedEmail, tenantId);

      // Get tenant info
      const subdomain = await this.getTenantSubdomain(tenantId);

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create root user (N:M REFACTORING: department_id removed, has_full_access = true for root)
      // CRITICAL: username = email (always lowercase)
      const [result] = await execute<ResultSetHeader>(
        `INSERT INTO users (
          username, email, password, first_name, last_name,
          role, position, notes, employee_number, is_active, has_full_access, tenant_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'root', $6, $7, $8, $9, 1, $10, NOW(), NOW())`,
        [
          normalizedEmail, // username = email (lowercase)
          normalizedEmail, // email (lowercase)
          hashedPassword,
          data.firstName,
          data.lastName,
          data.position,
          data.notes,
          data.employeeNumber ?? null,
          data.isActive ?? true,
          tenantId,
        ],
      );

      // Generate and update employee_id
      // POSTGRESQL FIX: Parameters must be $1, $2 in order they appear in array
      const employeeId = generateEmployeeId(subdomain, 'root', result.insertId);
      await execute('UPDATE users SET employee_id = $1 WHERE id = $2', [
        employeeId,
        result.insertId,
      ]);

      // N:M REFACTORING: Root users have has_full_access=1, no individual department assignments needed

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
   * N:M REFACTORING: department_id removed - handled separately via user_departments
   * CRITICAL: When email changes, username must also change (username = email)
   */
  private buildRootUserUpdateFields(data: UpdateRootUserRequest): {
    fields: string[];
    values: unknown[];
    nextParamIndex: number;
  } {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Map of request properties to database columns
    // N:M REFACTORING: department_id removed - now managed via user_departments table
    const fieldMappings: { field: keyof UpdateRootUserRequest; column: string }[] = [
      { field: 'firstName', column: 'first_name' },
      { field: 'lastName', column: 'last_name' },
      { field: 'position', column: 'position' },
      { field: 'notes', column: 'notes' },
      { field: 'employeeNumber', column: 'employee_number' },
      { field: 'isActive', column: 'is_active' },
    ];

    // Build fields and values arrays with PostgreSQL $n placeholders
    for (const mapping of fieldMappings) {
      const value = data[mapping.field];
      if (value !== undefined) {
        fields.push(`${mapping.column} = $${paramIndex++}`);
        values.push(value);
      }
    }

    // CRITICAL: When email changes, also update username (username = email, lowercase)
    if (data.email !== undefined) {
      const normalizedEmail = data.email.toLowerCase().trim();
      fields.push(`email = $${paramIndex++}`);
      values.push(normalizedEmail);
      fields.push(`username = $${paramIndex++}`); // username = email
      values.push(normalizedEmail);
    }

    return { fields, values, nextParamIndex: paramIndex };
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

      const { fields, values, nextParamIndex } = this.buildRootUserUpdateFields(data);
      let paramIndex = nextParamIndex;

      // Hash password if provided
      if (data.password !== undefined && data.password !== '') {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        fields.push(`password = $${paramIndex++}`);
        values.push(hashedPassword);
      }

      // Update user fields if any
      if (fields.length > 0) {
        fields.push('updated_at = NOW()');
        const idParamIndex = paramIndex;
        values.push(id);
        await execute(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idParamIndex}`, values);
      }

      // N:M REFACTORING: Root users have has_full_access=1, no individual department assignments needed
      // Department assignments for root users are managed via has_full_access flag, not user_departments
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
        "SELECT COUNT(*) as count FROM users WHERE role = 'root' AND tenant_id = $1 AND id != $2",
        [tenantId, id],
      );

      const rootCountRow = rootCount[0];
      if (rootCountRow === undefined || rootCountRow.count < 1) {
        throw new ServiceError(
          'LAST_ROOT_USER',
          'At least one root user must remain in the system',
          400,
        );
      }

      // Delete user's related data first (to avoid foreign key constraints)
      // SECURITY: tenant_id required for multi-tenant isolation
      await execute('DELETE FROM oauth_tokens WHERE user_id = $1 AND tenant_id = $2', [
        id,
        tenantId,
      ]);
      await execute('DELETE FROM user_teams WHERE user_id = $1 AND tenant_id = $2', [id, tenantId]);
      await execute('DELETE FROM user_departments WHERE user_id = $1 AND tenant_id = $2', [
        id,
        tenantId,
      ]);

      // Now delete the user - SECURITY: tenant_id required for multi-tenant isolation
      await execute('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
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

      const tenantCountRow = tenantCount[0];
      if (tenantCountRow === undefined) {
        throw new ServiceError('SERVER_ERROR', 'Failed to get tenant count', 500);
      }

      // Get active features
      const [features] = await execute<FeatureCodeResult[]>(
        `SELECT f.code
         FROM tenant_features tf
         JOIN features f ON tf.feature_id = f.id
         WHERE tf.tenant_id = $1 AND tf.is_active = 1`,
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
        tenantCount: tenantCountRow.count,
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
      const tenant = await tenantModel.findById(tenantId);
      if (!tenant) {
        throw new ServiceError('NOT_FOUND', 'Tenant not found', 404);
      }

      const planKey = tenant.current_plan ?? 'basic';
      const totalStorage = getStorageLimit(planKey);
      if (totalStorage === undefined) {
        throw new ServiceError('SERVER_ERROR', `Unknown plan type: ${planKey}`, 500);
      }

      // Get storage breakdown in parallel
      const [documentsSize, attachmentsSize, logsSize] = await Promise.all([
        getStorageTotal(
          'SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = $1',
          [tenantId],
        ),
        getStorageTotal(
          `SELECT COALESCE(SUM(ka.file_size), 0) as total FROM kvp_attachments ka
           JOIN kvp_suggestions ks ON ka.suggestion_id = ks.id WHERE ks.tenant_id = $1`,
          [tenantId],
        ),
        getStorageTotal(
          "SELECT COALESCE(SUM(LENGTH(action) + LENGTH(COALESCE(details, ''))), 0) as total FROM admin_logs WHERE tenant_id = $1",
          [tenantId],
        ),
      ]);

      const usedStorage = documentsSize + attachmentsSize + logsSize;
      const percentage = Math.round((usedStorage / totalStorage) * 100);

      return {
        used: usedStorage,
        total: totalStorage,
        percentage: Math.min(percentage, 100),
        plan: planKey,
        breakdown: {
          documents: documentsSize,
          attachments: attachmentsSize,
          logs: logsSize,
          backups: 0,
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
        `SELECT dq.*, t.company_name, u.username as requested_by_name
        FROM tenant_deletion_queue dq
        JOIN tenants t ON t.id = dq.tenant_id
        JOIN users u ON u.id = dq.created_by
        WHERE dq.tenant_id = $1 AND dq.status NOT IN ('cancelled', 'completed')
        ORDER BY dq.created_at DESC LIMIT 1`,
        [tenantId],
      );

      const deletion = deletions[0];
      if (deletion === undefined) {
        return null;
      }

      // CRITICAL: Two-person principle - creator cannot approve their own deletion request
      const hasUserId = currentUserId !== undefined && currentUserId !== 0;
      const isCreator = hasUserId ? deletion.created_by === currentUserId : false;
      const canApprove = deletion.status === 'pending_approval' && !isCreator;
      const canCancel = ['pending_approval', 'approved'].includes(deletion.status) && isCreator;

      return mapDeletionToStatus(deletion, canCancel, canApprove);
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
        WHERE q.status = 'pending_approval'
        AND q.created_by != $1
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

      // Transform to our API format (bracket notation for index signatures, ?? for nullish coalescing)
      const records = report.affectedRecords as Record<string, number | undefined>;
      return {
        tenantId: report.tenantId,
        companyName,
        estimatedDuration: `${report.estimatedDuration} minutes`,
        affectedRecords: {
          users: records['users'] ?? 0,
          documents: records['documents'] ?? 0,
          departments: records['departments'] ?? 0,
          teams: records['teams'] ?? 0,
          shifts: records['shifts'] ?? 0,
          kvpSuggestions: records['kvp_suggestions'] ?? 0,
          surveys: records['surveys'] ?? 0,
          logs: records['logs'] ?? 0,
          total: report.totalRecords,
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
