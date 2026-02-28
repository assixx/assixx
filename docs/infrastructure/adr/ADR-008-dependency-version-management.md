# ADR-008: Dependency Version Management (Production vs Development)

| Metadata                | Value                             |
| ----------------------- | --------------------------------- |
| **Status**              | Accepted                          |
| **Date**                | 2026-01-15                        |
| **Decision Makers**     | SCS Technik                       |
| **Affected Components** | Docker, pnpm, package.json, CI/CD |

---

## Context

During the development of Assixx, the question arose of how dependency versions should be handled between production and development:

### Questions

1. **Runtime (Node.js)**: Can/should prod and dev use different Node versions?
2. **NPM Packages**: Can/should prod and dev use different package versions?
3. **Protection**: How do we prevent dev dependencies from ending up in production?

### Existing Setup

- **Package Manager**: pnpm 10.28.0 with workspace
- **Lock File**: One `pnpm-lock.yaml` for the entire project
- **Docker**: Multi-stage builds for frontend/backend
- **Environments**: Development (local), Production (Docker)

### Risks Without a Clear Strategy

| Risk                       | Impact                                  |
| -------------------------- | --------------------------------------- |
| Dev dependencies in prod   | Larger images, security vulnerabilities |
| Different package versions | "Works on my machine" bugs              |
| Uncontrolled updates       | Breaking changes in production          |
| Version drift              | Non-reproducible builds                 |

---

## Decision

### 1. Runtime Versions (Node.js): CAN Be Different

**Mechanism**: Docker Build Arguments

```dockerfile
# Dockerfile.frontend / Dockerfile.dev
ARG NODE_VERSION=24.14.0-alpine3.22
FROM node:${NODE_VERSION}
```

**Controlled via**:

- `docker/.env` - Single Source of Truth
- `docker-compose.yml` - Build Args
- Fallback default in Dockerfile

**Rationale**: Node LTS in prod for stability, newer version in dev for testing possible.

### 2. NPM Package Versions: MUST Be Identical

**Mechanism**: One lock file for all environments

```
pnpm-lock.yaml  \u2190 Single Source of Truth
      \u2502
      \u251c\u2500\u2500 Production Build: pnpm install --frozen-lockfile
      \u2514\u2500\u2500 Development:      pnpm install --frozen-lockfile
```

**Rationale**:

- Testing integrity: What is tested = what is deployed
- Reproducible builds: Identical versions everywhere
- No "works on my machine" bugs

### 3. Which Packages Are Installed: dependencies vs devDependencies

```
package.json
\u251c\u2500\u2500 dependencies        \u2192 Production + Development
\u2502   \u251c\u2500\u2500 @nestjs/core
\u2502   \u251c\u2500\u2500 fastify
\u2502   \u2514\u2500\u2500 pg
\u2502
\u2514\u2500\u2500 devDependencies     \u2192 Development ONLY
    \u251c\u2500\u2500 typescript
    \u251c\u2500\u2500 eslint
    \u2514\u2500\u2500 vitest
```

**Protection Mechanism**:

```dockerfile
# Dockerfile.frontend:53
RUN pnpm deploy --filter=assixx-frontend --prod /deploy
#                                        ^^^^^^
#                    Only dependencies, NO devDependencies
```

### 4. Testing New Versions: Git Branches Instead of Separate Lock Files

```
Branch: main (stable)          Branch: testing/svelte-upgrade
\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510          \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 pnpm-lock.yaml      \u2502          \u2502 pnpm-lock.yaml      \u2502
\u2502 SvelteKit: 2.21.4   \u2502          \u2502 SvelteKit: 3.0-beta \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518          \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
         \u2502                                \u2502
         \u25bc                                \u25bc
    PRODUCTION                    STAGING / DEV-SERVER
```

**Workflow**:

1. Create feature branch with new versions
2. Test on staging/dev
3. After successful testing: Merge to main
4. Production receives updates only after merge

---

## Alternatives Considered

### 1. Separate Lock Files per Environment

| Pros                        | Cons                             |
| --------------------------- | -------------------------------- |
| Different versions possible | Version drift                    |
| Flexibility                 | Not reproducible                 |
|                             | Maintenance effort doubled       |
|                             | "Works on my machine" guaranteed |

**Decision**: Rejected - Violates reproducibility.

### 2. npm instead of pnpm

| Pros              | Cons                               |
| ----------------- | ---------------------------------- |
| More widely known | Slower                             |
|                   | No workspace symlinks              |
|                   | Larger node_modules                |
|                   | `pnpm deploy --prod` not available |

**Decision**: Rejected - pnpm offers better monorepo support.

### 3. No Lock File (always latest)

| Pros                            | Cons                                  |
| ------------------------------- | ------------------------------------- |
| Always current security patches | Not reproducible                      |
|                                 | Breaking changes possible at any time |
|                                 | CI can build differently than local   |

**Decision**: Rejected - Unacceptable risk.

### 4. Renovate/Dependabot for Automatic Updates

| Pros                       | Cons                    |
| -------------------------- | ----------------------- |
| Automatic security updates | Additional complexity   |
| PRs for every update       | Noise with many updates |
| Good for large teams       | Overkill for small team |

**Decision**: Evaluate later - Currently manual updates via `pnpm update`.

---

## Consequences

### Positive

1. **Reproducible builds**: Lock file guarantees identical versions
2. **Testing integrity**: Dev tests exactly what prod runs
3. **Clear separation**: `dependencies` vs `devDependencies`
4. **Secure prod images**: `pnpm deploy --prod` excludes dev tools
5. **Flexible runtime**: Node version controllable per environment
6. **Documented decision**: This ADR as reference

### Negative

1. **No "quick testing"**: New version requires a branch
2. **Merge conflicts**: Lock file can conflict during parallel work
3. **Update effort**: Manual updates instead of automatic

### Neutral

1. **Branch strategy required**: testing/feature branches for upgrades
2. **Lock file size**: pnpm-lock.yaml can grow large (~1MB)

---

## Implementation Status

### Implemented

| Protection                | File                                                     | Status |
| ------------------------- | -------------------------------------------------------- | ------ |
| `--prod` flag             | `Dockerfile.frontend:57`                                 | \u2705 |
| `--frozen-lockfile`       | `Dockerfile.frontend:38`, `Dockerfile.dev:41`            | \u2705 |
| `engines` field           | `package.json:6-11`                                      | \u2705 |
| `preinstall` hook         | `package.json:37`                                        | \u2705 |
| `.npmrc` enforcement      | `.npmrc`                                                 | \u2705 |
| **Node version ARG**      | `Dockerfile.frontend:19`, `Dockerfile.dev:13`            | \u2705 |
| **pnpm version ARG**      | `Dockerfile.frontend:23`, `Dockerfile.dev:26`            | \u2705 |
| **Build args in Compose** | `docker-compose.yml:73-76`, `docker-compose.yml:308-310` | \u2705 |
| **Version variables**     | `docker/.env:27-29`                                      | \u2705 |

### Configuration (Single Source of Truth)

```bash
# docker/.env
NODE_VERSION_PROD=24.14.0-alpine3.22  # Production: LTS
NODE_VERSION_DEV=24.14.0-alpine3.22   # Development: can be set to a newer version
PNPM_VERSION=10.28.0                   # Both environments
```

### Use Case: Upgrade Dev to Node 26, Prod Stays on Node 24

**Step 1: Change one line in `.env`**

```bash
# docker/.env

# BEFORE (both the same):
NODE_VERSION_PROD=24.14.0-alpine3.22
NODE_VERSION_DEV=24.14.0-alpine3.22

# AFTER (only DEV changed):
NODE_VERSION_PROD=24.14.0-alpine3.22      # \u2190 stays
NODE_VERSION_DEV=26.0.0-alpine3.22        # \u2190 NEW
```

**Step 2: Rebuild backend**

```bash
cd /home/scs/projects/Assixx/docker
docker-compose build backend
```

**Done.**

```
\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                                                                 \u2502
\u2502  Production (Frontend + Nginx):  Node 24.14.0 LTS  \u2190 unchanged  \u2502
\u2502  Development (Backend):          Node 26.0.0 LTS   \u2190 NEW       \u2502
\u2502                                                                 \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
```

**Summary:**

| What             | Where         | Change                               |
| ---------------- | ------------- | ------------------------------------ |
| **One variable** | `docker/.env` | `NODE_VERSION_DEV=26.0.0-alpine3.22` |
| **One command**  | Terminal      | `docker-compose build backend`       |

Prod is **not** touched.

---

### Use Case: After Successful Testing, Also Upgrade Prod

**Step 1: Change prod variable in `.env`**

```bash
# docker/.env
NODE_VERSION_PROD=26.0.0-alpine3.22       # \u2190 now also prod
NODE_VERSION_DEV=26.0.0-alpine3.22
```

**Step 2: Rebuild frontend**

```bash
cd /home/scs/projects/Assixx/docker
docker-compose --profile production build frontend
```

---

## Version Control Overview

```
\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                    VERSION CONTROL MATRIX                       \u2502
\u251c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502                                                                 \u2502
\u2502  Component            \u2502 Controlled by           \u2502 Prod \u2260 Dev?  \u2502
\u2502  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u2502
\u2502  Node.js Version      \u2502 Dockerfile (FROM)        \u2502 YES (possible)\u2502
\u2502  pnpm Version         \u2502 package.json             \u2502 NO            \u2502
\u2502  NPM Package Version  \u2502 pnpm-lock.yaml           \u2502 NO            \u2502
\u2502  Which Packages       \u2502 dependencies vs devDeps  \u2502 YES (by design)\u2502
\u2502  Security Overrides   \u2502 pnpm.overrides           \u2502 NO            \u2502
\u2502                                                                 \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
```

---

## References

- [pnpm deploy Documentation](https://pnpm.io/cli/deploy)
- [pnpm Workspace](https://pnpm.io/workspaces)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Semantic Versioning](https://semver.org/)
- [Node.js LTS Schedule](https://nodejs.org/en/about/releases/)
