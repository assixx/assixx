# Contributing to Assixx

**Version:** 2.1.0 | **Updated:** 2026-04-08

Before contributing, read [CODE-OF-CONDUCT.md](./docs/CODE-OF-CONDUCT.md) and the [CLAUDE-KAIZEN-MANIFEST.md](./CLAUDE-KAIZEN-MANIFEST.md).

> **Terminology (ADR-033):** The modular SaaS system uses **Addons** (DB: `addons`, `tenant_addons`, `user_addon_permissions`). "Feature" is deprecated. User-facing label: "Modul".

---

## Tech Stack

| Layer      | Technology                         |
| ---------- | ---------------------------------- |
| Backend    | NestJS 11 + Fastify                |
| Frontend   | SvelteKit 5 + Tailwind v4          |
| Database   | PostgreSQL 18 + Row Level Security |
| Cache      | Redis 7                            |
| Secrets    | Doppler                            |
| Validation | Zod (nestjs-zod)                   |
| Testing    | Vitest (Unit + API Integration)    |
| Container  | Docker + Nginx (Reverse Proxy)     |

---

## Prerequisites

- Node.js 24.x LTS
- pnpm 10.x (`npm` and `yarn` are blocked)
- Docker & Docker Compose
- [Doppler CLI](https://docs.doppler.com/docs/install-cli) (secret management)
- Doppler Service Token (request from project maintainer)

---

## Getting Started

### 1. Doppler Setup (Required)

All secrets are managed via Doppler. **Without a Doppler token, Docker will not start.**

You need a Service Token from the maintainer. Request one via **assixx@scs-technik.de**. You do **not** need a Doppler account or dashboard access.

```bash
# Install Doppler CLI
curl -Ls --tlsv1.2 --proto "=https" "https://cli.doppler.com/install.sh" | sudo sh
```

See [HOW-TO-DOPPLER-GUIDE.md](./docs/how-to/HOW-TO-DOPPLER-GUIDE.md) for the full reference.

### 2. Clone & Start

```bash
git clone https://github.com/assixx/assixx.git
cd assixx

# Install dependencies (npm/yarn are blocked)
pnpm install

# Generate SvelteKit type files (ADR-041)
# Auto-invoked by `type-check`/`check`/`lint:frontend`, but required for any direct
# `tsc -p frontend` or `pnpm exec eslint` call. Skipping → cryptic "Tsconfig not found".
pnpm run sync:svelte

# Start Docker (backend, postgres, redis, deletion-worker, monitoring stack)
cd docker
export DOPPLER_TOKEN="your-token-here"
doppler run -- docker-compose up -d

# Verify backend is healthy
curl -s http://localhost:3000/health | jq '.'
```

### 3. Start Frontend Dev Server

```bash
# From project root
pnpm run dev:svelte
# Opens http://localhost:5173 with HMR
```

### URLs

| URL                     | What                |
| ----------------------- | ------------------- |
| `http://localhost:5173` | SvelteKit Dev (HMR) |
| `http://localhost:3000` | Backend API         |
| `http://localhost`      | Production (Nginx)  |

See [PRODUCTION-AND-DEVELOPMENT-TESTING.md](./docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md) for full architecture.

---

## Development Workflow

### 1. Create Branch

```bash
git checkout main && git pull origin main
git checkout -b feature/short-description
```

| Prefix      | Use for           |
| ----------- | ----------------- |
| `feature/`  | New functionality |
| `bugfix/`   | Bug fixes         |
| `hotfix/`   | Production fixes  |
| `refactor/` | Code improvements |

### 2. Develop

```bash
# Frontend: SvelteKit dev server (auto-reload)
pnpm run dev:svelte

# Backend: Docker handles it. After code changes:
cd docker && doppler run -- docker-compose restart backend
```

### 3. Validate

```bash
# Run ALL checks at once (recommended before commit)
pnpm run validate:all

# Or individual checks:
pnpm run lint:all:fix          # ESLint backend + frontend
pnpm run type-check            # TypeScript backend + frontend
cd frontend && pnpm run check  # Svelte-specific checks
pnpm run stylelint:fix         # CSS linting
```

### 4. Test

Four Vitest projects are configured (see ADR-018): `api`, `unit`, `permission`, `frontend-unit`.

```bash
# Top-level test scripts
pnpm run test:api          # API integration tests (requires running Docker backend)
pnpm run test:unit         # Backend + shared unit tests
pnpm run test:permission   # Permission guard tests
pnpm exec vitest run --project frontend-unit   # Frontend unit tests

# Single module — always via `pnpm exec`, NEVER bare `vitest`
pnpm exec vitest run --project api backend/test/calendar.api.test.ts
```

See [HOW-TO-TEST.md](./docs/how-to/HOW-TO-TEST.md) for details.

### 5. Commit

```bash
# Format: <type>(<scope>): <description>
git commit -m "feat(calendar): add recurring events support"
```

| Type       | Use for                      |
| ---------- | ---------------------------- |
| `feat`     | New feature                  |
| `fix`      | Bug fix                      |
| `docs`     | Documentation only           |
| `refactor` | Code change (no feature/fix) |
| `test`     | Adding tests                 |
| `chore`    | Maintenance, dependencies    |

### 6. Push & PR

```bash
git push -u origin feature/short-description
# Create PR via GitHub
```

---

## Pull Request Requirements

- [ ] `pnpm run validate:all` passes (format + lint backend/frontend + type-check + svelte-check + stylelint)
- [ ] `pnpm run test:api` passes (or the relevant project subset)
- [ ] `pnpm changeset` created for user-visible changes — see [HOW-TO-USE-CHANGESETS](./docs/how-to/HOW-TO-USE-CHANGESETS.md)
- [ ] No `any` types without `eslint-disable` + justification comment
- [ ] No `// TODO:` comments — implement now or open an issue
- [ ] Functions ≤ 60 lines, files ≤ 800 (backend) / ≤ 850 (frontend src), cognitive complexity ≤ 10
- [ ] Type-only imports use `import type` or inline `type` modifier (ADR-041)
- [ ] No magic `is_active` numbers — use `IS_ACTIVE` constants from `@assixx/shared/constants`
- [ ] No `(error as Error).message` — use `getErrorMessage(error)`
- [ ] Commits follow `<type>(<scope>): <description>`

**Merge strategy:** Always `--no-ff` (no fast-forward).

---

## Project Structure

```
Assixx/
├── backend/src/nest/          # NestJS Backend
│   ├── auth/                  #   Module: controller + service + dto/
│   ├── users/                 #   Module: controller + service + dto/
│   ├── calendar/              #   ... (~46 modules total)
│   ├── common/                #   Guards, Pipes, Interceptors, Decorators, DTO factories
│   ├── config/                #   Environment config
│   └── database/              #   DB connection service
├── frontend/src/              # SvelteKit 5 Frontend
│   ├── routes/(app)/          #   Authenticated wrapper (ADR-012 route groups)
│   │   ├── (shared)/          #     Shared pages — admin + employee
│   │   ├── (admin)/           #     Admin-only pages
│   │   └── (root)/            #     Root-only pages
│   ├── routes/login/          #   Public auth pages
│   ├── lib/                   #   Shared utilities, types, stores
│   ├── styles/                #   Page-specific CSS
│   └── design-system/         #   CSS component library (29 components)
├── shared/                    # @assixx/shared workspace package (types + constants)
├── database/                  # Database
│   ├── migrations/            #   node-pg-migrate TypeScript migrations (17-digit UTC ts)
│   └── seeds/                 #   Idempotent seed data (SQL)
├── docker/                    # Docker Compose + Dockerfiles + Nginx
├── backend/test/              # Vitest API integration tests
└── docs/                      # All documentation (incl. infrastructure/adr/)
```

---

## Common Tasks

### Add New API Endpoint

1. Create NestJS module in `backend/src/nest/<module>/`
   - `<module>.controller.ts` — Route handlers
   - `<module>.service.ts` — Business logic (`DatabaseService` via constructor injection)
   - `<module>.module.ts` — Module definition
   - `dto/` — Zod schemas via `createZodDto(Schema)`
2. **ID Param DTOs:** use the factory, never inline `z.coerce.number().int().positive()`:
   - Standard `:id` → re-export `IdParamDto` from `common/dto`
   - Custom name → `createIdParamSchema('adminId')`
   - See [TYPESCRIPT-STANDARDS § 7.5](./docs/TYPESCRIPT-STANDARDS.md)
3. Register module in `app.module.ts`
4. **If addon-gated (ADR-020):** register per-module permissions via `OnModuleInit`
5. Add Vitest API tests in `backend/test/<module>.api.test.ts`
6. Run `pnpm run validate:all`

See [ZOD-INTEGRATION-GUIDE.md](./backend/docs/ZOD-INTEGRATION-GUIDE.md) for DTO patterns.

### Add New Frontend Page

1. Choose the right route group (ADR-012 / ADR-036):
   - `frontend/src/routes/(app)/(shared)/<page>/` — admin **and** employee
   - `frontend/src/routes/(app)/(admin)/<page>/` — admin only
   - `frontend/src/routes/(app)/(root)/<page>/` — root only
2. Create `+page.svelte` and `+page.server.ts`
3. **If addon-gated (ADR-024):** call `requireAddon('<addon-code>')` in `+page.server.ts` — fail-closed
4. Add `_lib/` folder for API calls, types, page-local state
5. Use design system components (see `frontend/src/design-system/README.md`)
6. Svelte 5 Runes only: `$state`, `$derived`, `$effect`, `$props`, `$bindable` — never `$:` or stores in new code
7. **Hierarchy labels (ADR-034):** read tenant-custom labels from layout data — never hardcode "Bereich"/"Abteilung"/"Team"
8. **Session expiry:** use centralised `checkSessionExpired()` from `$lib/utils/session-expired` — never re-implement

See [CODE-OF-CONDUCT-SVELTE.md](./docs/CODE-OF-CONDUCT-SVELTE.md) for Svelte patterns.

### Database Changes

> 🚨 **HARD BLOCK:** Read [DATABASE-MIGRATION-GUIDE.md](./docs/DATABASE-MIGRATION-GUIDE.md) first.
> Mandatory sequence: **Backup → Generator → Dry-Run → Run → Verify**. Skipping any step is a critical failure.

1. **Backup the database** — required before any DB change:
   ```bash
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
     --format=custom --compress=9 \
     > database/backups/full_backup_${TIMESTAMP}.dump
   ```
2. **Generate** the migration (NEVER create files manually — node-pg-migrate v8 needs 17-digit UTC timestamps):
   ```bash
   doppler run -- pnpm run db:migrate:create add-feature-x
   ```
3. Implement `up()` and `down()` in the generated TypeScript file. For tenant-scoped tables:
   - Enable + force RLS
   - Use the strict-mode policy template (ADR-019, no bypass clause):
     `tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer`
   - GRANT for **both** `app_user` AND `sys_user` (Triple-User Model — sys_user is the BYPASSRLS service account)
   - GRANT `USAGE, SELECT` on the sequence to both users
4. **Dry run** — must succeed before the real run:
   ```bash
   doppler run -- ./scripts/run-migrations.sh up --dry-run
   ```
5. **Run** the migration:
   ```bash
   doppler run -- ./scripts/run-migrations.sh up
   ```
6. **Verify**: check `pgmigrations`, `pg_policies`, `\d <table>`, then restart backend:
   ```bash
   docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d <table>"
   doppler run -- docker-compose restart backend deletion-worker
   ```
7. **Sync customer fresh-install** (mandatory after every migration):
   ```bash
   ./scripts/sync-customer-migrations.sh
   ```

### Fix a Bug

1. Reproduce with API test or browser
2. Find **root cause** (not symptoms)
3. Write fix
4. Add test case for the bug
5. `pnpm run validate:all`

---

## Code Standards (Quick Reference)

```
FORBIDDEN                            REQUIRED
----------------------------------   ----------------------------------
any                                  unknown + type guard
|| for defaults                      ?? (nullish coalescing)
if (value)                           if (value !== null && value !== '')
! non-null assertion                 explicit null/undefined check
// TODO:                             Implement now or open an issue
? placeholders (MySQL)               $1, $2, $3 (PostgreSQL)
var                                  const or let
console.log (frontend)               console.warn / console.error
(error as Error).message             getErrorMessage(error)            (§ 7.3)
is_active = 1 / != 4   (magic)       IS_ACTIVE.ACTIVE / .DELETED       (§ 7.4)
inline z.coerce.number() in params   idField / createIdParamSchema     (§ 7.5)
inline import('pg').PoolClient       import type { PoolClient }        (ADR-041)
snake_case in API fields             camelCase
Functions > 60 lines                 ≤ 60 lines
Cognitive complexity > 10            ≤ 10 (sonarjs)
```

All rules above are enforced by ESLint or architectural tests in CI.
Full details: [TYPESCRIPT-STANDARDS.md](./docs/TYPESCRIPT-STANDARDS.md)

---

## Docker Reference

```bash
cd docker

# Development (backend + DB + Redis)
doppler run -- docker-compose up -d
doppler run -- docker-compose ps
doppler run -- docker-compose restart backend

# Production (+ SvelteKit + Nginx)
doppler run -- docker-compose --profile production up -d
doppler run -- docker-compose --profile production build frontend

# Logs
docker logs -f assixx-backend
docker logs -f assixx-postgres

# Backend checks inside container
docker exec assixx-backend pnpm run type-check
docker exec assixx-backend pnpm run lint
```

---

## Key Documentation

| Document                                                                              | Purpose                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------- |
| [CLAUDE-KAIZEN-MANIFEST.md](./CLAUDE-KAIZEN-MANIFEST.md)                              | Mandatory reading — error chronicle         |
| [CODE-OF-CONDUCT.md](./docs/CODE-OF-CONDUCT.md)                                       | Code standards & Power-of-Ten rules         |
| [CODE-OF-CONDUCT-SVELTE.md](./docs/CODE-OF-CONDUCT-SVELTE.md)                         | Svelte 5 & SvelteKit patterns               |
| [TYPESCRIPT-STANDARDS.md](./docs/TYPESCRIPT-STANDARDS.md)                             | TypeScript strict rules (ADR-041)           |
| [DATABASE-MIGRATION-GUIDE.md](./docs/DATABASE-MIGRATION-GUIDE.md)                     | PostgreSQL migrations, RLS, Triple-User     |
| [COMMON-COMMANDS.md](./docs/COMMON-COMMANDS.md)                                       | All daily commands, categorised             |
| [docs/how-to/README.md](./docs/how-to/README.md)                                      | HOW-TO catalog (Doppler, psql, Vitest …)    |
| [HOW-TO-USE-CHANGESETS.md](./docs/how-to/HOW-TO-USE-CHANGESETS.md)                    | Versioning + changelog workflow             |
| [HOW-TO-TEST.md](./docs/how-to/HOW-TO-TEST.md)                                        | API testing with Vitest                     |
| [PRODUCTION-AND-DEVELOPMENT-TESTING.md](./docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md) | Docker / Nginx / SvelteKit setup            |
| [ZOD-INTEGRATION-GUIDE.md](./backend/docs/ZOD-INTEGRATION-GUIDE.md)                   | Zod validation in NestJS                    |
| [ADR Index](./docs/infrastructure/adr/README.md)                                      | Architecture Decision Records (ADR-001…041) |

---

## Review Process

1. PR created -> Automated checks run
2. Code review by team member
3. Address feedback
4. Approval + merge with `--no-ff`

**Merge is blocked if:** ESLint errors, TypeScript errors, failing tests, or no reviewer approval.

---

**Thank you for contributing.**
