/**
 * Chat E2E Encrypted Messages — API Integration Tests
 *
 * Tests the encrypted message flow through the REST API:
 * - Send E2E encrypted messages (E2E fields stored, content NULL)
 * - Key version validation (mismatch → 422)
 * - E2E fields returned in GET messages responses
 * - In-conversation search excludes E2E messages
 * - Plaintext messages still work alongside E2E
 *
 * Runs against REAL backend (Docker must be running).
 *
 * @see vitest.config.ts (api project)
 */
import {
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  ensureE2eKey,
  ensureTestEmployee,
  loginApitest,
} from './helpers.js';

// ─── Test Constants ──────────────────────────────────────────────────────────

/**
 * Fake ciphertext — server stores opaque base64, never decrypts.
 * Content does not need to be real ciphertext for REST API tests.
 */
const FAKE_CIPHERTEXT = Buffer.from('test-encrypted-content-for-api-integration').toString(
  'base64',
);

/** Fake 24-byte XChaCha20-Poly1305 nonce (base64) */
const FAKE_NONCE = Buffer.from(new Uint8Array(24).fill(42)).toString('base64');

/** Current HKDF epoch (UTC day number) */
const CURRENT_EPOCH = Math.floor(Date.now() / 86_400_000);

/** Unique plaintext for search isolation — avoids collisions with other test data */
const SEARCH_PLAINTEXT = `e2e-api-test-searchable-${Date.now()}`;

// ─── Module State ────────────────────────────────────────────────────────────

let auth: AuthState;
let employeeId: number;
let keyVersion: number;
let conversationId: number | undefined;

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  auth = await loginApitest();
  employeeId = await ensureTestEmployee(auth.authToken);

  // Ensure admin user has E2E key registered (idempotent)
  const keyInfo = await ensureE2eKey(auth.authToken);
  keyVersion = keyInfo.keyVersion;

  // Create a direct 1:1 conversation for message tests
  const res = await fetch(`${BASE_URL}/chat/conversations`, {
    method: 'POST',
    headers: authHeaders(auth.authToken),
    body: JSON.stringify({
      participantIds: [employeeId],
      type: 'direct',
    }),
  });
  const body = (await res.json()) as JsonBody;

  if (body.data?.conversation?.id !== undefined) {
    conversationId = body.data.conversation.id as number;
  }
});

afterAll(async () => {
  if (conversationId !== undefined) {
    await fetch(`${BASE_URL}/chat/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  }
});

// ─── seq: 1 — Send Plaintext Message ─────────────────────────────────────────

describe('E2E Messages: Send Plaintext Message', () => {
  it('should send plaintext message with isE2e=false', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ message: 'Hello plaintext' }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.message.content).toBe('Hello plaintext');
    expect(body.data.message.isE2e).toBe(false);
    expect(body.data.message.encryptedContent).toBeNull();
    expect(body.data.message.e2eNonce).toBeNull();
    expect(body.data.message.e2eKeyVersion).toBeNull();
    expect(body.data.message.e2eKeyEpoch).toBeNull();
  });
});

// ─── seq: 2 — Send E2E Encrypted Message ─────────────────────────────────────

describe('E2E Messages: Send Encrypted Message', () => {
  it('should store ciphertext with content=null', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        encryptedContent: FAKE_CIPHERTEXT,
        e2eNonce: FAKE_NONCE,
        e2eKeyVersion: keyVersion,
        e2eKeyEpoch: CURRENT_EPOCH,
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);

    const msg = body.data.message;
    expect(msg.isE2e).toBe(true);
    expect(msg.content).toBeNull();
    expect(msg.encryptedContent).toBe(FAKE_CIPHERTEXT);
    expect(msg.e2eNonce).toBe(FAKE_NONCE);
    expect(msg.e2eKeyVersion).toBe(keyVersion);
    expect(msg.e2eKeyEpoch).toBe(CURRENT_EPOCH);
  });

  it('should return correct sender info on E2E message', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        encryptedContent: FAKE_CIPHERTEXT,
        e2eNonce: FAKE_NONCE,
        e2eKeyVersion: keyVersion,
        e2eKeyEpoch: CURRENT_EPOCH,
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(201);
    const msg = body.data.message;
    expect(msg.senderId).toBe(auth.userId);
    expect(msg.senderName).toBeDefined();
    expect(msg.id).toBeGreaterThan(0);
    expect(msg.conversationId).toBe(conversationId);
  });
});

// ─── seq: 3 — Key Version Validation ─────────────────────────────────────────

describe('E2E Messages: Key Version Validation', () => {
  it('should reject message with mismatched key version (422)', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        encryptedContent: FAKE_CIPHERTEXT,
        e2eNonce: FAKE_NONCE,
        e2eKeyVersion: 999, // Wrong version — server has v1
        e2eKeyEpoch: CURRENT_EPOCH,
      }),
    });

    expect(res.status).toBe(422);
  });

  it('should include descriptive error on key version mismatch', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        encryptedContent: FAKE_CIPHERTEXT,
        e2eNonce: FAKE_NONCE,
        e2eKeyVersion: 999,
        e2eKeyEpoch: CURRENT_EPOCH,
      }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(422);
    // AllExceptionsFilter wraps errors as { success: false, error: { code, message } }
    expect(body.error.message).toContain('key version');
  });
});

// ─── seq: 4 — GET Messages Returns E2E Fields ───────────────────────────────

describe('E2E Messages: GET Messages Returns E2E Fields', () => {
  it('should return both plaintext and E2E messages with correct fields', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages?limit=100`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // ResponseInterceptor unwraps paginated responses:
    // body.data = messages array, body.meta.pagination = pagination
    const messages = body.data as Array<Record<string, unknown>>;
    expect(messages.length).toBeGreaterThanOrEqual(2);

    // Find a plaintext message
    const plaintextMsg = messages.find((m: Record<string, unknown>) => m.isE2e === false);
    expect(plaintextMsg).toBeDefined();
    expect(plaintextMsg!.content).not.toBeNull();
    expect(plaintextMsg!.encryptedContent).toBeNull();

    // Find our specific E2E message from THIS run (search from newest first,
    // because stale messages from previous runs may have a different key version)
    const e2eMsg = messages
      .slice()
      .reverse()
      .find(
        (m: Record<string, unknown>) => m.isE2e === true && m.encryptedContent === FAKE_CIPHERTEXT,
      );
    expect(e2eMsg).toBeDefined();
    expect(e2eMsg!.content).toBeNull();
    expect(e2eMsg!.encryptedContent).toBe(FAKE_CIPHERTEXT);
    expect(e2eMsg!.e2eNonce).toBe(FAKE_NONCE);
    expect(e2eMsg!.e2eKeyVersion).toBe(keyVersion);
    expect(e2eMsg!.e2eKeyEpoch).toBe(CURRENT_EPOCH);
  });

  it('should include pagination metadata', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages?limit=100`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.meta.pagination).toBeDefined();
    expect(body.meta.pagination.totalItems).toBeGreaterThanOrEqual(2);
  });
});

// ─── seq: 5 — Search Excludes E2E Messages ──────────────────────────────────

describe('E2E Messages: Search Excludes E2E Messages', () => {
  /** Send a plaintext message with known search term, then verify search finds it */
  it('should find plaintext messages by search term', async () => {
    expect(conversationId).toBeDefined();

    // Send a plaintext message with unique search term
    await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ message: SEARCH_PLAINTEXT }),
    });

    // Search for that term
    const res = await fetch(
      `${BASE_URL}/chat/conversations/${conversationId}/messages?search=${encodeURIComponent(SEARCH_PLAINTEXT)}`,
      {
        headers: authOnly(auth.authToken),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    // Paginated: body.data is the messages array directly
    const messages = body.data as Array<Record<string, unknown>>;
    expect(messages.length).toBeGreaterThanOrEqual(1);

    // All returned messages should be plaintext (is_e2e = false)
    for (const msg of messages) {
      expect(msg.isE2e).toBe(false);
    }
  });

  it('should NOT return E2E messages in search results', async () => {
    expect(conversationId).toBeDefined();

    // Search for ciphertext content — should return empty because E2E messages
    // are excluded from search (AND m.is_e2e = false)
    const res = await fetch(
      `${BASE_URL}/chat/conversations/${conversationId}/messages?search=${encodeURIComponent(FAKE_CIPHERTEXT)}`,
      {
        headers: authOnly(auth.authToken),
      },
    );
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    // Paginated: body.data is the messages array directly
    const messages = body.data as Array<Record<string, unknown>>;

    // No E2E messages should appear in search results
    const e2eMessages = messages.filter((m: Record<string, unknown>) => m.isE2e === true);
    expect(e2eMessages.length).toBe(0);
  });
});

// ─── seq: 6 — DTO Validation ────────────────────────────────────────────────

describe('E2E Messages: DTO Validation', () => {
  it('should reject negative e2eKeyEpoch', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        encryptedContent: FAKE_CIPHERTEXT,
        e2eNonce: FAKE_NONCE,
        e2eKeyVersion: keyVersion,
        e2eKeyEpoch: -1,
      }),
    });

    // Zod: e2eKeyEpoch must be non-negative
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('should reject non-positive e2eKeyVersion', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        encryptedContent: FAKE_CIPHERTEXT,
        e2eNonce: FAKE_NONCE,
        e2eKeyVersion: 0,
        e2eKeyEpoch: CURRENT_EPOCH,
      }),
    });

    // Zod: e2eKeyVersion must be positive (> 0)
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('should reject excessively long encrypted content', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        encryptedContent: 'A'.repeat(100_001), // Exceeds MAX_ENCRYPTED_LENGTH
        e2eNonce: FAKE_NONCE,
        e2eKeyVersion: keyVersion,
        e2eKeyEpoch: CURRENT_EPOCH,
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// ─── seq: 7 — Edit Message Blocked for E2E ──────────────────────────────────

describe('E2E Messages: Edit Blocked for E2E', () => {
  let e2eMessageId: number | undefined;
  let plaintextMessageId: number | undefined;

  beforeAll(async () => {
    if (conversationId === undefined) throw new Error('conversationId not set');

    // Send an E2E message and capture its ID
    const e2eRes = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        encryptedContent: FAKE_CIPHERTEXT,
        e2eNonce: FAKE_NONCE,
        e2eKeyVersion: keyVersion,
        e2eKeyEpoch: CURRENT_EPOCH,
      }),
    });
    const e2eBody = (await e2eRes.json()) as JsonBody;
    e2eMessageId = e2eBody.data?.message?.id as number | undefined;

    // Send a plaintext message and capture its ID
    const ptRes = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ message: 'edit-test-plaintext' }),
    });
    const ptBody = (await ptRes.json()) as JsonBody;
    plaintextMessageId = ptBody.data?.message?.id as number | undefined;
  });

  it('should return 422 when editing an E2E message', async () => {
    expect(e2eMessageId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/messages/${e2eMessageId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ message: 'edited content' }),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(422);
    expect(body.error.message).toContain('encrypted');
  });

  it('should return 400 (not implemented) when editing a plaintext message', async () => {
    expect(plaintextMessageId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/messages/${plaintextMessageId}`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ message: 'edited content' }),
    });

    expect(res.status).toBe(400);
  });

  it('should return 404 when editing a non-existent message', async () => {
    const res = await fetch(`${BASE_URL}/chat/messages/999999`, {
      method: 'PUT',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ message: 'edited content' }),
    });

    expect(res.status).toBe(404);
  });
});

// ─── seq: 8 — Auth Required ─────────────────────────────────────────────────

describe('E2E Messages: Auth Required', () => {
  it('should return 401 for sending message without auth', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encryptedContent: FAKE_CIPHERTEXT,
        e2eNonce: FAKE_NONCE,
        e2eKeyVersion: 1,
        e2eKeyEpoch: CURRENT_EPOCH,
      }),
    });

    expect(res.status).toBe(401);
  });

  it('should return 401 for getting messages without auth', async () => {
    expect(conversationId).toBeDefined();

    const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`);

    expect(res.status).toBe(401);
  });
});
