# ADR-056: Password Validation Policy — Strict 4-of-4 + ASCII-only

| Metadata                | Value                                                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                                                                                                                                                   |
| **Date**                | 2026-04-30                                                                                                                                                                                                                                                 |
| **Decision Makers**     | SCS-Technik Team                                                                                                                                                                                                                                           |
| **Affected Components** | `backend/src/schemas/common.schema.ts` (`PasswordSchema` — sole validator); password-setting DTOs (`register.dto.ts`, `reset-password.dto.ts`); login DTO (`login.dto.ts` — explicitly **decoupled** from `PasswordSchema`, see Amendment 2026-04-30b); frontend signup, reset-password live-validator, 4× profile `_lib/constants.ts`, `RootUserModal.svelte` |
| **Supersedes**          | —                                                                                                                                                                                                                                                          |
| **Related ADRs**        | ADR-005 (Auth Strategy — JWT guard, fresh DB lookup), ADR-030 (Zod Validation), ADR-051 (Forgot-Password Role-Gate)                                                                                                                                        |

---

## Context

The Assixx password rule had two latent flaws that surfaced together during a routine UX review on 2026-04-30:

### Flaw 1 — "3 of 4 categories" allowed predictable single-class-omission patterns

The previous rule required at least 3 of 4 character categories (uppercase, lowercase, digit, special). This let predictable patterns through:

| Password       | Categories satisfied               | Real-world entropy |
| -------------- | ---------------------------------- | ------------------ |
| `Password1234` | upper + lower + digit (no special) | low                |
| `password123!` | lower + digit + special (no upper) | low                |
| `PASSWORD123!` | upper + digit + special (no lower) | very low           |

NIST SP 800-63B (current revision) explicitly recommends _replacing_ category rules with breach-database checks (zxcvbn / pwned-passwords). We are not yet ready to ship server-side breach-checking (separate scope, see "Alternatives B"), so in the meantime the 3-of-4 rule was both stricter than necessary in some places and looser than necessary in others. The user-facing tooltip "Enthält 3 von 4" was also unclear: which is _the_ category I'm allowed to skip?

### Flaw 2 — UTF-8 silent-acceptance bug

The four category regexes are ASCII-only:

- `/[A-Z]/` matches A–Z, **not** `Ü`/`Ä`/`Ö`
- `/[a-z]/` matches a–z, **not** `ü`/`ä`/`ö`/`ß`
- `/\d/` ASCII digits only
- The special-char class is a fixed ASCII set

Consequence: a password like `Prüfung12345!` was **silently accepted** — `P + rfung + 12345 + !` accidentally satisfied 4 of 4, and `ü` was simply ignored, neither counted nor rejected. This is the classic _"password works in Postman but not in production"_ bug class, because non-ASCII passwords interact unpredictably with:

- DB column collations (`en_US.UTF-8` vs `de_DE.UTF-8` vs `C` — varies per customer install)
- bcryptjs's **72-byte** input limit (not 72-char — UTF-8 chars take 2–4 bytes; a "valid" 72-char Unicode password silently truncates inside bcrypt)
- JSON transport vs `application/x-www-form-urlencoded` round-trips of non-ASCII
- DB index collation on `email` (used in `WHERE email = $1`) differs from in-memory bcrypt comparison

Industry precedent: Microsoft Entra ID rejects non-ASCII passwords with the literal error _"Ihr Kennwort enthält unzulässige Zeichen."_ AWS Cognito and GitHub do the same.

### Requirements

1. **Single source of truth** — one validator definition consumed by every code path (register, login, reset, profile-change).
2. **UX-honest message** — the rule message must match what the rule actually enforces, character-for-character.
3. **Cross-component robust** — reject anything that could disagree across login form ↔ DB ↔ bcrypt ↔ JSON.
4. **No regression for existing users** — login is bcrypt-compare only, no re-validation of the plaintext.
5. **Test fixtures preserved** — `ApiTest12345!`, `TestFirmaA12345!`, `TestFirmaB12345!`, `TestScs12345!`, `Unverified12345!`, `SecurePass123!`, `NewSecurePassword123!` must continue to satisfy the policy.

---

## Decision

Two orthogonal hardening steps applied together in `backend/src/schemas/common.schema.ts`, plus a consolidation step that eliminates a duplicate validator:

### 1. Strict 4-of-4 category rule

The category counter changes from `>= 3` to `=== 4`. Every password MUST contain at least one character from each of:

- Uppercase ASCII letter (`[A-Z]`)
- Lowercase ASCII letter (`[a-z]`)
- ASCII digit (`[0-9]`)
- Special character from the fixed set: `!@#$%^&*()_+-=[]{};':"\|,.<>/?`

### 2. ASCII-only whitelist refine — runs BEFORE the category counter

A new `refine` runs first and rejects anything outside the printable-ASCII subset that is exactly the union of the four categories plus space:

```typescript
const ALLOWED_PASSWORD_CHARS = /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/? ]+$/;
```

**Order matters.** Whitelist gate runs _before_ the category counter. The difference is between the user seeing _"Password contains disallowed characters"_ (clear, actionable) versus _"missing lowercase"_ (misleading — they typed `ü` thinking it was a lowercase letter; the regex disagrees and ignores it).

### 3. Single source of truth — eliminate `RegistrationPasswordSchema`

The duplicate `RegistrationPasswordSchema` in `register.dto.ts` (which had its own narrower regex and `min(8)` instead of `min(12)`) is removed. All registration / login / reset / profile-change paths now consume `PasswordSchema` from `common.schema.ts`. This eliminates the drift risk where one path could silently enforce a different rule than another.

### 4. Frontend live-validator alignment

`reset-password/+page.svelte` now mirrors all four backend rules exactly (length min/max, whitelist, category count, special-char set). The previously-narrower frontend special-char regex (`[!@#$%^&*(),.?":{}|<>]` — 15 chars) is widened to match the backend's full 28-char class. Result: the submit button no longer stays grey for valid passwords using `_` / `+` / `=` / `[` / `]` / etc.

A new derived `hasOnlyAllowedChars` plus a UI checklist item _"Nur erlaubte Zeichen (keine Umlaute, Akzente, Emojis)"_ surfaces the whitelist rule live.

### 5. Tooltip texts state the new rule explicitly

Tooltip texts on signup, profile-pages, and modals are updated to state the new rule character-for-character: _"Mindestens 1 Großbuchstabe, 1 Kleinbuchstabe, 1 Zahl und 1 Sonderzeichen (…)"_ The ASCII-only constraint is **not** stated in tooltips by design — the backend produces a clear "contains disallowed characters" error if violated, and surfacing it in normal-path tooltips would create cognitive load for the 99% of users who never type non-ASCII.

---

## Alternatives Considered

### A. Stay with NIST 3-of-4

NIST SP 800-63B's actual recommendation is to _replace_ category rules entirely with breach-database checks. Our existing rule was the worst of both worlds — neither matching NIST's recommendation nor offering a clear constraint to the user. **Rejected** because the practical NIST-aligned option (server-side zxcvbn + pwned-password API integration) is a separate, larger scope; meanwhile the silent-UTF-8 bug needed a fix today.

### B. zxcvbn / Pwned-Password API as the gate

Modern best practice. Frontend already loads `zxcvbn-ts` for the strength meter (since v2.0.0 of the password subsystem, see PASSWORD-VALIDATION-SYSTEM.md). **Deferred**, not rejected: requires server-side integration, threshold tuning, fallback strategy when haveibeenpwned is down, and rate-limit accounting. Tracked as a likely follow-up ADR.

### C. Allow UTF-8 with Unicode-aware regex (`\p{Lu}` / `\p{Ll}` + `u` flag)

Would let users type `Prüfung12345!` with `ü` correctly recognised as lowercase. **Rejected** because it solves only the regex side of the bug; the cross-component issues (bcrypt's 72-byte limit, DB collation, transport encoding) remain unaddressed. Microsoft Entra rejected the same approach for the same reasons. Industry consensus is ASCII-only.

### D. Allow UTF-8 + normalize to NFC + enforce 72-byte (not 72-char) max + Unicode regex

Stricter version of C: normalize input to NFC, enforce `Buffer.byteLength(p, 'utf-8') <= 72`, then run regex with `u` flag. **Rejected** as over-engineering for the threat model. The complexity-to-benefit ratio is unfavourable when the alternative (ASCII-only, simple) is industry-standard and fixes the same class of bugs with one regex.

### E. Tighten further — also reject Top-100 common passwords (static list)

Real-world impact: would block `Password1!`, `Welcome1!`, `Summer2026!`, etc. **Deferred**: the canonical implementation is breach-DB integration (alternative B), which subsumes this. Adding a static list now would be technical debt to remove later.

### F. Keep the rule as-is, just fix the UI text ("3 of 4" → clearer wording)

**Rejected.** The rule itself was the root problem — both the unclear semantics and the silent-UTF-8 acceptance bug were real defects, not UX defects. Fixing only the UI would have left the bug intact.

---

## Consequences

### Positive

1. **Cross-component UTF-8 bug class eliminated.** `Prüfung12345!` no longer silently accepted; the validator now gives a clear ASCII-only error at the first gate.
2. **Single source of truth.** `PasswordSchema` is the only validator. `register.dto.ts` imports it instead of defining its own narrower variant.
3. **UX-honest message.** Tooltip text matches the rule character-for-character.
4. **Frontend / backend alignment.** Live-validator on `/reset-password` no longer disagrees with backend on the special-char set.
5. **Future-extensible.** The two `refine`s compose cleanly — adding alternative B (breach-DB) means appending a third refine without touching the existing two.
6. **Industry-aligned.** ASCII-only matches Microsoft Entra, AWS Cognito, GitHub.

### Negative

1. **Existing user with a non-ASCII password is forced to update at next reset.** Quantified during this work: zero in dev tenants. Production count unknown until first paying tenant goes live (greenfield-launch context, see CLAUDE.md).
2. **Existing user with a 3-of-4 password is likewise forced at next reset.** Same caveat.
3. **Tooltip text is longer.** _"Mindestens 1 Großbuchstabe, 1 Kleinbuchstabe, 1 Zahl und 1 Sonderzeichen (…)"_ is ~3× longer than _"Enthält 3 von 4"_. Mitigated by the explicit special-char list, which removes ambiguity.
4. **Profile-page tooltip text duplicates across 4 separate `_lib/constants.ts` files.** A future cleanup could extract a shared constant in `@assixx/shared/constants`; not done in this round to keep the diff minimal.

### Risks & Mitigations

| Risk                                                                | Mitigation                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User has international name (e.g. "Zoë") and tries to use it in pwd | Backend error message is clear ("disallowed characters") — user pivots. Industry-standard, users used to this from Microsoft.                                                                                         |
| Test fixture password breaks under new rule                         | Audit done: `ApiTest12345!`, `TestFirmaA12345!`, `TestFirmaB12345!`, `TestScs12345!`, `Unverified12345!`, `SecurePass123!`, `NewSecurePassword123!` — all 4/4 + ASCII. Smoke test added to `common.schema.test.ts`.   |
| Frontend live-validator drifts from backend again in the future     | Long-term mitigation: extract the regex + rule set to `@assixx/shared/constants` and consume from both sides. Not done now because frontend cannot easily import zod-bound logic; would need a shared regex constant. |
| Existing fixture re-introduced later that fails new rule            | Architectural test in `shared/src/architectural.test.ts` could enforce this — not added in this round; tracked as follow-up.                                                                                          |
| User claims "feature regression" for non-ASCII passwords            | Documented in this ADR + PASSWORD-VALIDATION-SYSTEM.md changelog v3.0.0. ASCII-only is industry-standard.                                                                                                             |

---

## Implementation Details

### Files

| Layer                     | File                                                                     | Change                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Backend (validator)       | `backend/src/schemas/common.schema.ts`                                   | + `ALLOWED_PASSWORD_CHARS` const, + first refine (whitelist) BEFORE category counter, flipped `>= 3` → `=== 4`, updated error messages |
| Backend (consolidation)   | `backend/src/nest/auth/dto/register.dto.ts`                              | Removed local `RegistrationPasswordSchema`; now imports `PasswordSchema` from `common.schema.ts`                                       |
| Backend (decoupling)      | `backend/src/nest/auth/dto/login.dto.ts`                                 | **Removed** `PasswordSchema` import; introduced local lightweight `LoginPasswordSchema` (`z.string().max(72)` only) — see Amendment 2026-04-30b |
| Backend (tests)           | `backend/src/schemas/common.schema.test.ts`                              | Flipped 3 acceptance cases to expected-rejection; +9 non-ASCII rejection tests; +1 ASCII-space acceptance test; +1 dev-fixture smoke   |
| Backend (tests)           | `backend/src/nest/auth/dto/auth.dto.test.ts`                             | Flipped reset-password 3-of-4 acceptance; updated register-min-length narrative; +1 reset-password umlaut rejection; +4 LoginSchema regression-locks (Amendment 2026-04-30b) |
| Frontend (live-validator) | `frontend/src/routes/reset-password/+page.svelte`                        | + `hasOnlyAllowedChars` derived; UI checklist item; widened special-char regex to backend's 28-char class                              |
| Frontend (UI text)        | `frontend/src/routes/(public)/signup/+page.svelte`                       | Tooltip rewrite                                                                                                                        |
| Frontend (UI text)        | `frontend/src/routes/(app)/(admin)/admin-profile/_lib/constants.ts`      | 2 strings (`passwordRequirements`, `PASSWORD_TOOLTIP`)                                                                                 |
| Frontend (UI text)        | `frontend/src/routes/(app)/(root)/root-profile/_lib/constants.ts`        | 2 strings                                                                                                                              |
| Frontend (UI text)        | `frontend/src/routes/(app)/(root)/manage-admins/_lib/constants.ts`       | `HINT_PASSWORD`                                                                                                                        |
| Frontend (UI text)        | `frontend/src/routes/(app)/(shared)/employee-profile/_lib/constants.ts`  | 2 strings                                                                                                                              |
| Frontend (UI text)        | `frontend/src/routes/(app)/(root)/manage-root/_lib/RootUserModal.svelte` | Tooltip rewrite                                                                                                                        |
| Documentation             | `docs/PASSWORD-VALIDATION-SYSTEM.md`                                     | v3.0.0 — full update + new "Disallowed Characters" §4 + changelog                                                                      |

### Migration Impact

- **Login (bcrypt-compare path):** unaffected. The validator runs only on registration / password-change / password-reset endpoints, never on login. **Enforcement detail:** see Amendment 2026-04-30b — `login.dto.ts` was originally listed in Affected Components but the actual decoupling step (replacing `PasswordSchema` with a lightweight `z.string().max(72)`) was missed in the initial round and discovered as a 2FA test regression. The fix and rationale are documented below.
- **Existing user with a password containing umlauts or only 3-of-4 categories:** can still log in with the existing password. Hits the new rule at the next `/reset-password` or profile-page password change.
- **OAuth sign-in users (ADR-046):** unaffected — they have no Assixx-side password.
- **Test fixtures:** all `*Test12345!` family + `SecurePass123!` already 4/4 + ASCII; no test breakage.

---

## Amendment 2026-04-30b — Login DTO Decoupling

### Context

The initial implementation of this ADR (2026-04-30) listed `login.dto.ts` in Affected Components but did not actually relax it — it still imported the now-strict `PasswordSchema`. The 2FA test `POST /auth/login → invalid password → 401` (FEAT_2FA_EMAIL §R10) regressed from 401 to **400** because `'WrongPassword!'` (the test's intentionally-wrong probe) is 3-of-4 (no digit) and was rejected at the Zod gate before ever reaching auth.

### Three contracts the missed change broke

1. **Anti-enumeration (FEAT_2FA_EMAIL §R10).** Wrong-password and unknown-email must be indistinguishable to an attacker — both 401 with identical envelope. A 400 leak from the validator told the attacker (a) the password did not meet policy and (b) the request was rejected before auth ran — a distinguishable probe signal. R10 is the regression detector for exactly this class of mistake.
2. **Legacy-user login (this ADR's own R4 "No regression for existing users — login is bcrypt-compare only").** Any pre-policy stored password (3-of-4 or non-ASCII) would 400 forever. The user — through no fault of their own — could never authenticate again, with no recovery path that does not first require logging in.
3. **This ADR's own "Migration Impact" claim.** *"Login (bcrypt-compare path): unaffected. The validator runs only on registration / password-change / password-reset endpoints, never on login."* That sentence was an aspiration, not a state. It only became true once `login.dto.ts` stopped importing `PasswordSchema`.

### Decision

`login.dto.ts` defines a **separate**, lightweight `LoginPasswordSchema`:

```typescript
const LoginPasswordSchema = z.string().max(72, 'Password cannot exceed 72 characters');
```

- **No `min`** — empty string falls through to bcrypt-compare → 401, preserving R10 symmetry. A `min(1)` refine would itself produce a 400 distinguishable from 401.
- **No category / charset / length-floor checks** — bcrypt-compare is the gate. The plaintext is never re-validated; only the bcrypt hash matters at login.
- **`max(72)`** — bcrypt's input limit is 72 bytes. Bounding at the DTO layer is a DoS guard against mega-payloads that would otherwise consume bcrypt CPU for no useful work.
- **Local, not exported** — kept private to `login.dto.ts` so it cannot accidentally be reused at a password-setting endpoint.

`PasswordSchema` (strict 4-of-4 + ASCII) remains the sole validator at every endpoint that **sets** a password (`register.dto.ts`, `reset-password.dto.ts`, profile-page password change). The asymmetry is intentional: setting a password enforces policy; checking a password against a stored hash does not.

### Regression locks

Four new test cases pin `LoginSchema` as the gate-shape contract in `backend/src/nest/auth/dto/auth.dto.test.ts > LoginSchema`:

1. Accepts a 3-of-4 password (`'WrongPassword!'` — the exact value from the failing 2FA test) — locks the R10 contract.
2. Accepts a non-ASCII password (`'Prüfung12345!'`) — locks the legacy-user-login contract.
3. Rejects passwords longer than 72 characters — locks the bcrypt-input DoS guard.
4. Accepts empty password — locks R10 symmetry (validator must NOT short-circuit empty before auth).

Any future PR that re-introduces `PasswordSchema` at login fails all four.

### Verification

```bash
docker exec assixx-backend pnpm exec vitest run --project unit \
    backend/src/nest/auth/dto/auth.dto.test.ts        # 40/40 (4 new locks)
pnpm exec vitest run --project api \
    backend/test/two-factor-auth.api.test.ts          # 34/34 + 1 skipped
```

The `invalid password → 401 + NO challenge issued + NO email sent (R10)` test that regressed is the canonical proof: green again after the decoupling.

---

## Verification

```bash
# Touched-test suite — must be 101/101
docker exec assixx-backend pnpm exec vitest run --project unit \
    backend/src/schemas/common.schema.test.ts \
    backend/src/nest/auth/dto/auth.dto.test.ts

# Broader regression — must be 783/783
docker exec assixx-backend pnpm exec vitest run --project unit \
    backend/src/nest/signup backend/src/nest/auth \
    backend/src/nest/users backend/src/nest/root

# Type + lint gates
docker exec assixx-backend pnpm run type-check    # exit 0
cd frontend && pnpm run check                      # 0 errors / 0 warnings on 2591 files
docker exec assixx-backend pnpm run lint           # exit 0
cd frontend && pnpm run lint                       # exit 0
```

| Scenario                                                                                    | Expected                         | Status |
| ------------------------------------------------------------------------------------------- | -------------------------------- | ------ |
| `ApiTest12345!` (admin fixture)                                                             | accepted                         | ✅     |
| `TestFirmaA12345!`, `TestFirmaB12345!`, `TestScs12345!`, `Unverified12345!` (seed fixtures) | accepted                         | ✅     |
| `Prüfung12345!` (umlaut, formerly silently accepted)                                        | rejected — disallowed character  | ✅     |
| `Größe1234567!` (multiple non-ASCII)                                                        | rejected — disallowed character  | ✅     |
| `Café1234567!Z` (accent)                                                                    | rejected — disallowed character  | ✅     |
| `Naïve1234567!` (diaeresis)                                                                 | rejected — disallowed character  | ✅     |
| `Password1!🔒A` (emoji)                                                                     | rejected — disallowed character  | ✅     |
| `Password1!\tA` (tab)                                                                       | rejected — disallowed character  | ✅     |
| `SecurePass123` (3/4 — no special)                                                          | rejected — missing category      | ✅     |
| `securepass1!!` (3/4 — no upper)                                                            | rejected — missing category      | ✅     |
| `SECUREPASS1!!` (3/4 — no lower)                                                            | rejected — missing category      | ✅     |
| `Strong1pass` (11 chars)                                                                    | rejected — too short             | ✅     |
| 73-char password                                                                            | rejected — too long              | ✅     |
| `My Secure Pa1!` (4/4 with ASCII space)                                                     | accepted (space is in whitelist) | ✅     |

---

## References

- [PASSWORD-VALIDATION-SYSTEM.md](../../PASSWORD-VALIDATION-SYSTEM.md) — implementation, lazy-loading details, full changelog
- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) — JWT guard, fresh DB lookup per request
- [ADR-030: Zod Validation Architecture](./ADR-030-zod-validation-architecture.md) — `createZodDto`, sole validation library
- [ADR-051: Forgot-Password Role-Gate](./ADR-051-forgot-password-role-gate.md) — companion ADR on the `/forgot-password` flow
- [NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html) — Digital Identity Guidelines (recommended replacement for category rules: breach-DB checks)
- [Microsoft Entra password policy](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-sspr-policy) — industry precedent for ASCII-only, error message "Ihr Kennwort enthält unzulässige Zeichen"
- [adr.github.io](https://adr.github.io/) — ADR best practices (template followed here)
