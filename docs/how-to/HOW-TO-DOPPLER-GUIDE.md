# Doppler Secret Management Guide

> Assixx — central secrets management with Doppler

**As of:** 2026-04-03
**Doppler CLI:** v3.75.3
**Project:** assixx
**Configs:** dev, stg, prd

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [The 2 pillars: Doppler + .locklock](#2-the-2-pillars-doppler--locklock)
3. [Understanding the token system](#3-understanding-the-token-system)
4. [Docker commands with Doppler](#4-docker-commands-with-doppler)
5. [Development workflow](#5-development-workflow)
6. [Production workflow](#6-production-workflow)
7. [Lost a token? Create a new one](#7-lost-a-token-create-a-new-one)
8. [Managing secrets](#8-managing-secrets)
9. [Team: token management for developers](#9-team-token-management-for-developers)
10. [Multi-environment setup (dev / stg / prd)](#10-multi-environment-setup-dev--stg--prd)
11. [Service tokens for deployment](#11-service-tokens-for-deployment)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Quick Start

```bash
# Set token + start Docker
cd /home/scs/projects/Assixx/docker
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose up -d
```

**Or permanently in your shell:**

```bash
# Once in ~/.bashrc
echo 'export DOPPLER_TOKEN="dp.st.dev.xxx"' >> ~/.bashrc
source ~/.bashrc

# From now on, just:
doppler run -- docker-compose up -d
```

---

## 2. The 2 Pillars: Doppler + .locklock

### IMPORTANT: secrets live ONLY in Doppler + .locklock!

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CHANGING A SECRET?                                 │
│                                                                              │
│   1. DOPPLER        →  Source of truth for DEV + PROD (THE single source!) │
│   2. .locklock      →  ALWAYS update as archive + emergency backup!         │
│                                                                              │
│   docker/.env contains NO MORE secrets! Only configuration (ports, hosts).  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The 2 pillars explained

| Pillar        | Purpose                       | When to update? |
| ------------- | ----------------------------- | --------------- |
| **Doppler**   | Active secrets for DEV + PROD | On every change |
| **.locklock** | Archive + safety + emergency  | On every change |

### What about docker/.env?

`docker/.env` only contains **non-secrets** (ports, hostnames, versions).
Without Doppler, `docker-compose` fails immediately with clear error messages:

```
ERROR: required variable REDIS_PASSWORD is missing a value:
  REDIS_PASSWORD must be set - use doppler run
```

### Why only 2 pillars?

```
Scenario 1: Doppler works (normal case)
├── doppler run -- docker-compose up -d
└── ✅ Secrets come from Doppler

Scenario 2: Doppler down / token lost
├── docker-compose up -d (without doppler run)
├── ❌ Error: "JWT_SECRET must be set - use doppler run"
├── Open .locklock → set secrets manually as ENV
└── ✅ Emergency recovery possible

Scenario 3: Everything broken / new machine / disaster recovery
├── Open .locklock
└── ✅ All secrets + history + tokens documented
```

### Workflow on a secret change

```bash
# Example: rotate JWT_SECRET

# 1. Generate a new secret
NEW_JWT=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# 2. Update in DOPPLER (primary)
doppler secrets set JWT_SECRET="$NEW_JWT" --project assixx --config dev

# 3. Document in .locklock (archive)
# → Manually: move old value to ARCHIVE section
# → Add new value to CURRENT section

# docker/.env does NOT need to be updated (contains no secrets!)
```

### Checklist on every secret change

```
□ Doppler updated?     → doppler secrets set ...
□ .locklock updated?   → archive + documentation
```

---

## 3. Understanding the Token System

### What is the DOPPLER_TOKEN?

| Property          | Value                             |
| ----------------- | --------------------------------- |
| **What is it?**   | Service token for the Doppler API |
| **Who needs it?** | Docker, CI/CD, scripts            |
| **Permission**    | Read-only on `assixx/dev` config  |

### IMPORTANT: the token is shown only ONCE!

```
┌─────────────────────────────────────────────────────────────┐
│  Create token                                               │
│  └── doppler configs tokens create NAME ...                 │
│      └── Token shown ONCE: dp.st.dev.xxxxx                   │
│          └── Save IMMEDIATELY in .locklock!                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Afterwards in Doppler Cloud                                │
│  └── Token VALUE is no longer visible                       │
│  └── Only token NAME and metadata visible                   │
│  └── This is a SECURITY FEATURE!                            │
└─────────────────────────────────────────────────────────────┘
```

### Where do I find my token?

| Location                     | Token value visible? | Note                     |
| ---------------------------- | -------------------- | ------------------------ |
| `.locklock`                  | ✅ YES               | **Your local reference** |
| Doppler Cloud dashboard      | ❌ NO                | Only name/metadata       |
| `doppler configs tokens` CLI | ❌ NO                | Only name/metadata       |

**The token value lives ONLY in `.locklock`!**

```bash
# Show token from .locklock
grep -A 2 "docker-dev:" /home/scs/projects/Assixx/.locklock
```

---

## 4. Docker Commands with Doppler

### Basic commands

> **Profile system** (ADR-027 amendment 2026-04-28): `backend`/`deletion-worker` live in the `dev` profile, `backend-prod`/`deletion-worker-prod` in the `production` profile. Default via `docker/.env`: `COMPOSE_PROFILES=dev,observability`.

```bash
cd /home/scs/projects/Assixx/docker

# Default (reads .env default: dev,observability) — backend (dev) + PG + Redis + observability
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose up -d

# Explicit dev only (no observability)
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile dev up -d

# Explicit dev + observability
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile dev --profile observability up -d

# Production (CI parity: backend-prod from docker/Dockerfile + frontend + Nginx + observability)
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile production up -d
```

### Stop

```bash
# Stop dev stack
doppler run -- docker-compose --profile dev down

# With observability
doppler run -- docker-compose --profile dev --profile observability down

# Stop production
doppler run -- docker-compose --profile production down
```

### Rebuild (after a dependency change)

```bash
# Rebuild DEV backend (profile dev required — otherwise "service not found")
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile dev build --no-cache backend

# Rebuild PROD completely (backend-prod + frontend)
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile production build --no-cache
```

---

## 5. Development Workflow

### Start DEV (default)

```bash
# Terminal 1: Docker services (.env default: COMPOSE_PROFILES=dev,observability)
cd /home/scs/projects/Assixx/docker
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose up -d
# OR explicit:
# DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile dev --profile observability up -d

# Terminal 2: frontend dev server (HMR)
cd /home/scs/projects/Assixx
pnpm run dev:svelte
```

### DEV URLs

| Service        | URL                   | Description      |
| -------------- | --------------------- | ---------------- |
| Frontend (HMR) | http://localhost:5173 | Vite dev server  |
| Backend API    | http://localhost:3000 | NestJS + Fastify |
| Grafana        | http://localhost:3050 | Dashboards       |
| Prometheus     | http://localhost:9090 | Metrics          |
| Loki           | http://localhost:3100 | Logs             |

### After a code change

| Change                | Command                                                |
| --------------------- | ------------------------------------------------------ |
| Backend code          | `docker-compose restart backend`                       |
| Frontend code         | **Nothing** — HMR reloads automatically                |
| Backend dependencies  | `docker-compose build backend && docker-compose up -d` |
| Frontend dependencies | **Nothing** — runs locally, `pnpm add` is enough       |

### DEV summary

```
┌──────────────┬───────────────────────┬──────────────────────┐
│    Change    │        Backend        │       Frontend       │
├──────────────┼───────────────────────┼──────────────────────┤
│ Code         │ restart backend       │ nothing (HMR)        │
├──────────────┼───────────────────────┼──────────────────────┤
│ Dependencies │ build backend + up -d │ nothing (runs local) │
└──────────────┴───────────────────────┴──────────────────────┘
```

---

## 6. Production Workflow

### Start PROD

```bash
cd /home/scs/projects/Assixx/docker
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile production up -d
```

### PROD URLs

| Service           | URL                   | Description      |
| ----------------- | --------------------- | ---------------- |
| Frontend (SSR)    | http://localhost      | Via Nginx        |
| Frontend (direct) | http://localhost:3001 | SvelteKit Node   |
| Backend API       | http://localhost:3000 | NestJS + Fastify |

### After a code change

| Change        | Command                                                      |
| ------------- | ------------------------------------------------------------ |
| Backend code  | `docker-compose --profile production restart backend-prod`   |
| Frontend code | `docker-compose --profile production up -d --build frontend` |

### PROD summary

```
┌──────────────┬──────────────────────────────────────────────────────┐
│    Step      │                       Command                        │
├──────────────┼──────────────────────────────────────────────────────┤
│ Build PROD   │ docker-compose --profile production build --no-cache │
├──────────────┼──────────────────────────────────────────────────────┤
│ Start PROD   │ docker-compose --profile production up -d            │
├──────────────┼──────────────────────────────────────────────────────┤
│ Stop PROD    │ docker-compose --profile production down             │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

## 7. Lost a Token? Create a New One

### Step 1: revoke the old token

```bash
doppler configs tokens revoke docker-dev --project assixx --config dev
```

### Step 2: create a new token

```bash
doppler configs tokens create docker-dev-v2 \
  --project assixx \
  --config dev \
  --max-age 0 \
  --plain
```

**Output (ONCE!):**

```
dp.st.dev.NEWTOKENxxxxxxxxxxxxxxxxxxxxx
```

### Step 3: save IMMEDIATELY in .locklock

```bash
# Open .locklock and update the token
nano /home/scs/projects/Assixx/.locklock

# Replace the value under "Doppler Service Tokens:"
```

### Step 4: update ~/.bashrc (if used)

```bash
# Replace the old line
nano ~/.bashrc
# export DOPPLER_TOKEN="dp.st.dev.NEWTOKEN..."
source ~/.bashrc
```

---

## 8. Managing Secrets

### Show all secrets

```bash
doppler secrets --project assixx --config dev
```

### Get a single secret

```bash
doppler secrets get JWT_SECRET --project assixx --config dev
```

### Add/change a secret

```bash
doppler secrets set NEW_SECRET="value" --project assixx --config dev
```

### Delete a secret

```bash
doppler secrets delete OLD_SECRET --project assixx --config dev
```

### Multiple secrets at once (JSON upload)

```bash
# 1. Create JSON
cat > /tmp/secrets.json << 'EOF'
{
  "NEW_KEY_1": "value1",
  "NEW_KEY_2": "value2"
}
EOF

# 2. Upload
doppler secrets upload /tmp/secrets.json --project assixx --config dev

# 3. Delete the JSON!
rm /tmp/secrets.json
```

### Activity log (who changed what?)

```bash
doppler activity --project assixx
```

---

## 9. Team: Token Management for Developers

### Ground rule: one token per developer

```
┌─────────────────────────────────────────────────────────────┐
│  NEVER share one token with everyone!                       │
│  → Every developer gets their OWN token                     │
└─────────────────────────────────────────────────────────────┘
```

### Create a token for a new developer

```bash
# You (admin) create a token for "Max"
doppler configs tokens create max-dev \
  --project assixx \
  --config dev \
  --max-age 90d \
  --plain

# Output: dp.st.dev.MAXTOKENxxxxx
# → Token shown ONCE, write it down immediately!
```

### Hand the token over securely

| Method                                     | Security    |
| ------------------------------------------ | ----------- |
| ❌ Email                                   | NEVER       |
| ❌ Slack/Teams                             | NEVER       |
| ⚠️ Signal/WhatsApp (disappearing)          | OK          |
| ✅ In person / video call                  | Best option |
| ✅ Password manager (1Password, Bitwarden) | Best option |

### What the new developer has to do

```bash
# 1. Install the Doppler CLI
curl -Ls --tlsv1.2 --proto "=https" \
  "https://cli.doppler.com/install.sh" | sudo sh

# 2. Start Docker WITH the token (explicit, no export!)
cd /home/scs/projects/Assixx/docker
DOPPLER_TOKEN="dp.st.dev.MAXTOKENxxx" doppler run -- docker-compose up -d

# 3. With observability
DOPPLER_TOKEN="dp.st.dev.MAXTOKENxxx" doppler run -- docker-compose --profile observability up -d
```

### What the developer does NOT need

| Needs it? | What?                           |
| --------- | ------------------------------- |
| ❌ NO     | Doppler account                 |
| ❌ NO     | Doppler login (`doppler login`) |
| ❌ NO     | Access to the Doppler dashboard |
| ✅ YES    | Their service token             |
| ✅ YES    | Doppler CLI installed           |
| ✅ YES    | Docker installed                |

### Show all team tokens

```bash
doppler configs tokens --project assixx --config dev
```

### Revoke a token (developer leaves the team)

```bash
# Max leaves the team → revoke the token immediately
doppler configs tokens revoke max-dev --project assixx --config dev
```

### Token naming convention

```
Format: [name]-[environment]

Examples:
├── docker-dev      → your local token
├── max-dev         → Max's token
├── anna-dev        → Anna's token
├── ci-github-dev   → GitHub Actions
└── ci-github-prod  → GitHub Actions production
```

### Team token checklist

```
New developer:
□ Token created: doppler configs tokens create NAME-dev ...
□ Token handed over securely (NOT via email!)
□ Documented in .locklock (token NAME only, not the value!)

Developer leaves the team:
□ Token revoked: doppler configs tokens revoke NAME-dev ...
□ Removed from .locklock
```

### Audit: who accessed what and when?

```bash
# Show activity log
doppler activity --project assixx

# Shows: token name, timestamp, action
```

---

## 10. Multi-Environment Setup (dev / stg / prd)

### Overview

Assixx has **3 Doppler configs** with independent, cryptographically strong secrets:

| Config  | Purpose           | NODE_ENV    | Domains                        | Secrets                      |
| ------- | ----------------- | ----------- | ------------------------------ | ---------------------------- |
| **dev** | Local development | development | localhost:3000, localhost:5173 | Dev passwords (`dev_only_*`) |
| **stg** | Staging / QA      | production  | stg.assixx.com, stg.assixx.de  | 128-char hex secrets         |
| **prd** | Live production   | production  | assixx.com, assixx.de, www.\*  | 128-char hex secrets         |

> **Why `NODE_ENV=production` for stg?** The backend config validator (`config.service.ts`) only accepts
> `development`, `production`, `test`. Staging-specific behaviour is steered via `LOG_LEVEL`,
> `ALLOWED_ORIGINS`, and `ORIGIN`.

### Differences between the environments

| Variable          | dev                       | stg                           | prd                           |
| ----------------- | ------------------------- | ----------------------------- | ----------------------------- |
| `LOG_LEVEL`       | debug                     | info                          | warn                          |
| `ALLOWED_ORIGINS` | localhost:3000,5173       | stg.assixx.com, stg.assixx.de | assixx.com, assixx.de, www.\* |
| `ORIGIN`          | http://localhost          | https://stg.assixx.com        | https://assixx.com            |
| `REDIS_PASSWORD`  | `dev_only_redis_p@ss_...` | 64-char hex                   | 64-char hex                   |
| `JWT_SECRET`      | `DEV_91040ae...`          | 128-char hex                  | 128-char hex                  |
| All other secrets | Dev strings               | Independently generated       | Independently generated       |

**Every environment has fully independent secrets.** No secret is shared between stg/prd
(except Sentry DSN and Grafana Cloud keys — those are monitoring endpoints, not secrets).

### Environment seeder script

Secrets for stg/prd are generated with the seeder script:

```bash
# Preview (no write access)
./scripts/doppler-seed-environment.sh stg --dry-run
./scripts/doppler-seed-environment.sh prd --dry-run

# Actually seed (requires confirmation)
./scripts/doppler-seed-environment.sh stg
./scripts/doppler-seed-environment.sh prd

# Overwrite existing secrets (e.g. for rotation)
./scripts/doppler-seed-environment.sh prd --force
```

**Safety rules of the script:**

- `dev` is **always rejected** — dev secrets are managed separately
- Secrets are **never** printed to stdout
- Confirmation: you have to type the environment name
- Automatic verification: JWT≠Refresh, minimum lengths, all critical keys set

### Compare secrets (only names, never values!)

```bash
# Which secrets does stg have?
doppler secrets --project assixx --config stg --only-names

# Which secrets does prd have?
doppler secrets --project assixx --config prd --only-names

# Inspect a single secret (length, not value)
doppler secrets get JWT_SECRET --project assixx --config prd --plain | wc -c
```

### Manual secret change (e.g. SMTP)

```bash
# Set SMTP for production
doppler secrets set SMTP_USER="real-email@assixx.com" --project assixx --config prd
doppler secrets set SMTP_PASS="app-specific-password" --project assixx --config prd

# Change a domain
doppler secrets set ALLOWED_ORIGINS="https://new-domain.com" --project assixx --config prd
```

---

## 11. Service Tokens for Deployment

### What is a service token?

A service token is a **read-only API key** that lets a server/container pull
secrets from a specific Doppler config. Every environment needs its own token.

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Your laptop (dev)         Staging server          Production server   │
│   ┌─────────────┐           ┌─────────────┐         ┌─────────────┐   │
│   │ docker-dev  │           │ docker-stg  │         │ docker-prd  │   │
│   │ Token       │           │ Token       │         │ Token       │   │
│   └──────┬──────┘           └──────┬──────┘         └──────┬──────┘   │
│          │                         │                       │          │
│          ▼                         ▼                       ▼          │
│   ┌─────────────┐           ┌─────────────┐         ┌─────────────┐   │
│   │ Doppler dev │           │ Doppler stg │         │ Doppler prd │   │
│   │ Config      │           │ Config      │         │ Config      │   │
│   └─────────────┘           └─────────────┘         └─────────────┘   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### Current status

| Token        | Config | Created             | Stored in |
| ------------ | ------ | ------------------- | --------- |
| `docker-dev` | dev    | 2026-01-14          | .locklock |
| —            | stg    | **Not yet created** | —         |
| —            | prd    | **Not yet created** | —         |

**stg/prd tokens are only needed when a staging or production server is set up.**
As long as everything runs locally, the `docker-dev` token is enough.

### Create a token (when deployment is due)

```bash
# Create staging token (shown ONCE!)
doppler configs tokens create docker-stg \
  --project assixx \
  --config stg \
  --max-age 0 \
  --plain
# Output: dp.st.stg.xxxxx → save IMMEDIATELY in .locklock!

# Create production token
doppler configs tokens create docker-prd \
  --project assixx \
  --config prd \
  --max-age 0 \
  --plain
# Output: dp.st.prd.xxxxx → save IMMEDIATELY in .locklock!
```

### Use the token on the server

```bash
# On the staging server:
export DOPPLER_TOKEN="dp.st.stg.xxxxx"
doppler run -- docker-compose --profile production up -d

# On the production server:
export DOPPLER_TOKEN="dp.st.prd.xxxxx"
doppler run -- docker-compose --profile production up -d
```

### Safety rules

- **1 token per server/environment** — never share the same token
- **Token value shown only ONCE** — document immediately in .locklock
- **Revoke the token on compromise:**
  ```bash
  doppler configs tokens revoke docker-stg --project assixx --config stg
  ```
- **Tokens have no expiry** (`max-age 0`) — rotate manually as needed

---

## 12. Troubleshooting

### "you must provide a token"

```bash
# Token not set
export DOPPLER_TOKEN="dp.st.dev.xxx"
# or
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- ...
```

### "invalid token"

```bash
# Token wrong or revoked
# → create a new token (see section 6)
```

### "Secrets not injected"

```bash
# Test: are secrets being loaded?
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- printenv | grep JWT

# If empty → check the token
doppler whoami
```

### Container does not start

```bash
# 1. Check logs
docker logs assixx-backend

# 2. Check secrets
doppler secrets --project assixx --config dev | grep -i error

# 3. Emergency: set secrets manually from .locklock
export JWT_SECRET="value-from-locklock"
export DB_PASSWORD="value-from-locklock"
export REDIS_PASSWORD="value-from-locklock"
# ... more secrets from .locklock
docker-compose up -d
```

### How does secret injection work?

```
doppler run -- docker-compose up -d
       │
       ▼
┌─────────────────────────────────────┐
│ 1. Doppler injects secrets as       │
│    environment variables            │
│ 2. docker-compose reads ${VAR}      │
│ 3. docker/.env provides ONLY        │
│    non-secrets (ports, hosts)       │
│ 4. Missing secrets → clear error    │
│    "must be set - use doppler run"  │
└─────────────────────────────────────┘
```

**Without Doppler NOTHING starts.** That is intentional — no accidental starts with empty secrets.

---

## Quick Reference

```bash
# === DOPPLER CLI ===
doppler login                                    # browser auth
doppler whoami                                   # current user
doppler secrets --project assixx --config dev    # all dev secrets
doppler secrets --project assixx --config stg    # all staging secrets
doppler secrets --project assixx --config prd    # all production secrets
doppler configs --project assixx                 # list all configs

# === TOKEN MANAGEMENT ===
doppler configs tokens --project assixx --config dev              # list tokens
doppler configs tokens create NAME --project assixx --config dev  # new token
doppler configs tokens revoke NAME --project assixx --config dev  # delete token

# === DOCKER WITH DOPPLER (REQUIRED!) ===
DOPPLER_TOKEN="xxx" doppler run -- docker-compose up -d
DOPPLER_TOKEN="xxx" doppler run -- docker-compose --profile observability up -d
DOPPLER_TOKEN="xxx" doppler run -- docker-compose --profile production up -d

# === ENVIRONMENT SEEDER (stg/prd) ===
./scripts/doppler-seed-environment.sh stg --dry-run   # staging preview
./scripts/doppler-seed-environment.sh prd --dry-run   # production preview
./scripts/doppler-seed-environment.sh stg             # seed staging
./scripts/doppler-seed-environment.sh prd             # seed production
./scripts/doppler-seed-environment.sh prd --force     # rotate secrets

# === EMERGENCY (without Doppler — secrets from .locklock) ===
# export JWT_SECRET="..." DB_PASSWORD="..." REDIS_PASSWORD="..." etc.
# docker-compose up -d
```

---

## Important Files

| File                                  | Contents                                  | In Git? |
| ------------------------------------- | ----------------------------------------- | ------- |
| `.locklock`                           | Token values, passwords, archive          | ❌ NO   |
| `docker/.env`                         | Non-secrets only (ports, hosts, versions) | ❌ NO   |
| `docker/.env.example`                 | Template with CHANGE_ME placeholders      | ✅ YES  |
| `scripts/doppler-seed-environment.sh` | Environment seeder (stg/prd)              | ✅ YES  |
| `docs/DOPPLER-IMPLEMENTATION-PLAN.md` | Implementation details                    | ✅ YES  |
| `HOW-TO-DOPPLER-GUIDE.md`             | This guide                                | ❌ NO   |

---

**Last update:** 2026-04-03
