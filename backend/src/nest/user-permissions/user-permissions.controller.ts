/**
 * User Addon Permissions Controller
 *
 * HTTP endpoints for per-user addon permission management.
 * Access: Delegated — Root, Admin (full), or Lead with manage-permissions.
 * Returns raw data — ResponseInterceptor wraps automatically (ADR-007).
 *
 * GET  /user-permissions/:uuid  → Get permission tree for user
 * PUT  /user-permissions/:uuid  → Upsert permissions for user
 *
 * @see docs/FEAT_DELEGATED_PERMISSION_MANAGEMENT_MASTERPLAN.md
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 */
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Put,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { HierarchyPermissionService } from '../hierarchy-permission/hierarchy-permission.service.js';
import { ScopeService } from '../hierarchy-permission/scope.service.js';
import { UpsertUserPermissionsDto } from './dto/index.js';
import type { PermissionCategoryResponse } from './user-permissions.service.js';
import { UserPermissionsService } from './user-permissions.service.js';

@Controller('user-permissions')
@Roles('admin', 'root', 'employee')
export class UserPermissionsController {
  private readonly logger = new Logger(UserPermissionsController.name);

  constructor(
    private readonly service: UserPermissionsService,
    private readonly scopeService: ScopeService,
    private readonly hierarchyPermission: HierarchyPermissionService,
  ) {}

  /**
   * Get permission tree for a user.
   * Root/Admin(full): see all categories.
   * Lead with manage-permissions.canRead: see only own categories (filtered).
   */
  @Get(':uuid')
  async getPermissions(
    @TenantId() tenantId: number,
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
  ): Promise<PermissionCategoryResponse[]> {
    await this.assertPermissionAccess(user, uuid, tenantId, 'canRead');

    // Lead: filter to only show permissions the lead has
    const filterByLeaderId = this.isDelegatedAccess(user) ? user.id : undefined;
    return await this.service.getPermissions(tenantId, uuid, filterByLeaderId);
  }

  /**
   * Upsert permissions for a user.
   * Root/Admin(full): can set any permission.
   * Lead with manage-permissions.canWrite: delegated upsert (filtered by own perms).
   */
  @Put(':uuid')
  async upsertPermissions(
    @TenantId() tenantId: number,
    @Param('uuid') uuid: string,
    @Body() dto: UpsertUserPermissionsDto,
    @CurrentUser() user: NestAuthUser,
  ): Promise<{ updated: number }> {
    await this.assertPermissionAccess(user, uuid, tenantId, 'canWrite');

    const delegatorScope =
      this.isDelegatedAccess(user) ?
        await this.scopeService.getScope()
      : undefined;

    const result = await this.service.upsertPermissions(
      tenantId,
      uuid,
      dto.permissions,
      user.id,
      delegatorScope,
    );
    return { updated: result.applied };
  }

  /**
   * Delegated permission access check (replaces assertFullAccess).
   *
   * 1. Root → always OK (including self-edit)
   * 2. Admin with has_full_access → OK (NOT for own UUID)
   * 3. Lead with manage-permissions permission → OK if:
   *    a) Target user is in own scope
   *    b) Target user ≠ current user (no self-grant)
   */
  private async assertPermissionAccess(
    user: NestAuthUser,
    targetUuid: string,
    tenantId: number,
    action: 'canRead' | 'canWrite',
  ): Promise<void> {
    // Rule: Root always OK
    if (user.activeRole === 'root') return;

    // Rule: Admin with full access — but NOT self-edit
    if (user.hasFullAccess) {
      await this.assertNotSelf(user.id, targetUuid, tenantId);
      return;
    }

    // Rule: Lead with manage-permissions permission
    const hasManagePerms = await this.service.hasPermission(
      user.id,
      'manage_hierarchy',
      'manage-permissions',
      action,
    );
    if (!hasManagePerms) {
      this.logger.warn(
        `Permission denied: user ${user.id} lacks manage-permissions.${action}`,
      );
      throw new ForbiddenException(
        'Keine Berechtigung zum Verwalten von Benutzer-Permissions',
      );
    }

    // Self-grant block (Regel 1)
    await this.assertNotSelf(user.id, targetUuid, tenantId);

    // Scope check (Regel 3): target user must be in own scope
    await this.assertTargetInScope(user.id, targetUuid, tenantId);
  }

  /** Block self-permission-editing (except Root) */
  private async assertNotSelf(
    currentUserId: number,
    targetUuid: string,
    tenantId: number,
  ): Promise<void> {
    const targetId = await this.service.resolveUserId(targetUuid, tenantId);
    if (targetId === currentUserId) {
      this.logger.warn(
        `Self-grant blocked: user ${currentUserId} tried to edit own permissions`,
      );
      throw new ForbiddenException(
        'Eigene Berechtigungen können nicht selbst geändert werden',
      );
    }
  }

  /** Verify target user is within the current user's organizational scope */
  private async assertTargetInScope(
    currentUserId: number,
    targetUuid: string,
    tenantId: number,
  ): Promise<void> {
    const scope = await this.scopeService.getScope();
    const targetId = await this.service.resolveUserId(targetUuid, tenantId);
    const visibleIds = await this.hierarchyPermission.getVisibleUserIds(
      scope,
      tenantId,
    );

    if (visibleIds !== 'all' && !visibleIds.includes(targetId)) {
      this.logger.warn(
        `Scope denied: user ${currentUserId} cannot access permissions of user ${targetId}`,
      );
      throw new ForbiddenException(
        'Benutzer liegt nicht in Ihrem Zuständigkeitsbereich',
      );
    }
  }

  /** Check if this is a delegated (non-root, non-admin-full) access */
  private isDelegatedAccess(user: NestAuthUser): boolean {
    return user.activeRole !== 'root' && !user.hasFullAccess;
  }
}
