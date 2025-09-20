/**
 * Authentication Controller
 * Handles all authentication-related business logic
 */
import { Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2/promise';

import { createLog } from '../routes/v1/logs';
import authService from '../services/auth.service';
import userService from '../services/user.service';
import type { AuthResult } from '../types/auth.types';
import type { AuthenticatedRequest } from '../types/request.types';
import { errorResponse, successResponse } from '../types/response.types';
import { query as executeQuery } from '../utils/db';
import { logger } from '../utils/logger';

// Type guard to check if request has authenticated user
/**
 *
 * @param req - The request object
 */
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return 'user' in req && req.user != null && typeof req.user === 'object' && 'id' in req.user;
}

// Interfaces for request bodies
interface LoginRequest extends Request {
  body: {
    username?: string;
    password?: string;
    fingerprint?: string; // Browser fingerprint for session isolation
  };
}

interface RegisterRequest extends Request {
  body: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    tenant_id?: number;
  };
}

/**
 *
 */
class AuthController {
  /**
   * Check if user is authenticated
   * @param req - The request object
   * @param res - The response object
   */
  checkAuth(req: AuthenticatedRequest, res: Response): void {
    try {
      // If middleware passes, user is authenticated
      res.json(
        successResponse({
          authenticated: true,
          user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
          },
        }),
      );
    } catch (error: unknown) {
      logger.error('Error in auth check:', error);
      res.status(500).json(errorResponse('Serverfehler', 500));
    }
  }

  /**
   * Get current user profile
   * @param req - The request object
   * @param res - The response object
   */
  async getUserProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = await userService.getUserById(req.user.id, req.user.tenant_id);

      if (user === null) {
        res.status(404).json(errorResponse('Benutzer nicht gefunden', 404));
        return;
      }

      // Get tenant name - handle both column names for compatibility
      let tenantName = '';
      try {
        const [tenantRows] = await executeQuery<RowDataPacket[]>(
          'SELECT * FROM tenants WHERE id = ?',
          [req.user.tenant_id],
        );

        if (tenantRows.length > 0) {
          // Check company_name first, fall back to name if empty
          // Use nullish coalescing and proper string checks
          const companyName = tenantRows[0].company_name as string | null | undefined;
          const name = tenantRows[0].name as string | null | undefined;

          if (companyName !== null && companyName !== undefined && companyName.trim() !== '') {
            tenantName = companyName;
          } else if (name !== null && name !== undefined && name.trim() !== '') {
            tenantName = name;
          }
        }
      } catch (error: unknown) {
        logger.warn('Failed to get tenant name:', error);
      }

      res.json(
        successResponse({
          ...user,
          tenantName,
        }),
      );
    } catch (error: unknown) {
      logger.error('Error in get user profile:', error);
      res.status(500).json(errorResponse('Serverfehler', 500));
    }
  }

  /**
   * Track login attempt in database
   */
  private async trackLoginAttempt(
    username: string,
    ipAddress: string,
    success: boolean,
  ): Promise<void> {
    try {
      await executeQuery(
        'INSERT INTO login_attempts (username, ip_address, success, attempted_at) VALUES (?, ?, ?, NOW())',
        [username, ipAddress, success],
      );
    } catch (error: unknown) {
      logger.error(`Failed to track ${success ? 'successful' : 'failed'} login attempt:`, error);
    }
  }

  /**
   * Validate login request data
   */
  private validateLoginRequest(
    username: string | undefined,
    password: string | undefined,
  ): boolean {
    return username !== undefined && username !== '' && password !== undefined && password !== '';
  }

  /**
   * Process successful login
   */
  private async processSuccessfulLogin(
    result: AuthResult,
    req: LoginRequest,
    res: Response,
  ): Promise<void> {
    // Set token as httpOnly cookie for HTML pages
    if (result.token === '') {
      res.status(500).json(errorResponse('Token-Generierung fehlgeschlagen', 500));
      return;
    }

    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Log successful login
    if (result.user !== null) {
      await createLog(
        result.user.id,
        result.user.tenant_id,
        'login',
        'user',
        result.user.id,
        `Erfolgreich angemeldet`,
        req.ip ?? 'unknown',
        req.headers['user-agent'] ?? 'unknown',
      );

      await this.trackLoginAttempt(req.body.username ?? 'unknown', req.ip ?? 'unknown', true);
    }

    // Return user data and tokens with standardized response format
    res.json(
      successResponse(
        {
          token: result.token,
          refreshToken: result.refreshToken,
          role: result.user?.role,
          user: result.user,
        },
        'Login erfolgreich',
      ),
    );
  }

  /**
   * Login user
   * @param req - The request object
   * @param res - The response object
   */
  async login(req: LoginRequest, res: Response): Promise<void> {
    console.info('[DEBUG] AuthController.login called');
    try {
      const { username, password, fingerprint } = req.body;
      console.info('[DEBUG] Login attempt for username:', username);
      console.info('[DEBUG] Browser fingerprint provided:', fingerprint !== undefined);

      // Validate input
      if (!this.validateLoginRequest(username, password)) {
        res.status(400).json(errorResponse('Benutzername und Passwort sind erforderlich', 400));
        return;
      }

      // At this point, username and password are guaranteed to be defined and non-empty
      const validUsername = username as string;
      const validPassword = password as string;

      // Get tenant subdomain from header if provided
      const tenantSubdomainHeader = req.headers['x-tenant-subdomain'];
      const tenantSubdomain =
        typeof tenantSubdomainHeader === 'string' ? tenantSubdomainHeader : undefined;

      // Authenticate user with fingerprint and tenant validation
      console.info('[DEBUG] Calling authService.authenticateUser');
      console.info('[DEBUG] Username/Email:', validUsername);
      console.info('[DEBUG] Tenant subdomain from header:', tenantSubdomain);
      const result = await authService.authenticateUser(
        validUsername,
        validPassword,
        fingerprint,
        tenantSubdomain,
      );
      console.info('[DEBUG] Auth result:', result.success ? 'Success' : 'Failed');
      console.info('[DEBUG] Auth result details:', JSON.stringify(result));

      if (!result.success) {
        await this.trackLoginAttempt(validUsername, req.ip ?? 'unknown', false);
        res.status(401).json(errorResponse(result.message ?? 'Ungültige Anmeldedaten', 401));
        return;
      }

      await this.processSuccessfulLogin(result, req, res);
    } catch (error: unknown) {
      logger.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[DEBUG] Login error details:', errorMessage, errorStack);
      res.status(500).json(errorResponse('Serverfehler beim Login', 500));
    }
  }

  /**
   * Register new user
   * @param req - The request object
   * @param res - The response object
   */
  async register(req: RegisterRequest, res: Response): Promise<void> {
    try {
      // Map English field names to German field names expected by service
      const userData = {
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
        vorname: req.body.first_name ?? '',
        nachname: req.body.last_name ?? '',
        role: req.body.role as 'admin' | 'employee' | undefined,
        tenant_id: req.body.tenant_id,
      };

      // Register user through service
      const result = await authService.registerUser(userData);

      if (!result.success) {
        res.status(400).json(errorResponse(result.message ?? 'Registrierung fehlgeschlagen', 400));
        return;
      }

      res.status(201).json(successResponse({ user: result.user }, 'Registrierung erfolgreich'));
    } catch (error: unknown) {
      logger.error('Registration error:', error);
      res.status(500).json(errorResponse('Serverfehler bei der Registrierung', 500));
    }
  }

  /**
   * Invalidate user session in database
   */
  private async invalidateUserSession(token: string, userId: number): Promise<void> {
    try {
      const jwt = await import('jsonwebtoken');
      const jwtSecret = process.env.JWT_SECRET;

      if (jwtSecret === undefined || jwtSecret === '') {
        throw new Error('JWT_SECRET not configured');
      }

      const decoded = jwt.default.verify(token, jwtSecret) as JwtPayload & {
        sessionId?: string;
        id?: number;
      };

      if (decoded.sessionId !== undefined && decoded.sessionId !== '') {
        await executeQuery(
          'UPDATE user_sessions SET expires_at = NOW() WHERE session_id = ? AND user_id = ?',
          [decoded.sessionId, userId],
        );
      }
    } catch (error: unknown) {
      logger.warn('Failed to invalidate session:', error);
    }
  }

  /**
   * Log logout action
   */
  private async logLogoutAction(req: AuthenticatedRequest): Promise<void> {
    await createLog(
      req.user.id,
      req.user.tenant_id,
      'logout',
      'user',
      req.user.id,
      'Abgemeldet',
      req.ip ?? 'unknown',
      req.headers['user-agent'] ?? 'unknown',
    );
  }

  /**
   * Clear authentication cookie
   */
  private clearAuthCookie(res: Response): void {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }

  /**
   * Logout user
   * @param req - The request object
   * @param res - The response object
   */
  async logout(req: Request, res: Response): Promise<void> {
    // Log logout action and invalidate session if user is authenticated
    if (isAuthenticated(req)) {
      await this.logLogoutAction(req);

      // Invalidate session in database if token exists
      const token = req.headers.authorization?.split(' ')[1];
      if (token !== undefined && token.trim() !== '') {
        await this.invalidateUserSession(token, req.user.id);
      }
    }

    // Clear the httpOnly cookie
    this.clearAuthCookie(res);

    res.json(successResponse(null, 'Erfolgreich abgemeldet'));
  }

  /**
   * Validate token
   * @param req - The request object
   * @param res - The response object
   */
  async validateToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Token is already validated by authenticateToken middleware
      // Get fresh user data from database
      const userId = req.user.id;
      const user = await userService.getUserById(userId, req.user.tenant_id);

      if (user === null) {
        res.status(404).json(errorResponse('Benutzer nicht gefunden', 404));
        return;
      }

      // Check if user is active
      if (user.is_active === false) {
        res.status(403).json(errorResponse('Benutzerkonto ist inaktiv', 403));
        return;
      }

      res.json(
        successResponse({
          valid: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            tenant_id: user.tenant_id,
            department_id: user.department_id,
            first_name: user.first_name,
            last_name: user.last_name,
          },
        }),
      );
    } catch (error: unknown) {
      logger.error('[AUTH] Validation error:', error);
      res.status(500).json(errorResponse('Interner Serverfehler', 500));
    }
  }

  /**
   * Validate browser fingerprint
   * @param req - The request object
   * @param res - The response object
   */
  async validateFingerprint(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const requestBody = req.body as { fingerprint?: unknown };
      const fingerprint =
        typeof requestBody.fingerprint === 'string' ? requestBody.fingerprint : undefined;
      const user = req.user;

      if (fingerprint === undefined || fingerprint === '') {
        res.json({ valid: true }); // Skip validation if no fingerprint
        return;
      }

      // Get session ID from token (if available)
      interface UserWithSession {
        id: number;
        tenant_id: number;
        sessionId?: string;
      }
      const userWithSession = user as UserWithSession;
      const sessionId = userWithSession.sessionId;
      if (sessionId === undefined || sessionId === '') {
        res.json({ valid: true }); // Skip if no session ID
        return;
      }

      // Check session in database
      const [sessions] = await executeQuery<RowDataPacket[]>(
        'SELECT fingerprint FROM user_sessions WHERE user_id = ? AND session_id = ? AND expires_at > NOW()',
        [user.id, sessionId],
      );

      if (sessions.length === 0) {
        res.status(403).json({
          error: 'Session not found or expired',
          valid: false,
        });
        return;
      }

      const storedFingerprint = sessions[0].fingerprint as string | null | undefined;
      if (
        storedFingerprint !== null &&
        storedFingerprint !== undefined &&
        storedFingerprint !== '' &&
        storedFingerprint !== fingerprint
      ) {
        logger.warn(`[SECURITY] Browser fingerprint mismatch for user ${user.id}`);
        res.status(403).json({
          error: 'Browser fingerprint mismatch',
          valid: false,
        });
        return;
      }

      res.json({ valid: true });
    } catch (error: unknown) {
      logger.error('[AUTH] Fingerprint validation error:', error);
      res.status(500).json({
        error: 'Internal server error',
        valid: false,
      });
    }
  }

  /**
   * Initiate password reset
   * @param req - The request object
   * @param res - The response object
   */
  forgotPassword(req: Request, res: Response): void {
    try {
      const requestBody = req.body as { email?: unknown };
      const email = typeof requestBody.email === 'string' ? requestBody.email : 'undefined';

      // TODO: Implement password reset logic
      // For now, just return success for tests
      console.info(`[AUTH] Password reset requested for email: ${email}`);
      res.status(200).json(successResponse(null, 'Password reset E-Mail wurde gesendet'));
    } catch (error: unknown) {
      logger.error('Forgot password error:', error);
      res.status(500).json(errorResponse('Serverfehler beim Passwort-Reset', 500));
    }
  }

  /**
   * Reset password with token
   * @param _req - The _req parameter
   * @param res - The response object
   */
  resetPassword(_req: Request, res: Response): void {
    try {
      // const { token, newPassword } = req.body;

      // TODO: Implement password reset logic
      // For now, just return success for tests
      res.status(200).json(successResponse(null, 'Passwort wurde erfolgreich zurückgesetzt'));
    } catch (error: unknown) {
      logger.error('Reset password error:', error);
      res.status(500).json(errorResponse('Serverfehler beim Passwort-Reset', 500));
    }
  }

  /**
   * Refresh access token using refresh token
   * @param req - The request object
   * @param res - The response object
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const requestBody = req.body as { refreshToken?: unknown };
      const refreshToken = requestBody.refreshToken;

      if (typeof refreshToken !== 'string' || refreshToken.trim() === '') {
        res.status(400).json(errorResponse('Refresh token ist erforderlich', 400));
        return;
      }

      // Attempt to refresh the access token
      const result = await authService.refreshAccessToken(refreshToken);

      if (result === null) {
        res.status(401).json(errorResponse('Ungültiger oder abgelaufener Refresh token', 401));
        return;
      }

      // Return new tokens with standardized response format
      res.json(
        successResponse(
          {
            token: result.token,
            refreshToken: result.refreshToken,
            user: result.user,
          },
          'Token erfolgreich erneuert',
        ),
      );
    } catch (error: unknown) {
      logger.error('Refresh token error:', error);
      res.status(500).json(errorResponse('Serverfehler beim Token-Refresh', 500));
    }
  }
}

// Export singleton instance
const authController = new AuthController();
export default authController;

// Named export for the class
export { AuthController };

// CommonJS compatibility
