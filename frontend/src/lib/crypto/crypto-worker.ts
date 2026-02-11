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
    throw new Error(
      'Worker not initialized — userId required before DB access',
    );
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
      reject(
        new Error(
          `IndexedDB open failed: ${request.error?.message ?? 'unknown'}`,
        ),
      );
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
      reject(
        new Error(
          `IndexedDB read failed: ${getReq.error?.message ?? 'unknown'}`,
        ),
      );
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
  const derivedKey = hkdf(
    sha256,
    sharedSecret,
    conversationSaltBytes,
    info,
    32,
  );
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
  const encKey = getEpochKey(
    recipientPublicKeyB64,
    conversationSaltBytes,
    keyEpoch,
  );
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
  const encKey = getEpochKey(
    senderPublicKeyB64,
    conversationSaltBytes,
    keyEpoch,
  );
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
async function atomicKeyGeneration(
  db: IDBDatabase,
): Promise<StoredPrivateKey | null> {
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
        reject(
          new Error(
            `IndexedDB put failed: ${putReq.error?.message ?? 'unknown'}`,
          ),
        );
      };
    };

    getReq.onerror = () => {
      reject(
        new Error(
          `IndexedDB get failed: ${getReq.error?.message ?? 'unknown'}`,
        ),
      );
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
    const encrypted = encryptMessage(
      plaintext,
      recipientPublicKey,
      conversationSalt,
      keyEpoch,
    );
    respond({ requestId, type: 'encrypted', ...encrypted });
  } catch (err) {
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
  } catch (err) {
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

/** Dispatch incoming Worker messages to the appropriate handler */
async function handleMessage(request: WorkerRequest): Promise<void> {
  const { requestId } = request;

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
