// =============================================================================
// SIGNUP PAGE - TYPE DEFINITIONS
// =============================================================================

/**
 * Country option for phone number prefix selector
 */
export interface Country {
  flag: string; // Emoji flag (e.g., "🇩🇪")
  code: string; // Country code (e.g., "+49")
}

/**
 * Subscription plan option
 */
export interface Plan {
  value: string; // Internal value (e.g., "enterprise")
  name: string; // Display name (e.g., "Enterprise")
  price: string; // Price display (e.g., "€149/M")
}

/**
 * Form data structure (internal state)
 */
export interface SignupFormData {
  companyName: string;
  subdomain: string;
  email: string;
  emailConfirm: string;
  firstName: string;
  lastName: string;
  phone: string;
  countryCode: string;
  password: string;
  passwordConfirm: string;
  selectedPlan: string;
  termsAccepted: boolean;
}

/**
 * API request payload for registration
 */
export interface RegisterPayload {
  company_name: string;
  subdomain: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  password: string;
  plan: string;
}

/**
 * API response structure
 */
export interface RegisterResponse {
  success: boolean;
  data?: {
    id: number;
    message: string;
  };
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Form validation errors
 */
export interface FormErrors {
  subdomain: string | null;
  emailMatch: string | null;
  phone: string | null;
  password: string | null;
  passwordMatch: string | null;
}

/**
 * Password strength score (0-4)
 * 0 = very weak, 1 = weak, 2 = fair, 3 = strong, 4 = very strong
 */
export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

/**
 * Password strength information
 */
export interface PasswordStrength {
  score: PasswordStrengthScore;
  label: string;
  time: string;
  warning: string;
  suggestions: string[];
}
