/**
 * Handoff-Mint DTO — `POST /auth/handoff/mint` (Session 12c, ADR-050).
 *
 * Purpose: the frontend password-login action calls this endpoint when the
 * user authenticated on the apex (`hostSlug === null`) but their tenant has
 * a subdomain. We mint a single-use handoff token carrying the auth payload,
 * redirect the browser to the subdomain-scoped consumer page (Session 12),
 * and let the subdomain set its own cookies. Same Redis keyspace + same
 * consumer as the OAuth handoff (Session 7) — reuse, no new plumbing.
 *
 * Why `refreshToken` in body (not derived from cookie / auth header):
 *   The endpoint is Bearer-authenticated (JwtAuthGuard), so the accessToken
 *   lives in the Authorization header. The refreshToken has stricter scope
 *   (sameSite:'strict', path:'/api/v2/auth') and does NOT flow automatically
 *   on arbitrary requests. The frontend SSR action holds both tokens
 *   in-memory right after login; forwarding the refreshToken explicitly
 *   keeps this endpoint stateless + reusable without cookie gymnastics.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §OAuth (handoff reuse)
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Session 12c
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const HandoffMintSchema = z.object({
  /** Raw refresh JWT issued by the same `/auth/login` call that produced the Bearer. */
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export class HandoffMintDto extends createZodDto(HandoffMintSchema) {}

/**
 * Response shape for `POST /auth/handoff/mint`.
 *
 * - `token`: 64 hex chars, single-use, 60 s TTL, consumed via the existing
 *   `POST /auth/oauth/handoff` endpoint on the subdomain.
 * - `subdomain`: the tenant's routing slug (`tenants.subdomain`). Always
 *   non-null here — the endpoint returns 404 if the tenant has no subdomain
 *   (the frontend should never have minted in that case).
 */
export interface HandoffMintResponse {
  token: string;
  subdomain: string;
}
