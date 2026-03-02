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
