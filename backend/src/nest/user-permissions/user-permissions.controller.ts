/**
 * User Feature Permissions Controller
 *
 * HTTP endpoints for per-user feature permission management.
 * Access: root always, admin only with has_full_access = true.
 * Returns raw data — ResponseInterceptor wraps automatically (ADR-007).
 *
 * GET  /user-permissions/:uuid  → Get permission tree for user
 * PUT  /user-permissions/:uuid  → Upsert permissions for user
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 * @see docs/infrastructure/adr/ADR-007-api-response-standardization.md
 */
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Put,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { UpsertUserPermissionsDto } from './dto/index.js';
import type { PermissionCategoryResponse } from './user-permissions.service.js';
import { UserPermissionsService } from './user-permissions.service.js';

@Controller('user-permissions')
@Roles('admin', 'root')
export class UserPermissionsController {
  constructor(private readonly service: UserPermissionsService) {}

  /**
   * Get permission tree for a user.
   * Returns all registered categories filtered by tenant's active features,
   * merged with current permission values from DB.
   */
  @Get(':uuid')
  async getPermissions(
    @TenantId() tenantId: number,
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
  ): Promise<PermissionCategoryResponse[]> {
    this.assertFullAccess(user);
    return await this.service.getPermissions(tenantId, uuid);
  }

  /**
   * Upsert permissions for a user.
   * Validates featureCode/moduleCode against the permission registry.
   * Non-allowed permission types are forced to false.
   */
  @Put(':uuid')
  async upsertPermissions(
    @TenantId() tenantId: number,
    @Param('uuid') uuid: string,
    @Body() dto: UpsertUserPermissionsDto,
    @CurrentUser() user: NestAuthUser,
  ): Promise<{ updated: number }> {
    this.assertFullAccess(user);
    await this.service.upsertPermissions(
      tenantId,
      uuid,
      dto.permissions,
      user.id,
    );
    return { updated: dto.permissions.length };
  }

  /**
   * Ensure requesting user has full access.
   * Root always passes. Admin requires has_full_access = true.
   *
   * @throws ForbiddenException if admin without full access
   */
  private assertFullAccess(user: NestAuthUser): void {
    if (user.activeRole === 'root') return;

    if (!user.hasFullAccess) {
      throw new ForbiddenException(
        'Admin requires full access to manage user permissions',
      );
    }
  }
}
