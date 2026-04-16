/**
 * Role Switch Controller
 *
 * REST API endpoints for role switching functionality.
 * Allows admin/root users to temporarily view the app as employee.
 *
 * SECURITY: All endpoints require authentication.
 * All user information comes from the JWT token - NO request body needed.
 */
import { Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CurrentUser, Roles } from '../common/index.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
// Keep cookie writes single-sourced — auth.controller owns the 3-cookie invariant.
import { rotateAccessCookies } from '../auth/auth.controller.js';
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
   * Cookie handling: the service mints a new access token carrying the
   * switched `activeRole` claim. `rotateAccessCookies` updates the
   * `accessToken` + `accessTokenExp` cookies so SSR (which reads the cookie)
   * and client-side Bearer (which reads localStorage after the JSON body is
   * applied) agree on the role. Refresh cookie is untouched — session
   * identity hasn't changed, only a UI-state claim.
   *
   * @returns New JWT token with activeRole='employee' and isRoleSwitched=true
   */
  @Post('to-employee')
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.OK)
  async switchToEmployee(
    @CurrentUser() user: NestAuthUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RoleSwitchResult> {
    const result = await this.roleSwitchService.switchToEmployee(user.id, user.tenantId);
    rotateAccessCookies(reply, result.token);
    return result;
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
  async switchToOriginal(
    @CurrentUser() user: NestAuthUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RoleSwitchResult> {
    const result = await this.roleSwitchService.switchToOriginal(user.id, user.tenantId);
    rotateAccessCookies(reply, result.token);
    return result;
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
  async rootToAdmin(
    @CurrentUser() user: NestAuthUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RoleSwitchResult> {
    const result = await this.roleSwitchService.rootToAdmin(user.id, user.tenantId);
    rotateAccessCookies(reply, result.token);
    return result;
  }

  /**
   * GET /api/v2/role-switch/status
   *
   * Get current role switch status.
   * All authenticated users can check their status.
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
