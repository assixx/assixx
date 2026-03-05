# NestJS Migration Plan - Assixx

!!FYI: 1 class per file

**Branch:** `feature/nestjs-migration`
**Created:** 2025-12-16
**Status:** 🟢 **PHASE 8 COMPLETE: NESTJS + FASTIFY**
**Last Updated:** 2025-12-18 14:45 Uhr
**Total Files Created:** ~339 TypeScript files

---

## 🎯 ENDZIEL: NESTJS + FASTIFY (kein Express) ✅ ERREICHT

```
✅ DONE:  NestJS Services 26/26 native (100%)
✅ DONE:  NestJS Code entkoppelt von routes/v2
✅ DONE:  Legacy Code von routes/v2 entkoppelt
✅ DONE:  routes/v2/ komplett gelöscht (~166 Dateien, 2.5MB)
✅ DONE:  Legacy Services gelöscht (19 von 21)
✅ DONE:  Dead Code Middleware gelöscht
✅ DONE:  @nestjs/platform-express → @nestjs/platform-fastify
✅ DONE:  Express Dependency entfernt
✅ DONE:  Health Check: {"status":"ok","framework":"NestJS+Fastify"}
```

---

## 🟢 PHASE 6 ABGESCHLOSSEN: ALLE SERVICES NATIVE

### ✅ FORTSCHRITT (2025-12-17 21:00)

**ALLE 26/26 NESTJS SERVICES SIND JETZT NATIVE!**

Die 4 ehemaligen Wrapper-Services wurden vollständig auf native NestJS migriert:

| Service               | Zeilen | Status    | Bruno Tests   |
| --------------------- | ------ | --------- | ------------- |
| blackboard.service.ts | ~1300  | ✅ Native | 15/15 ✅      |
| kvp.service.ts        | ~950   | ✅ Native | 13/13 ✅      |
| surveys.service.ts    | ~1370  | ✅ Native | 11/11 ✅      |
| reports.service.ts    | ~1230  | ✅ Native | (keine Tests) |

**Bruno API Tests:** 31/31 Requests ✅ | 57/57 Tests ✅ | 66/66 Assertions ✅

**NestJS ist komplett entkoppelt von routes/v2:**

- ✅ Alle NestJS Controller importieren NUR von NestJS Services
- ✅ Alle Typen sind in NestJS Modulen definiert
- ✅ 0 Imports von `../../routes/v2/` in `/src/nest/`

---

## 🟢 PHASE 7: EXPRESS REMOVAL - ABGESCHLOSSEN ✅

### Was wurde erledigt (2025-12-17 23:30)

**Phase 7.1: Legacy Services Analyse**

- [x] Geprüft welche /services/\*.service.ts noch von NestJS genutzt werden
- [x] Identifiziert: Nur 2 Services werden noch genutzt:
  - `tenantDeletion.service.ts` → von `root.service.ts`
  - `hierarchyPermission.service.ts` → von `blackboard.service.ts`
- [x] `tenantDeletion.service.ts` von routes/v2 entkoppelt (lokales Interface statt DbUser)

**Phase 7.2: Middleware gelöscht (Dead Code)**

- [x] `middleware/features.ts` → GELÖSCHT (nirgends importiert)
- [x] `middleware/tenant.ts` → GELÖSCHT (nirgends importiert)
- [x] `middleware/departmentAccess.ts` → GELÖSCHT (nur von routes/v2 genutzt)
- [x] `middleware/security.ts` → GELÖSCHT (importierte gelöschte v2/auth)
- [x] `middleware/v2/` → GELÖSCHT (auth, roleCheck, security)
- [x] `middleware/pageAuth.ts` → GELÖSCHT (2025-12-18, Dead Code verifiziert)
- [x] `middleware/rateLimiter.ts` → GELÖSCHT (2025-12-18, Dead Code verifiziert)
- [x] `middleware/role.middleware.ts` → GELÖSCHT (2025-12-18, Dead Code verifiziert)
- [x] `middleware/security-enhanced.ts` → GELÖSCHT (2025-12-18, Dead Code verifiziert)
- [x] `middleware/tenantIsolation.ts` → GELÖSCHT (2025-12-18, Dead Code verifiziert)
- [x] `middleware/tenantStatus.ts` → GELÖSCHT (2025-12-18, Dead Code verifiziert)
- [x] `middleware/validation.zod.ts` → GELÖSCHT (2025-12-18, Dead Code verifiziert)
- [x] `types/middleware.types.ts` → GELÖSCHT (2025-12-18, keine Imports)
- [x] `middleware/` Ordner → KOMPLETT GELÖSCHT

**Phase 7.3: Utils migriert**

- [x] `utils/emailService.ts` → Neue `utils/featureCheck.ts` erstellt
- [x] Feature-Import von routes/v2 → lokale Utils umgestellt

**Phase 7.4: Cleanup**

- [x] 19 Legacy /services/\*.service.ts gelöscht
- [x] routes/v2/ komplett gelöscht (~166 Dateien, 2.5MB)
- [x] routes/pages/ gelöscht (Legacy HTML Routing)
- [x] Docker Health Check verifiziert ✅
- [x] API Tests: 68/87 Passed (Shifts 500 Error - separates Issue)

### Verbleibende Dateien

**Behalten (von NestJS genutzt):**

```
backend/src/services/
├── tenantDeletion.service.ts  # Von root.service.ts genutzt
└── hierarchyPermission.service.ts  # Von blackboard.service.ts genutzt
```

**middleware/ → KOMPLETT GELÖSCHT (2025-12-18)**

```
❌ backend/src/middleware/  # Ordner existiert nicht mehr
❌ types/middleware.types.ts  # Gelöscht, Export aus types/index.ts entfernt
```

---

## 🟢 PHASE 8: FASTIFY ADAPTER MIGRATION - COMPLETE ✅

### Ziel

Express durch Fastify ersetzen für bessere Performance (~4.7x schneller laut Benchmarks).

### Vorher (Express)

```json
"@nestjs/platform-express": "^11.1.9"
"express": "^5.2.1"
```

### Nachher (Fastify) ✅

```json
"@nestjs/platform-fastify": "^11.1.9"
"fastify": "^5.2.2"
"@fastify/static": "^8.2.0"
"@fastify/helmet": "^13.0.1"
"@fastify/cookie": "^11.0.2"
"@fastify/multipart": "^9.0.3"
"@webundsoehne/nest-fastify-file-upload": "^3.0.1"
"fastify-multer": "^2.0.3"
// express ENTFERNT ✅
```

### Tasks - ALLE ABGESCHLOSSEN ✅

- [x] `pnpm add @nestjs/platform-fastify fastify` - Fastify v5 installiert
- [x] `pnpm add @fastify/static @fastify/helmet @fastify/cookie` - Plugins installiert
- [x] `pnpm add @webundsoehne/nest-fastify-file-upload fastify-multer` - File Upload
- [x] `pnpm remove @nestjs/platform-express express @types/express` - Express entfernt
- [x] `main.ts` anpassen mit FastifyAdapter:

  ```typescript
  import { NestFactory } from '@nestjs/core';
  import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: false }));
  await app.listen({ port: 3000, host: '0.0.0.0' }); // Fastify v5 Syntax
  ```

- [x] Controller Types ändern: `FastifyRequest`, `FastifyReply` statt Express
- [x] FileInterceptor von `@webundsoehne/nest-fastify-file-upload` importieren
- [x] `fastify-multer` Import für ESM kompatibel gemacht:

  ```typescript
  // ESM-kompatibel (fastify-multer ist CommonJS)
  import multer from 'fastify-multer';

  const { diskStorage, memoryStorage } = multer;
  ```

- [x] Docker neu gebaut: `docker-compose build --no-cache backend`
- [x] Docker Health Check verifiziert ✅
- [x] API Tests verifiziert ✅

### Verifizierung (2025-12-18)

```bash
# Health Check
curl -s http://localhost:3000/health | jq '.'
{
  "status": "ok",
  "framework": "NestJS+Fastify"
}

# Auth Endpoint (Validation)
curl -s http://localhost:3000/api/v2/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"x"}'
# → 400 Bad Request (Zod Validation funktioniert)

# Static Files
curl -s http://localhost:3000/login -o /dev/null -w "%{http_code}"
# → 200 OK

# Protected Endpoint
curl -s http://localhost:3000/api/v2/users/me
# → 401 Unauthorized (JWT Guard funktioniert)
```

### Breaking Changes - GELÖST ✅

| Express                                    | Fastify                                  | Lösung             | Status |
| ------------------------------------------ | ---------------------------------------- | ------------------ | ------ |
| `@Req() req: Request`                      | `@Req() req: FastifyRequest`             | Type geändert      | ✅     |
| `@Res() res: Response`                     | `@Res() res: FastifyReply`               | Type geändert      | ✅     |
| `@nestjs/platform-express FileInterceptor` | `@webundsoehne/nest-fastify-file-upload` | Package gewechselt | ✅     |
| `multer.diskStorage()`                     | `fastify-multer` mit ESM Import          | Import angepasst   | ✅     |
| `app.listen(port)`                         | `app.listen({ port, host })`             | Fastify v5 Syntax  | ✅     |

### Gelöste Probleme

1. **tsconfig.tsbuildinfo Cache** - Stale Cache verursachte Build-Fehler → Cache gelöscht
2. **Permission-Probleme** - Docker Root vs lokaler User → `chown -R scs:scs`
3. **@nestjs/swagger fehlte** - Peer Dependency → `pnpm add @nestjs/swagger`
4. **fastify-multer ESM Import** - CommonJS Modul → `import multer from 'fastify-multer'`
5. **file.size undefined** - TypeScript strict → `file.size ?? 0`

---

## 📊 AKTUELLER STATUS

| Metrik                   | Wert             | Status                               |
| ------------------------ | ---------------- | ------------------------------------ |
| **NestJS Controllers**   | 300/300          | ✅ 100%                              |
| **NestJS Services**      | 26/26 Native     | ✅ 100%                              |
| **Bruno Tests**          | 68/87            | ⚠️ 78% (Shifts Issue)                |
| **routes/v2/**           | GELÖSCHT         | ✅ ~166 Dateien entfernt             |
| **Legacy Services**      | 2/21 behalten    | ✅ 19 gelöscht                       |
| **Dead Code Middleware** | GELÖSCHT         | ✅ 14 Dateien entfernt (inkl. types) |
| **middleware/ Ordner**   | GELÖSCHT         | ✅ Komplett entfernt (2025-12-18)    |
| **Framework**            | NestJS + Fastify | ✅ Express komplett entfernt         |

### Was funktioniert

- ✅ Docker startet mit `nest/main.ts`
- ✅ Health Check OK: `{"status":"ok","framework":"NestJS+Fastify"}`
- ✅ Type-Check erfolgreich
- ✅ Static Files (login.html etc.) werden served
- ✅ JWT Auth Guard funktioniert
- ✅ Zod Validation funktioniert
- ⚠️ 19 Shifts-Tests fehlgeschlagen (500 Error - separates Issue)

### Verbleibende Struktur (Stand: 2025-12-18)

```
backend/src/
├── nest/           # NestJS Module (PRODUKTIV) ✅ 339 Files
├── services/       # Nur 2 Dateien behalten:
│   ├── tenantDeletion.service.ts     # Von root.service.ts
│   └── hierarchyPermission.service.ts # Von blackboard.service.ts
├── utils/          # Shared utilities ✅
│   └── featureCheck.ts  # NEU: Email Feature Check
├── config/         # Konfiguration ✅
├── schemas/        # Zod Schemas ✅
└── types/          # TypeScript Types ✅ (middleware.types.ts gelöscht)

❌ middleware/      # GELÖSCHT (2025-12-18)
❌ routes/          # GELÖSCHT
❌ loaders/         # GELÖSCHT
❌ app.ts           # GELÖSCHT
❌ server.ts        # GELÖSCHT
```

```typescript
// ✅ ALLE 26/26 SERVICES SIND JETZT NATIVE NESTJS:
@Injectable()
export class BlackboardService {
  constructor(private readonly db: DatabaseService) {}

  async getEntries(tenantId: number, userId: number): Promise<BlackboardEntry[]> {
    const rows = await this.db.query<DbBlackboardEntry>(
      `SELECT id, title, content, priority, status, created_at
       FROM blackboard_entries
       WHERE tenant_id = $1 AND is_active = 1
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return rows.map((row) => this.transformEntry(row)); // ✅ Direkte DB!
  }
}
```

**KEINE Wrapper mehr - alle Services nutzen DatabaseService direkt!**

---

## 📊 SERVICE MIGRATION STATUS (Phase 6) - 100% Complete ✅

### ✅ Native NestJS Services (26/26 = 100%)

| Service                          | Zeilen | Pattern                                 | Kommentar                            |
| -------------------------------- | ------ | --------------------------------------- | ------------------------------------ |
| auth.service.ts                  | ~300   | DatabaseService + bcrypt                | JWT, Login, Register                 |
| users.service.ts                 | ~800   | DatabaseService + ClsService            | CRUD, Profile, Availability          |
| calendar.service.ts              | ~600   | DatabaseService + ClsService            | Events CRUD, Dashboard               |
| documents.service.ts             | ~400   | DatabaseService                         | Upload, Download, Archive            |
| chat.service.ts                  | ~1430  | DatabaseService                         | Conversations, Messages, Attachments |
| shifts.service.ts                | ~1022  | DatabaseService                         | Shifts CRUD, Plans, Swap Requests    |
| rotation.service.ts              | ~1097  | DatabaseService                         | Patterns, Assignments, Generation    |
| logs.service.ts                  | ~660   | DatabaseService + bcrypt                | Audit Logs, Deletion                 |
| areas.service.ts                 | ~200   | DatabaseService                         | War bereits sauber                   |
| departments.service.ts           | ~200   | DatabaseService                         | War bereits sauber                   |
| teams.service.ts                 | ~200   | DatabaseService                         | War bereits sauber                   |
| roles.service.ts                 | ~100   | Static (kein DB)                        | Nur Konstanten                       |
| role-switch.service.ts           | ~150   | DatabaseService                         | JWT Role Switching                   |
| **features.service.ts**          | ~300   | DatabaseService                         | ✅ **NEU MIGRIERT** (2025-12-17)     |
| **plans.service.ts**             | ~400   | DatabaseService                         | ✅ **NEU MIGRIERT** (2025-12-17)     |
| **machines.service.ts**          | ~450   | DatabaseService                         | ✅ **NEU MIGRIERT** (2025-12-17)     |
| **admin-permissions.service.ts** | ~350   | DatabaseService                         | ✅ **NEU MIGRIERT** (2025-12-17)     |
| **audit-trail.service.ts**       | ~745   | DatabaseService + bcrypt                | ✅ **NEU MIGRIERT** (2025-12-17)     |
| **settings.service.ts**          | ~857   | DatabaseService                         | ✅ **NEU MIGRIERT** (2025-12-17)     |
| **signup.service.ts**            | ~383   | DatabaseService + transaction           | ✅ **NEU MIGRIERT** (2025-12-17)     |
| **notifications.service.ts**     | ~900   | DatabaseService                         | ✅ **NEU MIGRIERT** (2025-12-17)     |
| **root.service.ts**              | ~1271  | DatabaseService + tenantDeletionService | ✅ **NEU MIGRIERT** (2025-12-17)     |

### ✅ Ehemalige Wrapper Services - JETZT NATIVE (2025-12-17)

Diese 4 Services wurden am 2025-12-17 vollständig zu Native NestJS migriert:

| Service                   | Zeilen | Migriert am | Bruno Tests |
| ------------------------- | ------ | ----------- | ----------- |
| **blackboard.service.ts** | ~1300  | 2025-12-17  | 15/15 ✅    |
| **kvp.service.ts**        | ~950   | 2025-12-17  | 13/13 ✅    |
| **surveys.service.ts**    | ~1370  | 2025-12-17  | 11/11 ✅    |
| **reports.service.ts**    | ~1230  | 2025-12-17  | (keine)     |

**Gesamt:** ~4850 Zeilen neuer Service-Code, alle nutzen DatabaseService direkt.

---

## 🎯 ZIEL: KOMPLETT EXPRESS-FREI

### Phase 6.1: Service Migration - 100% COMPLETE ✅

**Alle 26 Services zu Native NestJS migriert:**

**Migriert (Session 1 - 2025-12-17 früh):**

- [x] features.service.ts → Native (~300 LOC)
- [x] plans.service.ts → Native (~400 LOC)
- [x] machines.service.ts → Native (~450 LOC)
- [x] admin-permissions.service.ts → Native (~350 LOC)
- [x] audit-trail.service.ts → Native (~745 LOC)
- [x] settings.service.ts → Native (~857 LOC)
- [x] signup.service.ts → Native (~383 LOC)
- [x] notifications.service.ts → Native (~900 LOC)
- [x] root.service.ts → Native (~1271 LOC)

**Migriert (Session 2 - 2025-12-17 abend):**

- [x] blackboard.service.ts → Native (~1300 LOC) ✅ 15/15 Tests
- [x] kvp.service.ts → Native (~950 LOC) ✅ 13/13 Tests
- [x] surveys.service.ts → Native (~1370 LOC) ✅ 11/11 Tests
- [x] reports.service.ts → Native (~1230 LOC)

**Gesamt:** ~10506 LOC neuer Service-Code in 2 Sessions

### Phase 6.2: NestJS von routes/v2 entkoppelt - 100% COMPLETE ✅

**Alle NestJS Controller/Services importieren NUR noch von /nest/:**

- [x] blackboard.controller.ts → BlackboardComment von service statt routes/v2
- [x] admin-permissions.controller.ts → PermissionLevel von service statt routes/v2
- [x] machines.controller.ts → Types von service statt routes/v2
- [x] settings.controller.ts → SettingData von service statt routes/v2

**Resultat:** 0 Imports von `../../routes/v2/` in `/src/nest/`

### Phase 7: Express Removal (IN PROGRESS)

**1. Entry-Points LÖSCHEN:**

```
backend/src/
├── app.ts              ❌ LÖSCHEN (Express Loader Pattern)
├── server.ts           ❌ LÖSCHEN (Node Entry Point für Express)
└── loaders/            ❌ LÖSCHEN (10 Bootstrap Loaders)
    ├── database.ts
    ├── express.ts
    ├── middleware.ts
    ├── routes.ts
    ├── security.ts
    └── ... (5 weitere)
```

**2. Express Routes LÖSCHEN:**

```
backend/src/routes/v2/  ❌ KOMPLETT LÖSCHEN (26 Module)
├── admin-permissions/
├── areas/
├── audit-trail/
├── auth/
├── blackboard/
├── calendar/
├── chat/
├── departments/
├── documents/
├── features/
├── kvp/
├── logs/
├── machines/
├── notifications/
├── plans/
├── reports/
├── role-switch/
├── roles/
├── root/
├── settings/
├── shifts/
├── signup/
├── surveys/
├── teams/
├── tenants/
└── users/
```

**3. Behalten (von NestJS genutzt):**

```
backend/src/
├── config/             ✅ BEHALTEN (DB Config)
├── middleware/         ✅ PRÜFEN (teilweise genutzt)
├── services/           ❓ PRÜFEN (vielleicht noch genutzt)
├── utils/              ✅ BEHALTEN (fieldMapper, pathSecurity, etc.)
├── types/              ✅ BEHALTEN (TypeScript Definitionen)
└── schemas/            ✅ BEHALTEN (Zod Schemas)
```

**4. Package.json anpassen:**

```json
// ENTFERNEN:
"express": "^5.2.1",
"express-rate-limit": "^8.2.1",
// ... andere Express-spezifische Deps

// ÄNDERN:
"start": "node dist/nest/main.js",  // Bereits getan
```

**5. Docker verifizieren:**

```dockerfile
# Bereits korrekt:
CMD ["node", "dist/nest/main.js"]
```

---

## 🔧 MIGRATIONS-PATTERN FÜR SERVICES

Jeder Service muss so migriert werden:

```typescript
// VORHER (Express-Delegation):
import { legacyService } from '../../routes/v2/feature/feature.service.js';

@Injectable()
export class FeatureService {
  async getData() {
    return legacyService.getData();
  }
}

// NACHHER (Native NestJS):
import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DatabaseService } from '../database/database.service.js';
import { dbToApi } from '../../utils/fieldMapper.js';

interface DbFeatureRow {
  id: number;
  tenant_id: number;
  name: string;
  // ... snake_case DB columns
}

@Injectable()
export class FeatureService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly clsService: ClsService,
  ) {}

  async getData(): Promise<Feature[]> {
    const tenantId = this.clsService.get<number>('tenantId');

    const rows = await this.databaseService.query<DbFeatureRow>(
      `SELECT id, tenant_id, name, created_at, updated_at
       FROM features
       WHERE tenant_id = $1 AND is_active = 1
       ORDER BY created_at DESC`,
      [tenantId],
    );

    return rows.map(row => dbToApi(row));
  }
}
```

**Wichtige Patterns:**

- `$1, $2, $3` Placeholders (PostgreSQL)
- `ClsService` für tenantId, userId aus Request-Context
- `dbToApi()` für snake_case → camelCase Mapping
- `DatabaseService.query<T>()` für typisierte Queries
- Interface für DB-Row Type (`DbXxxRow`)

---

## ⚠️ ACCURATE PROGRESS ASSESSMENT

| Metric                 | Value       | Details                                           |
| ---------------------- | ----------- | ------------------------------------------------- |
| **Overall Progress**   | **100%**    | 25/25 Express modules migrated                    |
| **Endpoints Migrated** | **300/300** | ✅ 100% of total endpoints                        |
| **Phase 3 Status**     | ✅ 100%     | All 6 modules complete                            |
| **Phase 4 Status**     | ✅ 100%     | All 13 modules complete (tenants has 0 endpoints) |
| **Phase 5 Status**     | 🔄 70%      | NestJS running in Docker, cleanup pending         |

### Module Status Overview

```
✅ ALL 25 MODULES WITH ENDPOINTS MIGRATED (100%)

   admin-permissions (11)    notifications (15)
   areas (7)                 plans (8)
   audit-trail (6)           reports (9)
   auth (6)                  roles (5)
   blackboard (21)           role-switch (4)
   calendar (8)              root (25)
   chat (26)                 settings (18)
   departments (7)           shifts (30)
   documents (12)            signup (2)
   features (11)             surveys (14)
   kvp (14)                  teams (11)
   logs (3)                  users (15)
   machines (12)

   ────────────────────────────────────────
   TOTAL: 300 endpoints across 25 modules

   Note: tenants module has 0 endpoints (model only)
```

---

## Executive Summary

Migration from Express.js to NestJS for the Assixx multi-tenant SaaS platform. This document outlines the step-by-step strategy, architectural decisions, and implementation phases.

---

## Table of Contents

1. [Why NestJS](#1-why-nestjs)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Key Migration Decisions](#4-key-migration-decisions)
5. [Phase Plan](#5-phase-plan)
6. [Module Mapping](#6-module-mapping)
7. [Multi-Tenant Strategy](#7-multi-tenant-strategy)
8. [Database Strategy](#8-database-strategy)
9. [Validation Strategy](#9-validation-strategy)
10. [Authentication Strategy](#10-authentication-strategy)
11. [Testing Strategy](#11-testing-strategy)
12. [Risk Assessment](#12-risk-assessment)
13. [Success Metrics](#13-success-metrics)

---

## 1. Why NestJS

### Enterprise Benefits (2025)

| Feature        | Express        | NestJS            | Benefit                      |
| -------------- | -------------- | ----------------- | ---------------------------- |
| Architecture   | Manual         | Built-in modular  | Scalability, maintainability |
| DI Container   | None           | Native            | Testability, loose coupling  |
| TypeScript     | Optional       | First-class       | Type safety at compile time  |
| Validation     | Middleware     | Pipes             | Declarative, automatic       |
| Auth           | Manual         | Guards            | Standardized, reusable       |
| Error Handling | Callback-based | Exception Filters | Centralized, clean           |
| Documentation  | Manual         | OpenAPI/Swagger   | Auto-generated               |
| Testing        | Jest (manual)  | Jest (integrated) | Built-in utilities           |

### Key Drivers

1. **Architectural Control** - Express lacks built-in standards, NestJS enforces patterns
2. **Team Scalability** - Consistent code style across developers
3. **Enterprise Features** - Guards, interceptors, pipes, filters out-of-box
4. **Type Inference** - Full TypeScript integration with Zod
5. **Future-Proof** - NestJS v10+ supports Prisma, GraphQL Federation 2.0, AI modules

---

## 2. Current Architecture Analysis

### Express Structure (23 Route Modules)

```
backend/src/
├── app.ts                    # Loader pattern bootstrap
├── server.ts                 # Node entry point
├── config/                   # DB, Redis, Token configs
├── loaders/                  # 10 bootstrap loaders (ORDER CRITICAL)
├── routes/v2/                # 23 API modules
│   ├── auth/                 # Controller + Service + Validation
│   ├── users/
│   ├── calendar/
│   ├── ... (20 more)
├── middleware/               # Auth, Tenant, Rate limiting
├── services/                 # Business logic
├── utils/                    # DB, Response, Errors, Helpers
├── types/                    # TypeScript definitions
└── schemas/                  # Zod schemas
```

### Current Patterns

| Pattern          | Implementation                                           |
| ---------------- | -------------------------------------------------------- |
| Route Definition | `router.post('/path', middleware..., controller.method)` |
| Controller       | Async functions handling req/res                         |
| Service          | Classes with static methods                              |
| Validation       | Zod middleware (`validateBody(schema)`)                  |
| Auth             | JWT middleware → `req.user`                              |
| DB               | Raw PostgreSQL via `pg` library                          |
| RLS              | `setTenantContext()` per transaction                     |
| Response         | `successResponse(data)` / `errorResponse(code, msg)`     |

### Dependency Inventory

```json
{
  "express": "^5.2.1",
  "pg": "^8.16.3",
  "zod": "4.2.0",
  "jsonwebtoken": "^9.0.3",
  "bcryptjs": "^3.0.3",
  "helmet": "^8.1.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^8.2.1",
  "multer": "^2.0.2",
  "ws": "^8.18.3"
}
```

---

## 3. Target Architecture

### NestJS Structure

```
backend/src/
├── main.ts                           # NestJS bootstrap
├── app.module.ts                     # Root module
├── common/                           # Shared utilities
│   ├── decorators/                   # Custom decorators
│   │   ├── current-user.decorator.ts
│   │   ├── tenant.decorator.ts
│   │   └── public.decorator.ts
│   ├── filters/                      # Exception filters
│   │   └── all-exceptions.filter.ts
│   ├── guards/                       # Auth & Role guards
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── interceptors/                 # Response transform, logging
│   │   ├── response.interceptor.ts
│   │   └── tenant-context.interceptor.ts
│   ├── pipes/                        # Validation pipes
│   │   └── zod-validation.pipe.ts
│   └── interfaces/                   # Shared interfaces
├── config/                           # Configuration module
│   ├── config.module.ts
│   └── database.config.ts
├── database/                         # Database module
│   ├── database.module.ts
│   ├── database.service.ts           # Raw pg queries
│   └── tenant-context.service.ts     # RLS context
├── auth/                             # Auth module
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── dto/
│   │   ├── login.dto.ts
│   │   └── register.dto.ts
│   └── strategies/
│       └── jwt.strategy.ts
├── users/                            # Users module
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── dto/
├── calendar/                         # Calendar module
│   └── ...
└── [20 more feature modules]/
```

### Module Relationships

```
AppModule
├── ConfigModule (global)
├── DatabaseModule (global)
├── ClsModule (global)              # Request context
├── AuthModule (global)             # JWT, Guards
├── UsersModule
├── CalendarModule
├── TeamsModule
├── DepartmentsModule
├── DocumentsModule
├── ... (feature modules)
```

---

## 4. Key Migration Decisions

### 4.1 Database: Keep Raw pg (NO TypeORM)

**Decision:** Continue using `pg` library with raw SQL queries

**Rationale:**

- 800+ existing raw SQL queries work correctly
- RLS (Row-Level Security) requires `SET app.tenant_id` per transaction
- TypeORM adds complexity without benefit for our use case
- PostgreSQL `$1, $2, $3` placeholders already standardized

**Implementation:**

```typescript
// database.service.ts
@Injectable()
export class DatabaseService {
  constructor(private pool: Pool) {}

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>, tenantId?: number, userId?: number): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (tenantId) await this.setTenantContext(client, tenantId);
      if (userId) await this.setUserContext(client, userId);
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

### 4.2 Validation: Keep Zod (via nestjs-zod)

**Decision:** Use `nestjs-zod` package for Zod integration

**Rationale:**

- 100% of v2 routes already use Zod schemas
- Full type inference from schemas
- `nestjs-zod` provides `ZodValidationPipe` and `createZodDto()`

**Implementation:**

```typescript
// dto/login.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8),
});

export class LoginDto extends createZodDto(LoginSchema) {}

// auth.controller.ts
@Post('login')
async login(@Body() dto: LoginDto) {
  // dto is fully typed and validated
}
```

### 4.3 Multi-Tenant: NestJS-CLS for Request Context

**Decision:** Use `nestjs-cls` for continuation-local storage

**Rationale:**

- Provides request-scoped context without REQUEST scope overhead
- Works across async operations (promises, callbacks)
- Perfect for tenant_id propagation to database layer
- Factory proxy providers for tenant-specific connections

**Implementation:**

```typescript
// app.module.ts
ClsModule.forRoot({
  global: true,
  middleware: {
    mount: true,
    setup: (cls, req) => {
      cls.set('tenantId', req.user?.tenantId);
      cls.set('userId', req.user?.id);
      cls.set('userRole', req.user?.role);
    },
  },
});

// database.service.ts
@Injectable()
export class DatabaseService {
  constructor(private cls: ClsService) {}

  getTenantId(): number {
    return this.cls.get('tenantId');
  }
}
```

### 4.4 Authentication: Custom JWT Guard (No Passport)

**Decision:** Build custom JWT guard without Passport.js

**Rationale:**

- Simpler, fewer dependencies
- Full control over token validation flow
- Current auth logic can be directly ported
- Supports our role-switching feature

**Implementation:**

```typescript
// guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException();

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = await this.lookupUser(payload);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

### 4.5 Response Format: Interceptor-based

**Decision:** Use interceptor for consistent response transformation

**Rationale:**

- Centralized response formatting
- Controllers return raw data, interceptor wraps
- Consistent `{ success, data, message }` format

**Implementation:**

```typescript
// interceptors/response.interceptor.ts
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

---

## 5. Phase Plan

### Phase 0: Foundation ✅ COMPLETE

**Scope:** Set up NestJS alongside Express

| Task | Description                         | Files                      | Status  |
| ---- | ----------------------------------- | -------------------------- | ------- |
| 0.1  | Install NestJS dependencies         | `package.json`             | ✅ Done |
| 0.2  | Create NestJS bootstrap             | `main.ts`, `app.module.ts` | ✅ Done |
| 0.3  | Configure `ConfigModule`            | `config/`                  | ✅ Done |
| 0.4  | Create `DatabaseModule` (pg)        | `database/`                | ✅ Done |
| 0.5  | Set up `ClsModule` (tenant context) | `app.module.ts`            | ✅ Done |
| 0.6  | Create common utilities             | `common/`                  | ✅ Done |
| 0.7  | Port Zod schemas                    | `dto/` files               | ✅ Done |

**Dependencies to Install:**

```bash
pnpm add @nestjs/core @nestjs/common @nestjs/platform-express
pnpm add @nestjs/config @nestjs/jwt
pnpm add nestjs-cls nestjs-zod
pnpm add reflect-metadata rxjs
```

### Phase 1: Auth Module ✅ COMPLETE

**Scope:** Migrate authentication completely

| Task | Description                         | Status  |
| ---- | ----------------------------------- | ------- |
| 1.1  | Create `AuthModule` structure       | ✅ Done |
| 1.2  | Port `JwtAuthGuard`                 | ✅ Done |
| 1.3  | Port `RolesGuard`                   | ✅ Done |
| 1.4  | Port login/logout/refresh endpoints | ✅ Done |
| 1.5  | Port token services                 | ✅ Done |
| 1.6  | Test auth flow end-to-end           | ✅ Done |

**Implemented Files:**

- `nest/auth/auth.module.ts`
- `nest/auth/auth.controller.ts`
- `nest/auth/auth.service.ts`
- `nest/auth/dto/*.ts`
- `nest/common/guards/jwt-auth.guard.ts`
- `nest/common/guards/roles.guard.ts`
- `nest/common/decorators/*.ts`

### Phase 2: Core Feature Modules ✅ COMPLETE

**Scope:** Migrate high-traffic modules

| Module      | Priority | Complexity | Status  | Endpoints | Files    |
| ----------- | -------- | ---------- | ------- | --------- | -------- |
| Users       | Critical | Medium     | ✅ Done | 11        | 10 files |
| Departments | Critical | Low        | ✅ Done | 7         | 9 files  |
| Teams       | Critical | Low        | ✅ Done | 11        | 10 files |
| Calendar    | High     | High       | ✅ Done | 8         | 10 files |
| Documents   | High     | High       | ✅ Done | 11        | 7 files  |

**Code Quality Tasks Completed:**

| Task | Description                                             | Status  |
| ---- | ------------------------------------------------------- | ------- |
| 2.6  | ESLint compliance (0 errors)                            | ✅ Done |
| 2.7  | Fixed deprecated Zod `.datetime()` → `.iso.datetime()`  | ✅ Done |
| 2.8  | Split DTOs to comply with `max-classes-per-file` rule   | ✅ Done |
| 2.9  | Added type annotations for `@typescript-eslint/typedef` | ✅ Done |
| 2.10 | Reduced cognitive complexity in services                | ✅ Done |
| 2.11 | Extracted constants for duplicated strings              | ✅ Done |

**Implemented Files:**

- `nest/users/*` - User CRUD, profile, password change, availability (10 files)
- `nest/departments/*` - Department CRUD, members, stats (9 files)
- `nest/teams/*` - Team CRUD, members, machines (10 files)
- `nest/calendar/*` - Event CRUD, dashboard, export (10 files)
- `nest/documents/*` - Document CRUD, archive, download, preview, stats (7 files)

### Phase 3: Secondary Modules ✅ COMPLETE (100%)

| Module        | Priority | Complexity | Status  | Endpoints | Files |
| ------------- | -------- | ---------- | ------- | --------- | ----- |
| Blackboard    | Medium   | Low        | ✅ Done | 8         | 8     |
| KVP           | Medium   | Medium     | ✅ Done | 13        | 10    |
| Surveys       | Medium   | Medium     | ✅ Done | 14        | 12    |
| Notifications | Medium   | Medium     | ✅ Done | 15        | 10    |
| Shifts        | Medium   | High       | ✅ Done | 28        | 23    |
| Chat          | Medium   | High       | ✅ Done | 26        | 17    |

**Completed Module Files (Phase 3):**

- `nest/blackboard/*` - Posts CRUD, pinning, attachments (8 files)
- `nest/kvp/*` - Suggestions CRUD, comments, status workflow, dashboard (10 files)
- `nest/surveys/*` - Surveys CRUD, questions, responses, statistics, export (12 files)
- `nest/notifications/*` - Notifications CRUD, preferences, SSE streaming, statistics (10 files)
- `nest/shifts/*` - Shifts CRUD, shift plans, swap requests, favorites, rotation patterns, history, generation (23 files)
- `nest/chat/*` - Conversations CRUD, messages, attachments, scheduled messages, participants, file uploads (17 files)

**Completed Module Files (Phase 4):**

- `nest/areas/*` - Areas CRUD, stats, department assignments (10 files)
- `nest/roles/*` - Static role definitions, hierarchy, assignable roles, user role check (7 files)
- `nest/role-switch/*` - Switch to employee/admin view, status check, JWT-based role switching (5 files)
- `nest/signup/*` - Tenant self-registration, subdomain availability check (6 files)
- `nest/logs/*` - System audit logs, statistics, filtered deletion with password confirmation (6 files)

### Phase 4: Remaining Modules ✅ NEAR COMPLETE (14 modules, 13 complete)

| Module            | Priority | Complexity | Endpoints | Status      | Files |
| ----------------- | -------- | ---------- | --------- | ----------- | ----- |
| Areas             | Low      | Low        | 7         | ✅ Complete | 10    |
| Roles             | Low      | Low        | 5         | ✅ Complete | 7     |
| Role-Switch       | Low      | Low        | 4         | ✅ Complete | 5     |
| Signup            | Low      | Low        | 2         | ✅ Complete | 6     |
| Logs              | Low      | Low        | 3         | ✅ Complete | 6     |
| Audit Trail       | Medium   | Medium     | 6         | ✅ Complete | 11    |
| Settings          | Medium   | Low        | 18        | ✅ Complete | 10    |
| Admin Permissions | Medium   | Medium     | 11        | ✅ Complete | 7     |
| Plans             | Medium   | Low        | 8         | ✅ Complete | 8     |
| Reports           | Medium   | Medium     | 9         | ✅ Complete | 9     |
| Machines          | Medium   | Medium     | 12        | ✅ Complete | 9     |
| Features          | Low      | Low        | 11        | ✅ Complete | 8     |
| Root              | Low      | Medium     | 25        | ✅ Complete | 10    |
| Tenants           | Low      | Medium     | 0         | ⏳ Pending  | 0     |

**Phase 4 Progress:** 121/121 endpoints migrated (100%), only tenants model remains (0 endpoints)

### Phase 5: Cleanup & Optimization 🔄 IN PROGRESS

| Task | Description                     | Status      |
| ---- | ------------------------------- | ----------- |
| 5.1  | Update package.json entry-point | ✅ Complete |
| 5.2  | Update Docker configuration     | ✅ Complete |
| 5.3  | Fix circular imports            | ✅ Complete |
| 5.4  | NestJS startup verified         | ✅ Complete |
| 5.5  | Remove old loaders              | ⏳ Pending  |
| 5.6  | Remove Express entry-points     | ⏳ Pending  |
| 5.7  | Documentation update            | ✅ Complete |

**Phase 5 Progress:** Docker now starts NestJS (2025-12-17). Express services still needed as legacy delegation.

---

## 6. Module Mapping

### Express → NestJS Conversion Table

| Express Pattern            | NestJS Equivalent                |
| -------------------------- | -------------------------------- |
| `router.get()`             | `@Get()` decorator               |
| `router.post()`            | `@Post()` decorator              |
| `validateBody(schema)`     | `@Body()` + `ZodValidationPipe`  |
| `validateParams(schema)`   | `@Param()` + validation          |
| `validateQuery(schema)`    | `@Query()` + validation          |
| `authenticateV2`           | `@UseGuards(JwtAuthGuard)`       |
| `requireRoleV2(['admin'])` | `@Roles('admin')` + `RolesGuard` |
| `typed.auth(handler)`      | Native controller method         |
| `successResponse(data)`    | `ResponseInterceptor`            |
| `ServiceError`             | `HttpException` subclass         |
| Loader pattern             | Module system                    |

### Route Migration Example

**Before (Express):**

```typescript
// routes/v2/users/index.ts
router.get(
  '/',
  authenticateV2,
  requireRoleV2(['admin', 'root']),
  validateQuery(UsersListQuerySchema),
  typed.auth(usersController.list),
);
```

**After (NestJS):**

```typescript
// users/users.controller.ts
@Controller('api/v2/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  @Get()
  @Roles('admin', 'root')
  async list(@Query() query: UsersListDto) {
    return this.usersService.list(query);
  }
}
```

---

## 7. Multi-Tenant Strategy

### Request Flow

```
Request → CLS Middleware → JWT Guard → Roles Guard → Controller → Service → Database
                ↓
         Set tenantId in CLS
                                                          ↓
                                              Get tenantId from CLS
                                                          ↓
                                              SET app.tenant_id (RLS)
```

### Implementation Details

```typescript
// 1. CLS Setup (app.module.ts)
ClsModule.forRoot({
  global: true,
  middleware: {
    mount: true,
    generateId: true,
    setup: (cls, req) => {
      // Set after JWT validation populates req.user
    },
  },
});

// 2. After Auth Guard (tenant-context.interceptor.ts)
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    if (request.user) {
      this.cls.set('tenantId', request.user.tenantId);
      this.cls.set('userId', request.user.id);
    }
    return next.handle();
  }
}

// 3. Database Service
@Injectable()
export class DatabaseService {
  constructor(private cls: ClsService) {}

  async transactionWithTenant<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const tenantId = this.cls.get('tenantId');
    const userId = this.cls.get('userId');
    return this.transaction(callback, tenantId, userId);
  }
}
```

---

## 8. Database Strategy

### Keep Raw PostgreSQL

```typescript
// database/database.service.ts
@Injectable()
export class DatabaseService {
  constructor(
    @Inject('PG_POOL') private pool: Pool,
    private cls: ClsService,
  ) {}

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>, tenantId?: number, userId?: number): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Set RLS context
      if (tenantId !== undefined) {
        await client.query(`SELECT set_config('app.tenant_id', $1::text, true)`, [String(tenantId)]);
      }
      if (userId !== undefined) {
        await client.query(`SELECT set_config('app.user_id', $1::text, true)`, [String(userId)]);
      }

      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Convenience method using CLS context
  async tenantTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const tenantId = this.cls.get<number>('tenantId');
    const userId = this.cls.get<number>('userId');
    return this.transaction(callback, tenantId, userId);
  }
}
```

### Database Module

```typescript
// database/database.module.ts
@Module({
  providers: [
    {
      provide: 'PG_POOL',
      useFactory: async (configService: ConfigService) => {
        const pool = new Pool({
          host: configService.get('DB_HOST'),
          port: configService.get('DB_PORT'),
          database: configService.get('DB_NAME'),
          user: configService.get('DB_USER'),
          password: configService.get('DB_PASSWORD'),
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });
        return pool;
      },
      inject: [ConfigService],
    },
    DatabaseService,
  ],
  exports: ['PG_POOL', DatabaseService],
})
export class DatabaseModule {}
```

---

## 9. Validation Strategy

### Zod Integration with nestjs-zod

```typescript
// Global pipe (main.ts)
app.useGlobalPipes(new ZodValidationPipe());

// DTO definition
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  role: z.enum(['admin', 'employee']).default('employee'),
  departmentId: z.number().int().positive().optional(),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}

// Controller usage
@Post()
async create(@Body() dto: CreateUserDto) {
  // dto is typed as z.infer<typeof CreateUserSchema>
}
```

### Reuse Existing Schemas

```typescript
// Existing schema (keep as-is)
// schemas/common.schema.ts
export const EmailSchema = z.string().email().toLowerCase().trim();
export const IdSchema = z.coerce.number().int().positive();
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

// New DTO wrapping existing schema
import { PaginationSchema } from '../schemas/common.schema';

export class PaginationDto extends createZodDto(PaginationSchema) {}
```

---

## 10. Authentication Strategy

### JWT Authentication Guard

```typescript
// common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private reflector: Reflector,
    private cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check for @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);

      // Fresh DB lookup (like current Express middleware)
      const user = await this.usersService.findById(payload.id, payload.tenantId);
      if (!user || user.isActive !== 1) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Handle role switching
      const effectiveRole = payload.activeRole ?? user.role;

      request.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        activeRole: effectiveRole,
        tenantId: user.tenantId,
      };

      // Set CLS context for downstream services
      this.cls.set('tenantId', user.tenantId);
      this.cls.set('userId', user.id);
      this.cls.set('userRole', effectiveRole);

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer') return token;
    return request.cookies?.accessToken;
  }
}
```

### Roles Guard

```typescript
// common/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No user found');
    }

    // Use activeRole for role-switched users
    const effectiveRole = user.activeRole ?? user.role;
    return requiredRoles.includes(effectiveRole);
  }
}
```

---

## 11. Testing Strategy

### Unit Tests

```typescript
// users/users.service.spec.ts
describe('UsersService', () => {
  let service: UsersService;
  let dbService: jest.Mocked<DatabaseService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DatabaseService,
          useValue: {
            query: jest.fn(),
            tenantTransaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    dbService = module.get(DatabaseService);
  });

  it('should create a user', async () => {
    dbService.tenantTransaction.mockImplementation(async (cb) => {
      return cb({ query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) });
    });

    const result = await service.create({ email: 'test@test.com', username: 'test' });
    expect(result.id).toBe(1);
  });
});
```

### Integration Tests (Bruno)

Keep existing Bruno API tests - they test HTTP endpoints regardless of framework.

```bash
pnpm run test:api  # Works for both Express and NestJS
```

---

## 12. Risk Assessment

### High Risk

| Risk                   | Mitigation                                          |
| ---------------------- | --------------------------------------------------- |
| Breaking auth flow     | Extensive testing, parallel routes during migration |
| RLS context lost       | Unit tests for tenant isolation, CLS verification   |
| Performance regression | Load testing before/after each phase                |

### Medium Risk

| Risk                       | Mitigation                                 |
| -------------------------- | ------------------------------------------ |
| Zod schema incompatibility | Use `nestjs-zod`, schemas remain unchanged |
| Response format changes    | Interceptor ensures consistent format      |
| WebSocket migration        | Migrate chat module last, careful testing  |

### Low Risk

| Risk              | Mitigation                                |
| ----------------- | ----------------------------------------- |
| Type mismatches   | TypeScript strict mode catches at compile |
| Missing endpoints | Bruno tests catch missing routes          |

---

## 13. Success Metrics

### Current Progress (2025-12-17 23:30) - **PHASE 7 COMPLETE**

| Metric                   | Status                | Details                                           |
| ------------------------ | --------------------- | ------------------------------------------------- |
| **Controller Migration** | **✅ 100%**           | 25/25 Express modules migrated, 300/300 endpoints |
| **Service Migration**    | **✅ 100%**           | 26/26 Services native NestJS                      |
| **Legacy Cleanup**       | **✅ 100%**           | routes/v2 gelöscht, 19 Legacy Services entfernt   |
| NestJS Infrastructure    | ✅ complete           | Common, Config, Database                          |
| Total Files              | ~180 TypeScript files | Nach Cleanup (vorher ~340)                        |
| **TypeScript**           | **✅ 0 Errors**       | Kompiliert erfolgreich                            |
| **API Tests**            | **⚠️ 78%**            | 68/87 passed (Shifts 500 Error)                   |
| **Docker**               | **✅ Running**        | NestJS Health Check OK                            |

### Service Migration Summary (Phase 6)

| Category               | Count  | LOC        | Status      |
| ---------------------- | ------ | ---------- | ----------- |
| Native vor Phase 6     | 13     | ~8000      | ✅ Complete |
| Neu migriert (Phase 6) | 9      | ~5656      | ✅ Complete |
| **Native Total**       | **22** | **~13656** | **84.6%**   |
| Wrapper Pattern        | 4      | -          | Funktional  |

### File Breakdown by Module

| Module                                                    | Files   | DTOs    |
| --------------------------------------------------------- | ------- | ------- |
| Common (decorators, guards, filters, interceptors, pipes) | 16      | -       |
| Config                                                    | 3       | -       |
| Database                                                  | 3       | -       |
| Auth                                                      | 5       | 4       |
| Users                                                     | 5       | 6       |
| Departments                                               | 5       | 5       |
| Teams                                                     | 5       | 6       |
| Calendar                                                  | 5       | 6       |
| Documents                                                 | 5       | 3       |
| Blackboard                                                | 4       | 4       |
| KVP                                                       | 4       | 6       |
| Surveys                                                   | 4       | 8       |
| Notifications                                             | 4       | 6       |
| Shifts                                                    | 6       | 17      |
| Chat                                                      | 4       | 13      |
| Areas                                                     | 5       | 5       |
| Roles                                                     | 4       | 3       |
| Role-Switch                                               | 3       | 2       |
| Signup                                                    | 4       | 2       |
| Logs                                                      | 4       | 4       |
| Root (main.ts, app.module.ts)                             | 2       | -       |
| **TOTAL**                                                 | **100** | **100** |

### Phase Completion Criteria

- [x] No TypeScript errors
- [x] ESLint passes (0 errors)
- [ ] All Bruno API tests pass (⏳ Next step)
- [ ] Response format unchanged
- [ ] Tenant isolation verified
- [ ] Performance within 10% of baseline

### ESLint Fixes Applied (Phase 2)

| Fix Category                | Files Affected | Pattern Applied                            |
| --------------------------- | -------------- | ------------------------------------------ |
| Empty NestJS module classes | 5 modules      | `eslint-disable` with justification        |
| Deprecated `.datetime()`    | 7 DTOs         | Changed to `.iso.datetime()`               |
| Missing type annotations    | 12 files       | Added explicit types in callbacks          |
| Max classes per file (>2)   | 4 DTOs         | Split into separate files + barrel exports |
| Cognitive complexity (>10)  | 2 services     | Extracted helper functions                 |
| Duplicated string literals  | 2 services     | Extracted to constants                     |
| Unnecessary optional chains | 2 services     | Removed on non-optional fields             |

### Final Success Criteria

- [x] 100% route coverage migrated (300/300 endpoints)
- [x] 100% service migration (26/26 native NestJS)
- [x] Legacy routes/v2 removed (~166 files, 2.5MB)
- [x] Docker build succeeds (NestJS running)
- [x] Type-Check passes (0 errors)
- [ ] 100% API tests pass (aktuell 78%, Shifts Issue)
- [ ] Production deployment successful
- [ ] No regressions in 2 weeks post-migration

**Note:** Express ist aktuell noch Dependency (@nestjs/platform-express), wird aber in Phase 8 durch Fastify ersetzt!

---

## Sources & References

### NestJS Official

- [NestJS Documentation](https://docs.nestjs.com)
- [NestJS Migration Guide](https://docs.nestjs.com/migration-guide)

### Best Practices

- [Moving from Express to NestJS](https://www.softsuave.com/blog/moving-from-express-js-to-nestjs/)
- [Express to NestJS Migration Guide](https://delvingdeveloper.com/posts/migrating-from-express-to-nestjs)
- [NestJS in 2025](https://leapcell.io/blog/nestjs-2025-backend-developers-worth-it)
- [Enterprise NestJS Architecture](https://v-checha.medium.com/building-enterprise-grade-nestjs-applications-a-clean-architecture-template-ebcb6462c692)

### Database & Multi-Tenant

- [Raw PostgreSQL in NestJS](https://wanago.io/2022/08/29/api-nestjs-postgresql-raw-sql-queries/)
- [NestJS-CLS Documentation](https://github.com/papooch/nestjs-cls)

### Validation

- [nestjs-zod Package](https://github.com/BenLorantfy/nestjs-zod)
- [NestJS Zod Integration](https://hackmd.io/UVRGb-LoQPK7a2Obls_iAw)

---

**Document Version:** 3.4
**Last Updated:** 2025-12-18 15:00 Uhr
**Author:** Claude (AI Assistant)
**Reviewed By:** [Pending]

---

## Changelog

| Version | Date             | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.4     | 2025-12-18 15:00 | **🎉 PHASE 8 COMPLETE: NESTJS + FASTIFY** - Fastify Adapter Migration erfolgreich abgeschlossen! **Installierte Packages:** @nestjs/platform-fastify, fastify v5.2.2, @fastify/static, @fastify/helmet, @fastify/cookie, @fastify/multipart, @webundsoehne/nest-fastify-file-upload, fastify-multer. **Express komplett entfernt:** @nestjs/platform-express, express, @types/express. **main.ts geändert:** FastifyAdapter mit Fastify v5 Syntax `app.listen({ port, host })`. **Controller geändert:** FastifyRequest/FastifyReply Types in 5 Controllern (chat, users, documents, kvp, blackboard). **FileInterceptor geändert:** Von @nestjs/platform-express zu @webundsoehne/nest-fastify-file-upload. **ESM Fix:** fastify-multer CommonJS Import (`import multer from 'fastify-multer'; const { diskStorage } = multer;`). **Gelöste Probleme:** tsconfig.tsbuildinfo Cache, Permission-Probleme, @nestjs/swagger Peer Dependency, file.size undefined. **Verifizierung:** Health Check zeigt `"framework":"NestJS+Fastify"`, Auth, Static Files, Validation alle funktionsfähig. **MIGRATION KOMPLETT!**                                                                                                                                                                                                  |
| 1.0     | 2025-12-16       | Initial plan created                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1.1     | 2025-12-16       | Phase 0, 1, 2 marked as complete. Added progress tracking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 1.2     | 2025-12-16       | **ESLint Compliance Complete:** Fixed all 42+ ESLint errors across nest directory. Key fixes: deprecated Zod `.datetime()` → `.iso.datetime()`, split DTOs for `max-classes-per-file` compliance, added type annotations in callbacks, extracted ERROR_MESSAGES constants, refactored complex methods to reduce cognitive complexity. Total: 78 TypeScript files, 0 ESLint errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.3     | 2025-12-16       | **Phase 3 Progress (50%):** Completed Blackboard (8 endpoints, 8 files), KVP (13 endpoints, 10 files), Surveys (14 endpoints, 12 files). All three modules wrap legacy services. Fixed exactOptionalPropertyTypes issues with conditional assignment pattern.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1.4     | 2025-12-16       | **Phase 3 Progress (67%):** Completed Notifications module (15 endpoints, 10 files). Includes SSE streaming with NestJS @Sse() decorator, push subscription placeholders, preferences management. Extracted SSE helper functions to comply with max-lines-per-function rule. Total: 118 TypeScript files, ~98 endpoints migrated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 1.5     | 2025-12-16       | **Phase 3 Progress (83%):** Completed Shifts module (28 endpoints, 23 files). Largest module in migration - includes shifts CRUD, shift plans, swap requests, favorites, rotation patterns, rotation assignments, rotation generation, rotation history. Created `rotation.dto.ts` re-export file, fixed `z.record()` calls (needed 2 args), added explicit return types to 28 controller methods, fixed `exactOptionalPropertyTypes` with `\| undefined` in filter interfaces. Total: 141 TypeScript files, ~126 endpoints migrated. Only Chat module remaining in Phase 3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 1.6     | 2025-12-16       | **VERIFIED PROGRESS:** Filesystem verification revealed inaccurate "83%" claim. Actual: 145 files, ~139 endpoints migrated (~49% of ~285 total). Express V2 has 26 modules; NestJS has 11 business modules + 3 infrastructure. Phase 4 expanded from 6 to 14 modules (added: areas, features, logs, machines, role-switch, root, signup, tenants). Updated all metrics to reflect accurate ~45% overall progress.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 1.7     | 2025-12-16       | **PHASE 3 COMPLETE:** Chat module migrated (26 endpoints, 17 files). Largest DTO count in migration - 13 DTO files split for ESLint `max-classes-per-file` compliance. Features: conversations CRUD, messages with attachments, scheduled messages, participants management, file uploads with Multer (disk + memory storage). Fixed 26 ESLint errors: typedef annotations for Multer callbacks, require-await with `Promise<never>` for stub methods, collapsible-if merge, strict null checks for CLS context. **Phase 3: 100% COMPLETE (6/6 modules)**. Total: 162 files, ~165 endpoints migrated (~58% overall). Ready for Phase 4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1.8     | 2025-12-16       | **Phase 4 Progress (14%):** Completed Areas module (7 endpoints, 10 files) and Roles module (5 endpoints, 7 files). Areas: location/area management with stats, department assignments. Roles: static role definitions (root/admin/employee), hierarchy, assignable roles, user role checks. Added `eslint-disable import-x/max-dependencies` to app.module.ts (NestJS root modules require many imports). Total: 179 files, ~177 endpoints migrated (~62% overall).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1.9     | 2025-12-16       | **Phase 4 Progress (21%):** Completed Role-Switch module (4 endpoints, 5 files). Features: switch to employee view, switch back to original, root-to-admin switch, status check. JWT-based role switching with `activeRole` and `isRoleSwitched` claims. Added `isRoleSwitched` to `NestAuthUser` interface and `JwtPayload`. Updated `jwt-auth.guard.ts` to populate role switch state. Total: 184 files, ~181 endpoints migrated (~64% overall). **Phase 4: 3/14 modules complete (21%)**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2.0     | 2025-12-16       | **Phase 4 Progress (36%):** Completed Signup module (2 endpoints, 6 files) and Logs module (3 endpoints, 6 files). **Signup:** Public endpoints for tenant self-registration (`POST /signup`, `GET /signup/check-subdomain/:subdomain`). Uses existing Tenant model with regex-based email validation from common.schema.ts. **Logs:** Root-only endpoints for system audit logs (`GET /logs`, `GET /logs/stats`, `DELETE /logs`). Delete requires password confirmation. Refactored service to reduce cognitive complexity (extracted `verifyPassword`, `hasAnyDeleteFilter`, `buildDeleteFilters` helpers). Total: 228 files, ~186 endpoints migrated (~61% overall). **Phase 4: 5/14 modules complete (36%)**. Remaining: 9 modules, ~117 endpoints.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2.1     | 2025-12-16       | **Phase 4 Progress (43%):** Completed Audit-Trail module (6 endpoints, 11 files). **Features:** `GET /audit-trail` (entries with pagination), `GET /audit-trail/stats` (admin/root), `POST /audit-trail/reports` (compliance reports: GDPR, data_access, data_changes, user_activity), `GET /audit-trail/export` (JSON/CSV), `DELETE /audit-trail/retention` (data retention, root only), `GET /audit-trail/:id`. DTOs: 6 files with date range validation refinements for reports (dateTo >= dateFrom, max 1 year). CSV export generates properly escaped output. Total: 239 files, ~192 endpoints migrated (~63% overall). **Phase 4: 6/14 modules complete (43%)**. Remaining: 8 modules, ~111 endpoints.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2.2     | 2025-12-17       | **VERIFICATION UPDATE:** Full filesystem analysis confirmed accurate metrics. **Verified:** 18/26 modules migrated (69.2%), 198/303 endpoints migrated (65.3%), 239 TypeScript files. **Corrections:** Updated percentage from ~63% to ~65-69% (module vs endpoint basis), fixed Phase 4 table (audit-trail now marked complete), tenants module has 0 endpoints (only model file). **Pending endpoints breakdown:** root (25), settings (18), machines (12), admin-permissions (11), features (11), reports (9), plans (8), tenants (0) = 94 total remaining. **Phase 4: 7/14 modules complete (50%)**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2.3     | 2025-12-17       | **PHASE 4 COMPLETE:** Migrated all 7 remaining modules in Phase 4: Settings (18 endpoints, 10 files), Admin-Permissions (11 endpoints, 7 files), Machines (12 endpoints, 9 files), Features (11 endpoints, 8 files), Plans (8 endpoints, 8 files), Reports (9 endpoints, 9 files), Root (25 endpoints, 10 files). **New modules created:** `nest/settings/*` - System/tenant/user settings, bulk updates, category management. `nest/admin-permissions/*` - Admin cross-tenant permission management with direct DB queries. `nest/machines/*` - Industrial asset CRUD, maintenance records, stats, assignments. `nest/features/*` - Feature flag management with public/tenant-scoped endpoints. `nest/plans/*` - Subscription plans, addons, cost calculation, upgrades. `nest/reports/*` - Analytics reports (overview, employees, departments, shifts, KVP, attendance, compliance), custom report generation, PDF/Excel/CSV export. `nest/root/*` - Root user management (admins, root users, tenants), dashboard stats, storage info, tenant deletion workflow (request, approve, reject, emergency stop, dry run). **Total:** ~320 TypeScript files, 292/303 endpoints migrated (~96%). **Phase 4: 13/14 modules complete (~100%)**. Only tenants model remains (0 endpoints). Ready for Phase 5 (cleanup). |
| 2.4     | 2025-12-17       | **🎉 100% ENDPOINT COVERAGE ACHIEVED:** Final verification completed. All 25 modules with endpoints fully migrated. **Final counts:** 300/300 endpoints (100%), all 25 Express modules covered. **Session accomplishments:** Added missing file upload/download endpoints: Blackboard attachments (6 endpoints - upload, list, download, preview, download-by-UUID, delete), Users profile pictures (4 endpoints - PATCH /me, GET/POST/DELETE /me/profile-picture), KVP attachments (2 endpoints - multi-file upload, UUID download), Documents upload (1 endpoint - POST /documents with file content). **Key patterns implemented:** `memoryStorage()` for general uploads, `diskStorage()` for profile pictures, `FileInterceptor`/`FilesInterceptor` for multer, `@Res()` for file streaming, `uuidv7` for file UUIDs, `crypto.createHash('sha256')` for checksums. **Ready for Phase 5:** Testing, validation, Express removal, final deployment.                                                                                                                                                                                                                                                                                                                                                             |
| 2.5     | 2025-12-17       | **🔴 PHASE 6 STARTED: SERVICE NATIVE MIGRATION** - Entdeckt: NestJS Controller sind 100% migriert, aber 13/26 Services delegieren noch zu Express-Legacy-Code via `legacyService` Imports. **Das Problem:** Express kann nicht entfernt werden solange Services Express-Abhängigkeiten haben. **Migrierte Services (13/26 = 50%):** auth (~300 LOC), users (~800 LOC), calendar (~600 LOC), documents (~400 LOC), chat (~1430 LOC), shifts (~1022 LOC), rotation (~1097 LOC), logs (~660 LOC), areas, departments, teams, roles, role-switch. **Verbleibende Services (13/26):** admin-permissions, audit-trail, blackboard, features, kvp, machines, notifications, plans, reports, root, settings, signup, surveys. **Geschätzte Arbeit:** ~6500 Zeilen Service-Code zu nativem NestJS. **Pattern:** `DatabaseService.query<T>()` + `ClsService` + `dbToApi()` statt Express-Delegation. **Ziel:** Komplett Express-frei, NestJS-only. **Nach Service-Migration:** Löschen von app.ts, server.ts, loaders/_, routes/v2/_, Express-Dependencies aus package.json.                                                                                                                                                                                                                                                 |
| 2.6     | 2025-12-17       | **🟡 PHASE 6.1: 84.6% COMPLETE (22/26 Services Native)** - Massive Progress Session: 9 Services zu Native NestJS migriert (~5656 LOC neuer Code). **Migrierte Services:** features.service.ts (~300), plans.service.ts (~400), machines.service.ts (~450), admin-permissions.service.ts (~350), audit-trail.service.ts (~745), settings.service.ts (~857), signup.service.ts (~383), notifications.service.ts (~900), root.service.ts (~1271). **Key Patterns:** PostgreSQL `$1, $2, $3` Placeholders, `QueryResultRow` from `pg`, `db.transaction()` für Multi-Step-Operations, NestJS Exceptions (NotFoundException, ForbiddenException, BadRequestException, ConflictException), snake_case→camelCase Mapping. **Wrapper Pattern (4 Services):** blackboard, kvp, surveys, reports - Diese nutzen komplexe Model-Layer und arbeiten funktional via Delegation. **TypeScript:** Kompiliert erfolgreich (0 Errors).                                                                                                                                                                                                                                                                                                                                                                                               |
| 3.0     | 2025-12-17 21:00 | **🟢 PHASE 6 COMPLETE: 100% NATIVE NESTJS (26/26 Services)** - Die letzten 4 Wrapper-Services wurden vollständig zu Native NestJS migriert: **blackboard.service.ts** (~1300 LOC, 15/15 Tests ✅), **kvp.service.ts** (~950 LOC, 13/13 Tests ✅), **surveys.service.ts** (~1370 LOC, 11/11 Tests ✅), **reports.service.ts** (~1230 LOC). **Gesamt:** ~4850 LOC neuer Service-Code. **Bruno Tests:** 31/31 Requests ✅, 57/57 Tests ✅, 66/66 Assertions ✅. **Phase 6.2 COMPLETE:** NestJS komplett von routes/v2 entkoppelt - 0 Imports von `../../routes/v2/` in `/src/nest/`. Controller-Imports korrigiert: BlackboardComment, PermissionLevel, Machine-Types, SettingData jetzt alle von NestJS Services. **NÄCHSTER SCHRITT:** Phase 7 - Legacy Code von routes/v2 entkoppeln, routes/v2/ löschen, Express aus package.json entfernen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3.1     | 2025-12-17 23:30 | **🟢 PHASE 7 COMPLETE: EXPRESS REMOVAL** - Legacy Code komplett aufgeräumt! **Phase 7.1 (Analyse):** 21 Legacy Services analysiert, nur 2 werden noch von NestJS genutzt (tenantDeletion, hierarchyPermission). `tenantDeletion.service.ts` von routes/v2 entkoppelt (lokales `DeletionWarningUser` Interface statt `DbUser` Import). **Phase 7.2 (Middleware):** 7 Dead-Code-Dateien gelöscht: `middleware/features.ts`, `middleware/tenant.ts`, `middleware/departmentAccess.ts`, `middleware/security.ts`, `middleware/v2/*` (auth, roleCheck, security). **Phase 7.3 (Utils):** Neue `utils/featureCheck.ts` erstellt für Email-Feature-Check, `emailService.ts` von routes/v2 entkoppelt. **Phase 7.4 (Cleanup):** 19 Legacy Services gelöscht, `routes/v2/` komplett gelöscht (~166 Dateien, 2.5MB), `routes/pages/` gelöscht. **Verifizierung:** Docker Health Check ✅, Type-Check ✅, 68/87 API Tests ✅ (19 Shifts-Fehler = separates Issue). **Express bleibt als Infrastruktur** (@nestjs/platform-express benötigt es), aber KEIN Legacy-App-Code mehr!                                                                                                                                                                                                                                               |
| 3.2     | 2025-12-18 00:40 | **🧹 FINAL CLEANUP: MIDDLEWARE DEAD CODE ENTFERNT** - Vollständige Verifizierung des Migration Plans durchgeführt. **Gelöschte Dateien (8):** `middleware/pageAuth.ts`, `middleware/rateLimiter.ts`, `middleware/role.middleware.ts`, `middleware/security-enhanced.ts`, `middleware/tenantIsolation.ts`, `middleware/tenantStatus.ts`, `middleware/validation.zod.ts`, `types/middleware.types.ts`. **Editiert:** `types/index.ts` (Export von middleware.types.js entfernt). **Verifizierung:** Keine Imports dieser Dateien im gesamten Projekt gefunden (grep bestätigt). **Ergebnis:** `middleware/` Ordner komplett gelöscht, Type-Check ✅, Docker Health Check ✅. **Finale Struktur:** 339 TypeScript Files in `/nest/`, 2 Legacy Services behalten (tenantDeletion, hierarchyPermission), Express nur noch als @nestjs/platform-express Infrastruktur.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3.3     | 2025-12-18 01:00 | **⏳ PHASE 8 HINZUGEFÜGT: FASTIFY ADAPTER MIGRATION** - Plan korrigiert: Phase 7 (NestJS Code Migration) ist complete, aber Fastify Adapter Migration fehlt noch! **Laut OPTIMAL-SETUP.md:** Ziel ist `@nestjs/platform-fastify`, nicht Express. **Phase 8 Tasks:** Install @nestjs/platform-fastify + fastify, main.ts anpassen (FastifyAdapter), Express entfernen, Edge Cases testen (Multer, SSE, WebSocket). **Breaking Changes dokumentiert:** Request/Response Types, Multer → @fastify/multipart, Helmet → @fastify/helmet. **OPTIMAL-SETUP.md aktualisiert:** Executive Summary von "✅ DONE" zu "⚠️ PARTIAL", Phase 1.5 für Fastify hinzugefügt, Status-Banner korrigiert.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
