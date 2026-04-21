/**
 * OAuth Handoff Service — single-use token bridge for subdomain OAuth flows.
 *
 * Purpose (ADR-050 §OAuth, masterplan §Step 2.5d/2.5f):
 *   The OAuth callback lives on the apex (`www.assixx.com`) because the
 *   Microsoft Entra registered redirect-URI is single-valued. When a user
 *   started the flow on a subdomain, the apex callback cannot set cookies
 *   on the subdomain origin (browser same-origin policy). The handoff token
 *   carries the auth payload over the origin boundary: apex mints, subdomain
 *   page consumes and sets its own cookies. Handoff is opaque (32 random
 *   bytes), server-stored, single-use, 60-s TTL.
 *
 * Storage:
 *   Redis key namespace `oauth:handoff:{token}` (the `oauth:` prefix is
 *   automatic via the ioredis client's `keyPrefix`; shared with state /
 *   signup-ticket). 60-s TTL — long enough for the browser to chase the
 *   redirect, short enough to bound replay.
 *
 * R15 order discipline (masterplan §Step 2.5f):
 *   consume() ALWAYS reads first, then checks `hostTenantId === payload.tenantId`
 *   BEFORE deleting. A tampered redirect that lands the token on the wrong
 *   subdomain gets 403 without burning the token — the legitimate user's flow
 *   is not DoS'd by an attacker who intercepted the redirect. Only on
 *   host-match does the delete happen.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §OAuth
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 2 Step 2.5d / 2.5f
 * @see backend/src/nest/auth/oauth/oauth-state.service.ts — sibling pattern
 */
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Redis } from 'ioredis';

import { getErrorMessage } from '../../common/utils/error.utils.js';
import { OAUTH_REDIS_CLIENT } from './oauth.tokens.js';
import type { OAuthHandoffPayload } from './oauth.types.js';

/** Handoff TTL — 60 s. Covers the 302 → navigation → POST /handoff round-trip. */
const HANDOFF_TTL_SECONDS = 60;

/** Sub-prefix appended to the `oauth:` keyPrefix → full key `oauth:handoff:{token}`. */
const HANDOFF_KEY_PREFIX = 'handoff:';

/** Token length in bytes — 32 → 64 hex chars → 256 bits entropy. Mirrors session-token sizing. */
const TOKEN_BYTES = 32;

@Injectable()
export class OAuthHandoffService {
  private readonly logger = new Logger(OAuthHandoffService.name);

  constructor(@Inject(OAUTH_REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Mint a single-use handoff token carrying the auth payload across origins.
   *
   * @returns The opaque token (64 hex chars) — append to subdomain callback URL.
   */
  async mint(payload: Omit<OAuthHandoffPayload, 'createdAt'>): Promise<string> {
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const full: OAuthHandoffPayload = { ...payload, createdAt: Date.now() };
    await this.redis.set(
      `${HANDOFF_KEY_PREFIX}${token}`,
      JSON.stringify(full),
      'EX',
      HANDOFF_TTL_SECONDS,
    );
    return token;
  }

  /**
   * Consume a handoff token — R15 order: GET → host-check → DEL.
   *
   * @param token           Opaque token from the `?token=` query param.
   * @param hostTenantId    Request-host-derived tenant id from
   *                        `TenantHostResolverMiddleware`. MUST equal the
   *                        payload's tenantId — else 403 without deletion.
   * @returns The parsed payload on match.
   * @throws  NotFoundException   `HANDOFF_TOKEN_INVALID` — unknown / expired / malformed.
   * @throws  ForbiddenException  `HANDOFF_HOST_MISMATCH`  — host ≠ payload.tenantId
   *                                                          (token preserved for legit user).
   */
  async consume(token: string, hostTenantId: number | null): Promise<OAuthHandoffPayload> {
    const key = `${HANDOFF_KEY_PREFIX}${token}`;

    // Step 1: read WITHOUT deleting — see R15 rationale in file header.
    const raw = await this.redis.get(key);
    if (raw === null) {
      throw new NotFoundException({
        code: 'HANDOFF_TOKEN_INVALID',
        message: 'Handoff token is invalid or expired.',
      });
    }

    const payload = this.parseOrThrow(raw);

    // Step 2: host cross-check BEFORE deletion. Attacker-redirected handoff
    // hitting the wrong subdomain gets 403 without burning the token.
    if (hostTenantId === null || hostTenantId !== payload.tenantId) {
      throw new ForbiddenException({
        code: 'HANDOFF_HOST_MISMATCH',
        message: 'Handoff token does not match the request host.',
      });
    }

    // Step 3: single-use delete. Race window: two parallel GETs both pass
    // host-check, both try DEL; both succeed at returning payload (duplicate
    // cookie-set is benign). Acceptable over the Lua-script cost.
    await this.redis.del(key);
    return payload;
  }

  private parseOrThrow(raw: string): OAuthHandoffPayload {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error: unknown) {
      // Never log `raw` — payload carries accessToken/refreshToken.
      this.logger.warn(`Failed to parse OAuth handoff payload: ${getErrorMessage(error)}`);
      throw new NotFoundException({
        code: 'HANDOFF_TOKEN_INVALID',
        message: 'Handoff token payload is malformed.',
      });
    }
    if (!OAuthHandoffService.isHandoffPayload(parsed)) {
      throw new NotFoundException({
        code: 'HANDOFF_TOKEN_INVALID',
        message: 'Handoff token payload is malformed.',
      });
    }
    return parsed;
  }

  /** Static type-guard — no `this` capture, trivially unit-testable. */
  private static isHandoffPayload(value: unknown): value is OAuthHandoffPayload {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
      typeof v['userId'] === 'number' &&
      typeof v['tenantId'] === 'number' &&
      typeof v['accessToken'] === 'string' &&
      typeof v['refreshToken'] === 'string' &&
      typeof v['createdAt'] === 'number'
    );
  }
}
