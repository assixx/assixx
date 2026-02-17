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
import {
  consumeLoginPassword,
  clearLoginPassword,
} from './login-password-bridge';

const log = createLogger('E2eState');

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
}

let e2eState = $state<E2eState>({
  isReady: false,
  publicKey: null,
  fingerprint: null,
  keyVersion: null,
  persisted: false,
  error: null,
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
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'E2E initialization failed';
      setE2eState({
        isReady: false,
        publicKey: null,
        fingerprint: null,
        keyVersion: null,
        persisted: false,
        error: message,
      });
      log.error({ err: message }, 'E2E initialization FAILED');
    } finally {
      // Safety net — ensure login password never lingers in memory
      clearLoginPassword();
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
      await apiClient.put('/e2e/escrow', wrapped);
      log.info('Escrow blob re-encrypted with new password');
    } catch (err) {
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

  // MISMATCH: server has a different public key than our local private key.
  // This happens when IndexedDB was cleared (container browser, cache clear)
  // and a new key pair was generated locally. The server still has the old key.
  // Fix: rotate the server key to match our current local key.
  log.warn(
    {
      localFingerprint: localFingerprint.substring(0, 16) + '…',
      serverFingerprint: serverKey.fingerprint.substring(0, 16) + '…',
    },
    'KEY MISMATCH — server has different key than local. Rotating server key.',
  );
  const rotated = await rotateKeyOnServer(localPublicKey);
  return {
    publicKey: rotated.publicKey,
    fingerprint: rotated.fingerprint,
    keyVersion: rotated.keyVersion,
  };
}

/** Generate a new key pair and upload to server */
async function generateAndRegisterKey(): Promise<ResolvedKey> {
  log.info('No local key found — generating new X25519 key pair');
  const generated = await cryptoBridge.generateKeys();
  log.info(
    { fingerprint: generated.fingerprint.substring(0, 16) + '…' },
    'Key pair generated',
  );

  log.info('Uploading public key to server…');
  const serverResult = await registerKeyOnServer(generated.publicKey);

  // If server returned a different key (409 conflict from another tab/session),
  // our NEW local private key doesn't match the OLD server public key.
  // Rotate server to match our new local key — otherwise ECDH shared secret diverges.
  if (serverResult.publicKey !== generated.publicKey) {
    log.warn(
      'Server has different key (conflict) — rotating to match new local key',
    );
    const rotated = await rotateKeyOnServer(generated.publicKey);
    return {
      publicKey: rotated.publicKey,
      fingerprint: rotated.fingerprint,
      keyVersion: rotated.keyVersion,
    };
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

/** Rotate key on server: deactivate old + register new atomically (PUT /e2e/keys/me) */
async function rotateKeyOnServer(publicKey: string): Promise<ServerKeyData> {
  const apiClient = getApiClient();
  const result = await apiClient.put<ServerKeyData>('/e2e/keys/me', {
    publicKey,
  });
  log.info(
    {
      keyVersion: result.keyVersion,
      fingerprint: result.fingerprint.substring(0, 16) + '…',
    },
    'Server key rotated successfully',
  );
  return result;
}

/** Register public key on server, handling 409 conflict from concurrent tabs */
async function registerKeyOnServer(publicKey: string): Promise<ServerKeyData> {
  const apiClient = getApiClient();
  try {
    return await apiClient.post<ServerKeyData>(
      '/e2e/keys',
      { publicKey },
      { silent: true },
    );
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
    const escrow = await apiClient.get<EscrowData | null>('/e2e/escrow');

    if (escrow === null) {
      log.info('No escrow blob on server — will generate new key');
      return false;
    }

    log.info(
      { blobVersion: escrow.blobVersion },
      'Escrow blob found — attempting recovery',
    );

    const result = await cryptoBridge.unwrapKey(
      password,
      escrow.encryptedBlob,
      escrow.argon2Salt,
      escrow.xchachaNonce,
      escrow.argon2Params,
    );

    if (result === null) {
      log.warn(
        'Escrow unwrap failed — password may have changed since escrow creation',
      );
      return false;
    }

    log.info(
      { fingerprint: result.fingerprint.substring(0, 16) + '…' },
      'Private key RECOVERED from escrow',
    );
    return true;
  } catch (err) {
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
    await apiClient.post('/e2e/escrow', wrapped, { silent: true });
    log.info('Escrow blob created on server');
  } catch (err) {
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
    const existing = await apiClient.get<EscrowData | null>('/e2e/escrow');
    if (existing !== null) {
      return; // Already has escrow — nothing to do
    }
    await tryCreateEscrow(password);
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : 'unknown' },
      'Escrow backfill check failed — non-fatal',
    );
  }
}
