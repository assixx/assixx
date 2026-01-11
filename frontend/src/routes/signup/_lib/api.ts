// =============================================================================
// SIGNUP PAGE - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';

import { ERROR_MESSAGES } from './constants';

import type { RegisterPayload, RegisterResponse } from './types';

const apiClient = getApiClient();

/**
 * Registers a new user/tenant
 *
 * @param payload - Registration data
 * @returns Promise with registration result
 * @throws Error if registration fails
 */
export async function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  try {
    // Registration endpoint is unauthenticated
    return await apiClient.post<RegisterResponse>('/auth/register', payload, {
      useAuth: false,
    });
  } catch (err) {
    // Re-throw with user-friendly message
    const message =
      err instanceof Error && err.message !== '' ? err.message : ERROR_MESSAGES.registrationFailed;
    throw new Error(message);
  }
}

/**
 * Creates the API payload from form data
 *
 * @param formData - Form data from the signup form
 * @returns API payload ready to send
 */
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
    company_name: formData.companyName,
    subdomain: formData.subdomain,
    email: formData.email,
    first_name: formData.firstName,
    last_name: formData.lastName,
    phone: fullPhone,
    password: formData.password,
    plan: formData.selectedPlan,
  };
}
