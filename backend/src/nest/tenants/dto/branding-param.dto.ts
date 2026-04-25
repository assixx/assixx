/**
 * Branding Param DTO
 *
 * Validates the `:slug` path parameter for `GET /tenants/branding/:slug`.
 *
 * Regex matches the signup DTO's slug shape (`^[a-z0-9][a-z0-9-]*[a-z0-9]$`,
 * 3–50 chars) — the strictest valid-slug rule in the codebase. Reserved-slug
 * enforcement (ADR-050 §"Reserved Slug List") is deliberately NOT applied
 * here: reserved slugs can never be persisted (DB CHECK constraint blocks
 * inserts), so a branding lookup for e.g. `www` simply returns a miss →
 * default Assixx brand. Adding the reserved check here would be dead code.
 *
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.3
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const BrandingSlugSchema = z
  .string()
  .min(3, 'Subdomain must be at least 3 characters')
  .max(50, 'Subdomain cannot exceed 50 characters')
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Subdomain must contain only lowercase letters, numbers, and hyphens',
  )
  .transform((val: string) => val.toLowerCase().trim());

export const BrandingParamSchema = z.object({
  slug: BrandingSlugSchema,
});

export class BrandingParamDto extends createZodDto(BrandingParamSchema) {}
