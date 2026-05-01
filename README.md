<p align="center">
  <img src="frontend/static/images/logo_darkmode.png" alt="Assixx Logo" width="200">
</p>

# What is Assixx?

**Enterprise 2.0 Platform for Industrial Companies**

[![Version](https://img.shields.io/badge/Version-0.4.13-blue.svg)](https://github.com/assixx/assixx)
[![Status](https://img.shields.io/badge/Status-Development-yellow.svg)](https://github.com/assixx/assixx)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)

Multi-Tenant SaaS for knowledge management, communication, and collaboration in manufacturing companies.

---

## Preview

[Demo-Video ansehen](https://github.com/user-attachments/assets/7854f964-94d7-429a-83b5-bd11a5990770)

---

## Overview

Assixx digitizes existing paper-based processes in industrial companies. From TPM checklists to payroll documents — digital, secure, and efficient.

**Target Audience:** Automotive, Mechanical Engineering, Chemical, Metal Processing | 50–500 employees | Germany

---

## Quick Start

```bash
git clone https://github.com/assixx/assixx.git
cd assixx/docker

# With Doppler (team members):
doppler run -- ./docker-init.sh

# Without Doppler (external contributors):
./docker-init.sh --local
```

After setup completes, start the frontend dev server:

```bash
cd .. && pnpm run dev:svelte
```

Development: `http://localhost:5173` | Production: `http://localhost`

> **Profiles** (ADR-027 Amendment 2026-04-28): `docker/.env` setzt `COMPOSE_PROFILES=dev,observability` als Default. Production-Mode (`backend-prod` aus `docker/Dockerfile`, CI-Parität) via `docker-compose --profile production up -d`. Siehe [docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md](./docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md).

> **Full setup guide:** [docs/DOCKER-SETUP.md](./docs/DOCKER-SETUP.md)
>
> **Microsoft OAuth sign-in** (optional — enables one-click root-user signup via Azure AD): requires a one-time Azure AD app registration + three Doppler secrets (`MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`, `PUBLIC_APP_URL`). See [docs/how-to/HOW-TO-AZURE-AD-SETUP.md](./docs/how-to/HOW-TO-AZURE-AD-SETUP.md). Password signup works without it.

---

## Tech Stack

| Component  | Technology                                      |
| ---------- | ----------------------------------------------- |
| Backend    | NestJS 11 + Fastify + TypeScript                |
| Frontend   | SvelteKit 5 + Tailwind v4                       |
| Database   | PostgreSQL 18 + Row Level Security              |
| Cache      | Redis 7                                         |
| Real-Time  | WebSocket (Chat) + SSE (Notifications, ADR-003) |
| Validation | Zod                                             |
| Container  | Docker + Nginx (Reverse Proxy)                  |

---

## Features

**Available (25 Addons):**

- User Management (Multi-Tenant, Roles: Root/Admin/Employee)
- Document System (Upload, Categories, Access Control)
- Bulletin Board (Digital Announcements)
- Calendar (Events, Drag & Drop, ICS/CSV Export)
- CIP System (Continuous Improvement Proposals + Approval Workflow)
- Shift Planning (Weekly View, Rotation, Drag & Drop)
- Chat System (Real-Time, E2E Encryption, Groups, File Attachments)
- TPM System — Total Productive Maintenance (Plans, Checklists, Escalation)
- Vacation Management (Requests, Approval Workflow, Entitlements, Absence Calendar)
- Work Orders (Status Workflow, Photo Documentation, SSE Notifications)
- Approvals System (Multi-Level, Configurable Approver Types)
- Organigram (Hierarchy Visualization, Position Catalog)
- Survey Tool (Templates, Statistics, Export)
- Asset Management (CRUD, Categories, Maintenance)
- Payroll (via Document Explorer: Secure PDF Upload)
- Addon System (25 Addons, A-la-carte Model)

Details: [FEATURES.md](./docs/FEATURES.md)

---

## Documentation

| Document                                  | Content                       |
| ----------------------------------------- | ----------------------------- |
| [FEATURES.md](./docs/FEATURES.md)         | Addon-Übersicht & Preismodell |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Technical Architecture        |
| [DOCKER-SETUP.md](./docs/DOCKER-SETUP.md) | Docker Setup                  |
| [TODO.md](./TODO.md)                      | Current Tasks                 |

---

## Docker

> Alle Befehle laufen über `doppler run --` — Secrets kommen ausschließlich aus Doppler ([HOW-TO-DOPPLER-GUIDE.md](./docs/how-to/HOW-TO-DOPPLER-GUIDE.md)). Default-Profile via `docker/.env`: `COMPOSE_PROFILES=dev,observability` (ADR-027 Amendment 2026-04-28).

```bash
cd docker

# === Development (dev + observability per docker/.env) ===
doppler run -- docker-compose up -d                          # Start dev stack
doppler run -- docker-compose ps                             # Status
doppler run -- docker-compose logs -f backend                # Backend logs
doppler run -- docker-compose --profile dev down             # Stop

# === Production (CI-Parität via docker/Dockerfile multi-stage) ===
# Pflicht: Dev-Backend vorher stoppen — beide Profile teilen container_name=assixx-backend
doppler run -- docker-compose --profile dev stop backend deletion-worker
doppler run -- docker-compose --profile dev rm -f backend deletion-worker
doppler run -- docker-compose --profile production build
doppler run -- docker-compose --profile production up -d
```

> **Vollständige Befehlsreferenz:** [docs/COMMON-COMMANDS.md §1](./docs/COMMON-COMMANDS.md) · [docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md](./docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md) · Node-Bumps: [HOW-TO-BUMP-NODE.md](./docs/how-to/HOW-TO-BUMP-NODE.md)

---

## Contact

**Development:** SCS-Technik Team
**GitHub:** [assixx/assixx](https://github.com/assixx/assixx)

---

## License

Proprietary Software — All rights reserved. See [LICENSE](./LICENSE).
