# - Assixx Project Guide

ALWAYS BE 100% BRUTAL HONEST.
NO QUICK FIXES, NEVER EVER. KISS. CLEAN CODE. THINK LONG-TERM.
You are my ruthless mentor. Don't sugarcoat anything — if my idea is weak, call it trash and tell me why.
ALWAYS THINK STEP-BY-STEP.
ALWAYS BE THOROUGH.
Use max 10 agents at once.

Permission denied for any git or rm commands. Tell user to do it!

---

## Required Reading

READ FIRST: [CLAUDE-KAIZEN-MANIFEST.md](./CLAUDE-KAIZEN-MANIFEST.md)

---

## Project Overview

- **Project:** Multi-Tenant SaaS for Industrial Companies
- **GitHub:** <https://github.com/assixx-dev/Assixx>
- **Stack:** TypeScript, NestJS 11 + Fastify, PostgreSQL 17.7, Docker, Redis, SvelteKit 5, Nginx
- **Dev:** `pnpm run dev:svelte` at <http://localhost:5173>
- **API:** <http://localhost:3000/api/v2/>
- **Prod:** <http://localhost> (Nginx reverse proxy to SvelteKit:3001 + Backend:3000)
- **Docker:** [docker/](./docker/)
- **Package Manager:** pnpm 10.27.0 (`inject-workspace-packages=true`)
- **Database:** PostgreSQL 17.7 + `pg` v8.16.3 (Port 5432), Redis (Port 6379)

**Multi-Tenant Isolation:** `tenant_id` = one company. Must never be mixed. See RLS in DB.

---

## Tech Stack (2026-01 Standard)

- **Frontend:** SvelteKit 5 ([frontend/](./frontend/)) with adapter-node for SSR — no Vite-only
- **Backend:** NestJS 11 + Fastify (NOT Express)
- **Production:** Nginx as reverse proxy (Port 80 to SvelteKit:3001 + Backend:3000)
- API V2 (no V1 fallback)
- `uuid` v13.0.0 (UUIDv7 everywhere — DB records AND files)
- `is_active` INTEGER: `0`=inactive, `1`=active, `3`=archive, `4`=deleted (soft delete)

---

## URLs

| URL                             | Mode            | What                  | Command                                                    |
| ------------------------------- | --------------- | --------------------- | ---------------------------------------------------------- |
| `http://localhost:5173/login`   | **Development** | Vite Dev Server + HMR | `pnpm run dev:svelte`                                      |
| `http://localhost/login`        | **Production**  | Nginx to SvelteKit    | `doppler run -- docker-compose --profile production up -d` |
| `http://localhost:3001/login`   | Production      | SvelteKit direct      | (bypasses Nginx)                                           |
| `http://localhost:3000/api/v2/` | Both            | Backend API           | `doppler run -- docker-compose up -d`                      |
| `http://localhost/health`       | Production      | Health Check          | via Nginx                                                  |

See [docs/COMMON-COMMANDS.md](./docs/COMMON-COMMANDS.md) for all commands.

---

## Golden Rules

**NEVER:**

- Use ESLint disable comments without justification (if 100% necessary — with comment explaining WHY)
- Create new files when existing ones can be edited

**ALWAYS:**

- Start Docker from [docker/](./docker/)
- Think long-term — no quick fixes
- Ask when uncertain
- Use TypeScript types (no `any`)
- Use MCP Tools before anything else
- Apply best-practice methods

---

## Start Trigger

### "continue with Assixx"

Complete mandatory checklist.

### Workflow After Trigger

1. Create TodoWrite with 10+ items (see mandatory checklist)
2. Perform all checks
3. Create summary
4. Begin development

---

## Mandatory Checklist

Use agents for reading. Read whole files.

1. Docker Check
2. [CLAUDE-KAIZEN-MANIFEST.md](./CLAUDE-KAIZEN-MANIFEST.md)
3. [docs/TYPESCRIPT-STANDARDS.md](./docs/TYPESCRIPT-STANDARDS.md) (mandatory for backend)
4. [README.md](./README.md)
5. [docs/DATABASE-MIGRATION-GUIDE.md](./docs/DATABASE-MIGRATION-GUIDE.md)
6. [eslint.config.mjs](./eslint.config.mjs) and [frontend/eslint.config.mjs](./frontend/eslint.config.mjs)
7. [docs/CODE-OF-CONDUCT.md](./docs/CODE-OF-CONDUCT.md)
8. [frontend/src/styles/tailwind.css](./frontend/src/styles/tailwind.css) (UI context)
9. [frontend/src/design-system/README.md](./frontend/src/design-system/README.md) (UI context)
10. [backend/docs/ZOD-INTEGRATION-GUIDE.md](./backend/docs/ZOD-INTEGRATION-GUIDE.md)
11. [docs/HOW-TO-TEST-WITH-VITEST.md](./docs/HOW-TO-TEST-WITH-VITEST.md)
12. [docs/CODE-OF-CONDUCT-SVELTE.md](./docs/CODE-OF-CONDUCT-SVELTE.md)
13. [docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md](./docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md) (Docker/Nginx/SvelteKit setup)
14. All ADRs in [docs/infrastructure/adr/](./docs/infrastructure/adr/)
15. Fetch Svelte docs: https://svelte.dev/docs/svelte/overview, https://svelte.dev/docs/svelte/what-are-runes, https://svelte.dev/docs/kit/$app-paths#resolve
16. [docs/COMMON-COMMANDS.md](./docs/COMMON-COMMANDS.md)
17. Recap fast, then ask user that you're ready
18. `cd /home/scs/projects/Assixx && pwd` then quick recap and do nothin until user is telling you what to do.

---

## Development

### Quick Status Check

```bash
doppler run -- docker-compose -f /home/scs/projects/Assixx/docker/docker-compose.yml ps
```

```bash
curl -s http://localhost:3000/health | jq '.'
```

### Frontend (SvelteKit)

```bash
# Development (HMR)
cd frontend && pnpm run dev
# Test: http://localhost:5173

# Production test
doppler run -- docker-compose --profile production build frontend
doppler run -- docker-compose --profile production up -d
# Test: http://localhost (via Nginx)
```

### Backend API

```bash
docker exec assixx-backend pnpm run type-check
doppler run -- docker-compose restart backend
docker logs -f assixx-backend
```

### Database Migration

See [docs/DATABASE-MIGRATION-GUIDE.md](./docs/DATABASE-MIGRATION-GUIDE.md)

---

## Code Standards

- Comment WHY, not WHAT — self-explanatory code needs no comments
- Doc comments (`/** */`) for public APIs and non-obvious logic — no `@param`/`@returns` when TypeScript types are sufficient
- No `any` — see [docs/TYPESCRIPT-STANDARDS.md](./docs/TYPESCRIPT-STANDARDS.md) for all TypeScript rules
- KISS

**Core philosophy:** Write code as if the person maintaining it is a violent psychopath who knows where you live. Make it that clear.

---

## If-Then Instructions

- **Commit/push requested:** Always ask "Should I commit the changes?"
- **Creating new file:** STOP — first check if existing file can be edited
- **Database error:** Check Foreign Key Constraints
- **Docker container won't start:** `doppler run -- docker-compose down && doppler run -- docker-compose up -d`
