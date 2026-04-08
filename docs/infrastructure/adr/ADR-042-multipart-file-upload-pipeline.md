# ADR-042: Multipart File Upload Pipeline (Fastify + Multer Bridge)

| Metadata                | Value                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**              | Accepted                                                                                                                             |
| **Date**                | 2026-04-08                                                                                                                           |
| **Decision Makers**     | Simon Öztürk                                                                                                                         |
| **Affected Components** | `backend/src/nest/main.ts`, 9 upload controllers, `@fastify/multipart`, `fastify-multer`, `@webundsoehne/nest-fastify-file-upload`   |
| **Related ADRs**        | ADR-027 (Dockerfile Hardening — pinning discipline), ADR-041 (TS Compiler Config — strict-everywhere), ADR-040 (Inventory — uploads) |

---

## Context

Assixx runs on **NestJS 11 + Fastify 5** (no Express adapter — see ADR-041 baseline). Nine controllers across the backend serve `multipart/form-data` upload endpoints:

| Controller                                               | Storage Engine | Use case                               |
| -------------------------------------------------------- | -------------- | -------------------------------------- |
| `backend/src/nest/inventory/inventory.controller.ts`     | disk           | Item photo documentation (V1, ADR-040) |
| `backend/src/nest/users/users.controller.ts`             | memory         | Profile picture (2 MB cap)             |
| `backend/src/nest/documents/documents.controller.ts`     | disk           | Document Explorer file uploads         |
| `backend/src/nest/blackboard/blackboard.controller.ts`   | disk           | Bulletin board attachments             |
| `backend/src/nest/kvp/kvp.controller.ts`                 | disk           | KVP suggestion attachments             |
| `backend/src/nest/chat/chat.controller.ts`               | disk           | Chat file attachments                  |
| `backend/src/nest/work-orders/work-orders.controller.ts` | disk           | Work-order photos                      |
| `backend/src/nest/tpm/tpm-locations.controller.ts`       | disk           | TPM location attachments               |
| `backend/src/nest/tpm/tpm-executions.controller.ts`      | disk           | TPM execution evidence photos          |

All nine use the **Multer ergonomics** pattern: `@UseInterceptors(FileInterceptor('field'))` + `@UploadedFile()` decorator + a `multer({ storage, limits, fileFilter })` options object. This is the conventional NestJS file-upload API and is what every developer or AI agent encountering the codebase will recognise.

The non-obvious part: NestJS's official Multer integration (`@nestjs/platform-express` + `@nestjs/multer`) only works on the Express adapter. Assixx uses the Fastify adapter, so the official package is unavailable. A bridge is required.

### The Bridge Problem

Three packages are involved in every upload request:

1. **`@fastify/multipart`** — registered as a Fastify content-type parser in `main.ts:99`
2. **`fastify-multer`** — provides Multer-compatible storage engines (`memoryStorage`, `diskStorage`), `fileFilter`, `limits`, and the `multer()` factory
3. **`@webundsoehne/nest-fastify-file-upload`** — provides `FileInterceptor`, `FilesInterceptor`, `FileFieldsInterceptor` and `AnyFilesInterceptor` decorators that wrap `fastify-multer.middleware` in a NestJS-compatible interceptor

This indirection is **not redundant**. Each layer has a distinct, load-bearing role. Removing any of them breaks all 9 upload endpoints. The pipeline is non-obvious enough that an audit on 2026-04-08 (triggered by the `@fastify/multipart` 9.4.0 → 10.0.0 bump) initially flagged Layer 1 as removable — it is not.

### Audit Findings (2026-04-08)

While preparing the `@fastify/multipart` major bump, the question was raised: _"Does main.ts:99 still do anything if `fastify-multer` already has its own content-type parser?"_

Investigation:

- `fastify-multer` exports `multer.contentParser` which calls `addContentTypeParser('multipart', setMultipart)`
- `grep "contentParser|multer\.contentParser" backend/src` → **0 matches**
- `fastify-multer.contentParser` is **never registered** anywhere in the source
- `@webundsoehne/nest-fastify-file-upload@2.3.1`'s `package.json` declares:
  ```json
  "peerDependencies": { "@fastify/multipart": ">=9" },
  "peerDependenciesMeta": { "@fastify/multipart": { "optional": true } }
  ```
- Its README §"Nest 11+ / Fastify 5" explicitly instructs: _"Install `npm i @fastify/multipart` as multipart body parser. Register `fastifyMultipart` in your root application after creation."_
- The `optional: true` flag exists only because users on the legacy stack (Nest ≤ 10 / Fastify 3-4) can register `fastify-multer.contentParser` instead. For our stack, `@fastify/multipart` is the documented and required path.
- The pnpm resolution path confirms the peer is wired: `@webundsoehne+nest-fastify-file-upload@2.3.1_@fastify+multipart@9.4.0_@nestjs+common@11_…`

Conclusion: `main.ts:99` is the **single** content-type parser for `multipart/form-data` in the entire application. Removing it returns HTTP 415 on all 9 upload endpoints because Fastify falls back to its default parser, which rejects unsupported media types.

---

## Decision

Adopt and document the three-layer multipart pipeline as the **canonical, blessed pattern** for file uploads in Assixx. Each layer's responsibility is fixed:

```
HTTP request (Content-Type: multipart/form-data)
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 1: @fastify/multipart                             │
│   Registered in backend/src/nest/main.ts:99             │
│   Hooks Fastify's content-type parser pipeline          │
│   Decorates request with .parts() / .file() / .files()  │
│   / .saveRequestFiles()                                 │
│   Makes the multipart body stream consumable            │
└─────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: @webundsoehne/nest-fastify-file-upload         │
│   Provides FileInterceptor / FilesInterceptor /         │
│   FileFieldsInterceptor / AnyFilesInterceptor           │
│   Used via @UseInterceptors() in 9 controllers          │
│   Internally instantiates Layer 2's multer() and calls  │
│   .single() / .array() / .fields() / .any() as Express- │
│   style middleware against the Fastify req/reply        │
└─────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: fastify-multer                                 │
│   Imported by every upload controller for ergonomics:   │
│     import multer from 'fastify-multer';                │
│     const { memoryStorage, diskStorage } = multer;      │
│   Provides storage engines, fileFilter, limits, the     │
│   multer() factory, and the middleware that consumes    │
│   the parts iterator from Layer 1                       │
│   Sets req.file / req.files                             │
└─────────────────────────────────────────────────────────┘
   │
   ▼
@UploadedFile() / @UploadedFiles() decorators →
   typed MulterFile delivered to the controller method
```

### Hard Rule (binding)

The single line **`backend/src/nest/main.ts:99`**:

```typescript
await app.register(import('@fastify/multipart'));
```

is **load-bearing**. Reviewers must reject any PR that removes it without an explicit, written migration plan to one of the alternatives below. A pointer comment above the registration links to this ADR.

---

## Alternatives Considered

### Alternative A — Switch to `@nestjs/platform-express` + `@nestjs/multer`

Use the official NestJS Multer integration on the Express adapter.

| Pros                                   | Cons                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Official, mature, large community      | **Loses Fastify performance for the entire app** (2-3× request throughput regression)                                                   |
| Best-known API in the NestJS ecosystem | Conflicts with `NestFastifyApplication` adapter wired throughout `main.ts`                                                              |
| No bridge package needed               | Cascading refactor: every Fastify-specific plugin (`@fastify/cookie`, `@fastify/helmet`, `@fastify/static`) needs an Express equivalent |
|                                        | Breaks ADR baseline: stack is Fastify, not Express                                                                                      |

**Rejected:** Framework-level regression. The performance gap and the cascading refactor cost are far higher than the cost of maintaining the bridge.

### Alternative B — Raw `@fastify/multipart` API + custom NestJS interceptors

Skip Layer 2 and Layer 3 entirely. Write 9 custom interceptors that call `req.parts()` / `req.saveRequestFiles()` directly.

| Pros                                               | Cons                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| Two fewer dependencies                             | **Re-implement memoryStorage / diskStorage / fileFilter / limits from scratch** |
| Full control over the parsing path                 | 9 custom interceptors instead of 9 one-line `FileInterceptor('field')` calls    |
| Direct access to `@fastify/multipart` v10 features | Loses every Multer convention developers already understand                     |
|                                                    | Reinvents `req.file` / `req.files` shape (or invents a divergent one)           |

**Rejected:** Massive maintenance cost for marginal benefit. The Multer-style API is the de-facto standard in the NestJS ecosystem and developer onboarding cost matters.

### Alternative C — `fastify-multer.contentParser` (the legacy bridge path)

Replace `main.ts:99` with `await app.register(multer.contentParser)` from `fastify-multer`. This was the documented `@webundsoehne/nest-fastify-file-upload` setup for **Nest ≤ 10 / Fastify 3-4**.

| Pros                                                       | Cons                                                                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| One fewer direct dependency (`@fastify/multipart` removed) | **Deprecated path** — `@webundsoehne` README now explicitly recommends `@fastify/multipart` for Nest 11+ / Fastify 5 |
| Slightly smaller dependency tree                           | `fastify-multer` ships an old `@fastify/busboy@^1.0.0` (Layer 1 ships `^3.0.0`)                                      |
|                                                            | Risk of subtle parser-behaviour drift between the legacy and modern paths                                            |
|                                                            | Not the path the upstream maintainer wants us on                                                                     |

**Rejected:** Going against the upstream-recommended setup for our exact stack version. The savings are negligible.

### Alternative D — Fork `@webundsoehne/nest-fastify-file-upload`

Vendor the bridge to remove the third-party dependency.

**Rejected:** Premature. The package is small, focused, and currently maintained. Re-evaluate only if it becomes unmaintained (see Risks below).

---

## Consequences

### Positive

1. **Standard Multer ergonomics in 9 controllers** — `FileInterceptor('field')`, `@UploadedFile()`, `memoryStorage()`, `diskStorage()`, `fileFilter`, `limits`. Zero developer onboarding cost for anyone with NestJS experience.
2. **Documented "blessed" pattern** from `@webundsoehne/nest-fastify-file-upload`'s README §"Nest 11+ / Fastify 5". We are on the upstream-recommended path, not a custom hack.
3. **Each layer has a single responsibility** — content-type parsing, ergonomics, NestJS integration. Easy to reason about once the diagram is internalised.
4. **Fastify performance preserved** — no Express adapter, no compatibility shims, no shared performance regression for the rest of the API.
5. **Future flexibility** — the `@fastify/multipart` v10 `saveRequestFiles` enhancement is available if a future endpoint ever wants it, even though current controllers don't use it.

### Negative

1. **3-package indirection is non-obvious.** The exact mistake this ADR is meant to prevent: removing `main.ts:99` because "fastify-multer already handles multipart." It does not, in our wiring.
2. **Coupled upgrade discipline.** Bumps to `@fastify/multipart` must satisfy `@webundsoehne/nest-fastify-file-upload`'s peer range (`>=9` as of v2.3.1). Currently both 9.x and 10.x satisfy this.
3. **Smaller-community bridge package.** `@webundsoehne/nest-fastify-file-upload` is a focused niche package, not a flagship NestJS module. If it ever stops being maintained, we need a fallback plan (see Risks).
4. **Two import paths for "multer"** — controllers import `multer` from `fastify-multer` for storage engines, and `FileInterceptor` from `@webundsoehne/nest-fastify-file-upload`. Slightly more awkward than a single import, but the `multer.interface.ts` file already centralises the `MulterFile` type.

### Risks & Mitigations

| Risk                                                                                                                         | Mitigation                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Future dev/agent removes `main.ts:99` thinking it is redundant                                                               | Pointer comment above `main.ts:99` references this ADR. Reviewer must reject the diff. This ADR exists.                                                                                |
| `@fastify/multipart` major bump breaks `@webundsoehne` peer range                                                            | Upgrade discipline section below — verify peer range first, then run upload API tests for both storage engines.                                                                        |
| `@webundsoehne/nest-fastify-file-upload` becomes unmaintained                                                                | Documented fallback: switch to Alternative B (raw `@fastify/multipart` API + 9 custom interceptors). Estimated ~2 days of refactor work, fully scoped, no risk to the rest of the app. |
| `fastify-multer` becomes unmaintained                                                                                        | Same fallback path — Alternative B subsumes both Layer 2 and Layer 3.                                                                                                                  |
| Subtle parser-behaviour change between `@fastify/busboy` versions across `fastify-multer` (v1) and `@fastify/multipart` (v3) | Layer 1 is the parser of record. `fastify-multer` only consumes the stream Layer 1 prepared, so its bundled busboy version is unused.                                                  |

---

## Upgrade Discipline

### When bumping `@fastify/multipart`

```bash
# 1. Verify the new version satisfies @webundsoehne peer range.
#    Currently the peer is ">=9" — both 9.x and 10.x are fine.
#    If the peer ever becomes ">=10" or stricter, check this first.
cat node_modules/.pnpm/@webundsoehne+nest-fastify-file-upload@*/node_modules/@webundsoehne/nest-fastify-file-upload/package.json | grep -A2 peerDependencies

# 2. Bump (workspace-aware, explicit version)
pnpm --filter @assixx/backend up @fastify/multipart@<new-version>

# 3. Type-check (must remain zero errors — we do not call saveRequestFiles)
docker exec assixx-backend pnpm run type-check

# 4. Run API tests for at least one memory-storage and one disk-storage endpoint
pnpm exec vitest run --project api backend/test/users.api.test.ts        # memoryStorage (profile picture)
pnpm exec vitest run --project api backend/test/inventory.api.test.ts    # diskStorage (item photo)
pnpm exec vitest run --project api backend/test/documents.api.test.ts    # diskStorage (document upload)
```

### When bumping `@webundsoehne/nest-fastify-file-upload`

Re-read the package's README _first_. Major versions of this package have historically switched the recommended body parser (e.g. v2.3.x switched from `fastify-multer.contentParser` to `@fastify/multipart` for the Nest 11+/Fastify 5 path). If the README changes again, adjust `main.ts` accordingly **and update this ADR**.

### When bumping `fastify-multer`

Verify the `multer.memoryStorage()` and `multer.diskStorage()` factory shapes are unchanged. Any breaking change in the Multer-API surface affects all 9 controllers.

---

## Verification

### Static proof

```bash
# Layer 1 is the only multipart content-type parser registered
grep -rn "addContentTypeParser\|contentParser\|@fastify/multipart" backend/src/
# Expected: a single hit at backend/src/nest/main.ts:99

# All 9 controllers use the bridge interceptor, not the raw API
grep -rln "@webundsoehne/nest-fastify-file-upload" backend/src/nest/
# Expected: 9 controller files

# No controller calls req.saveRequestFiles directly
grep -rn "saveRequestFiles\|savedRequestFiles" backend/src/
# Expected: 0 hits (the @fastify/multipart 10.0.0 API change is irrelevant to us)
```

### Runtime smoke test

```bash
# Bring the stack up
cd /home/scs/projects/Assixx/docker && doppler run -- docker-compose up -d

# Hit one endpoint per storage engine
curl -F "file=@/tmp/test.jpg" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v2/users/me/profile-picture     # memory storage

curl -F "photo=@/tmp/test.jpg" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v2/inventory/items/<uuid>/photos # disk storage
```

Expected: HTTP 200/201. If either returns HTTP 415, Layer 1 is broken — re-check `main.ts:99`.

### Negative proof (do not run in production)

If you ever need to convince yourself this ADR is right:

```bash
# 1. Comment out main.ts:99
# 2. Restart backend
# 3. Hit any upload endpoint → HTTP 415 Unsupported Media Type
# 4. Restore main.ts:99 → uploads work again
```

---

## References

### Internal

- [ADR-027: Dockerfile Hardening](./ADR-027-dockerfile-hardening.md) — pinning discipline for related infra
- [ADR-040: Inventory Addon Architecture](./ADR-040-inventory-addon-architecture.md) — first consumer requiring photo uploads (current branch trigger)
- [ADR-041: TypeScript Compiler Configuration](./ADR-041-typescript-compiler-configuration.md) — strict-everywhere baseline; this ADR follows the same upgrade-discipline pattern
- `backend/src/nest/main.ts:98-99` — load-bearing registration with pointer comment to this ADR
- `backend/src/nest/common/interfaces/multer.interface.ts` — centralised `MulterFile` type definition

### External

- [`@webundsoehne/nest-fastify-file-upload` README §"Nest 11+ / Fastify 5"](https://github.com/webundsoehne/nest-fastify-file-upload#readme) — upstream recommendation
- [`@fastify/multipart` v10.0.0 release notes](https://github.com/fastify/fastify-multipart/releases/tag/v10.0.0) — PR #612, Issue #549 (`saveRequestFiles` return-value enhancement)
- [`fastify-multer` README](https://github.com/fox1t/fastify-multer#readme) — Multer-API surface for Fastify
- [Fastify Content-Type Parser docs](https://fastify.dev/docs/latest/Reference/ContentTypeParser/) — why a parser registration is mandatory for non-default media types

### Audit trail

- Internal investigation 2026-04-08: triggered by `@fastify/multipart` 9.4.0 → 10.0.0 dependency-update report. Initial hypothesis "`main.ts:99` is redundant because `fastify-multer` has its own parser" was disproven by reading `fastify-multer@2.0.3/lib/lib/content-parser.js`, the `@webundsoehne/nest-fastify-file-upload@2.3.1` peer-dependency declaration, and the pnpm resolution path. This ADR is the durable record of that investigation.
