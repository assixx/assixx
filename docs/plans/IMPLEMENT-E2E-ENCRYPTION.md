# E2E Encryption MVP Plan — 1:1 Messages Only

> **Version:** 3.6.0
> **Created:** 2026-02-10
> **Updated:** 2026-02-11
> **Status:** PHASE 0 DONE, PHASE 1 DONE — 14/14 DoD items complete + 3 post-testing bugfixes
> **Author:** Claude Code + SCS
> **Branch:** `e2e`
> **Replaces:** v3.5 (3 critical bugfixes: user-scoped IndexedDB, ensureKeyOnServer, toast notifications)

---

## 1. Executive Summary

Add End-to-End Encryption for **1:1 chat messages only**. Two phases. No group encryption, no attachment encryption, no device linking, no TOFU, no forced rotation. Ship it, learn, iterate.

**Crypto:** X25519 ECDH + XChaCha20-Poly1305 + HKDF-SHA256 via `@noble` suite (audited, MIT, 14KB gzip).

**User experience:** Zero setup. Keys generate automatically. Lock icon on messages. That's it.

**What the user gets:**

- Messages encrypted on sender's device, decrypted only on recipient's device
- Server stores only ciphertext — cannot read message contents
- Lock icon on every message
- No passphrases, no setup wizards, no config

**What this is NOT:**

- NOT Signal Protocol (no Double Ratchet) — daily HKDF epoch rotation limits exposure of _derived_ keys only (see Section 4 for honest threat model)
- NOT group encryption (Phase 2, future)
- NOT attachment encryption (Phase 3, future)

---

## 2. Scope

### In Scope (MVP)

- X25519 key pair generation (automatic, silent)
- CryptoWorker (Web Worker isolation for private key)
- 1:1 message encryption/decryption
- Daily key rotation via HKDF epoch (zero-infrastructure)
- Server-side public key storage + key version validation
- `navigator.storage.persist()` (prevent browser eviction of private key)
- Multi-tab coordination (atomic IndexedDB check-and-set)
- Basic key rotation (admin reset only)
- CSP hardening (nonce-based)
- Lock icon UI
- Server-side search disabled for E2E messages

### Explicitly Out of Scope (Future)

- Group chat encryption
- Attachment/file encryption
- Device linking (multi-device)
- TOFU key pinning
- Forced key rotation (90-day server-enforced — daily HKDF rotation IS in scope)
- Fingerprint verification UI
- Safety numbers comparison
- Client-side search
- GDPR Article 15 client-side message export (metadata export IS in scope)

---

## 3. Prerequisites — All Verified

| Prerequisite             | Status       | Details                                                                                                                                              |
| ------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.user_id` GUC        | **DONE**     | JwtAuthGuard → CLS → tenantTransaction() → set_config. RESTRICTIVE RLS policies will work.                                                           |
| WebSocket server         | **EXISTS**   | Standalone `ChatWebSocketServer` (websocket.ts, 947 lines). Raw WS + connection tickets. Just add E2E fields — NO NestJS gateway migration needed.   |
| CSP partial config       | **EXISTS**   | svelte.config.js has `worker-src 'self' blob:`. Need to switch to `mode: 'nonce'` for `script-src` (nonce-based, not just removing `unsafe-inline`). |
| `@noble` browser support | **VERIFIED** | Works in all modern browsers (needs BigInt — Chrome 67+, Firefox 68+, Safari 14+).                                                                   |

---

## 4. Cryptographic Design

### Key Types

| Key                   | Algorithm   | Size          | Lifetime                             | Storage                                                                       |
| --------------------- | ----------- | ------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| **Identity Key Pair** | X25519      | 32 bytes each | Until admin reset or device loss     | Private: user-scoped IndexedDB (`assixx-e2e-user-${userId}`). Public: server. |
| **Shared Secret**     | X25519 ECDH | 32 bytes      | Ephemeral (derived on-the-fly)       | Never stored                                                                  |
| **Encryption Key**    | HKDF-SHA256 | 32 bytes      | Per-conversation per-epoch (derived) | Never stored                                                                  |
| **Message Nonce**     | Random      | 24 bytes      | Per-message                          | Stored with ciphertext                                                        |

### Key Derivation Chain

```
User opens chat for first time
  │
  ├─ CryptoWorker: Generate X25519 key pair (automatic)
  │    Private key → IndexedDB (device-bound)
  │    Public key → uploaded to server
  │
Sending a message to Bob:
  │
  ├─ CryptoWorker: x25519.getSharedSecret(myPrivate, bobPublic)
  │    → rawSharedSecret (32 bytes)
  │
  ├─ keyEpoch = Math.floor(Date.now() / 86_400_000)   // rotates daily
  │
  ├─ CryptoWorker: hkdf(sha256, rawSharedSecret, conversationSalt, 'assixx-e2e-v1:' + keyEpoch, 32)
  │    → encryptionKey (32 bytes, unique per day)
  │
  └─ CryptoWorker: xchacha20poly1305(encryptionKey, randomNonce).encrypt(plaintext)
       → ciphertext + nonce + keyEpoch → sent to server
```

### Conversation Salt

```
conversationSalt = SHA-256("assixx:" + tenantId + ":" + conversationId + ":" + sort([userIdA, userIdB]).join(":"))
```

Includes sorted user IDs to prevent salt collision if conversation IDs are reused after TRUNCATE.

### Daily Key Epoch Rotation

```
keyEpoch = Math.floor(Date.now() / 86_400_000)  // integer, rotates every 24h UTC
```

**How it works:** The epoch integer is appended to the HKDF `info` parameter: `'assixx-e2e-v1:' + keyEpoch`. Same ECDH shared secret, same salt, different info → different encryption key every day.

**What epoch rotation DOES protect against:** If a _derived daily encryption key_ is somehow extracted (e.g., Worker memory dump of one session), only that day's messages (~24h window) are exposed. Other days use different derived keys.

**What epoch rotation does NOT protect against:** If the _X25519 private key_ itself is compromised (e.g., IndexedDB theft via XSS — the realistic attack vector), the attacker can derive ALL epoch keys for ALL days, past and future. For protection against private key compromise, a full Double Ratchet (Signal Protocol) is needed — that's out of scope for MVP.

**Bottom line:** Epoch rotation is a cheap defense-in-depth layer that narrows the exposure window for a specific class of key leak. It is NOT a substitute for forward secrecy. We do NOT claim forward secrecy.

**Sender stores epoch with message.** Recipient uses the stored epoch (NOT their own clock) to derive the decryption key. No clock sync requirement — the epoch is data, not a timestamp comparison.

**Epoch boundary edge case:** A user sends a message at 23:59:59 UTC (epoch N), the recipient opens it at 00:00:01 UTC (epoch N+1). This works correctly because the stored epoch (N) is used for decryption, not the recipient's current time. Test suite MUST cover this boundary explicitly.

**Zero infrastructure:** No key distribution, no server coordination, no additional key exchange. The epoch is just an integer stored alongside the ciphertext.

### Why XChaCha20-Poly1305

24-byte nonce = safe random nonce generation (collision probability ~2^-96 at 2^48 messages). AES-GCM's 12-byte nonce has real collision risk at high message volumes. No debate.

---

## 5. Web Worker Architecture

### Purpose

Defense-in-depth against XSS. Private key held in Worker memory — main thread never receives it via postMessage.

**Honest limitation:** IndexedDB is accessible from both Worker and main thread. A targeted XSS attack CAN read IndexedDB directly. The Worker prevents casual key leakage, not targeted attacks. CSP is the primary XSS defense.

### Worker Message Protocol

```typescript
// Main Thread → Worker
type WorkerRequest = { requestId: string } & (
  | { type: 'init'; userId: number } // userId scopes IndexedDB: `assixx-e2e-user-${userId}`
  | { type: 'generateKeys' }
  | { type: 'encrypt'; plaintext: string; recipientPublicKey: string; conversationSalt: string; keyEpoch: number }
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

// Worker → Main Thread
type WorkerResponse = { requestId: string } & (
  | { type: 'ready'; hasKey: boolean }
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
```

Every request carries `requestId` (crypto.randomUUID()) for response correlation. CryptoBridge maps requestId → pending Promise.

### Worker-Internal Caching (Performance)

Loading a conversation with N messages means N decrypt operations. Without caching, each decrypt performs ECDH + HKDF + XChaCha20. ECDH is ~0.5ms per op — 500 messages = 250ms just for key agreement.

**The Worker MUST cache internally:**

| Cache               | Key                           | Value                          | Lifetime       |
| ------------------- | ----------------------------- | ------------------------------ | -------------- |
| `sharedSecretCache` | recipient public key (base64) | 32-byte raw shared secret      | Until `lock()` |
| `epochKeyCache`     | `${recipientPubKey}:${epoch}` | 32-byte derived encryption key | Until `lock()` |

**Cache invalidation:** Both caches are `Map` instances in Worker memory. Cleared on `lock()` and Worker restart. Never persisted to IndexedDB — derived keys are ephemeral by design.

**Impact:** First message per recipient per epoch: ECDH + HKDF + XChaCha20 (~1ms). Subsequent messages same epoch: XChaCha20 only (~0.01ms). 500 messages from same sender, same day = ~1ms + 499×0.01ms ≈ 6ms total.

### Worker Crash Recovery

1. Detect via `worker.onerror` + 10-second request timeout
2. Auto-restart: new Worker instance, re-init from IndexedDB
3. Reject all pending promises with `WorkerCrashedError`
4. Retry failed operation once; if second attempt fails:
   - **Decrypt failure:** Show `[Decryption failed]` with tooltip explaining the key may have been lost
   - **Encrypt failure:** Show "Message failed to send" inline with retry button. Message stays in input. No silent data loss.

### `lock()` Honesty

`lock()` clears the private key from Worker memory and deletes it from IndexedDB. Called on explicit logout.

**Do NOT rely on `lock()` for tab close/navigation.** `beforeunload`/`pagehide` events are unreliable on mobile browsers (iOS Safari fires `pagehide` inconsistently, Android Chrome may kill the process without events). `lock()` is a best-effort cleanup — the primary security boundary is that IndexedDB is origin-scoped and browser-sandboxed, not that `lock()` always fires.

---

## 6. Phase 0 — Key Management Foundation

### Definition of Done — ALL COMPLETE

- [x] `e2e_user_keys` table created with RLS — migration `20260210000022_e2e-user-keys.ts` applied
- [x] E2eKeys backend module (register, get, reset endpoints) — `backend/src/nest/e2e-keys/`
- [x] CryptoWorker generates X25519 key pair automatically on first authenticated page visit (app layout, NOT just /chat)
- [x] `navigator.storage.persist()` requested before key generation. If `persist()` returns `false`: logs warning, proceeds (non-blocking).
- [x] Multi-tab coordination: atomic IndexedDB `readwrite` transaction prevents duplicate key generation + server 409 handling
- [x] Private key stored in IndexedDB, public key uploaded to server
- [x] CSP `script-src` tightened via nonce-based approach (`mode: 'nonce'`)
- [x] Unit tests for crypto operations (23 tests including epoch rotation) — `e2e-crypto.test.ts`
- [x] API integration tests for key endpoints (including duplicate key 409) — `e2e-keys.api.test.ts`

### 6.1 Database Migration

**File:** `database/migrations/YYYYMMDDHHMMSS_e2e-user-keys.ts`

```sql
CREATE TABLE e2e_user_keys (
    id UUID PRIMARY KEY,  -- UUIDv7 (application-generated)
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,       -- base64 X25519 public key (32 bytes)
    fingerprint VARCHAR(64) NOT NULL, -- SHA-256 hex of public key
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active INTEGER NOT NULL DEFAULT 1,  -- 0=inactive, 1=active, 4=deleted
    UNIQUE(tenant_id, user_id, key_version)
);

-- Enforce exactly ONE active key per user per tenant
CREATE UNIQUE INDEX idx_e2e_user_keys_one_active
    ON e2e_user_keys(tenant_id, user_id) WHERE is_active = 1;

CREATE INDEX idx_e2e_user_keys_tenant ON e2e_user_keys(tenant_id);
CREATE INDEX idx_e2e_user_keys_user ON e2e_user_keys(user_id);
CREATE INDEX idx_e2e_user_keys_active ON e2e_user_keys(user_id, is_active) WHERE is_active = 1;

-- RLS (ADR-019 pattern)
ALTER TABLE e2e_user_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE e2e_user_keys FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON e2e_user_keys
    FOR ALL USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON e2e_user_keys TO app_user;
```

### 6.2 Backend — E2E Keys Module

**New files:**

```
backend/src/nest/e2e-keys/
├── e2e-keys.module.ts
├── e2e-keys.controller.ts
├── e2e-keys.service.ts
├── e2e-keys.types.ts
└── dto/
    ├── register-keys.dto.ts
    └── index.ts
```

**Endpoints:**

| Method   | Path                       | Auth  | Purpose                                     |
| -------- | -------------------------- | ----- | ------------------------------------------- |
| `POST`   | `/api/v2/e2e/keys`         | User  | Register public key (409 if already exists) |
| `GET`    | `/api/v2/e2e/keys/me`      | User  | Get own key data                            |
| `GET`    | `/api/v2/e2e/keys/:userId` | User  | Get another user's public key               |
| `DELETE` | `/api/v2/e2e/keys`         | Admin | Reset a user's key (marks is_active=4)      |

**Rate Limiting (ADR-001):**

| Endpoint                | Limit        | Reason                                  |
| ----------------------- | ------------ | --------------------------------------- |
| `POST /e2e/keys`        | 5/hour/user  | Key registration is rare                |
| `GET /e2e/keys/:userId` | 60/min/user  | Normal usage ~1 lookup per conversation |
| `DELETE /e2e/keys`      | 3/hour/admin | Prevents rapid reset attacks            |

**Zod DTO:**

```typescript
// dto/register-keys.dto.ts
const RegisterKeysSchema = z.object({
  publicKey: z
    .string()
    .min(40)
    .max(50)
    .refine(
      (val) => {
        try {
          const bytes = Buffer.from(val, 'base64');
          return bytes.length === 32;
        } catch {
          return false;
        }
      },
      { message: 'Public key must be a valid base64-encoded 32-byte X25519 key' },
    ),
});
```

**Service (key methods):**

```typescript
class E2eKeysService {
  async registerKeys(publicKey: string): Promise<{ fingerprint: string }>;
  async getOwnKeys(): Promise<E2eUserKey | null>;
  async getPublicKey(userId: number): Promise<{ publicKey: string; fingerprint: string } | null>;
  async hasKeys(userId: number): Promise<boolean>;
  async resetKeys(userId: number): Promise<void>; // Admin only: is_active = 4
}
```

### 6.3 Frontend — CryptoWorker

**New file:** `frontend/src/lib/crypto/crypto-worker.ts`

Web Worker that:

1. On init: requests `navigator.storage.persist()` (Worker has access to Navigator API)
2. Before key generation: atomic IndexedDB `readwrite` transaction — check if key exists, only generate if absent. This serializes across tabs (IndexedDB transactions are exclusive within `readwrite`).
3. Generates X25519 key pair via `@noble/curves`
4. Stores private key in **user-scoped IndexedDB** (`assixx-e2e-user-${userId}` database, `private-keys` store) — each user gets their own database to prevent key cross-contamination on shared browsers
5. Performs ECDH + HKDF (with epoch in info string) + XChaCha20-Poly1305 encrypt/decrypt
6. Never sends raw private key via postMessage

**IndexedDB schema:**

```typescript
interface StoredPrivateKey {
  keyVersion: number; // keyPath
  privateKey: Uint8Array; // 32-byte X25519 private key
  publicKey: string; // base64
  isActive: boolean;
  createdAt: string; // ISO 8601
}
```

### 6.4 Frontend — CryptoBridge

**New file:** `frontend/src/lib/crypto/crypto-bridge.ts`

Promise-based wrapper for main thread → Worker communication:

```typescript
class CryptoBridge {
  private worker: Worker;
  private pending: Map<string, { resolve; reject }>;
  private lastUserId: number | null; // stored for crash recovery re-init

  async init(userId: number): Promise<{ hasKey: boolean; persisted: boolean }>;
  async generateKeys(): Promise<{ publicKey: string; fingerprint: string }>;
  async encrypt(
    plaintext: string,
    recipientPublicKey: string,
    conversationSalt: string,
    keyEpoch?: number,
  ): Promise<{ ciphertext: string; nonce: string; keyEpoch: number }>;
  async decrypt(
    ciphertext: string,
    nonce: string,
    senderPublicKey: string,
    conversationSalt: string,
    keyEpoch: number,
  ): Promise<string>;
  async getPublicKey(): Promise<string>;
  async lock(): Promise<void>; // Clear private key from Worker memory + IndexedDB on explicit logout
  destroy(): void;
}

export const cryptoBridge = new CryptoBridge();
```

### 6.5 Frontend — E2E Reactive State

**New file:** `frontend/src/lib/crypto/e2e-state.svelte.ts`

```typescript
let e2eState = $state<{
  isReady: boolean;
  publicKey: string | null;
  fingerprint: string | null;
}>({
  isReady: false,
  publicKey: null,
  fingerprint: null,
});

export const e2e = {
  get state() { return e2eState; },
  async initialize(userId: number): Promise<void>,  // Init Worker (user-scoped), auto-generate keys if needed, ensureKeyOnServer()
  lock(): void,                                       // On logout
};
```

### 6.6 CSP Hardening

**Modify:** `frontend/svelte.config.js`

```javascript
csp: {
  mode: 'nonce',  // SvelteKit generates per-request nonce for inline scripts (SSR hydration needs this)
  directives: {
    'default-src': ['self'],
    'script-src': ['self'],  // nonce added automatically by SvelteKit for inline scripts
    'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
    'font-src': ['self', 'https://fonts.gstatic.com'],
    'connect-src': ['self', '*.ingest.de.sentry.io', '*.sentry.io', 'ws://localhost:*', 'wss://*.assixx.com'],
    'worker-src': ['self', 'blob:'],
    'img-src': ['self', 'data:', 'blob:'],
    'object-src': ['none'],
    'base-uri': ['self'],
    'frame-ancestors': ['none'],
  },
},
```

**Why `mode: 'nonce'` (NOT removing `unsafe-inline`):** SvelteKit SSR generates inline `<script>` tags for hydration data. Simply removing `unsafe-inline` from `script-src` breaks SSR hydration. With `mode: 'nonce'`, SvelteKit automatically generates a per-request cryptographic nonce and adds `nonce="..."` to all its inline scripts. The CSP header becomes `script-src 'self' 'nonce-<random>'` — this is strictly better than `unsafe-inline` because only scripts with the correct nonce execute.

### 6.7 Multi-Tab Coordination

**Problem:** User opens two tabs simultaneously. Both detect "no key in IndexedDB" → both generate keys → both POST to server → one fails or keys are inconsistent.

**Solution:** IndexedDB `readwrite` transactions serialize across tabs within the same origin:

```typescript
// Inside CryptoWorker generateKeys handler:
// db = openDB(`assixx-e2e-user-${userId}`, ...) — user-scoped
const tx = db.transaction('private-keys', 'readwrite');
const store = tx.objectStore('private-keys');
const existing = await store.get(1); // keyVersion 1 is the active key

if (existing) {
  // Another tab already generated keys — use those
  return { type: 'keysGenerated', publicKey: existing.publicKey, fingerprint: computeFingerprint(existing.publicKey) };
}

// No key exists — generate and store atomically within this transaction
const keyPair = generateX25519();
await store.put({
  keyVersion: 1,
  privateKey: keyPair.privateKey,
  publicKey: encode(keyPair.publicKey),
  isActive: true,
  createdAt: new Date().toISOString(),
});
await tx.done;
```

**Server-side defense:** POST `/api/v2/e2e/keys` returns `409 Conflict` if a key already exists for this user+tenant. The frontend handles 409 gracefully — fetches the existing key via `GET /e2e/keys/me` and continues.

### 6.8 Auto Key Generation Flow

```
User logs in (any authenticated page, via +layout.svelte in (app) group)
  │
  ├─ +layout.svelte onMount → e2e.initialize(userId)
  │    ├─ cryptoBridge.init(userId)
  │    │    → Worker opens user-scoped IndexedDB (`assixx-e2e-user-${userId}`)
  │    │    → Worker requests navigator.storage.persist()
  │    │    → Worker checks IndexedDB (readwrite transaction)
  │    │    → Returns { hasKey: false, persisted: true }
  │    ├─ cryptoBridge.generateKeys()
  │    │    → Worker opens readwrite transaction
  │    │    → Atomic check: key exists? → skip. Else generate X25519 key pair + store.
  │    │    → Returns { publicKey, fingerprint }
  │    ├─ ensureKeyOnServer(publicKey)
  │    │    → GET /api/v2/e2e/keys/me → not null? → use server data
  │    │    → null? → POST /api/v2/e2e/keys { publicKey }
  │    │         → 201 Created: Server stores public key + computes fingerprint
  │    │         → 409 Conflict: Key already exists → GET /e2e/keys/me instead
  │    └─ e2eState.isReady = true
  │
  └─ No modal, no prompt, no user interaction. Silent.
```

**Why +layout.svelte (not +page.svelte in /chat):** If key generation only happens in /chat, then User A can message User B who has never visited /chat → User B has no public key → encryption fails. Moving to the app layout ensures keys are generated on first login, regardless of which page the user visits first.

---

## 7. Phase 1 — 1:1 Message Encryption

### Definition of Done — ALL 14/14 COMPLETE

- [x] All new 1:1 messages encrypted client-side before sending (with daily epoch rotation) — `e2e-handlers.ts`
- [x] Server stores only ciphertext in `messages.encrypted_content` + `e2e_key_epoch` — migration `20260210000023` applied
- [x] Server validates sender's `e2e_key_version` before accepting message — both REST (`chat-messages.service.ts`) and WS (`websocket.ts`)
- [x] Recipient decrypts client-side via CryptoWorker using stored epoch (NOT own clock) — `decryptSingleMessage()` uses `msg.e2eKeyEpoch`
- [x] Lock icon on every message — green lock in `MessagesArea.svelte` message-time footer
- [x] WebSocket delivery works with encrypted payloads — `resolveE2eFields()` + `processAndBroadcastMessage()`
- [x] System messages (`is_system = true`) remain plaintext with `is_e2e = false` — `DEFAULT false` on column
- [x] Message editing disabled for E2E messages (HTTP 422) — `editMessage()` checks `is_e2e`, returns 422 for E2E, 400 "not implemented" for plaintext, 404 for non-existent
- [x] Server-side search returns empty for E2E messages — `AND m.is_e2e = false` in search query
- [x] Encrypt failure shows "Message failed to send" with retry (no silent data loss) — `E2eError` thrown, `messageInput` restored
- [x] `messages.content` nullable audit complete — types updated (`string | null`), `resolveMessageContent()` helper, MessagesArea handles null
- [x] Recipient without keys: sender gets clear error — `E2eError('no_recipient_key')` → German notification
- [x] Unit tests for encrypt/decrypt roundtrip (including epoch rotation) — 23 tests in `e2e-crypto.test.ts`
- [x] API integration tests for encrypted message flow (17 tests: plaintext, E2E send, key version mismatch 422, GET with E2E fields, search exclusion, DTO validation, edit blocked 422, auth) — `chat-e2e-messages.api.test.ts`

### 7.1 Database Migration — APPLIED

**File:** `database/migrations/20260210000023_e2e-message-columns.ts` (applied 2026-02-10)

```sql
ALTER TABLE chat_messages ADD COLUMN encrypted_content TEXT;
ALTER TABLE chat_messages ADD COLUMN e2e_nonce TEXT;
ALTER TABLE chat_messages ADD COLUMN is_e2e BOOLEAN NOT NULL DEFAULT false;  -- false = safer during deployment, flips to true per-message
ALTER TABLE chat_messages ADD COLUMN e2e_key_version INTEGER;
ALTER TABLE chat_messages ADD COLUMN e2e_key_epoch INTEGER;  -- Math.floor(Date.now() / 86_400_000), stored for decryption
ALTER TABLE chat_messages ALTER COLUMN content DROP NOT NULL;

CREATE INDEX idx_chat_messages_e2e ON chat_messages(is_e2e) WHERE is_e2e = true;
```

**Why `DEFAULT false`:** During deployment, if the backend is live but the frontend hasn't been deployed yet, system messages and any legacy code paths will create messages with `is_e2e = false` by default. The frontend explicitly sets `is_e2e = true` for encrypted messages. `DEFAULT true` would be dangerous — any message created without explicit E2E fields would claim to be encrypted while storing plaintext.

**`content` nullable audit — REQUIRED before migration:**

Run `Grep` for `\.content` and `messages.content` across entire codebase. Every hit needs null-safety. Known files (7+ files, NOT just 5):

| #   | File                                                               | Lines | What to check                                                                                                                         |
| --- | ------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `backend/src/websocket.ts`                                         | 948   | Inline SQL `INSERT INTO chat_messages (...content...)`, broadcast object `data.content`, `processAndBroadcastMessage()` content field |
| 2   | `backend/src/nest/chat/chat-messages.service.ts`                   | 534   | Every `SELECT content`, every `row.content`, `insertMessageRecord()`, `getMessages()` response mapping                                |
| 3   | `backend/src/nest/chat/chat.types.ts`                              | 288   | `MessageRow.content` → `string \| null`, `Message.content` → `string \| null`                                                         |
| 4   | `backend/src/nest/chat/chat.controller.ts`                         | 543   | Response mapping, any direct content access                                                                                           |
| 5   | `backend/src/nest/chat/chat-scheduled.service.ts`                  | 221   | `chat_scheduled_messages.content` — separate table but same pattern                                                                   |
| 6   | `frontend/src/routes/(app)/(shared)/chat/_lib/types.ts`            | 310   | `Message.content` → `string \| null`                                                                                                  |
| 7   | `frontend/src/routes/(app)/(shared)/chat/_lib/handlers.ts`         | 769   | `handleNewMessage()`, `sendMessage()`, WS message construction                                                                        |
| 8   | `frontend/src/routes/(app)/(shared)/chat/_lib/MessagesArea.svelte` | 579   | Every `{message.content}` render, search highlighting on content                                                                      |
| 9   | Any notification service                                           | ?     | Check if message preview/snippet uses `.content` (e.g., SSE badge with last message text)                                             |

**Rule:** Every `message.content` access in display code must use `message.decryptedContent ?? message.content ?? ''` for E2E messages, or `message.content ?? ''` for system messages. Type system enforces this via `content: string | null`.

### 7.2 WebSocket Changes — DONE

**Modified file:** `backend/src/websocket.ts`

In `handleSendMessage()`:

**Before (current):**

```typescript
// Receives: { conversationId, content, attachments }
// Stores: content as plaintext
```

**After (E2E):**

```typescript
// Receives: { conversationId, encryptedContent, e2eNonce, e2eKeyVersion, e2eKeyEpoch }
//   OR: { conversationId, content, isSystem: true } (for system messages)
// Stores: encrypted_content, e2e_nonce, content=NULL, is_e2e=true, e2e_key_epoch
```

The `handleSendMessage` handler needs to:

1. Accept `encryptedContent`, `e2eNonce`, `e2eKeyVersion`, `e2eKeyEpoch` fields
2. **Validate sender's key version** (see 7.3 for implementation)
3. Store in DB: `encrypted_content`, `e2e_nonce`, `e2e_key_version`, `e2e_key_epoch`, `content = NULL`, `is_e2e = true`
4. Broadcast the encrypted payload (NOT decrypt it)

System messages (join/leave) continue using `content` with `is_e2e = false`, `is_system = true`.

### 7.3 Backend Service Changes — DONE

**Modified file:** `backend/src/nest/chat/chat-messages.service.ts`

In `insertMessageRecord()`:

- Accept `encryptedContent`, `e2eNonce`, `e2eKeyVersion`, `e2eKeyEpoch` instead of `content`
- **Validate sender's key version before INSERT:**

```typescript
// Server-side key version validation — prevents decryption failures
const senderKey = await this.e2eKeysService.getOwnKeys(); // uses CLS context for userId
if (!senderKey || senderKey.keyVersion !== dto.e2eKeyVersion) {
  throw new UnprocessableEntityException(
    `Key version mismatch: sender claims v${dto.e2eKeyVersion}, server has v${senderKey?.keyVersion ?? 'none'}. ` +
      'Client must re-fetch their key data.',
  );
}
```

- Store `content = NULL` for user messages
- Store encrypted fields including `e2e_key_epoch`

In `getMessages()`:

- Include `encrypted_content`, `e2e_nonce`, `is_e2e`, `e2e_key_version`, `e2e_key_epoch` in SELECT
- Map to API response with camelCase

In `searchMessages()` (if exists):

- For E2E messages (`is_e2e = true`): exclude from server-side search results. The server has only ciphertext — searching it returns garbage matches. Return empty results with a flag `e2eSearchUnavailable: true` so the frontend can display "Search not available for encrypted messages."

In `editMessage()`:

- Reject edits for E2E messages: `throw new UnprocessableEntityException('Editing is not supported for encrypted messages')`

**Modified file:** `backend/src/nest/chat/chat.types.ts`

```typescript
// Add to MessageRow
encrypted_content: string | null;
e2e_nonce: string | null;
is_e2e: boolean;
e2e_key_version: number | null;
e2e_key_epoch: number | null;

// Add to Message (API response)
encryptedContent: string | null;
e2eNonce: string | null;
isE2e: boolean;
e2eKeyVersion: number | null;
e2eKeyEpoch: number | null;
```

**Modified file:** `backend/src/nest/chat/dto/send-message.dto.ts`

Add E2E fields to the Zod schema:

```typescript
encryptedContent: z.string().max(100_000),  // base64 ciphertext
e2eNonce: z.string().max(40),               // base64 24-byte nonce
e2eKeyVersion: z.number().int().positive(),  // sender's key version
e2eKeyEpoch: z.number().int().nonnegative(), // Math.floor(Date.now() / 86_400_000) — stored for decryption
```

### 7.4 Frontend Changes — DONE

**Architecture:** E2E logic was extracted from handlers.ts/+page.svelte into dedicated modules:

- `e2e-handlers.ts` — encrypt/decrypt logic (send, receive, batch)
- `chat-page-state.svelte.ts` — all chat page state & handlers (Svelte 5 factory function)
- `+page.svelte` — thin template shell (160 lines)

**Existing file:** `frontend/src/lib/crypto/public-key-cache.ts` — In-memory cache for other users' public keys with TTL.

**New file:** `frontend/src/routes/(app)/(shared)/chat/_lib/e2e-handlers.ts`

Exports: `prepareMessageForSending`, `decryptIncomingMessage`, `decryptLoadedMessages`, `E2eError`

- `prepareMessageForSending` — encrypts for 1:1, throws `E2eError` on failure (never silently falls back to plaintext)
- `decryptIncomingMessage` — decrypts WebSocket messages using stored epoch
- `decryptLoadedMessages` — batch decrypts REST API responses

**New file:** `frontend/src/routes/(app)/(shared)/chat/_lib/chat-page-state.svelte.ts`

Svelte 5 factory function (`createChatPageState`) extracted from +page.svelte. Owns all `$state`, `$derived`, `$effect`, WebSocket callbacks, and handler functions. Returns reactive getters/setters for template binding.

**Modified file:** `frontend/src/routes/(app)/(shared)/chat/_lib/handlers.ts`

- E2E functions removed (moved to `e2e-handlers.ts`)
- `handleNewMessage` dispatches E2E messages to `decryptIncomingMessage`

**Modified file:** `frontend/src/routes/(app)/(shared)/chat/_lib/types.ts`

E2E fields added to `Message`: `encryptedContent`, `e2eNonce`, `isE2e`, `e2eKeyVersion`, `e2eKeyEpoch`, `decryptedContent?`, `decryptionFailed?`, `encryptionFailed?`. `content` is now `string | null`.

**Modified file:** `frontend/src/routes/(app)/(shared)/chat/_lib/MessagesArea.svelte`

- Displays `decryptedContent` for E2E messages, `content` for system messages
- Green lock icon next to timestamp on all `isE2e === true` messages
- Red error state with German text for `decryptionFailed === true`

**Modified file:** `frontend/src/routes/(app)/(shared)/chat/_lib/constants.ts`

- Added `errorE2eNoRecipientKey` and `errorE2eEncryptFailed` German messages

**Modified file:** `frontend/src/routes/(app)/+layout.svelte`

- Calls `e2e.initialize(userId)` on mount (ensures keys exist for ALL authenticated users, user-scoped IndexedDB)
- Calls `e2e.lock()` on explicit logout

### 7.5 Group Conversations — PLAINTEXT, UNCHANGED

Group conversations (3+ participants) are **NOT affected** by this MVP. They continue to work exactly as today:

- Messages sent as plaintext via existing flow
- No lock icon
- No encryption
- No UI changes
- No "unencrypted" badge (adding one implies encryption is expected — it's not, for groups)

**Frontend check:** Before encrypting in `sendMessage()`, check `conversation.type === '1:1'` (or participant count === 2). If group → send plaintext via existing path. This is a simple guard, not a feature flag.

**Future:** Group encryption (Phase 2) requires symmetric key distribution and is explicitly deferred.

### 7.6 REST vs WebSocket Message Paths

Messages can currently be sent via TWO paths:

1. **WebSocket** `handleSendMessage()` in `websocket.ts` — primary path for real-time chat
2. **REST** `POST /conversations/:id/messages` in `chat.controller.ts` → `chat-messages.service.ts` — used by scheduled messages and potentially direct API calls

**Decision for MVP:** Both paths MUST support E2E fields. The controller already calls the service, so updating the service + DTO covers the REST path. But `chat.controller.ts` needs to:

1. Pass through E2E fields from the updated DTO to the service
2. Validate that 1:1 conversations require E2E fields (no plaintext fallback)
3. Return E2E fields in message responses

The WebSocket path in `websocket.ts` has inline SQL and separate broadcast logic — it needs independent E2E changes (see 7.2).

### 7.7 Message Editing — DISABLED for E2E

Backend rejects with HTTP 422. Frontend hides the "Edit" button for E2E messages with tooltip: "Encrypted messages cannot be edited." Users can delete and resend.

### 7.8 Scheduled Messages — DISABLED with E2E

Since we TRUNCATE, the scheduled messages table is empty. Disable the feature in UI: "Scheduled messages are not available with end-to-end encryption." The `chat-scheduled.service.ts` endpoints return 410 Gone.

---

## 8. Migration Strategy (Fresh Start)

```sql
-- TRUNCATE all chat data (maintenance window)
TRUNCATE TABLE chat_messages CASCADE;
TRUNCATE TABLE chat_conversations CASCADE;
TRUNCATE TABLE chat_conversation_participants CASCADE;
TRUNCATE TABLE chat_scheduled_messages CASCADE;
```

**Deployment order:**

1. Communicate to users: "Chat will be reset for encryption upgrade"
2. Run TRUNCATE
3. Run migrations (e2e_user_keys table + message columns)
4. Deploy backend with E2E endpoints
5. Deploy frontend with CryptoWorker
6. First user login → keys generated automatically → E2E active

**Rollback plan** — if E2E breaks in production:

1. Revert frontend to send plaintext (`is_e2e = false` in new messages)
2. Backend continues to serve both plaintext and encrypted messages
3. New messages work immediately

**Explicit cost of rollback:** All messages encrypted during the E2E period are **permanently unreadable**. The server has only ciphertext. Users cannot export or recover those messages after rollback. This is the inherent trade-off of true E2E encryption — there is no backdoor. Communicate this risk to stakeholders before deploying.

---

## 9. Security Notes

### What E2E Protects Against

- Server/DB compromise → messages are ciphertext
- Malicious DBA → cannot decrypt
- SQL injection → attacker gets ciphertext
- Backup theft → ciphertext only

### What E2E Does NOT Protect Against

- Compromised client device
- Sophisticated XSS (can read IndexedDB)
- Key substitution by server (MITM) — no TOFU in MVP
- Message metadata (who, when, how often)
- Shared terminals (private key in IndexedDB at rest — mitigated by user-scoped DB per userId)

### Layered XSS Defense

1. **Web Worker** — private key not in main thread memory
2. **CSP nonce** — `script-src 'self' 'nonce-<random>'` blocks injected scripts (primary defense). Nonce regenerated per request.
3. **SvelteKit auto-escaping** — no raw HTML injection
4. **`lock()` on explicit logout** — clears Worker memory + IndexedDB. Best-effort only on tab close (see `lock()` Honesty section).

### Admin Key Reset

Admin resets user's key → user generates fresh key on next login → old messages unreadable → all conversation partners see "[Name] has a new encryption key." No MITM mitigation in MVP (TOFU deferred).

---

## 10. Testing Strategy

### Crypto Unit Tests — `frontend/src/lib/crypto/__tests__/e2e-crypto.test.ts`

| Test                               | Description                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Key generation                     | Valid 32-byte X25519 key pair                                                   |
| ECDH symmetry                      | `derive(A.priv, B.pub) === derive(B.priv, A.pub)`                               |
| Encrypt/decrypt roundtrip          | Various message lengths (empty, short, 5000 chars, unicode/emoji)               |
| Wrong key decryption               | Returns error, not garbage                                                      |
| Fingerprint determinism            | Same key → same fingerprint                                                     |
| Salt uniqueness                    | Different conversations → different salts                                       |
| Epoch rotation                     | Same keys, different epochs → different ciphertext → both decrypt correctly     |
| Epoch from message                 | Decrypt uses stored epoch, not current `Date.now()`                             |
| Epoch boundary (23:59:59→00:00:01) | Message sent at epoch N, decrypted at epoch N+1 — uses stored epoch N, succeeds |
| Encrypt failure                    | Returns `encryptFailed` response, not crash                                     |

### Backend API Tests — `backend/test/e2e-keys.api.test.ts`

| Test                            | Description                                          |
| ------------------------------- | ---------------------------------------------------- |
| POST /e2e/keys                  | Register key, verify 201                             |
| POST /e2e/keys (duplicate)      | 409 Conflict (23505 or explicit check)               |
| POST /e2e/keys (multi-tab race) | Second POST returns 409, first wins                  |
| GET /e2e/keys/me                | Returns own public key + fingerprint                 |
| GET /e2e/keys/:userId           | Returns other user's public key                      |
| GET /e2e/keys/:userId (no key)  | Returns 404 or null (user hasn't generated keys yet) |
| DELETE /e2e/keys (admin)        | Marks keys is_active=4                               |
| 401 without auth                | All endpoints require authentication                 |
| Tenant isolation                | User A cannot access User B's keys cross-tenant      |

### Backend Service Tests — `backend/src/nest/e2e-keys/e2e-keys.service.test.ts`

| Test                     | Description                             |
| ------------------------ | --------------------------------------- |
| registerKeys             | Stores public key, computes fingerprint |
| registerKeys (duplicate) | Throws ConflictException (409)          |
| getOwnKeys               | Returns correct key data                |
| getPublicKey             | Returns other user's active public key  |
| hasKeys                  | true/false correctly                    |
| resetKeys                | Sets is_active=4                        |
| validateKeyVersion       | Rejects mismatched key version (422)    |
| Non-existent user        | Returns null                            |

---

## 11. File Inventory (Actual — verified 2026-02-10)

### New Files (16 total)

| File                                                                     | Phase | Purpose                                | Status      |
| ------------------------------------------------------------------------ | ----- | -------------------------------------- | ----------- |
| `database/migrations/20260210000022_e2e-user-keys.ts`                    | 0     | User keys table + RLS                  | **Applied** |
| `database/migrations/20260210000023_e2e-message-columns.ts`              | 1     | Message E2E columns + content nullable | **Applied** |
| `backend/src/nest/e2e-keys/e2e-keys.module.ts`                           | 0     | NestJS module                          | **Done**    |
| `backend/src/nest/e2e-keys/e2e-keys.controller.ts`                       | 0     | REST endpoints                         | **Done**    |
| `backend/src/nest/e2e-keys/e2e-keys.service.ts`                          | 0     | Business logic                         | **Done**    |
| `backend/src/nest/e2e-keys/e2e-keys.types.ts`                            | 0     | TypeScript interfaces                  | **Done**    |
| `backend/src/nest/e2e-keys/dto/register-keys.dto.ts`                     | 0     | Zod validation                         | **Done**    |
| `backend/src/nest/e2e-keys/dto/index.ts`                                 | 0     | Barrel export                          | **Done**    |
| `frontend/src/lib/crypto/crypto-worker.ts`                               | 0     | Web Worker (IndexedDB + crypto ops)    | **Done**    |
| `frontend/src/lib/crypto/crypto-bridge.ts`                               | 0     | Promise-based Worker wrapper           | **Done**    |
| `frontend/src/lib/crypto/e2e-state.svelte.ts`                            | 0     | Svelte 5 reactive E2E state            | **Done**    |
| `frontend/src/lib/crypto/public-key-cache.ts`                            | 1     | In-memory public key cache with TTL    | **Done**    |
| `frontend/src/lib/crypto/conversation-salt.ts`                           | 1     | SHA-256 conversation salt derivation   | **Done**    |
| `frontend/src/routes/(app)/(shared)/chat/_lib/e2e-handlers.ts`           | 1     | E2E encrypt/decrypt handlers           | **Done**    |
| `frontend/src/routes/(app)/(shared)/chat/_lib/chat-page-state.svelte.ts` | 1     | Svelte 5 factory — all chat state      | **Done**    |

### Modified Files (11 total)

| File                                                               | Phase | Changes                                                                                                                | Status   |
| ------------------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| `backend/src/nest/app.module.ts`                                   | 0     | Register E2eKeysModule                                                                                                 | **Done** |
| `backend/src/websocket.ts`                                         | 1     | E2E fields + key version validation in handleSendMessage, inline SQL for encrypted insert, broadcast encrypted payload | **Done** |
| `backend/src/nest/chat/chat-messages.service.ts`                   | 1     | E2E-aware insert/read, key version validation, search disabled for E2E, disable editing                                | **Done** |
| `backend/src/nest/chat/chat.controller.ts`                         | 1     | Pass E2E fields through REST path, return E2E fields in responses                                                      | **Done** |
| `backend/src/nest/chat/chat.types.ts`                              | 1     | E2E fields (incl. epoch) on MessageRow/Message, `content: string \| null`                                              | **Done** |
| `backend/src/nest/chat/dto/send-message.dto.ts`                    | 1     | E2E fields (incl. epoch) in Zod schema                                                                                 | **Done** |
| `frontend/svelte.config.js`                                        | 0     | CSP nonce-based hardening                                                                                              | **Done** |
| `frontend/src/routes/(app)/+layout.svelte`                         | 0     | E2E init on auth (key generation for all users, not just chat)                                                         | **Done** |
| `frontend/src/routes/(app)/(shared)/chat/_lib/handlers.ts`         | 1     | E2E dispatch to `e2e-handlers.ts`, group plaintext guard                                                               | **Done** |
| `frontend/src/routes/(app)/(shared)/chat/_lib/types.ts`            | 1     | E2E fields on Message, `content: string \| null`, `decryptedContent?`, `decryptionFailed?`                             | **Done** |
| `frontend/src/routes/(app)/(shared)/chat/_lib/MessagesArea.svelte` | 1     | Lock icon, decrypted content display, decryption-failed error state                                                    | **Done** |

### Rewritten Files (1 total)

| File                                                   | Phase | Changes                                                                              | Status   |
| ------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------ | -------- |
| `frontend/src/routes/(app)/(shared)/chat/+page.svelte` | 1     | Thin template shell (160 lines) — all state extracted to `chat-page-state.svelte.ts` | **Done** |

### Modified Constants (1 total)

| File                                                        | Phase | Changes                                                 | Status   |
| ----------------------------------------------------------- | ----- | ------------------------------------------------------- | -------- |
| `frontend/src/routes/(app)/(shared)/chat/_lib/constants.ts` | 1     | Added `errorE2eNoRecipientKey`, `errorE2eEncryptFailed` | **Done** |

### Test Files (4 total)

| File                                                   | Phase | Purpose                                        | Status   |
| ------------------------------------------------------ | ----- | ---------------------------------------------- | -------- |
| `frontend/src/lib/crypto/__tests__/e2e-crypto.test.ts` | 0     | Crypto unit tests (22 tests)                   | **Done** |
| `backend/src/nest/e2e-keys/e2e-keys.service.test.ts`   | 0     | Service unit tests                             | **Done** |
| `backend/test/e2e-keys.api.test.ts`                    | 0     | API integration tests (key mgmt)               | **Done** |
| `backend/test/chat-e2e-messages.api.test.ts`           | 1     | API integration tests (E2E messages, 17 tests) | **Done** |

### Modified Test Helper (1 total)

| File                      | Phase | Changes                                     | Status   |
| ------------------------- | ----- | ------------------------------------------- | -------- |
| `backend/test/helpers.ts` | 1     | Added `ensureE2eKey()` helper for E2E tests | **Done** |

### Bugfixes (5 total)

| File                                                                     | Phase | Bug                                                                                                                               | Fix                                                                                                       |
| ------------------------------------------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `frontend/src/lib/crypto/e2e-state.svelte.ts`                            | 0     | Double-unwrap: `response.data.publicKey` crash after 409 fallback                                                                 | `apiClient.get()` already unwraps — use `keyData.publicKey` directly                                      |
| `frontend/src/app.html`                                                  | 0     | CSP blocks inline FOUC-prevention script                                                                                          | Added `nonce="%sveltekit.nonce%"` to `<script>` tag                                                       |
| `frontend/src/lib/crypto/crypto-worker.ts`                               | Post  | IndexedDB NOT user-scoped — all users on same browser shared identical private keys (CRITICAL SECURITY)                           | DB name changed from `assixx-e2e` to `assixx-e2e-user-${userId}`. Worker `init` now takes `userId` param. |
| `frontend/src/lib/crypto/e2e-state.svelte.ts`                            | Post  | If initial POST was interrupted (user logged out in <3s), key existed locally but NOT on server → all recipients saw "no E2E key" | Added `ensureKeyOnServer()`: GET `/e2e/keys/me` → re-upload if null. Runs on every init.                  |
| `frontend/src/routes/(app)/(shared)/chat/_lib/chat-page-state.svelte.ts` | Post  | `showNotification()` was a no-op (only `log.warn()`) — E2E errors invisible to user                                               | Connected to real toast system (`showErrorAlert`, `showSuccessAlert`, `showWarningAlert`, `showAlert`)    |

**Total: 16 new + 11 modified + 1 rewritten + 1 constants + 4 test + 1 test helper + 5 bugfixes = 39 files touched**

---

## 12. Dependencies

### New npm Packages (Frontend Only)

| Package          | Purpose             | Size (gzip) | License |
| ---------------- | ------------------- | ----------- | ------- |
| `@noble/curves`  | X25519 key exchange | ~11KB       | MIT     |
| `@noble/ciphers` | XChaCha20-Poly1305  | ~3KB        | MIT     |
| `@noble/hashes`  | SHA-256, HKDF       | ~5KB        | MIT     |

```bash
cd frontend && pnpm add @noble/curves @noble/ciphers @noble/hashes
```

**No backend dependencies.** All crypto is client-side. No Argon2id (no device linking in MVP).

---

## 13. Customer-Facing Transparency

### In the App (Settings → "About Encryption")

> Your messages are encrypted on your device before reaching our server. Only you and your conversation partner can read them.
>
> **Protected:** Message contents. Neither Assixx nor your administrator can read them.
>
> **Not protected:** Who messages whom and when (metadata).
>
> **Important:** Your encryption key is bound to this device. If you lose your device, old messages cannot be recovered.

### Do NOT Claim

- "Signal-level encryption"
- "Military-grade"
- "Unbreakable"

### DO Claim

- "End-to-end encrypted — the server cannot read your messages"
- "Modern, audited cryptography"

---

## 14. GDPR Compliance (Article 15 — Right of Access)

### What the Server CAN Export (metadata)

- Who messaged whom (sender_id, recipient_id)
- When (created_at timestamps)
- Conversation membership
- Public keys + fingerprints
- Message status (read/delivered)

**This metadata export is already possible** via standard DB queries and satisfies the minimum GDPR Article 15 requirement.

### What the Server CANNOT Export (message content)

- Encrypted message content is ciphertext — the server literally cannot read it
- Only the user's client device can decrypt messages

### Client-Side Export (Future — NOT MVP)

A future feature can add a "Export my messages" button in Settings that:

1. Loads all conversations
2. Decrypts all messages client-side via CryptoWorker
3. Exports as JSON/CSV to the user's device

**This is deferred** because it requires:

- Pagination for large histories
- Progress UI for bulk decryption
- File download handling
- Edge cases (messages from users whose keys were reset)

### Key Loss = Message Loss

If a user loses their device (and thus their private key in IndexedDB), their encrypted messages are **permanently unrecoverable**. This is by design. Document this in the "About Encryption" page and in the user onboarding flow.

---

## 15. Future Work (Explicitly Deferred)

| Feature                               | Priority | Why Deferred                                                                        |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| Group chat encryption                 | High     | Needs symmetric key distribution, rotation, grace periods. Ship 1:1 first.          |
| Attachment encryption                 | Medium   | Encrypt files client-side before upload. Needs streaming crypto for large files.    |
| Device linking                        | Medium   | Multi-device key transfer via short code + Argon2id.                                |
| Client-side message export (GDPR)     | Medium   | Bulk decrypt + download. See Section 14.                                            |
| TOFU key pinning                      | Low      | Automatic MITM detection. Disproportionate for factory workers.                     |
| Forced key rotation (server-enforced) | Low      | 90-day server-enforced rotation. Daily HKDF epoch rotation already limits exposure. |
| Fingerprint verification UI           | Low      | Manual safety number comparison. Most users will never use it.                      |
| Client-side search                    | Low      | Search within decrypted messages. Complex, poor UX for large histories.             |

---

**End of Document — v3.6.0. Changes from v3.5→3.6: 3 critical post-testing bugfixes: (1) SECURITY: IndexedDB now user-scoped (`assixx-e2e-user-${userId}`) — prevents key cross-contamination between users on same browser; (2) RELIABILITY: `ensureKeyOnServer()` re-uploads key if server is missing it (handles interrupted uploads); (3) UX: `showNotification()` connected to real toast system (was no-op). Worker `init` protocol now takes `userId`. `CryptoBridge.init(userId)` and `e2e.initialize(userId)` signatures updated. Both Phase 0 and Phase 1 remain DONE.**
