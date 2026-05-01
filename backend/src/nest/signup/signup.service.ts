/**
 * Signup Service (NestJS)
 *
 * Native NestJS implementation for tenant self-service registration.
 * Uses DatabaseService directly for PostgreSQL queries.
 *
 * IMPORTANT: Uses PostgreSQL $1, $2, $3 placeholders (NOT MySQL's ?)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { DatabaseError, type PoolClient, type QueryResultRow } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import type { CompleteSignupDto } from '../auth/oauth/dto/index.js';
// Type-only import — directional coupling is intentional: SignupService is the OAuth-aware
// orchestrator, not the other way around (see plan §2.7 + Spec Deviation D14).
import type { SignupTicket } from '../auth/oauth/oauth.types.js';
import { AppConfigService } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';
import { DomainVerificationService } from '../domains/domain-verification.service.js';
import {
  type EmailValidationFailure,
  extractDomain,
  validateBusinessEmail,
} from '../domains/email-validator.js';
import { TwoFactorAuthService } from '../two-factor-auth/two-factor-auth.service.js';
import type { LoginResult } from '../two-factor-auth/two-factor-auth.types.js';
import type { SignupDto, SignupResponseData, SubdomainCheckResponseData } from './dto/index.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const ERROR_CODES = {
  SUBDOMAIN_TAKEN: 'SUBDOMAIN_TAKEN',
  INVALID_SUBDOMAIN: 'INVALID_SUBDOMAIN',
  REGISTRATION_FAILED: 'REGISTRATION_FAILED',
  CHECK_FAILED: 'CHECK_FAILED',
} as const;

const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'test', 'dev'];
const TRIAL_DAYS = 14;

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

interface DbIdResult extends QueryResultRow {
  id: number;
}

interface DbTenantResult extends QueryResultRow {
  id: number;
}

interface DbUserResult extends QueryResultRow {
  id: number;
}

interface DbAddonResult extends QueryResultRow {
  id: number;
  trial_days: number;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: AppConfigService,
    // `DomainVerificationService` — used ONLY for token generation here; the
    // DNS-TXT lookup side of that service is exercised from `DomainsService`
    // (Step 2.5). Exported from `DomainsModule` (Step 2.8 wiring).
    private readonly domainVerification: DomainVerificationService,
    // 2FA email gate — Step 2.5 (ADR-054 / DD-11). Password signups create a
    // pending user (`is_active = INACTIVE`) and immediately issue an email
    // challenge. Tokens are NOT minted here; the verify endpoint flips the
    // user to ACTIVE + mints them. OAuth signup (`registerTenantWithOAuth`)
    // bypasses this dependency per DD-7 — Azure AD is the trust boundary.
    private readonly twoFactorAuth: TwoFactorAuthService,
  ) {}

  /**
   * Register a new tenant with admin user (password path).
   *
   * Step 2.5 (ADR-054) reshapes the post-tx tail into a 2FA gate:
   *   1. Validate (e-mail gates → subdomain → availability) — unchanged.
   *   2. `executeRegistrationTransaction` inserts tenant + pending user
   *      (`is_active = INACTIVE`) + seeds tenant_domains + activates trial
   *      addons. Atomic; pre-2FA — no tokens are minted yet.
   *   3. Issue an email challenge via `TwoFactorAuthService.issueChallenge`.
   *      Mail send is awaited (DD-14 fail-loud); on success we audit the
   *      registration and return `{ stage: 'challenge_required', challenge }`.
   *   4. **DD-14 cleanup**: if the SMTP transport throws, the just-created
   *      user (and conditionally its tenant — anti subdomain-squatting) are
   *      deleted in a separate `systemTransaction`, then the original 503 is
   *      re-thrown so the controller surfaces a retryable error to the user.
   *
   * The frontend will pivot from the legacy `SignupResponseData` shape to
   * the discriminated union in Phase 5 (Step 5.4). Until then the signup
   * UX is interim-broken — documented in masterplan §Step 2.4 "Known
   * interim state".
   */
  async registerTenant(
    dto: SignupDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    // Validation (no logging needed - errors throw). Email gates first —
    // cheapest check (synchronous, ~1ms), rejects freemail / disposable /
    // malformed before we touch the DB. Both `email` AND `adminEmail`
    // validated per v0.3.5 D31 — frontend sends same value today but a
    // future API consumer could split them; defence-in-depth is cheap.
    this.validateBusinessEmailOrThrow(dto.email, 'email');
    this.validateBusinessEmailOrThrow(dto.adminEmail, 'adminEmail');
    this.validateSubdomainOrThrow(dto.subdomain);
    await this.ensureSubdomainAvailable(dto.subdomain);

    // Step 1: persist tenant + pending user. Generic-error wrap kept for
    // parity with the pre-2FA contract (callers expected BadRequestException
    // on any tx-level failure). DD-14 cleanup is NOT triggered here — the
    // transaction either commits (tenant + user exist) or rolls back (no
    // rows survived to need cleanup).
    let txResult: { tenantId: number; userId: number; trialEndsAt: Date };
    try {
      txResult = await this.executeRegistrationTransaction(dto);
    } catch (error: unknown) {
      this.logger.error('Registration failed:', error);
      throw new BadRequestException({
        code: ERROR_CODES.REGISTRATION_FAILED,
        message: 'Failed to complete registration',
      });
    }

    // Step 2: issue 2FA challenge. SMTP send is awaited inside
    // `issueChallenge` (DD-14). On transport failure the service throws
    // `ServiceUnavailableException` AND rolls back its own Redis-side
    // challenge record — we own the DB-side cleanup here.
    try {
      const challenge = await this.twoFactorAuth.issueChallenge(
        txResult.userId,
        txResult.tenantId,
        dto.adminEmail,
        'signup',
      );

      // Audit registration only AFTER the challenge mail left the building.
      // Pre-DD-14-cleanup audit would leave an orphan `register` row pointing
      // at a tenant we've already deleted.
      await this.createAuditLog(
        'register',
        txResult.userId,
        txResult.tenantId,
        dto,
        ipAddress,
        userAgent,
      );

      this.logger.log(
        `Pending tenant created (2FA challenge issued): "${dto.companyName}" (${dto.subdomain}) | tenant=${txResult.tenantId} user=${txResult.userId}`,
      );

      return { stage: 'challenge_required', challenge };
    } catch (error: unknown) {
      // DD-14: SMTP failure → fail-loud + cleanup. Without tenant cleanup an
      // attacker could squat any premium subdomain by signup-then-tab-close
      // (no challenge ever delivered, no reaper in scope yet — Step 2.11).
      // Cleanup is best-effort: even if it fails, surface the original 503
      // to the user; the stale-pending reaper (Step 2.11) is the safety net.
      if (error instanceof ServiceUnavailableException) {
        await this.cleanupFailedSignup(txResult.tenantId, txResult.userId);
        throw error;
      }
      // Non-SMTP error from `issueChallenge` (e.g. user is locked out — can't
      // happen for a brand-new userId, defensive). Same cleanup pattern, but
      // collapse to BadRequestException for the legacy contract.
      this.logger.error('2FA challenge issuance failed during signup:', error);
      await this.cleanupFailedSignup(txResult.tenantId, txResult.userId);
      throw new BadRequestException({
        code: ERROR_CODES.REGISTRATION_FAILED,
        message: 'Failed to complete registration',
      });
    }
  }

  /**
   * DD-14 anti-squat cleanup. Runs in its own `systemTransaction` (BYPASSRLS;
   * the signup user has no CLS context and the tenant is brand-new).
   *
   * **Tenant-erasure semantics (ADR-020 compliant):** the masterplan calls
   * for "delete both users AND tenants row". We achieve that via tenant
   * deletion + the existing `users.tenant_id ON DELETE CASCADE` FK — the
   * user vanishes via cascade, never via direct `DELETE FROM users`. This
   * keeps `signup.service.ts` outside the `users` hard-delete whitelist
   * enforced by `shared/src/architectural.test.ts:290` (the ADR-020 +
   * ADR-045 soft-delete-only rule). DD-14 cleanup IS conceptually a tenant
   * erasure (the tenant should never have existed; we're rolling back the
   * insert); cascading the user makes that explicit at the SQL layer.
   *
   * The branch on "are there other users on this tenant?" is defensive —
   * there is no race in practice for a fresh signup (we just inserted the
   * single root user). The check exists to guard against future codepaths
   * that might attach to a half-built tenant; in that branch we soft-delete
   * the orphaned pending user (`is_active = DELETED`) and leave the tenant
   * + the other users intact.
   *
   * Tenant deletion also cascades to `tenant_domains`, `tenant_addons`,
   * etc. via existing FK ON DELETE CASCADE — no manual sweep required.
   *
   * Best-effort: a failure here is logged and swallowed so the original
   * `ServiceUnavailableException` reaches the caller unchanged. The stale-
   * pending reaper (Step 2.11) catches anything cleanup misses.
   */
  private async cleanupFailedSignup(tenantId: number, userId: number): Promise<void> {
    try {
      await this.db.systemTransaction(async (client: PoolClient) => {
        // Count OTHER users (not this pending one) to decide common vs edge.
        const otherUsersResult = await client.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM users WHERE tenant_id = $1 AND id <> $2',
          [tenantId, userId],
        );
        const otherCount = otherUsersResult.rows[0]?.count;

        if (otherCount === '0') {
          // Common case: tenant erasure rolls back the half-built signup.
          // FK CASCADE on users.tenant_id removes the pending user row.
          await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
        } else {
          // Edge case (defensive — does not arise in practice): another user
          // is attached to this tenant. Soft-delete the orphaned pending
          // user and leave the tenant + other users untouched.
          await client.query(
            `UPDATE users SET is_active = ${IS_ACTIVE.DELETED}, updated_at = NOW() WHERE id = $1`,
            [userId],
          );
        }
      });
      this.logger.warn(
        `DD-14 cleanup: rolled back pending signup tenant=${tenantId} user=${userId} after SMTP failure`,
      );
    } catch (cleanupError: unknown) {
      // Cleanup itself failed — log for ops, but DO NOT mask the original
      // SMTP error from the caller. Reaper (Step 2.11) is the safety net.
      this.logger.error(
        `DD-14 cleanup failed for tenant=${tenantId} user=${userId}:`,
        cleanupError,
      );
    }
  }

  /**
   * Validate subdomain format and throw if invalid
   */
  private validateSubdomainOrThrow(subdomain: string): void {
    const validation = this.validateSubdomain(subdomain);
    if (!validation.valid) {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_SUBDOMAIN,
        message: validation.error ?? 'Invalid subdomain format',
      });
    }
  }

  /**
   * Ensure subdomain is available, throw ConflictException if taken
   */
  private async ensureSubdomainAvailable(subdomain: string): Promise<void> {
    const isAvailable = await this.isSubdomainAvailable(subdomain);
    if (!isAvailable) {
      throw new ConflictException({
        code: ERROR_CODES.SUBDOMAIN_TAKEN,
        message: 'This subdomain is already taken',
      });
    }
  }

  /**
   * Validate an email against the three-layer business-email filter
   * (format / disposable / freemail — §2.3). Called twice per signup (D31):
   * once for `dto.email` (company contact), once for `dto.adminEmail` (root
   * login). `field` is surfaced in the error payload so future API consumers
   * sending distinct values can see which side failed; the stock frontend
   * sends the same string to both so users see a single toast either way.
   */
  private validateBusinessEmailOrThrow(email: string, field: 'email' | 'adminEmail'): void {
    const result = validateBusinessEmail(email);
    if (result.valid) return;
    // Exhaustive switch on the 3-member `EmailValidationFailure` union — no
    // `default:` by design (same pattern as `DomainsService.throwForValidation
    // Failure` in Step 2.5). Adding a 4th member in `email-validator.ts`
    // breaks tsc here (return-type inference loses exhaustiveness), forcing
    // a deliberate update. `??` fallback guards the optional `failure` prop.
    const failure: EmailValidationFailure = result.failure ?? 'INVALID_FORMAT';
    switch (failure) {
      case 'INVALID_FORMAT':
        throw new BadRequestException({
          code: 'INVALID_FORMAT',
          field,
          message: 'Bitte gib eine gültige E-Mail-Adresse ein.',
        });
      case 'DISPOSABLE_EMAIL':
        throw new BadRequestException({
          code: 'DISPOSABLE_EMAIL',
          field,
          message:
            'Wegwerf-E-Mail-Adressen sind nicht erlaubt. Bitte nutze Deine Firmen-E-Mail-Adresse.',
        });
      case 'FREE_EMAIL_PROVIDER':
        throw new BadRequestException({
          code: 'FREE_EMAIL_PROVIDER',
          field,
          message:
            'Bitte nutze Deine Firmen-E-Mail-Adresse mit eigener Domain. Gmail, Outlook, GMX & Co. sind nicht erlaubt.',
        });
    }
  }

  /**
   * Seed the initial `tenant_domains(pending)` row from the root-user's
   * `adminEmail` domain (§0.2.5 #3 — root's own email is the ownership
   * claim; prevents `attacker@gmail.com` claiming `victim.de`). Called
   * INSIDE the enclosing `systemTransaction` so a downstream failure
   * rolls back tenant + user + domain atomically. No DNS yet — the token
   * lives in `verification_token` until the user pastes it into DNS TXT
   * via `/settings/company-profile/domains` (Phase 5 UI).
   */
  private async seedPendingDomain(
    client: PoolClient,
    tenantId: number,
    adminEmail: string,
  ): Promise<void> {
    const domain = extractDomain(adminEmail);
    const token = this.domainVerification.generateToken();
    await client.query(
      `INSERT INTO tenant_domains
         (tenant_id, domain, status, verification_token, is_primary)
       VALUES ($1, $2, 'pending', $3, true)`,
      [tenantId, domain, token],
    );
  }

  /**
   * Seed the initial `tenant_domains(verified)` row for OAuth signup (§2.8b,
   * §0.2.5 #17). Azure AD already proved domain ownership at the IdP level
   * (the customer's IT admin configured the Azure AD app registration with
   * the allowed domains), so no DNS-TXT dance is required. The
   * `verification_token` is still generated — NOT-NULL column + audit-trail
   * integrity — but never redeemed; `status='verified'` is what unlocks
   * user creation via `assertTenantVerified()`.
   *
   * MUST wrap the INSERT in a 23505 handler. The partial UNIQUE INDEX
   * `idx_tenant_domains_domain_verified` (§1.1) rejects the INSERT when
   * another tenant has already claimed the same domain as verified
   * (e.g. password-signup tenant A verified `firma.de` via DNS TXT, then
   * an OAuth signup for `x@firma.de` races in for tenant B). Without the
   * catch, Postgres's raw 23505 error bubbles as a 500 to the OAuth
   * callback — terrible UX for what is actually a "domain already taken"
   * conflict. The enclosing `systemTransaction` rolls back on throw → no
   * orphan tenant / user / oauth-link rows survive.
   */
  private async seedVerifiedDomain(
    client: PoolClient,
    tenantId: number,
    oauthEmail: string,
  ): Promise<void> {
    const domain = extractDomain(oauthEmail);
    // Token is generated for column-NOT-NULL + audit-trail integrity
    // (§0.2.5 #17); the DNS-TXT redemption path is never taken for
    // OAuth-seeded rows because they land at `status='verified'` directly.
    const token = this.domainVerification.generateToken();
    try {
      await client.query(
        `INSERT INTO tenant_domains
           (tenant_id, domain, status, verification_token, verified_at, is_primary)
         VALUES ($1, $2, 'verified', $3, NOW(), true)`,
        [tenantId, domain, token],
      );
    } catch (err: unknown) {
      // 23505 = unique_violation against `idx_tenant_domains_domain_verified`
      // (the only UNIQUE constraint a fresh OAuth signup could hit — per-
      // tenant-domain constraint can't fire on a brand-new tenantId). Map
      // to a clean 409 ConflictException; the outer `systemTransaction`
      // rolls back the tenant + user + oauth-link atomically on throw.
      if (err instanceof DatabaseError && err.code === '23505') {
        throw new ConflictException({
          code: 'DOMAIN_ALREADY_CLAIMED',
          message:
            'Diese Domain gehört bereits einem anderen Assixx-Tenant. Bitte wende Dich an Deinen Assixx-Kontakt.',
        });
      }
      throw err;
    }
  }

  /**
   * Execute the registration transaction (create tenant, user, activate trial addons)
   */
  private async executeRegistrationTransaction(
    dto: SignupDto,
  ): Promise<{ tenantId: number; userId: number; trialEndsAt: Date }> {
    return await this.db.systemTransaction<{
      tenantId: number;
      userId: number;
      trialEndsAt: Date;
    }>(async (client: PoolClient) => {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

      const tenantId = await this.createTenant(client, dto, trialEndsAt);
      const userId = await this.createRootUser(client, tenantId, dto);
      // Seed `tenant_domains(pending)` from `dto.adminEmail` domain (§2.8 +
      // D31 — root-login email is the ownership claim per §0.2.5 #3). Inside
      // the same `systemTransaction` so any later failure rolls back the
      // tenant + user + domain atomically; no orphan tenant without its
      // claim row. Seed always succeeds: UNIQUE (tenant_id, domain) can't
      // collide on a brand-new tenantId, and the verified-global index
      // only blocks `status='verified'` rows.
      await this.seedPendingDomain(client, tenantId, dto.adminEmail);
      await this.activateTrialAddons(client, tenantId);

      return { tenantId, userId, trialEndsAt };
    });
  }

  /**
   * Create tenant record in database
   */
  private async createTenant(
    client: PoolClient,
    dto: SignupDto,
    trialEndsAt: Date,
  ): Promise<number> {
    const tenantUuid = uuidv7();
    const tenantRows = await client.query<DbTenantResult>(
      `INSERT INTO tenants (company_name, subdomain, email, phone, street, house_number, postal_code, city, country_code, trial_ends_at, billing_email, status, uuid, uuid_created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'trial', $12, NOW())
       RETURNING id`,
      [
        dto.companyName,
        dto.subdomain,
        dto.email,
        dto.phone,
        dto.street ?? null,
        dto.houseNumber ?? null,
        dto.postalCode ?? null,
        dto.city ?? null,
        dto.countryCode ?? null,
        trialEndsAt,
        dto.adminEmail,
        tenantUuid,
      ],
    );

    const tenantId = tenantRows.rows[0]?.id ?? 0;
    if (tenantId === 0) {
      throw new Error('Failed to create tenant');
    }
    return tenantId;
  }

  /**
   * Check if a subdomain is available for registration
   */
  async checkSubdomainAvailability(subdomain: string): Promise<SubdomainCheckResponseData> {
    // Validate subdomain format first
    const validation = this.validateSubdomain(subdomain);
    if (!validation.valid) {
      const result: SubdomainCheckResponseData = {
        available: false,
        subdomain,
      };
      if (validation.error !== undefined) {
        result.error = validation.error;
      }
      return result;
    }

    try {
      const available = await this.isSubdomainAvailable(subdomain);
      return { available, subdomain };
    } catch (error: unknown) {
      this.logger.error('Subdomain check failed:', error);
      throw new BadRequestException({
        code: ERROR_CODES.CHECK_FAILED,
        message: 'Failed to check subdomain availability',
      });
    }
  }

  /**
   * Validate subdomain format only (no DB check)
   */
  validateSubdomain(subdomain: string): {
    valid: boolean;
    error?: string | undefined;
  } {
    // Only lowercase letters, numbers, and hyphens
    const regex = /^[-0-9a-z]+$/;

    if (!regex.test(subdomain)) {
      return {
        valid: false,
        error: 'Only lowercase letters, numbers, and hyphens allowed',
      };
    }

    if (subdomain.length < 3 || subdomain.length > 50) {
      return {
        valid: false,
        error: 'Subdomain must be between 3 and 50 characters',
      };
    }

    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      return { valid: false, error: 'This subdomain is reserved' };
    }

    return { valid: true };
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Check if subdomain is available in database
   */
  private async isSubdomainAvailable(subdomain: string): Promise<boolean> {
    const rows = await this.db.systemQuery<DbIdResult>(
      'SELECT id FROM tenants WHERE subdomain = $1',
      [subdomain],
    );
    return rows.length === 0;
  }

  /**
   * Create root user for new tenant.
   *
   * Step 2.5 (ADR-054): the row lands at `is_active = INACTIVE` and stays
   * there until the user passes the email-2FA challenge in
   * `TwoFactorAuthController.verify` (Step 2.7), which flips it to
   * `IS_ACTIVE.ACTIVE` + sets `tfa_enrolled_at`. If the user abandons the
   * flow OR SMTP fails, the row is reaped (DD-14 synchronous cleanup or
   * Step 2.11 stale-pending reaper). OAuth users go through
   * `createOAuthRootUser` and start ACTIVE because Azure AD already proved
   * the email (DD-7 exempt).
   */
  private async createRootUser(
    client: PoolClient,
    tenantId: number,
    dto: SignupDto,
  ): Promise<number> {
    const hashedPassword = await bcrypt.hash(dto.adminPassword, 12);
    const employeeNumber = this.generateTemporaryEmployeeNumber();
    const userUuid = uuidv7();

    const userRows = await client.query<DbUserResult>(
      `INSERT INTO users (username, email, password, role, first_name, last_name, tenant_id, phone, employee_number, has_full_access, is_active, uuid, uuid_created_at)
       VALUES ($1, $2, $3, 'root', $4, $5, $6, $7, $8, true, ${IS_ACTIVE.INACTIVE}, $9, NOW())
       RETURNING id`,
      [
        dto.adminEmail,
        dto.adminEmail,
        hashedPassword,
        dto.adminFirstName,
        dto.adminLastName,
        tenantId,
        dto.phone,
        employeeNumber,
        userUuid,
      ],
    );

    const userId = userRows.rows[0]?.id ?? 0;
    if (userId === 0) {
      throw new Error('Failed to create root user');
    }

    // Generate employee_id
    const employeeId = this.generateEmployeeId(dto.subdomain, 'root', userId);
    await client.query('UPDATE users SET employee_id = $1 WHERE id = $2', [employeeId, userId]);

    return userId;
  }

  /**
   * Activate purchasable addons as trial for new tenant (ADR-033).
   * Core addons are always accessible without tenant_addons entries.
   * Dev mode: activate ALL purchasable addons for convenience.
   * Production: no auto-activation — admin activates via addon store.
   */
  private async activateTrialAddons(client: PoolClient, tenantId: number): Promise<void> {
    if (!this.config.isDevelopment) {
      return;
    }

    const addonRows = await client.query<DbAddonResult>(
      `SELECT id, COALESCE(trial_days, 30) AS trial_days
       FROM addons
       WHERE is_core = false AND is_active = ${IS_ACTIVE.ACTIVE}`,
    );

    for (const addon of addonRows.rows) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + addon.trial_days);

      await client.query(
        `INSERT INTO tenant_addons
           (tenant_id, addon_id, status, trial_started_at, trial_ends_at, activated_at, is_active, created_at, updated_at)
         VALUES ($1, $2, 'trial', NOW(), $3, NOW(), ${IS_ACTIVE.ACTIVE}, NOW(), NOW())`,
        [tenantId, addon.id, trialEndsAt],
      );
    }

    this.logger.log(
      `DEV MODE: Activated ${addonRows.rows.length} purchasable addons as trial for tenant ${tenantId}`,
    );
  }

  /**
   * Generate temporary employee number
   */
  private generateTemporaryEmployeeNumber(): string {
    const timestamp = Date.now().toString().slice(-6);
    // Generate cryptographically secure random number
    let randomInt: number;
    do {
      const randomBuffer = randomBytes(2);
      randomInt = randomBuffer.readUInt16BE(0);
    } while (randomInt >= 65000);
    randomInt = randomInt % 1000;
    const random = randomInt.toString().padStart(3, '0');
    return `TEMP-${timestamp}${random}`;
  }

  /**
   * Generate employee ID
   */
  private generateEmployeeId(subdomain: string, role: string, userId: number): string {
    const prefix = subdomain.substring(0, 3).toUpperCase();
    const rolePrefix =
      role === 'root' ? 'R'
      : role === 'admin' ? 'A'
      : 'E';
    return `${prefix}-${rolePrefix}${userId.toString().padStart(5, '0')}`;
  }

  // ==========================================================================
  // OAUTH SIGNUP PATH — plan §2.7
  // ==========================================================================

  /**
   * Register a tenant + root admin seeded from an OAuth-resolved identity.
   *
   * Flow mirrors `registerTenant()` but:
   *   - `email` / `adminFirstName` / `adminLastName` come from the verified
   *     OAuth profile (SignupTicket), NOT from the form
   *   - `users.password` is set to a bcrypt of a fresh 256-bit random value
   *     — the plaintext is never retained, so password-login is effectively
   *     locked. V2 "set a password" would overwrite this hash.
   *   - A `user_oauth_accounts` row is inserted inside the SAME
   *     `systemTransaction` — mitigates R8 (concurrent-signup race): the
   *     UNIQUE(provider, provider_user_id) constraint arbitrates, losers
   *     roll the full tx back so no half-created tenant is left behind.
   *
   * Spec deviation D14: plan §2.4 intends `OAuthAccountRepository.createLink`
   * as the canonical link-insert API. It cannot be injected here — SignupModule
   * would need to import OAuthModule to reach the repo, but OAuthModule
   * already imports SignupModule via `OAuthService` wiring → circular module
   * dep. We inline the INSERT in `insertOAuthAccountLink` with the exact
   * SQL/columns the repository uses. The repository remains the API for
   * future non-signup link-create paths (V2 link/unlink settings).
   */
  async registerTenantWithOAuth(
    dto: CompleteSignupDto,
    oauthInfo: SignupTicket,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SignupResponseData> {
    this.validateSubdomainOrThrow(dto.subdomain);
    await this.ensureSubdomainAvailable(dto.subdomain);

    try {
      const result = await this.executeOAuthRegistrationTransaction(dto, oauthInfo);
      await this.createOAuthAuditLog(
        result.userId,
        result.tenantId,
        dto,
        oauthInfo,
        ipAddress,
        userAgent,
      );

      this.logger.log(
        `OAuth tenant registered: "${dto.companyName}" (${dto.subdomain}) via ${oauthInfo.provider} | tenant=${result.tenantId} user=${result.userId}`,
      );

      return {
        tenantId: result.tenantId,
        userId: result.userId,
        subdomain: dto.subdomain,
        trialEndsAt: result.trialEndsAt.toISOString(),
        message: 'Registration successful! You can now log in.',
        // OAuth auto-verifies (§2.8b, §0.2.5 #17) — Azure AD is the trust
        // boundary, domain claim is already proven at IdP level; frontend
        // suppresses the verification banner for OAuth-signed-up tenants.
        tenantVerificationRequired: false,
      };
    } catch (error: unknown) {
      // Let R3 (duplicate OAuth link) surface as 409 — translated in
      // `insertOAuthAccountLink`. Everything else collapses to a generic 400.
      if (error instanceof ConflictException) throw error;
      this.logger.error('OAuth registration failed:', error);
      throw new BadRequestException({
        code: ERROR_CODES.REGISTRATION_FAILED,
        message: 'Failed to complete registration',
      });
    }
  }

  private async executeOAuthRegistrationTransaction(
    dto: CompleteSignupDto,
    oauthInfo: SignupTicket,
  ): Promise<{ tenantId: number; userId: number; trialEndsAt: Date }> {
    return await this.db.systemTransaction<{
      tenantId: number;
      userId: number;
      trialEndsAt: Date;
    }>(async (client: PoolClient) => {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

      const tenantId = await this.createTenantForOAuth(client, dto, oauthInfo, trialEndsAt);
      const userId = await this.createOAuthRootUser(client, tenantId, dto, oauthInfo);
      // Seed `tenant_domains(verified)` from Microsoft-provided OAuth email
      // (§2.8b + §0.2.5 #17). Azure AD is the trust boundary, so the domain
      // is auto-verified — no DNS-TXT dance. Placed immediately after the
      // root-user INSERT (mirrors password path order in §2.8) so a 23505
      // conflict rolls back tenant + user atomically before we reach
      // `insertOAuthAccountLink`. The seeder catches 23505 → 409 clean.
      await this.seedVerifiedDomain(client, tenantId, oauthInfo.email);
      await this.activateTrialAddons(client, tenantId);
      await this.insertOAuthAccountLink(client, tenantId, userId, oauthInfo);

      return { tenantId, userId, trialEndsAt };
    });
  }

  /**
   * Tenant INSERT mirrors `createTenant()` but draws contact + billing email
   * from the OAuth-verified profile (single source of truth post-OAuth;
   * CompleteSignupDto deliberately has no email field).
   */
  private async createTenantForOAuth(
    client: PoolClient,
    dto: CompleteSignupDto,
    oauthInfo: SignupTicket,
    trialEndsAt: Date,
  ): Promise<number> {
    const tenantUuid = uuidv7();
    const tenantRows = await client.query<DbTenantResult>(
      `INSERT INTO tenants (
         company_name, subdomain, email, phone, street, house_number,
         postal_code, city, country_code, trial_ends_at, billing_email,
         status, uuid, uuid_created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'trial', $12, NOW())
       RETURNING id`,
      [
        dto.companyName,
        dto.subdomain,
        oauthInfo.email,
        dto.phone,
        dto.street ?? null,
        dto.houseNumber ?? null,
        dto.postalCode ?? null,
        dto.city ?? null,
        dto.countryCode ?? null,
        trialEndsAt,
        oauthInfo.email,
        tenantUuid,
      ],
    );

    const tenantId = tenantRows.rows[0]?.id ?? 0;
    if (tenantId === 0) {
      throw new Error('Failed to create tenant');
    }
    return tenantId;
  }

  /**
   * Root-user INSERT with an unusable password. `users.password` is NOT NULL,
   * but OAuth-only users sign in through Microsoft — the bcrypt here hashes
   * 256-bit random bytes that we immediately discard. `bcrypt.compare` will
   * never succeed against any password a human could type.
   */
  private async createOAuthRootUser(
    client: PoolClient,
    tenantId: number,
    dto: CompleteSignupDto,
    oauthInfo: SignupTicket,
  ): Promise<number> {
    const unusablePassword = randomBytes(32).toString('base64url');
    const hashedPassword = await bcrypt.hash(unusablePassword, 12);
    const employeeNumber = this.generateTemporaryEmployeeNumber();
    const userUuid = uuidv7();

    const userRows = await client.query<DbUserResult>(
      `INSERT INTO users (username, email, password, role, first_name, last_name, tenant_id, phone, employee_number, has_full_access, uuid, uuid_created_at)
       VALUES ($1, $2, $3, 'root', $4, $5, $6, $7, $8, true, $9, NOW())
       RETURNING id`,
      [
        oauthInfo.email,
        oauthInfo.email,
        hashedPassword,
        dto.adminFirstName,
        dto.adminLastName,
        tenantId,
        dto.phone,
        employeeNumber,
        userUuid,
      ],
    );

    const userId = userRows.rows[0]?.id ?? 0;
    if (userId === 0) {
      throw new Error('Failed to create root user');
    }

    const employeeId = this.generateEmployeeId(dto.subdomain, 'root', userId);
    await client.query('UPDATE users SET employee_id = $1 WHERE id = $2', [employeeId, userId]);

    return userId;
  }

  /**
   * Insert the OAuth account link in the signup transaction.
   * SQL deliberately mirrors `OAuthAccountRepository.createLink` — see the
   * Spec-Deviation-D14 note on `registerTenantWithOAuth` for why the
   * repository cannot be injected into this module.
   *
   * Postgres error code `23505` = unique_violation. The UNIQUE constraint
   * `(provider, provider_user_id)` is our R3 arbiter — translate to 409 so
   * the controller surfaces a friendly German message to the user.
   */
  private async insertOAuthAccountLink(
    client: PoolClient,
    tenantId: number,
    userId: number,
    oauthInfo: SignupTicket,
  ): Promise<void> {
    try {
      await client.query(
        `INSERT INTO user_oauth_accounts (
           tenant_id, user_id, provider, provider_user_id,
           email, email_verified, display_name, microsoft_tenant_id
         ) VALUES ($1, $2, $3::oauth_provider, $4, $5, $6, $7, $8)`,
        [
          tenantId,
          userId,
          oauthInfo.provider,
          oauthInfo.providerUserId,
          oauthInfo.email,
          oauthInfo.emailVerified,
          oauthInfo.displayName,
          oauthInfo.microsoftTenantId,
        ],
      );
    } catch (error: unknown) {
      if (SignupService.isUniqueViolation(error)) {
        throw new ConflictException(
          'Dieses Microsoft-Konto ist bereits mit einem Assixx-Tenant verknüpft.',
        );
      }
      throw error;
    }
  }

  /** Narrow an unknown error to a Postgres unique-violation (SQLSTATE 23505). */
  private static isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    return error.code === '23505';
  }

  /**
   * OAuth-specific audit log. Captures the provider, the verified sub, and the
   * Microsoft tenant id alongside the usual company fields for forensic
   * traceability of sign-ups via external identity providers.
   */
  private async createOAuthAuditLog(
    userId: number,
    tenantId: number,
    dto: CompleteSignupDto,
    oauthInfo: SignupTicket,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.db.systemQuery(
        `INSERT INTO root_logs (action, user_id, tenant_id, entity_type, entity_id, details, new_values, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          'register_oauth',
          userId,
          tenantId,
          'tenant',
          tenantId,
          `Registriert via ${oauthInfo.provider}: ${dto.companyName}`,
          JSON.stringify({
            company_name: dto.companyName,
            subdomain: dto.subdomain,
            admin_email: oauthInfo.email,
            admin_first_name: dto.adminFirstName,
            admin_last_name: dto.adminLastName,
            phone: dto.phone,
            oauth_provider: oauthInfo.provider,
            oauth_provider_user_id: oauthInfo.providerUserId,
            oauth_tenant_id: oauthInfo.microsoftTenantId,
            ...(dto.street !== undefined && { street: dto.street }),
            ...(dto.houseNumber !== undefined && { house_number: dto.houseNumber }),
            ...(dto.postalCode !== undefined && { postal_code: dto.postalCode }),
            ...(dto.city !== undefined && { city: dto.city }),
            ...(dto.countryCode !== undefined && { country_code: dto.countryCode }),
          }),
          ipAddress ?? null,
          userAgent ?? null,
        ],
      );
    } catch (error: unknown) {
      this.logger.error('Failed to create OAuth audit log:', error);
    }
  }

  // ==========================================================================
  // SHARED AUDIT HELPER — password-signup path
  // ==========================================================================

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    action: string,
    userId: number,
    tenantId: number,
    dto: SignupDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.db.systemQuery(
        `INSERT INTO root_logs (action, user_id, tenant_id, entity_type, entity_id, details, new_values, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          action,
          userId,
          tenantId,
          'tenant',
          tenantId,
          `Registriert: ${dto.companyName}`,
          JSON.stringify({
            company_name: dto.companyName,
            subdomain: dto.subdomain,
            admin_email: dto.adminEmail,
            admin_first_name: dto.adminFirstName,
            admin_last_name: dto.adminLastName,
            phone: dto.phone,
            ...(dto.street !== undefined && { street: dto.street }),
            ...(dto.houseNumber !== undefined && {
              house_number: dto.houseNumber,
            }),
            ...(dto.postalCode !== undefined && {
              postal_code: dto.postalCode,
            }),
            ...(dto.city !== undefined && { city: dto.city }),
            ...(dto.countryCode !== undefined && {
              country_code: dto.countryCode,
            }),
          }),
          ipAddress ?? null,
          userAgent ?? null,
        ],
      );
    } catch (error: unknown) {
      this.logger.error('Failed to create audit log:', error);
    }
  }
}
