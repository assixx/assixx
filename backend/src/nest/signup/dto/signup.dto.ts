/**
 * Signup DTO
 *
 * Data transfer object for tenant registration.
 * Uses Zod for runtime validation.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { EmailSchema } from '../../../schemas/common.schema.js';

// ========================================
// SCHEMA DEFINITIONS
// ========================================

/**
 * Reserved subdomain slugs — hard-blocked at signup.
 *
 * WHY: these labels would collide with our own infra — apex (`www`),
 * future infra-subdomains (`api`, `cdn`, `static`, `mail`, `status`,
 * `support`), observability tooling (`admin`, `app`, `docs`, `blog`,
 * `grafana`, `health`, `auth`, `assets`, `tempo`), and protocol-
 * reserved literals (`localhost`, `test` per RFC 6761). Mirrored
 * at the DB layer via `tenants_subdomain_reserved_check` CHECK
 * constraint (migration 20260421102820830) as defense-in-depth.
 *
 * Keep in exact sync with the CHECK constraint. The list is
 * conservative — cheaper to un-reserve later than reclaim from a
 * paying customer.
 *
 * TECH-DEBT (post-Phase-6): this schema + regex is duplicated in
 * `check-subdomain.dto.ts`. Extract to `shared/src/` when the slug
 * validation gains more refinements. Tracked in D4 resolution.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Reserved Slug List"
 */
export const RESERVED_SUBDOMAINS = [
  'www',
  'api',
  'admin',
  'app',
  'assets',
  'auth',
  'cdn',
  'docs',
  'blog',
  'grafana',
  'health',
  'localhost',
  'mail',
  'static',
  'status',
  'support',
  'tempo',
  'test',
] as const;

/**
 * Subdomain validation pattern
 * - Only lowercase letters, numbers, and hyphens
 * - Must start with letter/number
 * - Cannot end with hyphen
 * - 3-50 characters
 * - NOT in RESERVED_SUBDOMAINS (ADR-050)
 */
const SubdomainSchema = z
  .string()
  .min(3, 'Subdomain must be at least 3 characters')
  .max(50, 'Subdomain cannot exceed 50 characters')
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Subdomain must contain only lowercase letters, numbers, and hyphens',
  )
  .transform((val: string) => val.toLowerCase().trim())
  .refine((val: string) => !(RESERVED_SUBDOMAINS as readonly string[]).includes(val), {
    message: 'This subdomain is reserved and cannot be used.',
  });

/**
 * Company name validation
 */
const CompanyNameSchema = z
  .string()
  .min(2, 'Company name must be at least 2 characters')
  .max(100, 'Company name cannot exceed 100 characters')
  .regex(
    /^[a-zA-Z\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df0-9\s\-&.,()]+$/,
    'Company name contains invalid characters',
  )
  .transform((val: string) => val.trim());

/**
 * Phone validation
 */
const PhoneSchema = z
  .string()
  .min(6, 'Phone number too short')
  .max(30, 'Phone number too long')
  .regex(/^[+0-9\s\-()]+$/, 'Invalid phone number format')
  .transform((val: string) => val.trim());

/**
 * Password validation
 */
const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password cannot exceed 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Name validation
 */
const NameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(50, 'Name cannot exceed 50 characters')
  .regex(
    /^[a-zA-Z\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df\s\-']+$/,
    'Name contains invalid characters',
  )
  .transform((val: string) => val.trim());

/**
 * Street name validation
 */
const StreetSchema = z
  .string()
  .min(1, 'Street is required')
  .max(255, 'Street cannot exceed 255 characters')
  .regex(
    /^[a-zA-Z0-9\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df\s\-.,/()]+$/,
    'Street contains invalid characters',
  )
  .transform((val: string) => val.trim());

/**
 * House number validation (e.g. "42", "12a", "5/3")
 */
const HouseNumberSchema = z
  .string()
  .min(1, 'House number is required')
  .max(20, 'House number cannot exceed 20 characters')
  .regex(/^[a-zA-Z0-9\s\-/]+$/, 'House number contains invalid characters')
  .transform((val: string) => val.trim());

/**
 * Postal code validation (international: 3-20 chars)
 */
const PostalCodeSchema = z
  .string()
  .min(3, 'Postal code must be at least 3 characters')
  .max(20, 'Postal code cannot exceed 20 characters')
  .regex(/^[a-zA-Z0-9\s-]+$/, 'Postal code contains invalid characters')
  .transform((val: string) => val.trim());

/**
 * City name validation
 */
const CitySchema = z
  .string()
  .min(1, 'City is required')
  .max(100, 'City cannot exceed 100 characters')
  .regex(
    /^[a-zA-Z\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df\s\-.,()'/]+$/,
    'City contains invalid characters',
  )
  .transform((val: string) => val.trim());

/**
 * ISO 3166-1 alpha-2 country code validation (e.g. "DE", "AT", "US")
 */
const CountryCodeSchema = z
  .string()
  .length(2, 'Country code must be exactly 2 characters')
  .regex(/^[A-Z]{2}$/, 'Country code must be two uppercase letters')
  .transform((val: string) => val.toUpperCase());

// ========================================
// REQUEST SCHEMA
// ========================================

/**
 * Main signup request validation
 */
export const SignupSchema = z.object({
  // Company information
  companyName: CompanyNameSchema,
  subdomain: SubdomainSchema,
  email: EmailSchema,
  phone: PhoneSchema,

  // Structured address (international) — optional at signup, completed in /settings/company
  street: StreetSchema.optional(),
  houseNumber: HouseNumberSchema.optional(),
  postalCode: PostalCodeSchema.optional(),
  city: CitySchema.optional(),
  countryCode: CountryCodeSchema.optional(),

  // Admin user information
  adminEmail: EmailSchema,
  adminPassword: PasswordSchema,
  adminFirstName: NameSchema,
  adminLastName: NameSchema,
});

// ========================================
// DTO CLASS
// ========================================

/**
 * DTO for tenant signup request
 */
export class SignupDto extends createZodDto(SignupSchema) {}

// ========================================
// RESPONSE TYPES
// ========================================

/**
 * Signup success response data.
 *
 * `tenantVerificationRequired` (§2.8) — `true` for password signup (new
 * tenant must prove DNS TXT ownership of `adminEmail`'s domain before it
 * can create further users), `false` for OAuth signup (§2.8b — Azure AD
 * is the trust boundary, domain is auto-verified). Frontend reads this
 * field to conditionally surface the "Verify your domain" banner.
 */
export interface SignupResponseData {
  tenantId: number;
  userId: number;
  subdomain: string;
  trialEndsAt: string;
  message: string;
  tenantVerificationRequired: boolean;
}
