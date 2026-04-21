/**
 * Tenant Host Resolver Middleware
 *
 * Runs BEFORE `JwtAuthGuard`. Reads the request Host (preferring the
 * nginx-set `X-Forwarded-Host`), resolves it to a tenant id via a Redis
 * cache-through lookup against the `tenants` table, and stores the result
 * on `req.hostTenantId`.
 *
 * The middleware never rejects — downstream guards decide. It is purely
 * a source of truth for "which tenant does this host represent?". The
 * cross-check that turns the value into a security boundary lives in
 * `JwtAuthGuard` (throw 403 if JWT.tenantId ≠ req.hostTenantId).
 *
 * Three-state output semantics on `req.hostTenantId`:
 *
 *   | Value       | Meaning                           | Guard behaviour    |
 *   | ----------- | --------------------------------- | ------------------ |
 *   | `undefined` | middleware did not run            | skip cross-check   |
 *   | `null`      | apex / localhost / IP / unknown   | skip cross-check   |
 *   | `number`    | subdomain resolved to this tenant | MUST match JWT     |
 *
 * Unknown slug → `null` (NOT 404). Rationale: we do not want to leak
 * "is this subdomain real?" via timing, and the JWT remains the ground
 * truth for tenant context regardless of what the URL claims.
 *
 * Error policy: Redis outage or DB outage → `null` + warn-log + continue.
 * Subdomain routing must not be a hard availability dependency for the
 * general request flow; the JWT path still works (cross-check skipped
 * like on localhost).
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §Decision
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 2 Step 2.2
 */
import { Inject, Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import type { IncomingMessage } from 'node:http';

import { DatabaseService } from '../../database/database.service.js';
import { extractSlug } from '../utils/extract-slug.js';
import { TENANT_HOST_REDIS_CLIENT } from './tenant-host-resolver.tokens.js';

/**
 * Request augmentation for the ADR-050 cross-tenant host-check.
 *
 * ── Object-identity caveat (discovered Session 10, API integration test) ────
 * NestJS class-based middleware mounted via `MiddlewareConsumer` runs under
 * `@fastify/middie` — which passes the **raw** `http.IncomingMessage` to the
 * middleware's `use()` method, NOT the Fastify-wrapped `FastifyRequest`.
 * That raw object is later exposed on the Fastify request as `.raw`. So the
 * middleware writes `hostTenantId` to the IncomingMessage; guards and
 * controllers read it via `request.raw.hostTenantId`, not `request.hostTenantId`.
 *
 * Putting the property on a shape named `HostAwareRaw` and exposing it on
 * `FastifyRequest.raw` makes the split explicit at the type level — any
 * consumer that writes `request.hostTenantId` directly is a type error, not
 * a runtime silent-skip.
 *
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Session 10 (D17)
 */
export interface HostAwareRaw {
  hostTenantId?: number | null;
}

/**
 * The FastifyRequest seen by guards/controllers after the middleware ran.
 * `hostTenantId` is read via `request.raw` (see `HostAwareRaw` rationale above).
 */
export interface HostAwareRequest extends FastifyRequest {
  raw: IncomingMessage & HostAwareRaw;
}

/**
 * Redis cache TTL for slug → tenant-id lookup. 60 s:
 *   1. Bounds R13 cache-poisoning blast-radius to 1 min.
 *   2. Long enough to amortise DB hits across bursts.
 *   3. Short enough that subdomain changes propagate in ≤ 1 min.
 */
const CACHE_TTL_SECONDS = 60;

/**
 * Redis key prefix under the module-level `keyPrefix: 'tenant:'`, giving
 * final keys `tenant:slug:<slug>`.
 */
const CACHE_KEY_PREFIX = 'slug:';

interface TenantIdRow {
  id: number;
}

@Injectable()
export class TenantHostResolverMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantHostResolverMiddleware.name);

  constructor(
    @Inject(TENANT_HOST_REDIS_CLIENT) private readonly redis: Redis,
    private readonly databaseService: DatabaseService,
  ) {}

  async use(req: FastifyRequest, _res: FastifyReply, next: () => void): Promise<void> {
    // @fastify/middie gives us the raw IncomingMessage despite the
    // FastifyRequest type (type annotation kept for downstream docs-friendliness).
    // Writing to `req` here writes to what the Fastify adapter later exposes as
    // `FastifyRequest.raw` — guards/controllers read via `request.raw.hostTenantId`.
    const hostAware = req as unknown as IncomingMessage & HostAwareRaw;
    try {
      const host = this.readHost(req);
      const slug = extractSlug(host);

      if (slug === null) {
        hostAware.hostTenantId = null;
        next();
        return;
      }

      hostAware.hostTenantId = await this.resolveTenantId(slug);
    } catch (error: unknown) {
      this.logger.warn(
        `Host resolver failure — defaulting hostTenantId=null and continuing: ${String(error)}`,
      );
      hostAware.hostTenantId = null;
    }

    next();
  }

  /**
   * Read the hostname. Preference order:
   *   1. `X-Forwarded-Host` — set by nginx in prod, trusted because Fastify
   *      is configured with `trustProxy: true` (main.ts:284, ADR-050 §"Fastify
   *      trustProxy prerequisite"). Without the trust flag, this would be
   *      attacker-controlled and the cross-check would be defeated.
   *   2. `Host` header — always present in HTTP/1.1; used when the request
   *      bypasses nginx (internal docker-network, cron jobs, deletion-worker,
   *      localhost dev).
   *
   * Returning `undefined` when neither is set is OK — `extractSlug(undefined)`
   * returns `null`.
   */
  private readHost(req: FastifyRequest): string | undefined {
    const fwd = req.headers['x-forwarded-host'];
    if (typeof fwd === 'string' && fwd !== '') return fwd;
    if (Array.isArray(fwd) && fwd[0] !== undefined && fwd[0] !== '') return fwd[0];

    const hostHeader = req.headers.host;
    if (typeof hostHeader === 'string' && hostHeader !== '') return hostHeader;

    return undefined;
  }

  /**
   * Redis cache-through lookup. Misses fall back to `systemQuery()` —
   * BYPASSRLS pool (ADR-019 Triple-User Model) because this is pre-auth
   * context, no CLS tenantId exists yet, so RLS would return 0 rows.
   *
   * Filter `deletion_status = 'active'` — the tenants table uses a
   * dedicated enum `tenants_deletion_status` (values: `active`,
   * `marked_for_deletion`, `suspended`, `deleting`) for the soft-delete
   * lifecycle. Only `active` tenants are routable.
   *
   * NOT filtered on `status` (`trial`/`active`/`suspended`/`cancelled`):
   * suspended/cancelled tenants still need their subdomain to resolve so
   * the frontend can render an informative "subscription required" page
   * instead of a generic 404. That UX decision lives in the frontend
   * layer, not here.
   *
   * Deviation from masterplan §2.2 ("AND is_active = 1"): the `tenants`
   * table has no `is_active` column — that was a mechanical copy-paste
   * from the `users` table convention. Documented as deviation in the
   * Session 6 log entry.
   */
  private async resolveTenantId(slug: string): Promise<number | null> {
    const cacheKey = `${CACHE_KEY_PREFIX}${slug}`;

    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      const n = Number(cached);
      return Number.isFinite(n) && n > 0 ? n : null;
    }

    const rows = await this.databaseService.systemQuery<TenantIdRow>(
      `SELECT id FROM tenants WHERE subdomain = $1 AND deletion_status = 'active'`,
      [slug],
    );
    const tenantId = rows[0]?.id ?? null;

    if (tenantId !== null) {
      await this.redis.set(cacheKey, String(tenantId), 'EX', CACHE_TTL_SECONDS);
    }

    return tenantId;
  }
}
