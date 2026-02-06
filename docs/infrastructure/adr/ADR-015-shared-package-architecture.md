# ADR-015: Shared Package Architecture & Implementation Plan (`@assixx/shared`)

| Metadata                | Value                                                       |
| ----------------------- | ----------------------------------------------------------- |
| **Status**              | Accepted                                                    |
| **Date**                | 2026-01-30                                                  |
| **Decision Makers**     | SCS Technik                                                 |
| **Affected Components** | shared/, backend/, frontend/, Docker, pnpm workspace, CI/CD |

---

## Context

### Problem

Zero formal code sharing between frontend (SvelteKit) and backend (NestJS). Types, constants, and helpers were copy-pasted across both sides, leading to:

| Issue                         | Impact                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| `UserRole` in 7+ files        | Conflicting definitions (shifts adds `team_lead`, `manager`) |
| `IsActiveStatus` (0\|1\|3\|4) | Hardcoded in 50+ files, no central constant                  |
| `ApiResponse` 3 versions      | Incompatible shapes between frontend and backend             |
| `STATUS_LABELS` copy-pasted   | 8+ frontend route modules with identical code                |
| Date helpers                  | Exist only in frontend, backend duplicates logic             |

### Constraints

- **pnpm workspace** monorepo with `inject-workspace-packages=true` in `.npmrc`
- **Backend** uses `moduleResolution: "nodenext"` (requires `.js` extensions in imports)
- **Frontend** uses `moduleResolution: "bundler"` (SvelteKit)
- **Docker dev container** compiles with `tsc` then runs with `node` (not tsx) due to NestJS decorator metadata requirements
- **Docker production** runs with `tsx` (which handles `.ts` → `.js` resolution natively)

---

## Decision

### 1. Single shared package: `@assixx/shared`

Location: `/shared/` at workspace root. Pure TypeScript with a build step (`tsc`) to produce compiled `.js` for Node.js runtime.

### 2. Conditional exports in `package.json`

```json
{
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

| Condition | Resolves to       | Consumer                                  |
| --------- | ----------------- | ----------------------------------------- |
| `types`   | `./src/index.ts`  | TypeScript (full types, go-to-definition) |
| `import`  | `./dist/index.js` | Node.js ESM runtime                       |
| `default` | `./dist/index.js` | Fallback                                  |

**Rationale**: TypeScript gets raw `.ts` source for best DX (hover, go-to-definition). Node.js gets compiled `.js` for runtime, avoiding the Node 24 type-stripping limitation where `.js` extension imports inside `.ts` files fail because no actual `.js` files exist.

### 3. Internal imports use `.js` extensions

```typescript
// shared/src/index.ts
export { USER_ROLES } from './types/index.js';
```

**Rationale**: Required by `moduleResolution: "nodenext"`. TypeScript resolves `.js` → `.ts` at compile time. The compiled output contains actual `.js` files at the referenced paths.

### 4. Build step required (`tsc`)

```json
{
  "scripts": {
    "build": "tsc"
  }
}
```

**Rationale**: The original design avoided a build step ("raw `.ts` source consumed directly"). This failed in the Docker dev environment because:

1. `tsc` compiles backend → `dist/nest/main.js`
2. `node dist/nest/main.js` resolves `@assixx/shared` → `./src/index.ts`
3. Node 24 type-stripping loads `.ts` but can NOT resolve internal `.js` imports to `.ts` files
4. Crash: `ERR_MODULE_NOT_FOUND: Cannot find module '/app/shared/src/types/index.js'`

The build step produces real `.js` files that match the import paths.

### 5. UserRole conflict resolution

Two separate types coexist:

```typescript
type UserRole = 'root' | 'admin' | 'employee'; // System auth roles (DB)
type ExtendedUserRole = UserRole | 'team_lead' | 'manager'; // Domain-specific (shifts UI)
```

- Auth code imports `UserRole`
- Shifts module imports `ExtendedUserRole as UserRole` (local alias for backward compat)

### 6. Docker integration

All three Dockerfiles updated:

| Dockerfile            | Changes                                                       |
| --------------------- | ------------------------------------------------------------- |
| `Dockerfile.dev`      | COPY shared source before `pnpm install`, build shared in CMD |
| `Dockerfile`          | COPY shared in builder + production stages                    |
| `Dockerfile.frontend` | COPY shared source + `tsconfig.base.json` for Vite resolution |

`docker-compose.yml` dev service: bind-mount `../shared:/app/shared:delegated` and build shared before backend in CMD.

### 7. ESLint coverage

Root `eslint.config.mjs` extended: `shared/**/*.ts` added to the backend TypeScript config block. Same strict rules as backend (no separate config needed).

---

## Package Structure

```
shared/
  package.json          (@assixx/shared, private, type: module, conditional exports)
  tsconfig.json         (extends tsconfig.base.json, composite: true, NodeNext)
  src/
    index.ts            (barrel export - types, constants, helpers)
    types/
      index.ts          (barrel)
      user-role.ts      (UserRole, ExtendedUserRole, USER_ROLES)
      is-active-status.ts (IsActiveStatus, FormIsActiveStatus, StatusFilter)
      api-response.ts   (ApiSuccessResponse, ApiErrorResponse, ApiResponse)
      auth-user.ts      (BaseAuthUser - shared fields only)
      pagination.ts     (PaginationParams, PaginationMeta)
      availability.ts   (AvailabilityStatus, AVAILABILITY_STATUSES)
    constants/
      index.ts          (barrel)
      is-active.ts      (IS_ACTIVE, STATUS_LABELS, STATUS_BADGE_CLASSES)
      roles.ts          (ROLE_LABELS, EXTENDED_ROLE_LABELS)
      availability.ts   (AVAILABILITY_LABELS, AVAILABILITY_ICONS, AVAILABILITY_OPTIONS)
    helpers/
      index.ts          (barrel)
      date-helpers.ts   (formatDate, formatDateTime, formatTime, formatRelativeDate)
  dist/                 (compiled JS output, gitignored)
```

---

## What is NOT shared

| Category                     | Reason                            |
| ---------------------------- | --------------------------------- |
| NestJS DTOs, Zod schemas     | Backend-only, framework-specific  |
| Svelte components, runes     | Frontend-only, framework-specific |
| Domain request/response DTOs | Stay in their module              |
| UI constants (MESSAGES, etc) | Frontend-specific                 |
| `fieldMapper` (snake_case)   | Backend-only transformation       |

---

## Alternatives Considered

### A: No shared package (status quo)

Copy-paste types and constants between frontend and backend.

- **Pro**: Zero setup, no build step, no coordination
- **Con**: Definitions drift apart, bugs from inconsistency, 50+ files with duplicated `IsActiveStatus`
- **Rejected**: Unsustainable at current project size

### B: Shared package without build step (raw `.ts` only)

Export raw `.ts` from `package.json` without conditional exports.

- **Pro**: Simplest setup, no compilation overhead
- **Con**: Fails in Docker dev (`node dist/main.js` can't resolve `.js` imports in `.ts` files via Node 24 type-stripping). Only works with `tsx` runtime.
- **Rejected**: Dev environment uses `node` (not `tsx`) due to NestJS decorator metadata requirement

### C: Shared package with `.ts` extensions in imports

Use `allowImportingTsExtensions: true` instead of `.js` extensions.

- **Pro**: No build needed, Node type-stripping resolves `.ts` → `.ts`
- **Con**: Requires `noEmit: true` (can't produce output), incompatible with backend's tsconfig without project references. Complex configuration chain.
- **Rejected**: Too fragile, requires coordinating multiple tsconfig settings

### D: Zod schemas as single source of truth

Use Zod for runtime validation with `z.infer<>` for types.

- **Pro**: Runtime validation + types from one definition
- **Con**: Adds runtime dependency, overhead for pure type sharing, frontend doesn't need Zod validation
- **Rejected**: Over-engineered for the current need (type sharing, not runtime validation)

### E: Monorepo tooling (Turborepo/Nx)

Full monorepo build orchestration.

- **Pro**: Automatic dependency graph, caching, parallel builds
- **Con**: Massive infrastructure change, learning curve, overkill for 3 packages
- **Rejected**: Complexity disproportionate to benefit

---

## Consequences

### Positive

- **Single source of truth** for `UserRole`, `IsActiveStatus`, `ApiResponse`, `AvailabilityStatus`
- **Type safety across boundaries**: Frontend and backend share identical type definitions
- **Reduced duplication**: ~200 lines of copy-pasted code eliminated from 20+ files
- **Refactoring confidence**: Change a type in one place, TypeScript catches all consumers
- **IDE support**: `types` condition in exports → full go-to-definition into shared source

### Negative

- **Build step**: `shared/` must be compiled before backend in dev (`pnpm --filter @assixx/shared run build`)
- **Docker complexity**: All three Dockerfiles needed updates for COPY and build ordering
- **Stale builds**: If shared source changes but `dist/` isn't rebuilt, dev container uses outdated JS
- **Package resolution**: `inject-workspace-packages=true` copies source at install time, requiring careful Docker layer ordering

### Mitigations

| Risk                 | Mitigation                                                           |
| -------------------- | -------------------------------------------------------------------- |
| Stale shared/dist    | Dev CMD rebuilds shared on every container start                     |
| Docker COPY ordering | Dockerfile comments explain why shared COPY must precede install     |
| Type-check coverage  | `type-check` script runs `tsc --noEmit` on shared, frontend, backend |
| ESLint coverage      | `shared/**/*.ts` in root ESLint config's TypeScript block            |

---

## References

- [pnpm inject-workspace-packages](https://pnpm.io/npmrc#inject-workspace-packages)
- [TypeScript conditional exports](https://www.typescriptlang.org/docs/handbook/modules/reference.html#packagejson-exports)
- [Node.js type stripping (v24)](https://nodejs.org/api/typescript.html)
- [ADR-007: API Response Standardization](./ADR-007-api-response-standardization.md) (ApiResponse type origin)
- [ADR-008: Dependency Version Management](./ADR-008-dependency-version-management.md) (pnpm workspace context)

---

## Appendix: Implementation Plan

> Executed 2026-01-29 / 2026-01-30. Updated with learnings from actual implementation.

### Phase 1: Foundation (zero consumer changes)

1. Create `shared/` directory with `package.json`, `tsconfig.json`
2. Create all type files: `user-role.ts`, `is-active-status.ts`, `api-response.ts`, `auth-user.ts`, `pagination.ts`, `availability.ts`
3. Create all constant files: `is-active.ts`, `roles.ts`, `availability.ts`
4. Create helper files: `date-helpers.ts`
5. Create all barrel exports (`index.ts` in each subdirectory + root)
6. Update `pnpm-workspace.yaml`: add `"shared"` to packages (first entry)
7. Update root `tsconfig.json`: add `{ "path": "./shared" }` reference (first in list)
8. Run `pnpm install`
9. Verify: `cd shared && npx tsc --noEmit`

**Result**: Zero impact on existing code. All type-checks pass.

### Phase 2: Backend migration (UserRole + auth types)

1. Add `"@assixx/shared": "workspace:*"` to `backend/package.json` dependencies
2. Run `pnpm install`
3. Update `backend/src/nest/common/interfaces/auth.interface.ts`:
   - Import `UserRole`, `USER_ROLES`, `BaseAuthUser` from `@assixx/shared`
   - Remove local `UserRole` type, `VALID_ROLES` marked `@deprecated`
   - Make `NestAuthUser` extend `BaseAuthUser`
   - Re-export `UserRole` for backward compatibility
4. Verify: `cd backend && npx tsc --noEmit`

**Note**: Skipped adding references to `backend/tsconfig.json` - not needed for pnpm workspace package resolution.

### Phase 3: Frontend migration (UserRole + IsActiveStatus + constants)

1. Add `"@assixx/shared": "workspace:*"` to `frontend/package.json` dependencies
2. Run `pnpm install`
3. Update `frontend/src/app.d.ts` - import `UserRole` from `@assixx/shared`
4. Update `frontend/src/lib/utils/auth.ts` - import/re-export `UserRole`
5. Update `frontend/src/hooks.server.ts` - import `UserRole`
6. Update 12 route module files (6 `types.ts` + 6 `constants.ts`):
   - `manage-root`, `manage-admins`, `manage-employees`, `manage-areas`, `manage-departments`, `manage-teams`
   - Replace local `IsActiveStatus`, `FormIsActiveStatus` with imports from `@assixx/shared`
   - Replace local `STATUS_LABELS`, `STATUS_BADGE_CLASSES` with re-exports from `@assixx/shared/constants`
7. Update `shifts/_lib/types.ts` - import `ExtendedUserRole as UserRole` from `@assixx/shared`
8. Update `shifts/_lib/constants.ts` - re-export `AVAILABILITY_LABELS`, `AVAILABILITY_ICONS`, `AVAILABILITY_BADGE_CLASSES` from `@assixx/shared/constants`
9. Verify: `cd frontend && pnpm run check` (0 errors, 0 warnings)

### Phase 4: ApiResponse unification

1. Update `backend/src/types/api.d.ts` - re-export `ApiResponse`, `ApiSuccessResponse`, `ApiErrorResponse`, `ValidationError`, `PaginationMeta`, `ResponseMeta` from `@assixx/shared`
2. Mark `PaginatedResponse` and `ErrorResponse` as `@deprecated`
3. Intentionally skipped `frontend/src/lib/utils/api-client.types.ts` - `ApiResponseWrapper` has incompatible error shape
4. Verify: `pnpm run type-check`

### Phase 5: Date helpers + AvailabilityStatus

1. Date helpers already created in `shared/src/helpers/date-helpers.ts` (Phase 1)
2. Update `frontend/src/lib/utils/date-helpers.ts` - replace 217 lines with re-exports from `@assixx/shared/helpers`
3. `AvailabilityStatus` already in shared (Phase 1) and imported by frontend (Phase 3)
4. Verify: `pnpm run type-check`

### Phase 6: Docker & Infrastructure (unplanned - emerged during testing)

> This phase was NOT in the original plan. It was discovered when Docker builds failed.

1. **Dockerfile.dev** - Add `COPY shared/package.json` + `COPY shared/` before `pnpm install`
2. **Dockerfile** (backend production) - Add shared COPY in both builder and production stages
3. **Dockerfile.frontend** - Add `COPY shared/` + `COPY tsconfig.base.json` (Vite resolves shared/tsconfig.json chain)
4. **docker-compose.yml** - Add `../shared:/app/shared:delegated` bind mount for backend + deletion-worker
5. **Build step**: Change shared exports from raw `.ts` to conditional exports (`types` → source, `import` → compiled JS). Required because Node 24 type-stripping can't resolve `.js` extension imports inside `.ts` files.
6. **Dev CMD**: Update to `pnpm --filter @assixx/shared run build && cd backend && pnpm run build && node dist/nest/main.js`
7. **ESLint**: Add `shared/**/*.ts` to root `eslint.config.mjs` TypeScript files pattern
8. **type-check script**: Add `tsc --noEmit -p shared` as first step in root `package.json`

### Files Created

| File                                   | Description                                                   |
| -------------------------------------- | ------------------------------------------------------------- |
| `shared/package.json`                  | Package definition with conditional exports                   |
| `shared/tsconfig.json`                 | TypeScript config (NodeNext, composite)                       |
| `shared/src/index.ts`                  | Barrel export (types + constants + helpers)                   |
| `shared/src/types/index.ts`            | Types barrel                                                  |
| `shared/src/types/user-role.ts`        | UserRole, ExtendedUserRole, USER_ROLES                        |
| `shared/src/types/is-active-status.ts` | IsActiveStatus, FormIsActiveStatus, StatusFilter              |
| `shared/src/types/api-response.ts`     | ApiSuccessResponse, ApiErrorResponse, ApiResponse             |
| `shared/src/types/auth-user.ts`        | BaseAuthUser (shared base interface)                          |
| `shared/src/types/pagination.ts`       | PaginationParams, PaginationMeta                              |
| `shared/src/types/availability.ts`     | AvailabilityStatus, AVAILABILITY_STATUSES                     |
| `shared/src/constants/index.ts`        | Constants barrel                                              |
| `shared/src/constants/is-active.ts`    | IS_ACTIVE, STATUS_LABELS, STATUS_BADGE_CLASSES                |
| `shared/src/constants/roles.ts`        | ROLE_LABELS, EXTENDED_ROLE_LABELS                             |
| `shared/src/constants/availability.ts` | AVAILABILITY_LABELS, AVAILABILITY_ICONS, AVAILABILITY_OPTIONS |
| `shared/src/helpers/index.ts`          | Helpers barrel                                                |
| `shared/src/helpers/date-helpers.ts`   | formatDate, formatDateTime, formatTime, etc.                  |

### Files Modified

| File                                                   | Change                                                    |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `pnpm-workspace.yaml`                                  | Add `"shared"` as first package                           |
| `tsconfig.json` (root)                                 | Add `{ "path": "./shared" }` reference                    |
| `package.json` (root)                                  | Add `tsc --noEmit -p shared` to type-check script         |
| `eslint.config.mjs`                                    | Add `shared/**/*.ts` to TypeScript files pattern          |
| `backend/package.json`                                 | Add `@assixx/shared: workspace:*` dependency              |
| `backend/src/nest/common/interfaces/auth.interface.ts` | Import from shared, extend BaseAuthUser                   |
| `backend/src/types/api.d.ts`                           | Re-export from shared, deprecate local types              |
| `frontend/package.json`                                | Add `@assixx/shared: workspace:*` dependency              |
| `frontend/src/app.d.ts`                                | Import UserRole from shared                               |
| `frontend/src/lib/utils/auth.ts`                       | Import/re-export UserRole from shared                     |
| `frontend/src/hooks.server.ts`                         | Import UserRole from shared                               |
| `frontend/src/lib/utils/date-helpers.ts`               | Re-export from shared (replaced 217 lines)                |
| 6x `manage-*/_lib/types.ts`                            | Import IsActiveStatus, FormIsActiveStatus from shared     |
| 6x `manage-*/_lib/constants.ts`                        | Re-export STATUS_LABELS, STATUS_BADGE_CLASSES from shared |
| `shifts/_lib/types.ts`                                 | Import ExtendedUserRole, AvailabilityStatus from shared   |
| `shifts/_lib/constants.ts`                             | Re-export AVAILABILITY\_\* from shared                    |
| `docker/Dockerfile.dev`                                | COPY shared source, build shared in CMD                   |
| `docker/Dockerfile`                                    | COPY shared in builder + production stages                |
| `docker/Dockerfile.frontend`                           | COPY shared source + tsconfig.base.json                   |
| `docker/docker-compose.yml`                            | Add shared bind mount, update dev CMD                     |

### Lessons Learned

1. **"No build step" was naive**: Node 24 type-stripping loads `.ts` files but can NOT resolve `.js` extension imports to `.ts` files. A build step (`tsc`) is required to produce real `.js` files for runtime.
2. **Docker adds a whole phase**: Every Dockerfile and docker-compose volume mount must account for new workspace packages. This was not anticipated in the original plan.
3. **Conditional exports are essential**: `types` condition for TypeScript DX (go-to-definition into source), `import`/`default` for Node.js runtime (compiled JS).
4. **Anonymous Docker volumes are sticky**: The `/app/node_modules` anonymous volume persists across container recreations. After adding a new workspace dependency, the image must be rebuilt AND the volume refreshed.
5. **`inject-workspace-packages=true` requires source at install time**: pnpm needs the actual source files present before `pnpm install`, not just `package.json`. COPY ordering in Dockerfiles matters.

### Verification Checklist

- [x] `cd shared && npx tsc --noEmit` - shared type-checks
- [x] `cd backend && npx tsc --noEmit` - backend type-checks
- [x] `cd frontend && pnpm run check` - frontend svelte-check (0 errors)
- [x] `pnpm run type-check` - all three projects type-check
- [x] Docker backend starts without restart loop
- [x] Docker frontend build succeeds (Vite/Rollup resolves shared imports)
- [ ] `pnpm run dev:svelte` - smoke test pages load
- [ ] `pnpm run test:api` - API tests pass
- [ ] ESLint: `docker exec assixx-backend pnpm exec eslint backend/src` - shared linted
