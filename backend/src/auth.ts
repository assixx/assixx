/**
 * Vereinheitlichte Authentifizierungsbibliothek
 *
 * Diese Datei stellt alle Authentifizierungsfunktionen für die gesamte Anwendung bereit.
 * Sie ersetzt sowohl auth.js als auch middleware/auth.js, um Inkonsistenzen zu vermeiden.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import userModel from './models/user';
import type { DbUser } from './models/user';
import { DatabaseUser } from './types';
import { TokenPayload, TokenValidationResult } from './types/auth.types';
import { AuthUser, AuthenticatedRequest } from './types/request.types';
import { RowDataPacket, query as executeQuery } from './utils/db';
import { normalizeMySQLBoolean } from './utils/typeHelpers';

// Konstante für das JWT-Secret aus der Umgebungsvariable
const JWT_SECRET: string = process.env.JWT_SECRET ?? '';

// Konstante für Session-Expired Redirect
const SESSION_EXPIRED_REDIRECT = '/login?session=expired';

// In Produktion MUSS ein JWT_SECRET gesetzt sein
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production and be at least 32 characters long!');
  } else {
    console.warn('⚠️  WARNING: Using insecure default JWT_SECRET for development only!');
  }
}

// Import DbUser type from user model

// Helper function to convert DbUser to DatabaseUser
function dbUserToDatabaseUser(dbUser: DbUser): DatabaseUser {
  return {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    password_hash: dbUser.password,
    first_name: dbUser.first_name,
    last_name: dbUser.last_name,
    role: dbUser.role as 'admin' | 'employee' | 'root',
    tenant_id: dbUser.tenant_id ?? null,
    department_id: dbUser.department_id ?? null,
    is_active: normalizeMySQLBoolean(dbUser.is_active),
    is_archived: normalizeMySQLBoolean(dbUser.is_archived),
    profile_picture: dbUser.profile_picture ?? null,
    phone_number: dbUser.phone ?? null,
    landline: dbUser.landline ?? null,
    employee_number: dbUser.employee_number ?? '',
    position: dbUser.position ?? null,
    hire_date: dbUser.hire_date ?? null,
    birth_date: dbUser.birthday ?? null,
    created_at: dbUser.created_at ?? new Date(),
    updated_at: dbUser.updated_at ?? new Date(),
  };
}

/**
 * Benutzerauthentifizierung mit Benutzername/E-Mail und Passwort
 */
export interface AuthUserResult {
  user: DatabaseUser | null;
  error?: 'USER_NOT_FOUND' | 'INVALID_PASSWORD' | 'USER_INACTIVE';
}

export async function authenticateUser(
  usernameOrEmail: string,
  password: string,
): Promise<AuthUserResult> {
  console.info('[DEBUG] authenticateUser called with:', usernameOrEmail);
  try {
    // Try to find user by username first
    console.info('[DEBUG] Looking up user by username...');
    let user = await userModel.findByUsername(usernameOrEmail);

    // If not found by username, try by email
    if (!user) {
      console.info('[DEBUG] Not found by username, trying email...');
      user = await userModel.findByEmail(usernameOrEmail);
      if (user) {
        console.info('[DEBUG] User found by email:', user.email);
      }
    }

    if (!user) {
      console.info('[DEBUG] User not found');
      return { user: null, error: 'USER_NOT_FOUND' };
    }

    console.info(
      '[DEBUG] User found:',
      user.username,
      'tenant_id:',
      user.tenant_id,
      'is_active:',
      user.is_active,
    );
    const isValid = await bcrypt.compare(password, user.password);
    console.info('[DEBUG] Password comparison result:', isValid);
    if (isValid) {
      // Check if user is active
      if (user.is_active === false) {
        console.info('[DEBUG] User is inactive, denying access');
        return { user: null, error: 'USER_INACTIVE' };
      }
      return { user: dbUserToDatabaseUser(user) };
    } else {
      return { user: null, error: 'INVALID_PASSWORD' };
    }
  } catch (error: unknown) {
    console.error('Error during authentication for user', usernameOrEmail, ':', error);
    throw error;
  }
}

/**
 * Token-Generierung für authentifizierte Benutzer
 */
export function generateToken(
  user: DatabaseUser,
  fingerprint?: string,
  sessionId?: string,
): string {
  try {
    const payload: TokenPayload = {
      id: Number.parseInt(user.id.toString(), 10), // Ensure ID is a number
      username: user.username,
      role: user.role,
      tenant_id:
        user.tenant_id !== null && user.tenant_id !== 0 ?
          Number.parseInt(user.tenant_id.toString(), 10)
        : null,
      fingerprint: fingerprint, // Browser fingerprint
      sessionId:
        sessionId ?? `sess_${Date.now().toString()}_${crypto.randomBytes(16).toString('hex')}`, // Cryptographically secure session ID
    };

    // 30 Minuten

    return jwt.sign(payload, JWT_SECRET, { expiresIn: '30m' });
  } catch (error: unknown) {
    console.error(`Error generating token for user ${user.username}:`, error);
    throw error;
  }
}

/**
 * Middleware zur Token-Authentifizierung
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  // Try to get token from Authorization header first
  let token = authHeader?.split(' ')[1];

  // Cookie-Fallback für HTML-Seiten und Server-Side Rendering
  // WICHTIG: Cookies verwenden SameSite=strict für CSRF-Schutz
  // Dies ist sicher, da:
  // 1. SameSite=strict verhindert Cross-Site-Requests komplett
  // 2. Cookies sind httpOnly (kein JS-Zugriff möglich)
  // 3. Primär für direkte Seitenzugriffe gedacht (nicht API-Calls)
  // Siehe README.md für vollständige Sicherheitsdokumentation
  if (
    (token === undefined || token === '') &&
    'token' in req.cookies &&
    typeof req.cookies.token === 'string' &&
    req.cookies.token !== ''
  ) {
    token = req.cookies.token;
  }

  // Debug logging
  console.info('Auth check - Path:', req.path);
  console.info('Auth check - Headers:', req.headers);
  console.info('Auth check - Cookies:', req.cookies);
  console.info('Auth check - Token found:', token !== undefined && token !== '');

  if (token === undefined || token === '') {
    // Check if client expects HTML (browser page request) or JSON (API request)
    const acceptHeader = req.headers.accept ?? '';
    if (acceptHeader.includes('text/html')) {
      // Browser request - redirect to login
      res.redirect(SESSION_EXPIRED_REDIRECT);
    } else {
      // API request - return JSON error
      res.status(401).json({ error: 'Authentication token required' });
    }
    return;
  }

  try {
    const decoded = await new Promise<jwt.JwtPayload>((resolve, reject) => {
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err !== null) {
          reject(err);
        } else if (decoded === undefined || typeof decoded === 'string') {
          reject(new Error('Invalid token payload'));
        } else {
          resolve(decoded);
        }
      });
    });

    const user = decoded as TokenPayload & {
      activeRole?: string;
      isRoleSwitched?: boolean;
    };

    // Best Practice Session Security (wie Google, Facebook, etc.)
    if (user.sessionId !== undefined && user.sessionId !== '') {
      try {
        // Track wichtige Security-Events, aber blockiere nicht bei normalen Änderungen
        const requestFingerprint = req.headers['x-browser-fingerprint'] as string;
        // const requestIP = req.ip  ?? req.connection.remoteAddress;
        // const userAgent = req.headers['user-agent'];

        // Log Security-relevante Änderungen für Monitoring
        if (user.fingerprint && requestFingerprint && requestFingerprint !== user.fingerprint) {
          console.info(
            `[SECURITY-INFO] Fingerprint change for user ${user.id} - likely browser/system update`,
          );

          // Nur bei verdächtigen Mustern warnen/blockieren:
          // - Mehrere Sessions gleichzeitig von verschiedenen Ländern
          // - Rapid fingerprint changes (> 10 pro Stunde)
          // - Known malicious patterns

          // Für jetzt: Nur loggen, nicht blockieren
        }

        // Optionally validate session in database
        if (process.env.VALIDATE_SESSIONS === 'true') {
          const [sessions] = await executeQuery<RowDataPacket[]>(
            'SELECT fingerprint FROM user_sessions WHERE user_id = ? AND session_id = ? AND expires_at > NOW()',
            [user.id, user.sessionId],
          );

          if (sessions.length === 0) {
            // Check if client expects HTML (browser page request) or JSON (API request)
            const acceptHeader = req.headers.accept ?? '';
            if (acceptHeader.includes('text/html')) {
              // Browser request - redirect to login with session expired message
              res.redirect(SESSION_EXPIRED_REDIRECT);
            } else {
              // API request - return JSON error
              res.status(403).json({
                error: 'Session expired or not found',
              });
            }
            return;
          }
        }
      } catch (error: unknown) {
        console.error('[AUTH] Session validation error:', error);
        // Continue anyway in case of database issues
      }
    }

    // Normalize user object for consistency and ensure IDs are numbers
    const authenticatedUser: AuthUser & {
      activeRole?: string;
      isRoleSwitched?: boolean;
    } = {
      id: Number.parseInt(user.id.toString(), 10),
      userId: Number.parseInt(user.id.toString(), 10),
      username: user.username,
      email: '', // Will be filled from database if needed
      first_name: '',
      last_name: '',
      role: user.role,
      activeRole: user.activeRole ?? user.role, // Support für Dual-Role
      isRoleSwitched: user.isRoleSwitched ?? false,
      tenant_id:
        user.tenant_id ? Number.parseInt(user.tenant_id.toString(), 10)
        : user.tenantId ? Number.parseInt(user.tenantId.toString(), 10)
        : 0,
      department_id: null,
      position: null,
    };

    // Use local reference to avoid race condition
    const currentReq = req;
    currentReq.user = authenticatedUser;
    // Set tenant_id directly on req for backwards compatibility
    (currentReq as Request & { tenant_id: number }).tenant_id = authenticatedUser.tenant_id;
    next();
  } catch (error) {
    // Check if client expects HTML (browser page request) or JSON (API request)
    const acceptHeader = req.headers.accept ?? '';
    if (acceptHeader.includes('text/html')) {
      // Browser request - redirect to login with expired session message
      res.redirect(SESSION_EXPIRED_REDIRECT);
    } else {
      // API request - return JSON error
      res.status(403).json({
        error: 'Invalid or expired token',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return;
  }
}

/**
 * Middleware zur Rollenbasierte Autorisierung
 */
export function authorizeRole(role: 'admin' | 'employee' | 'root') {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user exists on request (might not be authenticated yet)
    if (!('user' in req) || !req.user) {
      // Check if client expects HTML (browser page request) or JSON (API request)
      const acceptHeader = req.headers.accept ?? '';
      if (acceptHeader.includes('text/html')) {
        // Browser request - redirect to login
        res.redirect('/login?session=expired');
      } else {
        // API request - return JSON error
        res.status(401).json({ error: 'Authentication required' });
      }
      return;
    }

    // Now we know user exists, cast to AuthenticatedRequest
    const authReq = req as AuthenticatedRequest;
    const userRole: string = authReq.user.role;

    // Root hat Zugriff auf alles
    if (userRole === 'root') {
      next();
      return;
    }

    // Admin hat Zugriff auf Admin- und Employee-Ressourcen
    if (userRole === 'admin' && (role === 'admin' || role === 'employee')) {
      next();
      return;
    }

    // Genauer Rollen-Match
    if (userRole === role) {
      next();
      return;
    }

    // Check if client expects HTML (browser page request) or JSON (API request)
    const acceptHeader = req.headers.accept ?? '';
    if (acceptHeader.includes('text/html')) {
      // Browser request - redirect to appropriate dashboard based on role
      const dashboardMap: Record<string, string> = {
        employee: '/employee-dashboard',
        admin: '/admin-dashboard',
        root: '/root-dashboard',
      };
      // Validate userRole is a valid key to prevent object injection
      let redirectPath = '/login';
      if (userRole === 'employee') {
        redirectPath = dashboardMap.employee;
      } else if (userRole === 'admin') {
        redirectPath = dashboardMap.admin;
      } else if (userRole === 'root') {
        redirectPath = dashboardMap.root;
      }
      res.redirect(`${redirectPath}?error=unauthorized`);
    } else {
      // API request - return JSON error
      res.status(403).json({ error: 'Unauthorized - insufficient permissions' });
    }
  };
}

/**
 * Token-Validierung ohne Middleware-Kontext
 * Nützlich für Tests und andere nicht-Express-Kontexte
 */
export function validateToken(token: string): TokenValidationResult {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return {
      valid: true,
      user: decoded,
    };
  } catch (error: unknown) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export for backwards compatibility
export { JWT_SECRET };
