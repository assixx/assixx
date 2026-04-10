# ADR-027: Dockerfile Hardening (Performance, Security, Best Practices)

| Metadata                | Value                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| **Status**              | Amended                                                                                          |
| **Date**                | 2026-02-28 (amended 2026-04-07, 2026-04-08)                                                      |
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

## References

- [Docker Build Best Practices](https://docs.docker.com/build/building/best-practices/)
- [Docker Build Cache Optimization](https://docs.docker.com/build/cache/optimize/)
- [Dockerfile Reference](https://docs.docker.com/reference/dockerfile/)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Build Secrets](https://docs.docker.com/build/building/secrets/)
- [Docker Scout Security Policies](https://docs.docker.com/scout/policy/)
- [ADR-008: Dependency Version Management](./ADR-008-dependency-version-management.md) — Node/pnpm version strategy
- [ADR-013: CI/CD Pipeline Hardening](./ADR-013-ci-cd-pipeline-hardening.md) — Build pipeline context, Trivy scanning
