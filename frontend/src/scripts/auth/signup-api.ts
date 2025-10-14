/**
 * Signup API Client
 *
 * Handles all API communication for signup process
 * Best Practice 2025: Separation of API logic from UI logic
 */

/**
 * Signup request data (API v2 format)
 */
export interface SignupData {
  companyName: string;
  subdomain: string;
  email: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  phone: string;
  plan: string;
}

/**
 * Signup success response
 */
export interface SignupSuccessResponse {
  success: true;
  message: string;
  data?: {
    tenantId?: number;
    subdomain?: string;
  };
}

/**
 * Signup error response
 */
export interface SignupErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
  };
  message?: string; // Fallback for legacy responses
}

/**
 * Signup response (success or error)
 */
export type SignupResponse = SignupSuccessResponse | SignupErrorResponse;

/**
 * Prepare signup data from form inputs
 */
export function prepareSignupData(
  companyName: string,
  subdomain: string,
  email: string,
  firstName: string,
  lastName: string,
  phone: string,
  countryCode: string,
  password: string,
  plan: string,
): SignupData {
  // Format phone with country code (remove spaces)
  const fullPhone = `${countryCode}${phone.replace(/\s+/g, '')}`;

  return {
    companyName,
    subdomain,
    email,
    adminEmail: email,
    adminPassword: password,
    adminFirstName: firstName,
    adminLastName: lastName,
    phone: fullPhone,
    plan,
  };
}

/**
 * Submit signup request to API
 */
export async function submitSignup(data: SignupData): Promise<SignupResponse> {
  const API_URL = '/api/v2/signup';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const responseText = await response.text();

    // Parse JSON response
    let result: SignupResponse;
    try {
      result = JSON.parse(responseText) as SignupResponse;
    } catch {
      // Invalid JSON response
      return {
        success: false,
        error: {
          message: `Server response was not valid JSON: ${responseText}`,
        },
      };
    }

    // Check if response is successful
    if (!response.ok && !result.success) {
      return result;
    }

    // Check v2 response structure
    if (!result.success) {
      return result;
    }

    // Success
    return result;
  } catch (error) {
    // Network or other error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      success: false,
      error: {
        message: `Ein Fehler ist aufgetreten: ${errorMessage}`,
      },
    };
  }
}

/**
 * Extract error message from response
 */
export function getErrorMessage(response: SignupResponse): string {
  if (response.success) {
    return '';
  }

  // error.message is guaranteed to exist (string type)
  if (response.error.message !== '') {
    return response.error.message;
  }

  // Fallback to legacy message field or default
  return response.message ?? 'Fehler bei der Registrierung';
}

/**
 * Check if signup was successful
 */
export function isSignupSuccessful(response: SignupResponse): response is SignupSuccessResponse {
  return response.success;
}
