// =============================================================================
// SIGNUP PAGE - API FUNCTIONS
// =============================================================================

import type { RegisterPayload, RegisterResponse } from './types';
import { ERROR_MESSAGES } from './constants';

/**
 * Registers a new user/tenant
 *
 * @param payload - Registration data
 * @returns Promise with registration result
 * @throws Error if registration fails
 */
export async function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  const response = await fetch('/api/v2/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result: RegisterResponse = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? ERROR_MESSAGES.registrationFailed);
  }

  return result;
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
