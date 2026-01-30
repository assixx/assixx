# Refactoring Plan: Unify fieldMapping.ts + fieldMapper.ts

> **Status:** Planned
> **Date:** 2026-01-30
> **Branch:** refactor/backend
> **Risk:** Medium (boolean behavior change, surveys recursion)

---

## Problem

Two files do the same job (snake_case <-> camelCase), different API, different behavior:

| Aspect          | `fieldMapping.ts`                          | `fieldMapper.ts`                                     |
| --------------- | ------------------------------------------ | ---------------------------------------------------- |
| **API**         | Named exports: `dbToApi()`, `apiToDb()`    | Object: `fieldMapper.dbToApi()`                      |
| **Imports**     | 9 files, ~25 call sites                    | 2 files, 5 call sites                                |
| **Recursion**   | NO (flat only)                             | YES (nested objects + arrays)                        |
| **Booleans**    | NO conversion (`is_verified: 1` stays `1`) | YES (`is_verified: 1` -> `true`, except `is_active`) |
| **Dates**       | Pass-through                               | `Date` -> `.toISOString()`                           |
| **Null safety** | NO (crashes on null input)                 | YES (returns null/undefined)                         |
| **Return type** | `Record<string, unknown>` (good)           | `unknown` (bad)                                      |
| **Dead code**   | `dbToApiEvent()` (unused)                  | `mapField()` (empty custom map)                      |

**Consequences of keeping both:**

- Bug-fix in one file = bug stays in the other
- `fieldMapping` doesn't convert booleans (violates TypeScript API standards)
- Developer confusion: which one to use?
- `surveys.service.ts` has 30+ lines of manual recursion because `fieldMapping` can't recurse

---

## Solution

1. Rewrite `fieldMapper.ts` with clean API (named exports, fix return type)
2. Migrate all 9 `fieldMapping.ts` consumers to `fieldMapper.ts`
3. Remove redundant manual boolean/date conversions
4. Delete `fieldMapping.ts`

---

## Audit: All Consumers

### fieldMapping.ts consumers (9 imports)

| #   | File                                                            | Call Sites | Data                      | Booleans                                          | Manual Recursion   | Risk                   |
| --- | --------------------------------------------------------------- | ---------- | ------------------------- | ------------------------------------------------- | ------------------ | ---------------------- |
| 1   | `kvp/kvp.service.ts:134`                                        | 1          | Flat categories           | NO                                                | NO                 | Low                    |
| 2   | `shifts/rotation-assignment.service.ts:46`                      | 1          | Flat joined row           | `is_active` (exempt)                              | NO                 | Low                    |
| 3   | `shifts/rotation-history.service.ts:88`                         | 1          | Flat joined row           | `is_active` (exempt)                              | NO                 | Low                    |
| 4   | `shifts/shifts.service.ts:334,499,563,754,1182,1424,1464`       | 7          | Flat + manual nested user | NO                                                | NO                 | Low                    |
| 5   | `blackboard/blackboard.helpers.ts:103`                          | 1          | Flat entry                | `is_confirmed` -> manual `Boolean()`              | NO                 | Low (remove redundant) |
| 6   | `blackboard/blackboard-confirmations.service.ts:145`            | 1          | Flat joined users         | `confirmed` (not `is_*` pattern)                  | NO                 | Low                    |
| 7   | `kvp/kvp.helpers.ts:38`                                         | 1          | Flat suggestion           | `is_confirmed`                                    | NO                 | Low (remove redundant) |
| 8   | `shifts/rotation-pattern.service.ts:62`                         | 1          | Flat + JSON field         | `is_active` (exempt, manual override)             | NO                 | Low                    |
| 9   | **`surveys/surveys.service.ts:707,716,727,747,1431,1888,1952`** | **7**      | **Multi-level nested**    | **`is_anonymous`, `is_mandatory`, `is_required`** | **YES (3 levels)** | **Medium**             |

### fieldMapper.ts consumers (2 imports, API change only)

| #   | File                                         | Call Sites | Risk                                                     |
| --- | -------------------------------------------- | ---------- | -------------------------------------------------------- |
| 10  | `users/users.service.ts:1054`                | 1          | Low (API change: `fieldMapper.dbToApi()` -> `dbToApi()`) |
| 11  | `reports/reports.service.ts:552,680,762,765` | 4          | Low (same API change)                                    |

### Dead code

| File                 | Function         | Status                                                                             |
| -------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `fieldMapping.ts:36` | `dbToApiEvent()` | DEAD -- calendar uses its own typed version in `calendar.helpers.ts`               |
| `fieldMapper.ts:107` | `mapField()`     | DEAD -- `customMappings` is empty, does nothing beyond `camelCase()`/`snakeCase()` |

---

## Execution Steps

### Step 0: Rewrite `fieldMapper.ts`

**File:** `backend/src/utils/fieldMapper.ts`

**Changes:**

| Before                                           | After                                                   |
| ------------------------------------------------ | ------------------------------------------------------- |
| `export const fieldMapper = { dbToApi() {...} }` | `export function dbToApi(...): Record<string, unknown>` |
| `export const fieldMapper = { apiToDb() {...} }` | `export function apiToDb(...): Record<string, unknown>` |
| Return type `unknown`                            | Return type `Record<string, unknown>`                   |
| `this.dbToApi.bind(this)`                        | Direct function reference `dbToApi`                     |
| `mapField()` with empty map                      | DELETE                                                  |

**Keep:**

- Recursion (nested objects + arrays)
- Boolean conversion (`is_*`/`has_*` -> `Boolean()`, except `is_active`)
- Date handling (`Date` -> `.toISOString()`)
- Null safety (null/undefined input -> pass-through)

---

### Step 1: Migrate flat consumers (import path change only)

**Files:**

```
backend/src/nest/kvp/kvp.service.ts
backend/src/nest/shifts/rotation-assignment.service.ts
backend/src/nest/shifts/rotation-history.service.ts
backend/src/nest/shifts/shifts.service.ts
```

**Change per file:**

```typescript
// BEFORE
import { dbToApi } from '../../utils/fieldMapping.js';
// or
import { apiToDb, dbToApi } from '../../utils/fieldMapping.js';

// AFTER
import { dbToApi } from '../../utils/fieldMapper.js';
// or
import { apiToDb, dbToApi } from '../../utils/fieldMapper.js';
```

No other changes needed. Data is flat, no boolean fields in play (or `is_active` which is exempt).

---

### Step 2: Migrate boolean consumers (import + remove redundant manual conversions)

#### 2a. `blackboard/blackboard.helpers.ts`

**Lines 103-124:** `transformEntry()` has redundant manual boolean/date handling.

```typescript
// REMOVE these lines (fieldMapper handles automatically):
transformed['isConfirmed'] = Boolean(entry.is_confirmed);
transformed['confirmedAt'] = entry.confirmed_at?.toISOString() ?? null;
transformed['firstSeenAt'] = entry.first_seen_at?.toISOString() ?? null;
delete transformed['is_confirmed']; // no-op after dbToApi
delete transformed['confirmed_at']; // no-op
delete transformed['first_seen_at']; // no-op
```

#### 2b. `blackboard/blackboard-confirmations.service.ts`

**Line 145:** Maps flat user rows. The `confirmed` field does NOT match `is_*`/`has_*` pattern, so fieldMapper does NOT auto-convert. **Import change only.**

#### 2c. `kvp/kvp.helpers.ts`

**Line 38:** `dbToApi(suggestion)`. Has `is_confirmed` from LEFT JOIN. fieldMapper auto-converts to boolean. Check for manual `Boolean()` after -- if present, remove.

#### 2d. `shifts/rotation-pattern.service.ts`

**Lines 62-70:** Manual overrides for `isActive`, `startsAt`, `endsAt` after dbToApi. These overrides are CORRECT and should stay:

- `is_active` is exempt from auto-conversion (multi-state integer)
- Dates use custom `formatDate()` method, not ISO

**Import change only.** Manual overrides keep working (they overwrite spread).

---

### Step 3: Migrate surveys (medium risk)

**File:** `backend/src/nest/surveys/surveys.service.ts`

**Current manual recursion (lines 707-748):**

```
Level 1: dbToApi(survey)           -- flat survey row
Level 2: dbToApi(question)         -- inside .map() on questions array
Level 3: dbToApi(option)           -- inside .map() on options array
```

**After migration:**

Determine whether `survey` at line 707 already contains nested `questions`/`options`:

- **If YES (assembled before line 707):** One `dbToApi(survey)` call handles everything. Remove manual `.map()` recursion (lines 714-748). Major simplification.
- **If NO (questions added after):** Keep `.map()` structure, just change import. Each `dbToApi(question)` now auto-recurses into its own nested data.

**Boolean fields change:** `is_anonymous: 1` -> `isAnonymous: true`, `is_mandatory: 1` -> `isMandatory: true`, `is_required: 1` -> `isRequired: true`. This is CORRECT per TypeScript API standards.

**Verification:** Run `pnpm run test:api:full` -- surveys module has Bruno tests.

---

### Step 4: Migrate existing fieldMapper.ts consumers (API change)

**Files:**

```
backend/src/nest/users/users.service.ts
backend/src/nest/reports/reports.service.ts
```

**Change per call site:**

```typescript
// BEFORE
import { fieldMapper } from '../../utils/fieldMapper.js';
// AFTER
import { dbToApi } from '../../utils/fieldMapper.js';

fieldMapper.dbToApi(obj);

dbToApi(obj);
```

5 call sites across 2 files.

---

### Step 5: Delete `fieldMapping.ts`

```bash
rm backend/src/utils/fieldMapping.ts
```

**Verify no remaining references:**

```bash
grep -r "fieldMapping" backend/src/
```

---

### Step 6: Verify

```bash
# Type check
docker exec assixx-backend pnpm run type-check

# Lint
cd /home/scs/projects/Assixx && docker exec assixx-backend pnpm exec eslint backend/src

# API tests (covers surveys, blackboard, kvp, shifts, users)
pnpm run test:api:full
```

---

## Execution Order Summary

```
Step 0: Rewrite fieldMapper.ts (named exports, fix types, delete mapField)
Step 1: Migrate 4 flat consumers (import path change)
Step 2: Migrate 4 boolean consumers (import + remove redundant manual code)
Step 3: Migrate surveys.service.ts (import + simplify recursion)
Step 4: Migrate 2 existing fieldMapper consumers (API change)
Step 5: Delete fieldMapping.ts
Step 6: Type-check + lint + test
```

**Total files touched:** 12 (1 rewrite, 10 import changes, 1 delete)

---

## Risk Matrix

| Risk                                        | Affected                 | Mitigation                                                          |
| ------------------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| Boolean values change `0/1` -> `true/false` | blackboard, kvp, surveys | CORRECT per TypeScript standards. Verify frontend.                  |
| Dates change `Date` -> ISO string           | blackboard.helpers.ts    | Already manually calling `.toISOString()` -- fieldMapper automates. |
| Surveys double-conversion                   | surveys.service.ts       | Read code to determine data structure. Test with Bruno.             |
| `is_active` accidentally becomes boolean    | All                      | `shouldConvertToBoolean()` exempts `is_active`. Safe.               |
| `confirmed` (no `is_` prefix) auto-converts | blackboard-confirmations | Does NOT match `is_*`/`has_*` pattern. Not converted. Safe.         |

---

## Files Reference

```
REWRITE:  backend/src/utils/fieldMapper.ts
DELETE:   backend/src/utils/fieldMapping.ts

MIGRATE:
  backend/src/nest/kvp/kvp.service.ts
  backend/src/nest/kvp/kvp.helpers.ts
  backend/src/nest/shifts/rotation-assignment.service.ts
  backend/src/nest/shifts/rotation-history.service.ts
  backend/src/nest/shifts/rotation-pattern.service.ts
  backend/src/nest/shifts/shifts.service.ts
  backend/src/nest/blackboard/blackboard.helpers.ts
  backend/src/nest/blackboard/blackboard-confirmations.service.ts
  backend/src/nest/surveys/surveys.service.ts
  backend/src/nest/users/users.service.ts
  backend/src/nest/reports/reports.service.ts
```
