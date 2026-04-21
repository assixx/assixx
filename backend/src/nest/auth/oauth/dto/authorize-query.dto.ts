/**
 * `GET /auth/oauth/microsoft/authorize?mode=login|signup[&return_to_slug=<slug>]`
 *
 * - `mode`: drives Microsoft prompt + post-callback routing (link-lookup vs. ticket-creation).
 * - `return_to_slug` (optional, ADR-050 §OAuth): subdomain the user started on.
 *   Used as a FALLBACK when `X-Forwarded-Host` is lost across the Nginx 307
 *   subdomain→apex bounce. Client-declared and tamper-prone, but R15's
 *   handoff host-cross-check neutralises tampering structurally — a forged
 *   slug lands the handoff on the wrong origin → 403 HANDOFF_HOST_MISMATCH.
 *   Server-trusted source is `X-Forwarded-Host`; query param is the bounce-case fallback.
 *
 * Slug regex mirrors `extractSlug()` so we reject malformed payloads at the
 * edge instead of propagating them to Redis.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2, Step 2.6 — controller endpoints)
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 2 Step 2.5
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const AuthorizeQuerySchema = z.object({
  mode: z.enum(['login', 'signup']),
  return_to_slug: z.string().regex(SLUG_REGEX).min(2).max(63).optional(),
});

export class AuthorizeQueryDto extends createZodDto(AuthorizeQuerySchema) {}
