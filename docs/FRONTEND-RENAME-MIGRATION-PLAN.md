# Frontend Rename Migration Plan (REVISED v2.0)

> **Date**: 2026-01-06
> **Branch**: feature/nestjs-migration
> **Author**: Claude Code / System Engineer
> **Status**: PLAN REVISED - CRITICAL ISSUES FOUND
> **Revision**: 2.0 (Complete rewrite after double-check)

---

## CRITICAL WARNING

**THE ORIGINAL PLAN WAS INCOMPLETE!**

After thorough double-checking, critical issues were found that MUST be addressed before migration.

---

## Executive Summary

This document provides a **zero-error migration plan** to:
1. Archive the legacy `frontend/` directory to `frontend-legacy/`
2. Create a ZIP backup of the archived folder
3. Rename `frontend-svelte/` to `frontend/`
4. Update ALL configuration references (MORE than originally identified!)
5. Address the **CRITICAL backend incompatibility** with SvelteKit

---

## CRITICAL ARCHITECTURAL ISSUE

### The Problem

The backend (`backend/src/nest/main.ts`) is hardcoded to serve the **legacy Vite frontend**:

```typescript
// backend/src/nest/main.ts - Lines 84-98
const frontendPath = path.join(projectRoot, 'frontend');
const distPath = path.join(frontendPath, 'dist');      // SvelteKit uses 'build/'!

return {
  distPath,
  publicPath: path.join(frontendPath, 'public'),      // SvelteKit uses 'static/'!
  srcPath: path.join(frontendPath, 'src'),
  pagesPath: path.join(distPath, 'pages'),            // SvelteKit has NO static HTML pages!
};
```

### Structure Comparison

| Component | Legacy Frontend (Vite) | SvelteKit Frontend |
|-----------|------------------------|-------------------|
| Build Output | `dist/` | `build/` |
| Static Assets | `public/` | `static/` |
| HTML Pages | `dist/pages/*.html` (static) | **SSR - No static HTML!** |
| Adapter | N/A | `@sveltejs/adapter-node` |
| Server Type | Static files | Node.js server |

### Consequence

**The backend CANNOT serve SvelteKit directly!** SvelteKit produces a Node.js application, NOT static HTML files.

### Required Decision

You must choose ONE of these options BEFORE proceeding:

| Option | Description | Effort | Recommended |
|--------|-------------|--------|-------------|
| **A** | Run SvelteKit as separate container/process | Medium | **YES - Dev Mode** |
| **B** | Update backend to proxy to SvelteKit | High | For Production |
| **C** | Switch to `@sveltejs/adapter-static` | High | NO - Loses SSR |

**Recommended Path**: Continue with **Option A** for development. Address backend integration in a separate task after directory rename.

---

## Pre-Flight Checklist

Before executing ANY commands, verify:

- [ ] All Docker containers are stopped (`docker-compose down`)
- [ ] No running dev servers (`lsof -i :5173 && lsof -i :5174`)
- [ ] Git status is clean (all changes committed)
- [ ] pnpm-lock.yaml has no pending changes
- [ ] Database backup exists (precautionary)
- [ ] **DECISION MADE**: Which architectural option (A/B/C)?

---

## COMPLETE File Reference Analysis

### Files WITH "frontend-svelte" References (MUST UPDATE)

| Priority | File | Line(s) | Current Value | New Value |
|----------|------|---------|---------------|-----------|
| HIGH | `pnpm-workspace.yaml` | 3 | `- "frontend-svelte"` | REMOVE |
| HIGH | `package.json` (root) | 41 | `"predev:svelte": "./scripts/free-port.sh 5174"` | Change to 5173 |
| HIGH | `package.json` (root) | 42 | `"dev:svelte": "cd frontend-svelte && pnpm run dev"` | Change to `frontend` |
| HIGH | `eslint.config.js` | 70-71 | `'frontend-svelte/**'`, `'frontend-svelte/.svelte-kit/**'` | `'frontend-legacy/**'` |
| HIGH | `.gitignore` | 26-27 | `frontend-svelte/build/`, `frontend-svelte/.svelte-kit/` | `frontend/build/`, `frontend/.svelte-kit/` |
| HIGH | `frontend-svelte/package.json` | 2 | `"name": "assixx-frontend-svelte"` | `"name": "assixx-frontend"` |
| HIGH | `frontend-svelte/vite.config.ts` | 13, 14, 19 | `port: 5174` | `port: 5173` |
| MEDIUM | `vitest.config.ts` | 17 | `port: 5174` | `port: 5173` (optional - Vitest UI) |
| LOW | `frontend-svelte/src/lib/utils/avatar-helpers.ts` | 6 | Comment: `@see frontend-svelte/...` | Update comment |

### Files WITH Port 5174 References (MUST UPDATE)

| File | Line(s) | Description |
|------|---------|-------------|
| `package.json` (root) | 41 | `predev:svelte` script |
| `frontend-svelte/vite.config.ts` | 13, 14, 19 | Dev server + HMR port |
| `vitest.config.ts` | 17 | Vitest UI API port |

### Files WITHOUT "frontend-svelte" BUT Need Attention

| File | Status | Issue |
|------|--------|-------|
| `backend/src/nest/main.ts` | **CRITICAL** | Hardcoded paths for legacy frontend structure |
| `docker/docker-compose.yml` | OK | Uses `../frontend:/app/frontend` - will work |
| `docker/Dockerfile.dev` | OK | Copies `frontend/package.json` - will work |
| `tsconfig.json` (root) | **VERIFY** | References `./frontend` - needs verification with SvelteKit |

### Files AUTO-UPDATED (Do Not Edit Manually)

| File | Action |
|------|--------|
| `pnpm-lock.yaml` | Will regenerate via `pnpm install` |

### Documentation Files (Update Later - Non-Critical)

These files contain historical references to `frontend-svelte/`:
- `docs/SVELTEKIT-MIGRATION-PLAN.md` (50+ references)
- `docs/ARCHITECTURE-DECISION-NO-TRPC.md`
- `docs/SVELTEKIT-REFACTORING-CHECKLIST.md`
- `frontend-svelte/docs/LEVEL3-REFACTOR-TRACKER.md`

**Action**: Update these AFTER successful migration as a separate task.

---

## Backend Incompatibility Details

### Current Backend Static File Serving

The backend serves these routes (from `main.ts`):

```typescript
// Line 115-158 - setupStaticAssets()
// Main dist directory (Vite build output)
await app.register(fastifyStatic, {
  root: distPath,  // = frontend/dist/ - SvelteKit has frontend/build/!
  prefix: '/',
});

// Source assets (non-bundled)
await app.register(fastifyStatic, {
  root: path.join(srcPath, 'assets'),  // = frontend/src/assets/
  prefix: '/assets/',
});

// Public folder
await app.register(fastifyStatic, {
  root: publicPath,  // = frontend/public/ - SvelteKit has frontend/static/!
  prefix: '/public/',
});
```

### Current Backend HTML Routes

```typescript
// Line 162-214 - setupHtmlRoutes()
// Serves static HTML files from frontend/dist/pages/
fastify.get('/', async (request, reply) => {
  const indexPath = path.join(pagesPath, 'index.html');  // DOESN'T EXIST IN SVELTEKIT!
  // ...
});
```

### Impact After Migration

| Route | Legacy (Works) | SvelteKit (After Migration) |
|-------|----------------|----------------------------|
| `/` | Serves `dist/pages/index.html` | **404 - File doesn't exist** |
| `/dashboard` | Serves `dist/pages/dashboard.html` | **404 - File doesn't exist** |
| `/api/v2/*` | Works | Works (no change) |
| `/uploads/*` | Works | Works (no change) |

### Solution

**For Development (Immediate)**:
- Run SvelteKit on port 5173 as separate process
- Backend serves only API (`/api/v2/*`) and uploads
- Access app via `http://localhost:5173` (SvelteKit)
- SvelteKit proxies API calls to backend (already configured)

**For Production (Future Task)**:
- Add SvelteKit container to docker-compose
- Use nginx as reverse proxy
- OR update backend to proxy to SvelteKit

---

## Port Configuration

### Current Ports

| Service | Port | Server |
|---------|------|--------|
| Legacy Frontend (Vite) | 5173 | `vite dev` |
| SvelteKit Frontend | 5174 | `vite dev` (SvelteKit) |
| NestJS Backend | 3000 | `node dist/nest/main.js` |

### After Migration

| Service | Port | Server |
|---------|------|--------|
| Frontend (SvelteKit) | 5173 | Changed from 5174 |
| Legacy Frontend | ARCHIVED | No longer running |
| NestJS Backend | 3000 | Unchanged (API only in dev) |

### SvelteKit Proxy (Already Configured)

```typescript
// frontend-svelte/vite.config.ts - Lines 25-38
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
  '/uploads': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
}
```

This means in dev mode, SvelteKit proxies API calls to backend automatically!

---

## Step-by-Step Migration Commands

### Phase 1: Preparation

```bash
# 1.1 Stop all Docker containers
cd /home/scs/projects/Assixx/docker
docker-compose down

# 1.2 Kill any running dev servers
pkill -f "vite" || true
pkill -f "node" || true

# 1.3 Verify no processes on ports
lsof -i :5173 -i :5174 -i :3000 || echo "All ports free"

# 1.4 Verify git status
cd /home/scs/projects/Assixx
git status

# 1.5 Create safety backup
tar -czf ../assixx-backup-$(date +%Y%m%d_%H%M%S).tar.gz .
echo "Backup created at ../assixx-backup-*.tar.gz"
```

### Phase 2: Archive Legacy Frontend

```bash
cd /home/scs/projects/Assixx

# 2.1 Rename frontend to frontend-legacy
mv frontend frontend-legacy

# 2.2 Verify rename
ls -la | grep frontend
# Should show: frontend-legacy/

# 2.3 Create ZIP archive of legacy frontend
zip -r frontend-legacy-archive-$(date +%Y%m%d).zip frontend-legacy/

# 2.4 Verify ZIP created
ls -lh frontend-legacy-archive-*.zip
```

### Phase 3: Rename SvelteKit Frontend

```bash
# 3.1 Rename frontend-svelte to frontend
mv frontend-svelte frontend

# 3.2 Verify structure
ls -la | grep frontend
# Should show:
# frontend/         (NEW - SvelteKit)
# frontend-legacy/  (OLD - Vite)

# 3.3 Verify SvelteKit files exist
ls -la frontend/
# Should show: svelte.config.js, vite.config.ts, src/, static/, etc.
```

### Phase 4: Update Configuration Files

#### 4.1 Update pnpm-workspace.yaml

**File**: `/home/scs/projects/Assixx/pnpm-workspace.yaml`

**FROM:**
```yaml
packages:
  - "frontend"
  - "frontend-svelte"
  - "backend"
```

**TO:**
```yaml
packages:
  - "frontend"
  - "backend"
```

#### 4.2 Update package.json (root) - TWO CHANGES

**File**: `/home/scs/projects/Assixx/package.json`

**Change 1 - Line 41:**
```json
// FROM:
"predev:svelte": "./scripts/free-port.sh 5174",

// TO:
"predev:svelte": "./scripts/free-port.sh 5173",
```

**Change 2 - Line 42:**
```json
// FROM:
"dev:svelte": "cd frontend-svelte && pnpm run dev",

// TO:
"dev:svelte": "cd frontend && pnpm run dev",
```

#### 4.3 Update eslint.config.js

**File**: `/home/scs/projects/Assixx/eslint.config.js`

**FROM (lines 70-71):**
```javascript
'frontend-svelte/**',
'frontend-svelte/.svelte-kit/**',
```

**TO:**
```javascript
'frontend-legacy/**',
```

#### 4.4 Update .gitignore

**File**: `/home/scs/projects/Assixx/.gitignore`

**FROM (lines 26-27):**
```
frontend-svelte/build/
frontend-svelte/.svelte-kit/
```

**TO:**
```
frontend/build/
frontend/.svelte-kit/
frontend-legacy/
```

#### 4.5 Update frontend/package.json (was frontend-svelte/package.json)

**File**: `/home/scs/projects/Assixx/frontend/package.json`

**FROM (line 2):**
```json
"name": "assixx-frontend-svelte",
```

**TO:**
```json
"name": "assixx-frontend",
```

#### 4.6 Update frontend/vite.config.ts - THREE CHANGES

**File**: `/home/scs/projects/Assixx/frontend/vite.config.ts`

**Change 1 - Line 13:**
```typescript
// FROM:
port: 5174,

// TO:
port: 5173,
```

**Change 2 - Line 14:**
```typescript
// FROM:
strictPort: true, // Fail if port 5174 is unavailable (5173 = legacy Vite)

// TO:
strictPort: true, // Fail if port 5173 is unavailable
```

**Change 3 - Line 19:**
```typescript
// FROM:
port: 5174,

// TO:
port: 5173,
```

#### 4.7 Update vitest.config.ts (Optional but Recommended)

**File**: `/home/scs/projects/Assixx/vitest.config.ts`

**FROM (line 17):**
```typescript
port: 5174,
```

**TO:**
```typescript
port: 5175, // Avoid conflict with dev server
```

#### 4.8 Update frontend/src/lib/utils/avatar-helpers.ts (Optional)

**File**: `/home/scs/projects/Assixx/frontend/src/lib/utils/avatar-helpers.ts`

**FROM (line 6):**
```typescript
* @see frontend-svelte/src/design-system/primitives/avatar/avatar.css
```

**TO:**
```typescript
* @see frontend/src/design-system/primitives/avatar/avatar.css
```

### Phase 5: Verify tsconfig References

The root `tsconfig.json` references `./frontend`:

```json
"references": [{ "path": "./backend" }, { "path": "./frontend" }],
```

**Issue**: The SvelteKit `frontend/tsconfig.json` extends `./.svelte-kit/tsconfig.json`.

**Action**: After rename, verify:
```bash
cd /home/scs/projects/Assixx/frontend
cat tsconfig.json
# Should extend "./.svelte-kit/tsconfig.json"

# Regenerate SvelteKit config
pnpm exec svelte-kit sync
```

### Phase 6: Regenerate Dependencies

```bash
cd /home/scs/projects/Assixx

# 6.1 Remove old node_modules (clean slate)
rm -rf node_modules
rm -rf frontend/node_modules
rm -rf frontend-legacy/node_modules
rm -rf backend/node_modules

# 6.2 Remove pnpm-lock.yaml (will regenerate)
rm pnpm-lock.yaml

# 6.3 Reinstall all dependencies
pnpm install

# 6.4 Verify workspace packages
pnpm list --depth 0
# Should show: assixx, assixx-frontend, assixx-backend
```

### Phase 7: Verification

```bash
cd /home/scs/projects/Assixx

# 7.1 Verify ESLint works
pnpm run lint

# 7.2 Verify SvelteKit sync
cd frontend
pnpm exec svelte-kit sync

# 7.3 Verify SvelteKit check
pnpm run check

# 7.4 Verify frontend build
pnpm run build

# 7.5 Start dev server
pnpm run dev
# Should start on http://localhost:5173
# Open browser and verify pages load
```

### Phase 8: Docker Verification

**Note**: Backend will NOT serve frontend pages after migration! Only API works.

```bash
cd /home/scs/projects/Assixx/docker

# 8.1 Rebuild and start Docker containers
docker-compose up -d --build

# 8.2 Check container status
docker-compose ps

# 8.3 Verify backend health (API only)
curl -s http://localhost:3000/health | jq '.'

# 8.4 Verify API works
curl -s http://localhost:3000/api/v2/auth/check

# 8.5 Check Docker logs
docker-compose logs backend --tail=50

# EXPECTED BEHAVIOR:
# - http://localhost:3000/ → 404 (no static HTML)
# - http://localhost:3000/api/v2/* → Works
# - http://localhost:5173/ → Works (run SvelteKit separately)
```

---

## Development Workflow After Migration

### Running in Development

```bash
# Terminal 1: Start Docker (Backend + DB + Redis)
cd /home/scs/projects/Assixx/docker
docker-compose up -d

# Terminal 2: Start SvelteKit Frontend
cd /home/scs/projects/Assixx
pnpm run dev:svelte
# Opens http://localhost:5173
```

### Access Points

| URL | Service |
|-----|---------|
| `http://localhost:5173` | SvelteKit Frontend (development) |
| `http://localhost:3000/api/v2/*` | NestJS Backend API |
| `http://localhost:3000/health` | Backend health check |
| `http://localhost:3000/uploads/*` | Uploaded files |

---

## Rollback Plan

If anything fails, execute these commands:

```bash
# ROLLBACK - Execute only if migration fails!

cd /home/scs/projects/Assixx

# 1. Restore frontend directories
mv frontend frontend-broken
mv frontend-legacy frontend
# Optionally restore frontend-svelte from broken state
mv frontend-broken frontend-svelte

# 2. Git reset configuration changes
git checkout -- pnpm-workspace.yaml
git checkout -- package.json
git checkout -- eslint.config.js
git checkout -- .gitignore
git checkout -- vitest.config.ts

# 3. Remove broken state
rm -rf node_modules

# 4. Reinstall dependencies
pnpm install

# 5. Verify rollback
pnpm run lint
cd frontend && pnpm run build
```

---

## Post-Migration Tasks (Future Work)

### Immediate (After Migration)

1. Test all 34 SvelteKit pages manually
2. Verify API calls work through proxy
3. Test file uploads
4. Test WebSocket chat functionality

### Short-Term

1. **Update Documentation**: Replace all `frontend-svelte` references in docs
2. **Backend Integration Decision**: Choose Option A, B, or C for production

### Long-Term

1. **Docker Production Setup**: Add SvelteKit container
2. **CI/CD Pipeline**: Update build scripts
3. **Remove frontend-legacy**: After 30 days of stable operation

---

## Summary: Files to Edit

### CRITICAL (6 files, 10 changes)

| # | File | Changes |
|---|------|---------|
| 1 | `pnpm-workspace.yaml` | Remove `"frontend-svelte"` line |
| 2 | `package.json` (root) | Line 41: 5174→5173, Line 42: frontend-svelte→frontend |
| 3 | `eslint.config.js` | Lines 70-71: frontend-svelte→frontend-legacy |
| 4 | `.gitignore` | Lines 26-27: frontend-svelte→frontend, add frontend-legacy |
| 5 | `frontend/package.json` | Line 2: name change |
| 6 | `frontend/vite.config.ts` | Lines 13, 14, 19: 5174→5173 |

### RECOMMENDED (2 files, 2 changes)

| # | File | Changes |
|---|------|---------|
| 7 | `vitest.config.ts` | Line 17: 5174→5175 |
| 8 | `frontend/src/lib/utils/avatar-helpers.ts` | Line 6: comment update |

---

## Approval Signature

- [ ] **CRITICAL ISSUE ACKNOWLEDGED**: Backend incompatibility understood
- [ ] **DECISION MADE**: Development workflow (Option A) accepted
- [ ] **User Approval Required Before Execution**
- [ ] All 10 file changes reviewed
- [ ] Backup strategy confirmed
- [ ] Rollback plan understood

---

**Document Version**: 2.0.0
**Last Updated**: 2026-01-06
**Revision Reason**: Complete rewrite after double-check - found 4 missed files and critical backend incompatibility
