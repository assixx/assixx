/**
 * Common Zod Schemas for Assixx
 * Reusable schemas and types based on Zod documentation best practices
 */
import { z } from 'zod';

// ============================================================
// BASIC TYPES - Frequently reused base schemas
// ============================================================

/**
 * ID validation with string-to-number transform
 * Handles both string and number inputs
 * Returns undefined for empty strings to avoid NaN issues
 */
export const IdSchema = z.preprocess((val: unknown) => {
  if (val === undefined || val === null || val === '') {
    return undefined;
  }
  if (typeof val === 'string') {
    const parsed = Number.parseInt(val, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return val;
}, z.number().int().positive('ID must be a positive integer'));

/**
 * Email validation with normalization
 */
export const EmailSchema = z
  .string()
  .min(1, 'Email is required')
  .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid email address')
  .toLowerCase()
  .trim();

/**
 * Password validation with MODERN security requirements (2024 Standards)
 * - Minimum: 12 characters (NIST 800-63B recommendation)
 * - Maximum: 72 characters (BCrypt limitation - truncates at 72 bytes)
 * - Complexity: At least 3 out of 4 character categories
 *
 * NOTE: BCrypt has a 72-byte limit. We use 72 chars to be safe with UTF-8.
 * For longer passwords, consider migrating to Argon2id.
 */
export const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(72, 'Password cannot exceed 72 characters (BCrypt limit)')
  .refine(
    (password: string) => {
      // Count how many character categories are present
      let categoriesPresent = 0;

      // Category 1: Uppercase letters
      if (/[A-Z]/.test(password)) categoriesPresent++;

      // Category 2: Lowercase letters
      if (/[a-z]/.test(password)) categoriesPresent++;

      // Category 3: Numbers
      if (/\d/.test(password)) categoriesPresent++;

      // Category 4: Special characters (common set)
      if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) categoriesPresent++;

      // Require at least 3 out of 4 categories
      return categoriesPresent >= 3;
    },
    {
      message:
        'Password must contain characters from at least 3 of the following: uppercase, lowercase, numbers, special characters (!@#$%^&*)',
    },
  );

/**
 * Username validation
 * NOTE: Username = Email in our system, so we allow email characters (\@, ., etc.)
 * The regex is relaxed to accept email-like usernames
 */
export const UsernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(255, 'Username must be at most 255 characters')
  .transform((val: string) => val.toLowerCase().trim());

/**
 * Role enum - matches database ENUM
 */
export const RoleSchema = z.enum(['admin', 'employee', 'root', 'dummy']);

// ============================================================
// PAGINATION - Query parameter schemas
// ============================================================

/**
 * Pagination query parameters with defaults
 * Transforms string inputs to numbers automatically
 */
export const PaginationSchema = z.object({
  page: z.preprocess((val: unknown) => {
    if (typeof val === 'string' || typeof val === 'number') {
      return Number.parseInt(val.toString(), 10);
    }
    return 1;
  }, z.number().int().min(1).default(1)),
  limit: z.preprocess((val: unknown) => {
    if (typeof val === 'string' || typeof val === 'number') {
      return Number.parseInt(val.toString(), 10);
    }
    return 10;
  }, z.number().int().min(1).max(100).default(10)),
  offset: z.preprocess((val: unknown) => {
    if (typeof val === 'string' || typeof val === 'number') {
      return Number.parseInt(val.toString(), 10);
    }
    return undefined;
  }, z.number().int().min(0).optional()),
});

/**
 * Search query with optional filters
 */
export const SearchQuerySchema = PaginationSchema.extend({
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// ============================================================
// DATE/TIME - Date and time validation
// ============================================================

/**
 * ISO date string validation
 * Using refine instead of regex to avoid false positive security warnings
 */
export const DateSchema = z.string().refine(
  (val: string) => {
    // ISO 8601 date format: YYYY-MM-DDTHH:mm:ss[.sss][Z]
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    return isoDatePattern.test(val);
  },
  { message: 'Invalid date format. Use ISO 8601 format' },
);

/**
 * Time format HH:MM
 */
export const TimeSchema = z
  .string()
  .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM');

// ============================================================
// TENANT - Multi-tenant validation
// ============================================================

/**
 * Tenant ID validation (never 0)
 */
export const TenantIdSchema = z
  .number()
  .int()
  .positive('Invalid tenant ID')
  .refine((val: number) => val !== 0, 'Tenant ID cannot be 0');
