# Claude Code – Assixx Project Complete Guide

## 🔴🔴🔴 STOP! REQUIRED READING BEFORE ANYTHING ELSE! 🔴🔴🔴

## → READ FIRST: [CLAUDE-KAIZEN-MANIFEST.md](./CLAUDE-KAIZEN-MANIFEST.md)

## QUICK REFERENCE

- Project: Multi-Tenant SaaS for Industrial Companies
- GitHub: <https://github.com/SCS-Technik/Assixx>
- Current Branch: debugging/v0.1.0--R2Stable
- Tech Stack: TypeScript, Express, MySQL, Docker, Redis, Vite
- Dev URL: <http://localhost:3000>
- Docker Dir: /home/scs/projects/Assixx/docker
- Package Manager: pnpm
- Database: MySQL (Port 3307), Redis (Port 6379)

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

## 🎨 UX/UI DESIGN STANDARDS

### NO MORE MODALS FOR DATA ENTRY

**From now on:** All forms as **Inline Forms**, NO Modals!

#### New UI Patterns

1. **Split-View Pattern** - Left: List, Right: Form
2. **Inline-Expansion Pattern** - Form expands in list
3. **Slide-in Panel Pattern** - Sliding in from right (not modal)
4. **Top-Form Pattern** - Form above table

#### Modals only for

- ❌ Delete confirmations
- ⚠️ Critical warnings
- ℹ️ Info dialogs
- 🔒 Session timeouts

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

**Frontend Change:**

```bash
docker exec assixx-backend pnpm run build
# Clear Browser Cache (Ctrl+Shift+R)
# Test on http://localhost:3000
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
bash scripts/quick-backup.sh "before_migration"
docker cp migration.sql assixx-mysql:/tmp/
docker exec assixx-mysql mysql -u assixx_user -pAssixxP@ss2025! main < /tmp/migration.sql
```

### Docker Commands

```bash
cd /home/scs/projects/Assixx/docker
docker-compose ps
docker-compose up -d
docker-compose down
docker-compose restart backend
```

## MANDATORY CHECKLIST (TodoWrite with 10+ items)

1. Docker Check (with "skip": WITHOUT dev-status.sh)
2. TODO.md (CURRENT PHASE + PROGRESS TRACKING!)
3. CLAUDE.md
4. TypeScript Standards (MANDATORY for Backend)
5. Design Standards
6. README.md
7. Database Migration Guide
8. Follow BEFORE-STARTING-DEV
9. Read DAILY-PROGRESS.md
10. API-V2-MIGRATION-MASTERPLAN.md
11. API-V2-MASTERPLAN-CHECKLIST.md
12. API-V2-MIGRATION-EXECUTIVE-SUMMARY.md
13. API-V2-FRONTEND-MIGRATION-DETAILS.md
14. workshop-decisions.md
15. API-DESIGN-WORKSHOP-PLAN.md

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

- TypeScript Test Errors (56 errors) - ignore, affects only tests
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

**MySQL Password:** AssixxP@ss2025!

**Core Philosophy:** Write code as if the person maintaining it is a violent psychopath who knows where you live. Make it that clear. KISS PRINCIPLE
