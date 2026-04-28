# FEAT: i18n English Localization — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-28
> **Version:** 0.2.0 (Draft)
> **Status:** DRAFT — Phase 0 (planning, awaiting PoC)
> **Branch:** `feat/i18n-english`
> **Spec:** **NO upfront ADR.** ADR-053 will be written AFTER Phase 4 ships, capturing the
> actual decisions made — not the ones we _thought_ we'd make. (See "ADR-after-impl" below.)
> **Author:** Simon Öztürk
> **Estimated sessions:** 9–11 (excluding 1 post-impl session for ADR)
> **Actual sessions:** 0 / 10

> **Reading note:** this is a DRAFT. Markers `OPEN: ...` flag decisions that are NOT yet made
> and MUST be resolved in or before the named phase. Don't pre-decide them silently in code.

---

## Why no ADR yet?

Writing an ADR before the PoC is theatre — the document would describe an imagined design,
not a verified one. The 2026-04-15 layout-load-cache disaster is exactly that pattern:
600-line plan + ADR "Accepted" before any probe → all work discarded after Phase 3.

**Rule for this plan:** ADR-053 is written in **§Post-Impl** as the final session, after Phase 4
ships. It captures real decisions, real trade-offs, real numbers from production. Until then
this masterplan IS the design document.

---

## Changelog

| Version | Date       | Change                                                                                                                                            |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-04-28 | Initial 22-session draft — over-scoped (per user feedback)                                                                                        |
| 0.2.0   | 2026-04-28 | Restructured to 5 phases (PoC → DB → Migration → Email/PDF → TMS), ADR moved to post-impl, Big-Enterprise patterns explicit, `OPEN` markers added |
| 1.0.0   | TBD        | Phase 0 PoC PASSED — stack validated                                                                                                              |
| 1.1.0   | TBD        | Phase 1 COMPLETE — DB migration + locale resolver shipped                                                                                         |
| 1.2.0   | TBD        | Phase 2 COMPLETE — all in-app strings migrated                                                                                                    |
| 1.3.0   | TBD        | Phase 3 COMPLETE — email + PDF localized                                                                                                          |
| 1.4.0   | TBD        | Phase 4 COMPLETE — TMS pipeline + CI gates live                                                                                                   |
| 2.0.0   | TBD        | Post-Impl: ADR-053 published, plan archived                                                                                                       |

---

## Goal Statement

Add English (`en`) as a second UI language alongside the German default (`de`), so non-DACH
customers can use Assixx. **Existing German tenants see ZERO change.** Locale is per-user
(`users.preferred_language`), defaults to `de`, switchable via UI. ICU MessageFormat is the
wire format on both backend (nestjs-i18n + i18next-icu) and frontend (Paraglide JS).
Hierarchy Labels (ADR-034) remain orthogonal — they rename DB entities per tenant, i18n
translates UI chrome.

---

## Big-Enterprise Long-Term Patterns (what we adopt vs. defer)

How Google / Meta / Microsoft / SAP do this at scale, mapped to what Assixx V1 should adopt:

| #   | Pattern                                                           | V1 adoption   | Rationale                                                                                                 |
| --- | ----------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | **Source language convention** (one canonical, others translate)  | ✅ German     | Team writes German first; translators translate de→en. Reverse of Google's en-first, matches our reality. |
| 2   | **No literal strings in code, only message keys**                 | ✅            | Enforced by ESLint architectural test in Phase 4. The only German string lives in `messages/de.json`.     |
| 3   | **Continuous Localization (CLOC)** — TMS sync on every PR         | ✅ Phase 4    | Tolgee/Crowdin auto-PR's translations back. Translators work async, never block dev.                      |
| 4   | **Translation Memory (TM)** — TMS suggests past translations      | ✅            | Built into Tolgee/Crowdin. Free benefit, no extra work.                                                   |
| 5   | **ICU MessageFormat** for plurals, gender, select                 | ✅            | Day-one. `{count, plural, one {1 entry} other {# entries}}`. Both Paraglide + nestjs-i18n support it.     |
| 6   | **Pseudo-locale** for QA (`[!! ßtríng !!]` wrapping)              | ✅            | Paraglide supports it natively. Surface untranslated strings in staging without needing a translator.     |
| 7   | **Locale-aware non-text** (`Intl.DateTimeFormat`, `NumberFormat`) | ✅            | All hardcoded `de-DE` calls replaced with `cls.get('locale')`. Phase 3.                                   |
| 8   | **CI gates: keyset equality + missing-key detection**             | ✅ Phase 4    | Architectural test fails CI if `de.json` and `en.json` have divergent keys.                               |
| 9   | **RTL-readiness** (CSS logical properties, `dir` attribute)       | ⚠️ Audit-only | V1 doesn't ship RTL; but Phase 2 audits CSS for `margin-left/right` → flags V2 work. No new violations.   |
| 10  | **Versioned message bundles** (legacy mobile clients)             | ❌ N/A        | Web-only product, no legacy clients to support.                                                           |
| 11  | **A/B-test-aware copy variants**                                  | ❌ V3+        | Out of scope. Will require message-key-with-variant in TMS.                                               |
| 12  | **Auto-deprecation of unused keys** (telemetry-driven)            | ❌ V2         | Tolgee supports it, requires production telemetry. Defer.                                                 |
| 13  | **In-context editor** (translator clicks button → live edit)      | ❌ V2         | Tolgee supports it. V1 uses CLI sync only.                                                                |

**Net effect for V1:** patterns 1–8 baked in from session 1. Patterns 9 (audit) and 10–13
(deferred) noted explicitly. This is "best practice with discipline", not "ship everything".

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

- [ ] Docker stack running (all containers healthy)
- [ ] DB backup taken: `database/backups/pre-i18n-english_{TIMESTAMP}.dump`
- [ ] Branch `feat/i18n-english` checked out
- [ ] No pending migrations blocking
- [ ] Dependent features shipped: ADR-034 V3 (already done — i18n must compose with custom labels)
- [ ] Phase 0.5 stack PoC PASSED (see §0.5)

### 0.2 Risk register

| #   | Risk                                                                                        | Impact | Probability | Mitigation                                                                                                                  | Verification                                                                            |
| --- | ------------------------------------------------------------------------------------------- | ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| R1  | Hierarchy Labels (ADR-034) collide with i18n — same string translated twice or missed       | High   | Medium      | i18n keys reference labels via ICU placeholders: `m.manage_entity({ entity: labels.area })`. Single source per locale.      | Manual smoke test on `manage-areas` in both locales with custom tenant labels           |
| R2  | ~360+ hardcoded German strings missed during migration → mixed-language UI                  | High   | High        | ESLint architectural rule `no-hardcoded-german` in Phase 4 + CI gate. New strings must be in `messages/de.json`.            | CI fails on hardcoded German chars (umlauts + common nouns) outside `messages/`         |
| R3  | SSR/CSR locale mismatch causes Svelte hydration error                                       | High   | Medium      | Paraglide `paraglideMiddleware` runs BEFORE `resolve()` in `hooks.server.ts`. Locale set on `event.locals`.                 | Browser console clean — no `[svelte] hydration_mismatch` warnings                       |
| R4  | Backend Zod errors bypass i18n (Zod has its own error map) — silent killer                  | High   | High        | `ZodValidationPipe` patched to map every `ZodIssue.code` to `i18n.t('zod.${code}')`. Day-one of Phase 1.                    | API test: bad email + `Accept-Language: en` → "Email is invalid" not "Ungültige E-Mail" |
| R5  | E-Mail templates currently inline German strings in `email-service.ts`                      | Medium | High        | Phase 3 carves templates into `i18n/{locale}/email/*.{json\|hbs\|mjml}` (engine: **OPEN — Phase 3 §3.1**)                   | Unit test: render password-reset in en → English subject + body                         |
| R6  | PDF/CSV exports use `de-DE` date/number format                                              | Medium | Medium      | Phase 3 replaces all `toLocaleString('de-DE')` with `toLocaleString(locale)`                                                | Smoke test: vacation-PDF with locale=en → `04/28/2026`, `1,234.56`                      |
| R7  | Translation drift: keys in DE, missing in EN (or vice versa)                                | Medium | High        | Phase 4 architectural test: keysets of `messages/de.json` and `messages/en.json` MUST match exactly                         | CI test fails on first divergence                                                       |
| R8  | nestjs-i18n + nestjs-cls + Fastify combo unverified (most examples are Express)             | High   | Medium      | **PoC §0.5** validates this combo. If broken: fall back to nestjs-i18n with custom resolver bypassing CLS.                  | PoC test: authenticated request → backend error reflects user's `preferred_language`    |
| R9  | Paraglide path-prefix routing breaks SvelteKit Route Groups `(app)/(root)/...`              | High   | Low         | **PoC §0.5** validates this. SvelteKit groups don't appear in URL — Paraglide's `i18n.route()` should handle.               | PoC test: `/en/admin-dashboard` resolves to `(admin)` group correctly                   |
| R10 | ADR-034 Factory-Pattern (`createMessages(labels)`) doesn't compose with Paraglide functions | Medium | Medium      | Phase 2 first session adapts: factory takes `m.*` Paraglide functions instead of static strings. Validated on first module. | First module migration ships green type-check + smoke test                              |

### 0.3 Ecosystem integration points

| Existing system                                     | Integration                                                                                  | Phase | Verified on |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----- | ----------- |
| `users` table                                       | New column `preferred_language ENUM('de','en') NOT NULL DEFAULT 'de'`                        | 1     |             |
| JwtAuthGuard (ADR-005)                              | Loads `preferred_language` → `cls.set('locale', user.preferred_language)`                    | 1     |             |
| ClsModule (ADR-006)                                 | New CLS key: `locale: 'de' \| 'en'`                                                          | 1     |             |
| ResponseInterceptor (ADR-007)                       | Error envelope `error.message` translated via `i18n.t(key)` before response                  | 1     |             |
| ZodValidationPipe (ADR-030)                         | `ZodError.issues` mapped to `zod.${code}` keys before `BadRequestException`                  | 1     |             |
| Permission Registry (ADR-020)                       | `PermissionCategoryDef.label` becomes a translation key (`permissions.blackboard_posts`)     | 2     |             |
| Hierarchy Labels (ADR-034) factory                  | Factory takes Paraglide message functions, not strings — composes cleanly                    | 2     |             |
| Frontend `hooks.server.ts`                          | `paraglideMiddleware` wraps `resolve` BEFORE auth middleware                                 | 0/1   |             |
| Frontend `(app)/+layout.server.ts`                  | Returns `locale` in PageData → child pages reuse                                             | 1     |             |
| `apiClient`                                         | Auto-attaches `Accept-Language: ${locale}` header on every request                           | 1     |             |
| EmailService (`backend/src/utils/email-service.ts`) | Locale-aware template loading. **OPEN: engine (Pino-template? Handlebars? MJML?) — Phase 3** | 3     |             |
| PDF/CSV exporters (vacation, KVP, surveys)          | Replace hardcoded `de-DE` with dynamic `cls.get('locale')`                                   | 3     |             |
| Audit trail (ADR-009)                               | REMAINS in German — system-internal log, see Known Limitations                               | —     | (out of V1) |
| Customer fresh-install                              | Migration synced via `./scripts/sync-customer-migrations.sh`                                 | 4     |             |

---

### 0.4 Baseline measurement

> **N/A — FEATURE plan, not OPTIMIZATION.** Skip.

---

### 0.5 Stack Proof-of-Concept (mandatory gate)

> **Why a PoC for a FEATURE?** Paraglide-SvelteKit + adapter-node + nestjs-i18n + nestjs-cls
>
> - Fastify is an unverified combination in this repo. Validate end-to-end on ONE page +
>   ONE endpoint before committing to 9 sessions of migration. **No Phase 1 code without this gate.**

**Scope (≤1 session, throwaway code):**

1. `pnpm add @inlang/paraglide-js @inlang/paraglide-sveltekit` (FE)
2. `pnpm add nestjs-i18n i18next-icu` (BE)
3. Initialize Paraglide: `npx @inlang/paraglide-js init` → creates `messages/de.json` + `messages/en.json`
4. Wire Paraglide middleware into `frontend/src/hooks.server.ts`
5. Wire `I18nModule` into `backend/src/nest/app.module.ts` + custom resolver (cookie → header → default)
6. Translate exactly **one** string on the login page (`/login` title) and **one** error message in `auth.service.ts` (`INVALID_CREDENTIALS`)
7. Manual test: visit `/en/login` → English title + bad creds → English error

**Pass criteria (all required):**

- [ ] Login page renders correct locale based on `/en/...` prefix vs `/...` (de default)
- [ ] `POST /auth/login` with bad creds + `Accept-Language: en` → English error string
- [ ] No SSR/CSR hydration mismatch (browser console clean)
- [ ] `pnpm exec tsc --noEmit -p frontend` passes
- [ ] `docker exec assixx-backend pnpm run type-check` passes
- [ ] R8 + R9 mitigations work (CLS+Fastify combo, Route Groups composition)

**Fail criteria → STOP plan, re-evaluate stack:**

- Paraglide cannot resolve locale during SSR
- nestjs-i18n incompatible with nestjs-cls middleware order
- ICU placeholders parse differently between FE and BE
- Path-prefix routing breaks `(app)/(root)/...` group composition

**§0.5 Definition of Done:**

- [ ] PoC built in <1 session
- [ ] All pass criteria green
- [ ] PoC commit on a throwaway branch (squash + cherry-pick for Phase 1, OR start Phase 1 fresh)
- [ ] **OPEN POINTS resolved:**
  - [ ] **OPEN-1:** Path-prefix vs cookie-only routing — decide based on PoC behaviour and SEO weight
  - [ ] **OPEN-2:** Paraglide adapter version (latest stable) — pin in `package.json`
  - [ ] **OPEN-3:** Cookie name for guest locale — proposal: `assixx_locale`
  - [ ] **OPEN-4:** Resolver precedence final order — proposal: `CLS(auth) > cookie > Accept-Language > default(de)`

---

## Phase 1: DB Migration + Locale Resolver (1 Session)

> **Dependency:** §0.5 PoC PASSED.
> **No ADR is written here.** ADR-053 ships in §Post-Impl after Phase 4.

### 1.1 DB migration: `users.preferred_language`

**File:** `database/migrations/{timestamp}_users-preferred-language.ts` (generator only — never manual!)

**Up:**

```sql
CREATE TYPE user_preferred_language AS ENUM ('de', 'en');
ALTER TABLE users ADD COLUMN preferred_language user_preferred_language NOT NULL DEFAULT 'de';
```

**Down:**

```sql
ALTER TABLE users DROP COLUMN preferred_language;
DROP TYPE user_preferred_language;
```

**RLS / GRANTs:** unchanged — `users` table already has the full set.

### 1.2 Backend: Locale-Resolver + nestjs-i18n module

**New files:**

- `backend/src/nest/i18n/i18n.module.ts` — `I18nModule.forRoot({ ... })` config with `i18next-icu`
- `backend/src/nest/i18n/locale-resolver.ts` — custom resolver implementing precedence (OPEN-4)
- `backend/src/i18n/de/{auth,zod,common}.json` — initial German message files
- `backend/src/i18n/en/{auth,zod,common}.json` — initial English translations

### 1.3 Patch JwtAuthGuard (CLS locale)

`backend/src/nest/common/guards/jwt-auth.guard.ts` — after DB user lookup:

```ts
this.cls.set('locale', user.preferred_language);
```

### 1.4 Patch ZodValidationPipe (R4 silent killer)

`backend/src/nest/common/pipes/zod-validation.pipe.ts` — map every `ZodIssue.code`:

```ts
details: error.issues.map((i) => ({
  field: i.path.join('.'),
  message: i18n.t(`zod.${i.code}`, { args: i }),
  code: i.code,
}));
```

### 1.5 New endpoint: `PATCH /users/me/preferences`

Body: `{ preferredLanguage: 'de' | 'en' }`. Updates `users.preferred_language`, returns 200.
Permission: any authenticated user (own-profile mutation).

### 1.6 Frontend: locale plumbing

- `frontend/src/hooks.server.ts` — `paraglideMiddleware` wired (carry over from PoC)
- `frontend/src/routes/+layout.server.ts` — return `locale` in PageData
- `frontend/src/lib/api/apiClient.ts` — auto-attach `Accept-Language` header
- `frontend/src/lib/components/LocaleSwitcher.svelte` — DE/EN toggle in user menu

### Phase 1 — Definition of Done

- [ ] Migration applied + verified
- [ ] All 6 i18n JSON files exist (`de/en × auth/zod/common`)
- [ ] Locale resolver tested manually with 4 request shapes (auth, no-auth+cookie, no-auth+header, no signal)
- [ ] ZodValidationPipe translates all 14 standard `ZodIssue.code` values
- [ ] JwtAuthGuard sets `cls.locale` on every authenticated request
- [ ] `PATCH /users/me/preferences` works for both locales
- [ ] LocaleSwitcher works on every page (calls PATCH if authed, sets cookie if guest)
- [ ] ESLint 0 errors, type-check 0 errors
- [ ] Smoke test: change locale via UI → next API call returns translated content without re-login

**OPEN POINTS in Phase 1:**

- [ ] **OPEN-5:** Tenant-default locale (`tenants.default_language`) — V1 user-only, V2 add tenant-level. Document in Known Limitations.
- [ ] **OPEN-6:** Pseudo-locale (`?locale=pseudo`) for staging — enable in Phase 1 or defer to Phase 4? Recommend: enable now (Paraglide config switch, no code cost).

---

## Phase 2: Modulweise Constants Migration (4–6 Sessions)

> **Dependency:** Phase 1 complete (locale plumbing works).
> **Reuse:** ADR-034 Factory-Pattern. Each `_lib/constants.ts` has `createMessages(labels)` —
> in Phase 2 the factory takes Paraglide message functions instead of static strings.

### 2.1 First session — adapt the Factory pattern (CRITICAL)

The first migration validates that `createMessages()` (ADR-034) composes with Paraglide.
Pick the **smallest** module — proposal: `(public)/login/` (~30 strings, no auth complexity).

**Pattern:**

```ts
// constants.ts (Phase 2 form)
import * as m from '$lib/paraglide/messages.js';

export function createMessages(labels: HierarchyLabels) {
  return {
    PAGE_TITLE: m.login_page_title(),
    HEADING: m.manage_entity({ entity: labels.area }), // ICU placeholder
    BTN_SAVE: m.common_btn_save(),
  } as const;
}
```

**If this works** → mechanical migration, sessions 2.2–2.6 are copy-paste-fähig.
**If this fails** → R10 fired → adapt before continuing.

### 2.2–2.6 Module batches

Migrate ~3–5 modules per session. Source-language strings stay in `messages/de.json` (German
is canonical, see Big-Enterprise pattern #1). Translators fill `messages/en.json` later via TMS.

**Suggested batches** (subject to revision after session 2.1):

| Session | Batch                                                                           | Approx strings |
| ------- | ------------------------------------------------------------------------------- | -------------- |
| 2.1     | login + layout/nav + dashboard + LocaleSwitcher                                 | ~80            |
| 2.2     | manage-employees + manage-areas/-departments/-teams + organigram                | ~180           |
| 2.3     | calendar + blackboard + chat + documents-explorer                               | ~190           |
| 2.4     | kvp + kvp-detail + shifts + shift-handover + vacation (×3 role variants)        | ~240           |
| 2.5     | tpm + work-orders + approvals + surveys + inventory                             | ~250           |
| 2.6     | root-pages + admin-remainders + settings + Permission Registry labels (ADR-020) | ~190           |

**Per-module checklist:**

- [ ] All German strings extracted to `messages/de.json` under namespace `{module}.{key}`
- [ ] Same keys present in `messages/en.json` (translation can be empty initially → pseudo-locale surfaces them)
- [ ] `_lib/constants.ts` `createMessages()` updated to call `m.*` functions
- [ ] All `+page.svelte` and child components use `messages.X` or direct `m.X()`
- [ ] Backend errors for the same module's controller use `i18n.t('{module}.error_*')`
- [ ] svelte-check 0 errors, ESLint 0 errors

### Phase 2 — Definition of Done

- [ ] All ~22 modules migrated
- [ ] `messages/de.json` ≈1100 keys, `messages/en.json` keysets match (English may be partial — TMS fills)
- [ ] No hardcoded German strings in `frontend/src/routes/**/*.svelte` (architectural test added in Phase 4)
- [ ] Backend controllers' error paths all translated
- [ ] Permission Registry labels (ADR-020) use translation keys
- [ ] Hierarchy Labels (ADR-034) compose correctly — manual test on `manage-areas` with custom labels
- [ ] Bundle size delta verified: <10% growth (Paraglide tree-shakes per route)

**OPEN POINTS in Phase 2:**

- [ ] **OPEN-7:** Audit-trail message strings — translate or leave German? Recommend: leave German (system-internal, ADR-009). Document in Known Limitations.
- [ ] **OPEN-8:** Toast/notification strings sent from backend → frontend — translate at backend (using `cls.locale`) or at frontend (using key + args)? Recommend: backend translates, frontend just renders.

---

## Phase 3: Email Templates + PDF Exports (2 Sessions)

> **Dependency:** Phase 2 complete.
> **Engine choice:** **OPEN-9 — decide at start of §3.1.**

### 3.1 Email template engine — OPEN POINT

**Decision needed (before writing any code in §3.2):**

| Option                        | Pro                                             | Con                                               |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| **Pino-template**             | Lightweight, no new dep                         | No HTML email features, no MJML responsive layout |
| **Handlebars**                | Industry standard, mature                       | Logic-less by design — ICU plurals awkward        |
| **MJML + i18n**               | Best for HTML emails, responsive out of the box | New dep, learning curve                           |
| **nestjs-i18n .ftl** (Fluent) | Native to nestjs-i18n, ICU-compatible           | Niche format, translators need Fluent training    |

**Recommendation (subject to review):** **MJML for HTML emails + nestjs-i18n JSON for strings**.
MJML handles responsive HTML; nestjs-i18n JSON handles the i18n-able strings (subject, body
paragraphs). Templates reference message keys: `<mj-text>{{ t 'email.password_reset.greeting' }}</mj-text>`.

**Owner decision required before §3.2 starts.**

### 3.2 Localize critical email templates (V1 = 3 templates)

**In V1 scope:** `password-reset`, `vacation-approved`, `tenant-invite`.
**Out of V1:** other 14 email templates → V2 follow-up (see Known Limitations).

Per template:

- Subject + body strings → `i18n/{locale}/email/{template}.json`
- HTML structure → MJML (or chosen engine) with placeholders
- Render function: `EmailService.render(template, { locale, ...vars })` — `locale` from CLS at send time

### 3.3 PDF / CSV exports

**Files in scope** (grep `toLocaleDateString\|toLocaleString` in `backend/`):

- vacation-overview PDF
- KVP CSV export
- surveys-results CSV
- audit-trail export (if user-initiated)

**Pattern:**

```ts
// before
date.toLocaleDateString('de-DE');
// after
const locale = this.cls.get<string>('locale') ?? 'de';
date.toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US');
```

### 3.4 Locale-aware formats elsewhere

**Audit + replace:**

- All `Intl.DateTimeFormat`, `Intl.NumberFormat` instances in frontend
- All hardcoded `'de-DE'` strings in backend services
- Number/currency formatters in dashboards

### Phase 3 — Definition of Done

- [ ] Email engine decided (OPEN-9 resolved + documented in plan)
- [ ] 3 email templates render correctly in both locales
- [ ] PDF export with `locale=en` produces `04/28/2026`, `1,234.56`
- [ ] All `'de-DE'` literal strings in backend replaced with dynamic locale
- [ ] Smoke test: trigger password-reset email as English user → arrives in English

**OPEN POINTS in Phase 3:**

- [ ] **OPEN-9:** Email template engine (above)
- [ ] **OPEN-10:** Email locale fallback when User has no `preferred_language` set in template-render context (e.g. signup confirmation BEFORE login) — solution: read from cookie or `Accept-Language` of signup request. Confirm during implementation.

---

## Phase 4: TMS Pipeline + GitHub Actions (1 Session)

> **Dependency:** Phase 3 complete.

### 4.1 TMS choice — OPEN POINT

**Decision needed at start of Phase 4:**

| Option       | Pro                                                  | Con                                 | License     |
| ------------ | ---------------------------------------------------- | ----------------------------------- | ----------- |
| **Tolgee**   | OSS, self-hostable (DSGVO-clean), in-context editor  | Requires hosting + ops              | Apache 2.0  |
| **Crowdin**  | Managed, free tier (≤5 langs), large translator pool | Closed source, data in vendor cloud | Proprietary |
| **Lokalise** | Mature, great API                                    | Paid only (~$120/mo entry tier)     | Proprietary |
| **Phrase**   | Enterprise-grade                                     | Expensive, overkill for V1          | Proprietary |

**Recommendation (subject to owner review):** **Tolgee self-hosted** — DSGVO-clean (industrial
customers care), free, OSS. Adds 1 small Docker container. Crowdin only if you want zero-ops.

### 4.2 TMS pipeline integration

- [ ] Tolgee API token in Doppler
- [ ] CI pulls translations on PR open: `tolgee pull --api-key=$TOLGEE_API_KEY`
- [ ] CI pushes new keys on PR merge: `tolgee push`
- [ ] Translators work in Tolgee web UI; translations auto-PR back

### 4.3 CI gates (architectural tests)

**Add to `shared/src/architectural.test.ts` or a new `i18n.test.ts`:**

- [ ] **Keyset equality:** `messages/de.json` and `messages/en.json` MUST have identical keysets
- [ ] **No hardcoded German:** ESLint rule scanning `frontend/src/routes/**/*.svelte` for German diacritics + common nouns outside JSX-attribute-with-German-comment
- [ ] **No untranslated default fallback:** every Paraglide call must have a key that exists in both locales
- [ ] **Backend mirror:** every backend i18n key called via `i18n.t(...)` must exist in both `i18n/de/*.json` and `i18n/en/*.json`

### 4.4 Pseudo-locale activation (if not done in Phase 1)

Enable `?locale=pseudo` for staging — every untranslated string surfaces visibly to QA.

### Phase 4 — Definition of Done

- [ ] TMS chosen + documented (OPEN-11 resolved)
- [ ] TMS sync works on a real PR (push new key → translation appears in TMS)
- [ ] All 4 CI gates pass on green build, fail on injected violation
- [ ] Pseudo-locale renders on staging
- [ ] Customer fresh-install synced: `./scripts/sync-customer-migrations.sh`
- [ ] `FEATURES.md` updated: i18n listed under "Available"

**OPEN POINTS in Phase 4:**

- [ ] **OPEN-11:** TMS choice (above)
- [ ] **OPEN-12:** Translator workflow — internal team translates? Hire freelancers? Use AI pre-translation (DeepL API → human review)? Recommend: AI pre-translation + human review for V1 launch, full human translation for V2.
- [ ] **OPEN-13:** Hosting Tolgee — same Docker network as Assixx, or separate ops? Recommend: same Docker for V1, dedicated infra V2.

---

## §Post-Impl: ADR-053 + Post-Mortem (1 Session, AFTER Phase 4 ships)

> **The ADR is written LAST.** It documents the actual decisions, actual trade-offs, actual
> numbers — not imagined ones. This is the discipline that prevents the 2026-04-15 layout-
> load-cache failure from happening again.

### Tasks

- [ ] **ADR-053: Internationalization Architecture** — written reflecting ALL `OPEN-*` resolutions:
  - Stack chosen (Paraglide + nestjs-i18n + ICU + chosen TMS + chosen email engine)
  - Locale resolver precedence (final resolved order from OPEN-4)
  - Source-language convention (German)
  - Big-Enterprise patterns adopted vs deferred (table from §0)
  - Lessons learned during implementation
  - Migration scope: what's in V1, what's deferred to V2
- [ ] **CLAUDE.md update** — new section: "Adding a translatable string"
- [ ] **Post-mortem table** — planned vs. actual (sessions, strings, bundle size, p95 regression)
- [ ] **Open V2 follow-ups documented** — list of OPEN points that were deferred, not resolved

### Post-Impl — Definition of Done

- [ ] ADR-053 reviewed + status "Accepted"
- [ ] CLAUDE.md updated
- [ ] Post-mortem filled in (real numbers)
- [ ] V2 backlog created (issues/cards/Linear) for deferred items

---

## Session Tracking

| Session | Phase     | Description                                                            | Status | Date |
| ------- | --------- | ---------------------------------------------------------------------- | ------ | ---- |
| 1       | 0         | PoC: Paraglide + nestjs-i18n stack validation                          |        |      |
| 2       | 1         | DB migration + locale resolver + Zod patch + UI switcher               |        |      |
| 3       | 2         | Module batch 1: login + layout + dashboard                             |        |      |
| 4       | 2         | Module batch 2: employees + areas/depts/teams + organigram             |        |      |
| 5       | 2         | Module batch 3: calendar + blackboard + chat + docs                    |        |      |
| 6       | 2         | Module batch 4: kvp + shifts + vacation                                |        |      |
| 7       | 2         | Module batch 5: tpm + work-orders + approvals + surveys + inventory    |        |      |
| 8       | 2         | Module batch 6: root + admin-remainders + settings + permission labels |        |      |
| 9       | 3         | Email templates (3 critical) + engine wiring                           |        |      |
| 10      | 3         | PDF/CSV exports + locale-aware Intl audit                              |        |      |
| 11      | 4         | TMS pipeline + CI gates + customer-sync                                |        |      |
| 12      | Post-Impl | ADR-053 + post-mortem + CLAUDE.md update + V2 backlog                  |        |      |

### Session log (fill per session)

```markdown
### Session N — YYYY-MM-DD

**Goal:** {what should be achieved}
**Result:** {what was actually achieved}
**OPEN points resolved:** {OPEN-X, OPEN-Y}
**OPEN points deferred:** {OPEN-Z + reason}
**New files:** {list}
**Changed files:** {list}
**Verification:**

- ESLint: {0 / N → fixed}
- Type-check: {0 errors}
- Tests: {N / N passed}
- Manual smoke: {result}
  **Deviations:** {what differed from plan and why}
  **Next session:** {what comes next}
```

---

## OPEN Points Index (single source of truth)

| #       | Description                                                      | Decide in   | Status |
| ------- | ---------------------------------------------------------------- | ----------- | ------ |
| OPEN-1  | Path-prefix vs cookie-only routing                               | Phase 0 PoC | OPEN   |
| OPEN-2  | Paraglide adapter version                                        | Phase 0 PoC | OPEN   |
| OPEN-3  | Cookie name for guest locale (`assixx_locale`?)                  | Phase 0 PoC | OPEN   |
| OPEN-4  | Resolver precedence final order                                  | Phase 0 PoC | OPEN   |
| OPEN-5  | Tenant-default locale (V1 user-only, V2?)                        | Phase 1     | OPEN   |
| OPEN-6  | Pseudo-locale activation timing                                  | Phase 1 / 4 | OPEN   |
| OPEN-7  | Audit-trail messages — translate or leave German?                | Phase 2     | OPEN   |
| OPEN-8  | Backend-emitted toast strings — translate where?                 | Phase 2     | OPEN   |
| OPEN-9  | Email template engine (MJML / Handlebars / Pino-template / .ftl) | Phase 3     | OPEN   |
| OPEN-10 | Email locale fallback for pre-login flows (signup confirm)       | Phase 3     | OPEN   |
| OPEN-11 | TMS choice (Tolgee / Crowdin / Lokalise / Phrase)                | Phase 4     | OPEN   |
| OPEN-12 | Translator workflow (internal / freelance / AI-pre-translate)    | Phase 4     | OPEN   |
| OPEN-13 | Tolgee hosting (same network / separate ops)                     | Phase 4     | OPEN   |

---

## Spec Deviations

| #   | Spec says  | Actual code | Decision |
| --- | ---------- | ----------- | -------- |
| —   | (none yet) |             |          |

---

## Known Limitations (V1 — deliberately excluded)

1. **Tenant-default locale** (OPEN-5) — V1 stores locale per-user only. V2 adds `tenants.default_language`.
2. **Locales beyond DE/EN** — Adding French/Italian/Spanish is a 1-session task once pipeline exists; not in V1 due to translator availability.
3. **Audit-trail localization** (OPEN-7) — System-internal log; remains German. Sentry/Loki treat audit text as opaque.
4. **Most email templates** — Only 3 critical templates in V1. Other 14 → V2.
5. **RTL layout** — V1 audits CSS for `margin-left/right` violations but doesn't ship RTL.
6. **In-context editor** — Tolgee feature, V2.
7. **Locale-aware DB sorting** — `ORDER BY name COLLATE "de-x-icu"` requires per-table audit, deferred.
8. **Currency conversion** — EUR for all tenants V1.
9. **Per-user format overrides** — Locale dictates date/number format. No override (e.g., German user wanting US dates). YAGNI.
10. **A/B copy variants** — V3+ feature.
11. **Auto-deprecation of unused keys** — V2 (telemetry-driven).
12. **Versioned message bundles** — N/A, web-only.

---

## Post-Mortem (fill after Phase 4 ships)

### What went well

- (TBD)

### What went badly

- (TBD)

### Metrics

| Metric                           | Planned | Actual |
| -------------------------------- | ------- | ------ |
| Sessions                         | 11–12   |        |
| Migration files                  | 1       |        |
| New backend files                | ~10     |        |
| New frontend files               | ~6      |        |
| Changed files                    | ~180    |        |
| Translated keys (de canonical)   | ~1100   |        |
| Translated keys (en complete %)  | TBD     |        |
| ESLint errors at release         | 0       |        |
| Spec deviations                  | 0       |        |
| Bundle-size delta (FE)           | < 10%   |        |
| p95 regression on /auth/login    | < 5%    |        |
| OPEN points resolved at ADR time | 13/13   |        |

---

**This document is the execution plan. Every session starts here, takes the next unchecked
item, and marks it done. No coding starts before §0.5 PoC PASSES. The ADR is written LAST
in §Post-Impl, capturing real decisions — not imagined ones.**
