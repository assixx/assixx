# Contributing to Assixx

**Version:** 2.0.0 | **Updated:** 2026-01-28

Before contributing, read [CODE-OF-CONDUCT.md](./docs/CODE-OF-CONDUCT.md).

---

## Tech Stack

| Layer      | Technology                         |
| ---------- | ---------------------------------- |
| Backend    | NestJS 11 + Fastify                |
| Frontend   | SvelteKit 5 + Tailwind v4          |
| Database   | PostgreSQL 17 + Row Level Security |
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

See [HOW-TO-DOPPLER-GUIDE.md](./docs/HOW-TO-DOPPLER-GUIDE.md) for the full reference.

### 2. Clone & Start

```bash
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx

# Install dependencies
pnpm install

# Start Docker (backend, postgres, redis)
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
git checkout master && git pull origin master
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

```bash
# API integration tests (requires Docker backend)
pnpm run test:api

# Unit tests (no Docker needed)
pnpm run test:unit

# Single module
vitest run --project api api-tests/vitest/calendar.api.test.ts
```

See [HOW-TO-TEST-WITH-VITEST.md](./docs/HOW-TO-TEST-WITH-VITEST.md) for details.

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

- [ ] `pnpm run validate:all` passes
- [ ] `pnpm run test:api` passes
- [ ] No `any` types without justification
- [ ] No `// TODO:` comments
- [ ] Functions <= 60 lines
- [ ] Commits follow `<type>(<scope>): <description>`

**Merge strategy:** Always `--no-ff` (no fast-forward).

---

## Project Structure

```
Assixx/
├── backend/src/nest/          # NestJS Backend
│   ├── auth/                  #   Module: controller + service + dto/
│   ├── users/                 #   Module: controller + service + dto/
│   ├── calendar/              #   ... (30 modules total)
│   ├── common/                #   Guards, Pipes, Interceptors, Decorators
│   ├── config/                #   Environment config
│   └── database/              #   DB connection service
├── frontend/src/              # SvelteKit 5 Frontend
│   ├── routes/(app)/          #   Authenticated pages
│   ├── routes/login/          #   Public pages
│   ├── lib/                   #   Shared utilities, types, stores
│   ├── styles/                #   Page-specific CSS
│   └── design-system/         #   CSS component library (29 components)
├── database/                  # Database
│   ├── migrations/            #   node-pg-migrate TypeScript migrations
│   └── seeds/                 #   Idempotent seed data (SQL)
├── docker/                    # Docker Compose + Dockerfiles + Nginx
├── api-tests/                 # Vitest API integration tests
└── docs/                      # All documentation
```

---

## Common Tasks

### Add New API Endpoint

1. Create NestJS module in `backend/src/nest/<module>/`
   - `<module>.controller.ts` - Route handlers
   - `<module>.service.ts` - Business logic
   - `<module>.module.ts` - Module definition
   - `dto/` - Zod validation schemas (`createZodDto`)
2. Register module in `app.module.ts`
3. Add Vitest API tests in `api-tests/vitest/<module>.api.test.ts`
4. Run `pnpm run validate:all`

See [ZOD-INTEGRATION-GUIDE.md](./backend/docs/ZOD-INTEGRATION-GUIDE.md) for DTO patterns.

### Add New Frontend Page

1. Create route in `frontend/src/routes/(app)/<page>/+page.svelte`
2. Add `_lib/` folder for API calls, types, state
3. Use design system components (see `frontend/src/design-system/README.md`)
4. Svelte 5 Runes: `$state`, `$derived`, `$effect`, `$props`

See [CODE-OF-CONDUCT-SVELTE.md](./docs/CODE-OF-CONDUCT-SVELTE.md) for Svelte patterns.

### Database Changes

1. Read [DATABASE-MIGRATION-GUIDE.md](./docs/DATABASE-MIGRATION-GUIDE.md)
2. Create migration:
   ```bash
   doppler run -- pnpm run db:migrate:create add-feature-x
   ```
3. Implement `up()` and `down()` in generated TypeScript file
4. Include RLS policy + `app_user` GRANTs for tenant-specific tables
5. Run:
   ```bash
   doppler run -- ./scripts/run-migrations.sh up
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
FORBIDDEN                      REQUIRED
--------------------------     --------------------------
any                            unknown + type guard
|| for defaults                ?? (nullish coalescing)
if (value)                     if (value !== null)
// TODO:                       Implement immediately
? placeholders                 $1, $2, $3 (PostgreSQL)
var                            const or let
console.log                    console.warn / console.error
```

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

| Document                                                                              | Purpose                       |
| ------------------------------------------------------------------------------------- | ----------------------------- |
| [CODE-OF-CONDUCT.md](./docs/CODE-OF-CONDUCT.md)                                       | Code standards & rules        |
| [CODE-OF-CONDUCT-SVELTE.md](./docs/CODE-OF-CONDUCT-SVELTE.md)                         | Svelte 5 & SvelteKit patterns |
| [TYPESCRIPT-STANDARDS.md](./docs/TYPESCRIPT-STANDARDS.md)                             | TypeScript strict rules       |
| [DATABASE-MIGRATION-GUIDE.md](./docs/DATABASE-MIGRATION-GUIDE.md)                     | PostgreSQL migrations & RLS   |
| [HOW-TO-DOPPLER-GUIDE.md](./docs/HOW-TO-DOPPLER-GUIDE.md)                             | Secret management setup       |
| [HOW-TO-TEST-WITH-VITEST.md](./docs/HOW-TO-TEST-WITH-VITEST.md)                       | API testing with Vitest       |
| [PRODUCTION-AND-DEVELOPMENT-TESTING.md](./docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md) | Docker/Nginx/SvelteKit setup  |
| [ZOD-INTEGRATION-GUIDE.md](./backend/docs/ZOD-INTEGRATION-GUIDE.md)                   | Zod validation in NestJS      |
| [ADR Index](./docs/infrastructure/adr/README.md)                                      | Architecture Decision Records |

---

## Review Process

1. PR created -> Automated checks run
2. Code review by team member
3. Address feedback
4. Approval + merge with `--no-ff`

**Merge is blocked if:** ESLint errors, TypeScript errors, failing tests, or no reviewer approval.

---

**Thank you for contributing.**
