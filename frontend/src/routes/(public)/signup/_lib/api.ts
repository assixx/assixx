// =============================================================================
// SIGNUP PAGE - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { ApiError } from '$lib/utils/api-client.types';

import { EMAIL_VALIDATION_MESSAGES, ERROR_MESSAGES } from './constants';

import type { RegisterPayload, RegisterResponse } from './types';

const apiClient = getApiClient();

/**
 * Registers a new user/tenant.
 *
 * @throws Error if registration fails. Backend signup-validation codes
 *   (`INVALID_FORMAT`, `DISPOSABLE_EMAIL`, `FREE_EMAIL_PROVIDER` per
 *   `validateBusinessEmail`, masterplan §2.3 + ADR-048) are mapped to the
 *   German `EMAIL_VALIDATION_MESSAGES` table from `_lib/constants.ts`.
 *   Unknown codes fall through to the generic `registrationFailed` message.
 */
export async function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  try {
    // Public signup endpoint (creates tenant + admin user)
    // Note: /auth/register is for admins creating users, /signup is for public tenant registration
    return await apiClient.post<RegisterResponse>('/signup', payload, {
      useAuth: false,
    });
  } catch (err: unknown) {
    // Map backend signup-validation codes to German UI messages BEFORE the
    // generic fallback. Per masterplan v0.3.9: `ApiError` exposes `.code` as
    // a public field (api-client.types.ts:115) so a direct lookup works
    // without the `extractValidationCode()` helper the v0.3.0 plan-text
    // pseudocode proposed. `Object.hasOwn` (over `in`) guards against
    // prototype-pollution surface — irrelevant for a static literal but the
    // safer default for `Record<string, string>` lookups.
    if (err instanceof ApiError && Object.hasOwn(EMAIL_VALIDATION_MESSAGES, err.code)) {
      throw new Error(EMAIL_VALIDATION_MESSAGES[err.code], { cause: err });
    }

    // Re-throw with user-friendly message (existing behavior preserved for
    // non-validation errors: network failures, 5xx, unknown codes).
    const message =
      err instanceof Error && err.message !== '' ? err.message : ERROR_MESSAGES.registrationFailed;
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
}): RegisterPayload {
  // Format phone: combine country code + digits only
  const phoneDigits = formData.phone.replace(/\s/g, '');
  const fullPhone = `${formData.countryCode}${phoneDigits}`;

  return {
    companyName: formData.companyName,
    subdomain: formData.subdomain,
    email: formData.email,
    phone: fullPhone,
    adminEmail: formData.email,
    adminPassword: formData.password,
    adminFirstName: formData.firstName,
    adminLastName: formData.lastName,
  };
}
