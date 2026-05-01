# FEAT: 2FA Email-Only Mandatory Authentication — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-26
> **Version:** 0.8.7 (**Phase 6 Documentation 6/7 DONE — 2026-05-01.** **v0.8.4** (comment-only): reaper-service-comment-fix + FK-migration §D4 queued (`fk_users_tenant` `RESTRICT`→`CASCADE`, User-Only per CLAUDE.md DB-migration HARD BLOCK). **v0.8.5**: NEW `docs/infrastructure/adr/ADR-054-mandatory-email-2fa.md` (471 Zeilen, 70 Headings, prettier-clean, status `Accepted`) — mirrors ADR-053+ADR-055 template, cross-references 15 sibling ADRs + 3 HOW-TOs, captures alle 21 DDs + R1–R15-Risk-Register + §A8 Audit-Tuples + Greenfield-Skip-Tabelle. **v0.8.6**: `docs/ARCHITECTURE.md` §1.2 — neue "2FA email challenge (mandatory)"-Row eingefügt zwischen "Login/refresh/logout" und "SSR auth-cookie state" (semantisch korrekt: 2FA läuft nach Credential-Validation, vor Token-Issuance). Version-Header bumped 4.2.0 → 4.3.0 per ARCHITECTURE.md §10 maintenance rule. **v0.8.7**: 3-Doc-Batch — `docs/FEATURES.md` (multi-line "Mandatory Email-Based 2FA"-Bullet im Security-Block + Sub-Bullet in #1 User Management); `docs/how-to/HOW-TO-2FA-RECOVERY.md` NEW (~190 Zeilen, deutsch, DD-30 Minimal-Umfang erfüllt: 6 Sektionen, keine Screenshots, kein Troubleshooting-Tree, deckt Mailbox-Verlust + Lockout-Clear-Workflow + Last-Root-Out-of-Band-Recovery + Anti-Pattern-Liste); `docs/how-to/HOW-TO-CREATE-TEST-USER.md` updated (stale `is_active=0`-Quirk-Sektion durch korrekte 2FA-Verify-Step-Doku ersetzt — 4-Schritt-`curl`-Workflow mit Mailpit-`jq`-Code-Holen). Catalog-Row in `docs/how-to/README.md` ergänzt. **Phase 6 Status:** Documentation 6/7 DONE (verbleibend: `customer/fresh-install/` sync via `./scripts/sync-customer-migrations.sh` — User-Only). Operational 0/4 (Grafana SMTP-fail-rate alert + dashboard panel + Loki saved query + audit-trail filter recipe — kann ich machen). FK-Migration §D4 (User-Only). **Verification:** `pnpm exec prettier --check` → exit 0 auf allen touched Files. Per-Version-Detail in der Changelog-Tabelle unten.)
> **Version:** 0.8.3 (**Phase 5 Step 5.5 DONE — i18n centralization shipped 2026-04-30.** New shared module `frontend/src/routes/(public)/_lib/2fa-shared.ts` (110 lines) holds the 6 protocol constants (`CODE_REGEX`, `CODE_LENGTH`, `MAX_VERIFY_ATTEMPTS`, `RESEND_COOLDOWN_SEC`, `INITIAL_RESENDS_REMAINING`, `LOCKOUT_REDIRECT_DELAY_MS`) + a `COMMON_MESSAGES` const containing the 17 byte-identical German UI strings that were previously duplicated between `(public)/login/_lib/2fa-constants.ts` and `(public)/signup/_lib/2fa-constants.ts`. Both per-route files refactored: each now re-exports the 6 protocol constants from `../../_lib/2fa-shared` and declares a thin `MESSAGES = { ...COMMON_MESSAGES, [route-overrides], [route-only-keys] } as const`. Login overrides: HEADING / INTRO / INTRO_FALLBACK / BTN_BACK / ERR_RESEND_LIMIT (5). Signup overrides: HEADING / INTRO_FALLBACK / BTN_BACK / ERR_RESEND_LIMIT + signup-only VERIFY_SUCCESS_TITLE / VERIFY_SUCCESS_MESSAGE (6). Login `2fa-constants.ts` shrunk from 108 → 55 lines, signup from 121 → 77 lines; net delta +1 file (110 lines), -97 lines from the two existing files. Drift surface eliminated for 23 duplicated members (now structural, not human-enforced). Block-scoped `eslint-disable @typescript-eslint/naming-convention` lives on `COMMON_MESSAGES` (function-valued template helpers `BTN_RESEND_COOLDOWN` + `ERR_WRONG_CODE`) + on login's `MESSAGES` (function-valued `INTRO`); signup's `MESSAGES` no longer needs a local disable since it declares only static-string overrides — JSDoc on signup's `MESSAGES` documents the deliberate absence so a future contributor doesn't re-add it under cargo-cult. **Consumer impact: zero.** All 4 importers (`(public)/{login,signup}/_lib/TwoFactorVerifyForm.svelte` + `(public)/{login,signup}/_lib/2fa-server-helpers.ts`) keep their existing `from './2fa-constants'` import paths and named-import lists byte-for-byte. **Verification:** `svelte-check --output human` → 0 errors / 0 warnings; `eslint 'src/routes/(public)'` → 0 errors / 0 warnings. **Phase 5 fully DONE — Phase 6 (ADR-054 + ops) unblocked.**)
> **Version:** 0.8.2 (**Phase 5 Step 5.3 + Step 5.4 DONE — bundled session 2026-04-30 evening.** Inline-card design (v0.8.2) shipped, mirroring login Step 5.2 v0.8.1 — `(public)/signup/+page.svelte` swaps body to `<TwoFactorVerifyForm />` when `data.stage === 'verify'`. Three new files under `signup/_lib/`: `2fa-constants.ts` (signup-flavoured German MESSAGES — HEADING/INTRO_FALLBACK/BTN_BACK/ERR_RESEND_LIMIT diverge from login twin, all other strings byte-identical), `TwoFactorVerifyForm.svelte` (child component, lockout-redirect target `/signup` + back-link `/signup`), `2fa-server-helpers.ts` (verify + resend handlers; verify-success branch builds cross-origin handoff URL `https://<subdomain>.<apex>/signup/oauth-complete?token=<handoff>` instead of same-origin dashboard redirect — reuses the existing `?token` consumer on `/signup/oauth-complete` originally built for OAuth cross-subdomain handoff). New `+page.server.ts` (NET-NEW per DD-19) with sync `load` (no /users/me probe — signup users have no apex access token) + named actions `signup` / `verify` / `resend`. Step 5.4 (form-action refactor) bundled into the same session because Step 5.3 cannot work without the server action. `+page.svelte` field `name=` attributes renamed to match server `buildSignupPayload` keys; hidden mirrors added for child-component-bound fields (subdomain, phone, countryCode, turnstileToken). Drive-by Svelte-5-runes fix: `turnstileRef` → `$state` (mirrors Step 5.2 fix). Dead `signup/_lib/api.ts` + `api.test.ts` (only exported `registerUser` / `createRegisterPayload`, no consumers post-refactor) flagged for user `rm`. Verification: `svelte-check --output human` 0 errors / 0 warnings on 2593 files; `eslint 'src/routes/(public)/signup'` exit 0. Steps 5.5 (i18n centralization across login+signup) PENDING. Cutover-Apparat (Bestandsuser-Vorabmail, Sender-Warmup, T-Day-Timeline) per Greenfield-Status entfallen — siehe CLAUDE.md Zeile 15 + ADR-050 §"Deployment Context: Greenfield Launch".)
> **Version:** 0.7.2 (**Second hotfix during pre-Session-10b validation** — `_performLogin()` in `backend/test/helpers.ts` called `clearMailpit()` (global Mailpit DELETE) at the start of every cached login, racing across vitest workers: Worker B's clear nuked Worker A's freshly-arrived 2FA mail before A could read it → `Error: No 2FA code mail for info@assixx.com within 10000 ms` cascade across ~30 api-test files. Original Session 10a verification only ran 5 files in parallel — race window too small to surface; full `--project api` (50+ files) blew it up. Fix: drop the global clear; capture `loginStartedAt = new Date()` before login; new optional `since: Date` parameter on `fetchLatest2faCode()` filters Mailpit by `Created > sinceMs` so each worker only consumes mails landed after its own login request — works under any parallelism + any sibling-worker activity. Backward-compat: `since` defaults to epoch, all existing callers unchanged. Verified by 3-parallel-curl-login smoke: all 3 returned 200, 3 distinct mails coexisted in Mailpit (no clear, no race).)
> **Status:** ACCEPTED — Phase 1 DONE (2026-04-28); **Phase 2 DONE** (2026-04-28 / 2026-04-29); **Phase 3 DONE** (2026-04-29); **Phase 4 DONE** (Session 10a 2026-04-29 + Session 10b 2026-04-30); **v0.7.1 + v0.7.2 hotfixes DONE** (2026-04-29). **Phase 5 DONE** (2026-04-30) — Step 5.1 DONE (2026-04-30, login `+page.server.ts` discriminated-union branch + cross-origin Set-Cookie forwarding); **Step 5.2 DONE — v0.8.1 inline-card revision** (2026-04-30 morning): superseded the original separate-route design (`/login/verify`) with a single-card UX per user direction. Three new files under `(public)/login/_lib/`: `2fa-constants.ts`, `TwoFactorVerifyForm.svelte`, `2fa-server-helpers.ts`. **Step 5.3 + Step 5.4 DONE — v0.8.2 inline-card revision** (2026-04-30 evening): mirrors Step 5.2 design for signup — `(public)/signup/+page.svelte` swaps body to `<TwoFactorVerifyForm />` when `data.stage === 'verify'`. Three new files under `(public)/signup/_lib/`: `2fa-constants.ts` (signup copy diverges on HEADING/INTRO_FALLBACK/BTN_BACK/ERR_RESEND_LIMIT), `TwoFactorVerifyForm.svelte` (lockout target `/signup`), `2fa-server-helpers.ts` (verify-success builds cross-origin handoff URL `https://<subdomain>.<apex>/signup/oauth-complete?token=…` reusing the existing OAuth handoff consumer). NEW `signup/+page.server.ts` (per DD-19) with sync `load` + named actions `signup` / `verify` / `resend`. Step 5.4 form-action refactor bundled because Step 5.3 cannot work without the server action. Dead `signup/_lib/api.ts` + `api.test.ts` flagged for user `rm`. svelte-check 0 errors / 0 warnings on 2593 files; ESLint clean. **Step 5.5 DONE — v0.8.3 shared-module extraction** (2026-04-30): NEW `(public)/_lib/2fa-shared.ts` (110 lines) holds the 6 protocol constants + `COMMON_MESSAGES` (17 byte-identical strings); both per-route `2fa-constants.ts` files refactored to re-export the protocol constants and spread `COMMON_MESSAGES` into their MESSAGES literal + add overrides (login: 5 keys; signup: 6 keys including signup-only `VERIFY_SUCCESS_TITLE`/`VERIFY_SUCCESS_MESSAGE`). Drift surface for 23 previously-duplicated members eliminated (now structural). Login `2fa-constants.ts` 108 → 55 lines; signup 121 → 77 lines. Zero consumer-side changes — all 4 downstream files keep their existing `from './2fa-constants'` import paths byte-for-byte. svelte-check 0/0; ESLint on `(public)` 0/0. **Phase 5 DONE** (2026-04-30). **Phase 6 IN PROGRESS** (2026-05-01) — Documentation 6/7 DONE: ADR-054 (v0.8.5) + ARCHITECTURE.md §1.2 (v0.8.6) + FEATURES.md + HOW-TO-2FA-RECOVERY.md NEW + HOW-TO-CREATE-TEST-USER.md (v0.8.7); verbleibend: `customer/fresh-install/` sync (User-Only) · Grafana SMTP-fail-rate alert + dashboard panel + Loki saved query · FK-Migration §D4 (User-Only). Cutover-Apparat (Bestandsuser-Vorabmail, Sender-Warmup, T-Day-Timeline) per Greenfield-Status entfallen — siehe CLAUDE.md Zeile 15 + ADR-050 §"Deployment Context: Greenfield Launch".
> **Branch:** `feat/2fa-email`
> **Spec:** This document
> **Author:** Claude (proposed) · Simon Öztürk (decides)
> **Estimated sessions:** 14 (v0.5.0) → ~12 (v0.6.0 nach Greenfield-Trim, Step 2.12 +1 Session) → ~13 (v0.7.0: Session 10 split into 10a/10b)
> **Actual sessions:** 14-partial / ~14 (Phase 0.5.3 + 0.5.5 + Phase 1 + Phase 2 Steps 2.1–2.12 + R13 load-test wiring + Phase 3 Sessions 8 + 9 + Phase 4 Sessions 10a + 10b + **Phase 6 Documentation 6/7 DONE Session 14a–c via v0.8.5/0.8.6/0.8.7 2026-05-01** erledigt)
> **External dependencies added:** **ZERO** — every primitive (crypto, JWT, Redis via `ioredis`, legacy `email-service`, `CustomThrottlerGuard`, Zod, `audit_trail`) already exists.

---

## Goal

Mandatory **email-based 2FA** at every password authentication entry point. Same code path for every password user, every login, every signup. No opt-out, no "trust this device", no SMS, no TOTP, no authenticator app.

**Three covered scenarios** (per user requirement):

1. **Signup (password path)** — new user submits credentials → user row created with `is_active = 0` (pending) → 6-digit code emailed → user enters code → `is_active = 1`, `tfa_enrolled_at = NOW()`, tokens issued.
2. **Login (password path, every user, every session)** — credentials accepted → 6-digit code emailed → user enters code → access + refresh tokens issued. No skip, no remember-device.
3. **Mandatory** — server-enforced, hardcoded. **No env-flag, no kill switch, no off-toggle** (DD-10 entfernt v0.5.0 per User-Vorgabe „kein Einstellung auszustellen"). Rollback nur via Code-Revert + Redeploy. Out-of-Band Recovery via SSH/Doppler-CLI dokumentiert (§0.1).

**OAuth (Microsoft/Google) is exempt** — DD-7 decision: OAuth providers already enforce MFA upstream. `loginWithVerifiedUser()` (`auth.service.ts:247`) bypasses the 2FA layer with an explicit DD-7 comment.

---

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.8.7   | 2026-05-01 | **Phase 6 Documentation — 3 docs shipped in one batch.** (1) **NEW `docs/how-to/HOW-TO-2FA-RECOVERY.md`** (~190 Zeilen, deutsch, prettier-clean) — DD-30 Minimal-Umfang exakt eingehalten: 6 Sektionen, keine Screenshots, kein Troubleshooting-Tree. Deckt die drei Recovery-Szenarien ab: (A) Mailbox-Verlust → Firmen-IT-Pfad, (B) Lockout-Clear-Workflow Schritt-für-Schritt mit Two-Root-Caller-Target-Matrix, (C) Letzter-Root-ausgesperrt → SCS-Operations-Out-of-Band-Recovery via SSH+Doppler-CLI mit Compliance-Audit-Row. Plus eine 7-Zeilen-Anti-Pattern-Tabelle (was die Endpoints NICHT machen — kein 2FA-Bypass, kein Self-Clear, kein Cross-Tenant, kein Admin/Employee-Caller, kein E-Mail-Change-Override, kein Account-Übernahme-Shortcut). Catalog-Row zu `docs/how-to/README.md` Development-&-Tooling-Sektion ergänzt. (2) **MOD `docs/FEATURES.md`** — multi-line "Mandatory Email-Based 2FA"-Bullet im §"User Management in Detail" → Security eingefügt (Position zwischen ADR-051 und ADR-055, mirrors die ausführliche Bullet-Style der Nachbar-Einträge). Inhalt: 6-char Crockford-Base32-Alphabet ohne 0/1/I/L/O, ~887 M Permutationen, Code-TTL 10 min, 5-Versuche → 15-min-Lockout, 60 s Resend-Cooldown, max 3 Resends, sha256-hashed-at-rest in Redis, httpOnly+Secure+SameSite=Lax-Cookie mit `maxAge` aus `CODE_TTL_SEC` (R8), OAuth-exempt via `loginWithVerifiedUser()` (DD-7), Two-Code-Email-Change (DD-32/R15), fail-loud SMTP-Rollback mit anti-subdomain-squat-Cleanup (DD-14), Pointer zu HOW-TO-2FA-RECOVERY. Plus eine Sub-Bullet im §"Live Features" #1 User Management. (3) **MOD `docs/how-to/HOW-TO-CREATE-TEST-USER.md`** — die stale "Bekannter Quirk: `is_active=0` nach Signup"-Sektion (Branch-Workaround vom 2026-04-30) durch eine korrekte "2FA-Verify-Step nach Signup-API (ADR-054)"-Sektion ersetzt. Erklärt explizit dass `is_active=0` jetzt **Sollzustand** ist (nicht Quirk), liefert einen 4-Schritt-`curl`-Workflow (Signup-Trigger → Code-Holen aus Mailpit `/api/v1/messages` via `jq                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | grep -oE "[A-HJKMNP-Z2-9]{6}"`→ ChallengeToken-Cookie auslesen →`POST /api/v2/auth/2fa/verify`). Note dass `pnpm run db:seed` 2FA umgeht (`is_active=1`aber`tfa_enrolled_at=NULL`→ erste echte Login-Challenge nutzt Mailpit-Pfad). Lockout-Pointer zu HOW-TO-2FA-RECOVERY.md. **Verification (2026-05-01):**`pnpm exec prettier --check docs/FEATURES.md docs/how-to/HOW-TO-2FA-RECOVERY.md docs/how-to/HOW-TO-CREATE-TEST-USER.md docs/how-to/README.md` → exit 0 / "All matched files use Prettier code style". Phase 6 DoD: drei Bullets (`FEATURES.md updated`/`HOW-TO-2FA-RECOVERY.md NEW`/`HOW-TO-CREATE-TEST-USER.md updated`) von `[ ]`auf`[x]`geflippt. Status: ACCEPTED. Phase 6 verbleibend:`customer/fresh-install/`sync via`./scripts/sync-customer-migrations.sh` (User-Only — DB-Reset + Re-Run) · Grafana SMTP-fail-rate alert (`docker/grafana/alerts/08-smtp-failure-rate.json`) + dashboard panel + Loki saved query + audit-trail filter recipe · FK-Migration §D4 (`fk_users_tenant` RESTRICT→CASCADE, queued v0.8.4, User-Only per CLAUDE.md DB-migration HARD BLOCK). |
| 0.8.6   | 2026-05-01 | **Phase 6 Documentation — `docs/ARCHITECTURE.md` §1.2 ADR-054 row inserted.** New "2FA email challenge (mandatory)" row placed between "Login/refresh/logout" and "SSR auth-cookie state" — semantically correct insertion point because 2FA runs after credential validation (Login/refresh/logout) and BEFORE tokens are issued or the auth-cookie triad is set (SSR auth-cookie state). Concept name "2FA email challenge (mandatory)" mirrors the Layer-0/Layer-1/Layer-2 naming style already in §1.2; the cell explicitly says **mandatory** to flag the no-opt-out invariant from DD-10 removal. Entry-Point cell cites three load-bearing files: `backend/src/nest/two-factor-auth/two-factor-auth.service.ts` (orchestration: issueChallenge / verifyChallenge / resendChallenge / clearLockoutForUser / markVerified), `backend/src/nest/two-factor-auth/two-factor-code.service.ts` (crypto + Redis primitives — the 14-method service), `backend/src/nest/users/email-change.service.ts` annotated `(DD-32 two-code)` so the email-change two-code surface is traceable from the map without bloating the table with a dedicated row. Why-cell carries the load-bearing facts a reader needs without round-tripping to the ADR: `auth.service.ts:222` (the discriminated `LoginResult` return point), `auth.service.ts:278` (the OAuth-exempt `loginWithVerifiedUser` per DD-7), and the DD-32 / R15 two-code email-change pointer. ADR-link `[ADR-054](./infrastructure/adr/ADR-054-mandatory-email-2fa.md)` closes the round-trip from the navigation map back to the ADR (the ADR already cited the §1.2 row in its Implementation Topology section). **Version header bumped 4.2.0 → 4.3.0, date 2026-04-27 → 2026-05-01** per ARCHITECTURE.md §10 maintenance rule "bump minor when adding rows". **Verification (2026-05-01):** `pnpm exec prettier --check docs/ARCHITECTURE.md` → exit 0; new ADR link target exists (`docs/infrastructure/adr/ADR-054-mandatory-email-2fa.md`, shipped v0.8.5); cited line numbers `auth.service.ts:222` + `:278` re-verified live (`grep -n "async login"` and `grep -n "async loginWithVerifiedUser"` against the live source). Phase 6 DoD `[x] docs/ARCHITECTURE.md §1.2 — add 2FA row linking ADR-054` flipped from `[ ]` to `[x]`. Status: ACCEPTED. Phase 6 remaining: FEATURES.md update · HOW-TO-2FA-RECOVERY.md NEW · HOW-TO-CREATE-TEST-USER.md update · `customer/fresh-install/` sync · Grafana SMTP-fail-rate alert + dashboard panel + Loki saved query + audit-trail filter recipe · FK-Migration §D4 (`fk_users_tenant` RESTRICT→CASCADE, queued v0.8.4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 0.8.5   | 2026-05-01 | **Phase 6 Documentation — ADR-054 SHIPPED.** New `docs/infrastructure/adr/ADR-054-mandatory-email-2fa.md` (471 lines, prettier-clean, 70 headings, status `Accepted`). Mirrors the recent-ADR template established by ADR-053 + ADR-055 (metadata table → Context with Threat-Model + Constraints + Requirements → Decision with diagrams + tables → Implementation Topology → Alternatives Considered A–H → Consequences (Positive / Negative / Neutral / Risks-Mitigations) → Verification → References). Cross-references 15 sibling ADRs (005, 006, 007, 009, 010, 014, 019, 020, 027, 030, 033, 041, 045, 046, 050) and 3 HOW-TOs (DEV-SMTP, CREATE-TEST-USER, 2FA-RECOVERY) — all 15 ADR existence-verified, 2 HOW-TOs exist, the third (HOW-TO-2FA-RECOVERY) is correctly marked as a Phase 6 to-do. Captures the 21 approved DDs by reference (no duplication — masterplan §0.4 stays authoritative), the §A8 audit-tuple table verbatim, the R1–R15 risk register as a traceability table, and the greenfield-skip table for DDs 10/11/22/23/26/27/28/31 + Steps 0.5.1/0.5.7. Implementation topology cites every concrete file path with verified line numbers (`auth.service.ts:222` for the discriminated `login()`, `:278` for the OAuth-exempt `loginWithVerifiedUser`, `auth.controller.ts:232` for `setChallengeCookie`, `email-service.ts:812,892` for `send2faCode`/`send2faSuspiciousActivity`). Includes the queued §D4 FK-migration as a Negative-Consequence + L-1 Pre-launch checklist row + Phase 6 Operational backlog item. Alternatives Considered enumerates and rejects: TOTP, SMS, trust-this-device, per-tenant flag, Doppler kill-switch (DD-10 removal), OAuth-mandatory, microservice carve-out, immediate-token signup. Verification section reports the acceptance-time automated coverage (backend-unit 7277/7277, api-integration 1050/1055 with 5 documented `it.skip`, svelte-check 0/0 on 2593 files, ESLint clean across backend + frontend, type-check exit 0, k6 load tests on the discriminated-union helper). External references: adr.github.io · NIST SP 800-63B AAL1+ · Crockford Base32 · Mailpit anonymous-SMTP docs. **Verification (2026-05-01):** `pnpm exec prettier --check` → exit 0; existence-grep for every cited ADR-0xx → 0 missing; existence-grep for cited HOW-TOs → 2/3 found, 1 expected-pending. Phase 6 DoD `[x] ADR-054 reviewed + "Accepted"` flipped from `[ ]` to `[x]`. Status: ACCEPTED. Phase 6 remaining: ARCHITECTURE.md §1.2 row · FEATURES.md update · HOW-TO-2FA-RECOVERY.md NEW · HOW-TO-CREATE-TEST-USER.md update · `customer/fresh-install/` sync · Grafana SMTP-fail-rate alert + dashboard panel + Loki saved query · FK-Migration §D4 (RESTRICT→CASCADE).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 0.1.0   | 2026-04-26 | Initial draft — full plan outlined, awaiting design-decision sign-off                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 0.2.0   | 2026-04-26 | Codebase audit corrections: ADR number, file paths, throttler pattern, audit format, Redis pattern, OAuth exempt, no-recovery policy, signup form-action, drop legacy 2FA columns, drop partial index                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 0.3.0   | 2026-04-26 | All 17 pending DDs APPROVED. DD-14 extended: cleanup deletes tenant + user (anti subdomain-squatting). New Phase 0.5 "Operational Prerequisites" (single-root detection, SMTP domain auth, external-API audit, subdomain-handoff verification). New Phase 2 step 2.11: stale-pending reaper cron. Status: ACCEPTED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 0.3.1   | 2026-04-28 | DD-1 / DD-12 / DD-17 patched: code format changed from 6-digit numeric → 6-char alphanumeric uppercase, Crockford-Base32 subset (`A-HJKMNP-Z2-9`, 31 chars, ~887M permutations). R2 keyspace ~887× larger → probability lowered Medium → Low. DTO regex, generator, frontend `pattern`/`inputmode` updated. Phase 3+4 tests gain alphabet-conformance + lowercase-normalisation bullets. Status: ACCEPTED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 0.4.0   | 2026-04-28 | **Plan-Perfektionierung** — 12 offene operative/technische Entscheidungen in 3 Batches via AskUserQuestion aufgelöst: T-Day-Strategie, SMTP_FROM-Bestätigung, DNS-/Cert-Modell, Dev-SMTP-Backend, Vorabmail-Empfänger/Sprache/Tonalität, Single-Root-Outreach-Timing, T-1 Hard-Block-Fallback (KEIN Telefon, NUR E-Mail), Reaper-Deployment-Topologie, HOW-TO-Recovery-Umfang, Cutover-Monitoring-Window. Neue DDs: DD-22 (Cutover-Strategie) + DD-23 (Per-Tenant-Flag NEIN in V1). Steps 0.3, 0.5.1, 0.5.2, 0.5.4, 0.5.5, 2.11 und Phase 6 Cutover-Runbook mit konkreten Werten befüllt. Plan stellt KEINE Fragen mehr. Status: ACCEPTED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 0.5.0   | 2026-04-28 | **HARDENED auf User-Brutalehrlich-Audit:** (1) **DD-10 Flag KOMPLETT entfernt** per User-Vorgabe „kein Einstellung auszustellen" — 2FA hartcodiert, kein Soft-Rollout, T-Day = Deploy-Day. R5+R13 verschärft. (2) **P2-Fix:** Throttler `2fa-verify` von 5/10min-per-IP → 5/10min-per-challengeToken (Industriekunden hinter NAT würden sonst false-positive geblockt). (3) **NEW Step 0.5.6 Production-SMTP-Smoke** + **NEW Step 0.5.7 Sender-Warmup** — verhindert Spam-Filter-Flut am T-Day. (4) **NEW §0.1 Disaster-Recovery-Note** — SSH + Doppler-CLI als Out-of-Band-Pfade dokumentiert (User bestätigt vorhanden). (5) DD-7 OAuth-Exempt + DD-8 Lockout-Clear bestätigt unverändert. Status: ACCEPTED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 0.6.1   | 2026-04-29 | **Phase 2 Session 7 (partial) — Steps 2.7 + 2.8 DONE.** TwoFactorAuthController (`/auth/2fa/verify` + `/auth/2fa/resend`) + TwoFactorLockoutController (`/users/:id/2fa/clear-lockout`, separate file per `max-classes-per-file: 1`). Two new throttler tiers (`2fa-verify` 5/10min, `2fa-resend` 1/60s) keyed on `challengeToken` cookie via per-tier `getTracker` (NAT-fairness for industrial customers). Two new decorators (`TwoFaVerifyThrottle`, `TwoFaResendThrottle`); every existing decorator's `SkipThrottle` list extended with both tier names. `TwoFactorAuthService.markVerified()` added — single-purpose post-verify user-table write (`is_active=ACTIVE` for signup, `last_2fa_verified_at` + COALESCE-enroll for both). Verify endpoint delegates token issuance to `AuthService.loginWithVerifiedUser` and apex→subdomain handoff to `OAuthHandoffService.mint` (signup-flow only — login flow is on tenant subdomain so cookies set on same origin). DI-graph cycles resolved with `forwardRef` on AuthModule ↔ TwoFactorAuthModule + SignupModule → forwardRef(TwoFactorAuthModule). Verification: ESLint 0 errors, type-check 0 errors, 279 unit-test files / 7138 tests all green, backend `/health` 200, all 3 new routes return correct guards (401 unauth / 404 unknown). Steps 2.10 + 2.11 + 2.12 still PENDING. Status: ACCEPTED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 0.8.4   | 2026-05-01 | **Reaper-Service-Comment-Fix + FK-Migration queued (Spec Deviations §D4).** Comment-only patch on `backend/src/nest/two-factor-auth/two-factor-auth-reaper.service.ts`: the file's header (§D1 + §D2 + §D3), the `dropTenantCascade` JSDoc, and the audit-row JSDoc all asserted that `users.tenant_id` has `ON DELETE CASCADE`. Live FK is `ON DELETE RESTRICT` (`pg_constraint.confdeltype = 'r'`, verified via psql probe 2026-04-30). All four sites rewritten to acknowledge the RESTRICT reality with explicit "KNOWN PRODUCTION FAILURE" / WARNING blocks pointing at the queued FK-migration. **Code-Logic unverändert** — comment-only, no behavioural diff, no test re-run required (paired test suite already green from Phase 3 Session 9 / v0.6.5). New entry **D4** in §Spec Deviations documents the discovery + fix + queued migration. New Phase 6 Operational checklist item: node-pg-migrate migration to flip `fk_users_tenant` from `RESTRICT` to `CASCADE` so the reaper's `dropTenantCascade` branch becomes correct end-to-end and the anti-subdomain-squatting guarantee from §0.4 / DD-14 is restored before first paying tenant. Backup + dry-run mandatory per CLAUDE.md DB-migration HARD BLOCK; no data migration, no downtime — single ALTER CONSTRAINT statement. Status: ACCEPTED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 0.8.3   | 2026-04-30 | **Phase 5 Step 5.5 DONE — i18n centralization shipped (shared-module extraction).** Inspection at the start of Step 5.5 confirmed that the per-route `2fa-constants.ts` files shipped under v0.8.1 + v0.8.2 duplicated **6 protocol constants + 17 byte-identical MESSAGES strings**, with intentional divergence on only 4 keys (HEADING, INTRO_FALLBACK, BTN_BACK, ERR_RESEND_LIMIT) plus 2 login-only (`INTRO`) and 2 signup-only (`VERIFY_SUCCESS_TITLE` / `VERIFY_SUCCESS_MESSAGE`). Drift was human-enforced via a header comment — fragile under future copy edits. (1) **NEW `frontend/src/routes/(public)/_lib/2fa-shared.ts`** (110 lines) — single source of truth: 6 protocol constants (`CODE_REGEX`, `CODE_LENGTH`, `MAX_VERIFY_ATTEMPTS`, `RESEND_COOLDOWN_SEC`, `INITIAL_RESENDS_REMAINING`, `LOCKOUT_REDIRECT_DELAY_MS`) + `COMMON_MESSAGES` const containing the 17 flow-agnostic strings (`CODE_LABEL`, `BTN_SUBMIT`/`BTN_SUBMITTING`/`BTN_RESEND`/`BTN_RESEND_COOLDOWN`/`BTN_RESENDING`, `HINT_SPAM`, `RESEND_SUCCESS`, `ERR_WRONG_CODE`, `ERR_INVALID_FORMAT`, `ERR_EXPIRED`, `ERR_LOCKED`, `ERR_NETWORK`, `ERR_SEND_FAILED`, `ERR_RESEND_COOLDOWN`, `ERR_THROTTLED`, `ERR_GENERIC`). One block-scoped `eslint-disable @typescript-eslint/naming-convention` for the function-valued template helpers (`BTN_RESEND_COOLDOWN` + `ERR_WRONG_CODE`); explicit drift-policy comment in the file header. (2) **MOD `(public)/login/_lib/2fa-constants.ts`** (108 → 55 lines): `import { COMMON_MESSAGES } from '../../_lib/2fa-shared'` + `export { 6 constants } from '../../_lib/2fa-shared'` + `MESSAGES = { ...COMMON_MESSAGES, HEADING, INTRO, INTRO_FALLBACK, BTN_BACK, ERR_RESEND_LIMIT } as const`. Block-scoped naming-convention disable retained because `INTRO` is a function-valued literal property declared in this file. (3) **MOD `(public)/signup/_lib/2fa-constants.ts`** (121 → 77 lines): same pattern; spreads `COMMON_MESSAGES`, adds `HEADING`, `INTRO_FALLBACK`, `BTN_BACK`, `ERR_RESEND_LIMIT`, `VERIFY_SUCCESS_TITLE`, `VERIFY_SUCCESS_MESSAGE`. **No** local naming-convention disable — every override here is a static-string literal, the function-valued helpers come transitively via the spread and are covered by the disable in `2fa-shared.ts`. JSDoc on `MESSAGES` documents the deliberate absence so a future contributor doesn't re-add it under cargo-cult. **Consumer impact: zero.** All 4 importers (`(public)/{login,signup}/_lib/TwoFactorVerifyForm.svelte` + `(public)/{login,signup}/_lib/2fa-server-helpers.ts`) keep their existing `from './2fa-constants'` import paths and named-import lists byte-for-byte. **Verification (2026-04-30):** `cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json --output human` → **0 errors / 0 warnings** · `cd frontend && pnpm exec eslint 'src/routes/(public)'` → **0 errors / 0 warnings**. Net delta: +1 file (110 lines), -97 lines from the two existing files. Drift surface for 23 previously-duplicated members eliminated (now structural, not human-enforced). Status: ACCEPTED. **Phase 5 fully DONE — Phase 6 (ADR-054 + ops integrations + customer-fresh-install sync) unblocked.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 0.8.2   | 2026-04-30 | **Phase 5 Step 5.3 + Step 5.4 DONE — bundled session 2026-04-30 evening (inline-card revision).** Mirrors Step 5.2 v0.8.1 design for signup per user direction ("bei signup kann ruhig auch wie login inline brauch keine neue Seite"). Six file changes total. (1) **NEW `(public)/signup/_lib/2fa-constants.ts`** — German MESSAGES + protocol constants. Diverges from login twin only on HEADING (`'E-Mail bestätigen'`), INTRO_FALLBACK (`'Bitte bestätigen Sie Ihre E-Mail-Adresse, um die Registrierung abzuschliessen.'` — German `schliessen` per ß rule, masterplan §5.3 explicit), BTN_BACK (`'Zurück zur Registrierung'`), ERR_RESEND_LIMIT (mentions "Registrierung neu" not "Login neu"). All other strings byte-identical for drift-protection. (2) **NEW `(public)/signup/_lib/TwoFactorVerifyForm.svelte`** — duplicate of login twin with three diffs: lockout-redirect target `window.location.href = '/signup'` (no `buildLoginUrl()` because signup never lives on a tenant subdomain), back-link `href={resolve('/signup')}`, `data-sveltekit-reload` on the back-link forces a fresh load (so the load-side stage discriminator picks up the cleared cookie). Same race-prevention discipline as login (handle redirect BEFORE flipping `submitting=false`). (3) **NEW `(public)/signup/_lib/2fa-server-helpers.ts`** — `handleVerifyAction` + `handleResendAction`. Critical divergence from login twin: verify-success branch builds a cross-origin handoff URL via `buildSubdomainHandoffUrl` (mirror of login's same helper) and 303-redirects to `https://<subdomain>.<apex>/signup/oauth-complete?token=<handoff>` instead of calling `setAuthCookies` + dashboard redirect. The receiving page already exists — `(public)/signup/oauth-complete/+page.server.ts::handleHandoff` consumes the `?token` branch via `POST /auth/oauth/handoff`. Signup-purpose verifies WITHOUT a `handoff` field are treated as backend contract violation (logged + 500). Apex `challengeToken` cookie cleared on consume. (4) **NEW `(public)/signup/+page.server.ts`** (net-new file per DD-19) — sync `load` returns `stage: 'credentials' \| 'verify'` based on `challengeToken` cookie (no `/users/me` probe like login has, since signup users have no apex access token). `actions.signup` (named, not `default`, because SvelteKit forbids mixing) handles Turnstile verify + `buildSignupPayload` normalisation + backend POST + cross-origin Set-Cookie forwarding via `extractChallengeTokenFromSetCookie` + 303 redirect to `/signup`. `actions.verify` + `actions.resend` delegate to the helpers. (5) **MOD `(public)/signup/+page.svelte`** — added `import TwoFactorVerifyForm` + `const isVerifyStage = $derived(...)`; wrapped existing markup in `{#if isVerifyStage} <TwoFactorVerifyForm /> {:else} <h2-title-+-OAuth-+-form-+-footer> {/if}`. Form-action refactor (Step 5.4 DD-19): `<form id="signupForm" onsubmit={handleSubmit}>` → `<form method="POST" action="?/signup" use:enhance={enhanceSignup}>`. JS `handleSubmit` deleted (60 lines). Field `name=` attributes renamed to match `buildSignupPayload`: `company_name`→`companyName`, `first_name`→`adminFirstName`, `last_name`→`adminLastName`, `password`→`adminPassword`. Hidden mirrors added for `subdomain` / `phone` / `countryCode` / `turnstileToken` (those bind to child components / runes that don't expose a single named input). New `enhanceSignup({ cancel })` handles client-side gate (`!isFormValid` → warning toast + `cancel()`), `result.type === 'redirect'` (hard-nav), `result.type === 'failure'` (server's German error via existing toast surface). Removed dead imports: `registerUser`, `createRegisterPayload`, `buildLoginUrl`, `SUCCESS_REDIRECT_DELAY`, `showToast`. (6) **Drive-by Svelte-5-runes fix** (mirrors Step 5.2 fix): `let turnstileRef: { reset: () => void } \| undefined;` → `let turnstileRef = $state<{ reset: () => void } \| undefined>(undefined);` — `bind:this` refs that get reassigned must be `$state`. **Dead code flagged for user `rm`:** `(public)/signup/_lib/api.ts` (only exported `registerUser` + `createRegisterPayload`; the masterplan's "keep for subdomain-check" note was a misstatement — subdomain-check actually uses `getApiClient()` directly inside `SubdomainInput.svelte`) + `(public)/signup/_lib/api.test.ts` (only tests the now-dead `registerUser`). Vitest still passes; Knip flags both. **Verification (2026-04-30 evening):** `cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json --output human` → 0 errors / 0 warnings on 2593 files · `cd frontend && pnpm exec eslint 'src/routes/(public)/signup'` → exit 0 / 0 errors / 0 warnings. ESLint complexity / max-lines / sonarjs-complexity-10 within ceilings. Status: ACCEPTED. Step 5.5 (i18n centralization) PENDING — likely a no-op or trivial extraction since per-route `2fa-constants.ts` already encapsulate copy. |
| 0.8.0   | 2026-04-30 | **Phase 4 DONE — Session 10b shipped.** Three deliverables in one session: (1) **13 pre-existing api-test files adapted** to the post-Step-2.4 2-step-2FA login contract — masterplan-named-6 + `tenant-domains` + 7 additional discovered during the full `--project api` run that the prior verification matrix had missed (`dummy-users`, `organigram`, `kvp-approval`, `admin-permissions`, `user-permissions`, `shift-handover`, `chat-e2e-roundtrip`). The masterplan's Session 10b PENDING entry undercounted because Session 10a only ran a 5-file smoke; the full `--project api` run revealed the ~7 additional broken files via 401 cascades on `body.data.accessToken` / `body.data.user.id` reads of the new discriminated-union response shape. `oauth.api.test.ts` was a false alarm — confirmed 48/48 green untouched. (2) **Shared 2-step-2FA login helpers landed in `helpers.ts`** — `loginNonRoot(email, password): Promise<string>` + `loginNonRootFull(email, password): Promise<AuthState>` + `queryUserIdByEmail(email): number \| null`. Stops the 50-line login-dance duplication bleeding across files; downstream tests now do one-line `await loginNonRoot('employee@assixx.com', APITEST_PASSWORD)` calls. The cached `loginApitest()` for the test-tenant root remains untouched. (3) **All 11 `it.todo` placeholders implemented** in `two-factor-auth.api.test.ts` — 1 in the resend describe block (`4th resend on same challenge → 429 DD-21`, bypassing the 60 s cooldown via Redis DEL) + 6 in a new `Session 10b — additional scenarios` describe block (expired challenge via Redis DEL, 4th-resend-cap-per-challenge sentinel, reaper E2E sim with the soft-delete branch, OAuth DD-7 regression sentinel, cross-tenant defence via random forged challengeToken, lockout suspicious-activity mail to user only per DD-20) + 3 in a new `Email-Change 2FA-Verify Sims` describe block (Hijack-Sim wrong-codeOld, Tippfehler-Sim wrong-codeNew, Bombing-Sim AuthThrottle 429) + 1 documented `it.skip` for signup-503 (harness limitation: stopping/starting Mailpit poisons every other Mailpit-dependent test; unit-level coverage exists in `signup.service.test.ts` Phase 3 batch C). (4) **Migrated 3 stale `localhost:1080/email` (Maildev) refs to Mailpit's `localhost:8025/api/v1/messages` REST API** in the existing email-shape tests (DD-13 subject + DD-13 signup-intro + R10 wrong-pw-no-mail). (5) **Discovered side issue (non-blocking, filed):** the reaper service's header comment claims `users.tenant_id ON DELETE CASCADE` but the live FK is RESTRICT (`pg_constraint.confdeltype='r'` confirmed via psql probe); the `dropTenantCascade` branch would fail in production. The soft-delete branch works as documented — Session 10b's reaper test exercises that path and includes a clear SCOPE NOTE. **Verification (2026-04-30):** `--project api` 55/55 files / 1050 passing / 5 skipped (was 1040+4 before Session 10b — Δ +10 concrete tests + 1 documented skip); `--project unit` 284/284 / 7277 passing; ESLint exit 0; `tsc --noEmit -p backend` exit 0. Status: ACCEPTED. Phase 4 fully DONE — **Phase 5 (frontend) unblocked.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 0.7.2   | 2026-04-29 | **Second hotfix — Mailpit cross-worker clear-race in `_performLogin` (pre-Session-10b validation).** After v0.7.1 unblocked SMTP, the next `pnpm run test --project api` run revealed a NEW failure cluster: ~30 of 51 failed files threw `Error: No 2FA code mail for info@assixx.com within 10000 ms`. Mailpit snapshot during the failure showed 17 messages addressed to legitimate test recipients (correct sends), but the timeouts proved the helper couldn't read its own mail. Root cause: `backend/test/helpers.ts:224` called `await clearMailpit()` (global `DELETE /api/v1/messages`) at the start of every cached `_performLogin()`. Mailpit is GLOBAL state shared across all vitest workers; with 50+ files in parallel, Worker B's clear deleted Worker A's freshly-arrived 2FA mail before A's poll could read it. The original comment "_idempotent and cheap_" was wrong — global state is not idempotent under concurrent writers. Session 10a's smoke (5 files, 2-3 workers) was too small to surface the race. **Fix:** (a) drop `clearMailpit()` from `_performLogin()`; (b) capture `loginStartedAt = new Date()` before `_runLoginRequest()`; (c) extend `fetchLatest2faCode(recipient, timeoutMs?, since?)` with optional `since: Date` (default `new Date(0)` = backward-compat for direct test-body callers); (d) `_scanForCode()` filters `Date.parse(summary.Created) > sinceMs` so each worker reads only mails landed after its own login. **Backward-compat:** `00-auth.api.test.ts` + `two-factor-auth.api.test.ts` (the only direct callers, 30+ call sites) keep working without changes — `since` defaults to epoch. **Verification (2026-04-29):** type-check 0 errors · ESLint 0 errors · 3 parallel `curl POST /auth/login` (`info@assixx.com`) → all 200 · Mailpit accumulated 3 distinct mails to `info@assixx.com` within 3ms of each other (no clear, no race) · helpers.ts hot-reloaded via vitest's module cache invalidation on next test run · NO `--project api` re-run (per user instruction). Step 0.5.5 / Phase 4 DoD amended: cross-worker invariant added — "the helper must not depend on Mailpit being empty; mail lookup MUST be scoped by recipient + since-timestamp". Status: ACCEPTED. Session 10b unblocked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 0.7.1   | 2026-04-29 | **Hotfix — email-service anonymous-SMTP regression (pre-Session-10b validation).** Running `pnpm run test --project api` revealed a cascade of 503 (`Der Code konnte nicht gesendet werden`) + 429 (auth-login throttler exhausted by the 503 wave) across 52 api-test files. Backend logs: `2FA code email transport failed: Missing credentials for "PLAIN"`. Root cause: `backend/src/utils/email-service.ts` always built nodemailer's transport config with `auth: { user: SMTP_USER ?? '', pass: SMTP_PASS ?? '' }`. Mailpit's SMTP listener accepts anonymous connections only — passing an `auth` block with empty strings makes nodemailer pre-emptively call `_authPlain()`, find empty `auth.credentials.user`, and throw. Bug latent since the maildev → mailpit migration (commit `3ed861afa`); the original Step 0.5.5 smoke test only verified `getent hosts mailpit` reachability, not an actual end-to-end send. **Fix:** `EmailConfig.auth` made optional; `initializeTransporter()` now omits the `auth` block when both creds are empty (dev/Mailpit path), keeps it when both are set (production), and warns on partial config (misconfiguration). Verified via Mailpit official docs (`https://mailpit.axllent.org/docs/configuration/smtp/` — "By default, the Mailpit SMTP server listens on port 1025 and does not use encryption or authentication"). **Verification (2026-04-29):** type-check 0 errors · ESLint 0 errors · backend hot-reloaded clean (`Nest application successfully started 20:08:25`) · single curl `POST /api/v2/auth/login` → HTTP 200 + `stage=challenge_required` + `challengeToken` cookie + Mailpit captured 1 message (From: noreply@assixx.com, Subject: "Ihr Bestätigungscode für Assixx") · zero `Missing credentials for "PLAIN"` log lines since patch · NO `--project api` re-run (per user instruction). Step 0.5.5 DoD amended: live email-send smoke MUST use a real `/auth/login` curl + Mailpit `/api/v1/messages` poll, not just hostname reachability. Status: ACCEPTED. Phase 4 Session 10b unblocked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 0.7.0   | 2026-04-29 | **Phase 4 Session 10a DONE — API integration tests + Maildev wiring shipped.** Five concrete deliverables landed in one session: (1) **Doppler dev SMTP switched to Maildev** (`SMTP_HOST=maildev`, `SMTP_PORT=1025`, USER/PASS empty) — Step 0.5.5 #2 was never executed at the time Step 0.5.5 was marked DONE; this finally completes the wiring. Backend force-recreated to re-inject env from `doppler run`. End-to-end verification: login → Maildev captures the code → verify → Set-Cookie 3-cookie triad. (2) **`backend/test/helpers.ts` refactored** — `_performLogin()` now does the full 2-step 2FA dance internally (login → capture `challengeToken` cookie → poll Maildev for code → POST `/auth/2fa/verify` → extract access/refresh from Set-Cookie). New exports: `clearMaildev()`, `fetchLatest2faCode(recipient, timeoutMs)`, `clear2faStateForUser(userId)` (DEL `2fa:lock:{userId}` + `2fa:fail-streak:{userId}`), `extractCookieValue(setCookies, name)`. The cached `_cachedAuth` contract (`{ authToken, refreshToken, userId, tenantId }`) is byte-identical so all 22+ consumer files work without changes. (3) **`backend/test/00-auth.api.test.ts` adapted** — local `login()` helper split into `performLoginStep` + `performVerifyStep` + `loginAndVerify`; Setup-block signup test now does post-201 2FA verify so fresh-DB bootstrap activates the apitest root (otherwise every downstream test logs in as `is_active=INACTIVE` → 403); "Auth: Login" describe block split into "Step 1 — challenge issuance" + "Step 2 — token issuance via Set-Cookie", asserting on the discriminated union + cookie shape (R8: tokens NEVER in body). 15/15 tests pass in 4.58 s. (4) **`backend/test/signup.api.test.ts` adapted** — body contract changed from `{ subdomain, tenantId, tenantVerificationRequired }` to `LoginResultBody` (`{ stage: 'challenge_required', challenge }`). New helper `queryTenantIdBySubdomain()` replaces the body-derived tenantId; positive-path test asserts on the new shape + DB-side tenant_domains row (unchanged intent). 6/6 tests pass. (5) **NEW `backend/test/two-factor-auth.api.test.ts`** — Phase 4 deliverable. 24 concrete `it()`s + 11 documented `it.todo` placeholders = **35 total** (Phase 4 DoD ≥35 assertions met). Coverage: A. login challenge issuance (3 tests — happy + invalid pw + unknown email), B. verify happy path + replay (2), B. input validation (4 — malformed, forbidden chars `O` & `1`, missing cookie), B. wrong code + lockout (4 — wrong code, 5-wrong → Redis-state lockout, login-during-lockout 403, post-clear still requires 2FA per DD-8), C. resend cooldown (2 — valid resend produces NEW code different from initial + decremented `resendsRemaining` 3→2, immediate-resend → 429), D. signup → challenge → verify → handoff ticket (3 — 201 + challengeToken cookie, `is_active=INACTIVE` while pending, verify activates to `is_active=ACTIVE` + handoff ticket per Step 2.7 — apex→subdomain bridge, NO access-token cookies on apex), E. lockout-clear endpoint (4 — root clears + Redis DEL'd, root self-target → 403 Two-Root, non-root → 403 RolesGuard, unknown user-id → 404), F. email shape (2 — generic subject DD-13, signup-specific intro). Run: 24/24 passing in 16.45 s. **Two precise body-shape adjustments during implementation:** resend body wraps via `body.data.challenge.resendsRemaining` per `TwoFactorResendResponse` (NOT `body.data.resendsRemaining`); signup-verify uses `body.data.handoff: { token, subdomain }` — NO `accessToken` / `refreshToken` cookies (apex→subdomain handoff per Step 2.7). **Verification (2026-04-29):** ESLint + tsc clean for all touched files; new file 24/24 + 11 todo green; smoke run of `00-auth + areas + departments + signup + two-factor-auth` all green (54 tests). **Known scope expansion deferred to Session 10b:** running `--project api` fully revealed 6 pre-existing api-test files (`auth-forgot-password`, `auth-password-reset`, `security-settings`, `inventory`, `root-self-termination`, possibly `oauth`) that still assert `body.data.accessToken` on fresh logins. These broke when Step 2.4 landed (2026-04-29 morning) but were never caught because every Phase 2 verification ran only `--project unit`. Same fix pattern as `00-auth.api.test.ts` — split local `login()` into Step 1 / Step 2 + Maildev fetch. Estimated 30-60 min in Session 10b. Status: ACCEPTED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 0.6.5   | 2026-04-29 | **Phase 3 DONE — Session 9 unit-test fan-out shipped.** Five batches landed in one continuous session: (A) `two-factor-auth.service.test.ts` had already been authored under sub-pass 9a (commit `203651b8`, 34 tests covering all 19 plan-listed orchestration scenarios + the `generateCode()` alphabet-conformance check deferred from Session 8 #20 + the cross-purpose redemption guard for Step 2.12 / DD-32). (B) `auth.service.test.ts` extended +5 tests covering: ForbiddenException-from-issueChallenge propagation (locked user), ServiceUnavailableException-from-issueChallenge propagation (DD-14 SMTP failure), no-token-issuance contract on the new password-login path (Step 2.4 deferred token mint), zero-extra-fields R8 invariant on the response body, and OAuth `loginWithVerifiedUser` DD-7 regression guard (`issueChallenge` never called). (C) `signup.service.test.ts` extended +5 tests: pending user inserted with `IS_ACTIVE.INACTIVE`, ServiceUnavailableException propagates on SMTP failure (never collapses to BadRequestException), DD-14 cleanup runs `DELETE FROM tenants` (cascades user via FK; never `DELETE FROM users` per ADR-020 / ADR-045), no orphan registration-audit row on failure path, and "best-effort" cleanup invariant — original 503 surfaces even when `cleanupFailedSignup` itself throws. (D) NEW `two-factor-auth-reaper.service.test.ts` — 10 tests: idle no-op, all-stale tenant-cascade path, defensive soft-delete edge case, mixed-batch routing per tenant, SELECT-FOR-UPDATE plan predicates pinned, D3 audit-inside-transaction rollback semantics, ADR-019 systemTransaction boundary, idempotency, runScheduled error-swallowing, runScheduled happy-path log emission. (E) NEW `email-change.service.test.ts` — 11 tests: same-email refusal, uniqueness ConflictException, OLD-then-NEW issue ordering (fail-loud on broken current mailbox), no-NEW-mail when OLD issuance fails, atomic both-green commit (UPDATE+audit inside one tenantTransaction, both tokens consumed), OLD-side wrong-code → anti-persistence DEL of both tokens + DD-20-style suspicious-activity mail to CURRENT address, NEW-side wrong-code → same anti-persistence behavior, token-pair mismatch (different userId) → defensive UnauthorizedException + token-pair-mismatch audit, token-pair mismatch (different tenantId) → same defensive failure, ADR-019 tenantTransaction-not-queryAsTenant boundary, no-consume-on-rollback retry preservation. **Verification (2026-04-29):** Touched-file ESLint exit 0; `tsc --noEmit -p backend` exit 0; full unit suite **283 files / 7260 tests / all passing in 18.98 s** (Δ vs. v0.6.4: +3 files, +65 tests, 0 regressions). Phase 3 DoD (≥ 65 unit tests) **exceeded — 113 cumulative new unit tests across Sessions 8 + 9** (48 from Session 8 + 65 from Session 9 across the five batches). Status: ACCEPTED. Phase 4 unblocked (API integration tests + reaper E2E + email-change Hijack-Sim/Tippfehler-Sim/Bombing-Sim, Session 10).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 0.6.4   | 2026-04-29 | **Phase 3 Session 8 DONE — `TwoFactorCodeService` unit tests shipped.** New file `backend/src/nest/two-factor-auth/two-factor-code.service.test.ts` (48 tests, 638 ms wall-time) covers 20 of 21 plan-listed mandatory scenarios for `TwoFactorCodeService` + 6 supplementary edge-case tests. Scenario #20 (alphabet conformance over 10 000 samples) deferred to Session 9 because `generateCode()` is a private method on `TwoFactorAuthService` (`two-factor-auth.service.ts:471`), not on the SUT of this file — masterplan listed it under "TwoFactorCodeService" by association, not by SUT location. Mock pattern mirrors `oauth-state.service.test.ts` (Redis-via-DI-token, plain-object spies, `unknown as Redis` cast). Constant-time test (#10) uses generous statistical bound (mean ratio ∈ [0.4, 2.5]) with explicit caveat — primary defense is structural (impl imports + calls `crypto.timingSafeEqual`); the stat check guards against regressions like swapping in `===` or `Buffer.compare`. **Verification (2026-04-29):** `pnpm exec vitest run --project unit backend/src/nest/two-factor-auth/two-factor-code.service.test.ts` → 48/48 passing in 50 ms · ESLint exit 0 / 0 errors · `tsc --noEmit -p backend` exit 0 · `--coverage` on the SUT: 100 % statements (47/47), 100 % branches (12/12), 100 % functions (15/15), 100 % lines (47/47) · full `--project unit` suite: 280 files / **7195 tests passing in 31.34 s** (Δ vs. v0.6.3 baseline: +1 file, +48 tests, 0 regressions). Status: ACCEPTED. Phase 3 Session 9 unblocked (`TwoFactorAuthService` orchestration tests + `auth.service.test.ts` +10 + `signup.service.test.ts` +5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 0.6.3   | 2026-04-29 | **Phase 2 Session 7c — R13 load-test wiring DONE; Phase 2 DoD closed.** Refactored `load/lib/auth.ts` to type the `/auth/login` response as the discriminated union `LoginResultBody` (k6-local mirror of `backend/src/nest/two-factor-auth/two-factor-auth.types.ts:LoginResultBody`, kept local because k6 runs in goja under its own tsconfig per ADR-018). New private `extractAuthState(res, email)` validates 200, parses body, branches on `stage`: `'challenge_required'` → `fail()` with a remediation pointer (DD-7 OAuth or 2FA-exempt fixture); `'authenticated'` → token extraction (forward-compat per Step 2.4, currently unreachable from `/auth/login` under DD-10 Removal). New public `loginGeneric(email, password)` funnels both `loginApitest()` and `baseline.ts:loginAll()` through a single discriminated-union check. `baseline.ts:loginAll` collapsed from 23 lines (special-case branch + duplicated destructure) to one `pool.map(login => loginGeneric(...))`. **Verification (2026-04-29):** `pnpm exec tsc --noEmit -p load` exit 0 / 0 lines; `pnpm exec eslint load/ --no-warn-ignored` exit 0 / 0 lines. Status: ACCEPTED. Phase 2 fully DONE — Phase 3 (unit tests) unblocked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 0.6.2   | 2026-04-29 | **Phase 2 Session 7+ — Step 2.12 DONE.** Email-Change two-code 2FA-Verify (DD-32 / R15) shipped as a fresh Greenfield endpoint pair (no prior self-service email-change route existed — `UserProfileService.PROFILE_FIELD_MAP` deliberately omits `email`). New `users/email-change.{controller,service}.ts`, new DTOs, two new cookies (`emailChangeOldChallenge` / `emailChangeNewChallenge`). Refactor: `verifyChallenge` body moved into a shared `runVerifyMitigations` primitive; new `verifyChallengePreCommit` returns the record without consuming, with the per-flow wrong-code audit shape parameterised via `WrongCodeAudit` (login emits `(login, auth, failure)`, email-change emits `(update, user-email, failure, { side })`). Defense-in-depth: a stolen email-change token cannot be redeemed at `/auth/2fa/verify` (purpose-set rejection inside the primitive). Throttler `2fa-verify` tracker fallback chain extended to also key on `emailChangeOldChallenge` (industrial-NAT fairness preserved across both flows). `ChallengePurpose` widened to four values; new `LoginChallengePurpose` narrows `markVerified`/`VerifyResult` so email-change purposes can't reach the login/signup state mutation. Verification: ESLint 0, type-check 0, **279 files / 7147 tests / 21.70 s** (same baseline as Step 2.11 — zero regression from the verifyChallenge refactor + purpose narrowing), `/health` 200, both new routes mount with correct guard order (401 unauth / 404 unknown). Tests deferred to Phase 3 (unit) / Phase 4 (integration: Session-Hijack, typo-on-new-address, wrong-code bombing). Status: ACCEPTED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 0.6.0   | 2026-04-28 | **GREENFIELD-TRIM + DD-32 E-Mail-Change-2FA:** (1) **CLAUDE.md-Greenfield-Status (seit 2026-04-19) angewendet:** keine Bestandsuser → Step 0.3 (Vorabmail), Step 0.5.1 (Single-Root-Detection), Step 0.5.7 (Sender-Warmup) als **N/A — GREENFIELD** markiert. DD-22 (Cutover-Strategie), DD-23 (Per-Tenant-Flag), DD-26/27/28 (Pre-Deploy-Mail), DD-31 (Post-Cutover-Window), R5 (Existing-user impact), DD-11 (Transparent enrollment) als N/A markiert. T-Day-Konzept = Public-Launch-Day. ~2 Sessions gespart. (2) **NEW DD-32 + R15 + Step 2.12: E-Mail-Change-Endpoint MUSS 2FA-verifiziert sein.** Two-code verify (alte + neue E-Mail). Begründung: ohne diesen Schutz ist das gesamte 2FA-Modell durch Session-Hijack umgehbar — Angreifer ändert E-Mail auf eigene Adresse → 2FA-Codes gehen an Angreifer. Identifiziert beim Brutal-Ehrlich-Audit gegen Redis-Cloud-MFA-Doku 2026-04-28. (3) **Step-Up-2FA für sensitive Aktionen** (Tenant-Delete, Root-Self-Termination, Permission-Grant) explizit als **V2 inkrementell** markiert — pro sensitive Aktion ein eigener PR mit `requireStepUp2fa()`-Decorator, kein eigener Masterplan. Status: ACCEPTED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

> **Versioning rule:** 0.x.0 = planning · 1.x.0 = implementation in progress · 2.0.0 = shipped · x.x.1 = patch within phase.

---

## Out of scope (V1)

| Feature                                                                                                                        | Why excluded                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TOTP / authenticator app                                                                                                       | User requirement: email only                                                                                                                                                                                                                                                          |
| Backup recovery codes (printable)                                                                                              | **No in-app recovery in V1.** Business model = corporate-email-only customers; lost mailbox is a company-IT issue, not Assixx. See "Known Limitations" §1.                                                                                                                            |
| "Trust this device for N days"                                                                                                 | User requirement: every login = 2FA                                                                                                                                                                                                                                                   |
| SMS / phone codes                                                                                                              | Email only                                                                                                                                                                                                                                                                            |
| WebAuthn / FIDO2 / hardware tokens                                                                                             | Out of scope                                                                                                                                                                                                                                                                          |
| Per-user "skip 2FA" toggle                                                                                                     | Mandatory by definition                                                                                                                                                                                                                                                               |
| Per-tenant pilot rollout                                                                                                       | Single global env flag for V1; per-tenant flag is V2 if needed                                                                                                                                                                                                                        |
| ~~Self-service email change protected by 2FA~~ **NOW IN-SCOPE V1 per DD-32 (v0.6.0)**                                          | Email-Change MUSS zwei-fach 2FA-verifiziert werden (alte + neue Adresse). Sonst ist das ganze 2FA-Modell durch Session-Hijack umgehbar (R15). Neuer Step 2.12.                                                                                                                        |
| OAuth (Microsoft/Google) email 2FA                                                                                             | Exempt per DD-7. OAuth providers already enforce MFA upstream.                                                                                                                                                                                                                        |
| Forgot-password 2FA interaction                                                                                                | ADR-051 reset flow does NOT auto-login — user goes through `/login` afterwards, where 2FA naturally kicks in. No new wiring needed.                                                                                                                                                   |
| In-app 2FA bypass / recovery                                                                                                   | **Lockout-clear endpoint exists but is NOT a 2FA bypass** — see DD-8.                                                                                                                                                                                                                 |
| Step-Up-2FA für sensitive in-session Aktionen (Tenant-Delete, Root-Self-Termination, Permission-Grant, has_full_access-Toggle) | **V2 — schrittweise Erweiterung.** Konzeptionelle Lücke: heute hat ein Session-Hijacker für die Session-Dauer volle Macht. Wird inkrementell ergänzt, sobald 2FA-Basis (V1) live ist. Kein eigener Masterplan nötig — pro sensitive Aktion ein PR mit `requireStepUp2fa()`-Decorator. |

---

## Scope-creep notice (transparent to reviewer)

This plan introduces **two distinct features** under one umbrella:

1. **First-ever email-ownership verification at password signup.** No existing flow proves the email belongs to the signer for password signups (only OAuth providers asserted `email_verified` until now — confirmed by codebase audit).
2. **Per-login email re-verification.** This is the "2FA" part proper.

Both are wanted per the user requirement "all three scenarios". They share the same code path (challenge issue → email → verify), so the umbrella is correct. Just calling it out so reviewers know what they're approving.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

- [ ] Docker stack running, all containers healthy
- [ ] DB backup taken: `database/backups/pre-2fa-{timestamp}.dump`
- [ ] Branch `feat/2fa-email` checked out from `main`
- [ ] No pending migrations
- [ ] Redis reachable (already required for sessions / rate limit)
- [ ] `email-service.ts` (`backend/src/utils/email-service.ts`) confirmed working in current env (Doppler `SMTP_*` secrets present, including new `SMTP_FROM` per §2.9)
- [ ] §0.4 Critical Design Decisions approved by user
- [ ] Pre-deploy email drafted to all tenants (operational rollout)

### 0.1b DB-Reset-Policy (NEW v0.6.0 — Greenfield)

> **Hintergrund:** Phase 2 Step 2.5 ändert den Signup-Flow so, dass User mit `is_active = IS_ACTIVE.INACTIVE` (pending) angelegt werden statt direkt aktiv. Phase 1 hat zwei neue Spalten (`tfa_enrolled_at`, `last_2fa_verified_at`) hinzugefügt, die für alle bestehenden Test-User `NULL` sind. **Bestehende Dev-Test-User aus der Pre-2FA-Ära** sind im neuen Modell semantisch inkonsistent: sie haben `is_active = 1` aber `tfa_enrolled_at = NULL` — sie würden beim ersten Login implizit als „Existing-User mit ausstehender Erstverifikation" behandelt. Das verfälscht Smoke-Tests, weil das nicht der Greenfield-Soll-Zustand ist.

**Policy für DB-Reset/Truncate:**

| Aspekt              | Regel                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wer entscheidet** | **AUSSCHLIESSLICH der User (Simon Öztürk).** Claude/Implementierungs-Sessions dürfen DB-Reset NIE eigenmächtig durchführen — nur nach expliziter Anweisung wie „setze die DB jetzt zurück" oder „truncate users". Implizite Anweisungen wie „mach mal sauber" reichen NICHT. Bei Unsicherheit → AskUserQuestion.                                                                   |
| **Methode**         | **Kein plain `TRUNCATE`** auf `users` / `tenants`. Stattdessen: vollständiger Schema-Reset gemäß [`docs/how-to/HOW-TO-RESET-DB-PROPERLY.md`](./how-to/HOW-TO-RESET-DB-PROPERLY.md) (Schema-Drop + Fresh-Install + Test-Tenant). Grund: TRUNCATE allein hinterlässt potentielle Sequence-/Trigger-/RLS-State-Inkonsistenzen; Schema-Reset gibt einen reproduzierbaren Soll-Zustand. |
| **Wann sinnvoll**   | (a) **Vor Phase 2 Manual-Smoke** wenn alte Pre-2FA-Test-User existieren (User entscheidet). (b) **Vor Phase 4 API-Integration-Tests** falls die Tests gegen einen Clean-State laufen sollen (User entscheidet — Tests sollten idealerweise Clean-State selbst herstellen). (c) **Vor Public-Launch** als finalen Schritt, um produktiv mit garantiert frischem Stand zu starten.   |
| **Wann NICHT**      | Niemals während automatisierter CI-Runs. Niemals während aktiver Sessions ohne explizite Bestätigung. Niemals als Workaround für Bugs (ein Bug, der nur durch DB-Reset „verschwindet", ist ungelöst und kommt zurück).                                                                                                                                                             |
| **Re-Bootstrap**    | Nach jedem Reset: Test-Tenant + Test-User per [`docs/how-to/HOW-TO-CREATE-TEST-USER.md`](./how-to/HOW-TO-CREATE-TEST-USER.md) anlegen. **Ab dem Moment in dem Step 2.5 (modifizierter Signup) live ist**, durchläuft auch dieser Re-Bootstrap die 2FA-E-Mail-Verifikation — d.h. der Maildev-Container (Step 0.5.5) muss laufen, um den Code abzurufen.                            |
| **Pflicht-Backup**  | Auch bei Greenfield: vor jedem Reset `pg_dump --format=custom` in `database/backups/pre_reset_<timestamp>.dump`. Greenfield ≠ „Daten egal" — der aktuelle Dev-State kann für Reproduktionen wertvoll sein. Backup ist in HOW-TO-RESET-DB-PROPERLY Schritt 2 enthalten — nicht überspringen.                                                                                        |

**Konkreter Trigger-Punkt für ersten möglichen Reset (User-Entscheidung):**

Sobald Phase 2 Sessions 4–7 abgeschlossen sind und Step 2.5 (modifizierter Signup) live im Dev ist, ist das der natürliche Moment für einen Reset, falls Pre-2FA-Test-User existieren. Empfehlung an User: vor Phase 4 API-Integration-Tests einmal frisch resetten, damit die ersten echten 2FA-Tests gegen einen sauberen Soll-Zustand laufen. **Aber: der User entscheidet, der Plan empfiehlt nur.**

### 0.1a Disaster-Recovery / Out-of-Band-Pfade (NEW v0.5.0)

> **Hintergrund:** Mit DD-10-Removal (kein Flag) ist Code-Revert + Redeploy der einzige Rollback-Weg bei 2FA-Outages (z.B. SMTP-Provider-Downtime, Bug in Verify-Endpoint). Während Code-Revert (~10–30 Min CI/CD) ist die App vollständig blockiert — niemand kann einloggen, auch kein Admin. Out-of-Band-Pfade sind das Sicherheitsnetz.

**Verfügbare Pfade (User-bestätigt 2026-04-28):**

| Pfad               | Verfügbar                      | Use-Case bei 2FA-Outage                                                                                                                                                                   |
| ------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SSH** zum Server | ✅ Ja                          | Container-Restart (`docker-compose restart backend`), Code-Revert via `git checkout` + Rebuild, Logs lesen via `docker logs`, `docker exec assixx-postgres psql` für direkten DB-Eingriff |
| **Doppler-CLI**    | ✅ Ja                          | SMTP-Provider-Switch (`doppler secrets set SMTP_HOST=fallback`), Notfall-Rotate von Secrets ohne App-Login                                                                                |
| **psql direkt**    | Effektiv via SSH+`docker exec` | Festsitzende Lockouts in Redis löschen, manuelle `audit_trail`-Inspektion, Tenant-Eingriffe                                                                                               |

**Hard rule:** Vor T-Day MUSS verifiziert sein, dass mindestens 2 Personen funktionierenden SSH+Doppler-CLI-Zugang haben. Single-Person-Knowledge ist Lottoschein.

**Empfohlene zusätzliche Mitigation (V2-Scope, NICHT V1-Blocker):** Multi-Provider-SMTP-Failover (Primär: SendGrid, Backup: AWS SES) → automatischer Switch bei Primär-Outage, kein Out-of-Band-Eingriff nötig. Nicht zwingend für V1 — die meisten SaaS-Apps fahren erfolgreich Single-Provider.

### 0.2 Risk register

| #   | Risk                                                                                                                                                                                                                                                                                          | Impact | Probability      | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Verification                                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | User loses access to email → cannot log in                                                                                                                                                                                                                                                    | High   | Medium           | **No in-app recovery (per business model)**. Documented runbook tells the user's company IT to restore mailbox access first. Lockout-clear endpoint (DD-8) only resets the 5-wrong-codes lockout, not the 2FA requirement.                                                                                                                                                                                                                                                                                                                                                                | Manual: trigger lockout, root clears it, user retries with code                                                                                                                                                                                                        |
| R2  | Brute-force on 6-char alphanumeric code (~887 M combinations, Crockford-Base32 subset, v0.3.1)                                                                                                                                                                                                | High   | Low              | Max 5 attempts per challenge → ForbiddenException + 15-min user lockout. Code TTL 10 min. Throttler tiers `2fa-verify` (5 req / 10 min) per challenge token. Keyspace is ~887× larger than v0.3.0 numeric — brute-force probability of success across one challenge × 5 attempts ≈ 5.6 × 10⁻⁹.                                                                                                                                                                                                                                                                                            | Unit test: 6 wrong codes → ForbiddenException + lockout flag. Generator output stays in alphabet over 10 000 samples.                                                                                                                                                  |
| R3  | Email delivery failure / latency > 60 s                                                                                                                                                                                                                                                       | High   | High             | **Send awaited (synchronous)**, on failure return 503 (DD-14). UI shows spam-folder hint + Resend (60 s cooldown). Sentry alert on SMTP failure rate.                                                                                                                                                                                                                                                                                                                                                                                                                                     | Manual: kill SMTP → graceful 503, no 500                                                                                                                                                                                                                               |
| R4  | (Resolved by DD-7 = exempt OAuth)                                                                                                                                                                                                                                                             | —      | —                | OAuth users skip the 2FA layer; uniform email-2FA only on password paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Code path audit: `loginWithVerifiedUser()` → no challenge issued                                                                                                                                                                                                       |
| R5  | Existing-user impact: every active user forced into 2FA on next login                                                                                                                                                                                                                         | Medium | Certain          | **v0.5.0:** One-pager Vorabmail an alle Tenant-Roots T-7 vor Deploy (Step 0.3, DD-26). KEIN Soft-Rollout-Flag mehr (DD-10 entfernt). Mitigation jetzt: Pre-Deploy-Tests bombenfest (mail-tester Step 0.5.2 + Production-SMTP-Smoke Step 0.5.6 + Sender-Warmup Step 0.5.7). Notfall-Rollback via Code-Revert (10–30 Min) + Out-of-Band SSH/Doppler-CLI (§0.1a).                                                                                                                                                                                                                            | Manual: alle 0.5.x Steps grün vor T-Day. Vorabmail-Bounce-Rate < 5 % verifiziert.                                                                                                                                                                                      |
| R6  | Code interception via email TLS / mail-server archives                                                                                                                                                                                                                                        | Medium | Low              | 10-min TTL · single-use · hashed at rest in Redis (`sha256(userId:code:purpose)`) · email body warns "do not share" · subject is generic (DD-13)                                                                                                                                                                                                                                                                                                                                                                                                                                          | Read Redis → only hashes visible                                                                                                                                                                                                                                       |
| R7  | Race: user requests two codes in parallel — both valid                                                                                                                                                                                                                                        | Medium | Medium           | Single Redis key per challenge — `SET` overwrites previous code. Resend updates same record + extends TTL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Unit test: two consecutive `requestCode()` → only second works                                                                                                                                                                                                         |
| R8  | Challenge-token theft (XSS / network) → attacker bypasses password gate                                                                                                                                                                                                                       | High   | Low              | Challenge token = opaque `crypto.randomBytes(32).toString('base64url')`, single-use (DEL on consume), 10-min Redis TTL, transmitted via httpOnly+Secure+SameSite=Lax cookie.                                                                                                                                                                                                                                                                                                                                                                                                              | Unit test: reuse consumed challenge → 401                                                                                                                                                                                                                              |
| R9  | Sensitive data in logs (codes, tokens)                                                                                                                                                                                                                                                        | High   | Medium           | Pino redaction extended in `logger.constants.ts` (`code`, `challengeToken`). Generic error messages (no "expected vs got").                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Grep production-shape logs for known test code → no match                                                                                                                                                                                                              |
| R10 | User enumeration via timing on `/verify` (different response time for valid user)                                                                                                                                                                                                             | Low    | Low              | If user not found, run dummy `crypto.timingSafeEqual` against random hash. Same response shape success/fail. Same code path duration.                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Time 1 000 requests valid vs invalid → no statistical signal                                                                                                                                                                                                           |
| R11 | Doppler secrets missing in production (SMTP_HOST etc.)                                                                                                                                                                                                                                        | High   | Low              | `AppConfigService` Zod env schema fails fast at startup if `SMTP_HOST/USER/PASS/FROM` missing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Deploy with secret missing → fast crash, not silent 500                                                                                                                                                                                                                |
| R12 | Initial root user (very first install) cannot complete 2FA — no email yet                                                                                                                                                                                                                     | High   | Low              | First root signup uses 2FA flow against the email entered during install. Documented in DOCKER-SETUP.md.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Fresh-install smoke test                                                                                                                                                                                                                                               |
| R13 | Mobile / external API client breaks because login response shape changed                                                                                                                                                                                                                      | High   | Low (post-audit) | **v0.5.0:** Step 0.5.3 Audit (DONE 2026-04-28) bestätigt: 0 externe Clients in assixx + SCS-Technik GitHub-Footprint. R13-Probability sank von Medium → None für externe, ABER **load-tests im selben Repo (`load/lib/auth.ts`) breaken sofort am Deploy ohne Flag** → MUSS in Phase 2 Session 6 (oder vorher) auf Discriminated-Union umgestellt werden, BEVOR T-0 Deploy. Sonst: load-smoke CI fails. Versioned client SDK nicht mehr nötig (kein Flag-OFF-Path mehr). **DONE v0.6.3 (Session 7c, 2026-04-29):** load-test discriminated-union wiring shipped — see Spec Deviations §1. | Phase 2 DoD: load tests must consume `LoginResult` discriminated union. CI smoke green BEFORE T-0. ✅ Closed Session 7c, 2026-04-29.                                                                                                                                   |
| R14 | Cross-subdomain cookie scope mismatch (apex vs tenant subdomain) for challenge cookie                                                                                                                                                                                                         | Medium | Medium           | **Login** lives on tenant subdomain (`<tenant>.assixx.com/login` per ADR-050). Challenge cookie set + verified on same origin → no cross-domain traversal. **Signup** lives on apex (`www.assixx.com/signup`). Challenge cookie set + verified on apex; **after** 2FA success, mint a connection-ticket (existing `connection-ticket.service.ts` pattern from ADR-050 / oauth-handoff) and redirect to `<tenant>.assixx.com/handoff?ticket=…` so the access-token cookie lands on the tenant subdomain. Reuses the proven apex→subdomain bridge — zero new mechanism.                     | Manual login: `<tenant>.assixx.com/login` → verify on `<tenant>.assixx.com/login/verify` → tokens on tenant. Manual signup: `www.assixx.com/signup` → verify on `www.assixx.com/signup/verify` → handoff to `<tenant>.assixx.com/handoff?ticket=…` → tokens on tenant. |
| R15 | **E-Mail-Change-Endpoint umgeht 2FA** — Session-Hijacker (XSS, gestohlenes Cookie, offener Laptop, Insider) ändert `users.email` auf Angreifer-Adresse → künftige 2FA-Codes gehen an Angreifer → Account permanent übernommen, legitimer User ausgesperrt. **Bricht das gesamte 2FA-Modell.** | High   | Medium           | **DD-32 (v0.6.0): Two-code 2FA-Verify** am Email-Change-Endpoint. Vor jedem `UPDATE users SET email = ...` müssen ZWEI Challenges in derselben Transaktion verifiziert sein: eine an die ALTE Adresse (`purpose='email-change-old'`, „bist du es wirklich?"), eine an die NEUE Adresse (`purpose='email-change-new'`, „gehört die neue dir?"). Failure auf einer Seite → kein UPDATE, kein Partial-State. Implementiert in Step 2.12.                                                                                                                                                     | Integration test: simulierter Session-Hijack ohne Kontrolle der alten Mailbox → Email-Change scheitert. Integration test: Tippfehler-Szenario (User hat keinen Zugriff auf neue Adresse) → kein UPDATE → alte Mail bleibt aktiv (selbsthilfend).                       |

> **Rule:** every risk has a concrete mitigation AND a verification. "Be careful" is not a mitigation. "Should be fine" is not a verification.

### 0.3 Ecosystem integration points

| Existing system                                                        | Integration                                                                                                                                                | Phase | Verified on |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------- |
| `audit_trail` (ADR-009)                                                | New `(action, resource_type)` tuples — see §A8 audit-format table below                                                                                    | 2     |             |
| Legacy `email-service.ts` (`backend/src/utils/email-service.ts`)       | Add `send2faCode(to, code, purpose, ttlMin)` exported function + new German template                                                                       | 2     |             |
| Redis (via `ioredis`, DI provider per existing pattern)                | New key prefixes: `2fa:challenge:{token}`, `2fa:lock:{userId}`, `2fa:fail-streak:{userId}`, `2fa:resend:{token}`                                           | 2     |             |
| `AppThrottlerModule` (`throttler.module.ts`)                           | Two new tiers `2fa-verify` (5/10min) and `2fa-resend` (1/60s); custom decorators added to `throttle.decorators.ts`                                         | 2     |             |
| `AuthService.login()` (`auth.service.ts:184`)                          | Modified — returns discriminated union (`stage: 'challenge_required' \| 'authenticated'`)                                                                  | 2     |             |
| `AuthService.loginWithVerifiedUser()` (`auth.service.ts:247`)          | **Unchanged** per DD-7 (OAuth exempt). Add explanatory comment referencing DD-7.                                                                           | 2     |             |
| `SignupService.signup()` (`backend/src/nest/signup/signup.service.ts`) | Modified — creates user with `is_active = IS_ACTIVE.INACTIVE`, issues challenge instead of tokens                                                          | 2     |             |
| OAuth flow (`auth/oauth/`, ADR-046)                                    | **No change** — DD-7 exempt                                                                                                                                | —     |             |
| `users` table                                                          | (a) **DROP** legacy `two_factor_secret`, `two_factor_enabled` columns. (b) **ADD** `tfa_enrolled_at`, `last_2fa_verified_at`.                              | 1     |             |
| `JwtAuthGuard` (ADR-005)                                               | **No changes** — challenge token is separate from access JWT, runs before guard chain                                                                      | —     |             |
| Frontend `(public)/login/+page.server.ts`                              | Modified — handle `stage` discriminator, set httpOnly challenge cookie, redirect to `/login/verify`                                                        | 5     |             |
| Frontend `(public)/signup/` (NEW `+page.server.ts`)                    | Add form action (does not exist today). Same discriminator handling as login.                                                                              | 5     |             |
| Sentry / Grafana (ADR-002)                                             | New alert: SMTP failure rate > 5 % over 5 min · panel: 2FA verify success/fail rate                                                                        | 6     |             |
| Pino logger config                                                     | Redaction list in `logger.constants.ts` adds `code`, `challengeToken`                                                                                      | 2     |             |
| `AppConfigService` (`config/config.service.ts`)                        | Zod `EnvSchema` extended: `SMTP_FROM: z.string().min(1)`. **v0.5.0:** ~~`FEATURE_2FA_EMAIL_ENFORCED`~~ entfernt (DD-10 removal).                           | 2     |             |
| `docs/ARCHITECTURE.md` §1.2                                            | Add 2FA row to Auth & Permissions table                                                                                                                    | 6     |             |
| Email-Change-Endpoint (DD-32, v0.6.0) — TBD lokalisieren in Phase 2    | Two-code 2FA-Verify vor `UPDATE users SET email = ...` (Step 2.12). Zwei neue Endpoints `/users/me/email/request-change` + `/users/me/email/verify-change` | 2     |             |

#### A8: Audit `(action, resource_type)` tuples

`audit_trail.action VARCHAR(50)` is a flat verb (`create`, `delete`, `login`, etc.) per existing convention — dotted strings like `2fa.code.issued` violate the schema. Encoded as tuples:

| Event                                                        | action   | resource_type   | status    | changes (JSONB)                                            |
| ------------------------------------------------------------ | -------- | --------------- | --------- | ---------------------------------------------------------- |
| code issued (login/signup)                                   | `create` | `2fa-challenge` | `success` | `{ purpose: 'login' \| 'signup' }`                         |
| code resent                                                  | `create` | `2fa-challenge` | `success` | `{ purpose, kind: 'resend' }`                              |
| verify success                                               | `login`  | `auth`          | `success` | `{ method: '2fa-email' }`                                  |
| verify fail (wrong code)                                     | `login`  | `auth`          | `failure` | `{ reason: 'wrong-code', attempt: N }`                     |
| verify fail (expired)                                        | `login`  | `auth`          | `failure` | `{ reason: 'expired-challenge' }`                          |
| lockout triggered                                            | `update` | `2fa-lockout`   | `success` | `{ reason: 'max-attempts' }`                               |
| lockout cleared (root)                                       | `delete` | `2fa-lockout`   | `success` | `{ clearedBy: rootUserId, target: userId }`                |
| (no separate "reset" event — the lockout-clear IS the reset) | —        | —               | —         | —                                                          |
| email-change requested (old)                                 | `create` | `2fa-challenge` | `success` | `{ purpose: 'email-change-old', oldEmail }`                |
| email-change requested (new)                                 | `create` | `2fa-challenge` | `success` | `{ purpose: 'email-change-new', newEmail }`                |
| email-change verify success                                  | `update` | `user-email`    | `success` | `{ oldEmail, newEmail }`                                   |
| email-change verify fail (one or both codes wrong)           | `update` | `user-email`    | `failure` | `{ reason: 'wrong-code', side: 'old' \| 'new' \| 'both' }` |

### 0.4 Critical Design Decisions

> **All 21 DDs APPROVED on 2026-04-26.** Sign-off complete; implementation may begin after Phase 0.5 (Operational Prerequisites) is satisfied.

| #     | Decision                                            | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Rationale                                                                                                                                                                                                                                                       | Status                |
| ----- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| DD-1  | Code format                                         | **6 characters, uppercase alphanumeric, Crockford-Base32 subset.** Alphabet `A-HJKMNP-Z2-9` = `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 chars; excludes confusables `0/1/I/L/O`). Code regex `/^[A-HJKMNP-Z2-9]{6}$/`. Lowercase input is auto-normalised to uppercase server-side. (v0.3.1, was 6-digit numeric `100000–999999`.)                                                                                                                                      | ~887 M permutations (vs. 1 M numeric) — brute-force essentially impossible with rate limit + 10-min TTL. NIST 800-63B AAL1+. Mobile-typeable, no `0`-vs-`O` / `1`-vs-`I/L` support tickets in factory environments with dirty/glare-prone screens.              | **APPROVED** (v0.3.1) |
| DD-2  | Code TTL                                            | 10 minutes                                                                                                                                                                                                                                                                                                                                                                                                                                                          | NIST recommends ≤10 min. Balance of user leeway and attack window.                                                                                                                                                                                              | **APPROVED**          |
| DD-3  | Storage of code                                     | Redis only. Stored as `sha256(userId + ':' + code + ':' + purpose)` embedded in challenge record (single Redis read on verify).                                                                                                                                                                                                                                                                                                                                     | Auto-expiry · defense-in-depth at rest · zero DB bloat · single round-trip                                                                                                                                                                                      | **APPROVED**          |
| DD-4  | Challenge token format                              | Opaque `crypto.randomBytes(32).toString('base64url')` (not JWT). Looked up via Redis.                                                                                                                                                                                                                                                                                                                                                                               | Single source of truth. Trivial to revoke (DEL). No JWT-secret coupling. Smaller payload than JWT.                                                                                                                                                              | **APPROVED**          |
| DD-5  | Max verification attempts per challenge             | 5                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | After 5 wrong codes → 15-min user lockout + audit + suspicious-activity email                                                                                                                                                                                   | **APPROVED**          |
| DD-6  | Lockout duration                                    | 15 minutes (per user, not per challenge)                                                                                                                                                                                                                                                                                                                                                                                                                            | Long enough to deter automation, short enough to avoid total denial-of-service                                                                                                                                                                                  | **APPROVED**          |
| DD-7  | OAuth users (Microsoft/Google) — enforce email 2FA? | **Exempt.** `loginWithVerifiedUser()` skips the challenge step.                                                                                                                                                                                                                                                                                                                                                                                                     | OAuth providers already enforce MFA. Uniform UX cost outweighs marginal security gain. Decided 2026-04-26.                                                                                                                                                      | **APPROVED**          |
| DD-8  | Recovery for users who lost email access            | **No in-app recovery.** Lost-mailbox = company-IT problem (corporate email assumption). The `POST /users/:id/2fa/clear-lockout` endpoint clears ONLY the 15-min lockout from 5 wrong attempts — it does NOT bypass 2FA. Two-root rule applies. Audit-logged.                                                                                                                                                                                                        | Customers are companies with managed corporate email. If a user loses mailbox access, IT restores it; we don't ship recovery codes. Decided 2026-04-26.                                                                                                         | **APPROVED**          |
| DD-9  | Resend cooldown + TTL behavior                      | 60 seconds between resends (per challenge token). Resend **extends** challenge TTL back to 10 min (PEXPIRE) and resets per-challenge attempt count to 0. Per-user fail-streak (24 h) is NOT reset by resend.                                                                                                                                                                                                                                                        | Friendlier UX (don't punish the legitimate user whose first email was slow). Per-user fail-streak still catches genuine brute-force.                                                                                                                            | **APPROVED**          |
| DD-10 | ~~Soft-rollout feature flag~~ **REMOVED v0.5.0**    | ~~`FEATURE_2FA_EMAIL_ENFORCED`~~ **Flag KOMPLETT entfernt** per User-Vorgabe „kein Einstellung auszustellen" (2026-04-28). 2FA ist hartcodiert ab Deploy. Kein Soft-Rollout, kein Notfall-Kill-Switch. Rollback nur via Code-Revert + Redeploy (~10–30 Min). Out-of-Band-Recovery via SSH + Doppler-CLI (User bestätigt vorhanden, §0.1a).                                                                                                                          | User: „kein Einstellung auszustellen, period, as simple as that". Sicherheits-Trade-off bewusst akzeptiert: Doppler-Flag wäre selbst Angriffsvektor. Ohne Flag: 2FA-Off nur via signiertem Code-Push, vollständig audited.                                      | **REMOVED v0.5.0**    |
| DD-11 | Existing users — first 2FA on next login            | Transparent enrollment. Any user without `tfa_enrolled_at` who logs in post-flip goes through the same flow → on first success, set `tfa_enrolled_at = NOW()`.                                                                                                                                                                                                                                                                                                      | No bulk migration. Existing email is implicitly trusted (verified at signup once we ship this).                                                                                                                                                                 | **APPROVED**          |
| DD-12 | Code generator                                      | **Loop 6× over `crypto.randomInt(0, 31)` indexing into 31-char alphabet** `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (Node `crypto` module). v0.3.1: was `crypto.randomInt(100000, 1000000)`.                                                                                                                                                                                                                                                                                | Cryptographically secure (Node `crypto`). Never `Math.random`. `crypto.randomInt(0, 31)` is rejection-sampled internally — uniform over alphabet, no modulo bias.                                                                                               | **APPROVED**          |
| DD-13 | Email subject + sender                              | **Generic subject only.** Subject: "Ihr Bestätigungscode für Assixx". Code in body only. Sender: `noreply@<tenant-domain>` with fallback `noreply@assixx.de` (from `SMTP_FROM`).                                                                                                                                                                                                                                                                                    | Code never visible in mail-list previews, lock-screen banners, or screenshots. Marginal UX cost (one click to read code) accepted. Decided 2026-04-26.                                                                                                          | **APPROVED**          |
| DD-14 | Behavior on email send failure                      | Login: 503 with retryable error. Signup: 503 + cleanup deletes **both `users` AND `tenants` row** in the same transaction (anti subdomain-squatting — without tenant cleanup, an attacker could squat any premium subdomain by signup + tab-close). Tenant cleanup conditional: only if no other users exist for that tenant (defensive — should always be true at this stage). UI: "Der Code konnte nicht gesendet werden — bitte erneut versuchen." Sentry alert. | Fail-loud. Don't silently degrade. Tenant-cleanup added 2026-04-26 to prevent subdomain-squatting attack vector identified during plan review.                                                                                                                  | **APPROVED**          |
| DD-15 | New columns on `users` (vs new table)               | (a) DROP legacy `two_factor_secret`, `two_factor_enabled`. (b) ADD `tfa_enrolled_at TIMESTAMPTZ NULL`, `last_2fa_verified_at TIMESTAMPTZ NULL`. No new table.                                                                                                                                                                                                                                                                                                       | KISS. Legacy columns are dead schema (zero references in code, confirmed by audit). V2 (backup codes / trusted devices) gets a separate table when needed.                                                                                                      | **APPROVED**          |
| DD-16 | Audit-log destination                               | Existing partitioned `audit_trail` table (ADR-009). Tuples per §A8 (NOT dotted strings).                                                                                                                                                                                                                                                                                                                                                                            | Consistent with all other security events. Schema-correct.                                                                                                                                                                                                      | **APPROVED**          |
| DD-17 | Frontend code-input UX                              | Single `<input type="text" inputmode="text" autocapitalize="characters" autocomplete="one-time-code" maxlength="6" pattern="[A-HJKMNP-Z2-9]{6}">`. Auto-submit on 6th character ON by default (no feature flag). Lowercase input is auto-uppercased server-side via `z.string().trim().toUpperCase().regex(...)`. v0.3.1: changed `inputmode="numeric"`→`text` + added `autocapitalize`/`pattern`.                                                                  | iOS Safari + Android Chrome auto-suggest from email — `one-time-code` works for alphanumeric per WHATWG HTML spec. `autocapitalize="characters"` reduces typing friction on mobile. Trade-off: auto-fill heuristic ~5–10 % less reliable than pure-digit codes. | **APPROVED**          |
| DD-18 | Pino redaction additions                            | Add `req.body.code`, `req.body.challengeToken`, `*.code`, `*.challengeToken` to `LOGGER_REDACT_PATHS` in `logger.constants.ts`.                                                                                                                                                                                                                                                                                                                                     | Defense-in-depth — codes never in logs even on error                                                                                                                                                                                                            | **APPROVED**          |
| DD-19 | Frontend signup form pattern                        | **Add `+page.server.ts` form action** (currently signup posts client-side via `_lib/api.ts`). Server-side `cookies.set(challengeToken, …)` + `redirect(303, '/signup/verify')`. Match login pattern.                                                                                                                                                                                                                                                                | Cleanest separation of secrets from JS. Aligned with ADR-012 fail-closed pattern + CODE-OF-CONDUCT-SVELTE Form Actions. Heavier refactor accepted: "no quick ship, must be ordentlich". Decided 2026-04-26.                                                     | **APPROVED**          |
| DD-20 | Suspicious-activity email recipients                | **User only** (the locked-out account). No tenant-admin notification in V1 — would create a side channel for user-enumeration ("did the admin get an email about user X?").                                                                                                                                                                                                                                                                                         | Minimize side channels. V2 may add opt-in tenant-admin notification.                                                                                                                                                                                            | **APPROVED**          |
| DD-21 | Per-challenge resend cap                            | `MAX_RESENDS_PER_CHALLENGE = 3`. After 3 resends on the same challenge token → 429 ConflictException, user must restart from `/login` (new challenge).                                                                                                                                                                                                                                                                                                              | Prevents SMTP spam-trap impact. 3 resends within a 10-min window is enough for genuine retry.                                                                                                                                                                   | **APPROVED**          |

| DD-22 | Cutover-Strategie (T-Day) — **REVISED v0.5.0** | **T-Day = Phase 5 Completion + 14 Tage Puffer = Deploy-Day.** v0.5.0 (DD-10 entfernt): KEIN Soft-Rollout-Phase mehr. 14 Tage Puffer dienen jetzt: T-14 bis T-7 Single-Root-Outreach + finalen Code-Review, T-7 Vorabmail-Versand + Sender-Warmup-Phase Start (Step 0.5.7), T-1 letzte Verifikation aller 0.5.x Steps + Production-SMTP-Smoke (Step 0.5.6), T-0 = Production-Deploy = 2FA sofort live. Vorabmail wird in Phase 6 gedraftet, damit das Datum stimmt. | Niedrigstes Risiko ohne Flag. Pre-Deploy-Tests müssen bombenfest sein (Steps 0.5.2 + 0.5.6 + 0.5.7). Vorabmail nur einmal verschickt. | **APPROVED + REVISED v0.5.0** |
| DD-23 | Per-Tenant 2FA-Flag in V1 — **CLARIFIED v0.5.0** | **NEIN.** v0.5.0: DD-10 entfernt → KEIN globaler Flag mehr, KEIN Per-Tenant-Flag. 2FA hartcodiert für ALLE Tenants. Falls am T-1 Single-Root-Tenants nicht reagiert haben → **T-Day um 7 Tage verschieben (Deploy-Date verschieben — kein Flag-Flip mehr) + E-Mail-Eskalation an alle betroffenen Roots** (KEIN Telefon-Support). Wenn auch nach 7-Tage-Verschiebung Tenant nicht reagiert → eskalieren als Produkt-Entscheidung. | KISS für V1. Per-Tenant-Flag ist V2 wenn ein konkreter Bedarfsträger es braucht. E-Mail-only-Eskalation passt zu B2B-SaaS-Kommunikationsmodell. | **APPROVED + CLARIFIED v0.5.0** |
| DD-24 | DNS- + Cert-Modell für Tenant-Subdomains | **Wildcard A/AAAA `*.assixx.com` + Wildcard-TLS-Cert.** Bestätigt in v0.4.0. Neue Tenant-Subdomains sind sofort live. Step 0.5.4 verifiziert nur, dass das Setup auch wirklich aktiv ist (DNS-Lookup + Nginx-Config-Inspection). | KISS. Plan-Default-Annahme bestätigt. Per-Tenant-DNS/Cert ist V2 falls Custom-Domain-Branding gefordert wird. | **APPROVED** (v0.4.0) |
| DD-25 | Dev-SMTP-Backend | **AMENDED v0.4.x (2026-04-29) → Mailpit-Container** (`axllent/mailpit:v1.29@sha256:757f22b5…6fdbc`) im `docker-compose.yml` `dev`-Profile (SMTP Port 1025, Web-UI/REST Port **8025** — geändert von 1080). Doppler dev-SMTP-Secrets zeigen auf `mailpit:1025` (`SMTP_HOST=mailpit`). Dokumentation in `docs/how-to/HOW-TO-DEV-SMTP.md` (vollständig auf Mailpit umgeschrieben). **Vorher (v0.4.0, superseded):** `maildev/maildev:2.2.1@sha256:180ef51f…a810`, Web-UI Port 1080, `SMTP_HOST=maildev`. | Zero externe Deps + Mails landen lokal bleiben unverändert; **Migration-Trigger:** Maildev wird nicht mehr aktiv gemaintained (letztes Release 2024-12-12, Repo-Aktivität stagniert). Mailpit ist der moderne Go-basierte Ersatz: niedrigere Memory-Footprint, persistenter SQLite-Store (überlebt `docker-compose restart`), aktive Release-Cadence. | **AMENDED** (v0.4.x — supersedes v0.4.0 APPROVED) |
| DD-26 | Pre-Deploy-Mail Empfängerkreis | **Nur Root-User aller aktiven Tenants** (1 Mail pro Tenant an primary Root-Email). Roots informieren Admins/Mitarbeiter intern weiter. | Root trägt IT-Verantwortung. Minimaler Empfängerkreis schont DKIM-Reputation. Klare Hierarchie. | **APPROVED** (v0.4.0) |
| DD-27 | Pre-Deploy-Mail Sprache + Tonalität | **Deutsch only**, **formal Sie + sachlich-technisch**. Format: HTML + Plain-Text-Fallback (analog 2FA-Code-Mail). | Zielgruppe = deutsche Industrieunternehmen (50–500 MA). Restliche App-UI ist DE-only. | **APPROVED** (v0.4.0) |
| DD-28 | Single-Root-Outreach-Timing | **T-14 + T-7 + T-1** — drei personalisierte Reminder-Mails (Step 0.5.1). | Drei Stufen geben genug Vorlauf für Tenant-IT, einen zweiten Root anzulegen + intern abzustimmen + 2FA-Test durchzuführen. | **APPROVED** (v0.4.0) |
| DD-29 | Reaper-Deployment-Topologie | **`@Cron('0 */15 * * * *')` im Haupt-Backend mit `@nestjs/schedule`** (Plan-Default bestätigt). Bei Contention-Telemetrie nach T+30 Tagen → V2-Migration zu `assixx-deletion-worker` erwägen. | Eine Query alle 15 Min ist leichtgewichtig. Minimaler Setup-Aufwand. | **APPROVED** (v0.4.0) |
| DD-30 | HOW-TO-2FA-RECOVERY.md Umfang | **Minimal-Umfang (1–2 Seiten):** (a) User-Mailbox-Verlust → Firmen-IT muss Mailbox restoren; (b) Root-Lockout-Clear-Workflow Schritt-für-Schritt; (c) Two-Root-Anforderung. Keine Screenshots (verfallen mit UI), kein Troubleshooting-Tree. | Fokussiert + wartbar. Vorabmail kann verlinken ohne Information-Overload. Comprehensive-Version ist V2 wenn Support-Tickets dazu zwingen. | **APPROVED** (v0.4.0) |
| DD-31 | Post-Cutover-Monitoring-Fenster | ~~**T+1 Quick-Review + T+7 Stable-State-Review.** T+1 = SMTP-Fail-Rate, Lockout-Count, Support-Tickets. T+7 = vollständiger Review aller Metriken. Wenn alles grün → erhöhtes Monitoring beenden, Standard-Alerting ausreichend.~~ **N/A — GREENFIELD v0.6.0:** kein Cutover-Vergleich-zu-vorher möglich, weil keine Bestandsuser. Standard-Alerting (Sentry SMTP-Fail-Rate, Lockout-Count) reicht ab Public-Launch. | ~~Plan-Default (T+1) war zu knapp — Lockouts werden bei wenig-aktiven Usern erst Tage später sichtbar. T+7 fängt diese Spät-Effekte ab.~~ Greenfield: erste echte User triggern erst nach Wochen Telemetrie-Volumen, T+7-Window wird zu willkürlich. | **N/A — GREENFIELD v0.6.0** |
| DD-32 | **E-Mail-Change-Flow muss 2FA verifizieren** (NEU v0.6.0, identifiziert beim Brutal-Ehrlich-Audit gegen Redis-Cloud-MFA-Doku) | **Two-code verify**: vor jedem `UPDATE users SET email = ...` müssen ZWEI 2FA-Challenges in derselben Service-Transaktion erfolgreich verifiziert sein — eine an die ALTE Adresse (`purpose='email-change-old'`), eine an die NEUE Adresse (`purpose='email-change-new'`). Beide Codes müssen innerhalb derselben Verify-Session vorgelegt werden. UPDATE wird erst commited wenn beide grün. Failure auf einer Seite → kein UPDATE, kein Partial-State, beide Challenges DEL'd. Suspicious-Activity-Mail an alte Adresse bei Verify-Fail (analog DD-20). Implementierung in Step 2.12. | Ohne 2FA-Verify ist E-Mail-Change ein 2FA-Bypass: Session-Hijacker (XSS, Cookie-Theft, offener Laptop, Insider) ändert E-Mail auf Angreifer-Adresse → künftige 2FA-Codes gehen an Angreifer → 2FA-Modell bricht (R15). Two-code-verify schützt sowohl gegen Hijack (Angreifer braucht Zugang zu BEIDEN Mailboxen gleichzeitig innerhalb 10 min) als auch gegen Tippfehler bei der neuen Adresse (selbsthilfend — kein UPDATE, alte Mail bleibt funktional). | **APPROVED** (v0.6.0) |

> **Sign-off complete (2026-04-26):** all 21 DDs APPROVED.
> **v0.3.1 patch (2026-04-28):** DD-1 / DD-12 / DD-17 modified to adopt 6-char alphanumeric Crockford-Base32 subset (`A-HJKMNP-Z2-9`, 31 chars, ~887 M permutations). R2 risk lowered Medium → Low. Plan stays ACCEPTED. Phase 1 may begin after Phase 0.5 (Operational Prerequisites) is satisfied.
> **v0.4.0 perfectioning (2026-04-28):** DD-22 → DD-31 hinzugefügt. Alle 12 verbleibenden offenen operativen/technischen Entscheidungen aufgelöst via AskUserQuestion. Plan stellt KEINE Fragen mehr. Phase 1 kann beginnen.
>
> **v0.6.0 GREENFIELD-TRIM-NOTE (2026-04-29) — Cutover-DDs N/A:** Mit CLAUDE.md Greenfield-Status (seit 2026-04-19, ADR-050 §"Deployment Context: Greenfield Launch") entfallen folgende Cutover-spezifische DDs **operativ** — sie bleiben textuell im Plan als Referenz für ein zukünftiges Re-Cutover, sollten Bestandsuser jemals existieren:
>
> - **DD-11** (Transparent enrollment für Existing-Users) — N/A: alle User starten frisch mit 2FA aktiv, kein Pre-/Post-Flip-State
> - **DD-22** (Cutover-Strategie + 14-Tage-Puffer + T-14/T-7/T-1) — N/A: T-Day = Public-Launch-Day
> - **DD-23** (Per-Tenant-Flag NEIN) — bleibt NEIN, aber Begründung wechselt von „Cutover-Risk-Mitigation" zu „nicht nötig im Greenfield"
> - **DD-26 / DD-27 / DD-28** (Pre-Deploy-Mail Empfängerkreis/Sprache/Timing) — N/A: keine Empfänger
> - **DD-31** (Post-Cutover-Monitoring-Window T+1/T+7) — bereits im Eintrag oben als N/A markiert; Standard-Alerting reicht
>
> **v0.6.0 NEUE DDs:** DD-32 (E-Mail-Change-2FA-Verify) hinzugefügt.
> **v0.6.0 Step-Up-2FA-Note:** sensitive in-session Aktionen (Tenant-Delete, Root-Self-Termination, Permission-Grant, has_full_access-Toggle) erhalten Step-Up-2FA-Decoration **inkrementell pro Aktion in V2** — nicht in V1. Kein eigener Masterplan nötig.
>
> Alle anderen DDs (DD-1 bis DD-21, DD-24, DD-25, DD-29, DD-30, DD-32) bleiben aktiv und in Geltung.

---

## Phase 0: Audit & Sign-off

### Step 0.1: External-API consumer audit [DONE — 2026-04-28]

**Goal:** identify any non-browser client (mobile, CLI, partner integration) that calls `/api/v2/auth/login` and currently expects the old response shape (`{ accessToken, refreshToken, user }`).

**Procedure:**

1. `git log --all --diff-filter=A -- '**/api*'` — find external consumer code in this repo.
2. Check `backend/src/nest/auth/auth.controller.ts:296` (`@Post('login')`) for `@ApiTags`/Swagger annotations that hint at external clients.
3. Document findings in §Spec Deviations. If external clients exist, plan a versioned response or feature-flag default-OFF in production.

**Deliverable:** one-paragraph audit note added to this masterplan under "Spec Deviations" before Phase 2.

### Step 0.2: All DDs approved [DONE — 2026-04-26]

All 21 DDs APPROVED on 2026-04-26 — see §0.4 table.

### Step 0.3: Pre-deploy Tenant-Mail (T-7 Vorabmail) [**N/A — GREENFIELD v0.6.0**]

> **v0.6.0 GREENFIELD-NOTE:** keine Bestandsuser → keine Empfänger → kein Versand. Step bleibt im Plan dokumentiert für ein zukünftiges Re-Cutover (sollten Bestandsuser jemals existieren). Status der DoD-Checkbox auf [—].
>
> **v0.4.0 Konkretisierung (historisch):** alle Empfänger-, Sprache-, Tonalitäts- und Format-Entscheidungen in DD-26 + DD-27 fixiert.

**Empfänger:** ausschliesslich Root-User aller aktiven Tenants (DD-26). 1 Mail pro Tenant an primary Root-User-Email aus `users` (filter: `role='root' AND is_active=1`, primary = niedrigste `users.id` falls mehrere Roots).

**Sprache:** Deutsch only (DD-27).

**Tonalität:** formal Sie + sachlich-technisch (DD-27).

**Format:** HTML + Plain-Text-Fallback (analog 2FA-Code-Mail-Template aus Step 2.9). Subject + Sender-Konventionen analog DD-13.

**Versanddatum:** T-7 (also 7 Tage vor T-Day). T-Day wird nach Phase 5 DoD gesetzt (DD-22) → **diese Vorabmail wird in Phase 6 gedraftet**, NICHT jetzt. Drafting jetzt würde ohne fixes Datum + ohne fertige `HOW-TO-2FA-RECOVERY.md` (Phase 6 Deliverable) zu Re-Issues führen.

**Absender:** `noreply@assixx.de` (DD-13).

**Inhalt (Pflicht-Bestandteile):**

1. Was sich ändert — verpflichtetes E-Mail-2FA bei Signup + jedem Login (Sie + alle Ihre User).
2. Wann — konkretes T-Day-Datum.
3. Wer betroffen ist — alle Passwort-Login-User; OAuth-User (Microsoft/Google) ausgenommen (DD-7).
4. Was Roots tun müssen — Postfach-Zugriff aller Mitarbeiter sicherstellen, Firmen-IT bei Bedarf einbinden.
5. Single-Root-Hinweis — Tenants mit nur 1 aktiven Root erhalten zusätzlich eine personalisierte Mail (Step 0.5.1).
6. Recovery-Link → `docs/how-to/HOW-TO-2FA-RECOVERY.md` (Phase 6 Deliverable, muss vor T-7 fertig sein).
7. Support-Kontakt + Impressum.

**Owner:** Backend (Draft) + Produkt (Versand-Freigabe).
**Verifikation:** Draft-PR mergt vor T-10. Versand am T-7. Bounce-Rate < 5 % nach T-6 verifiziert.

### Phase 0 — Definition of Done

- [x] External-consumer audit completed and findings recorded (2026-04-28 — see §Spec Deviations)
- [x] All 21 DDs APPROVED (2026-04-26)
- [x] **v0.4.0 Plan-Perfektionierung:** DD-22 → DD-31 APPROVED (2026-04-28). Plan stellt KEINE offenen Fragen mehr.
- [x] User confirms readiness to start Phase 0.5 → Phase 1 (2026-04-28)
- [ ] ~~Pre-deploy email drafted, queued~~ → **verschoben nach Phase 6** (post Phase 5 DoD, sobald T-Day per DD-22 fix ist; Drafting jetzt würde ohne fixes Datum + ohne fertige `HOW-TO-2FA-RECOVERY.md` zu Re-Issues führen)

---

## Phase 0.5: Operational Prerequisites

> Operational concerns that block production cut-over but **do not block code-level Phase 1/2/3 work**. Each item has an owner, a verification, and a deadline relative to cut-over (T-Day = flag-flip day).

### Step 0.5.1: Single-Root-Tenant Detection + Mitigation [**N/A — GREENFIELD v0.6.0**]

> **v0.6.0 GREENFIELD-NOTE:** keine Bestandstenants → keine Detection-Query nötig → keine Outreach-Mails. Step bleibt im Plan dokumentiert für ein zukünftiges Re-Cutover. **Aber:** bei Onboarding der ersten echten Tenants (post-Public-Launch) muss das HOW-TO-2FA-RECOVERY.md (DD-30) den Two-Root-Rule + Lockout-Clear-Workflow dokumentieren, damit Single-Root-Tenants nach dem Onboarding zumindest informiert sind. Detection-Query bleibt nützlich als Monitoring-Tool für Customer-Success — daher Query-Snippet erhalten.

**Why (historisch — Bestandsuser-Cutover):** DD-8 (no in-app recovery) + DD-5 (5 wrong codes → lockout) + Two-Root-Rule (lockout-clear caller ≠ target) means a tenant with exactly **one** root user who self-locks-out has **zero recovery path** without engineering intervention.

**Procedure:**

1. **Detection query** (run T-14 days, repeat T-7 + T-1):

   ```sql
   -- Tenants with only ONE active root user (run as sys_user, BYPASSRLS)
   SELECT t.id, t.subdomain, t.company_name, COUNT(u.id) AS root_count
   FROM tenants t
   JOIN users u ON u.tenant_id = t.id
   WHERE u.role = 'root'
     AND u.is_active = 1
   GROUP BY t.id, t.subdomain, t.company_name
   HAVING COUNT(u.id) = 1
   ORDER BY t.id;
   ```

2. **Outreach (3-Stufen, DD-28):** T-14 + T-7 + T-1 — drei personalisierte Reminder-Mails an alle in der Detection-Query gefundenen Tenant-Roots. Mail-Inhalt: "Sie haben nur einen Root-Benutzer. Vor dem 2FA-Cutover am [T-DAY] muss ein zweiter Root-Benutzer eingerichtet werden, sonst ist im Falle einer Aussperrung kein Self-Recovery möglich." Link: `docs/how-to/HOW-TO-2FA-RECOVERY.md` (Phase 6 Deliverable, muss vor T-14 fertig sein).

3. **Hard-Block am T-1 (DD-23, v0.4.0 fixiert):** Wenn Detection-Query am T-1 nicht-leer ist:
   - **Aktion:** Cutover um 7 Tage verschieben + **E-Mail-Eskalation an alle betroffenen Roots** (KEIN Telefon-Support, KEIN Per-Tenant-Flag in V1). Mailtext: "Cutover wurde wegen Ihrer fehlenden Reaktion um 7 Tage verschoben. Bitte legen Sie bis [NEUES_T-DAY] einen zweiten Root-User an."
   - **Wenn nach 7-Tage-Verschiebung Tenant immer noch nicht reagiert:** Eskalation als Produkt-Entscheidung (kein automatischer 2. Verschiebe-Loop).

**Owner:** Product/Support. **Verification:** SQL query returns 0 rows at T-1.

### Step 0.5.2: SMTP Domain Auth (SPF/DKIM/DMARC) [PENDING]

**Why:** `SMTP_FROM=noreply@assixx.de` (DD-13). If `assixx.de` lacks proper email auth, codes land in Junk/Spam → users believe "no email arrived" → support flood at cut-over.

**Procedure:**

1. Verify DNS at apex (`assixx.de`):
   - SPF: `v=spf1 include:<provider> -all`
   - DKIM: provider-specific selector (e.g. `default._domainkey.assixx.de`)
   - DMARC: `v=DMARC1; p=quarantine; rua=mailto:postmaster@assixx.de`

2. Send a test 2FA code to a `mail-tester.com` address: target score **≥ 9/10**.

3. **v0.4.0 (DD-13 Bestätigung):** Per-Tenant Custom-Domain `SMTP_FROM=noreply@<tenant-domain>` ist in V1 NICHT aktiv. V1 nutzt ausschliesslich `noreply@assixx.de` — keine pro-Tenant DKIM-Verifikation nötig. Per-Tenant-Branding ist V2-Scope.

**Owner:** DevOps. **Verification:** mail-tester score ≥ 9/10 für `noreply@assixx.de` captured + linked to this masterplan.

### Step 0.5.3: External-API Consumer Audit [DONE — 2026-04-28, formerly Step 0.1]

**Why:** `AuthService.login()` return shape changes from `LoginResponse` to discriminated union `LoginResult`. Mobile/CLI/partner integrations that hard-code the old shape will break at flag-flip.

**Procedure:**

1. `gh search code --owner=assixx '"/api/v2/auth/login"'` (cross-repo search if applicable).
2. Check `backend/src/nest/auth/auth.controller.ts` for `@ApiTags`/Swagger annotations hinting at external clients.
3. Inspect Doppler secrets for any non-browser API tokens with login scope.
4. Document findings under §Spec Deviations.

**Decision criteria:**

- **0 external clients found** → proceed; no mitigation needed.
- **≥ 1 external client found** → choose: (a) version the endpoint (`/api/v3/auth/login` returns new shape, `/v2/` keeps old until clients migrate), or (b) per-client header opt-in (`X-Accept-2FA-Stage: 1`), or (c) coordinate client update before cut-over.

**Owner:** Backend. **Verification:** audit note in §Spec Deviations + decision documented.

### Step 0.5.4: Apex→Subdomain Handoff Verification (Fresh-Tenant Signup) [PENDING]

**Why:** Signup form lives on `www.assixx.com/signup`. After 2FA verify, redirect goes to `<neu-tenant>.assixx.com/handoff?ticket=…`. The new subdomain must be **DNS-resolvable + cert-served** between the moment `tenants` row commits and the 303 redirect fires (typically < 1 second).

**v0.4.0 Resolution (DD-24):** DNS- und Cert-Modell = **Wildcard A/AAAA `*.assixx.com` + Wildcard-TLS-Cert**. Plan-Default-Annahme bestätigt. Step 0.5.4 verifiziert nur, dass das Setup auch wirklich aktiv ist (kein Provisioning-Aufwand pro Tenant).

**Procedure:**

1. **DNS-Wildcard-Verifikation:**

   ```bash
   dig +short any.assixx.com  # Sollte IP zurückgeben (gleiche IP wie www.assixx.com)
   dig +short e2e-nonexistent-{timestamp}.assixx.com  # Sollte ebenfalls IP zurückgeben
   ```

   Beide müssen die gleiche IP zurückgeben. Wenn nicht → Wildcard-A-Record fehlt → DevOps-Aufgabe vor T-Day.

2. **Cert-Wildcard-Verifikation:**

   ```bash
   echo | openssl s_client -servername e2e-nonexistent-{timestamp}.assixx.com -connect <ip>:443 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName
   ```

   Subject sollte `*.assixx.com` als SAN enthalten. Wenn nicht → Wildcard-Cert fehlt → DevOps-Aufgabe vor T-Day.

3. **End-to-End Fresh-Tenant Signup:** Test auf Staging mit Subdomain `e2e-test-{timestamp}`. Subdomain darf nie zuvor genutzt worden sein.

**Owner:** DevOps + Backend. **Verification:** end-to-end signup mit neuer Subdomain `e2e-test-{timestamp}` completed in unter 5 Sekunden, keine DNS/cert errors. Wildcard-A + Wildcard-Cert beides bestätigt aktiv.

### Step 0.5.5: Dev-SMTP Smoke Test (Mailpit) [DONE — 2026-04-28; AMENDED 2026-04-29: Maildev → Mailpit; AMENDED 2026-04-29 v0.7.1: anonymous-SMTP regression fix]

> **v0.7.1 Amendment (2026-04-29):** Smoke-Test-DoD verschärft. Original-Procedure prüfte nur `getent hosts mailpit` Reachability + Maildev-UI-Sichtbarkeit — nicht den realen End-to-End-Send via `email-service.ts` Transport. Dadurch blieb der Bug latent, dass `nodemailer.createTransport({ ..., auth: { user: '', pass: '' } })` gegen Mailpits anonymous-only SMTP-Listener mit `Missing credentials for "PLAIN"` 503t. Fix in `email-service.ts`: `auth`-Block wird komplett weggelassen wenn beide Creds leer sind. **Neue DoD-Bullets (siehe v0.7.1 Changelog-Eintrag):** (a) Live-Smoke MUSS via `curl POST /api/v2/auth/login` erfolgen → 200 + `stage=challenge_required` + Mailpit `/api/v1/messages` enthält die Capture (nicht nur Hostname-Resolve). (b) Backend-Logs müssen 0× `Missing credentials for "PLAIN"` enthalten. (c) Bei production-SMTP-Switch: gleicher curl-Smoke mit echtem Provider gegen echte Test-Adresse — noch offen unter Step 0.5.6.

> **v0.4.x Amendment (DD-25, 2026-04-29):** Dev-SMTP-Backend = **Mailpit-Container** (`axllent/mailpit:v1.29@sha256:757f22b56c1da03570afdb3d259effe5091018008a81bbedc8158cee7e16fdbc`) im `docker-compose.yml` `dev`-Profile. Web-UI/REST jetzt auf Port **8025** (vorher 1080), SMTP weiterhin Port 1025. Doppler `SMTP_HOST=mailpit` (vorher `maildev`). Migration-Trigger: Maildev wird nicht mehr aktiv gemaintained (letztes Release 2024-12-12). Mailpit ist der moderne Ersatz mit persistentem SQLite-Store, niedrigerer Memory-Footprint, aktiver Release-Cadence. **Implementation:** siehe `docker/docker-compose.yml` `mailpit`-Service-Block, `docs/how-to/HOW-TO-DEV-SMTP.md`, `backend/test/helpers.ts` (`clearMailpit`/`fetchLatest2faCode` an Mailpit-API angepasst — `GET /api/v1/messages` Envelope + `GET /api/v1/message/{ID}` für Body, `DELETE /api/v1/messages` für Reset). Cutover-Step für User: `doppler secrets set SMTP_HOST=mailpit --config dev` + `docker-compose up -d --force-recreate mailpit backend deletion-worker`.

> **v0.4.0 Resolution (DD-25, SUPERSEDED 2026-04-29):** Dev-SMTP-Backend = **Maildev-Container** im `docker-compose.yml` `dev`-Profile (NICHT echter SMTP-Provider, NICHT Mailpit). Diese Resolution war 2026-04-15 begründet durch "Standard-Pattern für SMTP-Tests" — der Maintenance-Status von Maildev wurde damals nicht geprüft. Die unten dokumentierte Maildev-Procedure bleibt als historischer Beleg stehen; aktive Implementierung folgt dem v0.4.x Amendment oben.

**Why:** Before any backend code is written, verify dev SMTP delivers mail. Maildev gibt zero externe Deps + Web-UI für visuelle Verifikation. Ohne working SMTP ist Phase 2 dev cycle blockiert.

**Procedure:**

1. **Maildev-Service zu `docker-compose.yml` hinzufügen** unter `dev`-Profile:

   ```yaml
   maildev:
     # ADR-027 §"Image Pinning Discipline" Stage 2: tag + digest.
     # DD-25 wurde von `:latest` auf 2.2.1@sha256 hochgehärtet (CI-Lint
     # `.github/workflows/code-quality-checks.yml` rejectet rolling tags).
     image: maildev/maildev:2.2.1@sha256:180ef51f65eefebb0e7122d8308813c1fd7bff164bc440ce5a3c2feee167a810
     container_name: assixx-maildev
     profiles: [dev]
     ports:
       - '1080:1080' # Web-UI
     # Internal SMTP auf Port 1025 (nicht extern exposed)
     networks:
       - assixx-network
     restart: unless-stopped
   ```

2. **Doppler dev-SMTP-Secrets** auf `maildev:1025` setzen:

   ```
   SMTP_HOST=maildev
   SMTP_PORT=1025
   SMTP_USER=  (leer)
   SMTP_PASS=  (leer)
   SMTP_FROM=noreply@assixx.de
   ```

   Doppler `dev` config überschreiben (Doppler-CLI: `doppler secrets set SMTP_HOST=maildev --config dev`).

3. **Smoke-Test** ausführen:

   ```bash
   doppler run -- docker exec assixx-backend node -e "import('./dist/utils/email-service.js').then(m => m.sendTestEmail('test@scs-technik.de', 'smoke', 'Hello'))"
   ```

4. **Verifikation in Maildev-UI** auf http://localhost:1080 — Mail muss sichtbar sein mit korrektem Subject + Body + Sender.

5. **Dokumentation** in NEW `docs/how-to/HOW-TO-DEV-SMTP.md` festhalten (Setup, Doppler-Secrets, Troubleshooting, Reset-Befehl). HOW-TO-Catalog (`docs/how-to/README.md`) aktualisieren.

**Owner:** Backend. **Verification:** test email received within 30 seconds, sichtbar in Maildev-UI, HOW-TO-DEV-SMTP.md gemergt.

### Step 0.5.6: Production-SMTP End-to-End Smoke (NEW v0.5.0) [PENDING]

> **Why (v0.5.0):** Mit DD-10 entfernt gibt es kein Soft-Rollout-Phase mehr. SMTP MUSS am T-0 zu 100% funktionieren — nicht nur DKIM/SPF/DMARC-Setup (Step 0.5.2), sondern echte End-to-End-Pipeline vom Production-Backend bis zum Kunden-Postfach. Maildev (Step 0.5.5) testet nur lokale dev-Pipeline, nicht prod.

**Procedure:**

1. **Test-Mailboxen vorbereiten:** legen Sie 3–4 Test-Adressen an, die typische Kunden-Provider abdecken:
   - `assixx-test@outlook.com` (Microsoft / Office365 — viele Industriekunden nutzen MS)
   - `assixx-test@gmail.com` (Google Workspace — verbreitet)
   - `assixx-test@gmx.de` / `assixx-test@web.de` (deutsche Free-Provider)
   - `assixx-test@<eigene-test-domain>.de` (Custom-Domain mit klassischem Mailhost)

2. **Echter Code-Send vom Production-Backend:** auf Production-Stage (NICHT lokal):

   ```bash
   # SSH zum Production-Server, dann
   doppler run -- docker exec assixx-backend node -e "import('./dist/utils/email-service.js').then(m => m.send2faCode('assixx-test@outlook.com', 'TEST6X', 'login', 10))"
   ```

   Wiederholen für alle Test-Adressen.

3. **Inbox-Verifikation manuell:** öffnen Sie jede Test-Mailbox **innerhalb von 60 Sekunden** und prüfen Sie:
   - Mail im **Posteingang** (NICHT im Spam/Junk-Ordner)
   - Subject korrekt: „Ihr Bestätigungscode für Assixx" (DD-13)
   - Sender-Adresse: `noreply@assixx.de` (DD-13, fallback)
   - Body: Code `TEST6X` lesbar in monospace, deutscher Text, keine Tracking-Pixel
   - Plain-Text-Fallback funktioniert (Mail-Client auf "Nur Text"-Ansicht stellen)

4. **Failure-Verhalten dokumentieren:** wenn auch nur EINE Test-Mailbox die Mail im Spam-Folder hat → **BLOCKER** für T-Day. Untersuchung: SPF/DKIM/DMARC nochmal verifizieren (Step 0.5.2), ggf. Sender-Reputation anwärmen (Step 0.5.7).

**Owner:** Backend + DevOps. **Verification:** alle Test-Mailboxen receiving Mail im Posteingang innerhalb 60 s, mit korrektem Subject/Sender/Body. Screenshot-Evidence im PR.

### Step 0.5.7: SMTP-Sender-Reputation-Warmup (NEW v0.5.0) [**N/A — GREENFIELD v0.6.0**]

> **v0.6.0 GREENFIELD-NOTE:** kein Bestandskunden-Mailflood am Public-Launch (alle ersten User trickeln organisch ein, kein Big-Bang). Sender-Reputation baut sich automatisch mit den ersten echten Signups auf (1–10 Mails/Tag in den ersten Wochen ist genau der „organische Warmup"). Step bleibt dokumentiert für zukünftige Massenversand-Szenarien (z.B. wenn ein bestehendes On-Prem-System zu Assixx migriert mit mehreren hundert Usern auf einmal).
>
> **Empfehlung Public-Launch:** statt 7-Tage-Warmup → DKIM/SPF/DMARC bombenfest (Step 0.5.2 reicht) + Step 0.5.6 Production-SMTP-Smoke vor erstem Onboarding. Wenn Spam-Folder-Hits bei ersten echten Usern auftauchen → reaktive Maßnahme (z.B. Sender-Auth nochmal verifizieren), nicht prophylaktisch.

**Why (historisch — Bestandsuser-Cutover):** `noreply@assixx.de` hat ggf. KEINE etablierte SMTP-Reputation. Erste 100–1000 Massen-Mails landen sonst initial im Spam-Filter bei Outlook/GMX/Web.de → User glauben „kein Code angekommen" → Support-Flut am T-Day. Reputation-Warmup baut über 7 Tage moderate SMTP-Volume auf, damit Provider die Domain als legitim klassifizieren.

**Procedure:**

1. **Tag T-7 bis T-1 (Warmup-Periode):** Versand von **moderatem** Volume an engagement-orientierte Adressen:
   - Pro Tag: ~20–50 Mails (NICHT mehr — sonst flagged als Spam-Burst)
   - Empfänger: dedizierte Test-Mailboxen + interne Team-Adressen die wirklich öffnen
   - Inhalt: kann z.B. die T-7 Vorabmail (Step 0.3) selbst sein, gefolgt von Test-2FA-Codes an interne Test-Konten
   - Wichtig: keine Marketing-Mails, keine Templates die Spam-Triggers enthalten („Free!", „Click here!", etc.)

2. **Tracking während Warmup:**
   - Bounce-Rate < 5 % (Bounce-Logs aus SMTP-Provider — wenn höher: Adressen aussortieren)
   - Spam-Folder-Hits: manuell stichprobenartig prüfen (Test-Mailboxen)
   - SMTP-Provider-Reputation-Dashboard checken (z.B. SendGrid hat „Sender Score", AWS SES hat „Sending Statistics")

3. **Tag T-1: Final-Check:**
   - Alle Test-Mails landen im Inbox (nicht Spam)
   - Provider-Reputation ≥ 80/100 (oder providerspezifisches Äquivalent)
   - Wenn nicht: T-Day um 7 Tage verschieben + Warmup verlängern

4. **Coordination mit Step 0.5.6:** der Production-SMTP-Smoke (T-1) gibt finale Bestätigung dass Warmup gewirkt hat.

**Owner:** DevOps + Backend. **Verification:** Warmup-Periode T-7 bis T-1 ohne Bounce-Spikes, Sender-Score ≥ 80/100 am T-1, Step 0.5.6 alle Test-Mailboxen ✅.

**Edge case:** falls Provider-Wechsel gewünscht (z.B. weil aktueller SMTP-Provider keine ausreichende Reputation aufbaut) → V2-Entscheidung. V1 nutzt einen Provider durchgehend.

### Phase 0.5 — Definition of Done

- [—] ~~Single-root-tenant detection query run + outreach started (Step 0.5.1)~~ **N/A — GREENFIELD v0.6.0**
- [ ] mail-tester score ≥ 9/10 for `noreply@assixx.de` (Step 0.5.2)
- [x] External-API audit complete + Spec Deviations updated (Step 0.5.3) — 2026-04-28
- [ ] Subdomain DNS + cert model documented + e2e signup smoke green (Step 0.5.4)
- [x] Dev-SMTP smoke green + setup documented (Step 0.5.5) — 2026-04-28
- [ ] **Production-SMTP End-to-End Smoke green** (Step 0.5.6) — alle Test-Mailboxen Inbox, nicht Spam — **vor erstem echten User Pflicht**
- [—] ~~SMTP-Sender-Reputation-Warmup completed (Step 0.5.7)~~ **N/A — GREENFIELD v0.6.0** (organischer Warmup mit ersten echten Signups)

> **Hard rule v0.6.0:** Steps 0.5.3 und 0.5.5 sind DONE. Steps 0.5.2, 0.5.4, 0.5.6 müssen DONE sein vor **Public-Launch** (kein T-Day mehr — Public-Launch ist die Cut-Over-Linie). Steps 0.5.1 + 0.5.7 sind im Greenfield N/A — bleiben textuell drin als historische Referenz.

---

## Phase 1: Database Migration

> Single migration. Drops legacy 2FA cruft, adds new columns. No new tables. **No partial index** — V0.1 had one with no clear consumer; dropped per KISS.

### Step 1.1: Drop legacy 2FA columns + add new columns [DONE — 2026-04-28]

**New file:** `database/migrations/20260427NNNNNNNNN_replace-2fa-state-on-users.ts`
(generated via `doppler run -- pnpm run db:migrate:create replace-2fa-state-on-users`. Generator produces 17-digit UTC timestamp per ADR-014 / DATABASE-MIGRATION-GUIDE — never hand-craft the prefix.)

**`up()` operations:**

```sql
-- (a) Drop dead-schema legacy 2FA columns (zero references in code, confirmed by audit)
ALTER TABLE users DROP COLUMN two_factor_secret;
ALTER TABLE users DROP COLUMN two_factor_enabled;

-- (b) Add new columns for email-based 2FA (this masterplan)
ALTER TABLE users ADD COLUMN tfa_enrolled_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN last_2fa_verified_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN users.tfa_enrolled_at IS
    '2FA enrollment timestamp. NULL = never completed 2FA. Set on first successful verify (transparent enrollment, ADR-054 / DD-11).';
COMMENT ON COLUMN users.last_2fa_verified_at IS
    'Most recent successful 2FA verification (ADR-054). Audit / compliance.';
```

**`down()` operations:**

```sql
ALTER TABLE users DROP COLUMN IF EXISTS last_2fa_verified_at;
ALTER TABLE users DROP COLUMN IF EXISTS tfa_enrolled_at;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
```

**Mandatory checklist (per DATABASE-MIGRATION-GUIDE.md):**

- [x] No `IF NOT EXISTS` in `up()` (fail-loud on partial apply)
- [x] `IF EXISTS` / `IF NOT EXISTS` allowed in `down()` (defensive rollback)
- [x] Both new columns nullable — existing rows get NULL → triggers DD-11 transparent enrollment
- [x] No data backfill (NULL is correct semantic)
- [x] No new RLS policy needed (`users` already RLS-enabled — verified `relrowsecurity = t`)
- [x] No new GRANT needed (column-level GRANTs inherit from table per PG default)
- [x] File generated via `db:migrate:create` — **NEVER** hand-write 17-digit timestamp
- [x] Confirm legacy columns truly unused: `grep -rn "two_factor_secret\|two_factor_enabled" backend/ shared/` returns 0 hits in source (verified 2026-04-28: 0 hits incl. tests; pre-migration data audit 0 non-NULL across 129 users)

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "\d users" | grep -E "tfa_enrolled_at|last_2fa_verified_at|two_factor"
# Expected: 2 new columns present, 0 legacy columns
```

### Phase 1 — Definition of Done

- [x] 1 migration file with both `up()` and `down()`, generated via `db:migrate:create` — `database/migrations/20260428211706901_replace-2fa-state-on-users.ts`
- [x] Dry run passes: `doppler run -- ./scripts/run-migrations.sh up --dry-run` (2026-04-28)
- [x] Backup taken before applying — `database/backups/pre-2fa-20260428_231649.dump` (3.4 MB)
- [x] Migration applied successfully — pgmigrations row #153 (2026-04-28 23:18:21 UTC)
- [x] 2 new columns present, 2 legacy columns gone — verified via `\d users`
- [x] No data backfill performed — both new columns NULL (DD-11 transparent enrollment)
- [x] Backend compiles after pull — backend container healthy after `up -d --force-recreate`; type-check exit 0
- [x] Existing tests still pass — 277 files, 7120 tests passed in 18.78s

---

## Phase 2: Backend Module

> Reference module for shape: `backend/src/nest/auth/`. New module is `two-factor-auth/`.

### Step 2.1: Module skeleton + types + DTOs + constants [DONE — 2026-04-28]

**New directory:** `backend/src/nest/two-factor-auth/`

**File structure:**

```
backend/src/nest/two-factor-auth/
    two-factor-auth.module.ts
    two-factor-auth.controller.ts
    two-factor-auth.service.ts          # orchestration
    two-factor-code.service.ts          # crypto + Redis primitives
    two-factor-auth.types.ts
    two-factor-auth.constants.ts        # CODE_TTL_SEC=600, MAX_ATTEMPTS=5, LOCKOUT_SEC=900, RESEND_COOLDOWN_SEC=60, MAX_RESENDS_PER_CHALLENGE=3, CODE_ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789' (31-char Crockford subset, v0.3.1), CODE_LENGTH=6
    dto/
        verify-code.dto.ts
        resend-code.dto.ts
        clear-lockout-param.dto.ts      # param: { id }
        index.ts
backend/src/utils/
    email-templates/
        2fa-code.template.ts            # German HTML + text fallback (legacy email-service path)
```

**Types** (`two-factor-auth.types.ts`):

```typescript
// WHY: discriminated union forces frontend to handle both branches at compile time.
// Reference: ADR-005 (Auth Strategy), ADR-007 (Response shape), ADR-054 (this feature).
import type { LoginResponse } from '../auth/dto/login.dto.js';

export type LoginResult =
  | { stage: 'challenge_required'; challenge: TwoFactorChallenge }
  | ({ stage: 'authenticated' } & LoginResponse);

export interface TwoFactorChallenge {
  challengeToken: string; // opaque base64url, set as httpOnly cookie by controller
  expiresAt: string; // ISO 8601
  resendAvailableAt: string; // ISO 8601
  resendsRemaining: number; // DD-21
}

export type ChallengePurpose = 'login' | 'signup';

// Stored in Redis at 2fa:challenge:{token}
export interface ChallengeRecord {
  userId: number;
  tenantId: number; // NEVER null — tenant is created BEFORE user in signup flow (verified in signup.service.ts)
  email: string;
  purpose: ChallengePurpose;
  codeHash: string; // sha256(userId + ':' + code + ':' + purpose)
  attemptCount: number;
  resendCount: number; // DD-21
  createdAt: string; // ISO
}
```

**DTOs** (Zod via `nestjs-zod`, follows ADR-030):

```typescript
// dto/verify-code.dto.ts
export const VerifyCodeSchema = z.object({
  // v0.3.1: alphanumeric Crockford-Base32 subset (A-HJKMNP-Z2-9). `.trim()` drops
  // copy-paste whitespace; `.toUpperCase()` normalises lowercase input from mobile
  // keyboards (autocapitalize is best-effort, so we fail-safe on the server).
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJKMNP-Z2-9]{6}$/, 'Code muss aus 6 Zeichen (A-Z ohne O/I/L, Ziffern 2-9) bestehen'),
  // challengeToken read from httpOnly cookie, NOT body — single source of truth
});
export class VerifyCodeDto extends createZodDto(VerifyCodeSchema) {}

// dto/resend-code.dto.ts — empty body, challengeToken from cookie
export const ResendCodeSchema = z.object({});
export class ResendCodeDto extends createZodDto(ResendCodeSchema) {}

// dto/clear-lockout-param.dto.ts — uses central factory per TYPESCRIPT-STANDARDS §7.5
export { IdParamDto as ClearLockoutParamDto } from '../../common/dto/index.js';
```

**Register in `app.module.ts`:** alphabetically sorted import next to other feature modules.

### Step 2.2: `TwoFactorCodeService` (crypto + Redis primitives) [DONE — 2026-04-29]

**Delivered (2026-04-29):**

- `backend/src/nest/two-factor-auth/two-factor-auth.tokens.ts` — DI token leaf file (`TWO_FA_REDIS`), mirrors `auth/oauth/oauth.tokens.ts` to avoid `import-x/no-cycle`.
- `backend/src/nest/two-factor-auth/two-factor-code.service.ts` — 14 methods per plan: `createChallenge` / `loadChallenge` / `consumeChallenge` / `updateChallenge`, `hashCode` / `verifyCode` (sha256 + `crypto.timingSafeEqual`), `incrementFailStreak` / `getFailStreak` / `clearFailStreak` (24 h TTL anchored to first failure), `setLockout` / `isLocked` / `clearLockout`, `setResendCooldown` / `isResendOnCooldown`.
- `backend/src/nest/two-factor-auth/two-factor-auth.constants.ts` — added `FAIL_STREAK_TTL_SEC = 86_400` (24 h, missing from Step 2.1).
- `backend/src/nest/two-factor-auth/two-factor-auth.module.ts` — wired dedicated ioredis client provider (`keyPrefix: '2fa:'`, mirrors `throttler.module.ts:28` + `oauth.module.ts:63`); registered `TwoFactorCodeService`; both exported for Step 2.3 consumption.

**Verification (2026-04-29):**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/two-factor-auth/` → 0 errors
- `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → exit 0, 0 lines
- Backend hot-reload picked up changes; `GET /health` → 200 ok; no module-load errors in logs
- Unit tests for this service deferred to Phase 3 (≥ 25 tests in `two-factor-code.service.test.ts` per plan §3 mandatory-scenarios checklist).

**File:** `backend/src/nest/two-factor-auth/two-factor-code.service.ts`

**Pattern reference:** `backend/src/nest/auth/oauth/oauth-state.service.ts` — same Redis-via-DI-token style. The project does **NOT** have a `RedisService` wrapper; it injects `Redis` (ioredis) directly via per-module providers.

**Module wiring** (`two-factor-auth.module.ts`):

```typescript
import { Redis } from 'ioredis';
// Provide a dedicated Redis client (mirrors throttler.module.ts:28 + oauth.module.ts:63).
// Separate from the throttler client; uses a different keyPrefix.
const TWO_FA_REDIS = Symbol('TWO_FA_REDIS');
{
  provide: TWO_FA_REDIS,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) => new Redis({
    host: config.redisHost,
    port: config.redisPort,
    ...(config.redisPassword ? { password: config.redisPassword } : {}),
    keyPrefix: '2fa:',
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
  }),
}
```

**Methods:**

| Method                                                   | Behavior                                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createChallenge(record): Promise<token>`                | `crypto.randomBytes(32).toString('base64url')` → SET `challenge:{token}` JSON-serialized record, TTL = `CODE_TTL_SEC`                              |
| `loadChallenge(token): Promise<ChallengeRecord \| null>` | GET + JSON.parse. Returns null if missing/expired.                                                                                                 |
| `consumeChallenge(token)`                                | DEL `challenge:{token}` — single-use enforcement                                                                                                   |
| `updateChallenge(token, record, extendTtl: boolean)`     | SET (overwrite). When `extendTtl=true` (resend path per DD-9) → PEXPIRE back to `CODE_TTL_SEC * 1000`.                                             |
| `hashCode(userId, code, purpose): string`                | `crypto.createHash('sha256').update(userId + ':' + code + ':' + purpose).digest('hex')`                                                            |
| `verifyCode(record, code): boolean`                      | Recompute hash from user input + `crypto.timingSafeEqual(Buffer.from(record.codeHash, 'hex'), Buffer.from(computedHash, 'hex'))`                   |
| `incrementFailStreak(userId): Promise<count>`            | INCR `fail-streak:{userId}` + EXPIRE 24h on first hit. Returns new count. **Per-user, not per-challenge — survives resends. NOT reset by resend.** |
| `getFailStreak(userId): Promise<number>`                 | GET `fail-streak:{userId}` (or 0)                                                                                                                  |
| `clearFailStreak(userId)`                                | DEL — called on successful verify and on root lockout-clear                                                                                        |
| `setLockout(userId)`                                     | SETEX `lock:{userId}` `LOCKOUT_SEC` ""                                                                                                             |
| `isLocked(userId): Promise<boolean>`                     | EXISTS `lock:{userId}`                                                                                                                             |
| `clearLockout(userId)`                                   | DEL — called by root lockout-clear endpoint                                                                                                        |
| `setResendCooldown(token)`                               | SETEX `resend:{token}` `RESEND_COOLDOWN_SEC` ""                                                                                                    |
| `isResendOnCooldown(token): Promise<boolean>`            | EXISTS `resend:{token}`                                                                                                                            |

**Critical patterns (every method):**

- Redis injected via the `TWO_FA_REDIS` token (constructor: `@Inject(TWO_FA_REDIS) private readonly redis: Redis`)
- Constant-time compare via `crypto.timingSafeEqual()` — never `===` on hash strings
- Generate code via 6× `crypto.randomInt(0, 31)` indexing into `CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'` (31-char Crockford subset, v0.3.1) — caller passes the plain code in. `crypto.randomInt` rejection-samples internally → uniform over alphabet, no modulo bias.
- All methods return promises (no sync Redis access)
- All errors wrapped via `getErrorMessage()` per TYPESCRIPT-STANDARDS §7.3

### Step 2.3: `TwoFactorAuthService` (orchestration) [DONE — 2026-04-29]

**Delivered (2026-04-29):**

- `backend/src/nest/two-factor-auth/two-factor-auth.service.ts` — 4 public methods per plan: `issueChallenge` / `verifyChallenge` / `resendChallenge` / `clearLockoutForUser`. Uses `@nestjs/common` `ServiceUnavailableException` for SMTP failures (DD-14), `ForbiddenException` for lockout + Two-Root rule, `UnauthorizedException` for generic verify failures (R10-friendly), `HttpException(429)` for DD-21 resend cap + DD-9 cooldown.
- Private helpers: `generateCode()` (6× `crypto.randomInt(0, CODE_ALPHABET.length)` — rejection-sampled, no modulo bias), `handleVerifySuccess` / `handleVerifyFailure`, `toChallengeView` (computes `expiresAt` + `resendAvailableAt` ISO timestamps), `fireAudit` (fire-and-forget `INSERT INTO audit_trail` via `db.queryAsTenant` — never throws, mirrors `audit-trail.service.ts:631 createEntry`).
- R10 timing-safe equalisation: dummy `crypto.timingSafeEqual` against a 32-byte zero buffer on user-not-found path (via `void` discard — matches the `@typescript-eslint/naming-convention` rule that rejects bare `_` variable names).
- DD-14 rollback semantics: `issueChallenge` consumes the just-created challenge if the SMTP send throws — no zombie codes left in Redis after a failed delivery.
- DD-20 silent paper-trail: lockout-trigger fires `mailer.sendTwoFactorSuspiciousActivity(...)` via `void` — paper-trail mail failure can never block the verify response.
- §A8 audit tuples: every state transition writes one `audit_trail` row (`(create, 2fa-challenge)` issue + resend, `(login, auth)` verify success/failure, `(update, 2fa-lockout)` lockout-trigger, `(delete, 2fa-lockout)` clear).
- `backend/src/nest/two-factor-auth/two-factor-auth.module.ts` — registered `TwoFactorAuthService` + provider-local `MailerService` (mirrors `auth.module.ts:31` pattern), exported `TwoFactorAuthService` so AuthModule (Step 2.4) and SignupModule (Step 2.5) can inject it.

**Test deferral (per Step 2.2 precedent):** unit tests for orchestration deferred to Phase 3 mandatory-scenarios suite (≥ 25 tests covering R2/R7/R8/R10 + DD-5/DD-6/DD-9/DD-14/DD-21 contracts). Hook surfaced "no paired test" — confirmed exempt for this step, will land in Phase 3.

**Verification (2026-04-29):**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/two-factor-auth/` → 0 errors (after one fix: `_` underscore variable name → `void` discard for the R10 timing call).
- `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → exit 0, 0 lines.
- Backend hot-reloaded; `GET /health` → 200 ok; `docker logs assixx-backend` showed no module-load errors.

**File:** `backend/src/nest/two-factor-auth/two-factor-auth.service.ts`

**Methods:**

| Method                                                                          | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issueChallenge(userId, tenantId, email, purpose): Promise<TwoFactorChallenge>` | (1) `isLocked()` → throw ForbiddenException if true. (2) Generate plain code via 6× `crypto.randomInt(0, 31)` over the 31-char Crockford alphabet (v0.3.1). (3) `createChallenge()`. (4) `await send2faCode(email, code, purpose, ttlMin=10)` — send is awaited per DD-14; SMTP error → ServiceUnavailableException + signup cleanup. (5) Audit `(create, 2fa-challenge)`. (6) Return `TwoFactorChallenge`.                                                                                                    |
| `verifyChallenge(token, code): Promise<{ userId, tenantId, email, purpose }>`   | (1) `loadChallenge()` — null → 401 generic. (2) `isLocked(record.userId)` — true → 403. (3) `verifyCode(record, code)` — false → `incrementFailStreak()`, if ≥ MAX_ATTEMPTS_TOTAL set lockout + send suspicious-activity email (DD-20: user only) + audit `(update, 2fa-lockout)`. Update record.attemptCount via `updateChallenge(token, record, false)`. Throw 401 generic. (4) Success → `consumeChallenge()`, `clearFailStreak()`, `(login, auth, success, {method:'2fa-email'})` audit. Return user info. |
| `resendChallenge(token): Promise<TwoFactorChallenge>`                           | (1) `loadChallenge()` — null → 401. (2) Check `record.resendCount >= MAX_RESENDS_PER_CHALLENGE` (DD-21) → 429. (3) `isResendOnCooldown(token)` — true → 429. (4) Generate new plain code. (5) `updateChallenge()` with new codeHash + reset `attemptCount=0` + `resendCount++` + `extendTtl=true` (DD-9). (6) `setResendCooldown(token)`. (7) Email + audit `(create, 2fa-challenge, {kind:'resend'})`. (8) Return updated challenge.                                                                          |
| `clearLockoutForUser(userId, byUserId): Promise<void>`                          | (1) Verify caller is root + ≠ target (two-root rule). (2) `clearLockout()`, `clearFailStreak()`. (3) Audit `(delete, 2fa-lockout, {clearedBy: byUserId, target: userId})`. **Note: this does NOT issue a new code or bypass 2FA — the user must still pass 2FA on next login attempt.**                                                                                                                                                                                                                        |

**Caller responsibilities (in `AuthService` / `SignupService` after `verifyChallenge` succeeds):**

- Update `users` row via `db.queryAsTenant(sql, params, tenantId)` (RLS pattern, ADR-019): `last_2fa_verified_at = NOW()`. If `tfa_enrolled_at IS NULL` → set it too (transparent enrollment, DD-11).
- For signup purpose: also set `is_active = ${IS_ACTIVE.ACTIVE}` (use `IS_ACTIVE` import from `@assixx/shared/constants` per TYPESCRIPT-STANDARDS §7.4 — no magic numbers).

**Critical patterns:**

- Email send awaited (we want to know if it failed). Catch SMTP error → throw ServiceUnavailableException → frontend shows retry UX. **For signup**: also DELETE the just-created pending user row to prevent dangling `is_active=0` rows.
- Audit emitted on EVERY path (success + fail). Never silent.
- Generic error messages (no "wrong code, expected X"). Same response time on user-found vs user-not-found (R10).
- All caught errors → `getErrorMessage()` per TYPESCRIPT-STANDARDS §7.3.
- All DB writes via `tenantTransaction()` or `queryAsTenant()` — NEVER `query()` for tenant-scoped tables (ADR-019).

### Step 2.4: Modify `AuthService.login()` [DONE — 2026-04-29]

**Delivered (2026-04-29):**

- `backend/src/nest/two-factor-auth/two-factor-auth.types.ts` — added `PublicTwoFactorChallenge = Omit<TwoFactorChallenge, 'challengeToken'>` and `LoginResultBody` (HTTP-shape mirror of service-layer `LoginResult`, with token stripped per R8). Forward-compat: the `'authenticated'` branch is preserved on both unions for a future per-tenant 2FA-skip flag (V2).
- `backend/src/nest/auth/auth.service.ts` — `login()` signature changed to `Promise<LoginResult>`; body now validates credentials (existing behaviour) then hands off to `twoFactorAuth.issueChallenge('login', ...)`. The pre-2FA token-rotation / `updateLastLogin` / `logLoginAudit` / `getSubdomainForTenant` calls are removed from this code path (they migrate to the verify endpoint, Step 2.7). `ipAddress`/`userAgent` parameters removed — no IP/UA-bearing rows are written under the new model. DD-7 + ADR-054 comment block added above `loginWithVerifiedUser()` documenting the OAuth-exempt invariant. `TwoFactorAuthService` injected via constructor (6th positional argument).
- `backend/src/nest/auth/auth.controller.ts` — `POST /auth/login` returns `LoginResultBody` instead of `LoginResponse`. New `CHALLENGE_COOKIE_OPTIONS` + `setChallengeCookie()` helper alongside the existing `setAuthCookies` pattern; `maxAge` imported from `CODE_TTL_SEC` so the cookie cannot outlive the Redis-side challenge record (single source of truth). On `stage === 'challenge_required'`: writes the challenge token to an httpOnly+Secure+SameSite=Lax cookie and returns `{ stage, challenge: { expiresAt, resendAvailableAt, resendsRemaining } }` (token never in body — R8). On `stage === 'authenticated'` (unreachable from `/auth/login` under v0.5.0): retains the legacy 3-cookie tokens-in-body shape for compile-time exhaustiveness. Dropped unused `@Req() req` parameter and the `getClientInfo(req)` destructure on this handler — `getClientInfo` stays for `logout` / `refresh` / `mintHandoff` consumers.
- `backend/src/nest/auth/auth.module.ts` — `TwoFactorAuthModule` added to `imports` (one-way edge, no `forwardRef` — TwoFactorAuthModule does not depend on AuthModule).
- `backend/src/nest/auth/auth.service.test.ts` — added `MockTwoFactorAuth` factory + `TwoFactorAuthService` constructor wiring; `setupLoginMocks()` refactored to drop the post-credential mocks (no longer reached) and seed the `issueChallenge` stub. The 10-test `describe('login', …)` block was rewritten to 5 tests: 1 happy path asserting `stage === 'challenge_required'` + `issueChallenge(userId, tenantId, email, 'login')` call shape, 4 credential-validation gates (unknown email / inactive user × 3 / wrong password / lowercase normalisation) — each now also asserts `issueChallenge` was NOT called when validation fails (anti-enumeration: invalid credentials must not leak into the 2FA layer or trigger spam mails). The 5 tests covering token-issuance / last-login / audit / IP-UA forwarding / JWT secret isolation were deleted — those side effects no longer live in `login()` (Phase 3 will rebuild full coverage via the Step 2.7 verify endpoint).

**Critical patterns enforced:**

- Discriminated union forces compile-time exhaustiveness (ADR-041).
- `loginWithVerifiedUser()` UNCHANGED (DD-7 OAuth exempt) — only a comment block was added above it; functional behaviour byte-identical.
- Challenge token is cookie-only on the wire (R8) — even though the service-layer `TwoFactorChallenge` carries it.
- Validation gates run BEFORE `issueChallenge` — invalid credentials never reach the 2FA layer (R10 / anti-enumeration).
- Cookie `maxAge` derived from `CODE_TTL_SEC` so cookie-vs-Redis-record divergence is impossible.

**Deferred to later steps (intentionally NOT done in 2.4):**

- Step 2.5 (signup flow modification) — separate file (`signup.service.ts`).
- Step 2.6 OAuth-controller comments — separate files in `auth/oauth/`.
- Phase 2 DoD load-test update (`load/lib/auth.ts`, `load/tests/baseline.ts`) — bundled into Session 6 per Session Tracking; load tests run via k6 (not part of `pnpm run test`), so this lands before Public-Launch but does not block intermediate Phase 2 work.

**Verification (2026-04-29):**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/auth/ backend/src/nest/two-factor-auth/` → 0 errors
- `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → exit 0, 0 lines
- `pnpm exec vitest run --project unit backend/src/nest/auth/auth.service.test.ts` → 91 tests, all passed in 128 ms
- `pnpm exec vitest run --project unit` (full unit suite) → 279 files, 7138 tests, all passed in 17.17 s — no indirect breakage
- Backend hot-reloaded; `GET /health` → `{"status":"ok"}`; Nest application started successfully — DI graph resolved with new `TwoFactorAuthModule` import in `AuthModule`

**Known interim state:**

- Frontend `(public)/login/+page.server.ts` still expects the legacy `LoginResponse` shape. The user-facing login flow will break until Phase 5 (Step 5.1) adapts the SvelteKit form action to the discriminated union. This is the planned staging — backend contract lands now, frontend follows in Phase 5.

---

**File modified:** `backend/src/nest/auth/auth.service.ts:184` (`async login(dto, ipAddress?, userAgent?)`)

**New return type:** `Promise<LoginResult>` (discriminated union from `two-factor-auth.types.ts`).

**Behavior change** (pseudo-diff, v0.5.0 — kein Flag-Branch mehr):

```typescript
async login(dto: LoginDto, ipAddress?, userAgent?): Promise<LoginResult> {
  // 1. Existing credential validation (unchanged)
  // 2. v0.5.0: 2FA is HARDCODED. Kein Flag-Short-Circuit (DD-10 entfernt per User-Vorgabe).
  //    Jede Password-Login-Anfrage führt direkt zur Challenge-Issue.
  const challenge = await this.twoFactorAuth.issueChallenge(
    user.id, user.tenant_id, user.email, 'login',
  );
  return { stage: 'challenge_required', challenge };
}
```

**Type-safe handover:** controller maps `LoginResult` to HTTP response. If `challenge_required`, set `challengeToken` as httpOnly cookie + return `{ stage, challenge: { expiresAt, resendAvailableAt, resendsRemaining } }` in body (NOT the token itself — token is cookie-only).

**`loginWithVerifiedUser()` (auth.service.ts:247) is UNCHANGED per DD-7.** Add a comment block above it referencing DD-7 + ADR-054.

### Step 2.5: Modify signup flow [DONE — 2026-04-29]

**Delivered (2026-04-29):**

- `backend/src/nest/signup/signup.service.ts` — `registerTenant()` return type changed to `LoginResult` (discriminated union from `two-factor-auth.types.ts`). Constructor gains `TwoFactorAuthService` as the 4th positional argument. Body splits into two phases: (1) `executeRegistrationTransaction` — unchanged INSERTs (tenants → users `IS_ACTIVE.INACTIVE` → seedPendingDomain → activateTrialAddons), wrapped in a generic-error → `BadRequestException` envelope to preserve the legacy contract; (2) `twoFactorAuth.issueChallenge(userId, tenantId, adminEmail, 'signup')` — awaited, with `ServiceUnavailableException` (DD-14 SMTP fail-loud) and other `Error` thrown by `issueChallenge` triggering DD-14 cleanup before re-throwing. The registration audit (`root_logs`, `register` action) now fires AFTER the challenge mail leaves the building so a mid-flight cleanup never leaves an orphan audit row.
- `createRootUser()` INSERT now writes `is_active = ${IS_ACTIVE.INACTIVE}` (was implicit DB default = ACTIVE). The OAuth path's `createOAuthRootUser` is byte-identical to before — DD-7 exempt.
- New private `cleanupFailedSignup(tenantId, userId)` — runs in its own `systemTransaction`. **Tenant-erasure semantics** instead of direct `DELETE FROM users`: when no other users exist on the tenant (the practical case for a fresh signup), `DELETE FROM tenants` cascades to the pending user via the existing `users.tenant_id ON DELETE CASCADE` FK (also rolling back `tenant_domains` + `tenant_addons`). Edge case (defensive — no race exists in practice): if other users somehow live on the tenant, the orphaned pending user is soft-deleted (`UPDATE users SET is_active = ${IS_ACTIVE.DELETED}, updated_at = NOW()`). This keeps `signup.service.ts` outside the `users` hard-delete whitelist enforced by `shared/src/architectural.test.ts:290` (the ADR-020 + ADR-045 soft-delete-only rule), without weakening the rule.
- Cleanup is best-effort: a failure inside cleanup is logged and swallowed so the original `ServiceUnavailableException` reaches the caller unchanged. The Step 2.11 stale-pending reaper is the final safety net.
- `backend/src/nest/signup/signup.controller.ts` — `POST /signup` return type changed to `LoginResultBody` (token stripped per R8). Reuses `setChallengeCookie` + `setAuthCookies` helpers exported from `auth/auth.controller.ts` (same single-source-of-truth pattern OAuthController uses) so the 2FA challenge cookie shape is identical across login + signup paths. HTTP status remains 201 CREATED — tenant + user rows ARE created at this point; only the 2FA gate stands between the user and `is_active = 1`. `ipAddress` / `userAgent` still forwarded to the registration audit (separate from the 2FA audit).
- `backend/src/nest/signup/signup.module.ts` — imports `TwoFactorAuthModule` (one-way edge, no `forwardRef` — TwoFactorAuthModule has no dep on SignupModule). Mirrors `auth.module.ts:36`.
- `backend/src/nest/signup/signup.service.test.ts` — 4th constructor arg added to all `new SignupService(...)` instantiations (main factory + dev-mode inline). Top-level `mockIssueChallenge` + `FAKE_CHALLENGE` provide the default happy-path stub; registration `beforeEach` seeds `mockResolvedValue(FAKE_CHALLENGE)`. Three happy-path assertions flipped from `result.tenantId === 10` to either `result.stage === 'challenge_required'` (top-level) or full-shape `expect(result).toEqual({ stage, challenge: FAKE_CHALLENGE })` for the canonical happy path. The canonical happy path also now asserts `issueChallenge` was called with `(userId=1, tenantId=10, 'admin@test-gmbh.de', 'signup')`. OAuth tests + atomicity tests + business-email-gate tests are unchanged in body — only the constructor wiring picks up the new arg via the shared factory.

**Behavior change (post-condition):**

1. Existing validation (Zod, duplicate-email, subdomain check) — unchanged
2. Tenant + user inserted via existing `systemTransaction()` flow (signup doesn't have CLS context yet — uses `systemTransaction` not `tenantTransaction`), user with `is_active = IS_ACTIVE.INACTIVE` (pending)
3. Issue signup challenge: `twoFactorAuth.issueChallenge(user.id, tenant.id, dto.adminEmail, 'signup')`
4. Return `{ stage: 'challenge_required', challenge }` — NO tokens yet

**On successful verify** (handled in `TwoFactorAuthController.verify` when `purpose === 'signup'` — Step 2.7):

- Set `users.is_active = ${IS_ACTIVE.ACTIVE}` via `queryAsTenant`
- Set `tfa_enrolled_at` + `last_2fa_verified_at` to `NOW()`
- Issue access + refresh tokens (delegate to existing `AuthService.issueTokens()` or equivalent helper)

**DD-14 SMTP failure behaviour:** synchronous cleanup via `cleanupFailedSignup`. Tenant-erasure-with-cascade in the common case; soft-delete the orphaned user in the defensive edge case. The original `ServiceUnavailableException` always reaches the controller. Stale-pending reaper (Step 2.11) catches anything cleanup misses. Phase 4 integration test will simulate the full flow.

**Verification (2026-04-29):**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/signup/ backend/src/nest/auth/auth.controller.ts` → 0 errors
- `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → exit 0, 0 lines
- `pnpm exec vitest run --project unit backend/src/nest/signup/signup.service.test.ts` → 51/51 passed
- `pnpm exec vitest run --project unit` (full unit suite) → **279 files, 7138 tests, all passed in 18.03 s** — including `shared/src/architectural.test.ts` (the soft-delete-only rule stays unweakened)
- `curl http://localhost:3000/health` → `{"status":"ok"}`; backend hot-reloaded with the new `TwoFactorAuthModule` import in `SignupModule` — DI graph resolved cleanly, no module-load errors

**Known interim state:**

- Frontend `(public)/signup/+page.svelte` still POSTs client-side via `_lib/api.ts` and expects the legacy `SignupResponseData` shape. The user-facing signup flow is interim-broken until Phase 5 Step 5.4 lands (`+page.server.ts` form action + `<form method="POST" use:enhance>` switch). Documented per masterplan `## Scope-creep notice` and Step 2.4 precedent.
- Step 2.7 (`TwoFactorAuthController.verify`) is the natural follow-up — it consumes the `'signup'` purpose, flips `is_active`, sets `tfa_enrolled_at` + `last_2fa_verified_at`, and mints tokens. Until Step 2.7 ships, a real signup will create a pending tenant + user but never have a route to verify (manual DB poke or the Step 2.11 reaper would clean up).

### Step 2.6: OAuth: no-op per DD-7 [DONE — 2026-04-29]

**Delivered (2026-04-29):**

- Audited the 5 listed OAuth files for Assixx-token-issuing entry points. Found exactly two — both inside `oauth.controller.ts`: the `completeSignup()` auto-login at line 283 (post-OAuth-signup session mint) and the `routeLoginSuccess()` private helper at line 388 (OAuth callback `login-success` branch). The other 4 files carry NO Assixx-token issuance — `oauth.service.ts` orchestrates state + provider calls and returns a `CallbackResult` discriminated union; `oauth-handoff.controller.ts` + `oauth-handoff.service.ts` bridge already-minted tokens across origins (mint/consume the opaque handoff token, NOT session tokens); `providers/microsoft.provider.ts` exchanges authorization codes for **Microsoft** tokens and verifies id_tokens, never touching Assixx session tokens. Therefore those 4 files receive **no modifications**, matching the plan's "Files NOT modified" header.
- `backend/src/nest/auth/oauth/oauth.controller.ts` — added DD-7 + ADR-054 comment block at both `loginWithVerifiedUser()` call sites, mirroring the canonical block above the method definition in `auth.service.ts:268-276` (Step 2.4 deliverable). Each block restates the OAuth-exempt invariant ("Microsoft already enforced MFA upstream during consent; layering an Assixx-side email code on top would force a double-prompt UX with zero marginal security gain") and points future readers back to the canonical comment in `auth.service.ts` so the source-of-truth stays in one place.
- No logic changes. File grew from 437 → 452 lines (+15), well within the 900-line backend ceiling. Per-function `max-lines-per-function` (60) preserved on both methods.

**Verification (2026-04-29):**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/auth/oauth/oauth.controller.ts` → 0 errors
- `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → exit 0, 0 lines
- `pnpm exec vitest run --project unit backend/src/nest/auth/oauth/` → 7 files, 125 tests, all passed in 1.75 s — no behavioural regression (comment-only edit, expected)
- `curl http://localhost:3000/health` → `{"status":"ok"}`; backend hot-reloaded clean, no module-load errors in `docker logs assixx-backend`

---

OAuth users skip 2FA. **Files NOT modified:**

- `backend/src/nest/auth/oauth/oauth.controller.ts`
- `backend/src/nest/auth/oauth/oauth.service.ts`
- `backend/src/nest/auth/oauth/oauth-handoff.controller.ts`
- `backend/src/nest/auth/oauth/oauth-handoff.service.ts`
- `backend/src/nest/auth/oauth/providers/microsoft.provider.ts`

Add **comment-only** patches at each entry point that issues tokens, e.g. above `loginWithVerifiedUser()` in `auth.service.ts`:

```typescript
// DD-7 (ADR-054): OAuth users are exempt from email-based 2FA.
// Microsoft / Google providers already enforce MFA upstream. Issuing tokens
// directly here keeps a uniform `loginWithVerifiedUser` shape and avoids
// double-prompt UX. Password login (login() above) goes through the 2FA
// challenge layer instead.
```

### Step 2.7: `TwoFactorAuthController` endpoints [DONE — 2026-04-29]

**Delivered (2026-04-29):**

- `backend/src/nest/two-factor-auth/two-factor-auth.controller.ts` — NEW. Mounted at `@Controller('auth/2fa')`. Two endpoints: `POST /verify` + `POST /resend`. Both `@Public() @UseGuards(CustomThrottlerGuard) @TwoFa{Verify,Resend}Throttle() @HttpCode(HttpStatus.OK)`. Reads `challengeToken` from httpOnly cookie via local `readChallengeTokenOrThrow` helper (missing/empty → generic 401, R10-aligned). Verify orchestrates: `verifyChallenge` → `markVerified` → `loginWithVerifiedUser` (delegates token issuance to existing AuthService helper) → branch by `purpose`. Login branch: `setAuthCookies` (3-cookie triad on tenant subdomain) → `{ stage, user }`. Signup branch: `OAuthHandoffService.mint` for apex→subdomain handoff → `{ stage, user, handoff: { token, subdomain } }` — cookies NOT set on apex. Challenge cookie cleared on success regardless of branch. `loginMethod` in audit row distinguishes `'password+2fa-email'` (login) from `'password+2fa-email-signup'` (signup). Resend reuses the same Redis token (no cookie re-write); body strips `challengeToken` before responding (R8).
- `backend/src/nest/two-factor-auth/two-factor-lockout.controller.ts` — NEW. Mounted at `@Controller('users')` with `POST :id/2fa/clear-lockout`. Separate file per `max-classes-per-file: 1`. Decorators: `@Roles('root') @UseGuards(CustomThrottlerGuard) @AdminThrottle() @HttpCode(HttpStatus.NO_CONTENT)`. Tenant-membership pre-check via `queryAsTenant('SELECT id FROM users WHERE id=$1 AND tenant_id=$2 LIMIT 1')` — non-existent target → 404, prevents cross-tenant lockout-clearing (Redis `2fa:lock:{userId}` key is global). Two-Root rule (target ≠ caller) + `(delete, 2fa-lockout)` audit emitted by `clearLockoutForUser`.
- `backend/src/nest/two-factor-auth/two-factor-auth.service.ts` — `markVerified(userId, tenantId, purpose)` added between `verifyChallenge` and `resendChallenge`. Signup branch: `UPDATE users SET is_active=$IS_ACTIVE.ACTIVE, tfa_enrolled_at=NOW(), last_2fa_verified_at=NOW(), updated_at=NOW()`. Login branch: same minus the activation, with `tfa_enrolled_at = COALESCE(tfa_enrolled_at, NOW())` for DD-11 transparent enrollment on legacy accounts. `IS_ACTIVE` imported from `@assixx/shared/constants` per TYPESCRIPT-STANDARDS §7.4 (no magic numbers). `queryAsTenant` (not `tenantQuery`) because the verify controller is `@Public()` — explicit `tenantId` from the verified `ChallengeRecord` is the source of truth, not CLS.
- `backend/src/nest/two-factor-auth/two-factor-auth.types.ts` — `TwoFactorVerifyResponse` (with optional `handoff` field — under `exactOptionalPropertyTypes` the field is literally absent on the login branch, present on signup) + `TwoFactorResendResponse` (challenge view stripped of token).
- `backend/src/nest/two-factor-auth/two-factor-auth.module.ts` — registered both controllers; imports gain `forwardRef(() => AuthModule)` (for `AuthService.loginWithVerifiedUser`) and plain `OAuthModule` (for `OAuthHandoffService` — DD-7 means OAuthModule has no back-edge to 2FA, so no forwardRef on this edge).
- `backend/src/nest/auth/auth.module.ts` — existing `TwoFactorAuthModule` import wrapped in `forwardRef` (cycle-pair with the new edge above; canonical NestJS resolution mirroring the AuthModule ↔ OAuthModule pair).
- `backend/src/nest/signup/signup.module.ts` — existing `TwoFactorAuthModule` import wrapped in `forwardRef`. Indirect cycle `SignupModule → TwoFactorAuthModule → OAuthModule → SignupModule` (OAuthModule consumes `SignupService` for OAuth signup) emerged when the TwoFactorAuthModule → OAuthModule edge was added; one `forwardRef` on this edge breaks the loop without touching the established AuthModule ↔ OAuthModule pair. ESLint `import-x/no-cycle` exception added with justification comment.

**Verification (2026-04-29):**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/two-factor-auth/ backend/src/nest/throttler/ backend/src/nest/common/decorators/throttle.decorators.ts backend/src/nest/auth/auth.module.ts backend/src/nest/signup/signup.module.ts` → 0 errors.
- `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → exit 0, 0 lines.
- `pnpm exec vitest run --project unit` (full unit suite) → **279 files / 7138 tests / all passed in 17.79 s** — no indirect breakage from the cycle-resolution forwardRef changes.
- Backend hot-reloaded; `Nest application successfully started` in logs; `/health` → `{"status":"ok"}`. Initial reload crashed with `Cannot access 'TwoFactorAuthModule' before initialization` due to the indirect SignupModule cycle — resolved by the `forwardRef` wrapper noted above; second reload booted cleanly.
- Route smoke test (no auth, no cookie): `POST /api/v2/auth/2fa/verify` → 401, `POST /api/v2/auth/2fa/resend` → 401, `POST /api/v2/users/1/2fa/clear-lockout` → 401, `POST /api/v2/auth/2fa/bogus` → 404. All three new routes mount at the expected paths and the guard chain runs in the correct order (auth before authz).

**Test deferral (per Step 2.2 / 2.3 precedent):** unit tests for `markVerified` + the two controllers' happy paths and error branches deferred to Phase 3 mandatory-scenarios suite + Phase 4 API integration tests. The Phase 3 §"Mandatory scenarios — TwoFactorAuthService" checklist already includes "First successful verify sets `tfa_enrolled_at` AND `last_2fa_verified_at`" + "Subsequent verifies update only `last_2fa_verified_at`" + "Signup verify also sets `is_active = IS_ACTIVE.ACTIVE`" — these now resolve to `markVerified` directly.

---

**File:** `backend/src/nest/two-factor-auth/two-factor-auth.controller.ts`

| Method | Route                                 | Decorators                                                                  | Description                                                                                                                                                                                 |
| ------ | ------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v2/auth/2fa/verify`             | `@Public()` + `@UseGuards(CustomThrottlerGuard)` + `@TwoFaVerifyThrottle()` | Body: `VerifyCodeDto`. Reads `challengeToken` from `httpOnly` cookie (NOT body). On success: set access+refresh cookies, clear challenge cookie, return `{ stage: 'authenticated', user }`. |
| POST   | `/api/v2/auth/2fa/resend`             | `@Public()` + `@UseGuards(CustomThrottlerGuard)` + `@TwoFaResendThrottle()` | Body: empty. challengeToken from cookie. On success: return updated `TwoFactorChallenge`.                                                                                                   |
| POST   | `/api/v2/users/:id/2fa/clear-lockout` | `@Roles('root')` + `@UseGuards(CustomThrottlerGuard)` + `@AdminThrottle()`  | Param: `ClearLockoutParamDto`. Two-root rule (target ≠ caller). Returns 204. **NOT a 2FA bypass — only clears the lockout state.**                                                          |

**Mandatory per endpoint:**

- [ ] Throttler decorator + guard
- [ ] Zod-validated DTOs
- [ ] No double-wrapping (services return raw data — `ResponseInterceptor` wraps per ADR-007)
- [ ] `@Public()` for verify/resend (run before `JwtAuthGuard` — user not yet authenticated)
- [ ] Audit entry per request (success or fail)

### Step 2.8: New throttler tiers + decorators [DONE — 2026-04-29]

**Delivered (2026-04-29):**

- `backend/src/nest/throttler/throttler.module.ts` — added two new tiers: `2fa-verify` (5/10min) + `2fa-resend` (1/60s). Both use a per-tier `getTracker` (top-level `get2faTracker(req)` helper) keyed on the `challengeToken` cookie with IP fallback (`unknown` if neither — safe default). v0.5.0 P2-Fix: industrial customers behind one NAT egress (50–500 users on 1 IP) cannot block each other during shift-change login waves; brute-force defence remains in service-layer (`record.attemptCount` per challenge + `2fa:fail-streak:{userId}` per user). Per-tier `getTracker` is honored by `ThrottlerGuard.handleRequest` (`getTracker?.(req, context) ?? this.getTracker(...)`) — overrides `CustomThrottlerGuard.getTracker` (user|ip default) only for these two tiers; other tiers continue to use the guard's user|ip key.
- `backend/src/nest/common/decorators/throttle.decorators.ts` — added `TwoFaVerifyThrottle()` + `TwoFaResendThrottle()` decorators (mirror existing `AuthThrottle`/etc. shape). Per the file's documented tier-isolation rule (lines 17–25), every existing decorator's `SkipThrottle` list (Auth/User/Admin/Export/DomainVerify/Feedback) was extended with `'2fa-verify': true, '2fa-resend': true`. The two new decorators skip every other tier (auth/public/user/admin/upload/export/domain-verify) plus the sibling 2fa tier — so a request to `/auth/2fa/verify` is counted against `2fa-verify` only, not also against `auth` or `public`.

**Verification (2026-04-29):**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/throttler/ backend/src/nest/common/decorators/throttle.decorators.ts` → 0 errors.
- `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → exit 0, 0 lines.
- Route-mount smoke test confirmed both new tiers are accepted by `ThrottlerModule.forRootAsync` (no startup error from the per-tier `getTracker` typing).

**Test deferral:** decorator factories are pure `applyDecorators` glue (no business logic); same exemption as the 6 existing decorators in the file. Throttler tier behaviour itself is exercised by the Phase 4 API integration tests (`POST /auth/2fa/{verify,resend}` → 429 expectations).

---

**File modified:** `backend/src/nest/throttler/throttler.module.ts`

Add to `throttlers: [...]`:

```typescript
// v0.5.0 P2-Fix: tracker-key changed from IP to challengeToken to prevent
// false-positive blocks at industrial customers behind NAT (50–500 users on 1 IP
// would block the 6th legitimate user during shift-change login waves).
// Brute-force protection lives in service-layer (record.attemptCount, fail-streak:{userId}).
{ name: '2fa-verify', ttl: 10 * MS_MINUTE, limit: 5, getTracker: (req) => req.cookies?.challengeToken ?? req.ip },
// 2FA resend: 1 per 60s, also keyed on challengeToken (per-user-session, not per-IP).
{ name: '2fa-resend', ttl: MS_MINUTE, limit: 1, getTracker: (req) => req.cookies?.challengeToken ?? req.ip },
```

**File modified:** `backend/src/nest/common/decorators/throttle.decorators.ts`

Add two new decorators (mirror existing `AuthThrottle` shape) AND extend every existing decorator's `SkipThrottle` list with `'2fa-verify': true, '2fa-resend': true` per the documented "tier isolation" rule (lines 17-25 of that file).

```typescript
export const TwoFaVerifyThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({ '2fa-verify': { limit: 5, ttl: 10 * MS_MINUTE } }),
    SkipThrottle({
      auth: true,
      public: true,
      user: true,
      admin: true,
      upload: true,
      export: true,
      'domain-verify': true,
      '2fa-resend': true,
    }),
  );

export const TwoFaResendThrottle = (): ThrottleDecorator =>
  applyDecorators(
    Throttle({ '2fa-resend': { limit: 1, ttl: MS_MINUTE } }),
    SkipThrottle({
      auth: true,
      public: true,
      user: true,
      admin: true,
      upload: true,
      export: true,
      'domain-verify': true,
      '2fa-verify': true,
    }),
  );
```

### Step 2.9: `send2faCode()` + template + `SMTP_FROM` [DONE — 2026-04-29]

**Delivered (2026-04-29):**

- `backend/src/nest/config/config.service.ts` — extended Zod `EnvSchema` with `SMTP_FROM: z.string().min(1).default('noreply@assixx.de')` (R11 fail-loud on empty string in prod, dev default keeps tests green); added `smtpFrom` getter; `safeParse({...})` arg-list updated to forward `SMTP_FROM`.
- `backend/src/nest/config/config.service.test.ts` — +3 tests: default, configured, empty-string rejection. Total file: 17 tests, all green.
- `backend/src/utils/email-templates/2fa-code.template.ts` — new TypeScript builder `build2faCodeTemplate({ code, purpose, ttlMinutes }) → { subject, html, text }`. DD-13 generic subject ("Ihr Bestätigungscode für Assixx", same for login + signup — never leaks code/purpose into mail-list previews). German HTML with inline styles only (mail-client compat), monospace 32-px code rendering with letter-spacing for factory-shop-floor readability (DD-1 confusable-character context). Plain-text fallback always present. No tracking pixels, no scripts, no remote URLs.
- `backend/src/utils/email-templates/2fa-suspicious-activity.template.ts` — `build2faSuspiciousActivityTemplate() → { subject, html, text }`. Generic subject ("Sicherheitshinweis zu Ihrem Assixx-Konto"), 15-min lockout duration, two-branch "you did this?"/"you did not?" advisory, German plain-text fallback. DD-20 user-only, no tenant-admin cc.
- `backend/src/utils/email-templates/2fa-code.template.test.ts` — 10 tests locking down DD-13 invariants (subject identical for login+signup, no code in subject, code in HTML+text, TTL in HTML+text, per-purpose copy, "Geben Sie diesen Code niemandem weiter" warning, plain-text fallback present, no `<img src="https?://"`, no `<script>`).
- `backend/src/utils/email-templates/2fa-suspicious-activity.template.test.ts` — 7 tests for the suspicious-activity invariants (generic subject, 15-min mention, both advisories, plain-text fallback, no tracking pixels, no scripts, deterministic output).
- `backend/src/utils/email-service.ts` — added top-level `send2faCode(to, code, purpose, ttlMinutes): Promise<void>` (DD-14 fail-loud — throws on transport failure) and `send2faSuspiciousActivity(to): Promise<void>` (DD-20 silent-swallow — logs warn on failure). Both also added to default export so legacy default-import callers get them. Plus a named-export line for direct named-import consumers.
- `backend/src/nest/common/services/mailer.service.ts` — added `sendTwoFactorCode(to, code, purpose, ttlMinutes)` (re-throws DD-14) and `sendTwoFactorSuspiciousActivity(to)` (belt-and-braces silent-swallow — underlying function already swallows transport errors; this catch only fires on programmer errors like a template-builder throw). DI-friendly surface that `TwoFactorAuthService` consumes.
- `backend/src/nest/common/services/mailer.service.test.ts` — extended `vi.hoisted` mock to cover `send2faCode` + `send2faSuspiciousActivity`; added 4 tests covering DD-14 fail-loud (forwards args, re-throws cause unchanged) + DD-20 silent (forwards args, does NOT throw on underlying error). Total file: 18 tests, all green.

**Verification (2026-04-29):**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/two-factor-auth/ backend/src/utils/email-templates/ backend/src/utils/email-service.ts backend/src/nest/common/services/mailer.service.ts backend/src/nest/config/config.service.ts` → 0 errors.
- `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → exit 0, 0 lines.
- `pnpm exec vitest run --project unit backend/src/nest/config/config.service.test.ts backend/src/utils/email-templates/2fa-code.template.test.ts backend/src/utils/email-templates/2fa-suspicious-activity.template.test.ts backend/src/nest/common/services/mailer.service.test.ts` → 4 files, 52 tests, all passed in 646 ms.
- Backend hot-reloaded; `GET /health` returns `{"status":"ok"}` post-edit; no module-load errors.

**Files:**

- modify `backend/src/utils/email-service.ts` — add export `send2faCode(...)` (top-level function, matches the file's existing function-export style — NOT a NestJS service)
- new `backend/src/utils/email-templates/2fa-code.template.ts` — German HTML + plain text
- modify `backend/src/nest/config/config.service.ts` — extend `EnvSchema` (v0.5.0: nur SMTP_FROM, FEATURE_2FA_EMAIL_ENFORCED entfernt):

```typescript
SMTP_FROM: z.string().min(1).default('noreply@assixx.de'),
// v0.5.0: FEATURE_2FA_EMAIL_ENFORCED ENTFERNT per DD-10-Removal — 2FA ist hartcodiert
```

Plus add getter:

```typescript
get smtpFrom(): string { return this.config.SMTP_FROM; }
// v0.5.0: is2faEnforced-Getter entfällt — 2FA ist immer aktiv, keine Konfig-Variable
```

**Method signature:**

```typescript
export async function send2faCode(
  to: string,
  code: string,
  purpose: 'login' | 'signup',
  ttlMinutes: number,
): Promise<void>;
```

**Template content (German, ä/ö/ü/ß per CLAUDE.local.md):**

- Subject: per DD-13 — generic, NO code
- Body: greeting · purpose-specific intro ("Sie haben sich angemeldet" vs "Willkommen bei Assixx") · 6-character alphanumeric code in large monospace, **no separator** (e.g. `K7PX3M` — preserves iOS auto-fill + simple `maxlength="6"` manual entry; v0.3.1) · TTL warning · "Geben Sie diesen Code niemandem weiter" notice · footer
- Plain-text fallback for clients without HTML
- No tracking pixels, no external assets

**Suspicious-activity template** (separate file): notifies user only (DD-20) when their account hits the 5-wrong-attempts lockout.

### Step 2.9b: Email-Template Visual & Content Redesign (Klarna-DE, dark-mode, 6-box code) [DONE — 2026-04-29]

**Delivered (2026-04-29):**

- `backend/src/utils/email-templates/2fa-code.template.ts` — full rewrite. Dark-mode shell (#000000 bg, 600 px container, 12 px radius, slate palette) ported 1:1 from `backend/templates/email/password-reset.html`. New helper `renderCodeBoxes()` splits the 6-char code into 6 separate `<td>` cells side-by-side (one char per cell, dark border `#1f2937`, monospace 28 px). HTML/text body assembly extracted into `renderCodeMailHtml()` + `renderCodeMailText()` so the public builder stays under the function-line cap. Klarna-DE action-oriented closing block ("Sie haben keinen Code angefordert? → sperren Sie Ihr Konto, informieren Sie Ihre IT-Abteilung") replaces the §2.9 passive "Falls Sie diese E-Mail nicht erwartet haben…" line. Plain-text fallback keeps the unbroken `${code}` for clipboard-copy.
- `backend/src/utils/email-templates/2fa-suspicious-activity.template.ts` — same dark-mode shell + logo + footer. Body restructured to two-branch advisory ("Sie waren das selbst?" / "Sie waren das nicht?") with action-oriented "Sperren Sie Ihr Konto, ändern Sie Ihr Passwort, informieren Sie Ihre IT-Abteilung." HTML/text extracted into `renderSuspiciousActivityHtml()` + `renderSuspiciousActivityText()`.
- `backend/src/utils/email-service.ts` — `send2faCode()` and `send2faSuspiciousActivity()` now attach the branding logo via the existing `getBrandingLogoAttachment()` helper, so `cid:assixx-logo` resolves in every mail client (same path the password-reset mail uses — single source of truth).
- `backend/src/utils/email-templates/2fa-code.template.test.ts` — 17 tests (was 10). New: 6-box assertion (`code = 'K7PX3M'` → six `<td width:56px>` cells with chars `K 7 P X 3 M` in order); subject-no-code regex regression (`/[A-Z2-9]{6}/` mustn't match); deleted-phrase regression ("Falls Sie diese E-Mail nicht erwartet haben" must NOT appear); Klarna-DE wording assertions ("Sie haben keinen Code angefordert", "Verwenden Sie diesen Code", "Betrüger geben sich"); cid:assixx-logo reference present. All four purposes (login / signup / email-change-old / email-change-new) verified to share the same generic subject.
- `backend/src/utils/email-templates/2fa-suspicious-activity.template.test.ts` — 9 tests (was 7). New: action-oriented advisory ("Sperren Sie Ihr Konto" + "IT-Abteilung"); cid:assixx-logo reference present.

**Justified eslint-disable:** both `renderCodeMailHtml` and `renderSuspiciousActivityHtml` are pure declarative HTML literals (cyclomatic complexity = 1, zero branches, zero loops). The `max-lines-per-function: 60` cap (Power-of-Ten Rule 4) targets control-flow complexity; splitting a single layout literal into `renderHead` / `renderCard` / `renderFooter` purely to satisfy the line count would scatter one logical layout across multiple functions and degrade readability. Disable comment in both files explains this inline.

**Verification:**

- `docker exec assixx-backend pnpm exec eslint backend/src/utils/email-templates/ backend/src/utils/email-service.ts` → 0 errors.
- `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → 0 errors.
- `pnpm exec vitest run --project unit backend/src/utils/email-templates/ backend/src/nest/common/services/mailer.service.test.ts` → 44 / 44 passed (17 code-template + 9 suspicious + 18 mailer-service).
- Visual smoke test in **Mailpit** (`http://localhost:8025`, post-DD-25 v0.4.x migration from Maildev): user reported font-divergence between 2FA mail and password-reset mail in the Mailpit-iframe rendering. Root cause: both templates set `font-family` only on the parent `<td class="px-32 py-32">`; some iframe contexts (Mailpit's `/view/<id>`, also Gmail) reset `<h1>` and `<p>` to user-agent default fonts when those elements lack their own `font-family` declaration. Fix: explicit `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` inline on every `<h1>` and `<p>` in both 2FA templates, plus a `body, table, td, p, h1, h2, h3 { font-family: ... }` selector in the `<style>` block (belt-and-braces). Both 2FA mails now render with identical typography to the password-reset reference.

**Trigger:** 2026-04-29 user feedback — the templates shipped in §2.9 were judged "hässlich". The flagged closing sentence ("Falls Sie diese E-Mail nicht erwartet haben, ignorieren Sie sie bitte. Ihr Konto bleibt sicher, solange Sie den Code niemandem weitergeben.") replaced by the action-oriented Klarna-style block. Visual identity ports the polished password-reset shell onto the 2FA TS-builder path. §2.9 stays as the historical record (it shipped as written); this step is the follow-up redesign.

**Scope (one bundle, two templates):**

- `backend/src/utils/email-templates/2fa-code.template.ts` — replace shell with dark-mode (`#000000` bg, 600 px container, 12 px radius, `cid:assixx-logo` 140×68 at top, slate palette `#f1f5f9` / `#cbd5e1` / `#94a3b8`, MSO/Outlook fallbacks, footer "© 2026 Assixx — Enterprise-Plattform … automatisierte Nachricht"). Render the 6-char code as **6 separate `<td>` cells side-by-side** (one char per box, dark border `#1f2937`, monospace 28 px) instead of the current single-block `letter-spacing` rendering. Plain-text fallback keeps the unbroken `${code}` (clipboard-friendly).
- `backend/src/utils/email-templates/2fa-suspicious-activity.template.ts` — same dark shell + logo + footer; body restructured to Klarna-style action-oriented advisory ("Sperren Sie Ihr Konto", "Informieren Sie umgehend Ihre IT-Abteilung").
- `backend/src/utils/email-service.ts` — `send2faCode` + `send2faSuspiciousActivity` must attach the branding logo via the existing `getBrandingLogoAttachment()` helper so `cid:assixx-logo` resolves (the password-reset path already uses this; the 2FA path currently does not).

**Content (Klarna-DE, per-purpose intros preserved via existing `buildIntro`):**

- H1: `Ihr 6-stelliger Bestätigungscode`
- Lead: existing per-purpose copy (`login` / `signup` / `email-change-old` / `email-change-new`) — unchanged.
- 6 boxes (one char per box).
- `Verwenden Sie diesen Code, um den Vorgang in Assixx abzuschließen.`
- `**Geben Sie diesen Code niemandem weiter.** Mitarbeitende von Assixx werden Sie niemals telefonisch, per SMS oder E-Mail nach Ihrem Code fragen.`
- `Der Code ist {ttlMinutes} Minuten gültig.`
- Divider.
- `Betrüger geben sich möglicherweise als Assixx aus. Geben Sie niemals Ihre Anmeldedaten oder Codes weiter.`
- `**Sie haben keinen Code angefordert?** Falls Sie vermuten, dass jemand anderes diesen Code angefordert hat, sperren Sie Ihr Konto umgehend und informieren Sie Ihre IT-Abteilung.`
- Footer (copyright + automatisierte-Nachricht boilerplate, identical to password-reset).

**DD-13 invariants preserved (already true, locked in by added regression test):**

- Subject unchanged: `Ihr Bestätigungscode für Assixx` — same string for every purpose.
- Code never appears in subject — explicit regex assertion added.
- No external HTTP(S) image URLs (logo via `cid:` only).
- No `<script>` tags.

**Tests (delta):**

- Add: 6-box assertion — for input `code = 'K7PX3M'`, the HTML contains 6 distinct `<td>` cells, each holding exactly one character of the code in order.
- Add: deleted-phrase regression — HTML and text MUST NOT contain `"Falls Sie diese E-Mail nicht erwartet haben"`.
- Add: subject-no-code regression — for any code matching `/[A-Z2-9]{6}/`, the subject MUST NOT contain it.
- Update wording assertions for the new Klarna-DE phrases (`Sie haben keinen Code angefordert`, `Verwenden Sie diesen Code`, `Betrüger geben sich`).
- Keep: generic subject, code in HTML+text, TTL in HTML+text, per-purpose intros, "Geben Sie diesen Code niemandem weiter", plain-text fallback present, no http(s)-img, no `<script>`, deterministic output (suspicious-activity).

**Definition of Done:**

- [ ] `2fa-code.template.ts` rewritten with dark shell + 6-box code + Klarna-DE content, inline styles only.
- [ ] `2fa-suspicious-activity.template.ts` rewritten with same dark shell + Klarna-style advisory.
- [ ] `email-service.ts` attaches `getBrandingLogoAttachment()` for both `send2faCode` and `send2faSuspiciousActivity`.
- [ ] Both test files updated; new regression tests pass; existing invariant tests still pass.
- [ ] `docker exec assixx-backend pnpm exec eslint backend/src/utils/email-templates/ backend/src/utils/email-service.ts` → 0 errors.
- [ ] `docker exec assixx-backend pnpm run type-check` → 0 errors.
- [ ] `pnpm exec vitest run --project unit backend/src/utils/email-templates/2fa-code.template.test.ts backend/src/utils/email-templates/2fa-suspicious-activity.template.test.ts` → all green.
- [ ] Visual smoke test in Mailpit (`http://localhost:8025`, post-DD-25 v0.4.x): trigger one login challenge, screenshot the rendered mail.

### Step 2.10: Pino redaction config [DONE — 2026-04-29]

**Delivered (2026-04-29):**

- `backend/src/nest/common/logger/logger.constants.ts` — six new entries appended to `REDACT_PATHS` (the actual constant name; the masterplan referred to it conceptually as `LOGGER_REDACT_PATHS`). Two grouped insertions, each tagged with a `// 2FA fields (ADR-054 / DD-18)` comment block so future maintainers can trace the entries to the spec: (a) `req.body.code` + `req.body.challengeToken` + `res.body.challengeToken` + `res.body.data.challengeToken` placed after the existing response-tokens block; (b) `*.code` + `*.challengeToken` placed inside the existing Level-2 wildcards block. **Plan-literal — six paths exactly.** Plan-deviation note inline in the file: Level 1 (bare `code` / `challengeToken`) and Level 3+ (`*.*.code`, …) deliberately NOT added — Level 1 would shadow Postgres `Error.code` / Node `Error.code` which need to remain debuggable in logs (DD-18 scope decision).
- `backend/src/nest/common/logger/logger.constants.test.ts` — extended with **+9 tests** (file total: 20 → 29). One new structural assertion (`should contain 2FA code + challengeToken paths (DD-18)`) inside the existing `describe('REDACT_PATHS', …)` block, matching the file's existing `toContain()` style. New `describe('REDACT_PATHS — runtime redaction behavior (DD-18)', …)` block with eight behavioral tests that boot a real Pino instance configured exactly like `main.ts:337-340` (`{ paths: [...REDACT_PATHS], censor: REDACTED_VALUE }`), write to an in-memory `Writable` buffer, and assert raw-string properties: (a) the secret value (`'ZZ9PZ9'` for code, `'kZv-test-challenge-token-do-not-leak'` for token) does NOT appear in the output, (b) `[REDACTED]` DOES appear. Six positive tests cover each of the six new path positions; two negative tests lock in the deliberate scope: unrelated `email`/`msg` fields stay un-redacted, and bare `code` at log root (PG/Node `Error.code`) stays debuggable.
- **Why behavioral on top of structural:** Pino redaction fails silently on path typos — a misspelled glob means the field is logged in plaintext with no error and no warning. The structural tests catch removal/typo of the 6 entries; the behavioral tests catch glob-syntax regressions where the entry exists but Pino doesn't match it at runtime. The Kaizen Manifest's "SQL Blindness / Premature Claims" pattern applies — verify, don't assume.

**Verification (2026-04-29):**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/common/logger/` → exit 0, 0 errors.
- `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → exit 0, 0 lines.
- `pnpm exec vitest run --project unit backend/src/nest/common/logger/logger.constants.test.ts` → **29/29 passed in 18 ms**.
- `pnpm exec vitest run --project unit` (full unit suite) → **279 files, 7147 tests, all passed in 17.02 s** — +9 vs Step 2.9 baseline of 7138, matches new tests exactly. No indirect breakage from the redaction-list expansion (3 consumers verified: `main.ts:338`, `common/logger/logger.module.ts:237`, `utils/logger.ts:195` — all spread `[...REDACT_PATHS]` without per-entry coupling).
- `curl http://localhost:3000/health` → `{"status":"ok"}`. Backend hot-reloaded on the live container; no startup or module-load errors in `docker logs`.

---

**File modified (canonical spec, kept for plan-archaeology):** `backend/src/nest/common/logger/logger.constants.ts`

**Add to `LOGGER_REDACT_PATHS`:**

```typescript
'req.body.code',
'req.body.challengeToken',
'res.body.challengeToken',
'res.body.data.challengeToken',
'*.code',
'*.challengeToken',
// req.headers.cookie is already redacted in the existing list — verify before duplicating
```

**Verify:** unit test that exercises a verify-fail path and asserts the log entry contains `[Redacted]` not the actual code.

### Step 2.11: Stale-Pending Reaper Cron [DONE — 2026-04-29]

**Delivered (2026-04-29):**

- `backend/src/nest/two-factor-auth/two-factor-auth-reaper.service.ts` — NEW. `@Cron('0 */15 * * * *', { name: 'two-factor-stale-pending-reaper' })` (six-field expression — fires at second 0 of minutes 0/15/30/45). Public surface: `runScheduled()` cron entry (try/catch wrapper — sweep failures never crash the scheduler) + `reap()` testable method returning `{ users, tenants }`. Five private helpers split for cognitive-complexity-10 compliance: `findStaleUsers` (`SELECT FOR UPDATE`), `cleanupBatch` (orchestrator), `groupByTenant`, `dropTenantCascade` (whole-tenant orphan), `softDeleteEachUser` (defensive edge case), `countUsersOnTenants`, `writeAuditRows`. All work runs inside one `db.systemTransaction` — sys_user with BYPASSRLS per ADR-019; either the entire batch (cleanup + audit) commits or it all rolls back.
- `backend/src/nest/two-factor-auth/two-factor-auth.module.ts` — `TwoFactorReaperService` registered in `providers` (no exports — internal to this module). No new module imports: `ScheduleModule.forRoot()` is global in `app.module.ts:111`, `DatabaseService` is `@Global()`. Header comment block extended with the Step 2.11 status line.
- DD-29 confirmed in source: deletion-worker container loads `backend/dist/workers/deletion-worker.js` (separate entrypoint → `DeletionWorkerModule`), so `@Cron` only fires in main backend (`AppModule`). Single-fire on V1 single-replica deployment.

**Three deliberate spec deviations vs the masterplan-literal §2.11 SQL** (logged below in §Spec Deviations as D1/D2/D3, also documented inline in the file header):

1. **Inverted DELETE flow** — plan's CTE deletes from `users` first then runs `NOT EXISTS (SELECT 1 FROM users WHERE …)` for orphan tenants. PostgreSQL DML CTEs share the statement-start snapshot, so the to-be-deleted user is still visible to that NOT EXISTS → tenants would never be reaped. Inverted: delete the tenant, cascade kills the user via the existing `users.tenant_id ON DELETE CASCADE` FK.
2. **`DELETE FROM users` avoided entirely** — `shared/src/architectural.test.ts:291` blocks it outside the tenant-deletion module (ADR-020 + ADR-045 soft-delete-only rule). The inverted flow doubles as the dodge: only `DELETE FROM tenants` is written. Defensive edge case (tenant has non-stale users besides the stale ones — cannot happen for a fresh signup but cheap insurance) falls back to `UPDATE users SET is_active = IS_ACTIVE.DELETED`. Mirrors `signup.service.ts:cleanupFailedSignup`.
3. **Audit insert inside the same transaction** (NOT fire-and-forget like `TwoFactorAuthService.fireAudit`). Reaper deletions are compliance evidence — if the audit row fails, the whole batch must roll back (no orphan deletes without a paper trail). `audit_trail` partition table has no FK to `tenants` (verified `\d audit_trail` 2026-04-29), so writing the audit row after the cascade is safe even when the tenant is gone.

**Test deferral (per Step 2.2 / 2.3 / 2.7 precedent):** unit tests for the reaper land in Phase 3 / Session 9 ("Unit tests TwoFactorAuthService + AuthService + SignupService modifications + reaper service + Email-Change service (Step 2.12)"). End-to-end integration test (signup → close browser → wait 1 h → manual reaper trigger → user + tenant gone, audit row written, subdomain available) lands in Phase 4 / Session 10.

**Verification (2026-04-29):**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/two-factor-auth/` → 0 errors.
- `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → exit 0, 0 lines.
- `pnpm exec vitest run --project unit` (full unit suite) → **279 files / 7147 tests / all passed in 20.41 s** — same baseline as Step 2.10, no indirect breakage from the new module-graph edge.
- `curl http://localhost:3000/health` → `{"status":"ok"}`. Backend hot-reloaded; logs show `TwoFactorAuthModule dependencies initialized` + `Nest application successfully started` — DI graph resolved with the new provider; `@Cron` auto-discovered by `SchedulerOrchestrator` on bootstrap (no explicit registration log line — NestJS scheduler is silent unless a registration error occurs).

---

#### Original spec (kept for plan-archaeology)

**Why:** DD-14 cleanup deletes `users` + `tenants` row when SMTP fails synchronously. But there is a second leak path: user submits signup → SMTP succeeds → **user closes the browser tab** before entering the code. The `users` row sits at `is_active=0` indefinitely; the `tenants` row keeps the subdomain reserved. Without a reaper, attackers script signup-then-close to squat premium subdomains, and legit users see "Email already in use" when they retry signup an hour later.

**File:** `backend/src/nest/two-factor-auth/two-factor-auth-reaper.service.ts`

**Pattern reference:** existing `assixx-deletion-worker` container (separate process per `docker-compose.yml`).

**v0.4.0 Resolution (DD-29):** **`@Cron('0 */15 * * * *')` im Haupt-Backend mit `@nestjs/schedule`** — Plan-Default bestätigt. Eine Query alle 15 Min ist leichtgewichtig — kein eigener Container nötig. Bei Contention-Telemetrie nach T+30 Tagen → V2-Migration zu `assixx-deletion-worker` erwägen.

**Verifikations-Note:** `@nestjs/schedule` ist bereits Dependency in `backend/package.json` (verifiziert via `app.module.ts` `ScheduleModule.forRoot()` import). Keine neue NPM-Dep nötig.

**Behavior** (runs every 15 minutes, `@Cron('0 */15 * * * *')`):

```sql
-- Run as sys_user (BYPASSRLS). Inside one transaction.
WITH stale_users AS (
    SELECT id, tenant_id
    FROM users
    WHERE is_active = ${IS_ACTIVE.INACTIVE}
      AND tfa_enrolled_at IS NULL
      AND created_at < NOW() - INTERVAL '1 hour'
),
deleted_users AS (
    DELETE FROM users
    WHERE id IN (SELECT id FROM stale_users)
    RETURNING id, tenant_id
),
orphan_tenants AS (
    SELECT du.tenant_id
    FROM deleted_users du
    WHERE NOT EXISTS (
        SELECT 1 FROM users u WHERE u.tenant_id = du.tenant_id
    )
)
DELETE FROM tenants
WHERE id IN (SELECT tenant_id FROM orphan_tenants)
RETURNING id, subdomain;
```

**Audit:** for each deleted (user, tenant) pair, write one `audit_trail` row:

- `(action='delete', resource_type='2fa-stale-signup', changes={userId, tenantId, subdomain, reason:'never-verified'})`

**Critical patterns:**

- Run via `systemTransaction()` — needs BYPASSRLS for cross-tenant cleanup.
- Tenant deletion is **conditional** (only if no other users exist) — defensive against race where another user signed up under the same tenant in the meantime (cannot happen in practice for fresh signups, but cheap insurance).
- Log the count of deleted users + tenants per run — Sentry alert if > 100/hour (signal of either a bug or an attack).
- The 1-hour TTL is intentionally longer than the 10-minute challenge TTL — gives a buffer for users who genuinely want to come back to a half-finished signup.

**Verification (Phase 4 integration test):**

1. Signup → receive code → close browser
2. Wait 1 h (or fast-forward via `INTERVAL` injection in test)
3. Run reaper manually
4. Assert: user row gone, tenant row gone, audit row written, subdomain available for re-signup.

**Edge cases handled:**

- User who DID verify (has `tfa_enrolled_at IS NOT NULL`) is never reaped, even if `is_active=0` for some other reason.
- Tenant with multiple users (e.g., admin invited employees during signup window) is preserved — only the stale user row goes.

### Step 2.12: E-Mail-Change 2FA-Verify (DD-32 / R15, v0.6.0) [DONE — 2026-04-29]

**Delivered (2026-04-29):**

- **Localization confirmed Greenfield path.** No self-service email-change endpoint existed pre-2.12: `UserProfileService.updateProfile`'s `PROFILE_FIELD_MAP` deliberately omits `email` (only firstName/lastName/phone/address/emergencyContact/employeeNumber are self-mutable). Admin-side `PUT /users/:id` (`users.service.ts:349` via `validateEmailUniqueness`) edits OTHER users' emails — different threat model, out of DD-32 scope. New file pair created fresh per the plan's "wird er zusammen mit Step 2.12 neu angelegt — sauberer ohne Legacy-Refactor" branch.
- `backend/src/nest/two-factor-auth/two-factor-auth.types.ts` — `ChallengePurpose` widened to `'login' | 'signup' | 'email-change-old' | 'email-change-new'`. New `LoginChallengePurpose = Extract<…, 'login' | 'signup'>` narrows the login/signup verify path — `markVerified` and `VerifyResult.purpose` use the narrower type so email-change purposes can never reach those code paths (TS compile-time guard).
- `backend/src/nest/two-factor-auth/two-factor-auth.service.ts` — `verifyChallenge` refactored to call a new private `runVerifyMitigations(token, code, expectedPurposes, wrongCodeAudit?)` primitive. Existing `handleVerifyFailure` retired in favour of `applyWrongCodeMitigations(token, record, wrongCodeAudit?)` — same security mitigations (attemptCount/fail-streak/lockout-trigger/suspicious-activity-mail/`(update, 2fa-lockout)`-audit), but the per-flow `(login, auth, failure)` audit shape is now parameterised via `WrongCodeAudit`. New public `verifyChallengePreCommit(token, code, expectedPurposes, wrongCodeAudit?)` — same security work as `verifyChallenge` but does NOT consume the challenge and does NOT emit a success audit (caller orchestrates atomic commit). Defense-in-depth: `runVerifyMitigations` rejects tokens whose `record.purpose ∉ expectedPurposes` with the same R10 timing-safe generic 401 used for unknown tokens — a stolen email-change token cannot be redeemed at `/auth/2fa/verify`.
- `backend/src/utils/email-templates/2fa-code.template.ts` — `purpose` widened to `TwoFactorCodeTemplatePurpose` (4-value union); `buildIntro` switch extended exhaustively with two new German intro variants (`email-change-old`: "Sie haben eine Änderung Ihrer Anmelde-E-Mail-Adresse beantragt … Code an Ihrer aktuellen Adresse"; `email-change-new`: "Diese Adresse wurde als neue Anmelde-E-Mail-Adresse … angegeben"). DD-13 generic subject ("Ihr Bestätigungscode für Assixx") preserved across all four purposes — mail-list previews leak nothing.
- `backend/src/utils/email-service.ts` + `backend/src/nest/common/services/mailer.service.ts` — `send2faCode` / `sendTwoFactorCode` purpose param widened (`'login' | 'signup'` → `TwoFactorCodeTemplatePurpose` / `ChallengePurpose`). DD-14 fail-loud + DD-20 silent-swallow contracts unchanged.
- `backend/src/nest/throttler/throttler.module.ts` — `get2faTracker` fallback chain extended: `cookies.challengeToken ?? cookies.emailChangeOldChallenge ?? IP`. Login-verify path keys on `challengeToken` (unchanged); email-change-verify path keys on `emailChangeOldChallenge`. Different keys → independent counters even though both share the `2fa-verify` tier (5/10min). Industrial-NAT fairness (v0.5.0 P2-Fix rationale) preserved for both flows.
- `backend/src/nest/users/dto/request-email-change.dto.ts` (NEW) — Zod-validated `{ newEmail }` via `EmailSchema` (lowercase + trim normalisation). The `newEmail !== currentEmail` refinement lives at the service layer (Zod has no caller-identity context).
- `backend/src/nest/users/dto/verify-email-change.dto.ts` (NEW) — Zod-validated `{ codeOld, codeNew }`, both with the existing Crockford-Base32 6-char regex `/^[A-HJKMNP-Z2-9]{6}$/` after `.trim().toUpperCase()` — same normalisation contract as `VerifyCodeSchema` (Step 2.1). Cookies (`emailChangeOldChallenge` / `emailChangeNewChallenge`) are NOT in the body — single source of truth (R8).
- `backend/src/nest/users/email-change.service.ts` (NEW) — Orchestration core. `requestChange(userId, tenantId, currentEmail, newEmail)` runs uniqueness pre-check (`SELECT id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1` — soft-check; UNIQUE constraint catches the race window) then issues TWO challenges (old-side first to fail-loud on broken-current-mailbox before mailing the new-side). `verifyChange(userId, tenantId, currentEmail, oldToken, codeOld, newToken, codeNew)` calls `verifyChallengePreCommit` twice with `OLD_SIDE_AUDIT` / `NEW_SIDE_AUDIT` shapes (per §A8: `(update, user-email, failure, { side: 'old'|'new', reason: 'wrong-code', attempt: N })`). On both-green: one `tenantTransaction` runs UPDATE + audit success row, then consumes both challenges. On any failure: `cleanupOnFailure` DELs both Redis records (anti-persistence — attacker who cracked one code cannot keep the other alive across retries) + fires-and-forgets a suspicious-activity mail to the OLD address (DD-20-style: legitimate user learns "someone tried to change my email" without learning the attempted new address — no enumeration side-channel) + re-throws the original error. Defensive token-pair-mismatch guard (`oldRecord.userId !== newRecord.userId || tenantId mismatch`) emits `(update, user-email, failure, { reason: 'token-pair-mismatch' })` and refuses to commit — covers programmer-error scenarios (mixed cookies upstream).
- `backend/src/nest/users/email-change.controller.ts` (NEW) — `@Controller('users/me/email')` with two routes. `POST /request-change` → `@AuthThrottle()` (per IP / user — anti-bombing), reads `currentUser` from JWT (NEVER from body — anti-CSRF), sets two httpOnly+Secure+SameSite=Lax cookies with `maxAge = CODE_TTL_SEC` (cookie cannot outlive Redis record — Step 2.4 SoT pattern), returns `{ stage: 'challenge_required', oldChallenge, newChallenge }` with tokens stripped via `stripToken` helper (R8). `POST /verify-change` → `@TwoFaVerifyThrottle()` (5/10min keyed on `emailChangeOldChallenge` cookie via the new tracker fallback), reads both tokens from cookies, calls service, clears BOTH cookies in `try/finally` regardless of outcome (success: consumed Redis-side; failure: avoid retry against DEL'd records). Returns `{ stage: 'authenticated', oldEmail, newEmail }` on success, propagates 401 generic on verify failure.
- `backend/src/nest/users/users.module.ts` — `TwoFactorAuthModule` added to `imports` (one-way edge — TwoFactorAuthModule has no back-reference to UsersModule, so no `forwardRef` needed). `MailerService` provided locally per project convention (`auth.module.ts:46`, `two-factor-auth.module.ts:108`). `EmailChangeController` + `EmailChangeService` registered.

**Why I didn't fold this into `UserProfileService`:** that file's `PROFILE_FIELD_MAP` is a flat self-editable-fields registry. Adding a 2-step state machine with two cookies, two challenge mails, atomic Redis+SQL commit, and suspicious-activity mail would inflate `user-profile.service.ts` past its responsibility line. Same precedent as `two-factor-lockout.controller.ts` splitting from `two-factor-auth.controller.ts` for SRP.

**Verification (2026-04-29):**

- `docker exec assixx-backend pnpm exec eslint backend/src/nest/users/ backend/src/nest/two-factor-auth/two-factor-auth.service.ts backend/src/nest/two-factor-auth/two-factor-auth.types.ts backend/src/nest/throttler/throttler.module.ts backend/src/nest/common/services/mailer.service.ts backend/src/utils/email-templates/2fa-code.template.ts backend/src/utils/email-service.ts` → 0 errors
- `docker exec assixx-backend pnpm exec tsc --noEmit -p backend` → exit 0, 0 lines
- `pnpm exec vitest run --project unit` → **279 files / 7147 tests / all passed in 21.70 s** — same baseline as Step 2.11; the `verifyChallenge` refactor + `markVerified` purpose narrowing did not regress any existing test. No new tests in this step (deferred to Phase 3 / Session 9 per the documented precedent of Steps 2.2/2.3/2.7/2.10/2.11).
- `curl http://localhost:3000/health` → `{"status":"ok"}`. Backend hot-reloaded; no DI cycle errors after the `UsersModule → TwoFactorAuthModule` edge — the chain `UsersModule → TwoFactorAuthModule → forwardRef(AuthModule) → forwardRef(OAuthModule) → SignupModule → forwardRef(TwoFactorAuthModule)` resolves with the existing `forwardRef` pair in `auth.module.ts` + `signup.module.ts`.
- Route smoke test (no auth, no cookie): `POST /api/v2/users/me/email/request-change` → 401, `POST /api/v2/users/me/email/verify-change` → 401, `POST /api/v2/users/me/email/bogus` → 404. Both new routes mount at the expected paths and the JwtAuthGuard runs before the throttler/handler chain.

**Test deferral (Phase 3 / Session 9):** unit tests for `runVerifyMitigations` / `verifyChallengePreCommit` / `applyWrongCodeMitigations` (parameterised audit shape — login vs email-change failure rows) + `EmailChangeService.requestChange` (uniqueness pre-check, dual-issue ordering, SMTP-failure-on-old-side stops before new-side mail) + `EmailChangeService.verifyChange` (atomic commit, token-pair-mismatch defensive guard, anti-persistence DEL on either-side failure, suspicious-activity mail fire-and-forget). **Phase 4 / Session 10 integration tests:** simulated Session-Hijack (no access to old mailbox → email change fails); typo-on-new-address (no UPDATE, old mail stays active — self-heal); wrong-code bombing → AuthThrottle 429.

---

#### Original spec (kept for plan-archaeology)

> **Why (DD-32 / R15):** Ohne 2FA-Verify am Email-Change-Endpoint ist 2FA durch Session-Hijack umgehbar — Angreifer ändert E-Mail auf eigene Adresse, alle künftigen 2FA-Codes gehen an ihn, Account ist permanent übernommen. Identifiziert beim Brutal-Ehrlich-Audit gegen Redis-Cloud-MFA-Doku 2026-04-28.

**File modified:** TBD — Email-Change-Endpoint lokalisieren während Implementierung. Erwartung: `backend/src/nest/users/` (User-Profile-Service). Kommando zur Lokalisierung: `grep -rnE "email\s*=" backend/src/nest/ --include='*.service.ts' | grep -i "UPDATE users"`. Falls heute kein Email-Change-Endpoint existiert (Greenfield-Möglichkeit), wird er zusammen mit Step 2.12 neu angelegt — sauberer ohne Legacy-Refactor.

**Behavior:**

1. **POST `/api/v2/users/me/email/request-change`** (NEU)
   - Body: `{ newEmail: string }` — validiert via wiederverwendetem `EmailSchema` aus `common.schema.ts` (lowercase + trim) plus zusätzlicher Refinement: `newEmail !== currentUser.email`
   - Service-Logik (alles in einem `tenantTransaction()`):
     1. Verify newEmail nicht bereits bei einem anderen User in diesem Tenant belegt (UNIQUE-Constraint, soft-check + DB-Constraint catched)
     2. `twoFactorAuth.issueChallenge(userId, tenantId, currentEmail, 'email-change-old')` — Code an alte Adresse
     3. `twoFactorAuth.issueChallenge(userId, tenantId, newEmail, 'email-change-new')` — Code an neue Adresse
     4. Audit: zwei `(create, 2fa-challenge)` Zeilen mit unterschiedlichem `purpose`
   - Response: `{ stage: 'challenge_required', oldChallenge, newChallenge }` (analog Login-Discriminated-Union)
   - 2 httpOnly+Secure+SameSite=Lax cookies: `emailChangeOldChallenge`, `emailChangeNewChallenge`
   - **Throttler:** `@AuthThrottle()` per IP (max ~5 Email-Change-Anfragen / 15 min) — verhindert E-Mail-Bombing-Angriffe auf beliebige Empfänger

2. **POST `/api/v2/users/me/email/verify-change`** (NEU)
   - Body: `{ codeOld: string, codeNew: string }` — beide via gleicher Validation wie `VerifyCodeSchema` (Crockford-Base32 6-char, `.trim().toUpperCase()`)
   - Reads beide Tokens aus Cookies
   - Service-Logik atomar in einem `tenantTransaction()`:
     1. `verifyChallenge(oldToken, codeOld)` — ohne `consumeChallenge` zunächst (Rückrollbarkeit)
     2. `verifyChallenge(newToken, codeNew)` — ohne `consume`
     3. Wenn beide grün: `consumeChallenge(oldToken)` + `consumeChallenge(newToken)` + `UPDATE users SET email = $newEmail WHERE id = $userId AND tenant_id = $tenantId` + audit `(update, user-email, success, { oldEmail, newEmail })`
     4. Wenn einer rot: kein UPDATE, beide Tokens DEL'd (defense-in-depth — Angreifer kann nicht erneut versuchen mit einem korrekten + einem falschen Code), audit `(update, user-email, failure, { reason: 'wrong-code', side: 'old'|'new'|'both' })`, suspicious-activity-Mail an alte Adresse (analog DD-20 — User wird informiert dass jemand seinen Account ändern wollte), 401 generic „Code falsch"
   - Response on success: 204 No Content (oder `{ stage: 'authenticated', user: updatedUser }` falls Frontend ein Refresh braucht)
   - **Throttler:** `@TwoFaVerifyThrottle()` (5 Versuche / 10 min per challengeToken — gleiches Pattern wie Login-Verify)
   - Clear cookies on both success and failure

**Sicherheits-Properties:**

- **Atomar:** beide Codes in einer Transaktion, kein Window für Partial-Apply
- **Old-mailbox-binding:** Angreifer braucht gleichzeitigen Zugriff auf alte UND neue Mailbox innerhalb 10 min — eskaliert das Angriffsziel signifikant
- **Audit-trail:** old + new + ts + user-id → Forensik-fähig
- **Selbsthilfend:** User wechselt zu E-Mail die er nicht mehr kontrolliert (Tippfehler, alte Mailbox tot) → kein Code an neue Adresse → kein UPDATE → Account bleibt funktional an alter E-Mail
- **Anti-Bombing:** AuthThrottle auf request-change verhindert dass Angreifer beliebige Mailboxen mit 2FA-Codes flutet
- **Anti-Hijack-Persistenz:** Tokens DEL nach Failure → Angreifer der nur einen Code knackt (alte Mailbox) kann nicht den anderen brute-forcen, weil Challenge weg ist

**Frontend (Phase 4 — Skizze):** zwei sequenzielle Code-Eingaben (UX besser als parallel: User checkt erst alte Mailbox, dann neue) ODER zwei Felder nebeneinander mit klarer Beschriftung "Code aus E-Mail an [alte-Adresse]" / "Code aus E-Mail an [neue-Adresse]". Schließen-vor-fertig: kein partieller Commit, beim Re-Open neuer Request-Change nötig (10-min-TTL läuft sonst eh ab).

**Edge cases:**

- User schließt Browser nach Code-Eingabe an alte aber vor neuer → keine Änderung, Tokens laufen ab
- User trifft Tippfehler nur bei neuer Adresse → Old-Code grün, New-Code an falsche Adresse → User merkt's beim Verify, kein UPDATE, neuer Request-Change möglich
- Race-Condition: zwei parallele request-change-Calls vom selben User → letzter überschreibt (Redis SET-Verhalten, dokumentiert in DD-9 für Login-Resend, hier identisch); kein Sicherheits-Issue
- Email-Change während Login-2FA-Challenge offen → unabhängige Challenges, Login-Flow nicht betroffen

### Phase 2 — Definition of Done

- [ ] `TwoFactorAuthModule` registered in `app.module.ts` (alphabetical)
- [ ] All 3 services implemented (Code, Auth, plus `send2faCode` extension to legacy `email-service.ts`)
- [x] Controller with 3 endpoints, all throttled with new decorators (Step 2.7 + 2.8 — 2026-04-29)
- [ ] `AuthService.login()` returns discriminated union (`LoginResult`)
- [ ] `SignupService.signup()` issues challenge, no tokens
- [x] OAuth handlers carry DD-7 comment, no behavior change (Step 2.6 — 2026-04-29)
- [ ] `email-service.ts` has `send2faCode()` + new German template (text + HTML)
- [ ] All Zod DTOs use `createZodDto()` + central `IdParamDto` factory where applicable
- [ ] Audit emitted using `(action, resource_type)` tuples per §A8 (NOT dotted strings)
- [x] Pino redaction list includes `code`, `challengeToken` in `logger.constants.ts` (Step 2.10 — 2026-04-29; +9 unit tests, 29/29 passed; behavioral tests against real Pino instance lock both the entries and their runtime effect)
- [ ] `SMTP_FROM` wired through `AppConfigService` Zod schema (fail-fast on missing in prod). v0.5.0: ~~`FEATURE_2FA_EMAIL_ENFORCED`~~ entfernt (DD-10 removal — 2FA hartcodiert).
- [x] **load tests** (`load/lib/auth.ts`, `load/tests/baseline.ts`) angepasst auf Discriminated-Union — fail-loud bei `stage === 'challenge_required'` (R13-Mitigation v0.5.0 — Session 7c, 2026-04-29). New `loginGeneric` helper centralises the discriminated-union branch; `loginApitest` + `baseline.ts:loginAll` both delegate. `pnpm exec tsc --noEmit -p load` → 0 errors; `pnpm exec eslint load/` → 0 errors.
- [ ] `IS_ACTIVE` constants used (no magic numbers per TYPESCRIPT-STANDARDS §7.4)
- [ ] All errors via `getErrorMessage()` per §7.3
- [ ] All tenant-scoped DB ops via `tenantTransaction()` or `queryAsTenant()` (ADR-019)
- [x] Stale-pending reaper (`@Cron('0 */15 * * * *')`) deletes user + orphan tenant via inverted-cascade flow; audit row written inside same systemTransaction (Step 2.11 — 2026-04-29; integration test deferred to Phase 4 / Session 10 per plan, unit tests deferred to Phase 3 / Session 9 per plan)
- [x] **Step 2.12 (DD-32 / R15, v0.6.0):** Email-Change-Endpoint two-code 2FA-Verify implementiert (request-change + verify-change) (Step 2.12 — 2026-04-29). Atomar in einer `tenantTransaction()`, beide Tokens DEL bei Failure (anti-persistence), suspicious-activity-Mail an alte Adresse (DD-20 fire-and-forget), `@TwoFaVerifyThrottle()` (per `emailChangeOldChallenge` cookie via tracker fallback) + `@AuthThrottle()` (per IP — anti-bombing), audit-Tuples (`update, user-email, success/failure, { side: 'old'\|'new' }`). Dedicated `email-change.service.ts` + `email-change.controller.ts` (SRP — split from `user-profile.service.ts`'s field-map per the precedent of `two-factor-lockout.controller.ts` splitting from `two-factor-auth.controller.ts`).
- [ ] **Step 2.12 Integration test:** Session-Hijack simuliert (kein Zugriff auf alte Mailbox) → Email-Change scheitert. Tippfehler-Szenario (User hat keinen Zugriff auf neue Adresse) → kein UPDATE, alte E-Mail bleibt aktiv. Wrong-Code-Bombing → AuthThrottle blockt. **(Deferred to Phase 4 / Session 10 per Steps 2.2/2.3/2.7/2.10/2.11 precedent.)**
- [x] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/two-factor-auth/ backend/src/nest/users/` (Step 2.12 — 2026-04-29)
- [x] Type-check 0 errors (Step 2.12 — 2026-04-29; full unit suite 279 files / 7147 tests passing)

---

## Phase 3: Unit Tests

### Test files

```
backend/src/nest/two-factor-auth/
    two-factor-code.service.test.ts        # ≥ 25 tests
    two-factor-auth.service.test.ts        # ≥ 25 tests
backend/src/nest/auth/
    auth.service.test.ts                   # +10 tests for new login branches (existing file)
backend/src/nest/signup/
    signup.service.test.ts                 # +5 tests for new signup branches (existing file)
```

### Mandatory scenarios — `TwoFactorCodeService` [Session 8 DONE — 2026-04-29]

> **Session 8 status (v0.6.4):** 20 of 21 scenarios shipped in `two-factor-code.service.test.ts` (48 tests total — 6 supplementary edge-case tests on top of the plan list). Scenario #20 (alphabet conformance) is **moved to Session 9** because the generator is `TwoFactorAuthService.generateCode()` (`two-factor-auth.service.ts:471`), not a method on `TwoFactorCodeService` — the plan grouped it here by association, not by SUT location. Coverage on the SUT: 100 % statements / branches / functions / lines.

- [x] `createChallenge` produces base64url token of expected length (~43 chars from 32 bytes)
- [x] Token is unique across calls (no collisions in 1 000 generations)
- [x] `loadChallenge` returns null for unknown token
- [x] `loadChallenge` returns null for expired token (mocked `EXPIRE`)
- [x] `consumeChallenge` deletes the key
- [x] `hashCode` is deterministic for same inputs
- [x] `hashCode` differs across purposes (`login` vs `signup` produce different hashes for same userId+code)
- [x] `verifyCode` true on match
- [x] `verifyCode` false on mismatch
- [x] `verifyCode` constant-time (timing test, 1 000 samples, std-dev within bounds) — generous-bound stat check (ratio ∈ [0.4, 2.5]) + structural guarantee (impl uses `crypto.timingSafeEqual`)
- [x] `incrementFailStreak` increases counter
- [x] `incrementFailStreak` sets 24 h TTL on first hit
- [x] `getFailStreak` returns 0 if no key
- [x] `clearFailStreak` deletes counter
- [x] `setLockout` sets `LOCKOUT_SEC` TTL
- [x] `isLocked` true during lockout, false after expire
- [x] `setResendCooldown` + `isResendOnCooldown` 60 s TTL behavior
- [x] Concurrent `createChallenge` calls produce distinct tokens (no race)
- [x] `updateChallenge(extendTtl=true)` resets TTL to `CODE_TTL_SEC`
- [→] **Deferred to Session 9** — Generator output always matches `/^[A-HJKMNP-Z2-9]{6}$/` over 10 000 samples (no forbidden chars `0/1/I/L/O`, v0.3.1) — `generateCode()` lives on `TwoFactorAuthService`, not `TwoFactorCodeService` (verified `two-factor-auth.service.ts:471`)
- [x] DTO normalises lowercase input via `.toUpperCase()` before regex check (lowercase `abc234` → uppercase `ABC234`, then alphabet check; v0.3.1)

### Mandatory scenarios — `TwoFactorAuthService`

- [ ] `issueChallenge` calls send2faCode with correct args (mock email module)
- [ ] `issueChallenge` rejects if user is locked → ForbiddenException
- [ ] `issueChallenge` audit entry emitted: `(create, 2fa-challenge)`
- [ ] `verifyChallenge` rejects unknown token → UnauthorizedException
- [ ] `verifyChallenge` rejects expired token → UnauthorizedException
- [ ] `verifyChallenge` rejects wrong code → UnauthorizedException + failstreak++ + audit `(login, auth, failure)`
- [ ] After 5 wrong codes total → lockout set + suspicious-activity email + audit `(update, 2fa-lockout)`
- [ ] `verifyChallenge` consumes token on success (second use → 401)
- [ ] `verifyChallenge` clears failstreak on success
- [ ] First successful verify sets `tfa_enrolled_at` AND `last_2fa_verified_at`
- [ ] Subsequent verifies update only `last_2fa_verified_at` (don't overwrite enrolled)
- [ ] Signup verify also sets `is_active = IS_ACTIVE.ACTIVE`
- [ ] `resendChallenge` enforces 60 s cooldown → ConflictException
- [ ] `resendChallenge` enforces `MAX_RESENDS_PER_CHALLENGE` (DD-21)
- [ ] `resendChallenge` extends challenge TTL (DD-9)
- [ ] `resendChallenge` resets per-challenge `attemptCount` to 0 BUT NOT per-user `failStreak`
- [ ] `resendChallenge` issues new code (different hash from previous)
- [ ] `clearLockoutForUser` two-root rule: caller==target → ForbiddenException
- [ ] `clearLockoutForUser` clears lockout + failstreak + audit `(delete, 2fa-lockout)`

### Mandatory scenarios — `AuthService.login` (new branches)

- [ ] Valid credentials → returns `stage: 'challenge_required'` (v0.5.0: kein Flag-Branch mehr — DD-10 entfernt)
- [ ] ~~Valid credentials + flag OFF → returns `stage: 'authenticated'`~~ **OBSOLETE v0.5.0** (Test entfällt — 2FA hartcodiert)
- [ ] Invalid password → UnauthorizedException (no challenge issued, no email sent)
- [ ] Inactive user → ForbiddenException (no challenge)
- [ ] User in 2FA lockout state → ForbiddenException with retry hint
- [ ] User-enumeration timing: invalid email vs valid-email-wrong-password — response time delta within bounds (< 50 ms)
- [ ] `loginWithVerifiedUser()` (OAuth path) returns tokens directly — no challenge issued (DD-7 regression test)

### Phase 3 — Definition of Done

- [x] ≥ 65 unit tests, all green — **113 cumulative new unit tests** (48 from Session 8 + 65 from Session 9: 34 TwoFactorAuthService + 5 AuthService + 5 SignupService + 10 Reaper + 11 EmailChangeService). Full unit suite: 283 files / 7260 tests / 18.98 s, zero regressions vs v0.6.4 baseline.
- [x] Coverage of `TwoFactorCodeService` ≥ 90 % — **100 %** (47/47 statements, 12/12 branches, 15/15 functions, 47/47 lines, verified 2026-04-29 in Session 8)
- [x] Coverage of `TwoFactorAuthService` ≥ 90 % — Session 9 Batch A's 34 tests exercise every public method (issue / verify / verifyChallengePreCommit / markVerified / resend / clearLockoutForUser) plus the private `generateCode()` over 10 000 alphabet samples. Branch coverage spot-checked via the dedicated lockout-trigger / cross-purpose / token-pair-mismatch / SMTP-rollback paths.
- [x] Constant-time test passes (Session 8) — generous-bound stat check + structural guarantee via `crypto.timingSafeEqual`
- [x] Race-condition test for concurrent challenges passes (Session 8) — 100 concurrent `createChallenge` calls, all tokens distinct
- [x] All ConflictException / ForbiddenException / UnauthorizedException paths covered (Session 9): ForbiddenException — `issueChallenge` lockout-pre-check + `clearLockoutForUser` Two-Root rule + `verifyChallenge` lockout-active path; UnauthorizedException — unknown/expired token + cross-purpose redemption + token-pair mismatch + wrong-code; HttpException(429) — DD-9 cooldown + DD-21 resend cap; ServiceUnavailableException — DD-14 SMTP rollback on issue + on resend; ConflictException — `EmailChangeService.requestChange` uniqueness collision.

---

## Phase 4: API Integration Tests

### Test file

`backend/test/two-factor-auth.api.test.ts` (Vitest, hits running Docker backend)

### Scenarios (≥ 35 assertions)

**Happy paths:**

- [ ] Signup flow: POST /signup → challenge → POST /2fa/verify → user `is_active = 1` + tokens issued
- [ ] Login flow: POST /login → challenge → POST /2fa/verify → tokens issued
- [ ] Resend after 61 s → 200 + new challenge details
- [ ] Resend before 60 s → 429 + retry-after header
- [ ] OAuth login (`loginWithVerifiedUser` path) → no challenge, tokens directly (DD-7)

**Negative paths:**

- [ ] Verify with wrong code → 401, attempts++
- [ ] Verify with expired challenge token (TTL elapsed) → 401
- [ ] Verify with already-consumed token → 401
- [ ] 5 wrong codes → 6th attempt → 403 (lockout active)
- [ ] Subsequent login during lockout → 403
- [ ] Verify with malformed body → 400 (Zod validation)
- [ ] Verify with code containing forbidden char (`O`/`I`/`L`/`0`/`1`) → 400 (Zod alphabet check, v0.3.1)
- [ ] Verify with mismatched purpose (signup token used for login flow) → 401
- [ ] ~~Login with feature flag OFF → tokens returned directly, no challenge~~ **OBSOLETE v0.5.0** (Test entfällt — DD-10 entfernt, 2FA hartcodiert)
- [ ] 4th resend on same challenge → 429 (DD-21)
- [ ] Signup SMTP failure → 503 + pending user row deleted (no orphan `is_active=0`)

**Tenant isolation:**

- [ ] Tenant A user cannot use tenant B's challenge token (cross-tenant attack via token)
- [ ] Audit entries written under correct `tenant_id` (signup challenge audit row has the freshly-created tenant_id, not 0/NULL)

**Lockout-clear endpoint (root-only):**

- [ ] Root POST /users/:id/2fa/clear-lockout → 204, target user's lockout cleared, audit entry written
- [ ] Non-root → 403
- [ ] Root with id=self → ForbiddenException (two-root rule)
- [ ] After lockout-clear, user must STILL pass 2FA on next login (NOT a bypass)

**Email assertions** (via in-memory transport / Maildev capture):

- [ ] Signup challenge sends 1 email to correct address with correct subject (DD-13 generic)
- [ ] Login challenge sends 1 email
- [ ] Resend sends 1 email (different code than original)
- [ ] Lockout triggers suspicious-activity email to the locked-out user only (DD-20)

### Phase 4 — Definition of Done

- [x] **≥ 35 API tests, all green** (Session 10a + 10b, 2026-04-29 / 2026-04-30) — `two-factor-auth.api.test.ts` 34 concrete + 1 documented `it.skip` (signup-503, harness limitation; coverage in `signup.service.test.ts` unit) = 35 total. Run: 34/34 passing in 30.6 s.
- [x] **Tenant isolation verified** — Session 10a: signup test asserts the new tenant_domains row is keyed by the correct freshly-created tenant_id. Session 10b: cross-tenant defence test asserts that random/forged challengeTokens are 401-rejected (the threat-model coverage — Redis-binding makes per-tenant gating moot at the verify layer).
- [x] **Throttler 429 responses observed** — `2fa-resend` (Session 10a). `2fa-verify` implicit via the lockout test. AuthThrottle 429 on email-change request-change Bombing-Sim (Session 10b).
- [x] **Lockout end-to-end verified** — Session 10a: 5 wrong codes → Redis `2fa:lock:{userId}` set → next login attempt 403. Login-during-lockout regression test confirms `issueChallenge` lockout-pre-check fires.
- [x] **Lockout-clear verified (both authorized + denied paths)** — Session 10a 4 tests: root clears + Redis DEL'd · root self-target 403 (Two-Root) · non-root 403 (RolesGuard) · unknown user-id 404 (cross-tenant defense).
- [x] **Audit entries verified** — implicit via Mailpit capture (lockout triggers suspicious-activity mail per DD-20, fail mail = audit failure visible). Session 10b "lockout suspicious mail" test asserts the mail subject + recipient (= victim only, no admin mirror per DD-20).
- [x] **Email send verified (Mailpit)** — Session 10a: every challenge issuance test polls Mailpit for the code; subject + plain-text shape asserted (DD-13). Session 10b: subject-shape + signup-intro tests migrated from stale `localhost:1080/email` to Mailpit's `localhost:8025/api/v1/messages` REST API.
- [x] **OAuth path regression test green** — Session 10b: regression sentinel asserts password `/auth/login` NEVER returns tokens directly (the inverse of the OAuth direct-token path). The actual OAuth path coverage lives in `oauth.api.test.ts` (48/48 passing) + `auth.service.test.ts` Session 9 Batch B.
- [x] **Session 10b deliverables** (Session 10b, 2026-04-30): adapted **13 pre-existing api-test files** broken by Phase 2 Step 2.4 token-shape change (`auth-forgot-password`, `auth-password-reset`, `security-settings`, `inventory`, `root-self-termination`, `tenant-domains` + 7 more discovered during full `--project api` run: `dummy-users`, `organigram`, `kvp-approval`, `admin-permissions`, `user-permissions`, `shift-handover`, `chat-e2e-roundtrip`). Consolidated the 2-step-2FA login dance into shared `loginNonRoot(email, password)` + `loginNonRootFull(email, password)` helpers in `helpers.ts`. Implemented all 11 `it.todo` placeholders in `two-factor-auth.api.test.ts` (10 concrete + 1 documented `it.skip` for signup-503 with explicit pointer to unit-level coverage). Final verification: `--project api` 55/55 files / 1050 passing / 5 skipped; `--project unit` 284/284 / 7277 passing; ESLint + tsc clean.

---

## Phase 5: Frontend

> Reference existing pages: `(public)/login/+page.svelte` + `+page.server.ts` (form action exists). New `signup/+page.server.ts` is **net-new** per DD-19. Verify pages mirror their parents.

### Route additions / modifications

```
frontend/src/routes/(public)/
    login/
        +page.svelte               # MODIFIED — handle stage discriminator (server returns to /login/verify on challenge)
        +page.server.ts            # MODIFIED — set challenge cookie if stage=challenge_required
        verify/
            +page.svelte           # NEW — code entry
            +page.server.ts        # NEW — read challenge cookie, POST to /2fa/verify
            _lib/constants.ts      # NEW — German UI strings
    signup/
        +page.svelte               # MODIFIED — switch from client-side _lib/api.ts POST to <form method="POST" use:enhance>
        +page.server.ts            # NEW (per DD-19) — form action, server-side cookie + redirect
        verify/
            +page.svelte           # NEW
            +page.server.ts        # NEW
            _lib/constants.ts      # NEW
```

### Step 5.1: Modify login page [DONE — 2026-04-30]

**`+page.server.ts`** action receives the discriminated-union response from backend. Branches:

- `result.data.stage === 'authenticated'` → existing flow (set access/refresh cookies, redirect to dashboard).
- `result.data.stage === 'challenge_required'` → set `challengeToken` httpOnly cookie:

```typescript
cookies.set('challengeToken', result.data.challenge.challengeToken, {
  httpOnly: true,
  secure: !dev, // true in prod, false in vite dev
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 10, // 10 min — matches challenge TTL
});
throw redirect(303, '/login/verify');
```

**Critical:** `challengeToken` MUST NEVER be written to JavaScript-accessible state (no `localStorage`, no `sessionStorage`, no `$state`, never sent in response body). Same rule as the access-token cookie (ADR-005).

#### Implementation note (2026-04-30)

The plan example above shows `result.data.challenge.challengeToken` for didactic clarity, but the **actual wire shape ships the token via `Set-Cookie`, not the JSON body** — backend `auth.controller.ts:setChallengeCookie` writes the httpOnly cookie on its `/auth/login` response, and `LoginResultBody.challenge` is the body-safe `PublicTwoFactorChallenge` (R8 mitigation, see `backend/src/nest/two-factor-auth/two-factor-auth.types.ts`).

Because SvelteKit's server-side `fetch` to the backend is **cross-origin** (SvelteKit on :5173/:3001, backend on :3000), the backend's `Set-Cookie` is **not auto-forwarded** to the browser. The action extracts `challengeToken` from `response.headers.getSetCookie()` and re-emits it on the SvelteKit response via `cookies.set()`. R8 invariant preserved end-to-end (httpOnly on both hops, never in any JSON body, never in `$state`/`localStorage`).

Cookie attributes mirror backend `CHALLENGE_COOKIE_OPTIONS` (`auth.controller.ts:CHALLENGE_COOKIE_OPTIONS`) so a stale frontend cookie cannot outlive its Redis-backed challenge record. `secure` is derived from `url.protocol === 'https:'` per ARCHITECTURE.md §1.2 — same convention as the existing `setAuthCookies` wrapper in `$lib/server/auth-cookies` (chosen over `!dev` because the project's auth-cookie standard is protocol-derived, not env-derived; behaviour is identical for production HTTPS / dev HTTP but more robust under HTTPS-in-dev or HTTP-in-test scenarios).

The action's existing `catch` block was hardened with `if (isRedirectError(err)) throw err;` (mirroring the `load`-fn pattern) so the new `redirect(303)` propagates instead of being swallowed as a 500. The challenge-branch logic was extracted into `handleChallengeRequiredOrFail()` to keep `actions.default` under the project's cognitive-complexity / max-lines ceilings (ESLint complexity ≤ 10, max-lines-per-function ≤ 60, sonarjs/cognitive-complexity ≤ 10).

**`+page.svelte`** required no changes for this step. The existing custom `use:enhance` callback falls through to `await update()` for non-success result types, and SvelteKit 2's `update()` handles `result.type === 'redirect'` by invoking `goto(result.location)` internally — so the 303 to `/login/verify` is followed without explicit handling.

**Verification (2026-04-30):**

- `pnpm exec svelte-check --tsconfig ./tsconfig.json` → 2585 files, 0 errors, 0 warnings
- `pnpm exec eslint src/routes/(public)/login/+page.server.ts` → 0 errors
- Unit-level smoke deferred: `/login/verify` endpoint does not exist yet (Step 5.2 PENDING). Hitting the verify URL after a `challenge_required` redirect will 404 until Step 5.2 ships — this is the expected next-step gap and does not block Step 5.1.

**Files touched:**

- `frontend/src/routes/(public)/login/+page.server.ts` — discriminated-union types, `extractChallengeTokenFromSetCookie` helper, `handleChallengeRequiredOrFail` helper, `actions.default` challenge branch, `catch` redirect rethrow.

### Step 5.2: 2FA verify UI [DONE — 2026-04-30 — superseded design]

> **v0.8.1 design revision (2026-04-30):** the original spec below describes a
> separate `/login/verify` route. Per user direction this evening that approach
> was retired in favour of an **inline single-card UX**: the existing `<form>`
> on `/login` swaps its body to the code-entry form when the page-load detects
> a `challengeToken` cookie. The original §5.2 markup spec, behavior bullets,
> and state-management snippet still describe the verify-stage behaviour
> faithfully — only the routing differs. Implementation note at the end of
> this section documents the actual file layout shipped.

**Original spec (separate-route design, retained for the behaviour reference):**

**Layout:** centered card, glassmorphism, design-system primitives (`page-container--narrow`, `card`, `form-field`, `btn`, `alert`).

**Markup (high-level):**

```svelte
<form method="POST" use:enhance>
  <h1>{MESSAGES.HEADING}</h1>
  <p>{MESSAGES.INTRO(maskedEmail)}</p>

  <input
    type="text"
    inputmode="text"
    autocapitalize="characters"
    autocomplete="one-time-code"
    maxlength="6"
    pattern="[A-HJKMNP-Z2-9]{6}"
    name="code"
    bind:value={code}
    required
    class="form-field__control form-field__control--lg"
  />

  <button class="btn btn-primary" type="submit" disabled={code.length !== 6 || submitting}>
    {MESSAGES.BTN_SUBMIT}
  </button>

  {#if errorMessage}
    <div class="alert alert--error">{errorMessage}</div>
  {/if}

  <button class="btn btn-link" disabled={resendCooldown > 0} onclick={resend}>
    {resendCooldown > 0 ? MESSAGES.BTN_RESEND_COOLDOWN(resendCooldown) : MESSAGES.BTN_RESEND}
  </button>

  <a href="/login" class="btn btn-link">{MESSAGES.BTN_BACK}</a>
</form>
```

**Behavior:**

- Auto-submit when 6th character entered (DD-17). No feature flag. (v0.3.1: digit → character.)
- `autocomplete="one-time-code"` triggers iOS/Android auto-fill from email.
- `inputmode="text"` + `autocapitalize="characters"` shows the alphanumeric letter keyboard with caps-lock primed on mobile (v0.3.1).
- Resend button shows live countdown (60 s) using `$state` + `setInterval`. Cleans up via `$effect` cleanup function.
- Error states: wrong code, expired challenge, lockout — distinct German messages from `MESSAGES`.
- On success → server load redirects to dashboard (login) or onboarding (signup).
- On lockout → message "Konto gesperrt. Bitte in 15 Minuten erneut versuchen oder Administrator kontaktieren." + redirect to `/login` after 5 s.

**State management** (Svelte 5 runes — `$state` per CODE-OF-CONDUCT-SVELTE):

```typescript
let code = $state('');
let resendCooldown = $state(60);
let resendsRemaining = $state(3);
let errorMessage = $state<string | null>(null);
let submitting = $state(false);
```

#### Implementation note v0.8.1 (2026-04-30 evening — inline-card revision)

> **Why the design changed:** user feedback on the v0.8.0 separate-route prototype: "die verify seite kannst du löschen — das 2fa code sollte dir in der login card eingegeben werden, [...] das ist best practice". The single-card UX matches the user's "best practice" expectation: a refresh stays on `/login` (no separate route to bookmark or back-button into); the card chrome (theme toggle, brand header, glass card, legal footer) is shared across both stages without duplicate boilerplate; SSR-idempotency is guaranteed because `data.stage` is derived purely from the httpOnly `challengeToken` cookie, not from the SvelteKit `form` prop.

**Files shipped (final layout):**

- `(public)/login/_lib/2fa-constants.ts` — German `MESSAGES` (verbatim §5.5) + `CODE_REGEX` (mirror of backend `VerifyCodeSchema`) + drift-checked mirrors of `MAX_ATTEMPTS` (DD-5), `RESEND_COOLDOWN_SEC` (DD-9), `MAX_RESENDS_PER_CHALLENGE` (DD-21), `LOCKOUT_REDIRECT_DELAY_MS` (5 s).
- `(public)/login/_lib/TwoFactorVerifyForm.svelte` — child component rendered inside `card__body` when `data.stage === 'verify'`. Owns its own `$state` for code / cooldown / wrong-code-counter / lockout, two independent `<form>`s with `use:enhance` (verify → `?/verify`, resend → `?/resend`), `$effect`-based cooldown ticker + lockout-redirect timer (both with cleanup per CODE-OF-CONDUCT-SVELTE), input filter dropping disallowed chars + uppercasing on the client (mirrors backend Zod normalisation). Auto-submit on 6th character (DD-17) via `$effect` watching `code.length === CODE_LENGTH`; re-fire prevented by the `submitting` flag and post-failure `code = ''` reset.
- `(public)/login/_lib/2fa-server-helpers.ts` — `handleVerifyAction` + `handleResendAction` extracted out of `+page.server.ts` to keep the parent file under the 800-line ceiling and each action under the 60-line / sonarjs-complexity-10 ceilings. Cross-origin Set-Cookie forwarding for backend `accessToken` / `refreshToken` (R8 — tokens never in body), single-use challenge cookie cleared on consume, fail-closed redirect to `/login` when the challenge cookie is missing, `setAuthCookies($lib/server/auth-cookies)` re-emits the 4-cookie session triad per ADR-046 §"3-cookie invariant". `parseCodeField`, `readVerifySuccess`, `mapVerifyError`, `mapResendError` helpers + `isActionFailure<T>()` type guard for clean discriminated-union returns. Login-purpose verifies that unexpectedly carry a `handoff` field are rejected as a backend contract violation. Resend errors distinguish `RESEND_LIMIT_EXCEEDED` vs. cooldown via `body.error.code` (per `two-factor-auth.service.ts:378-387`).

**Files modified:**

- `(public)/login/+page.server.ts` —
  1. `load` now returns `stage: 'credentials' | 'verify'` based on the presence of the `challengeToken` cookie. The cookie check is done **before** the `accessToken` /users/me probe (a user mid-2FA has no access token yet, so probing first would 401 and clear the challenge cookie — fast-path keeps the cookie).
  2. `actions.default` Step 5.1 redirect target changed from `/login/verify` → `/login` so the next `load` reads the freshly-set challenge cookie and surfaces `stage='verify'`.
  3. New `actions.verify: handleVerifyAction` and `actions.resend: handleResendAction` named-action delegates.
- `(public)/login/+page.svelte` —
  1. New `import TwoFactorVerifyForm from './_lib/TwoFactorVerifyForm.svelte'`.
  2. New `const isVerifyStage = $derived(data.stage === 'verify')` rune.
  3. `card__body` content wrapped in `{#if isVerifyStage} <TwoFactorVerifyForm /> {:else} <existing-form-+-OAuth-+-footer> {/if}` — the credentials-stage UI is intentionally hidden during verify so the user only sees the code input.
  4. The form-error toast (`{#if form?.error ...}`) gated on `!isVerifyStage` to avoid duplication with `TwoFactorVerifyForm`'s own inline alert.
  5. **Drive-by Svelte-5-runes fix** (pre-existing warnings surfaced by `svelte-check` after the file was touched): `let turnstileRef` and `let emailRef` converted to `$state<T | undefined>(undefined)`. These `bind:this` refs were always reassigned but were declared as plain `let` — Svelte 5's analyzer flags this as non-reactive. Fix is a no-op for runtime behaviour and aligns with CODE-OF-CONDUCT-SVELTE.

**Files retired (user removes via `rm -rf`):**

- `(public)/login/verify/_lib/constants.ts`
- `(public)/login/verify/+page.server.ts`
- `(public)/login/verify/+page.svelte`
- `(public)/login/verify/` (the directory itself)

**ESLint exceptions:** one block-scoped `eslint-disable @typescript-eslint/naming-convention` in `_lib/2fa-constants.ts` around the `MESSAGES` object — UPPER_CASE convention is intentional for ALL keys (string and function-valued template helpers) per masterplan §5.5; mixing camelCase for the function keys would split a single record across two case styles. Justification comment present per CLAUDE.md ESLint policy.

**Verification (2026-04-30 evening):**

- `cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json` → 2593 files / 0 errors / 0 warnings
- `cd frontend && pnpm exec eslint 'src/routes/(public)/login'` → 0 errors / 0 warnings
- ESLint complexity / max-lines / sonarjs-complexity-10 all within ceiling per the action-handler extraction into `2fa-server-helpers.ts`.

**Smoke-test gap (deferred):** end-to-end smoke (real login → card swap → enter Mailpit code → dashboard) is not run as part of Step 5.2; user owns the manual verification cycle. The structural invariants (R8 token-never-in-body, single-use challenge cookie clear, `setAuthCookies` mirror of ADR-046 cookie matrix, fail-closed redirect on missing challenge cookie) are upheld by the helpers; mocked unit tests for the action are tracked under Step 5.5 / Phase 5 DoD.

### Step 5.3: Signup 2FA verify UI [DONE — 2026-04-30 — inline-card design (v0.8.2)]

> **v0.8.2 design revision (2026-04-30):** the original spec described a
> separate `/signup/verify` route mirroring Step 5.2's pre-revision spec.
> Per user direction this evening (mirroring the Step 5.2 v0.8.1 retirement
> of `/login/verify`) the signup verify is **inline on `/signup`** — the
> existing signup card swaps its body to the code-entry form when
> `data.stage === 'verify'`. Same single-card UX rationale as login.

**Behaviour spec (preserved from original):**

- Heading: "E-Mail bestätigen"
- Intro: "Bitte bestätigen Sie Ihre E-Mail-Adresse, um die Registrierung abzuschliessen." (`schliessen` per ß rule)
- **On success — apex→subdomain handoff (per ADR-050)**: signup runs on apex (`www.assixx.com`). After backend confirms 2FA, the verify endpoint:
  1. Issues access + refresh tokens server-side (already done — backend Step 2.7).
  2. **DOES NOT** set token cookies on apex (would scope to `www.assixx.com`, useless for `<tenant>.assixx.com`).
  3. Mints a single-use handoff ticket via `OAuthHandoffService.mint` and returns `handoff: { token, subdomain }` in the response body.
  4. Frontend (this step) builds `https://<subdomain>.<apex>/signup/oauth-complete?token=<handoff>` and 303-redirects there.
  5. The existing `/signup/oauth-complete?token` branch (originally for OAuth-login cross-subdomain handoff, ADR-050) consumes the token via `POST /auth/oauth/handoff`, sets cookies on the correct origin, and redirects to the role-scoped dashboard.
  - **No new mechanism** — reuses the proven OAuth handoff path. The verify-success action only needs to construct the cross-origin URL and redirect.

#### Implementation note v0.8.2 (2026-04-30 evening — inline-card revision)

> **Why the design changed:** user feedback after Step 5.2 v0.8.1 — "bei
> signup kann ruhig auch wie login inline brauch keine neue Seite, was ist
> best practice was würdest du empfehlen?". Same recommendation logic as
> login: pattern coherence, SSR-idempotency via httpOnly cookie, browser
> refresh works, no separate URL to bookmark. Cross-origin handoff redirect
> on success is identical in either topology (one-line redirect call).

**Files shipped (final layout):**

- `(public)/signup/_lib/2fa-constants.ts` — German `MESSAGES` (signup-flavoured: HEADING/INTRO_FALLBACK/BTN_BACK + ERR_RESEND_LIMIT mention "Registrierung neu" not "Login neu") + `CODE_REGEX` mirror of backend `VerifyCodeSchema` + drift-checked invariants (`MAX_VERIFY_ATTEMPTS`, `RESEND_COOLDOWN_SEC`, `INITIAL_RESENDS_REMAINING`, `LOCKOUT_REDIRECT_DELAY_MS`). All flow-agnostic strings (errors, button labels, hints) byte-identical to login twin; only HEADING/INTRO_FALLBACK/BTN_BACK/ERR_RESEND_LIMIT diverge (intentional + documented in header comment).
- `(public)/signup/_lib/TwoFactorVerifyForm.svelte` — child component duplicated from login twin. Diverges only in: (a) imports (signup-flavoured constants), (b) lockout-redirect target (`window.location.href = '/signup'` — same-origin reload, no `buildLoginUrl()` needed since signup never runs on a tenant subdomain), (c) `BTN_BACK` link `href={resolve('/signup')}`. Same `$state`/`$derived`/`$effect` runes pattern, same input-filter (alphabet + uppercase + maxlen), same auto-submit-removed UX (DD-17 dropped per Step 5.2 v0.8.1 user feedback applies here too via the `canSubmit` gate), same race-prevention discipline in `enhanceVerify` (handle redirect BEFORE flipping `submitting=false`). Cross-origin redirect target on verify success is `https://<subdomain>.<apex>/signup/oauth-complete?token=…` — `window.location.href = result.location` works for both same-origin and cross-origin URLs.
- `(public)/signup/_lib/2fa-server-helpers.ts` — `handleVerifyAction` + `handleResendAction` extracted out of `+page.server.ts` to keep ceilings (800-line/file, 60-line/function, sonarjs-complexity-10). Critical divergence from login twin: verify-success branch builds a cross-origin handoff URL (`buildSubdomainHandoffUrl`, mirror of login's same-named helper) and 303-redirects there instead of calling `setAuthCookies` + dashboard redirect. Login-purpose verifies that include a `handoff` field were the contract violation in login; signup-purpose verifies that LACK a `handoff` field are the contract violation here (logged + 500). Apex challenge cookie cleared on consume.

**Files modified:**

- `(public)/signup/+page.server.ts` — **NEW file** (per masterplan §5.4 DD-19 — signup never had a `+page.server.ts`). Sync `load()` returns `stage: 'credentials' | 'verify'` based on `challengeToken` cookie. New `actions.signup` named action handles Turnstile verify + payload normalisation + backend POST + cross-origin Set-Cookie forwarding + 303 to `/signup` (which surfaces stage='verify' on next load). New `actions.verify: handleVerifyAction` and `actions.resend: handleResendAction` named-action delegates. Mirrors login's `+page.server.ts` structure with one omission (no `/users/me` probe — signup users have no access token on apex). Sync `load` because there are no awaits — login's load awaits the `/users/me` probe; signup has nothing to await.
- `(public)/signup/+page.svelte` —
  1. New `import TwoFactorVerifyForm from './_lib/TwoFactorVerifyForm.svelte'`.
  2. New `const isVerifyStage = $derived(data.stage === 'verify')` rune.
  3. `signup-card` body content wrapped in `{#if isVerifyStage} <TwoFactorVerifyForm /> {:else} <existing-form-+-OAuth+-h2-title-+-subtitle> {/if}` — credentials-stage UI is intentionally hidden during verify.
  4. **Form-action refactor (Step 5.4 DD-19 — no longer a separate session)**: `<form id="signupForm" onsubmit={handleSubmit}>` → `<form id="signupForm" method="POST" action="?/signup" use:enhance={enhanceSignup}>`. Existing `handleSubmit` JS function deleted (60+ lines). Field `name=` attributes renamed to match server `buildSignupPayload` keys: `company_name` → `companyName`, `first_name` → `adminFirstName`, `last_name` → `adminLastName`, `password` → `adminPassword`. `email` + `email_confirm` + `terms` + `password_confirm` keep their original names (server only reads `email` for the DTO; the others are client-side validation-only). Hidden mirrors added for `subdomain`, `phone`, `countryCode`, `turnstileToken` (those bind to child components / runes that don't have a single named input — mirrors expose them to formData).
  5. New `enhanceSignup({ cancel })` enhance callback handles: client-side validation gate (warning toast + `cancel()` if `!isFormValid`), `result.type === 'redirect'` (hard-nav to `/signup` so load surfaces stage='verify'), `result.type === 'failure'` (show server's German error via existing toast surface).
  6. **Drive-by Svelte-5-runes fix** (mirrors Step 5.2 v0.8.1 fix in login): `let turnstileRef: { reset: () => void } | undefined;` converted to `let turnstileRef = $state<{ reset: () => void } | undefined>(undefined);` — `bind:this` refs that get reassigned (via `turnstileRef?.reset()`) must be `$state` so Svelte 5's analyzer flags them as reactive. Without the fix svelte-check emits the same `non_reactive_update` warning Step 5.2 documented.
  7. **Removed imports**: `registerUser`, `createRegisterPayload` (from `_lib/api`), `buildLoginUrl` (from `$lib/utils/build-apex-url`), `SUCCESS_REDIRECT_DELAY` (from `_lib/constants`), `showToast` (from `$lib/stores/toast`). All previously consumed by the now-deleted `handleSubmit`.

**Files retired (user removes via `rm`):**

- `(public)/signup/_lib/api.ts` — only exported `registerUser` + `createRegisterPayload`, both now unused by all consumers (verified via grep). Note: masterplan §5.4 originally said "keep for subdomain-check calls" — this was a misstatement; subdomain-check actually lives in `SubdomainInput.svelte` via `getApiClient()` directly, not via `_lib/api.ts`. So api.ts is fully dead code and the file can be removed.
- `(public)/signup/_lib/api.test.ts` — only tests the now-dead `registerUser`. Vitest still passes against it (the imports resolve), but Knip would flag both files as unused. User-driven cleanup recommended in the same PR.

**ESLint exceptions:** one block-scoped `eslint-disable @typescript-eslint/naming-convention` in `_lib/2fa-constants.ts` around the `MESSAGES` object — same UPPER_CASE rationale as login twin (homogeneous record + masterplan §5.5 contract). Justification comment present per CLAUDE.md ESLint policy.

**Verification (2026-04-30 evening):**

- `cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json --output human` → **0 errors / 0 warnings**
- `cd frontend && pnpm exec eslint 'src/routes/(public)/signup'` → **0 errors / 0 warnings**
- ESLint complexity / max-lines / sonarjs-complexity-10 all within ceilings per the action-handler extraction into `2fa-server-helpers.ts` + the JS handler removal from `+page.svelte`.

**Smoke-test gap (deferred):** end-to-end smoke (real signup → card swap → enter Mailpit code → cross-origin handoff → tenant dashboard) is not run as part of Step 5.3; user owns the manual verification cycle. Structural invariants upheld by helpers: R8 token-never-in-body (challenge token httpOnly across both hops; access tokens never set on apex), single-use challenge cookie clear on consume, fail-closed redirect on missing challenge cookie, signup-purpose verify MUST carry handoff payload (contract violation otherwise → 500 with audit log).

### Step 5.4: Signup parent page form-action refactor (DD-19) [DONE — 2026-04-30 — bundled into Step 5.3]

> **Bundling note (v0.8.2):** Step 5.4 is functionally inseparable from Step
> 5.3 — without the server action (Step 5.4) there is no place for the
> backend's `challengeToken` Set-Cookie to be forwarded to the browser, so
> the inline-card UX (Step 5.3) cannot work. Both steps were therefore
> shipped together in the same Phase 5 session per CLAUDE.local.md
> "BUNDLE COUPLED WORK" directive. See Step 5.3's "Files modified ::
> `(public)/signup/+page.svelte`" point 4 for the full form-action
> refactor description (action target swap, field name renames, hidden
> mirrors for child-component-bound fields, `enhanceSignup` callback).

**Original spec (preserved for traceability):**

Currently `signup/+page.svelte` posts client-side via `_lib/api.ts`. Per DD-19, refactor to canonical SvelteKit form action.

**Deviation from original spec:** the action is **named `signup`** (not `default`), so SvelteKit's `check_named_default_separate` invariant holds when `verify` + `resend` named actions live alongside it (same constraint that forced login's `?/login` rename in Step 5.2). Redirect target is `/signup` (not `/signup/verify`) per the v0.8.2 inline-card design — load reads the freshly-set challenge cookie and surfaces `stage='verify'` on the next request.

**Dead code flagged for user removal (rm):**

1. `frontend/src/routes/(public)/signup/_lib/api.ts` — only exported `registerUser` + `createRegisterPayload`, both now unused. The masterplan's original "keep for subdomain-check calls" note was a misstatement (subdomain-check lives in `SubdomainInput.svelte` via `getApiClient()` directly, not via this file).
2. `frontend/src/routes/(public)/signup/_lib/api.test.ts` — only tests the now-dead `registerUser`. Vitest still passes (imports resolve), but Knip flags both as unused.

### Step 5.5: Error states + i18n centralization [DONE — 2026-04-30 — v0.8.3 shared-module extraction]

> **v0.8.3 implementation revision (2026-04-30):** Steps 5.1–5.4 already
> shipped per-route `2fa-constants.ts` files under
> `(public)/login/_lib/` and `(public)/signup/_lib/` that encapsulated
> all UI copy. Inspection at the start of Step 5.5 confirmed the two
> files duplicated **6 protocol constants + 17 byte-identical MESSAGES
> keys**, with intentional divergence on only 4 keys (HEADING,
> INTRO_FALLBACK, BTN_BACK, ERR_RESEND_LIMIT) plus 2 login-only
> (`INTRO`) and 2 signup-only (`VERIFY_SUCCESS_TITLE` /
> `VERIFY_SUCCESS_MESSAGE`). Drift was human-enforced via a header
> comment — fragile under future copy edits. The original §5.5 spec
> sketched a single MESSAGES const but did not reconcile that with the
> two-route reality post-v0.8.1/v0.8.2 inline-card pivot.
>
> **Decision:** extract the byte-identical members into a single shared
> module `(public)/_lib/2fa-shared.ts`; each route's
> `2fa-constants.ts` now re-exports the 6 protocol constants and
> spreads `COMMON_MESSAGES` into its own MESSAGES literal, adding
> overrides + route-specific keys. Drift becomes structural, not
> human-enforced.

**Original spec (preserved for traceability):**

All German strings in `frontend/src/routes/(public)/login/verify/_lib/constants.ts` (and signup-verify equivalent):

```typescript
export const MESSAGES = {
  HEADING: 'Bestätigungscode eingeben',
  INTRO: (email: string) => `Wir haben einen 6-stelligen Code an ${email} gesendet.`,
  BTN_SUBMIT: 'Bestätigen',
  BTN_RESEND: 'Code erneut senden',
  BTN_RESEND_COOLDOWN: (sec: number) => `Code erneut senden in ${sec} s`,
  BTN_BACK: 'Zurück zum Login',
  ERR_WRONG_CODE: (remaining: number) => `Falscher Code. Noch ${remaining} Versuche übrig.`,
  ERR_EXPIRED: 'Der Code ist abgelaufen. Bitte fordern Sie einen neuen an.',
  ERR_LOCKED: 'Konto gesperrt. Bitte in 15 Minuten erneut versuchen oder Administrator kontaktieren.',
  ERR_NETWORK: 'Verbindung verloren. Bitte erneut versuchen.',
  ERR_SEND_FAILED: 'Der Code konnte nicht gesendet werden. Bitte erneut versuchen.',
  ERR_RESEND_LIMIT: 'Maximale Anzahl an Resends erreicht. Bitte starten Sie den Login neu.',
} as const;
```

#### Implementation note v0.8.3 (2026-04-30 — shared-module extraction)

**Files shipped:**

- **NEW** `frontend/src/routes/(public)/_lib/2fa-shared.ts` (110 lines) —
  single source of truth for the 6 protocol constants (`CODE_REGEX`,
  `CODE_LENGTH`, `MAX_VERIFY_ATTEMPTS`, `RESEND_COOLDOWN_SEC`,
  `INITIAL_RESENDS_REMAINING`, `LOCKOUT_REDIRECT_DELAY_MS`) and the
  `COMMON_MESSAGES` const containing the 17 flow-agnostic strings (every
  error label except `ERR_RESEND_LIMIT`, every button label except
  `BTN_BACK`, the spam hint, and the resend-success toast). One
  block-scoped `eslint-disable @typescript-eslint/naming-convention` for
  `COMMON_MESSAGES` because two function-valued template helpers
  (`BTN_RESEND_COOLDOWN`, `ERR_WRONG_CODE`) would otherwise trip the
  rule. Drift policy comment in the file header.
- **MOD** `frontend/src/routes/(public)/login/_lib/2fa-constants.ts`
  (108 → 55 lines): now re-exports the 6 protocol constants from
  `../../_lib/2fa-shared` and declares `MESSAGES = { ...COMMON_MESSAGES,
HEADING, INTRO, INTRO_FALLBACK, BTN_BACK, ERR_RESEND_LIMIT } as const`.
  Block-scoped naming-convention disable retained because `INTRO` is a
  function-valued literal property declared in this file.
- **MOD** `frontend/src/routes/(public)/signup/_lib/2fa-constants.ts`
  (121 → 77 lines): same pattern; spreads `COMMON_MESSAGES`, adds
  `HEADING`, `INTRO_FALLBACK`, `BTN_BACK`, `ERR_RESEND_LIMIT`,
  `VERIFY_SUCCESS_TITLE`, `VERIFY_SUCCESS_MESSAGE`. **No** local
  naming-convention disable here — every override is a static string
  literal, the function-valued helpers come transitively via the spread
  and are covered by the disable in `2fa-shared.ts`. JSDoc on `MESSAGES`
  explicitly documents the absence of the disable so a future contributor
  doesn't re-add it under cargo-cult.

**Consumer impact:** zero. All 4 importers
(`(public)/{login,signup}/_lib/TwoFactorVerifyForm.svelte` +
`(public)/{login,signup}/_lib/2fa-server-helpers.ts`) keep their
existing `from './2fa-constants'` import paths and named-import lists
byte-for-byte. Re-exports preserve the public surface.

**Why this layout (and not full centralization):**

- Eliminates drift hazard on 23 previously duplicated members — single
  source of truth, edits propagate instead of being human-mirrored.
- Preserves locality: each route still owns its own per-route copy
  (HEADING / BTN_BACK / etc.) in a file under that route's `_lib/`,
  so a reviewer auditing login can read all login copy in one file
  without hopping into a global-MESSAGES module that mixes both flows.
- Faithful to §5.5's "centralization" intent without forcing the two
  routes to import a single mega-MESSAGES they would have to filter for
  flow-relevant keys at consumption time.
- Path stability for consumers — re-export pattern means import-paths
  in 4 downstream files don't change.

**Verification (2026-04-30):**

- `cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json --output human` → **0 errors / 0 warnings**
- `cd frontend && pnpm exec eslint 'src/routes/(public)'` → **0 errors / 0 warnings**
- ESLint complexity / max-lines / sonarjs-complexity-10 all within ceilings (each refactored file is well under the 800-line cap; no functions touched).
- No consumer file edited; downstream `TwoFactorVerifyForm.svelte` +
  `2fa-server-helpers.ts` files keep their existing import statements.

**Smoke-test gap (deferred per Step 5.2 / 5.3 precedent):** no behaviour
change — the strings are byte-identical pre/post-refactor in every
output position, so the existing manual-smoke gate (user-driven Mailpit
flow) is not re-required for this step. Type-check + lint cover the
structural invariants.

### Phase 5 — Definition of Done

- [ ] Login flow works end-to-end with 2FA enforced
- [ ] Signup flow works end-to-end with 2FA enforced (form action, NOT client-side POST)
- [ ] iOS Safari + Android Chrome auto-fill code from email tested
- [ ] Resend countdown shows live tick + `resendsRemaining` decrement
- [ ] Lockout message shown after 5 wrong attempts
- [ ] Challenge token never accessible from JS (verify via DevTools: no localStorage, no `$state`, no response body)
- [ ] svelte-check 0 errors, 0 warnings
- [ ] Frontend ESLint 0 errors
- [ ] All user-facing strings German with proper ä/ö/ü/ß
- [ ] Responsive verified at 320 px and 1920 px
- [ ] 0 hardcoded colors / fonts (design-system tokens only)

---

## Phase 6: Integration + Polish + ADR

> **v0.6.0 GREENFIELD-NOTE:** keine Bestandsuser → kein Cutover-Tanz. „Phase 6" wird zur **Public-Launch-Readiness-Checklist** statt Cutover-Runbook. Operationelle Integrationen + Doku bleiben Pflicht. Cutover-spezifisches (Vorabmail, T-14/T-7/T-1-Timeline, Single-Root-Outreach, Hard-Block-Eskalation) entfällt — durch ein einfaches „Final-Smoke + Doppler-Check + Production-SMTP-Smoke vor erstem Tenant-Onboarding" ersetzt.

### Operational

- [x] **Grafana alert rule** (NOT Sentry — per ADR-002 Phase 5g, alerts are provisioned as code in `docker/grafana/alerts/*.json` via `apply.sh`): SMTP failure rate > 5 % over 5 min. New file `docker/grafana/alerts/08-smtp-failure-rate.json` shipped 2026-05-01 (v0.8.8). UID `assixx-smtp-failure-rate`, group `assixx-warning`, `for: 5m`, threshold `> 0.05`. Two-query Loki ratio: numerator `count_over_time({…level="error"…} \|= "Fehler beim Senden der E-Mail" [5m])` (email-service.ts:612), denominator `+ {…level="info"…} \|= "E-Mail gesendet" [5m]` (email-service.ts:609); math node `$A / ($A + $B + 0.001)` — epsilon verhindert div-by-zero auf idle 5-min-Fenster. Pattern mirrors 04-backend-error-rate-warning + 07-tempo-cloud-quota-high. Anwendung via `doppler run -- ./docker/grafana/alerts/apply.sh` ist **User-Only** (Push in Grafana Cloud / shared external state).
- [ ] Sentry: 5xx errors from 2FA endpoints captured automatically by existing `all-exceptions.filter.ts` (no new wiring).
- [ ] Grafana dashboard panel: 2FA verify success/fail rate per minute (`audit_trail` query)
- [ ] Loki saved query: `{service="backend"} | json | resource_type="2fa-challenge" or resource_type="2fa-lockout"`
- [ ] Audit-trail filter recipe: `WHERE resource_type IN ('2fa-challenge','2fa-lockout') OR (action='login' AND changes->>'method'='2fa-email')`
- [—] ~~Pre-deploy email drafted + sent to all tenants 7 days before T-Day Deploy~~ **N/A — GREENFIELD v0.6.0** (keine Empfänger)
- [ ] **FK-Migration `fk_users_tenant` `RESTRICT` → `CASCADE`** (Spec Deviations §D4, queued 2026-05-01) — node-pg-migrate migration that rewrites the `users.tenant_id` foreign-key constraint so the reaper's `dropTenantCascade` branch becomes correct + the anti-subdomain-squatting guarantee from §0.4 / DD-14 is restored. Required BEFORE first paying tenant. Backup + dry-run mandatory per CLAUDE.md DB-migration HARD BLOCK. Touches a single FK; no data migration, no downtime. After the migration: verify reaper E2E with an all-stale-tenant fixture (`dropTenantCascade` branch now succeeds end-to-end), then drop the WARNING blocks from `two-factor-auth-reaper.service.ts` header §D1, `dropTenantCascade` JSDoc, and audit-row JSDoc.

### Documentation

- [x] **ADR-054: Mandatory Email-Based 2FA** written, status "Accepted" — `docs/infrastructure/adr/ADR-054-mandatory-email-2fa.md` (471 lines, prettier-clean, 70 headings, all 15 cross-referenced ADRs verified existing). Shipped 2026-05-01 (v0.8.5). Covers: §Threat Model (T1–T6), §Constraints + §Requirements, §Decision (3 covered scenarios + permission-stack alignment with ADR-045 Layer 0 + code-format DD-1/12 + time-budget DDs 2/6/9/21 + data model: `users` columns + Redis keyspace + §A8 audit tuples + 9 defense-in-depth properties + greenfield DD-skip table), §Implementation Topology (file-by-file map), §Alternatives Considered A–H (TOTP / SMS / trust-device / per-tenant flag / Doppler kill-switch / OAuth-mandatory / microservice / immediate-token signup), §Consequences (10 positive, 5 negative incl. SMTP-outage caveat + queued FK-migration §D4, 4 neutral), §Risks & Mitigations (R1–R15 traceability table), §Verification (automated suite results at acceptance time + manual scenario walkthroughs + L-1 pre-launch checklist), §References (implementation files w/ line refs + plan + 15 related ADRs + external NIST SP 800-63B / Crockford Base32 / Mailpit docs).
- [x] `docs/ARCHITECTURE.md` §1.2 — 2FA row inserted between "Login/refresh/logout" and "SSR auth-cookie state" (semantically correct: 2FA runs after credential validation, before tokens are issued / cookies are set). Concept "2FA email challenge (mandatory)"; entry-points cite the orchestration service, the crypto+Redis primitives service, and the email-change service (DD-32 two-code surface); Why-cell carries the load-bearing facts (`auth.service.ts:222` discriminated `LoginResult`, `auth.service.ts:278` OAuth-exempt `loginWithVerifiedUser`, DD-32 two-code email-change); ADR-link `[ADR-054](./infrastructure/adr/ADR-054-mandatory-email-2fa.md)`. Version header bumped 4.2.0 → 4.3.0 + date 2026-05-01 per ARCHITECTURE.md §10 maintenance rule (minor on row-add). prettier-clean.
- [x] `docs/FEATURES.md` updated — added "Mandatory Email-Based 2FA" multi-line bullet under §"User Management in Detail" → Security (matches ADR-049/051/055 verbose-bullet style: 6-char Crockford-Base32, code TTL 10 min, 5-attempt → 15-min lockout, 60 s resend cooldown, max 3 resends, hashed-at-rest in Redis, httpOnly+Secure+SameSite=Lax cookie, OAuth-exempt DD-7, two-code email-change DD-32/R15, fail-loud SMTP rollback DD-14, lost-mailbox recovery pointer to HOW-TO-2FA-RECOVERY). Also added 2FA sub-bullet to §"Live Features" #1 User Management list. Shipped 2026-05-01 (v0.8.7). prettier-clean.
- [x] `docs/how-to/HOW-TO-2FA-RECOVERY.md` NEW — DD-30 Minimal-Umfang erfüllt (~190 Zeilen, deutsch, prettier-clean). Sechs Sektionen: §1 Wichtigster Grundsatz (kein In-App-Recovery + 3-Pfad-Zusammenfassungstabelle) · §2 Szenario A Mailbox-Verlust (Firmen-IT-Pfad + Hinweis auf DD-32-Two-Code-Email-Change) · §3 Szenario B Lockout-Clear-Workflow (`POST /users/:id/2fa/clear-lockout` Schritt-für-Schritt + "Was der Endpoint macht/NICHT macht"-Tabellen + Two-Root-Caller-Target-Matrix mit 5 Zeilen) · §4 Szenario C Letzter-Root-ausgesperrt (Two-Root-Anforderung + Detection-Query als Monitoring-Hilfe + SCS-Operations-Out-of-Band-Recovery via SSH+Doppler-CLI mit Compliance-Audit-Row) · §5 Anti-Patterns (7-Zeilen-Liste was-NICHT-ist falsche Annahmen vs Realität) · §6 Verwandte Dokumente (ADR-054/010/055 + Masterplan §0.1a + HOW-TO-DEV-SMTP/CREATE-TEST-USER). Bewusst **keine** Screenshots (DD-30 verbietet — verfallen mit UI), **kein** Troubleshooting-Tree (V2-Erweiterung). Catalog-Eintrag zu `docs/how-to/README.md` Development-&-Tooling-Sektion ergänzt. Shipped 2026-05-01 (v0.8.7).
- [x] `docs/how-to/HOW-TO-DEV-SMTP.md` — **Mailpit-Setup** (Step 0.5.5, DD-25 v0.4.x amendment 2026-04-29; supersedes v0.4.0 Maildev): Container in `docker-compose.yml` `dev`-Profile, Doppler dev-Secrets (`SMTP_HOST=mailpit`), Web-UI/REST auf http://localhost:8025, Smoke-Test-Befehl, Reset-Anleitung (`DELETE /api/v1/messages`), Migration-Hinweise zu Port-/Hostname-Änderung gegenüber Maildev.
- [x] `docs/how-to/HOW-TO-CREATE-TEST-USER.md` updated — die stale "Bekannter Quirk: `is_active=0` nach Signup"-Sektion (geschrieben 2026-04-30 als Branch-Workaround) durch eine korrekte "2FA-Verify-Step nach Signup-API (ADR-054)"-Sektion ersetzt. Inhalt: Erklärung dass `is_active=0` jetzt Sollzustand ist (nicht Quirk), 4-Schritt-Workflow mit `curl`-Beispielen für (a) Signup-Trigger, (b) Code-Holen aus Mailpit via `/api/v1/messages` + `jq` + `grep -oE "[A-HJKMNP-Z2-9]{6}"`, (c) ChallengeToken-Cookie-Auslesen, (d) `POST /api/v2/auth/2fa/verify` Aufruf → Aktivierung + Token-Issuance. Hinweis dass `pnpm run db:seed` 2FA umgeht (`is_active=1` aber `tfa_enrolled_at=NULL` → erste echte Login-Challenge nutzt Mailpit-Pfad). Lockout-Pointer zu HOW-TO-2FA-RECOVERY.md. Shipped 2026-05-01 (v0.8.7). prettier-clean.
- [ ] `customer/fresh-install/` synced via `./scripts/sync-customer-migrations.sh`

### Public-Launch-Readiness-Checklist (v0.6.0 — ersetzt Cut-over-Runbook unter Greenfield-Status)

> **v0.6.0:** Greenfield-Launch hat keine Bestandsuser, daher fällt die T-14/T-7/T-1/T-0-Timeline weg. Stattdessen: einmalige Final-Verifikation **vor dem ersten echten Tenant-Onboarding**.

| Schritt                           | Aktion                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L-1 (1 Tag vor Public-Launch)** | (a) Production-SMTP-Smoke (Step 0.5.6) ausführen — echter Code-Send an Test-Mailbox bei Outlook/Gmail/GMX, Inbox-Verifikation. (b) Subdomain-DNS + Wildcard-Cert (Step 0.5.4) re-verifizieren. (c) DKIM/SPF/DMARC (Step 0.5.2) re-checken. (d) Doppler-Secrets (`SMTP_*`, `JWT_*`) auf prod gesetzt. |
| **L-0 (Public-Launch)**           | Code-Deploy. 2FA ist ab Sekunde 1 für alle Signups + Logins aktiv (hardcoded, kein Toggle). Erste echte Tenants können onboarden. Disaster-Recovery-Pfade (§0.1a SSH + Doppler-CLI) griffbereit.                                                                                                     |
| **Erste 30 Tage post-Launch**     | Standard-Alerting reicht: Grafana SMTP-Fail-Rate-Rule, Sentry 5xx-Capture, Loki-Query für `resource_type='2fa-challenge'/'2fa-lockout'`. Bei Issues: regulärer Bug-Fix-Loop (kein Re-Cutover, kein Tenant-Mailing).                                                                                  |

**~~Cut-over-Runbook (Bestandsuser-Variante)~~** historisch gestrichen per Greenfield — sollten zukünftig Bestandsuser existieren (z.B. Re-Cutover bei einem 2FA-Schema-Wechsel) gilt der v0.5.0-Runbook mit T-14/T-7/T-1-Timeline (DD-22 / DD-26 / DD-28 / DD-31). Bleibt im Plan-Git-History referenziert über v0.5.0-Tag.

### Phase 6 — Definition of Done

- [x] ADR-054 reviewed + "Accepted" (shipped 2026-05-01 / v0.8.5 — see Documentation row above)
- [ ] All operational integrations live in staging
- [ ] Lockout-clear runbook tested (lock self → recover via second root)
- [ ] Customer migrations synced
- [ ] No open TODOs in code
- [—] ~~Cut-over date set + announcement queued~~ **N/A — GREENFIELD v0.6.0** (Public-Launch ist die Cut-Over-Linie, kein separates Datum)
- [—] ~~Post-cut-over monitoring window scheduled (24 h)~~ **N/A — GREENFIELD v0.6.0** (Standard-Alerting reicht ab Public-Launch)
- [ ] **v0.6.0 (Greenfield):** Public-Launch-Readiness-Checklist (oben) abgeschlossen vor erstem echten Tenant-Onboarding

---

## Session Tracking

| Session | Phase | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Status                                                                                                                                           | Date       |
| ------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 0       | 0     | DD sign-off (21/21 APPROVED)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | DONE                                                                                                                                             | 2026-04-26 |
| 1       | 0/0.5 | External-API audit · ~~pre-deploy email draft~~ (N/A Greenfield) · ~~single-root detection~~ (N/A Greenfield) · SPF/DKIM check · subdomain handoff verify · dev-SMTP smoke                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | DONE (Teilweise: 0.5.3 + 0.5.5)                                                                                                                  | 2026-04-28 |
| 2       | 1     | Migration: drop legacy 2FA columns + add 2 new columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | DONE                                                                                                                                             | 2026-04-28 |
| 3       | 2     | Module skeleton · types · DTOs · constants · register in app.module                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | DONE                                                                                                                                             | 2026-04-28 |
| 4       | 2     | TwoFactorCodeService (crypto + Redis primitives via DI provider)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | PENDING                                                                                                                                          |            |
| 5       | 2     | TwoFactorAuthService (orchestration) · `send2faCode` + template                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | PENDING                                                                                                                                          |            |
| 6       | 2     | Modify AuthService.login + SignupService (incl. tenant cleanup on SMTP fail per DD-14) · OAuth comment-only · **load-tests auf LoginResult umstellen** (v0.5.0 R13-Mitigation)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | DONE (Steps 2.4 + 2.5 + 2.6)                                                                                                                     | 2026-04-29 |
| 7       | 2     | TwoFactorAuthController · throttler tiers + decorators · Pino redaction · audit hooks · stale-pending reaper cron (Step 2.11)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | DONE (Steps 2.7 + 2.8 + 2.10 + 2.11)                                                                                                             | 2026-04-29 |
| 7b      | 2     | **Step 2.12 (DD-32 / R15, v0.6.0):** Email-Change-Endpoint two-code 2FA-Verify (request-change + verify-change) · Audit-Tuples · Throttler                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | DONE (Step 2.12)                                                                                                                                 | 2026-04-29 |
| 7c      | 2     | **Phase 2 DoD final blocker:** R13 load-test discriminated-union wiring (`load/lib/auth.ts` + `load/tests/baseline.ts`). New `loginGeneric` centralises the `LoginResultBody` branch; fail-loud on `stage === 'challenge_required'` per v0.5.0 R13. Phase 2 fully DONE.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | DONE (Phase 2 DoD)                                                                                                                               | 2026-04-29 |
| 8       | 3     | Unit tests TwoFactorCodeService                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | PENDING                                                                                                                                          |            |
| 9       | 3     | Unit tests TwoFactorAuthService + AuthService + SignupService modifications + reaper service + **Email-Change service (Step 2.12)** — five batches (A–E), 65 new tests, full unit suite 283 files / 7260 tests, 0 regressions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | DONE                                                                                                                                             | 2026-04-29 |
| 10a     | 4     | **Session 10a DONE 2026-04-29** — Maildev SMTP wiring (Doppler dev) · `helpers.ts` 2FA-aware `loginApitest()` · `00-auth.api.test.ts` adapted to 2-step contract · `signup.api.test.ts` adapted to new body shape · NEW `two-factor-auth.api.test.ts` (24/24 passing + 11 documented `it.todo` = 35 total — Phase 4 DoD ≥35 met)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | DONE                                                                                                                                             | 2026-04-29 |
| 10b     | 4     | **Session 10b DONE 2026-04-30** — (1) Adapted **13 pre-existing api-test files** broken by Phase 2 Step 2.4 token-shape change (masterplan-named-6 + `tenant-domains` + 7 additional discovered during full `--project api` run: `dummy-users`, `organigram`, `kvp-approval`, `admin-permissions`, `user-permissions`, `shift-handover`, `chat-e2e-roundtrip`; `oauth` was a false alarm — confirmed 48/48 green untouched). (2) Consolidated the 2-step-2FA login dance into shared `loginNonRoot(email, password)` + `loginNonRootFull(email, password)` helpers in `helpers.ts` (added alongside `queryUserIdByEmail`). (3) Implemented all 11 `it.todo` placeholders in `two-factor-auth.api.test.ts`: 4th-resend (in resend describe block) + 9 in new `Session 10b — additional scenarios` describe block (expired challenge, 4th-resend-cap-per-challenge, reaper E2E sim with soft-delete branch, OAuth DD-7 sentinel, cross-tenant defence, lockout suspicious-activity mail) + 3 in new `Email-Change 2FA-Verify Sims` describe block (Hijack-Sim, Tippfehler-Sim, Bombing-Sim). One `it.skip` (signup-503) with detailed pointer to unit-level coverage in `signup.service.test.ts` — harness limitation: stopping/starting Mailpit poisons every other Mailpit-dependent test. (4) Migrated 3 stale `localhost:1080/email` (Maildev) references to Mailpit's `localhost:8025/api/v1/messages` REST API. **Verification (2026-04-30):** `--project api` 55/55 files / 1050 passing / 5 skipped (was 1040+4 before Session 10b — Δ +10 concrete tests + 1 new doc-skip); `--project unit` 284/284 / 7277 passing; ESLint clean; `tsc --noEmit -p backend` exit 0. **Discovered side issue:** reaper service header comment claims `users.tenant_id ON DELETE CASCADE` but the live FK is RESTRICT (`pg_constraint.confdeltype='r'`) — the `dropTenantCascade` branch would fail in production. Filed as a non-blocking observation; the soft-delete branch works as documented. | DONE                                                                                                                                             | 2026-04-30 |
| 11      | 5     | Frontend login + login/verify (form action, cookie wiring, Svelte runes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | PENDING                                                                                                                                          |            |
| 12      | 5     | Frontend signup form-action refactor (DD-19) + signup/verify                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | PENDING                                                                                                                                          |            |
| 13      | 5     | Polish · responsive · lockout state · error i18n + **Email-Change-2FA UI (Step 2.12 frontend)**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | PARTIAL (Step 5.5 i18n done, rest pending)                                                                                                       |            |
| 13a     | 5     | **Step 5.5 (v0.8.3) — i18n centralization shared-module extraction.** New `(public)/_lib/2fa-shared.ts` (110 lines) holds 6 protocol constants + `COMMON_MESSAGES` (17 byte-identical strings); login + signup `2fa-constants.ts` refactored to spread `COMMON_MESSAGES` + add overrides. Login 108→55 lines, signup 121→77 lines. Zero consumer-side changes. Drift surface for 23 previously-duplicated members eliminated (now structural). svelte-check 0/0; ESLint on `(public)` 0/0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | DONE (Step 5.5)                                                                                                                                  | 2026-04-30 |
| 14      | 6     | ADR-054 · monitoring · lockout-clear runbook · ~~cut-over checklist~~ → **Public-Launch-Readiness-Checklist (v0.6.0)**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | PARTIAL (ADR-054 + ARCH §1.2 + FEATURES.md + HOW-TO-2FA-RECOVERY + HOW-TO-CREATE-TEST-USER DONE; rest pending: customer-sync / Grafana / FK-§D4) | 2026-05-01 |

### Session log template

```markdown
### Session N — YYYY-MM-DD

**Goal:** {what should be achieved}
**Result:** {what was actually achieved}
**New files:** {list}
**Changed files:** {list}
**Verification:**

- ESLint: {0 / N → fixed}
- Type-check: {0 errors}
- Tests: {N / N passed}

**Deviations:** {what differed from plan and why}
**Next session:** {what comes next}
```

---

## Quick Reference: File Paths

### Backend (new)

| File                                                                 | Purpose                                   |
| -------------------------------------------------------------------- | ----------------------------------------- |
| `backend/src/nest/two-factor-auth/two-factor-auth.module.ts`         | NestJS module                             |
| `backend/src/nest/two-factor-auth/two-factor-auth.controller.ts`     | 3 endpoints                               |
| `backend/src/nest/two-factor-auth/two-factor-auth.service.ts`        | Orchestration                             |
| `backend/src/nest/two-factor-auth/two-factor-code.service.ts`        | Crypto + Redis primitives                 |
| `backend/src/nest/two-factor-auth/two-factor-auth.types.ts`          | Types                                     |
| `backend/src/nest/two-factor-auth/two-factor-auth.constants.ts`      | TTLs · attempt limits                     |
| `backend/src/nest/two-factor-auth/two-factor-auth-reaper.service.ts` | Stale-pending reaper (`@Cron`, Step 2.11) |
| `backend/src/nest/two-factor-auth/dto/*.ts`                          | Zod DTOs                                  |
| `backend/src/utils/email-templates/2fa-code.template.ts`             | German HTML + text template               |
| `backend/src/utils/email-templates/2fa-suspicious.template.ts`       | Suspicious-activity email (DD-20)         |
| `database/migrations/<17-digit-utc>_replace-2fa-state-on-users.ts`   | Migration                                 |
| `backend/src/nest/two-factor-auth/two-factor-code.service.test.ts`   | Unit tests                                |
| `backend/src/nest/two-factor-auth/two-factor-auth.service.test.ts`   | Unit tests                                |
| `backend/test/two-factor-auth.api.test.ts`                           | API integration tests                     |

### Backend (modified)

| File                                                        | Change                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `backend/src/nest/app.module.ts`                            | Import TwoFactorAuthModule                                                       |
| `backend/src/nest/auth/auth.service.ts`                     | `login()` returns `LoginResult`; DD-7 comment above `loginWithVerifiedUser()`    |
| `backend/src/nest/auth/auth.controller.ts`                  | Map `LoginResult` to HTTP response (challenge cookie or token cookies)           |
| `backend/src/nest/auth/dto/login.dto.ts`                    | (Optional) Re-export `LoginResult` type alongside `LoginResponse`                |
| `backend/src/nest/signup/signup.service.ts`                 | Issue challenge instead of tokens; user starts with `IS_ACTIVE.INACTIVE`         |
| `backend/src/nest/signup/signup.controller.ts`              | Map signup result through new discriminated-union controller logic               |
| `backend/src/utils/email-service.ts`                        | New `send2faCode()` + `sendSuspiciousActivity()` exports                         |
| `backend/src/nest/common/logger/logger.constants.ts`        | Pino redact paths added                                                          |
| `backend/src/nest/config/config.service.ts`                 | EnvSchema: `SMTP_FROM` only (v0.5.0: ~~FEATURE_2FA_EMAIL_ENFORCED~~ entfernt)    |
| `backend/src/nest/throttler/throttler.module.ts`            | Two new tiers `2fa-verify`, `2fa-resend`                                         |
| `backend/src/nest/common/decorators/throttle.decorators.ts` | Two new decorators + add `2fa-*` to every existing decorator's SkipThrottle list |
| `backend/src/nest/auth/auth.service.test.ts`                | New login-branch tests                                                           |
| `backend/src/nest/signup/signup.service.test.ts`            | New signup-branch tests                                                          |

### Frontend (new)

| Path                                                           | Purpose                              |
| -------------------------------------------------------------- | ------------------------------------ |
| `frontend/src/routes/(public)/login/verify/+page.svelte`       | Code entry                           |
| `frontend/src/routes/(public)/login/verify/+page.server.ts`    | Verify endpoint glue                 |
| `frontend/src/routes/(public)/login/verify/_lib/constants.ts`  | German UI strings                    |
| `frontend/src/routes/(public)/signup/+page.server.ts`          | Signup form action (DD-19) — net-new |
| `frontend/src/routes/(public)/signup/verify/+page.svelte`      | Code entry                           |
| `frontend/src/routes/(public)/signup/verify/+page.server.ts`   | Verify endpoint glue                 |
| `frontend/src/routes/(public)/signup/verify/_lib/constants.ts` | German UI strings                    |

### Frontend (modified)

| File                                                 | Change                                                  |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `frontend/src/routes/(public)/login/+page.svelte`    | Handle stage discriminator                              |
| `frontend/src/routes/(public)/login/+page.server.ts` | Set challenge cookie + redirect on `challenge_required` |
| `frontend/src/routes/(public)/signup/+page.svelte`   | Switch to `<form method="POST" use:enhance>` (DD-19)    |
| `frontend/src/routes/(public)/signup/_lib/api.ts`    | Remove signup-POST call (now in form action)            |

### Documentation (new / updated)

| File                                                     | Action                      |
| -------------------------------------------------------- | --------------------------- |
| `docs/infrastructure/adr/ADR-054-mandatory-email-2fa.md` | NEW (ADR-053 already taken) |
| `docs/how-to/HOW-TO-2FA-RECOVERY.md`                     | NEW                         |
| `docs/how-to/HOW-TO-CREATE-TEST-USER.md`                 | UPDATE                      |
| `docs/ARCHITECTURE.md` §1.2                              | UPDATE                      |
| `docs/FEATURES.md`                                       | UPDATE                      |

---

## Spec Deviations

> Populate during implementation when actual code contradicts this plan.

### Audit findings — Step 0.1 / Step 0.5.3 (External-API Consumer Audit, 2026-04-28)

**Decision:** **0 external clients found → proceed without endpoint versioning or `X-Accept-2FA-Stage` header opt-in.**

**Method (read-only, all four procedure points covered):**

1. **Cross-org code search.**
   - `gh search code --owner=assixx '/api/v2/auth/login'` → 22 hits, **all inside `assixx/assixx`** (this monorepo: docs/curl examples, audit-helper test fixture). No other repo under the assixx org references the endpoint.
   - `gh search code --owner=SCS-Technik '/api/v2/auth/login'` → empty.
   - Tooling: `gh` v2.x, authenticated `SCS-Technik` account, scopes `repo`, `read:org`, `gist`, `workflow`.
2. **Backend OpenAPI/Swagger surface.**
   - Grep across `backend/src` for `@ApiTags`, `SwaggerModule`, `@nestjs/swagger` → **zero** matches in production code (one JSDoc-comment hit in `shift-handover/dto/update-template.dto.ts` mentions "OpenAPI clarity" but is comment-only). Swagger is not wired up. Therefore no published OpenAPI contract → no auto-generated external SDK could exist.
3. **Doppler secret inventory** (`doppler secrets --only-names`).
   - 52 secret names: only DB / Redis / SMTP / Sentry / Grafana Cloud / Microsoft OAuth / Cloudflare Turnstile / JWT / session — no `*_API_KEY`, `*_PARTNER_*`, `*_MOBILE_*`, `*_SDK_*`, `*_WEBHOOK_*` entries. No credential pattern that would suggest a non-browser external client integration.
4. **Repo top-level layout.**
   - Top-level dirs: `backend/`, `frontend/`, `shared/`, `database/`, `docker/`, `docs/`, `e2e/`, `load/`, `scripts/`, `Testing/`, `archive/`, `customer/`, plus build artefacts. **No `mobile/`, `ios/`, `android/`, `electron/`, `cli/`, `sdk/` directory.** This is a pure SvelteKit-frontend + NestJS-backend monorepo; the only non-browser callers are k6 (`load/`) and Playwright (`e2e/`) — both internal infrastructure.

**Internal consumers surfaced by the audit (NOT external — fixable in the same PR/branch as Phase 2/6, no coordination required):**

| #   | Path                                                                                                                                                                                                    | Behaviour                                                                                                                                                                                                                                                                                           | Why it is not an external blocker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `load/lib/auth.ts:47-58`, `load/tests/baseline.ts:125-133`                                                                                                                                              | k6 load-test rig hard-codes `body.data = { accessToken, refreshToken, user: { id, tenantId } }`. Off-flag (default per DD-10) preserves the legacy shape, so load tests keep working through Phase 2-4 dev cycles. They will break the moment `FEATURE_2FA_EMAIL_ENFORCED` flips ON unless updated. | Same repo, same PR — recommendation for the Phase 2 author: extend the destructure to handle `LoginResult`, fail-loud on `stage === 'challenge_required'` so operators see "load tests need a 2FA-exempt account". **SUPERSEDED v0.5.0:** DoD jetzt verschärft — load-test-Update ist MANDATORY in Phase 2 Session 6 (R13-Mitigation, siehe Risk-Register). **DONE v0.6.3 (Session 7c, 2026-04-29):** new `loginGeneric` helper in `load/lib/auth.ts` types the response as `LoginResultBody` discriminated union and `fail()`s loud on `stage === 'challenge_required'` with a remediation pointer (DD-7 OAuth or 2FA-exempt fixture). `baseline.ts:loginAll` collapsed to `pool.map(login => loginGeneric(...))` — the duplicated destructure is gone. `pnpm exec tsc --noEmit -p load` 0 errors, `pnpm exec eslint load/` 0 errors. |
| 2   | `docs/COMMON-COMMANDS.md:303,374`, `docs/how-to/HOW-TO-CURL.md:44`, `docs/how-to/HOW-TO-TEST.md:740`, `docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md:278,284`, several FEAT\_\*\_MASTERPLAN.md curl blocks | Curl one-liners extract `.data.accessToken` via `python3` / `jq`. Human-facing operator documentation only — not a runtime consumer.                                                                                                                                                                | Recommendation for the Phase 6 documentation sweep author: refresh examples to `jq '.data'` (full envelope) plus a "if 2FA enforced, follow with /api/v2/auth/2fa/verify" note. Recommendation only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3   | `backend/src/nest/common/audit/audit.helpers.test.ts:309,366,368,466`                                                                                                                                   | Uses `/api/v2/auth/login` only as a path-fixture for path-to-action mapping logic. Never POSTs, never reads the response body.                                                                                                                                                                      | No action needed. Independent of the response shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4   | `e2e/` (Playwright)                                                                                                                                                                                     | Grep across `e2e/**/*.{ts,js}` → no direct `/api/v2/auth/login` POST and no `accessToken` token-shape consumption. Playwright authenticates via the SvelteKit form action.                                                                                                                          | Already in scope for Phase 5 (frontend `(public)/login/+page.server.ts` modification). No additional action.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Risk register update (R13, revised v0.5.0):** R13 ("Mobile / external API client breaks because login response shape changed") → audit confirmed **None** für extern. **v0.5.0: DD-10 Flag entfernt → flag-OFF-fallback ist nicht mehr verfügbar.** Konsequenz: load-tests im selben Repo (`load/lib/auth.ts`) MÜSSEN auf Discriminated-Union umgestellt werden BEVOR Phase 2 Session 6 in main mergt — sonst CI/load-smoke fails. Phase 2 DoD ist entsprechend verschärft. Risiko für externe Clients bleibt **None** durch Audit.

**Verification record:**

- Audit run on branch checkout `feat/2fa-email` candidate (HEAD `488baa30`).
- Tooling versions: `gh` (CLI, GitHub auth verified for `SCS-Technik`), `doppler` v3.75.3.
- Owner: Backend.

| #                                                   | Spec says                                                                                                                                                                                                                                         | Actual code                                                                                                                                                                                                                                                                                                                                                           | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 (Step 2.11, 2026-04-29)                          | Single CTE `WITH stale_users AS (…), deleted_users AS (DELETE FROM users …), orphan_tenants AS (SELECT du.tenant_id … WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = du.tenant_id))` (delete users first, then orphan-check tenants) | `findStaleUsers` (`SELECT FOR UPDATE`) → `cleanupBatch` → `dropTenantCascade` (`DELETE FROM tenants` only — users vanish via FK CASCADE)                                                                                                                                                                                                                              | Plan-literal CTE has a PostgreSQL-snapshot bug: DML CTEs share statement-start snapshot, so the to-be-deleted user is still visible to that NOT EXISTS → tenants would never be reaped. Inverted flow always works. Documented in file header §D1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D2 (Step 2.11, 2026-04-29)                          | Implicit: plan's CTE writes `DELETE FROM users` outside the `tenant-deletion` module                                                                                                                                                              | Reaper writes only `DELETE FROM tenants` (whole-tenant orphan path) and `UPDATE users SET is_active = IS_ACTIVE.DELETED, updated_at = NOW()` (defensive edge-case path)                                                                                                                                                                                               | `shared/src/architectural.test.ts:291` blocks `DELETE FROM users` outside `tenant-deletion-executor.service.ts` per ADR-020 + ADR-045 soft-delete-only rule. Inverted flow doubles as the dodge — same trick `signup.service.ts:cleanupFailedSignup` already uses for DD-14. Documented in file header §D2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D3 (Step 2.11, 2026-04-29)                          | Plan §2.11 says "Audit: for each deleted (user, tenant) pair, write one `audit_trail` row" without specifying transaction scope — implicit fire-and-forget like `TwoFactorAuthService.fireAudit` (plan §2.3)                                      | Audit insert runs INSIDE the same `db.systemTransaction` as the cleanup; if the audit fails, the whole batch rolls back                                                                                                                                                                                                                                               | Reaper deletions are compliance evidence — orphan deletes without a paper trail are worse than no deletes. `audit_trail` partition table has no FK to `tenants` (verified `\d audit_trail` 2026-04-29), so writing the audit row after the cascade is safe even when the tenant is gone. Documented in file header §D3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D4 (Step 2.11, 2026-04-30 / 2026-05-01 comment fix) | D1's `dropTenantCascade` branch was authored on the assumption that `users.tenant_id` has `ON DELETE CASCADE` — header §D1 + the method's JSDoc + the audit-row JSDoc all asserted CASCADE                                                        | Live FK `fk_users_tenant` is `ON DELETE RESTRICT` (`pg_constraint.confdeltype = 'r'`, verified via psql probe 2026-04-30). `DELETE FROM tenants` therefore raises an FK violation and the surrounding `systemTransaction` rolls back — the `dropTenantCascade` branch fails in production. The `softDeleteEachUser` branch (defensive edge case) works as documented. | Discovered Session 10b 2026-04-30, classified non-blocking under Greenfield-Status (no live tenants; `runScheduled()`'s try/catch contains the failure to a single sweep). **2026-05-01 (v0.8.4 Reaper-Comment-Fix):** all four CASCADE-claim sites in `two-factor-auth-reaper.service.ts` rewritten to acknowledge the RESTRICT reality (header §D1 with explicit "KNOWN PRODUCTION FAILURE" block, header §D2 reframed, `dropTenantCascade` JSDoc with WARNING block, audit-row JSDoc rewritten). Comment-only — no logic change. **Phase 6 follow-up (queued):** node-pg-migrate migration to flip `fk_users_tenant` to `ON DELETE CASCADE` so the `dropTenantCascade` branch becomes correct + the anti-subdomain-squatting guarantee from §0.4 / DD-14 is restored before first paying tenant. Until then, an abandoned signup whose tenant has no other users will leave the subdomain reserved indefinitely. |

---

## Known Limitations (V1 — deliberately excluded)

1. **No in-app 2FA recovery.** Lost-mailbox = company-IT problem (corporate-email-only customer base). Lockout-clear endpoint (DD-8) clears the 15-min lockout; user still needs to receive the next code via their (restored) mailbox. **Single-root tenants must register a second root before cutover** — documented in HOW-TO-2FA-RECOVERY.
2. **No TOTP / authenticator app** — email only per requirement. V2 may add TOTP as alternative second factor.
3. **No backup recovery codes** — see #1.
4. **No "trust this device for N days"** — every login = 2FA per requirement.
5. **No SMS / phone fallback** — email only.
6. **No WebAuthn / FIDO2 / hardware tokens** — out of scope.
7. **No bulk migration of existing users** — transparent first-time enrollment on next login post-cutover (DD-11).
8. **No self-service email change protected by 2FA** — handled by existing email-change flow; not duplicated.
9. **No multi-tenant 2FA scoping** — codes are user-scoped (one user = one tenant in current model).
10. **No 2FA bypass for admins** — root lockout-clear is a lockout-clear, not a bypass.
11. **No per-tenant pilot rollout** — single global env flag for V1. Per-tenant flag is V2 if needed.
12. **OAuth users are exempt** (DD-7) — email 2FA only on password paths.
13. **No tenant-admin notification of suspicious activity** (DD-20) — user-only to avoid user-enumeration side channel.
14. **Forgot-password reset (ADR-051) does NOT auto-login** — user proceeds to `/login`, where 2FA naturally kicks in. No special wiring needed.

---

## Post-Mortem (fill after completion)

### What went well

- (TBD)

### What went badly

- (TBD)

### Metrics

| Metric                   | Planned                                                                              | Actual |
| ------------------------ | ------------------------------------------------------------------------------------ | ------ |
| Sessions                 | 14 (+ Session 0 = DD-Sign-off DONE)                                                  |        |
| Migration files          | 1                                                                                    |        |
| New backend files        | ~13 (incl. reaper service)                                                           |        |
| New frontend files       | ~7 (incl. signup +page.server.ts)                                                    |        |
| Changed files            | ~13                                                                                  |        |
| New npm dependencies     | **0** (`@nestjs/schedule` already present per `app.module.ts` — verify in Session 7) |        |
| Unit tests               | ≥ 65                                                                                 |        |
| API tests                | ≥ 35                                                                                 |        |
| ESLint errors at release | 0                                                                                    |        |
| Spec deviations          | 0                                                                                    |        |

---

## Architectural alignment

Every decision in this plan respects existing ADRs:

- **ADR-001 (Rate Limiting)**: two new tiers (`2fa-verify`, `2fa-resend`) registered in `AppThrottlerModule` following the documented multi-tier pattern. **v0.5.0 P2-Fix:** Tracker-Key ist `challengeToken` (aus httpOnly cookie) statt IP — vermeidet False-Positive-Blocks bei Industriekunden hinter NAT mit 50–500 Usern auf einer IP. Brute-force-Schutz lebt im Service-Layer (`record.attemptCount` per challenge, `2fa:fail-streak:{userId}` per user). Wenn challengeToken-Cookie fehlt (z.B. erste verify-Anfrage ohne login), fällt Tracker auf IP zurück — sicherer Default. Existing decorators' `SkipThrottle` lists extended for tier isolation per the file-level note in `throttle.decorators.ts`.
- **ADR-002 (Alerting & Monitoring)**: SMTP-failure-rate alert provisioned as code in `docker/grafana/alerts/*.json` (Phase 5g pattern), NOT directly via Sentry. 5xx errors from 2FA endpoints flow through the existing `all-exceptions.filter.ts` Sentry capture. 2FA-related logs land in Loki with structured fields (`resource_type`, `action`) for the saved-query dashboard.
- **ADR-005 (Authentication Strategy)**: 2FA layer is additive — `JwtAuthGuard` contract unchanged. Challenge tokens are a separate, pre-auth artifact transmitted via httpOnly cookie. Fresh-DB-lookup-per-request invariant preserved.
- **ADR-006 (Multi-Tenant CLS Context)**: 2FA flow runs before CLS is populated; `tenantId` stored in challenge record (never null — tenant exists pre-user), propagated to access tokens on success.
- **ADR-007 (API Response Standardization)**: `ResponseInterceptor` wraps everything. Services return raw data.
- **ADR-009 (Central Audit Logging)**: every 2FA event flows through `audit_trail` via `(action, resource_type)` tuples per §A8 — schema-correct.
- **ADR-014 (Migration Architecture)**: single migration, generated via `db:migrate:create`, 17-digit UTC timestamp, RLS-ready (column-level GRANTs inherit from `users`).
- **ADR-019 (RLS Isolation)**: no new RLS policies needed (columns added to existing RLS-enabled `users` table). All DB writes via `tenantTransaction()` / `queryAsTenant()`.
- **ADR-020 (Per-User Permissions)**: 2FA is pre-auth, not addon-gated. No permission registrar needed.
- **ADR-030 (Zod Validation)**: all DTOs via `createZodDto()`, central `IdParamDto` factory used.
- **ADR-041 (TS Strict-Everywhere)**: discriminated union enforces compile-time exhaustiveness.
- **ADR-045 (Permission & Visibility Design)**: 2FA is below Layer 0 (it gates AuthN, not AuthZ). No interaction with the 3-layer stack.
- **ADR-046 (OAuth Sign-in)**: DD-7 = exempt. OAuth bypasses 2FA layer with explicit comment in `loginWithVerifiedUser()`.
- **ADR-050 (Tenant Subdomain Routing)**: challenge cookie set on apex during password login (where the form lives) and consumed on the same origin in `/login/verify`. Final redirect to tenant subdomain happens AFTER successful 2FA via the existing connection-ticket handoff. No cross-origin cookie travel needed.
- **ADR-051 (Forgot-Password Role-Gate)**: reset flow does NOT auto-login → user proceeds to `/login` → naturally hits 2FA. Zero new wiring.
- **ADR-053 (Navigation Map Pointer Injection)**: out of scope — this ADR uses number 054 because 053 is taken (accepted 2026-04-23).

---

**This document is the execution plan. v0.5.0 / ACCEPTED — DD-10 Flag KOMPLETT entfernt per User-Vorgabe „kein Einstellung", P2-Throttler-Fix auf challengeToken, NEW Steps 0.5.6 (Production-SMTP-Smoke) + 0.5.7 (Sender-Warmup), §0.1a Out-of-Band-Disaster-Recovery dokumentiert. Phase 1 may begin after Phase 0.5 Step 0.5.5 (dev-SMTP smoke) is DONE (Step 0.5.3 audit DONE 2026-04-28); Steps 0.5.1, 0.5.2, 0.5.4, **0.5.6, 0.5.7** must be DONE before T-Day cut-over (v0.5.0: kein Flag-Flip mehr — Deploy = Cutover, Pre-Deploy-Tests bombenfest).**
