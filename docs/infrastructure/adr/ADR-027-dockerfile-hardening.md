# ADR-027: Dockerfile Hardening (Performance, Security, Best Practices)

| Metadata                | Value                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                   |
| **Date**                | 2026-02-28                                                                 |
| **Decision Makers**     | SCS Technik                                                                |
| **Affected Components** | `docker/Dockerfile`, `docker/Dockerfile.dev`, `docker/Dockerfile.frontend` |

---

## Context

A comprehensive audit of all three Dockerfiles against Docker's official 2026 best practices (BuildKit, multi-stage builds, cache optimization, secrets handling, security policies) revealed **3 critical**, **14 high**, and **12 medium** severity findings.

### Audit Trigger

The production Dockerfile (`docker/Dockerfile`) had a **broken RUN instruction** (truncated `apk add --no-cac` with `adduser` jammed in), meaning the production image either failed to build or built without `dumb-init` and proper user setup. This prompted a full audit of all Docker infrastructure.

### Key Problems Found

| Category              | Finding                                                                                                                    | Severity |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| **Broken Build**      | Production Dockerfile line 64-65 syntactically broken — `dumb-init` not installed, `addgroup` missing, `adduser` malformed | CRITICAL |
| **BuildKit**          | Production Dockerfile missing `# syntax=docker/dockerfile:1` directive                                                     | CRITICAL |
| **Signal Handling**   | `dumb-init` referenced in CMD but not installed (broken RUN); frontend had no signal forwarding at all                     | CRITICAL |
| **Version Drift**     | npm `11.9.0` vs `11.8.0`, pnpm `10.30.2` vs `10.33.0` across files                                                         | HIGH     |
| **Cache Performance** | Production Dockerfile lacked `--mount=type=cache` for pnpm store (dev + frontend had it)                                   | HIGH     |
| **Layer Caching**     | Production Dockerfile lacked `COPY --link` for `--from=builder` copies                                                     | HIGH     |
| **Image Bloat**       | `tsconfig.json`, `tsconfig.base.json`, source `.ts` files, entire `shared/` dir copied to production                       | HIGH     |
| **Security**          | Frontend `adduser` not assigned to its group (`-G nodejs` missing)                                                         | HIGH     |
| **Resilience**        | Backend HEALTHCHECK missing `.on('error')` handler — hangs on connection refused                                           | MEDIUM   |
| **Consistency**       | Dev Dockerfile had no `HEALTHCHECK` instruction (relied solely on docker-compose)                                          | HIGH     |
| **Redundancy**        | `pnpm store prune` after `--prod` install (store never reused in production)                                               | MEDIUM   |
| **Redundancy**        | `apk upgrade --no-cache curl` after `apk add --no-cache curl` (no-op with `--no-cache`)                                    | HIGH     |

### Reference Documentation

- [Docker Build Best Practices (2026)](https://docs.docker.com/build/building/best-practices/)
- [Docker Build Cache Optimization](https://docs.docker.com/build/cache/optimize/)
- [Dockerfile Reference](https://docs.docker.com/reference/dockerfile/)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Build Secrets](https://docs.docker.com/build/building/secrets/)
- [Docker Scout Security Policies](https://docs.docker.com/scout/policy/)

---

## Decision

Harden all three Dockerfiles following Docker's official best practices. Changes organized by principle:

### 1. Fix Critical Build Failure (Dockerfile)

**Before** (broken):

```dockerfile
RUN npm install -g npm@11.9.0 pnpm@10.30.2 && \
    apk add --no-cac    adduser -S nodejs -u 1001
```

**After** (correct):

```dockerfile
ARG PNPM_VERSION=10.33.0
RUN apk add --no-cache dumb-init && \
    npm install -g npm@11.9.0 "pnpm@${PNPM_VERSION}" && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs
```

**Rationale**: Proper `dumb-init` installation, explicit group creation, user assigned to group.

### 2. BuildKit Syntax Directive

Added `# syntax=docker/dockerfile:1` to the production Dockerfile (was already present in dev + frontend).

**Rationale**: Without this directive, BuildKit features like `--mount=type=cache` and `--mount=type=secret` aren't guaranteed to work.

### 3. Signal Handling (dumb-init)

| File                  | Before                               | After                                        |
| --------------------- | ------------------------------------ | -------------------------------------------- |
| `Dockerfile`          | `dumb-init` in CMD but not installed | Properly installed + used                    |
| `Dockerfile.frontend` | `CMD ["node", "build"]`              | `CMD ["dumb-init", "node", "build"]`         |
| `Dockerfile.dev`      | `CMD ["sh", "-c", "..."]`            | Unchanged (dev image, compose overrides CMD) |

**Rationale**: Node.js as PID 1 doesn't handle SIGTERM properly. `dumb-init` forwards signals to the child process, enabling graceful shutdown via `docker stop`.

### 4. Cache Mount Optimization

Added `--mount=type=cache,id=pnpm-store` to **both** `pnpm install` calls in the production Dockerfile (builder + runtime stages):

```dockerfile
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod
```

**Rationale**: pnpm store cache persists between builds. Unchanged packages don't need re-download. Dev and frontend already had this — production was the outlier.

### 5. COPY --link for Independent Layer Caching

```dockerfile
COPY --link --from=builder /app/shared/dist ./shared/dist
COPY --link --from=builder --chown=1001:1001 /app/backend/dist ./backend/dist
```

**Rationale**: `--link` enables layer-independent copying. Layers can be cached even when preceding layers change, improving rebuild performance with `--cache-from`.

### 6. Production Image Minimization

**Removed from production stage:**

| File                          | Removed                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| `tsconfig.json`               | Build-time only — TypeScript compilation happens in builder            |
| `tsconfig.base.json`          | Build-time only                                                        |
| `shared/` source `.ts` files  | Only `shared/dist/` needed at runtime (exports resolve to `dist/*.js`) |
| `backend/` source `.ts` files | Only `backend/dist/` needed at runtime                                 |
| `pnpm store prune`            | Store never reused in ephemeral production container                   |

**Rationale**: Smaller image = fewer CVEs in scanners, faster pulls, reduced attack surface. Production images should contain only what's needed to run.

### 7. Version Standardization

| Component | Before                                                    | After                        |
| --------- | --------------------------------------------------------- | ---------------------------- |
| npm       | `11.9.0` (prod), `11.8.0` (dev, frontend)                 | `11.9.0` everywhere          |
| pnpm      | `10.30.2` (prod hardcoded), `10.33.0` (dev, frontend ARG) | `10.33.0` via ARG everywhere |

**Rationale**: CVE-2025-64756 requires npm >= 11.1.0. Using the latest (`11.9.0`) everywhere eliminates version drift. pnpm parameterized via `ARG PNPM_VERSION` for consistency with ADR-008.

### 8. HEALTHCHECK Improvements

| File                  | Fix                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `Dockerfile`          | Added `.on('error', () => process.exit(1))` — prevents infinite hang when backend is unreachable |
| `Dockerfile.dev`      | Added `HEALTHCHECK` instruction (was missing entirely — relied on docker-compose)                |
| `Dockerfile.frontend` | `adduser -S sveltekit -u 1001 -G nodejs` — user now properly assigned to group                   |

### 9. Redundant apk Upgrade Removed (Dockerfile.dev)

**Before:**

```dockerfile
RUN apk add --no-cache curl jq && \
    apk upgrade --no-cache curl
```

**After:**

```dockerfile
RUN apk add --no-cache curl jq
```

**Rationale**: `apk add --no-cache` fetches the latest package index and installs the latest available version. The subsequent `apk upgrade --no-cache curl` is redundant — it's already the latest.

---

## Alternatives Considered

### 1. Use corepack Instead of `npm install -g pnpm`

| Pros                           | Cons                                                         |
| ------------------------------ | ------------------------------------------------------------ |
| Built into Node 24             | Experimental status — may be removed in future Node versions |
| Zero-install                   | corepack behavior changed between Node 22-24                 |
| Matches `packageManager` field | Less predictable in Docker builds                            |

**Decision**: Rejected for now. `npm install -g pnpm` is reliable and well-tested. Revisit when corepack reaches stable status.

### 2. Distroless Base Image (gcr.io/distroless/nodejs)

| Pros                                                  | Cons                            |
| ----------------------------------------------------- | ------------------------------- |
| Minimal attack surface (no shell, no package manager) | No `apk add dumb-init` possible |
| Tiny image size                                       | No shell for HEALTHCHECK CMD    |
| Google-maintained                                     | Debugging impossible (no shell) |

**Decision**: Rejected. Our HEALTHCHECK uses `node -e "..."` which works fine, but `dumb-init` installation requires apk. Would need to COPY dumb-init binary from a builder stage. Unnecessary complexity for current scale.

### 3. `pnpm deploy` for Backend (Like Frontend)

| Pros                                         | Cons                                                         |
| -------------------------------------------- | ------------------------------------------------------------ |
| Self-contained deployment                    | Changes directory structure (`/deploy` instead of workspace) |
| No workspace resolution needed in production | CMD path would change                                        |
| Cleaner production image                     | Larger architectural change                                  |

**Decision**: Deferred. The frontend already uses `pnpm deploy --prod /deploy`. The backend could adopt the same pattern, but it requires validating that all runtime imports resolve correctly without workspace context. Tracked as future improvement.

### 4. Image Digest Pinning

```dockerfile
FROM node:24.14.0-alpine3.22@sha256:abc123...
```

| Pros                       | Cons                                                   |
| -------------------------- | ------------------------------------------------------ |
| Guaranteed reproducibility | Maintenance burden — must update digest on every patch |
| Supply chain protection    | CI/CD needs automation to update digests               |

**Decision**: Deferred. Version tags provide sufficient reproducibility for current stage. Consider digest pinning when deploying to production at scale or when adopting Docker Scout for automated remediation.

---

## Consequences

### Positive

1. **Production image builds correctly** — broken RUN fixed, `dumb-init` properly installed
2. **Graceful shutdown** — `dumb-init` in all production images ensures `docker stop` sends SIGTERM to Node.js
3. **Faster rebuilds** — cache mounts on all `pnpm install` calls, `COPY --link` for independent layer caching
4. **Smaller production images** — no TypeScript source, no tsconfig, no pnpm store leftovers
5. **Version consistency** — identical npm/pnpm versions across all Dockerfiles
6. **Self-documenting** — `LABEL`, `ARG` defaults, and comments explain every decision
7. **Resilient healthchecks** — `.on('error')` handler prevents HEALTHCHECK from hanging indefinitely

### Negative

1. **Lockfile risk** — copying only `shared/dist/` (not full source) to production relies on `inject-workspace-packages` handling this correctly. If pnpm changes behavior, production install could fail. Mitigated by `--frozen-lockfile` which fails loud.
2. **npm upgrade in production** — still installing npm globally just to install pnpm. Adds ~30MB to production image. Acceptable trade-off until corepack stabilizes or `pnpm deploy` is adopted for backend.

### Neutral

1. **`.dockerignore` already existed** — initial audit falsely flagged it as missing (Glob didn't find dotfile at root). The existing `.dockerignore` is comprehensive and well-documented.

---

## Implementation Status

| Protection                      | File                                | Status |
| ------------------------------- | ----------------------------------- | ------ |
| `# syntax=docker/dockerfile:1`  | All 3 Dockerfiles                   | Done   |
| `dumb-init` signal handling     | `Dockerfile`, `Dockerfile.frontend` | Done   |
| `--mount=type=cache` for pnpm   | `Dockerfile` (both stages)          | Done   |
| `COPY --link` for `--from`      | `Dockerfile`, `Dockerfile.frontend` | Done   |
| Non-root user with proper group | `Dockerfile`, `Dockerfile.frontend` | Done   |
| HEALTHCHECK with error handler  | All 3 Dockerfiles                   | Done   |
| Version standardization         | All 3 Dockerfiles                   | Done   |
| Production image minimization   | `Dockerfile`                        | Done   |
| Redundant apk upgrade removed   | `Dockerfile.dev`                    | Done   |

---

## Verification (2026-02-28)

### Build Verification

```bash
cd docker
doppler run -- docker-compose --profile production build --no-cache
```

```
[+] build 2/2
 ✔ Image assixx-backend:dev   Built 86.6s
 ✔ Image assixx-frontend:prod Built 86.6s
```

**Note**: First build attempt failed with `ERROR: Shared build failed!` because a stale `tsconfig.tsbuildinfo` from the host was included in the build context. After removing the stale file and rebuilding with `--no-cache`, both images built successfully.

### Runtime Verification

```bash
doppler run -- docker-compose --profile production up -d
```

All 10 containers healthy:

| Container              | Image                  | Status  | Port  |
| ---------------------- | ---------------------- | ------- | ----- |
| assixx-backend         | assixx-backend:dev     | healthy | :3000 |
| assixx-frontend        | assixx-frontend:prod   | healthy | :3001 |
| assixx-nginx           | nginx:alpine           | healthy | :80   |
| assixx-postgres        | postgres:17-alpine     | healthy | :5432 |
| assixx-redis           | redis:8-alpine         | healthy | :6379 |
| assixx-deletion-worker | assixx-backend:dev     | healthy | :3002 |
| assixx-loki            | grafana/loki:3.6.3     | healthy | :3100 |
| assixx-prometheus      | prom/prometheus:v3.9.1 | healthy | :9090 |
| assixx-grafana         | grafana/grafana:12.3.1 | healthy | :3050 |

### Healthcheck Responses

```json
// Backend (:3000/health)
{"status":"ok","framework":"NestJS+Fastify"}

// Frontend (:3001/health)
{"status":"ok","service":"sveltekit-frontend"}

// Nginx (:80/health) → proxies to backend
{"status":"ok","framework":"NestJS+Fastify"}
```

### CI/CD Compatibility

The GitHub Actions workflow (`code-quality-checks.yml`) includes a `docker-build-verification` job that builds `docker/Dockerfile`. No workflow changes needed — the job uses `docker/setup-buildx-action@v3` which supports all BuildKit features (`# syntax=docker/dockerfile:1`, `--mount=type=cache`, `--mount=type=secret`).

---

## File Change Summary

```
docker/Dockerfile          — Full rewrite (14 fixes)
docker/Dockerfile.dev      — 4 fixes (curl, npm version, HEALTHCHECK, error handler)
docker/Dockerfile.frontend — 5 fixes (dumb-init, npm version, adduser group, shared build check, error handler)
```

---

## References

- [Docker Build Best Practices](https://docs.docker.com/build/building/best-practices/)
- [Docker Build Cache Optimization](https://docs.docker.com/build/cache/optimize/)
- [Dockerfile Reference](https://docs.docker.com/reference/dockerfile/)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Build Secrets](https://docs.docker.com/build/building/secrets/)
- [Docker Scout Security Policies](https://docs.docker.com/scout/policy/)
- [ADR-008: Dependency Version Management](./ADR-008-dependency-version-management.md) — Node/pnpm version strategy
- [ADR-013: CI/CD Pipeline Hardening](./ADR-013-ci-cd-pipeline-hardening.md) — Build pipeline context
