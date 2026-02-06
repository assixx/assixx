# Assixx Cleanup Plan

**Created:** 2026-02-05 | **Completed:** 2026-02-05 | **Status:** DONE - All Phases Executed
**Verification:** All findings double-checked with full-repo grep. False positives removed.
**Result:** Phase 1-4 executed as planned. Phase 5 executed with corrections (27 barrels deleted, 36 kept — original estimate of ~60 unused was wrong).

---

## Overview

Strategic cleanup of confirmed dead code, unused dependencies, and orphaned files.
Every item below survived a two-pass verification (initial scan + independent re-verification).

### Corrections from Verification

| Original Finding                       | Correction                              | Reason                                                                              |
| -------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| `pg-cursor` unused                     | **REMOVED FROM PLAN**                   | Actively used in `unified-logs.service.ts` for cursor-based log streaming (ADR-009) |
| `getTokenExpiryTime` dead              | **REMOVED FROM PLAN**                   | Has unit test coverage in `jwt-utils.test.ts`                                       |
| `getStrengthLabel` remove export       | **CHANGED TO: remove from barrel only** | Used in `password-strength.test.ts` - needs `export` for testability                |
| `getStrengthColor` remove export       | **CHANGED TO: remove from barrel only** | Used in `password-strength.test.ts`                                                 |
| `getStrengthClass` remove export       | **CHANGED TO: remove from barrel only** | Used in `password-strength.test.ts`                                                 |
| `formatCrackTime` remove export        | **CHANGED TO: remove from barrel only** | Used in `password-strength.test.ts`                                                 |
| `DbConnection` remove export           | **CHANGED TO: DELETE entirely**         | Not used even within its own file                                                   |
| `generateTempEmployeeId` remove export | **CHANGED TO: DELETE entirely**         | Never called anywhere                                                               |

---

## Phase 1: Remove Unused NPM Dependencies (HIGH IMPACT, LOW RISK)

**Why first:** Reduces install time, bundle size, and attack surface. Zero code changes needed.

| #   | Package             | Version | File                   | Proof                                                                                                   | Action        |
| --- | ------------------- | ------- | ---------------------- | ------------------------------------------------------------------------------------------------------- | ------------- |
| 1.1 | `class-transformer` | 0.5.1   | `backend/package.json` | 0 imports in entire repo. Project uses Zod, not class-validator. Also in `knip.json` ignoreDependencies | `pnpm remove` |
| 1.2 | `pino-roll`         | 4.0.0   | `backend/package.json` | 0 imports. Logging uses pino-loki + pino-pretty. Also in `knip.json` ignoreDependencies                 | `pnpm remove` |
| 1.3 | `@nestjs/swagger`   | 11.2.6  | `backend/package.json` | 0 imports, no Swagger decorators, no OpenAPI setup                                                      | `pnpm remove` |

**Also clean up:** Remove `class-transformer` and `pino-roll` from `knip.json` `ignoreDependencies` list (they were listed there to suppress warnings - once removed from package.json, remove from knip.json too).

**Definition of Done:**

- [ ] All 3 packages removed from backend/package.json
- [ ] `class-transformer` and `pino-roll` removed from knip.json ignoreDependencies
- [ ] `pnpm install` succeeds in docker
- [ ] `docker exec assixx-backend pnpm run type-check` passes
- [ ] Backend starts without errors

---

## Phase 2: Delete Orphaned Backup Files (LOW IMPACT, ZERO RISK)

| #   | File                                                                     | Size  | Proof                                                                                            | Action |
| --- | ------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------ | ------ |
| 2.1 | `frontend/src/routes/(app)/(shared)/documents-explorer/+page.svelte.bak` | 30KB  | Current `+page.svelte` exists (16KB, newer). `.bak` excluded in tsconfig + eslint. 0 references. | DELETE |
| 2.2 | `database/migrations/archive/template.ts.bak`                            | 2.3KB | In archive dir, `.bak` extension. 0 references. Not processed by migration runner.               | DELETE |

**Definition of Done:**

- [ ] Both .bak files deleted
- [ ] No broken imports (verified: neither file is imported anywhere)

---

## Phase 3: Clean Dead Frontend Exports (MEDIUM IMPACT, LOW RISK)

### 3A: Completely Unused Functions (DELETE)

| #   | Function                    | File                                          | Proof                                                                                         | Action                                             |
| --- | --------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 3.1 | `containsDangerousHtml`     | `frontend/src/lib/utils/sanitize-html.ts`     | 0 imports across entire repo (no tests, no components, no barrel usage)                       | DELETE function + remove from barrel               |
| 3.2 | `isPasswordStrengthLoading` | `frontend/src/lib/utils/password-strength.ts` | 0 usage anywhere (not even internally)                                                        | DELETE function + remove from barrel               |
| 3.3 | `isPasswordStrengthReady`   | `frontend/src/lib/utils/password-strength.ts` | 0 real usage (only in outdated `PASSWORD-VALIDATION-SYSTEM.md` referencing non-existent file) | DELETE function + remove from barrel + update docs |

### 3B: Dead Exports - Remove `export` keyword (keep function)

| #   | Function                | File                                          | Proof                                                                            | Action                                       |
| --- | ----------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| 3.4 | `getCachedUser`         | `frontend/src/lib/utils/user-service.ts`      | 0 imports. Not in barrel. Never called.                                          | Remove `export` keyword                      |
| 3.5 | `getCachedTenant`       | `frontend/src/lib/utils/user-service.ts`      | 0 imports. Not in barrel. Never called.                                          | Remove `export` keyword                      |
| 3.6 | `initPasswordStrength`  | `frontend/src/lib/utils/password-strength.ts` | Only called internally by `checkPasswordStrength`. 0 external imports. No tests. | Remove `export` keyword + remove from barrel |
| 3.7 | `checkPasswordStrength` | `frontend/src/lib/utils/password-strength.ts` | Only called internally by `analyzePassword`. 0 external imports. No tests.       | Remove `export` keyword + remove from barrel |

### 3C: Over-exported Functions - Remove from barrel only (keep `export` for tests)

These are used internally by `analyzePassword()` AND have unit test coverage in `password-strength.test.ts`. Keep `export` keyword (tests import directly from file), but remove from barrel `index.ts`.

| #    | Function           | File                   | Test File                            | Action                  |
| ---- | ------------------ | ---------------------- | ------------------------------------ | ----------------------- |
| 3.8  | `getStrengthLabel` | `password-strength.ts` | `password-strength.test.ts:24,28-34` | Remove from barrel only |
| 3.9  | `getStrengthColor` | `password-strength.ts` | `password-strength.test.ts:23,37-40` | Remove from barrel only |
| 3.10 | `getStrengthClass` | `password-strength.ts` | `password-strength.test.ts:22,43-46` | Remove from barrel only |
| 3.11 | `formatCrackTime`  | `password-strength.ts` | `password-strength.test.ts:21,49-51` | Remove from barrel only |

### 3D: Update Barrel File (`frontend/src/lib/utils/index.ts`)

Remove re-exports for:

- `containsDangerousHtml` (line 76)
- `initPasswordStrength` (line 84)
- `checkPasswordStrength` (line 85)
- `isPasswordStrengthLoading` (line 91)
- `isPasswordStrengthReady` (line 92)
- `getStrengthLabel` (line 87)
- `getStrengthColor` (line 88)
- `getStrengthClass` (line 89)
- `formatCrackTime` (line 90)

**Keep in barrel:** `analyzePassword` (externally used by 3 profile pages)

### 3E: Update Documentation

- Update `docs/PASSWORD-VALIDATION-SYSTEM.md`: Remove references to deleted functions and non-existent `password-strength-integration.ts`

**Definition of Done:**

- [ ] 3 functions deleted entirely (3.1-3.3)
- [ ] `export` removed from 4 functions (3.4-3.7)
- [ ] 9 re-exports removed from barrel file (3D)
- [ ] 4 functions keep `export` but removed from barrel (3.8-3.11)
- [ ] Documentation updated (3E)
- [ ] `cd frontend && pnpm run lint` passes
- [ ] `cd frontend && pnpm run check` passes (svelte-check)
- [ ] `pnpm test --project frontend-unit` passes (19 tests)
- [ ] Frontend loads without errors on localhost:5173

---

## Phase 4: Clean Dead Backend Exports (MEDIUM IMPACT, LOW RISK)

### 4A: DELETE Entirely (not used anywhere, not even internally)

| #   | Export                            | File                                                     | Proof                                                                              | Action                  |
| --- | --------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| 4.1 | `DbConnection` interface          | `backend/src/utils/dbWrapper.ts`                         | 0 imports AND 0 internal usage. `ConnectionWrapper` uses `PoolConnection` instead. | DELETE interface        |
| 4.2 | `generateTempEmployeeId` function | `backend/src/utils/employeeIdGenerator.ts` (lines 52-70) | 0 calls anywhere in entire repo                                                    | DELETE function + JSDoc |

### 4B: Remove `export` keyword (used internally, not imported)

| #   | Export                                  | File                                | Proof                                                                                                         | Action                  |
| --- | --------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 4.3 | `FieldPacket` interface                 | `backend/src/utils/db.ts`           | Used internally 9x as type annotation. 0 external imports.                                                    | Remove `export` keyword |
| 4.4 | `RLSContextOptions` interface           | `backend/src/utils/db.ts`           | Used internally 1x (transaction function signature). 0 external imports.                                      | Remove `export` keyword |
| 4.5 | `checkTenantFeatureAccess` named export | `backend/src/utils/featureCheck.ts` | Used via default export object only (`FeatureCheck.checkTenantAccess`). Named export never directly imported. | Remove `export` keyword |
| 4.6 | `logFeatureUsage` named export          | `backend/src/utils/featureCheck.ts` | Used via default export object only (`FeatureCheck.logUsage`). Named export never directly imported.          | Remove `export` keyword |

### 4C: Update Documentation

- Update `backend/docs/TYPESCRIPT-DB-UTILITIES.md` lines 132-154: Remove `FieldPacket` and `RLSContextOptions` from "Available imports" section (misleading - they're now internal-only)

**Definition of Done:**

- [ ] 2 items deleted entirely (4.1-4.2)
- [ ] 4 `export` keywords removed (4.3-4.6)
- [ ] Documentation updated (4C)
- [ ] `docker exec assixx-backend pnpm run type-check` passes
- [ ] `docker exec assixx-backend pnpm exec eslint backend/src` passes
- [ ] `pnpm test --project unit` passes (345 tests)
- [ ] Backend starts without errors

---

## Phase 5: Unused Barrel Files (LOW IMPACT, DEFERRED)

~60 barrel files (`index.ts`) in `backend/src/nest/*/` that are never imported via barrel path.

**Status:** DEFERRED - Requires separate decision. These are harmless (no runtime impact) but add file noise. Removing them is a larger refactor that should be its own task.

**Exceptions (KEEP):**

- `backend/src/nest/common/index.ts` - IS used
- `backend/src/nest/config/index.ts` - IS used (by role-switch.module.ts)

---

## Execution Order

```
Phase 1 (npm deps)     → lowest risk, highest value, 3 packages
Phase 2 (backup files) → zero risk, 2 files
Phase 3 (frontend)     → medium risk, verify with lint + check + tests
Phase 4 (backend)      → medium risk, verify with type-check + lint + tests
Phase 5 (barrels)      → DEFERRED for separate discussion
```

---

## Rollback Strategy

All changes are individually reversible. If any phase breaks something:

1. Revert the specific file change
2. Run verification commands again
3. Investigate root cause before retrying

---

## Verification Status

| Finding          | Verified | Method                                                   | Result                                                                                                |
| ---------------- | -------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Phase 1 deps     | VERIFIED | grep for import/require + decorators + config refs       | 1 false positive found (`pg-cursor` is active). 3 confirmed unused.                                   |
| Phase 2 files    | VERIFIED | grep for .bak references + confirm active versions exist | Both safe to delete. `.bak` excluded in tsconfig + eslint.                                            |
| Phase 3 frontend | VERIFIED | grep each function across entire repo including tests    | 1 false positive (`getTokenExpiryTime` has tests). 4 functions need `export` for tests. 3 truly dead. |
| Phase 4 backend  | VERIFIED | grep each export across entire repo                      | All confirmed. 2 can be fully deleted, 4 need export removal only. Doc update needed.                 |

---

## Impact Summary

| Category                        | Items                 | Risk    | Effort      |
| ------------------------------- | --------------------- | ------- | ----------- |
| Unused npm deps removed         | 3                     | LOW     | 5 min       |
| Backup files deleted            | 2                     | ZERO    | 1 min       |
| Dead frontend functions deleted | 3                     | LOW     | 10 min      |
| Frontend exports cleaned        | 4 + 4 barrel removals | LOW     | 15 min      |
| Dead backend code deleted       | 2                     | LOW     | 5 min       |
| Backend exports cleaned         | 4                     | LOW     | 10 min      |
| Docs updated                    | 2 files               | ZERO    | 5 min       |
| **Total**                       | **22 items**          | **LOW** | **~50 min** |
