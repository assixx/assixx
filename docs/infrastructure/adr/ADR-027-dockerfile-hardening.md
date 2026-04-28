# ADR-027: Dockerfile Hardening (Performance, Security, Best Practices)

| Metadata                | Value                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| **Status**              | Amended                                                                                          |
| **Date**                | 2026-02-28 (amended 2026-04-07, 2026-04-08, 2026-04-16, 2026-04-27, 2026-04-28 a + b)            |
| **Decision Makers**     | SCS Technik                                                                                      |
| **Affected Components** | `docker/Dockerfile`, `docker/Dockerfile.dev`, `docker/Dockerfile.frontend`, `docker-compose.yml` |

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
| **Version Drift**     | npm `11.9.0` vs `11.8.0`, pnpm `10.30.2` vs `10.33.2` across files                                                         | HIGH     |
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
ARG PNPM_VERSION=10.33.2
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
| pnpm      | `10.30.2` (prod hardcoded), `10.33.2` (dev, frontend ARG) | `10.33.2` via ARG everywhere |

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

**Decision**: ~~Deferred.~~ **Implemented 2026-04-27** (Amendment). The frontend pattern (`pnpm deploy --filter=assixx-frontend --prod /deploy`) is now mirrored 1:1 for the backend (`pnpm deploy --filter=assixx-backend --prod /deploy`). Note: `--filter` matches the `name` field in package.json, not the directory name — backend's name is `assixx-backend` (no `@scope`); only `@assixx/shared` uses the scoped form. A mismatched filter silently exits 0 with an empty `/deploy`, so the package-name spelling is load-bearing. All runtime imports of `@assixx/shared/dist/*` resolve correctly because the builder syncs `shared/dist` into every injected workspace copy via `find /app/node_modules -path '*/@assixx/shared' -type d -exec cp -r /app/shared/dist {} \;` (same dance as `Dockerfile.frontend:50-53`) before invoking `pnpm deploy`. The production stage no longer runs `pnpm install --prod` at all — it only copies `/deploy/{node_modules,package.json}` plus `backend/dist`. The deletion-worker (which reuses `assixx-backend:dev`) is unaffected because it only consumes the dev image. Side benefit: pnpm itself is no longer installed in the production stage (was line 86 of the original prod stage), shaving ≈30 MB.

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

## Amendment 2026-04-07: Image Pinning Strategy + PLG Stack Bumps

### Context

A routine version audit (2026-04-07) found inconsistent pinning across the Docker stack. The original ADR-027 (2026-02-28) addressed Dockerfile **content** hardening but did not formalize an image **pinning strategy**. Result: 5 of 8 images were pinned to specific versions (Grafana, Loki, Prometheus, Node, pg_partman), while 3 used rolling tags (`nginx:alpine`, `redis:8-alpine`, `postgres:17-alpine`). The `docker-compose.yml` header even advised digest pinning — but the actual stack contradicted that advice.

Additionally, the PLG observability stack had drifted behind upstream:

- Grafana `12.3.1` → `12.4.2` (7 CVEs unpatched: CVE-2026-27876, -27877, -27879, -27880, -28375, -33375)
- Prometheus `v3.9.1` → `v3.11.1` (2 minor versions; OTLP HTTP tracing startup fix in 3.11.1)
- Loki `3.6.3` → `3.7.1` (Go and gRPC version upgrade)

### Decision: Three-Stage Pinning Model — Stage 1 Mandatory

| Stage   | Example                               | Reproducible? | Maintenance | Status                                     |
| ------- | ------------------------------------- | ------------- | ----------- | ------------------------------------------ |
| Stage 0 | `nginx:alpine`                        | No            | Zero        | **Forbidden**                              |
| Stage 1 | `nginx:1.29.8-alpine`                 | Yes           | Manual      | **Mandatory** for all images               |
| Stage 2 | `nginx:1.29.8-alpine@sha256:<digest>` | Cryptographic | High        | Deferred (see original §"Alternatives" #4) |

**Rule:** Every `image:` directive in `docker-compose.yml` and every `FROM` directive in any `Dockerfile*` MUST use a fully-qualified version tag (Stage 1). Rolling tags (Stage 0) are not permitted.

**Stage 2 trigger conditions** (re-open digest pinning decision when ANY of these occur):

- Renovate or Dependabot adopted (auto-PRs eliminate manual digest update burden)
- Production deployment to multi-node infrastructure
- Docker Scout or equivalent adopted for automated CVE remediation

### Rationale

1. **Reproducibility** — Builds are byte-stable across Dev, CI, and Prod within a release cycle. The same `git checkout` produces the same image bytes regardless of clock time.
2. **Trivy-compatible CVE tracking** — ADR-013 CVE scans need stable baselines for diff comparison. Rolling tags produce noise: "Why did this CVE disappear/appear without a code change?"
3. **Self-consistency** — `docker-compose.yml` header already advises pinning. Stage 0 in 3 of 8 images contradicted that.
4. **No new tooling required** — Pure config change, zero infrastructure cost.
5. **Trade-off accepted** — Manual updates required. Mitigated by quarterly review (or future Renovate adoption).

### Changes Applied (2026-04-07)

**`docker/docker-compose.yml`:**

| Line | Before                   | After                     | Reason                                   |
| ---- | ------------------------ | ------------------------- | ---------------------------------------- |
| 206  | `redis:8-alpine`         | `redis:8.6.2-alpine`      | Stage 0 → Stage 1                        |
| 397  | `nginx:alpine`           | `nginx:1.29.8-alpine`     | Stage 0 → Stage 1                        |
| 441  | `grafana/loki:3.6.3`     | `grafana/loki:3.7.1`      | Bump (Go/gRPC upgrade)                   |
| 476  | `prom/prometheus:v3.9.1` | `prom/prometheus:v3.11.1` | Bump (2 minors; OTLP tracing fix)        |
| 524  | `grafana/grafana:12.3.1` | `grafana/grafana:12.4.2`  | **CVE bump** (7 CVEs patched, see below) |

**`docker/Dockerfile.pg-partman`:**

| Line | Before                    | After                       | Reason            |
| ---- | ------------------------- | --------------------------- | ----------------- |
| 9    | `FROM postgres:17-alpine` | `FROM postgres:17.9-alpine` | Stage 0 → Stage 1 |

**`docker/docker-compose.yml` header comment block:** Updated stale `postgres:17-alpine` example references to `postgres:17.9-alpine` for consistency.

### Grafana CVEs Patched (12.3.1 → 12.4.2)

- CVE-2026-27876
- CVE-2026-27877
- CVE-2026-27879
- CVE-2026-27880
- CVE-2026-28375
- CVE-2026-33375

### Verification

Required after applying these changes:

```bash
cd /home/scs/projects/Assixx/docker

# 1. Stop running stack (named external volumes for postgres/redis are preserved)
doppler run -- docker-compose --profile observability --profile production down

# 2. Pull all updated external image tags (Grafana, Loki, Prometheus, Redis, Nginx)
doppler run -- docker-compose --profile observability --profile production pull

# 3. Rebuild ALL locally-built images with no cache
#    Required because: (a) the postgres base in Dockerfile.pg-partman changed,
#    (b) any pnpm-lock.yaml drift means backend/frontend node_modules must be
#    rebuilt — see Troubleshooting below for the anonymous volume footgun.
doppler run -- docker-compose --profile production build --no-cache

# 4. Apply
doppler run -- docker-compose --profile observability --profile production up -d

# 5. All containers must report (healthy)
doppler run -- docker-compose --profile observability --profile production ps
```

**Loki 3.6 → 3.7 risk:** The release notes indicate only "Go and gRPC upgrade" — no documented config schema changes. If `assixx-loki` becomes unhealthy after restart, inspect `docker logs assixx-loki --tail 50` and verify `docker/loki/loki-config.yml` against the current Loki 3.7.x reference schema.

### Troubleshooting: "Cannot find module" errors after stack update

**Symptom:** After a stack update, the backend container enters a restart loop with hundreds of TypeScript errors like:

```
error TS2307: Cannot find module 'nestjs-zod' or its corresponding type declarations.
error TS2339: Property 'startDate' does not exist on type 'CreateVacationRequestDto'.
```

— even though `backend/package.json` lists `nestjs-zod` and `pnpm-lock.yaml` is current.

**Root cause:** The backend service mounts an **anonymous volume** at `/app/node_modules` (`docker-compose.yml` in the backend service `volumes:` block). Anonymous volumes have a critical lifecycle property:

- They are populated **only on first container start** from the image's `/app/node_modules`
- They persist across `docker-compose down`/`up` cycles (NOT removed without `-v`)
- They are NOT removed by `docker system prune` or `docker builder prune -a`
- They retain old `node_modules` content even when `package.json` and the image change

Result: After adding a new dependency, `docker-compose build` rebuilds the image, but the **anonymous volume keeps its stale contents** and overlays the fresh image's `/app/node_modules` → new container sees the old `node_modules` → TypeScript compilation fails for any newly-added package.

**Recovery procedure:**

```bash
cd /home/scs/projects/Assixx/docker

# 1. Stop the stack (named external volumes — postgres/redis — are preserved)
doppler run -- docker-compose --profile observability --profile production down

# 2. Remove dangling anonymous volumes
#    Safe: only deletes volumes not currently in use
#    Spares named volumes like assixx_postgres_data
docker volume ls -q -f dangling=true | xargs -r docker volume rm

# 3. Full rebuild (ALL services with local Dockerfiles)
doppler run -- docker-compose --profile production build --no-cache

# 4. Restart — anonymous volumes are now re-populated from fresh images
doppler run -- docker-compose --profile observability --profile production up -d
```

**Verification that the anonymous volume is the root cause:**

```bash
# List all volumes — anonymous volumes have hex-string names (e.g. 49afe23f...)
docker volume ls

# Inspect the suspect volume directly
docker run --rm -v <hex-id>:/check alpine ls /check/<missing-module>
# If output is "No such file or directory" → confirmed: rebuild required
```

**Prevention:** After ANY of these events, perform a full rebuild + dangling volume cleanup, NOT just a `restart`:

- `pnpm add` / `pnpm remove` in any workspace package
- Branch switch with `pnpm-lock.yaml` drift between branches
- Running `cleanupdist` (deletes host `node_modules` but not container volumes)
- Any change to `package.json` that affects backend dependencies
- Image base bump in `Dockerfile.dev` (e.g., Node version change)

### Maintenance Workflow

Without Renovate/Dependabot, version updates are manual. Recommended cadence:

| Component                    | Cadence       | Rationale                                     |
| ---------------------------- | ------------- | --------------------------------------------- |
| Grafana, Prometheus, Loki    | Monthly       | Active development, frequent CVE fixes        |
| Postgres, Redis, Nginx, Node | Quarterly     | Stable, slow-moving, mostly patch releases    |
| pg_partman                   | Semi-annually | Mature extension, releases are infrequent     |
| **Any CVE announcement**     | **Immediate** | Apply within 48h regardless of normal cadence |

### Anti-Patterns (Forbidden)

- `image: <name>:latest` — never reproducible, version can change between containers in the same compose run
- `image: <name>:<major>` (e.g., `redis:8`) — picks "latest within major", same issue at smaller scale
- `image: <name>:<major>-alpine` (e.g., `nginx:alpine`, `redis:8-alpine`) — the original problem this amendment fixes
- Mixing pinning strategies within the same compose file — produces audit/reproducibility confusion

### Affected Components Update

The original ADR scoped only `docker/Dockerfile*`. This amendment extends scope to include `docker/docker-compose.yml` because the pinning rule applies to both `image:` directives (compose) and `FROM` directives (Dockerfiles).

---

## Amendment 2026-04-08: Pin-Strategy Hardening (CI Guard + Dependabot Coverage)

### Context

External review of the 2026-04-07 pinning amendment surfaced three concrete gaps:

1. **No CI enforcement of Stage 1.** The pinning rule existed only as text in this
   ADR. A future PR could reintroduce a rolling tag (`nginx:alpine`,
   `redis:8-alpine`, etc.) and pass code review unnoticed.
2. **Dependabot did not cover Docker.** `.github/dependabot.yml` existed (npm +
   github-actions ecosystems) but did not track Docker images. The Grafana CVE
   drift that triggered the 2026-04-07 amendment would have repeated.
3. **Anonymous `node_modules` volume drift footgun** was documented under
   §Troubleshooting but had no preventive mitigation.

### Decision

#### 1. CI Pin-Guard (Whitelist Approach)

Added a `Verify image pinning (ADR-027 Stage 1)` step to the
`docker-build-verification` job in `.github/workflows/code-quality-checks.yml`.

The check uses a **whitelist** regex (every external image MUST have a
semver-style tag with at least one dot OR a `@sha256:` digest) rather than a
blacklist of forbidden patterns, because blacklists miss novel rolling
patterns like `:edge`, `:nightly`, `:rc`, `:dev`, or missing-tag-entirely.

```bash
grep -E '^\s*(image:\s*\S+|FROM\s+\S+)' \
       docker/docker-compose*.yml docker/Dockerfile* \
   | grep -vE 'assixx-(backend|frontend|postgres):' \
   | grep -vE ':[^[:space:]]*[0-9]+\.[0-9]+|@sha256:|node:\$\{NODE_VERSION'
```

Whitelisted exceptions:

- `assixx-(backend|frontend|postgres):*` — locally-built images, version tag
  is the build context not a registry pull
- `node:${NODE_VERSION}` — ARG-substituted, the actual version is supplied
  via compose `build.args` and is itself Stage-1 pinned (`24.14.0-alpine3.22`)

Verified against current repo: zero false positives, catches `:latest`,
`:alpine`, `:8`, `:8-alpine`, `:edge`, no-tag, and single-digit-only patterns.

#### 2. Dependabot Coverage Extension

`.github/dependabot.yml` extended with two new ecosystems:

| Ecosystem        | Directory | Coverage                                                             |
| ---------------- | --------- | -------------------------------------------------------------------- |
| `docker`         | `/docker` | Only `/docker/Dockerfile` (the only standard-named one — see gap #4) |
| `docker-compose` | `/docker` | All `image:` tags in `docker-compose.yml` (closes the PLG drift gap) |

The `docker-compose` ecosystem reached general availability on
[2025-02-25](https://github.blog/changelog/2025-02-25-dependabot-version-updates-now-support-docker-compose-in-general-availability/).
PR grouping by stack (`plg-stack`, `infra`) keeps PR noise manageable.

#### 3. Anonymous Volume Drift Mitigation — ATTEMPTED, ROLLED BACK 2026-04-08

**First attempt (rolled back same day):** Backend and deletion-worker dev
commands in `docker-compose.yml` were updated to prepend
`pnpm install --frozen-lockfile` to the entrypoint chain, with the intent of
syncing the anonymous `/app/node_modules` volume against `pnpm-lock.yaml` on
every container start.

**Failure mode at first runtime test:**

```
assixx-backend     | Scope: all 4 workspace projects
assixx-backend     | Recreating /app/node_modules
assixx-backend     |  EACCES  EACCES: permission denied, rmdir '/app/node_modules/.bin'
assixx-backend exited with code 243 (restarting)
```

**Root cause analysis (3 layers):**

1. **`Dockerfile.dev` L46 chowns `/app` non-recursively** (`chown 1000:1000 /app`,
   not `chown -R`). The pre-existing inline comment justifies this:
   _"Only chown specific dirs (not node_modules — would take 100+ seconds!)"_.
   Consequence: image's `/app/node_modules` is **root-owned**, since the
   build-time `pnpm install` ran as the default Docker root user.

2. **Anonymous volume initialization preserves ownership** from the image
   contents on first container start. The volume's `/app/node_modules` is
   therefore root-owned.

3. **Container runs as `user: "${UID:-1000}:${GID:-1000}"`** per compose. The
   entrypoint `pnpm install` runs as UID 1000 against root-owned files.
   Compounding this, pnpm decided to "Recreate" the volume (likely because
   `node_modules/.modules.yaml` records the build-time store path
   `/root/.local/share/pnpm/store` which doesn't match the runtime default
   for UID 1000), then failed on `rmdir /app/node_modules/.bin` with EACCES.

The hybrid approach was the wrong call. The pre-existing chown-only-/app was
a warning sign about the volume ownership model that I missed during planning.
Claiming "steady-state cost is <5s" without runtime testing was overconfident.

**Rollback (2026-04-08):** Backend and deletion-worker `command:` directives
restored to their original form. The frontend/package.json bind mount added
to deletion-worker (which was a downstream prerequisite of the entrypoint
install) was also reverted because it serves no purpose without the install.

**Status of the underlying drift footgun: STILL OPEN.** The §Troubleshooting
recovery procedure (`docker volume rm` + `--no-cache build`) remains the
manual workaround. Tracked as future work below.

#### 3a. Future Work: Proper Anonymous Volume Fix (Two Viable Approaches)

**Option α — Build as UID 1000 from the start** (preferred but invasive):

Restructure `Dockerfile.dev` to run all file-creating operations as UID 1000.
Required changes:

- Move `chown -R 1000:1000 /app` BEFORE `WORKDIR /app` and any `COPY`
- Add `USER 1000:1000` before COPY/RUN sections that create files
- Use `COPY --chown=1000:1000` for all COPY directives
- Change pnpm cache mount target from `/root/.local/share/pnpm/store` to a
  path writable by UID 1000 (e.g., `target=/app/.pnpm-store,uid=1000,gid=1000`)
- Pin pnpm `--store-dir` explicitly so build-time and runtime agree

Pros: clean, no ownership issues, no recreate trigger.
Cons: requires verifying that BuildKit's cache mount with `uid=1000` works
correctly across pnpm operations, and that NestJS build still works as 1000.
Needs end-to-end test before merging.

**Option β — chown -R after build-time install** (simpler, slower build):

Add `chown -R 1000:1000 /app/node_modules` after the build-time pnpm install.
Adds ~30-60s to image build (one-time cost). Plus pin `pnpm --store-dir` to
a fixed path for build+runtime to avoid the "Recreating" trigger.

Pros: minimal Dockerfile diff.
Cons: build is slower; the recreate trigger may still need the store-dir pin
to be fully eliminated.

**Decision deferred** — both options need an isolated test on a branch with
container restart verification before being committed to the main flow.

#### 3b. What Survived the Rollback (Still Applied)

The CI pin-guard (§1) and the Dependabot extension (§2) above are independent
of the volume fix and remain in place. They were validated by static checks
(YAML lint, regex tests against current files) and are safe.

### Known Gaps NOT Closed by This Amendment

1. **Custom-named Dockerfiles** — `Dockerfile.dev`, `Dockerfile.frontend`,
   `Dockerfile.pg-partman` are NOT scanned by Dependabot's `docker` ecosystem
   ([dependabot-core #4449](https://github.com/dependabot/dependabot-core/issues/4449)).
   Mitigation: the Node version is supplied centrally via compose `build.args`,
   so the canonical pin lives in `docker-compose.yml` (which `docker-compose`
   ecosystem DOES track). The `postgres:17.9-alpine` in `Dockerfile.pg-partman`
   remains a manual-review item — flagged in §Maintenance Workflow.
2. **Stage 2 (digest pinning) is NOT adopted** by this amendment. See §Stage 2 Trigger Status below.

### Stage 2 Trigger Status (2026-04-08)

The 2026-04-07 amendment listed three trigger conditions for re-opening the
Stage 2 (digest pinning) decision:

| Trigger                                            | Met?                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| Renovate or Dependabot adopted                     | **YES** — Dependabot now covers `docker` + `docker-compose`                |
| Production deployment to multi-node infrastructure | NO — single-host deployment                                                |
| Docker Scout or equivalent adopted                 | NO — Trivy in CI is not equivalent (build-time scan, not auto-remediation) |

**Decision: Stage 2 remains DEFERRED.** Rationale: only one of three triggers
is met, and the maintenance burden of digest pinning without auto-remediation
(only auto-PRs) is still net-negative for current scale. Auto-PRs reduce the
update _labor_, but every digest update still requires human review of the
diff. Re-evaluate when a second trigger fires (production multi-node OR
Docker Scout adoption).

### Verification

```bash
# Pin-guard regex tested locally — zero false positives, all bad patterns caught
grep -E '^\s*(image:\s*\S+|FROM\s+\S+)' docker/docker-compose*.yml docker/Dockerfile* \
  | grep -vE 'assixx-(backend|frontend|postgres):' \
  | grep -vE ':[^[:space:]]*[0-9]+\.[0-9]+|@sha256:|node:\$\{NODE_VERSION'
# → no output (PASS)
```

CI verification will run on the next push to a PR branch.

Container startup verification (anonymous volume sync) requires a manual
test by the developer:

```bash
# Force a lockfile drift scenario
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose down
doppler run -- docker-compose up -d backend
# Backend logs should show "pnpm install" running, then build, then NestJS bootstrap
docker logs assixx-backend --tail 50
```

---

## Amendment 2026-04-16: Node Base Image — Alpine → Debian Slim (musl DNS Failure Class)

### Context

During Phase 6 end-to-end testing of the Microsoft OAuth masterplan
(`FEAT_MICROSOFT_OAUTH_MASTERPLAN.md`), the backend's OAuth token exchange
against `https://login.microsoftonline.com/organizations/oauth2/v2.0/token`
failed with `fetch failed / ENETUNREACH`, even though DNS and outbound TLS
had been previously verified working for the same container.

Diagnostic results from inside the container (musl 1.2.5 on Alpine 3.22,
Node 24.14, Docker embedded DNS at `127.0.0.11`):

| Probe                                                                | Result                                  |
| -------------------------------------------------------------------- | --------------------------------------- |
| `busybox nslookup -type=A login.microsoftonline.com 127.0.0.11`      | 7+ IPv4 addresses returned              |
| `node -e 'dns.resolve4(...)' ` (c-ares, independent of libc)         | 232 IPv4 addresses returned             |
| `node -e 'dns.lookup({family:4, all:true})'` (musl via libuv)        | 184 IPv4 addresses returned             |
| `node -e 'dns.lookup({all:true})'` (musl AF_UNSPEC, default `fetch`) | **0 IPv4, 48 IPv6 only**                |
| `nc -z 40.126.31.67 443` (direct v4 TCP connectivity)                | open                                    |
| `fetch(MS token URL)`                                                | `TypeError: fetch failed` (ENETUNREACH) |

c-ares + explicit `family:4` see the A records. musl's `getaddrinfo(AF_UNSPEC)`
— which is what Node's `fetch`/undici use by default — returns AAAA-only. The
Docker default bridge has no IPv6 routing → every connect attempt to the
returned v6 addresses fails with `ENETUNREACH`.

`dns.setDefaultResultOrder('ipv4first')` and `--dns-result-order=ipv4first`
are glibc hints; musl ignores them. Confirmed empirically (ran the flag,
still got v6-only).

### Root Cause

This is a known, documented failure class of the musl DNS stub resolver
interacting with Docker's IPv4-only embedded DNS (127.0.0.11). References:

- [moby/moby#41651 — Feature request: IPv6-enabled embedded DNS server](https://github.com/moby/moby/issues/41651)
- [alpinelinux/docker-alpine#399 — DNS resolution uses ipv6 (AAAA) record requests even if ipv6 is not used](https://github.com/alpinelinux/docker-alpine/issues/399)
- [netbirdio/netbird#2098 — musl getaddrinfo AF_UNSPEC semantics](https://github.com/netbirdio/netbird/issues/2098)
- [bell-sw blog — How to deal with Alpine DNS issues](https://bell-sw.com/blog/how-to-deal-with-alpine-dns-issues/) (TCP fallback, EDNS0, parallel query race)

The failure mode is: many-A-record hosts (Microsoft load-balanced endpoints
have 100+ A records) exceed the 512-byte UDP DNS response cap. musl's DNS
path does not send EDNS0 OPT records (no 4096-byte negotiation) and its
TCP-fallback interaction with the Docker embedded resolver is fragile on
NXDOMAIN races. The practical result is `dns.lookup(AF_UNSPEC)` returning
AAAA-only for affected hosts.

### Decision

**Move all Node-runtime container images from Alpine (musl) to Debian
bookworm-slim (glibc):**

- `docker/Dockerfile.dev` (backend dev)
- `docker/Dockerfile` (backend prod, both builder + production stages)
- `docker/Dockerfile.frontend` (SvelteKit SSR, both builder + production stages)
- `docker/docker-compose.yml` (`NODE_VERSION_DEV` + `NODE_VERSION_PROD` fallbacks)
- `docker/.env` (`NODE_VERSION_DEV` + `NODE_VERSION_PROD` canonical values)

**Explicitly NOT migrated** (scope-minimal):

- `docker/Dockerfile.pg-partman` → stays on `postgres:18.3-alpine` (no outbound
  HTTPS, no musl-DNS exposure; base swap would require a full pg_partman image
  rebuild with large regression surface — see ADR-029)
- `docker-compose.yml` `redis:8.6.2-alpine` (no outbound HTTPS)
- `docker-compose.yml` `nginx:1.29.8-alpine` (no outbound HTTPS)

Rationale for the scope line: the musl DNS failure class only triggers for
containers that issue outbound HTTPS to many-A-record hosts from inside the
Docker bridge network. Containers that only speak internal TCP (Postgres,
Redis, Nginx reverse proxy to internal services) are architecturally
unaffected. Keeping them on Alpine preserves their ~90 MB image footprint
and avoids gratuitous change for non-problem code paths.

### Syntax Diff (Alpine → Debian)

| Concept              | Alpine (before)                          | Debian (after)                                                                                                  |
| -------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Package install      | `apk add --no-cache dumb-init curl jq`   | `apt-get update && apt-get install -y --no-install-recommends dumb-init curl jq && rm -rf /var/lib/apt/lists/*` |
| System group         | `addgroup -g 1001 -S nodejs`             | `groupadd -r -g 1001 nodejs`                                                                                    |
| System user          | `adduser -S sveltekit -u 1001 -G nodejs` | `useradd -r -u 1001 -g nodejs --no-log-init sveltekit`                                                          |
| Base image tag       | `24.14.0-alpine3.22`                     | `24.14.0-bookworm-slim`                                                                                         |
| Image size (approx.) | ~180 MB                                  | ~280 MB                                                                                                         |

`--no-log-init` on `useradd` prevents the 1000-MB `/var/lib/log/lastlog`
sparse file that Debian's `useradd` otherwise initializes for system users.

### Alternatives Considered

**1. `dns.lookup` monkey-patch in `main.ts` (side-effect import that rewrites
dns.lookup to default `family: 4`).** Rejected — this is a workaround, not a
fix. Hides the real architectural mismatch and risks breaking any future
v6-only service. The project's KISS + no-quick-fixes policy (`CLAUDE.md`)
explicitly forbids this class of patch when an architectural fix is
available.

**2. Custom Undici dispatcher with `connect: { family: 4 }` globally.**
Rejected — would require adding `undici` as a direct dep (Node 24 bundles
it but does not expose it as a module path), and the global-dispatcher-sync
between bundled and external undici instances is fragile (see
`nodejs/undici#1775`). Also still a workaround.

**3. Bypass Docker embedded DNS via `dns: [8.8.8.8, 1.1.1.1]` in compose.**
Rejected — kills container-name resolution (service aliases like
`backend`, `postgres`, `redis` all resolve via 127.0.0.11). Would break
inter-container networking.

**4. `dnsmasq` sidecar inside each Alpine container** (per bell-sw blog).
Rejected — adds a process, complicates image, the bell-sw recommendation
exists because the root cause is musl's DNS stack. Fixing the root cause
(switch libc) is cleaner than layering another caching resolver.

**5. Alpaquita Linux** (Alpine-compatible, glibc-based, BellSoft).
Rejected — niche distribution, adds supply-chain/security-review burden
over standard Debian slim, and the only measurable benefit over Debian is
a smaller image footprint. Not worth the trade at current scale.

**6. Migrate everything to Debian (Postgres + Redis + Nginx too).**
Rejected — massive scope, Postgres-custom-image (pg_partman clang pinning,
ADR-029) would need full re-validation, zero benefit for services that
don't issue outbound HTTPS.

### Consequences

**Positive:**

- Entire class of musl-DNS bugs is eliminated for Node runtimes, not just
  the Microsoft OAuth case. Any future third-party HTTPS integration
  (Stripe, SendGrid, S3, external OIDC providers) is insulated by default.
- glibc implements EDNS0, TCP fallback, and RFC-compliant `AF_UNSPEC`
  dual-stack ordering — matches the behaviour of most production Node
  deployments (Vercel, Railway, Fly.io, Kubernetes Debian-based images).
- `fetch`/undici's default DNS path now works without runtime flags.

**Negative:**

- Per-image size increase ~100 MB (Alpine ~180 MB → Debian slim ~280 MB)
  for the 2 Node images. Absolute total ~200 MB added to disk. Acceptable.
- Switch from `apk` to `apt-get` syntax and from `addgroup`/`adduser` to
  `groupadd`/`useradd` in 3 Dockerfiles. One-off churn.
- Anonymous `node_modules` volume drift (§Troubleshooting) must be resolved
  on first container start after the base change — existing anon volumes
  contain musl-built `.pnpm` store metadata that is ABI-incompatible with
  glibc (native addons would break; pure-JS is fine but the `.pnpm` store
  records the build environment). Recovery: `docker-compose rm -fv
backend deletion-worker` (removes stopped containers + their anonymous
  volumes, spares named external volumes).

**Neutral:**

- The CI pin-guard from Amendment 2026-04-08 continues to pass: the tag
  `24.14.0-bookworm-slim` matches the `:[^[:space:]]*[0-9]+\.[0-9]+`
  whitelist regex (contains `24.14.0`).
- Dependabot's `docker-compose` ecosystem now tracks the new tag
  automatically.

### Post-Migration Incident (2026-04-16) — Anonymous Volume Data Loss

Following the Alpine→Debian migration, a volume cleanup step incorrectly
removed the named external data volumes `assixx_postgres_data` and
`assixx_redis_data`:

```bash
# The §Troubleshooting recovery procedure (current text, circa 2026-04-08)
docker volume ls -q -f dangling=true | xargs -r docker volume rm
```

**This command does NOT spare named volumes.** Docker's `dangling=true`
filter matches any volume not currently attached to a running container,
including named external volumes when the stack is `down`. Rerun from a
cold stack (as the §Troubleshooting procedure prescribes) will therefore
list both the anonymous `node_modules` volumes AND the named Postgres/Redis
data volumes as "dangling", and `xargs docker volume rm` will remove all
of them.

**Recovery actually used:** Postgres data restored from
`database/backups/full_backup_pre_oauth_phase1_20260416_160338.dump` via
`pg_restore -U assixx_user -d assixx --no-owner`. Redis data regenerated
(cache + rate-limit counters + connection tickets — tolerable reset).

**Documentation correction (applied in this amendment):** the
§Troubleshooting recovery snippet should use an exclusion filter:

```bash
# Safe: remove only hex-named (anonymous) dangling volumes, spare named ones
docker volume ls -q -f dangling=true | grep -vE '^assixx_' | xargs -r docker volume rm
```

or, more scoped and without grep filtering, target the specific services:

```bash
# Safest: rm -fv operates only on the listed compose services' containers
# and removes only THEIR anonymous volumes. Named external volumes untouched.
doppler run -- docker-compose stop backend deletion-worker
doppler run -- docker-compose rm -fv backend deletion-worker
doppler run -- docker-compose up -d backend deletion-worker
```

Both forms are now the canonical recovery. The original bare
`docker volume ls -f dangling=true | xargs rm` form is forbidden —
it is not safe when named volumes have been detached from running
containers for any reason (cold stack, compose version upgrade,
inspection).

### File Changes

| File                               | Change                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `docker/Dockerfile.dev`            | `alpine3.22` → `bookworm-slim`; `apk add curl jq` → `apt-get install`; header comment links musl-bug refs                    |
| `docker/Dockerfile` (backend prod) | Same base swap; `apk add dumb-init`/`addgroup`/`adduser` → `apt-get install dumb-init`/`groupadd`/`useradd -r --no-log-init` |
| `docker/Dockerfile.frontend`       | Same swap in both builder + production stages                                                                                |
| `docker/docker-compose.yml`        | Build-arg fallbacks for `NODE_VERSION_DEV` and `NODE_VERSION_PROD` → `24.14.0-bookworm-slim`                                 |
| `docker/.env`                      | `NODE_VERSION_DEV` + `NODE_VERSION_PROD` → `24.14.0-bookworm-slim`                                                           |
| `ADR-008`                          | Example snippets updated (see ADR-008 changelog 2026-04-16)                                                                  |
| `ADR-029`                          | Cross-ref note added re: "Debian verworfen" trade-off scope                                                                  |

### Verification

```bash
# Container libc is glibc, not musl
docker exec assixx-backend sh -c 'ldd --version | head -1'
  # → ldd (Debian GLIBC 2.36-9+deb12u13) 2.36

# Default DNS path returns dual-stack with IPv4 present
docker exec assixx-backend node -e \
  'require("dns").lookup("login.microsoftonline.com",{all:true},(e,r)=>{
     const f={};(r||[]).forEach(a=>f[a.family]=(f[a.family]||0)+1);
     console.log(f)
   })'
  # → { '4': 194, '6': 200 }

# OAuth token endpoint reachable — HTTP 400 with Microsoft error is SUCCESS
# (proves the connection path; only the dummy grant_type=test is rejected)
docker exec assixx-backend node -e \
  'fetch("https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
         {method:"POST",
          headers:{"Content-Type":"application/x-www-form-urlencoded"},
          body:"grant_type=test"})
    .then(async r => console.log("HTTP", r.status, (await r.text()).slice(0,80)))
    .catch(e => console.log("ERR", e.message, e.cause?.code))'
  # → HTTP 400 {"error":"unsupported_grant_type","error_description":"AADSTS70003:…
```

All three probes pass. The OAuth happy path (Microsoft token exchange +
`jose` JWKS verification) now completes without any runtime workaround.

---

## Amendment 2026-04-27: npm Parameterisation (Stage 1 Pinning Extended)

### Context

The 2026-02-28 Decision §7 "Version Standardization" parameterised pnpm via
`ARG PNPM_VERSION` in all three Dockerfiles, but kept npm hardcoded as
`npm@11.9.0` across **5 occurrences** in 3 files (`Dockerfile.dev:42`,
`Dockerfile:34, 83`, `Dockerfile.frontend:25, 101`).

A routine version audit (2026-04-27) showed `npm view npm version` →
`11.13.0` while images still pinned `11.9.0` — 4 patch versions of drift.
Patch releases of npm routinely contain security fixes in the bundled
dep tree (`glob`, `tar`, `cacache`, `node-gyp`); CVE-2025-64756 — the
original reason this ADR pinned npm at all — was exactly that class.
Hardcoded-but-unparameterised npm therefore violates the same Stage 1
reproducibility discipline that Amendment 2026-04-07 formalised for
image tags: a value pinned in 5 scattered RUN lines is auditable but
not maintainable, and Dependabot can't see it.

### Decision

Mirror the `PNPM_VERSION` pattern: introduce `ARG NPM_VERSION` in every
Dockerfile that bootstraps npm globally, supply the value via compose
`build.args`, and store the canonical version in `docker/.env` (the
existing Single Source of Truth for build-time versions).

| File                         | Change                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `docker/.env`                | `+ NPM_VERSION=11.13.0`                                                                   |
| `docker/docker-compose.yml`  | `+ NPM_VERSION: ${NPM_VERSION:-11.13.0}` in both `build.args` blocks (backend + frontend) |
| `docker/Dockerfile.dev`      | `+ ARG NPM_VERSION=11.13.0`; RUN uses `npm@${NPM_VERSION}`                                |
| `docker/Dockerfile`          | `+ ARG NPM_VERSION=11.13.0` in builder + production stages; both RUNs parameterised       |
| `docker/Dockerfile.frontend` | `+ ARG NPM_VERSION=11.13.0` in builder + production stages; both RUNs parameterised       |

### Rationale

1. **Consistency with pnpm.** §7 of the 2026-02-28 decision parameterised
   pnpm; leaving npm hardcoded was an oversight rooted in treating npm as
   "just the pnpm bootstrap" rather than a tracked build dependency.
2. **CVE tracking surface.** The `npm install -g pnpm` step runs as root.
   Any CVE in npm's bundled deps (e.g., CVE-2025-64756 on `glob`) is in
   scope at image build. Centralising the version in `docker/.env` makes
   bumps a one-line review instead of a 5-line search.
3. **Dependabot reach.** The `docker-compose` ecosystem (Amendment
   2026-04-08 §2) tracks `image:` tags AND `build.args`. Moving npm to a
   build-arg makes it visible to the same scanner that already PRs Node
   and pnpm bumps. Hardcoded `npm@X.Y.Z` inside a Dockerfile RUN line is
   opaque to it.
4. **No CI guard breakage.** The Stage 1 pin-guard regex (Amendment
   2026-04-08 §1) inspects only `image:` and `FROM` lines — ARG/RUN are
   out of scope. Verified: pin-guard passes unchanged.

### Scope: NOT Closed by This Amendment

- **Custom-named Dockerfiles still untracked by Dependabot's `docker`
  ecosystem** (Amendment 2026-04-08 §"Known Gaps" #1). Mitigation is
  unchanged: the canonical `NPM_VERSION` lives in `docker/.env` and
  `docker-compose.yml` `build.args`, both of which the `docker-compose`
  ecosystem tracks. The `ARG NPM_VERSION=11.13.0` default inside each
  Dockerfile is the fallback for standalone `docker build` invocations
  (e.g., CI's `docker-build-verification` job which builds the production
  `docker/Dockerfile` without compose). Defaults must be bumped manually
  alongside `docker/.env` until Renovate is adopted.
- **npm itself remains required at runtime in production images.**
  ADR-027 §"Negative Consequences" #2 still holds — corepack stabilisation
  or `pnpm deploy` adoption for the backend is the path to remove npm
  entirely. Out of scope here.

### Verification

```bash
# 1. No hardcoded npm@11.9.0 references remain
grep -n "npm@11" docker/Dockerfile*
  # → no output (PASS)

# 2. Parameterisation present everywhere expected
grep -nc "NPM_VERSION" docker/Dockerfile* docker/.env docker/docker-compose.yml
  # docker/Dockerfile:5  (2× ARG, 2× RUN, 1× comment)
  # docker/Dockerfile.dev:3
  # docker/Dockerfile.frontend:5
  # docker/.env:1
  # docker/docker-compose.yml:2

# 3. CI pin-guard still passes (Amendment 2026-04-08 §1)
grep -E '^\s*(image:\s*\S+|FROM\s+\S+)' docker/docker-compose*.yml docker/Dockerfile* \
  | grep -vE 'assixx-(backend|frontend|postgres):' \
  | grep -vE ':[^[:space:]]*[0-9]+\.[0-9]+|@sha256:|node:\$\{NODE_VERSION'
  # → no output (PASS)

# 4. End-to-end build (developer must run before merging)
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose --profile production build --no-cache
docker exec assixx-backend npm --version
  # → 11.13.0
```

### Maintenance Workflow Update

The §"Maintenance Workflow" cadence table from Amendment 2026-04-07 is
extended:

| Component         | Cadence                | Rationale                                                                           |
| ----------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| **npm bootstrap** | **Quarterly + on CVE** | Patch-only releases; review npm release notes for `glob`/`tar`/`cacache` advisories |

### File Change Summary

```
docker/.env                — +4 lines (NPM_VERSION + 3 lines comment)
docker/docker-compose.yml  — +6 lines (NPM_VERSION build.args, both blocks)
docker/Dockerfile.dev      — 1 RUN parameterised, ARG added, comment updated
docker/Dockerfile          — 2 RUNs parameterised, ARG added per stage
docker/Dockerfile.frontend — 2 RUNs parameterised, ARG added per stage
```

---

## Amendment 2026-04-28: Compose wiring for the production `Dockerfile` (profile split)

### Context

Amendment 2026-04-27 implemented `pnpm deploy --filter=assixx-backend --prod /deploy` in the production `Dockerfile`. The Dockerfile was built that way, **but it was not wired into `docker-compose.yml`**: the `backend:` service still pointed at `Dockerfile.dev` for every profile, including `--profile production`. Consequences:

| Consequence                                      | Impact                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Local `--profile production` ≠ CI                | CI builds `Dockerfile`, locally `Dockerfile.dev` is built → no real production parity |
| Backend container compiles TS at container start | `start_period: 120s` healthcheck grace, ~60–120 s cold start                          |
| Image size                                       | `assixx-backend:dev` ≈ 1.27 GB (full devDependencies, ripgrep/curl/jq, source mounts) |
| Production smoke impossible                      | Memory footprint, signal handling, dumb-init etc. only verifiable in CI               |

The verification table of the original ADR (2026-02-28) already listed `assixx-backend:dev` as the production image — known gap, but flagged as a stale entry. With the 2026-04-27 `pnpm deploy` refactor the production Dockerfile was finished — only the compose wiring was missing.

### Decision

The `backend:` service in `docker/docker-compose.yml` is split into **two** service definitions, separated by profiles:

| Service                | Dockerfile                     | Image                 | Profile        | Use case                                  |
| ---------------------- | ------------------------------ | --------------------- | -------------- | ----------------------------------------- |
| `backend`              | `docker/Dockerfile.dev`        | `assixx-backend:dev`  | `[dev]`        | Live reload, volume mounts, TS at startup |
| `backend-prod`         | `docker/Dockerfile`            | `assixx-backend:prod` | `[production]` | Multi-stage, `pnpm deploy`, dist in image |
| `deletion-worker`      | (reuses `assixx-backend:dev`)  | ditto                 | `[dev]`        | As before                                 |
| `deletion-worker-prod` | (reuses `assixx-backend:prod`) | ditto                 | `[production]` | Production worker with prod image         |

**Network alias `backend` on `backend-prod`**: so that `frontend.API_URL=http://backend:3000/api/v2` and `nginx.proxy_pass http://backend:3000` work without hostname renaming. The service name `backend-prod` is internal, consumers still see `backend`.

`frontend.depends_on` and `nginx.depends_on` point to `backend-prod` (not `backend`), so that compose profile resolution for `--profile production` has a complete service graph.

### Default profile via `COMPOSE_PROFILES`

`docker/.env.example` sets `COMPOSE_PROFILES=dev` as the default. With this `docker-compose up -d` works without an explicit `--profile` flag as before (backend = dev mode). Production is activated via `docker-compose --profile production up -d` (overrides env).

### Verification (2026-04-28)

Smoke test after `--no-cache` build + `--profile production up -d`:

| Probe                                   | Before (`Dockerfile.dev` for prod)         | After (`Dockerfile` for prod)                        |
| --------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| `docker inspect assixx-backend → Image` | `assixx-backend:dev`                       | `assixx-backend:prod` ✅                             |
| `curl /health → environment`            | `development`                              | `production` ✅                                      |
| Backend container user                  | `${UID:-1000}:${GID:-1000}` (host mapping) | UID/GID 1001 (`nodejs` from the Dockerfile) ✅       |
| Cold-start `/health`                    | ~60–120 s (TS compile at start)            | ~11 s (dist in the image) ✅                         |
| Image size                              | 1.27 GB                                    | **615 MB (52% smaller)** ✅                          |
| ADR-027 pin-guard CI check              | PASS                                       | PASS (new tags `assixx-backend:prod` whitelisted) ✅ |
| `pnpm deploy /deploy/node_modules`      | not built                                  | 382 packages, hard-copied ✅                         |

### Network alias pattern

```yaml
backend-prod:
  networks:
    assixx-network:
      aliases:
        - backend # so frontend's API_URL=http://backend:3000 stays unchanged
```

This pattern has two advantages over renaming the hostname for all consumers:

1. **`nginx.conf` stays unchanged** — `proxy_pass http://backend:3000` keeps working
2. **`frontend.environment.API_URL`** does not need to be conditional (would require `--profile`-specific env values)

Trade-off: service name `backend-prod` and network alias `backend` diverge slightly. Acceptable because documented and internal only.

### Breaking change & mitigation

`docker-compose up -d` without `--profile` and without `COMPOSE_PROFILES` env now only starts services without a profile (`postgres`, `redis`). Backend needs `--profile dev` explicitly or an env setting.

**Mitigation:** `docker/.env.example` sets `COMPOSE_PROFILES=dev` as the default. Existing users with their own `docker/.env` must migrate once:

```bash
echo "COMPOSE_PROFILES=dev" >> docker/.env
# Optionally with observability:
echo "COMPOSE_PROFILES=dev,observability" >> docker/.env
```

Without that step `docker-compose up -d` would only start postgres+redis — clearly visible, no silent failure.

### Switching between dev and production

Since both backends use the same `container_name: assixx-backend` and port `3000:3000` (XOR via profile), they cannot run at the same time. Switch:

```bash
# Dev → prod
docker-compose --profile dev stop backend deletion-worker
docker-compose --profile dev rm -f backend deletion-worker
docker-compose --profile production up -d

# Prod → dev
docker-compose --profile production stop backend-prod deletion-worker-prod frontend nginx
docker-compose --profile production rm -f backend-prod deletion-worker-prod frontend nginx
docker-compose --profile dev up -d
```

Non-backend services (postgres, redis, observability) are kept across switches by profile sharing (`profiles: [observability, production]`) and do not need to be restarted.

### Anonymous volume drift

§Troubleshooting (Amendment 2026-04-08) still applies: after a switch from dev to prod and back, the dev backend's anonymous `/app/node_modules` volume can be ABI-incompatible with the current `pnpm-lock.yaml`. Recovery (see ADR-027 §Troubleshooting):

```bash
docker-compose --profile dev stop backend deletion-worker
docker-compose --profile dev rm -fv backend deletion-worker  # -v removes anonymous volumes
docker-compose --profile dev up -d
```

`-fv` is safe here: it only removes the containers of the listed services and their anonymous volumes. Named external volumes (`assixx_postgres_data`, `assixx_redis_data`) are untouched.

### Alternatives Considered

**1. Override file (`docker-compose.prod.yml`).** Compose-native override pattern: `docker-compose -f base.yml -f prod.yml up -d`. Rejected because the repo already established `--profile production` as the convention (for the frontend + nginx stack); two parallel override mechanisms would be inconsistent.

**2. `target: ${BACKEND_TARGET:-dev}` in a single-stage service.** Would have required merging `Dockerfile.dev` and `Dockerfile` into a multi-target file. Rejected because of the architectural break (the two Dockerfiles have different build pipelines, merging would increase complexity).

**3. Leave the dev backend without a profile, run the prod backend on port 3010.** Would have allowed both backends at the same time. Rejected because the nginx reverse proxy routes to `backend:3000` (service DNS) — production parity would only be possible with a separate nginx config. The profile split is cleaner.

### Consequences

**Positive:**

- Local `--profile production` is 1:1 equivalent to the CI production pipeline (`integration-test-docker-compose` job in `.github/workflows/docker-image-build.yml`)
- 52% smaller image in production (615 MB instead of 1.27 GB) — fewer CVEs in Trivy scan, faster container pulls
- ~60–110 s faster cold start (no TS compile at container start)
- Production smoke test (memory, signal handling, dumb-init, non-root nodejs:1001 user) verifiable locally
- ADR-027 compliant (pin-guard PASS, all strict requirements met)

**Negative:**

- Breaking change: `docker-compose up -d` without a profile no longer starts a backend. Mitigated via the `.env.example` default `COMPOSE_PROFILES=dev`, but existing users with their own `.env` must migrate once.
- Switching between dev and prod requires `stop` + `rm` of the inactive backend variant (otherwise container_name conflict).
- The compose file is now ~150 lines longer (two additional service definitions with the full env list).

**Neutral:**

- ADR-027 §"Verification (2026-02-28)" table stays correct for the `--profile dev` default; production mode now has its own verification table (see above).
- ADR-027 §"Stage 2 trigger conditions" stays unchanged (digest pinning remains deferred).

### File change summary

```
docker/docker-compose.yml  — +156 lines (backend-prod + deletion-worker-prod)
                              ~10 lines mod (profiles: [dev], depends_on backend-prod)
docker/.env.example        — +12 lines (COMPOSE_PROFILES=dev block + comment)
```

### Maintenance workflow update

The `§"Maintenance Workflow"` cadence table is extended by:

| Component                | Cadence              | Rationale                                                                           |
| ------------------------ | -------------------- | ----------------------------------------------------------------------------------- |
| **Profile verification** | **Per compose edit** | When adding new services: set profile + check the depends_on graph in both profiles |

---

## Amendment 2026-04-28 (b): Dev-backend hot-reload pipeline (incremental tsc + nodemon)

### Context

With the 2026-04-28 (a) profile split, the dev backend (`assixx-backend:dev`, profile `[dev]`) became the only container with source mounts (`../backend:/app/backend:delegated`). **However:** the `command:` chain `pnpm exec tsc && node dist/nest/main.js` was a one-shot build — every source edit required `docker-compose --profile dev restart backend` (60–90 s cold tsc + boot). The `DOCKER-SETUP.md` claim "with live reload" was therefore factually wrong.

The obvious "quick fix" hypothesis: nodemon + tsx (developed for exactly this use case, both already in `backend/package.json` devDeps). **Empirically verified 2026-04-28 that this does NOT work with NestJS.**

### Empirical validation tsx + NestJS DI

Direct boot with `pnpm exec tsx src/nest/main.ts` (Node 24.15, tsx 4.21 with bundled esbuild 0.27.7) breaks reproducibly:

```
Nest can't resolve dependencies of the ShiftHandoverEntriesService (?, Symbol(SHIFT_HANDOVER_CLOCK)).
- The dependency at index [0] appears to be undefined at runtime
```

Index [0] is `DatabaseService`, imported as `import { DatabaseService } from '../database/database.service.js'` (no `import type`). `tsconfig.emitDecoratorMetadata: true` and `experimentalDecorators: true` are both set. Even so, NestJS sees undefined as the constructor param type.

**Root-cause theory:** esbuild 0.21+ supports `emitDecoratorMetadata` in principle but has documented gaps for cross-package and cross-module type references. For simple classes it works; for complex service constructor chains in a large NestJS codebase (multiple modules, Inject tokens, service-service deps) the metadata emission fails in places. The NestJS DI container then sees `undefined` for the missing param-type metadata and cannot resolve.

**Verdict:** the team-veto comment in the pre-refactor `docker-compose.yml` (_"tsc for decorator metadata - tsx can't emit it"_) is substantially correct — even if the wording "can't emit it" is technically dated. Empirical evidence trumps theory.

### Naive option-B trap

First refinement idea:

```yaml
command: sh -c "tsc && tsc -w & sleep 30 && exec node --watch dist/nest/main.js"
```

Four problems:

1. `sleep 30` is blind — cold tsc can take >30s → node starts with an empty dist/ → crash
2. `node --watch` reacts per file change → tsc emits files one by one → mid-emit restart → import error
3. `& sleep && exec` orphans `tsc -w` after `exec` (no trap, no `wait`)
4. No `set -e` — a failed step does not abort

### Decision

```yaml
# docker/docker-compose.yml — backend.command
command:
  - sh
  - -c
  - |
    set -e
    pnpm --filter @assixx/shared run build
    cd backend
    pnpm exec tsc                                    # initial blocking build
    pnpm exec tsc -w --preserveWatchOutput &         # background incremental
    exec pnpm exec nodemon --watch dist --delay 1500ms dist/nest/main.js
```

Key properties:

- **`set -e`** stops the chain on any failed step
- **Initial blocking `tsc`** guarantees a fully populated `dist/` before nodemon starts (no race)
- **`tsc -w`** then runs in the background and only emits changed files (~1 s)
- **`nodemon --watch dist --delay 1500ms`** waits 1.5 s after the last dist change before restarting — gives tsc time to finish multi-file emits
- **`exec nodemon`** makes nodemon PID 1 → correct SIGTERM handling on `docker stop`
- **Both tools already installed:** tsc was active before, nodemon is in `backend/package.json` devDeps for `pnpm run dev` — no new dependency

### ADR-027 §3 anonymous volume — not triggered

The 2026-04-08 anonymous-volume EACCES trap (see §"Amendment 2026-04-08") triggers when the container mutates `/app/node_modules` at runtime (root-owned by image, runtime user UID 1000). This path **only writes to `/app/backend/dist`** (host-mounted, writable by UID 1000). Reading the nodemon binary from `node_modules/.bin/` works with the `o+x` bit. Anonymous volume stays untouched. ✓

### Verification (2026-04-28)

| Probe                                              | Before               | After              |
| -------------------------------------------------- | -------------------- | ------------------ |
| Cold boot to `/health` 200                         | ~60–90 s             | ~13 s ✅           |
| Source edit → backend ready (`uptime` reset)       | ~60–90 s (`restart`) | **~4.5 s** auto ✅ |
| Incremental tsc rebuild on a 1-file change         | full ~60 s           | ~1 s ✅            |
| NestJS DI graph bootstrap                          | ✓ (tsc)              | ✓ (tsc)            |
| Anonymous volume `/app/node_modules` mutated?      | no                   | **no** ✅          |
| `nodemon` debounce (1500 ms) absorbs mid-emit race | n/a                  | ✓                  |

Empirical steps: `docker-compose --profile dev up -d backend` → `curl /health` → `echo "// probe" >> backend/src/nest/main.ts` → `docker logs -f assixx-backend` shows "File change detected" + "Found 0 errors" + NestJS re-bootstrap → `curl /health` shows fresh `uptime` (~2.6 s, not ~70 s of the old instance).

### Trade-offs

**Positive:**

- The hot-reload promise of `DOCKER-SETUP.md` is now true
- Dev iteration ~15× faster (4.5 s instead of 60–90 s)
- No new dependency (tsc + nodemon already installed)
- Strict tsc remains the compiler — zero DI risk (NestJS metadata complete)
- ADR-027 §3 (anonymous volume) NOT triggered
- ADR-041 strict-everywhere policy untouched (same tsc, same tsconfig)

**Negative:**

- `tsc -w` consumes ~200 MB RAM in the background (in addition to the NestJS process)
- A nodemon restart performs a full NestJS bootstrap (~2 s) — faster than `docker restart`, but not as fast as SvelteKit HMR (which preserves state)
- `tsc -w` as a background child of nodemon does receive SIGTERM on `docker stop`, but cleanup is not trap-explicit. Within the `docker stop` grace period (default 10 s) both processes finish cleanly.

**Neutral:**

- `start_period: 120s` healthcheck grace stays — the first cold build without `dist/` still needs the grace
- `DOCKER-SETUP.md` L89 "with live reload" is now accurate (was factually wrong before)

### File change summary

```
docker/docker-compose.yml — backend.command (one-shot tsc + node) → tsc + tsc-watch + nodemon
                            ~30 lines block comment with rationale + cross-refs
```

### Remaining follow-ups (from this investigation)

1. **`docker-compose.yml:198`** mounts `../nodemon.json` as a directory (host path is an empty root-owned dir, Apr 6). Dead mount, not handled by this amendment. Separate cleanup ticket: either remove the mount line or create a real nodemon config file.
2. **`Dockerfile.dev` L46 chown -R for `/app/node_modules`** (ADR-027 §3a future work) remains open, but is no longer hot-reload-blocking — lower priority.

---

## Amendment 2026-04-28 (c): UID system-range warning + apt cache mounts

Two local hardening / speed improvements from the same session.

### 1. `useradd --system` removed — `SYS_UID_MAX 999` warning gone

**Finding.** `useradd -r -u 1001 ...` (backend prod, frontend prod) marked the
app user as a system user AND assigned UID 1001 > Debian's `SYS_UID_MAX=999`.
useradd logged on every build:

```
nodejs's uid 1001 outside of the SYS_UID_MIN 100 and SYS_UID_MAX 999 range.
```

The condition for the warning is the combination `is_system_user AND uid > SYS_UID_MAX` — only one of the two needs to flip for the warning to disappear.

**Fix.** Drop `-r`, keep UID 1001 (volume compatibility intact, all
`COPY --link --chown=1001:1001` statements unchanged). The hardening that `-r`
implicitly provided is set explicitly:

```dockerfile
groupadd -g 1001 nodejs
useradd  -u 1001 -g nodejs -M -s /usr/sbin/nologin --no-log-init nodejs
```

| Flag                   | Replaces what `-r` provided              |
| ---------------------- | ---------------------------------------- |
| `-M`                   | implicit "no home directory"             |
| `-s /usr/sbin/nologin` | interactive login disabled               |
| `--no-log-init`        | stays — prevents the lastlog sparse file |

**Rejected alternative.** Lower the UID to ≤ 999 + keep `-r`: would have broken
all `--chown=1001:1001` statements + existing volume ownership. Too expensive
for a pure log-cleanup improvement.

**Files:** `docker/Dockerfile`, `docker/Dockerfile.frontend`. `Dockerfile.dev`
not affected (no useradd; runs as root for source mounts, OK in dev).

### 2. BuildKit cache mounts for `apt` in all 3 Dockerfiles

**Finding.** `apt-get update + install` took 45–129 s per stage —
mirror latency, every build re-downloads indexes + `.deb` files.

**Fix.** Pattern from
[docs.docker.com/build/cache/optimize](https://docs.docker.com/build/cache/optimize/#use-cache-mounts):

```dockerfile
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update \
    && apt-get install -y --no-install-recommends <pkgs>
```

Two non-obvious mandatory steps:

- **Add `rm -f /etc/apt/apt.conf.d/docker-clean`** — otherwise the Debian base
  purges its own `.deb` downloads via `DPkg::Post-Invoke`, the cache stays empty.
- **Remove `rm -rf /var/lib/apt/lists/*`** — it would empty the cache.
  Counter-intuitive but mandatory: cache-mount contents do NOT land in the
  image layer (BuildKit property, `type=cachemount` ≠ layer storage),
  therefore no bloat without an explicit `rm`.

**Win profile:**

| Scenario                             | Win                               |
| ------------------------------------ | --------------------------------- |
| Layer cache hit (RUN line unchanged) | 0 s (regular layer cache applies) |
| `--no-cache` locally                 | 45–129 s → 3–10 s per apt stage   |
| RUN line changed (new package)       | ~30–60 s saved                    |
| GitHub Actions / fresh CI runner     | 0 s without `cache-to/from` setup |

`sharing=locked` (instead of the default `shared`) chosen: serializes parallel
builds at the cache → robust against apt lock races. Costs nothing in serial
`docker-compose build` workflows.

**Files:** all 3 Dockerfiles. `# syntax=docker/dockerfile:1` was already
present in all of them — no toolchain prerequisites.

### Verification

```bash
# 1. Initial fill — cache empty, similar to previous time
time doppler run -- docker-compose --profile production build --no-cache backend-prod

# 2. Cache materialised?
docker buildx du --filter type=exec.cachemount

# 3. Win measurement — invalidate the RUN line (whitespace edit), then:
time doppler run -- docker-compose --profile production build backend-prod
# Expectation: apt stage 3–10 s instead of 45–129 s

# 4. Image size unchanged? (sanity check for "mount not in the layer")
docker image ls assixx-backend:prod
# Expectation: ±0.1 % vs. pre-cache-mount patch
```

### Pin-guard / CI

Both changes are orthogonal to the pin-guard (Amendment 2026-04-08).
Image size is within ±0.1 % — no impact on size budget or CVE scan timing.

---

## References

- [Docker Build Best Practices](https://docs.docker.com/build/building/best-practices/)
- [Docker Build Cache Optimization](https://docs.docker.com/build/cache/optimize/)
- [Dockerfile Reference](https://docs.docker.com/reference/dockerfile/)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Build Secrets](https://docs.docker.com/build/building/secrets/)
- [Docker Scout Security Policies](https://docs.docker.com/scout/policy/)
- [ADR-008: Dependency Version Management](./ADR-008-dependency-version-management.md) — Node/pnpm version strategy
- [ADR-013: CI/CD Pipeline Hardening](./ADR-013-ci-cd-pipeline-hardening.md) — Build pipeline context, Trivy scanning
