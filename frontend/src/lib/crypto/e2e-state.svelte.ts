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
   * Consumes a single-use unlock ticket minted on apex during login,
   * fetches the escrow blob, and unwraps it with the pre-derived wrappingKey
   * from the ticket — loading the private key into the subdomain's (new)
   * IndexedDB without a password re-entry and without a second Argon2id
   * pass.
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
   * @returns `true` if a key was loaded from the ticket, `false` otherwise.
   */
  async bootstrapFromUnlockTicket(userId: number, ticketId: string): Promise<boolean> {
    if (e2eState.isReady) {
      return false;
    }

    try {
      // 1. Ensure Worker is up with the correct user scope (idempotent).
      await cryptoBridge.init(userId);

      // 2. Consume the ticket — GETDEL atomic, single-use.
      const apiClient = getApiClient();
      const consumeResp = await apiClient.post<{ wrappingKey: string }>(
        '/e2e/escrow/consume-unlock',
        { ticketId },
        { silent: true },
      );
      const { wrappingKey } = consumeResp;

      // 3. Fetch the escrow blob metadata (blob, salt, nonce, params).
      const escrow = await apiClient.get<EscrowData | null>(ESCROW_ENDPOINT);
      if (escrow === null) {
        log.warn('Unlock ticket consumed but no escrow blob on server — cannot bootstrap');
        return false;
      }

      // 4. Unwrap using the pre-derived key — skips Argon2id.
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

      // 5. Align server-side active key with the escrow-canonical key.
      //
      // The escrow blob holds the user's long-term private key — the one they
      // (or their IndexedDB) deposited intentionally via the password-derived
      // wrappingKey. Over the lifetime of an account, the server's active key
      // may have drifted from this canonical key via:
      //   (a) past automatic rotations (now removed in Phase A) that fired
      //       when IndexedDB was cleared on a new origin — the server was
      //       rewritten to a freshly-generated key, but escrow was not
      //       touched (escrow re-encryption only happens on password change
      //       per ADR-022).
      //   (b) legitimate multi-device sessions where a newer device
      //       generated a key and uploaded it but the older device's escrow
      //       (if password unchanged) still encodes the older key.
      //
      // In either case, the canonical key (the one stored in escrow) is
      // what the user's counterparties have been encrypting to across most
      // of the account's history — restoring it maximises decryptability
      // of historical messages. The rotation is authorised by the password
      // proof implicit in the escrow unwrap success (an attacker without
      // the password cannot reach this branch). This is the single
      // permitted call site for `rotateKeyOnServer` — do not add others.
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
        // Server has no active key (admin reset or data loss). Register the
        // escrow-recovered key as the new active key. No rotation semantics
        // here — this is a standard first-register via POST.
        log.info('Server has no active key — registering escrow-recovered key');
        await registerKeyOnServer(result.publicKey);
      }

      return true;
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
    // Backfill: create escrow if missing (for users who had keys before escrow feature)
    if (loginPassword !== null) {
      void tryCreateEscrowIfMissing(loginPassword);
    }
    return resolved;
  }

  // No local key — try escrow recovery before generating a new key pair
  if (loginPassword !== null && (await tryRecoverFromEscrow(loginPassword))) {
    return await resolveExistingKey();
  }

  // No recovery possible — generate fresh key pair
  const resolved = await generateAndRegisterKey();
  // Create escrow blob for the newly generated key
  if (loginPassword !== null) {
    void tryCreateEscrow(loginPassword);
  }
  return resolved;
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

/** Generate a new key pair and upload to server */
async function generateAndRegisterKey(): Promise<ResolvedKey> {
  log.info('No local key found — generating new X25519 key pair');
  const generated = await cryptoBridge.generateKeys();
  log.info({ fingerprint: generated.fingerprint.substring(0, 16) + '…' }, 'Key pair generated');

  log.info('Uploading public key to server…');
  const serverResult = await registerKeyOnServer(generated.publicKey);

  // If the server already has a different key (409 → fetch returned that key),
  // we cannot safely reconcile: the counterpart private key is lost (escrow
  // recovery already failed or was unavailable — see resolveOrRecoverKey).
  // Silent rotation would destroy every counterparty's decryptability of
  // existing messages (ADR-022 §Motivation). Fail-closed; admin reset via
  // `DELETE /api/v2/e2e/keys/:userId` is the only safe path forward.
  if (serverResult.publicKey !== generated.publicKey) {
    log.error(
      {
        generatedFingerprint: generated.fingerprint.substring(0, 16) + '…',
        serverFingerprint: serverResult.fingerprint.substring(0, 16) + '…',
      },
      'Server has different E2E key and escrow recovery unavailable. Blocking E2E.',
    );
    throw new E2eKeyError(
      'server_has_key_no_recovery',
      'Auf dem Server existiert bereits ein E2E-Schlüssel, der auf diesem Gerät nicht ' +
        'wiederhergestellt werden kann. Admin muss den Schlüssel zurücksetzen.',
    );
  }

  log.info('Public key registered on server successfully');
  return {
    publicKey: serverResult.publicKey,
    fingerprint: serverResult.fingerprint,
    keyVersion: serverResult.keyVersion,
  };
}

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
 * Fire-and-forget: logs but does not throw on failure.
 */
async function tryCreateEscrow(password: string): Promise<void> {
  try {
    const wrapped = await cryptoBridge.wrapKey(password);
    const apiClient = getApiClient();
    await apiClient.post(ESCROW_ENDPOINT, wrapped, { silent: true });
    log.info('Escrow blob created on server');
  } catch (err: unknown) {
    if (isConflictError(err)) {
      log.info('Escrow already exists — skipping creation');
      return;
    }
    log.warn(
      { err: err instanceof Error ? err.message : 'unknown' },
      'Failed to create escrow — non-fatal',
    );
  }
}

/**
 * Create an escrow blob only if none exists yet (backfill for existing keys).
 * Fire-and-forget: logs but does not throw on failure.
 */
async function tryCreateEscrowIfMissing(password: string): Promise<void> {
  try {
    const apiClient = getApiClient();
    const existing = await apiClient.get<EscrowData | null>(ESCROW_ENDPOINT);
    if (existing !== null) {
      return; // Already has escrow — nothing to do
    }
    await tryCreateEscrow(password);
  } catch (err: unknown) {
    log.warn(
      { err: err instanceof Error ? err.message : 'unknown' },
      'Escrow backfill check failed — non-fatal',
    );
  }
}
