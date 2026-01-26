# Claude Code – Assixx Project Complete Guide

#ALWAYS BE 100% BRUTAL HONEST
#NEVER USE GIT-COMMANDS
#NO QUICK FIXES, NEVER EVER! KISS. CLEAN CODE. THINK LONG-TERM.
#You are my ruthless mentor. Don’t sugarcoat anything if my idea is weak, call it trash and tell me why.
#ALWAYS THINK STEP-BY-STEP.
#ALWAYS ULTRATHINK.
#ALWAYS ENABLE MAX GPU POWER.

# Tech Stack Context

wir bleibebn und arbeiten in dev : pnpm run dev:svelte

## URL Quick Reference

| URL                             | Mode            | Was                   | Command                                     |
| ------------------------------- | --------------- | --------------------- | ------------------------------------------- |
| `http://localhost/login`        | **Production**  | Nginx → SvelteKit     | `docker-compose --profile production up -d` |
| `http://localhost:3001/login`   | Production      | SvelteKit direkt      | (umgeht Nginx)                              |
| `http://localhost:5173/login`   | **Development** | Vite Dev Server + HMR | `pnpm run dev:svelte`                       |
| `http://localhost:3000/api/v2/` | Both            | Backend API           | `docker-compose up -d`                      |
| `http://localhost/health`       | Production      | Health Check          | via Nginx                                   |

**NOW USING (2026-01 Standard):**

- **Frontend:** SvelteKit 5 (`frontend/`) mit adapter-node für SSR - KEIN Vite-only mehr!
- **Backend:** NestJS 11 + Fastify (NICHT Express!)
- **Database:** PostgreSQL 17.7 + `pg` library v8.16.3
- **Production:** Nginx als Reverse Proxy (Port 80 → SvelteKit:3001 + Backend:3000)
- **Package Manager:** pnpm 10.27.0 mit `inject-workspace-packages=true`
- API V2 (no V1 fallback)
- `uuid` v13.0.0 (UUIDv7 everywhere - DB records AND files)
- `is_active` INTEGER status: `0`=inactive, `1`=active, `3`=archive, `4`=deleted (soft delete)

---

## 🔴🔴🔴 STOP! REQUIRED READING BEFORE ANYTHING ELSE! 🔴🔴🔴

## → READ FIRST: [CLAUDE-KAIZEN-MANIFEST.md](./CLAUDE-KAIZEN-MANIFEST.md)

## QUICK REFERENCE

- Project: Multi-Tenant SaaS for Industrial Companies
- GitHub: <https://github.com/SCS-Technik/Assixx>
- Tech Stack: TypeScript, NestJS+Fastify, PostgreSQL, Docker, Redis, SvelteKit, Nginx
- Dev URL: <http://localhost:5173> (SvelteKit) / <http://localhost:3000> (API)
- Prod URL: <http://localhost> (via Nginx)
- Docker Dir: /home/scs/projects/Assixx/docker
- Package Manager: pnpm 10.27.0
- Database: PostgreSQL (Port 5432), Redis (Port 6379)

**Multi-Tenant-Isolation:** tenant_id = One Company → don't forget this! It must not be mixed.

## GOLDEN RULES

**NEVER:**

- Commit or push without permission from User
- Checkout without permission from User
- Perform Fast-Forward merge (always --no-ff)
- Use ESLint disable comments WITHOUT justification (wenn 100% sicher/nötig → MIT Kommentar WARUM)
- Create new files when existing ones can be edited

**ALWAYS:**

- Start Docker from /home/scs/projects/Assixx/docker
- Think long-term - no quick fixes
- Ask when uncertain
- Edit existing files instead of creating new ones
- Use TypeScript types (no any)
- Use MCP Tools before anything else
- Apply best-practice methods

## START TRIGGER

### "continue with Assixx" (Normal Mode)

Complete mandatory checklist WITH dev-status.sh

### "continue with Assixx and skip" (Skip Mode)

Complete mandatory checklist WITHOUT dev-status.sh

**ONLY DIFFERENCE:** With "skip" dev-status.sh is skipped!

## DOCKER & DEVELOPMENT

### Quick Status Check (only in Normal Mode)

```bash
cd /home/scs/projects/Assixx/docker
docker-compose ps && curl -s http://localhost:3000/health | jq '.'

# Or use the status script:
/home/scs/projects/Assixx/scripts/dev-status.sh
```

### Common Development Tasks

**Frontend Change (SvelteKit):**

```bash
# Development: SvelteKit Dev Server mit HMR
cd frontend && pnpm run dev
# Test on http://localhost:5173

# Production Test: Rebuild Docker image
docker-compose --profile production build frontend
docker-compose --profile production up -d
# Test on http://localhost (via Nginx)
```

**Backend API Change:**

```bash
docker exec assixx-backend pnpm run type-check
docker-compose restart backend
docker logs -f assixx-backend
```

**Fix TypeScript Errors:**

```bash
docker exec assixx-backend pnpm run lint:fix
docker exec assixx-backend pnpm run format
docker exec assixx-backend pnpm run type-check
```

**Database Migration:**

```bash
# PostgreSQL - Database: assixx, Container: assixx-postgres
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt"
docker exec assixx-postgres pg_dump -U assixx_user -d assixx > backups/backup_$(date +%Y%m%d_%H%M%S).sql
docker cp database/migrations/XXX-migration.sql assixx-postgres:/tmp/
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/XXX-migration.sql
```

### Docker Commands

```bash
cd /home/scs/projects/Assixx/docker

# Development (Backend only)
docker-compose up -d
docker-compose ps

frontend neu bauen:  Bash(docker-compose --profile production build frontend 2>&1 | tail -30)

 # Nach Frontend-Code-Änderungen:
  docker-compose --profile production up -d --build frontend

  # Oder alles neu bauen + starten:
  docker-compose --profile production up -d --build


# Production (mit SvelteKit + Nginx)
docker-compose --profile production up -d
docker-compose --profile production ps
./scripts/check-production.sh  # Health Check Script

docker-compose down
docker-compose restart backend
```

## MANDATORY CHECKLIST (TodoWrite with 10+ items) read

1. Docker Check (with "skip": WITHOUT dev-status.sh) (read whole file)
2. Read(~/projects/Assixx/CLAUDE-KAIZEN-MANIFEST.md)
3. Follow (~/projects/Assixx/docs/BEFORE-STARTING-DEV.md)
4. Read(~/projects/Assixx/docs/TYPESCRIPT-STANDARDS.md) (MANDATORY for Backend, read whole File)
5. Read(~/projects/Assixx/README.md)
6. Read(~/projects/Assixx/docs/DATABASE-MIGRATION-GUIDE.md)
7. Read(~/projects/Assixx/eslint.config.mjs and ~/projects/Assixx/frontend/eslint.config.mjs) for rules (read whole File)
8. Read(~/projects/Assixx/docs/CODE-OF-CONDUCT.md) (read whole File)
9. Read(~/projects/Assixx/frontend/src/styles/tailwind.css) for UI context (read whole File)
10. Read(~/projects/Assixx/frontend/src/design-system/README.md) for UI context (read whole File)
11. Read(~/projects/Assixx/backend/docs/ZOD-INTEGRATION-GUIDE.md) for UI context (read whole File)
12. Read(~/projects/Assixx/docs/context.md) for context (read whole File)
13. Read(~/projects/Assixx/docs/HOW-TO-TEST-WITH-BRUNO.md) for context (read whole File)
14. Read(~/projects/Assixx/docs/CODE-OF-CONDUCT-SVELTE.md) for context (read whole File)
15. Read(~/projects/Assixx/docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md)\*\* - Docker/Nginx/SvelteKit Setup!
16. Read all ADR in (~/projects/Assixx/docs/infrastructure/adr/ADR-0XX.md.) and docs/infrastructure/adr/README.md
17. Always fetch original docs: like fetch this: https://svelte.dev/docs/svelte/overview and https://svelte.dev/docs/svelte/what-are-runes and https://svelte.dev/docs/kit/$app-paths#resolve
18. Dont do more than this and than recap fast and than ask user that youre ready.
19. change directory to root Bash(cd /home/scs/projects/Assixx && pwd)

## 📊 PROGRESS DOCUMENTATION

**Update Daily:**

- `/docs/DAILY-PROGRESS.md` - Daily progress with metrics
- `/docs/api/API-V2-PROGRESS-LOG.md` - API v2 specific details
- `TODO.md` - Progress tracking section at the top

**Why Important:** Continuous progress, retrospectives, solution documentation, motivation

## CENTRAL DOCUMENTATION

**Core Documents (daily relevant):**

- docs/PROJEKTSTRUKTUR.md - Complete directory structure
- docs/TYPESCRIPT-STANDARDS.md - TypeScript Patterns (MANDATORY for Backend)
- docs/DATABASE-MIGRATION-GUIDE.md - DB Changes (MANDATORY for migrations)
- docs/DESIGN-STANDARDS.md - Glassmorphism UI/UX

**Work Documents:**

- TODO.md - Current tasks and status
- docs/BEFORE-STARTING-DEV.md - Daily Dev Checks
- docs/FEATURES.md - Feature list with prices
- docs/DATABASE-SETUP-README.md - DB Schema Reference

## MERGE STRATEGY FOR MASTER BRANCH

**IMPORTANT: No Fast-Forward Merges!**

```bash
# ALWAYS merge with --no-ff:
git merge --no-ff <branch-name>

# Check BEFORE merge:
git diff master..<branch-name> --name-status
git diff master..<branch-name> -- CLAUDE.md
git diff master..<branch-name> -- TODO.md
```

**Why no Fast-Forward:**

- Merge history remains visible
- Easier rollback on problems
- Prevents accidental changes

## IF-THEN INSTRUCTIONS

- **IF User asks about feature status:** Check TODO.md, then FEATURES.md
- **IF TypeScript Error in Route Handler:** Use typed.auth or typed.body wrapper
- **IF User wants to commit/push:** ALWAYS ask: "Should I commit the changes?"
- **IF Creating new file:** STOP! First check if existing file can be edited
- **IF Database Error:** Check Foreign Key Constraints
- **IF Docker Container won't start:** docker-compose down && docker-compose up -d

## KNOWN ISSUES

- SMTP Warnings on start - optional, ignore
- Port 3000 occupied - lsof -i :3000 && kill -9 PID

## WORKFLOW AFTER START TRIGGER

1. Create TodoWrite with 10+ items (see MANDATORY CHECKLIST)
2. Perform all checks (with/without dev-status.sh depending on mode)
3. Create summary
4. Begin development

**For Documentation Updates:**

- DB Changes: DATABASE-SETUP-README.md
- New Features: FEATURES.md
- UI Changes: DESIGN-STANDARDS.md
- Structure Changes: PROJEKTSTRUKTUR.md

## CODE STANDARDS

- Comment WHY, not WHAT
- Every function needs JSDoc
- Explain complex logic
- Use TypeScript instead of any
- See TYPESCRIPT-STANDARDS.md for details

**PostgreSQL Password:** See `docker/.env` for credentials (DB_PASSWORD, POSTGRES_PASSWORD)

**Core Philosophy:** Write code as if the person maintaining it is a violent psychopath who knows where you live. Make it that clear. KISS PRINCIPLE
