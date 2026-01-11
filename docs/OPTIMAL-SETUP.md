# ASSIXX OPTIMAL SETUP 2025

> **Production-Ready Enterprise SaaS Configuration**
> Last Updated: 18. December 2025
> Status: TARGET STATE (Phase 0-2 ✅ COMPLETE, Phase 3 Pending)

---

## 🟢 BACKEND + CALENDAR MIGRATION: COMPLETE 🟢

```
┌─────────────────────────────────────────────────────────────────┐
│  ✅ PHASE 0: @event-calendar/core (FullCalendar ersetzt)        │
│  ✅ PHASE 1: NESTJS CODE MIGRATION: COMPLETE                    │
│  ✅ PHASE 1.5: FASTIFY ADAPTER: COMPLETE                        │
│  ✅ PHASE 2: VITEST MIGRATION: COMPLETE                         │
│                                                                 │
│  Completed: 18. Dezember 2025                                  │
│                                                                 │
│  ✅ WAS ERREICHT WURDE:                                         │
│     - FullCalendar → @event-calendar/core v3.8.1              │
│     - 300/300 Endpoints migriert (100%)                        │
│     - 26/26 Services Native NestJS                             │
│     - 339 TypeScript Files in /nest/                           │
│     - routes/v2/ komplett gelöscht (~166 Dateien)              │
│     - middleware/ komplett gelöscht (Dead Code)                │
│     - Express Entry-Points gelöscht (app.ts, server.ts)        │
│     - @nestjs/platform-fastify + Fastify v5.6.2                │
│     - Express Dependencies komplett entfernt (14 Packages)     │
│     - Vitest 4.0.16 (Jest komplett entfernt)                   │
│                                                                 │
│  📄 DETAILS: docs/NESTJS-MIGRATION-PLAN.md                      │
│  📄 FASTIFY: docs/FASTIFY-PLAN.md                               │
│                                                                 │
│  NÄCHSTE SCHRITTE:                                              │
│     - Phase 3: SvelteKit Migration                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## EXECUTIVE SUMMARY

| Layer                  | IST (Current)           | SOLL (Optimal)              | Verdict |
| ---------------------- | ----------------------- | --------------------------- | ------- |
| **Runtime**            | Node.js 24.11.1         | Node.js 24 LTS              | ✅ KEEP |
| **Package Manager**    | pnpm 10.24.0            | pnpm 10.x                   | ✅ KEEP |
| **Backend Framework**  | **NestJS 11 + Fastify** | NestJS 11 + Fastify         | ✅ DONE |
| **Frontend Framework** | Vanilla TypeScript      | **SvelteKit 2 + Svelte 5**  | CHANGE  |
| **Build Tool**         | Vite 7.2.6              | Vite 7.x (SvelteKit native) | ✅ KEEP |
| **CSS Framework**      | Tailwind 4.1.17         | Tailwind 4.x                | ✅ KEEP |
| **Database**           | PostgreSQL 17 + RLS     | PostgreSQL 17 + RLS         | ✅ KEEP |
| **Cache**              | Redis 7                 | Redis 7                     | ✅ KEEP |
| **Validation**         | Zod 4.x + nestjs-zod    | Zod 4.x + nestjs-zod        | ✅ KEEP |
| **Testing**            | **Vitest 4.0.16**       | Vitest 4.x                  | ✅ DONE |
| **TypeScript**         | 5.9.3                   | 5.9.x                       | ✅ KEEP |
| **ORM**                | Raw SQL (pg)            | Raw SQL (pg)                | ✅ KEEP |

**1 Change Remaining (SvelteKit Frontend). 3 Changes COMPLETED (NestJS, Fastify, Vitest). 9 Things Already Optimal.**

> 📄 **NestJS Migration Details:** [docs/NESTJS-MIGRATION-PLAN.md](./NESTJS-MIGRATION-PLAN.md)

---

## PART 1: IST-ZUSTAND (Current State)

### 1.1 Runtime & Package Management

```yaml
Runtime:
  engine: Node.js
  version: 24.11.1
  status: LTS (Active until April 2028)
  verdict: OPTIMAL

Package Manager:
  tool: pnpm
  version: 10.24.0
  workspaces: true
  verdict: OPTIMAL
```

### 1.2 Backend Stack

```yaml
Backend Framework:
  name: NestJS
  version: 11.x
  status: ✅ MIGRATED (18. Dezember 2025)
  migration_details: docs/NESTJS-MIGRATION-PLAN.md
  achievements:
    - 300/300 Endpoints migriert
    - 26/26 Services Native NestJS
    - 339 TypeScript Files
    - Express Entry-Points gelöscht
    - middleware/ gelöscht (Dead Code)
  verdict: ✅ DONE

API Architecture:
  style: REST
  version: v2 (no v1 fallback)
  validation: Zod 4.1.13
  verdict: ✅ OPTIMAL (tRPC REJECTED - see ADR)

Database:
  engine: PostgreSQL
  version: 17-alpine
  security: Row Level Security (RLS)
  multi-tenant: tenant_id isolation
  client: pg 8.16.3
  verdict: OPTIMAL

Cache:
  engine: Redis
  version: 7-alpine
  use-cases: Rate-limiting, Session cache
  verdict: OPTIMAL
```

### 1.3 Frontend Stack

```yaml
Frontend Framework:
  name: Vanilla TypeScript
  bundler: Vite 7.2.6
  problems:
    - Manual DOM manipulation
    - No component model
    - No SSR/SSG
    - No type-safe API calls
    - State management self-built
  verdict: REPLACE

CSS:
  framework: Tailwind CSS
  version: 4.1.17
  status: Current
  plugins:
    - @tailwindcss/forms
    - @tailwindcss/typography
    - @tailwindcss/container-queries
  verdict: OPTIMAL

Design System:
  location: frontend/src/design-system/
  components: 29+ primitives
  status: CSS-based (framework-agnostic)
  verdict: KEEP (1:1 Svelte-kompatibel)
```

### 1.4 Testing & Quality

```yaml
Testing:
  framework: Jest
  version: 30.2.0
  problems:
    - Slow with TypeScript
    - Requires ts-jest configuration
    - No native ESM support
    - Separate from Vite ecosystem
  verdict: REPLACE

Linting:
  tool: ESLint
  version: 9.39.1
  config: Flat config (eslint.config.js)
  plugins: 15+ security/quality plugins
  verdict: OPTIMAL

Formatting:
  tool: Prettier
  version: 3.7.4
  verdict: OPTIMAL

Type Checking:
  tool: TypeScript
  version: 5.9.3
  strictness: Maximum (all strict flags enabled)
  verdict: OPTIMAL
```

### 1.5 DevOps & Infrastructure

```yaml
Containerization:
  tool: Docker + Docker Compose
  base-image: node:24.11.1-alpine
  services:
    - backend (Node.js)
    - postgres (PostgreSQL 17)
    - redis (Redis 7)
    - deletion-worker
  verdict: OPTIMAL

CI/CD:
  status: Not configured
  verdict: NEEDS SETUP
```

---

## PART 2: SOLL-ZUSTAND (Optimal Target State)

### 2.1 Runtime & Package Management (NO CHANGE)

```yaml
Runtime:
  engine: Node.js
  version: '>=24.11.1'
  reason: |
    - LTS support until April 2028
    - V8 13.6 engine
    - Stable permission model
    - AsyncLocalStorage performance improvements
    - HTTP/3 support (Undici 7)

Package Manager:
  tool: pnpm
  version: '>=10.24.0'
  reason: |
    - Fastest package manager
    - Strict dependency management
    - Excellent workspace support
    - Disk space efficient
```

#### ⚠️ 2.1.1 pnpm + NestJS Konfiguration (WICHTIG!)

> **KRITISCH:** NestJS hat komplexe Dependency Trees die mit pnpm's striktem
> Hoisting Probleme verursachen können. Diese Konfiguration ist PFLICHT!

> **⚠️ BEKANNTER BUG #9413:** `public-hoist-pattern` und `shamefully-hoist`
> funktionieren **NUR in `.npmrc`**, NICHT in `pnpm-workspace.yaml`!
> Quelle: [GitHub Issue #9413](https://github.com/pnpm/pnpm/issues/9413)

**ZWEI Konfigurationsdateien nötig:**

```ini
# .npmrc - PFLICHT für Hoisting (Bug #9413!)
# Diese Settings MÜSSEN hier sein, funktionieren NICHT in pnpm-workspace.yaml!
public-hoist-pattern[]=@nestjs/*
public-hoist-pattern[]=fastify
public-hoist-pattern[]=@fastify/*
public-hoist-pattern[]=*types*
public-hoist-pattern[]=*eslint*

strict-peer-dependencies=false

# NUR als letzter Ausweg (hoisted ALLES - unsicher!):
# shamefully-hoist=true
```

```yaml
# pnpm-workspace.yaml - für Workspace-Definition und andere Settings
packages:
  - 'backend'
  - 'frontend'

# Andere Settings können hier sein (NICHT hoisting!)
onlyBuiltDependencies:
  - fsevents
```

| Setting                 | Config File           | Grund                |
| ----------------------- | --------------------- | -------------------- |
| `public-hoist-pattern`  | **`.npmrc`**          | Bug #9413            |
| `shamefully-hoist`      | **`.npmrc`**          | Bug #9413            |
| `packages`              | `pnpm-workspace.yaml` | Workspace-Definition |
| `onlyBuiltDependencies` | `pnpm-workspace.yaml` | Build-Settings       |

**Warum nicht `shamefully-hoist=true`?**

- Hoisted ALLE Packages (unsicher, kann Konflikte verursachen)
- `public-hoist-pattern` ist gezielter und sicherer
- Nur für spezifische problematische Packages nutzen

### 2.2 Backend Stack

#### 2.2.1 Backend Framework: NestJS + Fastify

```yaml
Backend Framework:
  name: NestJS
  version: ">=11.x"
  adapter: Fastify (NOT Express)
  decision: NESTJS + FASTIFY (not Hono, not Express)

Why NestJS + Fastify:
  enterprise:
    - Architectural enforcement: Modules, Controllers, Services, Guards
    - Dependency Injection: Scalable to 100+ developers
    - Built-in patterns: CQRS, Event Sourcing, Microservices-ready
    - Enterprise standard: Used by BMW, Adidas, Roche

  performance:
    # Quelle: https://fastify.dev/benchmarks/ (2. Dezember 2025)
    - Fastify: ~47k req/s (vs Express ~10k req/s)
    - Fastify ist 4.7x schneller als Express!
    - Fastify adapter: Native integration, no Express overhead

  features:
    - @nestjs/websockets: Native WebSocket support (we have chat!)
    - @nestjs/bull: Production-ready job queues (deletion worker!)
    - nestjs-zod: Full Zod integration with existing schemas
    # NOTE: @avallone-io/rls existiert, aber nutzt TypeORM - wir nutzen Raw SQL

  deployment:
    - Docker: Works everywhere (AWS, Azure, Hetzner, Plesk, K8s)
    - On-Premise: Perfect for self-hosted enterprise installations
    - Single-Tenant Option: Customers can have isolated instances

Why NOT Hono:
  - Performance: Significantly SLOWER than Fastify on Node.js (adapter overhead)
  - Source: "In the Node environment, Hono is very slow because it uses an
    Adapter to convert between Web Standard APIs and Node input/output."
    (https://betterstack.com/community/guides/scaling-nodejs/hono-vs-fastify/)
  - Team scaling: No architectural enforcement for 100 developers
  - Edge-optimized: Designed for Cloudflare Workers, not traditional servers
  - Hono benchmarks: Only fast on Edge/Bun, not Node.js

Why NOT Express:
  - Performance: Slowest option (~10k req/s laut Fastify Benchmarks)
  - No structure: Every project looks different
  - Already using: Migration effort similar to NestJS
```

**NestJS + Fastify Configuration:**

```typescript
// backend/src/main.ts - OPTIMAL SETUP
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ZodValidationPipe } from 'nestjs-zod';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: true }));

  // Global Zod validation
  app.useGlobalPipes(new ZodValidationPipe());

  // Security
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  });

  await app.listen(3000, '0.0.0.0');
}
bootstrap();
```

```typescript
// backend/src/app.module.ts - MODULAR ARCHITECTURE
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
// Guards & Filters
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantGuard } from './common/guards/tenant.guard';
// Infrastructure
import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
// Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({ isGlobal: true }),

    // Infrastructure
    DatabaseModule,
    RedisModule,
    TrpcModule, // Type-safe API for SvelteKit

    // Feature Modules (191+ files organized into modules!)
    AuthModule,
    UsersModule,
    ShiftsModule,
    ChatModule,
    TenantsModule,
    // ... 25+ more feature modules
  ],
  providers: [
    // Global Guards (applied in order!)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    // Global Exception Filter
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
```

#### 2.2.2 NestJS Guards System (Authentication & Authorization)

```typescript
// backend/src/common/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check for @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
```

```typescript
// backend/src/common/guards/tenant.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { TenantService } from '../../modules/tenants/tenant.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;

    if (!tenantId) {
      return false;
    }

    // Set RLS context for PostgreSQL
    await this.tenantService.setTenantContext(tenantId);

    return true;
  }
}
```

```typescript
// backend/src/common/guards/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

```typescript
// backend/src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// backend/src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

#### 2.2.3 NestJS Controller Example with Zod

```typescript
// backend/src/modules/users/users.controller.ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsersService } from './users.service';

// Zod Schema (can be imported from existing validation files!)
const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
});

// DTO automatically generated from Zod schema!
class CreateUserDto extends createZodDto(CreateUserSchema) {}

@Controller('api/v2/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('admin', 'manager')
  async create(@Body() createUserDto: CreateUserDto) {
    // createUserDto is fully typed and validated by Zod!
    return this.usersService.create(createUserDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }
}
```

#### 2.2.4 Database: PostgreSQL with RLS (NO CHANGE)

```yaml
Database:
  engine: PostgreSQL
  version: 17
  client: pg 8.16.3

RLS Best Practices:
  - SET LOCAL app.current_tenant at request start
  - Enable RLS on ALL tenant tables
  - Use FORCE ROW LEVEL SECURITY on table owners
  - Set security_invoker = true on views
  - Use RESTRICTIVE policies for additional filters
  - Reset tenant context after each request
  - Test with non-superuser role

Connection Pattern:
  migration-user: assixx_user (superuser for migrations)
  app-user: app_user (RLS-restricted for application)
```

**RLS Integration with NestJS:**

> ⚠️ **KRITISCH:** `SET LOCAL` funktioniert NUR innerhalb einer Transaction!
> Ohne Transaction wird der Tenant-Context sofort zurückgesetzt = **Datenleck!**

```typescript
// backend/src/modules/tenants/tenant.service.ts
import { Injectable, OnModuleDestroy, Scope } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

import { InjectPool } from '../../infrastructure/database/database.module';

@Injectable({ scope: Scope.REQUEST })
export class TenantService implements OnModuleDestroy {
  private client: PoolClient | null = null;
  private tenantId: string | null = null;

  constructor(@InjectPool() private readonly pool: Pool) {}

  /**
   * Setzt den Tenant-Context für RLS.
   * WICHTIG: Muss am Anfang jedes Requests aufgerufen werden!
   * Der Context gilt bis commitAndRelease() aufgerufen wird.
   */
  async setTenantContext(tenantId: string): Promise<PoolClient> {
    if (this.client) {
      throw new Error('Tenant context already set for this request');
    }

    this.tenantId = tenantId;
    this.client = await this.pool.connect();

    // BEGIN Transaction - SET LOCAL funktioniert NUR innerhalb einer Transaction!
    await this.client.query('BEGIN');
    await this.client.query('SET LOCAL app.current_tenant = $1', [tenantId]);

    return this.client;
  }

  /**
   * Gibt den aktuellen DB-Client zurück (für Queries innerhalb der Transaction)
   */
  getClient(): PoolClient {
    if (!this.client) {
      throw new Error('No tenant context set. Call setTenantContext() first.');
    }
    return this.client;
  }

  getTenantId(): string | null {
    return this.tenantId;
  }

  /**
   * Beendet die Transaction und gibt die Connection zurück zum Pool.
   * MUSS am Ende jedes Requests aufgerufen werden!
   */
  async commitAndRelease(): Promise<void> {
    if (this.client) {
      try {
        await this.client.query('COMMIT');
      } finally {
        this.client.release();
        this.client = null;
      }
    }
  }

  /**
   * Rollback bei Fehlern
   */
  async rollbackAndRelease(): Promise<void> {
    if (this.client) {
      try {
        await this.client.query('ROLLBACK');
      } finally {
        this.client.release();
        this.client = null;
      }
    }
  }

  /**
   * Cleanup falls commitAndRelease() nicht aufgerufen wurde
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      console.warn('TenantService: Connection not properly released!');
      await this.rollbackAndRelease();
    }
  }
}
```

**TenantGuard mit automatischem Cleanup:**

```typescript
// backend/src/common/guards/tenant.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { TenantService } from '../../modules/tenants/tenant.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const tenantId = request.user?.tenantId;

    if (!tenantId) {
      return false;
    }

    // Set RLS context (startet Transaction)
    await this.tenantService.setTenantContext(tenantId);

    // Cleanup nach Response (Fastify hook)
    response.raw.on('finish', async () => {
      await this.tenantService.commitAndRelease();
    });

    // Cleanup bei Error
    response.raw.on('error', async () => {
      await this.tenantService.rollbackAndRelease();
    });

    return true;
  }
}
```

**RLS Pattern:**

```sql
-- Optimal RLS setup
CREATE POLICY tenant_isolation ON users
  FOR ALL
  TO app_user
  USING (tenant_id = current_setting('app.current_tenant')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE users FORCE ROW LEVEL SECURITY;
```

#### 2.2.5 Validation: Zod with nestjs-zod (ENHANCED)

```yaml
Validation:
  library: Zod
  version: '>=4.1.13'
  integration: nestjs-zod

Best Practice:
  - Keep existing Zod schemas in validation files
  - Use createZodDto() to convert to NestJS DTOs
  - Shared schemas between frontend/backend
  - Export types with z.infer<typeof Schema>
```

```typescript
// backend/src/modules/users/users.validation.ts
// YOUR EXISTING ZOD SCHEMAS STAY THE SAME!
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
});

export const UpdateUserSchema = CreateUserSchema.partial();

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
```

```typescript
// backend/src/modules/users/users.dto.ts
// NestJS DTO wrapper - automatic validation!
import { createZodDto } from 'nestjs-zod';

import { CreateUserSchema, UpdateUserSchema } from './users.validation';

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
```

### 2.3 Frontend Stack

#### 2.3.1 Frontend Framework: SvelteKit 2 + Svelte 5

```yaml
Frontend Framework:
  name: SvelteKit
  version: '>=2.20.0'
  svelte: '>=5.x'
  decision: SVELTEKIT (not Next.js, not Nuxt, not Vanilla)

Why SvelteKit:
  - Performance: 2-3x faster startup than React
  - Svelte 5: Runes-based reactivity (explicit, powerful)
  - TypeScript: First-class support
  - Vite: Native Vite integration (you keep Vite!)
  - SSR/SSG: Built-in server-side rendering
  - REST: api-client.ts with Zod type safety
  - Size: Smallest bundle sizes of any framework
  - DX: Best developer experience in 2025

Why NOT Next.js:
  - React: Heavier runtime
  - Vercel: Vendor lock-in tendencies
  - Complexity: Over-engineered for your needs

Why NOT keep Vanilla TS:
  - No components: Manual DOM manipulation
  - No SSR: SEO and performance issues
  - No type-safe API: Manual fetch typing
  - No state: Self-built state management
```

#### ~~2.3.2 Type-Safe API: tRPC~~ ❌ REJECTED

> **Status:** REJECTED (2026-01-06)
> **Decision:** See [ARCHITECTURE-DECISION-NO-TRPC.md](./ARCHITECTURE-DECISION-NO-TRPC.md)
>
> **Reason:** REST API with `api-client.ts` (684 LOC) already provides:
>
> - Type safety via Zod + TypeScript
> - Caching, token refresh, error handling
> - Mobile/external client compatibility
> - 20+ tested REST controllers
>
> **Current Stack (OPTIMAL):**
>
> ```yaml
> Backend: NestJS + Fastify + REST Controllers + Zod DTOs
> Frontend: SvelteKit + api-client.ts (REST)
> Type Safety: Zod schemas shared between layers
> ```

#### ⚠️ 2.3.3 SVELTE 5 LIBRARY-KOMPATIBILITÄT (KRITISCH!)

> **Svelte 5 ist seit Oktober 2024 stable.** Das Ecosystem ist noch dünn!
> Vor Migration MÜSSEN alle Libraries auf Svelte 5 Support geprüft werden.

**Aktuelle Assixx Dependencies - Status:**

| Library          | Aktuell | Svelte 5?             | Aktion                 |
| ---------------- | ------- | --------------------- | ---------------------- |
| @fullcalendar/\* | 6.1.19  | ❌ **NEIN**           | → @event-calendar/core |
| @zxcvbn-ts/\*    | 3.0.4   | ✅ Framework-agnostic | Behalten               |
| dompurify        | 3.3.0   | ✅ Framework-agnostic | Behalten               |

**KRITISCH: FullCalendar Migration erforderlich!**

```yaml
Problem:
  library: svelte-fullcalendar
  status: ARCHIVIERT (September 2023)
  svelte5: Nicht unterstützt
  risk: 🔴 KRITISCH

Lösung:
  library: '@event-calendar/core'
  repo: https://github.com/vkurko/calendar
  svelte5: ✅ Native Support mit Runes
  license: MIT (alles frei, keine Premium-Features)
  size: 37kb (Brotli) vs ~150kb FullCalendar
  features:
    - DayGrid, TimeGrid, List views
    - ResourceTimeline, ResourceTimeGrid
    - Drag & Drop
    - Zero dependencies
```

**@event-calendar/core Setup:**

> **✅ AKTUELL: v5.0.5** - Upgrade durchgeführt 2025-12-22
> Alle Plugins in `@event-calendar/core` enthalten. Neue `createCalendar()` API.

```svelte
<!-- =================================================================== -->
<!-- VERSION 5.x (AKTUELL) - createCalendar() API                        -->
<!-- Alle Plugins in @event-calendar/core enthalten                      -->
<!-- =================================================================== -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { createCalendar, TimeGrid, DayGrid, Interaction } from '@event-calendar/core';
  import '@event-calendar/core/index.css';

  // Svelte 5 Runes für lokalen State
  let calendarEl: HTMLElement;
  let calendarInstance: ReturnType<typeof createCalendar> | null = $state(null);

  const plugins = [TimeGrid, DayGrid, Interaction];

  onMount(() => {
    // v5 API: createCalendar(target, plugins, options)
    calendarInstance = createCalendar(calendarEl, plugins, {
      view: 'timeGridWeek',
      events: [],
      editable: true,
      selectable: true,
      eventDrop: (info) => handleEventDrop(info),
      eventResize: (info) => handleEventResize(info),
    });

    return () => calendarInstance?.destroy();
  });

  function handleEventDrop(info: unknown) { /* ... */ }
  function handleEventResize(info: unknown) { /* ... */ }
</script>

<div bind:this={calendarEl}></div>
```

**SvelteKit Configuration:**

```typescript
// svelte.config.js - OPTIMAL SETUP
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true, // Brotli + Gzip
    }),
    alias: {
      '@/*': './src/*',
      '@components/*': './src/lib/components/*',
      '@styles/*': './src/styles/*',
    },
    csrf: {
      checkOrigin: true,
    },
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
      },
    },
  },
};

export default config;
```

#### 2.3.4 Build Tool: Vite (KEEP - SvelteKit Native)

```yaml
Build Tool:
  name: Vite
  version: '>=7.2.0'
  status: SvelteKit uses Vite natively

Configuration:
  - SvelteKit manages Vite config
  - Your existing optimizations transfer
  - Tailwind v4 plugin compatible
```

#### 2.3.5 CSS: Tailwind v4 (NO CHANGE)

```yaml
CSS Framework:
  name: Tailwind CSS
  version: '>=4.1.0'

v4 Best Practices:
  - Use @import "tailwindcss" (single import)
  - Configure via @theme in CSS (not JS)
  - Use CSS variables for customization
  - Browser support: Safari 16.4+, Chrome 111+, Firefox 128+

Design System Migration:
  - Your 29+ CSS primitives work 1:1
  - Convert to Svelte components gradually
  - CSS classes remain unchanged
```

### 2.4 Testing: Vitest

```yaml
Testing Framework:
  name: Vitest
  version: '>=3.x'
  decision: VITEST (not Jest)

Why Vitest:
  - Speed: 10-20x faster than Jest in watch mode
  - TypeScript: Native support, zero config
  - ESM: Native ES Modules support
  - Vite: Same transform pipeline as build
  - API: Jest-compatible (easy migration)
  - DX: Better error messages, inline snapshots

Migration Effort:
  - API 95% compatible with Jest
  - Replace jest.fn() with vi.fn()
  - Replace jest.mock() with vi.mock()
  - Remove ts-jest dependency
```

**Vitest Configuration:**

```typescript
// vitest.config.ts - OPTIMAL SETUP
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules', 'dist', '**/*.d.ts'],
    },
    // Performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
});
```

### 2.5 TypeScript Configuration (KEEP - Already Optimal)

```yaml
TypeScript:
  version: '>=5.9.0'
  strictness: Maximum

Your current config is OPTIMAL:
  - strict: true
  - strictNullChecks: true
  - noUncheckedIndexedAccess: true
  - exactOptionalPropertyTypes: true
  - useUnknownInCatchVariables: true
  - noImplicitReturns: true
  - All Power of Ten rules enabled
```

### 2.6 DevOps & Infrastructure

#### 2.6.1 Docker (MINIMAL CHANGES)

```yaml
Docker:
  base-image: node:24-alpine (already optimal)

Changes:
  - Add NestJS to backend
  - SvelteKit builds to /build
  - Update health checks
```

**Production Dockerfile:**

```dockerfile
# Dockerfile.prod - OPTIMAL SETUP
FROM node:24-alpine AS builder

RUN npm install -g pnpm@10

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Production image
FROM node:24-alpine AS runner

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/frontend/build ./frontend/build
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

USER nestjs
EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "backend/dist/main.js"]
```

#### 2.6.2 CI/CD (NEW)

```yaml
CI/CD:
  platform: GitHub Actions

Pipelines:
  - lint: ESLint + Prettier + Stylelint
  - type-check: TypeScript strict
  - test: Vitest with coverage
  - build: Production build
  - security: npm audit + Snyk
  - deploy: Docker to production
```

---

## PART 3: FINAL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRODUCTION STACK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    FRONTEND                              │   │
│  │  SvelteKit 2 + Svelte 5 + Vite 7 + Tailwind 4          │   │
│  │  • SSR/SSG for SEO                                      │   │
│  │  • Svelte 5 Runes for reactivity                        │   │
│  │  • Type-safe REST (api-client.ts + Zod)                 │   │
│  │  • Your Design System (29+ components)                  │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                     │
│                    Type-Safe REST API                           │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                    BACKEND                               │   │
│  │  NestJS 11 + Fastify + Zod + PostgreSQL 17 + Redis 7   │   │
│  │  • nestjs-zod validation                                │   │
│  │  • Guards: JWT, Tenant, Roles                           │   │
│  │  • @nestjs/websockets for chat                          │   │
│  │  • @nestjs/bull for jobs                                │   │
│  │  • RLS Multi-Tenant Isolation                           │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                    DATABASE                              │   │
│  │  PostgreSQL 17 + Row Level Security                     │   │
│  │  • tenant_id isolation                                  │   │
│  │  • app_user (RLS restricted)                            │   │
│  │  • assixx_user (migrations)                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                      DEVELOPMENT                                 │
│  Node.js 24 LTS | pnpm 10 | TypeScript 5.9 | Vitest 3          │
│  ESLint 9 | Prettier 3 | Docker Compose                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## PART 4: VERSION MATRIX

### Production Dependencies

| Package                  | Current | Target    | Status |
| ------------------------ | ------- | --------- | ------ |
| node                     | 24.11.1 | >=24.11.1 | KEEP   |
| pnpm                     | 10.24.0 | >=10.24.0 | KEEP   |
| typescript               | 5.9.3   | >=5.9.0   | KEEP   |
| @nestjs/core             | -       | >=11.0.0  | NEW    |
| @nestjs/platform-fastify | -       | >=11.0.0  | NEW    |
| @nestjs/websockets       | -       | >=11.0.0  | NEW    |
| @nestjs/bull             | -       | >=11.0.0  | NEW    |
| nestjs-zod               | -       | >=4.0.0   | NEW    |
| fastify                  | -       | >=5.0.0   | NEW    |
| zod                      | 4.1.13  | >=4.1.0   | KEEP   |
| pg                       | 8.16.3  | >=8.16.0  | KEEP   |
| redis                    | 5.10.0  | >=5.10.0  | KEEP   |
| @sveltejs/kit            | -       | >=2.20.0  | NEW    |
| svelte                   | -       | >=5.0.0   | NEW    |
| vite                     | 7.2.6   | >=7.2.0   | KEEP   |
| tailwindcss              | 4.1.17  | >=4.1.0   | KEEP   |
| vitest                   | -       | >=3.0.0   | NEW    |

### Removed Dependencies

| Package        | Reason                       |
| -------------- | ---------------------------- |
| express        | Replaced by NestJS + Fastify |
| @types/express | Not needed with NestJS       |
| jest           | Replaced by Vitest           |
| ts-jest        | Not needed with Vitest       |
| @types/jest    | Not needed with Vitest       |

---

## PART 5: SECURITY CHECKLIST

### Already Implemented (KEEP)

- [x] PostgreSQL RLS for tenant isolation
- [x] Zod validation on all inputs
- [x] Helmet-equivalent headers (Fastify helmet)
- [x] CORS configuration
- [x] Rate limiting via Redis
- [x] JWT authentication
- [x] bcryptjs password hashing
- [x] ESLint security plugins
- [x] npm audit in CI
- [x] **CSRF protection** (NestJS csurf)
- [x] **CSP headers** (SvelteKit config)

### NestJS Security Enhancements

- [x] **Guards System** - Centralized auth/authz
- [x] **Validation Pipes** - Global Zod validation
- [x] **Exception Filters** - Consistent error handling
- [x] **Interceptors** - Request/Response transformation

### To Implement (Phase 2)

- [ ] Security.txt file (5 Minuten)
- [ ] Dependency scanning (Snyk/Dependabot) - CI/CD Setup
- [ ] Penetration testing - vor Enterprise-Kunden

---

## PART 6: PERFORMANCE TARGETS

| Metric         | Target       | How                                |
| -------------- | ------------ | ---------------------------------- |
| TTFB           | <200ms       | SvelteKit SSR + Edge caching       |
| LCP            | <2.5s        | Optimized images, preloading       |
| FID            | <100ms       | Minimal JS, Svelte 5 performance   |
| CLS            | <0.1         | Reserved space for dynamic content |
| Bundle Size    | <500KB       | Code splitting, tree shaking       |
| API Response   | <100ms       | PostgreSQL indexes, Redis caching  |
| API Throughput | 30-50k req/s | Fastify adapter                    |

---

## PART 7: WHAT STAYS THE SAME

Your significant investments that remain unchanged:

1. **Services Layer** - All your business logic stays
2. **Zod Schemas** - All validation schemas stay (wrapped with nestjs-zod)
3. **PostgreSQL + RLS** - Database architecture stays
4. **Design System CSS** - All 29+ components work in Svelte
5. **TypeScript Config** - Your strict config is optimal
6. **ESLint Config** - Your security rules stay
7. **Docker Setup** - Minor adjustments only
8. **Redis Integration** - Cache layer unchanged
9. **pnpm Workspaces** - Monorepo structure stays

---

## SOURCES

- [Node.js 24 LTS Announcement](https://nodesource.com/blog/nodejs-24-becomes-lts)
- [NestJS Documentation](https://docs.nestjs.com/)
- [NestJS Fastify Adapter](https://docs.nestjs.com/techniques/performance)
- [nestjs-zod GitHub](https://github.com/risen228/nestjs-zod)
- [Fastify Benchmarks](https://www.fastify.io/benchmarks/)
- [Vitest vs Jest 2025](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/)
- [SvelteKit Enterprise Best Practices](https://zxce3.net/posts/sveltekit-2025-modern-development-trends-and-best-practices/)
- [PostgreSQL RLS Multi-Tenant Guide](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
- [Svelte 5 Production Readiness](https://codifysol.com/svelte-in-2025-is-it-ready-for-production/)

---

## DECISION SUMMARY

| Question              | Answer                    | Confidence |
| --------------------- | ------------------------- | ---------- |
| NestJS or Hono?       | **NestJS + Fastify**      | 95%        |
| SvelteKit or Next.js? | **SvelteKit**             | 90%        |
| Vitest or Jest?       | **Vitest**                | 99%        |
| Keep PostgreSQL RLS?  | **Yes**                   | 100%       |
| Keep Tailwind v4?     | **Yes**                   | 100%       |
| Keep Zod?             | **Yes** (with nestjs-zod) | 100%       |
| Keep Node.js 24?      | **Yes**                   | 100%       |
| Keep pnpm?            | **Yes**                   | 100%       |

**Why NestJS over Hono:**

- **Team Scaling**: Architectural enforcement for 100+ developers
- **Enterprise Features**: Guards, Modules, DI, built-in patterns
- **Performance**: Fastify is significantly faster than Hono on Node.js
  (Hono uses adapter overhead for Web Standard APIs)
- **Ecosystem**: @nestjs/websockets, @nestjs/bull, nestjs-zod
- **Deployment**: Perfect for on-premise enterprise installations

**Total Changes: 3 (Backend Framework, Frontend Framework, Testing)**
**Everything Else: Already Optimal**

---

## PART 8: PRE-LAUNCH CHECKLIST (NACH NESTJS-MIGRATION)

> **WICHTIG: Diese Items erst NACH der NestJS-Migration implementieren!**
> Der Code unten ist NestJS-spezifisch. Siehe Part 10 für die korrekte Reihenfolge.

### 8.1 PFLICHT vor Launch (3 Dinge)

#### 1. Sentry Error Tracking - KRITISCH

| Aspekt             | Details                                         |
| ------------------ | ----------------------------------------------- |
| **Warum PFLICHT?** | Ohne Error Tracking bist du BLIND in Production |
| **Priorität**      | KRITISCH                                        |

```typescript
// backend/src/infrastructure/sentry/sentry.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@Global()
@Module({})
export class SentryModule {
  static forRoot() {
    return {
      module: SentryModule,
      providers: [
        {
          provide: 'SENTRY',
          useFactory: (configService: ConfigService) => {
            Sentry.init({
              dsn: configService.get('SENTRY_DSN'),
              environment: configService.get('NODE_ENV'),
              tracesSampleRate: configService.get('NODE_ENV') === 'production' ? 0.1 : 1.0,
              beforeSend(event) {
                if (event.request?.data) {
                  delete event.request.data.password;
                  delete event.request.data.token;
                }
                return event;
              },
            });
            return Sentry;
          },
          inject: [ConfigService],
        },
      ],
      exports: ['SENTRY'],
    };
  }
}
```

```typescript
// backend/src/common/filters/sentry-exception.filter.ts
import { ArgumentsHost, Catch, HttpException, Inject } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    Sentry.captureException(exception);
    super.catch(exception, host);
  }
}
```

**Package:**

```bash
pnpm add @sentry/node
```

> **📌 Nach SvelteKit-Migration:** Frontend-Sentry hinzufügen!
>
> ```bash
> pnpm add @sentry/sveltekit
> ```

---

#### 2. Health Check erweitern - WICHTIG

| Aspekt        | Details                                              |
| ------------- | ---------------------------------------------------- |
| **Warum?**    | Docker/K8s Readiness Probes brauchen DB/Redis Status |
| **Priorität** | HOCH                                                 |

```typescript
// backend/src/infrastructure/health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

```typescript
// backend/src/infrastructure/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';

import { Public } from '../../common/decorators/public.decorator';
import { DatabaseHealthIndicator } from './database.health';
import { RedisHealthIndicator } from './redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: DatabaseHealthIndicator,
    private redis: RedisHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024), // 500MB
    ]);
  }
}
```

**Package:**

```bash
pnpm add @nestjs/terminus
```

**Docker Compose Update:**

```yaml
healthcheck:
  test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:3000/health']
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

---

#### 3. Graceful Shutdown - KRITISCH

| Aspekt              | Details                                                      |
| ------------------- | ------------------------------------------------------------ |
| **Warum KRITISCH?** | Ohne Graceful Shutdown verlierst du Requests bei Deployments |
| **Priorität**       | KRITISCH                                                     |

```typescript
// backend/src/main.ts - MIT GRACEFUL SHUTDOWN
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as Sentry from '@sentry/node';
import { ZodValidationPipe } from 'nestjs-zod';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: true }));

  const logger = new Logger('Bootstrap');

  // Global validation
  app.useGlobalPipes(new ZodValidationPipe());

  // Enable shutdown hooks
  app.enableShutdownHooks();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    await Sentry.close(2000);
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully...');
    await Sentry.close(2000);
    await app.close();
    process.exit(0);
  });

  await app.listen(3000, '0.0.0.0');
  logger.log(`Server running on port 3000`);
}
bootstrap();
```

**Docker stop_grace_period:**

```yaml
# docker-compose.yml
services:
  backend:
    stop_grace_period: 30s
```

---

### 8.2 BEREITS VORHANDEN (Nicht ändern!)

| Was                         | Status          | Location                        |
| --------------------------- | --------------- | ------------------------------- |
| Winston Logger              | ✅ Funktioniert | `backend/src/utils/logger.ts`   |
| Sensitive Data Sanitization | ✅ Eingebaut    | `sanitizeForLog()`              |
| Rate Limiting               | ✅ Redis-based  | Middleware                      |
| Basic Health Check          | ✅ Vorhanden    | `backend/src/loaders/health.ts` |

#### Winston + NestJS Integration

> **WICHTIG:** Winston muss in NestJS als Custom Logger integriert werden!
> Ohne Integration nutzt NestJS seinen eigenen ConsoleLogger.

**Option 1: nest-winston Package (Empfohlen)**

```bash
pnpm add nest-winston winston
```

```typescript
// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, context }) => {
              return `${timestamp} [${context}] ${level}: ${message}`;
            }),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    }),
  ],
})
export class AppModule {}
```

```typescript
// backend/src/main.ts - Winston als NestJS Logger
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Winston als NestJS Logger setzen
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  await app.listen(3000);
}
```

**Option 2: Custom LoggerService (Falls ihr existierenden Winston behalten wollt)**

```typescript
// backend/src/infrastructure/logger/winston-logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';

import { logger } from '../../utils/logger';

// Euer existierender Winston Logger

@Injectable()
export class WinstonLoggerService implements LoggerService {
  log(message: any, context?: string) {
    logger.info(message, { context });
  }

  error(message: any, trace?: string, context?: string) {
    logger.error(message, { trace, context });
  }

  warn(message: any, context?: string) {
    logger.warn(message, { context });
  }

  debug(message: any, context?: string) {
    logger.debug(message, { context });
  }

  verbose(message: any, context?: string) {
    logger.verbose(message, { context });
  }
}
```

```typescript
// backend/src/main.ts
import { WinstonLoggerService } from './infrastructure/logger/winston-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(new WinstonLoggerService());
  await app.listen(3000);
}
```

---

## PART 9: NICHT MACHEN (KISS - Over-Engineering vermeiden)

### 9.1 Pino statt Winston --aber pino besser. !! wir sollten pino nehmen. wir müssen noch darüber nachdenken !! KISS heißt nicht faul sein !!!!!!!! nein wir nehemn sicher pino!!!!! docs und setupmigration plan machen wenn soweit !!

| Vorschlag        | Winston → Pino Migration              |
| ---------------- | ------------------------------------- |
| **Empfohlen?**   | ❌ NEIN (für jetzt)                   |
| **Warum nicht?** | 68 Files ändern, Winston funktioniert |

**Pino ist schneller (5x), aber:**

- Euer Winston hat bereits `sanitizeForLog()`
- Migration = 68 Files ändern
- Kein ROI bis >10.000 Requests/Sekunde

**Wann doch Pino?**

- Log-Volume wird zum Performance-Problem
- Elastic/Loki-Integration zwingend JSON

---

### 9.2 Microservices statt Monolith

| Vorschlag        | Monolith → Microservices            |
| ---------------- | ----------------------------------- |
| **Empfohlen?**   | ❌ NEIN (für jetzt)                 |
| **Warum nicht?** | NestJS Monolith ist bereits modular |

**NestJS Module = Microservices-Vorbereitung:**

- Jedes Module ist eigenständig
- Bei Bedarf einzeln extrahierbar
- Monolith ist RICHTIG für Assixx-Größe

**Wann doch Microservices?**

- > 50 Entwickler an gleichem Service
- Unterschiedliche Skalierungsanforderungen
- Separate Deployment-Zyklen nötig

---

### 9.3 Kubernetes statt Docker Compose

| Vorschlag        | Docker Compose → Kubernetes          |
| ---------------- | ------------------------------------ |
| **Empfohlen?**   | ❌ NEIN (für jetzt)                  |
| **Warum nicht?** | Docker Compose reicht für On-Premise |

**Docker Compose Vorteile:**

- Einfache Installation für Kunden
- Kein K8s-Know-how nötig
- Perfekt für Single-Server Deployment

**Wann doch Kubernetes?**

- Multi-Region Deployment
- Auto-Scaling erforderlich
- > 10 Services

---

### 9.4 Secrets Management (Vault/Doppler)

| Phase                 | Empfehlung            |
| --------------------- | --------------------- |
| **Launch**            | Docker Secrets + .env |
| **Enterprise-Kunden** | Vault oder Doppler    |
| **SOC2/ISO27001**     | Vault Pflicht         |

**Für Launch reicht:**

- `.env` für Development
- Docker Secrets für Production
- Environment Variables in CI/CD

---

## PART 10: ROADMAP & MIGRATION ORDER

> **KRITISCH: Diese Reihenfolge einhalten!**
> **Keine Deadlines. Keine Zeitschätzungen. Wir sind fertig wenn wir fertig sind.**

### 10.1 MIGRATIONS-ROADMAP (Korrekte Reihenfolge)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ASSIXX ROADMAP 2025                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE 0: FULLCALENDAR MIGRATION (SEPARAT!)                    │
│  ═══════════════════════════════════════════                    │
│  ├── Eigener Branch: feature/fullcalendar-migration            │
│  ├── FullCalendar → @event-calendar/core                       │
│  ├── Intensives Testing (Schichtplanung = kritisch!)           │
│  ├── Merge BEVOR SvelteKit-Migration                           │
│  └── WARUM SEPARAT: Hohes Risiko, muss isoliert getestet werden│
│                         ↓                                       │
│  PHASE 1: NESTJS MIGRATION (Backend) ✅ COMPLETE!              │
│  ════════════════════════════════════════════════               │
│  ├── ✅ NestJS Projekt Setup (Express Adapter)                 │
│  ├── ✅ Module-Struktur erstellt (28 Module)                   │
│  ├── ✅ Guards implementiert (JWT, Tenant, Roles)              │
│  ├── ✅ Services migriert (26/26 Native, 339 Files)            │
│  ├── ✅ nestjs-zod Integration                                 │
│  ├── ✅ Express Entry-Points gelöscht                          │
│  ├── ✅ middleware/ gelöscht (Dead Code)                       │
│  ├── ✅ routes/v2/ gelöscht (~166 Dateien)                     │
│  └── 📄 Details: docs/NESTJS-MIGRATION-PLAN.md                 │
│                         ↓                                       │
│  PHASE 2: VITEST MIGRATION (Testing)                           │
│  ════════════════════════════════                               │
│  ├── jest.fn() → vi.fn()                                       │
│  ├── jest.mock() → vi.mock()                                   │
│  ├── Config anpassen                                           │
│  └── QUICK WIN: 95% API-kompatibel                             │
│                         ↓                                       │
│  PHASE 3: SVELTEKIT MIGRATION (Frontend)                       │
│  ═════════════════════════════════════                          │
│  ├── Library-Kompatibilität prüfen (siehe Part 2.3.3)          │
│  ├── Page für Page migrieren                                   │
│  ├── api-client.ts integrieren (REST)                          │
│  ├── Design System → Svelte Components                         │
│  └── WARUM ZULETZT: Braucht stabiles NestJS Backend            │
│                         ↓                                       │
│  PHASE 4: PRE-LAUNCH POLISH                                    │
│  ══════════════════════════                                     │
│  ├── Sentry Error Tracking (siehe Part 8)                      │
│  ├── @nestjs/terminus Health Checks                            │
│  ├── Graceful Shutdown                                         │
│  └── WARUM ZULETZT: Code ist NestJS-spezifisch                 │
│                         ↓                                       │
│  PHASE 5: ENTERPRISE FEATURES (Nach Launch)                    │
│  ══════════════════════════════════════════                     │
│  ├── Doppler/Infisical Secrets                                 │
│  ├── Full Observability (OpenTelemetry)                        │
│  └── SOC2 Compliance                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 PHASEN-ÜBERSICHT (OHNE Zeitschätzungen)

| Phase | Aufgabe                             | Abhängigkeit | Status                       |
| ----- | ----------------------------------- | ------------ | ---------------------------- |
| 0     | FullCalendar → @event-calendar/core | -            | ✅ **COMPLETE** (2025-12-18) |
| 1     | NestJS Migration (Code)             | Phase 0      | ✅ **COMPLETE** (2025-12-18) |
| 1.5   | Fastify Adapter (Express → Fastify) | Phase 1      | ✅ **COMPLETE** (2025-12-18) |
| 2     | Vitest Migration                    | Phase 1      | ✅ **COMPLETE** (2025-12-18) |
| 3     | SvelteKit Migration                 | Phase 1.5    | ⏳ Pending                   |
| 4     | Pre-Launch Polish                   | Phase 3      | ⏳ Pending                   |
| 5     | Enterprise Features                 | Launch       | ⏳ Pending                   |

> **Keine Zeitschätzungen.** Wir arbeiten bis es fertig ist.
> Qualität > Geschwindigkeit. KISS > Deadlines.
>
> 📄 **Phase 0 Details:** @event-calendar/core v3.8.1 ersetzt FullCalendar
> 📄 **Phase 1 Details:** [docs/NESTJS-MIGRATION-PLAN.md](./NESTJS-MIGRATION-PLAN.md)
> 📄 **Phase 2 Details:** Vitest 4.0.16, Jest komplett entfernt

### 10.3 WAS SICH NICHT ÄNDERT

```
┌─────────────────────────────────────────────┐
│           BLEIBT WIE ES IST                  │
├─────────────────────────────────────────────┤
│ ✅ Node.js 24 LTS                           │
│ ✅ pnpm Workspaces                          │
│ ✅ PostgreSQL 17 + RLS                      │
│ ✅ Redis 7                                  │
│ ✅ Zod Validation (wird mit nestjs-zod besser) │
│ ✅ Tailwind 4                               │
│ ✅ TypeScript 5.9 strict                    │
│ ✅ Docker Compose Setup                     │
│ ✅ Winston Logger                           │
│ ✅ ESLint Security Rules                    │
└─────────────────────────────────────────────┘
```

### 10.4 NICHT MACHEN (Over-Engineering)

```
┌─────────────────────────────────────────────┐
│           SPÄTER ODER NIE                    │
├─────────────────────────────────────────────┤
│ ❌ Pino Migration (68 Files!)               │
│ ❌ Kubernetes (Docker Compose reicht)       │
│ ❌ Microservices (NestJS Monolith ist richtig) │
│ ❌ Event Sourcing (YAGNI)                   │
│ ❌ CQRS (YAGNI)                             │
└─────────────────────────────────────────────┘
```

### 10.5 ROLLBACK-STRATEGIE

```
┌─────────────────────────────────────────────────────────────────┐
│  ROLLBACK = GIT                                                 │
│                                                                 │
│  - Kein Fallback-API                                           │
│  - Keine Legacy-Endpoints                                      │
│  - Keine Parallel-Systeme                                      │
│  - Keine /api/v2-legacy oder ähnliches                         │
│                                                                 │
│  Bei Problemen: git revert / git reset                         │
│  Wir migrieren KOMPLETT oder gar nicht.                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## SOURCES (Updated)

- [Node.js 24 LTS Announcement](https://nodesource.com/blog/nodejs-24-becomes-lts)
- [NestJS Documentation](https://docs.nestjs.com/)
- [NestJS Fastify Adapter](https://docs.nestjs.com/techniques/performance)
- [nestjs-zod GitHub](https://github.com/risen228/nestjs-zod)
- [Fastify vs Hono Benchmarks](https://www.fastify.io/benchmarks/)
- [Sentry NestJS Integration](https://docs.sentry.io/platforms/node/guides/nestjs/)
- [NestJS Terminus Health Checks](https://docs.nestjs.com/recipes/terminus)
- [ADR: No tRPC](./ARCHITECTURE-DECISION-NO-TRPC.md)
- [Vitest vs Jest 2025](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/)
- [PostgreSQL RLS Multi-Tenant Guide](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [OpenTelemetry Node.js Guide](https://signoz.io/opentelemetry/nodejs/)

### Svelte 5 Library Compatibility

- [svelte-fullcalendar - ARCHIVIERT](https://github.com/YogliB/svelte-fullcalendar) - Nicht verwenden!
- [@event-calendar/core - Svelte 5 Alternative](https://github.com/vkurko/calendar) - Empfohlen
- [Svelte 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [Svelte 5 Runes Compatibility Issues](https://github.com/sveltejs/svelte/issues/9632)

---

## APPENDIX: Skalierung für Enterprise (Nach Launch)

### A.1 Technische Skalierung

| Was                   | Wann nötig              |
| --------------------- | ----------------------- |
| **Load Balancer**     | >1.000 concurrent Users |
| **DB Read Replicas**  | >5.000 Tenants          |
| **CDN (Cloudflare)**  | Sofort sinnvoll         |
| **Backup & DR**       | ⚠️ VOR Launch!          |
| **Uptime Monitoring** | ⚠️ VOR Launch!          |

### A.2 Geschäftliche Anforderungen (was Entwickler oft vergessen!)

| Was                     | Warum kritisch                          | Wann                       |
| ----------------------- | --------------------------------------- | -------------------------- |
| **DSGVO-Dokumentation** | Pflicht in DE                           | Vor Launch                 |
| **AV-Verträge**         | Enterprise-Kunden fordern das           | Vor erstem Enterprise-Deal |
| **SLA definieren**      | "99.9% Uptime" = max 8.7h Downtime/Jahr | Vor Enterprise             |
| **Support-Prozess**     | Wer antwortet wann?                     | Vor Launch                 |
| **ISO 27001**           | Manche Enterprise-Kunden fordern es     | Bei >500k € ARR            |

---

## APPENDIX B: BRANCH-STRATEGIE

### Branch pro Phase

| Phase | Branch-Name                      | Inhalt                                            |
| ----- | -------------------------------- | ------------------------------------------------- |
| 0     | `feature/fullcalendar-migration` | FullCalendar → @event-calendar/core (SEPARAT!)    |
| 1     | `feature/nestjs-migration`       | NestJS + Fastify, Guards, Module, WebSocket, Bull |
| 2     | `refactor/jest-to-vitest`        | jest.fn() → vi.fn(), Config                       |
| 3     | `feature/sveltekit-migration`    | Pages, api-client.ts, Design System → Svelte      |
| 4     | `feature/pre-launch-polish`      | Sentry, Health Checks, Graceful Shutdown          |
| 5     | `feature/enterprise-features`    | Secrets, OpenTelemetry, SOC2                      |

### Workflow

```
master (stable)
    │
    ├── feature/fullcalendar-migration ► PR → master (ZUERST!)
    │                                        │
    │   ◄────────────────────────────────────┘
    │
    ├── feature/nestjs-migration ──────► PR → master
    │                                        │
    │   ◄────────────────────────────────────┘
    │
    ├── refactor/jest-to-vitest ───────► PR → master
    │                                        │
    │   ◄────────────────────────────────────┘
    │
    ├── feature/sveltekit-migration ───► PR → master
    │                                        │
    │   ◄────────────────────────────────────┘
    │
    └── ... (weitere Phasen)
```

### Regeln

1. **Ein Branch pro Phase** - nicht mischen
2. **Phase 0 zuerst** - FullCalendar isoliert testen (hohes Risiko!)
3. **Phase 1 vor Phase 3** - Frontend braucht stabiles Backend
4. **PR nach jeder Phase** - incremental mergen
5. **master bleibt stable** - nur getesteter Code
6. **KEIN Fallback/Legacy** - git revert bei Problemen
