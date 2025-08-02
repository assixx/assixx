/**
 * Signup API v2 Types
 * Type definitions for user registration
 */

export interface SignupRequest {
  companyName: string;
  subdomain: string;
  email: string;
  phone: string;
  address?: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  selectedPlan?: string;
}

export interface SignupResponse {
  success: boolean;
  data: {
    tenantId: number;
    userId: number;
    subdomain: string;
    trialEndsAt: string;
    message: string;
  };
}

export interface SubdomainCheckRequest {
  subdomain: string;
}

export interface SubdomainCheckResponse {
  success: boolean;
  data: {
    available: boolean;
    subdomain: string;
    error?: string;
  };
}

export interface SubdomainValidation {
  valid: boolean;
  error?: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}

export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
