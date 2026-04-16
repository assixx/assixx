/**
 * Signup Service (NestJS)
 *
 * Native NestJS implementation for tenant self-service registration.
 * Uses DatabaseService directly for PostgreSQL queries.
 *
 * IMPORTANT: Uses PostgreSQL $1, $2, $3 placeholders (NOT MySQL's ?)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import type { CompleteSignupDto } from '../auth/oauth/dto/index.js';
// Type-only import — directional coupling is intentional: SignupService is the OAuth-aware
// orchestrator, not the other way around (see plan §2.7 + Spec Deviation D14).
import type { SignupTicket } from '../auth/oauth/oauth.types.js';
import { AppConfigService } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';
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
  ) {}

  /**
   * Register a new tenant with admin user
   */
  async registerTenant(
    dto: SignupDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SignupResponseData> {
    // Validation (no logging needed - errors throw)
    this.validateSubdomainOrThrow(dto.subdomain);
    await this.ensureSubdomainAvailable(dto.subdomain);

    try {
      const result = await this.executeRegistrationTransaction(dto);

      await this.createAuditLog(
        'register',
        result.userId,
        result.tenantId,
        dto,
        ipAddress,
        userAgent,
      );

      // ONE log per operation - all relevant info in one line
      this.logger.log(
        `Tenant registered: "${dto.companyName}" (${dto.subdomain}) | tenant=${result.tenantId} user=${result.userId}`,
      );

      return {
        tenantId: result.tenantId,
        userId: result.userId,
        subdomain: dto.subdomain,
        trialEndsAt: result.trialEndsAt.toISOString(),
        message: 'Registration successful! You can now log in.',
      };
    } catch (error: unknown) {
      this.logger.error('Registration failed:', error);
      throw new BadRequestException({
        code: ERROR_CODES.REGISTRATION_FAILED,
        message: 'Failed to complete registration',
      });
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
   * Create root user for new tenant
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
      `INSERT INTO users (username, email, password, role, first_name, last_name, tenant_id, phone, employee_number, has_full_access, uuid, uuid_created_at)
       VALUES ($1, $2, $3, 'root', $4, $5, $6, $7, $8, true, $9, NOW())
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
    return (error as { code: unknown }).code === '23505';
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
