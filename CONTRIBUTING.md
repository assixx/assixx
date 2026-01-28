# Contributing to Assixx

**Version:** 1.1.0 | **Updated:** 2026-01-28

Before contributing, read [CODE-OF-CONDUCT.md](./docs/CODE-OF-CONDUCT.md).

---

## Prerequisites

- Node.js 24.x
- pnpm 10.x (not npm, not yarn)
- Docker & Docker Compose
- [Doppler CLI](https://docs.doppler.com/docs/install-cli) (required for secret management)
- A Doppler Service Token (request from project maintainer)
- PostgreSQL client (for debugging)

---

## Getting Started

### 1. Doppler Setup (Required)

All secrets (DB passwords, JWT keys, Redis credentials) are managed via [Doppler](https://www.doppler.com/).
**Without a Doppler token, Docker containers will not start.**

You need a Service Token from the project maintainer. You do **not** need:

- A Doppler account
- Access to the Doppler dashboard
- Knowledge of the actual secret values

Once you have your token, install the Doppler CLI:

```bash
curl -Ls --tlsv1.2 --proto "=https" "https://cli.doppler.com/install.sh" | sudo sh
```

### 2. Clone & Start

```bash
# Clone repository
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx

# Start Docker containers (token inline - recommended for first-time setup)
cd docker
DOPPLER_TOKEN="your-token-here" doppler run -- docker-compose up -d

# Or export once per shell session
export DOPPLER_TOKEN="your-token-here"
doppler run -- docker-compose up -d

# Verify health
curl -s http://localhost:3000/health | jq '.'

# Run inside container
docker exec assixx-backend pnpm run type-check
docker exec assixx-backend pnpm run lint
```

> **Note:** See [HOW-TO-DOPPLER-GUIDE.md](./docs/HOW-TO-DOPPLER-GUIDE.md) for the full Doppler reference.

---

## Development Workflow

### 1. Create Branch

```bash
# From master
git checkout master
git pull origin master
git checkout -b feature/short-description
```

**Branch naming:**

- `feature/description` - New functionality
- `bugfix/issue-123-description` - Bug fixes
- `hotfix/critical-fix` - Production fixes
- `refactor/area-description` - Code improvements

### 2. Make Changes

```bash
# Edit files, then verify
docker exec assixx-backend pnpm run type-check
docker exec assixx-backend pnpm run lint

# Build
docker exec assixx-backend pnpm run build
```

### 3. Test

```bash
# API tests with Bruno
pnpm run test:api

# Single module
cd api-tests && npx bru run calendar --env local
```

### 4. Commit

```bash
# Format: <type>(<scope>): <description>
git add .
git commit -m "feat(calendar): add recurring events support"
```

**Commit types:**
| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change (no feature/fix) |
| `test` | Adding tests |
| `chore` | Maintenance |

### 5. Push & Create PR

```bash
git push -u origin feature/short-description
# Create PR via GitHub
```

---

## Pull Request Requirements

Before submitting:

- [ ] `pnpm run lint` = 0 errors
- [ ] `pnpm run type-check` = 0 errors
- [ ] `pnpm run test:api` passes
- [ ] No `any` types without justification
- [ ] No `// TODO:` comments
- [ ] Functions <= 60 lines
- [ ] Commits follow format

**PR Title:** Same format as commits (`feat(scope): description`)

**PR Description:**

```markdown
## Summary

Brief description of changes.

## Test Plan

- [ ] Tested endpoint X with Bruno
- [ ] Verified edge case Y
```

---

## Code Standards Summary

**See:** [CODE-OF-CONDUCT.md](./docs/CODE-OF-CONDUCT.md) for full details.

```
FORBIDDEN                      REQUIRED
--------------------------     --------------------------
any                            unknown + type guard
|| for defaults                ?? (nullish coalescing)
if (value)                     if (value !== null)
// TODO:                       Implement immediately
? placeholders                 $1, $2, $3 (PostgreSQL)
var                            const or let
```

---

## Project Structure

```
Assixx/
├── backend/src/
│   ├── routes/v2/          # API endpoints
│   ├── models/             # Database models
│   ├── services/           # Business logic
│   ├── middleware/         # Express middleware
│   └── types/              # TypeScript types
├── frontend/src/
│   ├── pages/              # HTML pages
│   ├── scripts/            # TypeScript modules
│   ├── styles/             # CSS files
│   └── design-system/      # Component library
├── docker/                 # Docker configuration
├── api-tests/              # Bruno API tests
└── docs/                   # Documentation
```

---

## Common Tasks

### Add New API Endpoint

1. Create route in `backend/src/routes/v2/<module>/`
2. Add Zod validation schema
3. Implement service layer
4. Add Bruno tests in `api-tests/<module>/`
5. Run `pnpm run lint` and `pnpm run type-check`

### Fix a Bug

1. Reproduce with Bruno or browser
2. Find root cause (not symptoms)
3. Write fix
4. Add test case for the bug
5. Verify fix doesn't break other tests

### Database Changes

1. Read [DATABASE-MIGRATION-GUIDE.md](./docs/DATABASE-MIGRATION-GUIDE.md)
2. Create migration SQL file
3. Test on local first
4. Include RLS policy if tenant-specific table

---

## Getting Help

- Check existing documentation in `/docs/`
- Review similar code in the codebase
- Ask in team chat

---

## Review Process

1. PR created -> Automated checks run
2. Code review by team member
3. Address feedback
4. Approval + merge with `--no-ff`

**Merge is blocked if:**

- ESLint errors exist
- TypeScript errors exist
- Tests fail
- No approval from reviewer

---

**Thank you for contributing.**
