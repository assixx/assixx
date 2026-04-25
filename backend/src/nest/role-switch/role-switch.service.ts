/**
 * Role Switch Service
 *
 * Business logic for role switching with strict security checks.
 * Allows admin/root users to temporarily view the app as employee.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { getErrorMessage } from '../common/index.js';
import { DatabaseService } from '../database/database.service.js';

/**
 * User row from database
 */
interface UserRow {
  id: number;
  username: string;
  email: string;
  role: string;
  tenant_id: number;
  position: string | null;
}

/**
 * Role switch result with new token
 */
export interface RoleSwitchResult {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    activeRole: string;
    tenantId: number;
    isRoleSwitched: boolean;
  };
  message: string;
}

/**
 * Role switch status
 */
export interface RoleSwitchStatus {
  userId: number;
  tenantId: number;
  originalRole: string;
  activeRole: string;
  isRoleSwitched: boolean;
  canSwitch: boolean;
}

@Injectable()
export class RoleSwitchService {
  private readonly logger = new Logger(RoleSwitchService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Verify user belongs to tenant and return user data
   * SECURITY: Only allows ACTIVE users (is_active = 1) to perform role switches
   */
  private async verifyUserTenant(userId: number, tenantId: number): Promise<UserRow> {
    const rows = await this.db.tenantQuery<UserRow>(
      `SELECT id, username, email, role, tenant_id, position FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [userId, tenantId],
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new NotFoundException('User not found, inactive, or tenant mismatch');
    }

    const user = rows[0];

    // SECURITY: Double-check tenant_id matches
    if (user.tenant_id !== tenantId) {
      this.logger.error(
        `SECURITY VIOLATION: User ${userId} tried to access tenant ${tenantId} but belongs to ${user.tenant_id}`,
      );
      throw new ForbiddenException('Unauthorized access');
    }

    return user;
  }

  /**
   * Generate JWT token with role switch information.
   *
   * `preserveExp` is the Unix-seconds expiration from the CALLER's current
   * access token. Role-switch is semantically a claim change (`activeRole`),
   * NOT a session renewal — we preserve the original session's exp so:
   *   1. The header countdown flows smoothly across role changes instead of
   *      jumping back to 30:00 every switch.
   *   2. Users cannot bypass the inactivity timeout by periodically clicking
   *      role-switch; a compromised session stays bounded by the original exp.
   *   3. Only the explicit refresh-token flow (AuthService.refresh) legitimately
   *      extends session lifetime.
   *
   * A floor of 1 second keeps jsonwebtoken from rejecting a zero/negative
   * expiresIn if the caller's token is about to expire; the new token will
   * simply die immediately and the client hits the standard expired-session
   * path. Happens only in a sub-second race window because the JwtAuthGuard
   * already rejected expired tokens upstream.
   */
  private generateToken(
    user: UserRow,
    activeRole: string,
    isRoleSwitched: boolean,
    preserveExp: number,
  ): string {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const remainingSeconds = Math.max(preserveExp - nowSeconds, 1);
    return this.jwtService.sign(
      {
        // User identity - NEVER changes
        id: user.id,
        username: user.username,
        email: user.email,
        tenant_id: user.tenant_id,
        tenantId: user.tenant_id,

        // Role information
        role: user.role, // Original role NEVER changes
        activeRole,
        isRoleSwitched,

        // Token type
        type: 'access' as const,
      },
      // Override the module's default expiresIn (30m) with the caller's
      // remaining session time — see method doc for rationale.
      { expiresIn: remainingSeconds },
    );
  }

  /**
   * Log role switch action to root_logs for audit trail
   */
  private async logRoleSwitch(
    tenantId: number,
    userId: number,
    fromRole: string,
    toRole: string,
    action: string,
  ): Promise<void> {
    try {
      await this.db.tenantQuery(
        `INSERT INTO root_logs (tenant_id, user_id, action, entity_type, entity_id, new_values, was_role_switched, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          tenantId,
          userId,
          action,
          'user',
          userId,
          JSON.stringify({ from_role: fromRole, to_role: toRole }),
          true,
        ],
      );
    } catch (error: unknown) {
      // Don't fail the operation if audit logging fails
      this.logger.warn(`Failed to log role switch: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Switch to employee view (admin/root only)
   */
  async switchToEmployee(
    userId: number,
    tenantId: number,
    preserveExp: number,
  ): Promise<RoleSwitchResult> {
    this.logger.log(`User ${userId} switching to employee view`);

    const user = await this.verifyUserTenant(userId, tenantId);

    // PERMISSION: Only admin and root can switch
    if (user.role !== 'admin' && user.role !== 'root') {
      throw new ForbiddenException('Only admins and root users can switch roles');
    }

    const token = this.generateToken(user, 'employee', true, preserveExp);

    await this.logRoleSwitch(tenantId, userId, user.role, 'employee', 'role_switch_to_employee');

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        activeRole: 'employee',
        tenantId: user.tenant_id,
        isRoleSwitched: true,
      },
      message: 'Successfully switched to employee view',
    };
  }

  /**
   * Switch back to original role
   */
  async switchToOriginal(
    userId: number,
    tenantId: number,
    preserveExp: number,
  ): Promise<RoleSwitchResult> {
    this.logger.log(`User ${userId} switching back to original role`);

    const user = await this.verifyUserTenant(userId, tenantId);

    // PERMISSION: Only admin and root can use this
    if (user.role !== 'admin' && user.role !== 'root') {
      throw new ForbiddenException('Only admins and root users can switch roles');
    }

    const token = this.generateToken(user, user.role, false, preserveExp);

    await this.logRoleSwitch(
      tenantId,
      userId,
      'employee',
      user.role,
      `role_switch_to_${user.role}`,
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        activeRole: user.role,
        tenantId: user.tenant_id,
        isRoleSwitched: false,
      },
      message: `Successfully switched back to ${user.role} view`,
    };
  }

  /**
   * Root user switches to admin view
   */
  async rootToAdmin(
    userId: number,
    tenantId: number,
    preserveExp: number,
  ): Promise<RoleSwitchResult> {
    this.logger.log(`Root user ${userId} switching to admin view`);

    const user = await this.verifyUserTenant(userId, tenantId);

    // PERMISSION: Only root can use this
    if (user.role !== 'root') {
      throw new ForbiddenException('Only root users can switch to admin view');
    }

    const token = this.generateToken(user, 'admin', true, preserveExp);

    await this.logRoleSwitch(tenantId, userId, 'root', 'admin', 'role_switch_root_to_admin');

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        activeRole: 'admin',
        tenantId: user.tenant_id,
        isRoleSwitched: true,
      },
      message: 'Successfully switched to admin view',
    };
  }

  /**
   * Get current role switch status from JWT payload
   */
  getStatus(
    userId: number,
    tenantId: number,
    role: string,
    activeRole: string | undefined,
    isRoleSwitched: boolean | undefined,
  ): RoleSwitchStatus {
    return {
      userId,
      tenantId,
      originalRole: role,
      activeRole: activeRole ?? role,
      isRoleSwitched: isRoleSwitched ?? false,
      canSwitch: role === 'admin' || role === 'root',
    };
  }
}
