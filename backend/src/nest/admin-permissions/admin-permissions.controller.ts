/**
 * Admin Permissions Controller
 *
 * HTTP endpoints for admin permissions management:
 * - GET    /admin-permissions/my                                   - Get current admin's permissions
 * - GET    /admin-permissions/:adminId                             - Get permissions for specific admin (root only)
 * - POST   /admin-permissions                                      - Set permissions for an admin (root only)
 * - DELETE /admin-permissions/:adminId/departments/:departmentId   - Remove department permission (root only)
 * - DELETE /admin-permissions/:adminId/groups/:groupId             - Remove group permission (root only)
 * - POST   /admin-permissions/bulk                                 - Bulk update permissions (root only)
 * - GET    /admin-permissions/:adminId/check/:departmentId/:level  - Check admin access (root only)
 * - GET    /admin-permissions/:adminId/check/:departmentId         - Check admin access (root only)
 * - POST   /admin-permissions/:userId/areas                        - Set area permissions (root only)
 * - DELETE /admin-permissions/:userId/areas/:areaId                - Remove area permission (root only)
 * - PATCH  /admin-permissions/:userId/full-access                  - Set full access flag (root only)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  AdminPermissionsResponse,
  BulkOperationResult,
  PermissionCheckResult,
  PermissionLevel,
} from './admin-permissions.service.js';
import { AdminPermissionsService } from './admin-permissions.service.js';
import {
  BulkUpdatePermissionsDto,
  SetAreaPermissionsDto,
  SetFullAccessDto,
  SetPermissionsDto,
} from './dto/index.js';

/**
 * Response type for success operations
 */
interface MessageResponse {
  message: string;
}

/**
 * Get admin tenant query
 * SECURITY: Only return tenant for ACTIVE users (is_active = 1)
 */
const GET_ADMIN_TENANT_QUERY = `SELECT tenant_id FROM users WHERE id = $1 AND role = 'admin' AND is_active = ${IS_ACTIVE.ACTIVE}`;
const GET_USER_TENANT_QUERY = `SELECT tenant_id FROM users WHERE id = $1 AND is_active = ${IS_ACTIVE.ACTIVE}`;
const ERROR_ADMIN_NOT_FOUND = 'Admin not found or inactive';
const ERROR_USER_NOT_FOUND = 'User not found or inactive';

@Controller('admin-permissions')
export class AdminPermissionsController {
  constructor(
    private readonly adminPermissionsService: AdminPermissionsService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * GET /admin-permissions/my
   * Get current user's permissions
   */
  @Get('my')
  async getMyPermissions(
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<AdminPermissionsResponse> {
    // Only admins need permission info
    if (user.role !== 'admin') {
      // Root users always have full access
      return {
        areas: [],
        departments: [],
        groups: [],
        hasFullAccess: user.role === 'root',
        totalAreas: 0,
        totalDepartments: 0,
        assignedAreas: 0,
        assignedDepartments: 0,
        leadAreas: [],
        leadDepartments: [],
      };
    }

    return await this.adminPermissionsService.getAdminPermissions(user.id, tenantId);
  }

  /**
   * GET /admin-permissions/bulk
   * This needs to be before :adminId to avoid conflict
   * But since we have POST /bulk, this is just a placeholder
   */

  /**
   * GET /admin-permissions/:adminId
   * Get permissions for a specific admin (root only)
   */
  @Get(':adminId')
  @Roles('root')
  async getAdminPermissions(
    @Param('adminId', ParseIntPipe) adminId: number,
  ): Promise<AdminPermissionsResponse> {
    // Get the admin's tenant ID
    const adminRows = await this.db.query<{ tenant_id: number }>(GET_ADMIN_TENANT_QUERY, [adminId]);

    if (adminRows.length === 0 || adminRows[0] === undefined) {
      throw new Error(ERROR_ADMIN_NOT_FOUND);
    }

    const targetTenantId = adminRows[0].tenant_id;
    return await this.adminPermissionsService.getAdminPermissions(adminId, targetTenantId);
  }

  /**
   * POST /admin-permissions
   * Set permissions for an admin (root only)
   */
  @Post()
  @Roles('root')
  async setPermissions(
    @Body() dto: SetPermissionsDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponse> {
    // Get the admin's tenant ID
    const adminRows = await this.db.query<{ tenant_id: number }>(GET_ADMIN_TENANT_QUERY, [
      dto.adminId,
    ]);

    if (adminRows.length === 0 || adminRows[0] === undefined) {
      throw new Error(ERROR_ADMIN_NOT_FOUND);
    }

    const targetTenantId = adminRows[0].tenant_id;

    // Set department permissions
    await this.adminPermissionsService.setDepartmentPermissions(
      dto.adminId,
      dto.departmentIds,
      dto.permissions,
      user.id,
      targetTenantId,
    );

    // Set group permissions if provided (DEPRECATED - no-op, kept for API compatibility)
    if (dto.groupIds.length > 0) {
      this.adminPermissionsService.setGroupPermissions(
        dto.adminId,
        dto.groupIds,
        dto.permissions,
        user.id,
        targetTenantId,
      );
    }

    return { message: 'Permissions updated successfully' };
  }

  /**
   * DELETE /admin-permissions/:adminId/departments/:departmentId
   * Remove department permission (root only)
   */
  @Delete(':adminId/departments/:departmentId')
  @Roles('root')
  async removeDepartmentPermission(
    @Param('adminId', ParseIntPipe) adminId: number,
    @Param('departmentId', ParseIntPipe) departmentId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponse> {
    // Get the admin's tenant ID
    const adminRows = await this.db.query<{ tenant_id: number }>(GET_ADMIN_TENANT_QUERY, [adminId]);

    if (adminRows.length === 0 || adminRows[0] === undefined) {
      throw new Error(ERROR_ADMIN_NOT_FOUND);
    }

    const targetTenantId = adminRows[0].tenant_id;

    await this.adminPermissionsService.removeDepartmentPermission(
      adminId,
      departmentId,
      user.id,
      targetTenantId,
    );

    return { message: 'Permission removed successfully' };
  }

  /**
   * DELETE /admin-permissions/:adminId/groups/:groupId
   * Remove group permission (root only) - DEPRECATED
   */
  @Delete(':adminId/groups/:groupId')
  @Roles('root')
  async removeGroupPermission(
    @Param('adminId', ParseIntPipe) adminId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponse> {
    // Get the admin's tenant ID
    const adminRows = await this.db.query<{ tenant_id: number }>(GET_ADMIN_TENANT_QUERY, [adminId]);

    if (adminRows.length === 0 || adminRows[0] === undefined) {
      throw new Error(ERROR_ADMIN_NOT_FOUND);
    }

    const targetTenantId = adminRows[0].tenant_id;

    // DEPRECATED: Always throws NotFoundException - groups system removed (never returns)
    this.adminPermissionsService.removeGroupPermission(adminId, groupId, user.id, targetTenantId);
  }

  /**
   * POST /admin-permissions/bulk
   * Bulk update permissions (root only)
   */
  @Post('bulk')
  @Roles('root')
  async bulkUpdatePermissions(
    @Body() dto: BulkUpdatePermissionsDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<BulkOperationResult> {
    return await this.adminPermissionsService.bulkUpdatePermissions(
      dto.adminIds,
      dto.operation,
      dto.departmentIds,
      dto.permissions,
      user.id,
      tenantId,
    );
  }

  /**
   * GET /admin-permissions/:adminId/check/:departmentId/:permissionLevel
   * Check admin access (root only)
   */
  @Get(':adminId/check/:departmentId/:permissionLevel')
  @Roles('root')
  async checkAccessWithLevel(
    @Param('adminId', ParseIntPipe) adminId: number,
    @Param('departmentId', ParseIntPipe) departmentId: number,
    @Param('permissionLevel') permissionLevel: string,
  ): Promise<PermissionCheckResult> {
    // Get the admin's tenant ID
    const adminRows = await this.db.query<{ tenant_id: number }>(GET_ADMIN_TENANT_QUERY, [adminId]);

    if (adminRows.length === 0 || adminRows[0] === undefined) {
      throw new Error(ERROR_ADMIN_NOT_FOUND);
    }

    const targetTenantId = adminRows[0].tenant_id;
    let level: PermissionLevel = 'read';
    if (permissionLevel === 'write') {
      level = 'write';
    } else if (permissionLevel === 'delete') {
      level = 'delete';
    }

    return await this.adminPermissionsService.checkAccess(
      adminId,
      departmentId,
      targetTenantId,
      level,
    );
  }

  /**
   * GET /admin-permissions/:adminId/check/:departmentId
   * Check admin access without permission level (defaults to 'read')
   */
  @Get(':adminId/check/:departmentId')
  @Roles('root')
  async checkAccess(
    @Param('adminId', ParseIntPipe) adminId: number,
    @Param('departmentId', ParseIntPipe) departmentId: number,
  ): Promise<PermissionCheckResult> {
    // Get the admin's tenant ID
    const adminRows = await this.db.query<{ tenant_id: number }>(GET_ADMIN_TENANT_QUERY, [adminId]);

    if (adminRows.length === 0 || adminRows[0] === undefined) {
      throw new Error(ERROR_ADMIN_NOT_FOUND);
    }

    const targetTenantId = adminRows[0].tenant_id;

    return await this.adminPermissionsService.checkAccess(
      adminId,
      departmentId,
      targetTenantId,
      'read',
    );
  }

  /**
   * POST /admin-permissions/:userId/areas
   * Set area permissions (root only)
   */
  @Post(':userId/areas')
  @Roles('root')
  async setAreaPermissions(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetAreaPermissionsDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponse> {
    // Get user tenant
    const userRows = await this.db.query<{ tenant_id: number }>(GET_USER_TENANT_QUERY, [userId]);

    if (userRows.length === 0 || userRows[0] === undefined) {
      throw new Error(ERROR_USER_NOT_FOUND);
    }

    const targetTenantId = userRows[0].tenant_id;

    await this.adminPermissionsService.setAreaPermissions(
      userId,
      dto.areaIds,
      dto.permissions,
      user.id,
      targetTenantId,
    );

    return { message: 'Area permissions updated successfully' };
  }

  /**
   * DELETE /admin-permissions/:userId/areas/:areaId
   * Remove area permission (root only)
   */
  @Delete(':userId/areas/:areaId')
  @Roles('root')
  async removeAreaPermission(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('areaId', ParseIntPipe) areaId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponse> {
    // Get user tenant
    const userRows = await this.db.query<{ tenant_id: number }>(GET_USER_TENANT_QUERY, [userId]);

    if (userRows.length === 0 || userRows[0] === undefined) {
      throw new Error(ERROR_USER_NOT_FOUND);
    }

    const targetTenantId = userRows[0].tenant_id;

    await this.adminPermissionsService.removeAreaPermission(
      userId,
      areaId,
      user.id,
      targetTenantId,
    );

    return { message: 'Area permission removed successfully' };
  }

  /**
   * PATCH /admin-permissions/:userId/full-access
   * Set full access flag (root only)
   */
  @Patch(':userId/full-access')
  @Roles('root')
  async setFullAccess(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetFullAccessDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponse> {
    // Get user tenant
    const userRows = await this.db.query<{ tenant_id: number }>(GET_USER_TENANT_QUERY, [userId]);

    if (userRows.length === 0 || userRows[0] === undefined) {
      throw new Error(ERROR_USER_NOT_FOUND);
    }

    const targetTenantId = userRows[0].tenant_id;

    await this.adminPermissionsService.setHasFullAccess(
      userId,
      dto.hasFullAccess,
      user.id,
      targetTenantId,
    );

    return {
      message: dto.hasFullAccess ? 'Full access granted' : 'Full access revoked',
    };
  }
}
