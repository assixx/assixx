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
  /** Error message if initialization failed */
  error: string | null;
}

let e2eState = $state<E2eState>({
  isReady: false,
  publicKey: null,
  fingerprint: null,
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
   * - Generates keys if needed (auto, silent)
   * - Uploads public key to server
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

      const resolved =
        hasKey ? await resolveExistingKey() : await generateAndRegisterKey();

      log.info(
        { fingerprint: resolved.fingerprint.substring(0, 16) + '…' },
        'E2E initialization COMPLETE — isReady=true',
      );
      setE2eState({
        isReady: true,
        publicKey: resolved.publicKey,
        fingerprint: resolved.fingerprint,
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
        persisted: false,
        error: message,
      });
      log.error({ err: message }, 'E2E initialization FAILED');
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
      persisted: false,
      error: null,
    });
  },
};

// =============================================================================
// KEY RESOLUTION HELPERS
// =============================================================================

interface ResolvedKey {
  publicKey: string;
  fingerprint: string;
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

  if (serverKey === null) {
    // ensureKeyOnServer uploaded our local key → use local
    log.info('Server had no key — uploaded local key');
    return { publicKey: localPublicKey, fingerprint: localFingerprint };
  }

  // Compare server key with local key
  if (serverKey.publicKey === localPublicKey) {
    log.info(
      { serverFingerprint: serverKey.fingerprint.substring(0, 16) + '…' },
      'Server key matches local key',
    );
    return {
      publicKey: serverKey.publicKey,
      fingerprint: serverKey.fingerprint,
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
  };
}

/** Generate a new key pair and upload to server */
async function generateAndRegisterKey(): Promise<ResolvedKey> {
  log.info('No local key found — generating new X25519 key pair');
  const generated = await cryptoBridge.generateKeys();
  let publicKey = generated.publicKey;
  let fingerprint = generated.fingerprint;
  log.info(
    { fingerprint: fingerprint.substring(0, 16) + '…' },
    'Key pair generated',
  );

  log.info('Uploading public key to server…');
  const conflictData = await registerKeyOnServer(publicKey);
  if (conflictData !== null) {
    log.warn('Server returned conflict — using existing server key');
    publicKey = conflictData.publicKey;
    fingerprint = conflictData.fingerprint;
  } else {
    log.info('Public key registered on server successfully');
  }

  return { publicKey, fingerprint };
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
async function ensureKeyOnServer(
  publicKey: string,
): Promise<{ publicKey: string; fingerprint: string } | null> {
  const apiClient = getApiClient();
  const existing = await apiClient.get<{
    publicKey: string;
    fingerprint: string;
  } | null>('/e2e/keys/me');

  if (existing !== null) {
    // Server has a key — use it (may differ if another device registered first)
    return existing;
  }

  // Server has no key — upload the local one
  return await registerKeyOnServer(publicKey);
}

/** Rotate key on server: deactivate old + register new atomically (PUT /e2e/keys/me) */
async function rotateKeyOnServer(
  publicKey: string,
): Promise<{ publicKey: string; fingerprint: string }> {
  const apiClient = getApiClient();
  const result = await apiClient.put<{
    publicKey: string;
    fingerprint: string;
    keyVersion: number;
  }>('/e2e/keys/me', { publicKey });
  log.info(
    {
      keyVersion: result.keyVersion,
      fingerprint: result.fingerprint.substring(0, 16) + '…',
    },
    'Server key rotated successfully',
  );
  return { publicKey: result.publicKey, fingerprint: result.fingerprint };
}

/** Register public key on server, handling 409 conflict from concurrent tabs */
async function registerKeyOnServer(
  publicKey: string,
): Promise<{ publicKey: string; fingerprint: string } | null> {
  const apiClient = getApiClient();
  try {
    await apiClient.post('/e2e/keys', { publicKey }, { silent: true });
    return null;
  } catch (err: unknown) {
    if (!isConflictError(err)) {
      throw err;
    }
    // 409 = another tab registered first — fetch the existing key
    return await apiClient.get<{
      publicKey: string;
      fingerprint: string;
    } | null>('/e2e/keys/me');
  }
}
