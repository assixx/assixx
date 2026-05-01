/**
 * E2E Reactive State — Svelte 5 Runes
 *
 * Provides reactive E2E encryption state for the entire app.
 * Initialized in +layout.svelte on mount, locked on explicit logout.
 *
 * @see docs/plans/IMPLEMENT-E2E-ENCRYPTION.md (Section 6.5)
 */
import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import { cryptoBridge } from './crypto-bridge';
import { consumeLoginPassword, clearLoginPassword } from './login-password-bridge';

const log = createLogger('E2eState');

/** Escrow API path — single-source so future renames only touch one line. */
const ESCROW_ENDPOINT = '/e2e/escrow';

// =============================================================================
// TYPED ERRORS
// =============================================================================

/**
 * Thrown when local IndexedDB and server public key have diverged and escrow
 * recovery is not possible (no password bridge available, wrong password, or
 * no escrow blob). Fail-closed instead of silently rotating the server key —
 * rotation destroys every counterparty's ability to decrypt historical
 * messages (ADR-022 §Motivation, 2026-02-11 incident).
 *
 * Resolution: admin must reset the user's key via `DELETE /e2e/keys/:userId`,
 * then the user regenerates on next login.
 *
 * @see docs/infrastructure/adr/ADR-022-e2e-key-escrow.md
 */
export class E2eKeyError extends Error {
  readonly code: 'key_mismatch' | 'server_has_key_no_recovery';
  constructor(code: 'key_mismatch' | 'server_has_key_no_recovery', message: string) {
    super(message);
    this.name = 'E2eKeyError';
    this.code = code;
  }
}

// =============================================================================
// REACTIVE STATE
// =============================================================================

interface E2eState {
  /** Whether the CryptoWorker is initialized and keys are available */
  isReady: boolean;
  /** Current user's base64 public key (null if not yet generated) */
  publicKey: string | null;
  /** SHA-256 hex fingerprint of the public key */
  fingerprint: string | null;
  /** Whether storage persistence was granted */
  persisted: boolean;
  /** Server key version — needed for server-side version validation on send */
  keyVersion: number | null;
  /** Error message if initialization failed */
  error: string | null;
  /**
   * True iff init failed with an E2eKeyError (unrecoverable key divergence).
   * Distinguishes "init errored, recovery needed" from "init still running /
   * never started". 1:1 chat MUST refuse plaintext fallback when this is true,
   * otherwise the UI silently downgrades encryption without the user noticing.
   */
  recoveryRequired: boolean;
}

let e2eState = $state<E2eState>({
  isReady: false,
  publicKey: null,
  fingerprint: null,
  keyVersion: null,
  persisted: false,
  error: null,
  recoveryRequired: false,
});

/** Synchronous state setter — avoids require-atomic-updates false positives in async functions */
function setE2eState(newState: E2eState): void {
  e2eState = newState;
}

// =============================================================================
// PUBLIC API
// =============================================================================

export const e2e = {
  /** Reactive state — use in templates as e2e.state.isReady */
  get state(): E2eState {
    return e2eState;
  },

  /**
   * Initialize E2E encryption for a specific user.
   * - Starts the CryptoWorker with user-scoped IndexedDB
   * - Checks for existing keys
   * - Attempts escrow recovery if no local key but server has escrow (ADR-022)
   * - Generates keys if needed (auto, silent)
   * - Uploads public key to server
   * - Creates server escrow blob for future recovery
   *
   * Safe to call multiple times — no-ops if already ready.
   */
  async initialize(userId: number): Promise<void> {
    if (e2eState.isReady) {
      return;
    }

    try {
      log.info({ userId }, 'Initializing CryptoWorker…');
      const { hasKey, persisted } = await cryptoBridge.init(userId);
      log.info({ hasKey, persisted }, 'Worker init complete');

      // Consume login password once for escrow operations (ADR-022)
      // Only available during login flow — null on page refresh or session resume
      const loginPassword = consumeLoginPassword();
      const resolved = await resolveOrRecoverKey(hasKey, loginPassword);

      log.info(
        { fingerprint: resolved.fingerprint.substring(0, 16) + '…' },
        'E2E initialization COMPLETE — isReady=true',
      );
      setE2eState({
        isReady: true,
        publicKey: resolved.publicKey,
        fingerprint: resolved.fingerprint,
        keyVersion: resolved.keyVersion,
        persisted,
        error: null,
        recoveryRequired: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'E2E initialization failed';
      // ADR-022: distinguish "unrecoverable divergence" (needs admin reset) from
      // "init crashed for other reasons" (transient, retry may help). Only the
      // former must block plaintext fallback in 1:1 chat.
      const recoveryRequired = err instanceof E2eKeyError;
      setE2eState({
        isReady: false,
        publicKey: null,
        fingerprint: null,
        keyVersion: null,
        persisted: false,
        error: message,
        recoveryRequired,
      });
      log.error({ err: message, recoveryRequired }, 'E2E initialization FAILED');
    } finally {
      // Safety net — ensure login password never lingers in memory
      clearLoginPassword();
    }
  },

  /**
   * Cross-origin escrow bootstrap (ADR-050 × ADR-022).
   *
   * Consumes a single-use ticket minted on apex during login. Two ticket
   * kinds are possible (discriminated by `bootstrap` field on the consume
   * response):
   *
   *   1. **Unlock ticket** — escrow exists. Subdomain unwraps the existing
   *      blob with the apex-derived wrappingKey, no Argon2id pass.
   *   2. **Bootstrap ticket** (ADR-022 §"New-user scenario") — no escrow
   *      yet, server has no active key. Subdomain generates the first
   *      X25519 key pair, registers it, and creates the user's first
   *      escrow blob using the apex-derived wrappingKey + carried salt
   *      and params.
   *
   * `userId` is required because the Worker scopes IndexedDB per user
   * (`assixx-e2e-user-${userId}`); passing the wrong userId lands the key
   * in the wrong namespace and the subsequent `initialize()` would miss it.
   *
   * Contract:
   *   - MUST be called BEFORE `initialize()` in the subdomain's layout.
   *     On success `initialize()` finds `hasKey=true` and takes the happy
   *     path. On failure we fall through to normal `initialize()` which
   *     then fail-closes per Phase A if the server has a key we can't
   *     recover.
   *   - Ticket is single-use → never retry on same ticket; a second call
   *     triggers 401 and returns `false`.
   *   - Non-fatal by contract: network errors, missing escrow blob, wrong
   *     wrappingKey (blob tampered / derivation drift) all return `false`
   *     rather than throw. Callers do not special-case the error shape.
   *
   * @returns `true` if a key was loaded (or freshly bootstrapped), `false` otherwise.
   */
  async bootstrapFromUnlockTicket(userId: number, ticketId: string): Promise<boolean> {
    if (e2eState.isReady) {
      return false;
    }

    try {
      // Ensure Worker is up with the correct user scope (idempotent).
      await cryptoBridge.init(userId);

      // Consume the ticket — GETDEL atomic, single-use. Result carries the
      // wrappingKey unconditionally + optional bootstrap fields (salt+params).
      const apiClient = getApiClient();
      const consumeResp = await apiClient.post<UnlockTicketConsumeResult>(
        '/e2e/escrow/consume-unlock',
        { ticketId },
        { silent: true },
      );

      if (consumeResp.bootstrap !== undefined) {
        // First-login bootstrap path — generate key + create first escrow.
        return await bootstrapFreshEscrow(consumeResp.wrappingKey, consumeResp.bootstrap);
      }

      // Existing escrow recovery path — unwrap with pre-derived key + restorative rotation.
      return await recoverFromExistingEscrow(consumeResp.wrappingKey);
    } catch (err: unknown) {
      // 401 from consume-unlock = ticket expired/used/mismatched → non-fatal,
      // fall through to normal initialize() which will handle hasKey=false.
      log.warn(
        { err: err instanceof Error ? err.message : 'unknown' },
        'bootstrapFromUnlockTicketForUser failed — continuing with normal init',
      );
      return false;
    }
  },

  /**
   * Re-encrypt the escrow blob with a new password.
   * Call after a successful password change to keep the escrow in sync.
   * Non-fatal: logs a warning but does not throw on failure.
   *
   * @see ADR-022 (E2E Key Escrow)
   */
  async reEncryptEscrow(newPassword: string): Promise<void> {
    if (!e2eState.isReady) {
      log.warn('Cannot re-encrypt escrow — E2E not ready');
      return;
    }

    try {
      const wrapped = await cryptoBridge.wrapKey(newPassword);
      const apiClient = getApiClient();
      await apiClient.put(ESCROW_ENDPOINT, wrapped);
      log.info('Escrow blob re-encrypted with new password');
    } catch (err: unknown) {
      log.warn(
        { err: err instanceof Error ? err.message : 'unknown' },
        'Failed to re-encrypt escrow — old escrow may become unusable after password change',
      );
    }
  },

  /**
   * Clear private key from Worker memory + IndexedDB.
   * Call on explicit logout only.
   */
  async lock(): Promise<void> {
    try {
      await cryptoBridge.lock();
    } catch {
      // Best effort — Worker may already be destroyed
    }

    setE2eState({
      isReady: false,
      publicKey: null,
      fingerprint: null,
      keyVersion: null,
      persisted: false,
      error: null,
      recoveryRequired: false,
    });
  },
};

// =============================================================================
// KEY RESOLUTION HELPERS
// =============================================================================

/**
 * Resolve the user's E2E key — either from IndexedDB, server escrow, or new generation.
 * Orchestrates the escrow recovery + backfill logic from ADR-022.
 */
async function resolveOrRecoverKey(
  hasKey: boolean,
  loginPassword: string | null,
): Promise<ResolvedKey> {
  if (hasKey) {
    const resolved = await resolveExistingKey();
    // Backfill escrow if missing — covers two cases:
    //   1. Legacy users created before the escrow feature.
    //   2. Users who landed in `(key=present, escrow=missing)` from a
    //      pre-atomic registration (post-mortem 2026-05-01).
    // AWAIT and let errors propagate: the previous fire-and-forget
    // (`void tryCreateEscrowIfMissing(...)`) is precisely how those
    // legacy users got stuck in the irrecoverable state we are now
    // closing. Surfacing the error gives the user actionable feedback
    // and a retry path on the next login.
    if (loginPassword !== null) {
      await tryCreateEscrowIfMissing(loginPassword);
    }
    return resolved;
  }

  // No local key — try escrow recovery before generating a new key pair
  if (loginPassword !== null && (await tryRecoverFromEscrow(loginPassword))) {
    return await resolveExistingKey();
  }

  // No recovery possible — generate fresh key + escrow ATOMICALLY in one
  // server transaction. Without a password we cannot derive the wrappingKey,
  // and registering a key without escrow is the irrecoverable state we are
  // explicitly closing here (post-mortem 2026-05-01). Refuse loudly: the user
  // can retry by logging in again so the login-password-bridge is populated.
  if (loginPassword === null) {
    log.error('No local key, no escrow recovery, no password — cannot seed without password');
    throw new Error(
      'E2E-Schlüssel konnte nicht erstellt werden — bitte erneut anmelden, damit das Passwort verfügbar ist.',
    );
  }
  return await generateAndRegisterKeyWithEscrow(loginPassword);
}

interface ResolvedKey {
  publicKey: string;
  fingerprint: string;
  keyVersion: number;
}

/** Key data returned by the E2E server endpoints */
interface ServerKeyData {
  publicKey: string;
  fingerprint: string;
  keyVersion: number;
}

/**
 * Mirror of the backend `UnlockTicketConsumeResult` (see
 * `backend/src/nest/e2e-escrow/escrow-unlock-ticket.service.ts`).
 *
 * `wrappingKey` is always present. `bootstrap` is set iff the apex minted
 * a bootstrap ticket — i.e. the user had no server-side escrow yet at
 * login time (ADR-022 §"New-user scenario"). Subdomain branches on
 * `bootstrap !== undefined`.
 */
interface UnlockTicketConsumeResult {
  wrappingKey: string;
  bootstrap?: {
    argon2Salt: string;
    argon2Params: { memory: number; iterations: number; parallelism: number };
  };
}

/** Load existing key from IndexedDB and verify server has it */
async function resolveExistingKey(): Promise<ResolvedKey> {
  const localPublicKey = await cryptoBridge.getPublicKey();
  const localFingerprint = await cryptoBridge.getFingerprint();
  log.info(
    { fingerprint: localFingerprint.substring(0, 16) + '…' },
    'Local key loaded from IndexedDB',
  );

  log.info('Verifying server has our key (ensureKeyOnServer)…');
  const serverKey = await ensureKeyOnServer(localPublicKey);

  // Compare server key with local key
  if (serverKey.publicKey === localPublicKey) {
    log.info(
      { serverFingerprint: serverKey.fingerprint.substring(0, 16) + '…' },
      'Server key matches local key',
    );
    return {
      publicKey: serverKey.publicKey,
      fingerprint: serverKey.fingerprint,
      keyVersion: serverKey.keyVersion,
    };
  }

  // MISMATCH: the server's active public key does not correspond to our
  // locally stored private key. Historically this path auto-rotated the
  // server key to match the local one — but that silently destroyed every
  // counterparty's ability to decrypt historical messages with us (the
  // ECDH shared secret shifts on key change). ADR-022 was introduced
  // specifically to replace rotation with zero-knowledge escrow recovery.
  //
  // If we reach this branch, escrow recovery has already been attempted
  // upstream (resolveOrRecoverKey) and either:
  //   - succeeded → we would not be here (local key would match server)
  //   - failed: no escrow blob, wrong password, or no password bridge
  //     available (e.g. the login-password-bridge did not survive a
  //     cross-origin redirect — ADR-050 × ADR-022 boundary).
  //
  // Fail-closed is the only safe path. Admin can unstick the user via
  // `DELETE /api/v2/e2e/keys/:userId` (ADR-021 §E2E-Keys endpoints), after
  // which the next login regenerates cleanly and creates a fresh escrow.
  //
  // Do NOT reintroduce automatic rotation here without first reading the
  // 2026-02-11 incident writeup in ADR-022 §Motivation.
  log.error(
    {
      localFingerprint: localFingerprint.substring(0, 16) + '…',
      serverFingerprint: serverKey.fingerprint.substring(0, 16) + '…',
    },
    'KEY MISMATCH — local and server keys diverged. Blocking E2E until admin reset.',
  );
  throw new E2eKeyError(
    'key_mismatch',
    'Dein E2E-Schlüssel auf diesem Gerät stimmt nicht mit dem Server überein. ' +
      'Melde dich auf dem Ursprungsgerät an oder bitte den Admin, deinen Schlüssel zurückzusetzen.',
  );
}

/**
 * Atomic key + escrow registration via the `POST /e2e/keys/with-escrow`
 * endpoint. Backend wraps both inserts in a single `tenantTransaction()` —
 * either both rows commit or both roll back. By construction this closes
 * the `(key=present, escrow=missing)` race window that the old two-call
 * sequence left open (post-mortem 2026-05-01).
 *
 * Used by both same-origin first-key generation (this function calls it
 * with an Argon2id-derived envelope) AND the cross-origin bootstrap
 * branch (`bootstrapFreshEscrow` calls it with the apex-derived
 * wrappingKey envelope). The differences are confined to the wrap step;
 * the server-side guarantee is identical.
 */
interface ServerKeyEscrowEnvelope {
  encryptedBlob: string;
  argon2Salt: string;
  xchachaNonce: string;
  argon2Params: { memory: number; iterations: number; parallelism: number };
}

interface ServerKeyWithEscrowResponse {
  key: ServerKeyData;
  escrow: EscrowData;
}

async function postAtomicKeyAndEscrow(
  publicKey: string,
  envelope: ServerKeyEscrowEnvelope,
): Promise<ServerKeyWithEscrowResponse> {
  const apiClient = getApiClient();
  return await apiClient.post<ServerKeyWithEscrowResponse>(
    '/e2e/keys/with-escrow',
    { publicKey, escrow: envelope },
    { silent: true },
  );
}

/**
 * Same-origin first-key generation: derive wrappingKey from password
 * (Argon2id, in-Worker), wrap private key, atomic POST. On 409 the
 * server already has a key for this user that we cannot reconcile —
 * fail-closed with `E2eKeyError` so the UI surfaces the admin-reset
 * recovery hint (ADR-022 §Motivation).
 */
async function generateAndRegisterKeyWithEscrow(password: string): Promise<ResolvedKey> {
  log.info('No local key + no escrow recovery — atomic key+escrow generation');
  const generated = await cryptoBridge.generateKeys();
  log.info({ fingerprint: generated.fingerprint.substring(0, 16) + '…' }, 'Key pair generated');

  const wrapped = await cryptoBridge.wrapKey(password);

  try {
    const result = await postAtomicKeyAndEscrow(generated.publicKey, {
      encryptedBlob: wrapped.encryptedBlob,
      argon2Salt: wrapped.argon2Salt,
      xchachaNonce: wrapped.xchachaNonce,
      argon2Params: wrapped.argon2Params,
    });
    log.info(
      { fingerprint: result.key.fingerprint.substring(0, 16) + '…' },
      'Atomic registration complete — key + escrow committed in one transaction',
    );
    return {
      publicKey: result.key.publicKey,
      fingerprint: result.key.fingerprint,
      keyVersion: result.key.keyVersion,
    };
  } catch (err: unknown) {
    if (isConflictError(err)) {
      log.error(
        { localFingerprint: generated.fingerprint.substring(0, 16) + '…' },
        'Atomic register hit 409 — server has a key + escrow for this user we cannot reconcile',
      );
      throw new E2eKeyError(
        'server_has_key_no_recovery',
        'Auf dem Server existiert bereits ein E2E-Schlüssel, der auf diesem Gerät nicht ' +
          'wiederhergestellt werden kann. Admin muss den Schlüssel zurücksetzen.',
      );
    }
    throw err;
  }
}

// Note: the historic `generateAndRegisterKey()` (non-atomic two-call path)
// was removed in the 2026-05-01 refactor. All first-key generation now
// goes through `generateAndRegisterKeyWithEscrow()` (same-origin) or
// `bootstrapFreshEscrow()` (cross-origin), both of which use the atomic
// `POST /e2e/keys/with-escrow` endpoint.

// =============================================================================
// SERVER COMMUNICATION HELPERS
// =============================================================================

/** Check if an error is a 409 Conflict */
function isConflictError(err: unknown): boolean {
  if (err !== null && typeof err === 'object' && 'status' in err) {
    return (err as { status: number }).status === 409;
  }
  if (err !== null && typeof err === 'object' && 'response' in err) {
    const response = (err as { response: { status?: number } }).response;
    return response.status === 409;
  }
  return false;
}

/** Verify server has our key; if missing (interrupted prior upload), re-register it */
async function ensureKeyOnServer(publicKey: string): Promise<ServerKeyData> {
  const apiClient = getApiClient();
  const existing = await apiClient.get<ServerKeyData | null>('/e2e/keys/me');

  if (existing !== null) {
    // Server has a key — use it (may differ if another device registered first)
    return existing;
  }

  // Server has no key — upload the local one
  return await registerKeyOnServer(publicKey);
}

/**
 * Rotate the server's active E2E key to match a locally-held private key.
 *
 * SAFETY CONTRACT — this function MUST NOT be called from automatic paths.
 * It is callable ONLY after a successful escrow unwrap (see
 * `bootstrapFromUnlockTicket`), because that path proves:
 *   1. The caller knows the user's password (required to derive the
 *      wrappingKey that unwrapped the escrow blob).
 *   2. The local private key we're about to publish is the user's
 *      CANONICAL key — the one they've stored in escrow themselves, and
 *      therefore the one their counterparties have historically been
 *      encrypting to across multiple rotation events.
 *
 * Under those two conditions rotation is RESTORATIVE, not destructive:
 * the server's current active key is typically the result of a past
 * buggy auto-rotation (now removed in Phase A); reverting it to the
 * escrow-canonical key re-enables decryption of every message encrypted
 * during any historical period where the active key matched escrow.
 *
 * Callers: `bootstrapFromUnlockTicket` only. Do not add new call sites
 * without re-reading ADR-022 §Motivation and this docblock's SAFETY
 * CONTRACT clauses.
 */
async function rotateKeyOnServer(publicKey: string): Promise<ServerKeyData> {
  const apiClient = getApiClient();
  const result = await apiClient.put<ServerKeyData>('/e2e/keys/me', { publicKey });
  log.info(
    {
      keyVersion: result.keyVersion,
      fingerprint: result.fingerprint.substring(0, 16) + '…',
    },
    'Server key rotated to escrow-canonical key',
  );
  return result;
}

/** Register public key on server, handling 409 conflict from concurrent tabs */
async function registerKeyOnServer(publicKey: string): Promise<ServerKeyData> {
  const apiClient = getApiClient();
  try {
    return await apiClient.post<ServerKeyData>('/e2e/keys', { publicKey }, { silent: true });
  } catch (err: unknown) {
    if (!isConflictError(err)) {
      throw err;
    }
    // 409 = another tab registered first — fetch the existing key
    const existing = await apiClient.get<ServerKeyData | null>('/e2e/keys/me');
    if (existing === null) {
      throw new Error('E2E key conflict but no key found on server', {
        cause: err,
      });
    }
    return existing;
  }
}

// =============================================================================
// ESCROW HELPERS (ADR-022 — Zero-Knowledge Key Recovery)
// =============================================================================

/** Server escrow response shape (matches E2eEscrowResponse from backend) */
interface EscrowData {
  encryptedBlob: string;
  argon2Salt: string;
  xchachaNonce: string;
  argon2Params: { memory: number; iterations: number; parallelism: number };
  blobVersion: number;
}

/**
 * Attempt to recover a private key from the server escrow blob.
 * Returns true if recovery succeeded (key loaded into Worker + IndexedDB).
 */
async function tryRecoverFromEscrow(password: string): Promise<boolean> {
  try {
    const apiClient = getApiClient();
    const escrow = await apiClient.get<EscrowData | null>(ESCROW_ENDPOINT);

    if (escrow === null) {
      log.info('No escrow blob on server — will generate new key');
      return false;
    }

    log.info({ blobVersion: escrow.blobVersion }, 'Escrow blob found — attempting recovery');

    const result = await cryptoBridge.unwrapKey(
      password,
      escrow.encryptedBlob,
      escrow.argon2Salt,
      escrow.xchachaNonce,
      escrow.argon2Params,
    );

    if (result === null) {
      log.warn('Escrow unwrap failed — password may have changed since escrow creation');
      return false;
    }

    log.info(
      { fingerprint: result.fingerprint.substring(0, 16) + '…' },
      'Private key RECOVERED from escrow',
    );
    return true;
  } catch (err: unknown) {
    log.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      'Escrow recovery error — non-fatal, will generate new key',
    );
    return false;
  }
}

/**
 * Create an escrow blob on the server for future key recovery.
 *
 * Throws on real failures — only swallows the "already exists" 409 because
 * that is the idempotent success case (escrow is what we wanted, somebody
 * else got there first). The previous fire-and-forget version is the root
 * cause of the post-mortem 2026-05-01 incident: a transient escrow-create
 * failure would silently leave the user in `(key, no escrow)` state.
 */
async function tryCreateEscrow(password: string): Promise<void> {
  const wrapped = await cryptoBridge.wrapKey(password);
  const apiClient = getApiClient();
  try {
    await apiClient.post(ESCROW_ENDPOINT, wrapped, { silent: true });
    log.info('Escrow blob created on server');
  } catch (err: unknown) {
    if (isConflictError(err)) {
      log.info('Escrow already exists — skipping creation');
      return;
    }
    log.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      'Failed to create escrow — propagating to caller (post-mortem 2026-05-01)',
    );
    throw err;
  }
}

/**
 * Backfill: create an escrow blob iff none exists yet.
 *
 * Idempotent on the happy path (returns early when escrow already exists)
 * but propagates real failures so the caller can decide. Used by the
 * `hasKey=true` branch in `resolveOrRecoverKey` to repair legacy users
 * created before the escrow feature, AND users left in
 * `(key=present, escrow=missing)` by the pre-atomic registration code.
 */
async function tryCreateEscrowIfMissing(password: string): Promise<void> {
  const apiClient = getApiClient();
  const existing = await apiClient.get<EscrowData | null>(ESCROW_ENDPOINT);
  if (existing !== null) {
    return; // Already has escrow — nothing to do (idempotent)
  }
  await tryCreateEscrow(password);
}

// =============================================================================
// CROSS-ORIGIN BOOTSTRAP HELPERS (ADR-022 § "New-user scenario" + ADR-050)
// =============================================================================

/**
 * Bootstrap branch — true first login on this user's account.
 *
 * Pre-condition: server has no active key (apex pre-checked via
 * `/e2e/keys/me` before minting the bootstrap ticket — see
 * `mintUnlockTicketOrFallback`). The Worker is initialised but has no key.
 *
 * Steps:
 *   1. Generate fresh X25519 key pair → store in subdomain IndexedDB.
 *   2. Register the public key on server (POST /e2e/keys → 201).
 *   3. Wrap the in-memory private key with the apex-derived wrappingKey.
 *   4. Persist the user's first escrow blob using the carried salt + params.
 *
 * Aborts (returns false) on any registration conflict (409 — race or
 * unexpected server-side key) so `initialize()` runs normally and produces
 * the appropriate fail-closed UX. Escrow-store failure is non-fatal: the
 * key is registered, future same-origin logins backfill via
 * `tryCreateEscrowIfMissing`.
 */
/**
 * POST /e2e/keys with the freshly generated public key. Returns true if the
 * server accepted the key AND echoed it back unchanged (race-free path).
 * Returns false on 409 (race / pre-existing key) or any other error — the
 * caller aborts the bootstrap in that case so the key/escrow stay coherent.
 */
/**
 * Cross-origin first-login bootstrap — wraps with the apex-derived
 * `wrappingKey` (no Argon2id here; the apex side already paid that cost
 * during the unlock-ticket mint) and posts atomically.
 *
 * Returns `false` (instead of throwing) on failure to preserve the
 * existing caller contract: `bootstrapFromUnlockTicket` falls through to
 * `initialize()` on `false`, which then fail-closes cleanly. Throwing
 * here would crash the layout mount and skip the fall-through.
 */
async function bootstrapFreshEscrow(
  wrappingKey: string,
  bootstrap: NonNullable<UnlockTicketConsumeResult['bootstrap']>,
): Promise<boolean> {
  // 1. Generate fresh X25519 key pair (Worker + IndexedDB atomic).
  const generated = await cryptoBridge.generateKeys();

  // 2. Wrap private key with the apex-derived wrappingKey (no Argon2 round).
  const wrapped = await cryptoBridge.wrapKeyWithDerivedKey(wrappingKey);

  // 3. Atomic register — both rows commit together or both roll back.
  //    Replaces the previous two-call sequence (POST /e2e/keys then
  //    POST /e2e/escrow) which left a `(key, no escrow)` window if the
  //    second call failed (post-mortem 2026-05-01).
  try {
    await postAtomicKeyAndEscrow(generated.publicKey, {
      encryptedBlob: wrapped.encryptedBlob,
      argon2Salt: bootstrap.argon2Salt,
      xchachaNonce: wrapped.xchachaNonce,
      argon2Params: bootstrap.argon2Params,
    });
    log.info(
      { fingerprint: generated.fingerprint.substring(0, 16) + '…' },
      'Atomic bootstrap complete — first key + first escrow committed',
    );
    return true;
  } catch (err: unknown) {
    if (isConflictError(err)) {
      log.warn(
        'Atomic bootstrap hit 409 — server already has key/escrow, falling back to normal init',
      );
    } else {
      log.warn(
        { err: err instanceof Error ? err.message : 'unknown' },
        'Atomic bootstrap failed — falling back to normal init',
      );
    }
    return false;
  }
}

/**
 * Existing-escrow recovery branch — preserved logic from the previous
 * `bootstrapFromUnlockTicket` body. Unwraps the existing escrow blob with
 * the apex-derived wrappingKey, then aligns the server's active key with
 * the escrow-canonical key (the single permitted call site for
 * `rotateKeyOnServer`, see SAFETY CONTRACT in that helper).
 */
async function recoverFromExistingEscrow(wrappingKey: string): Promise<boolean> {
  const apiClient = getApiClient();

  const escrow = await apiClient.get<EscrowData | null>(ESCROW_ENDPOINT);
  if (escrow === null) {
    log.warn('Unlock ticket consumed but no escrow blob on server — cannot bootstrap');
    return false;
  }

  const result = await cryptoBridge.unwrapKeyWithDerivedKey(
    wrappingKey,
    escrow.encryptedBlob,
    escrow.xchachaNonce,
  );
  if (result === null) {
    log.warn(
      'Escrow unwrap failed with pre-derived key — wrappingKey may be stale or blob tampered',
    );
    return false;
  }

  log.info(
    { fingerprint: result.fingerprint.substring(0, 16) + '…' },
    'Private key bootstrapped from unlock ticket',
  );

  // Align server-side active key with the escrow-canonical key.
  // Rationale + SAFETY CONTRACT documented above on `rotateKeyOnServer`.
  // This is the single permitted call site for that helper.
  const serverKey = await apiClient.get<ServerKeyData | null>('/e2e/keys/me');
  if (serverKey !== null && serverKey.publicKey !== result.publicKey) {
    log.warn(
      {
        escrowFingerprint: result.fingerprint.substring(0, 16) + '…',
        serverFingerprint: serverKey.fingerprint.substring(0, 16) + '…',
      },
      'Server key diverges from escrow-canonical key — restoring escrow key on server',
    );
    await rotateKeyOnServer(result.publicKey);
  } else if (serverKey === null) {
    log.info('Server has no active key — registering escrow-recovered key');
    await registerKeyOnServer(result.publicKey);
  }

  return true;
}
