/**
 * Auth Controller v2
 * Handles authentication logic with new API standards
 *
 * Security Features (2025-11-26):
 * - Refresh Token Rotation (new token on every refresh)
 * - Reuse Detection (revoke family on reuse)
 * - Token Family tracking
 *
 * @see docs/AUTH-TOKEN-REFACTOR-PLAN.md
 */
import bcryptjs from 'bcryptjs';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import {
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES_SECONDS,
} from '../../../config/token.config.js';
import * as refreshTokenService from '../../../services/refreshToken.service.js';
import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import { dbToApi } from '../../../utils/fieldMapping.js';
import { logger } from '../../../utils/logger.js';
import rootLog from '../logs/logs.service.js';
import user from '../users/model/index.js';

// JWT Payload interface for type safety
interface JwtPayload extends jwt.JwtPayload {
  id: number;
  email: string;
  role: string;
  tenantId: number;
  type: 'access' | 'refresh';
  family?: string; // Token family UUID for rotation tracking
}

// Request body interfaces
interface LoginRequestBody {
  email: string;
  password: string;
}

interface RefreshRequestBody {
  refreshToken: string;
}

// Get secrets from environment variables
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'default-jwt-secret';
const JWT_REFRESH_SECRET =
  process.env['JWT_REFRESH_SECRET'] ?? process.env['JWT_SECRET'] ?? 'default-jwt-secret';

// Token expiration times imported from central config (token.config['ts'])
// ACCESS_TOKEN_EXPIRES = '30m' (30 minutes)
// REFRESH_TOKEN_EXPIRES = '7d' (7 days)

// HTTP Headers
const USER_AGENT_HEADER = 'user-agent';

/** User type from findByEmail */
interface FoundUser {
  id: number;
  tenant_id: number;
  email: string;
  password: string;
  role: string;
  is_active?: boolean | number; // DB returns TINYINT (0/1)
  reset_token?: string | null;
  reset_token_expires?: Date | null;
  [key: string]: unknown;
}

/** Log successful login for audit trail */
async function logLoginAudit(foundUser: FoundUser, req: Request): Promise<void> {
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
}

/** Build safe user response without sensitive data */
function buildSafeUserResponse(foundUser: FoundUser): Record<string, unknown> {
  const {
    password,
    reset_token: resetToken,
    reset_token_expires: resetExpires,
    ...safeUser
  } = foundUser;
  void password;
  void resetToken;
  void resetExpires;
  return dbToApi(safeUser);
}

/** Log user creation for audit trail */
async function logUserCreation(
  authUser: { id: number; email: string; tenant_id: number },
  userId: number,
  userData: { email: string; username: string; firstName: string; lastName: string; role: string },
  req: Request,
): Promise<void> {
  await rootLog.create({
    tenant_id: authUser.tenant_id,
    user_id: authUser.id,
    action: 'create',
    entity_type: 'user',
    entity_id: userId,
    details: `Neuer Benutzer erstellt: ${userData.email} (${userData.role})`,
    new_values: {
      email: userData.email,
      username: userData.username,
      first_name: userData.firstName,
      last_name: userData.lastName,
      role: userData.role,
      created_by: authUser.email,
    },
    ip_address: req.ip ?? req.socket.remoteAddress,
    user_agent: req.get(USER_AGENT_HEADER),
    was_role_switched: false,
  });
}

/**
 * Generate JWT tokens with rotation support
 *
 * Creates access token + refresh token and stores refresh token hash in DB.
 * Uses token families for reuse detection.
 *
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 * @param role - The role parameter
 * @param email - The email parameter
 * @param tokenFamily - Optional existing family (for refresh rotation)
 * @param ipAddress - Client IP for audit
 * @param userAgent - Client user agent for audit
 */
async function generateTokensWithRotation(
  userId: number,
  tenantId: number,
  role: string,
  email: string,
  tokenFamily?: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  // Access token (unchanged)
  const accessToken = jwt.sign(
    {
      id: userId,
      email,
      role,
      tenantId,
      type: 'access' as const,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES },
  );

  // Generate or reuse token family
  const family = tokenFamily ?? refreshTokenService.generateTokenFamily();

  // Refresh token WITH family for rotation tracking
  const refreshToken = jwt.sign(
    {
      id: userId,
      email,
      role,
      tenantId,
      type: 'refresh' as const,
      family,
    },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES },
  );

  // Store token hash in DB (NEVER store raw token!)
  const tokenHash = refreshTokenService.hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_SECONDS * 1000);

  await refreshTokenService.storeRefreshToken(
    tokenHash,
    userId,
    tenantId,
    family,
    expiresAt,
    ipAddress,
    userAgent,
  );

  return { accessToken, refreshToken };
}

// ============================================
// Refresh Token Helpers
// ============================================

/** Custom error class for JWT verification failures */
class JwtVerifyError extends Error {
  type: 'expired' | 'invalid';
  constructor(type: 'expired' | 'invalid', message: string) {
    super(message);
    this.type = type;
    this.name = 'JwtVerifyError';
  }
}

/**
 * Verify refresh token JWT and return decoded payload
 * @throws JwtVerifyError if token is invalid or expired
 */
function verifyRefreshJwt(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
    if (decoded.type !== 'refresh') {
      throw new JwtVerifyError('invalid', 'Not a refresh token');
    }
    return decoded;
  } catch (err: unknown) {
    if (err instanceof JwtVerifyError) {
      throw err; // Re-throw our custom error
    }
    if (err instanceof jwt.TokenExpiredError) {
      throw new JwtVerifyError('expired', 'Refresh token has expired');
    }
    throw new JwtVerifyError('invalid', 'Invalid refresh token');
  }
}

/**
 * Handle token reuse detection - revokes family and returns true if reuse detected
 */
async function handleTokenReuseIfDetected(
  tokenHash: string,
  decoded: JwtPayload,
): Promise<boolean> {
  const alreadyUsed = await refreshTokenService.isTokenAlreadyUsed(tokenHash);
  if (!alreadyUsed) return false;

  // SECURITY ALERT: Token reuse detected!
  logger.warn(
    `[AUTH] SECURITY: Token reuse detected for user ${decoded.id}! Revoking entire family.`,
  );

  if (decoded.family !== undefined) {
    await refreshTokenService.revokeTokenFamily(decoded.family);
  }
  return true;
}

/** Perform token rotation: generate new tokens and mark old as used */
async function performTokenRotation(
  decoded: JwtPayload,
  oldTokenHash: string,
  storedToken: { userId: number } | null,
  ipAddress: string | undefined,
  userAgent: string | undefined,
): Promise<{ accessToken: string; refreshToken: string }> {
  // Use existing family if token was in DB, otherwise start new family
  const family = storedToken !== null ? decoded.family : undefined;

  if (storedToken === null) {
    logger.warn(`[AUTH] Token not found in DB for user ${decoded.id} - may be pre-rotation token`);
  }

  const tokens = await generateTokensWithRotation(
    decoded.id,
    decoded.tenantId,
    decoded.role,
    decoded.email,
    family,
    ipAddress,
    userAgent,
  );

  // Mark old token as used (only if it existed in DB)
  if (storedToken !== null) {
    const newTokenHash = refreshTokenService.hashToken(tokens.refreshToken);
    await refreshTokenService.markTokenAsUsed(oldTokenHash, newTokenHash);
  }

  logger.debug(`[AUTH] Token rotated for user ${decoded.id}`);
  return tokens;
}

/** User login */
async function login(
  req: Request<Record<string, string>, unknown, LoginRequestBody>,
  res: Response,
): Promise<void> {
  try {
    const { email, password } = req.body;

    if (email === '' || password === '') {
      res
        .status(400)
        .json(errorResponse('VALIDATION_ERROR', 'E-Mail und Passwort sind erforderlich'));
      return;
    }

    const foundUser = await user.findByEmail(email);
    if (foundUser === undefined) {
      res.status(401).json(errorResponse('INVALID_CREDENTIALS', 'E-Mail oder Passwort falsch'));
      return;
    }

    // Check if user is active (DB returns TINYINT 0/1, normalize to boolean)
    const isActiveValue = foundUser.is_active as boolean | number | undefined;
    if (isActiveValue !== true && isActiveValue !== 1) {
      res.status(403).json(errorResponse('ACCOUNT_INACTIVE', 'Ihr Account ist nicht aktiv'));
      return;
    }

    const isValidPassword = await bcryptjs.compare(password, foundUser.password);
    if (!isValidPassword) {
      res.status(401).json(errorResponse('INVALID_CREDENTIALS', 'E-Mail oder Passwort falsch'));
      return;
    }

    if (foundUser.tenant_id === undefined) {
      res.status(500).json(errorResponse('TENANT_ERROR', 'User has no tenant association'));
      return;
    }

    const typedUser = foundUser as FoundUser;

    // Generate tokens with rotation (stores refresh token hash in DB)
    const { accessToken, refreshToken } = await generateTokensWithRotation(
      typedUser.id,
      typedUser.tenant_id,
      typedUser.role,
      typedUser.email,
      undefined, // New family on login
      req.ip ?? req.socket.remoteAddress,
      req.get(USER_AGENT_HEADER),
    );

    await user.update(typedUser.id, { last_login: new Date() }, typedUser.tenant_id);
    await logLoginAudit(typedUser, req);

    res.json(
      successResponse({
        accessToken,
        refreshToken,
        user: buildSafeUserResponse(typedUser),
      }),
    );
  } catch (error: unknown) {
    logger.error('Login error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'An error occurred during login'));
  }
}

/** Register new user (admin only) */
async function register(req: AuthenticatedRequest, res: Response): Promise<void> {
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

    if (currentUserRole !== 'admin' && currentUserRole !== 'root') {
      res.status(403).json(errorResponse('FORBIDDEN', 'Only administrators can create users'));
      return;
    }

    const existingUser = await user.findByEmail(email);
    if (existingUser !== undefined) {
      res.status(409).json(errorResponse('EMAIL_EXISTS', 'A user with this email already exists'));
      return;
    }

    const username = email.split('@')[0];
    if (username === undefined || username === '') {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid email format'));
      return;
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const userId = await user.create({
      tenant_id: tenantId,
      username,
      email,
      password: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      role,
      is_active: true,
    });

    const newUser = await user.findById(userId, tenantId);
    if (newUser === undefined) {
      throw new Error('Failed to retrieve created user');
    }

    await logUserCreation(authUser, userId, { email, username, firstName, lastName, role }, req);

    const { password: pw, ...safeUser } = newUser;
    void pw;
    res.status(201).json(successResponse(dbToApi(safeUser)));
  } catch (error: unknown) {
    logger.error('Register error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'An error occurred during registration'));
  }
}

/**
 * User logout
 *
 * Revokes ALL refresh tokens for the user (not just current session).
 * This ensures complete logout across all devices.
 *
 * @param req - The request object
 * @param res - The response object
 */
async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Revoke ALL refresh tokens for this user
    const revokedCount = await refreshTokenService.revokeAllUserTokens(
      req.user.id,
      req.user.tenant_id,
    );

    logger.info(`[AUTH] Logout: Revoked ${revokedCount} refresh tokens for user ${req.user.id}`);

    // Log logout for audit trail
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'logout',
      entity_type: 'auth',
      entity_id: req.user.id,
      details: `Abgemeldet (${revokedCount} Tokens widerrufen)`,
      new_values: {
        email: req.user.email,
        role: req.user.role,
        tokens_revoked: revokedCount,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get(USER_AGENT_HEADER),
      was_role_switched: false,
    });

    res.json(
      successResponse({
        message: 'Logged out successfully',
        tokensRevoked: revokedCount,
      }),
    );
  } catch (error: unknown) {
    logger.error('Logout error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'An error occurred during logout'));
  }
}

/**
 * Refresh access token with rotation
 *
 * Security Features:
 * 1. Validates token signature (JWT)
 * 2. Checks token in DB (not revoked, not expired)
 * 3. REUSE DETECTION: If token was already used, revoke entire family
 * 4. Generates NEW refresh token (rotation)
 * 5. Marks old token as used
 *
 * @param req - The request object
 * @param res - The response object
 */
async function refresh(
  req: Request<unknown, unknown, RefreshRequestBody>,
  res: Response,
): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (refreshToken === '') {
      res.status(400).json(errorResponse('MISSING_TOKEN', 'Refresh token is required'));
      return;
    }

    // Step 1: Verify JWT signature and type
    let decoded: JwtPayload;
    try {
      decoded = verifyRefreshJwt(refreshToken);
    } catch (err: unknown) {
      if (err instanceof JwtVerifyError) {
        const code = err.type === 'expired' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
        res.status(401).json(errorResponse(code, err.message));
        return;
      }
      throw err; // Re-throw unexpected errors
    }

    // Step 2: Check for token reuse (SECURITY)
    const tokenHash = refreshTokenService.hashToken(refreshToken);
    const isReuse = await handleTokenReuseIfDetected(tokenHash, decoded);
    if (isReuse) {
      res
        .status(401)
        .json(
          errorResponse(
            'TOKEN_REUSE',
            'Security alert: Token reuse detected. All sessions revoked. Please login again.',
          ),
        );
      return;
    }

    // Step 3: Validate token in DB and perform rotation
    const storedToken = await refreshTokenService.findValidRefreshToken(tokenHash);
    const ipAddress = req.ip ?? req.socket.remoteAddress;
    const userAgent = req.get(USER_AGENT_HEADER);
    const tokens = await performTokenRotation(
      decoded,
      tokenHash,
      storedToken,
      ipAddress,
      userAgent,
    );

    res.json(successResponse(tokens));
  } catch (error: unknown) {
    logger.error('Refresh token error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'An error occurred during token refresh'));
  }
}

/**
 * Verify current token
 * @param req - The request object
 * @param res - The response object
 */
function verify(req: AuthenticatedRequest, res: Response): void {
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
async function getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
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
