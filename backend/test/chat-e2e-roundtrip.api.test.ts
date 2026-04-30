/* global TextEncoder, TextDecoder, btoa */
/**
 * E2E Encryption Roundtrip — API Integration Test
 *
 * Proves that end-to-end encryption ACTUALLY WORKS through the real server:
 *
 *   1. Two users generate REAL X25519 key pairs
 *   2. Both register their REAL public keys on the server
 *   3. Admin encrypts "Geheime Nachricht 🔐" with REAL crypto
 *   4. Server stores ONLY ciphertext (content = NULL, no plaintext)
 *   5. Employee fetches and decrypts → gets original plaintext back
 *   6. Wrong key CANNOT decrypt (AEAD authentication failure)
 *   7. Bidirectional: Employee encrypts → Admin decrypts
 *
 * This is the MISSING LINK between:
 *   - frontend/src/lib/crypto/__tests__/e2e-crypto.test.ts (real crypto, no server)
 *   - backend/test/chat-e2e-messages.api.test.ts (real server, fake crypto)
 *
 * Runs against REAL backend (Docker must be running).
 *
 * @see docs/plans/IMPLEMENT-E2E-ENCRYPTION.md (Section 10)
 * @see vitest.config.ts (api project)
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';

import {
  APITEST_PASSWORD,
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  ensureTestEmployee,
  fetchWithRetry,
  loginApitest,
  loginNonRoot,
} from './helpers.js';

// =============================================================================
// Crypto Helpers (same primitives as CryptoWorker, inlined for test isolation)
// =============================================================================

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Compute deterministic conversation salt.
 * Same logic as frontend/src/lib/crypto/conversation-salt.ts — inlined for test isolation.
 */
function computeConversationSalt(
  tenantId: number,
  conversationId: number,
  userIdA: number,
  userIdB: number,
): string {
  const sortedIds = [userIdA, userIdB].sort((a, b) => a - b);
  const input = `assixx:${tenantId}:${conversationId}:${sortedIds.join(':')}`;
  const hashBytes = sha256(new TextEncoder().encode(input));
  let binary = '';
  for (const byte of hashBytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Derive per-epoch encryption key via HKDF-SHA256. */
function deriveEpochKey(
  sharedSecret: Uint8Array,
  saltBytes: Uint8Array,
  epoch: number,
): Uint8Array {
  const info = new TextEncoder().encode(`assixx-e2e-v1:${epoch}`);
  return hkdf(sha256, sharedSecret, saltBytes, info, 32);
}

/** Encrypt plaintext with XChaCha20-Poly1305. Returns base64-encoded ciphertext + nonce. */
function encryptMessage(
  plaintext: string,
  encKey: Uint8Array,
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  const nonce = randomBytes(24);
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const cipher = xchacha20poly1305(encKey, nonce);
  return { ciphertext: cipher.encrypt(plaintextBytes), nonce };
}

/** Decrypt XChaCha20-Poly1305 ciphertext. Throws on AEAD auth failure (wrong key). */
function decryptMessage(ciphertext: Uint8Array, nonce: Uint8Array, encKey: Uint8Array): string {
  const cipher = xchacha20poly1305(encKey, nonce);
  const plaintextBytes = cipher.decrypt(ciphertext);
  return new TextDecoder().decode(plaintextBytes);
}

// =============================================================================
// Key Registration Helper
// =============================================================================

/**
 * Register or rotate a REAL X25519 public key for the authenticated user.
 * Uses PUT /e2e/keys/me (rotate) which works whether or not a key exists.
 * The rotate endpoint deactivates any old key and inserts the new one atomically.
 */
async function registerRealKey(
  token: string,
  publicKeyBase64: string,
): Promise<{ keyVersion: number }> {
  const res = await fetchWithRetry(`${BASE_URL}/e2e/keys/me`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ publicKey: publicKeyBase64 }),
  });

  if (res.ok) {
    const body = (await res.json()) as JsonBody;
    return { keyVersion: body.data.keyVersion as number };
  }

  throw new Error(`E2E key registration failed: ${res.status} ${res.statusText}`);
}

// =============================================================================
// Module State
// =============================================================================

let adminAuth: AuthState;
let employeeId: number;
let employeeToken: string;
let employeeUuid: string;
let conversationId: number | undefined;

/** Real X25519 key pairs — generated fresh each test run */
let adminPrivKey: Uint8Array;
let employeePrivKey: Uint8Array;

/** Key versions returned by the server after registration */
let adminKeyVersion: number;
let employeeKeyVersion: number;

/** ECDH shared secret (same from both sides) */
let sharedSecret: Uint8Array;

const CURRENT_EPOCH = Math.floor(Date.now() / 86_400_000);

// =============================================================================
// Setup / Teardown
// =============================================================================

beforeAll(async () => {
  // ── Step 1: Login both users ──────────────────────────────────────────────
  adminAuth = await loginApitest();
  employeeId = await ensureTestEmployee(adminAuth.authToken);

  // Full 2-step 2FA dance per FEAT_2FA_EMAIL Step 2.4 — `loginNonRoot`
  // consolidates the login → Mailpit → verify flow across api-test files.
  employeeToken = await loginNonRoot('employee@assixx.com', APITEST_PASSWORD);

  // ── Step 1b: Get employee UUID and grant chat permissions ─────────────────
  // Filter by role + bump limit — matches the `helpers.ts` ensureTestEmployee
  // pattern (lines 646-651). Test tenant fixtures grew past 50 users (kvp
  // fixtures, 2fa victims), so unfiltered `?limit=50` no longer contains
  // `employee@assixx.com` and `.find()` returned undefined → throw at line 176.
  const usersRes = await fetch(`${BASE_URL}/users?role=employee&limit=100`, {
    headers: authOnly(adminAuth.authToken),
  });
  const usersBody = (await usersRes.json()) as JsonBody;
  const employee = (usersBody.data as Array<{ id: number; email: string; uuid: string }>).find(
    (u) => u.email === 'employee@assixx.com',
  );

  if (!employee?.uuid) {
    throw new Error('Test employee not found or has no UUID');
  }
  employeeUuid = employee.uuid;

  // Grant chat permissions (conversations + messages: read + write)
  const permRes = await fetch(`${BASE_URL}/user-permissions/${employeeUuid}`, {
    method: 'PUT',
    headers: authHeaders(adminAuth.authToken),
    body: JSON.stringify({
      permissions: [
        {
          addonCode: 'chat',
          moduleCode: 'chat-conversations',
          canRead: true,
          canWrite: true,
          canDelete: false,
        },
        {
          addonCode: 'chat',
          moduleCode: 'chat-messages',
          canRead: true,
          canWrite: true,
          canDelete: false,
        },
      ],
    }),
  });

  if (!permRes.ok) {
    throw new Error(`Failed to grant chat permissions: ${permRes.status} ${permRes.statusText}`);
  }

  // ── Step 2: Generate REAL X25519 key pairs ────────────────────────────────
  adminPrivKey = x25519.utils.randomSecretKey();
  const adminPubKey = x25519.getPublicKey(adminPrivKey);

  employeePrivKey = x25519.utils.randomSecretKey();
  const employeePubKey = x25519.getPublicKey(employeePrivKey);

  // ── Step 3: Register REAL public keys on the server ───────────────────────
  const adminKeyInfo = await registerRealKey(adminAuth.authToken, toBase64(adminPubKey));
  adminKeyVersion = adminKeyInfo.keyVersion;

  const empKeyInfo = await registerRealKey(employeeToken, toBase64(employeePubKey));
  employeeKeyVersion = empKeyInfo.keyVersion;

  // ── Step 4: Compute shared secret (ECDH) ─────────────────────────────────
  const adminShared = x25519.getSharedSecret(adminPrivKey, employeePubKey);
  const empShared = x25519.getSharedSecret(employeePrivKey, adminPubKey);

  // Sanity check: ECDH must be symmetric
  if (toBase64(adminShared) !== toBase64(empShared)) {
    throw new Error('ECDH symmetry broken — shared secrets do not match');
  }
  sharedSecret = adminShared;

  // ── Step 5: Create a direct 1:1 conversation ─────────────────────────────
  const convRes = await fetch(`${BASE_URL}/chat/conversations`, {
    method: 'POST',
    headers: authHeaders(adminAuth.authToken),
    body: JSON.stringify({
      participantIds: [employeeId],
      type: 'direct',
    }),
  });
  const convBody = (await convRes.json()) as JsonBody;

  if (convBody.data?.conversation?.id !== undefined) {
    conversationId = convBody.data.conversation.id as number;
  }
});

afterAll(async () => {
  if (conversationId !== undefined) {
    await fetch(`${BASE_URL}/chat/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: authOnly(adminAuth.authToken),
    });
  }
});

// =============================================================================
// seq: 1 — Admin encrypts, Server stores, Employee decrypts
// =============================================================================

describe('E2E Roundtrip: Admin → Server → Employee', () => {
  const PLAINTEXT = 'Geheime Nachricht 🔐';
  let sentMessageId: number;

  it('should encrypt and send a real E2E message', async () => {
    expect(conversationId).toBeDefined();

    const saltB64 = computeConversationSalt(
      adminAuth.tenantId,
      conversationId!,
      adminAuth.userId,
      employeeId,
    );
    const saltBytes = fromBase64(saltB64);
    const encKey = deriveEpochKey(sharedSecret, saltBytes, CURRENT_EPOCH);

    const { ciphertext, nonce } = encryptMessage(PLAINTEXT, encKey);

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(adminAuth.authToken),
      body: JSON.stringify({
        encryptedContent: toBase64(ciphertext),
        e2eNonce: toBase64(nonce),
        e2eKeyVersion: adminKeyVersion,
        e2eKeyEpoch: CURRENT_EPOCH,
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);

    const msg = body.data.message;
    sentMessageId = msg.id as number;

    // Server stored E2E fields — plaintext is GONE
    expect(msg.isE2e).toBe(true);
    expect(msg.content).toBeNull();
    expect(msg.encryptedContent).toBe(toBase64(ciphertext));
    expect(msg.e2eNonce).toBe(toBase64(nonce));
    expect(msg.e2eKeyVersion).toBe(adminKeyVersion);
    expect(msg.e2eKeyEpoch).toBe(CURRENT_EPOCH);
  });

  it('should allow the employee to fetch and decrypt the message', async () => {
    expect(sentMessageId).toBeDefined();

    // Employee fetches messages from the conversation (limit=100 to handle stale data from prior runs)
    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages?limit=100`, {
      headers: authOnly(employeeToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    const messages = body.data as Array<Record<string, unknown>>;
    const e2eMsg = messages.find(
      (m: Record<string, unknown>) => (m.id as number) === sentMessageId,
    );

    expect(e2eMsg).toBeDefined();
    expect(e2eMsg!.content).toBeNull();
    expect(e2eMsg!.isE2e).toBe(true);

    // Employee derives the SAME key and decrypts
    const saltB64 = computeConversationSalt(
      adminAuth.tenantId,
      conversationId!,
      adminAuth.userId,
      employeeId,
    );
    const saltBytes = fromBase64(saltB64);
    const epoch = e2eMsg!.e2eKeyEpoch as number;
    const encKey = deriveEpochKey(sharedSecret, saltBytes, epoch);

    const decrypted = decryptMessage(
      fromBase64(e2eMsg!.encryptedContent as string),
      fromBase64(e2eMsg!.e2eNonce as string),
      encKey,
    );

    expect(decrypted).toBe(PLAINTEXT);
  });
});

// =============================================================================
// seq: 2 — Wrong key cannot decrypt (AEAD integrity)
// =============================================================================

describe('E2E Roundtrip: Wrong key cannot decrypt', () => {
  it('should throw AEAD authentication failure with a third party key', async () => {
    expect(conversationId).toBeDefined();

    const saltB64 = computeConversationSalt(
      adminAuth.tenantId,
      conversationId!,
      adminAuth.userId,
      employeeId,
    );
    const saltBytes = fromBase64(saltB64);
    const correctKey = deriveEpochKey(sharedSecret, saltBytes, CURRENT_EPOCH);

    const { ciphertext, nonce } = encryptMessage('Secret data', correctKey);

    // Simulate a third party (Charlie) who knows admin's public key
    // but has a different private key → different shared secret → wrong epoch key
    const charliePriv = x25519.utils.randomSecretKey();
    const adminPubKey = x25519.getPublicKey(adminPrivKey);
    const wrongShared = x25519.getSharedSecret(charliePriv, adminPubKey);
    const wrongKey = deriveEpochKey(wrongShared, saltBytes, CURRENT_EPOCH);

    // AEAD ensures authentication — wrong key = exception
    expect(() => decryptMessage(ciphertext, nonce, wrongKey)).toThrow();
  });
});

// =============================================================================
// seq: 3 — Bidirectional: Employee encrypts → Admin decrypts
// =============================================================================

describe('E2E Roundtrip: Employee → Server → Admin', () => {
  const REPLY_PLAINTEXT = 'Antwort vom Employee 📨';

  it('should encrypt, send, fetch, and decrypt in the reverse direction', async () => {
    expect(conversationId).toBeDefined();

    // Employee encrypts
    const saltB64 = computeConversationSalt(
      adminAuth.tenantId,
      conversationId!,
      adminAuth.userId,
      employeeId,
    );
    const saltBytes = fromBase64(saltB64);
    const encKey = deriveEpochKey(sharedSecret, saltBytes, CURRENT_EPOCH);
    const { ciphertext, nonce } = encryptMessage(REPLY_PLAINTEXT, encKey);

    // Employee sends via API
    const sendRes = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(employeeToken),
      body: JSON.stringify({
        encryptedContent: toBase64(ciphertext),
        e2eNonce: toBase64(nonce),
        e2eKeyVersion: employeeKeyVersion,
        e2eKeyEpoch: CURRENT_EPOCH,
      }),
    });
    const sendBody = (await sendRes.json()) as JsonBody;

    expect(sendRes.status).toBe(201);
    expect(sendBody.data.message.isE2e).toBe(true);
    expect(sendBody.data.message.content).toBeNull();

    const msgId = sendBody.data.message.id as number;

    // Admin fetches and decrypts (limit=100 to handle stale data from prior runs)
    const fetchRes = await fetch(
      `${BASE_URL}/chat/conversations/${conversationId}/messages?limit=100`,
      {
        headers: authOnly(adminAuth.authToken),
      },
    );
    const fetchBody = (await fetchRes.json()) as JsonBody;
    const messages = fetchBody.data as Array<Record<string, unknown>>;
    const empMsg = messages.find((m: Record<string, unknown>) => (m.id as number) === msgId);

    expect(empMsg).toBeDefined();
    expect(empMsg!.content).toBeNull();
    expect(empMsg!.isE2e).toBe(true);

    // Admin decrypts with the SAME shared secret (ECDH symmetry)
    const decrypted = decryptMessage(
      fromBase64(empMsg!.encryptedContent as string),
      fromBase64(empMsg!.e2eNonce as string),
      encKey,
    );

    expect(decrypted).toBe(REPLY_PLAINTEXT);
  });
});

// =============================================================================
// seq: 4 — Server never stores plaintext for E2E messages
// =============================================================================

describe('E2E Roundtrip: Server stores only ciphertext', () => {
  it('should have content=null for every E2E message in the conversation', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages?limit=100`, {
      headers: authOnly(adminAuth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    const messages = body.data as Array<Record<string, unknown>>;
    const e2eMessages = messages.filter((m: Record<string, unknown>) => m.isE2e === true);

    // We sent at least 2 E2E messages (admin→employee + employee→admin)
    expect(e2eMessages.length).toBeGreaterThanOrEqual(2);

    for (const msg of e2eMessages) {
      // Plaintext MUST be null — server never has it
      expect(msg.content).toBeNull();
      // Ciphertext fields MUST be present
      expect(msg.encryptedContent).toBeDefined();
      expect(msg.encryptedContent).not.toBeNull();
      expect(msg.e2eNonce).toBeDefined();
      expect(msg.e2eNonce).not.toBeNull();
      expect(msg.e2eKeyVersion).toBeGreaterThan(0);
      expect(msg.e2eKeyEpoch).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// seq: 5 — Public key exchange via API matches local keys
// =============================================================================

describe('E2E Roundtrip: Key exchange verification', () => {
  it('should return the correct public key when fetched from the server', async () => {
    // Admin fetches employee's public key from the server
    const res = await fetch(`${BASE_URL}/e2e/keys/${employeeId}`, {
      headers: authOnly(adminAuth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.data.publicKey).toBe(toBase64(x25519.getPublicKey(employeePrivKey)));
    expect(body.data.keyVersion).toBe(employeeKeyVersion);
  });

  it('should allow computing shared secret from fetched public key', async () => {
    // Admin fetches employee's key and derives shared secret from it
    const res = await fetch(`${BASE_URL}/e2e/keys/${employeeId}`, {
      headers: authOnly(adminAuth.authToken),
    });
    const body = (await res.json()) as JsonBody;
    const fetchedPubKey = fromBase64(body.data.publicKey as string);

    // Derive shared secret using fetched key (simulates real client flow)
    const derivedShared = x25519.getSharedSecret(adminPrivKey, fetchedPubKey);

    // Must match our pre-computed shared secret
    expect(toBase64(derivedShared)).toBe(toBase64(sharedSecret));
  });
});
