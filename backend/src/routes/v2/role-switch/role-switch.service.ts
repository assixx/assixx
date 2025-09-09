/**
 * Role Switch Service Layer
 * Handles business logic for role switching with strict security checks
 */
import jwt from 'jsonwebtoken';

import rootLog from '../../../models/rootLog';
import userModel, { DbUser } from '../../../models/user.js';

// Use same JWT_SECRET as auth middleware
const JWT_SECRET = process.env.JWT_SECRET ?? '';

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
 *
 */
export class ServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ServiceError';
  }
}

/**
 * SECURITY: Verify user belongs to the same tenant
 * CRITICAL: This prevents cross-tenant access
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 */
async function verifyUserTenant(userId: number, tenantId: number): Promise<DbUser> {
  const user = await userModel.findById(userId, tenantId);
  if (!user) {
    throw new ServiceError('User not found or tenant mismatch', 404, 'USER_NOT_FOUND');
  }

  // DOUBLE CHECK: Ensure tenant_id matches
  if (!user.tenant_id || user.tenant_id !== tenantId) {
    console.error(
      `SECURITY VIOLATION: User ${userId} tried to access tenant ${tenantId} but belongs to ${user.tenant_id ?? 'unknown'}`,
    );
    throw new ServiceError('Unauthorized access', 403, 'TENANT_MISMATCH');
  }

  return user;
}

/**
 * Generate JWT token with role switch information
 * SECURITY: Always preserves original role, tenant_id, and user_id
 * @param user - The user parameter
 * @param activeRole - The activeRole parameter
 * @param isRoleSwitched - The isRoleSwitched parameter
 */
function generateToken(user: DbUser, activeRole: string, isRoleSwitched: boolean): string {
  return jwt.sign(
    {
      // User identity - NEVER changes
      id: user.id,
      username: user.username,
      email: user.email,
      tenant_id: user.tenant_id as number, // CRITICAL: Always from user object (verified in verifyUserTenant)
      tenantId: user.tenant_id as number, // v2 compatibility

      // Role information
      role: user.role, // CRITICAL: Original role NEVER changes
      activeRole, // Only this changes
      isRoleSwitched, // Already a boolean

      // Token type for v2 auth middleware
      type: 'access' as const,
    },
    JWT_SECRET,
    { expiresIn: '24h' },
  );
}

/**
 * Log role switch action for audit trail
 * @param tenantId - The tenant ID
 * @param userId - The user ID
 * @param fromRole - The fromRole parameter
 * @param toRole - The toRole parameter
 * @param action - The action parameter
 */
async function logRoleSwitch(
  tenantId: number,
  userId: number,
  fromRole: string,
  toRole: string,
  action: string,
): Promise<void> {
  await rootLog.create({
    tenant_id: tenantId,
    user_id: userId,
    action,
    entity_type: 'user',
    entity_id: userId,
    new_values: {
      from_role: fromRole,
      to_role: toRole,
      timestamp: new Date(),
    },
    was_role_switched: true,
  });
}

/**
 * Switch to employee view
 * Only admin and root users can switch to employee
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 */
async function switchToEmployee(userId: number, tenantId: number): Promise<RoleSwitchResult> {
  // SECURITY: Verify user and tenant
  const user = await verifyUserTenant(userId, tenantId);

  // PERMISSION: Only admin and root can switch
  if (user.role !== 'admin' && user.role !== 'root') {
    throw new ServiceError(
      'Only admins and root users can switch roles',
      403,
      'INSUFFICIENT_PERMISSIONS',
    );
  }

  // Ensure employee data exists
  if (!user.position) {
    await userModel.update(
      user.id,
      { position: 'Mitarbeiter' },
      user.tenant_id as number, // CRITICAL: Use user's tenant_id (verified)
    );
  }

  // Generate token
  const token = generateToken(user, 'employee', true);

  // Log action
  await logRoleSwitch(
    user.tenant_id as number,
    user.id,
    user.role,
    'employee',
    'role_switch_to_employee',
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role, // Original role preserved
      activeRole: 'employee',
      tenantId: user.tenant_id as number,
      isRoleSwitched: true,
    },
    message: 'Successfully switched to employee view',
  };
}

/**
 * Switch back to original role (admin or root)
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 */
async function switchToOriginalRole(userId: number, tenantId: number): Promise<RoleSwitchResult> {
  // SECURITY: Verify user and tenant
  const user = await verifyUserTenant(userId, tenantId);

  // PERMISSION: Only admin and root can use this
  if (user.role !== 'admin' && user.role !== 'root') {
    throw new ServiceError(
      'Only admins and root users can switch roles',
      403,
      'INSUFFICIENT_PERMISSIONS',
    );
  }

  // Generate token with original role
  const token = generateToken(user, user.role, false);

  // Log action
  await logRoleSwitch(
    user.tenant_id as number,
    user.id,
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
      activeRole: user.role, // Back to original
      tenantId: user.tenant_id as number,
      isRoleSwitched: false,
    },
    message: `Successfully switched back to ${user.role} view`,
  };
}

/**
 * Root user switches to admin view
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 */
async function rootToAdmin(userId: number, tenantId: number): Promise<RoleSwitchResult> {
  // SECURITY: Verify user and tenant
  const user = await verifyUserTenant(userId, tenantId);

  // PERMISSION: Only root can use this
  if (user.role !== 'root') {
    throw new ServiceError(
      'Only root users can switch to admin view',
      403,
      'INSUFFICIENT_PERMISSIONS',
    );
  }

  // Generate token
  const token = generateToken(user, 'admin', true);

  // Log action
  await logRoleSwitch(
    user.tenant_id as number,
    user.id,
    'root',
    'admin',
    'role_switch_root_to_admin',
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role, // Still root
      activeRole: 'admin',
      tenantId: user.tenant_id as number,
      isRoleSwitched: true,
    },
    message: 'Successfully switched to admin view',
  };
}

export const roleSwitchService = {
  switchToEmployee,
  switchToOriginalRole,
  rootToAdmin,
};
