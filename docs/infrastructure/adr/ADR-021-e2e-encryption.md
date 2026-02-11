# ADR-021: End-to-End Encryption for 1:1 Chat Messages

| Metadata                | Value                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                               |
| **Date**                | 2026-02-10                                                                             |
| **Decision Makers**     | SCS-Technik Team                                                                       |
| **Affected Components** | Frontend (CryptoWorker, Chat), Backend (WebSocket, Chat Service, E2E Keys), PostgreSQL |
| **Supersedes**          | —                                                                                      |
| **Related ADRs**        | ADR-001 (Rate Limiting), ADR-005 (Auth), ADR-006 (CLS), ADR-019 (RLS)                  |

---

## Context

Assixx is a Multi-Tenant SaaS platform for industrial companies. The chat system stores all message content as plaintext in PostgreSQL. This means:

1. **A compromised database exposes all message content** — SQL injection, backup theft, or a malicious DBA can read every message
2. **Server-side access is unrestricted** — any admin with DB access can read private conversations
3. **Regulatory pressure** — customers in regulated industries increasingly require confidentiality guarantees beyond "we promise not to read your messages"
4. **Competitive expectation** — WhatsApp, Signal, and Teams have normalized E2E encryption; business customers now expect it

### The Problem

Plaintext storage provides zero protection for message content once the server boundary is breached. RLS (ADR-019) protects cross-tenant access, but within a tenant the server has full access to all message content. For a SaaS platform handling internal company communications, this is an unacceptable trust model.

### Requirements

- Message content encrypted on the sender's device, decryptable only on the recipient's device
- Server stores only ciphertext — cannot read message content even with full DB access
- Zero user interaction — no setup wizards, no passphrases, no key management UI
- Must work with existing WebSocket chat infrastructure (no rewrite)
- 1:1 messages only for MVP (group encryption deferred)
- Must not break existing functionality (system messages, scheduled messages, search)
- Private key must never leave the user's device
- Defense-in-depth against XSS (primary attack vector for key theft)

### Constraints

- Browser-only (no native app, no Electron) — limited to Web Crypto and JS libraries
- IndexedDB is the only persistent client-side storage option for binary data
- Web Workers are the only isolation boundary available in browsers
- No server-side key escrow (by design — this is the point of E2E)
- Single device per user for MVP (no device linking)

---

## Decision

### Cryptographic Primitives

**X25519 ECDH + XChaCha20-Poly1305 + HKDF-SHA256** via the `@noble` library suite.

| Primitive            | Algorithm          | Purpose                         | Why This One                                        |
| -------------------- | ------------------ | ------------------------------- | --------------------------------------------------- |
| **Key Agreement**    | X25519 ECDH        | Derive shared secret            | 32-byte keys, constant-time, no parameter choices   |
| **Key Derivation**   | HKDF-SHA256        | Derive per-epoch encryption key | Standard KDF, allows daily rotation via info string |
| **Symmetric Cipher** | XChaCha20-Poly1305 | Encrypt/decrypt messages        | 24-byte nonce eliminates collision risk             |
| **Fingerprint**      | SHA-256            | Key identity hash               | Standard, deterministic                             |

### Why XChaCha20-Poly1305 (Not AES-GCM)

AES-GCM uses a 12-byte nonce. With random nonce generation, collision probability becomes dangerous at ~2^32 messages per key — a high-volume chat system can hit this. XChaCha20-Poly1305's 24-byte nonce makes collision probability ~2^-96 at 2^48 messages. No nonce management, no counter state, no risk.

### Daily Key Epoch Rotation

```
keyEpoch = Math.floor(Date.now() / 86_400_000)  // rotates every 24h UTC

encryptionKey = HKDF(SHA-256, sharedSecret, conversationSalt, 'assixx-e2e-v1:' + keyEpoch, 32)
```

Same ECDH shared secret, same salt, different HKDF `info` string per day → different encryption key every 24 hours.

**What epoch rotation protects against:** If a derived daily encryption key is extracted (e.g., Worker memory dump), only that day's messages (~24h window) are exposed.

**What epoch rotation does NOT protect against:** If the X25519 private key is compromised (IndexedDB theft via XSS), the attacker can derive ALL epoch keys for all days. For protection against private key compromise, a full Double Ratchet (Signal Protocol) would be needed — explicitly deferred.

**We do NOT claim forward secrecy.** Epoch rotation is a cheap defense-in-depth layer, not a substitute for the Signal Protocol.

### Conversation Salt

```
conversationSalt = SHA-256("assixx:" + tenantId + ":" + conversationId + ":" + sort([userIdA, userIdB]).join(":"))
```

Includes sorted user IDs and tenant ID to ensure uniqueness even if conversation IDs are reused across tenants or after TRUNCATE.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  User opens any authenticated page                                   │
│      │                                                               │
│      ▼                                                               │
│  +layout.svelte onMount → e2e.initialize(userId)                    │
│  ├─ CryptoBridge → Worker: init(userId)                             │
│  │   ├─ User-scoped IndexedDB: `assixx-e2e-user-${userId}`         │
│  │   ├─ navigator.storage.persist() (prevent browser eviction)      │
│  │   ├─ IndexedDB readwrite transaction (multi-tab atomic check)    │
│  │   └─ Key exists? → ready. No key? → generate X25519 pair.       │
│  ├─ ensureKeyOnServer() (verify server has key, re-upload if not)   │
│  │   ├─ GET /api/v2/e2e/keys/me → not null? → use server data      │
│  │   └─ null? → POST /api/v2/e2e/keys { publicKey } (re-upload)    │
│  │        ├─ 201: Server stores public key + fingerprint            │
│  │        └─ 409: Key already exists → GET /e2e/keys/me             │
│  └─ e2eState.isReady = true (Svelte 5 reactive)                    │
│                                                                      │
│  Sending a 1:1 message                                              │
│      │                                                               │
│      ▼                                                               │
│  chat-page-state.svelte.ts → e2e-handlers.ts                       │
│  ├─ prepareMessageForSending()                                      │
│  │   ├─ Group? → plaintext (correct, not a fallback)                │
│  │   ├─ No recipient key? → throw E2eError('no_recipient_key')     │
│  │   ├─ Fetch recipient public key (in-memory cache with TTL)       │
│  │   ├─ CryptoBridge → Worker: encrypt(plaintext, recipientPubKey) │
│  │   │   ├─ ECDH: sharedSecret = x25519(myPrivate, recipientPub)   │
│  │   │   ├─ HKDF: encKey = hkdf(sha256, shared, salt, info+epoch)  │
│  │   │   └─ XChaCha20: ciphertext + nonce                          │
│  │   └─ Return { encryptedContent, e2eNonce, e2eKeyEpoch }         │
│  │                                                                   │
│  ▼  WebSocket → Backend                                             │
│  ├─ Validate sender's e2eKeyVersion against stored active key       │
│  ├─ INSERT: encrypted_content, e2e_nonce, content=NULL, is_e2e=true │
│  └─ Broadcast encrypted payload to recipient (no decryption)        │
│                                                                      │
│  Recipient receives WebSocket message                               │
│      │                                                               │
│      ▼                                                               │
│  decryptIncomingMessage()                                           │
│  ├─ Fetch sender's public key (cached)                              │
│  ├─ CryptoBridge → Worker: decrypt(ciphertext, nonce, senderPubKey)│
│  │   ├─ ECDH: same sharedSecret (ECDH is symmetric)                │
│  │   ├─ HKDF: same encKey (using STORED epoch from message)        │
│  │   └─ XChaCha20: plaintext                                       │
│  └─ message.decryptedContent = plaintext                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Web Worker Isolation

The CryptoWorker runs in a dedicated Web Worker. The private key:

1. Generated inside the Worker
2. Stored in **user-scoped IndexedDB** (`assixx-e2e-user-${userId}`) from inside the Worker
3. Used for ECDH inside the Worker
4. **Never sent to the main thread via postMessage**

**User isolation:** Each user gets a separate IndexedDB database (`assixx-e2e-user-3`, `assixx-e2e-user-4`, etc.). This prevents key cross-contamination when multiple users log in on the same browser — each user's private key is in their own database, never shared.

**Honest limitation:** IndexedDB is accessible from both Worker and main thread. A targeted XSS attack CAN read IndexedDB directly. The Worker prevents _casual_ key leakage from main thread memory, not targeted attacks. CSP nonce-based script-src (see below) is the primary XSS defense.

### Worker Performance Caching

| Cache               | Key                           | Value                    | Lifetime       |
| ------------------- | ----------------------------- | ------------------------ | -------------- |
| `sharedSecretCache` | recipient public key (base64) | 32-byte shared secret    | Until `lock()` |
| `epochKeyCache`     | `${pubKey}:${epoch}`          | 32-byte derived enc. key | Until `lock()` |

**Impact:** 500 messages from same sender, same day = ~1ms (first) + 499×0.01ms ≈ 6ms total. Without caching: ~250ms.

### CSP Hardening

```javascript
csp: {
  mode: 'nonce',  // SvelteKit generates per-request nonce for inline scripts
  directives: {
    'script-src': ['self'],  // nonce added automatically
    'worker-src': ['self', 'blob:'],
    // ...
  },
}
```

`mode: 'nonce'` replaces `unsafe-inline` — only scripts with the per-request cryptographic nonce execute. Primary defense against XSS-based key theft.

### Key Version Validation

The server validates the sender's claimed `e2eKeyVersion` against the stored active key before accepting any E2E message. This prevents:

- Stale clients encrypting with an old key that the recipient can't decrypt
- Replay attacks with outdated key versions
- Desync between client and server key state

Both REST (`chat-messages.service.ts`) and WebSocket (`websocket.ts`) paths perform this validation.

### No Silent Plaintext Fallback

For 1:1 conversations where E2E is ready, `prepareMessageForSending` **throws** a typed `E2eError` on failure — it never silently falls back to sending plaintext. The caller catches the error, shows a **toast notification** (via `showErrorAlert`) with a German error message, and restores the message input for retry.

Groups and non-E2E sessions send plaintext by design (correct behavior, not a fallback).

---

## Alternatives Considered

### 1. Signal Protocol (Double Ratchet)

| Pros                                  | Cons                                             |
| ------------------------------------- | ------------------------------------------------ |
| True forward secrecy                  | Requires pre-key server infrastructure           |
| Per-message key rotation              | Session management across reconnects             |
| Industry gold standard                | ~10x implementation complexity                   |
| Proven against private key compromise | Out-of-order message handling needed             |
|                                       | Group encryption even more complex (Sender Keys) |

**Rejected:** Disproportionate complexity for MVP. Our users are factory workers accessing from shared terminals — the threat model is DB compromise and curious admins, not nation-state actors. X25519 + HKDF epoch rotation provides meaningful protection at 10% of the implementation cost. Double Ratchet can be layered on later if needed.

### 2. WebCrypto API (Browser Native)

| Pros                        | Cons                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| No dependencies             | X25519 support inconsistent (Chrome 113+, Firefox 120+, no Safari until 17.4) |
| Browser-optimized           | API is verbose and error-prone (ArrayBuffer gymnastics)                       |
| Hardware acceleration (AES) | No XChaCha20 — only AES-GCM (12-byte nonce risk)                              |
|                             | Non-extractable keys prevent IndexedDB persistence portably                   |

**Rejected:** Browser support gaps (Safari) and no XChaCha20 support. AES-GCM's 12-byte nonce creates real collision risk at high message volumes. The `@noble` suite is audited, MIT-licensed, 14KB gzip, and works everywhere.

### 3. libsodium.js (libsodium WASM)

| Pros                           | Cons                      |
| ------------------------------ | ------------------------- |
| Battle-tested C implementation | 200KB+ WASM binary        |
| Full API (box, secretbox)      | Complex build integration |
| Constant-time guarantees       | WASM loading latency      |

**Rejected:** `@noble` provides the same primitives (X25519, XChaCha20-Poly1305, HKDF) at 14KB vs 200KB+. The `@noble` suite has been independently audited and is used by major projects (Ethereum ecosystem). Size matters for a SaaS app.

### 4. Server-Side Key Escrow (Key Recovery)

| Pros                        | Cons                                                 |
| --------------------------- | ---------------------------------------------------- |
| Key recovery on device loss | Server can decrypt messages (defeats purpose of E2E) |
| Corporate compliance        | Trust model identical to no encryption               |
| Admin can assist users      | Legal liability for holding decryption keys          |

**Rejected:** If the server holds private keys, E2E encryption is theater. The entire point is that the server CANNOT read messages. Key loss = message loss is an honest trade-off we accept and document.

### 5. localStorage for Private Key

| Pros             | Cons                                          |
| ---------------- | --------------------------------------------- |
| Simple API       | Synchronous (blocks main thread)              |
| String-based     | 5MB limit (fine for keys, but fragile)        |
| Works everywhere | Accessible from any script (XSS trivial read) |
|                  | No binary data (base64 overhead)              |
|                  | No transactional writes (multi-tab race)      |

**Rejected:** IndexedDB provides transactional `readwrite` for multi-tab coordination, binary storage without encoding overhead, and is accessible from Web Workers. The only storage option that satisfies our requirements.

### 6. Encrypt All Messages (Including Groups)

| Pros                 | Cons                                                          |
| -------------------- | ------------------------------------------------------------- |
| Consistent UX        | Group encryption requires symmetric key distribution          |
| No "some encrypted"  | Key rotation in groups is complex (grace periods, re-key)     |
| Simpler mental model | N participants = N key exchanges per message (or Sender Keys) |
|                      | Significantly more complex, delays shipping 1:1               |

**Rejected:** Group encryption is fundamentally different from 1:1 (symmetric key distribution vs. ECDH). Bundling them would delay shipping by weeks. 1:1 first, groups in Phase 2.

---

## Implementation Details

### Database Changes

**Table:** `e2e_user_keys` (Phase 0 — migration `20260210000022`)

```sql
CREATE TABLE e2e_user_keys (
    id UUID PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active INTEGER NOT NULL DEFAULT 1
);

-- Exactly ONE active key per user per tenant
CREATE UNIQUE INDEX idx_e2e_user_keys_one_active
    ON e2e_user_keys(tenant_id, user_id) WHERE is_active = 1;
```

RLS enabled with standard `tenant_isolation` policy (ADR-019).

**Columns on `chat_messages`** (Phase 1 — migration `20260210000023`)

```sql
ALTER TABLE chat_messages ADD COLUMN encrypted_content TEXT;
ALTER TABLE chat_messages ADD COLUMN e2e_nonce TEXT;
ALTER TABLE chat_messages ADD COLUMN is_e2e BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE chat_messages ADD COLUMN e2e_key_version INTEGER;
ALTER TABLE chat_messages ADD COLUMN e2e_key_epoch INTEGER;
ALTER TABLE chat_messages ALTER COLUMN content DROP NOT NULL;
```

`DEFAULT false` is critical: during deployment, any message created without explicit E2E fields defaults to plaintext (safe). `DEFAULT true` would cause plaintext messages to claim encryption.

### Backend Module

```
backend/src/nest/e2e-keys/
├── e2e-keys.module.ts
├── e2e-keys.controller.ts
├── e2e-keys.service.ts
├── e2e-keys.types.ts
├── e2e-keys.service.test.ts
└── dto/
    ├── register-keys.dto.ts
    └── index.ts
```

| Method | Path                       | Auth  | Rate Limit (ADR-001) | Purpose                     |
| ------ | -------------------------- | ----- | -------------------- | --------------------------- |
| POST   | `/api/v2/e2e/keys`         | User  | 5/hour/user          | Register public key         |
| GET    | `/api/v2/e2e/keys/me`      | User  | —                    | Get own key data            |
| GET    | `/api/v2/e2e/keys/:userId` | User  | 60/min/user          | Get other user's public key |
| DELETE | `/api/v2/e2e/keys`         | Admin | 3/hour/admin         | Reset user's key            |

### Frontend Architecture

```
frontend/src/lib/crypto/
├── crypto-worker.ts          # Web Worker — key gen, ECDH, encrypt, decrypt
├── crypto-bridge.ts          # Promise-based main↔Worker IPC
├── e2e-state.svelte.ts       # Svelte 5 reactive state ($state, $derived)
├── public-key-cache.ts       # In-memory TTL cache for other users' keys
└── conversation-salt.ts      # SHA-256 conversation salt derivation

frontend/src/routes/(app)/(shared)/chat/_lib/
├── e2e-handlers.ts           # prepareMessageForSending, decryptIncoming, decryptLoaded
├── chat-page-state.svelte.ts # Svelte 5 factory — all chat state + handlers
└── constants.ts              # German E2E error messages
```

### Multi-Tab Coordination

IndexedDB `readwrite` transactions serialize across tabs within the same origin. Each user has their own database (`assixx-e2e-user-${userId}`):

```typescript
const db = await openDB(`assixx-e2e-user-${userId}`, ...);
const tx = db.transaction('private-keys', 'readwrite');
const existing = await store.get(1);
if (existing) return existing; // Another tab generated first
// Generate + store atomically within this transaction
```

Server-side defense: POST `/e2e/keys` returns `409 Conflict` if key already exists. Frontend handles 409 by fetching existing key via GET.

**Server key resilience:** `ensureKeyOnServer()` runs after IndexedDB check. If IndexedDB has a key but the server doesn't (e.g., user logged out within 3 seconds of first login, before POST completed), the key is re-uploaded automatically.

### What Remains Plaintext

| Content          | Why                                                              |
| ---------------- | ---------------------------------------------------------------- |
| Group messages   | Group encryption deferred (requires symmetric key distribution)  |
| System messages  | Server-generated (`is_system = true`), no E2E fields             |
| Message metadata | Who, when, conversation membership — inherent to any chat system |
| Attachments      | File encryption deferred (requires streaming crypto)             |

---

## Consequences

### Positive

1. **Server cannot read message content** — DB compromise, SQL injection, backup theft, malicious DBA all yield only ciphertext
2. **Zero user interaction** — keys generate automatically on first login, no setup required
3. **Defense in depth** — Web Worker isolation + CSP nonce + IndexedDB origin scope + daily epoch rotation
4. **Minimal bundle impact** — `@noble` suite is 14KB gzip total (vs. 200KB+ for libsodium)
5. **No backend crypto dependencies** — all encryption is client-side; backend stores and relays opaque ciphertext
6. **Key version validation** — server prevents stale-client decryption failures before they happen
7. **No silent degradation** — encryption failure throws, shows toast notification, never silently falls back to plaintext
8. **Compatible with existing infrastructure** — works with current WebSocket server, REST API, and RLS policies

### Negative

1. **Key loss = message loss** — if a user loses their device (or clears browser data), all their encrypted messages are permanently unreadable. No recovery mechanism exists. This is by design, but must be communicated to users.
2. **No forward secrecy** — a compromised X25519 private key allows decryption of ALL past and future messages (unlike Signal Protocol's Double Ratchet). Daily epoch rotation only limits exposure of derived keys.
3. **Server-side search disabled** — E2E messages cannot be searched server-side (content is ciphertext). Client-side search is deferred.
4. **Message editing disabled** — encrypted messages cannot be edited (would require re-encryption with potentially different epoch). Delete and resend instead.
5. **Single device only** — no device linking for MVP. User can only decrypt from the device where the key was generated.
6. **No TOFU/key pinning** — the server could theoretically substitute a user's public key (MITM). Key verification UI is deferred.
7. **XSS still critical** — a sophisticated XSS attack can read IndexedDB directly, bypassing Worker isolation. CSP is the primary defense, not the Worker.
8. **Scheduled messages incompatible** — cannot schedule encrypted messages (server would need to hold plaintext until send time, defeating E2E).

### Risks & Mitigations

| Risk                                      | Mitigation                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| XSS steals private key from IndexedDB     | CSP `script-src 'nonce-...'` (primary), Worker isolation (secondary), SvelteKit auto-escaping |
| User clears browser data → key lost       | `navigator.storage.persist()` requested on init (prevents browser eviction)                   |
| Multi-tab key generation race             | IndexedDB `readwrite` transaction serialization + server 409 Conflict handling                |
| Stale client encrypts with old key        | Server validates `e2eKeyVersion` before accepting message (both REST + WS paths)              |
| Rollback needed after deployment          | Revert frontend to plaintext; encrypted-period messages permanently lost (documented cost)    |
| User expects message recovery             | "About Encryption" page in Settings clearly states key loss = message loss                    |
| Interrupted key upload (e.g. fast logout) | `ensureKeyOnServer()` verifies + re-uploads key on every init (idempotent)                    |

---

## Security Threat Model

### Protected Against

| Threat                | Protection                                          |
| --------------------- | --------------------------------------------------- |
| Database compromise   | Only ciphertext stored — no plaintext to steal      |
| Malicious DBA         | Cannot derive encryption keys from server-side data |
| SQL injection         | Attacker gets ciphertext, not plaintext             |
| Backup theft          | Backups contain only ciphertext                     |
| Curious admin         | Server never sees plaintext content                 |
| Network eavesdropping | TLS + E2E = double encryption layer                 |

### NOT Protected Against

| Threat                         | Why                                                         | Future Mitigation                                        |
| ------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------- |
| Compromised client device      | Attacker has full access to IndexedDB                       | Hardware key support (future)                            |
| Sophisticated XSS              | Can read IndexedDB directly                                 | Stronger CSP, subresource integrity                      |
| Server MITM (key substitution) | No TOFU — server could swap public keys                     | TOFU key pinning (future)                                |
| Private key compromise         | All past + future messages decryptable (no forward secrecy) | Double Ratchet (future)                                  |
| Message metadata               | Who, when, frequency visible to server                      | Metadata padding (unlikely)                              |
| Shared terminal / kiosk        | IndexedDB at rest, unencrypted by browser                   | User-scoped IndexedDB + `lock()` on logout (best-effort) |

---

## Verification

### How to verify E2E is working

```bash
# 1. Check e2e_user_keys table has entries
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
  SELECT user_id, key_version, is_active, created_at
  FROM e2e_user_keys WHERE is_active = 1;
"

# 2. Check chat_messages table has encrypted content
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
  SELECT id, is_e2e, content IS NULL AS content_null,
         encrypted_content IS NOT NULL AS has_encrypted,
         e2e_key_epoch
  FROM chat_messages WHERE is_e2e = true LIMIT 5;
"

# 3. Verify server CANNOT read content (only ciphertext visible)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
  SELECT id, LEFT(encrypted_content, 40) AS ciphertext_preview,
         content  -- should be NULL for E2E messages
  FROM chat_messages WHERE is_e2e = true LIMIT 3;
"

# 4. Verify RLS on e2e_user_keys
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
  SELECT tablename, policyname FROM pg_policies
  WHERE tablename = 'e2e_user_keys';
"
```

### Crypto Unit Tests (23 tests)

```bash
cd frontend && pnpm vitest run src/lib/crypto/__tests__/e2e-crypto.test.ts
```

Covers: key generation, ECDH symmetry, encrypt/decrypt roundtrip, wrong key rejection, fingerprint determinism, salt uniqueness, epoch rotation, epoch boundary (23:59:59→00:00:01), empty/unicode messages.

### API Integration Tests

```bash
cd backend && pnpm vitest run test/e2e-keys.api.test.ts
```

Covers: key registration, 409 duplicate, own key retrieval, other user's key, tenant isolation, admin reset, 401 without auth.

---

## References

- [Implementation Plan](../../plans/IMPLEMENT-E2E-ENCRYPTION.md) — Full technical spec (v3.6.0)
- [@noble/curves](https://github.com/paulmillr/noble-curves) — X25519 implementation (audited)
- [@noble/ciphers](https://github.com/paulmillr/noble-ciphers) — XChaCha20-Poly1305 implementation (audited)
- [@noble/hashes](https://github.com/paulmillr/noble-hashes) — SHA-256, HKDF implementation (audited)
- [ADR-001: Rate Limiting](./ADR-001-rate-limiting.md) — Rate limits on E2E key endpoints
- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) — JWT guard, CLS context for userId/tenantId
- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md) — ClsService for request-scoped tenant context
- [ADR-019: Multi-Tenant RLS Isolation](./ADR-019-multi-tenant-rls-isolation.md) — RLS policies on `e2e_user_keys` table
- [XChaCha20 nonce size analysis](https://doc.libsodium.org/secret-key_cryptography/aead/chacha20-poly1305/xchacha20-poly1305_construction) — Why 24-byte nonce eliminates collision risk
- [SvelteKit CSP](https://svelte.dev/docs/kit/configuration#csp) — Nonce-based CSP configuration
