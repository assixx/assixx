// =============================================================================
// SIGNUP PAGE - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';

import { ERROR_MESSAGES } from './constants';

import type { RegisterPayload, RegisterResponse } from './types';

const apiClient = getApiClient();

/**
 * Registers a new user/tenant.
 *
 * @throws Error if registration fails
 */
export async function registerUser(
  payload: RegisterPayload,
): Promise<RegisterResponse> {
  try {
    // Public signup endpoint (creates tenant + admin user)
    // Note: /auth/register is for admins creating users, /signup is for public tenant registration
    return await apiClient.post<RegisterResponse>('/signup', payload, {
      useAuth: false,
    });
  } catch (err) {
    // Re-throw with user-friendly message
    const message =
      err instanceof Error && err.message !== '' ?
        err.message
      : ERROR_MESSAGES.registrationFailed;
    throw new Error(message, { cause: err });
  }
}

/** Creates the API payload from form data (matches backend SignupSchema) */
export function createRegisterPayload(formData: {
  companyName: string;
  subdomain: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  countryCode: string;
  password: string;
  selectedPlan: string;
}): RegisterPayload {
  // Format phone: combine country code + digits only
  const phoneDigits = formData.phone.replace(/\s/g, '');
  const fullPhone = `${formData.countryCode}${phoneDigits}`;

  return {
    // Company information
    companyName: formData.companyName,
    subdomain: formData.subdomain,
    email: formData.email, // Company contact email (same as admin for now)
    phone: fullPhone,

    // Admin user information
    adminEmail: formData.email, // Admin uses same email as company contact
    adminPassword: formData.password,
    adminFirstName: formData.firstName,
    adminLastName: formData.lastName,

    // Subscription plan
    plan: formData.selectedPlan as RegisterPayload['plan'],
  };
}
