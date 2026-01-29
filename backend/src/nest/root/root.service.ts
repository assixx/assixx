/**
 * Root Service (NestJS)
 *
 * Native NestJS implementation for root user operations and tenant management.
 * Uses DatabaseService directly for PostgreSQL queries.
 *
 * IMPORTANT: Uses PostgreSQL $1, $2, $3 placeholders (NOT MySQL's ?)
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';

import { tenantDeletionService } from '../../services/tenantDeletion.service.js';
import { generateEmployeeId } from '../../utils/employeeIdGenerator.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { UserRepository } from '../database/repositories/user.repository.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  DUPLICATE_USERNAME: 'DUPLICATE_USERNAME',
  DUPLICATE_EMPLOYEE_NUMBER: 'DUPLICATE_EMPLOYEE_NUMBER',
  SELF_DELETE: 'SELF_DELETE',
  LAST_ROOT_USER: 'LAST_ROOT_USER',
  INSUFFICIENT_ROOT_USERS: 'INSUFFICIENT_ROOT_USERS',
  ALREADY_SCHEDULED: 'ALREADY_SCHEDULED',
} as const;

/** Storage limits by plan (in bytes) */
const STORAGE_LIMITS: Record<string, number> = {
  basic: 5 * 1024 * 1024 * 1024, // 5 GB
  professional: 25 * 1024 * 1024 * 1024, // 25 GB
  enterprise: 100 * 1024 * 1024 * 1024, // 100 GB
};

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

interface DbUserRow {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  position: string | null;
  notes: string | null;
  employee_number: string;
  employee_id: string | null;
  department_id?: number | null;
  is_active: number;
  tenant_id: number;
  last_login?: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface DbTenantRow {
  id: number;
  company_name: string;
  subdomain: string;
  current_plan: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * PostgreSQL COUNT(*) returns bigint which pg driver serializes as STRING!
 * ALWAYS use Number() when using this value in arithmetic operations.
 */
interface DbCountRow {
  count: string | number; // pg returns string for bigint, but might be number in tests
}

/**
 * PostgreSQL SUM() returns numeric which pg driver may serialize as STRING.
 * ALWAYS use Number() when using this value in arithmetic operations.
 */
interface DbStorageTotalRow {
  total: string | number;
}

interface DbFeatureCodeRow {
  code: string;
}

interface DbRootLogRow {
  id: number;
  user_id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

interface DbDeletionQueueRow {
  id: number;
  tenant_id: number;
  status: string;
  created_by: number;
  created_at: Date;
  approved_by: number | null;
  approved_at: Date | null;
  scheduled_for: Date | null;
  reason: string;
  error_message: string | null;
  cooling_off_hours: number;
  company_name: string;
  requested_by_name: string;
}

interface DbDeletionRequestRow {
  id: number;
  tenant_id: number;
  company_name: string;
  subdomain: string;
  created_by: number;
  requester_name: string;
  requester_email: string;
  created_at: Date;
  reason: string;
  status: string;
}

interface DbIdRow {
  id: number;
}

interface DbSubdomainRow {
  subdomain: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  notes?: string;
  position?: string;
  employeeNumber?: string;
  profilePicture?: string | null;
  isActive: number;
  tenantId: number;
  tenantName?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface RootUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  notes?: string;
  employeeNumber?: string;
  departmentId?: number;
  isActive: number;
  employeeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id: number;
  companyName: string;
  subdomain: string;
  currentPlan?: string | undefined;
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
  adminCount?: number | undefined;
  employeeCount?: number | undefined;
  storageUsed?: number | undefined;
}

export interface AdminLog {
  id: number;
  userId: number;
  action: string;
  entityType: string;
  entityId?: number;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface DashboardStats {
  adminCount: number;
  employeeCount: number;
  totalUsers: number;
  tenantCount?: number;
  activeFeatures?: string[];
  systemHealth?: {
    database: 'healthy' | 'degraded' | 'down';
    storage: 'healthy' | 'degraded' | 'down';
    services: 'healthy' | 'degraded' | 'down';
  };
}

export interface StorageInfo {
  used: number;
  total: number;
  percentage: number;
  plan: string;
  breakdown?: {
    documents: number;
    attachments: number;
    logs: number;
    backups: number;
  };
}

export interface TenantDeletionStatus {
  queueId: number;
  tenantId: number;
  status: string;
  requestedBy: number;
  requestedByName?: string | undefined;
  requestedAt: Date;
  approvedBy?: number | undefined;
  approvedAt?: Date | undefined;
  scheduledFor?: Date | undefined;
  reason?: string | undefined;
  errorMessage?: string | undefined;
  coolingOffHours: number;
  canCancel: boolean;
  canApprove: boolean;
}

export interface DeletionApproval {
  queueId: number;
  tenantId: number;
  companyName: string;
  subdomain: string;
  requesterId: number;
  requesterName: string;
  requesterEmail: string;
  requestedAt: Date;
  reason?: string;
  status: string;
}

export interface DeletionDryRunReport {
  tenantId: number;
  companyName: string;
  estimatedDuration: string;
  affectedRecords: {
    users: number;
    documents: number;
    departments: number;
    teams: number;
    shifts: number;
    kvpSuggestions: number;
    surveys: number;
    logs: number;
    total: number;
  };
  storageToFree: number;
  warnings: string[];
  canProceed: boolean;
}

interface CreateAdminRequest {
  email: string;
  password: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
  notes?: string | undefined;
  employeeNumber?: string | undefined;
  position?: string | undefined;
}

interface UpdateUserRequest {
  email?: string | undefined;
  password?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  notes?: string | undefined;
  isActive?: number | undefined;
  employeeNumber?: string | undefined;
  position?: string | undefined;
}

interface CreateRootUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  position?: string | undefined;
  notes?: string | undefined;
  employeeNumber?: string | undefined;
  isActive?: number | undefined;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

@Injectable()
export class RootService {
  private readonly logger = new Logger(RootService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly userRepository: UserRepository,
  ) {}

  // ==========================================================================
  // ADMIN MANAGEMENT
  // ==========================================================================

  /**
   * Get all admin users for a tenant
   */
  async getAdmins(tenantId: number): Promise<AdminUser[]> {
    this.logger.debug(`Getting admins for tenant ${tenantId}`);

    // SECURITY: Only return active admins (is_active = 1)
    const admins = await this.db.query<DbUserRow>(
      `SELECT u.*, t.company_name as tenant_name
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.role = 'admin' AND u.tenant_id = $1 AND u.is_active = 1
       ORDER BY u.created_at DESC`,
      [tenantId],
    );

    return admins.map((admin: DbUserRow) => this.mapDbUserToAdminUser(admin));
  }

  /**
   * Get single admin by ID
   */
  async getAdminById(id: number, tenantId: number): Promise<AdminUser | null> {
    this.logger.debug(`Getting admin ${id} for tenant ${tenantId}`);

    // SECURITY: Only return active admins (is_active = 1)
    const rows = await this.db.query<DbUserRow & { tenant_name?: string }>(
      `SELECT u.*, t.company_name as tenant_name
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1 AND u.role = 'admin' AND u.tenant_id = $2 AND u.is_active = 1`,
      [id, tenantId],
    );

    const admin = rows[0];
    if (admin === undefined) {
      return null;
    }

    // Get last login
    const lastLoginRows = await this.db.query<DbRootLogRow>(
      `SELECT created_at FROM root_logs
       WHERE user_id = $1 AND action = 'login'
       ORDER BY created_at DESC LIMIT 1`,
      [id],
    );

    const result = this.mapDbUserToAdminUser(admin);
    if (lastLoginRows.length > 0 && lastLoginRows[0] !== undefined) {
      result.lastLogin = lastLoginRows[0].created_at;
    }

    return result;
  }

  /**
   * Create new admin user
   */
  async createAdmin(
    data: CreateAdminRequest,
    tenantId: number,
    actingUserId: number,
  ): Promise<number> {
    this.logger.log(`Creating admin for tenant ${tenantId}`);

    const normalizedEmail = data.email.toLowerCase().trim();

    // Check for duplicate email
    await this.checkDuplicateEmail(normalizedEmail, tenantId);

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    try {
      const userUuid = uuidv7();
      const rows = await this.db.query<DbIdRow>(
        `INSERT INTO users (username, email, password, first_name, last_name, role, position, notes, employee_number, is_active, tenant_id, uuid, uuid_created_at)
         VALUES ($1, $2, $3, $4, $5, 'admin', $6, $7, $8, 1, $9, $10, NOW())
         RETURNING id`,
        [
          normalizedEmail,
          normalizedEmail,
          hashedPassword,
          data.firstName ?? '',
          data.lastName ?? '',
          data.position ?? null,
          data.notes ?? null,
          data.employeeNumber ?? '',
          tenantId,
          userUuid,
        ],
      );

      const userId = rows[0]?.id;
      if (userId === undefined) {
        throw new BadRequestException('Failed to create admin');
      }

      // Log activity
      await this.activityLogger.logCreate(
        tenantId,
        actingUserId,
        'user',
        userId,
        `Admin erstellt: ${normalizedEmail} (Rolle: admin)`,
        {
          email: normalizedEmail,
          role: 'admin',
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
        },
      );

      return userId;
    } catch (error: unknown) {
      this.handleDuplicateEntryError(error);
      throw error;
    }
  }

  /**
   * Update admin user
   */
  async updateAdmin(
    id: number,
    data: UpdateUserRequest,
    tenantId: number,
  ): Promise<void> {
    this.logger.log(`Updating admin ${id} for tenant ${tenantId}`);

    // Check if admin exists
    const admin = await this.getAdminById(id, tenantId);
    if (admin === null) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Admin not found',
      });
    }

    const { fields, values, nextIndex } = this.buildUserUpdateFields(data);
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
   * Delete admin user
   */
  async deleteAdmin(
    id: number,
    tenantId: number,
    actingUserId: number,
  ): Promise<void> {
    this.logger.log(`Deleting admin ${id} for tenant ${tenantId}`);

    // Check if admin exists
    const admin = await this.getAdminById(id, tenantId);
    if (admin === null) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Admin not found',
      });
    }

    // Log activity BEFORE deleting
    await this.activityLogger.logDelete(
      tenantId,
      actingUserId,
      'user',
      id,
      `Admin gelöscht: ${admin.email}`,
      {
        email: admin.email,
        role: 'admin',
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
    );

    await this.db.query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [
      id,
      tenantId,
    ]);
  }

  /**
   * Get admin logs
   */
  async getAdminLogs(
    adminId: number,
    tenantId: number,
    days?: number,
  ): Promise<AdminLog[]> {
    this.logger.debug(`Getting logs for admin ${adminId}`);

    // Verify admin exists
    const admin = await this.getAdminById(adminId, tenantId);
    if (admin === null) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Admin not found',
      });
    }

    let query = `SELECT * FROM root_logs WHERE user_id = $1`;
    const params: unknown[] = [adminId];

    if (days !== undefined && days > 0) {
      params.push(days);
      query += ` AND created_at >= NOW() - $${params.length} * INTERVAL '1 day'`;
    }

    query += ' ORDER BY created_at DESC';

    const logs = await this.db.query<DbRootLogRow>(query, params);

    return logs.map((log: DbRootLogRow) => this.mapDbLogToAdminLog(log));
  }

  // ==========================================================================
  // TENANT MANAGEMENT
  // ==========================================================================

  /**
   * Get tenants - ONLY the root user's own tenant for security
   */
  async getTenants(tenantId: number): Promise<Tenant[]> {
    this.logger.debug(`Getting tenants for tenant ${tenantId}`);

    // Only return user's own tenant (multi-tenant isolation)
    const tenants = await this.db.query<DbTenantRow>(
      'SELECT * FROM tenants WHERE id = $1',
      [tenantId],
    );

    if (tenants.length === 0) {
      return [];
    }

    // Get additional stats - SECURITY: Use UserRepository for accurate active user counts
    return await Promise.all(
      tenants.map(async (tenant: DbTenantRow) => {
        const [adminCount, employeeCount, storageUsed] = await Promise.all([
          this.userRepository.countByRole('admin', tenant.id),
          this.userRepository.countByRole('employee', tenant.id),
          this.db.query<DbStorageTotalRow>(
            'SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = $1',
            [tenant.id],
          ),
        ]);

        return {
          id: tenant.id,
          companyName: tenant.company_name,
          subdomain: tenant.subdomain,
          currentPlan: tenant.current_plan ?? undefined,
          status: tenant.status as Tenant['status'],
          createdAt: tenant.created_at,
          updatedAt: tenant.updated_at,
          adminCount,
          employeeCount,
          storageUsed: Number(storageUsed[0]?.total ?? 0),
        };
      }),
    );
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
       WHERE u.role = 'root' AND u.tenant_id = $1 AND u.is_active = 1
       ORDER BY u.created_at DESC`,
      [tenantId],
    );

    return users.map((user: DbUserRow) => this.mapDbUserToRootUser(user));
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
       WHERE u.id = $1 AND u.role = 'root' AND u.tenant_id = $2 AND u.is_active = 1`,
      [id, tenantId],
    );

    const user = rows[0];
    if (user === undefined) {
      return null;
    }

    return this.mapDbUserToRootUser(user);
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
      this.handleDuplicateEntryError(error);
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

    const { fields, values, nextIndex } = this.buildUserUpdateFields(data);
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
      "SELECT COUNT(*) as count FROM users WHERE role = 'root' AND tenant_id = $1 AND id != $2 AND is_active = 1",
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
         WHERE tf.tenant_id = $1 AND tf.is_active = 1`,
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

  /**
   * Get storage information
   */
  async getStorageInfo(tenantId: number): Promise<StorageInfo> {
    this.logger.debug(`Getting storage info for tenant ${tenantId}`);

    // Get tenant plan
    const tenant = await this.db.query<DbTenantRow>(
      'SELECT current_plan FROM tenants WHERE id = $1',
      [tenantId],
    );

    const tenantData = tenant[0];
    if (tenantData === undefined) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Tenant not found',
      });
    }

    const planKey = tenantData.current_plan ?? 'basic';
    const defaultStorage = STORAGE_LIMITS['basic'] ?? 0;

    const totalStorage =
      Object.hasOwn(STORAGE_LIMITS, planKey) ?
        (STORAGE_LIMITS[planKey] ?? defaultStorage)
      : defaultStorage;

    // Get storage breakdown in parallel
    const [documentsSize, attachmentsSize, logsSize] = await Promise.all([
      this.db.query<DbStorageTotalRow>(
        'SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = $1',
        [tenantId],
      ),
      this.db.query<DbStorageTotalRow>(
        `SELECT COALESCE(SUM(ka.file_size), 0) as total FROM kvp_attachments ka
         JOIN kvp_suggestions ks ON ka.suggestion_id = ks.id WHERE ks.tenant_id = $1`,
        [tenantId],
      ),
      this.db.query<DbStorageTotalRow>(
        "SELECT COALESCE(SUM(LENGTH(action) + LENGTH(COALESCE(details, ''))), 0) as total FROM admin_logs WHERE tenant_id = $1",
        [tenantId],
      ),
    ]);

    // PostgreSQL SUM() returns bigint/numeric as string - must convert
    const documents = Number(documentsSize[0]?.total ?? 0);
    const attachments = Number(attachmentsSize[0]?.total ?? 0);
    const logs = Number(logsSize[0]?.total ?? 0);
    const usedStorage = documents + attachments + logs;
    const percentage =
      totalStorage > 0 ? Math.round((usedStorage / totalStorage) * 100) : 0;

    return {
      used: usedStorage,
      total: totalStorage,
      percentage: Math.min(percentage, 100),
      plan: planKey,
      breakdown: {
        documents,
        attachments,
        logs,
        backups: 0,
      },
    };
  }

  // ==========================================================================
  // TENANT DELETION
  // ==========================================================================

  /**
   * Request tenant deletion
   */
  async requestTenantDeletion(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<number> {
    this.logger.log(`Requesting tenant deletion for tenant ${tenantId}`);

    // SECURITY: Check if there are at least 2 ACTIVE root users (is_active = 1)
    const rootCount = await this.userRepository.countByRole('root', tenantId);

    if (rootCount < 2) {
      throw new BadRequestException({
        code: ERROR_CODES.INSUFFICIENT_ROOT_USERS,
        message: 'At least 2 root users required before tenant deletion',
      });
    }

    try {
      const result = await tenantDeletionService.requestTenantDeletion(
        tenantId,
        requestedBy,
        reason ?? 'No reason provided',
        ipAddress,
      );
      return result.queueId;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('already marked_for_deletion')) {
        throw new ConflictException({
          code: ERROR_CODES.ALREADY_SCHEDULED,
          message: 'Tenant is already marked for deletion',
        });
      }
      throw error;
    }
  }

  /**
   * Get tenant deletion status
   */
  async getDeletionStatus(
    tenantId: number,
    currentUserId?: number,
  ): Promise<TenantDeletionStatus | null> {
    this.logger.debug(`Getting deletion status for tenant ${tenantId}`);

    const deletions = await this.db.query<DbDeletionQueueRow>(
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

    const hasUserId = currentUserId !== undefined && currentUserId !== 0;
    const isCreator = hasUserId ? deletion.created_by === currentUserId : false;
    const canApprove = deletion.status === 'pending_approval' && !isCreator;
    const canCancel =
      ['pending_approval', 'approved'].includes(deletion.status) && isCreator;

    return {
      queueId: deletion.id,
      tenantId: deletion.tenant_id,
      status: deletion.status,
      requestedBy: deletion.created_by,
      requestedByName: deletion.requested_by_name,
      requestedAt: deletion.created_at,
      approvedBy: deletion.approved_by ?? undefined,
      approvedAt: deletion.approved_at ?? undefined,
      scheduledFor: deletion.scheduled_for ?? undefined,
      reason: deletion.reason,
      errorMessage: deletion.error_message ?? undefined,
      coolingOffHours: deletion.cooling_off_hours,
      canCancel,
      canApprove,
    };
  }

  /**
   * Cancel deletion
   */
  async cancelDeletion(tenantId: number, userId: number): Promise<void> {
    this.logger.log(`Cancelling deletion for tenant ${tenantId}`);
    await tenantDeletionService.cancelDeletion(tenantId, userId);
  }

  /**
   * Perform deletion dry run
   */
  async performDeletionDryRun(tenantId: number): Promise<DeletionDryRunReport> {
    this.logger.log(`Performing deletion dry run for tenant ${tenantId}`);

    const report = await tenantDeletionService.performDryRun(tenantId);

    // Get tenant name
    const tenant = await this.db.query<DbTenantRow>(
      'SELECT company_name FROM tenants WHERE id = $1',
      [tenantId],
    );

    const records = report.affectedRecords as Record<
      string,
      number | undefined
    >;

    return {
      tenantId: report.tenantId,
      companyName: tenant[0]?.company_name ?? 'Unknown',
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
      storageToFree: 0,
      warnings: report.warnings,
      canProceed: report.blockers.length === 0,
    };
  }

  // ==========================================================================
  // DELETION APPROVALS
  // ==========================================================================

  /**
   * Get all deletion requests
   */
  async getAllDeletionRequests(): Promise<DeletionApproval[]> {
    this.logger.debug('Getting all deletion requests');

    const deletions = await this.db.query<DbDeletionRequestRow>(
      `SELECT q.*, t.company_name, t.subdomain, u.username as requester_name, u.email as requester_email
       FROM tenant_deletion_queue q
       JOIN tenants t ON t.id = q.tenant_id
       JOIN users u ON u.id = q.created_by
       ORDER BY q.created_at DESC`,
    );

    return deletions.map((d: DbDeletionRequestRow) => ({
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
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(
    currentUserId: number,
  ): Promise<DeletionApproval[]> {
    this.logger.debug(`Getting pending approvals for user ${currentUserId}`);

    const approvals = await this.db.query<DbDeletionRequestRow>(
      `SELECT q.*, t.company_name, t.subdomain, u.username as requester_name, u.email as requester_email
       FROM tenant_deletion_queue q
       JOIN tenants t ON t.id = q.tenant_id
       JOIN users u ON u.id = q.created_by
       WHERE q.status = 'pending_approval' AND q.created_by != $1
       ORDER BY q.created_at DESC`,
      [currentUserId],
    );

    return approvals.map((a: DbDeletionRequestRow) => ({
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
  }

  /**
   * Approve deletion with password verification (Two-Person-Principle)
   *
   * SECURITY: The approving user must verify their identity with their password.
   * This implements the "Zwei-Personen-Prinzip" for critical operations.
   */
  async approveDeletion(
    queueId: number,
    userId: number,
    password: string,
    comment?: string,
  ): Promise<void> {
    this.logger.log(`Approving deletion ${queueId} - verifying user password`);

    // SECURITY: Get user's password hash for verification
    // IMPORTANT: Only allow ACTIVE users (is_active = 1) to approve deletions
    // TODO: Add tenantId parameter to use UserRepository.getPasswordHash() for full isolation
    const users = await this.db.query<{ password: string | null }>(
      'SELECT password FROM users WHERE id = $1 AND is_active = 1',
      [userId],
    );

    const userRecord = users[0];
    if (userRecord === undefined) {
      this.logger.error(
        `User ${userId} not found or inactive for deletion approval`,
      );
      throw new Error('User not found or inactive');
    }

    // SECURITY: Verify the password matches
    const storedHash = userRecord.password;
    if (storedHash === null || storedHash === '') {
      this.logger.error(`User ${userId} has no password set`);
      throw new Error('User password not configured');
    }

    const isPasswordValid = await bcrypt.compare(password, storedHash);
    if (!isPasswordValid) {
      this.logger.warn(
        `Invalid password for deletion approval by user ${userId}`,
      );
      throw new Error('Ungültiges Passwort');
    }

    this.logger.log(
      `Password verified for user ${userId}, proceeding with approval`,
    );
    await tenantDeletionService.approveDeletion(queueId, userId, comment);
  }

  /**
   * Reject deletion
   */
  async rejectDeletion(
    queueId: number,
    userId: number,
    reason: string,
  ): Promise<void> {
    this.logger.log(`Rejecting deletion ${queueId}`);
    await tenantDeletionService.rejectDeletion(queueId, userId, reason);
  }

  /**
   * Emergency stop
   */
  async emergencyStop(tenantId: number, userId: number): Promise<void> {
    this.logger.log(`Emergency stop for tenant ${tenantId}`);
    await tenantDeletionService.triggerEmergencyStop(tenantId, userId);
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

  /**
   * Type guard for PostgreSQL unique constraint violation (23505)
   */
  private isPgUniqueViolation(
    error: unknown,
  ): error is { code: string; message: string } {
    if (typeof error !== 'object' || error === null) return false;
    if (!('code' in error) || !('message' in error)) return false;
    return (error as Record<string, unknown>)['code'] === '23505';
  }

  /**
   * Handle database duplicate entry errors
   */
  private handleDuplicateEntryError(error: unknown): void {
    if (!this.isPgUniqueViolation(error)) return;

    if (error.message.includes('employee_number')) {
      throw new ConflictException({
        code: ERROR_CODES.DUPLICATE_EMPLOYEE_NUMBER,
        message: 'Employee number already exists',
      });
    }
    if (error.message.includes('email')) {
      throw new ConflictException({
        code: ERROR_CODES.DUPLICATE_EMAIL,
        message: 'Email already exists',
      });
    }
    if (error.message.includes('username')) {
      throw new ConflictException({
        code: ERROR_CODES.DUPLICATE_USERNAME,
        message: 'Username already exists',
      });
    }
  }

  /**
   * Build user update fields for dynamic UPDATE queries
   */
  private buildUserUpdateFields(data: UpdateUserRequest): {
    fields: string[];
    values: unknown[];
    nextIndex: number;
  } {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.email !== undefined) {
      const normalizedEmail = data.email.toLowerCase().trim();
      fields.push(`email = $${paramIndex++}`, `username = $${paramIndex++}`);
      values.push(normalizedEmail, normalizedEmail);
    }
    if (data.firstName !== undefined) {
      fields.push(`first_name = $${paramIndex++}`);
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      fields.push(`last_name = $${paramIndex++}`);
      values.push(data.lastName);
    }
    if (data.position !== undefined) {
      fields.push(`position = $${paramIndex++}`);
      values.push(data.position);
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }
    if (data.employeeNumber !== undefined) {
      fields.push(`employee_number = $${paramIndex++}`);
      values.push(data.employeeNumber);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }

    return { fields, values, nextIndex: paramIndex };
  }

  /**
   * Map database user row to AdminUser
   */
  private mapDbUserToAdminUser(
    admin: DbUserRow & {
      tenant_name?: string;
      profile_picture?: string | null;
    },
  ): AdminUser {
    const result: AdminUser = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      firstName: admin.first_name ?? '',
      lastName: admin.last_name ?? '',
      isActive: admin.is_active,
      tenantId: admin.tenant_id,
      createdAt: admin.created_at,
      updatedAt: admin.updated_at,
    };

    if (admin.notes !== null) result.notes = admin.notes;
    if (admin.position !== null) result.position = admin.position;
    if (admin.employee_number !== '')
      result.employeeNumber = admin.employee_number;
    if (admin.profile_picture !== undefined)
      result.profilePicture = admin.profile_picture;
    if (admin.tenant_name !== undefined) result.tenantName = admin.tenant_name;
    if (admin.last_login !== null && admin.last_login !== undefined)
      result.lastLogin = admin.last_login;

    return result;
  }

  /**
   * Map database user row to RootUser
   */
  private mapDbUserToRootUser(user: DbUserRow): RootUser {
    const result: RootUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name ?? '',
      lastName: user.last_name ?? '',
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    if (user.position !== null) result.position = user.position;
    if (user.notes !== null) result.notes = user.notes;
    if (user.employee_number !== '')
      result.employeeNumber = user.employee_number;
    if (user.department_id !== null && user.department_id !== undefined)
      result.departmentId = user.department_id;
    if (user.employee_id !== null) result.employeeId = user.employee_id;

    return result;
  }

  /**
   * Map database log row to AdminLog
   */
  private mapDbLogToAdminLog(log: DbRootLogRow): AdminLog {
    const result: AdminLog = {
      id: log.id,
      userId: log.user_id,
      action: log.action,
      entityType: log.entity_type ?? '',
      createdAt: log.created_at,
    };

    if (log.entity_id !== null) result.entityId = log.entity_id;
    if (log.details !== null) result.description = log.details;
    if (log.ip_address !== null) result.ipAddress = log.ip_address;
    if (log.user_agent !== null) result.userAgent = log.user_agent;

    return result;
  }
}
