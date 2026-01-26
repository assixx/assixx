/**
 * Signup Service (NestJS)
 *
 * Native NestJS implementation for tenant self-service registration.
 * Uses DatabaseService directly for PostgreSQL queries.
 *
 * IMPORTANT: Uses PostgreSQL $1, $2, $3 placeholders (NOT MySQL's ?)
 */
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { v7 as uuidv7 } from 'uuid';

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

interface DbFeatureResult extends QueryResultRow {
  id: number;
}

interface DbPlanResult extends QueryResultRow {
  id: number;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(private readonly db: DatabaseService) {}

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
   * Execute the registration transaction (create tenant, user, plan, features)
   */
  private async executeRegistrationTransaction(
    dto: SignupDto,
  ): Promise<{ tenantId: number; userId: number; trialEndsAt: Date }> {
    return await this.db.transaction<{ tenantId: number; userId: number; trialEndsAt: Date }>(
      async (client: PoolClient) => {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

        const tenantId = await this.createTenant(client, dto, trialEndsAt);
        const userId = await this.createRootUser(client, tenantId, dto);
        await this.assignBasicPlan(client, tenantId);
        await this.activateTrialFeatures(client, tenantId);

        return { tenantId, userId, trialEndsAt };
      },
    );
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
      `INSERT INTO tenants (company_name, subdomain, email, phone, address, trial_ends_at, billing_email, status, uuid, uuid_created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'trial', $8, NOW())
       RETURNING id`,
      [
        dto.companyName,
        dto.subdomain,
        dto.email,
        dto.phone,
        dto.address ?? null,
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
  validateSubdomain(subdomain: string): { valid: boolean; error?: string | undefined } {
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
    const rows = await this.db.query<DbIdResult>('SELECT id FROM tenants WHERE subdomain = $1', [
      subdomain,
    ]);
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
   * Assign basic plan to new tenant
   */
  private async assignBasicPlan(client: PoolClient, tenantId: number): Promise<void> {
    const planRows = await client.query<DbPlanResult>(
      'SELECT id FROM plans WHERE code = $1 AND is_active = 1',
      ['basic'],
    );

    if (planRows.rows.length > 0) {
      const basicPlanId = planRows.rows[0]?.id;
      if (basicPlanId !== undefined) {
        await client.query(
          `INSERT INTO tenant_plans (tenant_id, plan_id, status, started_at)
           VALUES ($1, $2, 'trial', NOW())`,
          [tenantId, basicPlanId],
        );

        await client.query('UPDATE tenants SET current_plan_id = $1 WHERE id = $2', [
          basicPlanId,
          tenantId,
        ]);
      }
    }
  }

  /**
   * Activate trial features for new tenant
   */
  private async activateTrialFeatures(client: PoolClient, tenantId: number): Promise<void> {
    // TEMPORARY: Activate ALL features for beta test
    const featureRows = await client.query<DbFeatureResult>('SELECT id FROM features');

    for (const feature of featureRows.rows) {
      await client.query(
        `INSERT INTO tenant_features (tenant_id, feature_id, is_active, expires_at)
         VALUES ($1, $2, 1, NOW() + INTERVAL '${TRIAL_DAYS} days')`,
        [tenantId, feature.id],
      );
    }
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
      await this.db.query(
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
            address: dto.address,
            plan: dto.plan ?? 'trial',
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
