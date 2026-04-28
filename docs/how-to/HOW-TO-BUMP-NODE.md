# HOW-TO: Bump Node.js Version

> Reproducible guide for Node.js version bumps (minor/patch → scoped here, major → see §Major Upgrade).
> Last updated: 2026-04-23 (first written during the 24.14.0 → 24.15.0 bump).

---

## TL;DR

1. **Pre-Check** the release notes + verify the Docker Hub tag exists
2. **Edit 12 files** (10 config/code + 2 docs) — grep-replace the version string
3. **User-side:** `nvm install` + full `docker-compose build --no-cache` + `validate:all` + e2e + k6 smoke

Three ADRs (008, 027, 041) are intentionally **not** rewritten — they are historical. If the bump introduces a new policy, write an amendment, do not rewrite.

---

## Pre-Check (Mandatory — ~2 minutes)

### 1. Read the release notes

Open `https://nodejs.org/en/blog/release/v<VERSION>`. Confirm:

- **LTS status** — we only ship LTS to prod
- **Breaking changes** — rare on minor/patch, but deprecations sometimes become hard-errors (e.g. `downlevelIteration` in TS 6.0 is not Node's fault but the same class of surprise can happen)
- **Relevant security fixes** — crypto, http/2, fs, net are the ones that usually touch us

### 2. Verify the Docker Hub tag exists

Do not trust release notes or docs — they lie. Hit the Hub v2 API directly (see `memory/feedback_docker_image_tag_verification.md`):

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://hub.docker.com/v2/repositories/library/node/tags/<VERSION>-bookworm-slim/"
# 200 = tag exists, continue.
# 404 = try the next patch (e.g. x.y.1 instead of x.y.0), do not invent a tag.
```

**Base image family:** `bookworm-slim` (glibc), **NOT Alpine**. Reason: ADR-027 Amendment 2026-04-16 — musl DNS failure class with Docker's embedded DNS broke every outbound `fetch()` from the backend container. Non-Node images (postgres, redis, nginx) stay on Alpine because they have no outbound HTTPS.

### 3. Scan ADRs for fresh policies

Skim the following if they have been updated since the last bump:

- **ADR-008** — single source of truth in `docker/.env`, `--frozen-lockfile`, dependencies vs devDependencies
- **ADR-027** — digest pinning is deferred (version tag is sufficient), `bookworm-slim` is mandatory for Node images, `dumb-init` in prod images
- **ADR-041** — strict-everywhere policy on `tsconfig.*`, `lib: ES2024`, type-import rules. If `engines.node` jumps a major, the `lib`/`target` line may need to follow.

---

## Files to Touch

Canonical grep sweep — run this **before** and **after** the edit to prove completeness:

```bash
OLD=24.14.0   # set to the current version
grep -rn --include="*.json" --include="*.js" --include="*.mjs" --include="*.ts" \
         --include="*.yml" --include="*.yaml" --include="Dockerfile*" \
         --include=".nvmrc" --include="*.md" \
         -E "$OLD" /home/scs/projects/Assixx \
  | grep -v node_modules | grep -v ".svelte-kit" | grep -v "pnpm-lock" \
  | grep -v "/dist/" | grep -v "coverage/" | grep -v "infrastructure/adr/"
```

After the edit, this command must print **zero lines**. (ADRs are excluded on purpose — they capture historical state.)

### Code & Config (10 files)

| #   | File                                        | Pattern                                                              |
| --- | ------------------------------------------- | -------------------------------------------------------------------- |
| 1   | `.nvmrc`                                    | single line — the bare version                                       |
| 2   | `package.json`                              | `"engines": { "node": ">=<VERSION>" }`                               |
| 3   | `backend/package.json`                      | `"engines": { "node": ">=<VERSION>" }`                               |
| 4   | `docker/.env`                               | `NODE_VERSION_PROD` + `NODE_VERSION_DEV` → `<VERSION>-bookworm-slim` |
| 5   | `docker/Dockerfile`                         | `ARG NODE_VERSION=<VERSION>-bookworm-slim`                           |
| 6   | `docker/Dockerfile.dev`                     | `ARG NODE_VERSION=<VERSION>-bookworm-slim`                           |
| 7   | `docker/Dockerfile.frontend`                | 2× `ARG NODE_VERSION=` (builder + runtime stage)                     |
| 8   | `docker/docker-compose.yml`                 | 2× `NODE_VERSION: ${..:-<VERSION>-bookworm-slim}` fallback defaults  |
| 9   | `.github/workflows/code-quality-checks.yml` | 4× `node-version: "<VERSION>"`                                       |
| 10  | `.vscode/settings.json`                     | `eslint.runtime: "/home/scs/.nvm/versions/node/v<VERSION>/bin/node"` |

### Documentation (2 files)

| #   | File                                         | Note                        |
| --- | -------------------------------------------- | --------------------------- |
| 11  | `docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md` | Version-Tabelle (~Line 407) |
| 12  | `docs/plans/FASTIFY-PLAN.md`                 | inline version mention      |

### DO NOT TOUCH

- `docs/infrastructure/adr/ADR-008-dependency-version-management.md`
- `docs/infrastructure/adr/ADR-027-dockerfile-hardening.md`
- `docs/infrastructure/adr/ADR-041-typescript-compiler-configuration.md`

ADRs are decisions frozen at their date. A bump that introduces a new constraint (SHA-pinning, base-image-family switch, lib bump) warrants a **new ADR or amendment**, not a retroactive edit of old ones.

---

## User-Side Commands

```bash
# ─── 1. Local Node via nvm ───────────────────────────────────────────────
source ~/.nvm/nvm.sh
nvm install <NEW>
nvm alias default <NEW>
nvm use <NEW>
nvm uninstall <OLD>       # keep the toolchain clean

# ─── 2. Docker full rebuild (base image changed) ─────────────────────────
# Profile-System (ADR-027 Amendment 2026-04-28): nur Services mit `build:`
# Block werden gebaut. deletion-worker/deletion-worker-prod reusen das
# backend-Image (kein eigener build:), daher NICHT extra zu bauen.
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose --profile dev build --no-cache backend
doppler run -- docker-compose --profile production build --no-cache backend-prod frontend

# ─── 3. Start containers ─────────────────────────────────────────────────
# .env Default `COMPOSE_PROFILES=dev,observability` → `up -d` startet beide
doppler run -- docker-compose up -d
# Explizit (überschreibt .env):
doppler run -- docker-compose --profile dev --profile observability up -d

# ─── 4. Quick smoke ──────────────────────────────────────────────────────
node -v                                     # → v<NEW>
docker exec assixx-backend node -v          # → v<NEW>
curl -s http://localhost:3000/health | jq .

# ─── 5. Full validation — all must be 0 errors ───────────────────────────
pnpm run validate:all       # format + lint + type-check + svelte-check + stylelint
pnpm run test:api           # API integration (Tier 2)
pnpm run test:unit          # Unit tests
pnpm run test:e2e           # Playwright smoke (Tier 3)
pnpm run test:load:smoke    # k6 smoke — checks rate must be 100%

# ─── 6. VS Code ──────────────────────────────────────────────────────────
# Ctrl+Shift+P → "Reload Window" so eslint.runtime picks up the new node binary.
```

---

## Rollback

Every file touched is tracked by git — rollback is one command per side:

```bash
# 1. Files
git restore \
  .nvmrc package.json backend/package.json \
  docker/.env docker/Dockerfile docker/Dockerfile.dev docker/Dockerfile.frontend \
  docker/docker-compose.yml \
  .github/workflows/code-quality-checks.yml \
  .vscode/settings.json \
  docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md docs/plans/FASTIFY-PLAN.md

# 2. Local Node
nvm use <OLD>
nvm alias default <OLD>

# 3. Docker back to old base image (deletion-worker reuses backend image)
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose --profile dev build --no-cache backend
doppler run -- docker-compose --profile production build --no-cache backend-prod frontend
```

---

## Major Upgrade (e.g. 24 → 26)

Minor/patch bumps are mechanical. Majors are not — additional checks:

1. **Peer dependency matrix.** Verify the new major Node LTS is supported by every tool with a `node` peer dep:
   - `@nestjs/*`, `nestjs-zod`
   - `typescript`, `typescript-eslint`
   - `@sveltejs/kit`, `svelte`, `svelte-check`, `vite`
   - `tsx`, `pnpm`
     Template: the compatibility matrix in ADR-041 Phase 3 (TS 5.9 → 6.0).
2. **`lib` / `target` in `tsconfig.base.json`.** New Node major = new ECMAScript APIs native. Consider bumping `lib` (type-checking surface) and possibly `target` (emit semantics — only if you are sure about the Node minimum).
3. **Deprecations.** Read the full changelog from the `X.0.0` release, not just the LTS-promotion post. New majors silently remove deprecated APIs.
4. **Write an ADR or amendment.** Document the decision + the compatibility matrix you verified. Attach the matrix as a table so the next upgrade has a template.
5. **Update `CLAUDE.md`** if the stack section pins a major.
6. **Longer CI run.** Let `validate:all` + all 4 test projects run locally before pushing.

---

## Commit Convention

Minor/patch bump (≥95% of cases):

```
chore: bump Node <OLD> → <NEW> LTS
```

Major bump — write the ADR first, reference it in the commit:

```
chore: bump Node 24 → 26 LTS (see ADR-0XX)
```

**No changeset.** Tooling bumps are not user-facing.

---

## References

- ADR-008 — Dependency Version Management (single source of truth in `docker/.env`)
- ADR-027 — Dockerfile Hardening (base image family, digest pinning deferred)
- ADR-041 — TypeScript Compiler Configuration (lib/target, type-import policy)
- `docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md` — Docker/Nginx architecture
- `docs/COMMON-COMMANDS.md` — validation pipeline
- `memory/feedback_docker_image_tag_verification.md` — verify Hub tags before pinning
