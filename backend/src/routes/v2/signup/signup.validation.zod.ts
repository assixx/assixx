/**
 * Signup Route Validation Schemas
 * CRITICAL: User registration validation - prevents SQL injection, XSS, and invalid data
 */
import { z } from 'zod';

/**
 * Subdomain validation pattern
 * - Only lowercase letters, numbers, and hyphens
 * - Must start with letter/number
 * - Cannot end with hyphen
 * - 3-50 characters
 */
const SubdomainSchema = z
  .string()
  .min(3, 'Subdomain must be at least 3 characters')
  .max(50, 'Subdomain cannot exceed 50 characters')
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Subdomain must contain only lowercase letters, numbers, and hyphens',
  )
  .transform((val: string) => val.toLowerCase().trim());

/**
 * Company name validation
 * - Required, 2-100 characters
 * - No special characters that could cause XSS
 */
const CompanyNameSchema = z
  .string()
  .min(2, 'Company name must be at least 2 characters')
  .max(100, 'Company name cannot exceed 100 characters')
  .regex(/^[a-zA-ZäöüÄÖÜß0-9\s\-&.,()]+$/, 'Company name contains invalid characters')
  .transform((val: string) => val.trim());

/**
 * Email validation with normalization
 */
const EmailSchema = z
  .string()
  .max(255, 'Email cannot exceed 255 characters')
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- False positive, email() is the correct method in Zod v4
  .email('Invalid email address')
  .transform((val: string) => val.toLowerCase().trim());

/**
 * Phone validation - allows common formats
 */
const PhoneSchema = z
  .string()
  .min(6, 'Phone number too short')
  .max(30, 'Phone number too long')
  .regex(/^[+0-9\s\-()]+$/, 'Invalid phone number format')
  .transform((val: string) => val.trim());

/**
 * Password validation
 * - Minimum 8 characters
 * - Must contain: uppercase, lowercase, number
 * - Optional: special character
 */
const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password cannot exceed 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Name validation (first/last name)
 */
const NameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(50, 'Name cannot exceed 50 characters')
  .regex(/^[a-zA-ZäöüÄÖÜß\s\-']+$/, 'Name contains invalid characters')
  .transform((val: string) => val.trim());

/**
 * Address validation (optional)
 */
const AddressSchema = z
  .string()
  .max(255, 'Address cannot exceed 255 characters')
  .regex(/^[a-zA-Z0-9äöüÄÖÜß\s\-,./]+$/, 'Address contains invalid characters')
  .transform((val: string) => val.trim())
  .optional();

/**
 * Plan validation - must be valid plan type
 */
const PlanSchema = z
  .enum(['free', 'basic', 'professional', 'enterprise', 'trial'], {
    message: 'Invalid subscription plan',
  })
  .default('trial');

// ========================================
// REQUEST SCHEMAS
// ========================================

/**
 * Main signup request validation
 * CRITICAL: Validates all user registration data
 */
export const SignupRequestSchema = z.object({
  // Company information
  companyName: CompanyNameSchema,
  subdomain: SubdomainSchema,
  email: EmailSchema,
  phone: PhoneSchema,
  address: AddressSchema,

  // Admin user information
  adminEmail: EmailSchema,
  adminPassword: PasswordSchema,
  adminFirstName: NameSchema,
  adminLastName: NameSchema,

  // Subscription
  plan: PlanSchema.optional(),
});

/**
 * Subdomain availability check validation
 */
export const SubdomainCheckRequestSchema = z.object({
  subdomain: SubdomainSchema,
});

// ========================================
// TYPE EXPORTS
// ========================================

export type SignupRequestBody = z.infer<typeof SignupRequestSchema>;
export type SubdomainCheckRequestBody = z.infer<typeof SubdomainCheckRequestSchema>;

// ========================================
// VALIDATION ERROR FORMATTER
// ========================================

/**
 * Format Zod errors for consistent API response
 */
export function formatSignupValidationError(error: z.ZodError): {
  field: string;
  message: string;
}[] {
  // eslint-disable-next-line @typescript-eslint/typedef -- Zod's internal type
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
