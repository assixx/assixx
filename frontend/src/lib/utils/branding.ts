/**
 * Brand Resolver — maps host + tenant context to the page-level brand shape
 * consumed by `(public)` route group pages (login / signup / forgot-password).
 *
 * Inputs:
 *   - `hostSlug` — from `event.locals.hostSlug` (set by `hookResolverHandle`
 *     in `hooks.server.ts`). `null` means apex / localhost / unknown host.
 *   - `tenantName` — from `GET /api/v2/tenants/branding/:slug`. `null` means
 *     the slug did not resolve to an active tenant, OR the field was empty.
 *
 * Outputs are deliberately minimal (V1 scope — ADR-050 masterplan Phase 5
 * Step 5.3): just a `title` + `subtitle`. Logo URL and primary colour are
 * carried through the `(public)/+layout.server.ts` `PageData` shape so
 * future V2 work can swap the logo image and theme colour without touching
 * this helper — resolveBrand() stays centred on the text identity.
 *
 * Fallback policy: any missing / null / empty input falls back to the
 * default Assixx brand. A dead Redis + dead DB still renders a working
 * login page — branding MUST NEVER be a hard availability dependency.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Decision"
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.3
 */

export interface Brand {
  /**
   * Brand identifier — used as the `X` in page titles like "Anmelden – X".
   * Apex / unknown subdomain → "Assixx". Subdomain with resolved name → the
   * tenant's `company_name`.
   */
  title: string;
  /** Marketing tagline shown below the logo / brand label. */
  subtitle: string;
}

const DEFAULT_BRAND: Brand = {
  title: 'Assixx',
  subtitle: 'Enterprise-Plattform für Industrieunternehmen',
};

export function resolveBrand(hostSlug: string | null, tenantName: string | null): Brand {
  if (hostSlug === null || tenantName === null || tenantName === '') {
    return DEFAULT_BRAND;
  }
  return {
    title: tenantName,
    subtitle: `${tenantName} — powered by Assixx`,
  };
}
