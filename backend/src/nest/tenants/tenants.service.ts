/**
 * Tenants Service — public branding lookup for the `(public)` SvelteKit route group.
 *
 * Only one method: `getBranding(slug)`. Consumed by an unauthenticated endpoint
 * (`GET /api/v2/tenants/branding/:slug`) called by the frontend's SSR load
 * function to render per-tenant login/signup/forgot-password pages on the
 * subdomain origin (ADR-050 §Decision — subdomain identity + branding).
 *
 * Cache-through against Redis (5-minute TTL). DB access uses `systemQuery()`
 * (BYPASSRLS, ADR-019) because this is pre-auth context — no CLS tenant
 * identity exists when an unauthenticated visitor hits the login page.
 *
 * Fail-soft semantics mirror `TenantHostResolverMiddleware`: Redis outage or
 * DB outage → return the "null brand" and let the frontend fall back to the
 * default Assixx identity. Branding MUST NOT be a hard availability dependency
 * for the login surface.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Cookies: Browser-Native Isolation"
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.3
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { DatabaseService } from '../database/database.service.js';
import type { BrandingResponseData } from './dto/index.js';
import { TENANTS_BRANDING_REDIS_CLIENT } from './tenants.tokens.js';

/** 5 minute Redis TTL — see token file comment for rationale. */
const CACHE_TTL_SECONDS = 300;

/**
 * Null-brand sentinel returned when the slug has no matching active tenant,
 * or when Redis / DB errors. Frontend treats it as "use default Assixx brand".
 */
const NULL_BRAND: BrandingResponseData = {
  name: null,
  logoUrl: null,
  primaryColor: null,
};

/** Shape of the rows returned by the branding SELECT. */
interface BrandingRow {
  company_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @Inject(TENANTS_BRANDING_REDIS_CLIENT) private readonly redis: Redis,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Resolve a tenant's public branding fields by subdomain slug.
   *
   * Returns the null-brand sentinel for:
   *   - unknown slug (no active tenant row)
   *   - Redis outage (cache read fails)
   *   - DB outage (systemQuery throws)
   *
   * The caller CANNOT distinguish these from "slug exists but fields are
   * empty" — intentionally, because leaking "is this slug real?" via 404 vs
   * 200 creates a tenant-enumeration side channel.
   */
  async getBranding(slug: string): Promise<BrandingResponseData> {
    try {
      const cached = await this.readCache(slug);
      if (cached !== null) return cached;

      const fresh = await this.readFromDatabase(slug);
      if (fresh !== null) {
        await this.writeCache(slug, fresh);
        return fresh;
      }

      return NULL_BRAND;
    } catch (error: unknown) {
      // Intentionally swallow: branding MUST NOT take down login.
      this.logger.warn(
        `Branding lookup failed for slug "${slug}" — falling back to null brand: ${String(error)}`,
      );
      return NULL_BRAND;
    }
  }

  /** Read the cache entry for a slug. Parse failures return null (treat as miss). */
  private async readCache(slug: string): Promise<BrandingResponseData | null> {
    const raw = await this.redis.get(slug);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      return TenantsService.isBrandingShape(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  /** DB lookup via `systemQuery()` — pre-auth, no tenant context, BYPASSRLS. */
  private async readFromDatabase(slug: string): Promise<BrandingResponseData | null> {
    const rows = await this.databaseService.systemQuery<BrandingRow>(
      `SELECT company_name, logo_url, primary_color
         FROM tenants
        WHERE subdomain = $1 AND deletion_status = 'active'`,
      [slug],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      name: row.company_name ?? null,
      logoUrl: row.logo_url ?? null,
      primaryColor: row.primary_color ?? null,
    };
  }

  /** Write fresh branding into Redis with 5-minute TTL. */
  private async writeCache(slug: string, data: BrandingResponseData): Promise<void> {
    await this.redis.set(slug, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
  }

  /** Static type-guard — defends against corrupted cache entries. */
  private static isBrandingShape(value: unknown): value is BrandingResponseData {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    const okName = v['name'] === null || typeof v['name'] === 'string';
    const okLogo = v['logoUrl'] === null || typeof v['logoUrl'] === 'string';
    const okColor = v['primaryColor'] === null || typeof v['primaryColor'] === 'string';
    return okName && okLogo && okColor;
  }
}
