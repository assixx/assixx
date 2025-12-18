# Fastify Migration Plan

**Status:** ✅ COMPLETE | **Branch:** `feature/nestjs-migration`
**Completed:** 2025-12-18

## WARUM FASTIFY v5 (nicht v4)

| Version | LTS Ende | Node.js | Empfehlung |
|---------|----------|---------|------------|
| v4 | **2025-06-30** (6 Monate!) | 18+ | ❌ EOL bald |
| v5 | TBD (aktuell) | **20+** | ✅ Verwenden |

Wir haben Node 24.12.0 → v5 ist die richtige Wahl.
Quelle: https://fastify.dev/docs/latest/Reference/LTS/

---

## AKTUELLER ZUSTAND (main.ts)

```
backend/src/nest/main.ts (202 Zeilen):
- Zeile 9:   import type { NestExpressApplication }
- Zeile 11:  import express from 'express'
- Zeile 12:  import helmet from 'helmet'
- Zeile 27:  NestFactory.create<NestExpressApplication>
- Zeile 35:  expressApp.get('/health', ...)
- Zeile 61-71: express.static() für /css, /js, /images, /fonts, /assets, /scripts, /uploads
- Zeile 91-161: 47 HTML-Routes via expressApp.get('/${route}', ...)
- Zeile 166: app.use(helmet())
- Zeile 167: app.use(cookieParser())
- Zeile 187: app.set('trust proxy', 1)
```

---

## PHASE 1: Packages

```bash
# Im Container ausführen:
docker exec -it assixx-backend sh -c "
  pnpm add @nestjs/platform-fastify@^11 fastify@^5 \
    @fastify/static @fastify/helmet @fastify/cookie \
    @fastify/multipart fastify-multer \
    @webundsoehne/nest-fastify-file-upload
"
```

**WICHTIG für Fastify v5:**
- `@webundsoehne/nest-fastify-file-upload` ist NestJS 7-11 + Fastify 3-5 kompatibel
- Bei Fastify v5: KEIN FastifyMulterModule importieren!
- Stattdessen: `@fastify/multipart` direkt in main.ts registrieren

**NICHT entfernen bis Migration complete:** express, @nestjs/platform-express, multer

---

## PHASE 2: main.ts komplett ersetzen

```typescript
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyStatic from '@fastify/static';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import path from 'path';
import 'reflect-metadata';

import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: ['error', 'warn'], trustProxy: true })
  );

  const fastify = app.getHttpAdapter().getInstance();

  // Paths (Docker: cwd = /app/backend)
  const projectRoot = path.resolve(process.cwd(), '..');
  const distPath = path.join(projectRoot, 'frontend/dist');
  const pagesPath = path.join(distPath, 'pages');

  // Security + Cookies + Multipart (File Upload)
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await app.register(fastifyCookie);
  await app.register(import('@fastify/multipart')); // WICHTIG für File Uploads!

  // Static Files - EINE Registration mit wildcards
  await app.register(fastifyStatic, {
    root: distPath,
    prefix: '/',
    decorateReply: false,
  });

  // Health Check (außerhalb /api/v2)
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    framework: 'NestJS+Fastify',
  }));

  // HTML Routes - Fastify wildcard
  fastify.get('/:page', async (request, reply) => {
    const page = (request.params as { page: string }).page;
    if (!page.includes('.')) { // Keine Dateiendung = HTML-Seite
      return reply.sendFile(`pages/${page}.html`);
    }
  });
  fastify.get('/', async (_req, reply) => reply.sendFile('pages/index.html'));

  // Global Config
  app.setGlobalPrefix('api/v2');
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // WICHTIG: 0.0.0.0 für Docker! (v5 Syntax mit Object)
  await app.listen({ port: 3000, host: '0.0.0.0' });
  logger.log('NestJS+Fastify running on port 3000');
}

bootstrap().catch(console.error);
```

---

## PHASE 3: Controller @Req/@Res ändern

**Grep-Befehl zum Finden:**
```bash
grep -rn "@Req\|@Res" backend/src/nest --include="*.ts"
```

**Änderungen (19 Stellen):**

| Datei:Zeile | VON | ZU |
|-------------|-----|-----|
| auth.controller.ts:93 | `@Req() req: Request` | `@Req() req: FastifyRequest` |
| auth.controller.ts:145 | `@Req() req: Request` | `@Req() req: FastifyRequest` |
| signup.controller.ts:46 | `@Req() req: Request` | `@Req() req: FastifyRequest` |
| root.controller.ts:295 | `@Req() req: Request` | `@Req() req: FastifyRequest` |
| root.controller.ts:327 | `@Req() req: Request` | `@Req() req: FastifyRequest` |
| audit-trail.controller.ts:175-176 | `Request, Response` | `FastifyRequest, FastifyReply` |
| audit-trail.controller.ts:209 | `@Req() req: Request` | `@Req() req: FastifyRequest` |
| documents.controller.ts:281,301 | `@Res() res: Response` | `@Res() res: FastifyReply` |
| users.controller.ts:289 | `@Res() res: Response` | `@Res() res: FastifyReply` |
| surveys.controller.ts:307 | `@Res() res: Response` | `@Res() res: FastifyReply` |
| shifts.controller.ts:264 | `@Res() res: Response` | `@Res() res: FastifyReply` |
| calendar.controller.ts:118 | `@Res() res: Response` | `@Res() res: FastifyReply` |
| kvp.controller.ts:342 | `@Res() res: Response` | `@Res() res: FastifyReply` |
| blackboard.controller.ts:407,431,455 | `@Res() res: Response` | `@Res() res: FastifyReply` |
| reports.controller.ts:141 | `@Res() res: Response` | `@Res() res: FastifyReply` |

**Import ändern in JEDER Datei:**
```typescript
// ENTFERNEN:
import { Request, Response } from 'express';
// HINZUFÜGEN:
import { FastifyRequest, FastifyReply } from 'fastify';
```

**ACHTUNG res.sendFile() → reply.send(createReadStream()):**
```typescript
// VON (Express):
res.sendFile(filePath);

// ZU (Fastify):
import { createReadStream } from 'fs';
reply.type('application/octet-stream').send(createReadStream(filePath));
```

---

## PHASE 4: FileInterceptor (5 Controller)

**Import ändern:**
```typescript
// VON:
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';

// ZU:
import { FileInterceptor, FilesInterceptor } from '@webundsoehne/nest-fastify-file-upload';
import { diskStorage, memoryStorage } from 'fastify-multer';
```

**Dateien:**
- `kvp.controller.ts:37,39` - FilesInterceptor + memoryStorage
- `documents.controller.ts:35,37` - FileInterceptor + memoryStorage
- `users.controller.ts:41,43` - FileInterceptor + diskStorage
- `chat.controller.ts:23,26` - FileInterceptor + beide
- `blackboard.controller.ts:47,49` - FileInterceptor + memoryStorage

**KEIN FastifyMulterModule bei Fastify v5!** - @fastify/multipart in main.ts reicht.

---

## PHASE 5: Verifikation

```bash
# 1. Build
docker exec assixx-backend pnpm run build

# 2. Type-Check
docker exec assixx-backend pnpm run typecheck

# 3. Restart
cd docker && docker-compose restart backend

# 4. Health Check
curl http://localhost:3000/health
# Erwartung: {"status":"ok","framework":"NestJS+Fastify"}

# 5. Static File
curl -I http://localhost:3000/login
# Erwartung: 200 OK, Content-Type: text/html

# 6. API Auth
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.de","password":"test"}'

# 7. File Upload Test (nach Login)
# Bruno: blackboard attachment upload

# 8. Full API Test
pnpm run test:api
```

---

## GOTCHAS

| Problem | Lösung |
|---------|--------|
| `app.use()` funktioniert nicht | Fastify: `app.register()` |
| `res.sendFile()` fehlt | `reply.send(createReadStream(path))` |
| `express.static()` | `@fastify/static` mit `root` option |
| Trust Proxy | `new FastifyAdapter({ trustProxy: true })` |
| Middleware | `@fastify/middie` oder Fastify Hooks |
| File nicht gefunden | Pfade prüfen, `decorateReply: false` setzen |

**Fastify v5 spezifisch:**

| v4 (alt) | v5 (neu) |
|----------|----------|
| `app.listen(3000, '0.0.0.0')` | `app.listen({ port: 3000, host: '0.0.0.0' })` |
| `request.connection` | `request.socket` |
| `reply.getResponseTime()` | `reply.elapsedTime` |
| `logger: customLogger` | `loggerInstance: customLogger` |

---

## NACH ERFOLG ✅ ALL DONE (2025-12-18)

1. ✅ `pnpm remove @nestjs/platform-express express @types/express multer @types/multer` - Entfernt (14 Dependencies)
2. ✅ NESTJS-MIGRATION-PLAN.md → Phase 8 COMPLETE
3. ✅ OPTIMAL-SETUP.md → Backend Framework ✅ DONE
4. ✅ chat.module.ts - MulterModule Import entfernt (nutzt jetzt @fastify/multipart aus main.ts)
