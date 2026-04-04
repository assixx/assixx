/**
 * User Repository
 *
 * Centralized repository for ALL user database access.
 * Implements secure-by-default pattern: all queries filter by is_active = 1
 * unless explicitly using *IncludeDeleted variants.
 *
 * SECURITY: This repository prevents accidental exposure of soft-deleted users.
 * Always use this repository instead of direct SQL queries for user data.
 *
 * @see docs/plans/USER-REPOSITORY-REFACTOR-PLAN.md
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import type { IsActiveStatus } from '@assixx/shared/types';
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database.service.js';

/**
 * Base user fields returned by most queries
 * Does NOT include sensitive fields like password
 */
export interface UserBase {
  id: number;
  uuid: string;
  tenant_id: number;
  email: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: IsActiveStatus;
  position: string | null;
  profile_picture: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Minimal user info for display purposes
 */
export interface UserMinimal {
  id: number;
  uuid: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

/**
 * User with password hash (internal auth use only)
 */
export interface UserWithPassword extends UserBase {
  password: string;
  last_login: Date | null;
}

export interface FindManyOptions {
  /** Filter by role */
  role?: string;
  /** Maximum results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Order by field (default: created_at DESC) */
  orderBy?: string;
  /** Order direction */
  orderDir?: 'ASC' | 'DESC';
}

const USER_BASE_COLUMNS = `
  id, uuid, tenant_id, email, username, first_name, last_name,
  role, is_active, position, profile_picture, created_at, updated_at
`;

/** Includes password - for auth only */
const USER_AUTH_COLUMNS = `
  id, uuid, tenant_id, email, username, first_name, last_name,
  role, is_active, position, profile_picture, password, last_login,
  created_at, updated_at
`;

const USER_MINIMAL_COLUMNS = `id, uuid, first_name, last_name, email`;

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(private readonly db: DatabaseService) {}

  // =========================================================================
  // SAFE METHODS - Always filter by is_active = 1
  // =========================================================================

  /** Find active user by numeric ID */
  async findById(id: number, tenantId: number): Promise<UserBase | null> {
    return await this.db.tenantQueryOne<UserBase>(
      `SELECT ${USER_BASE_COLUMNS}
       FROM users
       WHERE id = $1
         AND tenant_id = $2
         AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [id, tenantId],
    );
  }

  /** Find active user by UUID */
  async findByUuid(uuid: string, tenantId: number): Promise<UserBase | null> {
    return await this.db.tenantQueryOne<UserBase>(
      `SELECT ${USER_BASE_COLUMNS}
       FROM users
       WHERE uuid = $1
         AND tenant_id = $2
         AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [uuid, tenantId],
    );
  }

  /** Find active user by email */
  async findByEmail(email: string, tenantId: number): Promise<UserBase | null> {
    return await this.db.tenantQueryOne<UserBase>(
      `SELECT ${USER_BASE_COLUMNS}
       FROM users
       WHERE LOWER(email) = LOWER($1)
         AND tenant_id = $2
         AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [email, tenantId],
    );
  }

  /** Get minimal user info by UUID (for display purposes) */
  async findMinimalByUuid(uuid: string, tenantId: number): Promise<UserMinimal | null> {
    return await this.db.tenantQueryOne<UserMinimal>(
      `SELECT ${USER_MINIMAL_COLUMNS}
       FROM users
       WHERE uuid = $1
         AND tenant_id = $2
         AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [uuid, tenantId],
    );
  }

  /** Get minimal user info by ID (for display purposes) */
  async findMinimalById(id: number, tenantId: number): Promise<UserMinimal | null> {
    return await this.db.tenantQueryOne<UserMinimal>(
      `SELECT ${USER_MINIMAL_COLUMNS}
       FROM users
       WHERE id = $1
         AND tenant_id = $2
         AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [id, tenantId],
    );
  }

  /** Count active users by role — BYPASSRLS: called from root services (cross-tenant) */
  async countByRole(role: string, tenantId: number): Promise<number> {
    const result = await this.db.systemQueryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM users
       WHERE role = $1
         AND tenant_id = $2
         AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [role, tenantId],
    );
    return Number.parseInt(result?.count ?? '0', 10);
  }

  /** Count all active users for tenant — BYPASSRLS: called from root services (cross-tenant) */
  async countAll(tenantId: number): Promise<number> {
    const result = await this.db.systemQueryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM users
       WHERE tenant_id = $1
         AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [tenantId],
    );
    return Number.parseInt(result?.count ?? '0', 10);
  }

  /** List active users with pagination and filtering */
  async findMany(tenantId: number, options: FindManyOptions = {}): Promise<UserBase[]> {
    const { role, limit = 50, offset = 0, orderBy = 'created_at', orderDir = 'DESC' } = options;

    // Whitelist allowed order columns to prevent SQL injection
    const allowedOrderColumns = [
      'id',
      'email',
      'username',
      'first_name',
      'last_name',
      'role',
      'created_at',
      'updated_at',
    ];
    const safeOrderBy = allowedOrderColumns.includes(orderBy) ? orderBy : 'created_at';
    const safeOrderDir = orderDir === 'ASC' ? 'ASC' : 'DESC';

    const params: unknown[] = [tenantId];
    let whereClause = `WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE}`;

    if (role !== undefined) {
      params.push(role);
      whereClause += ` AND role = $${params.length}`;
    } else {
      whereClause += " AND role != 'dummy'";
    }

    params.push(limit, offset);

    return await this.db.tenantQuery<UserBase>(
      `SELECT ${USER_BASE_COLUMNS}
       FROM users
       ${whereClause}
       ORDER BY ${safeOrderBy} ${safeOrderDir}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
  }

  /** Check if active user exists */
  async exists(id: number, tenantId: number): Promise<boolean> {
    const result = await this.db.tenantQueryOne<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM users
         WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
       ) as exists`,
      [id, tenantId],
    );
    return result?.exists ?? false;
  }

  /** Check if active user exists by UUID */
  async existsByUuid(uuid: string, tenantId: number): Promise<boolean> {
    const result = await this.db.tenantQueryOne<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM users
         WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
       ) as exists`,
      [uuid, tenantId],
    );
    return result?.exists ?? false;
  }

  /**
   * Filter array of IDs to only include active users.
   * Useful for validating user lists (e.g., chat participants)
   */
  async filterActiveIds(ids: number[], tenantId: number): Promise<number[]> {
    if (ids.length === 0) {
      return [];
    }

    const result = await this.db.tenantQuery<{ id: number }>(
      `SELECT id FROM users
       WHERE id = ANY($1::int[])
         AND tenant_id = $2
         AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [ids, tenantId],
    );

    return result.map((row: { id: number }) => row.id);
  }

  /** Get user role by ID (for permission checks) */
  async getRole(id: number, tenantId: number): Promise<string | null> {
    const result = await this.db.tenantQueryOne<{ role: string }>(
      `SELECT role FROM users
       WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [id, tenantId],
    );
    return result?.role ?? null;
  }

  // =========================================================================
  // AUTH METHODS - Special handling for authentication
  // =========================================================================

  /**
   * Find user for authentication by email (across all tenants).
   * Returns user regardless of status - caller MUST check is_active
   *
   * IMPORTANT: This is the ONLY method that returns password hash.
   * IMPORTANT: Caller must validate is_active === 1 before allowing login.
   */
  async findForAuth(email: string): Promise<UserWithPassword | null> {
    return await this.db.systemQueryOne<UserWithPassword>(
      `SELECT ${USER_AUTH_COLUMNS}
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [email],
    );
  }

  /**
   * Find user for authentication by ID (token refresh).
   * Returns user regardless of status - caller MUST check is_active
   */
  async findForAuthById(id: number, tenantId: number): Promise<UserWithPassword | null> {
    return await this.db.systemQueryOne<UserWithPassword>(
      `SELECT ${USER_AUTH_COLUMNS}
       FROM users
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
  }

  /**
   * Get password hash for ACTIVE user only.
   * Used for password validation (change password, etc.)
   */
  async getPasswordHash(id: number, tenantId: number): Promise<string | null> {
    const result = await this.db.tenantQueryOne<{ password: string }>(
      `SELECT password FROM users
       WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [id, tenantId],
    );
    return result?.password ?? null;
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.db.systemQuery('UPDATE users SET last_login = NOW() WHERE id = $1', [id]);
  }

  // =========================================================================
  // ADMIN METHODS - Explicit include deleted (for audit purposes)
  // =========================================================================

  /**
   * Find user including deleted (for admin audit purposes).
   * WARNING: Only use for audit logs, admin dashboards
   */
  async findByIdIncludeDeleted(id: number, tenantId: number): Promise<UserBase | null> {
    this.logger.warn(`findByIdIncludeDeleted called for user ${id} - audit/admin use only`);
    return await this.db.tenantQueryOne<UserBase>(
      `SELECT ${USER_BASE_COLUMNS}
       FROM users
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
  }

  /** Count users by status (for admin dashboard) */
  async countByStatus(status: IsActiveStatus, tenantId: number): Promise<number> {
    const result = await this.db.tenantQueryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM users
       WHERE is_active = $1 AND tenant_id = $2`,
      [status, tenantId],
    );
    return Number.parseInt(result?.count ?? '0', 10);
  }

  /** Get all user statuses with counts (for admin dashboard) */
  async getStatusCounts(tenantId: number): Promise<Map<IsActiveStatus, number>> {
    const result = await this.db.tenantQuery<{ is_active: number; count: string }>(
      `SELECT is_active, COUNT(*) as count
       FROM users
       WHERE tenant_id = $1
       GROUP BY is_active`,
      [tenantId],
    );

    const counts = new Map<IsActiveStatus, number>();
    for (const row of result as { is_active: number; count: string }[]) {
      counts.set(row.is_active as IsActiveStatus, Number.parseInt(row.count, 10));
    }
    return counts;
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /** Resolve UUID to numeric ID (for active users only) */
  async resolveUuidToId(uuid: string, tenantId: number): Promise<number | null> {
    const result = await this.db.tenantQueryOne<{ id: number }>(
      `SELECT id FROM users
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [uuid, tenantId],
    );
    return result?.id ?? null;
  }

  /** Resolve numeric ID to UUID (for active users only) */
  async resolveIdToUuid(id: number, tenantId: number): Promise<string | null> {
    const result = await this.db.tenantQueryOne<{ uuid: string }>(
      `SELECT uuid FROM users
       WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [id, tenantId],
    );
    return result?.uuid ?? null;
  }

  /**
   * Check if email is already taken by another ACTIVE user
   * @param excludeId - User ID to exclude (for self-updates)
   */
  async isEmailTaken(email: string, tenantId: number, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [email.toLowerCase(), tenantId];
    let excludeClause = '';

    if (excludeId !== undefined) {
      params.push(excludeId);
      excludeClause = ` AND id != $${params.length}`;
    }

    const result = await this.db.systemQueryOne<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM users
         WHERE LOWER(email) = $1
           AND tenant_id = $2
           AND is_active = ${IS_ACTIVE.ACTIVE}
           ${excludeClause}
       ) as exists`,
      params,
    );
    return result?.exists ?? false;
  }
}
