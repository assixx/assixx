/**
 * Roles Controller
 *
 * HTTP endpoints for role management:
 * - GET  /roles              - Get all available roles
 * - GET  /roles/hierarchy    - Get role hierarchy
 * - GET  /roles/assignable   - Get roles assignable by current user
 * - GET  /roles/:id          - Get role by ID
 * - POST /roles/check        - Check if user has role (admin/root only)
 */
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import { CheckUserRoleDto, type RoleName } from './dto/index.js';
import type { Role, RoleCheckResult, RoleHierarchyEntry } from './roles.service.js';
import { RolesService } from './roles.service.js';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * GET /roles
   * Get all available roles
   */
  @Get()
  getAllRoles(): Role[] {
    return this.rolesService.getAllRoles();
  }

  /**
   * GET /roles/hierarchy
   * Get role hierarchy showing which roles can manage others
   */
  @Get('hierarchy')
  getRoleHierarchy(): { hierarchy: RoleHierarchyEntry[] } {
    return this.rolesService.getRoleHierarchy();
  }

  /**
   * GET /roles/assignable
   * Get roles that can be assigned by the current user
   */
  @Get('assignable')
  getAssignableRoles(@CurrentUser() user: JwtPayload): Role[] {
    return this.rolesService.getAssignableRoles(user.role as RoleName);
  }

  /**
   * GET /roles/:id
   * Get a specific role by ID
   */
  @Get(':id')
  getRoleById(@Param('id') id: RoleName): Role {
    return this.rolesService.getRoleById(id);
  }

  /**
   * POST /roles/check
   * Check if a user has a specific role (admin/root only)
   */
  @Post('check')
  @Roles('admin', 'root')
  async checkUserRole(
    @Body() dto: CheckUserRoleDto,
    @TenantId() tenantId: number,
  ): Promise<RoleCheckResult> {
    return await this.rolesService.checkUserRole(dto.userId, tenantId, dto.requiredRole);
  }
}
