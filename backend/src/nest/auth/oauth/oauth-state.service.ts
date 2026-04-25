/**
 * OAuth State Service — single-use state token cache for the authorization flow.
 *
 * Purpose:
 *   Defends against R2 (state replay / CSRF) by giving each in-flight authorization a
 *   unique, server-side-stored, atomically-consumed UUIDv7 token. The `state` parameter
 *   travels through the provider redirect; on callback we GETDEL it from Redis — second
 *   use returns null and gets rejected.
 *
 * Storage:
 *   Redis key namespace `oauth:state:{uuid}` (the `oauth:` prefix is automatic via the
 *   ioredis client's `keyPrefix`). 10-minute TTL — RFC 7636 best practice for short-lived
 *   PKCE-paired state.
 *
 * Why GETDEL (not GET + DEL pipeline):
 *   GETDEL (Redis 6.2+) is a single command — truly atomic across replicas. Our Redis
 *   image is 8.6.2 (verified at session start), well above the 6.2 minimum.
 *
 * Sensitive data warning:
 *   Stored payload contains the `codeVerifier`. We never log the payload contents.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2, Step 2.2)
 * @see ADR-001 — established ioredis 5.x as the project's Redis client.
 */
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { v7 as uuidv7 } from 'uuid';

import { getErrorMessage } from '../../common/utils/error.utils.js';
import { OAUTH_REDIS_CLIENT } from './oauth.tokens.js';
import type { OAuthMode, OAuthState } from './oauth.types.js';

/** State TTL — 10 minutes. Long enough for slow user, short enough to limit replay window. */
const STATE_TTL_SECONDS = 600;

/** Sub-prefix appended to the client-level `oauth:` keyPrefix → full key `oauth:state:{uuid}`. */
const STATE_KEY_PREFIX = 'state:';

@Injectable()
export class OAuthStateService {
  private readonly logger = new Logger(OAuthStateService.name);

  constructor(@Inject(OAUTH_REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Create a single-use authorization state token.
   *
   * @param mode 'login' or 'signup' — drives post-callback routing
   * @param codeVerifier RFC 7636 PKCE code_verifier (caller-generated, >=43 char URL-safe base64)
   * @param returnToSlug Subdomain the user started the flow on, if any (ADR-050 §OAuth).
   *                     Apex-initiated flows → omit. Subdomain-initiated flows → slug →
   *                     callback mints a handoff-token and redirects to that subdomain.
   * @returns The state UUID (UUIDv7) to send to the provider's authorize endpoint
   */
  async create(mode: OAuthMode, codeVerifier: string, returnToSlug?: string): Promise<string> {
    const state = uuidv7();
    // Conditional spread keeps payload.returnToSlug absent when undefined —
    // mirrors exactOptionalPropertyTypes (ADR-041) and keeps the isOAuthState
    // type-guard simple (undefined field ≠ explicitly-undefined field).
    const payload: OAuthState = {
      mode,
      codeVerifier,
      createdAt: Date.now(),
      ...(returnToSlug !== undefined && { returnToSlug }),
    };
    await this.redis.set(
      `${STATE_KEY_PREFIX}${state}`,
      JSON.stringify(payload),
      'EX',
      STATE_TTL_SECONDS,
    );
    return state;
  }

  /**
   * Consume a state token (atomic GETDEL). Returns the stored payload exactly once.
   * Subsequent calls with the same state throw UnauthorizedException — defends R2 (replay).
   *
   * @throws UnauthorizedException if state is unknown, expired, or already consumed
   */
  async consume(state: string): Promise<OAuthState> {
    const raw = await this.redis.getdel(`${STATE_KEY_PREFIX}${state}`);
    if (raw === null) {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
    return this.parseStateOrThrow(raw);
  }

  /** Parse + type-check the JSON payload — defends against tampered or corrupted Redis data. */
  private parseStateOrThrow(raw: string): OAuthState {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error: unknown) {
      // Never log `raw` — it contains the codeVerifier.
      this.logger.warn(`Failed to parse OAuth state payload: ${getErrorMessage(error)}`);
      throw new UnauthorizedException('Malformed OAuth state payload');
    }
    if (!OAuthStateService.isOAuthState(parsed)) {
      throw new UnauthorizedException('Malformed OAuth state payload');
    }
    return parsed;
  }

  /**
   * Type guard — narrow `unknown` JSON.parse result to OAuthState.
   * Static so it does not capture `this` (KISS, easier to test in isolation).
   */
  private static isOAuthState(value: unknown): value is OAuthState {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const v = value as Record<string, unknown>;
    if (
      !(v['mode'] === 'login' || v['mode'] === 'signup') ||
      typeof v['codeVerifier'] !== 'string' ||
      typeof v['createdAt'] !== 'number'
    ) {
      return false;
    }
    // ADR-050 §OAuth: returnToSlug optional — absent OR string. Anything else
    // (number, null, object, array) is a tampered payload and rejects.
    if (v['returnToSlug'] !== undefined && typeof v['returnToSlug'] !== 'string') {
      return false;
    }
    return true;
  }
}
