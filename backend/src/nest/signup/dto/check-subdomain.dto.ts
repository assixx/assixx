/**
 * Check Subdomain DTO
 *
 * Data transfer object for subdomain availability check.
 * Uses Zod for runtime validation.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { RESERVED_SUBDOMAINS } from './signup.dto.js';

// ========================================
// SCHEMA DEFINITION
// ========================================

/**
 * Subdomain validation pattern
 * - Only lowercase letters, numbers, and hyphens
 * - Must start with letter/number
 * - Cannot end with hyphen
 * - 3-50 characters
 * - NOT in RESERVED_SUBDOMAINS (ADR-050)
 *
 * NOTE: schema shape is intentionally duplicated with `signup.dto.ts` —
 * D4 resolution in the masterplan flags extraction to `shared/` as
 * post-Phase-6 tech-debt. Importing `RESERVED_SUBDOMAINS` from the
 * signup DTO keeps the list single-source while the regex stays local.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Reserved Slug List"
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
 * Subdomain availability check validation
 */
export const CheckSubdomainParamSchema = z.object({
  subdomain: SubdomainSchema,
});

// ========================================
// DTO CLASS
// ========================================

/**
 * DTO for subdomain check path parameter
 */
export class CheckSubdomainParamDto extends createZodDto(CheckSubdomainParamSchema) {}

// ========================================
// RESPONSE TYPE
// ========================================

/**
 * Subdomain check response data
 */
export interface SubdomainCheckResponseData {
  available: boolean;
  subdomain: string;
  error?: string;
}
