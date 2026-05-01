# FEAT: Android App (Capacitor) — Execution Masterplan

> **Created:** 2026-04-11
> **Version:** 0.3.0 (Draft + Amendments 2026-05-02 Parts A + B)
> **Status:** DRAFT — Phase 0 (Planning)
> **Branch:** `feat/android-app`
> **Context:** [BRAINSTORMING_MOBILE_APP.md](./BRAINSTORMING_MOBILE_APP.md)
> **Author:** Simon (Staff Engineer)
> **Estimated Sessions:** 21
> **Actual Sessions:** 0 / 21

---

## ⚠ Pre-Flight Trigger (read FIRST every session)

**Before touching ANY step in this masterplan, the executing session MUST start with:**

> **`continue with Assixx`**

This triggers the mandatory checklist defined in [CLAUDE.md](../CLAUDE.md#mandatory-checklist):
Docker check, KAIZEN-Manifest, TypeScript-Standards, Architecture-Map, Database-Migration-Guide,
ESLint-configs, Code-of-Conduct, design-system, Zod-integration, HOW-TO catalog, ADRs, etc.

**Rationale:** This plan touches Auth (ADR-005), Multi-Tenant Context (ADR-006), Permission Stack
(ADR-045) and the SvelteKit route-security model (ADR-012). Skipping the checklist = skipping the
ADR refresh = high risk of breaking invariants the web app depends on. **No exceptions.**

After "Routine finished — ready." the session may proceed to the next unchecked step in this plan.

---

## Changelog

| Version | Date       | Change                                                                                                       |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| 0.1.0   | 2026-04-11 | Initial Draft — Phases 1-6 planned                                                                           |
| 0.2.0   | 2026-05-02 | Amendment Part A — Codemod-based SPA migration, Pre-Flight trigger, ground-truth file counts                 |
| 0.3.0   | 2026-05-02 | Amendment Part B — ADR/standards-compliance: layout-security trade-off, Svelte 5 syntax, RLS, lint, Zod DTOs |

> **Versioning Rule:**
>
> - `0.x.0` = Planning phase (Draft)
> - `1.x.0` = Implementation in progress (Minor bump per phase)
> - `2.0.0` = Feature fully complete
> - Patch `x.x.1` = Hotfix/rework within a phase

---

## Amendment 2026-05-02 — SPA Migration via Codemod

**Trigger:** Ground-truth analysis of `frontend/src/routes/**/+page.server.ts` — actual structure
materially changes Phase 1 strategy.

### Ground Truth (verified 2026-05-02)

| Artifact                                            | Count   | Implication                                                 |
| --------------------------------------------------- | ------- | ----------------------------------------------------------- |
| `+page.server.ts` total                             | **84**  | Plan said 78 — slightly more, but pattern is uniform        |
| `+page.ts` (universal load)                         | **0**   | No universal-load files exist yet — clean slate             |
| `+layout.server.ts`                                 | **5**   | Central auth bootstrap (`(app)`, `(public)`, etc.)          |
| Files with `actions = { ... }` (Form-Actions)       | **~9**  | Login, Signup, Forgot/Reset Password, OAuth-Complete        |
| Files using shared `apiFetch()` from `$lib/server/` | **70+** | **Token handling is already abstracted** → codemod-friendly |

### Pattern Uniformity (key insight)

70+ of 84 `+page.server.ts` files follow the **identical** pattern:

```ts
const token = cookies.get('accessToken');
if (!token) redirect(302, buildLoginUrl(...));
const [a, b] = await Promise.all([
  apiFetch<T>('/endpoint', token, fetch),
  apiFetch<T>('/other', token, fetch),
]);
return { a, b };
```

The auth-check is **already redundant** — `(app)/+layout.server.ts` (762 lines) enforces it
centrally. → Per-page checks are dead code that the codemod can strip.

### Revised Phase 1 Strategy

**Old plan (v0.1.0):** Manual migration of 78 files OR `export const ssr = false` per-file —
estimated 5-7 sessions.

**New plan (v0.2.0):** Three-track migration based on file shape:

| Track                            | Files                                   | Strategy                                                                          | Sessions |
| -------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| **Track A — Codemod**            | ~70 pure data-load files                | `ts-morph` script: rename `.server.ts`→`.ts`, swap types, strip auth, swap import | **0.5**  |
| **Track B — Layout**             | 5 `+layout.server.ts`                   | Manual restructure → `+layout.ts` with client-side auth gate                      | **1-2**  |
| **Track C — Form Actions**       | ~9 (Login, Signup, Forgot/Reset, OAuth) | Manual rewrite — SvelteKit `actions` don't exist in SPA mode → plain `fetch()`    | **1-2**  |
| **Track D — Universal apiFetch** | 1 new file: `$lib/api-fetch.ts`         | Token from `TokenStore` (Web localStorage / Mobile Capacitor Preferences)         | **0.5**  |
| **Σ Phase 1.2**                  | 84 files + 1 new                        |                                                                                   | **3-5**  |

### New Step 1.2 (replaces v0.1.0 Step 1.2)

#### Step 1.2a: Universal `apiFetch` Helper [TODO]

**New file:** `frontend/src/lib/api-fetch.ts` (universal — works on web SSR, web SPA, and mobile)

```ts
import { browser } from '$app/environment';

import { API_BASE } from './config';
import { TokenStore } from './utils/token-store';

export async function apiFetch<T>(path: string, fetchFn: typeof fetch = fetch): Promise<T> {
  const token = browser ? await TokenStore.get('accessToken') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const res = await fetchFn(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return ((await res.json()) as { data: T }).data;
}
```

**Why a new file (not edit `$lib/server/api-fetch.ts`):** The `$lib/server/` prefix is a SvelteKit
convention — SvelteKit refuses to bundle `$lib/server/*` into the client. The new helper lives at
`$lib/api-fetch.ts` (no `server/` prefix) so it works in both `+page.server.ts` (SSR web) and
`+page.ts` (SPA web + mobile).

#### Step 1.2b: Codemod for 70 Data-Load Files [TODO]

**New file:** `scripts/codemod-spa-migration.ts`

**Operations per file (in order):**

1. **AST parse** with `ts-morph`
2. **Rename file:** `+page.server.ts` → `+page.ts` (and `$types` import: `PageServerLoad` → `PageLoad`)
3. **Strip auth-check block:**
   - Remove `const token = cookies.get('accessToken');`
   - Remove `if (!token) redirect(...)` statement
4. **Rewrite apiFetch import:** `$lib/server/api-fetch` → `$lib/api-fetch`
5. **Strip `token` argument:** `apiFetch<T>(path, token, fetch)` → `apiFetch<T>(path, fetch)`
6. **Strip `cookies` from load destructure:** `({ cookies, fetch, url })` → `({ fetch, url })`
7. **Run Prettier + ESLint --fix**

**Verification per file:**

- Type-check passes (no missing `cookies` references)
- Build (web `adapter-node`) still passes — `+page.ts` works for SSR too
- Build (mobile `BUILD_TARGET=mobile`) succeeds — no `+page.server.ts` left in SPA bundle

#### Step 1.2c: Layout Files — Manual Restructure [TODO]

**Files (5):**

- `frontend/src/routes/(app)/+layout.server.ts` (762 lines — biggest)
- `frontend/src/routes/(public)/+layout.server.ts`
- `frontend/src/routes/(app)/(admin)/+layout.server.ts`
- `frontend/src/routes/(app)/(root)/+layout.server.ts`
- `frontend/src/routes/(app)/(shared)/+layout.server.ts`

**Strategy:** Keep `+layout.server.ts` for web SSR. Add parallel `+layout.ts` (universal) that runs
client-side. Use `BUILD_TARGET` env var at SvelteKit-config time to control which is bundled.

**Auth-check migration:**

- Web SSR: cookie-based check (existing) stays
- SPA / Mobile: `+layout.ts` reads token from `TokenStore`, calls `goto('/login')` if absent
- Token expiry: existing proactive-refresh timer (token-manager.ts) handles it on both

#### Step 1.2d: Form Actions — Manual Rewrite [TODO]

**Files with `export const actions` (~9):**

- `(public)/login/+page.server.ts` (554 lines)
- `(public)/signup/+page.server.ts` (397 lines)
- `(public)/signup/oauth-complete/+page.server.ts` (407 lines)
- `(public)/forgot-password/+page.server.ts`
- `reset-password/+page.server.ts`
- `tenant-deletion-approve/+page.server.ts`
- (others as discovered during audit)

**Why no codemod:** Form actions are server-only by design. SPA mode replaces them with
`<form on:submit|preventDefault={handler}>` calling `fetch()` directly. The handler does:

```ts
async function handleLogin(event: SubmitEvent) {
  const formData = new FormData(event.target as HTMLFormElement);
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'X-Client-Platform': IS_MOBILE ? 'mobile' : 'web' },
    body: formData,
  });
  const { accessToken, refreshToken } = await res.json();
  await TokenStore.set('accessToken', accessToken);
  if (IS_MOBILE) await TokenStore.set('refreshToken', refreshToken);
  await goto('/dashboard');
}
```

**Web parity:** Web build keeps using `+page.server.ts` actions (HttpOnly cookie path). The new
`+page.ts` handler is **mobile-only**. Two paths intentional — auth flow is fundamentally
different across cookies vs. native token store.

### Definition of Done — Phase 1.2 (Amendment)

- [ ] `scripts/codemod-spa-migration.ts` exists, dry-run mode + apply mode
- [ ] `$lib/api-fetch.ts` exists, type-checks, works for web SPA and mobile
- [ ] Codemod converts ≥70 files clean (no manual fixup) — measure with `git diff --stat`
- [ ] Web build (`adapter-node`) still passes — zero web regressions
- [ ] Mobile build (`BUILD_TARGET=mobile`) produces `build-mobile/index.html` with no leftover
      `+page.server.ts` or form-action references
- [ ] Login flow works on Android emulator end-to-end (POST → token in Preferences → navigate)
- [ ] All 5 layout files have working `+layout.ts` companions for SPA mode
- [ ] ESLint 0 errors, Type-Check 0 errors on both build targets

### Revised Session Tracking (v0.2.0)

| Old | New | Phase | Description                                          |
| --- | --- | ----- | ---------------------------------------------------- |
| 1   | 1   | 0     | **`continue with Assixx`** + Phase 1.1 adapter setup |
| 2   | 2   | 1     | Capacitor init + Android project + scripts           |
| 3   | 3   | 1     | Step 1.2a — Universal apiFetch + Step 1.2b — Codemod |
| —   | 4   | 1     | Step 1.2c — Layout files manual restructure          |
| —   | 5   | 1     | Step 1.2d — Form-Action rewrites (Login/Signup)      |
| —   | 6   | 1     | CSP fixes + Phase 1 DoD verification                 |
| 4   | 7   | 2     | Token store + platform detection                     |
| 5   | 8   | 2     | Backend dual auth path (cookie + header)             |
| 6   | 9   | 2     | API client adaptation + WebSocket hardening          |
| 7   | 10  | 3     | StatusBar + SplashScreen + Keyboard                  |
| 8   | 11  | 3     | Push Notifications (FCM setup + backend)             |
| 9   | 12  | 3     | Push Notifications (backend dispatch + test)         |
| 10  | 13  | 3     | Biometric auth + Deep links + App lifecycle          |
| 11  | 14  | 4     | Offline cache architecture + service                 |
| 12  | 15  | 4     | API client cache integration + indicators            |
| 13  | 16  | 4     | Offline testing + edge cases                         |
| 14  | 17  | 5     | Touch targets + pull-to-refresh                      |
| 15  | 18  | 5     | Mobile layout + safe areas + navigation              |
| 16  | 19  | 6     | App assets + signing + Gradle config                 |
| 17  | 20  | 6     | Store listing + Sentry + CI/CD                       |
| 18  | 21  | 6     | Performance audit + final testing + release          |

**Estimated Sessions:** 18 → **21** (+3 for Phase 1 split into A/B/C/D tracks)
**Actual Sessions:** 0 / 21

### Spec Deviations Added (Amendment)

| #   | v0.1.0 Says                              | v0.2.0 Decision                                      | Reason                                                                |
| --- | ---------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| D4  | "Evaluate dual-load vs `ssr = false`"    | **Codemod to `+page.ts` + universal `apiFetch`**     | Pattern uniformity (70/84 files identical) makes codemod fastest path |
| D5  | "78 +page.server.ts files"               | **84 files (verified 2026-05-02)**                   | Ground-truth count; pattern still uniform                             |
| D6  | "Backend dual auth path is small change" | **Confirmed small — but Form-Actions are NOT small** | ~1500+ LOC across 9 form-action files needs manual rewrite for mobile |

---

## Amendment 2026-05-02 (Part B) — ADR/Standards Compliance

**Trigger:** Mandatory-checklist re-read (CLAUDE.md §"continue with Assixx") surfaced 5 compliance
gaps where Part A was correct on strategy but missing concrete invariants from existing ADRs/
standards. Part B closes them — no strategy changes, only added discipline.

### B-1: Phase 1.2c — Layout-Restructure Security Trade-Off (ADR-012 + ADR-045)

**Gap in Part A:** Track B (5 layout-server-files → universal layouts) treats security as solved
"because backend guards exist" without naming the specific trade-off.

**The trade-off (must be acknowledged in the masterplan, not implicit):**

| Security Property                         | Web SSR (current)  | Mobile SPA (post-migration)            |
| ----------------------------------------- | ------------------ | -------------------------------------- |
| Auth check before HTML emitted            | ✅ Server (cookie) | ❌ Client (token from Preferences)     |
| Role-gated route invisible to denied user | ✅ 302 from server | ❌ Loads JS, then client-side redirect |
| API mutations (real damage)               | ✅ Backend guards  | ✅ Backend guards (unchanged)          |
| UI-existence info-leak (route names)      | ✅ Hidden          | ⚠ Visible in static bundle             |

**Conclusion:** The mobile SPA **leaks the UI tree structure** (route names, button labels, form
shapes) to anyone who downloads the APK and decompiles `build-mobile/`. This is a **bounded
information leak** — no data, no mutations, just feature existence. The 4-layer Defense-in-Depth
from ADR-012 still holds because **Layer 4 (Backend API Guards via ADR-045's 3-layer stack:
addon-gate → management-gate → action-permission)** remains the authoritative enforcement point.

**Action items added to Phase 1.2c DoD:**

- [ ] `+layout.ts` (universal) MUST call `goto('/login')` synchronously when no token in `TokenStore`
- [ ] `+layout.ts` for `(admin)` / `(root)` MUST check `user.role` client-side BEFORE rendering
      child routes (mirrors ADR-012 fail-closed pattern, even if APK is decompiled)
- [ ] Document in `BRAINSTORMING_MOBILE_APP.md` "Known Limitations" — UI-existence info-leak is
      acceptable given ADR-045 backend enforcement
- [ ] Spike test: `cap build android --release` → unzip APK → grep `build-mobile/` for route
      names — confirm leak surface is route-tree only (no data, no secrets)

### B-2: Phase 1.2d — Svelte 5 Syntax + Line-Limit Discipline

**Gap in Part A:** Form-action rewrite snippet uses generic SvelteKit examples without enforcing
the project's Svelte 5 + ESLint rules.

**Rules (from CODE-OF-CONDUCT-SVELTE.md + frontend/eslint.config.mjs):**

1. **Svelte 5 event syntax:** `onsubmit={handleLogin}`, **NOT** `on:submit={handleLogin}` (Svelte 4 syntax).
   See CODE-OF-CONDUCT-SVELTE §"Events (Svelte 5 Syntax)".
2. **`max-lines-per-block`:** Svelte components — script ≤ 450, template ≤ 800 (frontend/eslint.config.mjs:439).
3. **`max-lines-per-function`:** 60 (svelte components: 80 — frontend/eslint.config.mjs:450).
4. **`cognitive-complexity`:** ≤ 10 (frontend/eslint.config.mjs:143).
5. **`no-floating-promises`:** every async fetch call needs `await` or `void`.

**Action items added to Phase 1.2d DoD:**

- [ ] All event handlers use Svelte 5 `oneventname` syntax (no `on:event`)
- [ ] `(public)/login/+page.svelte` script block stays ≤ 450 lines — extract handlers to
      `_lib/login-handlers.ts` (already exists pattern in `(app)/(shared)/manage-surveys/_lib/`)
- [ ] Login/signup/forgot/reset/oauth-complete handlers use `await` or explicit `void` (no
      floating promises — `@typescript-eslint/no-floating-promises` is `error` in
      frontend/eslint.config.mjs:298)
- [ ] Cognitive complexity ≤ 10 per function — split if exceeded

### B-3: Phase 3 — DB Migration Hard-Block + RLS Triple-User-Model

**Gap in Part A:** `user_push_tokens` table mentioned, but the **🚨 HARD BLOCK** from
DATABASE-MIGRATION-GUIDE.md §"LLMs / AI AGENTS" and the **mandatory** RLS pattern from
ADR-019 §"How to add RLS to a new table" are not explicit.

**Hard block (verbatim from DATABASE-MIGRATION-GUIDE.md):**

> 1. **BACKUP FIRST** — Before ANY DB change. No exceptions.
> 2. **GENERATOR ONLY** — `doppler run -- pnpm run db:migrate:create <name>`. Period.
>    NO `Write` tool, NO `touch`, NO copy-paste, NO manual file creation.
> 3. **DRY RUN MANDATORY** — `doppler run -- ./scripts/run-migrations.sh up --dry-run`
> 4. **NEVER execute raw SQL** to bypass migration tooling.

**Mandatory RLS template for `user_push_tokens` (from ADR-019 §"How to add RLS to a new table"):**

```sql
-- Schema
CREATE TABLE user_push_tokens (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('android', 'ios')),
    is_active SMALLINT NOT NULL DEFAULT 1,  -- 0|1|3|4 per IS_ACTIVE constants
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id, fcm_token)
);

-- RLS — ENABLE + FORCE (mandatory per ADR-019)
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_push_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON user_push_tokens
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- Triple-User-Model GRANTs (mandatory — both app_user AND sys_user)
GRANT SELECT, INSERT, UPDATE, DELETE ON user_push_tokens TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_push_tokens TO sys_user;
GRANT USAGE, SELECT ON SEQUENCE user_push_tokens_id_seq TO app_user;
GRANT USAGE, SELECT ON SEQUENCE user_push_tokens_id_seq TO sys_user;
```

**Action items added to Phase 3 DoD:**

- [ ] Migration generated via `doppler run -- pnpm run db:migrate:create add-user-push-tokens` —
      NEVER hand-written
- [ ] `pg_dump` backup created before applying migration (per HARD BLOCK rule 1)
- [ ] `doppler run -- ./scripts/run-migrations.sh up --dry-run` passes before real run
- [ ] RLS verified post-migration: `SELECT tablename, policyname FROM pg_policies WHERE
    tablename = 'user_push_tokens';` — `tenant_isolation` policy present
- [ ] `app_user` GRANTs verified: `\dp user_push_tokens` shows `arwd/assixx_user` for app_user
- [ ] Customer fresh-install synced: `./scripts/sync-customer-migrations.sh`

### B-4: Phase 1.2a — Universal `apiFetch` ESLint/Strict-TS Compliance

**Gap in Part A:** Snippet for `$lib/api-fetch.ts` was conceptual but does not pass the strict
ESLint rules from `frontend/eslint.config.mjs` and `eslint.config.mjs`.

**Rules that affect the helper (verified against actual configs):**

1. `@typescript-eslint/explicit-function-return-type: error` (eslint.config.mjs:217) — explicit
   return types on exported functions
2. `@typescript-eslint/strict-boolean-expressions: error` — no truthy checks (`if (token)` →
   `if (token !== null && token !== '')`)
3. `@typescript-eslint/no-floating-promises: error` — every promise awaited or `void`-prefixed
4. `@typescript-eslint/consistent-type-imports: error` — type-only imports use `import type`
5. `sonarjs/cognitive-complexity: ['error', 10]` — function complexity ≤ 10
6. `@typescript-eslint/no-explicit-any: error` — generic `T` only, never `any`

**Updated `$lib/api-fetch.ts` (ESLint-compliant):**

```typescript
import { browser } from '$app/environment';

import type { ApiResponse } from '@assixx/shared/types';

import { API_BASE } from './config';
import { TokenStore } from './utils/token-store';

/**
 * Universal API fetch — works in:
 *   - Web SSR (adapter-node, +page.server.ts)
 *   - Web SPA (adapter-static + browser, +page.ts)
 *   - Mobile SPA (Capacitor + browser, +page.ts)
 *
 * Token source switches by environment: browser → TokenStore (localStorage|Preferences),
 * server → returns null (caller must use $lib/server/api-fetch with cookie).
 *
 * @see ADR-045 (3-layer permission stack — Backend enforces)
 * @see ADR-005 (auth — Bearer header is canonical)
 */
export async function apiFetch<T>(path: string, fetchFn: typeof fetch = fetch): Promise<T> {
  const token = browser ? await TokenStore.get('accessToken') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== null && token !== '') {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetchFn(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`API ${res.status.toString()}: ${path}`);
  }
  const json = (await res.json()) as ApiResponse<T>;
  if (json.success !== true || json.data === undefined) {
    throw new Error(`API ${path}: malformed response`);
  }
  return json.data;
}
```

**Action items added to Phase 1.2a DoD:**

- [ ] `pnpm exec eslint frontend/src/lib/api-fetch.ts` → 0 errors
- [ ] `pnpm exec tsc --noEmit -p frontend` → 0 errors
- [ ] Cognitive complexity verified ≤ 10 (file is 1 function, complexity ~4)

### B-5: Phase 1.2b — Codemod Post-Step `lint:fix`

**Gap in Part A:** Codemod produces 84 `+page.ts` files but does not guarantee they pass
ESLint. ESLint `consistent-type-imports` rule (frontend/eslint.config.mjs:335) auto-fixes
import drift, but only if the fixer runs.

**Action items added to Phase 1.2b DoD:**

- [ ] Codemod final step: `pnpm run sync:svelte && cd frontend && pnpm run lint:fix`
      (per ADR-041 §"Build Tooling Pre-Step Discipline" — every frontend ESLint invocation
      MUST follow `sync:svelte`)
- [ ] After lint:fix: `pnpm run type-check` → 0 errors
- [ ] After lint:fix: `pnpm run lint` → 0 errors (no remaining violations after auto-fix)
- [ ] Spot-check 3 random converted files for: (a) `import type` syntax used,
      (b) no `any`, (c) cognitive complexity ≤ 10

### B-6: Phase 3 — Push Token DTOs (ADR-030 + TYPESCRIPT-STANDARDS §7.5)

**Gap in Part A:** Push-token endpoints mentioned without naming the mandatory factory pattern.

**Rules (from ADR-030 + TYPESCRIPT-STANDARDS §7.5 + `shared/src/architectural.test.ts`):**

1. Param DTOs MUST use `idField` / `createIdParamSchema()` from `common/dto/param.factory.ts` —
   inline `z.coerce.number()` is **forbidden** and CI-blocked
2. Body DTOs MUST extend `createZodDto(Schema)` (nestjs-zod) — never raw classes
3. `IS_ACTIVE` constants from `@assixx/shared/constants` — never magic numbers `0/1/3/4`
4. API field naming: **camelCase** (TYPESCRIPT-STANDARDS §5.3) — no `snake_case`

**Mandatory pattern for `backend/src/nest/push/dto/`:**

```typescript
// dto/create-push-token.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// dto/push-token-id-param.dto.ts — use the factory, NOT inline z.coerce
import { createIdParamSchema } from '../../common/dto/index.js';

export const CreatePushTokenSchema = z.object({
  fcmToken: z.string().min(1).max(4096), // NOT fcm_token (camelCase!)
  platform: z.enum(['android', 'ios']),
});

export class CreatePushTokenDto extends createZodDto(CreatePushTokenSchema) {}

export const PushTokenIdParamSchema = createIdParamSchema('pushTokenId');
export class PushTokenIdParamDto extends createZodDto(PushTokenIdParamSchema) {}
```

**Action items added to Phase 3 DoD:**

- [ ] All push-DTOs use `createZodDto()` — no raw class declarations
- [ ] No inline `z.coerce.number()` in `*-param.dto.ts` (CI test in
      `shared/src/architectural.test.ts` enforces)
- [ ] No magic `is_active = 0/1/3/4` — import `IS_ACTIVE` from `@assixx/shared/constants`
- [ ] All API fields camelCase: `fcmToken` not `fcm_token`, `userId` not `user_id`
- [ ] `pnpm run test:unit -- shared/src/architectural.test.ts` passes

### Part B Summary

| #   | Phase | Gap                                  | Compliance Source                                               |
| --- | ----- | ------------------------------------ | --------------------------------------------------------------- |
| 1   | 1.2c  | Layout-security trade-off named      | ADR-012 (fail-closed RBAC) + ADR-045 (3-layer permission stack) |
| 2   | 1.2d  | Svelte 5 syntax + line limits        | CODE-OF-CONDUCT-SVELTE.md + frontend/eslint.config.mjs:439, 450 |
| 3   | 3     | Migration hard-block + RLS template  | DATABASE-MIGRATION-GUIDE.md §HARD BLOCK + ADR-019               |
| 4   | 1.2a  | apiFetch ESLint compliance           | eslint.config.mjs (strict-everywhere) + ADR-041                 |
| 5   | 1.2b  | Codemod post-step lint:fix           | ADR-041 §Build Tooling Pre-Step Discipline                      |
| 6   | 3     | Push DTOs via createZodDto + idField | ADR-030 + TYPESCRIPT-STANDARDS §7.5 + architectural.test.ts     |

**Part B does not change strategy or session count.** It hardens the existing plan against
silent rule violations that would surface as CI failures, ESLint blocks, or migration HARD-BLOCKs
mid-implementation. Cost: ~30 min review per affected step. Benefit: zero rework.

---

## Architecture Overview

### Strategy: Dual-Build Target

The web app (`adapter-node`, SSR) stays **100% untouched**. The mobile app is a
**second build target** (`adapter-static`, SPA) wrapped by Capacitor into a native
Android APK/AAB.

```
                     ┌─────────────────────────┐
                     │   SvelteKit 5 Codebase   │
                     │   (shared source code)    │
                     └───────────┬───────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            ┌───────▼───────┐        ┌───────▼───────┐
            │  adapter-node │        │adapter-static  │
            │  (SSR, Web)   │        │  (SPA, Mobile) │
            └───────┬───────┘        └───────┬───────┘
                    │                         │
            ┌───────▼───────┐        ┌───────▼───────┐
            │    Nginx       │        │   Capacitor    │
            │  Port 80/443   │        │   Android App  │
            └───────────────┘        └───────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                     ┌───────────▼───────────┐
                     │   NestJS Backend API   │
                     │   (unchanged, shared)   │
                     └─────────────────────────┘
```

### What Does NOT Change

| Component           | Reason                                     |
| ------------------- | ------------------------------------------ |
| Backend API         | 1:1 identical — mobile hits same endpoints |
| @assixx/shared      | Types reused directly                      |
| Design Tokens / CSS | Same CSS variables in WebView              |
| Zod Schemas         | Same validation on both platforms          |
| Web Build (prod)    | adapter-node stays, SSR stays              |
| Docker Setup        | No changes                                 |
| Database            | No changes                                 |

### What Changes / Gets Added

| Component          | Change                                              |
| ------------------ | --------------------------------------------------- |
| `svelte.config.js` | Conditional adapter (env-based: node vs static)     |
| Auth Flow          | Dual-path: cookie (web) vs Secure Storage (mobile)  |
| API Base URL       | Configurable: relative (web) vs absolute (mobile)   |
| Capacitor Project  | New: `frontend/capacitor.config.ts`, `android/`     |
| Native Plugins     | New: Push, Biometrics, StatusBar, SplashScreen, etc |
| Build Pipeline     | New: GitHub Actions workflow for APK/AAB builds     |
| Platform Detection | New: `Capacitor.isNativePlatform()` utility         |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (all containers healthy)
- [ ] Branch `feat/android-app` checked out
- [ ] Web app fully functional at v0.5.0 baseline
- [ ] Android Studio installed (latest stable)
- [ ] JDK 17+ installed
- [ ] Google Play Developer Account active
- [ ] Physical Android device available for testing (Android 10+)

### 0.2 Risk Register

| #   | Risk                                        | Impact | Likelihood | Mitigation                                                                     | Verification                                                    |
| --- | ------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| R1  | adapter-static breaks SSR-dependent pages   | High   | High       | Conditional adapter via `BUILD_TARGET` env var; never remove adapter-node      | Web build still works: `pnpm run build` + production smoke test |
| R2  | HttpOnly cookies don't work cross-origin    | High   | High       | Dual auth path: cookie (web) vs Capacitor Preferences (mobile)                 | Login + token refresh on physical Android device                |
| R3  | +page.server.ts load functions need SSR     | High   | Medium     | Convert to universal load (+page.ts) or provide mobile-specific fallbacks      | Every route navigable in SPA mode without server                |
| R4  | CSP blocks Capacitor bridge communication   | High   | Medium     | Add `https://localhost` and `capacitor://localhost` to CSP connect-src/default | Console log check: no CSP violations in Android WebView         |
| R5  | WebSocket drops on mobile network switching | Medium | High       | Exponential backoff reconnection with connectivity listener                    | Toggle airplane mode → chat reconnects within 10s               |
| R6  | Google Play Store rejection                 | Medium | Medium     | Privacy Policy URL, proper permissions declarations, target API 34+            | Pre-launch report in Google Play Console passes                 |
| R7  | Capacitor plugin version conflicts          | Medium | Low        | Pin exact versions, test upgrade path before bumping                           | `pnpm exec cap doctor` clean on CI                              |
| R8  | SPA deep linking breaks navigation          | Medium | Medium     | Capacitor App plugin + fallback route in adapter-static config                 | Open notification deep link → correct page loads                |

### 0.3 Ecosystem Integration Points

| Existing System          | Integration Type                                       | Phase | Verified |
| ------------------------ | ------------------------------------------------------ | ----- | -------- |
| Auth (JWT + Cookies)     | Dual-path: Capacitor Preferences for native            | 2     |          |
| API Client               | Configurable base URL + platform-aware credentials     | 2     |          |
| WebSocket (Chat)         | Reconnection hardening for mobile networks             | 2     |          |
| Push Notifications (SSE) | Replace SSE with FCM push for background delivery      | 3     |          |
| Sentry                   | Add `@sentry/capacitor` for native crash reporting     | 6     |          |
| Biometric Auth           | New login path via @capacitor-community/biometric-auth | 3     |          |

---

## Phase 1: Build Infrastructure & Capacitor Setup

> **Dependency:** None (first phase)
> **Goal:** Dual-build working — web unchanged, mobile SPA builds, Android project initialized

### Step 1.1: Conditional Adapter Configuration [TODO]

**File:** `frontend/svelte.config.js`

**What happens:**

1. Install `@sveltejs/adapter-static` as devDependency
2. Read `BUILD_TARGET` env var at config time
3. Default to `adapter-node` (web, unchanged behavior)
4. Switch to `adapter-static` when `BUILD_TARGET=mobile`

**Implementation:**

```javascript
import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';

const isMobile = process.env.BUILD_TARGET === 'mobile';

const adapter =
  isMobile ?
    adapterStatic({
      pages: 'build-mobile',
      assets: 'build-mobile',
      fallback: 'index.html', // SPA fallback — critical for client-side routing
      strict: false,
    })
  : adapterNode({
      out: './build',
      precompress: true,
    });
```

**Verification:**

```bash
# Web build still works
cd frontend && pnpm run build
# Mobile build produces static files
cd frontend && BUILD_TARGET=mobile pnpm run build
ls -la frontend/build-mobile/index.html
```

### Step 1.2: SPA Compatibility — Universal Load Functions [TODO]

**What happens:**

Many routes use `+page.server.ts` with load functions that only run on the server.
In SPA mode (adapter-static), these need a migration path.

**Analysis required (78 +page.server.ts files):**

The majority only do:

1. Auth check (cookie → redirect to /login)
2. Fetch data from backend API
3. Check addon permissions

**Strategy — Dual load pattern:**

```
+page.server.ts  → Stays for web (SSR, auth cookies)
+page.ts         → Added for mobile (universal load, token from Preferences)
```

SvelteKit resolution: if both exist, `+page.server.ts` runs on server,
`+page.ts` runs on client. For adapter-static, only `+page.ts` is used.

**Alternative (simpler):** Keep `+page.server.ts` and set `export const ssr = false`
per page in mobile builds. This forces client-side loading even with server files.

**Decision:** Evaluate in session — pick the approach with least code duplication.

### Step 1.3: Capacitor Project Initialization [TODO]

**New files:**

- `frontend/capacitor.config.ts`
- `frontend/android/` (generated by Capacitor)

**Commands:**

```bash
cd frontend
pnpm add -D @capacitor/core @capacitor/cli @capacitor/android
pnpm exec cap init "Assixx" "com.assixx.app" --web-dir build-mobile
pnpm exec cap add android
```

**capacitor.config.ts:**

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.assixx.app',
  appName: 'Assixx',
  webDir: 'build-mobile',
  server: {
    // Production: no URL (loads from local files)
    // Development: uncomment to live-reload against dev server
    // url: 'http://10.0.2.2:5173', // Android emulator → host localhost
    androidScheme: 'https', // Use https scheme for WebView (cookie/CORS compat)
  },
  plugins: {
    CapacitorHttp: {
      enabled: true, // Native HTTP for better cookie/CORS handling
    },
  },
};

export default config;
```

### Step 1.4: Build Scripts & pnpm Integration [TODO]

**File:** `frontend/package.json` (scripts section)

**New scripts:**

```json
{
  "build:mobile": "BUILD_TARGET=mobile vite build",
  "cap:sync": "cap sync android",
  "cap:open": "cap open android",
  "cap:run": "cap run android",
  "mobile:build": "pnpm run build:mobile && pnpm run cap:sync",
  "mobile:dev": "BUILD_TARGET=mobile vite build && cap sync android && cap run android"
}
```

### Step 1.5: Platform Detection Utility [TODO]

**New file:** `frontend/src/lib/utils/platform.ts`

```typescript
import { Capacitor } from '@capacitor/core';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): 'android' | 'ios' | 'web' {
  return Capacitor.getPlatform() as 'android' | 'ios' | 'web';
}

export const IS_MOBILE = isNativePlatform();
```

### Step 1.6: CSP Configuration for Capacitor [TODO]

**File:** `frontend/svelte.config.js` (CSP directives)

**Add to connect-src:**

```
'https://localhost', 'capacitor://localhost', 'http://10.0.2.2:*'
```

**Add to default-src:**

```
'capacitor://localhost'
```

### Step 1.7: .gitignore Updates [TODO]

**Files:** `frontend/.gitignore`

**Add:**

```gitignore
# Capacitor
android/app/build/
android/.gradle/
android/build/
android/local.properties
build-mobile/
*.apk
*.aab
*.keystore
```

**Keep in git:** `android/` project structure (Capacitor recommends committing it).

### Phase 1 — Definition of Done

- [ ] `pnpm run build` (web) still works — zero regressions
- [ ] `pnpm run build:mobile` produces `build-mobile/index.html`
- [ ] `pnpm exec cap doctor` reports no issues
- [ ] Android project opens in Android Studio without errors
- [ ] App loads in Android Emulator (shows login page)
- [ ] All web production tests still pass
- [ ] Platform detection utility works: `IS_MOBILE === true` in emulator
- [ ] CSP allows Capacitor bridge communication (no console errors)

---

## Phase 2: Auth & API Adaptation

> **Dependency:** Phase 1 complete
> **Goal:** Login, token refresh, and API calls work natively on Android

### Step 2.1: Capacitor Preferences for Token Storage [TODO]

**Install:**

```bash
cd frontend && pnpm add @capacitor/preferences
```

**New file:** `frontend/src/lib/utils/native-token-store.ts`

**What happens:**

- On mobile: store access token + refresh token in Capacitor Preferences (encrypted on Android)
- On web: keep existing behavior (localStorage for access token, HttpOnly cookie for refresh token)
- Unified interface: `TokenStore.get()`, `TokenStore.set()`, `TokenStore.remove()`

**Why not HttpOnly cookies on mobile:**

The mobile app loads from `capacitor://localhost` but API lives at `https://api.assixx.com`.
This is cross-origin. HttpOnly cookies with `SameSite=Strict` will NOT be sent.
Even `SameSite=Lax` fails for POST requests. Cookie-based auth is fundamentally
incompatible with Capacitor's cross-origin model.

### Step 2.2: Backend — Mobile Auth Endpoint Adaptation [TODO]

**File:** `backend/src/nest/auth/auth.controller.ts`

**Small change required:**

The login endpoint currently returns the access token in the response body and sets
the refresh token as an HttpOnly cookie. For mobile clients, we need the refresh
token in the response body too.

**Approach:** Detect mobile client via `X-Client-Platform: mobile` header.
When present, include `refreshToken` in response body (in addition to cookie).

```typescript
// Pseudocode — existing login endpoint
if (request.headers['x-client-platform'] === 'mobile') {
  // Return refresh token in body for native storage
  return { accessToken, refreshToken, user };
} else {
  // Web: set HttpOnly cookie (existing behavior)
  reply.setCookie('refreshToken', refreshToken, { httpOnly: true, ... });
  return { accessToken, user };
}
```

**Same for refresh endpoint:** Accept refresh token from `Authorization` header
OR cookie (whichever is present).

### Step 2.3: API Client — Platform-Aware Configuration [TODO]

**File:** `frontend/src/lib/utils/api-client.ts`

**Changes:**

1. **Base URL:** On mobile, use absolute URL (configurable via env/config)

   ```typescript
   const baseUrl =
     IS_MOBILE ?
       'https://app.assixx.com/api/v2' // or from config
     : '/api/v2'; // relative for web (existing)
   ```

2. **Credentials:** On mobile, send `Authorization: Bearer <refreshToken>` header
   for refresh requests instead of relying on cookies

3. **Platform header:** Add `X-Client-Platform: mobile` to all requests from native app

### Step 2.4: Token Manager — Mobile Adaptation [TODO]

**File:** `frontend/src/lib/utils/token-manager.ts`

**Changes:**

- Replace `localStorage.getItem('accessToken')` with `TokenStore.get('accessToken')`
- Replace `localStorage.setItem(...)` with `TokenStore.set(...)`
- Refresh flow: use stored refresh token in header instead of cookie
- Proactive refresh timer continues to work (already client-side)

### Step 2.5: WebSocket — Reconnection Hardening [TODO]

**File:** `frontend/src/routes/(app)/(shared)/chat/_lib/websocket.ts`

**Changes:**

1. Add `@capacitor/network` plugin for connectivity detection
2. Add exponential backoff reconnection (1s → 2s → 4s → 8s → max 30s)
3. Listen for network status changes → auto-reconnect on regain
4. Visual indicator: "Reconnecting..." in chat when disconnected

### Phase 2 — Definition of Done

- [ ] Login works on Android emulator → access token stored in Preferences
- [ ] Token refresh works → new token stored, old one replaced
- [ ] Proactive refresh timer works (token refreshes before expiry)
- [ ] API calls authenticated correctly (Bearer token in header)
- [ ] `X-Client-Platform: mobile` header sent on all requests
- [ ] Backend accepts refresh token from both cookie AND Authorization header
- [ ] WebSocket reconnects after airplane mode toggle (< 10s)
- [ ] Network status indicator visible when offline
- [ ] Web build unaffected — cookie-based auth still works
- [ ] ESLint 0 Errors, Type-Check passed

---

## Phase 3: Native Plugins

> **Dependency:** Phase 2 complete
> **Goal:** Native Android capabilities: Push, Biometrics, StatusBar, Splash, Keyboard

### Step 3.1: StatusBar & SplashScreen [TODO]

**Install:**

```bash
pnpm add @capacitor/status-bar @capacitor/splash-screen
```

**What happens:**

- StatusBar: Match app theme (dark/light), translucent overlay
- SplashScreen: Show branded splash during app load, auto-hide when SvelteKit mounts

**Configuration in `capacitor.config.ts`:**

```typescript
plugins: {
  SplashScreen: {
    launchAutoHide: false,        // Manual hide after SvelteKit mount
    backgroundColor: '#0f172a',   // Dark theme background
    showSpinner: false,
    androidScaleType: 'CENTER_CROP',
  },
  StatusBar: {
    style: 'DARK',                // Light text on dark background
    backgroundColor: '#0f172a',
  },
}
```

**Hide splash in root `+layout.svelte`:**

```typescript
import { SplashScreen } from '@capacitor/splash-screen';
import { onMount } from 'svelte';

onMount(() => {
  if (IS_MOBILE) {
    void SplashScreen.hide({ fadeOutDuration: 300 });
  }
});
```

### Step 3.2: Keyboard Plugin [TODO]

**Install:**

```bash
pnpm add @capacitor/keyboard
```

**What happens:**

- Prevent viewport resize when keyboard opens (use `resize: 'none'`)
- Scroll active input into view automatically
- Handle keyboard dismiss on backdrop tap

### Step 3.3: Push Notifications via Firebase Cloud Messaging [TODO]

**Install:**

```bash
pnpm add @capacitor/push-notifications
```

**What happens:**

1. Register for push on app start
2. Send FCM token to backend: `POST /api/v2/users/me/push-token`
3. Backend stores FCM token per user per device
4. Backend sends push via FCM when creating notifications (alongside existing SSE)

**Backend changes required:**

- New table: `user_push_tokens` (user_id, token, platform, created_at)
- New endpoint: `POST /api/v2/users/me/push-token` + `DELETE`
- Notification service: parallel dispatch — SSE (web) + FCM (mobile)
- New dependency: `firebase-admin` SDK

**This is the most significant backend change in this masterplan.**

### Step 3.4: Biometric Authentication [TODO]

**Install:**

```bash
pnpm add @capacitor-community/biometric-auth
```

**What happens:**

1. After first successful login, offer "Enable biometric login"
2. If enabled: store encrypted credentials in Android Keystore
3. On subsequent app opens: biometric prompt → auto-login
4. Fallback: manual login form (existing)

**Flow:**

```
App opens → Check biometric availability → Check stored credentials
  → Available + stored: Show biometric prompt → Success → API login → Dashboard
  → Not available / not stored: Show login form (existing)
  → Biometric fails 3x: Fallback to login form
```

### Step 3.5: App Lifecycle & Deep Links [TODO]

**Install:**

```bash
pnpm add @capacitor/app
```

**What happens:**

- Handle `appUrlOpen` events for deep linking (notification taps)
- Handle `backButton` events for Android hardware back
- Handle `appStateChange` for background/foreground transitions
- Refresh data on foreground resume (stale data prevention)

**Deep link scheme:** `assixx://` for custom URLs, `https://app.assixx.com/` for App Links

### Phase 3 — Definition of Done

- [ ] StatusBar matches app theme (dark/light toggle works)
- [ ] SplashScreen shows on cold start, hides after mount
- [ ] Keyboard doesn't resize viewport, inputs scroll into view
- [ ] Push notification permission requested on first launch
- [ ] FCM token stored in backend, push received when app backgrounded
- [ ] Biometric prompt works on physical device
- [ ] Biometric login completes full auth flow
- [ ] Deep link `assixx://dashboard` opens correct page
- [ ] Android back button navigates correctly (not closing app on sub-pages)
- [ ] App refreshes data on foreground resume
- [ ] ESLint 0 Errors, Type-Check passed
- [ ] Web build unaffected

---

## Phase 4: Offline Read Layer

> **Dependency:** Phase 2 complete (auth working)
> **Goal:** Core data readable without internet connection

### Step 4.1: Offline Storage Architecture [TODO]

**Technology:** IndexedDB via `idb` library (lightweight Promise wrapper)

**What gets cached (read-only):**

| Data                    | Cache Strategy         | TTL      | Priority |
| ----------------------- | ---------------------- | -------- | -------- |
| User profile            | Cache-first            | 1 hour   | P0       |
| Dashboard counts        | Network-first          | 5 min    | P0       |
| Blackboard posts        | Stale-while-revalidate | 15 min   | P1       |
| Calendar events         | Cache-first            | 1 hour   | P1       |
| Document list           | Cache-first            | 30 min   | P1       |
| Chat messages (last 50) | Cache-first            | Realtime | P2       |
| TPM checklists          | Cache-first            | 1 hour   | P2       |

**What is NOT cached (V1):**

- Write operations (create, update, delete) — require network
- File attachments / PDFs — too large for IndexedDB
- Real-time data (chat typing indicators, SSE events)

### Step 4.2: Cache Service Implementation [TODO]

**New file:** `frontend/src/lib/utils/offline-cache.ts`

**Interface:**

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class OfflineCache {
  async get<T>(key: string): Promise<T | null>;
  async set<T>(key: string, data: T, ttl: number): Promise<void>;
  async invalidate(key: string): Promise<void>;
  async clear(): Promise<void>;
}
```

### Step 4.3: API Client Cache Integration [TODO]

**File:** `frontend/src/lib/utils/api-client.ts`

**Changes:**

- On successful GET: write response to IndexedDB cache
- On network error: serve from cache if available
- Show "Offline — showing cached data" indicator
- On POST/PUT/PATCH/DELETE without network: show "No connection" error

### Step 4.4: Network Status & UI Indicator [TODO]

**Install:**

```bash
pnpm add @capacitor/network
```

**What happens:**

- Global reactive state: `$state<'online' | 'offline'>('online')`
- Banner component: "You are offline — showing cached data"
- Disable mutation buttons when offline
- Auto-retry pending operations on reconnect (stretch goal)

### Phase 4 — Definition of Done

- [ ] Core pages load from cache when airplane mode is on
- [ ] Offline indicator visible when no connection
- [ ] Write operations show "No connection" error when offline
- [ ] Cache TTL respected — stale data re-fetched when online
- [ ] Cache cleared on logout
- [ ] Cache size stays under 50 MB
- [ ] Online → offline → online transition is seamless
- [ ] ESLint 0 Errors, Type-Check passed

---

## Phase 5: Touch & Mobile UX

> **Dependency:** Phase 1 complete (app runs in emulator)
> **Goal:** App feels native, not like a website in a wrapper

### Step 5.1: Touch Target Sizing [TODO]

**What happens:**

- Audit all interactive elements for 44px minimum touch target (WCAG)
- Design system already targets this — verify on mobile
- Add `touch-action: manipulation` to prevent 300ms tap delay
- Disable text selection on interactive elements

### Step 5.2: Pull-to-Refresh [TODO]

**What happens:**

- Add pull-to-refresh gesture on list pages (Blackboard, Calendar, Documents, etc.)
- Use Capacitor or CSS overscroll-behavior + custom implementation
- Trigger API refetch + cache invalidation

### Step 5.3: Swipe Gestures [TODO]

**What happens:**

- Swipe-left on list items for quick actions (delete, archive)
- Swipe-right to go back (consistent with Android navigation)
- Only on mobile — web unchanged

### Step 5.4: Mobile-Specific Layout Adjustments [TODO]

**What happens:**

- Sidebar: Convert to bottom navigation or hamburger on mobile
- Tables: Horizontal scroll or card-based layout on narrow screens
- Modals: Full-screen on mobile instead of centered overlay
- Forms: Input types optimized (`inputmode="numeric"`, etc.)

### Step 5.5: Safe Area & Notch Handling [TODO]

**What happens:**

- Add `viewport-fit=cover` to meta viewport
- Use `env(safe-area-inset-*)` CSS variables for padding
- Prevent content from being hidden behind notch or navigation bar

### Phase 5 — Definition of Done

- [ ] All buttons/links have >= 44px touch target
- [ ] Pull-to-refresh works on list pages
- [ ] No 300ms tap delay
- [ ] Safe area insets respected (no content under notch)
- [ ] Sidebar adapted for mobile navigation
- [ ] Tables readable on phone-sized screens
- [ ] Swipe gestures feel natural
- [ ] App tested on 3 screen sizes: phone, small tablet, large tablet
- [ ] Web build unaffected

---

## Phase 6: Store Release & Hardening

> **Dependency:** Phase 1-5 complete
> **Goal:** Published on Google Play Store, production-ready

### Step 6.1: App Identity & Assets [TODO]

**What happens:**

- App icon: Adaptive icon (foreground + background layers) from Assixx logo
- Splash screen image: Branded loading screen
- Feature graphic: 1024x500px for Google Play listing
- Screenshots: 5+ screenshots in phone and tablet format

**Files:**

```
frontend/android/app/src/main/res/
    mipmap-hdpi/ic_launcher.webp
    mipmap-mdpi/ic_launcher.webp
    mipmap-xhdpi/ic_launcher.webp
    mipmap-xxhdpi/ic_launcher.webp
    mipmap-xxxhdpi/ic_launcher.webp
    drawable/splash.xml
```

### Step 6.2: Android App Configuration [TODO]

**File:** `frontend/android/app/build.gradle`

**Settings:**

- `minSdkVersion: 24` (Android 7.0, covers 97%+ devices)
- `targetSdkVersion: 34` (Android 14, Google Play requirement)
- `versionCode: 1`, `versionName: "0.5.0"` (synced with web)

### Step 6.3: Release Signing [TODO]

**What happens:**

1. Generate release keystore: `keytool -genkey -v -keystore assixx-release.jks`
2. Store keystore password in Doppler
3. Configure Gradle signing config for release builds
4. NEVER commit keystore to git

### Step 6.4: ProGuard / R8 Optimization [TODO]

**What happens:**

- Enable R8 code shrinking for release builds
- Add ProGuard rules for Capacitor plugins
- Verify no runtime crashes after shrinking

### Step 6.5: Google Play Store Listing [TODO]

**Required:**

- [ ] App title: "Assixx — Betriebsplattform"
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] Privacy Policy URL (GDPR compliant)
- [ ] Category: Business
- [ ] Content rating questionnaire completed
- [ ] Data safety section completed
- [ ] 5+ screenshots (phone)
- [ ] 2+ screenshots (tablet / 7-inch)
- [ ] Feature graphic (1024x500)
- [ ] App icon (512x512)

### Step 6.6: Sentry Native Crash Reporting [TODO]

**Install:**

```bash
pnpm add @sentry/capacitor @sentry/svelte
```

**What happens:**

- Native crash reporting (ANR, native crashes, OOM)
- Source maps uploaded for JavaScript stack traces
- Release tracking: `com.assixx.app@0.5.0+1`

### Step 6.7: Performance & Battery Audit [TODO]

**Checklist:**

- [ ] Cold start time < 3 seconds
- [ ] Memory usage < 150 MB under normal use
- [ ] No background wake-locks (battery drain)
- [ ] Push notification delivery within 5 seconds
- [ ] WebView rendering at 60 FPS on mid-range device
- [ ] APK size < 30 MB (AAB < 20 MB after split)

### Step 6.8: CI/CD — GitHub Actions for Android Builds [TODO]

**New file:** `.github/workflows/android-build.yml`

**Pipeline:**

```
Trigger: push to feat/android-app OR manual dispatch
Steps:
  1. Checkout + pnpm install
  2. BUILD_TARGET=mobile pnpm run build (SvelteKit static build)
  3. cap sync android
  4. Setup JDK 17 + Android SDK
  5. ./gradlew assembleRelease (signed APK)
  6. Upload APK as artifact
  7. (Optional) Upload to Google Play internal track
```

### Phase 6 — Definition of Done

- [ ] Signed release APK/AAB builds successfully
- [ ] App passes Google Play Pre-launch report (no crashes)
- [ ] Store listing complete with all required assets
- [ ] Privacy Policy URL accessible
- [ ] Sentry captures crashes with readable stack traces
- [ ] Cold start < 3 seconds on mid-range device
- [ ] APK size < 30 MB
- [ ] CI/CD pipeline produces release build on push
- [ ] Internal testing track on Google Play — at least 5 testers
- [ ] No ESLint errors, Type-Check passed, web build unaffected

---

## Session Tracking

| Session | Phase | Description                                  | Status | Date |
| ------- | ----- | -------------------------------------------- | ------ | ---- |
| 1       | 1     | Conditional adapter + adapter-static setup   |        |      |
| 2       | 1     | Capacitor init + Android project + scripts   |        |      |
| 3       | 1     | SPA compatibility audit + CSP fixes          |        |      |
| 4       | 2     | Token store + platform detection             |        |      |
| 5       | 2     | Backend dual auth path (cookie + header)     |        |      |
| 6       | 2     | API client adaptation + WebSocket hardening  |        |      |
| 7       | 3     | StatusBar + SplashScreen + Keyboard          |        |      |
| 8       | 3     | Push Notifications (FCM setup + backend)     |        |      |
| 9       | 3     | Push Notifications (backend dispatch + test) |        |      |
| 10      | 3     | Biometric auth + Deep links + App lifecycle  |        |      |
| 11      | 4     | Offline cache architecture + service         |        |      |
| 12      | 4     | API client cache integration + indicators    |        |      |
| 13      | 4     | Offline testing + edge cases                 |        |      |
| 14      | 5     | Touch targets + pull-to-refresh              |        |      |
| 15      | 5     | Mobile layout + safe areas + navigation      |        |      |
| 16      | 6     | App assets + signing + Gradle config         |        |      |
| 17      | 6     | Store listing + Sentry + CI/CD               |        |      |
| 18      | 6     | Performance audit + final testing + release  |        |      |

### Session Protocol Template

```markdown
### Session {N} — {Date}

**Goal:** {What should be achieved}
**Result:** {What was actually achieved}
**New Files:** {List}
**Changed Files:** {List}
**Verification:**

- ESLint: {0 Errors}
- Type-Check: {0 Errors}
- Web build: {still works}
- Mobile: {tested on emulator/device}
  **Deviations from plan:** {What went differently and why}
  **Next session:** {What comes next}
```

---

## Quick Reference: File Paths

### New Files (Mobile)

| File                                           | Purpose                       |
| ---------------------------------------------- | ----------------------------- |
| `frontend/capacitor.config.ts`                 | Capacitor configuration       |
| `frontend/android/`                            | Android project (generated)   |
| `frontend/src/lib/utils/platform.ts`           | Platform detection utility    |
| `frontend/src/lib/utils/native-token-store.ts` | Capacitor Preferences wrapper |
| `frontend/src/lib/utils/offline-cache.ts`      | IndexedDB offline cache       |
| `.github/workflows/android-build.yml`          | CI/CD for Android builds      |

### Changed Files

| File                                       | Change                                  |
| ------------------------------------------ | --------------------------------------- |
| `frontend/svelte.config.js`                | Conditional adapter (node vs static)    |
| `frontend/package.json`                    | New deps + mobile build scripts         |
| `frontend/src/lib/utils/api-client.ts`     | Platform-aware base URL + offline cache |
| `frontend/src/lib/utils/token-manager.ts`  | Platform-aware token storage            |
| `frontend/src/lib/utils/auth.ts`           | Mobile auth flow integration            |
| `frontend/src/app.html`                    | viewport-fit=cover, safe-area meta      |
| `frontend/.gitignore`                      | Android build artifacts                 |
| `backend/src/nest/auth/auth.controller.ts` | Dual auth response (cookie + body)      |
| `backend/src/nest/auth/auth.service.ts`    | Accept refresh token from header        |

### Backend (New — Push Notifications)

| File                                          | Purpose                     |
| --------------------------------------------- | --------------------------- |
| `database/migrations/{ts}_add-push-tokens.ts` | user_push_tokens table      |
| `backend/src/nest/push/push.module.ts`        | Push notification module    |
| `backend/src/nest/push/push.service.ts`       | FCM dispatch service        |
| `backend/src/nest/push/push.controller.ts`    | Token registration endpoint |
| `backend/src/nest/push/dto/`                  | Zod DTOs                    |

---

## Spec Deviations

| #   | Brainstorming Says              | Actual Decision               | Reason                                                                             |
| --- | ------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| D1  | "1:1 Feature Parity"            | Core features first, not 100% | Some features (e.g., E2E encryption key exchange) need mobile-specific crypto work |
| D2  | "Offline read access — Pflicht" | Phased: P0/P1 data first      | Full offline for all 19+ addons is scope creep — start with core pages             |
| D3  | "iOS nachziehen"                | Out of scope for this plan    | This masterplan is Android-only. iOS gets its own plan when Mac is available       |

---

## Known Limitations (V1 — Intentionally Excluded)

1. **iOS build** — No Mac available. Android only for V1. iOS masterplan later.
2. **Offline write operations** — V1 is read-only cache. Write-while-offline needs conflict resolution (complex, deferred).
3. **E2E encrypted chat on mobile** — Requires IndexedDB crypto key migration. Chat works, but E2E key setup needs separate session.
4. **Camera integration** — Capacitor Camera plugin not in V1. Use native file picker for uploads.
5. **NFC / Bluetooth** — No use case currently. Explicitly excluded.
6. **Automatic OTA updates** — V1 uses store updates only. Capacitor Live Update (Appflow) evaluated later.
7. **Tablet-optimized layout** — V1 targets phone form factor. Tablet works but isn't optimized.
8. **Widget (Android home screen)** — Out of scope.

---

## Post-Mortem (fill after completion)

### What went well

- {Punkt 1}
- {Punkt 2}

### What went poorly

- {Punkt 1 + how to avoid next time}
- {Punkt 2 + how to avoid next time}

### Metrics

| Metric                   | Planned | Actual |
| ------------------------ | ------- | ------ |
| Sessions                 | 18      |        |
| New frontend files       | ~10     |        |
| Changed frontend files   | ~8      |        |
| New backend files        | ~6      |        |
| Changed backend files    | ~3      |        |
| New dependencies         | ~12     |        |
| Migration files          | 1       |        |
| APK size                 | < 30 MB |        |
| Cold start time          | < 3s    |        |
| Google Play release date |         |        |

---

**This document is the execution plan. Each session starts here,
picks the next unchecked item, and marks it as done.**
