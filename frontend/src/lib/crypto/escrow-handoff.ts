/**
 * Cross-Origin Escrow Unlock Ticket Mint (ADR-050 × ADR-022).
 *
 * Runs client-side on the apex AFTER a successful login (or 2FA verify),
 * BEFORE the cross-origin redirect to the user's tenant subdomain. Mints
 * a single-use Redis ticket that carries the Argon2id-derived `wrappingKey`
 * across the origin boundary — sessionStorage cannot bridge cross-origin
 * navigations, so the ticket-via-Redis path is the only way to keep the
 * ADR-022 escrow recovery flow working through ADR-050 subdomain handoffs.
 *
 * Why a separate module (lifted from `(public)/login/+page.svelte` on
 * 2026-05-01):
 *   - Pre-ADR-054 the credentials form was the only call site.
 *   - ADR-054 made 2FA mandatory for every password login → the verify
 *     form (`_lib/TwoFactorVerifyForm.svelte`) became the new hot path
 *     and inherited the same cross-origin requirement.
 *   - Two consumers need the same logic → DRY refactor instead of copy.
 *
 * Branches (discriminated by the server's escrow state):
 *
 *   1. **Unlock**     — escrow exists → derive wrappingKey from server-
 *                       stored salt + params → mint unlock ticket.
 *                       Subdomain unwraps the existing blob.
 *   2. **Bootstrap**  — no escrow AND server has no active key (true
 *                       first login) → fresh salt + defaults → derive →
 *                       mint bootstrap ticket carrying salt + params.
 *                       Subdomain generates first key + first escrow blob.
 *   3. **Skip**       — no escrow but server already has a key (existing
 *                       user, lost local state on this origin) →
 *                       bootstrap unsafe (would 409 on subdomain) → return
 *                       the redirect URL unchanged → subdomain
 *                       `e2e.initialize()` fail-closes with
 *                       `recoveryRequired: true` → admin reset is the
 *                       documented recovery path.
 *
 * Fail-closed by design: any failure in network, Worker, or response
 * shape returns `redirectTo` unchanged. The downstream subdomain init
 * either generates a fresh key (no server-key collision) or fail-closes
 * with `recoveryRequired: true` — never silent data loss.
 *
 * Security:
 *   - `accessToken` is used ONLY for the authenticated fetches inside
 *     this module; never persisted, never returned, GC'd at page unload.
 *   - `wrappingKey` is derived inside the Worker and serialised once
 *     into the POST body; it lives in this module's local scope until
 *     GC'd by the page unload that follows the redirect.
 *   - The ticket payload sits in Redis for ≤ 60 s (TTL enforced by
 *     `oauth:escrow:` keyspace) — equivalent threat model to the server
 *     having the password at bcrypt time, NOT a regression against rest-
 *     state DB dumps. See ADR-022 §"Cross-Origin Unlock Handoff".
 *
 * @see docs/infrastructure/adr/ADR-022-e2e-key-escrow.md
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md
 * @see docs/infrastructure/adr/ADR-054-mandatory-email-2fa.md
 */
import { createLogger } from '$lib/utils/logger';

import { cryptoBridge } from './crypto-bridge';

const log = createLogger('EscrowHandoff');

/**
 * Default Argon2id params used when bootstrapping an escrow for a brand-
 * new user. Matches the in-Worker `wrapKey` defaults so a same-origin
 * password-change re-encrypt can be done with comparable cost. Stored
 * alongside the blob for future param upgrades.
 */
const DEFAULT_ARGON2_PARAMS = { memory: 65536, iterations: 3, parallelism: 1 } as const;

interface EscrowMetadata {
  encryptedBlob: string;
  argon2Salt: string;
  xchachaNonce: string;
  argon2Params: { memory: number; iterations: number; parallelism: number };
}

/** Fetch existing escrow metadata. Returns null on 4xx/5xx OR `data: null`. */
async function fetchEscrow(accessToken: string): Promise<EscrowMetadata | null> {
  const resp = await fetch('/api/v2/e2e/escrow', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    log.warn(
      { status: resp.status },
      'Escrow fetch failed during handoff — continuing without unlock ticket',
    );
    return null;
  }
  const body = (await resp.json()) as {
    success?: boolean;
    data?: EscrowMetadata | null;
  };
  return body.data ?? null;
}

/**
 * Pre-flight check: does the server already hold an active E2E key for
 * this user? Used to distinguish "first-ever login" (no key, no escrow →
 * bootstrap) from "existing user without escrow" (key present, escrow
 * null → admin reset path).
 */
async function serverHasActiveKey(accessToken: string): Promise<boolean> {
  const resp = await fetch('/api/v2/e2e/keys/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    return false;
  }
  const body = (await resp.json()) as { success?: boolean; data?: unknown };
  return body.data !== null && body.data !== undefined;
}

/** Generate a fresh 32-byte salt as base64. */
function freshArgon2Salt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Mint the Redis ticket, return the URL with `?unlock=<id>` appended.
 * Returns `redirectTo` unchanged on any failure (silent → fail-closed
 * downstream — subdomain init handles recovery).
 */
async function mintTicketOrFallback(
  redirectTo: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<string> {
  const resp = await fetch('/api/v2/e2e/escrow/unlock-ticket', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    log.warn({ status: resp.status }, 'Unlock ticket mint failed — continuing without ticket');
    return redirectTo;
  }
  const respBody = (await resp.json()) as {
    success?: boolean;
    data?: { ticketId: string };
  };
  const ticketId = respBody.data?.ticketId;
  if (typeof ticketId !== 'string' || ticketId === '') {
    log.warn({ respBody }, 'Unlock ticket response malformed — continuing without ticket');
    return redirectTo;
  }
  const url = new URL(redirectTo);
  url.searchParams.set('unlock', ticketId);
  return url.toString();
}

/**
 * Mint a cross-origin escrow unlock ticket and return the redirect URL
 * with `?unlock=<id>` appended.
 *
 * @param redirectTo         Subdomain handoff URL the caller is about to
 *                           navigate to.
 * @param accessToken        Short-lived bearer for the authenticated
 *                           `/e2e/escrow*` fetches. Caller MUST NOT
 *                           persist it (already documented in callers).
 * @param userId             Per-user IndexedDB scope key for the Worker
 *                           (`assixx-e2e-user-${userId}`). Required so the
 *                           wrappingKey is bound to the right origin
 *                           namespace.
 * @param loginPasswordValue The plaintext password the user just typed.
 *                           Consumed once for Argon2id derivation, never
 *                           leaves this function's scope.
 * @returns The original `redirectTo` (skip / failure) or the same URL
 *          with `?unlock=<ticketId>` appended (success). NEVER throws —
 *          caller can navigate unconditionally.
 */
export async function mintUnlockTicketOrFallback(
  redirectTo: string,
  accessToken: string,
  userId: number,
  loginPasswordValue: string,
): Promise<string> {
  try {
    // Spin up the Worker. On apex this opens a per-user IndexedDB with no
    // existing key — a harmless no-op. The Worker is terminated by the
    // page unload that follows the redirect; nothing persists here.
    await cryptoBridge.init(userId);

    const escrow = await fetchEscrow(accessToken);
    if (escrow !== null) {
      // Unlock branch: derive from the server-stored salt + params.
      const wrappingKey = await cryptoBridge.deriveWrappingKey(
        loginPasswordValue,
        escrow.argon2Salt,
        escrow.argon2Params,
      );
      return await mintTicketOrFallback(redirectTo, accessToken, { wrappingKey });
    }

    // No escrow → check whether the server already has a key. If yes,
    // this is an existing user who lost local state on this origin —
    // bootstrap is unsafe (key already registered, can't reconcile
    // escrow). Skip the ticket and let the subdomain fail-close with
    // `recoveryRequired`.
    if (await serverHasActiveKey(accessToken)) {
      log.info(
        'No escrow but server has key — skipping bootstrap (admin reset required for this user)',
      );
      return redirectTo;
    }

    // Bootstrap branch: true first login. Mint fresh salt + params,
    // derive, mint a bootstrap ticket. Subdomain generates the key and
    // stores the first escrow.
    const argon2Salt = freshArgon2Salt();
    const argon2Params = { ...DEFAULT_ARGON2_PARAMS };
    const wrappingKey = await cryptoBridge.deriveWrappingKey(
      loginPasswordValue,
      argon2Salt,
      argon2Params,
    );
    return await mintTicketOrFallback(redirectTo, accessToken, {
      wrappingKey,
      argon2Salt,
      argon2Params,
    });
  } catch (err: unknown) {
    log.warn(
      { err: err instanceof Error ? err.message : 'unknown' },
      'Unlock ticket flow threw — continuing without ticket',
    );
    return redirectTo;
  }
}
