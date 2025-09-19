/**
 * Signup Service v2
 * Business logic for user registration
 */
// Sequelize Model Import - MUSS PascalCase sein (ist eine Klasse/Konstruktor)
// Dies ist KEIN normaler Import sondern ein ORM Model das als Klasse definiert ist
// eslint-disable-next-line @typescript-eslint/naming-convention
import Tenant from '../../../models/tenant.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { logger } from '../../../utils/logger.js';
import type { SignupRequest, SubdomainValidation } from './types.js';

/**
 *
 */
export class SignupService {
  /**
   * Helper: Log registration start
   */
  private logRegistrationStart(data: SignupRequest): void {
    console.info('[SignupService] METHOD CALLED');
    console.info('[SignupService] Input data:', data);
    logger.info('[SignupService] Starting registerTenant with data:', {
      companyName: data.companyName,
      subdomain: data.subdomain,
      email: data.email,
      adminEmail: data.adminEmail,
      phone: data.phone,
      plan: data.plan,
    });
    console.info('[SignupService] Logger called');
  }

  /**
   * Helper: Validate and check subdomain availability
   */
  private async validateSubdomainAndAvailability(subdomain: string): Promise<void> {
    logger.info('[SignupService] Validating subdomain:', subdomain);
    console.info('[SignupService] About to validate subdomain');

    const subdomainValidation: SubdomainValidation = Tenant.validateSubdomain(subdomain);
    console.info('[SignupService] Validation result:', subdomainValidation);
    logger.info('[SignupService] Subdomain validation result:', subdomainValidation);

    if (!subdomainValidation.valid) {
      console.info('[SignupService] Invalid subdomain, throwing error');
      throw new ServiceError(
        'INVALID_SUBDOMAIN',
        subdomainValidation.error ?? 'Invalid subdomain format',
      );
    }
    console.info('[SignupService] Subdomain is valid');

    // Check availability
    logger.info('[SignupService] Checking subdomain availability');
    const isAvailable = await Tenant.isSubdomainAvailable(subdomain);
    logger.info('[SignupService] Subdomain available:', isAvailable);

    if (!isAvailable) {
      throw new ServiceError('SUBDOMAIN_TAKEN', 'This subdomain is already taken');
    }
  }

  /**
   * Helper: Build tenant data for creation
   */
  private buildTenantData(data: SignupRequest): {
    company_name: string;
    subdomain: string;
    email: string;
    phone?: string;
    address?: string;
    admin_email: string;
    admin_password: string;
    admin_first_name: string;
    admin_last_name: string;
  } {
    return {
      company_name: data.companyName,
      subdomain: data.subdomain,
      email: data.email,
      phone: data.phone,
      address: data.address,
      admin_email: data.adminEmail,
      admin_password: data.adminPassword,
      admin_first_name: data.adminFirstName,
      admin_last_name: data.adminLastName,
    };
  }

  /**
   * Helper: Log creation success
   */
  private logSuccess(data: SignupRequest, result: { tenantId: number; subdomain: string }): void {
    const safeResult = {
      tenantId: result.tenantId,
      subdomain: result.subdomain,
    };
    logger.info('[SignupService] Tenant created successfully:', safeResult);
    logger.info(`New tenant registered: ${data.companyName} (${data.subdomain})`);
  }

  /**
   * Helper: Handle registration errors
   */
  private handleError(error: unknown, data: SignupRequest): never {
    console.info('[SignupService] CATCH BLOCK ENTERED');
    console.info('[SignupService] Error type:', error?.constructor?.name);
    console.info('[SignupService] Error message:', error instanceof Error ? error.message : error);

    if (error instanceof ServiceError) {
      console.info('[SignupService] Re-throwing ServiceError');
      throw error;
    }

    console.info('[SignupService] Not a ServiceError, logging and throwing REGISTRATION_FAILED');
    logger.error('Error registering tenant:', error);
    logger.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      data: data,
    });
    throw new ServiceError('REGISTRATION_FAILED', 'Failed to complete registration');
  }

  /**
   * Register a new tenant and admin user
   * @param data - The data object
   */
  async registerTenant(data: SignupRequest): Promise<{
    tenantId: number;
    userId: number;
    subdomain: string;
    trialEndsAt: string;
  }> {
    this.logRegistrationStart(data);

    try {
      console.info('[SignupService] Entering try block');

      // Validate and check subdomain
      await this.validateSubdomainAndAvailability(data.subdomain);

      // Build tenant data
      const tenantData = this.buildTenantData(data);

      // Create tenant
      const safeLogData = {
        company_name: data.companyName,
        subdomain: data.subdomain,
        email: data.email,
      };
      logger.info('[SignupService] Creating tenant for:', safeLogData);
      const result = await Tenant.create(tenantData);

      // Log success
      this.logSuccess(data, result);

      return {
        tenantId: result.tenantId,
        userId: result.userId,
        subdomain: result.subdomain,
        trialEndsAt: result.trialEndsAt.toISOString(),
      };
    } catch (error: unknown) {
      this.handleError(error, data);
    }
  }

  /**
   * Check if a subdomain is available
   * @param subdomain - The subdomain parameter
   */
  async checkSubdomainAvailability(subdomain: string): Promise<{
    available: boolean;
    subdomain: string;
    error?: string;
  }> {
    try {
      // Validate subdomain format
      const validation: SubdomainValidation = Tenant.validateSubdomain(subdomain);
      if (!validation.valid) {
        return {
          available: false,
          subdomain,
          error: validation.error,
        };
      }

      // Check availability
      const available = await Tenant.isSubdomainAvailable(subdomain);

      return {
        available,
        subdomain,
      };
    } catch (error: unknown) {
      logger.error('Error checking subdomain availability:', error);
      throw new ServiceError('CHECK_FAILED', 'Failed to check subdomain availability');
    }
  }

  /**
   * Validate subdomain format
   * @param subdomain - The subdomain parameter
   */
  validateSubdomain(subdomain: string): SubdomainValidation {
    return Tenant.validateSubdomain(subdomain);
  }
}

export const signupService = new SignupService();
