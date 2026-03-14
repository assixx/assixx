/**
 * User Addon Permissions Service
 *
 * Manages per-user, per-addon/module permission control.
 * Uses tenantTransaction() for all DB access (ADR-019 RLS conformant).
 * Validates against PermissionRegistryService — no hardcoded addon knowledge.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
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
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { PermissionEntry } from './dto/index.js';

/** DB row shape for user_addon_permissions SELECT */
interface DbPermissionRow {
  addon_code: string;
  module_code: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

/** DB row shape for active tenant addon codes */
interface DbTenantAddonRow {
  code: string;
}

/** Shape for a single applied permission after registry validation */
interface AppliedPermission {
  addonCode: string;
  moduleCode: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
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
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /**
   * Get permission tree for a user, filtered by tenant's active addons.
   * Returns all registered categories with current boolean values.
   *
   * @throws NotFoundException if user UUID not found
   */
  async getPermissions(
    tenantId: number,
    userUuid: string,
    filterByLeaderId?: number,
  ): Promise<PermissionCategoryResponse[]> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<PermissionCategoryResponse[]> => {
        const user = await this.resolveUserFromUuid(userUuid, tenantId);
        const activeAddons = await this.getActiveAddonsForTenant(client);

        // Filter categories by tenant addons + target user role
        let categories = this.filterCategoriesByRole(activeAddons, user.role);

        // Per design: manage-permissions ONLY for leads. Root/admin-full bypass via hasFullAccess.
        if (!user.isAnyLead) {
          categories = this.hideManagePermissionsModule(categories);
        }

        // Delegated: additionally filter to only modules the leader has
        const filteredCategories =
          filterByLeaderId !== undefined ?
            await this.filterByLeaderPerms(client, categories, filterByLeaderId)
          : categories;

        const userId = user.id;
        const permMap = await this.loadUserPermissionMap(client, userId);

        return filteredCategories.map((cat: PermissionCategoryDef) =>
          this.buildCategoryResponse(cat, permMap),
        );
      },
    );
  }

  /** Filter registered categories by tenant addons + target user role */
  private filterCategoriesByRole(
    activeAddons: Set<string>,
    targetRole: string,
  ): PermissionCategoryDef[] {
    return this.registry
      .getAll()
      .filter((cat: PermissionCategoryDef) => activeAddons.has(cat.code))
      .map((cat: PermissionCategoryDef) => ({
        ...cat,
        modules: cat.modules.filter(
          (mod: PermissionModuleDef) =>
            mod.allowedRoles === undefined ||
            mod.allowedRoles.includes(targetRole),
        ),
      }))
      .filter((cat: PermissionCategoryDef) => cat.modules.length > 0);
  }

  /** Hide manage-permissions module for non-lead employees (they can never delegate) */
  private hideManagePermissionsModule(
    categories: PermissionCategoryDef[],
  ): PermissionCategoryDef[] {
    return categories
      .map((cat: PermissionCategoryDef) => ({
        ...cat,
        modules: cat.modules.filter(
          (mod: PermissionModuleDef) =>
            !(
              cat.code === 'manage_hierarchy' &&
              mod.code === 'manage-permissions'
            ),
        ),
      }))
      .filter((cat: PermissionCategoryDef) => cat.modules.length > 0);
  }

  /** Delegated view: only show modules the leader has (Regel 2 for GET) */
  private async filterByLeaderPerms(
    client: PoolClient,
    categories: PermissionCategoryDef[],
    leaderId: number,
  ): Promise<PermissionCategoryDef[]> {
    const leaderPerms = await this.loadLeaderPermissions(client, leaderId);

    return categories
      .map((cat: PermissionCategoryDef) => ({
        ...cat,
        modules: cat.modules.filter((mod: PermissionModuleDef) => {
          // Regel 4: non-delegatable modules are hidden in delegated view
          if (
            cat.code === 'manage_hierarchy' &&
            mod.code === 'manage-permissions'
          ) {
            return false;
          }
          // Regel 2: leader must have at least canRead for this module
          const key = `${cat.code}:${mod.code}:canRead`;
          return leaderPerms.has(key);
        }),
      }))
      .filter((cat: PermissionCategoryDef) => cat.modules.length > 0);
  }

  /** Load user permission rows as lookup map */
  private async loadUserPermissionMap(
    client: PoolClient,
    userId: number,
  ): Promise<Map<string, DbPermissionRow>> {
    const rows = await client.query<DbPermissionRow>(
      `SELECT addon_code, module_code, can_read, can_write, can_delete
       FROM user_addon_permissions WHERE user_id = $1`,
      [userId],
    );
    const permMap = new Map<string, DbPermissionRow>();
    for (const row of rows.rows) {
      permMap.set(`${row.addon_code}:${row.module_code}`, row);
    }
    return permMap;
  }

  /**
   * Upsert permissions for a user.
   * Validates each entry against the permission registry.
   * Forces non-allowed permission types to false.
   *
   * @throws NotFoundException if user UUID not found
   * @throws BadRequestException if addonCode/moduleCode unknown
   */
  async upsertPermissions(
    tenantId: number,
    userUuid: string,
    permissions: PermissionEntry[],
    assignedByUserId: number,
    delegatorScope?: import('../hierarchy-permission/organizational-scope.types.js').OrganizationalScope,
  ): Promise<{ applied: number }> {
    let userId = 0;
    let oldState = new Map<string, DbPermissionRow>();
    const applied: AppliedPermission[] = [];
    const isDelegated = delegatorScope !== undefined;

    // Per design: manage-permissions ONLY for leads. Root/admin-full bypass via hasFullAccess.
    const targetUser = await this.resolveUserFromUuid(userUuid, tenantId);
    const targetCanDelegate = targetUser.isAnyLead;

    // Pre-filter delegated entries (Regel 2 + 4) outside transaction for clarity
    const filteredPermissions =
      isDelegated ?
        await this.filterDelegatedPermissions(
          permissions,
          assignedByUserId,
          tenantId,
        )
      : permissions;

    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        userId = await this.resolveUserIdFromUuid(userUuid, tenantId);
        oldState = await this.capturePermissionState(client, userId);

        for (const entry of filteredPermissions) {
          // Per design: manage-permissions only for leads/admin/root
          if (
            !targetCanDelegate &&
            entry.addonCode === 'manage_hierarchy' &&
            entry.moduleCode === 'manage-permissions'
          ) {
            continue;
          }

          const result = await this.upsertSingleEntry(
            client,
            tenantId,
            userId,
            entry,
            assignedByUserId,
          );
          applied.push(result);
        }

        this.logger.log(
          `Upserted ${applied.length}/${permissions.length} permission(s) for user ${userUuid}${isDelegated ? ' (delegated)' : ''}`,
        );
      },
    );

    this.auditPermissionChanges(
      tenantId,
      userUuid,
      userId,
      assignedByUserId,
      oldState,
      applied,
    );

    return { applied: applied.length };
  }

  /**
   * Check if a permission entry is delegatable by a non-root/non-admin-full user.
   * Regel 4: manage-permissions itself is NOT delegatable.
   */
  /** Filter permissions for delegated upsert: Regel 2 (only own) + Regel 4 (no manage-permissions) */
  private async filterDelegatedPermissions(
    permissions: PermissionEntry[],
    leaderId: number,
    _tenantId: number,
  ): Promise<PermissionEntry[]> {
    const leaderPerms = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<Set<string>> =>
        await this.loadLeaderPermissions(client, leaderId),
    );

    return permissions.filter((entry: PermissionEntry) => {
      if (!this.isDelegatableEntry(entry, leaderId)) return false;
      return this.leaderHasPermission(leaderPerms, entry);
    });
  }

  private isDelegatableEntry(
    entry: PermissionEntry,
    _assignedByUserId: number,
  ): boolean {
    return !(
      entry.addonCode === 'manage_hierarchy' &&
      entry.moduleCode === 'manage-permissions'
    );
  }

  /** Load all permissions the leader has (single query, used for Regel 2 batch check) */
  private async loadLeaderPermissions(
    client: PoolClient,
    leaderId: number,
  ): Promise<Set<string>> {
    const result = await client.query<DbPermissionRow>(
      `SELECT addon_code, module_code, can_read, can_write, can_delete
       FROM user_addon_permissions WHERE user_id = $1`,
      [leaderId],
    );
    const perms = new Set<string>();
    for (const row of result.rows) {
      if (row.can_read)
        perms.add(`${row.addon_code}:${row.module_code}:canRead`);
      if (row.can_write)
        perms.add(`${row.addon_code}:${row.module_code}:canWrite`);
      if (row.can_delete)
        perms.add(`${row.addon_code}:${row.module_code}:canDelete`);
    }
    return perms;
  }

  /** Regel 2: Leader can only delegate permissions they have themselves */
  private leaderHasPermission(
    leaderPerms: Set<string>,
    entry: PermissionEntry,
  ): boolean {
    const key = `${entry.addonCode}:${entry.moduleCode}`;
    if (entry.canRead && !leaderPerms.has(`${key}:canRead`)) return false;
    if (entry.canWrite && !leaderPerms.has(`${key}:canWrite`)) return false;
    if (entry.canDelete && !leaderPerms.has(`${key}:canDelete`)) return false;
    return true;
  }

  /** Validate a single entry against registry, upsert to DB, return applied values. */
  private async upsertSingleEntry(
    client: PoolClient,
    tenantId: number,
    userId: number,
    entry: PermissionEntry,
    assignedByUserId: number,
  ): Promise<AppliedPermission> {
    if (!this.registry.isValidModule(entry.addonCode, entry.moduleCode)) {
      throw new BadRequestException(
        `Unknown addon/module: ${entry.addonCode}/${entry.moduleCode}`,
      );
    }

    const allowed = this.registry.getAllowedPermissions(
      entry.addonCode,
      entry.moduleCode,
    );
    const canRead = allowed.includes('canRead') ? entry.canRead : false;
    const canWrite = allowed.includes('canWrite') ? entry.canWrite : false;
    const canDelete = allowed.includes('canDelete') ? entry.canDelete : false;

    await client.query(
      `INSERT INTO user_addon_permissions
         (tenant_id, user_id, addon_code, module_code, can_read, can_write, can_delete, assigned_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id, user_id, addon_code, module_code)
       DO UPDATE SET
         can_read = EXCLUDED.can_read,
         can_write = EXCLUDED.can_write,
         can_delete = EXCLUDED.can_delete,
         assigned_by = EXCLUDED.assigned_by,
         updated_at = NOW()`,
      [
        tenantId,
        userId,
        entry.addonCode,
        entry.moduleCode,
        canRead,
        canWrite,
        canDelete,
        assignedByUserId,
      ],
    );

    return {
      addonCode: entry.addonCode,
      moduleCode: entry.moduleCode,
      canRead,
      canWrite,
      canDelete,
    };
  }

  /** Fire-and-forget audit log for permission changes. */
  private auditPermissionChanges(
    tenantId: number,
    userUuid: string,
    userId: number,
    assignedByUserId: number,
    oldState: Map<string, DbPermissionRow>,
    applied: AppliedPermission[],
  ): void {
    const diff = this.buildPermissionDiff(oldState, applied);
    if (diff.changes.length > 0) {
      void this.activityLogger.logUpdate(
        tenantId,
        assignedByUserId,
        'user_addon_permission',
        userId,
        `Berechtigungen aktualisiert für User ${userUuid}: ${diff.summary}`,
        diff.oldValues,
        diff.newValues,
      );
    }
  }

  /** Capture current permission state for a user before upsert. */
  private async capturePermissionState(
    client: PoolClient,
    userId: number,
  ): Promise<Map<string, DbPermissionRow>> {
    const result = await client.query<DbPermissionRow>(
      `SELECT addon_code, module_code, can_read, can_write, can_delete
       FROM user_addon_permissions
       WHERE user_id = $1`,
      [userId],
    );

    const stateMap = new Map<string, DbPermissionRow>();
    for (const row of result.rows) {
      stateMap.set(`${row.addon_code}:${row.module_code}`, row);
    }
    return stateMap;
  }

  /** Build old/new diff for audit logging — only includes actual changes. */
  private buildPermissionDiff(
    oldState: Map<string, DbPermissionRow>,
    applied: AppliedPermission[],
  ): {
    changes: string[];
    summary: string;
    oldValues: Record<string, unknown>;
    newValues: Record<string, unknown>;
  } {
    const changes: string[] = [];
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    for (const entry of applied) {
      const key = `${entry.addonCode}:${entry.moduleCode}`;
      const old = oldState.get(key);
      const oldR = old?.can_read ?? false;
      const oldW = old?.can_write ?? false;
      const oldD = old?.can_delete ?? false;

      if (
        oldR !== entry.canRead ||
        oldW !== entry.canWrite ||
        oldD !== entry.canDelete
      ) {
        changes.push(entry.moduleCode);
        oldValues[key] = { canRead: oldR, canWrite: oldW, canDelete: oldD };
        newValues[key] = {
          canRead: entry.canRead,
          canWrite: entry.canWrite,
          canDelete: entry.canDelete,
        };
      }
    }

    const summary =
      changes.length > 0 ?
        `${changes.length} Modul(e) geändert: ${changes.join(', ')}`
      : 'Keine Änderungen';

    return { changes, summary, oldValues, newValues };
  }

  /**
   * Get all addon codes where the user has at least one module with can_read = true.
   * Used by DashboardService and NotificationsController to filter counts/events
   * based on user permissions — no permission = no notification.
   */
  async getReadableAddonCodes(userId: number): Promise<Set<string>> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<Set<string>> => {
        const result = await client.query<{ addon_code: string }>(
          `SELECT DISTINCT addon_code
           FROM user_addon_permissions
           WHERE user_id = $1 AND can_read = true`,
          [userId],
        );

        return new Set(
          result.rows.map((row: { addon_code: string }) => row.addon_code),
        );
      },
    );
  }

  /**
   * Check if a user has a specific permission for an addon module.
   * Used by PermissionGuard for endpoint enforcement.
   * Fail-closed: no row in DB = denied.
   */
  async hasPermission(
    userId: number,
    addonCode: string,
    moduleCode: string,
    action: PermissionType,
  ): Promise<boolean> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<boolean> => {
        const result = await client.query<DbPermissionRow>(
          `SELECT can_read, can_write, can_delete
           FROM user_addon_permissions
           WHERE user_id = $1
             AND addon_code = $2
             AND module_code = $3`,
          [userId, addonCode, moduleCode],
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
  /** Public UUID → ID resolution (used by controller for scope checks) */
  async resolveUserId(userUuid: string, tenantId: number): Promise<number> {
    const result = await this.resolveUserFromUuid(userUuid, tenantId);
    return result.id;
  }

  private async resolveUserIdFromUuid(
    userUuid: string,
    tenantId: number,
  ): Promise<number> {
    const result = await this.resolveUserFromUuid(userUuid, tenantId);
    return result.id;
  }

  /** Resolve UUID to user ID + role + lead status (for filtering) */
  private async resolveUserFromUuid(
    userUuid: string,
    tenantId: number,
  ): Promise<{ id: number; role: string; isAnyLead: boolean }> {
    const result = await this.db.queryOne<{
      id: number;
      role: string;
      is_any_lead: boolean;
    }>(
      `SELECT u.id, u.role,
        (EXISTS (SELECT 1 FROM teams t WHERE (t.team_lead_id = u.id OR t.deputy_lead_id = u.id) AND t.is_active = ${IS_ACTIVE.ACTIVE})
         OR EXISTS (SELECT 1 FROM departments d WHERE d.department_lead_id = u.id AND d.is_active = ${IS_ACTIVE.ACTIVE})
         OR EXISTS (SELECT 1 FROM areas a WHERE a.area_lead_id = u.id AND a.is_active = ${IS_ACTIVE.ACTIVE})
        ) AS is_any_lead
       FROM users u WHERE u.uuid = $1 AND u.tenant_id = $2 AND u.is_active = ${IS_ACTIVE.ACTIVE}`,
      [userUuid, tenantId],
    );

    if (result === null) {
      throw new NotFoundException(`User not found: ${userUuid}`);
    }

    return { id: result.id, role: result.role, isAnyLead: result.is_any_lead };
  }

  /** Get active addon codes for the current tenant (RLS filters by tenant). */
  private async getActiveAddonsForTenant(
    client: PoolClient,
  ): Promise<Set<string>> {
    const result = await client.query<DbTenantAddonRow>(
      `SELECT a.code
       FROM addons a
       WHERE a.is_active = ${IS_ACTIVE.ACTIVE}
         AND (
           a.is_core = true
           OR EXISTS (
             SELECT 1 FROM tenant_addons ta
             WHERE ta.addon_id = a.id
               AND ta.is_active = ${IS_ACTIVE.ACTIVE}
               AND ta.status IN ('active', 'trial')
           )
         )`,
    );

    return new Set(result.rows.map((row: DbTenantAddonRow) => row.code));
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
