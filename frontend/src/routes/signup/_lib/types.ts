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
 * API request payload for registration
 * Matches backend SignupSchema (backend/src/nest/signup/dto/signup.dto.ts)
 */
export interface RegisterPayload {
  // Company information
  companyName: string;
  subdomain: string;
  email: string; // Company contact email
  phone: string;

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
