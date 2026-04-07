# ADR-041: TypeScript Compiler Configuration & Strict-Everywhere Policy

| Metadata                | Value                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| **Status**              | Accepted                                                                |
| **Date**                | 2026-04-07                                                              |
| **Decision Makers**     | Simon Öztürk                                                            |
| **Affected Components** | `tsconfig.base.json`, `backend/tsconfig*.json`, `shared/tsconfig*.json` |

---

## Context

A configuration audit on 2026-04-07 surfaced two production-impacting issues
in the project's TypeScript setup, plus several low-risk hardening
opportunities. The audit was triggered while evaluating a TypeScript
5.9.3 → 6.0.2 upgrade and reviewing the related NestJS ecosystem state
(`nestjs/nest` PRs [#16626](https://github.com/nestjs/nest/pull/16626),
[#16669](https://github.com/nestjs/nest/pull/16669), and the silent-build
regression [`nest-cli` #3312](https://github.com/nestjs/nest-cli/issues/3312)).

### Audit Findings

1. **`backend/tsconfig.build.json` disabled every strict flag**
   The production build config explicitly set `strict: false`,
   `noImplicitAny: false`, `strictNullChecks: false`,
   `strictPropertyInitialization: false`, `noPropertyAccessFromIndexSignature: false`,
   `noUncheckedIndexedAccess: false`, and `exactOptionalPropertyTypes: false`.
   Result: `pnpm run build:ts` (which uses this file) emitted JavaScript
   without strict type checking. The only safety net was the separate
   `pnpm run type-check` script — convention only, not enforcement.

   Verification: running `pnpm exec tsc --noEmit -p backend` (strict) and
   `pnpm exec tsc --noEmit -p backend/tsconfig.build.json` (strict, after
   the fix) both returned exit 0 with zero output. The strict-disable was
   hiding **nothing** — it was pure config drift.

2. **Dead `baseUrl` + `paths` aliases pointing at non-existent directories**
   `backend/tsconfig.json` declared `baseUrl: "./src"` and seven path
   aliases (`@controllers/*`, `@models/*`, `@middleware/*`, `@services/*`,
   `@utils/*`, `@types/*`, `@/*`).
   - **Zero usage** anywhere in the codebase (verified via `grep` across
     `backend/`).
   - **Four of the targeted directories don't even exist**: `controllers/`,
     `models/`, `middleware/`, `services/` — leftovers from a pre-NestJS
     Express era.
   - **No runtime resolver** (no `tsc-alias`, `tsconfig-paths`, or similar)
     in `package.json`, so even if someone tried to use them, the
     compiled output would fail at runtime.
   - **`baseUrl` is deprecated in TypeScript 6.0** ([microsoft/TypeScript
     Issue #62207](https://github.com/microsoft/TypeScript/issues/62207))
     and will become a hard error in TS 7.0. The same deprecation already
     affects the official NestJS starter template
     ([nestjs/nest #15883](https://github.com/nestjs/nest/issues/15883)).

3. **TypeScript 5.6+ added new opt-in strict flags** that the project
   was not yet leveraging:
   - `noUncheckedSideEffectImports` (TS 5.6)
   - `strictBuiltinIteratorReturn` (TS 5.6)
   - `verbatimModuleSyntax` (TS 5.0, but never adopted)

4. **Stale `lib: ["ES2022"]`** despite `engines.node >= 24.14.0`. Node 24
   natively ships ES2024 APIs (`Object.groupBy`, `Promise.withResolvers`,
   `Array.fromAsync`, `Atomics.waitAsync`, etc.) that TypeScript was not
   surfacing in IntelliSense.

5. **Inconsistent `nodenext`/`NodeNext` casing** across configs (cosmetic,
   but a tell-tale sign of copy-paste drift).

### Constraint from Project Owner

> "Unsere bestehende Strictness darf nicht weniger werden, höchstens stricter."

Translation: any change must preserve or increase strictness. Weakening
is forbidden, even temporarily.

---

## Decision

### 1. Strict-Everywhere Policy

**`backend/tsconfig.build.json` MUST inherit and never override any strict
flag set in `tsconfig.base.json` or `backend/tsconfig.json`.**

The build config now extends `./tsconfig.json` and sets only
production-specific overrides (declaration map suppression, expanded
exclude patterns). All strict checking from the base inheritance chain
applies to production builds.

```jsonc
// backend/tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declarationMap": false, // smaller dist
  },
  "exclude": [
    /* test files, v1 routes, mocks */
  ],
}
```

**Rule (binding):** any future PR that touches `backend/tsconfig.build.json`
must not introduce a `compilerOptions` entry that weakens a strict flag.
Reviewer must reject such PRs.

### 2. Removal of `baseUrl` and `paths`

Both removed from `backend/tsconfig.json` because:

- They are completely unused.
- Their target directories don't exist.
- `baseUrl` is deprecated in TS 6.0 (will fail in TS 7.0).
- Removal is a no-op for compilation correctness (verified by full
  type-check).

This decouples the project from the upcoming TS 7.0 hard-deprecation and
removes a dishonest signal in the config (aliases that suggest
"organize your code into these folders" when nothing actually uses them).

### 3. New Strict Flags Added (`tsconfig.base.json`)

Verified safe (full type-check passes after each):

| Flag                           | TS Version | What it does                                                        |
| ------------------------------ | ---------- | ------------------------------------------------------------------- |
| `noUncheckedSideEffectImports` | 5.6+       | Errors on `import "./missing-file"` typos                           |
| `strictBuiltinIteratorReturn`  | 5.6+       | `Map`/`Set`/`Array` iterators return `IteratorResult<T, undefined>` |

Both produce zero errors against the current codebase. They are pure
strictness gains with no semantic impact.

### 4. `lib: ["ES2024"]` (was `ES2022`)

Upgraded in `tsconfig.base.json` and `backend/tsconfig.json`. Justification:

- `engines.node >= 24.14.0` already requires Node 24, which natively
  ships ES2024 features.
- `target` stays at `ES2022` — emit semantics are unchanged. Only the
  type-checking surface gets the newer APIs (`Object.groupBy`,
  `Promise.withResolvers`, `Array.fromAsync`, regex `v` flag, etc.).
- Frontend (`frontend/tsconfig.json`) extends `.svelte-kit/tsconfig.json`
  which is auto-generated; it does not pick up base lib changes and is
  unaffected.

### 5. Casing Normalization

All `module` and `moduleResolution` values normalized to lowercase
`"nodenext"` (matches the official NestJS template). Functionally
identical to PascalCase, but reduces copy-paste drift.

### 6. `verbatimModuleSyntax` — Deferred (Open Item)

Enabling `verbatimModuleSyntax: true` produces **41 `TS1484` errors**
across **30+ files** in the NestJS backend. The errors are uniformly the
same pattern: type-only NestJS interfaces (`OnModuleInit`, `CanActivate`,
`ExecutionContext`, `NestInterceptor`, `CallHandler`, `PipeTransform`,
`ExceptionFilter`, `ArgumentsHost`, `NestFastifyApplication`,
`ThrottlerLimitDetail`) imported via runtime `import { X }` syntax instead
of `import type { X }`.

These are mechanical, non-semantic fixes. They are tracked as a follow-up
refactor (see "Open Items"). The flag is intentionally **not** set in
this ADR's scope.

### 7. `useDefineForClassFields` — Not Set (Decision: Default)

Initially considered setting `useDefineForClassFields: false` for
NestJS-safety. After verification:

- The official NestJS starter template
  ([nestjs/typescript-starter](https://github.com/nestjs/typescript-starter/blob/master/tsconfig.json))
  does **not** set this flag and uses `target: "ES2023"`, which makes the
  default `true`.
- Assixx uses `target: "ES2022"`, which also makes the default `true`.
- The codebase compiles cleanly with the default. Constructor injection
  (the canonical NestJS DI pattern, used throughout Assixx) is unaffected
  by this flag.
- Property injection patterns (`@Inject(TOKEN) private readonly x: T`)
  also work because the metadata is generated from the type annotation,
  not the field initializer.

Setting it explicitly would be cargo-culting. **Decision: leave at default
(implicit `true`).**

---

## Alternatives Considered

### Alt 1: Keep the strict-disabled `tsconfig.build.json`

**Rejected.** No measurable benefit (strict mode does not slow tsc emit),
and it creates a real risk of broken code reaching production if a dev
runs `pnpm run build` without first running `pnpm run type-check`.

### Alt 2: Migrate path aliases to a runtime resolver (`tsc-alias`)

**Rejected.** Would add a new dependency, a build-time codegen step, and
zero current usage justifies it. NestJS DI already gives us what aliases
were originally meant to provide (decoupled module references).

### Alt 3: Enable `verbatimModuleSyntax` in this ADR by also fixing all

41 imports atomically

**Rejected for this ADR's scope.** A 30+-file mechanical refactor warrants
its own PR + commit so the diff is reviewable and the strict-flag enable is
isolated from the import-style refactor. Tracked as Open Item below.

### Alt 4: Enable `isolatedDeclarations: true` (TS 5.5+)

**Rejected.** Would require explicit return type annotations on every
exported member of every exported object literal. Estimated impact:
hundreds to thousands of new errors. Not worth the cost; the existing
`@typescript-eslint/explicit-function-return-type` lint rule already
enforces explicit returns at function level.

### Alt 5: Bump `target` to `ES2023` to match the NestJS starter template

**Rejected for this ADR's scope.** Bumping `target` changes the actual
emitted JavaScript (ES2023 adds `Array.findLast`, `Array.findLastIndex`,
etc., as native syntax instead of polyfills). It is safe for Node 24, but
crosses a different boundary than the type-checking changes in this ADR.
Tracked as a separate evaluation.

---

## Consequences

### Positive

- Production builds (`pnpm run build:ts`) now enforce the same strict
  type-checking as the dev type-check. No more drift risk.
- TypeScript 6.0 upgrade path is unblocked (no `baseUrl` deprecation
  blocker).
- Two new TS 5.6 strict flags catch additional bug classes at compile
  time.
- IntelliSense surfaces ES2024 APIs that Node 24 already supports
  natively.
- The "stricter never weaker" rule is now codified and reviewable.

### Negative

- `verbatimModuleSyntax` is still off, so type-only imports may still be
  written as runtime imports. Caught only by the (separate) typescript-eslint
  rule `consistent-type-imports`, which is enabled in `frontend/eslint.config.mjs`
  but not in the root config that covers `backend/`.
- ESLint coverage between frontend and backend remains uneven.

### Neutral

- The audit also confirmed that several existing **strengths** are
  intentional and should not be changed:
  - `composite: true` + `incremental: true` for project references
  - Direct `tsc` invocation (no `nest build` wrapper) — protects against
    [`nest-cli` #3312](https://github.com/nestjs/nest-cli/issues/3312) and
    similar wrapper-level regressions.
  - Modern conditional exports in `shared/package.json`
    (per [ADR-015](./ADR-015-shared-package-architecture.md))
  - All NASA Power-of-Ten strict flags already enabled (`exactOptionalPropertyTypes`,
    `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`,
    `useUnknownInCatchVariables`, `noImplicitOverride`)

---

## Related Fix (2026-04-07): Build Tooling Pre-Step Discipline

After this ADR's primary changes were applied, running `pnpm run validate:all`
surfaced three cascading errors that all traced to the **same root cause**:

```
ESLint Frontend → "EslintPluginImportResolveError: typescript with invalid interface loaded as resolver"
TypeScript Check → "Cannot read file '.../frontend/.svelte-kit/tsconfig.json'"
TypeScript Check → "TS5095: Option 'bundler' can only be used when 'module' is set to 'preserve' or to 'es2015' or later"
```

### Root Cause

`frontend/tsconfig.json` extends `./.svelte-kit/tsconfig.json` — an auto-generated
file produced by `svelte-kit sync`. When the file is missing (fresh checkout,
post-`pnpm install`, after a clean), every frontend tooling command fails:

- `tsc --noEmit -p frontend` → cannot read parent tsconfig (TS5083)
- `eslint .` (in frontend) → `eslint-import-resolver-typescript` v4.4.4 invokes
  the TypeScript program loader, which fails because the parent tsconfig is
  missing — `eslint-plugin-import-x` reports it as
  "typescript with invalid interface loaded as resolver"
- The `bundler` resolution mode fails because the parent (which would have set
  `module`) is missing

The previous `validate:all` script ran `svelte-kit sync` only inside step 6
(`svelte check`) — **after** lint and type-check had already failed.
**Race condition.**

### Reproduction (verified)

```bash
mv frontend/.svelte-kit/tsconfig.json frontend/.svelte-kit/tsconfig.json.bak
cd frontend && pnpm exec eslint src/routes/\(app\)/\(shared\)/shifts/_lib/state-shifts.svelte.ts
# → Same Resolve error, same stack trace as the user's validate:all output
mv frontend/.svelte-kit/tsconfig.json.bak frontend/.svelte-kit/tsconfig.json
```

### Fix

Added `sync:svelte` script and made it a mandatory pre-step for every script
that touches frontend tooling chains:

```jsonc
// package.json
{
  "scripts": {
    "sync:svelte": "cd frontend && pnpm exec svelte-kit sync",
    "type-check": "pnpm run sync:svelte && tsc --noEmit -p shared && tsc --noEmit -p frontend && tsc --noEmit -p backend && tsc --noEmit -p backend/test",
    "check": "pnpm run sync:svelte && tsc --noEmit -p frontend && tsc --noEmit -p backend",
    "lint:frontend": "pnpm run sync:svelte && cd frontend && NODE_OPTIONS='--max-old-space-size=8192' eslint .",
    "lint:frontend:fix": "pnpm run sync:svelte && cd frontend && NODE_OPTIONS='--max-old-space-size=8192' eslint . --fix",
  },
}
```

**Why inline `&&` and not `pre*` hooks:** pnpm v9+ disables auto pre/post
hooks for non-standard npm lifecycle scripts by default
(`enable-pre-post-scripts=false`). Inline chaining is guaranteed to work
without changing `.npmrc`.

### Verification

```
pnpm run validate:all → === VALIDATE ALL PASSED ===
```

### Rule (binding)

**Any script that invokes `tsc -p frontend`, `eslint` inside `frontend/`, or
`vite` outside of dev mode MUST be preceded by `pnpm run sync:svelte`** (or
inherit the pre-step transitively). Reviewers must reject PRs that add such
scripts without the sync prefix.

---

## Phase 2 Resolution (2026-04-08): Partial Type-Import Strictness

After the primary ADR was applied, the question of `verbatimModuleSyntax`
adoption was re-investigated. Goal: enforce explicit `import type` for
type-only imports across the backend.

### Lab Verification

Two paths were evaluated against the current codebase:

**Pfad A — `verbatimModuleSyntax: true` (TS compiler flag):**

- Test: temporarily set the flag in `tsconfig.base.json` and run `pnpm exec tsc --noEmit -p backend`
- Result: **41 `TS1484` errors** across **~30 files** in NestJS decorator-laden code (services, guards, interceptors, pipes, filters, registrars). Targets: `OnModuleInit`, `OnModuleDestroy`, `CanActivate`, `ExecutionContext`, `NestInterceptor`, `CallHandler`, `PipeTransform`, `ExceptionFilter`, `ArgumentsHost`, `ThrottlerLimitDetail`, `NestFastifyApplication`, `Transporter`, `SendMailOptions`, `Data`
- Resolution requires manual edit of all 30+ files

**Pfad B — `@typescript-eslint/consistent-type-imports` (ESLint rule):**

- Test: temporarily added the rule to the backend ESLint section, ran lint on `backend/src/`
- Result: **only 10 violations across 8 files** — far less than Pfad A
- Reason: per [typescript-eslint blog 2024-03-25](https://typescript-eslint.io/blog/changes-to-consistent-type-imports-with-decorators/), the rule **deliberately skips files with decorators** when both `experimentalDecorators` and `emitDecoratorMetadata` are enabled. NestJS controllers/services/guards/etc. are all decorator-bearing, so the rule silently bypasses them. There is no override option.
- Cross-verification:
  - `jwt-auth.guard.ts` (has `@Injectable()`, imports `CanActivate`/`ExecutionContext` as runtime values) → **0 ESLint reports**
  - `email-service.ts` (no decorators, imports `Transporter`/`SendMailOptions` as runtime values) → **1 ESLint error**

### Decision

**Pfad B for the 10 catchable violations now. Pfad A deferred.**

Rationale:

- Pfad B catches 10/41 = ~24% of the violations automatically and prevents future drift in non-decorator files (utils, workers, websocket, main.ts)
- Pfad A would require ~30 manual edits in mid-feature work on `feature/inventory` — high branch-pollution risk for marginal benefit (the JS emit is bit-for-bit identical, the only gain is theoretical bundler-readiness)
- The two paths are complementary, not exclusive: Pfad A can be added later when the decorator-file refactor is its own dedicated PR

### Phase 2 Changes Applied

1. Added `@typescript-eslint/consistent-type-imports` rule to backend section of root `eslint.config.mjs`
2. Manually fixed 3 inline `import('...').Type` annotations (not auto-fixable):
   - `nest/notifications/notifications.controller.ts:841` — `Subscriber` from `rxjs`
   - `nest/user-permissions/user-permissions.service.ts:226` — `OrganizationalScope` from sibling module
   - `nest/work-orders/work-orders-notification.service.ts:134` — `PoolClient` from `pg`
3. Auto-fixed 7 type-only imports via `pnpm run lint:fix`:
   - `nest/main.ts` — `NestFastifyApplication`
   - `utils/email-service.ts` — `SendMailOptions`, `Transporter`
   - `websocket-message-handler.ts` — entire import statement
   - `websocket.ts` — multiple imports including `WebSocketData`, `IncomingMessage`, `Server`
   - `workers/deletion-worker.ts` — entire import statement

### Verification

```
pnpm exec eslint backend/src                              → exit 0, 0 violations
pnpm exec tsc --noEmit -p shared                          → exit 0, 0 lines
pnpm exec tsc --noEmit -p backend                         → exit 0, 0 lines
pnpm exec tsc --noEmit -p backend/test                    → exit 0, 0 lines
pnpm exec tsc --noEmit -p frontend                        → exit 0, 0 lines
pnpm exec tsc --noEmit -p backend/tsconfig.build.json     → exit 0, 0 lines
pnpm run validate:all                                     → === VALIDATE ALL PASSED ===
```

### Anti-Pattern Eliminated

The 3 manually-fixed files contained inline `import('foo').Type` annotations
in parameter and type-alias positions. This pattern is harder to read
(reviewers must scan for `import()` patterns inline) and is now forbidden by
the rule's `disallowTypeAnnotations: true` default. All future code is
prevented from re-introducing it (in non-decorator files).

### Rule (binding)

**`@typescript-eslint/consistent-type-imports` is now active for backend +
shared source.** Type-only imports must use `import type` syntax (or inline
`type` modifier). The rule auto-fixes most violations via
`pnpm run lint:fix`. Files containing class decorators are exempted by
upstream rule logic — this is documented behavior, not a bug.

---

## Open Items (Tracked, Not in Scope)

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Effort  | Risk             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------- |
| ~~Add `@typescript-eslint/consistent-type-imports` to backend ESLint as alternative~~ — **DONE 2026-04-08** (Phase 2 Resolution above)                                                                                                                                                                                                                                                                                                                                                                                                                                                | —       | —                |
| Enable `verbatimModuleSyntax: true` in `tsconfig.base.json` — requires manual fix of ~38 type-only imports across ~30 NestJS decorator files (`OnModuleInit`, `CanActivate`, `ExecutionContext`, etc.). The ESLint rule cannot help here because it deliberately skips decorator-bearing files. Best done as an isolated PR on a dedicated branch. Code-quality benefit is mostly theoretical (future bundler migration to swc/esbuild). Can stay deferred until there's a concrete migration trigger.                                                                                | ~1 h    | Low (mechanical) |
| Re-evaluate `target: ES2023` bump (matches NestJS starter)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ~30 min | Low              |
| Re-evaluate `target: ES2024` (Node 24 native, no polyfills)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | ~30 min | Low              |
| `backend/test/tsconfig.json` relaxes `noPropertyAccessFromIndexSignature` — review if still needed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | ~15 min | Medium           |
| Extend `consistent-type-imports` rule to the backend test section (`backend/**/*.test.ts`, `backend/test/**/*.ts`) — currently rule is only in the strict src section. Test files would gain the same drift protection.                                                                                                                                                                                                                                                                                                                                                              | ~10 min | Low              |
| **`shared/dist/` build dependency for frontend dev** — Vite dev server fails to resolve `@assixx/shared/*` if `shared/dist/` is missing or stale (per [ADR-015](./ADR-015-shared-package-architecture.md) conditional exports). Currently self-heals via Vite cache invalidation but is fragile. Consider adding `build:shared` as a pre-step to `dev:svelte`/`build:frontend`.                                                                                                                                                                                                       | ~20 min | Medium           |

---

## Verification

Before applying changes:

```
pnpm exec tsc --noEmit -p shared        → exit 0
pnpm exec tsc --noEmit -p backend       → exit 0  (with strict)
pnpm exec tsc --noEmit -p backend/test  → exit 0
pnpm exec tsc --noEmit -p frontend      → exit 0
```

After applying changes (P0-1, P0-2, P2a, P3, +2 new strict flags):

```
pnpm exec tsc --noEmit -p shared                          → exit 0, 0 lines
pnpm exec tsc --noEmit -p backend                         → exit 0, 0 lines
pnpm exec tsc --noEmit -p backend/test                    → exit 0, 0 lines
pnpm exec tsc --noEmit -p frontend                        → exit 0, 0 lines
pnpm exec tsc --noEmit -p backend/tsconfig.build.json     → exit 0, 0 lines
```

After applying the Related Fix (svelte-kit sync pre-step):

```
pnpm run validate:all                                     → === VALIDATE ALL PASSED ===
```

The production build config now passes the **same** strict checks as the
dev type-check, and the full validation pipeline (format → lint → type-check
→ svelte-check → stylelint) succeeds end-to-end.

---

## References

- [TypeScript 5.6 Release Notes — `noUncheckedSideEffectImports`](https://devblogs.microsoft.com/typescript/announcing-typescript-5-6/)
- [TypeScript 5.6 Release Notes — `strictBuiltinIteratorReturn`](https://devblogs.microsoft.com/typescript/announcing-typescript-5-6/)
- [TypeScript 6.0 Announcement — deprecated flags](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [microsoft/TypeScript Issue #62207 — `baseUrl` deprecation](https://github.com/microsoft/TypeScript/issues/62207)
- [nestjs/nest Issue #15883 — `baseUrl` deprecation in NestJS template](https://github.com/nestjs/nest/issues/15883)
- [nestjs/nest PR #16626 — TypeScript v6 upgrade (open, CI failing)](https://github.com/nestjs/nest/pull/16626)
- [nestjs/nest PR #16669 — bump typescript 5.9.3 → 6.0.2 (open, CI failing)](https://github.com/nestjs/nest/pull/16669)
- [nestjs/nest-cli Issue #3312 — silent build failure with TS 6 + incremental (closed 2026-04-07)](https://github.com/nestjs/nest-cli/issues/3312)
- [nestjs/typescript-starter — official NestJS tsconfig template](https://github.com/nestjs/typescript-starter/blob/master/tsconfig.json)
- [docs/TYPESCRIPT-STANDARDS.md](../../TYPESCRIPT-STANDARDS.md) — code-level rules that complement this compiler config
- [ADR-015](./ADR-015-shared-package-architecture.md) — shared package conditional exports (related)
- [ADR-018](./ADR-018-testing-strategy.md) — testing strategy (test tsconfig context)
