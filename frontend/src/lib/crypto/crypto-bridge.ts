/**
 * CryptoBridge — Promise-based wrapper for CryptoWorker
 *
 * Provides async/await API for main thread ↔ Worker communication.
 * Each request carries a unique requestId for response correlation.
 *
 * Features:
 * - Automatic Worker crash detection + recovery
 * - 10-second request timeout
 * - One pending promise per requestId
 *
 * @see docs/plans/IMPLEMENT-E2E-ENCRYPTION.md (Section 6.4)
 */
import { createLogger } from '$lib/utils/logger';

const log = createLogger('CryptoBridge');

/** Argon2 parameters stored alongside the escrow blob */
interface Argon2Params {
  memory: number;
  iterations: number;
  parallelism: number;
}

/** Response types from the Worker */
type WorkerResponse = { requestId: string } & (
  | { type: 'ready'; hasKey: boolean; persisted: boolean }
  | { type: 'keysGenerated'; publicKey: string; fingerprint: string }
  | { type: 'encrypted'; ciphertext: string; nonce: string; keyEpoch: number }
  | { type: 'encryptFailed'; reason: string }
  | { type: 'decrypted'; plaintext: string }
  | { type: 'decryptFailed'; reason: string }
  | { type: 'publicKey'; publicKey: string }
  | { type: 'fingerprint'; fingerprint: string }
  | {
      type: 'privateKeyWrapped';
      encryptedBlob: string;
      argon2Salt: string;
      xchachaNonce: string;
      argon2Params: Argon2Params;
    }
  | { type: 'privateKeyUnwrapped'; publicKey: string; fingerprint: string }
  | { type: 'unwrapFailed'; reason: string }
  | { type: 'wrappingKeyDerived'; wrappingKey: string }
  | { type: 'locked' }
  | { type: 'pong' }
  | { type: 'error'; message: string }
);

/** Pending promise entry */
interface PendingRequest {
  resolve: (value: WorkerResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 10_000;

class CryptoBridge {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();
  private crashed = false;
  private lastUserId: number | null = null;

  /**
   * Initialize the CryptoWorker with user-scoped IndexedDB.
   * Returns whether a private key already exists in IndexedDB for this user.
   */
  async init(userId: number): Promise<{ hasKey: boolean; persisted: boolean }> {
    this.lastUserId = userId;
    this.createWorker();

    const response = await this.send({ type: 'init', userId });
    if (response.type === 'ready') {
      return { hasKey: response.hasKey, persisted: response.persisted };
    }
    throw new Error(`Unexpected init response: ${response.type}`);
  }

  /**
   * Generate X25519 key pair (or re-use existing from another tab).
   * Atomic via IndexedDB readwrite transaction.
   */
  async generateKeys(): Promise<{ publicKey: string; fingerprint: string }> {
    const response = await this.send({ type: 'generateKeys' });
    if (response.type === 'keysGenerated') {
      return {
        publicKey: response.publicKey,
        fingerprint: response.fingerprint,
      };
    }
    if (response.type === 'error') {
      throw new Error(response.message);
    }
    throw new Error(`Unexpected generateKeys response: ${response.type}`);
  }

  /**
   * Encrypt a plaintext message for a recipient.
   * Returns ciphertext + nonce + keyEpoch, or throws on failure.
   */
  async encrypt(
    plaintext: string,
    recipientPublicKey: string,
    conversationSalt: string,
    keyEpoch?: number,
  ): Promise<{ ciphertext: string; nonce: string; keyEpoch: number }> {
    const epoch = keyEpoch ?? Math.floor(Date.now() / 86_400_000);

    const response = await this.send({
      type: 'encrypt',
      plaintext,
      recipientPublicKey,
      conversationSalt,
      keyEpoch: epoch,
    });

    if (response.type === 'encrypted') {
      return {
        ciphertext: response.ciphertext,
        nonce: response.nonce,
        keyEpoch: response.keyEpoch,
      };
    }
    if (response.type === 'encryptFailed') {
      throw new Error(`Encryption failed: ${response.reason}`);
    }
    throw new Error(`Unexpected encrypt response: ${response.type}`);
  }

  /**
   * Decrypt a ciphertext message from a sender.
   * Uses the stored keyEpoch from the message (NOT the current time).
   */
  async decrypt(
    ciphertext: string,
    nonce: string,
    senderPublicKey: string,
    conversationSalt: string,
    keyEpoch: number,
  ): Promise<string> {
    const response = await this.send({
      type: 'decrypt',
      ciphertext,
      nonce,
      senderPublicKey,
      conversationSalt,
      keyEpoch,
    });

    if (response.type === 'decrypted') {
      return response.plaintext;
    }
    if (response.type === 'decryptFailed') {
      throw new Error(`Decryption failed: ${response.reason}`);
    }
    throw new Error(`Unexpected decrypt response: ${response.type}`);
  }

  /** Get the current user's public key */
  async getPublicKey(): Promise<string> {
    const response = await this.send({ type: 'exportPublicKey' });
    if (response.type === 'publicKey') {
      return response.publicKey;
    }
    if (response.type === 'error') {
      throw new Error(response.message);
    }
    throw new Error(`Unexpected exportPublicKey response: ${response.type}`);
  }

  /** Get the SHA-256 hex fingerprint of the current public key */
  async getFingerprint(): Promise<string> {
    const response = await this.send({ type: 'getFingerprint' });
    if (response.type === 'fingerprint') {
      return response.fingerprint;
    }
    if (response.type === 'error') {
      throw new Error(response.message);
    }
    throw new Error(`Unexpected getFingerprint response: ${response.type}`);
  }

  /**
   * Wrap the in-memory private key with a password-derived wrapping key.
   * Returns the encrypted blob + KDF parameters for server escrow storage.
   * Uses Argon2id for KDF + XChaCha20-Poly1305 for wrapping (ADR-022).
   */
  async wrapKey(password: string): Promise<{
    encryptedBlob: string;
    argon2Salt: string;
    xchachaNonce: string;
    argon2Params: Argon2Params;
  }> {
    const response = await this.send({ type: 'wrapPrivateKey', password });
    if (response.type === 'privateKeyWrapped') {
      return {
        encryptedBlob: response.encryptedBlob,
        argon2Salt: response.argon2Salt,
        xchachaNonce: response.xchachaNonce,
        argon2Params: response.argon2Params,
      };
    }
    if (response.type === 'error') {
      throw new Error(response.message);
    }
    throw new Error(`Unexpected wrapKey response: ${response.type}`);
  }

  /**
   * Derive the escrow wrappingKey from password + stored salt/params, without
   * decrypting or persisting anything. Returns base64(32 bytes).
   *
   * Called by the apex-login flow (ADR-050 × ADR-022) BEFORE the cross-origin
   * redirect, to produce the value stored in the short-lived unlock ticket.
   * Requires `init()` to have been called first so the Worker exists (the
   * handler itself is stateless, but ioredis-style: someone must open the
   * channel). The IndexedDB side-effect of init is benign on apex — it just
   * opens an empty user-scoped DB that will not be written to here.
   */
  async deriveWrappingKey(
    password: string,
    argon2Salt: string,
    argon2Params: Argon2Params,
  ): Promise<string> {
    const response = await this.send({
      type: 'deriveWrappingKey',
      password,
      argon2Salt,
      argon2Params,
    });
    if (response.type === 'wrappingKeyDerived') {
      return response.wrappingKey;
    }
    if (response.type === 'error') {
      throw new Error(response.message);
    }
    throw new Error(`Unexpected deriveWrappingKey response: ${response.type}`);
  }

  /**
   * Unwrap using a pre-derived wrappingKey (skips Argon2id).
   *
   * Call path for the ADR-050 cross-origin handoff: the apex login derived
   * the wrappingKey once via normal `unwrapKey()` (or equivalent derivation),
   * transported it via Redis unlock-ticket, and the subdomain hands the
   * already-derived key to the Worker here. Saves ~1 second of Argon2id
   * re-derivation and avoids any password residue on the subdomain origin.
   *
   * Returns null on authentication failure (wrong wrappingKey → XChaCha20
   * "invalid tag") or malformed input — same contract as `unwrapKey()`.
   */
  async unwrapKeyWithDerivedKey(
    wrappingKey: string,
    encryptedBlob: string,
    xchachaNonce: string,
  ): Promise<{ publicKey: string; fingerprint: string } | null> {
    const response = await this.send({
      type: 'unwrapWithDerivedKey',
      wrappingKey,
      encryptedBlob,
      xchachaNonce,
    });
    if (response.type === 'privateKeyUnwrapped') {
      return { publicKey: response.publicKey, fingerprint: response.fingerprint };
    }
    if (response.type === 'unwrapFailed') {
      return null;
    }
    if (response.type === 'error') {
      throw new Error(response.message);
    }
    throw new Error(`Unexpected unwrapKeyWithDerivedKey response: ${response.type}`);
  }

  /**
   * Unwrap a private key from a server escrow blob using the user's password.
   * On success, the key is loaded into Worker memory + IndexedDB.
   * Returns null if password was wrong (invalid tag from XChaCha20).
   * Uses Argon2id for KDF + XChaCha20-Poly1305 for unwrapping (ADR-022).
   */
  async unwrapKey(
    password: string,
    encryptedBlob: string,
    argon2Salt: string,
    xchachaNonce: string,
    argon2Params: Argon2Params,
  ): Promise<{ publicKey: string; fingerprint: string } | null> {
    const response = await this.send({
      type: 'unwrapPrivateKey',
      password,
      encryptedBlob,
      argon2Salt,
      xchachaNonce,
      argon2Params,
    });
    if (response.type === 'privateKeyUnwrapped') {
      return {
        publicKey: response.publicKey,
        fingerprint: response.fingerprint,
      };
    }
    if (response.type === 'unwrapFailed') {
      // Wrong password or corrupted blob — caller decides what to do
      return null;
    }
    if (response.type === 'error') {
      throw new Error(response.message);
    }
    throw new Error(`Unexpected unwrapKey response: ${response.type}`);
  }

  /**
   * Clear private key from Worker memory only (IndexedDB persists for key continuity).
   * Call on explicit logout — destroys Worker process but preserves stored keys.
   */
  async lock(): Promise<void> {
    try {
      const response = await this.send({ type: 'lock' });
      if (response.type !== 'locked') {
        throw new Error(`Unexpected lock response: ${response.type}`);
      }
    } finally {
      // Destroy worker regardless
      this.destroyWorker();
    }
  }

  /** Terminate the Worker and reject all pending promises */
  destroy(): void {
    this.destroyWorker();
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  /** Create and wire up the Worker */
  private createWorker(): void {
    if (this.worker !== null) {
      return;
    }

    this.crashed = false;

    // Vite handles ?worker imports — creates blob URL in dev, separate file in prod
    this.worker = new Worker(new URL('./crypto-worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleResponse(event.data);
    };

    this.worker.onerror = (event: ErrorEvent) => {
      log.error({ err: event.message }, 'Worker error');
      this.handleCrash();
    };
  }

  /** Destroy worker and reject all pending */
  private destroyWorker(): void {
    if (this.worker !== null) {
      this.worker.terminate();
      this.worker = null;
    }

    // Reject all pending promises
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Worker destroyed'));
    }
    this.pending.clear();
  }

  /** Handle worker crash — reject all pending and mark as crashed */
  private handleCrash(): void {
    this.crashed = true;
    this.destroyWorker();
  }

  /** Route a Worker response to the correct pending promise */
  private handleResponse(response: WorkerResponse): void {
    const pending = this.pending.get(response.requestId);
    if (pending === undefined) {
      return; // Orphaned response (timed out or already resolved)
    }

    clearTimeout(pending.timer);
    this.pending.delete(response.requestId);
    pending.resolve(response);
  }

  /**
   * Send a message to the Worker and wait for the correlated response.
   * Retries once on crash (auto-restarts Worker from IndexedDB state).
   */
  private async send(
    message: Omit<Parameters<typeof this.sendOnce>[0], 'requestId'>,
    retried = false,
  ): Promise<WorkerResponse> {
    try {
      return await this.sendOnce(message);
    } catch (err: unknown) {
      // On crash, retry once (Worker restarts from IndexedDB)
      if (
        !retried &&
        this.crashed &&
        this.lastUserId !== null &&
        err instanceof Error &&
        (err.message === 'Worker destroyed' || err.message.includes('timeout'))
      ) {
        this.createWorker();
        // Re-init after crash recovery (with user-scoped DB)
        const initResponse = await this.sendOnce({
          type: 'init',
          userId: this.lastUserId,
        });
        if (initResponse.type !== 'ready') {
          throw new Error('Worker recovery failed — init did not return ready', { cause: err });
        }
        return await this.sendOnce(message, true);
      }
      throw err;
    }
  }

  /** Send a single message to Worker with timeout */
  private sendOnce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic message type
    message: Record<string, any>,
    _retried = false,
  ): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      if (this.worker === null) {
        reject(new Error('Worker not initialized — call init() first'));
        return;
      }

      const requestId = crypto.randomUUID();

      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(
          new Error(
            `Worker request timeout after ${REQUEST_TIMEOUT_MS}ms (type: ${String(message.type)})`,
          ),
        );
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(requestId, { resolve, reject, timer });
      this.worker.postMessage({ ...message, requestId });
    });
  }
}

/** Singleton instance — import this in components */
export const cryptoBridge = new CryptoBridge();
