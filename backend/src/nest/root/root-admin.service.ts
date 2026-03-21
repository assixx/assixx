/**
 * Root Admin Sub-Service
 *
 * Handles admin user CRUD and admin logs.
 * Extracted from root.service.ts — bounded context: admin management.
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

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { UserRepository } from '../database/repositories/user.repository.js';
import {
  ERROR_CODES,
  buildUserUpdateFields,
  handleDuplicateEntryError,
  mapDbLogToAdminLog,
  mapDbUserToAdminUser,
} from './root.helpers.js';
import type {
  AdminLog,
  AdminUser,
  CreateAdminRequest,
  DbIdRow,
  DbRootLogRow,
  DbUserRow,
  UpdateUserRequest,
} from './root.types.js';

@Injectable()
export class RootAdminService {
  private readonly logger = new Logger(RootAdminService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly userRepository: UserRepository,
  ) {}

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
       WHERE u.role = 'admin' AND u.tenant_id = $1 AND u.is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY u.created_at DESC`,
      [tenantId],
    );

    return admins.map((admin: DbUserRow) => mapDbUserToAdminUser(admin));
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
       WHERE u.id = $1 AND u.role = 'admin' AND u.tenant_id = $2 AND u.is_active = ${IS_ACTIVE.ACTIVE}`,
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

    const result = mapDbUserToAdminUser(admin);
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
      handleDuplicateEntryError(error);
      throw error;
    }
  }

  /**
   * Update admin user
   */
  async updateAdmin(id: number, data: UpdateUserRequest, tenantId: number): Promise<void> {
    this.logger.log(`Updating admin ${id} for tenant ${tenantId}`);

    // Check if admin exists
    const admin = await this.getAdminById(id, tenantId);
    if (admin === null) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Admin not found',
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
   * Delete admin user
   */
  async deleteAdmin(id: number, tenantId: number, actingUserId: number): Promise<void> {
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

    await this.db.query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  }

  /**
   * Get admin logs
   */
  async getAdminLogs(adminId: number, tenantId: number, days?: number): Promise<AdminLog[]> {
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

    return logs.map((log: DbRootLogRow) => mapDbLogToAdminLog(log));
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Check for duplicate email among ACTIVE users
   * SECURITY: Uses UserRepository which filters by is_active = 1
   */
  private async checkDuplicateEmail(email: string, tenantId: number): Promise<void> {
    const isTaken = await this.userRepository.isEmailTaken(email, tenantId);

    if (isTaken) {
      throw new ConflictException({
        code: ERROR_CODES.DUPLICATE_EMAIL,
        message: 'Email already in use',
      });
    }
  }
}
