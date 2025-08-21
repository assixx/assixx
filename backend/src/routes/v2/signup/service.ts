/**
 * Signup Service v2
 * Business logic for user registration
 */
import Tenant from '../../../models/tenant.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { logger } from '../../../utils/logger.js';
import type { SignupRequest, SubdomainValidation } from './types.js';

/**
 *
 */
export class SignupService {
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

    try {
      console.info('[SignupService] Entering try block');
      // Validate subdomain format
      logger.info('[SignupService] Validating subdomain:', data.subdomain);
      console.info('[SignupService] About to validate subdomain');
      const subdomainValidation: SubdomainValidation = Tenant.validateSubdomain(data.subdomain);
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

      // Check if subdomain is available
      logger.info('[SignupService] Checking subdomain availability');
      const isAvailable = await Tenant.isSubdomainAvailable(data.subdomain);
      logger.info('[SignupService] Subdomain available:', isAvailable);

      if (!isAvailable) {
        throw new ServiceError('SUBDOMAIN_TAKEN', 'This subdomain is already taken');
      }

      // Convert camelCase to snake_case for Tenant.create
      const tenantData = {
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

      // Create tenant and admin user
      // Log without sensitive data
      const safeLogData = {
        company_name: data.companyName,
        subdomain: data.subdomain,
        email: data.email,
        // Explicitly exclude: admin_password, phone, address
      };
      logger.info('[SignupService] Creating tenant for:', safeLogData);
      const result = await Tenant.create(tenantData);

      // Log only safe result data
      const safeResult = {
        tenantId: result.tenantId,
        subdomain: result.subdomain,
        // Explicitly exclude any sensitive data from result
      };
      logger.info('[SignupService] Tenant created successfully:', safeResult);

      logger.info(`New tenant registered: ${data.companyName} (${data.subdomain})`);

      // TODO: Send welcome email
      // await sendWelcomeEmail(data.adminEmail, data.subdomain);

      return {
        tenantId: result.tenantId,
        userId: result.userId,
        subdomain: result.subdomain,
        trialEndsAt: result.trialEndsAt.toISOString(),
      };
    } catch (error: unknown) {
      console.info('[SignupService] CATCH BLOCK ENTERED');
      console.info('[SignupService] Error type:', error?.constructor?.name);
      console.info(
        '[SignupService] Error message:',
        error instanceof Error ? error.message : error,
      );

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
