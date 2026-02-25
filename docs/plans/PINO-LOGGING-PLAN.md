# Pino Logging Integration Plan

> **Status:** ✅ Phase 1-4 Complete + Grafana Cloud
> **Priority:** HIGH (Security + Production Quality)
> **Created:** 2026-01-06
> **Updated:** 2026-01-13
> **Branch:** `Alerting-und-Monitoring-Stack`
> **Related:** [ADR-002: Alerting & Monitoring](./adr/ADR-002-alerting-monitoring.md)
>
> **Progress:**
>
> - Phase 1 (Backend Pino): ✅ Complete
> - Phase 2a (Frontend Security): ✅ Complete - esbuild.drop, logger.ts, hostname fixes
> - Phase 2b (Console Migration): ✅ Complete - 334 calls → createLogger() (2026-01-13)
> - Phase 3 (Validation): ✅ Complete (manually verified)
> - Phase 4 (PLG Stack): ✅ Complete - Loki + Grafana + Prometheus + pino-loki + Grafana Cloud
> - Phase 5 (Source Maps): 🔲 Future - CI/CD Pipeline (nicht blockierend für Dev)

---

## Zusammenhang mit ADR-002 (Alerting & Monitoring)

```
┌─────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY STACK                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  LOGGING (dieser Plan)         ERROR TRACKING (ADR-002)     │
│  ══════════════════════        ═════════════════════════     │
│  Pino ersetzt Winston          Sentry SaaS                  │
│  ├── Strukturierte Logs        ├── Exception Capture        │
│  ├── Redaction (Passwords)     ├── Stack Traces             │
│  ├── Performance (5x faster)   ├── Session Replay           │
│  └── JSON Output               └── Alerting                 │
│           │                                                  │
│           │ Phase 4 (NEXT)                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  PLG STACK (ADR-002 Phase 5)                        │    │
│  │  ════════════════════════════                       │    │
│  │  pino-loki → Loki → Grafana (Log Aggregation)      │    │
│  │  Prometheus → Grafana       (Metrics)              │    │
│  │  Grafana Dashboards         (Visualization)        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Reihenfolge:
1. ✅ PINO-LOGGING-PLAN Phase 1  → Winston → Pino (Backend)
2. ✅ PINO-LOGGING-PLAN Phase 2a → Frontend Security Fixes
3. ✅ ADR-002 Sentry             → Error Tracking
4. ✅ PINO-LOGGING-PLAN Phase 4  → PLG Stack (Loki + Grafana + Prometheus)
```

**Warum Pino zuerst?**

- Sentry tracked Errors, ersetzt aber kein Logging
- PLG Stack braucht Pino-Logs (via pino-loki Transport)
- Ohne Pino keine saubere Observability

---

## IMPORTANT: Codebase Reality Check

**Verified Structure (2026-01-06):**

```
Backend:
├── src/nest/main.ts          ← NestJS entry point (NOT src/main.ts!)
├── src/nest/app.module.ts    ← Root module
├── src/utils/logger.ts       ← Winston logger ALREADY EXISTS!
└── package.json              ← Fastify 5.6.2, NestJS 11, Winston 3.19

Current State:
├── Fastify 5.6.2 (NOT 4.x!) with built-in Pino
├── Winston already configured with file transports
├── sanitizeForLog() already implemented for redaction
├── nestjs-cls already configured for request context
└── 46 files using @nestjs/common Logger
```

---

## Table of Contents

1. [Problem Analysis](#1-problem-analysis)
2. [Current Logging Architecture](#2-current-logging-architecture)
3. [Solution Architecture](#3-solution-architecture)
4. [Implementation Phases](#4-implementation-phases)
5. [Backend Integration (NestJS + Fastify)](#5-backend-integration-nestjs--fastify)
6. [Frontend Integration (SvelteKit)](#6-frontend-integration-sveltekit)
7. [Configuration Reference](#7-configuration-reference)
8. [Migration Checklist](#8-migration-checklist)
9. [Testing Strategy](#9-testing-strategy)

---

## 1. Problem Analysis

### Current State: KRITISCH

```
Production URL: http://localhost/admin-dashboard (Nginx Port 80)
Browser Console Output:
  [TokenManager] Debug mode - available as window.tokenManager
  [SessionManager] Debug mode - available as window.sessionManager
  [API Client] Debug mode - available as window.apiClient
```

### Root Causes

| Problem                       | Location                                   | Severity     |
| ----------------------------- | ------------------------------------------ | ------------ |
| Wrong environment detection   | `hostname === 'localhost'`                 | **CRITICAL** |
| No console stripping in build | vite.config.ts missing esbuild.drop        | **HIGH**     |
| 158 console.log scattered     | 51 files in frontend/src                   | **HIGH**     |
| Debug objects on window.\*    | token-manager, session-manager, api-client | **CRITICAL** |
| THREE logging systems!        | Winston + NestJS Logger + Fastify Pino     | **HIGH**     |

---

## 2. Current Logging Architecture

### Backend: THREE Systems Running!

```typescript
// 1. WINSTON (backend/src/utils/logger.ts)
// - File transports: error.log, combined.log
// - 5MB max, 5 files rotation
// - sanitizeForLog() for redaction ✓
import { logger } from '../utils/logger.js';
logger.info('Message');

// 2. NESTJS LOGGER (@nestjs/common) - Used in 46 files!
import { Logger } from '@nestjs/common';
private readonly logger = new Logger(MyService.name);
this.logger.log('Message');  // Wraps console.log!

// 3. FASTIFY PINO (src/nest/main.ts:283-288) - MINIMAL CONFIG!
new FastifyAdapter({
  logger: { level: 'warn' },  // Only warns! No transports!
  trustProxy: true,
})
```

### Existing Winston Config (backend/src/utils/logger.ts):

```typescript
const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    customFormat,
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error', maxsize: 5MB }),
    new winston.transports.File({ filename: 'combined.log', maxsize: 5MB }),
  ],
});

// Console only in development
if (process.env['NODE_ENV'] !== 'production') {
  logger.add(new winston.transports.Console({ ... }));
}

// Redaction already implemented!
export function sanitizeForLog<T>(obj: T, maxDepth = 10): T { ... }
```

### DECISION: Pino Only (Winston entfernen!)

**Warum Pino Only?**

```
Performance:
├─ Pino:    ~30,000 logs/sec
├─ Winston: ~6,000 logs/sec
└─ Pino ist 5x SCHNELLER

Architecture:
├─ Fastify lädt Pino SOWIESO (0 extra cost)
├─ Winston = redundante Dependency
├─ 2 Logger = 2 Configs = Chaos
└─ Single Source of Truth = Clean Code

Enterprise Best Practice:
├─ Native Framework Integration nutzen
├─ Minimale Dependencies
├─ Konsistente Log-Formate
└─ Maximale Performance
```

**Migration Plan:**

1. Pino konfigurieren (nutzt Fastify's built-in)
2. nestjs-pino für NestJS Logger Integration
3. Winston komplett entfernen (`pnpm remove winston`)
4. `backend/src/utils/logger.ts` durch Pino ersetzen
5. `sanitizeForLog()` Pattern in Pino's `redact` option übernehmen

### Security Risks

```typescript
// EXPOSED IN PRODUCTION:
window.tokenManager; // Token manipulation possible
window.sessionManager; // Session hijacking possible
window.apiClient; // Cache manipulation, API abuse

// LEAKED IN CONSOLE:
console.warn('[TokenManager] DEBUG - New token validity:', {
  exp,
  now,
  remaining,
  tokenPreview, // <-- Token data!
});
```

### Why Pino?

| Feature            | console.log | Pino         |
| ------------------ | ----------- | ------------ |
| Structured JSON    | No          | Yes          |
| Log Levels         | Manual      | Built-in     |
| Performance        | Blocking    | Non-blocking |
| Production Ready   | No          | Yes          |
| Request Context    | Manual      | Automatic    |
| Redaction          | No          | Built-in     |
| Transport/Shipping | No          | Yes          |

---

## 3. Solution Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      LOGGING ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FRONTEND (SvelteKit)              BACKEND (NestJS + Fastify)   │
│  ┌──────────────────┐              ┌──────────────────────────┐ │
│  │  Browser Logger  │              │  Fastify Built-in Pino   │ │
│  │  (pino browser)  │              │  + nestjs-pino           │ │
│  └────────┬─────────┘              └────────────┬─────────────┘ │
│           │                                     │               │
│           │ transmit (errors only)              │               │
│           ▼                                     ▼               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Backend Logging Endpoint                     │  │
│  │              POST /api/v2/logs                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                   │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Pino Transports                        │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │  │
│  │  │ Console │  │  File   │  │  Loki   │  │ Sentry/etc  │  │  │
│  │  │ (dev)   │  │ (prod)  │  │ (future)│  │  (future)   │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Package Selection

| Package       | Purpose                 | Version |
| ------------- | ----------------------- | ------- |
| `pino`        | Core logger             | ^9.6.0  |
| `pino-pretty` | Dev formatting (devDep) | ^13.0.0 |
| `pino-http`   | HTTP request logging    | ^10.4.0 |
| `nestjs-pino` | NestJS integration      | ^4.2.0  |

---

## 4. Implementation Phases

### Phase 1: Backend Pino Integration (Priority: HIGH)

**Goal:** Replace Winston with Pino, single logging system

**Tasks:**

- [ ] Install pino packages: `pnpm add pino-http nestjs-pino && pnpm add -D pino-pretty`
- [ ] **REMOVE Winston:** `pnpm remove winston`
- [ ] Configure Fastify built-in Pino logger in `src/nest/main.ts`
- [ ] Integrate nestjs-pino for NestJS Logger replacement
- [ ] Replace `backend/src/utils/logger.ts` (Winston → Pino)
- [ ] Migrate `sanitizeForLog()` to Pino's `redact` option
- [ ] Configure transports: console (dev), file (prod) via pino-roll
- [ ] Update all imports from `../utils/logger.js` to new Pino logger

**Files to modify:**

```
backend/
├── src/
│   ├── nest/
│   │   ├── main.ts                    # Fastify Pino config (CORRECT PATH!)
│   │   ├── app.module.ts              # Add LoggerModule
│   │   └── common/
│   │       └── logger/
│   │           ├── logger.module.ts   # NEW: nestjs-pino config
│   │           └── logger.constants.ts # NEW: redact paths, levels
│   └── utils/
│       └── logger.ts                  # REPLACE: Winston → Pino export
└── package.json                       # Remove winston, add pino packages
```

**Winston → Pino Migration Table:**
| Winston Code | Pino Replacement |
|--------------|------------------|
| `logger.info(msg)` | `logger.info(msg)` (same API!) |
| `logger.error(msg, err)` | `logger.error({ err }, msg)` (object first!) |
| `sanitizeForLog(obj)` | Built-in `redact` option |
| `transports.File` | `pino.transport({ target: 'pino/file' })` |
| `transports.Console` | `pino-pretty` (dev only) |

### Phase 2: Frontend Logger Utility (Priority: HIGH)

**Goal:** Create environment-aware logger that strips in production

**Tasks:**

- [ ] Create `src/lib/utils/logger.ts` utility
- [ ] Use `import.meta.env.DEV` for environment detection
- [ ] Configure Pino browser with transmit for errors
- [ ] Add vite.config.ts console stripping
- [ ] Remove window.\* debug object exposure

**Files to modify:**

```
frontend/
├── src/lib/utils/
│   ├── logger.ts                  # NEW - Central logger
│   ├── token-manager.ts           # Remove window.* exposure
│   ├── session-manager.ts         # Remove window.* exposure
│   └── api-client.ts              # Remove window.* exposure
├── vite.config.ts                 # Add esbuild.drop
└── package.json                   # Add pino (browser bundle)
```

### Phase 3: Console.log Migration (Priority: MEDIUM)

**Goal:** Replace all 158 console.log calls with logger

**Tasks:**

- [ ] Create ESLint rule to ban console.\*
- [ ] Run migration script or manual replacement
- [ ] Categorize logs by level (debug, info, warn, error)
- [ ] Add context to logs (component name, operation)

### Phase 4: Production Hardening (Priority: MEDIUM)

**Goal:** Ensure zero debug output in production

**Tasks:**

- [ ] Verify esbuild.drop works in production build
- [ ] Test transmit endpoint for frontend errors
- [ ] Add log rotation for file transport
- [ ] Configure log retention policy
- [ ] Add health check for logging system

---

## 5. Backend Integration (NestJS + Fastify)

### 5.1 Package Installation

```bash
cd backend

# Step 1: REMOVE Winston (dead code!)
pnpm remove winston

# Step 2: Install Pino packages
# Note: pino is already included via Fastify, but we need:
# - nestjs-pino: NestJS integration
# - pino-http: HTTP request logging (used by nestjs-pino)
# - pino-pretty: Dev formatting (devDep)
# - pino-roll: File rotation (prod)
pnpm add nestjs-pino pino-http pino-roll
pnpm add -D pino-pretty
```

### 5.2 Fastify Logger Configuration

```typescript
// src/nest/main.ts (CORRECT PATH!)
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import type { PinoLoggerOptions } from 'fastify/types/logger.js';
import { Logger } from 'nestjs-pino';

// Redaction paths - migrate from sanitizeForLog()
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.confirmPassword',
  'req.body.refreshToken',
  'req.body.accessToken',
];

// Pino logger configuration
const loggerConfig: PinoLoggerOptions = {
  level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',

  // Pretty print only in development
  transport:
    process.env['NODE_ENV'] !== 'production' ?
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : {
        // Production: file transport with rotation
        target: 'pino-roll',
        options: {
          file: './logs/app',
          frequency: 'daily',
          mkdir: true,
          size: '10m',
        },
      },

  // Redaction (replaces sanitizeForLog!)
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
};

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    logger: loggerConfig,
    trustProxy: true, // For Docker/Nginx
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { bufferLogs: true });

  // Use nestjs-pino as NestJS logger (replaces @nestjs/common Logger)
  app.useLogger(app.get(Logger));

  // ... rest of setup (security, middleware, etc.)

  await app.listen({ port: 3000, host: '0.0.0.0' });
}
```

### 5.3 NestJS Module Configuration

```typescript
// src/common/logger/logger.module.ts
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      useFactory: () => ({
        pinoHttp: {
          // Use existing Fastify logger
          useExisting: true,

          // Custom log level per status code
          customLogLevel: (req, res, err) => {
            if (res.statusCode >= 500 || err) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
          },

          // Custom success message
          customSuccessMessage: (req, res) => {
            return `${req.method} ${req.url} completed`;
          },

          // Custom error message
          customErrorMessage: (req, res, err) => {
            return `${req.method} ${req.url} failed: ${err.message}`;
          },

          // Auto-logging for all routes
          autoLogging: true,

          // Serializers
          serializers: {
            req: (req) => ({
              method: req.method,
              url: req.url,
              query: req.query,
              params: req.params,
              // Body logged separately after parsing
            }),
            res: (res) => ({
              statusCode: res.statusCode,
            }),
          },
        },

        // Exclude health checks from logging
        exclude: [
          { method: 'GET', path: '/health' },
          { method: 'GET', path: '/api/v2/health' },
        ],
      }),
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
```

### 5.4 Usage in Services

```typescript
// Option 1: Standard NestJS Logger (Recommended)
import { Logger, Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async createUser(dto: CreateUserDto): Promise<User> {
    this.logger.log(`Creating user: ${dto.email}`);

    try {
      const user = await this.userRepository.create(dto);
      this.logger.log(`User created: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`Failed to create user: ${dto.email}`, error.stack);
      throw error;
    }
  }
}

// Option 2: PinoLogger (Direct Pino API)
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class UserService {
  constructor(
    @InjectPinoLogger(UserService.name)
    private readonly logger: PinoLogger,
  ) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    this.logger.info({ email: dto.email }, 'Creating user');
    // Pino convention: object first, message second
  }
}
```

---

## 6. Frontend Integration (SvelteKit)

### 6.1 Package Installation

```bash
cd frontend
pnpm add pino
pnpm add -D pino-pretty
```

### 6.2 Central Logger Utility

```typescript
// src/lib/utils/logger.ts
import { browser } from '$app/environment';

import pino from 'pino';

/**
 * Environment-aware logger for SvelteKit
 *
 * CRITICAL: Uses import.meta.env.DEV for build-time detection
 * - Development: Full logging to console
 * - Production: Only errors transmitted to backend
 */

// Determine log level based on environment
const getLogLevel = (): pino.Level => {
  if (!browser) return 'info'; // SSR: info level
  if (import.meta.env.DEV) return 'debug'; // Dev: all logs
  return 'warn'; // Prod: warnings and errors only
};

// Create browser-specific configuration
const browserConfig: pino.LoggerOptions['browser'] =
  browser ?
    {
      asObject: true,

      // Custom formatting for development
      formatters: {
        level: (label) => ({ level: label }),
      },

      // Development: use console methods
      // Production: silent (only transmit errors)
      write:
        import.meta.env.DEV ?
          {
            debug: (o) => console.debug('[DEBUG]', o),
            info: (o) => console.info('[INFO]', o),
            warn: (o) => console.warn('[WARN]', o),
            error: (o) => console.error('[ERROR]', o),
            fatal: (o) => console.error('[FATAL]', o),
          }
        : undefined,

      // Production: transmit errors to backend
      transmit:
        import.meta.env.PROD ?
          {
            level: 'error',
            send: async (level, logEvent) => {
              try {
                await fetch('/api/v2/logs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    level: logEvent.level.label,
                    timestamp: logEvent.ts,
                    messages: logEvent.messages,
                    bindings: logEvent.bindings,
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                  }),
                });
              } catch {
                // Silently fail - don't cause errors from logging
              }
            },
          }
        : undefined,

      // Disable all browser logging in production
      disabled: import.meta.env.PROD,
    }
  : undefined;

// Create the logger instance
const pinoLogger = pino({
  level: getLogLevel(),
  browser: browserConfig,

  // Base fields included in every log
  base:
    browser ?
      {
        env: import.meta.env.DEV ? 'development' : 'production',
      }
    : undefined,
});

/**
 * Application Logger
 *
 * Usage:
 *   import { logger } from '$lib/utils/logger';
 *
 *   logger.debug('Debugging info');
 *   logger.info({ userId: 123 }, 'User logged in');
 *   logger.warn('Deprecated API used');
 *   logger.error({ err }, 'Request failed');
 */
export const logger = pinoLogger;

/**
 * Create a child logger with component context
 *
 * Usage:
 *   const log = createLogger('TokenManager');
 *   log.info('Token refreshed');
 *   // Output: { context: 'TokenManager', msg: 'Token refreshed', ... }
 */
export function createLogger(context: string): pino.Logger {
  return pinoLogger.child({ context });
}

/**
 * SSR-safe check for development mode
 * Use this instead of hostname checks!
 */
export const isDev = import.meta.env.DEV;

/**
 * SSR-safe check for production mode
 */
export const isProd = import.meta.env.PROD;
```

### 6.3 Vite Console Stripping

```typescript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), sveltekit()],

  // ... existing config ...

  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('@event-calendar/')) return 'calendar';
          if (id.includes('marked')) return 'markdown';
          if (id.includes('dompurify')) return 'sanitize';
        },
      },
    },
    chunkSizeWarningLimit: 850,
  },

  // CRITICAL: Strip console.* in production builds
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    // Keep console.error and console.warn if needed:
    // pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
  },
}));
```

### 6.4 Fix Security Exposures

```typescript
// AFTER (FIXED):
import { createLogger, isDev } from './logger';

// src/lib/utils/token-manager.ts

// BEFORE (BROKEN):
if (isBrowser()) {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    (window as any).tokenManager = TokenManager.getInstance();
    console.info('[TokenManager] Debug mode...');
  }
}

const log = createLogger('TokenManager');

// Only expose in development builds (NOT runtime hostname check!)
if (isDev && typeof window !== 'undefined') {
  (window as unknown as { tokenManager: TokenManager }).tokenManager = TokenManager.getInstance();
  log.debug('Debug mode - available as window.tokenManager');
}
```

### 6.5 Usage Examples

```typescript
// In components/services
import { createLogger, logger } from '$lib/utils/logger';

// Simple logging
logger.info('Application started');
logger.warn({ deprecatedApi: 'v1' }, 'Using deprecated API');
logger.error({ err: error }, 'Request failed');

// With context (recommended for services)
const log = createLogger('SessionManager');
log.info('Session initialized');
log.debug({ remaining: 300 }, 'Token expiring soon');

// Conditional debug (automatically stripped in production)
if (import.meta.env.DEV) {
  log.debug({ tokenPreview: token.slice(0, 20) }, 'Token details');
}
```

---

## 7. Configuration Reference

### Log Levels

| Level    | Value    | Usage                              |
| -------- | -------- | ---------------------------------- |
| `fatal`  | 60       | System crash, unrecoverable        |
| `error`  | 50       | Operation failed, needs attention  |
| `warn`   | 40       | Deprecated, unusual but handled    |
| `info`   | 30       | Normal operations, business events |
| `debug`  | 20       | Detailed technical info            |
| `trace`  | 10       | Very verbose, step-by-step         |
| `silent` | Infinity | Disable all logging                |

### Environment Configuration

| Environment | Backend Level | Frontend Level         | Console Stripping |
| ----------- | ------------- | ---------------------- | ----------------- |
| Development | debug         | debug                  | No                |
| Production  | info          | warn (transmit errors) | Yes               |
| Test        | silent        | silent                 | Yes               |

### Redaction Paths (Backend)

```typescript
const redactPaths = [
  // Auth headers
  'req.headers.authorization',
  'req.headers.cookie',

  // Auth body fields
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.confirmPassword',
  'req.body.refreshToken',
  'req.body.accessToken',

  // Response tokens
  'res.body.accessToken',
  'res.body.refreshToken',
  'res.body.data.accessToken',
  'res.body.data.refreshToken',
];
```

---

## 8. Migration Checklist

### Phase 1: Backend (Winston → Pino Migration) - ✅ COMPLETE

- [x] **REMOVE Winston:** `cd backend && pnpm remove winston`
- [x] Install packages: `pnpm add pino-http nestjs-pino && pnpm add -D pino-pretty pino-roll`
- [x] Configure Fastify logger in `src/nest/main.ts`
- [x] Create `src/nest/common/logger/logger.module.ts` with nestjs-pino
- [x] Add `LoggerModule` to `AppModule` imports
- [x] Replace `backend/src/utils/logger.ts`:
  - [x] Remove Winston imports
  - [x] Export Pino logger instance
  - [x] Convert `sanitizeForLog()` to Pino `redact` paths
- [x] Update Winston logger imports (only 5 files!):
  - [x] `src/config/database.ts`
  - [x] `src/config/redis.ts`
  - [x] `src/services/tenantDeletion.service.ts`
  - [x] `src/services/hierarchyPermission.service.ts`
  - [x] `src/workers/deletionWorker.ts`
- [x] Replace @nestjs/common Logger calls in 46 files (optional - nestjs-pino handles this)
- [x] Add redaction for sensitive fields (passwords, tokens, cookies)
- [x] Test request logging with pino-pretty
- [x] Verify file transport works in production

**Note:** Pino redaction wildcards (`*.password`) only match ONE level deep. Added multi-level paths (`*.*.password`, `*.*.*.password`) for 4 levels deep coverage.

### Phase 2: Frontend - ✅ SECURITY FIXES COMPLETE (2026-01-12)

**Phase 2a: Critical Security Fixes - ✅ COMPLETE**

- [x] Install packages: `pino@10.1.1`
- [x] Create `src/lib/utils/logger.ts` - Central logging utility with:
  - [x] Environment-aware logging (`import.meta.env.DEV`)
  - [x] Pino-based for backend consistency
  - [x] `createLogger(context)` for child loggers
  - [x] `isDev` / `isProd` exports for SSR-safe checks
- [x] Update `vite.config.ts` with `esbuild.drop: ['console', 'debugger']`
  - Strips ALL 331 console.\* calls from production bundle!
- [x] Fix security exposures (hostname check → `import.meta.env.DEV`):
  - [x] `token-manager.ts:580` - window.tokenManager now dev-only
  - [x] `session-manager.ts:730` - window.sessionManager now dev-only
  - [x] `session-manager.ts:40` - DEBUG_MODE now build-time check
  - [x] `api-client.ts` - No exposure found (already secure)
- [x] Add ESLint exception for `logger.ts` in `eslint.config.mjs`
  - Rule `no-console` still enforced everywhere else
  - Logger utility is the ONE place that should use console.\*

**Phase 2b: Console Migration - 🔄 HIGH PRIORITY (Best Practice)**

**Status:** IN PROGRESS - 334 calls in 97 files

**Why HIGH Priority?**

- Best Practice: Strukturierte Logs statt lose console.\* Calls
- Konsistenz: Gleiche Logging-API wie Backend (Pino)
- Filterbar: Logs haben Context (Komponente/Service)
- Zukunftssicher: Bereits für Loki-Integration vorbereitet

**Files to Migrate:**

```
lib/utils/          8 files  (api-client, token-manager, session-manager, etc.)
lib/components/     1 file   (RoleSwitch.svelte)
lib/stores/         1 file   (toast.ts)
hooks/              2 files  (hooks.client.ts, instrumentation.server.ts)
routes/(app)/      ~85 files (+page.server.ts, +page.svelte, _lib/*.ts)
routes/other/       4 files  (login, sentry-tunnel, tenant-deletion)
```

**Migration Pattern:**

```typescript
// AFTER
import { createLogger } from '$lib/utils/logger';

// BEFORE
console.log('[MyService] Some message', data);
console.error('[MyService] Error:', error);

const log = createLogger('MyService');
log.info({ data }, 'Some message');
log.error({ err: error }, 'Error occurred');
```

**Tasks:**

- [ ] Migrate lib/utils/\*.ts (8 files)
- [ ] Migrate lib/components/\*.svelte (1 file)
- [ ] Migrate lib/stores/\*.ts (1 file)
- [ ] Migrate hooks + instrumentation (2 files)
- [ ] Migrate routes/(app)/\*_/_.server.ts (30+ files)
- [ ] Migrate routes/(app)/\*_/_.svelte (20+ files)
- [ ] Migrate routes/(app)/\*_/\_lib/_.ts (25+ files)
- [ ] Migrate remaining routes (login, sentry, etc.)
- [ ] Run ESLint to verify no console.\* remaining
- [ ] Update ESLint to enforce no-console rule project-wide

**Files Modified (Phase 2a):**

```
frontend/
├── vite.config.ts                    # esbuild.drop for production
├── eslint.config.mjs                 # Exception for logger.ts
├── package.json                      # Added pino@10.1.1
└── src/lib/utils/
    ├── logger.ts                     # NEW: Central logging utility
    ├── token-manager.ts              # Fixed: import.meta.env.DEV
    └── session-manager.ts            # Fixed: import.meta.env.DEV (2 places)
```

### Phase 3: Validation - ✅ COMPLETE (2026-01-13)

- [x] Run production build and verify console stripping
- [x] Check browser console is empty (except errors)
- [x] Verify window.\* objects not exposed in production
- [x] Check backend logs are structured JSON
- [x] Verify sensitive data is redacted
- [x] Performance test (logging overhead)

**Verified by:** Manual testing (user confirmed)

### Phase 4: PLG Stack (Loki + Grafana + Prometheus) - ✅ COMPLETE (2026-01-12)

**Ziel:** Pino-Logs zentral in Grafana durchsuchbar + System-Metrics

**Phase 4a: Docker Compose + Loki + Grafana** ✅

- [x] Loki Container zu docker-compose.yml hinzufügen
- [x] Grafana Container zu docker-compose.yml hinzufügen
- [x] Loki als Data Source in Grafana konfigurieren
- [x] Test: Loki empfängt Logs

**Phase 4b: pino-loki Transport** ✅

- [x] `pnpm add pino-loki` im Backend
- [x] Pino Transport konfigurieren (→ Loki lokal + Grafana Cloud)
- [x] Logs erscheinen in Grafana (lokal + Cloud)

**Phase 4c: Prometheus Metrics** ✅

- [x] Prometheus Container zu docker-compose.yml hinzufügen
- [x] `@willsoto/nestjs-prometheus` im Backend
- [x] `/api/v2/metrics` Endpoint in NestJS exponieren
- [x] Prometheus scrapet Backend
- [x] Prometheus als Data Source in Grafana
- [x] remote_write zu Grafana Cloud konfiguriert

**Phase 4d: Grafana Dashboards** ✅

- [x] Custom Assixx Backend Overview Dashboard erstellt (assixx-overview.json)
- [x] Custom Assixx Full Dashboard mit Logs erstellt (assixx-full-dashboard.json)
- [x] Grafana Cloud Integration konfiguriert

**Phase 4e: Grafana Cloud** ✅

- [x] Grafana Cloud Account erstellt (assixxdev Stack)
- [x] API Token mit logs:write + metrics:write Scopes
- [x] Prometheus remote_write konfiguriert
- [x] pino-loki sendet an Grafana Cloud Loki
- [x] Dashboards verfügbar unter https://assixxdev.grafana.net

**Container:**
| Container | Image | Port | RAM |
|-----------|-------|------|-----|
| assixx-loki | grafana/loki:3.x | 3100 | 1-2 GB |
| assixx-grafana | grafana/grafana:11.x | 3050 | 512 MB |
| assixx-prometheus | prom/prometheus:3.x | 9090 | 1-2 GB |

**Datenfluss:**

```
Pino (Backend) → pino-loki → Loki:3100 (lokal) → Grafana:3050 (lokal)
                    ↓
              Grafana Cloud Loki → Grafana Cloud (assixxdev.grafana.net)
                                              ↑
Prometheus:9090 → remote_write → Grafana Cloud Prometheus
```

### Phase 5: Sentry Source Maps - 🔲 FUTURE (CI/CD)

**Status:** Nicht blockierend für Entwicklung

**Was sind Source Maps?**
Source Maps ermöglichen Sentry, minified Stack Traces zurück zum Original-Code zu mappen:

```
// OHNE Source Maps (minified)
Error: Cannot read property 'user' of undefined
    at e.value (app-DxK3j2Ls.js:1:45892)

// MIT Source Maps (original)
Error: Cannot read property 'user' of undefined
    at UserService.getCurrentUser (src/lib/services/user-service.ts:47:12)
```

**Warum später?**

- Erfordert CI/CD Pipeline (GitHub Actions, etc.)
- Manueller Upload bei jedem Build unpraktisch
- Sentry funktioniert auch ohne (nur weniger hilfreiche Stack Traces)

**Implementation (wenn CI/CD bereit):**

```bash
# In CI/CD Pipeline nach dem Build:
npx @sentry/cli sourcemaps upload \
  --org your-org \
  --project assixx-frontend \
  --release $GIT_SHA \
  ./frontend/build
```

**Tasks (Future):**

- [ ] CI/CD Pipeline aufsetzen (GitHub Actions)
- [ ] Sentry CLI konfigurieren
- [ ] Source Maps Upload in Pipeline integrieren
- [ ] Release Tracking aktivieren

---

## 9. Testing Strategy

### Backend Tests

```typescript
// Test log redaction
it('should redact password from logs', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v2/auth/login')
    .send({ email: 'test@test.com', password: 'secret123' });

  // Check logs don't contain password
  expect(logOutput).not.toContain('secret123');
  expect(logOutput).toContain('[REDACTED]');
});

// Test log levels
it('should log errors for 5xx responses', async () => {
  // Trigger 500 error
  // Verify error level log was created
});
```

### Frontend Tests

```bash
# Build production and check for console statements
pnpm run build
grep -r "console\." frontend/build/

# Should return empty or only legitimate console.error for critical issues
```

### Manual Verification

1. **Development Mode:**

   ```bash
   pnpm run dev:svelte
   # Open http://localhost:5173
   # Check console shows debug logs
   # Check window.tokenManager exists (OK in dev)
   ```

2. **Production Mode:**
   ```bash
   docker-compose --profile production up -d
   # Open http://localhost/admin-dashboard
   # Check console is EMPTY
   # Check window.tokenManager is undefined
   ```

---

## References

- [Pino Documentation](https://getpino.io/)
- [Pino GitHub](https://github.com/pinojs/pino)
- [Pino Browser Docs](https://github.com/pinojs/pino/blob/main/docs/browser.md)
- [Pino API Reference](https://github.com/pinojs/pino/blob/main/docs/api.md)
- [nestjs-pino](https://github.com/iamolegga/nestjs-pino)
- [Fastify Logging](https://fastify.dev/docs/latest/Reference/Logging/)
- [Better Stack Pino Guide](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/)

---

**Last Updated:** 2026-01-13
**Author:** Assixx
**Version:** 2.1.0 - Phase 2b Console Migration (HIGH Priority)
