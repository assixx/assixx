/**
 * Auth Service
 *
 * Handles authentication business logic:
 * - Login (validate credentials, generate tokens)
 * - Logout (revoke tokens)
 * - Token refresh with rotation
 * - User registration
 *
 * Security Features:
 * - Refresh Token Rotation (new token on every refresh)
 * - Reuse Detection (revoke family on reuse)
 * - Token Family tracking
 * - SHA-256 token hashing (never store raw tokens)
 */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcryptjs from 'bcryptjs';
import crypto from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';

import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  LoginDto,
  LoginResponse,
  RefreshDto,
  RefreshResponse,
  RegisterDto,
} from './dto/index.js';

/**
 * Token configuration
 * Matches existing token.config.ts values
 * Using seconds for expiresIn to avoid type issues with JwtService
 */
const TOKEN_CONFIG = {
  /** Access token expiry in seconds (30 minutes) */
  accessExpirySeconds: 30 * 60,
  /** Refresh token expiry in seconds (7 days) */
  refreshExpirySeconds: 7 * 24 * 60 * 60,
} as const;

/**
 * JWT secrets from environment
 * SECURITY: No fallback defaults - must be set in environment
 */
function getJwtSecrets(): { access: string; refresh: string } {
  const accessSecret = process.env['JWT_SECRET'];
  if (accessSecret === undefined || accessSecret === '' || accessSecret.length < 32) {
    throw new Error(
      'SECURITY ERROR: JWT_SECRET must be set and at least 32 characters. ' +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    );
  }

  // JWT_REFRESH_SECRET MUST be different from JWT_SECRET for security
  // SECURITY: No fallback - must be explicitly set
  const refreshSecret = process.env['JWT_REFRESH_SECRET'];
  if (refreshSecret === undefined || refreshSecret === '' || refreshSecret.length < 32) {
    throw new Error(
      'SECURITY ERROR: JWT_REFRESH_SECRET must be set and at least 32 characters. ' +
        'It MUST be different from JWT_SECRET for proper token isolation. ' +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    );
  }

  // Ensure refresh secret is different from access secret
  if (refreshSecret === accessSecret) {
    throw new Error(
      'SECURITY ERROR: JWT_REFRESH_SECRET must be different from JWT_SECRET. ' +
        'Using the same secret for both defeats the purpose of token isolation.',
    );
  }

  return { access: accessSecret, refresh: refreshSecret };
}

const JWT_SECRETS = getJwtSecrets();
const JWT_SECRET = JWT_SECRETS.access;
const JWT_REFRESH_SECRET = JWT_SECRETS.refresh;

/**
 * Database row types
 */
interface UserRow {
  id: number;
  tenant_id: number;
  email: string;
  password: string;
  role: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  is_active: number;
  last_login: Date | null;
  created_at: Date;
}

interface RefreshTokenRow {
  id: number;
  user_id: number;
  tenant_id: number;
  token_hash: string;
  token_family: string;
  expires_at: Date;
  is_revoked: boolean;
  used_at: Date | null;
  replaced_by_hash: string | null;
}

/**
 * JWT payload structure
 */
interface JwtPayload {
  id: number;
  email: string;
  role: string;
  tenantId: number;
  type: 'access' | 'refresh';
  family?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Authenticate user with email and password
   */
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { email, password } = dto;

    // Find user by email
    const user = await this.findUserByEmail(email);
    if (user === null) {
      throw new UnauthorizedException('E-Mail oder Passwort falsch');
    }

    // Check if user is active
    if (user.is_active !== 1) {
      throw new ForbiddenException('Ihr Account ist nicht aktiv');
    }

    // Validate password
    const isValidPassword = await bcryptjs.compare(password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedException('E-Mail oder Passwort falsch');
    }

    // Generate tokens with rotation
    const tokens = await this.generateTokensWithRotation(
      user.id,
      user.tenant_id,
      user.role,
      user.email,
      undefined, // New family on login
      ipAddress,
      userAgent,
    );

    // Update last login
    await this.updateLastLogin(user.id, user.tenant_id);

    // Log login for audit
    await this.logLoginAudit(user, ipAddress, userAgent);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.buildSafeUserResponse(user),
    };
  }

  /**
   * Register a new user (admin/root only)
   */
  async register(dto: RegisterDto, authUser: NestAuthUser): Promise<UserRow> {
    // Only admin and root can create users
    if (authUser.activeRole !== 'admin' && authUser.activeRole !== 'root') {
      throw new ForbiddenException('Only administrators can create users');
    }

    // Check if email already exists
    const existingUser = await this.findUserByEmail(dto.email);
    if (existingUser !== null) {
      throw new ConflictException('A user with this email already exists');
    }

    // Generate username from email
    const username = dto.email.split('@')[0];
    if (username === undefined || username === '') {
      throw new UnauthorizedException('Invalid email format');
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(dto.password, 12);

    // Create user in transaction
    const userId = await this.createUser({
      tenantId: authUser.tenantId,
      username,
      email: dto.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
    });

    // Fetch and return created user
    const newUser = await this.findUserById(userId, authUser.tenantId);
    if (newUser === null) {
      throw new InternalServerErrorException('Failed to retrieve created user');
    }

    return newUser;
  }

  /**
   * Logout user - revoke all refresh tokens
   */
  async logout(user: NestAuthUser): Promise<{ tokensRevoked: number }> {
    const revokedCount = await this.revokeAllUserTokens(user.id, user.tenantId);

    this.logger.log(`Logout: Revoked ${revokedCount} refresh tokens for user ${user.id}`);

    return { tokensRevoked: revokedCount };
  }

  /**
   * Refresh access token with rotation
   */
  async refresh(dto: RefreshDto, ipAddress?: string, userAgent?: string): Promise<RefreshResponse> {
    const { refreshToken } = dto;

    // Step 1: Verify JWT signature and type
    const decoded = this.verifyRefreshJwt(refreshToken);

    // Step 2: Check for token reuse (SECURITY)
    const tokenHash = this.hashToken(refreshToken);
    const isReuse = await this.isTokenAlreadyUsed(tokenHash, decoded);
    if (isReuse) {
      throw new UnauthorizedException(
        'Security alert: Token reuse detected. All sessions revoked. Please login again.',
      );
    }

    // Step 3: Validate token in DB and perform rotation
    const storedToken = await this.findValidRefreshToken(tokenHash);
    return await this.performTokenRotation(decoded, tokenHash, storedToken, ipAddress, userAgent);
  }

  /**
   * Get current user information
   */
  async getCurrentUser(user: NestAuthUser): Promise<UserRow> {
    const foundUser = await this.findUserById(user.id, user.tenantId);
    if (foundUser === null) {
      throw new NotFoundException('User not found');
    }

    return foundUser;
  }

  /**
   * Verify token is valid (for /verify endpoint)
   */
  verifyToken(user: NestAuthUser): { valid: boolean; user: Partial<NestAuthUser> } {
    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
      },
    };
  }

  // ============================================
  // Token Methods
  // ============================================

  /**
   * Generate access and refresh tokens with rotation support
   */
  private async generateTokensWithRotation(
    userId: number,
    tenantId: number,
    role: string,
    email: string,
    tokenFamily?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Access token
    const accessToken = this.jwtService.sign(
      {
        id: userId,
        email,
        role,
        tenantId,
        type: 'access' as const,
      },
      {
        secret: JWT_SECRET,
        expiresIn: TOKEN_CONFIG.accessExpirySeconds,
      },
    );

    // Generate or reuse token family
    const family = tokenFamily ?? crypto.randomUUID();

    // Refresh token WITH family for rotation tracking
    const refreshToken = this.jwtService.sign(
      {
        id: userId,
        email,
        role,
        tenantId,
        type: 'refresh' as const,
        family,
      },
      {
        secret: JWT_REFRESH_SECRET,
        expiresIn: TOKEN_CONFIG.refreshExpirySeconds,
      },
    );

    // Store token hash in DB
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + TOKEN_CONFIG.refreshExpirySeconds * 1000);

    await this.storeRefreshToken(
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

  /**
   * Verify refresh token JWT
   */
  private verifyRefreshJwt(token: string): JwtPayload {
    try {
      const decoded = this.jwtService.verify<JwtPayload>(token, {
        secret: JWT_REFRESH_SECRET,
      });

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Not a refresh token');
      }

      return decoded;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const isExpired = error instanceof Error && error.name === 'TokenExpiredError';
      throw new UnauthorizedException(
        isExpired ? 'Refresh token has expired' : 'Invalid refresh token',
      );
    }
  }

  /**
   * Perform token rotation
   */
  private async performTokenRotation(
    decoded: JwtPayload,
    oldTokenHash: string,
    storedToken: RefreshTokenRow | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Use existing family if token was in DB
    const family = storedToken !== null ? decoded.family : undefined;

    if (storedToken === null) {
      this.logger.warn(`Token not found in DB for user ${decoded.id} - may be pre-rotation token`);
    }

    const tokens = await this.generateTokensWithRotation(
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
      const newTokenHash = this.hashToken(tokens.refreshToken);
      await this.markTokenAsUsed(oldTokenHash, newTokenHash);
    }

    this.logger.debug(`Token rotated for user ${decoded.id}`);
    return tokens;
  }

  /**
   * Hash a token using SHA-256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // ============================================
  // Database Methods
  // ============================================

  /**
   * Find user by email
   */
  private async findUserByEmail(email: string): Promise<UserRow | null> {
    const rows = await this.databaseService.query<UserRow>(
      `SELECT id, tenant_id, email, password, role, username, first_name, last_name,
              is_active, last_login, created_at
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()],
    );

    return rows[0] ?? null;
  }

  /**
   * Find user by ID
   */
  private async findUserById(userId: number, tenantId: number): Promise<UserRow | null> {
    const rows = await this.databaseService.query<UserRow>(
      `SELECT id, tenant_id, email, password, role, username, first_name, last_name,
              is_active, last_login, created_at
       FROM users
       WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    return rows[0] ?? null;
  }

  /**
   * Create a new user
   */
  private async createUser(data: {
    tenantId: number;
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
  }): Promise<number> {
    const userUuid = uuidv7();
    const rows = await this.databaseService.query<{ id: number }>(
      `INSERT INTO users (tenant_id, username, email, password, first_name, last_name, role, is_active, uuid, uuid_created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, NOW())
       RETURNING id`,
      [
        data.tenantId,
        data.username,
        data.email,
        data.password,
        data.firstName,
        data.lastName,
        data.role,
        userUuid,
      ],
    );

    const row = rows[0];
    if (row === undefined) {
      throw new InternalServerErrorException('Failed to create user');
    }

    return row.id;
  }

  /**
   * Update last login timestamp
   */
  private async updateLastLogin(userId: number, tenantId: number): Promise<void> {
    await this.databaseService.query(
      `UPDATE users SET last_login = NOW() WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(
    tokenHash: string,
    userId: number,
    tenantId: number,
    tokenFamily: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.databaseService.query(
      `INSERT INTO refresh_tokens
       (token_hash, user_id, tenant_id, token_family, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tokenHash, userId, tenantId, tokenFamily, expiresAt, ipAddress ?? null, userAgent ?? null],
    );

    this.logger.debug(`Stored new token for user ${userId} in family ${tokenFamily}`);
  }

  /**
   * Find valid refresh token by hash
   */
  private async findValidRefreshToken(tokenHash: string): Promise<RefreshTokenRow | null> {
    const rows = await this.databaseService.query<RefreshTokenRow>(
      `SELECT id, user_id, tenant_id, token_hash, token_family, expires_at, is_revoked, used_at, replaced_by_hash
       FROM refresh_tokens
       WHERE token_hash = $1 AND is_revoked = false AND expires_at > NOW()`,
      [tokenHash],
    );

    return rows[0] ?? null;
  }

  /**
   * Check if token was already used (reuse detection)
   */
  private async isTokenAlreadyUsed(tokenHash: string, decoded: JwtPayload): Promise<boolean> {
    const rows = await this.databaseService.query<{ used_at: Date | null }>(
      `SELECT used_at FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash],
    );

    // No token found in DB - not a reuse case
    if (rows.length === 0) {
      return false;
    }

    const token = rows[0];
    if (token !== undefined && token.used_at !== null) {
      // SECURITY ALERT: Token reuse detected!
      this.logger.warn(
        `SECURITY: Token reuse detected for user ${decoded.id}! Revoking entire family.`,
      );

      if (decoded.family !== undefined) {
        await this.revokeTokenFamily(decoded.family);
      }
      return true;
    }

    return false;
  }

  /**
   * Mark token as used and link to replacement
   */
  private async markTokenAsUsed(tokenHash: string, replacementHash: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE refresh_tokens
       SET used_at = NOW(), replaced_by_hash = $2
       WHERE token_hash = $1`,
      [tokenHash, replacementHash],
    );

    this.logger.debug(`Marked token as used, replaced by ${replacementHash.slice(0, 8)}...`);
  }

  /**
   * Revoke all tokens in a family
   */
  private async revokeTokenFamily(tokenFamily: string): Promise<number> {
    const result = await this.databaseService.query<{ count: string }>(
      `WITH updated AS (
         UPDATE refresh_tokens SET is_revoked = true WHERE token_family = $1 RETURNING 1
       )
       SELECT COUNT(*) as count FROM updated`,
      [tokenFamily],
    );

    const count = Number.parseInt(result[0]?.count ?? '0', 10);
    this.logger.warn(`SECURITY: Revoked ${count} tokens in family ${tokenFamily}`);
    return count;
  }

  /**
   * Revoke all tokens for a user
   */
  private async revokeAllUserTokens(userId: number, tenantId: number): Promise<number> {
    const result = await this.databaseService.query<{ count: string }>(
      `WITH updated AS (
         UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND tenant_id = $2 RETURNING 1
       )
       SELECT COUNT(*) as count FROM updated`,
      [userId, tenantId],
    );

    const count = Number.parseInt(result[0]?.count ?? '0', 10);
    this.logger.log(`Revoked ${count} tokens for user ${userId}`);
    return count;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Build safe user response (without sensitive data)
   */
  private buildSafeUserResponse(user: UserRow): LoginResponse['user'] {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name ?? undefined,
      lastName: user.last_name ?? undefined,
      role: user.role,
      tenantId: user.tenant_id,
    };
  }

  /**
   * Log login for audit trail
   */
  private async logLoginAudit(
    user: UserRow,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.databaseService.query(
        `INSERT INTO root_logs
         (tenant_id, user_id, action, entity_type, entity_id, details, new_values, ip_address, user_agent, was_role_switched)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          user.tenant_id,
          user.id,
          'login',
          'auth',
          user.id,
          `Angemeldet als ${user.role}`,
          JSON.stringify({
            email: user.email,
            role: user.role,
            login_method: 'password',
          }),
          ipAddress ?? null,
          userAgent ?? null,
          false,
        ],
      );
    } catch (error: unknown) {
      // Don't fail login if audit log fails
      this.logger.warn('Failed to log login audit', error);
    }
  }
}
