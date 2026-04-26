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
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { UserRepository } from '../database/repositories/user.repository.js';
import { TenantVerificationService } from '../domains/tenant-verification.service.js';
import { UserPositionService } from '../organigram/user-position.service.js';
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
  CreateAdminResult,
  DbIdUuidRow,
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
    private readonly userPositionService: UserPositionService,
    // Step 2.9 KISS gate — assertVerified at top of `insertAdminRecord`
    // (AST-enclosing helper of `INSERT INTO users`, v0.3.6 D33). tenantId
    // is the helper's 5th parameter.
    private readonly tenantVerification: TenantVerificationService,
  ) {}

  /**
   * Get all admin users for a tenant
   */
  async getAdmins(tenantId: number): Promise<AdminUser[]> {
    this.logger.debug(`Getting admins for tenant ${tenantId}`);

    // SECURITY: Only return active admins (is_active = 1)
    const admins = await this.db.systemQuery<DbUserRow>(
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
    const rows = await this.db.systemQuery<DbUserRow & { tenant_name?: string }>(
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
    const lastLoginRows = await this.db.systemQuery<DbRootLogRow>(
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
   * Create new admin user.
   *
   * Returns both `id` and `uuid` so the controller can expose the uuid in the
   * API response — the frontend uses it for the "Berechtigungen jetzt zuweisen?"
   * toast-link (deep-link to /manage-admins/permission/{uuid}), matching the
   * manage-employees flow. See ADR-045 (Permission Stack, Layer 2).
   */
  async createAdmin(
    data: CreateAdminRequest,
    tenantId: number,
    actingUserId: number,
  ): Promise<CreateAdminResult> {
    this.logger.log(`Creating admin for tenant ${tenantId}`);

    const normalizedEmail = data.email.toLowerCase().trim();
    await this.checkDuplicateEmail(normalizedEmail, tenantId);
    const hashedPassword = await bcrypt.hash(data.password, 12);

    try {
      const created = await this.db.systemTransaction(
        async (client: PoolClient) =>
          await this.insertAdminRecord(client, data, normalizedEmail, hashedPassword, tenantId),
      );

      await this.activityLogger.logCreate(
        tenantId,
        actingUserId,
        'user',
        created.id,
        `Admin erstellt: ${normalizedEmail} (Rolle: admin)`,
        {
          email: normalizedEmail,
          role: 'admin',
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
        },
      );

      return created;
    } catch (error: unknown) {
      handleDuplicateEntryError(error);
      throw error;
    }
  }

  /** Insert admin record and sync positions within transaction */
  private async insertAdminRecord(
    client: PoolClient,
    data: CreateAdminRequest,
    email: string,
    hashedPassword: string,
    tenantId: number,
  ): Promise<CreateAdminResult> {
    // KISS gate (§2.9 + §0.2.5 #1 + D33): helper-entry assertion. Arch-test
    // (§2.11, regex `INSERT INTO users\b`) locks this site.
    await this.tenantVerification.assertVerified(tenantId);
    // RETURNING id, uuid — uuid is needed by the controller for the API response
    // so the frontend can deep-link into the permission page without an extra GET.
    const result = await client.query<DbIdUuidRow>(
      `INSERT INTO users (username, email, password, first_name, last_name, role, position, notes, employee_number, is_active, tenant_id, uuid, uuid_created_at)
       VALUES ($1, $2, $3, $4, $5, 'admin', NULL, $6, $7, 1, $8, $9, NOW())
       RETURNING id, uuid`,
      [
        email,
        email,
        hashedPassword,
        data.firstName ?? '',
        data.lastName ?? '',
        data.notes ?? null,
        data.employeeNumber ?? '',
        tenantId,
        uuidv7(),
      ],
    );

    const row = result.rows[0];
    if (row === undefined) {
      throw new BadRequestException('Failed to create admin');
    }

    if (data.positionIds !== undefined && data.positionIds.length > 0) {
      await this.userPositionService.syncPositions(client, row.id, tenantId, data.positionIds);
    }

    return { id: row.id, uuid: row.uuid };
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

    await this.db.systemTransaction(async (client: PoolClient) => {
      const { fields, values, nextIndex } = buildUserUpdateFields(data);
      let paramIndex = nextIndex;

      // Hash password if provided
      if (data.password !== undefined && data.password !== '') {
        const hashedPassword = await bcrypt.hash(data.password, 12);
        fields.push(`password = $${paramIndex++}`);
        values.push(hashedPassword);
      }

      if (fields.length > 0) {
        fields.push('updated_at = NOW()');
        const idParam = paramIndex++;
        const tenantParam = paramIndex;
        values.push(id, tenantId);

        await client.query(
          `UPDATE users SET ${fields.join(', ')} WHERE id = $${idParam} AND tenant_id = $${tenantParam}`,
          values,
        );
      }

      if (data.positionIds !== undefined) {
        await this.userPositionService.syncPositions(client, id, tenantId, data.positionIds);
      }
    });
  }

  /**
   * Soft-delete admin user.
   *
   * WHY soft-delete (ADR-020 + ADR-045 + Audit 2026-04-26):
   *   - Audit trail preservation: 32 CASCADE-FKs on `users.id` would wipe
   *     permission history (admin_area_permissions, user_addon_permissions),
   *     read-status (notification/document/blackboard/kvp), e2e keys, and
   *     refresh-token telemetry on a hard-delete.
   *   - FK integrity: 24 RESTRICT-FKs (inventory_items.created_by,
   *     calendar_events.user_id, admin_logs.user_id, areas.created_by, …)
   *     would block hard-delete on any admin who has ever produced content,
   *     leaving the previous DELETE crashing in production with 23503.
   *   - Reactivation: `is_active = 4 → 1` is a single UPDATE; row resurrection
   *     after hard-delete is impossible.
   *   - Email re-use stays available because `checkDuplicateEmail` filters
   *     by `is_active = 1` (UserRepository.isEmailTaken).
   *
   * Hard-delete is reserved for tenant erasure (DSGVO Art. 17) inside
   * `tenant-deletion-executor.service.ts` — tenant_id ON DELETE CASCADE makes
   * that cleanup deterministic. The architectural test in
   * `shared/src/architectural.test.ts` enforces this boundary in CI.
   */
  async deleteAdmin(id: number, tenantId: number, actingUserId: number): Promise<void> {
    this.logger.log(`Soft-deleting admin ${id} for tenant ${tenantId}`);

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

    // Soft-delete: mirrors the canonical pattern in users.service.ts:512.
    await this.db.systemQuery(
      `UPDATE users SET is_active = ${IS_ACTIVE.DELETED}, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    // Defense-in-Depth: revoke auth artifacts so the soft-deleted admin cannot
    // continue using existing JWTs / refresh tokens. CASCADE-FKs do NOT fire
    // on UPDATE, so without this an active access token would still succeed
    // for ≤15 min and the refresh chain would survive indefinitely. The
    // is_active=1 check in JwtAuthGuard (ADR-005) is the primary defence;
    // this is the secondary one. user_sessions is a global table (no
    // tenant_id, see ADR-019); refresh_tokens is tenant-scoped.
    await this.db.systemQuery('DELETE FROM user_sessions WHERE user_id = $1', [id]);
    await this.db.systemQuery('DELETE FROM refresh_tokens WHERE user_id = $1 AND tenant_id = $2', [
      id,
      tenantId,
    ]);
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

    const logs = await this.db.systemQuery<DbRootLogRow>(query, params);

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
