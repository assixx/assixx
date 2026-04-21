/**
 * Public Route Group — SSR Load
 *
 * Runs for every route in the `(public)` group (login, signup,
 * forgot-password). Resolves the page brand from the request host and
 * exposes it through `PageData` so child pages can render per-tenant
 * titles without each re-fetching branding.
 *
 * Data flow:
 *   hooks.server.ts → extracts `hostSlug` via `extractSlug()` → locals
 *     ↓
 *   this load      → fetches `/api/v2/tenants/branding/:slug` (5-min
 *                     backend Redis cache) → computes `brand` via
 *                     `resolveBrand()` → returned in PageData
 *     ↓
 *   +page.svelte   → reads `data.brand.title` / `data.brand.subtitle`
 *
 * Fail-soft: any fetch error / parse error / non-200 response falls back
 * to the default Assixx brand. The login page MUST render even if Redis
 * and the DB are both unavailable.
 *
 * Apex (`hostSlug === null`) short-circuits — no branding fetch, saves a
 * round-trip for the dominant traffic pattern (apex = marketing surface).
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.3
 */
import { resolveBrand, type Brand } from '$lib/utils/branding';
import { createLogger } from '$lib/utils/logger';

import type { LayoutServerLoad } from './$types';

const log = createLogger('(public)/+layout.server');

/** Backend API base URL — mirrors the pattern in `hooks.server.ts`. */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface BrandingApiData {
  name: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}

interface BrandingApiResponse {
  success?: boolean;
  data?: BrandingApiData;
  // Backends may also return the unwrapped shape (ResponseInterceptor wraps
  // camelCase `data` on success; defensive shape-check below handles both).
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

const NULL_BRANDING: BrandingApiData = {
  name: null,
  logoUrl: null,
  primaryColor: null,
};

/**
 * Hit the backend branding endpoint and extract the `data` payload. Returns
 * the null-branding sentinel on any error so the caller can unconditionally
 * pass the result into `resolveBrand()`.
 */
async function fetchBranding(slug: string): Promise<BrandingApiData> {
  try {
    const response = await fetch(`${API_BASE}/tenants/branding/${encodeURIComponent(slug)}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      log.debug({ slug, status: response.status }, 'Branding fetch non-OK — default brand');
      return NULL_BRANDING;
    }
    const json = (await response.json()) as BrandingApiResponse;
    // Accept both wrapped (`{ success, data: {...} }`) and flat shapes —
    // some test/dev paths bypass the global ResponseInterceptor.
    if (json.data !== undefined) return json.data;
    if (json.name !== undefined || json.logoUrl !== undefined || json.primaryColor !== undefined) {
      return {
        name: json.name ?? null,
        logoUrl: json.logoUrl ?? null,
        primaryColor: json.primaryColor ?? null,
      };
    }
    return NULL_BRANDING;
  } catch (err: unknown) {
    log.warn({ slug, err }, 'Branding fetch threw — default brand');
    return NULL_BRANDING;
  }
}

export interface PublicLayoutData {
  /** Tenant subdomain slug (string) or `null` on apex/localhost/unknown host. */
  hostSlug: string | null;
  /** Resolved brand — always populated (falls back to default Assixx on any error). */
  brand: Brand;
  /** Raw tenant logo URL for V2 image swap. `null` = default Assixx logo. */
  logoUrl: string | null;
  /** Raw tenant primary colour for V2 theming. `null` = default palette. */
  primaryColor: string | null;
}

export const load: LayoutServerLoad = async ({ locals }): Promise<PublicLayoutData> => {
  const { hostSlug } = locals;

  // Apex short-circuit — no branding fetch needed, saves a round-trip.
  if (hostSlug === null) {
    return {
      hostSlug: null,
      brand: resolveBrand(null, null),
      logoUrl: null,
      primaryColor: null,
    };
  }

  const branding = await fetchBranding(hostSlug);
  return {
    hostSlug,
    brand: resolveBrand(hostSlug, branding.name),
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
  };
};
