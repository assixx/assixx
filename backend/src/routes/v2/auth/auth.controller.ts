/**
 * Auth Controller v2
 * Handles authentication logic with new API standards
 */
import bcryptjs from 'bcryptjs';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import rootLog from '../../../models/rootLog';
import user from '../../../models/user';
import type { AuthenticatedRequest } from '../../../types/request.types';
import { errorResponse, successResponse } from '../../../utils/apiResponse';
import { dbToApi } from '../../../utils/fieldMapping';
import { logger } from '../../../utils/logger';
import { createLog } from '../../v1/logs';

// Get secrets from environment variables
const JWT_SECRET = process.env.JWT_SECRET ?? 'default-jwt-secret';
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'default-jwt-secret';

// Token expiration times
const ACCESS_TOKEN_EXPIRES = '30m'; // 30 Minuten
const REFRESH_TOKEN_EXPIRES = '7d';

// HTTP Headers
const USER_AGENT_HEADER = 'user-agent';

/**
 * Generate JWT tokens
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 * @param role - The role parameter
 * @param email - The email parameter
 */
function generateTokens(
  userId: number,
  tenantId: number,
  role: string,
  email: string,
): { accessToken: string; refreshToken: string } {
  const payload = {
    id: userId,
    email,
    role,
    tenantId,
    type: 'access' as const,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });

  const refreshPayload = {
    id: userId,
    email,
    role,
    tenantId,
    type: 'refresh' as const,
  };

  const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });

  return { accessToken, refreshToken };
}

/**
 * User login
 * @param req - The request object
 * @param res - The response object
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };

    // Validate required fields
    if (!email || !password) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Email and password are required'));
      return;
    }

    // Find user by email
    const foundUser = await user.findByEmail(email);
    if (!foundUser) {
      res.status(401).json(errorResponse('INVALID_CREDENTIALS', 'Invalid email or password'));
      return;
    }

    // Check if user is active
    if (foundUser.status !== 'active') {
      res.status(403).json(errorResponse('ACCOUNT_INACTIVE', 'Your account is not active'));
      return;
    }

    // Verify password
    const isValidPassword = await bcryptjs.compare(password, foundUser.password);
    if (!isValidPassword) {
      res.status(401).json(errorResponse('INVALID_CREDENTIALS', 'Invalid email or password'));
      return;
    }

    // Ensure tenant_id exists
    if (!foundUser.tenant_id) {
      res.status(500).json(errorResponse('TENANT_ERROR', 'User has no tenant association'));
      return;
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      foundUser.id,
      foundUser.tenant_id,
      foundUser.role,
      foundUser.email,
    );

    // TODO: Update last login - need to add updateLastLogin method to User model

    // Log successful login to both log systems
    // 1. Log to activity_logs for frontend display
    await createLog(
      foundUser.id,
      foundUser.tenant_id,
      'login',
      'user',
      foundUser.id,
      `Angemeldet als ${foundUser.role}`,
      req.ip ?? req.socket.remoteAddress,
      req.get(USER_AGENT_HEADER),
    );

    // 2. Log to root_logs for detailed audit
    await rootLog.create({
      tenant_id: foundUser.tenant_id,
      user_id: foundUser.id,
      action: 'login',
      entity_type: 'auth',
      entity_id: foundUser.id,
      details: `Angemeldet als ${foundUser.role}`,
      new_values: {
        email: foundUser.email,
        role: foundUser.role,
        login_method: 'password',
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get(USER_AGENT_HEADER),
      was_role_switched: false,
    });

    // Remove sensitive data - create new object without password
    const {
      password: removedPassword,
      reset_token: removedResetToken,
      reset_token_expires: removedResetTokenExpires,
      ...safeUser
    } = foundUser;
    void removedPassword;
    void removedResetToken;
    void removedResetTokenExpires;

    // Convert to camelCase for API response
    const userApi = dbToApi(safeUser);

    res.json(
      successResponse({
        accessToken,
        refreshToken,
        user: userApi,
      }),
    );
  } catch (error: unknown) {
    logger.error('Login error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'An error occurred during login'));
  }
}

/**
 * Register new user (admin only)
 * @param req - The request object
 * @param res - The response object
 */
export async function register(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role = 'employee',
    } = req.body as {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role?: string;
    };
    const authUser = req.user;
    const { tenant_id: tenantId, role: currentUserRole } = authUser;

    // Only admins can create users
    if (currentUserRole !== 'admin' && currentUserRole !== 'root') {
      res.status(403).json(errorResponse('FORBIDDEN', 'Only administrators can create users'));
      return;
    }

    // Check if email already exists
    const existingUser = await user.findByEmail(email);
    if (existingUser) {
      res.status(409).json(errorResponse('EMAIL_EXISTS', 'A user with this email already exists'));
      return;
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Create user - username is email without domain for backwards compatibility
    const username = email.split('@')[0];
    const userId = await user.create({
      tenant_id: tenantId,
      username,
      email,
      password: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      role,
      status: 'active',
    });

    // Get created user
    const newUser = await user.findById(userId, tenantId);
    if (!newUser) {
      throw new Error('Failed to retrieve created user');
    }

    // Log user creation to both log systems
    // 1. Log to activity_logs for frontend display
    await createLog(
      authUser.id,
      tenantId,
      'create_user',
      'user',
      userId,
      `Neuer Benutzer erstellt: ${email} (${role})`,
      req.ip ?? req.socket.remoteAddress,
      req.get(USER_AGENT_HEADER),
    );

    // 2. Log to root_logs for detailed audit
    await rootLog.create({
      tenant_id: tenantId,
      user_id: authUser.id, // Admin who created the user
      action: 'create',
      entity_type: 'user',
      entity_id: userId,
      details: `Neuer Benutzer erstellt: ${email} (${role})`,
      new_values: {
        email,
        username,
        first_name: firstName,
        last_name: lastName,
        role,
        created_by: authUser.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get(USER_AGENT_HEADER),
      was_role_switched: false,
    });

    // Remove sensitive data - create new object without password
    const { password: userPassword, ...safeUser } = newUser;
    void userPassword; // Unused variable

    // Convert to camelCase
    const userApi = dbToApi(safeUser);

    res.status(201).json(successResponse(userApi));
  } catch (error: unknown) {
    logger.error('Register error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'An error occurred during registration'));
  }
}

/**
 * User logout
 * @param req - The request object
 * @param res - The response object
 */
export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // In a real implementation, you might want to:
    // 1. Blacklist the token
    // 2. Clear refresh token from database
    // 3. Clear any server-side sessions

    // Log logout
    // 1. Log to activity_logs for frontend display
    await createLog(
      req.user.id,
      req.user.tenant_id,
      'logout',
      'user',
      req.user.id,
      'Abgemeldet',
      req.ip ?? req.socket.remoteAddress,
      req.get(USER_AGENT_HEADER),
    );

    // 2. Log to root_logs for detailed audit
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'logout',
      entity_type: 'auth',
      entity_id: req.user.id,
      details: 'Abgemeldet',
      new_values: {
        email: req.user.email,
        role: req.user.role,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get(USER_AGENT_HEADER),
      was_role_switched: false,
    });

    res.json(
      successResponse({
        message: 'Logged out successfully',
      }),
    );
  } catch (error: unknown) {
    logger.error('Logout error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'An error occurred during logout'));
  }
}

/**
 * Refresh access token
 * @param req - The request object
 * @param res - The response object
 */
export function refresh(req: Request, res: Response): void {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      res.status(400).json(errorResponse('MISSING_TOKEN', 'Refresh token is required'));
      return;
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as jwt.JwtPayload;

    // Ensure it's a refresh token, not an access token
    if (decoded.type !== 'refresh') {
      res.status(401).json(errorResponse('INVALID_TOKEN', 'Invalid refresh token'));
      return;
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        id: decoded.id as number,
        email: decoded.email as string,
        tenantId: decoded.tenantId as number,
        role: decoded.role as string,
        type: 'access' as const,
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES },
    );

    res.json(
      successResponse({
        accessToken,
      }),
    );
  } catch (error: unknown) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json(errorResponse('INVALID_TOKEN', 'Invalid or expired refresh token'));
      return;
    }

    logger.error('Refresh token error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'An error occurred during token refresh'));
  }
}

/**
 * Verify current token
 * @param req - The request object
 * @param res - The response object
 */
export function verify(req: AuthenticatedRequest, res: Response): void {
  try {
    const authUser = req.user;
    res.json(
      successResponse({
        valid: true,
        user: {
          id: authUser.id,
          email: authUser.email,
          tenantId: authUser.tenant_id,
          role: authUser.role,
        },
      }),
    );
  } catch (error: unknown) {
    logger.error('Verify error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'An error occurred during verification'));
  }
}

/**
 * Get current user information
 * @param req - The request object
 * @param res - The response object
 */
export async function getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const authUser = req.user;
    const { userId, tenant_id: tenantId } = authUser;

    const foundUser = await user.findById(userId, tenantId);
    if (!foundUser) {
      res.status(404).json(errorResponse('USER_NOT_FOUND', 'User not found'));
      return;
    }

    // Remove sensitive data - create new object without password
    const {
      password: removedPassword,
      reset_token: removedResetToken,
      reset_token_expires: removedResetTokenExpires,
      ...safeUser
    } = foundUser;
    void removedPassword;
    void removedResetToken;
    void removedResetTokenExpires;

    // Convert to camelCase
    const userApi = dbToApi(safeUser);

    res.json(successResponse(userApi));
  } catch (error: unknown) {
    logger.error('Get current user error:', error);
    res
      .status(500)
      .json(errorResponse('SERVER_ERROR', 'An error occurred while fetching user data'));
  }
}

export const authController = {
  login,
  register,
  logout,
  refresh,
  verify,
  getCurrentUser,
};
