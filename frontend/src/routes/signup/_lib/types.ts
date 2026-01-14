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
 * Matches backend SignupSchema (backend/src/nest/signup/dto/signup.dto.ts)
 */
export interface RegisterPayload {
  // Company information
  companyName: string;
  subdomain: string;
  email: string; // Company contact email
  phone: string;
  address?: string;

  // Admin user information
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;

  // Subscription plan
  plan?: 'free' | 'basic' | 'professional' | 'enterprise' | 'trial';
}

/**
 * API response structure
 * Matches backend SignupResponseData (backend/src/nest/signup/dto/signup.dto.ts)
 */
export interface RegisterResponse {
  tenantId: number;
  userId: number;
  subdomain: string;
  trialEndsAt: string;
  message: string;
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
