/**
 * Escrow Unlock Ticket Service — single-use wrapping-key transport
 * for cross-origin login handoff (ADR-022 × ADR-050).
 *
 * Purpose:
 *   ADR-022 makes the user's private E2E key recoverable via an escrow blob
 *   unwrapped by Argon2id(password, salt). Same-origin login bridges the
 *   password from form to `e2e.initialize()` via an in-memory module
 *   (`login-password-bridge.ts`) — module memory dies across origin, so
 *   ADR-050's subdomain redirect breaks the handoff: the subdomain cannot
 *   re-derive the wrapping key without the password.
 *
 *   This service stores the client-derived wrappingKey in Redis for 60s
 *   under a UUIDv7 ticket, returned to the apex login flow. The subdomain
 *   consumes the ticket via `POST /e2e/escrow/consume-unlock` (authenticated,
 *   host-cross-checked) and receives the wrappingKey — enough to unwrap the
 *   blob client-side WITHOUT password re-entry and without the ~1s
 *   Argon2id round-trip.
 *
 * Why the wrappingKey is acceptable to relay server-side:
 *   The wrappingKey is derived client-side from the password the user is
 *   about to submit to our login endpoint anyway — the server already sees
 *   the password at bcrypt time. Storing the derived key in Redis for 60s
 *   adds a narrow time-window during which a Redis + DB dump combined
 *   would yield the escrow blob's plaintext key. The TTL + single-use
 *   GETDEL + bound-to-user constraint bound this. We document the trade-off
 *   in ADR-022 Amendment (B1 variant).
 *
 * Pattern mirror:
 *   Wire-for-wire identical to `OAuthStateService` (oauth:state:) and
 *   `OAuthHandoffService` (oauth:handoff:): ioredis + UUIDv7 + GETDEL.
 *   Reusing the pattern keeps the security story simple — "one more
 *   single-use Redis ticket, third in our codebase". Different keyspace
 *   (`escrow:`) so throttler / oauth / escrow can be flushed independently
 *   in dev.
 *
 * Security invariants:
 *   1. Ticket bound to `{ userId, tenantId }` at create time, cross-checked
 *      at consume time → another authenticated user cannot replay.
 *   2. TTL 60s — narrow attack window vs. Redis-dump + in-flight ticket.
 *   3. GETDEL atomic (Redis 6.2+, confirmed 8.6.2 in use) — no race.
 *   4. 128-bit UUIDv7 entropy — unguessable.
 *   5. NEVER log the wrappingKey value (same rule as codeVerifier in OAuth).
 *
 * @see ADR-022 (E2E Key Escrow)
 * @see ADR-050 (Tenant Subdomain Routing — cross-origin handoff rationale)
 * @see backend/src/nest/auth/oauth/oauth-state.service.ts (pattern source)
 */
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { v7 as uuidv7 } from 'uuid';

import { getErrorMessage } from '../common/utils/error.utils.js';
import { ESCROW_REDIS_CLIENT } from './e2e-escrow.tokens.js';

/** Sub-prefix — full key becomes `escrow:unlock:{uuidv7}` via client-level keyPrefix. */
const UNLOCK_KEY_PREFIX = 'unlock:';

/** Ticket TTL in seconds. 60s matches the OAuth handoff ticket; long enough for a
 * cross-origin 303 redirect + first-render of the app layout to consume, short
 * enough that an unused ticket is irrelevant before the user notices. */
const UNLOCK_TTL_SECONDS = 60;

/** Server-side payload — NEVER exposed in responses other than as `wrappingKey` on consume. */
interface UnlockTicketPayload {
  wrappingKey: string;
  userId: number;
  tenantId: number;
  createdAt: number;
}

@Injectable()
export class EscrowUnlockTicketService {
  private readonly logger = new Logger(EscrowUnlockTicketService.name);

  constructor(@Inject(ESCROW_REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Mint a single-use unlock ticket. Returns the UUIDv7 ticket ID; the
   * caller embeds this in the subdomain handoff URL as `?unlock=<id>`.
   */
  async create(userId: number, tenantId: number, wrappingKey: string): Promise<string> {
    const ticketId = uuidv7();
    const payload: UnlockTicketPayload = {
      wrappingKey,
      userId,
      tenantId,
      createdAt: Date.now(),
    };
    await this.redis.set(
      `${UNLOCK_KEY_PREFIX}${ticketId}`,
      JSON.stringify(payload),
      'EX',
      UNLOCK_TTL_SECONDS,
    );
    // Audit log — ticket ID is safe (already returned to client), wrappingKey is NOT logged.
    this.logger.log(`Escrow unlock ticket minted for user ${userId} (tenant ${tenantId})`);
    return ticketId;
  }

  /**
   * Consume a ticket atomically. Returns the stored wrappingKey exactly once.
   *
   * Cross-check: the payload's `userId` + `tenantId` MUST match the
   * authenticated caller. This defends against a leaked ticket being
   * redeemed by another user — a raw URL containing a ticket is only useful
   * if the redeeming session matches the minting session.
   *
   * @throws UnauthorizedException if ticket is unknown, expired, consumed,
   *         tampered, or bound to a different user.
   */
  async consume(ticketId: string, userId: number, tenantId: number): Promise<string> {
    const raw = await this.redis.getdel(`${UNLOCK_KEY_PREFIX}${ticketId}`);
    if (raw === null) {
      throw new UnauthorizedException('Invalid or expired escrow unlock ticket');
    }

    const payload = this.parsePayloadOrThrow(raw);

    if (payload.userId !== userId || payload.tenantId !== tenantId) {
      // Log the mismatch — this is either a bug or an attack, and either way
      // the defender should know. Do NOT echo the stored userId/tenantId back
      // to the client (the exception message stays generic).
      this.logger.warn(
        `Escrow unlock ticket consumer mismatch: ticket bound to user ` +
          `${payload.userId}/tenant ${payload.tenantId}, ` +
          `consumer is user ${userId}/tenant ${tenantId}`,
      );
      throw new UnauthorizedException('Escrow unlock ticket does not match consumer identity');
    }

    return payload.wrappingKey;
  }

  /** Parse + type-check the JSON payload. Never log `raw` — it contains the wrappingKey. */
  private parsePayloadOrThrow(raw: string): UnlockTicketPayload {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error: unknown) {
      this.logger.warn(`Failed to parse escrow unlock payload: ${getErrorMessage(error)}`);
      throw new UnauthorizedException('Malformed escrow unlock ticket');
    }
    if (!EscrowUnlockTicketService.isPayload(parsed)) {
      throw new UnauthorizedException('Malformed escrow unlock ticket');
    }
    return parsed;
  }

  /** Type guard — narrow `unknown` to UnlockTicketPayload. Static (no `this` capture). */
  private static isPayload(value: unknown): value is UnlockTicketPayload {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const v = value as Record<string, unknown>;
    return (
      typeof v['wrappingKey'] === 'string' &&
      typeof v['userId'] === 'number' &&
      typeof v['tenantId'] === 'number' &&
      typeof v['createdAt'] === 'number'
    );
  }
}
