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
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcryptjs from 'bcryptjs';
import { ClsService } from 'nestjs-cls';
import crypto from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';

import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { MailerService } from '../common/services/mailer.service.js';
import { DatabaseService } from '../database/database.service.js';
import { TenantVerificationService } from '../domains/tenant-verification.service.js';
import type {
  ForgotPasswordDto,
  LoginDto,
  LoginResponse,
  RefreshDto,
  RefreshResponse,
  RegisterDto,
  ResetPasswordDto,
  SendPasswordResetLinkResponse,
} from './dto/index.js';

/**
 * Internal return shape of `forgotPassword()` — consumed by the controller
 * to decide the additive HTTP body (ADR-051 §2.1 / §2.2, Plan v0.4.4).
 *
 * - `blocked = true`  → user exists, is active, but role !== 'root'. Blocked-mail
 *   has been sent; controller adds `blocked: true, reason: 'ROLE_NOT_ALLOWED'`
 *   to the JSON body.
 * - `blocked = false, delivered = false` → silent-drop (non-existent or
 *   inactive user). No mail, no token. Preserves R1 enumeration contract.
 * - `blocked = false, delivered = true`  → root happy-path. Reset mail sent.
 */
export interface ForgotPasswordResult {
  readonly blocked: boolean;
  readonly delivered: boolean;
}

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
    private readonly mailer: MailerService,
    // Step 2.9 + D33 Option (a): assertVerified at top of `createUser(data)`
    // (the AST-enclosing helper of `INSERT INTO users`, private, no bootstrap
    // path reaches it — sole caller `register(dto, authUser: NestAuthUser)`
    // enforces authenticated context via the type signature).
    private readonly tenantVerification: TenantVerificationService,
    // ADR-051: CLS supplies IP + User-Agent for the blocked-reset notification
    // meta-block and for `logger.warn()` context on both gates. Populated in
    // `app.module.ts` ClsModule.forRoot setup; trusts `trustProxy: true` at
    // main.ts:284 so `req.ip` is the client (not Nginx egress).
    private readonly cls: ClsService,
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

    // Log login for audit (default method 'password')
    await this.logLoginAudit(user, ipAddress, userAgent);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.buildSafeUserResponse(user),
    };
  }

  /**
   * Issue session tokens for a user whose identity has ALREADY been verified
   * by an external mechanism (e.g. OAuth id_token signature + claims validation).
   *
   * Skips password check — the caller MUST guarantee authentication happened
   * before invoking this. Currently called by `OAuthController` after a
   * successful Microsoft OAuth login (plan §2.5 / §2.6).
   *
   * Reuses the same token-rotation machinery as `login()`, writes the same
   * audit row, updates the same `last_login` column. The only difference is
   * the `loginMethod` string that appears in the audit `new_values` JSON and
   * the absence of a bcrypt.compare step.
   */
  async loginWithVerifiedUser(
    userId: number,
    tenantId: number,
    loginMethod: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponse> {
    const user = await this.findUserById(userId, tenantId);
    if (user === null) {
      throw new UnauthorizedException('User not found');
    }
    if (user.is_active !== 1) {
      throw new ForbiddenException('Ihr Account ist nicht aktiv');
    }

    const tokens = await this.generateTokensWithRotation(
      user.id,
      user.tenant_id,
      user.role,
      user.email,
      undefined, // new family on every login, even OAuth
      ipAddress,
      userAgent,
    );

    await this.updateLastLogin(user.id, user.tenant_id);
    await this.logLoginAudit(user, ipAddress, userAgent, loginMethod);

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
  async logout(
    user: NestAuthUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ tokensRevoked: number }> {
    const revokedCount = await this.revokeAllUserTokens(user.id, user.tenantId);

    this.logger.log(`Logout: Revoked ${revokedCount} refresh tokens for user ${user.id}`);

    // Log logout for audit trail
    await this.logLogoutAudit(user, ipAddress, userAgent);

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
  verifyToken(user: NestAuthUser): {
    valid: boolean;
    user: Partial<NestAuthUser>;
  } {
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
  // Password Reset Methods
  // ============================================

  /**
   * Request password reset — generates token, sends email.
   *
   * Two-gate defense-in-depth (ADR-051):
   * 1. SILENT DROP (preserved — R1 enumeration contract): non-existent OR
   *    inactive user → `{ blocked: false, delivered: false }`, no side effects.
   * 2. ROLE GATE (new — §2.1): existing active user whose role !== 'root' is
   *    denied. A blocked-notification mail is sent (paper trail for the
   *    account holder), `logger.warn` records context; NO reset token is
   *    generated. `has_full_access` + Lead-positions are intentionally NOT
   *    honored here (§0.2.5 #1 #2 — data-visibility !== auth-self-service).
   * 3. ROOT HAPPY PATH (unchanged): existing code — invalidate old tokens,
   *    issue new token, send reset mail.
   *
   * The complementary redemption gate lives in `resetPassword()` (§2.6) and
   * burns the token if an admin/employee token ever reaches redemption (belt
   * AND suspenders).
   *
   * @see docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md §2.1
   * @see docs/infrastructure/adr/ADR-051-forgot-password-role-gate.md §Decision — Gate 1
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<ForgotPasswordResult> {
    const user = await this.findUserByEmail(dto.email);

    // Gate 1 — Silent drop: covers non-existent AND is_active ∈ {0, 3, 4}.
    // NEVER reveal if the email exists (R1 no-leak contract; §0.2.5 #5).
    if (user?.is_active !== 1) {
      return { blocked: false, delivered: false };
    }

    // Gate 2 — Role check: secure-default. Any value NOT the literal 'root'
    // is blocked (R3). has_full_access + Lead-positions intentionally ignored
    // for auth self-service (§0.2.5 #1 #2).
    if (user.role !== 'root') {
      // Typed as `string | undefined` so the `??` fall-back is type-honest:
      // CLS could be empty at runtime if the middleware setup ever degrades.
      const ip = this.cls.get<string | undefined>('ip') ?? 'unknown';
      const userAgent = this.cls.get<string | undefined>('userAgent') ?? 'unknown';

      // Option A+ (Phase 0 decision): the auto-interceptor writes the
      // audit_trail row (via `isAuthEndpoint()` extension in audit.helpers.ts);
      // block-semantic context (user_id, role, tenant) lives in this warn-log
      // so Grafana/Loki can correlate.
      this.logger.warn(
        `Password-reset BLOCKED for user ${user.id} (role=${user.role}, tenant=${user.tenant_id}) from ${ip}`,
      );

      await this.mailer.sendPasswordResetBlocked(
        {
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
        },
        { ip, userAgent, timestamp: new Date() },
      );

      // Intentionally do NOT burn any pre-existing tokens here — the
      // redemption gate in resetPassword() handles that. Defense-in-depth.
      return { blocked: true, delivered: true };
    }

    // Root happy path — unchanged.

    // Invalidate any existing unused tokens for this user
    await this.databaseService.systemQuery(
      `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false`,
      [user.id],
    );

    // Generate cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes

    // Store hashed token in DB
    await this.databaseService.systemQuery(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at, used)
       VALUES ($1, $2, $3, false)`,
      [user.id, tokenHash, expiresAt],
    );

    // Send reset email — never throws (failure is logged inside MailerService)
    await this.mailer.sendPasswordReset(
      {
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      rawToken,
      expiresAt,
    );

    this.logger.log(`Password reset requested for user ${user.id}`);
    return { blocked: false, delivered: true };
  }

  /**
   * Reset password using token.
   *
   * Redemption gate (ADR-051 §Decision — Gate 2, the "suspenders" to the
   * request-gate's "belt"): even if an admin/employee holds a valid token
   * (pre-existing, leaked, or pre-plan-era), they CANNOT set a new password.
   * The token is burned on block so a retry with the same token is
   * impossible (R9).
   *
   * Gate order:
   * 1. Token validity (existing behaviour — unchanged): 401 if not found /
   *    used / expired.
   * 2. NEW — target lifecycle: if the user was deleted or deactivated after
   *    token issuance, burn the token and 401 (generic, no role leak).
   * 3. NEW — origin-check (`initiated_by_user_id`): admin-initiated tokens
   *    skip the role-gate and run the initiator-lifecycle check
   *    (`enforceRedemptionOriginGate`); self-service tokens (NULL) continue
   *    to the role-gate.
   * 4. NEW — role gate (self-service path only): if target role !== 'root',
   *    burn the token + 403 `ROLE_NOT_ALLOWED`. Explicit `ForbiddenException`
   *    (not 401) — token was valid, this is an AUTHORIZATION failure
   *    (§0.2.5 #4).
   * 5. Root/admin-initiated happy path: hash new password, invalidate token,
   *    revoke refresh-tokens (existing behaviour — unchanged below).
   *
   * @see docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md §2.6 + §2.8
   * @see docs/infrastructure/adr/ADR-051-forgot-password-role-gate.md §Decision — Gate 2
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = this.hashToken(dto.token);

    // Token-row lookup now also carries `initiated_by_user_id` (§2.8 origin-
    // check). NULL = self-service token (§2.6 role-gate applies). NOT NULL =
    // admin-initiated token (initiator-lifecycle check applies instead).
    const rows = await this.databaseService.systemQuery<{
      id: number;
      user_id: number;
      initiated_by_user_id: number | null;
    }>(
      `SELECT id, user_id, initiated_by_user_id FROM password_reset_tokens
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [tokenHash],
    );

    const tokenRow = rows[0];
    if (tokenRow === undefined) {
      throw new UnauthorizedException(
        'Ungültiger oder abgelaufener Link. Bitte fordern Sie einen neuen an.',
      );
    }

    // Redemption gate — re-load the target and check lifecycle before doing
    // anything expensive (bcrypt, writes). Applies to BOTH self-service and
    // admin-initiated tokens: a deleted/deactivated target is always a 401
    // + burn, regardless of how the token was issued.
    const targetUser = await this.findUserById(tokenRow.user_id);
    // Optional chain collapses both "deleted" (`null`) and "inactive"
    // (`is_active !== 1`) into one branch — same semantics, one generic 401,
    // no leak of which condition failed (keeps is_active private).
    if (targetUser?.is_active !== 1) {
      await this.burnToken(tokenRow.id);
      throw new UnauthorizedException(
        'Ungültiger oder abgelaufener Link. Bitte fordern Sie einen neuen an.',
      );
    }

    // §2.8 — branch on token origin. Self-service path enforces the §2.6
    // role-gate; admin-initiated path enforces initiator-lifecycle instead.
    await this.enforceRedemptionOriginGate(tokenRow, targetUser);

    // Happy path — hash new password, UPDATE users, mark token used.

    // Hash new password
    const hashedPassword = await bcryptjs.hash(dto.password, 12);

    // Update password + invalidate token in one transaction
    await this.databaseService.systemQuery(`UPDATE users SET password = $1 WHERE id = $2`, [
      hashedPassword,
      tokenRow.user_id,
    ]);

    await this.databaseService.systemQuery(
      `UPDATE password_reset_tokens SET used = true WHERE id = $1`,
      [tokenRow.id],
    );

    // Revoke all refresh tokens for security (force re-login on all devices)
    await this.revokeAllUserTokensByUserId(tokenRow.user_id);

    this.logger.log(`Password reset completed for user ${tokenRow.user_id}`);
  }

  /**
   * Burn a password-reset token (mark `used = true`) by row id.
   *
   * Used by the §2.6 redemption gate to invalidate tokens that reach
   * redemption for a non-root target (or a target that was deleted/
   * deactivated after issuance). Single-use / irreversible by design —
   * attacker cannot retry with the same raw token.
   *
   * @see docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md §2.6 + §0.2.5 #8
   */
  private async burnToken(tokenRowId: number): Promise<void> {
    await this.databaseService.systemQuery(
      `UPDATE password_reset_tokens SET used = true WHERE id = $1`,
      [tokenRowId],
    );
  }

  /**
   * Enforce the redemption-gate based on token origin (ADR-051 §2.6 + §2.8).
   *
   * - `initiated_by_user_id` NULL → self-service token: require target role = 'root',
   *   otherwise burn + 403 `ROLE_NOT_ALLOWED`.
   * - `initiated_by_user_id` NOT NULL → admin-initiated token: require initiator
   *   is still an active Root in the target's tenant, otherwise burn + generic 401.
   *
   * On success, returns void — caller proceeds to the bcrypt + UPDATE happy path.
   */
  private async enforceRedemptionOriginGate(
    tokenRow: { id: number; user_id: number; initiated_by_user_id: number | null },
    targetUser: UserRow,
  ): Promise<void> {
    if (tokenRow.initiated_by_user_id !== null) {
      // Admin-initiated path — initiator-lifecycle check.
      const initiator = await this.findUserById(tokenRow.initiated_by_user_id);
      const initiatorValid =
        initiator?.is_active === 1 &&
        initiator.role === 'root' &&
        initiator.tenant_id === targetUser.tenant_id;
      if (!initiatorValid) {
        await this.burnToken(tokenRow.id);
        this.logger.warn(
          `Admin-initiated reset-redemption BLOCKED: initiator ` +
            `${tokenRow.initiated_by_user_id} is no longer a valid Root ` +
            `(or tenant drift). Target=${targetUser.id}.`,
        );
        // Generic 401 — do NOT leak initiator-lifecycle details to the
        // token-holder. From their POV, the token is simply invalid.
        throw new UnauthorizedException(
          'Ungültiger oder abgelaufener Link. Bitte fordern Sie einen neuen an.',
        );
      }
      // Initiator check passed — SKIP the §2.6 self-service role-gate.
      // Admin-initiated tokens are issued FOR admin/employee targets by
      // design; blocking them on role would defeat the whole feature.
      return;
    }

    // Self-service path (§2.6): only Root can redeem their own token.
    if (targetUser.role !== 'root') {
      await this.burnToken(tokenRow.id);
      this.logger.warn(
        `Self-service password-reset REDEMPTION BLOCKED for user ${targetUser.id} ` +
          `(role=${targetUser.role}, tenant=${targetUser.tenant_id}) — token burned.`,
      );
      // Object form carries `code: 'ROLE_NOT_ALLOWED'` through the global
      // exception filter into `error.code` on the response body — the
      // machine-readable signal the frontend matches against for the
      // specific "contact your Root" UX (ADR-051 §2.2 mapping table +
      // §5.3 error-toast copy). Throwing with a bare string would be
      // normalized to `error.code: 'FORBIDDEN'`, losing the marker.
      throw new ForbiddenException({
        message:
          'Passwort-Reset nicht erlaubt. Wende Dich an einen Root-Benutzer in Deinem Unternehmen.',
        code: 'ROLE_NOT_ALLOWED',
      });
    }
  }

  /**
   * Issue a password-reset link on behalf of another user (Root → admin/employee).
   *
   * Strict Root-only capability (ADR-051 §Decision — Root-Initiated Reset,
   * §0.2.5 #12 + #13). Complements the self-service block: admin/employee
   * cannot reset themselves, but Root can delegate a reset flow to them on
   * request. Root never sees the new credential — the target clicks the
   * emailed link and sets their own password on the existing
   * `/reset-password` page. Separation of duties.
   *
   * Gates (in order):
   * 1. Target lookup — tenant-scoped via `findUserById(id, initiator.tenantId)`
   *    so cross-tenant attempts return 404 instead of 400.
   * 2. Target-Rule (§0.2.5 #12): Root-on-Root REJECTED (a second Root uses
   *    /forgot-password self-service; prevents Root-takeover chains). Only
   *    `admin` or `employee` targets accepted. Inactive users rejected.
   * 3. Rate-limit per (initiator, target) — 1 / 15 min via DB-check on
   *    `MAX(created_at)` in password_reset_tokens. No Throttler tier change.
   * 4. Issue token identical to §2.1 root-happy-path + `initiated_by_user_id`.
   * 5. Send admin-initiated email (§2.9) naming the initiator Root.
   *
   * @see docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md §2.7
   * @see docs/infrastructure/adr/ADR-051-forgot-password-role-gate.md §Decision — Root-Initiated Reset
   */
  async sendAdminInitiatedResetLink(
    targetUserId: number,
    initiator: NestAuthUser,
  ): Promise<SendPasswordResetLinkResponse> {
    // 1. Tenant-scoped target lookup — fresh DB, never trust JWT payload
    //    for role/is_active (ADR-005). Cross-tenant → null → 404.
    const target = await this.findUserById(targetUserId, initiator.tenantId);
    if (target === null) {
      throw new NotFoundException('Benutzer nicht gefunden.');
    }

    // 2. Target-Rule (§0.2.5 #12) + 3. per-pair rate-limit (§0.3 row).
    this.assertAdminInitiatedTargetAllowed(target);
    await this.assertAdminInitiatedRateLimit(targetUserId, initiator.id);

    // 4. Issue token — identical to §2.1 root-happy-path + initiated_by_user_id.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 min, §0.2.5 #12
    await this.databaseService.systemQuery(
      `INSERT INTO password_reset_tokens
         (user_id, token, expires_at, used, initiated_by_user_id)
       VALUES ($1, $2, $3, false, $4)`,
      [target.id, tokenHash, expiresAt, initiator.id],
    );

    // 5. Send email (§2.9) — names the initiator Root explicitly in the body.
    await this.mailer.sendPasswordResetAdminInitiated(
      { email: target.email, firstName: target.first_name, lastName: target.last_name },
      this.buildInitiatorName(initiator),
      rawToken,
      expiresAt,
    );

    this.logger.warn(
      `Admin-initiated password-reset-link issued by root ${initiator.id} ` +
        `(tenant=${initiator.tenantId}) for target ${target.id} (role=${target.role}).`,
    );

    return { message: `E-Mail gesendet an ${target.email}` };
  }

  /**
   * Target-Rule (§0.2.5 #12): admin/employee only, same tenant, active.
   * Root-on-Root REJECTED to prevent Root-takeover chains.
   */
  private assertAdminInitiatedTargetAllowed(target: UserRow): void {
    if (target.role === 'root') {
      throw new BadRequestException({
        message:
          'Root-Benutzer können keinen Passwort-Reset-Link für andere Root-Benutzer anfordern. Andere Root-Benutzer nutzen /forgot-password selbst.',
        code: 'INVALID_TARGET_ROLE',
      });
    }
    if (target.role !== 'admin' && target.role !== 'employee') {
      throw new BadRequestException({
        message: 'Ungültige Zielrolle.',
        code: 'INVALID_TARGET_ROLE',
      });
    }
    if (target.is_active !== 1) {
      throw new BadRequestException({
        message: 'Zielbenutzer ist nicht aktiv.',
        code: 'INACTIVE_TARGET',
      });
    }
  }

  /**
   * Per-pair rate-limit: 1 request / 15 min per (initiator Root, target user).
   * DB-check on `MAX(created_at)` in password_reset_tokens — accurate per-pair
   * scoping without Redis-infra change / new Throttler tier (§0.3 row).
   */
  private async assertAdminInitiatedRateLimit(
    targetUserId: number,
    initiatorUserId: number,
  ): Promise<void> {
    const recent = await this.databaseService.systemQuery<{ created_at: Date }>(
      `SELECT created_at FROM password_reset_tokens
       WHERE user_id = $1 AND initiated_by_user_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [targetUserId, initiatorUserId],
    );
    const lastIssued = recent[0];
    if (lastIssued !== undefined && Date.now() - lastIssued.created_at.getTime() < 15 * 60 * 1000) {
      throw new HttpException(
        {
          message: 'Bitte warte 15 Minuten, bevor Du erneut einen Link anforderst.',
          code: 'RATE_LIMIT',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Build a display name for the initiator Root shown in the admin-initiated
   * reset email template. Falls back to email if no name fields are set
   * (BaseAuthUser.firstName/lastName are optional per @assixx/shared).
   */
  private buildInitiatorName(initiator: NestAuthUser): string {
    const first = initiator.firstName ?? '';
    const last = initiator.lastName ?? '';
    const full = `${first} ${last}`.trim();
    return full !== '' ? full : initiator.email;
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
    const rows = await this.databaseService.systemQuery<UserRow>(
      `SELECT id, tenant_id, email, password, role, username, first_name, last_name,
              is_active, last_login, created_at
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()],
    );

    return rows[0] ?? null;
  }

  /**
   * Find user by ID (with tenant scope)
   */
  private async findUserById(userId: number, tenantId?: number): Promise<UserRow | null> {
    const query =
      tenantId !== undefined ?
        `SELECT id, tenant_id, email, password, role, username, first_name, last_name,
                is_active, last_login, created_at
           FROM users WHERE id = $1 AND tenant_id = $2`
      : `SELECT id, tenant_id, email, password, role, username, first_name, last_name,
                is_active, last_login, created_at
           FROM users WHERE id = $1`;
    const params = tenantId !== undefined ? [userId, tenantId] : [userId];
    const rows = await this.databaseService.systemQuery<UserRow>(query, params);

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
    // KISS gate (§2.9 + §0.2.5 #1 + D33 Option a): helper-entry assertion.
    // Sole caller `register(dto, authUser: NestAuthUser)` enforces auth'd
    // context via type signature — no bootstrap path reaches `createUser`.
    // Arch-test (§2.11, regex `INSERT INTO users\b`) locks the invariant.
    await this.tenantVerification.assertVerified(data.tenantId);
    const userUuid = uuidv7();
    const rows = await this.databaseService.systemQuery<{ id: number }>(
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
    await this.databaseService.systemQuery(
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
    await this.databaseService.systemQuery(
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
    const rows = await this.databaseService.systemQuery<RefreshTokenRow>(
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
    const rows = await this.databaseService.systemQuery<{ used_at: Date | null }>(
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
    await this.databaseService.systemQuery(
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
    const result = await this.databaseService.systemQuery<{ count: string }>(
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
    const result = await this.databaseService.systemQuery<{ count: string }>(
      `WITH updated AS (
         UPDATE refresh_tokens SET is_revoked = true
         WHERE user_id = $1 AND tenant_id = $2 AND is_revoked = false
         RETURNING 1
       )
       SELECT COUNT(*) as count FROM updated`,
      [userId, tenantId],
    );

    return Number.parseInt(result[0]?.count ?? '0', 10);
  }

  /**
   * Revoke all tokens for a user by ID only (no tenant scope needed)
   * Used during password reset to force re-login on all devices.
   */
  private async revokeAllUserTokensByUserId(userId: number): Promise<number> {
    const result = await this.databaseService.systemQuery<{ count: string }>(
      `WITH updated AS (
         UPDATE refresh_tokens SET is_revoked = true
         WHERE user_id = $1 AND is_revoked = false
         RETURNING 1
       )
       SELECT COUNT(*) as count FROM updated`,
      [userId],
    );

    return Number.parseInt(result[0]?.count ?? '0', 10);
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
   * Log login for audit trail.
   *
   * `loginMethod` defaults to `'password'` for backward compatibility with the
   * existing password-login caller. OAuth login passes `'oauth-microsoft'` (or
   * future provider ids) so forensic logs distinguish authentication sources.
   */
  private async logLoginAudit(
    user: UserRow,
    ipAddress?: string,
    userAgent?: string,
    loginMethod: string = 'password',
  ): Promise<void> {
    try {
      await this.databaseService.systemQuery(
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
            login_method: loginMethod,
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

  /**
   * Log logout for audit trail
   */
  private async logLogoutAudit(
    user: NestAuthUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.databaseService.systemQuery(
        `INSERT INTO root_logs
         (tenant_id, user_id, action, entity_type, entity_id, details, new_values, ip_address, user_agent, was_role_switched)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          user.tenantId,
          user.id,
          'logout',
          'auth',
          user.id,
          `Abgemeldet als ${user.role}`,
          JSON.stringify({
            role: user.role,
          }),
          ipAddress ?? null,
          userAgent ?? null,
          false,
        ],
      );
    } catch (error: unknown) {
      // Don't fail logout if audit log fails
      this.logger.warn('Failed to log logout audit', error);
    }
  }
}
