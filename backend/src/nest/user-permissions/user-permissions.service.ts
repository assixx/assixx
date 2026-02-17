/**
 * User Feature Permissions Service
 *
 * Manages per-user, per-feature/module permission control.
 * Uses tenantTransaction() for all DB access (ADR-019 RLS conformant).
 * Validates against PermissionRegistryService — no hardcoded feature knowledge.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import type {
  PermissionCategoryDef,
  PermissionModuleDef,
  PermissionType,
} from '../common/permission-registry/permission.types.js';
import { DatabaseService } from '../database/database.service.js';
import type { PermissionEntry } from './dto/index.js';

/** DB row shape for user_feature_permissions SELECT */
interface DbPermissionRow {
  feature_code: string;
  module_code: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

/** DB row shape for active tenant feature codes */
interface DbTenantFeatureRow {
  code: string;
}

/** DB row shape for UUID to id resolution */
interface DbUserIdRow {
  id: number;
}

/** Response shape: category with current permission values */
export interface PermissionCategoryResponse {
  code: string;
  label: string;
  icon: string;
  modules: PermissionModuleResponse[];
}

/** Response shape: module with current boolean permission values */
export interface PermissionModuleResponse {
  code: string;
  label: string;
  icon: string;
  allowedPermissions: ('canRead' | 'canWrite' | 'canDelete')[];
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

@Injectable()
export class UserPermissionsService {
  private readonly logger = new Logger(UserPermissionsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly registry: PermissionRegistryService,
  ) {}

  /**
   * Get permission tree for a user, filtered by tenant's active features.
   * Returns all registered categories with current boolean values.
   *
   * @throws NotFoundException if user UUID not found
   */
  async getPermissions(
    tenantId: number,
    userUuid: string,
  ): Promise<PermissionCategoryResponse[]> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<PermissionCategoryResponse[]> => {
        const userId = await this.resolveUserIdFromUuid(userUuid, tenantId);

        // Get tenant's active feature codes
        const activeFeatures = await this.getActiveFeaturesForTenant(client);

        // Get all registered categories, filtered by tenant features
        const allCategories = this.registry.getAll();
        const filteredCategories = allCategories.filter(
          (cat: PermissionCategoryDef) => activeFeatures.has(cat.code),
        );

        // Get existing permission rows for this user (RLS filters by tenant)
        const rows = await client.query<DbPermissionRow>(
          `SELECT feature_code, module_code, can_read, can_write, can_delete
           FROM user_feature_permissions
           WHERE user_id = $1`,
          [userId],
        );

        // Build lookup map: "featureCode:moduleCode" -> permission row
        const permMap = new Map<string, DbPermissionRow>();
        for (const row of rows.rows) {
          permMap.set(`${row.feature_code}:${row.module_code}`, row);
        }

        // Merge DB rows with registry definitions
        return filteredCategories.map((cat: PermissionCategoryDef) =>
          this.buildCategoryResponse(cat, permMap),
        );
      },
    );
  }

  /**
   * Upsert permissions for a user.
   * Validates each entry against the permission registry.
   * Forces non-allowed permission types to false.
   *
   * @throws NotFoundException if user UUID not found
   * @throws BadRequestException if featureCode/moduleCode unknown
   */
  async upsertPermissions(
    tenantId: number,
    userUuid: string,
    permissions: PermissionEntry[],
    assignedByUserId: number,
  ): Promise<void> {
    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        const userId = await this.resolveUserIdFromUuid(userUuid, tenantId);

        for (const entry of permissions) {
          // Validate against registry
          if (
            !this.registry.isValidModule(entry.featureCode, entry.moduleCode)
          ) {
            throw new BadRequestException(
              `Unknown feature/module: ${entry.featureCode}/${entry.moduleCode}`,
            );
          }

          // Force non-allowed permissions to false
          const allowed = this.registry.getAllowedPermissions(
            entry.featureCode,
            entry.moduleCode,
          );
          const canRead = allowed.includes('canRead') ? entry.canRead : false;
          const canWrite =
            allowed.includes('canWrite') ? entry.canWrite : false;
          const canDelete =
            allowed.includes('canDelete') ? entry.canDelete : false;

          // UPSERT: INSERT ON CONFLICT DO UPDATE
          await client.query(
            `INSERT INTO user_feature_permissions
               (tenant_id, user_id, feature_code, module_code, can_read, can_write, can_delete, assigned_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (tenant_id, user_id, feature_code, module_code)
             DO UPDATE SET
               can_read = EXCLUDED.can_read,
               can_write = EXCLUDED.can_write,
               can_delete = EXCLUDED.can_delete,
               assigned_by = EXCLUDED.assigned_by,
               updated_at = NOW()`,
            [
              tenantId,
              userId,
              entry.featureCode,
              entry.moduleCode,
              canRead,
              canWrite,
              canDelete,
              assignedByUserId,
            ],
          );
        }

        this.logger.log(
          `Upserted ${permissions.length} permission(s) for user ${userUuid}`,
        );
      },
    );
  }

  /**
   * Get all feature codes where the user has at least one module with can_read = true.
   * Used by DashboardService and NotificationsController to filter counts/events
   * based on user permissions — no permission = no notification.
   */
  async getReadableFeatureCodes(userId: number): Promise<Set<string>> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<Set<string>> => {
        const result = await client.query<{ feature_code: string }>(
          `SELECT DISTINCT feature_code
           FROM user_feature_permissions
           WHERE user_id = $1 AND can_read = true`,
          [userId],
        );

        return new Set(
          result.rows.map((row: { feature_code: string }) => row.feature_code),
        );
      },
    );
  }

  /**
   * Check if a user has a specific permission for a feature module.
   * Used by PermissionGuard for endpoint enforcement.
   * Fail-closed: no row in DB = denied.
   */
  async hasPermission(
    userId: number,
    featureCode: string,
    moduleCode: string,
    action: PermissionType,
  ): Promise<boolean> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<boolean> => {
        const result = await client.query<DbPermissionRow>(
          `SELECT can_read, can_write, can_delete
           FROM user_feature_permissions
           WHERE user_id = $1
             AND feature_code = $2
             AND module_code = $3`,
          [userId, featureCode, moduleCode],
        );

        const row = result.rows[0];
        if (row === undefined) {
          return false;
        }

        switch (action) {
          case 'canRead':
            return row.can_read;
          case 'canWrite':
            return row.can_write;
          case 'canDelete':
            return row.can_delete;
        }
      },
    );
  }

  /**
   * Resolve UUID to numeric user_id (active users only).
   * SECURITY: Only resolves ACTIVE users (is_active = 1).
   *
   * @throws NotFoundException if user not found or inactive
   */
  private async resolveUserIdFromUuid(
    userUuid: string,
    tenantId: number,
  ): Promise<number> {
    const result = await this.db.queryOne<DbUserIdRow>(
      `SELECT id FROM users WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1`,
      [userUuid, tenantId],
    );

    if (result === null) {
      throw new NotFoundException(`User not found: ${userUuid}`);
    }

    return result.id;
  }

  /** Get active feature codes for the current tenant (RLS filters by tenant). */
  private async getActiveFeaturesForTenant(
    client: PoolClient,
  ): Promise<Set<string>> {
    const result = await client.query<DbTenantFeatureRow>(
      `SELECT f.code
       FROM tenant_features tf
       JOIN features f ON f.id = tf.feature_id
       WHERE tf.is_active = 1`,
    );

    return new Set(result.rows.map((row: DbTenantFeatureRow) => row.code));
  }

  /**
   * Build response for a single category by merging registry definition
   * with DB permission rows.
   */
  private buildCategoryResponse(
    category: PermissionCategoryDef,
    permMap: Map<string, DbPermissionRow>,
  ): PermissionCategoryResponse {
    return {
      code: category.code,
      label: category.label,
      icon: category.icon,
      modules: category.modules.map((mod: PermissionModuleDef) => {
        const key = `${category.code}:${mod.code}`;
        const row = permMap.get(key);

        return {
          code: mod.code,
          label: mod.label,
          icon: mod.icon,
          allowedPermissions: mod.allowedPermissions,
          canRead: row?.can_read ?? false,
          canWrite: row?.can_write ?? false,
          canDelete: row?.can_delete ?? false,
        };
      }),
    };
  }
}
