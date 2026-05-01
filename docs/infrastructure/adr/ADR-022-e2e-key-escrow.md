# ADR-022: E2E Key Escrow — Zero-Knowledge Private Key Recovery

| Metadata                | Value                                                                            |
| ----------------------- | -------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                         |
| **Date**                | 2026-02-11                                                                       |
| **Decision Makers**     | SCS-Technik Team                                                                 |
| **Affected Components** | Frontend (CryptoWorker, Login, Profile), Backend (E2E Escrow Module), PostgreSQL |
| **Amends**              | ADR-021 (E2E Encryption) — removes "no key escrow" constraint                    |
| **Related ADRs**        | ADR-021 (E2E Encryption), ADR-005 (Auth), ADR-006 (CLS), ADR-019 (RLS)           |

---

## Context

### The Problem ADR-021 Created

ADR-021 introduced E2E encryption for 1:1 chat with X25519 key pairs stored exclusively in browser IndexedDB. This creates a **single point of failure**:

1. **User clears browser data** → private key gone → all encrypted messages permanently unreadable
2. **User switches device/browser** → no key transfer possible → forced key rotation → all old messages lost for BOTH participants
3. **IndexedDB evicted by browser** (storage pressure) → same result as clearing data
4. **Docker restart during development** → if it triggers a browser state change → silent key rotation

This is NOT theoretical — it happened on 2026-02-11:

```
User 4 key v1 (14:42) → Docker restart → key rotation to v2 (20:17) →
old messages: "Decryption failed: invalid tag" (XChaCha20 auth mismatch)
```

The ECDH shared secret changed because the private key changed. XChaCha20-Poly1305's authentication tag check correctly rejected the decryption. Messages were permanently lost.

### Why ADR-021's Rejection Was Wrong

ADR-021 rejected key escrow with: _"If the server holds private keys, E2E encryption is theater."_

This conflated two fundamentally different designs:

| Design                    | Server stores                              | Server can decrypt? | E2E intact?                        |
| ------------------------- | ------------------------------------------ | ------------------- | ---------------------------------- |
| **Bad escrow**            | Plaintext private key                      | Yes                 | No — theater                       |
| **Zero-knowledge escrow** | Private key encrypted with user's password | No                  | Yes — server sees only opaque blob |

Zero-knowledge escrow maintains the E2E guarantee: the server **cannot** decrypt messages even with full database access. The encryption key is derived from the user's password, which the server stores only as a bcrypt hash — not usable for key derivation.

### Requirements

- Private key must survive device loss, browser data clearing, and browser switching
- Server must NOT be able to decrypt the escrow blob (zero-knowledge)
- Zero additional UX friction — no separate passphrases, no setup wizards
- Must work with existing login flow (SvelteKit form action + JWT)
- Password change must re-encrypt the escrow blob atomically
- Must be resistant to offline brute-force from a database dump

---

## Decision

### Cryptographic Design

**Argon2id (KDF) + XChaCha20-Poly1305 (wrapping cipher)**

```
password ──► Argon2id(password, salt, params) ──► wrappingKey (32 bytes)
                                                        │
privateKey ──► XChaCha20-Poly1305(wrappingKey, nonce) ──► encryptedBlob
                                                              │
                                                              ▼
                                                     Server stores:
                                                     { encryptedBlob, salt, nonce, params }
```

| Primitive           | Algorithm          | Purpose                           | Why This One                                                         |
| ------------------- | ------------------ | --------------------------------- | -------------------------------------------------------------------- |
| **KDF**             | Argon2id           | Derive wrapping key from password | Memory-hard — resists GPU/ASIC brute-force. OWASP recommended.       |
| **Wrapping Cipher** | XChaCha20-Poly1305 | Encrypt/decrypt private key       | Already in project (`@noble/ciphers`). 24-byte nonce. Authenticated. |
| **Library**         | `hash-wasm`        | Argon2id in browser               | MIT, ~50KB WASM, well-maintained, works in Web Workers               |

### Why Argon2id (Not PBKDF2)

| Factor               | Argon2id                          | PBKDF2-SHA256                       |
| -------------------- | --------------------------------- | ----------------------------------- |
| GPU resistance       | **High** — memory-hard (64 MiB)   | Low — trivially parallelizable      |
| Offline brute-force  | ~0.5s per attempt per core        | Millions of attempts with GPU       |
| OWASP recommendation | **Primary recommendation (2024)** | Legacy — only if Argon2 unavailable |
| Dependencies         | `hash-wasm` (~50KB WASM)          | Zero (native WebCrypto)             |
| Browser support      | Any browser with WASM (99%+)      | Universal                           |

For key escrow, offline brute-force from a DB dump is the primary threat. Argon2id's memory-hardness makes this attack orders of magnitude more expensive than PBKDF2.

### Argon2id Parameters

```typescript
const ARGON2_PARAMS = {
  type: 'argon2id', // Hybrid: side-channel resistant + GPU resistant
  memory: 65536, // 64 MiB — good balance for browser
  iterations: 3, // t=3 — OWASP minimum for Argon2id
  parallelism: 1, // p=1 — Web Workers are single-threaded
  hashLength: 32, // 256 bits — matches XChaCha20 key size
};
```

**Derivation time:** ~0.5–1.0 seconds on modern hardware. Acceptable during login (one-time per session).

**Parameters stored per-blob:** allows upgrading parameters without breaking existing escrow blobs. Old blobs use their stored params; new blobs use current defaults.

### Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│  LOGIN FLOW (password available)                                       │
│                                                                        │
│  +page.svelte: password $state                                        │
│      │                                                                 │
│      ▼  (on successful login, BEFORE goto())                          │
│  loginPasswordBridge.setLoginPassword(password)                       │
│      │                                                                 │
│      ▼  goto('/dashboard') → +layout.svelte onMount                   │
│  e2e.initialize(userId)                                               │
│      │                                                                 │
│      ├─ IndexedDB has key? → resolveExistingKey()                     │
│      │   └─ (same as ADR-021, no change)                              │
│      │   └─ Escrow blob exists? → update if params outdated           │
│      │                                                                 │
│      └─ IndexedDB EMPTY? → tryRecoverFromEscrow()  ◄── NEW!          │
│          │                                                             │
│          ├─ GET /e2e/escrow → blob found?                             │
│          │   │                                                         │
│          │   ├─ YES: password = loginPasswordBridge.consume()         │
│          │   │   ├─ Worker: wrappingKey = Argon2id(password, salt)    │
│          │   │   ├─ Worker: privateKey = decrypt(wrappingKey, blob)   │
│          │   │   ├─ Store in IndexedDB → verify server key matches    │
│          │   │   └─ RECOVERED! No rotation, old messages intact ✅    │
│          │   │                                                         │
│          │   └─ NO or FAILED: generateAndRegisterKey()                │
│          │       └─ Create escrow blob for the new key                │
│          │                                                             │
│          └─ Always: loginPasswordBridge.clear()                       │
│                                                                        │
│  RESULT: Private key + escrow always in sync                          │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│  PASSWORD CHANGE FLOW                                                  │
│                                                                        │
│  Profile page: user enters oldPassword + newPassword                  │
│      │                                                                 │
│      ├─ Backend: PUT /users/me/password (validates + updates bcrypt)  │
│      │                                                                 │
│      ├─ Frontend (after backend success):                             │
│      │   ├─ GET /e2e/escrow → { encryptedBlob, salt, nonce, params } │
│      │   ├─ Worker: oldWrappingKey = Argon2id(oldPassword, oldSalt)  │
│      │   ├─ Worker: privateKey = decrypt(oldWrappingKey, oldBlob)    │
│      │   ├─ Worker: newSalt = randomBytes(32)                        │
│      │   ├─ Worker: newWrappingKey = Argon2id(newPassword, newSalt)  │
│      │   ├─ Worker: newBlob = encrypt(newWrappingKey, privateKey)    │
│      │   └─ PUT /e2e/escrow { newBlob, newSalt, newNonce, params }   │
│      │                                                                 │
│      └─ DONE: Escrow re-encrypted with new password                  │
└───────────────────────────────────────────────────────────────────────┘
```

### Login Password Bridge

The password is only available during the login flow (`+page.svelte` has `password` as `$state`). After `goto()` navigates to the app, the login component is destroyed. But SvelteKit is an SPA — module-scoped state survives client-side navigation.

```typescript
// $lib/crypto/login-password-bridge.ts
let pendingPassword: string | null = null;

export function setLoginPassword(password: string): void {
  pendingPassword = password;
}

export function consumeLoginPassword(): string | null {
  const pw = pendingPassword;
  pendingPassword = null; // consume once — never reusable
  return pw;
}

export function clearLoginPassword(): void {
  pendingPassword = null;
}
```

**Security properties:**

- Password lives in JS heap memory only — never in storage (no IndexedDB, no localStorage, no sessionStorage)
- Consumed exactly once during E2E init — cleared immediately after
- If E2E init doesn't happen (e.g., page closed), garbage collected with module scope
- Not accessible to other origins (same-origin policy)
- XSS can read it from memory — same risk as the login form input itself

### Database Schema

```sql
CREATE TABLE e2e_key_escrow (
    id              UUID PRIMARY KEY,              -- UUIDv7
    tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_blob  TEXT NOT NULL,                  -- base64, XChaCha20-encrypted private key
    argon2_salt     TEXT NOT NULL,                  -- base64, 32 bytes random
    xchacha_nonce   TEXT NOT NULL,                  -- base64, 24 bytes random
    argon2_params   JSONB NOT NULL DEFAULT '{"memory":65536,"iterations":3,"parallelism":1}',
    blob_version    INTEGER NOT NULL DEFAULT 1,     -- increments on re-encryption
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active       INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT uq_e2e_escrow_active UNIQUE (tenant_id, user_id)
);

-- RLS (MANDATORY — ADR-019)
ALTER TABLE e2e_key_escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE e2e_key_escrow FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON e2e_key_escrow
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );

-- Permissions for app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON e2e_key_escrow TO app_user;

-- Index
CREATE INDEX idx_e2e_key_escrow_user ON e2e_key_escrow(tenant_id, user_id);
```

**One row per user** — re-encryption (password change) updates in place. No version history needed since the blob is only useful with the current password.

### API Endpoints

| Method | Path          | Auth | Rate Limit                | Purpose                           |
| ------ | ------------- | ---- | ------------------------- | --------------------------------- |
| `POST` | `/e2e/escrow` | User | `@AuthThrottle` (10/5min) | Store initial escrow blob         |
| `GET`  | `/e2e/escrow` | User | `@UserThrottle`           | Retrieve escrow blob for recovery |
| `PUT`  | `/e2e/escrow` | User | `@AuthThrottle` (10/5min) | Re-encrypt blob (password change) |

**GET response:** `{ encryptedBlob, argon2Salt, xchachaNonce, argon2Params, blobVersion }` — never includes the wrapping key or plaintext private key.

### CryptoWorker Changes

Two new message types:

```typescript
// New request types
| { type: 'wrapPrivateKey'; password: string; }
| { type: 'unwrapPrivateKey'; password: string; encryptedBlob: string;
    argon2Salt: string; xchachaNonce: string; argon2Params: Argon2Params; }

// New response types
| { type: 'privateKeyWrapped'; encryptedBlob: string; argon2Salt: string;
    xchachaNonce: string; argon2Params: Argon2Params; }
| { type: 'privateKeyUnwrapped'; publicKey: string; fingerprint: string; }
| { type: 'unwrapFailed'; reason: string; }
```

**`wrapPrivateKey`:** Uses the in-memory private key (already loaded), derives wrapping key with Argon2id, encrypts, returns blob + salt + nonce. Password cleared from Worker memory immediately after derivation.

**`unwrapPrivateKey`:** Derives wrapping key from password + stored salt, decrypts blob, loads private key into Worker memory + IndexedDB. Password cleared immediately after derivation.

### What Changes in Existing Files

| File                                                      | Change                                                                                                                                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crypto-worker.ts`                                        | Add `handleWrapPrivateKey`, `handleUnwrapPrivateKey` handlers. Import `hash-wasm` for Argon2id.                                                                                                                        |
| `crypto-bridge.ts`                                        | Add `wrapKey(password)`, `unwrapKey(password, blob, salt, nonce, params)` methods                                                                                                                                      |
| `e2e-state.svelte.ts`                                     | Add `tryRecoverFromEscrow()` in the `!hasKey` branch BEFORE `generateAndRegisterKey()`. Add `createEscrowBlob()` after successful key generation. Add `reEncryptEscrow(oldPassword, newPassword)` for password change. |
| `login/+page.svelte`                                      | After successful login, call `setLoginPassword(password)` before `goto()`                                                                                                                                              |
| `*-profile/_lib/api.ts`                                   | After successful password change, call `reEncryptEscrow(oldPassword, newPassword)`                                                                                                                                     |
| **New:** `login-password-bridge.ts`                       | Module-scoped password bridge (see above)                                                                                                                                                                              |
| **New:** `backend/src/nest/e2e-escrow/`                   | New NestJS module with controller, service, DTO, types                                                                                                                                                                 |
| **New:** `database/migrations/XXXXXXXX_e2e-key-escrow.ts` | Migration for `e2e_key_escrow` table                                                                                                                                                                                   |

### New Dependency

```json
// frontend/package.json
"hash-wasm": "^4.11.0"  // MIT, ~50KB WASM, Argon2id in browser/Worker
```

No backend dependencies needed — backend only stores/retrieves opaque blobs.

---

## Alternatives Considered

### 1. PBKDF2-SHA256 via WebCrypto API (Zero Dependencies)

| Pros                  | Cons                                                       |
| --------------------- | ---------------------------------------------------------- |
| Zero new dependencies | GPU-trivially-parallelizable — millions of attempts/sec    |
| Native browser API    | OWASP recommends Argon2id over PBKDF2 since 2023           |
| Works everywhere      | 600k iterations ≈ 0.5s on CPU, but GPU can do 1000x faster |

**Rejected:** For escrow blobs that may be extracted from a DB dump and attacked offline with GPU clusters, PBKDF2's lack of memory-hardness is a real weakness. The 50KB WASM cost of `hash-wasm` is trivial compared to the security gain.

### 2. Separate Recovery Passphrase (Not Password)

| Pros                                | Cons                                         |
| ----------------------------------- | -------------------------------------------- |
| Stronger key if passphrase is long  | UX friction — user must remember TWO secrets |
| Decoupled from password changes     | Users WILL forget the passphrase             |
| No re-encryption on password change | Support tickets from locked-out users        |

**Rejected:** The whole point of zero-friction E2E. Factory workers accessing from shared terminals won't manage a separate passphrase. The password is good enough with Argon2id's protection.

### 3. Device Linking (Signal-Style Key Transfer)

| Pros                    | Cons                                       |
| ----------------------- | ------------------------------------------ |
| No server-stored blob   | Both devices must be online simultaneously |
| Cryptographically clean | Doesn't solve "old device lost/broken"     |
| Zero server knowledge   | High implementation complexity             |
|                         | UX friction (QR code, manual code entry)   |

**Rejected:** Doesn't solve the most common failure case (old device unavailable). Useful as a future complement to escrow, not a replacement.

### 4. No Escrow — Accept Key Loss (Status Quo / ADR-021)

| Pros                    | Cons                                                           |
| ----------------------- | -------------------------------------------------------------- |
| Simpler implementation  | Users lose ALL encrypted messages on device change             |
| Maximum security purism | Destroys trust — "your chat history randomly disappears"       |
|                         | Unacceptable for business SaaS — users expect data persistence |
|                         | Already caused data loss on 2026-02-11                         |

**Rejected:** Real-world experience proved this trade-off is unacceptable for a SaaS product. The security purist argument ("key loss = message loss is honest") falls apart when it happens to actual users who lose business communications.

---

## Consequences

### Positive

1. **Private key survives device changes** — user logs in on new device, key recovered from escrow, old messages decryptable
2. **Zero UX friction** — password already entered during login, no additional prompts
3. **Zero-knowledge** — server stores only an encrypted blob it cannot decrypt
4. **Argon2id protection** — offline brute-force from DB dump requires ~0.5s × 64 MiB per attempt per core
5. **Atomic with password change** — escrow blob re-encrypted whenever password changes
6. **Backward compatible** — existing users without escrow fall back to ADR-021 behavior (new key generation)
7. **Incremental rollout** — escrow is created on next login for existing users, no migration of existing keys needed

### Negative

1. **Password = single point of failure** — weak password + DB dump = brute-forceable escrow (mitigated by Argon2id memory-hardness)
2. **New dependency** — `hash-wasm` adds ~50KB WASM to the frontend bundle
3. **Login latency** — Argon2id adds ~0.5–1.0s to first login on a new device (acceptable, one-time)
4. **Password change complexity** — must re-encrypt escrow blob after every password change
5. **Forgotten password = key loss** — if user can't provide current password, escrow blob is useless (password reset flow must be considered)

### Risks & Mitigations

| Risk                                    | Mitigation                                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| DB dump + weak password = brute-force   | Argon2id 64 MiB memory cost. Enforce minimum password complexity.                                                                  |
| Password change fails mid-re-encryption | Atomic: backend validates new password FIRST, then frontend re-encrypts, then PUT escrow. Old blob stays valid until PUT succeeds. |
| Argon2id WASM fails to load             | Fallback: skip escrow creation (not recovery). User gets ADR-021 behavior. Log warning.                                            |
| XSS reads password during login         | Same attack surface as existing login form — no regression. CSP is primary defense.                                                |
| User forgets password AND loses device  | Escrow blob useless. Admin can reset key (`DELETE /e2e/keys/:userId`). Old messages permanently lost. Document this trade-off.     |
| Password reset (forgot password flow)   | Future: "forgot password" must delete escrow blob (old password unknown → can't re-encrypt). New key pair generated on next login. |

---

## Security Threat Model

### Step-by-Step: Why a Full DB Dump Cannot Decrypt Messages

An attacker with complete database access finds:

1. **Encrypted messages** — XChaCha20-Poly1305 ciphertext
2. **Escrow blob** — the private key, encrypted with a wrapping key
3. **Argon2 salt + XChaCha20 nonce** — public parameters
4. **Bcrypt hash** of the user's password

The decryption chain the attacker would need to follow:

```
Decrypt message
  ← requires ECDH shared secret
    ← requires user's private key
      ← requires wrapping key (to decrypt escrow blob)
        ← requires Argon2id(PLAINTEXT password, salt)
          ← requires the ACTUAL password
```

**Where the chain breaks:** The database stores the password only as a **bcrypt hash**. Bcrypt is a one-way function — the plaintext password cannot be recovered from it. The bcrypt hash itself is also useless as Argon2id input — only the original plaintext password produces the correct wrapping key.

**Only remaining attack: brute-force the password through Argon2id.**
Each attempt costs ~0.5 seconds and 64 MiB of RAM due to Argon2id's memory-hardness, making GPU parallelization extremely expensive. With a reasonably strong password (12+ characters), this is computationally infeasible.

**Conclusion:** Full database access alone **cannot** decrypt messages. The weakest link is password quality — a trivial password (e.g., "123456") combined with a DB dump is brute-forceable despite Argon2id. This is why minimum password complexity must be enforced.

### Protected Against (New, vs ADR-021)

| Threat                              | Protection                                             |
| ----------------------------------- | ------------------------------------------------------ |
| Device loss / browser data clearing | Escrow recovery with password → no key rotation needed |
| Accidental key rotation             | Recovery attempted BEFORE generating new key           |
| Cross-device usage                  | Same key recovered on any device with correct password |

### Still Protected Against (Inherited from ADR-021)

| Threat              | Protection                                       |
| ------------------- | ------------------------------------------------ |
| Database compromise | Escrow blob encrypted — useless without password |
| Malicious DBA       | Cannot derive wrapping key from bcrypt hash      |
| SQL injection       | Attacker gets encrypted blob, not plaintext key  |

### NOT Protected Against

| Threat                              | Why                                         | Mitigation                                    |
| ----------------------------------- | ------------------------------------------- | --------------------------------------------- |
| Weak password + DB dump             | Argon2id is slow but not unbreakable        | Enforce password policy, monitor for breaches |
| Password reset without old password | Can't re-encrypt escrow → old messages lost | Document clearly, admin reset available       |
| Compromised client during login     | Attacker has password + can read memory     | CSP, same as existing login form risk         |

---

## Definition of Done

- [x] `hash-wasm` dependency added to `frontend/package.json`
- [x] `crypto-worker.ts`: `wrapPrivateKey` and `unwrapPrivateKey` handlers implemented
- [x] `crypto-bridge.ts`: `wrapKey()` and `unwrapKey()` methods added
- [x] `login-password-bridge.ts`: module-scoped password bridge created
- [x] `e2e-state.svelte.ts`: `tryRecoverFromEscrow()` integrated before `generateAndRegisterKey()`
- [x] `e2e-state.svelte.ts`: `createEscrowBlob()` called after key generation
- [x] `e2e-state.svelte.ts`: `reEncryptEscrow()` for password change flow
- [x] `login/+page.svelte`: `setLoginPassword()` called before `goto()`
- [x] Profile pages: `reEncryptEscrow()` called after password change
- [x] Backend: `e2e-escrow` module with POST/GET/PUT endpoints
- [x] Backend: `e2e-escrow.service.ts` with proper `tenantTransaction()` (ADR-019)
- [x] Database: migration for `e2e_key_escrow` table with RLS + GRANT
- [x] Unit tests: Argon2id derivation, wrap/unwrap roundtrip, wrong password rejection
- [x] API tests: CRUD endpoints, tenant isolation, rate limiting
- [x] Integration test: full login → escrow creation → "device loss" → recovery → decryption
- [x] Password change test: re-encryption with new password, old password rejection after change
- [x] ADR-021 amended: "no key escrow" constraint removed, cross-reference to ADR-022

---

## References

- [ADR-021: E2E Encryption](./ADR-021-e2e-encryption.md) — Base E2E design (amended by this ADR)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) — Argon2id recommendation
- [hash-wasm](https://github.com/nicolo-ribaudo/hash-wasm) — MIT, Argon2id WASM implementation
- [@noble/ciphers](https://github.com/paulmillr/noble-ciphers) — XChaCha20-Poly1305 (already in project)
- [RFC 9106: Argon2](https://www.rfc-editor.org/rfc/rfc9106) — Argon2id specification
- [Incident 2026-02-11](../../CLAUDE-KAIZEN-MANIFEST.md) — Key rotation data loss that motivated this ADR

---

## Amendment 2026-04-22 — Cross-Origin Unlock Handoff + Restorative Rotation

### Context

ADR-050 (subdomain routing) introduced a mandatory cross-origin redirect
between password entry (apex `www.assixx.com`) and the app surface
(`<slug>.assixx.com`). The original escrow design assumed same-origin
login → app and carried the password via `login-password-bridge.ts`, a
module-scoped JS variable. Module memory does not survive a
`window.location.href` change across origins, so the subdomain's
`e2e.initialize()` received `loginPassword === null` and the recovery
path was unreachable — every cross-origin login that found an empty
subdomain IndexedDB fell through to `generateAndRegisterKey()` and
collided with the pre-existing server key.

The pre-Phase-A fallback was the silent rotation removed in
[ADR-021 §Amendment 2026-04-22](./ADR-021-e2e-encryption.md#amendment-2026-04-22--no-auto-rotation--plaintext-fallback-block).
Post-Phase-A the same collision fails closed. A cross-origin transport
mechanism is therefore required.

### Decision

#### Single-use unlock ticket (Redis, 60 s TTL)

A new Redis-backed single-use ticket carries the client-derived
wrappingKey from apex to subdomain. Wire-for-wire identical to the
existing `oauth:state:{uuid}` (ADR-046) and `oauth:handoff:{uuid}`
(ADR-050) patterns — different keyspace (`escrow:unlock:{uuid}`) so
`FLUSHDB` in dev isolates concerns.

**Payload:** `{ wrappingKey, userId, tenantId, createdAt }`. The
`wrappingKey` is a base64-encoded 32-byte XChaCha20 key derived
**client-side** in the apex Worker via `Argon2id(password, escrow.salt,
escrow.params)`. The password never leaves the apex browser for this
purpose — the server only sees the already-derived key.

**Binding:** consume verifies `payload.userId === req.user.id` and
`payload.tenantId === req.user.tenantId`. A ticket leaked to another
user cannot be redeemed.

**TTL:** 60 s. Long enough for the 303 redirect + subdomain first-render,
short enough to bound the dump-window. `GETDEL` atomic
(Redis 6.2+; production Redis 8.6.2).

#### Endpoints

| Method | Path                         | Auth   | Rate limit               | Purpose                                         |
| ------ | ---------------------------- | ------ | ------------------------ | ----------------------------------------------- |
| POST   | `/e2e/escrow/unlock-ticket`  | Bearer | `AuthThrottle` (10/5min) | Mint ticket after apex login                    |
| POST   | `/e2e/escrow/consume-unlock` | Cookie | `UserThrottle`           | Subdomain consumes ticket → returns wrappingKey |

#### Worker additions

- `deriveWrappingKey({ password, argon2Salt, argon2Params })` → returns
  base64 wrappingKey. Pure Argon2id, no IndexedDB side-effects (used on
  apex where the key should NOT land in a user-scoped store).
- `unwrapWithDerivedKey({ wrappingKey, encryptedBlob, xchachaNonce })` →
  XChaCha20-Poly1305 decrypt + store private key in subdomain's
  per-user IndexedDB. No Argon2id (key is already derived).

#### Flow

```
Apex /login use:enhance:
  1. Submit credentials, receive { accessToken, user.id, redirectTo, … }
  2. GET /e2e/escrow with Bearer → escrow metadata (or null)
  3. If escrow exists:
       - cryptoBridge.deriveWrappingKey(password, salt, params)
       - POST /e2e/escrow/unlock-ticket { wrappingKey } → { ticketId }
       - append ?unlock=<ticketId> to redirectTo
  4. window.location.href = redirectTo

Subdomain /signup/oauth-complete?token=…&unlock=…:
  - Server-side: consume handoff token, set cookies, preserve ?unlock=
    into the final dashboard redirect.

Subdomain (app) /+layout.svelte onMount:
  - bootstrapFromUnlockTicket(userId, ticketId):
      - POST /e2e/escrow/consume-unlock → { wrappingKey }
      - GET  /e2e/escrow → blob
      - cryptoBridge.unwrapKeyWithDerivedKey(wrappingKey, blob, nonce)
        → private key stored in subdomain IndexedDB
      - [restorative-rotation — see below]
  - e2e.initialize(userId) — hasKey=true, happy path.
```

#### Restorative rotation after escrow unwrap (single permitted rotation path)

Escrow may encode a private key whose fingerprint does NOT match the
server's current active public key. Real-world cause: past buggy
auto-rotations (pre-Phase-A) rewrote the server to a freshly generated
key without touching escrow; subsequent legitimate logins therefore
unwrap a historically-canonical key (what the escrow-stored private
actually decrypts to) while the server still holds the artefact key.

**Rule:** after a successful `unwrapKeyWithDerivedKey`, if the escrow's
fingerprint differs from the server's active key, `bootstrapFromUnlockTicket`
calls the private `rotateKeyOnServer` helper (defined in
`e2e-state.svelte.ts`) to align the server with the escrow-canonical
key. This is **the only permitted call site** for that helper.

**Why safe here and nowhere else:**

1. Successful Argon2id + XChaCha20 authenticated-decrypt is an
   identity proof — only someone holding the password reaches this
   branch.
2. The escrow-encoded private key is the user's own self-deposited
   long-term key — the one their counterparties have historically been
   encrypting to across most of the account's lifetime.
3. Rotation is RESTORATIVE: the new active key matches the
   escrow-canonical fingerprint, so every message encrypted during
   any prior period where the active key also matched escrow becomes
   decryptable again. Only messages encrypted during short-lived
   intermediate versions remain lost — the intended trade-off.

Empirical validation (user 19, 2026-04-22): escrow encoded fingerprint
`6aac158d84e7d6a6`, which had been the active public key during 5 of
the user's 13 historical key versions (v1, v3, v5, v8, v12 — 55 % of
the account's lifetime). Server's current active was `03dc09f88778f516`
(v13, active only 7 minutes). Post-amendment the subdomain rotated back
to `6aac…` as v14, immediately re-enabling decryption for the majority
of historical 1:1 traffic.

### Consequences

- Cross-origin subdomain login (ADR-050) now preserves escrow recovery
  end-to-end; no user intervention needed for normal operation.
- The ZK guarantee is slightly weakened: the derived wrappingKey exists
  on the server for up to 60 s. An attacker with a Redis dump AND a DB
  dump AND the ability to race the 60 s window could unlock escrow; with
  just the DB dump (the original ADR-022 threat model) the blob
  remains unbreakable.
- OAuth users (ADR-046) do not benefit — no password available to derive
  a wrappingKey. They still require admin reset on device change, as
  documented in ADR-021's "Consequences → Negative #1".
- ~~New-user scenario (no escrow yet): the apex flow skips ticket mint
  when `/e2e/escrow` returns null; the subdomain generates the initial
  key pair without a paired escrow. A future amendment may extend the
  ticket payload with `argon2Salt + argon2Params` so the subdomain can
  CREATE the first escrow post-generation — deferred, because all
  current known-affected users already have an escrow.~~
  **RESOLVED 2026-04-25** (see Amendment below). The "all current
  known-affected users already have an escrow" assumption proved wrong
  in practice — every user provisioned after a DB restore (or any new
  signup that did not bridge `setLoginPassword`) ended up key-on-server
  / no-escrow, and the next cross-origin login fail-closed with
  `recoveryRequired`. The bootstrap-variant of the unlock ticket now
  carries the salt + params; subdomain creates the first escrow.

### Files Changed

- `backend/src/nest/e2e-escrow/` — new `escrow-unlock-ticket.service.ts`,
  new DI token `ESCROW_REDIS_CLIENT`, module wiring for the `escrow:`
  keyspace Redis client, two controller endpoints.
- `frontend/src/lib/crypto/crypto-worker.ts` — `deriveWrappingKey` +
  `unwrapWithDerivedKey` handlers.
- `frontend/src/lib/crypto/crypto-bridge.ts` — matching promise wrappers.
- `frontend/src/lib/crypto/e2e-state.svelte.ts` —
  `bootstrapFromUnlockTicket` + private `rotateKeyOnServer` with
  SAFETY CONTRACT.
- `frontend/src/routes/(public)/login/+page.server.ts` — handoff
  response carries `accessToken` + `user.id/tenantId` for the
  apex-side ticket mint.
- `frontend/src/routes/(public)/login/+page.svelte` —
  `mintUnlockTicketOrFallback` in the `use:enhance` callback.
- `frontend/src/routes/(public)/signup/oauth-complete/+page.server.ts` —
  preserves `?unlock=` through the handoff redirect.
- `frontend/src/routes/(app)/+layout.svelte` —
  `bootstrapE2eFromUrlAndInitialize` before `initialize()`.

---

## Amendment 2026-04-25 — Cross-Origin First-Escrow Bootstrap (Resolves §"New-user scenario" Deferred)

### Context

Real-world verification on `testfirma.localhost` surfaced the deferred
"New-user scenario" path as actively broken — not just theoretical:

1. **DB-state in production-equivalent dev** — `e2e_user_keys` had 5 rows,
   `e2e_key_escrow` had 0. Every key in the system was orphaned. Every
   single user was one cross-origin login away from `recoveryRequired`.
2. **The "all current known-affected users already have an escrow"
   assumption from the 2026-04-22 Amendment is empirically false** the
   moment a database is restored, a tenant is reseeded, or a new user
   signs up via the cross-origin path. The first login on a brand-new
   subdomain origin generates the key (no `setLoginPassword` because
   sessionStorage is origin-scoped) but skips escrow creation entirely.
3. **The next cross-origin login then fail-closes** because
   `mintUnlockTicketOrFallback` finds `escrow === null`, skips the
   ticket, and the subdomain's `initialize()` collides 409 against
   the previously-registered key with no Argon2id-equivalent recovery
   path → `recoveryRequired = true`.

The deferred follow-up is no longer optional; it is the production
correctness gate for every fresh deployment.

### Decision

**Bootstrap-variant of the unlock ticket** carries `argon2Salt` +
`argon2Params` so the subdomain can create the user's first escrow blob
without re-prompting for the password and without a second Argon2id pass:

```
Apex login use:enhance:
  GET /e2e/escrow
    ├─ exists → derive wrappingKey from (password, escrow.salt, escrow.params)
    │           mint UNLOCK ticket { wrappingKey } (existing 2026-04-22 path)
    │
    └─ null → GET /e2e/keys/me
              ├─ exists → SKIP ticket (existing user without escrow → admin reset
              │           remains the recovery path; bootstrap would 409 on the
              │           subdomain's POST /e2e/keys and corrupt local state)
              │
              └─ null → generate fresh argon2Salt (32 random bytes, base64)
                        derive wrappingKey from (password, fresh_salt, defaults)
                        mint BOOTSTRAP ticket { wrappingKey, argon2Salt, argon2Params }

Subdomain bootstrapFromUnlockTicket:
  consume ticket → { wrappingKey, bootstrap? }
    ├─ bootstrap === undefined → existing UNLOCK path (unwrap + restorative rotation)
    │
    └─ bootstrap !== undefined →
         cryptoBridge.generateKeys()
         POST /e2e/keys { publicKey } (409 → abort, fail-closed downstream)
         cryptoBridge.wrapKeyWithDerivedKey(wrappingKey)  ← NEW Worker handler
         POST /e2e/escrow { encryptedBlob, argon2Salt, xchachaNonce, argon2Params }
```

### Pre-flight check (apex-side)

The apex `mintUnlockTicketOrFallback` MUST `GET /e2e/keys/me` before
choosing the bootstrap branch. If the server already holds an active
key but no escrow (the 5 legacy rows that motivated this amendment),
bootstrap is unsafe — the subdomain's `POST /e2e/keys` would 409 and
the local IndexedDB would already hold a fresh key that does not
match the server's. We skip the ticket entirely and let the
subdomain's `initialize()` fail-close cleanly with `recoveryRequired`.
Admin reset (`UPDATE e2e_user_keys SET is_active = 0`) followed by a
new login then takes the bootstrap path.

### Subdomain abort on 409

If the subdomain's `POST /e2e/keys` returns 409 inside the bootstrap
path (race condition or unexpected pre-existing key), the helper
`registerBootstrapKeyOrAbort` returns `false` immediately. The freshly
generated key remains in the subdomain's IndexedDB, but `initialize()`
will then run `resolveExistingKey` → server fingerprint mismatch →
`E2eKeyError('key_mismatch')` → `recoveryRequired = true`. Same
fail-closed semantics as ADR-021 §Amendment 2026-04-22, just with a
clean abort path that doesn't silently corrupt anything.

### Worker addition

`crypto-worker.ts` gains `wrapWithDerivedKey` — symmetric to the
existing `unwrapWithDerivedKey`. Sync handler (no IndexedDB writes,
just XChaCha20-Poly1305 encrypt with a fresh 24-byte random nonce).
Bridge wrapper `cryptoBridge.wrapKeyWithDerivedKey()` returns the
base64 ciphertext + nonce ready for `POST /e2e/escrow`.

### Threat-model delta vs. 2026-04-22 Amendment

The bootstrap ticket payload now contains `wrappingKey + argon2Salt +
argon2Params`. The salt and params are public values per Argon2id
threat model (RFC 9106) — knowing them does not weaken the
unbreakability of the resulting key. Same 60-second Redis TTL,
single-use GETDEL, user-bound consume-check apply. ZK guarantee
unchanged: a Redis dump alone (without the password) cannot derive
the wrappingKey; password + bcrypt-hash combo from a DB dump still
hits Argon2id memory-hardness for offline brute-force.

### Verification (live, 2026-04-25)

Verified end-to-end against User 249 (tenant 8, subdomain
`testfirma.localhost`) after `TRUNCATE e2e_user_keys`:

```
Login 1 (BOOTSTRAP path):
  apex   GET  /e2e/escrow            → 200 { data: null }
  apex   GET  /e2e/keys/me           → 200 { data: null }
  apex   POST /e2e/escrow/unlock-ticket  (with argon2Salt + argon2Params) → 201 { ticketId }
  → redirect testfirma.localhost/?unlock=…
  sub    POST /e2e/escrow/consume-unlock → 200 { wrappingKey, bootstrap }
  sub    POST /e2e/keys              → 201 (fingerprint e73129e3…)
  sub    POST /e2e/escrow            → 201 (blob_version 1)
  sub    log: "Escrow bootstrap complete — first escrow stored"

Login 2 (UNLOCK path, same user, fresh subdomain IndexedDB):
  apex   GET  /e2e/escrow            → 200 { data: { encryptedBlob, salt, nonce, params } }
  apex   POST /e2e/escrow/unlock-ticket  (no bootstrap fields) → 201 { ticketId }
  → redirect testfirma.localhost/?unlock=…
  sub    POST /e2e/escrow/consume-unlock → 200 { wrappingKey } (no bootstrap)
  sub    GET  /e2e/escrow            → 200 (blob fetched)
  sub    cryptoBridge.unwrapKeyWithDerivedKey → fingerprint e73129e3… (matches)
  sub    GET  /e2e/keys/me            → server fingerprint matches → no rotation needed
  sub    log: "Private key bootstrapped from unlock ticket"
                "Server key matches local key"
                "E2E initialization COMPLETE — isReady=true"
```

Both paths produce the same fingerprint (`e73129e304ef45be…`) — the
escrow is decryptable with the user's password across origin
boundaries. No 409, no `recoveryRequired`, no admin intervention.

### Files Changed (Amendment 2026-04-25)

- `backend/src/nest/e2e-escrow/escrow-unlock-ticket.service.ts` —
  new `BootstrapMaterial` + exported `UnlockTicketConsumeResult` types.
  `create(…, bootstrap?)` accepts optional bootstrap payload; `consume()`
  returns wrappingKey + optional bootstrap. Type-guard validates the
  optional sub-shape exhaustively.
- `backend/src/nest/e2e-escrow/dto/create-unlock-ticket.dto.ts` —
  optional `argon2Salt` (base64 32-byte) + `argon2Params` with cross-field
  refine ("set both, or neither"). ADR-041 `exactOptionalPropertyTypes`
  compatible.
- `backend/src/nest/e2e-escrow/e2e-escrow.controller.ts` — both
  endpoints pass-through the bootstrap variant; consume returns the
  extended response shape.
- `frontend/src/lib/crypto/crypto-worker.ts` — `wrapWithDerivedKey`
  request type + `privateKeyWrappedWithDerivedKey` response type +
  sync handler `handleWrapWithDerivedKey` (no IndexedDB writes).
- `frontend/src/lib/crypto/crypto-bridge.ts` —
  `wrapKeyWithDerivedKey()` promise wrapper.
- `frontend/src/routes/(public)/login/+page.svelte` — refactored
  `mintUnlockTicketOrFallback` into 3 branches (unlock / bootstrap /
  skip-because-server-has-key). Helpers `fetchEscrow`, `serverHasActiveKey`,
  `freshArgon2Salt`, `mintTicketOrFallback` extracted for KISS +
  cognitive-complexity compliance.
- `frontend/src/lib/crypto/e2e-state.svelte.ts` — local
  `UnlockTicketConsumeResult` type matching backend; refactored
  `bootstrapFromUnlockTicket` branches on `bootstrap` field. New helpers
  `bootstrapFreshEscrow` (gen + register + wrap + store) +
  `recoverFromExistingEscrow` (extracted from prior body) +
  `registerBootstrapKeyOrAbort` (409-handling).

---

## Amendment 2026-05-01 — Signup Bootstrap (Closes Login/Signup Asymmetry)

### Context

The 2026-04-25 amendment shipped the bootstrap-variant ticket primitive +
the apex caller on the **login** side (`(public)/login/+page.svelte`).
The matching **signup** caller was never wired — every freshly signed-up
tenant root user therefore ended up exactly in the "server has key, no
escrow" orphan state that the 2026-04-25 pre-flight check was designed
to detect, but had no code path to prevent at signup time.

Concrete reproduction (2026-05-01, dev box, tenant 1 user 1):

1. Apex `/login` credentials submit → 2FA challenge → verify success →
   handoff branch fires (host ≠ user's tenant subdomain).
2. `mintUnlockTicketOrFallback` runs Branch 3 (Skip): `fetchEscrow`
   returns null, `serverHasActiveKey` returns true → no ticket minted,
   redirect to subdomain WITHOUT `?unlock=…`.
3. Subdomain `(app)/+layout.svelte` → `e2e.initialize()` → no local
   key → generates fresh keypair → `POST /e2e/keys` → 409 (server
   already holds a different key from a prior abandoned signup) →
   `recoveryRequired = true`. Permanent block until admin reset.

The orphan key was created during the original signup flow because the
signup verify form (`(public)/signup/_lib/TwoFactorVerifyForm.svelte`)
threw `redirect()` instead of returning a `VerifyHandoffResult` — leaving
no client-side step where the apex-side ticket mint could run.

### Decision

The signup verify-action now follows the exact same contract as the
login verify-action: **RETURN `VerifyHandoffResult` instead of throwing
`redirect()`**, so the client-side `enhance` callback can call
`mintUnlockTicketOrFallback` BEFORE the cross-origin navigation. For a
brand-new signup user the helper takes the Bootstrap branch
automatically (no escrow, no server key) — no signup-specific
`mintBootstrapTicket` helper is needed; the `*OrFallback` name was
deliberate, the helper is the canonical entry point for every cross-
origin handoff dance and discriminates internally via the existing
3-branch logic.

The credentials → verify stage transition on signup also had to change
from `window.location.href` (hard nav, password $state destroyed) to
`await update()` (same-origin redirect followed by SvelteKit's client
router, parent component preserved, password $state survives). Mirrors
the login twin's pattern. Without this change the verify form would
receive `password=''` even with the prop wiring, producing a worthless
deterministic Argon2id-derived wrappingKey and a corrupted escrow blob.

### Files Changed (Amendment 2026-05-01)

- `frontend/src/routes/(public)/signup/_lib/2fa-server-helpers.ts` —
  `VerifyResponseData` gains `accessToken?: string` mirror of backend
  contract. New exported `VerifyHandoffResult` interface (mirror of
  the login twin's). `readVerifySuccess` validates + extracts
  `accessToken` (treats missing as 500 — backend contract violation).
  `handleVerifyAction` returns `VerifyHandoffResult` instead of
  throwing `redirect()`.
- `frontend/src/routes/(public)/signup/_lib/TwoFactorVerifyForm.svelte` —
  new `password: string` prop. Imports `mintUnlockTicketOrFallback`
  from `$lib/crypto/escrow-handoff`. Type guard `isHandoffSuccess` +
  helper `handleHandoffSuccess` (extracted to keep `enhanceVerify`
  under cognitive-complexity = 10). New first branch in
  `enhanceVerify`: `result.type === 'success' && isHandoffSuccess(...)`
  → mint ticket in parallel with the 5 s celebration toast → navigate
  to `redirectTo` with `?unlock=…` appended. Legacy redirect-throw
  branch retained as defensive fallback.
- `frontend/src/routes/(public)/signup/+page.svelte` —
  `enhanceSignup` redirect-branch falls through to `await update()`
  instead of `window.location.href`-hard-navigating, so the parent
  component (and its `password` $state) survive the credentials →
  verify stage transition. `<TwoFactorVerifyForm {password} />` wires
  the prop.
- `frontend/src/routes/(public)/signup/+page.server.ts` — JSDoc on the
  `verify` action updated to reflect the new return-vs-throw contract.
- `frontend/src/routes/(public)/signup/oauth-complete/+page.server.ts`
  — **no change required**. The `?unlock=` preservation in
  `handleHandoff` (added with the 2026-04-22 amendment for the login
  flow) is already dual-purpose; the same handoff consumer serves both
  login and signup and forwards `?unlock=` onto the dashboard redirect
  unchanged.

### Backend (no change)

`two-factor-auth.controller.ts:253-258` already echoes `accessToken`
for every handoff branch (login + signup). The 2026-05-01 fix is
purely frontend.

### Verification

Pre-fix DB query for any victim tenant:

```sql
SELECT u.id, u.email,
       k.fingerprint AS server_key_fingerprint,
       e.blob_version AS has_escrow
  FROM users u
  LEFT JOIN e2e_user_keys  k ON k.user_id = u.id AND k.is_active = 1
  LEFT JOIN e2e_key_escrow e ON e.user_id = u.id AND e.is_active = 1
 WHERE u.email = '<test@…>';
-- Pre-fix: server_key_fingerprint NOT NULL, has_escrow IS NULL  ← stranded
```

Cleanup for any pre-fix orphan-state user (so they can sign in cleanly
once the fix is live):

```sql
UPDATE e2e_user_keys SET is_active = 0
 WHERE user_id = $1 AND is_active = 1;
```

Post-fix the same query after a fresh signup must show
`has_escrow = 1` and a fingerprint that matches the subdomain's local
IndexedDB.

### Open Items (deferred)

1. **Empty-password edge case** — if a user reloads the verify page
   (rare: requires a valid challenge cookie still in flight), the
   parent's `password` $state initialises to `''` on the fresh mount.
   `mintUnlockTicketOrFallback` currently has no empty-password guard
   and would derive a worthless deterministic wrappingKey. The same
   latent edge case exists on login. Fix is a single guard in
   `escrow-handoff.ts::mintUnlockTicketOrFallback`: bail out and
   return `redirectTo` unchanged when `loginPasswordValue === ''`.
   Out of scope for this amendment because reproducing it requires a
   manual reload mid-flow.
2. **DRY consolidation of the two verify forms** —
   `(public)/login/_lib/TwoFactorVerifyForm.svelte` and
   `(public)/signup/_lib/TwoFactorVerifyForm.svelte` are now near-
   identical (~95% shared logic, differ in lockout target, cancel
   target, success-toast delay). Worth folding into a single
   component with a discriminator prop in a follow-up PR. Not in
   scope here — both forms now have parity for the escrow flow,
   future drift risk is the only motivation.

---

## Amendment 2026-05-01b — Atomic Key+Escrow Registration (Closes the (key, no escrow) Race Window)

### Context — what the prior amendments did NOT cover

The 2026-04-25 amendment introduced the cross-origin bootstrap ticket
to repair users who already held an orphan key and arrived at the
subdomain without a recovery path. The 2026-05-01 amendment wired the
matching apex-side caller into the signup flow so freshly created
tenants would not enter that orphan state from day zero.

Both amendments still relied on the **two-call sequence** from the
client:

```
POST /api/v2/e2e/keys      → INSERT row in e2e_user_keys, return key
POST /api/v2/e2e/escrow    → INSERT row in e2e_key_escrow, return blob
```

These are **two independent transactions**. Any failure on the second
call (network blip, transient DB error, browser tab killed, JS
exception in the wrap step, the user navigating away mid-flow) leaves
the database in `(e2e_user_keys.is_active = 1, e2e_key_escrow = ∅)` —
the same orphan state the prior amendments fight, just produced by a
different mechanism.

In `e2e-state.svelte.ts` the hazard was actively designed-in: the
escrow store call was deliberately fire-and-forget on both paths.

```typescript
// Same-origin fall-through (resolveOrRecoverKey, before the fix):
const resolved = await generateAndRegisterKey();
if (loginPassword !== null) {
  void tryCreateEscrow(loginPassword);   // ← non-awaited, non-throwing
}
return resolved;

// Cross-origin bootstrap (bootstrapFreshEscrow, before the fix):
try {
  await apiClient.post(ESCROW_ENDPOINT, { ... });
} catch (err) {
  log.warn('Escrow create failed during bootstrap — key registered, escrow missing');
  // returns true anyway — caller sees "bootstrapped"
}
```

`tryCreateEscrow` itself swallowed every error except 409. The two
swallows compose: a transient escrow POST failure produced **zero
user-visible feedback** while permanently parking the user in the
unrecoverable state that the prior amendments treat as a one-shot
admin-reset event. Concrete reproduction:

1. User truncates `e2e_user_keys` + `e2e_key_escrow` (admin reset).
2. User logs in cleanly via apex; `mintUnlockTicketOrFallback`
   correctly chooses Branch 2 (Bootstrap) and mints a bootstrap
   ticket → subdomain `bootstrapFreshEscrow` runs.
3. `POST /e2e/keys` succeeds (key row committed).
4. `POST /e2e/escrow` fails for any reason — the catch swallows it.
5. `bootstrapFreshEscrow` returns `true`. Subdomain `e2e.initialize()`
   reports `isReady: true`.
6. Next login from any cross-origin entry point, or any login after
   IndexedDB is cleared on the subdomain: **Branch 3 (Skip) fires
   forever**. User is locked into "admin reset required" until manual
   DB intervention.

### Decision

Replace the two-call sequence with a single atomic endpoint that
commits the key row AND the escrow row inside one
`tenantTransaction()`. PostgreSQL transactional semantics guarantee
both rows commit together or both roll back — by construction the
`(key, no escrow)` state cannot be observed at rest.

```
POST /api/v2/e2e/keys/with-escrow
Body: { publicKey, escrow: { encryptedBlob, argon2Salt, xchachaNonce, argon2Params } }
→ 201 Created { key, escrow }   # both rows committed
→ 409 Conflict                   # active key OR active escrow already exists
→ any DB failure                 # both rolled back, no observable side-effect
```

The legacy `POST /e2e/keys` and `POST /e2e/escrow` endpoints stay in
the controller for two narrow paths:

- Admin-reset followup where the next same-origin login backfills via
  `tryCreateEscrowIfMissing` (a user with a pre-existing local key
  whose server-side rows were just wiped).
- `PUT /e2e/escrow` for password-change re-encryption — unchanged.

Both legacy callers carry deprecation notes pointing future first-key
work at the atomic endpoint.

### Frontend invariants enforced alongside the endpoint

The atomic endpoint alone is insufficient; the client must call it
unconditionally on first-key creation paths AND must surface escrow
failures instead of swallowing them. Three additional client-side
changes lock those invariants:

1. `generateAndRegisterKey()` (legacy non-atomic) deleted from
   `e2e-state.svelte.ts`. The same-origin fall-through in
   `resolveOrRecoverKey` now calls `generateAndRegisterKeyWithEscrow`
   which derives the wrappingKey from the login password, wraps the
   freshly generated private key, and posts the atomic envelope. If
   no password is available (rare: cross-origin layout mount with no
   login-password-bridge AND no escrow on server AND no local key) we
   throw a plain `Error` so `recoveryRequired` stays false and the
   user is told to log in again — not flagged for admin reset.
2. `bootstrapFreshEscrow()` (cross-origin first login) rewritten to
   use the atomic endpoint with the apex-derived wrappingKey. Returns
   `false` on any failure to preserve the existing caller fall-through
   contract — the `bootstrapFromUnlockTicket` consumer expects
   non-throwing.
3. `tryCreateEscrow()` and `tryCreateEscrowIfMissing()` (the backfill
   paths) now propagate errors instead of logging-and-swallowing. Only
   the idempotent "already exists" 409 is still treated as success.
   The `void tryCreateEscrowIfMissing(...)` call in
   `resolveOrRecoverKey` becomes `await tryCreateEscrowIfMissing(...)`.
   Legacy users with a local key but missing server escrow are
   repaired on the next same-origin login with a known password; if
   the backfill itself fails, the user sees a transient error and can
   retry, instead of silently remaining in the orphan state.

### Why this composes with the prior amendments

| Amendment          | Closes                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-04-22         | No-auto-rotation + plaintext fallback block; primitive: bootstrap ticket.                                                                                                                                                                                                                  |
| 2026-04-25         | Cross-origin first-escrow bootstrap on the **login** path.                                                                                                                                                                                                                                 |
| 2026-05-01         | Cross-origin first-escrow bootstrap on the **signup** path (caller wiring parity).                                                                                                                                                                                                         |
| 2026-05-01b (this) | Eliminates the `(key, no escrow)` state at its database root by making the registration atomic. Defends against transient failure on EVERY path — including paths the prior amendments never covered (a legitimate bootstrap that just happens to lose the escrow POST to a network blip). |

Each prior amendment closed a **caller-side gap**. This amendment
closes the **server-side data invariant**: even if a future caller
forgets to wire the bootstrap branch, or a brand-new path is added,
the database itself refuses to commit a key without its escrow.

### Files Changed (Amendment 2026-05-01b)

Backend:

- `backend/src/nest/e2e-keys/dto/register-keys-with-escrow.dto.ts`
  (new) — combined Zod schema, both fields required.
- `backend/src/nest/e2e-keys/dto/register-keys-with-escrow.dto.test.ts`
  (new) — 6 composition tests (atomicity invariant: partial input
  rejected at schema layer).
- `backend/src/nest/e2e-keys/dto/index.ts` — barrel export updated.
- `backend/src/nest/e2e-keys/e2e-keys.service.ts` —
  `registerKeysWithEscrow()` plus four private helpers
  (`assertNoActiveKeyOrEscrow`, `insertKeyRow`, `insertEscrowRow`,
  `mapKeyRowToResponse`, `mapEscrowRowToResponse`). All three INSERTs
  share the single `tenantTransaction()`. Legacy `registerKeys()`
  retained with deprecation note.
- `backend/src/nest/e2e-keys/e2e-keys.service.test.ts` — 7 new tests
  including atomicity invariant (escrow INSERT failure propagates),
  conflict pre-checks for both tables, JSONB serialisation of
  `argon2Params`.
- `backend/src/nest/e2e-keys/e2e-keys.controller.ts` —
  `POST /e2e/keys/with-escrow` endpoint with `AuthThrottle()`. Both
  endpoints now carry deprecation pointers.

Frontend:

- `frontend/src/lib/crypto/e2e-state.svelte.ts` —
  `postAtomicKeyAndEscrow()` (shared helper),
  `generateAndRegisterKeyWithEscrow()` (same-origin),
  `bootstrapFreshEscrow()` rewrite (cross-origin atomic),
  `tryCreateEscrow*` propagate-on-failure semantics, `void → await`
  on the backfill call site, removed unused
  `registerBootstrapKeyOrAbort`, removed legacy
  `generateAndRegisterKey`.

### Verification

Unit tests: 30/30 green (`backend/src/nest/e2e-keys/`). Type-check
green on shared + backend + frontend + backend/test. Lint green on
both sides.

End-to-end (dev, tenant 1 user 1, after `TRUNCATE` on both tables):

| Login  | Apex behaviour                                          | Subdomain behaviour                                                                                                                             | Result                     |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| First  | Branch 2 (Bootstrap) — bootstrap ticket minted          | `consume-unlock` → `bootstrapFreshEscrow` → `POST /e2e/keys/with-escrow` 201 → `Atomic bootstrap complete — first key + first escrow committed` | E2E ready, `isReady: true` |
| Second | Branch 1 (Unlock) — escrow exists, unlock ticket minted | `consume-unlock` → `recoverFromExistingEscrow` → `Private key bootstrapped from unlock ticket`                                                  | E2E ready, `isReady: true` |

Backend log on first login: `Atomic register: E2E key + escrow for
user 1 in tenant 1 (fingerprint: 6c687f2eec48bf6c...)` — confirms
single-transaction commit.

### Open Items (deferred)

1. **Architectural test for the legacy two-call pattern** —
   `shared/src/architectural.test.ts` should fail on any new caller
   of `apiClient.post('/e2e/keys', …)` outside the small allowlist
   (the rotate path, the legacy backfill path). Cheap insurance
   against a future contributor reintroducing the race window.
2. **Removal of the legacy `POST /e2e/keys` endpoint** — once one
   release cycle confirms zero non-atomic usage in production logs,
   the endpoint and its DTO can be deleted. Keep the rotate endpoint
   (`PUT /e2e/keys/me`) and the admin-reset cascade unchanged.
3. **Same atomic refactor for `PUT /e2e/escrow` (password change)** —
   the password-change path currently issues `POST /api/v2/auth/...`
   (re-derive) followed by `PUT /e2e/escrow`. Failure between them
   produces a different orphan: the user's password rotates but the
   escrow stays encrypted with the old key, breaking next-login
   recovery on a new origin. Same atomicity argument applies; the
   fix is a single combined endpoint. Out of scope here because the
   2026-04-25 amendment already documented this as a known gap.
