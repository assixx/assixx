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
 * Allowed character whitelist for passwords — ASCII only, no umlauts/accents/emojis.
 *
 * WHY (2026-04-30): cross-component UTF-8 handling (login form ↔ DB collation ↔ bcrypt
 * 72-BYTE limit ↔ JSON transport) is a recurring source of "password works in Postman
 * but not in prod" bugs. Industry precedent: Microsoft Entra, AWS Cognito, GitHub all
 * reject non-ASCII passwords with a dedicated error. The whitelist is exactly the union
 * of the 4 category classes (A-Z, a-z, 0-9, special) plus space — anything outside
 * fails fast with a clear error BEFORE the category counter runs.
 *
 * Bug uncovered during this hardening: prior code silently accepted `Prüfung12345!`
 * because `/[a-z]/` is ASCII-only — so `ü` was simply ignored, neither counted nor
 * rejected. With the whitelist refine, the password is rejected at the first gate.
 */
const ALLOWED_PASSWORD_CHARS = /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/? ]+$/;

/**
 * Password validation with strict policy (Assixx 2026-04-30)
 * - Minimum: 12 characters (NIST 800-63B recommendation)
 * - Maximum: 72 characters (BCrypt limitation — truncates at 72 bytes)
 * - Charset: ASCII printable only — no umlauts/accents/emojis (whitelist refine)
 * - Complexity: ALL 4 character categories required (uppercase + lowercase + digit + special)
 *
 * WHY tightened from "3 of 4" to "all 4" (2026-04-30): the previous "3 of 4" rule allowed
 * predictable patterns like `Password1234` (no special) or `password123!` (no upper) that
 * passed validation but had low real-world entropy. Forcing all four categories is the
 * minimum-viable UX-honest message ("you MUST include each") without introducing zxcvbn /
 * pwned-password gates (separate scope). Tests confirmed: every dev/test fixture password
 * (`ApiTest12345!`, `TestFirmaA12345!`, `TestScs12345!`, `Unverified12345!`, `SecurePass123!`)
 * already satisfies 4/4 — no test breakage. Existing user logins are unaffected (bcrypt
 * compare only, no re-validation). Only password reset / change after this date enforces 4/4.
 *
 * NOTE: BCrypt has a 72-byte limit. We use 72 chars to be safe with UTF-8 (now moot with
 * the ASCII-only whitelist — every char is exactly 1 byte). For longer passwords, consider
 * migrating to Argon2id.
 */
export const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(72, 'Password cannot exceed 72 characters (BCrypt limit)')
  .refine((password: string) => ALLOWED_PASSWORD_CHARS.test(password), {
    // Order matters: whitelist gate BEFORE category counter, so non-ASCII inputs
    // get a clear "disallowed character" error instead of a confusing "missing
    // lowercase" error (the category regexes are ASCII-only and silently skip
    // umlauts/accents).
    message:
      'Password contains disallowed characters. Only ASCII letters (A-Z, a-z), digits (0-9), and the special characters !@#$%^&*()_+-=[]{};\':"\\|,.<>/? are allowed (no umlauts, accents, or emojis).',
  })
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

      // Require ALL 4 categories (tightened 2026-04-30)
      return categoriesPresent === 4;
    },
    {
      message:
        'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>/?)',
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
 * Pagination query parameters with defaults.
 *
 * WHY z.coerce + .default (and not z.preprocess + .default):
 * Zod 4.x changed semantics: `.default(N)` no longer triggers when the
 * preprocess function returns `undefined` for a missing query param —
 * the inner schema receives `undefined` and reports
 * `"expected nonoptional, received undefined"`. ADR-030 §4 mandates
 * `z.coerce.number()` over `z.preprocess` for exactly this reason.
 * Migrated 2026-04-30 after the regression surfaced as 400 on
 * `GET /api/v2/logs?limit=5` (root-dashboard SSR loader).
 *
 * Behavior contract (matches Zod-3 era expectations):
 *   - page    → string|number coerced; missing → default 1
 *   - limit   → string|number coerced; missing → default 10
 *   - offset  → string|number coerced; missing → undefined (truly optional)
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).optional(),
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
