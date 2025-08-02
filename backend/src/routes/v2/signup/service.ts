/**
 * Signup Service v2
 * Business logic for user registration
 */

import Tenant from "../../../models/tenant.js";
import { ServiceError } from "../../../utils/ServiceError.js";
import { logger } from "../../../utils/logger.js";

import { SignupRequest, SubdomainValidation } from "./types.js";

export class SignupService {
  /**
   * Register a new tenant and admin user
   */
  async registerTenant(data: SignupRequest): Promise<{
    tenantId: number;
    userId: number;
    subdomain: string;
    trialEndsAt: string;
  }> {
    try {
      // Validate subdomain format
      const subdomainValidation: SubdomainValidation = Tenant.validateSubdomain(
        data.subdomain,
      );
      if (!subdomainValidation.valid) {
        throw new ServiceError(
          "INVALID_SUBDOMAIN",
          subdomainValidation.error ?? "Invalid subdomain format",
        );
      }

      // Check if subdomain is available
      const isAvailable = await Tenant.isSubdomainAvailable(data.subdomain);
      if (!isAvailable) {
        throw new ServiceError(
          "SUBDOMAIN_TAKEN",
          "This subdomain is already taken",
        );
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
      const result = await Tenant.create(tenantData);

      logger.info(
        `New tenant registered: ${data.companyName} (${data.subdomain})`,
      );

      // TODO: Send welcome email
      // await sendWelcomeEmail(data.adminEmail, data.subdomain);

      return {
        tenantId: result.tenantId,
        userId: result.userId,
        subdomain: result.subdomain,
        trialEndsAt: result.trialEndsAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      
      logger.error("Error registering tenant:", error);
      throw new ServiceError(
        "REGISTRATION_FAILED",
        "Failed to complete registration",
      );
    }
  }

  /**
   * Check if a subdomain is available
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
    } catch (error) {
      logger.error("Error checking subdomain availability:", error);
      throw new ServiceError(
        "CHECK_FAILED",
        "Failed to check subdomain availability",
      );
    }
  }

  /**
   * Validate subdomain format
   */
  validateSubdomain(subdomain: string): SubdomainValidation {
    return Tenant.validateSubdomain(subdomain);
  }
}

export const signupService = new SignupService();