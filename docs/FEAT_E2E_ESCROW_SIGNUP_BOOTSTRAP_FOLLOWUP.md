# FEAT — E2E Escrow Bootstrap on Signup (Followup to ADR-022 × ADR-054)

> **Status:** RESOLVED 2026-05-01 — see ADR-022 §"Amendment 2026-05-01 — Signup Bootstrap (Closes Login/Signup Asymmetry)".
> **Date opened:** 2026-05-01
> **Date closed:** 2026-05-01 (same session)
> **Resolution:** signup verify now follows the login pattern — action returns `VerifyHandoffResult` instead of throwing redirect, the verify form mints the escrow ticket via the canonical `mintUnlockTicketOrFallback` (Bootstrap branch fires automatically for fresh signups), and the credentials → verify stage transition uses `await update()` so `password` $state survives.
> **Goal (achieved):** close the only remaining ADR-054 ↔ ADR-022 break — first-tenant signup never created an escrow blob.

---

## 1. Why this exists

The login same-origin fix (already merged) bridges the user's password from `TwoFactorVerifyForm` into `sessionStorage` so `e2e.initialize()` can derive an Argon2id wrapping key after the post-2FA redirect.

**Signup is structurally different and stays broken:**

- `signup/_lib/TwoFactorVerifyForm.svelte:295-307` redirects **cross-origin** to `https://<slug>.assixx.com/signup/oauth-complete?token=…`
- `sessionStorage` is origin-scoped → an apex-side `setLoginPassword(password)` does **not** survive the redirect
- Subdomain `e2e.initialize()` fires with `loginPassword = null` and `hasKey = false` → `generateAndRegisterKey()` runs without `tryCreateEscrow`
- Result: **every freshly signed-up tenant root user has a server key with no escrow blob.** Stranded from day one.

This is the same underlying defect ADR-022's 2026-04-25 amendment already solved for the **login** cross-origin path (`mintUnlockTicketOrFallback` in `login/+page.svelte:394`). Signup just hasn't been wired through yet.

---

## 2. What to fix

**Apex-side (signup verify):** mint a _bootstrap_ unlock ticket before the cross-origin redirect, append `?unlock=<ticketId>` to the redirect URL.

**Subdomain-side (`/signup/oauth-complete`):** preserve `?unlock=` through to the final dashboard redirect (already done for login per ADR-022 §"Files Changed" 2026-04-22). Verify it still works for the signup variant.

**`(app)/+layout.svelte`:** already calls `bootstrapE2eFromUrlAndInitialize` before `initialize()` — `bootstrapFromUnlockTicket` then routes into `bootstrapFreshEscrow` (`e2e-state.svelte.ts:678`) which generates the X25519 pair, registers it on subdomain, and stores the first escrow blob using the carried Argon2 salt + params.

### Files to change

| File                                                                  | Change                                                                                                                                                     | Pattern reference                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `frontend/src/routes/(public)/signup/_lib/TwoFactorVerifyForm.svelte` | Add `password` prop + `accessToken` prop (or expose via verify-action result) + `mintBootstrapTicket` call before `window.location.href`                   | `login/+page.svelte:394–450` (mintUnlockTicketOrFallback) |
| `frontend/src/routes/(public)/signup/+page.svelte`                    | Pass `{password}` to `<TwoFactorVerifyForm />`                                                                                                             | `login/+page.svelte:587` (already merged)                 |
| `frontend/src/routes/(public)/signup/+page.server.ts`                 | Verify action returns `accessToken` + `user.id` in the success-redirect data so apex-side can call `/e2e/escrow/unlock-ticket` before the cross-origin hop | `login/+page.server.ts:494–503` (handoff branch)          |
| `frontend/src/routes/(public)/signup/oauth-complete/+page.server.ts`  | Confirm `?unlock=` query-param is preserved into the final dashboard redirect (likely already correct)                                                     | ADR-022 amendment 2026-04-22 §Files Changed               |

### What NOT to change

- `e2e-state.svelte.ts` — `bootstrapFreshEscrow` + `recoverFromExistingEscrow` already handle both ticket variants. Don't re-touch.
- `crypto-worker.ts` / `crypto-bridge.ts` — `wrapKeyWithDerivedKey` / `deriveWrappingKey` already exist.
- `backend/src/nest/e2e-escrow/` — the unlock-ticket endpoints already accept the bootstrap variant (DTO has optional `argon2Salt` + `argon2Params` per ADR-022 amendment 2026-04-25).

**The whole infrastructure is in place. Only the signup-apex caller is missing.**

### Sketch (signup TwoFactorVerifyForm.svelte enhanceVerify, replaces lines ~295–308)

```ts
if (result.type === 'redirect') {
  if (typeof result.location === 'string' && result.location !== '') {
    showToast({
      /* unchanged 5s celebration */
    });

    // ADR-022 × ADR-054 × ADR-050: signup is cross-origin; sessionStorage
    // does not survive. Mint a bootstrap unlock ticket so the subdomain
    // can create the user's first escrow blob in `bootstrapFreshEscrow`.
    const finalUrl = await mintBootstrapTicket(
      result.location, // cross-origin handoff URL
      accessToken, // from verify-action success data (NEW)
      userId, // from verify-action success data (NEW)
      password, // prop from parent (NEW)
    );

    setTimeout(() => {
      window.location.href = finalUrl;
    }, SUCCESS_REDIRECT_DELAY);
    return;
  }
  /* ... unchanged ... */
}
```

`mintBootstrapTicket` is structurally identical to `mintUnlockTicketOrFallback` (`login/+page.svelte:394`) but **always** takes the bootstrap branch — there is by definition no pre-existing escrow or server key for a brand-new account, so no `fetchEscrow` / `serverHasActiveKey` checks needed. Generate fresh salt + params, derive wrapping key, mint ticket with `bootstrap` payload, return URL with `?unlock=` appended.

---

## 3. Verification

> **Correction 2026-05-01:** the original draft of this doc claimed dev cannot
> reproduce the bug because "localhost dev lacks subdomain routing". That
> conflated Nginx-level tenant resolution with browser-level origin isolation.
> The bug is browser-level (sessionStorage + cookies are origin-scoped on
> `assixx.localhost:5173` vs `localhost:5173` independently of any backend
> middleware), so dev reproduces it cleanly as long as `/etc/hosts` maps the
> tenant subdomain. The production-mode-Docker prerequisite is dropped.

### Dev reproduction (the cheap path)

```bash
# 1. Add tenant subdomain to /etc/hosts (HOW-TO-LOCAL-SUBDOMAINS.md)
#    127.0.0.1  freshtest.localhost

# 2. Start the dev stack (already running in most sessions)
cd docker && doppler run -- docker-compose up -d

# 3. Start frontend dev server
cd .. && pnpm run dev:svelte

# 4. Browser: http://localhost:5173/signup → run signup with slug `freshtest`
# 5. Check DB:
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT u.id, u.email, k.fingerprint, e.blob_version FROM users u
   LEFT JOIN e2e_user_keys  k ON k.user_id = u.id AND k.is_active = 1
   LEFT JOIN e2e_key_escrow e ON e.user_id = u.id AND e.is_active = 1
   WHERE u.email LIKE 'freshtest%' ORDER BY u.id DESC LIMIT 1;"
# Pre-fix: fingerprint NOT NULL, blob_version IS NULL  ← proven on 2026-05-01 (user 1)
# Post-fix: fingerprint NOT NULL, blob_version = 1
```

### Cleaning up an existing orphan-state user (admin reset alternative)

Pre-fix victims have a server key but no escrow. Without cleanup the same
user keeps hitting the Skip branch in `escrow-handoff.ts:208` on every
subsequent login (server-has-key + no-escrow → no ticket minted →
`recoveryRequired: true` on the subdomain). One-liner reset:

```sql
UPDATE e2e_user_keys SET is_active = 0
 WHERE user_id = $1 AND is_active = 1;
```

Next login goes through the Bootstrap path cleanly and creates the
escrow blob the original signup should have created.

### Production-mode validation (optional, full-stack parity)

Only needed when validating the full Nginx + adapter-node chain (e.g. a
pre-release sanity check). Same SQL query, run against the production
profile after a fresh signup on `freshtest.assixx.com` (or local
equivalent). For pure E2E flow validation the dev path above is
sufficient.

---

## 4. Definition of Done

- [x] **Bug confirmed in production** — user 1 (tenant 1) reproduced the orphan-key state on `assixx.localhost:5173` 2026-05-01: server key `94b4e482…`, no escrow blob, console showed `EscrowHandoff: "No escrow but server has key — skipping bootstrap"` (Branch 3 of `escrow-handoff.ts:208`).
- [x] **`mintUnlockTicketOrFallback` reused** — no new `mintBootstrapTicket` helper. The `*OrFallback` is the canonical entry point and discriminates internally (Unlock / Bootstrap / Skip); for a brand-new signup it takes the Bootstrap branch automatically (`fetchEscrow → null`, `serverHasActiveKey → false`).
- [x] **Signup verify-action returns `VerifyHandoffResult`** — was throwing `redirect()`. New exported interface in `signup/_lib/2fa-server-helpers.ts` with `accessToken`, `user.id`, `redirectTo`. Backend already echoed `accessToken` in the handoff response (`two-factor-auth.controller.ts:253-258`); no backend change.
- [x] **Apex-side ticket mint runs before cross-origin redirect** — `enhanceVerify` in `signup/_lib/TwoFactorVerifyForm.svelte` now matches on `result.type === 'success' && isHandoffSuccess(result.data)` and calls the helper before `window.location.href`.
- [x] **Subdomain `?unlock=` preservation already worked** — `oauth-complete/+page.server.ts:handleHandoff` (added with the 2026-04-22 amendment for login) is dual-purpose; signup uses the same handoff consumer. No change needed.
- [x] **Credentials → verify stage uses `await update()`** — `enhanceSignup` in `signup/+page.svelte` was hard-navigating with `window.location.href`, which destroyed `password` $state. Now falls through to `update()` (mirrors login twin's pattern); parent component is preserved, password survives. The followup doc didn't flag this because the original analysis assumed login + signup had identical credentials → verify behaviour. They didn't. Fixed.
- [x] **0 errors** — `pnpm run check` (frontend tsc + backend tsc), `pnpm run lint` (frontend ESLint), `svelte-check` (2594 files, 0 warnings).
- [x] **ADR-022 amended** — new §"Amendment 2026-05-01 — Signup Bootstrap (Closes Login/Signup Asymmetry)" appended.

### Runtime verification (live, 2026-05-01)

- [x] **Pre-fix DB baseline captured** — user 1 had `server_key_fingerprint = 94b4e4822a0f4fd9…`, `escrow_ver IS NULL`. Cleared via `UPDATE e2e_user_keys SET is_active = 0 WHERE user_id = 1`.
- [x] **Bootstrap path verified** — apex POST `/e2e/escrow/unlock-ticket` → 201 (backend log: `"Escrow bootstrap ticket minted for user 1 (tenant 1)"`). Subdomain POST `/e2e/escrow/consume-unlock` → 200. Subdomain POST `/e2e/keys` → 201 (`"Registered E2E key for user 1 in tenant 1 (fingerprint: a36b4e6c…)"`). Subdomain POST `/e2e/escrow` → 201 (`"Stored E2E escrow"`). Atomic gap: 90 ms between key creation and escrow creation. E2eState log: `"Escrow bootstrap complete — first escrow stored"`.
- [x] **Post-fix DB confirmed** — `SELECT … WHERE u.id = 1`:
      `    id |      email      |          server_key_fp           | key_active | escrow_ver | escrow_active
---+-----------------+----------------------------------+------------+------------+--------------
 1 | info@assixx.com | a36b4e6c9860bbf4c01ef743881faaca |     1      |     1      |      1`
      Tenant-weit: 1 active key, 1 active escrow, 0 inactive rows of either.
- [x] **Unlock path verified (regression check)** — second login on same user took the Unlock-branch automatically (escrow exists → `mintUnlockTicketOrFallback` Branch 1 fires, no `keys/me` call). `consume-unlock` returns `{ wrappingKey }` without bootstrap payload, subdomain unwraps existing blob. E2eState log: `"Private key bootstrapped from unlock ticket"` → `"Server key matches local key"` → `"E2E initialization COMPLETE — isReady=true"`. Same fingerprint `a36b4e6c…`, no key rotation.
- [ ] **Subsequent password change re-encrypts the escrow blob** — out of scope for this fix; same-origin re-encrypt path is unrelated to the cross-origin bootstrap gap that motivated the followup.

### Adjacent bug surfaced + fixed during verification

The runtime trace exposed a latent SvelteKit timing bug in `(app)/+layout.svelte:332` — the `bootstrapE2eFromUrlAndInitialize` helper called SvelteKit's `replaceState` from `$app/navigation` inside `onMount` to strip `?unlock=` from the URL, but during first hydration after a cross-origin redirect the router has not yet finished initialising → `Cannot call replaceState(...) before router is initialized` throws → both `bootstrapFromUnlockTicket` and `initialize` are skipped → ticket expires unconsumed → `recoveryRequired`.

Pre-existing bug (file unchanged on this branch). It was unreachable for user 1 before this fix because the orphan-key state forced the apex into Branch 3 (Skip — no `?unlock=` ever appended). The signup-side mint and the cleanup SQL now route fresh users through this path for the first time, exposing the throw.

**Fix:** swap SvelteKit's `replaceState` for raw `window.history.replaceState(window.history.state, '', url.toString())`. No router-init dependency, no console warnings for URL-only mutations. Trade-off: `$page.url` goes stale until the next navigation, but nothing in this flow re-reads `?unlock=` and it's a single-use param. Documented in `(app)/+layout.svelte:328-345`.

---

## 5. Trap to avoid

The login fix uses **same-origin sessionStorage bridging** because login redirects same-origin under ADR-054 (no apex→subdomain hop in the verify branch — verify action sets cookies on current origin and 303s to a path, not a URL).

The signup fix MUST NOT use that pattern — signup verify redirects cross-origin to subdomain. `setLoginPassword` would be a no-op because nothing on the subdomain reads apex sessionStorage.

If you accidentally try `setLoginPassword(password)` in `signup/_lib/TwoFactorVerifyForm.svelte`'s redirect branch, the diagnostic SQL will still show `blob_version IS NULL` post-redirect — that's the signal that you copy-pasted the login fix into the wrong topology. Bootstrap ticket is the only correct mechanism.

---

## References

- Login fix (already merged): `frontend/src/routes/(public)/login/_lib/TwoFactorVerifyForm.svelte:351–358` + `login-password-bridge.ts` (empty-string guards)
- ADR-022 §Amendment 2026-04-22 (cross-origin unlock ticket)
- ADR-022 §Amendment 2026-04-25 (bootstrap-variant for new-user scenario)
- ADR-054 (mandatory email 2FA)
- ADR-050 (tenant subdomain routing)
- HOW-TO-LOCAL-SUBDOMAINS.md (local cross-origin testing)
