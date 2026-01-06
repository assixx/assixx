/**
 * Role Switch Controller
 *
 * REST API endpoints for role switching functionality.
 * Allows admin/root users to temporarily view the app as employee.
 *
 * SECURITY: All endpoints require authentication.
 * All user information comes from the JWT token - NO request body needed.
 */
import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentUser, Roles } from '../common/index.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { RoleSwitchResult, RoleSwitchStatus } from './role-switch.service.js';
import { RoleSwitchService } from './role-switch.service.js';

@Controller('role-switch')
export class RoleSwitchController {
  constructor(private readonly roleSwitchService: RoleSwitchService) {}

  /**
   * POST /api/v2/role-switch/to-employee
   *
   * Switch current user to employee view.
   * Only admin and root users can use this endpoint.
   *
   * @returns New JWT token with activeRole='employee' and isRoleSwitched=true
   */
  @Post('to-employee')
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.OK)
  async switchToEmployee(@CurrentUser() user: NestAuthUser): Promise<RoleSwitchResult> {
    return await this.roleSwitchService.switchToEmployee(user.id, user.tenantId);
  }

  /**
   * POST /api/v2/role-switch/to-original
   *
   * Switch back to original role.
   * NOTE: No Roles decorator - service validates using DB role (not JWT activeRole).
   * This allows role-switched users (activeRole=employee) to switch back.
   *
   * @returns New JWT token with activeRole=originalRole and isRoleSwitched=false
   */
  @Post('to-original')
  @HttpCode(HttpStatus.OK)
  async switchToOriginal(@CurrentUser() user: NestAuthUser): Promise<RoleSwitchResult> {
    return await this.roleSwitchService.switchToOriginal(user.id, user.tenantId);
  }

  /**
   * POST /api/v2/role-switch/root-to-admin
   *
   * Root user switches to admin view.
   * Only root users can use this endpoint.
   *
   * @returns New JWT token with activeRole='admin' and isRoleSwitched=true
   */
  @Post('root-to-admin')
  @Roles('root')
  @HttpCode(HttpStatus.OK)
  async rootToAdmin(@CurrentUser() user: NestAuthUser): Promise<RoleSwitchResult> {
    return await this.roleSwitchService.rootToAdmin(user.id, user.tenantId);
  }

  /**
   * GET /api/v2/role-switch/status
   *
   * Get current role switch status.
   * All authenticated users can check their status.
   *
   * @returns Current role switch status from JWT payload
   */
  @Get('status')
  @HttpCode(HttpStatus.OK)
  getStatus(@CurrentUser() user: NestAuthUser): RoleSwitchStatus {
    return this.roleSwitchService.getStatus(
      user.id,
      user.tenantId,
      user.role,
      user.activeRole,
      user.isRoleSwitched,
    );
  }
}
