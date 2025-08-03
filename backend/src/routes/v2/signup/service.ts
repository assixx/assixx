/**
 * Signup Service v2
 * Business logic for user registration
 */

import Tenant from "../../../models/tenant.js";
import { logger } from "../../../utils/logger.js";
import { ServiceError } from "../../../utils/ServiceError.js";

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
    console.log("[SignupService] METHOD CALLED");
    console.log("[SignupService] Input data:", data);
    logger.info("[SignupService] Starting registerTenant with data:", {
      companyName: data.companyName,
      subdomain: data.subdomain,
      email: data.email,
      adminEmail: data.adminEmail,
      phone: data.phone,
      plan: data.plan,
    });
    console.log("[SignupService] Logger called");

    try {
      console.log("[SignupService] Entering try block");
      // Validate subdomain format
      logger.info("[SignupService] Validating subdomain:", data.subdomain);
      console.log("[SignupService] About to validate subdomain");
      const subdomainValidation: SubdomainValidation = Tenant.validateSubdomain(
        data.subdomain,
      );
      console.log("[SignupService] Validation result:", subdomainValidation);
      logger.info(
        "[SignupService] Subdomain validation result:",
        subdomainValidation,
      );

      if (!subdomainValidation.valid) {
        console.log("[SignupService] Invalid subdomain, throwing error");
        throw new ServiceError(
          "INVALID_SUBDOMAIN",
          subdomainValidation.error ?? "Invalid subdomain format",
        );
      }
      console.log("[SignupService] Subdomain is valid");

      // Check if subdomain is available
      logger.info("[SignupService] Checking subdomain availability");
      const isAvailable = await Tenant.isSubdomainAvailable(data.subdomain);
      logger.info("[SignupService] Subdomain available:", isAvailable);

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
      logger.info("[SignupService] Creating tenant with data:", tenantData);
      const result = await Tenant.create(tenantData);
      logger.info("[SignupService] Tenant created successfully:", result);

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
      console.log("[SignupService] CATCH BLOCK ENTERED");
      console.log("[SignupService] Error type:", error?.constructor?.name);
      console.log(
        "[SignupService] Error message:",
        error instanceof Error ? error.message : error,
      );

      if (error instanceof ServiceError) {
        console.log("[SignupService] Re-throwing ServiceError");
        throw error;
      }

      console.log(
        "[SignupService] Not a ServiceError, logging and throwing REGISTRATION_FAILED",
      );
      logger.error("Error registering tenant:", error);
      logger.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        data: data,
      });
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
      const validation: SubdomainValidation =
        Tenant.validateSubdomain(subdomain);
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
