/**
 * CryptoWorker — Web Worker for E2E Encryption
 *
 * Holds the X25519 private key in Worker memory.
 * Main thread never receives the private key via postMessage.
 *
 * Responsibilities:
 * - Generate X25519 key pair (stored in IndexedDB)
 * - ECDH key agreement + HKDF key derivation + XChaCha20-Poly1305 encrypt/decrypt
 * - Internal caching (shared secret + epoch key) for performance
 * - Multi-tab coordination via IndexedDB readwrite transactions
 * - lock() clears keys from Worker memory on logout (IndexedDB persists for key continuity)
 *
 * Security notes:
 * - IndexedDB is accessible from both Worker and main thread (XSS risk remains)
 * - CSP nonce-based policy is the primary XSS defense
 * - This Worker is defense-in-depth, not a security boundary
 *
 * @see docs/plans/IMPLEMENT-E2E-ENCRYPTION.md
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { argon2id } from 'hash-wasm';

// =============================================================================
// TYPES
// =============================================================================

/** Main Thread → Worker requests */
type WorkerRequest = { requestId: string } & (
  | { type: 'init'; userId: number }
  | { type: 'generateKeys' }
  | {
      type: 'encrypt';
      plaintext: string;
      recipientPublicKey: string;
      conversationSalt: string;
      keyEpoch: number;
    }
  | {
      type: 'decrypt';
      ciphertext: string;
      nonce: string;
      senderPublicKey: string;
      conversationSalt: string;
      keyEpoch: number;
    }
  | { type: 'exportPublicKey' }
  | { type: 'getFingerprint' }
  | { type: 'wrapPrivateKey'; password: string }
  | {
      type: 'unwrapPrivateKey';
      password: string;
      encryptedBlob: string;
      argon2Salt: string;
      xchachaNonce: string;
      argon2Params: { memory: number; iterations: number; parallelism: number };
    }
  | {
      /**
       * Argon2id-only derivation (no decryption, no IndexedDB side-effects).
       *
       * Used by the apex-login flow (ADR-050) to produce the wrappingKey for
       * the cross-origin unlock ticket WITHOUT touching apex's IndexedDB.
       * The subdomain later consumes the ticket via `unwrapWithDerivedKey`,
       * which DOES store the decrypted private key in the subdomain origin's
       * IndexedDB (the only origin that should hold it).
       */
      type: 'deriveWrappingKey';
      password: string;
      argon2Salt: string;
      argon2Params: { memory: number; iterations: number; parallelism: number };
    }
  | {
      /**
       * Unwrap the private key using a pre-derived wrappingKey (skips Argon2id).
       *
       * Used by the ADR-050 cross-origin escrow-unlock handoff: apex derives
       * the wrappingKey once during login, transports it via Redis single-use
       * ticket, and the subdomain calls this handler with the pre-derived key.
       * The subdomain never sees the password and avoids a second ~1s Argon2id
       * pass on a fresh origin.
       *
       * Caller MUST ensure the wrappingKey is a base64-encoded 32-byte value
       * (XChaCha20 key size); `unwrapFailed` is returned for wrong size or
       * any XChaCha20 authentication failure.
       */
      type: 'unwrapWithDerivedKey';
      wrappingKey: string;
      encryptedBlob: string;
      xchachaNonce: string;
    }
  | { type: 'lock' }
  | { type: 'ping' }
);

/** Worker → Main Thread responses */
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
      argon2Params: { memory: number; iterations: number; parallelism: number };
    }
  | { type: 'privateKeyUnwrapped'; publicKey: string; fingerprint: string }
  | { type: 'unwrapFailed'; reason: string }
  | { type: 'wrappingKeyDerived'; wrappingKey: string }
  | { type: 'locked' }
  | { type: 'pong' }
  | { type: 'error'; message: string }
);

/** IndexedDB stored key shape */
interface StoredPrivateKey {
  keyVersion: number;
  privateKey: Uint8Array;
  publicKey: string;
  isActive: boolean;
  createdAt: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DB_NAME_PREFIX = 'assixx-e2e-user-';
const DB_VERSION = 1;
const STORE_NAME = 'private-keys';
const ACTIVE_KEY_VERSION = 1;
const HKDF_INFO_PREFIX = 'assixx-e2e-v1:';
const NONCE_LENGTH = 24;
const ESCROW_NONCE_LENGTH = 24;

/** Default Argon2id parameters for escrow key derivation (ADR-022) */
const DEFAULT_ARGON2_PARAMS = {
  memory: 65536,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
};

// =============================================================================
// STATE (Worker-scoped, never leaves this thread)
// =============================================================================

let privateKey: Uint8Array | null = null;
let publicKeyBase64: string | null = null;
let activeUserId: number | null = null;

/** Cache: recipient public key (base64) → 32-byte raw shared secret */
const sharedSecretCache = new Map<string, Uint8Array>();

/** Cache: `${recipientPubKey}:${epoch}` → 32-byte derived encryption key */
const epochKeyCache = new Map<string, Uint8Array>();

// =============================================================================
// INDEXEDDB HELPERS
// =============================================================================

/** Get the user-scoped IndexedDB name. Throws if userId not set. */
function getDbName(): string {
  if (activeUserId === null) {
    throw new Error('Worker not initialized — userId required before DB access');
  }
  return `${DB_NAME_PREFIX}${activeUserId}`;
}

/** Open (or create) the E2E IndexedDB database (scoped per user) */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(getDbName(), DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'keyVersion' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error(`IndexedDB open failed: ${request.error?.message ?? 'unknown'}`));
    };
  });
}

/** Read the active key from IndexedDB within a readwrite transaction (serializes across tabs) */
async function readKeyFromDb(): Promise<StoredPrivateKey | undefined> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(ACTIVE_KEY_VERSION);

    getReq.onsuccess = () => {
      resolve(getReq.result as StoredPrivateKey | undefined);
    };

    getReq.onerror = () => {
      reject(new Error(`IndexedDB read failed: ${getReq.error?.message ?? 'unknown'}`));
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
}

// =============================================================================
// CRYPTO HELPERS
// =============================================================================

/** Base64 encode a Uint8Array */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Base64 decode to Uint8Array */
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Compute SHA-256 hex fingerprint of a public key */
function computeFingerprint(publicKeyB64: string): string {
  const keyBytes = fromBase64(publicKeyB64);
  const hash = sha256(keyBytes);
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Get or compute ECDH shared secret (cached) */
function getSharedSecret(recipientPublicKeyB64: string): Uint8Array {
  const cached = sharedSecretCache.get(recipientPublicKeyB64);
  if (cached !== undefined) {
    return cached;
  }

  if (privateKey === null) {
    throw new Error('Private key not loaded');
  }

  const recipientPubBytes = fromBase64(recipientPublicKeyB64);
  const secret = x25519.getSharedSecret(privateKey, recipientPubBytes);
  sharedSecretCache.set(recipientPublicKeyB64, secret);
  return secret;
}

/** Get or derive epoch encryption key (cached) */
function getEpochKey(
  recipientPublicKeyB64: string,
  conversationSaltBytes: Uint8Array,
  keyEpoch: number,
): Uint8Array {
  const cacheKey = `${recipientPublicKeyB64}:${keyEpoch}`;
  const cached = epochKeyCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const sharedSecret = getSharedSecret(recipientPublicKeyB64);
  const info = new TextEncoder().encode(`${HKDF_INFO_PREFIX}${keyEpoch}`);
  const derivedKey = hkdf(sha256, sharedSecret, conversationSaltBytes, info, 32);
  epochKeyCache.set(cacheKey, derivedKey);
  return derivedKey;
}

/** Encrypt plaintext with XChaCha20-Poly1305 */
function encryptMessage(
  plaintext: string,
  recipientPublicKeyB64: string,
  conversationSaltB64: string,
  keyEpoch: number,
): { ciphertext: string; nonce: string; keyEpoch: number } {
  const conversationSaltBytes = fromBase64(conversationSaltB64);
  const encKey = getEpochKey(recipientPublicKeyB64, conversationSaltBytes, keyEpoch);
  const nonce = randomBytes(NONCE_LENGTH);
  const plaintextBytes = new TextEncoder().encode(plaintext);

  const cipher = xchacha20poly1305(encKey, nonce);
  const ciphertextBytes = cipher.encrypt(plaintextBytes);

  return {
    ciphertext: toBase64(ciphertextBytes),
    nonce: toBase64(nonce),
    keyEpoch,
  };
}

/** Decrypt ciphertext with XChaCha20-Poly1305 */
function decryptMessage(
  ciphertextB64: string,
  nonceB64: string,
  senderPublicKeyB64: string,
  conversationSaltB64: string,
  keyEpoch: number,
): string {
  const conversationSaltBytes = fromBase64(conversationSaltB64);
  const encKey = getEpochKey(senderPublicKeyB64, conversationSaltBytes, keyEpoch);
  const ciphertextBytes = fromBase64(ciphertextB64);
  const nonceBytes = fromBase64(nonceB64);

  const cipher = xchacha20poly1305(encKey, nonceBytes);
  const plaintextBytes = cipher.decrypt(ciphertextBytes);

  return new TextDecoder().decode(plaintextBytes);
}

// =============================================================================
// MESSAGE HANDLERS (one per request type to keep complexity low)
// =============================================================================

/** Send response back to main thread */
function respond(response: WorkerResponse): void {
  self.postMessage(response);
}

/** Init: set userId, load existing key from IndexedDB, request storage persistence */
async function handleInit(requestId: string, userId: number): Promise<void> {
  // Set user scope BEFORE any DB access
  activeUserId = userId;

  // Clear any in-memory keys from a previous user session
  privateKey = null;
  publicKeyBase64 = null;
  sharedSecretCache.clear();
  epochKeyCache.clear();

  let persisted = false;
  try {
    persisted = await navigator.storage.persist();
    if (!persisted) {
      console.warn(
        '[CryptoWorker] navigator.storage.persist() returned false — IndexedDB may be evicted by browser',
      );
    }
  } catch {
    // persist() not available in this context — proceed anyway
  }

  const stored = await readKeyFromDb();
  if (stored?.isActive === true) {
    privateKey = stored.privateKey;
    publicKeyBase64 = stored.publicKey;
  }

  respond({
    requestId,
    type: 'ready',
    hasKey: privateKey !== null,
    persisted,
  });
}

/** Atomic key generation with IndexedDB readwrite transaction (serializes across tabs) */
async function atomicKeyGeneration(db: IDBDatabase): Promise<StoredPrivateKey | null> {
  return await new Promise<StoredPrivateKey | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(ACTIVE_KEY_VERSION);

    getReq.onsuccess = () => {
      const existing = getReq.result as StoredPrivateKey | undefined;
      if (existing?.isActive === true) {
        resolve(existing);
        return;
      }

      const newPrivateKey = x25519.utils.randomSecretKey();
      const newPublicKey = x25519.getPublicKey(newPrivateKey);
      const newPublicKeyB64 = toBase64(newPublicKey);

      const keyData: StoredPrivateKey = {
        keyVersion: ACTIVE_KEY_VERSION,
        privateKey: newPrivateKey,
        publicKey: newPublicKeyB64,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      const putReq = store.put(keyData);
      putReq.onsuccess = () => {
        resolve(null);
      };
      putReq.onerror = () => {
        reject(new Error(`IndexedDB put failed: ${putReq.error?.message ?? 'unknown'}`));
      };
    };

    getReq.onerror = () => {
      reject(new Error(`IndexedDB get failed: ${getReq.error?.message ?? 'unknown'}`));
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
}

/** Generate X25519 key pair, store in IndexedDB, return public key + fingerprint */
async function handleGenerateKeys(requestId: string): Promise<void> {
  const db = await openDb();
  const result = await atomicKeyGeneration(db);

  if (result !== null) {
    privateKey = result.privateKey;
    publicKeyBase64 = result.publicKey;
  } else {
    const stored = await readKeyFromDb();
    if (stored !== undefined) {
      privateKey = stored.privateKey;
      publicKeyBase64 = stored.publicKey;
    }
  }

  if (publicKeyBase64 === null) {
    respond({
      requestId,
      type: 'error',
      message: 'Key generation failed — no public key available',
    });
    return;
  }

  respond({
    requestId,
    type: 'keysGenerated',
    publicKey: publicKeyBase64,
    fingerprint: computeFingerprint(publicKeyBase64),
  });
}

/** Encrypt plaintext for a recipient */
function handleEncrypt(
  requestId: string,
  plaintext: string,
  recipientPublicKey: string,
  conversationSalt: string,
  keyEpoch: number,
): void {
  if (privateKey === null) {
    respond({
      requestId,
      type: 'encryptFailed',
      reason: 'No private key loaded',
    });
    return;
  }

  try {
    const encrypted = encryptMessage(plaintext, recipientPublicKey, conversationSalt, keyEpoch);
    respond({ requestId, type: 'encrypted', ...encrypted });
  } catch (err: unknown) {
    respond({
      requestId,
      type: 'encryptFailed',
      reason: err instanceof Error ? err.message : 'Unknown encrypt error',
    });
  }
}

/** Decrypt ciphertext from a sender */
function handleDecrypt(
  requestId: string,
  ciphertext: string,
  nonce: string,
  senderPublicKey: string,
  conversationSalt: string,
  keyEpoch: number,
): void {
  if (privateKey === null) {
    respond({
      requestId,
      type: 'decryptFailed',
      reason: 'No private key loaded',
    });
    return;
  }

  try {
    const plaintext = decryptMessage(
      ciphertext,
      nonce,
      senderPublicKey,
      conversationSalt,
      keyEpoch,
    );
    respond({ requestId, type: 'decrypted', plaintext });
  } catch (err: unknown) {
    respond({
      requestId,
      type: 'decryptFailed',
      reason: err instanceof Error ? err.message : 'Unknown decrypt error',
    });
  }
}

/** Export the current public key */
function handleExportPublicKey(requestId: string): void {
  if (publicKeyBase64 === null) {
    respond({ requestId, type: 'error', message: 'No public key available' });
    return;
  }
  respond({ requestId, type: 'publicKey', publicKey: publicKeyBase64 });
}

/** Get SHA-256 fingerprint of the current public key */
function handleGetFingerprint(requestId: string): void {
  if (publicKeyBase64 === null) {
    respond({ requestId, type: 'error', message: 'No public key available' });
    return;
  }
  respond({
    requestId,
    type: 'fingerprint',
    fingerprint: computeFingerprint(publicKeyBase64),
  });
}

/**
 * Wrap the in-memory private key with a password-derived key for server escrow.
 * Uses Argon2id for KDF + XChaCha20-Poly1305 for wrapping.
 * Password is used only for derivation, then discarded.
 *
 * @see ADR-022
 */
async function handleWrapPrivateKey(requestId: string, password: string): Promise<void> {
  if (privateKey === null) {
    respond({ requestId, type: 'error', message: 'No private key to wrap' });
    return;
  }

  try {
    const salt = randomBytes(32);
    const nonce = randomBytes(ESCROW_NONCE_LENGTH);

    const wrappingKeyHex = await argon2id({
      password,
      salt,
      memorySize: DEFAULT_ARGON2_PARAMS.memory,
      iterations: DEFAULT_ARGON2_PARAMS.iterations,
      parallelism: DEFAULT_ARGON2_PARAMS.parallelism,
      hashLength: DEFAULT_ARGON2_PARAMS.hashLength,
      outputType: 'hex',
    });
    const wrappingKey = hexToBytes(wrappingKeyHex);

    const cipher = xchacha20poly1305(wrappingKey, nonce);
    const encryptedBytes = cipher.encrypt(privateKey);

    respond({
      requestId,
      type: 'privateKeyWrapped',
      encryptedBlob: toBase64(encryptedBytes),
      argon2Salt: toBase64(salt),
      xchachaNonce: toBase64(nonce),
      argon2Params: {
        memory: DEFAULT_ARGON2_PARAMS.memory,
        iterations: DEFAULT_ARGON2_PARAMS.iterations,
        parallelism: DEFAULT_ARGON2_PARAMS.parallelism,
      },
    });
  } catch (err: unknown) {
    respond({
      requestId,
      type: 'error',
      message: err instanceof Error ? err.message : 'Failed to wrap private key',
    });
  }
}

/**
 * Unwrap a private key from an escrow blob using the user's password.
 * On success, loads the key into Worker memory + IndexedDB.
 *
 * @see ADR-022
 */
async function handleUnwrapPrivateKey(
  requestId: string,
  password: string,
  encryptedBlob: string,
  argon2Salt: string,
  xchachaNonce: string,
  argon2Params: { memory: number; iterations: number; parallelism: number },
): Promise<void> {
  try {
    const salt = fromBase64(argon2Salt);
    const nonce = fromBase64(xchachaNonce);
    const encryptedBytes = fromBase64(encryptedBlob);

    const wrappingKeyHex = await argon2id({
      password,
      salt,
      memorySize: argon2Params.memory,
      iterations: argon2Params.iterations,
      parallelism: argon2Params.parallelism,
      hashLength: 32,
      outputType: 'hex',
    });
    const wrappingKey = hexToBytes(wrappingKeyHex);

    const cipher = xchacha20poly1305(wrappingKey, nonce);
    const decryptedKey = cipher.decrypt(encryptedBytes);

    // Validate: must be exactly 32 bytes (X25519 private key)
    if (decryptedKey.length !== 32) {
      respond({
        requestId,
        type: 'unwrapFailed',
        reason: `Invalid key length: expected 32, got ${decryptedKey.length}`,
      });
      return;
    }

    // Derive public key from recovered private key
    const recoveredPublicKey = x25519.getPublicKey(decryptedKey);
    const recoveredPublicKeyB64 = toBase64(recoveredPublicKey);

    // Store in IndexedDB + load into Worker memory
    await storeKeyInDb(decryptedKey, recoveredPublicKeyB64);
    privateKey = decryptedKey;
    publicKeyBase64 = recoveredPublicKeyB64;
    sharedSecretCache.clear();
    epochKeyCache.clear();

    respond({
      requestId,
      type: 'privateKeyUnwrapped',
      publicKey: recoveredPublicKeyB64,
      fingerprint: computeFingerprint(recoveredPublicKeyB64),
    });
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Failed to unwrap private key';
    // "invalid tag" from XChaCha20 = wrong password
    respond({ requestId, type: 'unwrapFailed', reason });
  }
}

/**
 * Unwrap the private key blob using a pre-derived wrappingKey — no Argon2id.
 *
 * Invariants checked (defensive — callers can lie, Worker is the source of
 * truth for crypto correctness):
 *   - wrappingKey decodes to exactly 32 bytes (XChaCha20 key size)
 *   - encryptedBlob + nonce are valid base64
 *   - decrypt yields exactly 32 bytes (X25519 private key size)
 *
 * Any deviation → `unwrapFailed` with a descriptive reason. Never throw.
 *
 * ADR reference: ADR-050 (cross-origin handoff) + ADR-022 (escrow scheme).
 */
async function handleUnwrapWithDerivedKey(
  requestId: string,
  wrappingKeyBase64: string,
  encryptedBlob: string,
  xchachaNonce: string,
): Promise<void> {
  try {
    const wrappingKey = fromBase64(wrappingKeyBase64);
    if (wrappingKey.length !== 32) {
      respond({
        requestId,
        type: 'unwrapFailed',
        reason: `Invalid wrappingKey length: expected 32, got ${wrappingKey.length}`,
      });
      return;
    }

    const nonce = fromBase64(xchachaNonce);
    const encryptedBytes = fromBase64(encryptedBlob);

    const cipher = xchacha20poly1305(wrappingKey, nonce);
    const decryptedKey = cipher.decrypt(encryptedBytes);

    if (decryptedKey.length !== 32) {
      respond({
        requestId,
        type: 'unwrapFailed',
        reason: `Invalid key length: expected 32, got ${decryptedKey.length}`,
      });
      return;
    }

    const recoveredPublicKey = x25519.getPublicKey(decryptedKey);
    const recoveredPublicKeyB64 = toBase64(recoveredPublicKey);

    await storeKeyInDb(decryptedKey, recoveredPublicKeyB64);
    privateKey = decryptedKey;
    publicKeyBase64 = recoveredPublicKeyB64;
    sharedSecretCache.clear();
    epochKeyCache.clear();

    respond({
      requestId,
      type: 'privateKeyUnwrapped',
      publicKey: recoveredPublicKeyB64,
      fingerprint: computeFingerprint(recoveredPublicKeyB64),
    });
  } catch (err: unknown) {
    // "invalid tag" from XChaCha20 = wrong wrappingKey (Redis-stored value
    // was tampered OR client-side Argon2id derivation diverged from server).
    const reason = err instanceof Error ? err.message : 'Failed to unwrap with derived key';
    respond({ requestId, type: 'unwrapFailed', reason });
  }
}

/**
 * Pure Argon2id derivation — returns the 32-byte wrappingKey as base64.
 *
 * No decryption, no IndexedDB access, no private-key manipulation. Used by
 * the apex-login flow to mint the cross-origin escrow unlock ticket without
 * touching apex's IndexedDB. The derived key is ephemeral — it lives in the
 * Worker's reply message, gets stored server-side in Redis for 60s, and is
 * consumed once by the subdomain.
 *
 * @see handleUnwrapWithDerivedKey — paired consumer on the subdomain.
 */
async function handleDeriveWrappingKey(
  requestId: string,
  password: string,
  argon2Salt: string,
  argon2Params: { memory: number; iterations: number; parallelism: number },
): Promise<void> {
  try {
    const salt = fromBase64(argon2Salt);
    const wrappingKeyHex = await argon2id({
      password,
      salt,
      memorySize: argon2Params.memory,
      iterations: argon2Params.iterations,
      parallelism: argon2Params.parallelism,
      hashLength: 32,
      outputType: 'hex',
    });
    const wrappingKey = hexToBytes(wrappingKeyHex);
    respond({
      requestId,
      type: 'wrappingKeyDerived',
      wrappingKey: toBase64(wrappingKey),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to derive wrapping key';
    respond({ requestId, type: 'error', message });
  }
}

/** Store a recovered/generated key in IndexedDB */
async function storeKeyInDb(key: Uint8Array, publicKeyB64: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const keyData: StoredPrivateKey = {
      keyVersion: ACTIVE_KEY_VERSION,
      privateKey: key,
      publicKey: publicKeyB64,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    const putReq = store.put(keyData);
    putReq.onsuccess = () => {
      resolve();
    };
    putReq.onerror = () => {
      reject(new Error(`IndexedDB put failed: ${putReq.error?.message ?? 'unknown'}`));
    };
    tx.oncomplete = () => {
      db.close();
    };
  });
}

/** Convert hex string to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/** Clear keys from Worker memory only — IndexedDB persists for key continuity across sessions */
function handleLock(requestId: string): void {
  privateKey = null;
  publicKeyBase64 = null;
  activeUserId = null;
  sharedSecretCache.clear();
  epochKeyCache.clear();

  respond({ requestId, type: 'locked' });
}

// =============================================================================
// MESSAGE DISPATCHER
// =============================================================================

/** Dispatch escrow-related Worker messages (ADR-022) */
async function handleEscrowMessage(request: WorkerRequest): Promise<boolean> {
  const { requestId } = request;

  switch (request.type) {
    case 'wrapPrivateKey':
      await handleWrapPrivateKey(requestId, request.password);
      return true;
    case 'unwrapPrivateKey':
      await handleUnwrapPrivateKey(
        requestId,
        request.password,
        request.encryptedBlob,
        request.argon2Salt,
        request.xchachaNonce,
        request.argon2Params,
      );
      return true;
    case 'unwrapWithDerivedKey':
      await handleUnwrapWithDerivedKey(
        requestId,
        request.wrappingKey,
        request.encryptedBlob,
        request.xchachaNonce,
      );
      return true;
    case 'deriveWrappingKey':
      await handleDeriveWrappingKey(
        requestId,
        request.password,
        request.argon2Salt,
        request.argon2Params,
      );
      return true;
    default:
      return false;
  }
}

/** Dispatch incoming Worker messages to the appropriate handler */
async function handleMessage(request: WorkerRequest): Promise<void> {
  const { requestId } = request;

  // Try escrow handlers first (ADR-022)
  if (await handleEscrowMessage(request)) {
    return;
  }

  switch (request.type) {
    case 'init':
      await handleInit(requestId, request.userId);
      break;
    case 'generateKeys':
      await handleGenerateKeys(requestId);
      break;
    case 'encrypt':
      handleEncrypt(
        requestId,
        request.plaintext,
        request.recipientPublicKey,
        request.conversationSalt,
        request.keyEpoch,
      );
      break;
    case 'decrypt':
      handleDecrypt(
        requestId,
        request.ciphertext,
        request.nonce,
        request.senderPublicKey,
        request.conversationSalt,
        request.keyEpoch,
      );
      break;
    case 'exportPublicKey':
      handleExportPublicKey(requestId);
      break;
    case 'getFingerprint':
      handleGetFingerprint(requestId);
      break;
    case 'lock':
      handleLock(requestId);
      break;
    case 'ping':
      respond({ requestId, type: 'pong' });
      break;
  }
}

// =============================================================================
// WORKER ENTRY POINT
// =============================================================================

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void handleMessage(event.data).catch((err: unknown) => {
    respond({
      requestId: event.data.requestId,
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown worker error',
    });
  });
};
