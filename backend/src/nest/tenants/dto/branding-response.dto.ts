/**
 * Branding Response
 *
 * Shape returned by `GET /api/v2/tenants/branding/:slug`.
 *
 * All three fields are nullable. `null` means either:
 *   - no active tenant row exists for that slug (unknown subdomain — don't
 *     leak existence via HTTP status), OR
 *   - the tenant exists but the field is empty in the DB (logo not uploaded,
 *     primary color never customised → rendered as default Assixx brand).
 *
 * The frontend's `resolveBrand(hostSlug, tenantName)` treats both cases
 * identically: fall back to the default Assixx brand.
 *
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.3
 */
export interface BrandingResponseData {
  /** Tenant display name (maps to `tenants.company_name`). */
  name: string | null;
  /** Tenant logo URL (maps to `tenants.logo_url`). */
  logoUrl: string | null;
  /** Tenant primary brand colour, hex `#RRGGBB` (maps to `tenants.primary_color`). */
  primaryColor: string | null;
}
